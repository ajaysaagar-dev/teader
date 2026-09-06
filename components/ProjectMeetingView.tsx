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
  LocalVideoTrack,
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
  PowerOff,
  ScreenShare,
  ScreenShareOff,
  Maximize2,
  Minimize2,
  Monitor,
  Check,
  CheckCircle2,
  X,
  GripHorizontal,
  Users,
} from 'lucide-react';
import { toast } from 'sonner';
import { CustomDropdown } from '@/components/ui/CustomDropdown';
import { Avatar } from '@/components/ui/Avatar';

// ─── Interfaces & Quality Types ──────────────────────────────────────────────

export type ScreenResolution = '720' | '1080' | '1440';
export type ScreenFps = 24 | 30 | 48 | 60;

export const RESOLUTION_CONFIG: Record<
  ScreenResolution,
  { width: number; height: number; bitrates: Record<ScreenFps, number> }
> = {
  '720': {
    width: 1280,
    height: 720,
    bitrates: { 24: 1_800_000, 30: 2_200_000, 48: 2_600_000, 60: 2_800_000 },
  },
  '1080': {
    width: 1920,
    height: 1080,
    bitrates: { 24: 3_500_000, 30: 4_000_000, 48: 4_800_000, 60: 5_000_000 },
  },
  '1440': {
    width: 2560,
    height: 1440,
    bitrates: { 24: 6_000_000, 30: 7_000_000, 48: 8_500_000, 60: 9_000_000 },
  },
};

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
  isScreenSharing?: boolean;
  screenShareTrack?: Track;
  screenShareResolution?: string;
  screenShareFps?: number;
}

// ─── Screen Share Video Player Component ─────────────────────────────────────
const ScreenShareVideo: React.FC<{
  track: Track;
  isLocal?: boolean;
  className?: string;
  onClick?: () => void;
}> = ({ track, isLocal, className, onClick }) => {
  const videoRef = useRef<HTMLVideoElement | null>(null);

  useEffect(() => {
    const el = videoRef.current;
    if (!el || !track) return;
    track.attach(el);
    return () => {
      track.detach(el);
    };
  }, [track]);

  return (
    <video
      ref={videoRef}
      autoPlay
      playsInline
      muted={isLocal}
      onClick={onClick}
      className={className || 'w-full h-full object-contain bg-black'}
    />
  );
};

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

// ─── Universal Desktop & Mobile Screen Capture Polyfill ───────────────────────
async function captureDesktopMediaStream(config?: {
  width?: number;
  height?: number;
  fps?: number;
  includeAudio?: boolean;
}): Promise<MediaStream> {
  const isMobile =
    typeof navigator !== 'undefined' &&
    (/android|iphone|ipad|ipod|mobile/i.test(navigator.userAgent) ||
      (typeof window !== 'undefined' &&
        window.matchMedia &&
        window.matchMedia('(max-width: 768px)').matches));

  const isElectron =
    typeof window !== 'undefined' &&
    (Boolean((window as any).teaderDesktop?.isDesktop) ||
      /electron/i.test(navigator.userAgent) ||
      /teaderdesktop/i.test(navigator.userAgent));

  const targetWidth = config?.width || 1920;
  const targetHeight = config?.height || 1080;
  const targetFps = config?.fps || 60;
  // Mobile browsers (Chrome Android, iOS) do NOT support capturing system audio in getDisplayMedia
  const targetAudio = isMobile ? false : (config?.includeAudio ?? true);

  if (typeof navigator === 'undefined' || !navigator.mediaDevices) {
    throw new Error('Media devices are not available in this environment');
  }

  // 1. Standard / Mobile Browser: getDisplayMedia
  if (!isElectron && navigator.mediaDevices.getDisplayMedia) {
    // 1a. Try with requested constraints (framerate-only on mobile, dimensions on desktop)
    try {
      const videoConstraints: MediaTrackConstraints = isMobile
        ? { frameRate: { ideal: targetFps, max: targetFps } }
        : {
            width: { ideal: targetWidth, max: targetWidth },
            height: { ideal: targetHeight, max: targetHeight },
            frameRate: { ideal: targetFps, max: targetFps },
          };

      return await navigator.mediaDevices.getDisplayMedia({
        video: videoConstraints,
        audio: targetAudio,
      });
    } catch (err1: any) {
      if (err1?.name === 'NotAllowedError' || err1?.message?.includes('Permission denied')) {
        throw err1;
      }
      console.warn('[getDisplayMedia primary attempt note]:', err1);
    }

    // 1b. Universal clean fallback: { video: true, audio: false }
    // This is the most compatible WebRTC capture specification (works reliably on Chrome Android 107+)
    try {
      return await navigator.mediaDevices.getDisplayMedia({
        video: true,
        audio: false,
      });
    } catch (err1b: any) {
      if (err1b?.name === 'NotAllowedError' || err1b?.message?.includes('Permission denied')) {
        throw err1b;
      }
      console.warn('[getDisplayMedia clean fallback note]:', err1b);
    }
  }

  // 2. Electron-only Desktop fallbacks (chromeMediaSource)
  if (isElectron && navigator.mediaDevices.getUserMedia) {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: targetAudio
          ? ({ mandatory: { chromeMediaSource: 'desktop' } } as any)
          : false,
        video: {
          mandatory: {
            chromeMediaSource: 'screen',
            maxWidth: targetWidth,
            maxHeight: targetHeight,
            maxFrameRate: targetFps,
          },
        } as any,
      });
      return stream;
    } catch (err2: any) {
      console.warn('[Capture fallback 1 (screen) note]:', err2);
    }

    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: targetAudio
          ? ({ mandatory: { chromeMediaSource: 'desktop' } } as any)
          : false,
        video: {
          mandatory: {
            chromeMediaSource: 'desktop',
            maxWidth: targetWidth,
            maxHeight: targetHeight,
            maxFrameRate: targetFps,
          },
        } as any,
      });
      return stream;
    } catch (err3: any) {
      console.warn('[Capture fallback 2 (desktop) note]:', err3);
    }
  }

  // 3. Last-ditch generic getDisplayMedia attempt
  if (navigator.mediaDevices.getDisplayMedia) {
    try {
      return await navigator.mediaDevices.getDisplayMedia({
        video: true,
        audio: false,
      });
    } catch (errFinal: any) {
      if (errFinal?.name === 'NotAllowedError' || errFinal?.message?.includes('Permission denied')) {
        throw errFinal;
      }
    }
  }

  if (isMobile) {
    throw new Error(
      'Screen sharing is not supported by your mobile browser. Please use Chrome on Android and ensure you are using HTTPS.'
    );
  }

  throw new Error('Screen capture is not supported in this browser environment');
}

// Install getDisplayMedia polyfill once for Electron environments & mobile clean fallback
if (typeof window !== 'undefined' && typeof navigator !== 'undefined' && navigator.mediaDevices) {
  const originalGetDisplayMedia = navigator.mediaDevices.getDisplayMedia?.bind(navigator.mediaDevices);

  (navigator.mediaDevices as any).getDisplayMedia = async function (constraints?: any) {
    const isMobile =
      /android|iphone|ipad|ipod|mobile/i.test(navigator.userAgent) ||
      (window.matchMedia && window.matchMedia('(max-width: 768px)').matches);

    const isElectron =
      Boolean((window as any).teaderDesktop?.isDesktop) ||
      /electron/i.test(navigator.userAgent) ||
      /teaderdesktop/i.test(navigator.userAgent);

    if (originalGetDisplayMedia && !isElectron) {
      // If mobile, ensure audio is not passed to native getDisplayMedia
      const mobileSafeConstraints = isMobile
        ? {
            video:
              typeof constraints?.video === 'object'
                ? { frameRate: constraints.video.frameRate }
                : true,
            audio: false,
          }
        : constraints;

      try {
        return await originalGetDisplayMedia(mobileSafeConstraints);
      } catch (err: any) {
        if (err?.name === 'NotAllowedError' || err?.message?.includes('Permission denied')) {
          throw err;
        }
        // If failed due to audio or constraints, try basic { video: true, audio: false }
        try {
          return await originalGetDisplayMedia({ video: true, audio: false });
        } catch (retryErr: any) {
          if (retryErr?.name === 'NotAllowedError' || retryErr?.message?.includes('Permission denied')) {
            throw retryErr;
          }
        }
      }
    }

    const width = constraints?.video?.width?.ideal || constraints?.video?.width?.max || 1920;
    const height = constraints?.video?.height?.ideal || constraints?.video?.height?.max || 1080;
    const fps = constraints?.video?.frameRate?.ideal || constraints?.video?.frameRate?.max || 60;
    const includeAudio = isMobile ? false : Boolean(constraints?.audio);

    return await captureDesktopMediaStream({ width, height, fps, includeAudio });
  };
}

export interface ProjectMeetingViewProps {
  projectId: string | number;
  projectName: string;
  currentUser: {
    id: number | string;
    name?: string;
    username?: string;
    avatar?: string;
    email?: string;
  } | null;
  isMini?: boolean;
  onMinimizeMeeting?: () => void;
  onExpandMeeting?: () => void;
  onLeaveMeeting?: () => void;
}

export const ProjectMeetingView: React.FC<ProjectMeetingViewProps> = ({
  projectId,
  projectName,
  currentUser,
  isMini = false,
  onMinimizeMeeting,
  onExpandMeeting,
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

  // Screen Share State & Quality Settings
  const [isSharingScreen, setIsSharingScreen] = useState(false);
  const [fullscreenParticipant, setFullscreenParticipant] = useState<ParticipantInfo | null>(null);
  const [showScreenShareModal, setShowScreenShareModal] = useState(false);
  const [selectedResolution, setSelectedResolution] = useState<ScreenResolution>('1080');
  const [selectedFps, setSelectedFps] = useState<ScreenFps>(60);
  const [includeScreenAudio, setIncludeScreenAudio] = useState(true);
  const [activeStreamQuality, setActiveStreamQuality] = useState<{ res: string; fps: number } | null>(null);
  const activeStreamQualityRef = useRef<{ res: string; fps: number } | null>(null);
  activeStreamQualityRef.current = activeStreamQuality;
  const [participantQualities, setParticipantQualities] = useState<Map<string, { res: string; fps: number }>>(new Map());
  const participantQualitiesRef = useRef<Map<string, { res: string; fps: number }>>(new Map());
  participantQualitiesRef.current = participantQualities;
  const customScreenTrackRef = useRef<LocalVideoTrack | null>(null);
  const customScreenAudioTrackRef = useRef<LocalAudioTrack | null>(null);

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

  // Miniscreen Drag Position & State
  const [miniPosition, setMiniPosition] = useState<{ x: number; y: number } | null>(null);
  const isDraggingRef = useRef(false);
  const dragStartRef = useRef<{ mouseX: number; mouseY: number; elemX: number; elemY: number }>({
    mouseX: 0,
    mouseY: 0,
    elemX: 0,
    elemY: 0,
  });
  const miniScreenRef = useRef<HTMLDivElement | null>(null);

  // Initialize Miniscreen to bottom-right corner when in mini mode
  useEffect(() => {
    if (typeof window !== 'undefined' && miniPosition === null) {
      const defaultWidth = 360;
      const defaultHeight = 230;
      setMiniPosition({
        x: Math.max(16, window.innerWidth - defaultWidth - 24),
        y: Math.max(16, window.innerHeight - defaultHeight - 24),
      });
    }
  }, [miniPosition, isMini]);

  // Pointer drag event handlers with bounds clamping
  const handleDragPointerDown = (e: React.PointerEvent) => {
    if (e.button !== 0) return;
    isDraggingRef.current = true;
    const currentX = miniPosition?.x ?? Math.max(16, window.innerWidth - 360 - 24);
    const currentY = miniPosition?.y ?? Math.max(16, window.innerHeight - 230 - 24);
    dragStartRef.current = {
      mouseX: e.clientX,
      mouseY: e.clientY,
      elemX: currentX,
      elemY: currentY,
    };
    try {
      (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
    } catch {}
  };

  const handleDragPointerMove = (e: React.PointerEvent) => {
    if (!isDraggingRef.current) return;
    const deltaX = e.clientX - dragStartRef.current.mouseX;
    const deltaY = e.clientY - dragStartRef.current.mouseY;

    const el = miniScreenRef.current;
    const width = el?.offsetWidth || 360;
    const height = el?.offsetHeight || 230;

    const rawX = dragStartRef.current.elemX + deltaX;
    const rawY = dragStartRef.current.elemY + deltaY;

    const maxX = Math.max(0, window.innerWidth - width - 8);
    const maxY = Math.max(0, window.innerHeight - height - 8);
    const clampedX = Math.min(maxX, Math.max(8, rawX));
    const clampedY = Math.min(maxY, Math.max(8, rawY));

    setMiniPosition({ x: clampedX, y: clampedY });
  };

  const handleDragPointerUp = (e: React.PointerEvent) => {
    if (isDraggingRef.current) {
      isDraggingRef.current = false;
      try {
        (e.currentTarget as HTMLElement).releasePointerCapture(e.pointerId);
      } catch {}
    }
  };

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

  // ── Sync and Cleanup Fullscreen Participant ──
  useEffect(() => {
    if (fullscreenParticipant) {
      const updated = participants.find((p) => p.identity === fullscreenParticipant.identity);
      if (!updated || !updated.isScreenSharing || !updated.screenShareTrack) {
        setFullscreenParticipant(null);
      } else if (updated.screenShareTrack !== fullscreenParticipant.screenShareTrack) {
        setFullscreenParticipant(updated);
      }
    }
  }, [participants, fullscreenParticipant]);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && fullscreenParticipant) {
        setFullscreenParticipant(null);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [fullscreenParticipant]);

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
    const screenPub = p.getTrackPublication(Track.Source.ScreenShare);
    const isLocal = p instanceof LocalParticipant;
    const isScreenSharing = Boolean(screenPub && !screenPub.isMuted && screenPub.track);
    const screenShareTrack = screenPub?.track;

    const quality = participantQualitiesRef.current.get(p.identity) || (isLocal ? activeStreamQualityRef.current : null);
    const screenShareResolution = quality ? `${quality.res}p` : '1080p';
    const screenShareFps = quality ? quality.fps : 60;

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
      isScreenSharing,
      screenShareTrack,
      screenShareResolution,
      screenShareFps,
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
      setIsSharingScreen(
        Boolean(room.localParticipant.isScreenShareEnabled || customScreenTrackRef.current)
      );
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

      // 3. Initialize LiveKit Room instance with audio and 1080p 60fps video capabilities
      const room = new Room({
        adaptiveStream: true,
        dynacast: true,
        audioCaptureDefaults: {
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true, // Hardware/browser mic normalization enabled by default
          sampleRate: 48000,
        },
        videoCaptureDefaults: {
          resolution: {
            width: 1920,
            height: 1080,
            frameRate: 60,
          },
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
        .on(RoomEvent.LocalTrackPublished, (pub) => {
          if (pub.source === Track.Source.ScreenShare) {
            setIsSharingScreen(true);
          }
          syncParticipants();
        })
        .on(RoomEvent.LocalTrackUnpublished, (pub) => {
          if (pub.source === Track.Source.ScreenShare) {
            setIsSharingScreen(false);
          }
          syncParticipants();
        })
        .on(RoomEvent.Disconnected, (reason) => {
          syncParticipants();
          if (reason && reason.toString().toLowerCase().includes('room')) {
            toast.warning('The meeting was closed');
            if (onLeaveMeeting) {
              onLeaveMeeting();
            } else {
              window.history.back();
            }
          }
        })
        .on(RoomEvent.ParticipantConnected, (participant) => {
          toast.info(`${participant.name || 'A user'} joined the call`);
          syncParticipants();
        })
        .on(RoomEvent.ParticipantDisconnected, (participant) => {
          toast.info(`${participant.name || 'A user'} left the call`);
          attachedAudioElementsRef.current.delete(participant.identity);
          normalizerNodesRef.current.delete(participant.identity);
          setParticipantQualities((prev) => {
            const next = new Map(prev);
            next.delete(participant.identity);
            return next;
          });
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

            // Handle Admin closing the call for everyone
            if (msg.type === 'CALL_ENDED_BY_ADMIN') {
              toast.warning('The meeting was closed by a project admin');
              if (roomRef.current) {
                await roomRef.current.disconnect();
                roomRef.current = null;
              }
              if (onLeaveMeeting) {
                onLeaveMeeting();
              } else {
                window.history.back();
              }
              return;
            }

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

            // Remote screen stream quality metadata
            if (msg.type === 'STREAM_QUALITY' && participant) {
              if (msg.isSharing) {
                setParticipantQualities((prev) => {
                  const next = new Map(prev);
                  next.set(participant.identity, { res: msg.res, fps: msg.fps });
                  return next;
                });
              } else {
                setParticipantQualities((prev) => {
                  const next = new Map(prev);
                  next.delete(participant.identity);
                  return next;
                });
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
      if (customScreenTrackRef.current) {
        try {
          customScreenTrackRef.current.stop();
        } catch {}
        customScreenTrackRef.current = null;
      }
      if (customScreenAudioTrackRef.current) {
        try {
          customScreenAudioTrackRef.current.stop();
        } catch {}
        customScreenAudioTrackRef.current = null;
      }
      if (roomRef.current) {
        if (roomRef.current.localParticipant?.isScreenShareEnabled) {
          roomRef.current.localParticipant.setScreenShareEnabled(false).catch(() => {});
        }
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

  // ── Stop Screen Sharing (Ensures Mic audio is untouched) ──
  const handleStopScreenShare = useCallback(async () => {
    const room = roomRef.current;
    if (!room || !room.localParticipant) return;

    try {
      if (customScreenTrackRef.current) {
        await room.localParticipant.unpublishTrack(customScreenTrackRef.current, true).catch(() => {});
        customScreenTrackRef.current.stop();
        customScreenTrackRef.current = null;
      }

      if (customScreenAudioTrackRef.current) {
        await room.localParticipant.unpublishTrack(customScreenAudioTrackRef.current, true).catch(() => {});
        customScreenAudioTrackRef.current.stop();
        customScreenAudioTrackRef.current = null;
      }

      await room.localParticipant.setScreenShareEnabled(false).catch(() => {});

      // Broadcast stop stream info
      try {
        const payload = new TextEncoder().encode(
          JSON.stringify({
            type: 'STREAM_QUALITY',
            isSharing: false,
          })
        );
        await room.localParticipant.publishData(payload, { reliable: true });
      } catch (e) {
        console.warn('[publishData STREAM_QUALITY stop note]:', e);
      }

      setActiveStreamQuality(null);
      setIsSharingScreen(false);
      toast.info('Screen stream stopped');
      syncParticipants();
    } catch (err) {
      console.warn('[Stop Screen Share Error]:', err);
    }
  }, [syncParticipants]);

  // ── Start Screen Sharing (with Custom Resolution 720/1080/1440, FPS 24/30/48/60, Audio) ──
  const handleStartScreenShare = async (config?: {
    resolution?: ScreenResolution;
    fps?: ScreenFps;
    includeAudio?: boolean;
  }) => {
    const room = roomRef.current;
    if (!room || !room.localParticipant) {
      toast.error('Not connected to meeting room');
      return;
    }

    const isMobile =
      typeof navigator !== 'undefined' &&
      (/android|iphone|ipad|ipod|mobile/i.test(navigator.userAgent) ||
        (typeof window !== 'undefined' &&
          window.matchMedia &&
          window.matchMedia('(max-width: 768px)').matches));

    const targetRes = config?.resolution ?? selectedResolution;
    const targetFps = config?.fps ?? selectedFps;
    // On mobile devices, system audio in screen capture is unsupported and causes getDisplayMedia to throw NotSupportedError
    const targetAudio = isMobile ? false : (config?.includeAudio ?? includeScreenAudio);

    const resConfig = RESOLUTION_CONFIG[targetRes];
    const maxBitrate = resConfig.bitrates[targetFps] || 5_000_000;

    setShowScreenShareModal(false);
    toast.info(`Starting ${targetRes}p ${targetFps}fps screen stream…`);

    try {
      let sharedSuccessfully = false;

      // Attempt 1: Standard LiveKit setScreenShareEnabled
      // On mobile devices, do not specify forced fixed landscape width/height or audio: true
      try {
        await room.localParticipant.setScreenShareEnabled(
          true,
          {
            audio: targetAudio,
            resolution: isMobile
              ? undefined
              : {
                  width: resConfig.width,
                  height: resConfig.height,
                  frameRate: targetFps,
                },
          },
          {
            videoEncoding: {
              maxBitrate,
              maxFramerate: targetFps,
            },
          }
        );
        sharedSuccessfully = true;
      } catch (lkErr: any) {
        if (lkErr?.name === 'NotAllowedError' || lkErr?.message?.includes('Permission denied')) {
          throw lkErr;
        }
        console.warn('[LiveKit setScreenShareEnabled note, attempting direct desktop capture]:', lkErr);
      }

      // Attempt 2: Electron Forge or direct capture fallback
      if (!sharedSuccessfully) {
        const stream = await captureDesktopMediaStream({
          width: resConfig.width,
          height: resConfig.height,
          fps: targetFps,
          includeAudio: targetAudio,
        });

        const videoTrack = stream.getVideoTracks()[0];
        if (!videoTrack) {
          throw new Error('No screen video track was acquired');
        }

        const localVideoTrack = new LocalVideoTrack(videoTrack, undefined, false);
        localVideoTrack.source = Track.Source.ScreenShare;

        videoTrack.onended = () => {
          handleStopScreenShare();
        };

        await room.localParticipant.publishTrack(localVideoTrack, {
          source: Track.Source.ScreenShare,
          videoEncoding: {
            maxBitrate,
            maxFramerate: targetFps,
          },
        });

        customScreenTrackRef.current = localVideoTrack;

        // Publish audio track from desktop stream if present and requested
        const audioTrack = stream.getAudioTracks()[0];
        if (targetAudio && audioTrack) {
          try {
            const localAudioTrack = new LocalAudioTrack(audioTrack, undefined, false);
            localAudioTrack.source = Track.Source.ScreenShareAudio;
            await room.localParticipant.publishTrack(localAudioTrack, {
              source: Track.Source.ScreenShareAudio,
            });
            customScreenAudioTrackRef.current = localAudioTrack;
          } catch (audioErr) {
            console.warn('[Screen audio publish note]:', audioErr);
          }
        }
      }

      // Broadcast quality info to all participants
      const qualityInfo = { res: targetRes, fps: targetFps };
      setActiveStreamQuality(qualityInfo);
      setIsSharingScreen(true);

      try {
        const payload = new TextEncoder().encode(
          JSON.stringify({
            type: 'STREAM_QUALITY',
            res: targetRes,
            fps: targetFps,
            isSharing: true,
          })
        );
        await room.localParticipant.publishData(payload, { reliable: true });
      } catch (e) {
        console.warn('[publishData STREAM_QUALITY note]:', e);
      }

      toast.success(`Screen stream active (${targetRes}p ${targetFps}fps)`);
      syncParticipants();
    } catch (err: any) {
      console.warn('[Screen Share Error]:', err);
      if (err?.name === 'NotAllowedError' || err?.message?.includes('Permission denied')) {
        toast.info('Screen stream cancelled');
      } else {
        toast.error(err?.message || 'Failed to start screen stream');
      }
      setIsSharingScreen(
        Boolean(room.localParticipant?.isScreenShareEnabled || customScreenTrackRef.current)
      );
      syncParticipants();
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

  // ── Admin Close Call For Everyone ──
  const handleAdminCloseCall = async () => {
    if (!currentUserIsAdmin) {
      toast.error('Only project admins can close the call for everyone');
      return;
    }

    const confirmed = window.confirm(
      'Close call for everyone? All participants will be returned to the project overview page.'
    );
    if (!confirmed) return;

    const room = roomRef.current;
    try {
      // 1. Broadcast immediate real-time data message to all clients
      if (room && room.localParticipant) {
        const payload = new TextEncoder().encode(
          JSON.stringify({
            type: 'CALL_ENDED_BY_ADMIN',
            reason: 'The meeting was closed by a project admin',
          })
        );
        await room.localParticipant.publishData(payload, { reliable: true });
      }

      // 2. Call server API to close the room on the LiveKit server
      await fetch('/api/livekit-token', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'close-call',
          projectId,
        }),
      });

      toast.info('Meeting closed for all participants');

      // 3. Disconnect locally and leave to overview page
      if (room) {
        await room.disconnect();
        roomRef.current = null;
      }

      if (onLeaveMeeting) {
        onLeaveMeeting();
      } else {
        window.history.back();
      }
    } catch (err: any) {
      console.warn('[Admin Close Call Error]:', err);
      toast.error(err.message || 'Failed to close call');
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

  // ── Floating Draggable Miniscreen (Picture-in-Picture) Rendering ──
  if (isMini) {
    const screenSharingParticipant = participants.find(
      (p) => p.isScreenSharing && p.screenShareTrack
    );
    const activeSpeaker =
      participants.find((p) => p.isSpeaking && !p.isMuted) || participants[0];

    const posX =
      miniPosition?.x ??
      (typeof window !== 'undefined'
        ? Math.max(16, window.innerWidth - 360 - 24)
        : 20);
    const posY =
      miniPosition?.y ??
      (typeof window !== 'undefined'
        ? Math.max(16, window.innerHeight - 230 - 24)
        : 20);

    return (
      <div
        ref={miniScreenRef}
        style={{
          position: 'fixed',
          left: `${posX}px`,
          top: `${posY}px`,
          zIndex: 50,
        }}
        onClick={unlockAudio}
        className="w-80 sm:w-96 rounded-2xl bg-[#0F1015]/95 border border-[#2B2D38] shadow-2xl shadow-black/80 backdrop-blur-xl overflow-hidden flex flex-col select-none animate-in fade-in zoom-in-95 duration-150 transition-shadow hover:border-[#3D4150]"
      >
        {/* Miniscreen Draggable Header Bar */}
        <div
          onPointerDown={handleDragPointerDown}
          onPointerMove={handleDragPointerMove}
          onPointerUp={handleDragPointerUp}
          className="h-10 px-3 bg-[#15161E] border-b border-[#222430] flex items-center justify-between cursor-grab active:cursor-grabbing touch-none select-none"
          title="Drag to move miniscreen anywhere"
        >
          <div className="flex items-center gap-2 overflow-hidden pointer-events-none">
            <GripHorizontal size={15} className="text-[#787C83] shrink-0" />
            <span className="text-xs font-bold text-white truncate max-w-[140px] sm:max-w-[190px]">
              {screenSharingParticipant
                ? `${screenSharingParticipant.name}'s Screen`
                : `${projectName} Meeting`}
            </span>
            {screenSharingParticipant ? (
              <span className="px-1.5 py-0.2 rounded bg-[#22C55E]/15 text-[#22C55E] text-[9px] font-mono font-bold border border-[#22C55E]/30 shrink-0 flex items-center gap-1">
                <span className="w-1.5 h-1.5 rounded-full bg-[#22C55E] animate-ping" />
                {screenSharingParticipant.screenShareResolution || '1080p'}
                {screenSharingParticipant.screenShareFps || 60}
              </span>
            ) : isConnected ? (
              <span className="px-1.5 py-0.2 rounded bg-[#22C55E]/15 text-[#22C55E] text-[9px] font-mono font-semibold border border-[#22C55E]/30 shrink-0">
                LIVE
              </span>
            ) : null}
          </div>

          <div className="flex items-center gap-1 shrink-0">
            {/* Expand to full meeting */}
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                onExpandMeeting?.();
              }}
              className="p-1 rounded-lg hover:bg-[#252836] text-[#A0A5B0] hover:text-white transition-colors cursor-pointer"
              title="Expand to Full Meeting View"
            >
              <Maximize2 size={13} />
            </button>

            {/* Leave call */}
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                handleLeaveCall();
              }}
              className="p-1 rounded-lg hover:bg-red-500/20 text-red-400 hover:text-red-300 transition-colors cursor-pointer"
              title="Leave Call"
            >
              <PhoneOff size={13} />
            </button>
          </div>
        </div>

        {/* Miniscreen Body: Live Video or Voice Audio Tile */}
        {screenSharingParticipant && screenSharingParticipant.screenShareTrack ? (
          <div
            onClick={() => onExpandMeeting?.()}
            className="relative w-full aspect-video bg-black cursor-pointer group flex items-center justify-center overflow-hidden"
            title="Click to expand meeting"
          >
            <ScreenShareVideo
              track={screenSharingParticipant.screenShareTrack}
              isLocal={screenSharingParticipant.isLocal}
              className="w-full h-full object-contain"
            />
            {/* Hover overlay hint */}
            <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center pointer-events-none">
              <span className="px-2.5 py-1 rounded-lg bg-black/80 text-white text-[11px] font-semibold flex items-center gap-1.5 border border-white/15 backdrop-blur-md shadow-lg">
                <Maximize2 size={12} className="text-[#DCB001]" /> Click to Expand
              </span>
            </div>
          </div>
        ) : (
          /* Voice-only audio indicator tile */
          <div
            onClick={() => onExpandMeeting?.()}
            className="p-3.5 flex items-center justify-between gap-3 bg-[#0B0C10] cursor-pointer hover:bg-[#111319] transition-colors"
            title="Click to expand meeting"
          >
            <div className="flex items-center gap-2.5 min-w-0">
              <div className="relative shrink-0">
                <div
                  className={`w-9 h-9 rounded-full flex items-center justify-center overflow-hidden font-mono font-bold text-xs uppercase ${
                    activeSpeaker?.isSpeaking
                      ? 'ring-2 ring-[#22C55E] ring-offset-2 ring-offset-[#0B0C10] bg-[#22C55E]/20 text-[#22C55E]'
                      : 'bg-[#1A1C24] text-white border border-[#2B2D38]'
                  }`}
                >
                  <Avatar user={{ name: activeSpeaker?.name, avatar: activeSpeaker?.avatar }} size="sm" />
                </div>
                {activeSpeaker?.isMuted && (
                  <span className="absolute -bottom-0.5 -right-0.5 w-3.5 h-3.5 rounded-full bg-red-500/90 flex items-center justify-center text-white text-[8px]">
                    <MicOff size={8} />
                  </span>
                )}
              </div>
              <div className="min-w-0">
                <p className="text-xs font-semibold text-white truncate">
                  {activeSpeaker ? activeSpeaker.name : projectName}
                </p>
                <p className="text-[10px] text-[#787C83] flex items-center gap-1.5">
                  <span className="flex items-center gap-1">
                    <Users size={10} /> {participants.length} in call
                  </span>
                  {activeSpeaker?.isSpeaking && (
                    <span className="text-[#22C55E] font-medium">• Speaking</span>
                  )}
                </p>
              </div>
            </div>

            <div className="px-2 py-1 rounded-lg bg-[#151720] border border-[#262834] text-[10px] text-[#DCB001] font-semibold flex items-center gap-1 shrink-0">
              <Radio size={10} className="text-[#22C55E] animate-pulse" />
              <span>Voice</span>
            </div>
          </div>
        )}

        {/* Miniscreen Footer Controls */}
        <div className="px-3 py-2 bg-[#101218] border-t border-[#1F212C] flex items-center justify-between">
          <div className="flex items-center gap-1.5">
            {/* Mic Toggle */}
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                handleToggleMute();
              }}
              className={`p-1.5 rounded-xl border transition-all cursor-pointer ${
                isMuted
                  ? 'bg-red-500/15 text-red-400 border-red-500/35 hover:bg-red-500/25'
                  : 'bg-[#181A22] text-[#22C55E] border-[#2B2D38] hover:bg-[#222430]'
              }`}
              title={isMuted ? 'Unmute Mic' : 'Mute Mic'}
            >
              {isMuted ? <MicOff size={13} /> : <Mic size={13} />}
            </button>

            {/* Deafen Toggle */}
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                handleToggleDeafen();
              }}
              className={`p-1.5 rounded-xl border transition-all cursor-pointer ${
                isDeafened
                  ? 'bg-red-500/15 text-red-400 border-red-500/35 hover:bg-red-500/25'
                  : 'bg-[#181A22] text-[#A0A5B0] border-[#2B2D38] hover:text-white hover:bg-[#222430]'
              }`}
              title={isDeafened ? 'Undeafen' : 'Deafen'}
            >
              {isDeafened ? <VolumeX size={13} /> : <Volume2 size={13} />}
            </button>
          </div>

          <div className="flex items-center gap-2">
            <span className="font-mono text-[10px] text-[#787C83]">
              {formattedTimer}
            </span>

            {/* Expand button */}
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                onExpandMeeting?.();
              }}
              className="flex items-center gap-1 px-2.5 py-1 rounded-lg bg-[#DCB001]/15 hover:bg-[#DCB001]/25 text-[#DCB001] border border-[#DCB001]/35 text-[11px] font-semibold transition-all cursor-pointer"
              title="Expand to Full Meeting View"
            >
              <Maximize2 size={11} />
              <span>Expand</span>
            </button>
          </div>
        </div>
      </div>
    );
  }

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

          {/* Minimize to Floating Miniscreen */}
          {onMinimizeMeeting && (
            <button
              onClick={(e) => {
                e.stopPropagation();
                onMinimizeMeeting();
              }}
              className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded-xl bg-[#18191E] text-[#8E939D] hover:text-white border border-[#2A2C30] transition-all cursor-pointer"
              title="Minimize Meeting to Floating Miniscreen"
            >
              <Minimize2 size={14} />
              <span>Minimize</span>
            </button>
          )}

          {/* Admin Close Call Button (Ends meeting for everyone) */}
          {currentUserIsAdmin && (
            <button
              onClick={(e) => {
                e.stopPropagation();
                handleAdminCloseCall();
              }}
              className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-bold rounded-xl bg-red-600 hover:bg-red-700 text-white border border-red-500/50 transition-all shadow-md cursor-pointer"
              title="Close meeting for all participants and return to overview"
            >
              <PowerOff size={14} />
              <span>Close Call</span>
            </button>
          )}

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
              <CustomDropdown<string>
                value={selectedInputId}
                onChange={(val) => handleSwitchMic(val)}
                options={
                  audioInputDevices.length === 0
                    ? [{ value: '', label: 'Default Microphone' }]
                    : audioInputDevices.map((d, i) => ({
                        value: d.deviceId,
                        label: d.label || `Microphone ${i + 1}`,
                      }))
                }
                className="w-full"
                triggerClassName="w-full bg-[#1A1C22] border border-[#33363F] text-white text-xs rounded-xl px-3 py-2 hover:border-[#DCB001]/50"
                size="sm"
              />
            </div>

            {/* Output Selection */}
            <div className="flex-1 w-full">
              <label className="text-[11px] font-semibold text-[#8E939D] uppercase tracking-wider flex items-center gap-1.5 mb-1.5">
                <Headphones size={12} className="text-[#DCB001]" /> Speaker (Output)
              </label>
              <CustomDropdown<string>
                value={selectedOutputId}
                onChange={(val) => handleSwitchSpeaker(val)}
                options={
                  audioOutputDevices.length === 0
                    ? [{ value: '', label: 'Default Speaker' }]
                    : audioOutputDevices.map((d, i) => ({
                        value: d.deviceId,
                        label: d.label || `Speaker ${i + 1}`,
                      }))
                }
                className="w-full"
                triggerClassName="w-full bg-[#1A1C22] border border-[#33363F] text-white text-xs rounded-xl px-3 py-2 hover:border-[#DCB001]/50"
                size="sm"
              />
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

          {(() => {
            const hasAnyScreenShare = participants.some((p) => p.isScreenSharing && p.screenShareTrack);

            return (
              <div
                className={`grid gap-4 w-full h-full auto-rows-fr ${
                  hasAnyScreenShare
                    ? participants.length === 1
                      ? 'grid-cols-1 max-w-5xl mx-auto'
                      : participants.length === 2
                      ? 'grid-cols-1 lg:grid-cols-2 max-w-6xl mx-auto'
                      : participants.length <= 4
                      ? 'grid-cols-1 sm:grid-cols-2 max-w-6xl mx-auto'
                      : 'grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 max-w-7xl mx-auto'
                    : participants.length === 1
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
                  const isSharingThisScreen = Boolean(p.isScreenSharing && p.screenShareTrack);

                  return (
                    <div
                      key={p.identity}
                      onClick={() => {
                        if (isSharingThisScreen) {
                          setFullscreenParticipant(p);
                        }
                      }}
                      className={`relative rounded-2xl bg-[#121317] border transition-all duration-200 flex flex-col shadow-xl overflow-hidden ${
                        isSharingThisScreen
                          ? 'cursor-pointer hover:border-[#DCB001]/50 min-h-[260px] aspect-video'
                          : 'items-center justify-center p-6 min-h-[220px]'
                      } ${
                        speaking
                          ? 'border-[#22C55E] ring-4 ring-[#22C55E]/20 shadow-[0_0_24px_rgba(34,197,94,0.2)]'
                          : 'border-[#22242A] hover:border-[#333640]'
                      }`}
                    >
                      {/* Speaking background glow */}
                      {speaking && !isSharingThisScreen && (
                        <div className="absolute inset-0 bg-radial from-[#22C55E]/10 to-transparent pointer-events-none animate-pulse" />
                      )}

                      {isSharingThisScreen ? (
                        <div className="relative w-full h-full flex flex-col bg-black overflow-hidden group">
                          {/* 1080p 60fps Video Stream */}
                          <div className="relative flex-1 w-full h-full min-h-[200px] bg-black flex items-center justify-center overflow-hidden">
                            <ScreenShareVideo
                              track={p.screenShareTrack!}
                              isLocal={p.isLocal}
                              className="w-full h-full object-contain"
                            />

                            {/* Hover fullscreen prompt overlay */}
                            <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center pointer-events-none">
                              <span className="px-3.5 py-1.5 rounded-xl bg-black/80 text-white border border-white/20 backdrop-blur-md text-xs font-semibold flex items-center gap-1.5 shadow-2xl">
                                <Maximize2 size={14} className="text-[#DCB001]" /> Click to View Fullscreen
                              </span>
                            </div>
                          </div>

                          {/* Top Overlay Bar */}
                          <div className="absolute top-2.5 left-2.5 right-2.5 flex items-center justify-between pointer-events-none z-10">
                            {/* Streamer details pill */}
                            <div className="flex items-center gap-2 px-2.5 py-1 rounded-xl bg-black/80 backdrop-blur-md border border-white/15 text-xs font-medium text-white shadow-md pointer-events-auto">
                              <Avatar user={{ name: p.name, avatar: p.avatar }} size="xs" />
                              <span className="truncate max-w-[120px] font-semibold text-xs">{p.name}</span>
                              {p.isLocal && (
                                <span className="px-1.5 rounded bg-[#DCB001]/20 text-[#DCB001] font-mono text-[9px] font-bold">
                                  YOU
                                </span>
                              )}
                              {p.isAdmin && (
                                <span className="px-1.5 rounded bg-blue-500/20 text-blue-400 font-mono text-[9px] font-bold">
                                  ADMIN
                                </span>
                              )}
                            </div>

                            {/* Dynamic Resolution & FPS LIVE badge + Fullscreen button */}
                            <div className="flex items-center gap-1.5 pointer-events-auto">
                              <span className="px-2 py-0.5 rounded-lg bg-[#22C55E]/20 text-[#22C55E] text-[10px] font-mono font-bold border border-[#22C55E]/40 flex items-center gap-1 backdrop-blur-md shadow-sm">
                                <span className="w-1.5 h-1.5 rounded-full bg-[#22C55E] animate-ping" />
                                {p.screenShareResolution || '1080p'} {p.screenShareFps || 60}fps LIVE
                              </span>
                              <button
                                onClick={(e) => {
                                  e.stopPropagation();
                                  setFullscreenParticipant(p);
                                }}
                                className="p-1.5 rounded-lg bg-black/80 hover:bg-[#1E2026] text-white border border-white/15 backdrop-blur-md transition-all shadow-md cursor-pointer"
                                title="View stream in fullscreen"
                              >
                                <Maximize2 size={13} />
                              </button>
                            </div>
                          </div>

                          {/* Bottom Status / Admin Remote Mute Bar */}
                          <div className="absolute bottom-2.5 left-2.5 right-2.5 flex items-center justify-between z-10 pointer-events-none">
                            <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-black/80 backdrop-blur-md border border-white/15 text-[11px] font-mono text-white/90 pointer-events-auto">
                              {p.isMuted ? (
                                <span className="flex items-center gap-1 text-red-400">
                                  <MicOff size={12} /> Mic Muted
                                </span>
                              ) : p.isSpeaking ? (
                                <span className="flex items-center gap-1 text-[#22C55E]">
                                  <Mic size={12} /> Speaking…
                                </span>
                              ) : (
                                <span className="flex items-center gap-1 text-[#A0A5B0]">
                                  <Mic size={12} /> Idle
                                </span>
                              )}
                            </div>

                            {currentUserIsAdmin && !p.isLocal && (
                              <div className="pointer-events-auto">
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
                                  className={`flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-[11px] font-semibold border backdrop-blur-md transition-all cursor-pointer shadow-md ${
                                    p.isMuted
                                      ? 'bg-[#22C55E]/25 hover:bg-[#22C55E]/35 text-[#22C55E] border-[#22C55E]/40'
                                      : 'bg-red-500/25 hover:bg-red-500/35 text-red-300 border-red-500/40'
                                  }`}
                                  title={p.isMuted ? 'Admin: Unmute participant' : 'Admin: Mute participant'}
                                >
                                  {p.isMuted ? <Mic size={11} /> : <MicOff size={11} />}
                                  <span>{p.isMuted ? 'Unmute' : 'Mute'}</span>
                                </button>
                              </div>
                            )}
                          </div>
                        </div>
                      ) : (
                        <>
                          {/* Avatar */}
                          <div className="relative mb-3.5">
                            <div
                              className={`w-20 h-20 rounded-full flex items-center justify-center overflow-hidden font-bold text-xl uppercase transition-all duration-200 ${
                                speaking
                                  ? 'ring-4 ring-[#22C55E] ring-offset-4 ring-offset-[#121317] scale-105'
                                  : 'ring-2 ring-[#2B2D35]'
                              }`}
                            >
                              <Avatar user={{ name: p.name, avatar: p.avatar }} className="w-20 h-20 text-2xl font-bold font-mono" />
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
                        </>
                      )}
                    </div>
                  );
                })}
              </div>
            );
          })()}
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

          {/* Screen Share Button */}
          <button
            onClick={() => {
              if (isSharingScreen) {
                handleStopScreenShare();
              } else {
                setShowScreenShareModal(true);
              }
            }}
            className={`flex items-center gap-2 px-4 py-2.5 rounded-2xl font-semibold text-xs transition-all border cursor-pointer ${
              isSharingScreen
                ? 'bg-[#22C55E]/20 text-[#22C55E] border-[#22C55E]/50 hover:bg-[#22C55E]/30 shadow-[0_0_20px_rgba(34,197,94,0.25)] animate-pulse'
                : 'bg-[#1E2027] hover:bg-[#282B34] text-white border border-[#343742]'
            }`}
            title={
              isSharingScreen
                ? 'Stop Screen Stream'
                : 'Choose Quality & Share Screen (LiveKit)'
            }
          >
            {isSharingScreen ? (
              <ScreenShareOff size={16} className="text-[#22C55E]" />
            ) : (
              <ScreenShare size={16} className="text-[#A0A5B0]" />
            )}
            <span>{isSharingScreen ? 'Stop Sharing' : 'Share Screen'}</span>
            {isSharingScreen && activeStreamQuality ? (
              <span className="hidden sm:inline-block px-1.5 py-0.5 rounded bg-black/40 text-[9px] font-mono text-[#22C55E] border border-[#22C55E]/30">
                {activeStreamQuality.res}p{activeStreamQuality.fps}
              </span>
            ) : (
              <span className="hidden sm:inline-block px-1.5 py-0.5 rounded bg-black/40 text-[9px] font-mono text-[#A0A5B0] border border-white/10">
                {selectedResolution}p{selectedFps}
              </span>
            )}
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

          {/* Leave Button (Personal Exit) */}
          <button
            onClick={handleLeaveCall}
            className="flex items-center gap-2 px-4 py-2.5 rounded-2xl font-semibold text-xs bg-[#1E2027] hover:bg-[#282B34] text-white border border-[#343742] transition-all shadow-lg cursor-pointer"
            title="Disconnect & Exit Call"
          >
            <PhoneOff size={16} />
            <span>Leave Call</span>
          </button>

          {/* Admin Close Call Button (Ends meeting for all participants) */}
          {currentUserIsAdmin && (
            <button
              onClick={handleAdminCloseCall}
              className="flex items-center gap-2 px-4 py-2.5 rounded-2xl font-bold text-xs bg-red-600 hover:bg-red-700 text-white transition-all shadow-lg hover:shadow-red-600/30 cursor-pointer border border-red-500/50"
              title="Close meeting for everyone and return to overview"
            >
              <PowerOff size={16} />
              <span>Close Call</span>
            </button>
          )}
        </div>
      </div>

      {/* ── Screen Share Settings Modal ── */}
      {showScreenShareModal && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-md flex items-center justify-center p-4 animate-in fade-in duration-200">
          <div className="bg-[#121318] border border-[#282A34] rounded-2xl p-6 w-full max-w-md max-h-[90vh] overflow-y-auto shadow-2xl space-y-5">
            {/* Header */}
            <div className="flex items-center justify-between pb-3 border-b border-[#20222B]">
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-xl bg-[#DCB001]/10 border border-[#DCB001]/30 flex items-center justify-center text-[#DCB001]">
                  <ScreenShare size={16} />
                </div>
                <div>
                  <h3 className="text-sm font-bold text-white tracking-tight">Stream Quality & Audio</h3>
                  <p className="text-[11px] text-[#787C83]">Configure resolution and frame rate</p>
                </div>
              </div>
              <button
                onClick={() => setShowScreenShareModal(false)}
                className="p-1 rounded-lg hover:bg-[#1E2027] text-[#787C83] hover:text-white transition-colors cursor-pointer"
              >
                <X size={16} />
              </button>
            </div>

            {/* Resolution Options */}
            <div className="space-y-2">
              <label className="text-xs font-semibold text-white/90 flex items-center justify-between">
                <span>Resolution</span>
                <span className="text-[10px] text-[#A0A5B0] font-normal">720p HD • 1080p FHD • 1440p 2K</span>
              </label>
              <div className="grid grid-cols-3 gap-2">
                {[
                  { value: '720', label: '720p', desc: '1280x720' },
                  { value: '1080', label: '1080p', desc: '1920x1080', badge: 'Recommended' },
                  { value: '1440', label: '1440p', desc: '2560x1440' },
                ].map((item) => {
                  const isSelected = selectedResolution === item.value;
                  return (
                    <button
                      key={item.value}
                      type="button"
                      onClick={() => setSelectedResolution(item.value as ScreenResolution)}
                      className={`relative flex flex-col items-center justify-center p-3 rounded-xl border text-center transition-all cursor-pointer ${
                        isSelected
                          ? 'bg-[#DCB001]/15 border-[#DCB001] text-white shadow-[0_0_15px_rgba(220,176,1,0.15)]'
                          : 'bg-[#181920] border-[#2B2D37] text-[#9BA1A6] hover:bg-[#1E2028] hover:text-white'
                      }`}
                    >
                      {item.badge && (
                        <span className="absolute -top-2 px-1.5 py-0.5 rounded-full bg-[#DCB001] text-black text-[8px] font-bold uppercase tracking-wider">
                          {item.badge}
                        </span>
                      )}
                      <span className="text-sm font-bold">{item.label}</span>
                      <span className="text-[10px] text-[#787C83] mt-0.5">{item.desc}</span>
                    </button>
                  );
                })}
              </div>
            </div>

            {/* FPS Options */}
            <div className="space-y-2">
              <label className="text-xs font-semibold text-white/90 flex items-center justify-between">
                <span>Frame Rate</span>
                <span className="text-[10px] text-[#A0A5B0] font-normal">Higher FPS = Smoother Motion</span>
              </label>
              <div className="grid grid-cols-4 gap-2">
                {[
                  { value: 24, label: '24 FPS', desc: 'Cinema' },
                  { value: 30, label: '30 FPS', desc: 'Standard' },
                  { value: 48, label: '48 FPS', desc: 'High' },
                  { value: 60, label: '60 FPS', desc: 'Smooth', badge: 'Fast' },
                ].map((item) => {
                  const isSelected = selectedFps === item.value;
                  return (
                    <button
                      key={item.value}
                      type="button"
                      onClick={() => setSelectedFps(item.value as ScreenFps)}
                      className={`relative flex flex-col items-center justify-center py-2.5 px-1.5 rounded-xl border text-center transition-all cursor-pointer ${
                        isSelected
                          ? 'bg-[#22C55E]/15 border-[#22C55E] text-[#22C55E] shadow-[0_0_15px_rgba(34,197,94,0.15)]'
                          : 'bg-[#181920] border-[#2B2D37] text-[#9BA1A6] hover:bg-[#1E2028] hover:text-white'
                      }`}
                    >
                      {item.badge && (
                        <span className="absolute -top-2 px-1.5 py-0.5 rounded-full bg-[#22C55E] text-black text-[8px] font-bold uppercase tracking-wider">
                          {item.badge}
                        </span>
                      )}
                      <span className="text-xs font-bold">{item.label}</span>
                      <span className="text-[9px] text-[#787C83] mt-0.5">{item.desc}</span>
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Screen Audio Toggle */}
            <div className="pt-2 border-t border-[#20222B]">
              {typeof navigator !== 'undefined' &&
              (/android|iphone|ipad|ipod|mobile/i.test(navigator.userAgent) ||
                (typeof window !== 'undefined' &&
                  window.matchMedia &&
                  window.matchMedia('(max-width: 768px)').matches)) ? (
                <div className="p-3 rounded-xl bg-[#181920] border border-[#2B2D37] flex items-center gap-2.5 text-xs text-[#9BA1A6]">
                  <Volume2 size={16} className="text-[#DCB001] shrink-0" />
                  <div>
                    <p className="font-semibold text-white">Microphone Audio Active</p>
                    <p className="text-[10px] text-[#787C83]">
                      Mobile Chrome streams screen video while your microphone continuously transmits your voice.
                    </p>
                  </div>
                </div>
              ) : (
                <div
                  onClick={() => setIncludeScreenAudio((prev) => !prev)}
                  className="flex items-center justify-between p-3 rounded-xl bg-[#181920] border border-[#2B2D37] hover:border-[#383B47] transition-all cursor-pointer"
                >
                  <div className="flex items-center gap-2.5">
                    <div
                      className={`p-1.5 rounded-lg ${
                        includeScreenAudio
                          ? 'bg-[#22C55E]/15 text-[#22C55E]'
                          : 'bg-[#22242B] text-[#787C83]'
                      }`}
                    >
                      {includeScreenAudio ? <Volume2 size={16} /> : <VolumeX size={16} />}
                    </div>
                    <div>
                      <p className="text-xs font-semibold text-white">Share System Audio</p>
                      <p className="text-[10px] text-[#787C83]">
                        Stream tab/desktop sound alongside your microphone
                      </p>
                    </div>
                  </div>
                  <div
                    className={`w-10 h-5 rounded-full transition-colors relative flex items-center px-0.5 ${
                      includeScreenAudio ? 'bg-[#22C55E]' : 'bg-[#2B2D37]'
                    }`}
                  >
                    <div
                      className={`w-4 h-4 rounded-full bg-white transition-transform ${
                        includeScreenAudio ? 'translate-x-5' : 'translate-x-0'
                      }`}
                    />
                  </div>
                </div>
              )}
            </div>

            {/* Action Buttons */}
            <div className="flex items-center justify-end gap-2.5 pt-2 border-t border-[#20222B]">
              <button
                type="button"
                onClick={() => setShowScreenShareModal(false)}
                className="px-4 py-2 text-xs font-semibold rounded-xl bg-[#181920] hover:bg-[#20222B] text-[#9BA1A6] hover:text-white border border-[#2B2D37] transition-all cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={() => handleStartScreenShare()}
                className="flex items-center gap-2 px-5 py-2 text-xs font-bold rounded-xl bg-gradient-to-r from-[#DCB001] to-[#E6BA0A] hover:brightness-110 text-black shadow-lg shadow-[#DCB001]/20 transition-all cursor-pointer"
              >
                <ScreenShare size={15} />
                <span>Start Stream ({selectedResolution}p {selectedFps}fps)</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Fullscreen Stream Modal ── */}
      {fullscreenParticipant && fullscreenParticipant.screenShareTrack && (
        <div className="fixed inset-0 z-50 bg-[#050608]/98 backdrop-blur-2xl flex flex-col animate-in fade-in duration-200">
          {/* Header */}
          <div className="h-14 px-6 border-b border-[#1E2026] bg-[#0E0F13]/90 backdrop-blur-md flex items-center justify-between shrink-0 z-10">
            <div className="flex items-center gap-3">
              <Avatar user={{ name: fullscreenParticipant.name, avatar: fullscreenParticipant.avatar }} size="md" />
              <div>
                <div className="flex items-center gap-2">
                  <h3 className="text-sm font-bold text-white tracking-tight">
                    {fullscreenParticipant.name}'s Stream
                  </h3>
                  {fullscreenParticipant.isLocal && (
                    <span className="px-1.5 py-0.5 rounded bg-[#DCB001]/15 text-[#DCB001] font-mono text-[9px] font-bold border border-[#DCB001]/30">
                      YOU
                    </span>
                  )}
                  <span className="px-2 py-0.5 rounded-full bg-[#22C55E]/15 text-[#22C55E] text-[10px] font-mono font-bold border border-[#22C55E]/30 flex items-center gap-1">
                    <span className="w-1.5 h-1.5 rounded-full bg-[#22C55E] animate-ping" />
                    {fullscreenParticipant.screenShareResolution || '1080p'} {fullscreenParticipant.screenShareFps || 60}fps LIVE
                  </span>
                </div>
                <p className="text-[11px] text-[#787C83]">
                  Press <kbd className="px-1.5 py-0.5 rounded bg-[#1C1E24] text-white border border-[#2D3039] font-mono text-[10px]">Esc</kbd> or click Exit Fullscreen to return
                </p>
              </div>
            </div>

            <div className="flex items-center gap-2">
              <button
                onClick={() => setFullscreenParticipant(null)}
                className="flex items-center gap-1.5 px-3.5 py-1.5 text-xs font-semibold rounded-xl bg-[#1C1E24] hover:bg-[#282B34] text-white border border-[#323642] transition-all cursor-pointer shadow-md"
                title="Exit Fullscreen (Esc)"
              >
                <Minimize2 size={14} />
                <span>Exit Fullscreen</span>
              </button>
            </div>
          </div>

          {/* Video Container */}
          <div className="flex-1 min-h-0 flex items-center justify-center p-4 relative bg-black select-none">
            <ScreenShareVideo
              track={fullscreenParticipant.screenShareTrack}
              isLocal={fullscreenParticipant.isLocal}
              className="w-full h-full object-contain max-h-full"
            />
          </div>
        </div>
      )}
    </div>
  );
};

export default ProjectMeetingView;
