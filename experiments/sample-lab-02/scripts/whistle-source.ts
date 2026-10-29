/** SAMPLE LAB 02 / C — TIME FRACTURE: the one original recording.
 *
 * stairwell.wav  Someone in a tiled stairwell keeps time with their foot and finger snaps for a bar, then whistles an
 *                original two-bar tune in B minor at 75 BPM while still snapping and tapping. One stereo take: whistle,
 *                body percussion and the room arrive together, as they would on a phone held at the landing.
 *
 * The whistle is a breathy near-sine with portamento, scoops, delayed vibrato, fall-offs and tongue re-articulation dips
 * between legato notes; its breath noise is pitched (noise through a resonance that follows the whistle). Snaps are a
 * skin crack with a finger-cavity pop; foot taps are a floor thump and a sole slap. The stairwell is bright (hard tiles,
 * RT60 about 2 s) with a flutter echo between its parallel walls. Every note and hit time is exported (TAKE) so later
 * generations can name what they cut. Seeded, Node only. */
import { RATE, TAU, frames, rng, gaussian, noise, filter, bq, onePoleLow, onePoleHigh, resonator, mix, space, taper, hz, type Wave } from './dsp.ts';

export const TAKE_BPM = 75, BEAT = 60 / TAKE_BPM, PRE_ROLL = 0.3;
/** Tune: [midi, start beat, length beats, scoop cents (onset from below), vibrato cents, fall cents (end)]; beat 0 is
 * the downbeat after the one-bar count-in. */
export const TUNE: [number, number, number, number, number, number][] = [
  [90, 0.0, 0.7, -150, 0, 0],     // F#6, scooped
  [88, 0.75, 0.2, 0, 0, 0],       // E6
  [86, 1.0, 0.45, 0, 0, 0],       // D6
  [83, 1.5, 1.15, 0, 32, -80],    // B5, held, vibrato, falls away
  [81, 2.75, 0.2, 0, 0, 0],       // A5 pickup
  [83, 3.0, 0.45, 0, 0, 0],       // B5
  [86, 3.5, 0.45, 0, 0, 0],       // D6
  [90, 4.0, 0.45, 0, 0, 0],       // F#6
  [93, 4.5, 0.7, -200, 26, 0],    // A6, scooped up from F#
  [90, 5.25, 0.2, 0, 0, 0],       // F#6
  [88, 5.5, 1.3, 0, 36, -120],    // E6, held, vibrato, falls away
];
/** Body percussion in beats from the take's downbeat (count-in bar is beats -4..-1), with a lateness in ms. */
export const FOOT: [number, number][] = [[-4, 2], [-2, 5], [0, 3], [2, 6], [4, 1], [6, 4], [8, 3]];
export const SNAPS: [number, number][] = [[-3, 14], [-1, 19], [1, 17], [3, 22], [5, 15], [7, 24], [8.5, 11]];
export const beatTime = (beat: number) => PRE_ROLL + (beat + 4) * BEAT;   // seconds into stairwell.wav
export const TAKE_SECONDS = beatTime(9.5) + 0.9;

function whistle(rand: () => number, n: number): Wave {
  const g = gaussian(rand), freq = new Float64Array(n), amp = new Float64Array(n);
  const vibRate = 5.6;
  TUNE.forEach(([midi, start, len, scoop, vib, fall], k) => {
    const t0 = beatTime(start), t1 = t0 + len * BEAT, f = hz(midi), prev = TUNE[k - 1], legato = prev && Math.abs(beatTime(prev[1] + prev[2]) - t0) < 0.08 ? prev : null;
    for (let i = frames(t0 - 0.03); i < frames(t1 + 0.09) && i < n; i++) {
      const t = i / RATE, u = t - t0;
      // Pitch: glide from the previous note (legato) or scoop from below; vibrato after 150 ms; fall at the end.
      let cents = 0;
      if (legato && u < 0.045) cents = 1200 * Math.log2(hz(legato[0]) / f) * (1 - Math.max(0, u) / 0.045);
      else if (scoop && u < 0.07) cents = scoop * (1 - Math.max(0, u) / 0.07) ** 1.5;
      if (vib && u > 0.15) cents += vib * Math.min(1, (u - 0.15) / 0.25) * Math.sin(TAU * vibRate * (u - 0.15));
      if (fall && t > t1 - 0.14) cents += fall * Math.min(1, (t - (t1 - 0.14)) / 0.14) ** 2;
      // Amplitude: soft attack (or a tongue dip when tied to the previous note), slight decay, release.
      const att = legato ? 0.6 + 0.4 * Math.min(1, Math.abs(u) / 0.03) : u < 0 ? 0 : 0.5 - 0.5 * Math.cos(Math.PI * Math.min(1, u / 0.035));
      const rel = t < t1 ? 1 : Math.max(0, 1 - (t - t1) / 0.07);
      const a = att * rel * (0.9 + 0.1 * Math.exp(-u / 0.4)) * (fall && t > t1 - 0.14 ? 1 - 0.6 * (t - (t1 - 0.14)) / 0.14 : 1);
      if (a >= amp[i]!) { amp[i] = a; freq[i] = f * 2 ** (cents / 1200); }
    }
  });
  // Fill pitch through silences so the oscillator never jumps; drift the whole whistle a few cents, slowly.
  let last = hz(TUNE[0]![0]);
  for (let i = 0; i < n; i++) { if (freq[i]! > 0) last = freq[i]!; else freq[i] = last; }
  const tone = new Float64Array(n), breathDrive = new Float64Array(n);
  let p = 0;
  for (let i = 0; i < n; i++) {
    p += TAU * freq[i]! / RATE; if (p > TAU) p -= TAU;
    tone[i] = amp[i]! * (Math.sin(p) + 0.025 * Math.sin(2 * p + 0.3) + 0.006 * Math.sin(3 * p + 1.1));
    breathDrive[i] = g() * amp[i]!;
  }
  const pitched = resonator(breathDrive, i => freq[i]!, () => 140), hiss = filter(breathDrive, bq.highpass(1000), bq.lowpass(7000));
  const out = new Float64Array(n);
  for (let i = 0; i < n; i++) out[i] = tone[i]! + 0.12 * pitched[i]! + 0.03 * hiss[i]!;
  return out;
}

function snap(rand: () => number): Wave {
  const len = frames(0.12), crack = noise(len, rand);
  for (let i = 0; i < len; i++) { const t = i / RATE * 1000; crack[i]! *= Math.min(1, t / 0.15) * Math.exp(-t / 3.2); }
  const c = filter(crack, bq.highpass(900), bq.bandpass(2300, 0.7)), pop = resonator(crack, () => 1080 + 120 * rand(), () => 140);
  const thud = new Float64Array(len);
  for (let i = 0; i < len; i++) { const t = i / RATE; thud[i] = Math.sin(TAU * 280 * t) * Math.exp(-t / 0.012) * Math.min(1, t / 0.001); }
  const out = new Float64Array(len), pk = (x: Wave) => x.reduce((m, v) => Math.max(m, Math.abs(v)), 0);
  const kc = 1 / pk(c), kp = 0.4 / pk(pop);
  for (let i = 0; i < len; i++) out[i] = kc * c[i]! + kp * pop[i]! + 0.18 * thud[i]!;
  return out;
}
function foot(rand: () => number): Wave {
  const len = frames(0.4), out = new Float64Array(len), slap = onePoleLow(noise(len, rand), 1800);
  for (let i = 0; i < len; i++) {
    const t = i / RATE, att = Math.min(1, t / 0.004);
    out[i] = att * (Math.sin(TAU * 92 * t) * Math.exp(-t / 0.05) + 0.6 * Math.sin(TAU * 157 * t + 0.4) * Math.exp(-t / 0.032) + 0.35 * Math.sin(TAU * 243 * t + 1) * Math.exp(-t / 0.022))
      + 0.3 * slap[i]! * Math.exp(-t / 0.008) * Math.min(1, t / 0.0007);
  }
  return out;
}

export function stairwellTake(seed = 0x7173_0001) {
  const rand = rng(seed), n = frames(TAKE_SECONDS);
  const w = whistle(rand, n), body = new Float64Array(n), snapsOnly = new Float64Array(n);
  for (const [beat, ms] of FOOT) mix(body, foot(rand), frames(beatTime(beat) + ms / 1000), 0.62 * (0.92 + 0.16 * rand()));
  for (const [beat, ms] of SNAPS) mix(snapsOnly, snap(rand), frames(beatTime(beat) + ms / 1000), 0.5 * (0.9 + 0.2 * rand()));
  // Placement on the landing: whistler a little left, snapping hand right, foot in the middle.
  const dryL = new Float64Array(n), dryR = new Float64Array(n), toRoom = new Float64Array(n);
  for (let i = 0; i < n; i++) {
    dryL[i] = 0.42 * w[i]! + 0.55 * snapsOnly[i]! + body[i]!;
    dryR[i] = 0.34 * w[i]! + 0.8 * snapsOnly[i]! + body[i]!;
    toRoom[i] = 0.4 * w[i]! + 0.7 * snapsOnly[i]! + 0.7 * body[i]!;
  }
  const [rl, rr] = space(toRoom, {
    rt60: 2.0, size: 1.6, damping: 0.12, predelayMs: 3,
    early: [[3.1, 0.5, 0.3], [5.6, 0.3, 0.5], [8.9, 0.35, 0.22], [12.4, 0.22, 0.35], [17.2, 0.25, 0.2], [23.5, 0.15, 0.24]],
    flutter: { ms: 11.6, feedback: 0.45 },
  }, 0.1);
  const L = new Float64Array(n), R = new Float64Array(n);
  for (let i = 0; i < n; i++) { L[i] = dryL[i]! + 0.3 * rl[i]!; R[i] = dryR[i]! + 0.3 * rr[i]!; }
  const out: [Wave, Wave] = [onePoleHigh(L, 30), onePoleHigh(R, 30)];
  for (const c of out) taper(c, 64, frames(0.5));
  return { channels: out };
}
