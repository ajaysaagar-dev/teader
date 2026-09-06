'use client';

import React, { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import {
  Mic,
  MicOff,
  Volume2,
  VolumeX,
  PhoneOff,
  Settings,
  Radio,
  Sliders,
  AlertCircle,
  Headphones,
  Signal,
  Wifi,
  WifiOff,
} from 'lucide-react';
import { toast } from 'sonner';
import { useRealtimeSubscription, publishClientRealtimeEvent, RealtimeEvent } from '@/lib/useRealtime';

export interface MeetingParticipant {
  peerId: string;
  userId: number | string;
  userName: string;
  userAvatar?: string;
  userEmail?: string;
  isMuted: boolean;
  isDeafened: boolean;
  isSpeaking: boolean;
  joinedAt: number;
  lastSeen: number;
}

interface ProjectMeetingViewProps {
  projectId: string | number;
  projectName: string;
  currentUser: {
    id: number | string;
    name?: string;
    username?: string;
    avatar?: string;
    email?: string;
  } | null;
  onLeaveMeeting?: () => void;
}

// ICE servers — Google STUN + Cloudflare STUN for resilience
const ICE_SERVERS: RTCConfiguration = {
  iceServers: [
    { urls: 'stun:stun.l.google.com:19302' },
    { urls: 'stun:stun1.l.google.com:19302' },
    { urls: 'stun:stun2.l.google.com:19302' },
    { urls: 'stun:stun3.l.google.com:19302' },
    { urls: 'stun:stun.cloudflare.com:3478' },
  ],
  iceCandidatePoolSize: 10,
  bundlePolicy: 'max-bundle',
  rtcpMuxPolicy: 'require',
};

// VAD threshold — anything above -42 dBFS is considered speaking
const SPEAKING_RMS_THRESHOLD = 0.008;

export const ProjectMeetingView: React.FC<ProjectMeetingViewProps> = ({
  projectId,
  projectName,
  currentUser,
  onLeaveMeeting,
}) => {
  // ─── Stable peer identity (persists across re-renders) ───────────────────
  const localPeerIdRef = useRef<string>(
    `peer_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`
  );
  const localPeerId = localPeerIdRef.current;

  // ─── UI State ────────────────────────────────────────────────────────────
  const [isConnected, setIsConnected] = useState(false);
  const [isConnecting, setIsConnecting] = useState(true);
  const [permissionError, setPermissionError] = useState<string | null>(null);
  const [meetingDuration, setMeetingDuration] = useState(0);
  const [autoplayBlocked, setAutoplayBlocked] = useState(false);
  const [isMuted, setIsMuted] = useState(false);
  const [isDeafened, setIsDeafened] = useState(false);
  const [localSpeaking, setLocalSpeaking] = useState(false);
  const [localVolumeLevel, setLocalVolumeLevel] = useState(0);
  const [audioInputDevices, setAudioInputDevices] = useState<MediaDeviceInfo[]>([]);
  const [audioOutputDevices, setAudioOutputDevices] = useState<MediaDeviceInfo[]>([]);
  const [selectedInputId, setSelectedInputId] = useState<string>('');
  const [selectedOutputId, setSelectedOutputId] = useState<string>('');
  const [showDeviceSettings, setShowDeviceSettings] = useState(false);
  const [participants, setParticipants] = useState<MeetingParticipant[]>([]);
  const [remoteSpeaking, setRemoteSpeaking] = useState<Record<string, boolean>>({});
  const [remoteStreams, setRemoteStreams] = useState<Record<string, MediaStream>>({});
  const [pcStates, setPcStates] = useState<Record<string, RTCPeerConnectionState>>({});

  // ─── Refs (avoid stale closures inside callbacks/effects) ────────────────
  const isMutedRef = useRef(false);
  const isDeafenedRef = useRef(false);
  const localSpeakingRef = useRef(false);
  const selectedOutputIdRef = useRef('');

  // Keep refs in sync every render
  isMutedRef.current = isMuted;
  isDeafenedRef.current = isDeafened;
  localSpeakingRef.current = localSpeaking;
  selectedOutputIdRef.current = selectedOutputId;

  // ─── Audio refs ──────────────────────────────────────────────────────────
  const localStreamRef = useRef<MediaStream | null>(null);
  const localAudioCtxRef = useRef<AudioContext | null>(null);
  const localAnalyserRef = useRef<AnalyserNode | null>(null);
  const localVadIntervalRef = useRef<NodeJS.Timeout | null>(null);

  // ─── WebRTC refs ─────────────────────────────────────────────────────────
  const pcsRef = useRef<Map<string, RTCPeerConnection>>(new Map());
  const audioElemsRef = useRef<Map<string, HTMLAudioElement>>(new Map());
  const analysersRef = useRef<Map<string, { ctx: AudioContext; analyser: AnalyserNode; src: MediaStreamAudioSourceNode }>>(new Map());
  const pendingCandidatesRef = useRef<Map<string, RTCIceCandidateInit[]>>(new Map());
  const seenCandidatesRef = useRef<Map<string, Set<string>>>(new Map());
  // Perfect-negotiation per-peer state
  const makingOfferRef = useRef<Map<string, boolean>>(new Map());
  const ignoreOfferRef = useRef<Map<string, boolean>>(new Map());

  // ─── Meeting Timer ───────────────────────────────────────────────────────
  useEffect(() => {
    const t = setInterval(() => setMeetingDuration(d => d + 1), 1000);
    return () => clearInterval(t);
  }, []);

  const formattedTimer = useMemo(() => {
    const mins = Math.floor(meetingDuration / 60);
    const secs = meetingDuration % 60;
    const hrs = Math.floor(mins / 60);
    if (hrs > 0) {
      return `${String(hrs).padStart(2, '0')}:${String(mins % 60).padStart(2, '0')}:${String(secs).padStart(2, '0')}`;
    }
    return `${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}`;
  }, [meetingDuration]);

  // ─── Unlock AudioContext on first user gesture ────────────────────────────
  const unlockAudio = useCallback(() => {
    setAutoplayBlocked(false);
    audioElemsRef.current.forEach(el => el.play().catch(() => {}));
    if (localAudioCtxRef.current?.state === 'suspended') {
      localAudioCtxRef.current.resume().catch(() => {});
    }
    analysersRef.current.forEach(({ ctx }) => {
      if (ctx.state === 'suspended') ctx.resume().catch(() => {});
    });
  }, []);

  useEffect(() => {
    const fn = () => unlockAudio();
    window.addEventListener('click', fn, { once: true });
    window.addEventListener('keydown', fn, { once: true });
    return () => {
      window.removeEventListener('click', fn);
      window.removeEventListener('keydown', fn);
    };
  }, [unlockAudio]);

  // ─── Device Enumeration ──────────────────────────────────────────────────
  const refreshDevices = useCallback(async () => {
    if (!navigator.mediaDevices?.enumerateDevices) return;
    try {
      const all = await navigator.mediaDevices.enumerateDevices();
      const ins = all.filter(d => d.kind === 'audioinput');
      const outs = all.filter(d => d.kind === 'audiooutput');
      setAudioInputDevices(ins);
      setAudioOutputDevices(outs);
      if (ins.length > 0) setSelectedInputId(p => p || ins[0].deviceId);
      if (outs.length > 0) setSelectedOutputId(p => p || outs[0].deviceId);
    } catch {}
  }, []);

  // ─── Signal Relay (BroadcastChannel + Server) ────────────────────────────
  const sendSignal = useCallback(async (
    targetPeerId: string,
    signalType: 'offer' | 'answer' | 'candidate',
    data: any
  ) => {
    const payload = { fromPeerId: localPeerId, targetPeerId, signalType, data };
    // 1. Same-browser instant relay
    publishClientRealtimeEvent({ type: 'MEETING_SIGNAL', projectId, payload, senderSessionId: localPeerId });
    // 2. Cross-browser relay via server WebSocket
    try {
      await fetch(`/api/projects/${projectId}/meeting/signal`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
    } catch (e) {
      console.warn('[sendSignal]:', e);
    }
  }, [localPeerId, projectId]);

  // ─── Drain buffered ICE candidates ──────────────────────────────────────
  const drainCandidates = useCallback(async (peerId: string, pc: RTCPeerConnection) => {
    const q = pendingCandidatesRef.current.get(peerId) || [];
    pendingCandidatesRef.current.delete(peerId);
    for (const c of q) {
      try { await pc.addIceCandidate(new RTCIceCandidate(c)); }
      catch (e) { console.warn('[drainCandidates]:', e); }
    }
  }, []);

  // ─── Attach remote stream to audio element + analyser ────────────────────
  const attachRemoteAudio = useCallback((peerId: string, stream: MediaStream) => {
    // Enable all incoming audio tracks
    stream.getAudioTracks().forEach(t => { t.enabled = true; });

    // Update React state (drives hidden <audio> elements)
    setRemoteStreams(prev => ({ ...prev, [peerId]: stream }));

    // Imperative audio element (for guaranteed playback)
    let el = audioElemsRef.current.get(peerId);
    if (!el) {
      el = document.createElement('audio');
      el.id = `rm_audio_${peerId}`;
      el.autoplay = true;
      (el as any).playsInline = true;
      el.volume = 1.0;
      document.body.appendChild(el);
      audioElemsRef.current.set(peerId, el);
    }
    if (el.srcObject !== stream) el.srcObject = stream;
    el.muted = isDeafenedRef.current;
    if (selectedOutputIdRef.current && typeof (el as any).setSinkId === 'function') {
      (el as any).setSinkId(selectedOutputIdRef.current).catch(() => {});
    }
    const play = () => el!.play().catch(() => setAutoplayBlocked(true));
    play();
    stream.getAudioTracks().forEach(t => { t.onunmute = play; });

    // Per-peer Web Audio analyser for speaking detection
    const existing = analysersRef.current.get(peerId);
    if (existing) {
      try { existing.src.disconnect(); } catch {}
      try {
        const newSrc = existing.ctx.createMediaStreamSource(stream);
        newSrc.connect(existing.analyser);
        analysersRef.current.set(peerId, { ...existing, src: newSrc });
      } catch {}
    } else {
      try {
        const AudioCtx = (window.AudioContext || (window as any).webkitAudioContext) as typeof AudioContext;
        const ctx = new AudioCtx();
        if (ctx.state === 'suspended') ctx.resume().catch(() => {});
        const src = ctx.createMediaStreamSource(stream);
        const analyser = ctx.createAnalyser();
        analyser.fftSize = 512;
        analyser.smoothingTimeConstant = 0.85;
        src.connect(analyser);
        analysersRef.current.set(peerId, { ctx, analyser, src });
      } catch {}
    }
  }, []);

  // ─── Full peer cleanup ───────────────────────────────────────────────────
  const cleanupPeer = useCallback((peerId: string) => {
    const pc = pcsRef.current.get(peerId);
    if (pc) { try { pc.close(); } catch {} pcsRef.current.delete(peerId); }
    const el = audioElemsRef.current.get(peerId);
    if (el) { el.srcObject = null; try { el.remove(); } catch {} audioElemsRef.current.delete(peerId); }
    const a = analysersRef.current.get(peerId);
    if (a) {
      try { a.src.disconnect(); } catch {}
      try { a.ctx.close(); } catch {}
      analysersRef.current.delete(peerId);
    }
    pendingCandidatesRef.current.delete(peerId);
    seenCandidatesRef.current.delete(peerId);
    makingOfferRef.current.delete(peerId);
    ignoreOfferRef.current.delete(peerId);
    setRemoteStreams(prev => { const n = { ...prev }; delete n[peerId]; return n; });
    setPcStates(prev => { const n = { ...prev }; delete n[peerId]; return n; });
  }, []);

  // ─── Create or get RTCPeerConnection (Perfect Negotiation) ───────────────
  //
  // Perfect negotiation: https://www.w3.org/TR/webrtc/#perfect-negotiation-example
  //  - Lower peerId (lexicographic) = polite peer (yields on collision)
  //  - Higher peerId = impolite peer (ignores colliding incoming offers)
  //
  const getOrCreatePC = useCallback((remotePeerId: string) => {
    if (pcsRef.current.has(remotePeerId)) return pcsRef.current.get(remotePeerId)!;

    const isPolite = localPeerId < remotePeerId;
    const pc = new RTCPeerConnection(ICE_SERVERS);
    pcsRef.current.set(remotePeerId, pc);
    makingOfferRef.current.set(remotePeerId, false);
    ignoreOfferRef.current.set(remotePeerId, false);

    // Add local audio tracks immediately so onnegotiationneeded fires
    if (localStreamRef.current) {
      localStreamRef.current.getAudioTracks().forEach(track => {
        pc.addTrack(track, localStreamRef.current!);
      });
    } else {
      // No mic yet — add recvonly transceiver so we can receive their audio
      try { pc.addTransceiver('audio', { direction: 'recvonly' }); } catch {}
    }

    // ── Perfect negotiation: onnegotiationneeded ──
    pc.onnegotiationneeded = async () => {
      try {
        makingOfferRef.current.set(remotePeerId, true);
        // Modern API: setLocalDescription() auto-creates offer
        await pc.setLocalDescription();
        await sendSignal(remotePeerId, 'offer', pc.localDescription);
      } catch (e) {
        console.warn('[onnegotiationneeded]:', e);
      } finally {
        makingOfferRef.current.set(remotePeerId, false);
      }
    };

    pc.onicecandidate = ({ candidate }) => {
      if (candidate) {
        sendSignal(remotePeerId, 'candidate', candidate.toJSON());
      }
    };

    // Triggered when remote audio tracks arrive
    pc.ontrack = ({ streams, track }) => {
      const stream = (streams && streams[0]) ? streams[0] : new MediaStream([track]);
      attachRemoteAudio(remotePeerId, stream);
    };

    pc.onconnectionstatechange = () => {
      setPcStates(prev => ({ ...prev, [remotePeerId]: pc.connectionState }));
      if (pc.connectionState === 'failed') {
        // ICE restart — recreate the offer path
        try { pc.restartIce(); } catch {}
      }
      if (pc.connectionState === 'closed') {
        cleanupPeer(remotePeerId);
      }
    };

    pc.oniceconnectionstatechange = () => {
      if (pc.iceConnectionState === 'failed') {
        try { pc.restartIce(); } catch {}
      }
    };

    return pc;
  }, [attachRemoteAudio, cleanupPeer, localPeerId, sendSignal]);

  // ─── Handle incoming WebRTC signal ──────────────────────────────────────
  const handleSignal = useCallback(async (
    fromPeerId: string,
    signalType: string,
    data: any
  ) => {
    const isPolite = localPeerId < fromPeerId;
    const pc = getOrCreatePC(fromPeerId);

    if (signalType === 'offer') {
      if (!data?.sdp) return;
      const offerCollision = makingOfferRef.current.get(fromPeerId) || pc.signalingState !== 'stable';
      const shouldIgnore = !isPolite && offerCollision;
      ignoreOfferRef.current.set(fromPeerId, shouldIgnore);
      if (shouldIgnore) return;

      try {
        await pc.setRemoteDescription(new RTCSessionDescription(data));

        // Ensure our local audio is attached before answering
        if (localStreamRef.current) {
          const senders = pc.getSenders();
          localStreamRef.current.getAudioTracks().forEach(track => {
            const existing = senders.find(s => s.track?.kind === 'audio');
            if (existing) {
              existing.replaceTrack(track).catch(() => {});
            } else {
              pc.addTrack(track, localStreamRef.current!);
            }
          });
        }

        // Modern API: setLocalDescription() auto-creates answer
        await pc.setLocalDescription();
        await sendSignal(fromPeerId, 'answer', pc.localDescription);
        await drainCandidates(fromPeerId, pc);
      } catch (e) {
        console.warn('[offer handler]:', e);
      }
    } else if (signalType === 'answer') {
      if (!data?.sdp) return;
      if (ignoreOfferRef.current.get(fromPeerId)) return;
      try {
        if (pc.signalingState === 'have-local-offer') {
          await pc.setRemoteDescription(new RTCSessionDescription(data));
          await drainCandidates(fromPeerId, pc);
        }
      } catch (e) {
        console.warn('[answer handler]:', e);
      }
    } else if (signalType === 'candidate') {
      if (!data?.candidate) return;

      // Deduplicate candidates (BroadcastChannel + WS may deliver same one twice)
      let seen = seenCandidatesRef.current.get(fromPeerId);
      if (!seen) { seen = new Set(); seenCandidatesRef.current.set(fromPeerId, seen); }
      const key = `${data.candidate}|${data.sdpMid}|${data.sdpMLineIndex}`;
      if (seen.has(key)) return;
      seen.add(key);

      if (!pc.remoteDescription?.type) {
        // Buffer until remote description is set
        const q = pendingCandidatesRef.current.get(fromPeerId) || [];
        q.push(data);
        pendingCandidatesRef.current.set(fromPeerId, q);
      } else {
        try { await pc.addIceCandidate(new RTCIceCandidate(data)); }
        catch (e) { console.warn('[candidate]:', e); }
      }
    }
  }, [drainCandidates, getOrCreatePC, localPeerId, sendSignal]);

  // ─── Remote speaking detection (RMS-based, 80ms poll) ───────────────────
  useEffect(() => {
    const buf = new Float32Array(512);
    const interval = setInterval(() => {
      const map: Record<string, boolean> = {};
      analysersRef.current.forEach(({ analyser, ctx }, peerId) => {
        if (ctx.state === 'suspended') ctx.resume().catch(() => {});
        analyser.getFloatTimeDomainData(buf);
        let rms = 0;
        for (let i = 0; i < buf.length; i++) rms += buf[i] * buf[i];
        rms = Math.sqrt(rms / buf.length);
        map[peerId] = rms > SPEAKING_RMS_THRESHOLD;
      });
      setRemoteSpeaking(map);
    }, 80);
    return () => clearInterval(interval);
  }, []);

  // ─── Local Audio Initialization ──────────────────────────────────────────
  const initLocalAudio = useCallback(async (deviceId?: string): Promise<MediaStream | null> => {
    setIsConnecting(true);
    setPermissionError(null);

    // Stop previous tracks
    if (localStreamRef.current) {
      localStreamRef.current.getTracks().forEach(t => t.stop());
      localStreamRef.current = null;
    }
    if (localVadIntervalRef.current) { clearInterval(localVadIntervalRef.current); localVadIntervalRef.current = null; }
    if (localAudioCtxRef.current) {
      try { await localAudioCtxRef.current.close(); } catch {}
      localAudioCtxRef.current = null;
      localAnalyserRef.current = null;
    }

    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: {
          deviceId: deviceId ? { ideal: deviceId } : undefined,
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true,
          sampleRate: { ideal: 48000 },
        },
        video: false,
      });

      localStreamRef.current = stream;
      // Apply current mute state immediately
      stream.getAudioTracks().forEach(t => { t.enabled = !isMutedRef.current; });

      // ── Local VAD using float RMS (works correctly even when muted) ──────
      try {
        const AudioCtx = (window.AudioContext || (window as any).webkitAudioContext) as typeof AudioContext;
        const ctx = new AudioCtx({ sampleRate: 48000 });
        if (ctx.state === 'suspended') ctx.resume().catch(() => {});
        const src = ctx.createMediaStreamSource(stream);
        const analyser = ctx.createAnalyser();
        analyser.fftSize = 512;
        analyser.smoothingTimeConstant = 0.85;
        src.connect(analyser);
        localAudioCtxRef.current = ctx;
        localAnalyserRef.current = analyser;

        const buf = new Float32Array(analyser.fftSize);
        localVadIntervalRef.current = setInterval(() => {
          if (!localAnalyserRef.current) return;
          localAnalyserRef.current.getFloatTimeDomainData(buf);
          let rms = 0;
          for (let i = 0; i < buf.length; i++) rms += buf[i] * buf[i];
          rms = Math.sqrt(rms / buf.length);
          // Volume meter: map rms→0..100
          const db = 20 * Math.log10(rms + 1e-9);
          const vol = Math.max(0, Math.min(100, Math.round((db + 70) / 70 * 100)));
          setLocalVolumeLevel(vol);
          // Speaking: only when NOT muted
          const spk = !isMutedRef.current && rms > SPEAKING_RMS_THRESHOLD;
          setLocalSpeaking(spk);
          localSpeakingRef.current = spk;
        }, 80);
      } catch (e) {
        console.warn('[local VAD]:', e);
      }

      // ── Add/replace tracks in all existing peer connections ───────────────
      const audioTrack = stream.getAudioTracks()[0];
      if (audioTrack) {
        for (const [pid, pc] of pcsRef.current.entries()) {
          const senders = pc.getSenders();
          const existing = senders.find(s => s.track?.kind === 'audio');
          if (existing) {
            await existing.replaceTrack(audioTrack).catch(() => {});
          } else {
            pc.addTrack(audioTrack, stream);
            // addTrack triggers onnegotiationneeded automatically
          }
        }
      }

      setIsConnected(true);
      setIsConnecting(false);
      await refreshDevices();
      return stream;
    } catch (err: any) {
      setIsConnecting(false);
      setPermissionError(
        err.name === 'NotAllowedError'
          ? 'Microphone access denied. Allow microphone permissions and retry.'
          : `Microphone error: ${err.message}`
      );
      toast.error('Microphone access required');
      return null;
    }
  }, [refreshDevices]);

  // ─── Realtime Meeting Event Handler ─────────────────────────────────────
  const handleRealtimeEvent = useCallback(async (event: RealtimeEvent) => {
    if (String(event.projectId) !== String(projectId)) return;
    const { type, payload, senderSessionId } = event;
    if (senderSessionId === localPeerId) return; // ignore own echoes

    if (type === 'MEETING_SIGNAL') {
      const { fromPeerId, targetPeerId, signalType, data } = payload;
      if (targetPeerId && targetPeerId !== localPeerId) return; // not for us
      await handleSignal(fromPeerId, signalType, data);
    }

    if (type === 'MEETING_JOINED') {
      const { participant, participants: list } = payload;
      if (participant && participant.peerId !== localPeerId) {
        toast.info(`${participant.userName} joined the meeting`);
        // Create PC — onnegotiationneeded will fire and initiate offer
        getOrCreatePC(participant.peerId);
      }
      if (Array.isArray(list)) setParticipants(list);
    }

    if (type === 'MEETING_LEFT') {
      const { peerId: leftId, participants: list } = payload;
      if (leftId && leftId !== localPeerId) {
        cleanupPeer(leftId);
      }
      if (Array.isArray(list)) {
        setParticipants(list);
      } else if (leftId) {
        setParticipants(prev => prev.filter(p => p.peerId !== leftId));
      }
    }

    if (type === 'MEETING_STATE') {
      const { peerId: pid, isMuted: mutedV, isSpeaking: spkV, isDeafened: defV } = payload;
      setParticipants(prev => prev.map(p =>
        p.peerId === pid
          ? { ...p, isMuted: mutedV ?? p.isMuted, isSpeaking: spkV ?? p.isSpeaking, isDeafened: defV ?? p.isDeafened }
          : p
      ));
    }
  }, [cleanupPeer, getOrCreatePC, handleSignal, localPeerId, projectId]);

  useRealtimeSubscription({ projectId, onEvent: handleRealtimeEvent });

  // ─── Leave: instant local broadcast + server keepalive ───────────────────
  const performLeave = useCallback((unloading = false) => {
    // Broadcast to all browser tabs immediately
    publishClientRealtimeEvent({
      type: 'MEETING_LEFT',
      projectId,
      payload: { peerId: localPeerId, userId: currentUser?.id },
      senderSessionId: localPeerId,
    });

    const body = JSON.stringify({ action: 'leave', peerId: localPeerId });
    if (unloading && navigator.sendBeacon) {
      try {
        navigator.sendBeacon(
          `/api/projects/${projectId}/meeting`,
          new Blob([body], { type: 'application/json' })
        );
        return;
      } catch {}
    }
    fetch(`/api/projects/${projectId}/meeting`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body,
      keepalive: true,
    }).catch(() => {});
  }, [currentUser?.id, localPeerId, projectId]);

  // ─── Join & Heartbeat lifecycle ─────────────────────────────────────────
  useEffect(() => {
    let cancelled = false;

    const join = async () => {
      await initLocalAudio();
      if (cancelled) return;

      try {
        const res = await fetch(`/api/projects/${projectId}/meeting`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            action: 'join',
            peerId: localPeerId,
            isMuted: false,
            isDeafened: false,
          }),
        });

        if (res.ok && !cancelled) {
          const json = await res.json();
          if (Array.isArray(json.participants)) {
            setParticipants(json.participants);
            // Create peer connections for existing participants
            // onnegotiationneeded fires automatically → sends offer
            for (const p of json.participants) {
              if (p.peerId !== localPeerId) {
                getOrCreatePC(p.peerId);
              }
            }
          }
        }
      } catch (e) {
        console.warn('[join]:', e);
      }
    };

    join();

    // Heartbeat every 8s — also reconciles participant list
    const heartbeat = setInterval(async () => {
      try {
        const res = await fetch(`/api/projects/${projectId}/meeting`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            action: 'heartbeat',
            peerId: localPeerId,
            isMuted: isMutedRef.current,
            isDeafened: isDeafenedRef.current,
            isSpeaking: localSpeakingRef.current,
          }),
        });
        if (res.ok) {
          const json = await res.json();
          if (Array.isArray(json.participants)) setParticipants(json.participants);
        }
      } catch {}
    }, 8000);

    const onUnload = () => performLeave(true);
    window.addEventListener('beforeunload', onUnload);
    window.addEventListener('pagehide', onUnload);

    return () => {
      cancelled = true;
      clearInterval(heartbeat);
      window.removeEventListener('beforeunload', onUnload);
      window.removeEventListener('pagehide', onUnload);

      performLeave(false);

      pcsRef.current.forEach(pc => { try { pc.close(); } catch {} });
      pcsRef.current.clear();

      audioElemsRef.current.forEach(el => { el.srcObject = null; try { el.remove(); } catch {} });
      audioElemsRef.current.clear();

      analysersRef.current.forEach(({ ctx }) => { try { ctx.close(); } catch {} });
      analysersRef.current.clear();

      if (localStreamRef.current) localStreamRef.current.getTracks().forEach(t => t.stop());
      if (localVadIntervalRef.current) clearInterval(localVadIntervalRef.current);
      if (localAudioCtxRef.current) { try { localAudioCtxRef.current.close(); } catch {} }
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);  // run only on mount/unmount — refs keep everything fresh

  // ─── Microphone Device Switch ────────────────────────────────────────────
  const handleSwitchMic = async (deviceId: string) => {
    setSelectedInputId(deviceId);
    await initLocalAudio(deviceId);
    toast.success('Microphone switched');
  };

  // ─── Speaker Output Switch ───────────────────────────────────────────────
  const handleSwitchSpeaker = async (deviceId: string) => {
    setSelectedOutputId(deviceId);
    selectedOutputIdRef.current = deviceId;
    audioElemsRef.current.forEach(el => {
      if (typeof (el as any).setSinkId === 'function') {
        (el as any).setSinkId(deviceId).catch(() => {});
      }
    });
    toast.success('Speaker output switched');
  };

  // ─── Mute / Deafen Toggle ────────────────────────────────────────────────
  const handleToggleMute = () => {
    const next = !isMuted;
    setIsMuted(next);
    isMutedRef.current = next;
    localStreamRef.current?.getAudioTracks().forEach(t => { t.enabled = !next; });
    if (next) { setLocalSpeaking(false); localSpeakingRef.current = false; }
    fetch(`/api/projects/${projectId}/meeting`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'state', peerId: localPeerId, isMuted: next }),
    }).catch(() => {});
    toast.info(next ? 'Muted' : 'Unmuted');
  };

  const handleToggleDeafen = () => {
    const next = !isDeafened;
    setIsDeafened(next);
    isDeafenedRef.current = next;
    audioElemsRef.current.forEach(el => { el.muted = next; });
    toast.info(next ? 'Sound deafened' : 'Sound enabled');
  };

  const handleLeaveCall = () => {
    performLeave(false);
    onLeaveMeeting ? onLeaveMeeting() : window.history.back();
  };

  // ─── Rendered participants: deduplicated by userId ────────────────────────
  //
  // The server may briefly return two entries for the same userId (e.g. during
  // a page refresh before the old peerId is pruned). We deduplicate here by
  // keeping the most-recently-joined entry per userId.
  //
  const renderedParticipants = useMemo(() => {
    const byUserId = new Map<string, MeetingParticipant>();
    for (const p of participants) {
      const uid = String(p.userId);
      const existing = byUserId.get(uid);
      if (!existing || p.joinedAt > existing.joinedAt) {
        byUserId.set(uid, p);
      }
    }
    // Remote participants only
    const others = Array.from(byUserId.values()).filter(p => p.peerId !== localPeerId);

    // Local user entry — always use live state
    const me: MeetingParticipant = {
      peerId: localPeerId,
      userId: currentUser?.id || 'you',
      userName: currentUser?.name || currentUser?.username || 'You',
      userAvatar: currentUser?.avatar || '',
      isMuted,
      isDeafened,
      isSpeaking: localSpeaking,
      joinedAt: Date.now(),
      lastSeen: Date.now(),
    };

    return [me, ...others];
  }, [currentUser, isDeafened, isMuted, localPeerId, localSpeaking, participants]);

  // ─── JSX ─────────────────────────────────────────────────────────────────
  return (
    <div
      onClick={unlockAudio}
      className="flex-1 w-full h-full flex flex-col bg-[#0A0B0D] text-[#CFD4DD] overflow-hidden select-none font-sans"
    >
      {/* ── Header ── */}
      <div className="h-14 px-6 border-b border-[#1E2024] bg-[#111215]/95 flex items-center justify-between shrink-0 z-20 backdrop-blur-md">
        <div className="flex items-center gap-3">
          <div className="relative flex items-center justify-center w-8 h-8 rounded-lg bg-[#DCB001]/10 text-[#DCB001] border border-[#DCB001]/25">
            <Radio size={16} className={isConnected ? 'text-[#22C55E] animate-pulse' : 'text-[#DCB001]'} />
            {isConnected && (
              <span className="absolute -top-1 -right-1 w-2.5 h-2.5 rounded-full bg-[#22C55E] ring-2 ring-[#111215]" />
            )}
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h2 className="text-sm font-bold text-white tracking-tight">{projectName} Voice Room</h2>
              <span className="px-2 py-0.5 rounded-full bg-[#22C55E]/15 text-[#22C55E] text-[10px] font-mono font-semibold border border-[#22C55E]/30 flex items-center gap-1">
                <span className="w-1.5 h-1.5 rounded-full bg-[#22C55E] animate-ping" />
                LIVE
              </span>
            </div>
            <p className="text-[11px] text-[#787C83] flex items-center gap-2">
              <span>{renderedParticipants.length} in call</span>
              <span>•</span>
              <span className="font-mono text-[#A0A5B0]">{formattedTimer}</span>
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2.5">
          <button
            onClick={e => { e.stopPropagation(); setShowDeviceSettings(p => !p); }}
            className={`flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded-xl border transition-all cursor-pointer ${
              showDeviceSettings
                ? 'bg-[#DCB001]/15 text-[#DCB001] border-[#DCB001]/40 shadow-sm'
                : 'bg-[#18191E] text-[#8E939D] hover:text-white border-[#2A2C30]'
            }`}
            title="Configure Audio Devices"
          >
            <Settings size={14} /><span>Audio Devices</span>
          </button>
          <button
            onClick={e => { e.stopPropagation(); handleLeaveCall(); }}
            className="flex items-center gap-1.5 px-3.5 py-1.5 text-xs font-semibold rounded-xl bg-red-500/15 hover:bg-red-500/25 text-red-400 border border-red-500/30 transition-all shadow-md cursor-pointer"
            title="Leave Meeting Room"
          >
            <PhoneOff size={14} /><span>Leave</span>
          </button>
        </div>
      </div>

      {/* ── Body ── */}
      <div className="flex-1 min-h-0 flex flex-col relative overflow-hidden bg-[#0A0B0D]">

        {/* Autoplay blocked banner */}
        {autoplayBlocked && (
          <div
            onClick={unlockAudio}
            className="mx-6 mt-4 p-3.5 rounded-xl bg-amber-500/15 border border-amber-500/35 text-amber-300 text-xs flex items-center justify-between shadow-lg cursor-pointer animate-pulse"
          >
            <div className="flex items-center gap-2.5">
              <Volume2 size={16} className="text-amber-400 shrink-0" />
              <span>Browser blocked audio autoplay. Click anywhere to enable audio.</span>
            </div>
            <button className="px-3 py-1 bg-amber-500 text-black rounded-lg font-bold text-[11px] shrink-0">Enable Audio</button>
          </div>
        )}

        {/* Mic permission error */}
        {permissionError && (
          <div className="mx-6 mt-4 p-3.5 rounded-xl bg-red-500/10 border border-red-500/30 text-red-300 text-xs flex items-center justify-between shadow-lg">
            <div className="flex items-center gap-2.5">
              <AlertCircle size={16} className="text-red-400 shrink-0" />
              <span>{permissionError}</span>
            </div>
            <button
              onClick={e => { e.stopPropagation(); initLocalAudio(); }}
              className="px-2.5 py-1 bg-red-500/20 hover:bg-red-500/30 text-white rounded-lg font-medium transition-colors text-[11px] cursor-pointer"
            >
              Retry Microphone
            </button>
          </div>
        )}

        {/* Device settings drawer */}
        {showDeviceSettings && (
          <div className="mx-6 mt-4 p-4 rounded-2xl bg-[#141519] border border-[#2B2D33] shadow-2xl flex flex-col md:flex-row items-center justify-between gap-4 z-30 animate-in fade-in slide-in-from-top-2 duration-200">
            {/* Mic input */}
            <div className="flex-1 w-full">
              <label className="text-[11px] font-semibold text-[#8E939D] uppercase tracking-wider flex items-center gap-1.5 mb-1.5">
                <Mic size={12} className="text-[#DCB001]" /> Microphone (Input)
              </label>
              <select
                value={selectedInputId}
                onChange={e => handleSwitchMic(e.target.value)}
                className="w-full bg-[#1A1C22] border border-[#33363F] text-white text-xs rounded-xl px-3 py-2 outline-none focus:border-[#DCB001] transition-colors cursor-pointer"
              >
                {audioInputDevices.length === 0 && <option value="">Default Microphone</option>}
                {audioInputDevices.map((d, i) => <option key={d.deviceId || i} value={d.deviceId}>{d.label || `Microphone ${i + 1}`}</option>)}
              </select>
              {/* Mic level meter */}
              <div className="mt-2 flex items-center gap-2">
                <span className="text-[10px] text-[#787C83] font-mono">Mic Level:</span>
                <div className="flex-1 h-1.5 rounded-full bg-[#202228] overflow-hidden">
                  <div
                    className="h-full bg-[#22C55E] transition-all duration-75"
                    style={{ width: `${isMuted ? 0 : localVolumeLevel}%` }}
                  />
                </div>
              </div>
            </div>

            {/* Speaker output */}
            <div className="flex-1 w-full">
              <label className="text-[11px] font-semibold text-[#8E939D] uppercase tracking-wider flex items-center gap-1.5 mb-1.5">
                <Headphones size={12} className="text-[#DCB001]" /> Speaker (Output)
              </label>
              <select
                value={selectedOutputId}
                onChange={e => handleSwitchSpeaker(e.target.value)}
                className="w-full bg-[#1A1C22] border border-[#33363F] text-white text-xs rounded-xl px-3 py-2 outline-none focus:border-[#DCB001] transition-colors cursor-pointer"
              >
                {audioOutputDevices.length === 0 && <option value="">Default System Speaker</option>}
                {audioOutputDevices.map((d, i) => <option key={d.deviceId || i} value={d.deviceId}>{d.label || `Speaker ${i + 1}`}</option>)}
              </select>
              <p className="mt-1.5 text-[10px] text-[#787C83]">Output switching supported in Chrome/Edge.</p>
            </div>
          </div>
        )}

        {/* ── Participant Grid ── */}
        <div className="flex-1 min-h-0 p-6 overflow-y-auto">
          <div
            className={`grid gap-4 w-full h-full auto-rows-fr ${
              renderedParticipants.length === 1
                ? 'grid-cols-1 max-w-lg mx-auto'
                : renderedParticipants.length === 2
                ? 'grid-cols-1 sm:grid-cols-2 max-w-3xl mx-auto'
                : renderedParticipants.length <= 4
                ? 'grid-cols-2 max-w-4xl mx-auto'
                : 'grid-cols-2 md:grid-cols-3 max-w-6xl mx-auto'
            }`}
          >
            {renderedParticipants.map(p => {
              const isMe = p.peerId === localPeerId;
              const speaking = isMe ? localSpeaking : (remoteSpeaking[p.peerId] ?? false);
              const pcState = isMe ? null : pcStates[p.peerId];

              return (
                <div
                  key={p.peerId}
                  className={`relative rounded-2xl bg-[#121317] border transition-all duration-200 flex flex-col items-center justify-center p-6 shadow-xl overflow-hidden ${
                    speaking
                      ? 'border-[#22C55E] ring-4 ring-[#22C55E]/20 shadow-[0_0_24px_rgba(34,197,94,0.2)]'
                      : 'border-[#22242A] hover:border-[#333640]'
                  }`}
                >
                  {/* Speaking background glow */}
                  {speaking && (
                    <div className="absolute inset-0 bg-radial from-[#22C55E]/10 to-transparent pointer-events-none animate-pulse" />
                  )}

                  {/* Avatar */}
                  <div className="relative mb-3.5">
                    <div
                      className={`w-20 h-20 rounded-full flex items-center justify-center overflow-hidden font-bold text-xl uppercase transition-all duration-200 ${
                        speaking
                          ? 'ring-4 ring-[#22C55E] ring-offset-4 ring-offset-[#121317] scale-105'
                          : 'ring-2 ring-[#2B2D35]'
                      } ${p.userAvatar ? 'bg-[#1E2026]' : 'bg-gradient-to-br from-[#2B2E38] to-[#17181F] text-white'}`}
                    >
                      {p.userAvatar
                        ? <img src={p.userAvatar} alt={p.userName} className="w-full h-full object-cover" />
                        : <span>{p.userName.slice(0, 2)}</span>}
                    </div>

                    {/* Mic badge */}
                    <div
                      className={`absolute bottom-0 right-0 w-6 h-6 rounded-full flex items-center justify-center border-2 border-[#121317] shadow-md ${
                        p.isMuted
                          ? 'bg-red-500 text-white'
                          : speaking
                          ? 'bg-[#22C55E] text-black animate-bounce'
                          : 'bg-[#1F2128] text-[#8E939D]'
                      }`}
                    >
                      {p.isMuted ? <MicOff size={11} /> : <Mic size={11} />}
                    </div>
                  </div>

                  {/* Name */}
                  <div className="flex items-center gap-1.5 mb-1 z-10">
                    <span className="font-semibold text-sm text-white tracking-tight">{p.userName}</span>
                    {isMe && (
                      <span className="px-1.5 rounded bg-[#DCB001]/15 text-[#DCB001] font-mono text-[9px] font-bold border border-[#DCB001]/30">YOU</span>
                    )}
                  </div>

                  {/* Speaking waveform / Idle status */}
                  <div className="h-4 flex items-center gap-1 mt-1 z-10">
                    {speaking ? (
                      <>
                        <span className="w-1 h-3.5 bg-[#22C55E] rounded-full animate-pulse" />
                        <span className="w-1 h-5 bg-[#22C55E] rounded-full animate-pulse delay-75" />
                        <span className="w-1 h-2 bg-[#22C55E] rounded-full animate-pulse delay-150" />
                        <span className="w-1 h-4 bg-[#22C55E] rounded-full animate-pulse delay-100" />
                        <span className="text-[10px] text-[#22C55E] font-mono font-medium ml-1">Speaking...</span>
                      </>
                    ) : (
                      <span className="text-[10px] text-[#6B707B] font-mono">
                        {p.isMuted ? 'Muted' : 'Idle'}
                      </span>
                    )}
                  </div>

                  {/* Connection state badge (top-right) */}
                  <div className="absolute top-3 right-3 flex items-center gap-1 text-[10px] font-mono">
                    {isMe ? (
                      <Signal size={12} className="text-[#22C55E]" />
                    ) : pcState === 'connected' ? (
                      <Signal size={12} className="text-[#22C55E]" />
                    ) : pcState === 'connecting' || pcState === 'new' ? (
                      <Wifi size={12} className="text-[#DCB001] animate-pulse" />
                    ) : pcState === 'failed' || pcState === 'disconnected' ? (
                      <WifiOff size={12} className="text-red-400" />
                    ) : (
                      <Signal size={12} className="text-[#6B707B]" />
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* ── Bottom Controls Dock ── */}
        <div className="h-20 border-t border-[#1C1E23] bg-[#0E0F12]/95 backdrop-blur-xl flex items-center justify-center gap-4 px-6 z-30 shadow-2xl">
          {/* Mute */}
          <button
            onClick={handleToggleMute}
            className={`flex items-center gap-2 px-5 py-2.5 rounded-2xl font-semibold text-xs transition-all shadow-xl ${
              isMuted
                ? 'bg-red-500/20 text-red-400 border border-red-500/40 hover:bg-red-500/30'
                : 'bg-[#1E2027] hover:bg-[#282B34] text-white border border-[#343742]'
            }`}
            title={isMuted ? 'Unmute Microphone' : 'Mute Microphone'}
          >
            {isMuted ? <MicOff size={16} className="text-red-400" /> : <Mic size={16} className="text-[#22C55E]" />}
            <span>{isMuted ? 'Unmute Mic' : 'Mute Mic'}</span>
          </button>

          {/* Deafen */}
          <button
            onClick={handleToggleDeafen}
            className={`flex items-center gap-2 px-5 py-2.5 rounded-2xl font-semibold text-xs transition-all shadow-xl ${
              isDeafened
                ? 'bg-red-500/20 text-red-400 border border-red-500/40 hover:bg-red-500/30'
                : 'bg-[#1E2027] hover:bg-[#282B34] text-white border border-[#343742]'
            }`}
            title={isDeafened ? 'Undeafen Speaker' : 'Deafen Sound'}
          >
            {isDeafened ? <VolumeX size={16} className="text-red-400" /> : <Volume2 size={16} className="text-[#DCB001]" />}
            <span>{isDeafened ? 'Undeafen' : 'Deafen'}</span>
          </button>

          {/* Devices */}
          <button
            onClick={() => setShowDeviceSettings(p => !p)}
            className={`flex items-center gap-2 px-4 py-2.5 rounded-2xl font-semibold text-xs transition-all border ${
              showDeviceSettings
                ? 'bg-[#DCB001]/15 text-[#DCB001] border-[#DCB001]/40'
                : 'bg-[#16171C] hover:bg-[#22242B] text-[#9BA1A6] border-[#292B33]'
            }`}
            title="Audio Input / Output Device Preferences"
          >
            <Sliders size={15} /><span>Devices</span>
          </button>

          {/* Leave */}
          <button
            onClick={handleLeaveCall}
            className="flex items-center gap-2 px-5 py-2.5 rounded-2xl font-semibold text-xs bg-red-600 hover:bg-red-700 text-white transition-all shadow-lg hover:shadow-red-600/30 cursor-pointer"
            title="Disconnect & Exit Call"
          >
            <PhoneOff size={16} /><span>Leave Call</span>
          </button>
        </div>

        {/* ── Hidden React-managed audio elements (prevents GC throttling) ── */}
        <div className="hidden" aria-hidden="true">
          {renderedParticipants
            .filter(p => p.peerId !== localPeerId)
            .map(p => (
              <audio
                key={p.peerId}
                autoPlay
                playsInline
                muted={isDeafened}
                ref={el => {
                  if (!el) return;
                  audioElemsRef.current.set(p.peerId, el);
                  const stream = remoteStreams[p.peerId];
                  if (stream && el.srcObject !== stream) {
                    el.srcObject = stream;
                    el.play().catch(() => setAutoplayBlocked(true));
                  }
                  if (selectedOutputId && typeof (el as any).setSinkId === 'function') {
                    (el as any).setSinkId(selectedOutputId).catch(() => {});
                  }
                }}
              />
            ))}
        </div>
      </div>
    </div>
  );
};

export default ProjectMeetingView;
