/**
 * Noise Suppression Mode Configuration
 *
 * Three-tier noise suppression for live meetings:
 * - Off:      No processing. Raw mic input, 0ms added latency.
 * - Standard: Browser-native WebRTC noiseSuppression constraint.
 *             Removes steady background noise (fans, hum). ~0ms added latency.
 * - High:     Krisp AI WASM filter via @livekit/krisp-noise-filter.
 *             Removes keyboard, pets, background voices. ~10-20ms added latency.
 *
 * Constraint: Never run two noise suppressors on the same audio path.
 * When mode is 'high', WebRTC noiseSuppression stays true (Krisp docs recommend this).
 * When mode is 'off', WebRTC noiseSuppression is also disabled.
 */

export type NoiseSuppressionMode = 'off' | 'standard' | 'high' | 'extreme';

export const NOISE_SUPPRESSION_MODES: readonly NoiseSuppressionMode[] = ['off', 'standard', 'high', 'extreme'] as const;

export const NOISE_SUPPRESSION_CONFIG: Record<
  NoiseSuppressionMode,
  {
    label: string;
    description: string;
    webrtcNoiseSuppression: boolean;
    useKrisp: boolean;
    useVoiceIsolation: boolean;
    addedLatency: string;
  }
> = {
  off: {
    label: 'Off',
    description: 'No noise processing. Raw microphone input.',
    webrtcNoiseSuppression: false,
    useKrisp: false,
    useVoiceIsolation: false,
    addedLatency: '0ms',
  },
  standard: {
    label: 'Standard',
    description: 'Browser-level filtering. Removes steady background noise like fans and hum.',
    webrtcNoiseSuppression: true,
    useKrisp: false,
    useVoiceIsolation: false,
    addedLatency: '~0ms',
  },
  high: {
    label: 'High Quality (AI)',
    description: 'Krisp AI noise filter. Removes keyboard typing, pets, background speech.',
    webrtcNoiseSuppression: true,
    useKrisp: true,
    useVoiceIsolation: false,
    addedLatency: '~10-20ms',
  },
  extreme: {
    label: 'Extreme (Voice Only)',
    description: 'Ultra AI + Neural Vocal Gate. Transmits ONLY pure human voice; 100% background cut.',
    webrtcNoiseSuppression: true,
    useKrisp: true,
    useVoiceIsolation: true,
    addedLatency: '~12ms',
  },
} as const;

/** Cycle to the next noise suppression mode (Off → Standard → High → Extreme → Off) */
export function nextNoiseSuppressionMode(current: NoiseSuppressionMode): NoiseSuppressionMode {
  const idx = NOISE_SUPPRESSION_MODES.indexOf(current);
  return NOISE_SUPPRESSION_MODES[(idx + 1) % NOISE_SUPPRESSION_MODES.length];
}
