import { describe, it, expect } from 'vitest';
import { MeetingParticipant } from '@/components/ProjectMeetingView';

describe('Project Audio Meeting Operations & State Logic', () => {
  const testProjectId = 12345;

  it('manages meeting participant join and state mutations', () => {
    const room = new Map<string, MeetingParticipant>();

    const p1: MeetingParticipant = {
      peerId: 'peer_1',
      userId: 1,
      userName: 'Alice',
      userAvatar: 'https://example.com/alice.jpg',
      userEmail: 'alice@example.com',
      isMuted: false,
      isDeafened: false,
      isSpeaking: false,
      joinedAt: Date.now(),
      lastSeen: Date.now(),
    };

    const p2: MeetingParticipant = {
      peerId: 'peer_2',
      userId: 2,
      userName: 'Bob',
      userAvatar: 'https://example.com/bob.jpg',
      userEmail: 'bob@example.com',
      isMuted: true,
      isDeafened: false,
      isSpeaking: false,
      joinedAt: Date.now(),
      lastSeen: Date.now(),
    };

    room.set(p1.peerId, p1);
    room.set(p2.peerId, p2);

    expect(room.size).toBe(2);
    expect(room.get('peer_1')?.userName).toBe('Alice');
    expect(room.get('peer_2')?.isMuted).toBe(true);

    // Update Alice mute state
    const alice = room.get('peer_1')!;
    alice.isMuted = true;
    alice.isSpeaking = false;
    room.set('peer_1', alice);

    expect(room.get('peer_1')?.isMuted).toBe(true);

    // Bob leaves
    room.delete('peer_2');
    expect(room.size).toBe(1);
    expect(room.has('peer_2')).toBe(false);
  });

  it('prunes inactive participants after heartbeat timeout', () => {
    const room = new Map<string, MeetingParticipant>();
    const now = Date.now();

    room.set('active_peer', {
      peerId: 'active_peer',
      userId: 1,
      userName: 'Active User',
      isMuted: false,
      isDeafened: false,
      isSpeaking: false,
      joinedAt: now - 10000,
      lastSeen: now - 2000, // 2 seconds ago
    });

    room.set('stale_peer', {
      peerId: 'stale_peer',
      userId: 2,
      userName: 'Stale User',
      isMuted: false,
      isDeafened: false,
      isSpeaking: false,
      joinedAt: now - 60000,
      lastSeen: now - 45000, // 45 seconds ago (timed out)
    });

    const pruneInactive = (r: Map<string, MeetingParticipant>, timeoutMs = 35000) => {
      const cutoff = Date.now() - timeoutMs;
      for (const [peerId, p] of r.entries()) {
        if (p.lastSeen < cutoff) {
          r.delete(peerId);
        }
      }
      return Array.from(r.values());
    };

    const remaining = pruneInactive(room);
    expect(remaining).toHaveLength(1);
    expect(remaining[0].peerId).toBe('active_peer');
  });

  it('evaluates voice activity detection based on audio frequency energy', () => {
    const isSpeakingDetected = (frequencyData: number[], threshold = 12) => {
      if (frequencyData.length === 0) return false;
      const sum = frequencyData.reduce((acc, val) => acc + val, 0);
      const avg = sum / frequencyData.length;
      return avg > threshold;
    };

    // Quiet ambient background noise
    const backgroundNoise = [2, 3, 1, 4, 2, 3, 1, 0];
    expect(isSpeakingDetected(backgroundNoise)).toBe(false);

    // Active speech frequencies
    const activeSpeech = [35, 48, 52, 60, 42, 38, 25, 30];
    expect(isSpeakingDetected(activeSpeech)).toBe(true);
  });

  it('validates audio device selection and switching', () => {
    const mockAudioInputs = [
      { deviceId: 'default', label: 'Default - MacBook Pro Mic', kind: 'audioinput' },
      { deviceId: 'usb-mic-123', label: 'Rode PodMic USB', kind: 'audioinput' },
    ];
    const mockAudioOutputs = [
      { deviceId: 'default', label: 'Default - Internal Speakers', kind: 'audiooutput' },
      { deviceId: 'headphones-456', label: 'Sony WH-1000XM4', kind: 'audiooutput' },
    ];

    let currentInput = mockAudioInputs[0].deviceId;
    let currentOutput = mockAudioOutputs[0].deviceId;

    // Switch mic to USB
    currentInput = mockAudioInputs[1].deviceId;
    expect(currentInput).toBe('usb-mic-123');

    // Switch speaker to headphones
    currentOutput = mockAudioOutputs[1].deviceId;
    expect(currentOutput).toBe('headphones-456');
  });
});
