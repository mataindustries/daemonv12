/**
 * Rack rendering: every part as one continuous performance at the calibrated nominal level, then gain/pan, a shared
 * room (wet-only FDN from per-part sends) and the dry and musical-context mixes. The frame count is the engine's own
 * output length for the score (bars plus tail), so rack stems and bounced engine assets line up exactly.
 */
import { frozen } from './frozen.ts';
import { engineEndFrames } from './curves.ts';
import type { NormalizedPart, NormalizedScore } from './score.ts';

export type Stereo = [Float64Array, Float64Array];
export interface RenderedPart { part: NormalizedPart; audio: Stereo }
export interface Rendered { score: NormalizedScore; frames: number; parts: RenderedPart[] }
export interface Mixes { stems: Map<string, Stereo>; room: Stereo; dry: Stereo; context: Stereo }

export async function renderScore(score: NormalizedScore, log: (msg: string) => void = () => {}): Promise<Rendered> {
  const frames = engineEndFrames(score.endBeat, score.bpm, score.tailSeconds), parts: RenderedPart[] = [];
  for (const [partIndex, part] of score.parts.entries()) {
    const t0 = performance.now();
    const audio = await part.instrument.render(part.perf, { bpm: score.bpm, beatSeconds: score.beatSeconds, swing: score.swing, key: score.key, seed: score.seed, frames, partIndex });
    log(`${part.id.padEnd(16)} ${part.instrument.id.padEnd(32)} ${part.perf.notes.length} notes ${((performance.now() - t0) / 1000).toFixed(1)} s`);
    parts.push({ part, audio });
  }
  return { score, frames, parts };
}
/** Balance pan law used throughout the rack and the approved auditions. */
export const panGains = (pan: number): [number, number] => [Math.min(1, 1 - pan), Math.min(1, 1 + pan)];
export function placed(rp: RenderedPart, withGain = true): Stereo {
  const [gl, gr] = panGains(rp.part.pan), g = withGain ? Math.pow(10, rp.part.gainDb / 20) : 1;
  return [rp.audio[0].map(v => v * gl * g), rp.audio[1].map(v => v * gr * g)];
}
export async function mixdown(r: Rendered): Promise<Mixes> {
  const F = await frozen(), n = r.frames, s = r.score;
  const stems = new Map<string, Stereo>(), sendL = new Float64Array(n), sendR = new Float64Array(n);
  for (const rp of r.parts) {
    const st = placed(rp); stems.set(rp.part.id, st);
    for (let i = 0; i < n; i++) { sendL[i] = sendL[i]! + st[0][i]! * rp.part.room; sendR[i] = sendR[i]! + st[1][i]! * rp.part.room; }
  }
  const [wl, wr] = F.dsp.fdnReverb(sendL, sendR, { ...s.room, mod: 1.1, seed: s.seed }, 0);
  const room: Stereo = [wl.slice(0, n), wr.slice(0, n)];
  const master = Math.pow(10, s.masterGainDb / 20), dry: Stereo = [new Float64Array(n), new Float64Array(n)], context: Stereo = [new Float64Array(n), new Float64Array(n)];
  for (const rp of r.parts) {
    const st = stems.get(rp.part.id)!;
    for (let c = 0; c < 2; c++) for (let i = 0; i < n; i++) {
      const v = st[c]![i]! * master;
      if (!rp.part.context) dry[c]![i] = dry[c]![i]! + v;
      context[c]![i] = context[c]![i]! + v;
    }
  }
  for (let c = 0; c < 2; c++) for (let i = 0; i < n; i++) context[c]![i] = context[c]![i]! + room[c]![i]! * master;
  return { stems, room, dry, context };
}
export const peak = (chs: Float64Array[]) => { let p = 0; for (const c of chs) for (let i = 0; i < c.length; i++) { const a = Math.abs(c[i]!); if (a > p) p = a; } return p; };
