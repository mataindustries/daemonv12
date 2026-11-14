/**
 * A-to-S mix pass: shared helpers. Gain curves, a stem cache for fast iteration, loudness matching and the QA
 * measurements. Nothing here synthesises sound or changes an approved source; it only rearranges buffers that the
 * existing instruments rendered, using the frozen filters and DAEMON//CRUSH through ../lib.ts.
 */
import { createHash } from 'node:crypto';
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { SR, type Stereo, silence, gainDb, lp, hp, loudness, writeAudio, ampDb, dbAmp, peak, rms, truePeak } from '../lib.ts';
import { bandBalance, transientStats, round } from '../../fable-lab/crush/measure.ts';

/**
 * Keyed transient shaper: at each onset the gain is `attackDb` for `holdMs`, then moves (raised cosine) to
 * `sustainDb` over `releaseMs`, and returns to 0 dB `recoverMs` later. Deterministic, independent of the audio:
 * the onsets come from the score's own event frames. Overlapping onsets restart the curve.
 */
export function shape(x: Stereo, onsets: number[], o: { attackDb: number; holdMs: number; releaseMs: number; sustainDb?: number; recoverMs?: number }): Stereo {
  const n = x[0].length, g = new Float64Array(n).fill(0), sustain = o.sustainDb ?? 0;
  const hold = Math.round(o.holdMs * SR / 1000), rel = Math.max(1, Math.round(o.releaseMs * SR / 1000)), rec = Math.round((o.recoverMs ?? 0) * SR / 1000);
  const sorted = [...onsets].sort((a, b) => a - b);
  for (let k = 0; k < sorted.length; k++) {
    const at = sorted[k]!, stop = Math.min(n, k + 1 < sorted.length ? sorted[k + 1]! : n);
    for (let i = Math.max(0, at); i < stop; i++) {
      const t = i - at; let d: number;
      if (t < hold) d = o.attackDb;
      else if (t < hold + rel) { const u = (t - hold) / rel; d = o.attackDb + (sustain - o.attackDb) * 0.5 * (1 - Math.cos(Math.PI * u)); }
      else if (rec > 0 && t < hold + rel + rec) { const u = (t - hold - rel) / rec; d = sustain * 0.5 * (1 + Math.cos(Math.PI * u)); }
      else d = rec > 0 ? 0 : sustain;
      g[i] = d;
    }
  }
  return x.map(ch => ch.map((v, i) => v * dbAmp(g[i]!))) as Stereo;
}
/** Short multi-tap copy (no feedback): each tap is [ms, dB, pan -1..1]. A mix effect, not a new part. */
export function taps(x: Stereo, list: [number, number, number][]): Stereo {
  const n = x[0].length, y = silence(n), m = x[0].map((v, i) => 0.5 * (v + x[1][i]!));
  for (const [ms, db, pan] of list) {
    const d = Math.round(ms * SR / 1000), g = dbAmp(db), gl = Math.cos((pan + 1) * Math.PI / 4) * Math.SQRT2, gr = Math.sin((pan + 1) * Math.PI / 4) * Math.SQRT2;
    for (let i = d; i < n; i++) { y[0][i] = y[0][i]! + m[i - d]! * g * gl; y[1][i] = y[1][i]! + m[i - d]! * g * gr; }
  }
  return y;
}
/** Band-pass as a high-pass into a low-pass (Butterworth, the frozen biquads). */
export const band = (x: Stereo, lo: number, hi: number, steep = false) => lp(hp(x, lo, steep), hi, steep);

/** Rendered stems cached in the scratch directory named by SOUNDLAB_CACHE (iteration only; delivery renders fresh). */
export async function cachedStems(key: unknown, render: () => Promise<{ stems: Map<string, Stereo>; manifest: unknown }>) {
  const dir = process.env.SOUNDLAB_CACHE; if (!dir) return render();
  const id = createHash('sha256').update(JSON.stringify(key)).digest('hex').slice(0, 16), base = join(dir, id);
  if (existsSync(join(base, 'manifest.json'))) {
    const manifest = JSON.parse(readFileSync(join(base, 'manifest.json'), 'utf8')) as { __stems: string[] };
    const stems = new Map<string, Stereo>();
    for (const s of manifest.__stems) { const b = readFileSync(join(base, `${s}.f64`)); const all = new Float64Array(b.buffer, b.byteOffset, b.byteLength / 8); const h = all.length / 2; stems.set(s, [all.slice(0, h), all.slice(h)]); }
    return { stems, manifest };
  }
  const r = await render(); mkdirSync(base, { recursive: true });
  for (const [s, st] of r.stems) { const all = new Float64Array(st[0].length * 2); all.set(st[0]); all.set(st[1], st[0].length); writeFileSync(join(base, `${s}.f64`), Buffer.from(all.buffer)); }
  writeFileSync(join(base, 'manifest.json'), JSON.stringify({ ...(r.manifest as object), __stems: [...r.stems.keys()] }));
  return r;
}

export const floatSha = (x: Stereo) => createHash('sha256').update(Buffer.from(x[0].buffer)).update(Buffer.from(x[1].buffer)).digest('hex');
export const delayed = (x: Stereo, lead: number): Stereo => x.map(ch => { const y = new Float64Array(lead + ch.length); y.set(ch, lead); return y; }) as Stereo;
/** Back-to-back with `gap` frames of silence between items. */
export function chain(items: Stereo[], gap: number): Stereo {
  const n = items.reduce((a, x) => a + x[0].length, 0) + gap * (items.length - 1), y = silence(n); let at = 0;
  for (const x of items) { y[0].set(x[0], at); y[1].set(x[1], at); at += x[0].length + gap; }
  return y;
}

/** Integrated loudness of a buffer (writes a temporary PCM24 WAV and asks FFmpeg ebur128). */
export function lufsOf(x: Stereo, scratch: string): number {
  mkdirSync(scratch, { recursive: true }); const p = join(scratch, `lufs-${process.pid}.wav`);
  writeAudio(p, x, false); return loudness(p).lufs;
}
/**
 * Gain-match a set of masters to one integrated loudness. The target is the quietest member, rounded down to a
 * tenth: matching only ever turns a file DOWN, so no file needs a limiter to reach it and every true peak stays
 * at or under its original -1 dBTP. Repeats once to land within 0.05 LU of the target (ebur128 is not linear in
 * gain only at the gating edges).
 */
export function matchLoudness(set: Record<string, Stereo>, scratch: string): { target: number; gains: Record<string, number>; out: Record<string, Stereo> } {
  const measured = Object.fromEntries(Object.entries(set).map(([k, x]) => [k, lufsOf(x, scratch)]));
  const target = Math.floor(Math.min(...Object.values(measured)) * 10) / 10;
  const gains: Record<string, number> = {}, out: Record<string, Stereo> = {};
  for (const [k, x] of Object.entries(set)) {
    let g = target - measured[k]!, y = gainDb(x, g);
    const again = lufsOf(y, scratch); if (Math.abs(again - target) > 0.05) { g += target - again; y = gainDb(x, g); }
    gains[k] = round(g, 3); out[k] = y;
  }
  return { target, gains, out };
}

/**
 * Punch, as energy rather than a single sample: RMS of the first 10 ms after each onset against RMS 20-150 ms
 * (the body), and the same for the band under 150 Hz alone (the kick's thump against the 808 that follows it).
 */
export function punch(x: Stereo, onsets: number[]) {
  const a = Math.round(0.010 * SR), b0 = Math.round(0.02 * SR), b1 = Math.round(0.15 * SR), low = lp(x, 150, true);
  let full = 0, lo = 0, c = 0;
  for (const o of onsets) { if (o + b1 > x[0].length) continue; full += ampDb(rms(x, o, o + a)) - ampDb(rms(x, o + b0, o + b1)); lo += ampDb(rms(low, o, o + a)) - ampDb(rms(low, o + b0, o + b1)); c++; }
  return { frontRmsToBodyDb: round(full / Math.max(1, c)), lowFrontToBodyDb: round(lo / Math.max(1, c)) };
}
/** Mono compatibility: L/R correlation (full band and under 150 Hz) and the loudness change when folded to mono. */
export function monoCheck(x: Stereo, scratch: string) {
  const corr = (y: Stereo) => { let lr = 0, ll = 0, rr = 0; for (let i = 0; i < y[0].length; i++) { lr += y[0][i]! * y[1][i]!; ll += y[0][i]! ** 2; rr += y[1][i]! ** 2; } return round(lr / Math.sqrt(ll * rr || 1), 3); };
  const m = x[0].map((v, i) => 0.5 * (v + x[1][i]!));
  return { correlation: corr(x), correlationUnder150: corr(lp(x, 150, true)), monoFoldLufsDeltaDb: round(lufsOf([m, m.slice()], scratch) - lufsOf(x, scratch), 2) };
}
/** The QA block: loudness, true peak, clipping, band balance, harshness, transients and the loop seam. */
export function qa(x: Stereo, file: string, o: { onsets?: number[]; loopFrames?: number } = {}) {
  const l = loudness(file), s = bandBalance(x);
  let full = 0; for (const c of x) for (const v of c) if (Math.abs(v) >= 1) full++;
  // Harshness: energy 2-5 kHz against 500 Hz-2 kHz (the ear's most sensitive band against the body under it).
  const harsh = ampDb(rms(band(x, 2000, 5000, true))) - ampDb(rms(band(x, 500, 2000, true)));
  const lowShare = ampDb(rms(lp(x, 150, true))) - ampDb(rms(x));
  // Loop seam: the step across the loop point against the typical sample-to-sample step around it.
  let seam: undefined | { stepDb: number; localMedianStepDb: number } = undefined;
  if (o.loopFrames && o.loopFrames < x[0].length) {
    const L = o.loopFrames, steps: number[] = []; for (let i = L - 441; i < L + 441; i++) if (i !== L) steps.push(Math.abs(x[0][i]! - x[0][i - 1]!));
    steps.sort((a, b) => a - b); seam = { stepDb: round(ampDb(Math.abs(x[0][L]! - x[0][L - 1]!)), 1), localMedianStepDb: round(ampDb(steps[steps.length >> 1]!), 1) };
  }
  return { seconds: round(x[0].length / SR, 3), integratedLufs: l.lufs, lra: l.lra, truePeakDbtp: l.truePeakDb, samplePeakDbfs: round(ampDb(peak(x))),
    samplesAtFullScale: full, crestDb: round(ampDb(peak(x)) - ampDb(rms(x))), psrDb: round(ampDb(truePeak(x)) - ampDb(rms(x))), lowUnder150Db: round(lowShare), harsh2to5vs05to2Db: round(harsh),
    bandBalanceDb: s, ...(o.onsets ? { kick: { ...transientStats(x, o.onsets), ...punch(x, o.onsets) } } : {}), ...(seam ? { loopSeam: seam } : {}) };
}
export { round };
