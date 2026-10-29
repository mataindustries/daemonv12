/** SAMPLE LAB 02 / A — GHOST FREQUENCY: the source recordings.
 *
 * intercept.wav  A fictional shortwave numbers station, "received" off the air. After the dial is tuned into zero beat,
 *                the station keys up and plays its interval signal (six music-box notes: B4 D5 E5 G5 F#5 E5), then the
 *                announcer (voice.ts, a formant synthesizer) reads ECHO · ECHO · NINER · OVER in a monotone on B3. The
 *                announcement repeats. The station is reduced-carrier SSB, so a mistuned receiver does two things at once:
 *                it frequency-shifts the voice (every partial moves by the same number of hertz, so the harmonics stop
 *                lining up: metallic, hollow or "duck" voices) and it turns the pilot carrier into a whistle at the
 *                offset. The first message is in tune; during the second the receiver drifts to -82 Hz, -110 Hz and then
 *                up through zero to +262 Hz, offsets chosen so the whistle under each drifted word is a note (E2, A2,
 *                C4). Around the voice: transmitter key-up thumps, an interfering carrier on B5, fading with a moving
 *                multipath comb, AGC breathing, impulsive static, two lightning crashes, two squelch tails, and a last
 *                second through a narrow CW filter that makes the static ring as pitched pings. All of it plays through
 *                one console-radio speaker model.
 * hum.wav        The same receiver with the antenna unplugged: its 60 Hz ground-loop buzz, the bass of the sketch.
 *
 * Every event time is exported (INTERCEPT_REGIONS) so the sketch can name the chop it reads. Seeded, Node only. */
import { RATE, TAU, frames, rng, wander, noise, filter, bq, onePoleLow, onePoleHigh, resonator, frequencyShift, mix, peak, taper, hz, type Wave } from './dsp.ts';
import { speak, wordTimes, type Placed, type WordTiming } from './voice.ts';

export const ANNOUNCER_F0 = 246.94;  // B3: every in-tune syllable sits on this pitch
export const HUM_HZ = 60;
export const PING_HZ = 739.99;       // the CW filter's centre (F#5): the pitch the static rings at
export const INTERCEPT_SECONDS = 10.7;
export const MESSAGE = [{ word: 'ECHO', at: 0 }, { word: 'ECHO', at: 0.72 }, { word: 'NINER', at: 1.45 }, { word: 'OVER', at: 2.18 }] as const;
export const MESSAGE_STARTS = [2.5, 6.3];
/** The interval signal: [midi, start seconds]; the first four notes are the shape the sketch's echoes climb. */
export const INTERVAL: [number, number][] = [[71, 1.1], [74, 1.28], [76, 1.46], [79, 1.64], [78, 1.82], [76, 2.0]];
const KEY_UPS = [0.98, 6.08], SQUELCH = [5.26, 9.06], CRASHES = [5.6, 9.7], CW = [9.3, 10.4], PINGS = [9.36, 9.54, 9.92, 10.1];
const PLACED: Placed[] = MESSAGE_STARTS.flatMap(base => MESSAGE.map(w => ({ word: w.word, at: base + w.at })));

/** Receiver offset in Hz over time: tuning in from far above, zero beat until the second message, then the drift.
 * The drifted offsets are notes, so the pilot whistle under each drifted word is in key: E2, A2, then C4. */
const DRIFT: [number, number][] = [[0, 2600], [0.25, 1150], [0.55, 420], [0.82, 90], [0.95, 0], [6.2, 0], [6.35, -82.41], [6.85, -82.41],
  [7.0, -110], [7.62, -110], [7.92, 0], [8.25, 130.81], [8.42, 261.63], [10.7, 261.63]];
function curve(points: [number, number][], t: number): number {
  if (t <= points[0]![0]) return points[0]![1];
  for (let i = 1; i < points.length; i++) {
    const [t1, v1] = points[i]!, [t0, v0] = points[i - 1]!;
    if (t <= t1) { const w = (t - t0) / (t1 - t0), s = 0.5 - 0.5 * Math.cos(Math.PI * w); return v0 + (v1 - v0) * s; }
  }
  return points[points.length - 1]![1];
}
export const driftAt = (t: number) => curve(DRIFT, t);
const SECOND_MESSAGE = 6.2;  // before this the channel is calm; after it the fading deepens and the drift begins

function crashBurst(rand: () => number, seconds: number, rate: number, decay: number): Wave {
  const n = frames(seconds), x = new Float64Array(n);
  let t = 0;
  while (t < seconds) {
    t += -Math.log(1 - rand()) / rate;
    const i = frames(t); if (i >= n) break;
    const env = Math.min(1, t / 0.006) * Math.exp(-t / decay), a = env * (0.3 + 0.7 * rand() ** 3) * (rand() < 0.5 ? -1 : 1);
    for (let k = 0; k < 14 && i + k < n; k++) x[i + k]! += a * Math.sin(Math.PI * k / 14);
  }
  return x;
}
/** A music-box tine: a clamped-free bar (partials 1, 6.27, 17.55) plucked by a pin, with the box's wooden body. */
function musicBox(midi: number, rand: () => number, seconds = 1.2): Wave {
  const n = frames(seconds), f = hz(midi), x = new Float64Array(n), phase = [TAU * rand(), TAU * rand(), TAU * rand()];
  for (let i = 0; i < n; i++) {
    const t = i / RATE, att = Math.min(1, t / 0.0015);
    x[i] = att * (Math.exp(-t / 0.55) * Math.sin(TAU * f * t + phase[0]!) + 0.32 * Math.exp(-t / 0.06) * Math.sin(TAU * f * 6.267 * t + phase[1]!)
      + 0.12 * Math.exp(-t / 0.015) * Math.sin(TAU * f * 17.55 * t + phase[2]!) + 0.08 * Math.exp(-t / 0.03) * Math.sin(TAU * 310 * t));
  }
  return x;
}

export function intercept(seed = 0x6057_0a01) {
  const rand = rng(seed), n = frames(INTERCEPT_SECONDS);
  // 1. The studio: interval signal, then the announcement twice (each word is synthesized anew).
  const { voice } = speak(PLACED, INTERCEPT_SECONDS, { f0: ANNOUNCER_F0, seed: seed ^ 0x51 });
  const studio = Float64Array.from(voice), vp = peak(voice);
  for (const [midi, at] of INTERVAL) mix(studio, musicBox(midi, rand), frames(at), 0.55 * vp);
  // 2. Transmitter: SSB voice band, 300-2700 Hz (the pilot carrier is added at the receiver, below).
  const tx = filter(studio, bq.highpass(300), bq.highpass(300), bq.lowpass(2700), bq.lowpass(2700));
  const tp = peak(tx);
  for (let i = 0; i < n; i++) tx[i]! /= tp;
  // 3. Ionosphere: slow fading and a moving two-path comb, gentle at first, deep on the second message.
  const fade = wander(n, 0.45, rand), path = wander(n, 0.8, rand), sky = new Float64Array(n);
  for (let i = 0; i < n; i++) {
    const t = i / RATE, calm = t < SECOND_MESSAGE, depth = calm ? 0.12 : 0.42;
    const d = (1.3 + 0.9 * path[i]!) * RATE / 1000, j = i - d, j0 = Math.floor(j), f = j - j0;
    const delayed = j0 >= 1 ? tx[j0]! * (1 - f) + tx[j0 + 1]! * f : 0;
    sky[i] = (tx[i]! + (calm ? 0.18 : 0.5) * delayed) * (1 - depth + depth * (0.5 + 0.5 * fade[i]!));
  }
  // 4. Receiver mistuning: the product detector shifts the whole voice by the offset ...
  const shifted = frequencyShift(sky, i => driftAt(i / RATE));
  // ... and the pilot carrier beats against the BFO as a whistle at the offset (plus a second station, wavering on B5).
  const carrier = new Float64Array(n);
  let pc = 0, po = 0;
  for (let i = 0; i < n; i++) {
    const t = i / RATE, df = driftAt(t);
    pc += TAU * df / RATE;
    const pilot = (t < 0.95 ? 0.42 : 0.12) * Math.min(1, Math.abs(df) / 60 + (t < 0.95 ? 0.25 : 0));
    const other = t > 6.6 && t < 9.05 ? 0.07 * Math.sin(0.5 * Math.PI * Math.min(1, (t - 6.6) / 0.3)) * Math.min(1, (9.05 - t) / 0.2) : 0;
    po += TAU * (987.77 * (1 + 0.004 * Math.sin(TAU * 0.7 * t))) / RATE;
    carrier[i] = pilot * Math.sin(pc) + other * Math.sin(po);
  }
  // 5. Atmospherics: band-limited hiss, impulsive crackle, two lightning crashes, and the clicks the CW filter will ring.
  const hiss = filter(noise(n, rand), bq.highpass(320), bq.lowpass(3000));
  const crackle = new Float64Array(n);
  for (let t = 0; t < INTERCEPT_SECONDS;) {
    t += -Math.log(1 - rand()) / 16;
    const i = frames(t); if (i >= n - 30) break;
    const a = 0.08 * (1 / (1 - 0.92 * rand())) * (rand() < 0.5 ? -1 : 1);
    for (let k = 0; k < 10; k++) crackle[i + k]! += a * Math.sin(Math.PI * k / 10);
  }
  for (const [k, at] of CRASHES.entries()) mix(crackle, crashBurst(rand, 0.42, 1600 + 500 * k, 0.075 + 0.02 * k), frames(at), 0.9);
  for (const at of PINGS) for (let k = 0; k < 10; k++) crackle[frames(at) + k]! += 0.9 * Math.sin(Math.PI * k / 10);
  // 6. IF filter and AGC: the receiver rides its gain, so the hiss swells in every gap ("breathing").
  const sum = new Float64Array(n);
  for (let i = 0; i < n; i++) sum[i] = shifted[i]! + carrier[i]! + 0.035 * hiss[i]! + crackle[i]!;
  const ifOut = filter(sum, bq.highpass(250), bq.lowpass(3100));
  const agc = new Float64Array(n);
  let env = 0.05;
  for (let i = 0; i < n; i++) {
    const a = Math.abs(ifOut[i]!);
    env = a > env ? env + (a - env) * 0.02 : env * 0.99993;
    agc[i] = ifOut[i]! * Math.min(9, 0.42 / Math.max(env, 0.045));
  }
  // 7. The narrow CW filter for the last second: impulses ring at PING_HZ instead of clicking.
  const cw = resonator(agc, () => PING_HZ, () => 28), cwOut = new Float64Array(n);
  for (let i = 0; i < n; i++) {
    const t = i / RATE, w = t < CW[0]! ? 0 : t < CW[0]! + 0.03 ? (t - CW[0]!) / 0.03 : t < CW[1]! ? 1 : Math.max(0, 1 - (t - CW[1]!) / 0.03);
    cwOut[i] = agc[i]! * (1 - w) + 0.28 * cw[i]! * w;
  }
  // 8. Audio stage: squelch tails (wide noise, cut dead) and key-up thumps (the speaker cone kicked by the AGC step).
  const audio = Float64Array.from(cwOut);
  for (const at of SQUELCH) {
    const len = frames(0.16), burst = filter(noise(len, rand), bq.highpass(500), bq.lowpass(6500));
    for (let i = 0; i < len; i++) burst[i]! *= Math.min(1, i / 40) * (1 - 0.35 * i / len) * (i > len - 44 ? (len - i) / 44 : 1);
    mix(audio, burst, frames(at), 0.9);
  }
  for (const at of KEY_UPS) {
    const len = frames(0.22), th = new Float64Array(len);
    let p = 0;
    for (let i = 0; i < len; i++) { const t = i / RATE, f = 78 + 40 * Math.exp(-t / 0.018); p += TAU * f / RATE; th[i] = Math.sin(p) * Math.exp(-t / 0.055) * Math.min(1, i / 30); }
    for (let i = 0; i < 26; i++) th[i]! += 0.6 * Math.sin(Math.PI * i / 26) * (1 - i / 26) * (i % 2 ? 1 : -1);
    mix(audio, th, frames(at), 1.1);
  }
  // 9. Hum leaking under everything, then the console speaker: cabinet bump, cone peak, roll-off, soft clipping.
  mix(audio, hum(INTERCEPT_SECONDS, seed ^ 0x77, false), 0, 0.012);
  const spk = filter(audio, bq.highpass(70), bq.peak(115, 1.1, 3), bq.peak(1350, 1.2, 3), bq.lowpass(4300));
  const out = new Float64Array(n);
  for (let i = 0; i < n; i++) out[i] = Math.tanh(1.3 * spk[i]!) / Math.tanh(1.3);
  taper(out, 64, 2205);
  return { wave: out };
}

/** Named chop regions in seconds (start of the event to just before the next one), from the word timings. */
function regions(times: WordTiming[]) {
  const r: Record<string, { start: number; end: number; driftHz: number }> = {};
  const add = (name: string, start: number, end: number) => { r[name] = { start: +start.toFixed(6), end: +end.toFixed(6), driftHz: Math.round(driftAt((start + end) / 2)) }; };
  times.forEach((w, k) => {
    const m = k < 4 ? 'a' : 'b', tag = `${m}.${w.word.toLowerCase()}${w.word === 'ECHO' ? (k % 4) + 1 : ''}`, s = w.segments;
    const end = s[s.length - 1]!.end + 0.06;
    add(tag, s[0]!.start - 0.004, end);
    if (w.word === 'ECHO') { add(`${tag}.e`, s[0]!.start - 0.004, s[1]!.start + 0.012); add(`${tag}.cho`, s[2]!.start - 0.004, end); }
    if (w.word === 'NINER') { add(`${tag}.ni`, s[0]!.start - 0.004, s[2]!.start + 0.02); add(`${tag}.ner`, s[2]!.start, end); }
    if (w.word === 'OVER') { add(`${tag}.o`, s[0]!.start - 0.004, s[1]!.start + 0.01); add(`${tag}.ver`, s[1]!.start - 0.004, end); }
  });
  add('sweep', 0.0, 0.96);
  INTERVAL.forEach(([, t], i) => add(`box${i + 1}`, t - 0.002, (INTERVAL[i + 1]?.[1] ?? t + 0.38) - 0.004));
  KEY_UPS.forEach((t, i) => add(`thump${i + 1}`, t - 0.002, t + 0.2));
  CRASHES.forEach((t, i) => add(`crash${i + 1}`, t - 0.002, t + 0.38));
  SQUELCH.forEach((t, i) => add(`squelch${i + 1}`, t - 0.002, t + 0.165));
  add('cw', CW[0]!, CW[1]!);
  PINGS.forEach((t, i) => add(`ping${i + 1}`, t - 0.002, t + 0.17));
  return r;
}
export const INTERCEPT_REGIONS = regions(wordTimes(PLACED));

/** Ground-loop buzz of the receiver: 60 Hz with a falling, slightly irregular harmonic series and a faint rectifier
 * edge at 120 Hz. `alone` adds a soft power-up and hand-off so it can be stored as its own recording. */
export function hum(seconds = 2.2, seed = 0x6057_0a02, alone = true): Wave {
  const n = frames(seconds), rand = rng(seed), x = new Float64Array(n), amps: number[] = [], phases: number[] = [];
  for (let k = 1; k <= 40; k++) { amps.push((k === 2 ? 1.25 : 1) / k ** 0.82 * (0.75 + 0.5 * rand())); phases.push(TAU * rand()); }
  const wob = wander(n, 0.3, rand);
  for (let i = 0; i < n; i++) {
    const t = i / RATE; let v = 0;
    for (let k = 1; k <= 40 && k * HUM_HZ < 9000; k++) v += amps[k - 1]! * Math.sin(TAU * k * HUM_HZ * t + phases[k - 1]!);
    const edge = 0.5 * Math.max(0, Math.sin(TAU * 2 * HUM_HZ * t)) ** 24;
    x[i] = (v * 0.32 + edge) * (1 + 0.025 * wob[i]!);
  }
  const y = onePoleHigh(onePoleLow(x, 5200), 25);
  if (alone) taper(y, frames(0.03), frames(0.3));
  return y;
}
