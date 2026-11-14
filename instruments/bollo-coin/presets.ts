import type { CoinOptions } from './coin.ts';

export const PRESETS = {
  face: { motion: 'face', strike: 0.04, velocity: 0.9, hardness: 0.93, damping: 0.55, seed: 250 },
  edge: { motion: 'edge', strike: 0.98, velocity: 0.86, hardness: 0.96, damping: 0.32, seed: 251 },
  bounce: { motion: 'bounce', strike: 0.85, velocity: 0.86, restitution: 0.64, spin: 0.6, damping: 0.42, position: -0.15, seed: 252 },
  spin: { motion: 'spin', strike: 0.9, velocity: 0.88, spin: 0.95, motionSeconds: 2.75, damping: 0.5, seed: 253 },
  roll: { motion: 'roll', velocity: 0.82, hardness: 0.9, spin: 0.3, motionSeconds: 2.3, damping: 0.62, seed: 254 },
  tightFace: { motion: 'face', strike: 0.08, velocity: 0.85, damping: 0.8, hardness: 0.88, seed: 255 },
  rim: { motion: 'edge', strike: 0.96, velocity: 0.8, damping: 0.65, size: 0.96, seed: 256 },
  shortSpin: { motion: 'spin', velocity: 0.7, spin: 0.88, motionSeconds: 0.36, damping: 0.7, seed: 257 },
} as const satisfies Record<string, CoinOptions>;
