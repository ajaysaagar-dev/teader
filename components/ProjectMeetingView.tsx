'use client';

import React, { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import {
  Room,
  RoomEvent,
  Track,
  Participant,
  LocalParticipant,
  RemoteParticipant,
  LocalAudioTrack,
  ConnectionState,
  ConnectionQuality,
} from 'livekit-client';
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
  RefreshCw,
  Sparkles,
  Shield,
  Activity,
} from 'lucide-react';
import { toast } from 'sonner';

// ─── Interfaces ──────────────────────────────────────────────────────────────

export interface ParticipantInfo {
  identity: string;
  name: string;
  avatar?: string;
  role?: string;
  isAdmin?: boolean;
  isSpeaking: boolean;
  isMuted: boolean;
  isLocal: boolean;
  audioTrackSid?: string;
  connectionQuality: ConnectionQuality;
  joinedAt: number;
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

export const ProjectMeetingView: React.FC<ProjectMeetingViewProps> = ({
  projectId,
  projectName,
  currentUser,
  onLeaveMeeting,
}) => {
  // LiveKit Room instance reference
  const roomRef = useRef<Room | null>(null);

  // States
  const [connectionState, setConnectionState] = useState<ConnectionState>(
    ConnectionState.Connecting
  );
  const [participants, setParticipants] = useState<ParticipantInfo[]>([]);
  const [isMuted, setIsMuted] = useState(false);
  const [isDeafened, setIsDeafened] = useState(false);
  const [currentUserIsAdmin, setCurrentUserIsAdmin] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [autoplayBlocked, setAutoplayBlocked] = useState(false);

  // Noise Reduction State (LiveKit Krisp AI Filter, default: enabled)
  const [noiseReductionEnabled, setNoiseReductionEnabled] = useState(true);
  const krispProcessorRef = useRef<any>(null);

  // Voice Normalization State (Dynamic Range Compressor + Makeup Gain, default: enabled for all users)
  const [voiceNormalizationEnabled, setVoiceNormalizationEnabled] = useState(true);
  const voiceNormalizationRef = useRef(true);
  voiceNormalizationRef.current = voiceNormalizationEnabled;
  const normalizerNodesRef = useRef<
    Map<string, { compressor: DynamicsCompressorNode; makeupGain: GainNode }>
  >(new Map());

  // Meeting duration timer
  const [meetingDuration, setMeetingDuration] = useState(0);

  // Device settings
  const [audioInputDevices, setAudioInputDevices] = useState<MediaDeviceInfo[]>([]);
  const [audioOutputDevices, setAudioOutputDevices] = useState<MediaDeviceInfo[]>([]);
  const [selectedInputId, setSelectedInputId] = useState<string>('');
  const [selectedOutputId, setSelectedOutputId] = useState<string>('');
  const [showDeviceSettings, setShowDeviceSettings] = useState(false);

  // Refs for tracking audio elements & mute state
  const isDeafenedRef = useRef(isDeafened);
  isDeafenedRef.current = isDeafened;
  const selectedOutputIdRef = useRef(selectedOutputId);
  selectedOutputIdRef.current = selectedOutputId;
  const attachedAudioElementsRef = useRef<Map<string, HTMLAudioElement>>(new Map());

  // ── Meeting Duration Timer ──
  useEffect(() => {
    if (connectionState !== ConnectionState.Connected) return;
    const timer = setInterval(() => {
      setMeetingDuration((prev) => prev + 1);
    }, 1000);
    return () => clearInterval(timer);
  }, [connectionState]);

  const formattedTimer = useMemo(() => {
    const mins = Math.floor(meetingDuration / 60);
    const secs = meetingDuration % 60;
    const hrs = Math.floor(mins / 60);
    if (hrs > 0) {
      return `${String(hrs).padStart(2, '0')}:${String(mins % 60).padStart(2, '0')}:${String(secs).padStart(2, '0')}`;
    }
    return `${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}`;
  }, [meetingDuration]);

  // ── Unlock Autoplay Audio on User Interaction ──
  const unlockAudio = useCallback(() => {
    setAutoplayBlocked(false);
    attachedAudioElementsRef.current.forEach((audio) => {
      audio.play().catch(() => {});
    });
  }, []);

  useEffect(() => {
    const handleGesture = () => unlockAudio();
    window.addEventListener('click', handleGesture, { once: true });
    window.addEventListener('keydown', handleGesture, { once: true });
    return () => {
      window.removeEventListener('click', handleGesture);
      window.removeEventListener('keydown', handleGesture);
    };
  }, [unlockAudio]);

  // ── Refresh Audio Devices ──
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
    } catch (err) {
      console.warn('[refreshDevices]:', err);
    }
  }, [selectedInputId, selectedOutputId]);

  // ── Transform LiveKit Participant into ParticipantInfo ──
  const mapParticipant = useCallback((p: Participant): ParticipantInfo => {
    let avatar: string | undefined = undefined;
    let role: string | undefined = undefined;
    let isAdmin: boolean = false;

    if (p.metadata) {
      try {
        const meta = JSON.parse(p.metadata);
        avatar = meta.avatar;
        role = meta.role;
        isAdmin = Boolean(meta.isAdmin);
      } catch {}
    }

    const micPub = p.getTrackPublication(Track.Source.Microphone);
    const isLocal = p instanceof LocalParticipant;

    return {
      identity: p.identity,
      name: p.name || p.identity,
      avatar,
      role,
      isAdmin,
      isSpeaking: p.isSpeaking,
      isMuted: isLocal ? !(p as LocalParticipant).isMicrophoneEnabled : (micPub?.isMuted ?? true),
      isLocal,
      audioTrackSid: micPub?.trackSid,
      connectionQuality: p.connectionQuality,
      joinedAt: p.joinedAt ? p.joinedAt.getTime() : Date.now(),
    };
  }, []);

  // ── Re-sync participants list from LiveKit Room ──
  const syncParticipants = useCallback(() => {
    const room = roomRef.current;
    if (!room) return;

    const list: ParticipantInfo[] = [];

    // Local participant
    if (room.localParticipant) {
      list.push(mapParticipant(room.localParticipant));
    }

    // Remote participants
    room.remoteParticipants.forEach((p) => {
      list.push(mapParticipant(p));
    });

    setParticipants(list);
  }, [mapParticipant]);

  // ── LiveKit Noise Filter Application ──
  const applyNoiseFilter = useCallback(async (enabled: boolean) => {
    const room = roomRef.current;
    if (!room || !room.localParticipant) return;

    const micPub = room.localParticipant.getTrackPublication(Track.Source.Microphone);
    const localTrack = micPub?.track as LocalAudioTrack | undefined;
    if (!localTrack) return;

    try {
      if (enabled) {
        if (!krispProcessorRef.current) {
          const { isKrispNoiseFilterSupported, KrispNoiseFilter } = await import(
            '@livekit/krisp-noise-filter'
          );
          if (isKrispNoiseFilterSupported()) {
            const processor = KrispNoiseFilter();
            await localTrack.setProcessor(processor);
            krispProcessorRef.current = processor;
            await processor.setEnabled(true);
          } else {
            console.info('[LiveKit] Krisp not supported on this browser engine; native WebRTC noise cancellation active.');
          }
        } else {
          await krispProcessorRef.current.setEnabled(true);
        }
      } else {
        if (krispProcessorRef.current) {
          await krispProcessorRef.current.setEnabled(false);
        }
      }
    } catch (err) {
      console.warn('[LiveKit Noise Filter note]:', err);
    }
  }, []);

  // ── Toggle Noise Reduction Button Handler ──
  const handleToggleNoiseReduction = async () => {
    const next = !noiseReductionEnabled;
    setNoiseReductionEnabled(next);
    await applyNoiseFilter(next);
    toast.info(next ? 'LiveKit Noise Reduction enabled' : 'LiveKit Noise Reduction disabled');
  };

  // ── Voice Normalization Update Handler (Equalizes low and high volumes) ──
  const updateNormalizationState = useCallback((enabled: boolean) => {
    normalizerNodesRef.current.forEach(({ compressor, makeupGain }) => {
      try {
        const audioCtx = compressor.context;
        if (enabled) {
          // Boost quiet whispers & compress loud spikes down
          compressor.threshold.setValueAtTime(-24, audioCtx.currentTime);
          compressor.knee.setValueAtTime(30, audioCtx.currentTime);
          compressor.ratio.setValueAtTime(12, audioCtx.currentTime);
          compressor.attack.setValueAtTime(0.003, audioCtx.currentTime);
          compressor.release.setValueAtTime(0.25, audioCtx.currentTime);
          makeupGain.gain.setValueAtTime(isDeafenedRef.current ? 0 : 1.5, audioCtx.currentTime);
        } else {
          // Bypass compression
          compressor.ratio.setValueAtTime(1, audioCtx.currentTime);
          makeupGain.gain.setValueAtTime(isDeafenedRef.current ? 0 : 1.0, audioCtx.currentTime);
        }
      } catch (err) {
        console.warn('[updateNormalizationState error]:', err);
      }
    });
  }, []);

  const handleToggleVoiceNormalization = () => {
    const next = !voiceNormalizationEnabled;
    setVoiceNormalizationEnabled(next);
    voiceNormalizationRef.current = next;
    updateNormalizationState(next);
    toast.info(
      next
        ? 'Voice Normalization enabled (low & high volumes equalized)'
        : 'Voice Normalization disabled'
    );
  };

  // ── Connect to LiveKit Room ──
  const connectToVoiceRoom = useCallback(async () => {
    setErrorMessage(null);
    setConnectionState(ConnectionState.Connecting);

    try {
      // 1. Fetch short-lived token from Next.js server route
      const res = await fetch(`/api/livekit-token?projectId=${projectId}`);
      if (!res.ok) {
        const errorData = await res.json().catch(() => ({}));
        throw new Error(errorData.error || `Failed to authenticate with voice server (${res.status})`);
      }

      const { token, url, isAdmin } = await res.json();
      setCurrentUserIsAdmin(Boolean(isAdmin));

      if (!token || !url) {
        throw new Error('Invalid token response from voice server');
      }

      // 2. Disconnect existing room if any
      if (roomRef.current) {
        await roomRef.current.disconnect();
      }

      // 3. Initialize LiveKit Room instance with audio-only optimizations
      const room = new Room({
        adaptiveStream: true,
        dynacast: true,
        audioCaptureDefaults: {
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true, // Hardware/browser mic normalization enabled by default
          sampleRate: 48000,
        },
      });
      roomRef.current = room;

      // 4. Attach Event Listeners
      room
        .on(RoomEvent.ConnectionStateChanged, (state) => {
          setConnectionState(state);
          if (state === ConnectionState.Connected) {
            syncParticipants();
          }
        })
        .on(RoomEvent.Connected, () => {
          syncParticipants();
        })
        .on(RoomEvent.Reconnecting, () => {
          toast.info('Reconnecting to voice server…');
        })
        .on(RoomEvent.Reconnected, () => {
          toast.success('Reconnected to voice room');
          syncParticipants();
        })
        .on(RoomEvent.Disconnected, () => {
          syncParticipants();
        })
        .on(RoomEvent.ParticipantConnected, (participant) => {
          toast.info(`${participant.name || 'A user'} joined the call`);
          syncParticipants();
        })
        .on(RoomEvent.ParticipantDisconnected, (participant) => {
          toast.info(`${participant.name || 'A user'} left the call`);
          attachedAudioElementsRef.current.delete(participant.identity);
          normalizerNodesRef.current.delete(participant.identity);
          syncParticipants();
        })
        .on(RoomEvent.ActiveSpeakersChanged, () => {
          syncParticipants();
        })
        .on(RoomEvent.TrackMuted, () => {
          syncParticipants();
        })
        .on(RoomEvent.TrackUnmuted, () => {
          syncParticipants();
        })
        .on(RoomEvent.ConnectionQualityChanged, () => {
          syncParticipants();
        })
        .on(RoomEvent.DataReceived, async (payload: Uint8Array, participant?: RemoteParticipant) => {
          try {
            const decoded = new TextDecoder().decode(payload);
            const msg = JSON.parse(decoded);
            if (msg.type === 'ADMIN_MUTE' && msg.targetIdentity === room.localParticipant.identity) {
              const shouldMute = Boolean(msg.muted);
              await room.localParticipant.setMicrophoneEnabled(!shouldMute);
              setIsMuted(shouldMute);
              if (shouldMute) {
                toast.warning('Your microphone was muted by a project admin');
              } else {
                toast.success('Your microphone was unmuted by a project admin');
              }
              syncParticipants();
            }
          } catch (e) {
            console.warn('[LiveKit DataReceived error]:', e);
          }
        })
        .on(RoomEvent.TrackSubscribed, (track, publication, participant) => {
          if (track.kind === Track.Kind.Audio) {
            const audioEl = track.attach();
            audioEl.id = `lk_audio_${participant.identity}`;
            audioEl.muted = isDeafenedRef.current;
            (audioEl as any).playsInline = true;

            // Route to selected speaker device if supported
            if (selectedOutputIdRef.current && typeof (audioEl as any).setSinkId === 'function') {
              (audioEl as any).setSinkId(selectedOutputIdRef.current).catch(() => {});
            }

            attachedAudioElementsRef.current.set(participant.identity, audioEl);
            document.body.appendChild(audioEl);

            // Voice Normalization Web Audio Node Setup (Dynamic Range Compressor + Boost)
            try {
              const AudioContextClass = window.AudioContext || (window as any).webkitAudioContext;
              if (AudioContextClass) {
                const audioCtx = new AudioContextClass();
                const source = audioCtx.createMediaElementSource(audioEl);
                const compressor = audioCtx.createDynamicsCompressor();
                const makeupGain = audioCtx.createGain();

                const isNorm = voiceNormalizationRef.current;
                compressor.threshold.setValueAtTime(isNorm ? -24 : 0, audioCtx.currentTime);
                compressor.knee.setValueAtTime(30, audioCtx.currentTime);
                compressor.ratio.setValueAtTime(isNorm ? 12 : 1, audioCtx.currentTime);
                compressor.attack.setValueAtTime(0.003, audioCtx.currentTime);
                compressor.release.setValueAtTime(0.25, audioCtx.currentTime);
                makeupGain.gain.setValueAtTime(
                  isDeafenedRef.current ? 0 : (isNorm ? 1.5 : 1.0),
                  audioCtx.currentTime
                );

                source.connect(compressor);
                compressor.connect(makeupGain);
                makeupGain.connect(audioCtx.destination);

                normalizerNodesRef.current.set(participant.identity, { compressor, makeupGain });
              }
            } catch (err) {
              console.warn('[Voice Normalizer initialization note]:', err);
            }

            audioEl.play().catch(() => {
              setAutoplayBlocked(true);
            });
          }
          syncParticipants();
        })
        .on(RoomEvent.TrackUnsubscribed, (track, publication, participant) => {
          if (track.kind === Track.Kind.Audio) {
            track.detach();
            const el = attachedAudioElementsRef.current.get(participant.identity);
            if (el) {
              el.remove();
              attachedAudioElementsRef.current.delete(participant.identity);
            }
            normalizerNodesRef.current.delete(participant.identity);
          }
          syncParticipants();
        });

      // 5. Connect to LiveKit server
      await room.connect(url, token, { autoSubscribe: true });

      // 6. Enable microphone (audio only - no camera published)
      await room.localParticipant.setMicrophoneEnabled(true);
      setIsMuted(false);

      // 7. Apply LiveKit Noise Reduction if enabled by default
      if (noiseReductionEnabled) {
        const micPub = room.localParticipant.getTrackPublication(Track.Source.Microphone);
        const localTrack = micPub?.track as LocalAudioTrack | undefined;
        if (localTrack) {
          try {
            const { isKrispNoiseFilterSupported, KrispNoiseFilter } = await import(
              '@livekit/krisp-noise-filter'
            );
            if (isKrispNoiseFilterSupported()) {
              const processor = KrispNoiseFilter();
              await localTrack.setProcessor(processor);
              krispProcessorRef.current = processor;
            }
          } catch {}
        }
      }

      await refreshDevices();
      syncParticipants();
    } catch (err: any) {
      console.error('[LiveKit Connect Error]:', err);
      const msg = err.message || 'Could not connect to voice room';
      setErrorMessage(msg);
      setConnectionState(ConnectionState.Disconnected);
      toast.error('Voice connection failed');
    }
  }, [projectId, noiseReductionEnabled, refreshDevices, syncParticipants]);

  // Connect on mount
  useEffect(() => {
    connectToVoiceRoom();

    return () => {
      if (roomRef.current) {
        roomRef.current.disconnect();
        roomRef.current = null;
      }
      attachedAudioElementsRef.current.forEach((el) => el.remove());
      attachedAudioElementsRef.current.clear();
      normalizerNodesRef.current.clear();
      if (krispProcessorRef.current) {
        try {
          krispProcessorRef.current.destroy?.();
        } catch {}
        krispProcessorRef.current = null;
      }
    };
  }, [connectToVoiceRoom]);

  // ── Toggle Local Microphone Mute ──
  const handleToggleMute = async () => {
    const room = roomRef.current;
    if (!room || !room.localParticipant) return;

    try {
      const nextMuted = !isMuted;
      await room.localParticipant.setMicrophoneEnabled(!nextMuted);
      setIsMuted(nextMuted);
      syncParticipants();
      toast.info(nextMuted ? 'Microphone muted' : 'Microphone unmuted');
    } catch (err: any) {
      console.warn('[Toggle Mute Error]:', err);
    }
  };

  // ── Admin Mute / Unmute Remote Participant ──
  const handleAdminToggleMute = async (
    targetIdentity: string,
    trackSid: string | undefined,
    shouldMute: boolean,
    participantName: string
  ) => {
    if (!currentUserIsAdmin) {
      toast.error('Only project admins can mute or unmute participants');
      return;
    }

    const room = roomRef.current;
    if (!room) return;

    try {
      // 1. Send instantaneous real-time signal via LiveKit data channel
      const payload = new TextEncoder().encode(
        JSON.stringify({
          type: 'ADMIN_MUTE',
          targetIdentity,
          muted: shouldMute,
        })
      );
      await room.localParticipant.publishData(payload, { reliable: true });

      // 2. Call server-side API to enforce mute state via LiveKit RoomServiceClient
      const res = await fetch('/api/livekit-token', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          projectId,
          targetIdentity,
          trackSid,
          muted: shouldMute,
        }),
      });

      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error || 'Server mute enforcement failed');
      }

      toast.success(
        shouldMute
          ? `Muted ${participantName}`
          : `Unmuted ${participantName}`
      );
      syncParticipants();
    } catch (err: any) {
      console.warn('[Admin Mute Error]:', err);
      toast.error(err.message || 'Failed to update participant mute state');
    }
  };

  // ── Toggle Deafen (Mute Incoming Remote Audio) ──
  const handleToggleDeafen = () => {
    const nextDeafened = !isDeafened;
    setIsDeafened(nextDeafened);
    isDeafenedRef.current = nextDeafened;

    attachedAudioElementsRef.current.forEach((audioEl) => {
      audioEl.muted = nextDeafened;
    });

    normalizerNodesRef.current.forEach(({ makeupGain }) => {
      try {
        makeupGain.gain.setValueAtTime(
          nextDeafened ? 0 : (voiceNormalizationRef.current ? 1.5 : 1.0),
          makeupGain.context.currentTime
        );
      } catch {}
    });

    toast.info(nextDeafened ? 'Sound deafened' : 'Sound undeafened');
  };

  // ── Switch Microphone Device ──
  const handleSwitchMic = async (deviceId: string) => {
    setSelectedInputId(deviceId);
    const room = roomRef.current;
    if (room && typeof room.switchActiveDevice === 'function') {
      try {
        await room.switchActiveDevice('audioinput', deviceId);
        toast.success('Microphone switched');

        // Re-apply noise reduction to the newly switched track if enabled
        if (noiseReductionEnabled) {
          const micPub = room.localParticipant.getTrackPublication(Track.Source.Microphone);
          const localTrack = micPub?.track as LocalAudioTrack | undefined;
          if (localTrack && krispProcessorRef.current) {
            await localTrack.setProcessor(krispProcessorRef.current);
          }
        }
      } catch (err) {
        console.warn('[switchActiveDevice mic]:', err);
      }
    }
  };

  // ── Switch Speaker Output Device ──
  const handleSwitchSpeaker = async (deviceId: string) => {
    setSelectedOutputId(deviceId);
    selectedOutputIdRef.current = deviceId;
    const room = roomRef.current;

    if (room && typeof room.switchActiveDevice === 'function') {
      try {
        await room.switchActiveDevice('audiooutput', deviceId);
      } catch {}
    }

    attachedAudioElementsRef.current.forEach((audioEl) => {
      if (typeof (audioEl as any).setSinkId === 'function') {
        (audioEl as any).setSinkId(deviceId).catch(() => {});
      }
    });

    toast.success('Speaker output switched');
  };

  // ── Leave Call ──
  const handleLeaveCall = async () => {
    if (roomRef.current) {
      await roomRef.current.disconnect();
      roomRef.current = null;
    }
    if (onLeaveMeeting) {
      onLeaveMeeting();
    } else {
      window.history.back();
    }
  };

  const isConnected = connectionState === ConnectionState.Connected;
  const isConnecting =
    connectionState === ConnectionState.Connecting ||
    connectionState === ConnectionState.Reconnecting;

  return (
    <div
      onClick={unlockAudio}
      className="flex-1 w-full h-full flex flex-col bg-[#0A0B0D] text-[#CFD4DD] overflow-hidden select-none font-sans"
    >
      {/* ── Top Meeting Header ── */}
      <div className="h-14 px-6 border-b border-[#1E2024] bg-[#111215]/95 flex items-center justify-between shrink-0 z-20 backdrop-blur-md">
        <div className="flex items-center gap-3">
          <div className="relative flex items-center justify-center w-8 h-8 rounded-lg bg-[#DCB001]/10 text-[#DCB001] border border-[#DCB001]/25">
            <Radio
              size={16}
              className={
                isConnected
                  ? 'text-[#22C55E] animate-pulse'
                  : 'text-[#DCB001]'
              }
            />
            {isConnected && (
              <span className="absolute -top-1 -right-1 w-2.5 h-2.5 rounded-full bg-[#22C55E] ring-2 ring-[#111215]" />
            )}
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h2 className="text-sm font-bold text-white tracking-tight">
                {projectName} Voice Room
              </h2>
              {isConnected && (
                <span className="px-2 py-0.5 rounded-full bg-[#22C55E]/15 text-[#22C55E] text-[10px] font-mono font-semibold border border-[#22C55E]/30 flex items-center gap-1">
                  <span className="w-1.5 h-1.5 rounded-full bg-[#22C55E] animate-ping" />
                  LIVE
                </span>
              )}
              {currentUserIsAdmin && (
                <span className="px-2 py-0.5 rounded-full bg-[#DCB001]/15 text-[#DCB001] text-[10px] font-mono font-bold border border-[#DCB001]/30 flex items-center gap-1">
                  <Shield size={10} />
                  ADMIN
                </span>
              )}
            </div>
            <p className="text-[11px] text-[#787C83] flex items-center gap-2">
              <span>{participants.length} in call</span>
              {isConnected && (
                <>
                  <span>•</span>
                  <span className="font-mono text-[#A0A5B0]">{formattedTimer}</span>
                </>
              )}
              {isConnecting && (
                <>
                  <span>•</span>
                  <span className="text-[#DCB001] flex items-center gap-1 animate-pulse">
                    <RefreshCw size={10} className="animate-spin" />
                    Connecting to voice server…
                  </span>
                </>
              )}
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
            title="Configure Audio Devices"
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
        {/* Autoplay Blocked Banner */}
        {autoplayBlocked && (
          <div
            onClick={unlockAudio}
            className="mx-6 mt-4 p-3.5 rounded-xl bg-amber-500/15 border border-amber-500/35 text-amber-300 text-xs flex items-center justify-between shadow-lg cursor-pointer animate-pulse"
          >
            <div className="flex items-center gap-2.5">
              <Volume2 size={16} className="text-amber-400 shrink-0" />
              <span>Browser blocked audio playback. Click anywhere to listen to the call.</span>
            </div>
            <button className="px-3 py-1 bg-amber-500 text-black rounded-lg font-bold text-[11px] shrink-0 cursor-pointer">
              Enable Audio
            </button>
          </div>
        )}

        {/* Error Notification */}
        {errorMessage && (
          <div className="mx-6 mt-4 p-3.5 rounded-xl bg-red-500/10 border border-red-500/30 text-red-300 text-xs flex items-center justify-between shadow-lg">
            <div className="flex items-center gap-2.5">
              <AlertCircle size={16} className="text-red-400 shrink-0" />
              <span>{errorMessage}</span>
            </div>
            <button
              onClick={(e) => {
                e.stopPropagation();
                connectToVoiceRoom();
              }}
              className="px-2.5 py-1 bg-red-500/20 hover:bg-red-500/30 text-white rounded-lg font-medium transition-colors text-[11px] cursor-pointer flex items-center gap-1"
            >
              <RefreshCw size={12} />
              Retry
            </button>
          </div>
        )}

        {/* Device Settings Drawer */}
        {showDeviceSettings && (
          <div className="mx-6 mt-4 p-4 rounded-2xl bg-[#141519] border border-[#2B2D33] shadow-2xl flex flex-col md:flex-row items-center justify-between gap-4 z-30 animate-in fade-in slide-in-from-top-2 duration-200">
            {/* Input Selection */}
            <div className="flex-1 w-full">
              <label className="text-[11px] font-semibold text-[#8E939D] uppercase tracking-wider flex items-center gap-1.5 mb-1.5">
                <Mic size={12} className="text-[#DCB001]" /> Microphone (Input)
              </label>
              <select
                value={selectedInputId}
                onChange={(e) => handleSwitchMic(e.target.value)}
                className="w-full bg-[#1A1C22] border border-[#33363F] text-white text-xs rounded-xl px-3 py-2 outline-none focus:border-[#DCB001] transition-colors cursor-pointer"
              >
                {audioInputDevices.length === 0 && <option value="">Default Microphone</option>}
                {audioInputDevices.map((d, i) => (
                  <option key={d.deviceId || i} value={d.deviceId}>
                    {d.label || `Microphone ${i + 1}`}
                  </option>
                ))}
              </select>
            </div>

            {/* Output Selection */}
            <div className="flex-1 w-full">
              <label className="text-[11px] font-semibold text-[#8E939D] uppercase tracking-wider flex items-center gap-1.5 mb-1.5">
                <Headphones size={12} className="text-[#DCB001]" /> Speaker (Output)
              </label>
              <select
                value={selectedOutputId}
                onChange={(e) => handleSwitchSpeaker(e.target.value)}
                className="w-full bg-[#1A1C22] border border-[#33363F] text-white text-xs rounded-xl px-3 py-2 outline-none focus:border-[#DCB001] transition-colors cursor-pointer"
              >
                {audioOutputDevices.length === 0 && <option value="">Default Speaker</option>}
                {audioOutputDevices.map((d, i) => (
                  <option key={d.deviceId || i} value={d.deviceId}>
                    {d.label || `Speaker ${i + 1}`}
                  </option>
                ))}
              </select>
              <p className="mt-1 text-[10px] text-[#787C83]">Output switching works in Chrome, Edge, and modern browsers.</p>
            </div>
          </div>
        )}

        {/* ── Participant Grid ── */}
        <div className="flex-1 min-h-0 p-6 overflow-y-auto">
          {isConnecting && participants.length === 0 && (
            <div className="h-full flex flex-col items-center justify-center gap-4 text-[#6B707B]">
              <Radio size={48} className="text-[#DCB001] animate-pulse" />
              <div className="text-center">
                <p className="text-sm font-medium text-white">Connecting to Voice Room…</p>
                <p className="text-xs text-[#787C83] mt-1">Establishing high-fidelity audio stream with LiveKit</p>
              </div>
            </div>
          )}

          <div
            className={`grid gap-4 w-full h-full auto-rows-fr ${
              participants.length === 1
                ? 'grid-cols-1 max-w-lg mx-auto'
                : participants.length === 2
                ? 'grid-cols-1 sm:grid-cols-2 max-w-3xl mx-auto'
                : participants.length <= 4
                ? 'grid-cols-2 max-w-4xl mx-auto'
                : 'grid-cols-2 md:grid-cols-3 max-w-6xl mx-auto'
            }`}
          >
            {participants.map((p) => {
              const speaking = p.isSpeaking;

              return (
                <div
                  key={p.identity}
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
                      } ${
                        p.avatar
                          ? 'bg-[#1E2026]'
                          : 'bg-gradient-to-br from-[#2B2E38] to-[#17181F] text-white'
                      }`}
                    >
                      {p.avatar ? (
                        <img
                          src={p.avatar}
                          alt={p.name}
                          className="w-full h-full object-cover"
                        />
                      ) : (
                        <span>{p.name.slice(0, 2)}</span>
                      )}
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

                  {/* Name & Role Badges */}
                  <div className="flex items-center gap-1.5 mb-1 z-10">
                    <span className="font-semibold text-sm text-white tracking-tight">
                      {p.name}
                    </span>
                    {p.isLocal && (
                      <span className="px-1.5 rounded bg-[#DCB001]/15 text-[#DCB001] font-mono text-[9px] font-bold border border-[#DCB001]/30">
                        YOU
                      </span>
                    )}
                    {p.isAdmin && (
                      <span
                        className="px-1.5 rounded bg-blue-500/15 text-blue-400 font-mono text-[9px] font-bold border border-blue-500/30 flex items-center gap-0.5"
                        title="Project Admin"
                      >
                        <Shield size={9} />
                        ADMIN
                      </span>
                    )}
                  </div>

                  {/* Speaking Waveform / Status */}
                  <div className="h-4 flex items-center gap-1 mt-1 z-10">
                    {speaking ? (
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

                  {/* ── Admin Remote Mute / Unmute Action ── */}
                  {currentUserIsAdmin && !p.isLocal && (
                    <div className="mt-3 z-10 flex items-center gap-2">
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          handleAdminToggleMute(
                            p.identity,
                            p.audioTrackSid,
                            !p.isMuted,
                            p.name
                          );
                        }}
                        className={`flex items-center gap-1.5 px-3 py-1 rounded-xl text-[11px] font-semibold border transition-all cursor-pointer shadow-sm ${
                          p.isMuted
                            ? 'bg-[#22C55E]/15 hover:bg-[#22C55E]/25 text-[#22C55E] border-[#22C55E]/30'
                            : 'bg-red-500/15 hover:bg-red-500/25 text-red-400 border-red-500/30'
                        }`}
                        title={p.isMuted ? 'Admin: Unmute this participant' : 'Admin: Mute this participant'}
                      >
                        {p.isMuted ? (
                          <>
                            <Mic size={12} />
                            <span>Unmute</span>
                          </>
                        ) : (
                          <>
                            <MicOff size={12} />
                            <span>Mute</span>
                          </>
                        )}
                      </button>
                    </div>
                  )}

                  {/* Connection Quality Indicator */}
                  <div className="absolute top-3 right-3 flex items-center gap-1 text-[10px] font-mono">
                    {p.connectionQuality === ConnectionQuality.Excellent ||
                    p.connectionQuality === ConnectionQuality.Good ? (
                      <span title="Excellent Connection"><Signal size={12} className="text-[#22C55E]" /></span>
                    ) : p.connectionQuality === ConnectionQuality.Poor ? (
                      <span title="Poor Connection"><Wifi size={12} className="text-[#DCB001]" /></span>
                    ) : p.connectionQuality === ConnectionQuality.Lost ? (
                      <span title="Lost Connection"><WifiOff size={12} className="text-red-400" /></span>
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
        <div className="h-20 border-t border-[#1C1E23] bg-[#0E0F12]/95 backdrop-blur-xl flex items-center justify-center gap-3 px-6 z-30 shadow-2xl flex-wrap">
          {/* Mute Button */}
          <button
            onClick={handleToggleMute}
            className={`flex items-center gap-2 px-4 py-2.5 rounded-2xl font-semibold text-xs transition-all shadow-xl cursor-pointer ${
              isMuted
                ? 'bg-red-500/20 text-red-400 border border-red-500/40 hover:bg-red-500/30'
                : 'bg-[#1E2027] hover:bg-[#282B34] text-white border border-[#343742]'
            }`}
            title={isMuted ? 'Unmute Microphone' : 'Mute Microphone'}
          >
            {isMuted ? (
              <MicOff size={16} className="text-red-400" />
            ) : (
              <Mic size={16} className="text-[#22C55E]" />
            )}
            <span>{isMuted ? 'Unmute Mic' : 'Mute Mic'}</span>
          </button>

          {/* Deafen Button */}
          <button
            onClick={handleToggleDeafen}
            className={`flex items-center gap-2 px-4 py-2.5 rounded-2xl font-semibold text-xs transition-all shadow-xl cursor-pointer ${
              isDeafened
                ? 'bg-red-500/20 text-red-400 border border-red-500/40 hover:bg-red-500/30'
                : 'bg-[#1E2027] hover:bg-[#282B34] text-white border border-[#343742]'
            }`}
            title={isDeafened ? 'Undeafen Speaker' : 'Deafen Sound'}
          >
            {isDeafened ? (
              <VolumeX size={16} className="text-red-400" />
            ) : (
              <Volume2 size={16} className="text-[#DCB001]" />
            )}
            <span>{isDeafened ? 'Undeafen' : 'Deafen'}</span>
          </button>

          {/* LiveKit Noise Reduction Button (Default: Enabled) */}
          <button
            onClick={handleToggleNoiseReduction}
            className={`flex items-center gap-2 px-4 py-2.5 rounded-2xl font-semibold text-xs transition-all border cursor-pointer ${
              noiseReductionEnabled
                ? 'bg-[#22C55E]/15 text-[#22C55E] border-[#22C55E]/40 hover:bg-[#22C55E]/25 shadow-sm'
                : 'bg-[#16171C] hover:bg-[#22242B] text-[#9BA1A6] border-[#292B33]'
            }`}
            title={
              noiseReductionEnabled
                ? 'LiveKit AI Noise Reduction: Enabled (Click to disable)'
                : 'LiveKit AI Noise Reduction: Disabled (Click to enable)'
            }
          >
            <Sparkles
              size={15}
              className={noiseReductionEnabled ? 'text-[#22C55E]' : 'text-[#787C83]'}
            />
            <span>Noise Reduction {noiseReductionEnabled ? 'ON' : 'OFF'}</span>
          </button>

          {/* Voice Normalization Button (Default: Enabled) */}
          <button
            onClick={handleToggleVoiceNormalization}
            className={`flex items-center gap-2 px-4 py-2.5 rounded-2xl font-semibold text-xs transition-all border cursor-pointer ${
              voiceNormalizationEnabled
                ? 'bg-[#DCB001]/15 text-[#DCB001] border-[#DCB001]/40 hover:bg-[#DCB001]/25 shadow-sm'
                : 'bg-[#16171C] hover:bg-[#22242B] text-[#9BA1A6] border-[#292B33]'
            }`}
            title={
              voiceNormalizationEnabled
                ? 'Voice Normalization: Enabled (Low & high sounds dynamically equalized - Click to disable)'
                : 'Voice Normalization: Disabled (Click to enable)'
            }
          >
            <Activity
              size={15}
              className={voiceNormalizationEnabled ? 'text-[#DCB001]' : 'text-[#787C83]'}
            />
            <span>Normalizer {voiceNormalizationEnabled ? 'ON' : 'OFF'}</span>
          </button>

          {/* Devices Button */}
          <button
            onClick={() => setShowDeviceSettings((prev) => !prev)}
            className={`flex items-center gap-2 px-3.5 py-2.5 rounded-2xl font-semibold text-xs transition-all border cursor-pointer ${
              showDeviceSettings
                ? 'bg-[#DCB001]/15 text-[#DCB001] border-[#DCB001]/40'
                : 'bg-[#16171C] hover:bg-[#22242B] text-[#9BA1A6] border-[#292B33]'
            }`}
            title="Audio Input / Output Device Preferences"
          >
            <Sliders size={15} />
            <span>Devices</span>
          </button>

          {/* Leave Button */}
          <button
            onClick={handleLeaveCall}
            className="flex items-center gap-2 px-4 py-2.5 rounded-2xl font-semibold text-xs bg-red-600 hover:bg-red-700 text-white transition-all shadow-lg hover:shadow-red-600/30 cursor-pointer"
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
