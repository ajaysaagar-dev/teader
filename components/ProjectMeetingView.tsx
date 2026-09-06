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
  Users,
  Shield,
  RefreshCw,
  Sliders,
  Check,
  AlertCircle,
  Headphones,
  Signal,
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

const ICE_SERVERS: RTCConfiguration = {
  iceServers: [
    { urls: 'stun:stun.l.google.com:19302' },
    { urls: 'stun:stun1.l.google.com:19302' },
    { urls: 'stun:stun2.l.google.com:19302' },
    { urls: 'stun:stun3.l.google.com:19302' },
    { urls: 'stun:stun4.l.google.com:19302' },
  ],
  iceCandidatePoolSize: 10,
};

export const ProjectMeetingView: React.FC<ProjectMeetingViewProps> = ({
  projectId,
  projectName,
  currentUser,
  onLeaveMeeting,
}) => {
  // Session / Peer Identity
  const localPeerIdRef = useRef<string>(
    `peer_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`
  );
  const localPeerId = localPeerIdRef.current;

  // Connection and Room States
  const [isConnected, setIsConnected] = useState(false);
  const [isConnecting, setIsConnecting] = useState(true);
  const [permissionError, setPermissionError] = useState<string | null>(null);
  const [meetingDuration, setMeetingDuration] = useState(0);
  const [autoplayBlocked, setAutoplayBlocked] = useState(false);

  // Audio Controls
  const [isMuted, setIsMuted] = useState(false);
  const [isDeafened, setIsDeafened] = useState(false);
  const [localSpeaking, setLocalSpeaking] = useState(false);
  const [localVolumeLevel, setLocalVolumeLevel] = useState(0); // 0 to 100

  // Devices
  const [audioInputDevices, setAudioInputDevices] = useState<MediaDeviceInfo[]>([]);
  const [audioOutputDevices, setAudioOutputDevices] = useState<MediaDeviceInfo[]>([]);
  const [selectedInputId, setSelectedInputId] = useState<string>('');
  const [selectedOutputId, setSelectedOutputId] = useState<string>('');
  const [showDeviceSettings, setShowDeviceSettings] = useState(false);

  // Participants & Remote Streams Map
  const [participants, setParticipants] = useState<MeetingParticipant[]>([]);
  const [remoteSpeaking, setRemoteSpeaking] = useState<Record<string, boolean>>({});
  const [remoteStreams, setRemoteStreams] = useState<Record<string, MediaStream>>({});

  // Synchronized Ref values to avoid stale closures in listeners/heartbeats
  const isMutedRef = useRef(isMuted);
  isMutedRef.current = isMuted;
  const isDeafenedRef = useRef(isDeafened);
  isDeafenedRef.current = isDeafened;
  const localSpeakingRef = useRef(localSpeaking);
  localSpeakingRef.current = localSpeaking;
  const selectedOutputIdRef = useRef(selectedOutputId);
  selectedOutputIdRef.current = selectedOutputId;

  // Audio References
  const localStreamRef = useRef<MediaStream | null>(null);
  const localAudioContextRef = useRef<AudioContext | null>(null);
  const localAnalyserRef = useRef<AnalyserNode | null>(null);
  const localVolumeIntervalRef = useRef<NodeJS.Timeout | null>(null);

  // WebRTC Peer Connections & Queues
  const peerConnectionsRef = useRef<Map<string, RTCPeerConnection>>(new Map());
  const remoteAudioElementsRef = useRef<Map<string, HTMLAudioElement>>(new Map());
  const remoteAnalysersRef = useRef<Map<string, { ctx: AudioContext; analyser: AnalyserNode }>>(new Map());
  const pendingIceCandidatesRef = useRef<Map<string, RTCIceCandidateInit[]>>(new Map());
  const seenCandidatesRef = useRef<Map<string, Set<string>>>(new Map());
  const isMakingOfferRef = useRef<Map<string, boolean>>(new Map());
  const lastProcessedOfferRef = useRef<Map<string, string>>(new Map());
  const lastProcessedAnswerRef = useRef<Map<string, string>>(new Map());

  // Meeting timer
  useEffect(() => {
    const timer = setInterval(() => {
      setMeetingDuration((prev) => prev + 1);
    }, 1000);
    return () => clearInterval(timer);
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

  // ── Unlock Audio Playback on User Interaction ──
  const unlockAudio = useCallback(() => {
    setAutoplayBlocked(false);
    remoteAudioElementsRef.current.forEach((audio) => {
      audio.play().catch(() => {});
    });
    if (localAudioContextRef.current && localAudioContextRef.current.state === 'suspended') {
      localAudioContextRef.current.resume().catch(() => {});
    }
    remoteAnalysersRef.current.forEach(({ ctx }) => {
      if (ctx.state === 'suspended') {
        ctx.resume().catch(() => {});
      }
    });
  }, []);

  useEffect(() => {
    const handleFirstClick = () => {
      unlockAudio();
    };
    window.addEventListener('click', handleFirstClick, { once: true });
    window.addEventListener('keydown', handleFirstClick, { once: true });
    return () => {
      window.removeEventListener('click', handleFirstClick);
      window.removeEventListener('keydown', handleFirstClick);
    };
  }, [unlockAudio]);

  // ── 1. Device Enumeration ──
  const refreshDevices = useCallback(async () => {
    if (typeof navigator === 'undefined' || !navigator.mediaDevices?.enumerateDevices) return;
    try {
      const devices = await navigator.mediaDevices.enumerateDevices();
      const inputs = devices.filter((d) => d.kind === 'audioinput');
      const outputs = devices.filter((d) => d.kind === 'audiooutput');

      setAudioInputDevices(inputs);
      setAudioOutputDevices(outputs);

      if (inputs.length > 0 && !selectedInputId) {
        setSelectedInputId(inputs[0].deviceId);
      }
      if (outputs.length > 0 && !selectedOutputId) {
        setSelectedOutputId(outputs[0].deviceId);
      }
    } catch (e) {
      console.warn('[Device Enumeration Error]:', e);
    }
  }, [selectedInputId, selectedOutputId]);

  // ── 2. Send WebRTC Signal via Next.js API & Multi-Tab Broadcast ──
  const sendSignal = useCallback(
    async (
      targetPeerId: string,
      signalType: 'offer' | 'answer' | 'candidate' | 'request-offer',
      data: any
    ) => {
      const payload = {
        fromPeerId: localPeerId,
        targetPeerId,
        signalType,
        data,
      };

      // 1. Instant multi-tab broadcast in the same browser (sub-millisecond)
      publishClientRealtimeEvent({
        type: 'MEETING_SIGNAL',
        projectId,
        payload,
        senderSessionId: localPeerId,
      });

      // 2. Server broadcast for remote peers / other browsers
      try {
        await fetch(`/api/projects/${projectId}/meeting/signal`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload),
        });
      } catch (e) {
        console.warn('[Signal send error]:', e);
      }
    },
    [localPeerId, projectId]
  );

  // ── Drain Queued ICE Candidates Helper ──
  const drainIceCandidates = useCallback(async (remotePeerId: string, pc: RTCPeerConnection) => {
    const queue = pendingIceCandidatesRef.current.get(remotePeerId);
    if (queue && queue.length > 0) {
      for (const cand of queue) {
        try {
          await pc.addIceCandidate(new RTCIceCandidate(cand));
        } catch (e) {
          console.warn('[Drain candidate error]:', e);
        }
      }
      pendingIceCandidatesRef.current.delete(remotePeerId);
    }
  }, []);

  // ── Ensure Remote Audio Element is Audible & Playing ──
  const ensureRemoteAudioPlaying = useCallback(
    (remotePeerId: string, remoteStream: MediaStream) => {
      setRemoteStreams((prev) => ({ ...prev, [remotePeerId]: remoteStream }));

      remoteStream.getAudioTracks().forEach((track) => {
        track.enabled = true;
      });

      let audioElem = remoteAudioElementsRef.current.get(remotePeerId);
      if (!audioElem) {
        audioElem = document.createElement('audio');
        audioElem.id = `remote_audio_${remotePeerId}`;
        audioElem.autoplay = true;
        (audioElem as any).playsInline = true;
        audioElem.volume = 1.0;
        document.body.appendChild(audioElem);
        remoteAudioElementsRef.current.set(remotePeerId, audioElem);
      }

      if (audioElem.srcObject !== remoteStream) {
        audioElem.srcObject = remoteStream;
      }
      audioElem.muted = isDeafenedRef.current;

      if (selectedOutputIdRef.current && typeof (audioElem as any).setSinkId === 'function') {
        (audioElem as any).setSinkId(selectedOutputIdRef.current).catch(() => {});
      }

      const attemptPlay = () => {
        if (!audioElem) return;
        audioElem.play().catch((err: any) => {
          console.warn(`[Autoplay restricted for ${remotePeerId}]:`, err.message);
          setAutoplayBlocked(true);
        });
      };

      attemptPlay();

      remoteStream.getAudioTracks().forEach((track) => {
        track.onunmute = () => attemptPlay();
      });

      // Attach Web Audio Analyser to monitor remote speaker volume
      try {
        const AudioContextClass = window.AudioContext || (window as any).webkitAudioContext;
        let existing = remoteAnalysersRef.current.get(remotePeerId);
        if (!existing) {
          const remoteCtx = new AudioContextClass();
          if (remoteCtx.state === 'suspended') {
            remoteCtx.resume().catch(() => {});
          }
          const remoteSource = remoteCtx.createMediaStreamSource(remoteStream);
          const remoteAnalyser = remoteCtx.createAnalyser();
          remoteAnalyser.fftSize = 128;
          remoteSource.connect(remoteAnalyser);
          remoteAnalysersRef.current.set(remotePeerId, { ctx: remoteCtx, analyser: remoteAnalyser });
        }
      } catch {}
    },
    []
  );

  // ── 3. Create or Get Peer Connection ──
  const getOrCreatePeerConnection = useCallback(
    (remotePeerId: string) => {
      if (peerConnectionsRef.current.has(remotePeerId)) {
        return peerConnectionsRef.current.get(remotePeerId)!;
      }

      const pc = new RTCPeerConnection(ICE_SERVERS);
      peerConnectionsRef.current.set(remotePeerId, pc);

      // Add local audio tracks if available, or add receive-only transceiver
      if (localStreamRef.current && localStreamRef.current.getAudioTracks().length > 0) {
        localStreamRef.current.getTracks().forEach((track) => {
          const senders = pc.getSenders();
          if (!senders.some((s) => s.track === track)) {
            pc.addTrack(track, localStreamRef.current!);
          }
        });
      } else {
        try {
          pc.addTransceiver('audio', { direction: 'sendrecv' });
        } catch {}
      }

      // Handle ICE Candidates generated locally
      pc.onicecandidate = (event) => {
        if (event.candidate) {
          sendSignal(remotePeerId, 'candidate', event.candidate.toJSON ? event.candidate.toJSON() : event.candidate);
        }
      };

      // Handle Remote Audio Tracks
      pc.ontrack = (event) => {
        const remoteStream = event.streams[0] || new MediaStream([event.track]);
        ensureRemoteAudioPlaying(remotePeerId, remoteStream);
      };

      pc.onconnectionstatechange = () => {
        if (pc.connectionState === 'failed' || pc.connectionState === 'closed') {
          peerConnectionsRef.current.delete(remotePeerId);
          const audioElem = remoteAudioElementsRef.current.get(remotePeerId);
          if (audioElem) {
            audioElem.remove();
            remoteAudioElementsRef.current.delete(remotePeerId);
          }
          remoteAnalysersRef.current.delete(remotePeerId);
          pendingIceCandidatesRef.current.delete(remotePeerId);
          seenCandidatesRef.current.delete(remotePeerId);
          lastProcessedOfferRef.current.delete(remotePeerId);
          lastProcessedAnswerRef.current.delete(remotePeerId);
          setRemoteStreams((prev) => {
            const next = { ...prev };
            delete next[remotePeerId];
            return next;
          });
        }
      };

      return pc;
    },
    [ensureRemoteAudioPlaying, sendSignal]
  );

  // ── 4. Initiate Offer to Peer ──
  const initiateOfferToPeer = useCallback(
    async (remotePeerId: string) => {
      const pc = getOrCreatePeerConnection(remotePeerId);
      try {
        isMakingOfferRef.current.set(remotePeerId, true);
        const offer = await pc.createOffer({
          offerToReceiveAudio: true,
        });

        if (pc.signalingState !== 'stable') {
          return;
        }

        await pc.setLocalDescription(offer);
        await sendSignal(remotePeerId, 'offer', offer);
      } catch (err) {
        console.warn('[Initiate offer error]:', err);
      } finally {
        isMakingOfferRef.current.set(remotePeerId, false);
      }
    },
    [getOrCreatePeerConnection, sendSignal]
  );

  // ── 5. Local Audio Track Initialization ──
  const initLocalAudio = useCallback(
    async (deviceId?: string): Promise<MediaStream | null> => {
      try {
        setIsConnecting(true);
        setPermissionError(null);

        // Clean up previous tracks if switching
        if (localStreamRef.current) {
          localStreamRef.current.getTracks().forEach((t) => t.stop());
        }

        const constraints: MediaStreamConstraints = {
          audio: {
            deviceId: deviceId ? { ideal: deviceId } : undefined,
            echoCancellation: true,
            noiseSuppression: true,
            autoGainControl: true,
          },
          video: false,
        };

        const stream = await navigator.mediaDevices.getUserMedia(constraints);
        localStreamRef.current = stream;

        // Apply initial mute state
        stream.getAudioTracks().forEach((track) => {
          track.enabled = !isMuted;
        });

        // Setup Web Audio Analyser for local voice detection
        try {
          const AudioContextClass = window.AudioContext || (window as any).webkitAudioContext;
          const audioCtx = new AudioContextClass();
          if (audioCtx.state === 'suspended') {
            audioCtx.resume().catch(() => {});
          }
          const source = audioCtx.createMediaStreamSource(stream);
          const analyser = audioCtx.createAnalyser();
          analyser.fftSize = 256;
          source.connect(analyser);

          localAudioContextRef.current = audioCtx;
          localAnalyserRef.current = analyser;

          if (localVolumeIntervalRef.current) clearInterval(localVolumeIntervalRef.current);
          localVolumeIntervalRef.current = setInterval(() => {
            if (!localAnalyserRef.current || isMuted) {
              setLocalSpeaking(false);
              setLocalVolumeLevel(0);
              return;
            }
            const dataArray = new Uint8Array(localAnalyserRef.current.frequencyBinCount);
            localAnalyserRef.current.getByteFrequencyData(dataArray);

            let sum = 0;
            for (let i = 0; i < dataArray.length; i++) {
              sum += dataArray[i];
            }
            const average = sum / dataArray.length;
            const normalized = Math.min(100, Math.round((average / 128) * 100));
            setLocalVolumeLevel(normalized);

            const isCurrentlySpeaking = average > 12;
            setLocalSpeaking(isCurrentlySpeaking);
          }, 120);
        } catch (audioCtxErr) {
          console.warn('[AudioContext Init Note]:', audioCtxErr);
        }

        // Attach audio track to any existing peer connections
        const audioTrack = stream.getAudioTracks()[0];
        if (audioTrack) {
          for (const [remotePeerId, pc] of peerConnectionsRef.current.entries()) {
            const senders = pc.getSenders();
            const sender = senders.find((s) => s.track && s.track.kind === 'audio');
            if (sender) {
              await sender.replaceTrack(audioTrack);
            } else {
              pc.addTrack(audioTrack, stream);
              initiateOfferToPeer(remotePeerId);
            }
          }
        }

        setIsConnected(true);
        setIsConnecting(false);
        await refreshDevices();
        return stream;
      } catch (err: any) {
        setIsConnecting(false);
        const errMsg =
          err.name === 'NotAllowedError'
            ? 'Microphone access was denied. Please allow microphone permissions in your browser to talk in this meeting.'
            : `Could not access microphone: ${err.message || 'Unknown device error'}`;
        setPermissionError(errMsg);
        toast.error('Microphone access required');
        return null;
      }
    },
    [initiateOfferToPeer, isMuted, refreshDevices]
  );

  // Monitor remote audio analyzers to detect speaking participants
  useEffect(() => {
    const interval = setInterval(() => {
      const speakingMap: Record<string, boolean> = {};
      remoteAnalysersRef.current.forEach(({ analyser }, peerId) => {
        const dataArray = new Uint8Array(analyser.frequencyBinCount);
        analyser.getByteFrequencyData(dataArray);
        let sum = 0;
        for (let i = 0; i < dataArray.length; i++) {
          sum += dataArray[i];
        }
        const avg = sum / dataArray.length;
        speakingMap[peerId] = avg > 14;
      });
      setRemoteSpeaking(speakingMap);
    }, 150);

    return () => clearInterval(interval);
  }, []);

  // ── 6. Real-time Signaling & Meeting Events Subscription ──
  const handleRealtimeMeetingEvent = useCallback(
    async (event: RealtimeEvent) => {
      if (String(event.projectId) !== String(projectId)) return;

      const { type, payload, senderSessionId } = event;
      if (senderSessionId === localPeerId) return; // Ignore own echoes

      // ── Handle WebRTC Signaling ──
      if (type === 'MEETING_SIGNAL') {
        const { fromPeerId, targetPeerId, signalType, data } = payload;
        if (targetPeerId && targetPeerId !== localPeerId) return; // Not meant for this peer

        const pc = getOrCreatePeerConnection(fromPeerId);

        // ── Offer Handling with Perfect Negotiation (Resolves Glare) ──
        if (signalType === 'offer') {
          try {
            if (!data || !data.sdp) return;
            // Prevent duplicate offers from triggering renegotiation
            if (lastProcessedOfferRef.current.get(fromPeerId) === data.sdp) {
              return;
            }
            lastProcessedOfferRef.current.set(fromPeerId, data.sdp);

            const isPolite = localPeerId.localeCompare(fromPeerId) > 0;
            const isMakingOffer = isMakingOfferRef.current.get(fromPeerId) || false;
            const offerCollision = isMakingOffer || pc.signalingState !== 'stable';

            if (offerCollision && !isPolite) {
              // Impolite peer rejects incoming colliding offer
              return;
            }

            if (offerCollision && isPolite) {
              // Polite peer rolls back local offer
              try {
                await pc.setLocalDescription({ type: 'rollback' });
              } catch {}
            }

            await pc.setRemoteDescription(new RTCSessionDescription(data));
            await drainIceCandidates(fromPeerId, pc);

            // Ensure our local audio tracks are attached
            if (localStreamRef.current && localStreamRef.current.getAudioTracks().length > 0) {
              const audioTrack = localStreamRef.current.getAudioTracks()[0];
              const senders = pc.getSenders();
              const sender = senders.find((s) => s.track && s.track.kind === 'audio');
              if (sender) {
                await sender.replaceTrack(audioTrack);
              } else {
                pc.addTrack(audioTrack, localStreamRef.current);
              }
            }

            const answer = await pc.createAnswer();
            await pc.setLocalDescription(answer);
            await sendSignal(fromPeerId, 'answer', answer);
          } catch (offerErr) {
            console.warn('[Handle offer error]:', offerErr);
          }
        }

        // ── Answer Handling ──
        else if (signalType === 'answer') {
          try {
            if (!data || !data.sdp) return;
            // Prevent duplicate answers
            if (lastProcessedAnswerRef.current.get(fromPeerId) === data.sdp) {
              return;
            }
            lastProcessedAnswerRef.current.set(fromPeerId, data.sdp);

            if (pc.signalingState === 'have-local-offer') {
              await pc.setRemoteDescription(new RTCSessionDescription(data));
              await drainIceCandidates(fromPeerId, pc);
            }
          } catch (answerErr) {
            console.warn('[Handle answer error]:', answerErr);
          }
        }

        // ── Candidate Handling with Queuing & Deduplication ──
        else if (signalType === 'candidate') {
          if (!data || !data.candidate) return;

          // Deduplicate candidate
          let seen = seenCandidatesRef.current.get(fromPeerId);
          if (!seen) {
            seen = new Set<string>();
            seenCandidatesRef.current.set(fromPeerId, seen);
          }
          const candKey = `${data.candidate}_${data.sdpMid}_${data.sdpMLineIndex}`;
          if (seen.has(candKey)) return;
          seen.add(candKey);

          if (!pc.remoteDescription || !pc.remoteDescription.type) {
            // Buffer candidate until remoteDescription is set
            const queue = pendingIceCandidatesRef.current.get(fromPeerId) || [];
            queue.push(data);
            pendingIceCandidatesRef.current.set(fromPeerId, queue);
          } else {
            try {
              await pc.addIceCandidate(new RTCIceCandidate(data));
            } catch (err) {
              console.warn('[Add ICE candidate error]:', err);
            }
          }
        }

        // ── Request-Offer Handling ──
        else if (signalType === 'request-offer') {
          initiateOfferToPeer(fromPeerId);
        }
      }

      // ── Handle Peer Joined ──
      if (type === 'MEETING_JOINED') {
        const { participant, participants: updatedList } = payload;
        if (participant && participant.peerId !== localPeerId) {
          toast.info(`${participant.userName} joined the meeting`);
          getOrCreatePeerConnection(participant.peerId);
        }
        if (Array.isArray(updatedList)) {
          setParticipants(updatedList);
        } else if (participant && participant.peerId !== localPeerId) {
          setParticipants((prev) => {
            if (prev.some((p) => p.peerId === participant.peerId)) return prev;
            return [...prev, participant];
          });
        }
      }

      // ── Handle Peer Left ──
      if (type === 'MEETING_LEFT') {
        const { peerId: leftPeerId, participants: updatedList } = payload;
        if (leftPeerId) {
          const pc = peerConnectionsRef.current.get(leftPeerId);
          if (pc) {
            pc.close();
            peerConnectionsRef.current.delete(leftPeerId);
          }
          const audioElem = remoteAudioElementsRef.current.get(leftPeerId);
          if (audioElem) {
            audioElem.remove();
            remoteAudioElementsRef.current.delete(leftPeerId);
          }
          remoteAnalysersRef.current.delete(leftPeerId);
          pendingIceCandidatesRef.current.delete(leftPeerId);
          seenCandidatesRef.current.delete(leftPeerId);
          lastProcessedOfferRef.current.delete(leftPeerId);
          lastProcessedAnswerRef.current.delete(leftPeerId);
          setRemoteStreams((prev) => {
            const next = { ...prev };
            delete next[leftPeerId];
            return next;
          });
        }
        if (Array.isArray(updatedList)) {
          setParticipants(updatedList);
        } else if (leftPeerId) {
          setParticipants((prev) => prev.filter((p) => p.peerId !== leftPeerId));
        }
      }

      // ── Handle Peer State (Mute/Speaking/Deafen) ──
      if (type === 'MEETING_STATE') {
        const { peerId: statePeerId, isMuted: mutedState, isSpeaking: spkState, isDeafened: deafState } = payload;
        setParticipants((prev) =>
          prev.map((p) =>
            p.peerId === statePeerId
              ? {
                  ...p,
                  isMuted: mutedState ?? p.isMuted,
                  isSpeaking: spkState ?? p.isSpeaking,
                  isDeafened: deafState ?? p.isDeafened,
                }
              : p
          )
        );
      }
    },
    [drainIceCandidates, getOrCreatePeerConnection, initiateOfferToPeer, localPeerId, projectId, sendSignal]
  );

  useRealtimeSubscription({
    projectId,
    onEvent: handleRealtimeMeetingEvent,
  });

  // ── Instant Leave Broadcast & Server Notification ──
  const performLeave = useCallback(
    (isUnloading = false) => {
      // 1. Instantly broadcast left event across all browser tabs
      publishClientRealtimeEvent({
        type: 'MEETING_LEFT',
        projectId,
        payload: {
          peerId: localPeerId,
          userId: currentUser?.id,
        },
        senderSessionId: localPeerId,
      });

      // 2. Inform server via beacon (if unloading) or fetch with keepalive
      const leaveBody = JSON.stringify({
        action: 'leave',
        peerId: localPeerId,
      });

      if (isUnloading && typeof navigator !== 'undefined' && navigator.sendBeacon) {
        try {
          const blob = new Blob([leaveBody], { type: 'application/json' });
          navigator.sendBeacon(`/api/projects/${projectId}/meeting`, blob);
          return;
        } catch {}
      }

      fetch(`/api/projects/${projectId}/meeting`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: leaveBody,
        keepalive: true,
      }).catch(() => {});
    },
    [currentUser?.id, localPeerId, projectId]
  );

  // ── 7. Join Room on Mount & Start Heartbeat ──
  useEffect(() => {
    let isCancelled = false;

    async function startMeetingSession() {
      // 1. FIRST acquire local audio stream so microphone track is attached before any offer/answer
      await initLocalAudio();
      if (isCancelled) return;

      // 2. NOW register participant presence on server
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

        if (res.ok && !isCancelled) {
          const json = await res.json();
          if (Array.isArray(json.participants)) {
            setParticipants(json.participants);

            // Connect to any other already-existing peers:
            // The newly joined peer initiates the WebRTC offer to each existing peer
            for (const p of json.participants) {
              if (p.peerId !== localPeerId) {
                initiateOfferToPeer(p.peerId);
              }
            }
          }
        }
      } catch (e) {
        console.warn('[Join meeting error]:', e);
      }
    }

    startMeetingSession();

    // Periodic Heartbeat every 8s to keep presence active and reconcile state
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
          if (Array.isArray(json.participants)) {
            setParticipants(json.participants);
          }
        }
      } catch {}
    }, 8000);

    const handleUnload = () => {
      performLeave(true);
    };

    window.addEventListener('beforeunload', handleUnload);
    window.addEventListener('pagehide', handleUnload);

    return () => {
      isCancelled = true;
      clearInterval(heartbeat);
      window.removeEventListener('beforeunload', handleUnload);
      window.removeEventListener('pagehide', handleUnload);

      performLeave(false);

      // Close all peer connections
      peerConnectionsRef.current.forEach((pc) => pc.close());
      peerConnectionsRef.current.clear();

      // Remove audio elements
      remoteAudioElementsRef.current.forEach((el) => el.remove());
      remoteAudioElementsRef.current.clear();
      remoteAnalysersRef.current.clear();

      // Stop local microphone tracks
      if (localStreamRef.current) {
        localStreamRef.current.getTracks().forEach((t) => t.stop());
      }
      if (localVolumeIntervalRef.current) clearInterval(localVolumeIntervalRef.current);
    };
  }, [initLocalAudio, initiateOfferToPeer, localPeerId, performLeave, projectId]);

  // ── 7. Microphone Device Switching ──
  const handleSwitchMic = async (deviceId: string) => {
    setSelectedInputId(deviceId);
    await initLocalAudio(deviceId);
    toast.success('Microphone switched');
  };

  // ── 8. Speaker / Output Device Switching ──
  const handleSwitchSpeaker = async (deviceId: string) => {
    setSelectedOutputId(deviceId);
    selectedOutputIdRef.current = deviceId;
    remoteAudioElementsRef.current.forEach((audio) => {
      if (typeof (audio as any).setSinkId === 'function') {
        (audio as any).setSinkId(deviceId).catch((err: any) => {
          console.warn('[setSinkId Error]:', err);
        });
      }
    });
    toast.success('Speaker output switched');
  };

  // ── 9. Toggle Mic Mute ──
  const handleToggleMute = () => {
    const nextMuted = !isMuted;
    setIsMuted(nextMuted);
    isMutedRef.current = nextMuted;

    if (localStreamRef.current) {
      localStreamRef.current.getAudioTracks().forEach((t) => {
        t.enabled = !nextMuted;
      });
    }

    // Inform server and peers
    fetch(`/api/projects/${projectId}/meeting`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        action: 'state',
        peerId: localPeerId,
        isMuted: nextMuted,
      }),
    }).catch(() => {});

    toast.info(nextMuted ? 'Microphone muted' : 'Microphone unmuted');
  };

  // ── 10. Toggle Deafen (Mute Incoming Audio) ──
  const handleToggleDeafen = () => {
    const nextDeafen = !isDeafened;
    setIsDeafened(nextDeafen);
    isDeafenedRef.current = nextDeafen;

    remoteAudioElementsRef.current.forEach((audio) => {
      audio.muted = nextDeafen;
    });

    toast.info(nextDeafen ? 'Sound deafened' : 'Sound undeafened');
  };

  // ── 11. Leave Meeting ──
  const handleLeaveCall = () => {
    performLeave(false);
    if (onLeaveMeeting) {
      onLeaveMeeting();
    } else {
      window.history.back();
    }
  };

  // List of participants to render (including Local user)
  const renderedParticipants = useMemo(() => {
    const others = participants.filter((p) => p.peerId !== localPeerId);
    const localUserParticipant: MeetingParticipant = {
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

    return [localUserParticipant, ...others];
  }, [currentUser, isDeafened, isMuted, localPeerId, localSpeaking, participants]);

  return (
    <div
      onClick={unlockAudio}
      className="flex-1 w-full h-full flex flex-col bg-[#0A0B0D] text-[#CFD4DD] overflow-hidden select-none font-sans"
    >
      {/* ── Top Meeting Room Header ── */}
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

        {/* Action Header Buttons */}
        <div className="flex items-center gap-2.5">
          <button
            onClick={(e) => {
              e.stopPropagation();
              setShowDeviceSettings((prev) => !prev);
            }}
            className={`flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded-xl border transition-all cursor-pointer ${
              showDeviceSettings
                ? 'bg-[#DCB001]/15 text-[#DCB001] border-[#DCB001]/40 shadow-sm'
                : 'bg-[#18191E] text-[#8E939D] hover:text-white border-[#2A2C30]'
            }`}
            title="Configure Audio Input & Output Devices"
          >
            <Settings size={14} />
            <span>Audio Devices</span>
          </button>

          <button
            onClick={(e) => {
              e.stopPropagation();
              handleLeaveCall();
            }}
            className="flex items-center gap-1.5 px-3.5 py-1.5 text-xs font-semibold rounded-xl bg-red-500/15 hover:bg-red-500/25 text-red-400 border border-red-500/30 transition-all shadow-md cursor-pointer"
            title="Leave Meeting Room"
          >
            <PhoneOff size={14} />
            <span>Leave</span>
          </button>
        </div>
      </div>

      {/* ── Main Meeting Body ── */}
      <div className="flex-1 min-h-0 flex flex-col relative overflow-hidden bg-[#0A0B0D]">
        {/* Autoplay Blocked Alert Banner */}
        {autoplayBlocked && (
          <div
            onClick={unlockAudio}
            className="mx-6 mt-4 p-3.5 rounded-xl bg-amber-500/15 border border-amber-500/35 text-amber-300 text-xs flex items-center justify-between shadow-lg cursor-pointer animate-pulse"
          >
            <div className="flex items-center gap-2.5">
              <Volume2 size={16} className="text-amber-400 shrink-0" />
              <span>Browser autoplay policy blocked audio. Click anywhere on this screen to enable audio playback.</span>
            </div>
            <button className="px-3 py-1 bg-amber-500 text-black rounded-lg font-bold transition-colors text-[11px] shrink-0">
              Enable Audio
            </button>
          </div>
        )}

        {/* Permission / Connection Warning Bar */}
        {permissionError && (
          <div className="mx-6 mt-4 p-3.5 rounded-xl bg-red-500/10 border border-red-500/30 text-red-300 text-xs flex items-center justify-between shadow-lg">
            <div className="flex items-center gap-2.5">
              <AlertCircle size={16} className="text-red-400 shrink-0" />
              <span>{permissionError}</span>
            </div>
            <button
              onClick={(e) => {
                e.stopPropagation();
                initLocalAudio();
              }}
              className="px-2.5 py-1 bg-red-500/20 hover:bg-red-500/30 text-white rounded-lg font-medium transition-colors text-[11px] cursor-pointer"
            >
              Retry Microphone
            </button>
          </div>
        )}

        {/* ── Slide-Down Device Switcher Settings Drawer ── */}
        {showDeviceSettings && (
          <div className="mx-6 mt-4 p-4 rounded-2xl bg-[#141519] border border-[#2B2D33] shadow-2xl flex flex-col md:flex-row items-center justify-between gap-4 z-30 animate-in fade-in slide-in-from-top-2 duration-200">
            {/* Input Mic Selector */}
            <div className="flex-1 w-full">
              <label className="text-[11px] font-semibold text-[#8E939D] uppercase tracking-wider flex items-center gap-1.5 mb-1.5">
                <Mic size={12} className="text-[#DCB001]" />
                Microphone (Input Device)
              </label>
              <select
                value={selectedInputId}
                onChange={(e) => handleSwitchMic(e.target.value)}
                className="w-full bg-[#1A1C22] border border-[#33363F] text-white text-xs rounded-xl px-3 py-2 outline-none focus:border-[#DCB001] transition-colors cursor-pointer"
              >
                {audioInputDevices.length === 0 && <option value="">Default Microphone</option>}
                {audioInputDevices.map((device, idx) => (
                  <option key={device.deviceId || idx} value={device.deviceId}>
                    {device.label || `Microphone ${idx + 1}`}
                  </option>
                ))}
              </select>

              {/* Real-time Local Mic Meter */}
              <div className="mt-2 flex items-center gap-2">
                <span className="text-[10px] text-[#787C83] font-mono">Mic Input Level:</span>
                <div className="flex-1 h-1.5 rounded-full bg-[#202228] overflow-hidden">
                  <div
                    className="h-full bg-[#22C55E] transition-all duration-75"
                    style={{ width: `${isMuted ? 0 : localVolumeLevel}%` }}
                  />
                </div>
              </div>
            </div>

            {/* Output Speaker Selector */}
            <div className="flex-1 w-full">
              <label className="text-[11px] font-semibold text-[#8E939D] uppercase tracking-wider flex items-center gap-1.5 mb-1.5">
                <Headphones size={12} className="text-[#DCB001]" />
                Speaker / Output Device
              </label>
              <select
                value={selectedOutputId}
                onChange={(e) => handleSwitchSpeaker(e.target.value)}
                className="w-full bg-[#1A1C22] border border-[#33363F] text-white text-xs rounded-xl px-3 py-2 outline-none focus:border-[#DCB001] transition-colors cursor-pointer"
              >
                {audioOutputDevices.length === 0 && <option value="">Default System Speaker</option>}
                {audioOutputDevices.map((device, idx) => (
                  <option key={device.deviceId || idx} value={device.deviceId}>
                    {device.label || `Speaker / Headphones ${idx + 1}`}
                  </option>
                ))}
              </select>
              <p className="mt-1.5 text-[10px] text-[#787C83]">
                Output sink switching supported in modern Chromium/Edge browsers.
              </p>
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
            {renderedParticipants.map((p) => {
              const isMe = p.peerId === localPeerId;
              const isCurrentlySpeaking = isMe ? localSpeaking : remoteSpeaking[p.peerId];

              return (
                <div
                  key={p.peerId}
                  className={`relative rounded-2xl bg-[#121317] border transition-all duration-200 flex flex-col items-center justify-center p-6 shadow-xl overflow-hidden ${
                    isCurrentlySpeaking
                      ? 'border-[#22C55E] ring-4 ring-[#22C55E]/20 shadow-[0_0_24px_rgba(34,197,94,0.2)]'
                      : 'border-[#22242A] hover:border-[#333640]'
                  }`}
                >
                  {/* Speaking Waves Animation in Background */}
                  {isCurrentlySpeaking && (
                    <div className="absolute inset-0 bg-radial from-[#22C55E]/10 to-transparent pointer-events-none animate-pulse" />
                  )}

                  {/* Avatar with Halo */}
                  <div className="relative mb-3.5">
                    <div
                      className={`w-20 h-20 rounded-full flex items-center justify-center overflow-hidden font-bold text-xl uppercase transition-all duration-200 ${
                        isCurrentlySpeaking
                          ? 'ring-4 ring-[#22C55E] ring-offset-4 ring-offset-[#121317] scale-105'
                          : 'ring-2 ring-[#2B2D35]'
                      } ${
                        p.userAvatar
                          ? 'bg-[#1E2026]'
                          : 'bg-gradient-to-br from-[#2B2E38] to-[#17181F] text-white'
                      }`}
                    >
                      {p.userAvatar ? (
                        <img
                          src={p.userAvatar}
                          alt={p.userName}
                          className="w-full h-full object-cover"
                        />
                      ) : (
                        <span>{p.userName.slice(0, 2)}</span>
                      )}
                    </div>

                    {/* Mic Status Badge on Avatar Corner */}
                    <div
                      className={`absolute bottom-0 right-0 w-6 h-6 rounded-full flex items-center justify-center border-2 border-[#121317] shadow-md ${
                        p.isMuted
                          ? 'bg-red-500 text-white'
                          : isCurrentlySpeaking
                          ? 'bg-[#22C55E] text-black animate-bounce'
                          : 'bg-[#1F2128] text-[#8E939D]'
                      }`}
                    >
                      {p.isMuted ? <MicOff size={11} /> : <Mic size={11} />}
                    </div>
                  </div>

                  {/* Participant Name & Status */}
                  <div className="flex items-center gap-1.5 mb-1 z-10">
                    <span className="font-semibold text-sm text-white tracking-tight">
                      {p.userName}
                    </span>
                    {isMe && (
                      <span className="px-1.5 py-0.2 rounded bg-[#DCB001]/15 text-[#DCB001] font-mono text-[9px] font-bold border border-[#DCB001]/30">
                        YOU
                      </span>
                    )}
                  </div>

                  {/* Audio Waveform Equalizer when Speaking */}
                  <div className="h-4 flex items-center gap-1 mt-1 z-10">
                    {isCurrentlySpeaking ? (
                      <>
                        <span className="w-1 h-3.5 bg-[#22C55E] rounded-full animate-pulse" />
                        <span className="w-1 h-5 bg-[#22C55E] rounded-full animate-pulse delay-75" />
                        <span className="w-1 h-2 bg-[#22C55E] rounded-full animate-pulse delay-150" />
                        <span className="w-1 h-4 bg-[#22C55E] rounded-full animate-pulse delay-100" />
                        <span className="text-[10px] text-[#22C55E] font-mono font-medium ml-1">
                          Speaking...
                        </span>
                      </>
                    ) : (
                      <span className="text-[10px] text-[#6B707B] font-mono">
                        {p.isMuted ? 'Muted' : 'Idle'}
                      </span>
                    )}
                  </div>

                  {/* Top-Right Signal Badge */}
                  <div className="absolute top-3 right-3 flex items-center gap-1 text-[10px] text-[#6B707B] font-mono">
                    <Signal size={12} className="text-[#22C55E]" />
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* ── Bottom Floating Audio Dock Controls ── */}
        <div className="h-20 border-t border-[#1C1E23] bg-[#0E0F12]/95 backdrop-blur-xl flex items-center justify-center gap-4 px-6 z-30 shadow-2xl">
          {/* Mute Mic Button */}
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

          {/* Deafen Button */}
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

          {/* Device Settings Toggle */}
          <button
            onClick={() => setShowDeviceSettings((prev) => !prev)}
            className={`flex items-center gap-2 px-4 py-2.5 rounded-2xl font-semibold text-xs transition-all border ${
              showDeviceSettings
                ? 'bg-[#DCB001]/15 text-[#DCB001] border-[#DCB001]/40'
                : 'bg-[#16171C] hover:bg-[#22242B] text-[#9BA1A6] border-[#292B33]'
            }`}
            title="Audio Input / Output Device Preferences"
          >
            <Sliders size={15} />
            <span>Devices</span>
          </button>

          {/* Leave Meeting Call Button */}
          <button
            onClick={handleLeaveCall}
            className="flex items-center gap-2 px-5 py-2.5 rounded-2xl font-semibold text-xs bg-red-600 hover:bg-red-700 text-white transition-all shadow-lg hover:shadow-red-600/30 cursor-pointer"
            title="Disconnect & Exit Call"
          >
            <PhoneOff size={16} />
            <span>Leave Call</span>
          </button>
        </div>

        {/* ── Hidden Audio Players for Remote Participants in React DOM ── */}
        <div className="hidden" aria-hidden="true">
          {renderedParticipants
            .filter((p) => p.peerId !== localPeerId)
            .map((p) => (
              <audio
                key={p.peerId}
                id={`audio_elem_${p.peerId}`}
                autoPlay
                playsInline
                muted={isDeafened}
                ref={(el) => {
                  if (el) {
                    remoteAudioElementsRef.current.set(p.peerId, el);
                    const stream = remoteStreams[p.peerId];
                    if (stream && el.srcObject !== stream) {
                      el.srcObject = stream;
                      el.play().catch(() => setAutoplayBlocked(true));
                    }
                    if (selectedOutputId && typeof (el as any).setSinkId === 'function') {
                      (el as any).setSinkId(selectedOutputId).catch(() => {});
                    }
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
