// Shared semantic effect contract. No renderer-specific syntax lives here.
export type Effect = { type: 'highpass' | 'lowpass'; frequencyHz: number }
  | { type: 'delay'; timeMs: number; wet: number }
  | { type: 'compressor'; thresholdDb: number; ratio: number; attackMs: number; releaseMs: number; makeupGainDb?: number }
  | { type: 'reverb'; roomSize: number; decaySeconds: number; wet: number }
  | { type: 'saturation'; driveDb: number; mix: number };
export const effectParameters = {
  highpass: { frequencyHz: [20, 20000] }, lowpass: { frequencyHz: [20, 20000] },
  delay: { timeMs: [1, 2000], wet: [0, 0.5] },
  compressor: { thresholdDb: [-60, 0], ratio: [1, 20], attackMs: [0.01, 2000], releaseMs: [0.01, 9000], makeupGainDb: [0, 12] },
  reverb: { roomSize: [0, 1], decaySeconds: [0.1, 10], wet: [0, 1] },
  saturation: { driveDb: [0, 24], mix: [0, 1] },
} as const;
export interface DuckingSettings { amountDb: number; thresholdDb: number; attackMs: number; releaseMs: number }
export function validateEffect(effect: Effect): void {
  if (!Object.hasOwn(effectParameters, effect.type)) throw new RangeError('Unknown effect.');
  for (const [key, range] of Object.entries(effectParameters[effect.type])) {
    const value = (effect as unknown as Record<string, unknown>)[key];
    if (key === 'makeupGainDb' && value === undefined) continue;
    if (typeof value !== 'number' || !Number.isFinite(value) || value < range[0] || value > range[1])
      throw new RangeError(`Invalid ${effect.type}.${key}.`);
  }
}
