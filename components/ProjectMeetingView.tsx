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
import { useRealtimeSubscription, RealtimeEvent } from '@/lib/useRealtime';

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

const ICE_SERVERS = {
  iceServers: [
    { urls: 'stun:stun.l.google.com:19302' },
    { urls: 'stun:stun1.l.google.com:19302' },
    { urls: 'stun:stun2.l.google.com:19302' },
  ],
};

export const ProjectMeetingView: React.FC<ProjectMeetingViewProps> = ({
  projectId,
  projectName,
  currentUser,
  onLeaveMeeting,
}) => {
  // Session / Peer Identity
  const localPeerIdRef = useRef<string>(`peer_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`);
  const localPeerId = localPeerIdRef.current;

  // Connection and Room States
  const [isConnected, setIsConnected] = useState(false);
  const [isConnecting, setIsConnecting] = useState(true);
  const [permissionError, setPermissionError] = useState<string | null>(null);
  const [meetingDuration, setMeetingDuration] = useState(0);

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
  const [isTestingMic, setIsTestingMic] = useState(false);

  // Participants & Remote Streams
  const [participants, setParticipants] = useState<MeetingParticipant[]>([]);
  const [remoteSpeaking, setRemoteSpeaking] = useState<Record<string, boolean>>({});

  // Audio References
  const localStreamRef = useRef<MediaStream | null>(null);
  const localAudioContextRef = useRef<AudioContext | null>(null);
  const localAnalyserRef = useRef<AnalyserNode | null>(null);
  const localVolumeIntervalRef = useRef<NodeJS.Timeout | null>(null);

  // WebRTC Peer Connections & Remote Streams Map
  const peerConnectionsRef = useRef<Map<string, RTCPeerConnection>>(new Map());
  const remoteAudioElementsRef = useRef<Map<string, HTMLAudioElement>>(new Map());
  const remoteAnalysersRef = useRef<Map<string, { ctx: AudioContext; analyser: AnalyserNode }>>(new Map());

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

  // ── 2. Local Audio Track Initialization ──
  const initLocalAudio = useCallback(async (deviceId?: string) => {
    try {
      setIsConnecting(true);
      setPermissionError(null);

      // Clean up previous tracks if switching
      if (localStreamRef.current) {
        localStreamRef.current.getTracks().forEach((t) => t.stop());
      }

      const constraints: MediaStreamConstraints = {
        audio: {
          deviceId: deviceId ? { exact: deviceId } : undefined,
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

      // Replace audio track on any existing peer connections
      const audioTrack = stream.getAudioTracks()[0];
      if (audioTrack) {
        peerConnectionsRef.current.forEach((pc) => {
          const senders = pc.getSenders();
          const sender = senders.find((s) => s.track && s.track.kind === 'audio');
          if (sender) {
            sender.replaceTrack(audioTrack);
          } else {
            pc.addTrack(audioTrack, stream);
          }
        });
      }

      setIsConnected(true);
      setIsConnecting(false);
      await refreshDevices();
    } catch (err: any) {
      setIsConnecting(false);
      const errMsg = err.name === 'NotAllowedError'
        ? 'Microphone access was denied. Please allow microphone permissions in your browser to talk in this meeting.'
        : `Could not access microphone: ${err.message || 'Unknown device error'}`;
      setPermissionError(errMsg);
      toast.error('Microphone access required');
    }
  }, [isMuted, refreshDevices]);

  // ── 3. Send WebRTC Signal via Next.js API ──
  const sendSignal = useCallback(
    async (targetPeerId: string, signalType: 'offer' | 'answer' | 'candidate' | 'request-offer', data: any) => {
      try {
        await fetch(`/api/projects/${projectId}/meeting/signal`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            fromPeerId: localPeerId,
            targetPeerId,
            signalType,
            data,
          }),
        });
      } catch (e) {
        console.warn('[Signal send error]:', e);
      }
    },
    [localPeerId, projectId]
  );

  // ── 4. Create or Get Peer Connection ──
  const getOrCreatePeerConnection = useCallback(
    (remotePeerId: string) => {
      if (peerConnectionsRef.current.has(remotePeerId)) {
        return peerConnectionsRef.current.get(remotePeerId)!;
      }

      const pc = new RTCPeerConnection(ICE_SERVERS);
      peerConnectionsRef.current.set(remotePeerId, pc);

      // Add local tracks if available
      if (localStreamRef.current) {
        localStreamRef.current.getTracks().forEach((track) => {
          pc.addTrack(track, localStreamRef.current!);
        });
      }

      // Handle ICE Candidates
      pc.onicecandidate = (event) => {
        if (event.candidate) {
          sendSignal(remotePeerId, 'candidate', event.candidate);
        }
      };

      // Handle Remote Audio Track
      pc.ontrack = (event) => {
        const remoteStream = event.streams[0] || new MediaStream([event.track]);

        let audioElem = remoteAudioElementsRef.current.get(remotePeerId);
        if (!audioElem) {
          audioElem = document.createElement('audio');
          audioElem.autoplay = true;
          (audioElem as any).playsInline = true;
          audioElem.id = `remote_audio_${remotePeerId}`;
          document.body.appendChild(audioElem);
          remoteAudioElementsRef.current.set(remotePeerId, audioElem);
        }

        audioElem.srcObject = remoteStream;
        audioElem.muted = isDeafened;

        if (selectedOutputId && typeof (audioElem as any).setSinkId === 'function') {
          (audioElem as any).setSinkId(selectedOutputId).catch(() => {});
        }

        // Attach AnalyserNode to remote stream to monitor volume
        try {
          const AudioContextClass = window.AudioContext || (window as any).webkitAudioContext;
          const remoteCtx = new AudioContextClass();
          const remoteSource = remoteCtx.createMediaStreamSource(remoteStream);
          const remoteAnalyser = remoteCtx.createAnalyser();
          remoteAnalyser.fftSize = 128;
          remoteSource.connect(remoteAnalyser);
          remoteAnalysersRef.current.set(remotePeerId, { ctx: remoteCtx, analyser: remoteAnalyser });
        } catch {}
      };

      pc.onconnectionstatechange = () => {
        if (pc.connectionState === 'failed' || pc.connectionState === 'closed') {
          peerConnectionsRef.current.delete(remotePeerId);
        }
      };

      return pc;
    },
    [isDeafened, selectedOutputId, sendSignal]
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

  // ── 5. Real-time Signaling & Meeting Events Subscription ──
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

        if (signalType === 'offer') {
          await pc.setRemoteDescription(new RTCSessionDescription(data));
          const answer = await pc.createAnswer();
          await pc.setLocalDescription(answer);
          sendSignal(fromPeerId, 'answer', answer);
        } else if (signalType === 'answer') {
          await pc.setRemoteDescription(new RTCSessionDescription(data));
        } else if (signalType === 'candidate') {
          try {
            await pc.addIceCandidate(new RTCIceCandidate(data));
          } catch (err) {
            console.warn('[ICE candidate error]:', err);
          }
        } else if (signalType === 'request-offer') {
          const offer = await pc.createOffer();
          await pc.setLocalDescription(offer);
          sendSignal(fromPeerId, 'offer', offer);
        }
      }

      // ── Handle Peer Joined ──
      if (type === 'MEETING_JOINED') {
        const { participant, participants: updatedList } = payload;
        if (participant && participant.peerId !== localPeerId) {
          toast.info(`${participant.userName} joined the meeting`);
          // Initiate WebRTC offer to the newly joined peer
          const pc = getOrCreatePeerConnection(participant.peerId);
          try {
            const offer = await pc.createOffer();
            await pc.setLocalDescription(offer);
            sendSignal(participant.peerId, 'offer', offer);
          } catch (e) {
            console.warn('[Create offer error]:', e);
          }
        }
        if (Array.isArray(updatedList)) {
          setParticipants(updatedList);
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
        }
        if (Array.isArray(updatedList)) {
          setParticipants(updatedList);
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
    [getOrCreatePeerConnection, localPeerId, projectId, sendSignal]
  );

  useRealtimeSubscription({
    projectId,
    onEvent: handleRealtimeMeetingEvent,
  });

  // ── 6. Join Room on Mount & Start Heartbeat ──
  useEffect(() => {
    initLocalAudio();

    // Register participant on server
    const joinMeeting = async () => {
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
        if (res.ok) {
          const json = await res.json();
          if (Array.isArray(json.participants)) {
            setParticipants(json.participants);

            // Connect to any other already-existing peers
            json.participants.forEach((p: MeetingParticipant) => {
              if (p.peerId !== localPeerId) {
                // Request offer from existing peers
                sendSignal(p.peerId, 'request-offer', {});
              }
            });
          }
        }
      } catch (e) {
        console.warn('[Join meeting error]:', e);
      }
    };

    joinMeeting();

    // Periodic Heartbeat
    const heartbeat = setInterval(async () => {
      try {
        await fetch(`/api/projects/${projectId}/meeting`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            action: 'heartbeat',
            peerId: localPeerId,
            isMuted,
            isDeafened,
            isSpeaking: localSpeaking,
          }),
        });
      } catch {}
    }, 12000);

    return () => {
      clearInterval(heartbeat);

      // Leave meeting cleanup
      fetch(`/api/projects/${projectId}/meeting`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'leave',
          peerId: localPeerId,
        }),
      }).catch(() => {});

      // Close all peer connections
      peerConnectionsRef.current.forEach((pc) => pc.close());
      peerConnectionsRef.current.clear();

      // Remove audio elements
      remoteAudioElementsRef.current.forEach((el) => el.remove());
      remoteAudioElementsRef.current.clear();

      // Stop local microphone tracks
      if (localStreamRef.current) {
        localStreamRef.current.getTracks().forEach((t) => t.stop());
      }
      if (localVolumeIntervalRef.current) clearInterval(localVolumeIntervalRef.current);
    };
  }, [initLocalAudio, localPeerId, projectId, sendSignal]);

  // ── 7. Microphone Device Switching ──
  const handleSwitchMic = async (deviceId: string) => {
    setSelectedInputId(deviceId);
    await initLocalAudio(deviceId);
    toast.success('Microphone switched');
  };

  // ── 8. Speaker / Output Device Switching ──
  const handleSwitchSpeaker = async (deviceId: string) => {
    setSelectedOutputId(deviceId);
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

    remoteAudioElementsRef.current.forEach((audio) => {
      audio.muted = nextDeafen;
    });

    toast.info(nextDeafen ? 'Sound deafened' : 'Sound undeafened');
  };

  // ── 11. Leave Meeting ──
  const handleLeaveCall = () => {
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
    <div className="flex-1 w-full h-full flex flex-col bg-[#0A0B0D] text-[#CFD4DD] overflow-hidden select-none font-sans">
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
            onClick={() => setShowDeviceSettings((prev) => !prev)}
            className={`flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded-xl border transition-all ${
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
            onClick={handleLeaveCall}
            className="flex items-center gap-1.5 px-3.5 py-1.5 text-xs font-semibold rounded-xl bg-red-500/15 hover:bg-red-500/25 text-red-400 border border-red-500/30 transition-all shadow-md"
            title="Leave Meeting Room"
          >
            <PhoneOff size={14} />
            <span>Leave</span>
          </button>
        </div>
      </div>

      {/* ── Main Meeting Body ── */}
      <div className="flex-1 min-h-0 flex flex-col relative overflow-hidden bg-[#0A0B0D]">
        {/* Permission / Connection Warning Bar */}
        {permissionError && (
          <div className="mx-6 mt-4 p-3.5 rounded-xl bg-red-500/10 border border-red-500/30 text-red-300 text-xs flex items-center justify-between shadow-lg">
            <div className="flex items-center gap-2.5">
              <AlertCircle size={16} className="text-red-400 shrink-0" />
              <span>{permissionError}</span>
            </div>
            <button
              onClick={() => initLocalAudio()}
              className="px-2.5 py-1 bg-red-500/20 hover:bg-red-500/30 text-white rounded-lg font-medium transition-colors text-[11px]"
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
      </div>
    </div>
  );
};

export default ProjectMeetingView;
