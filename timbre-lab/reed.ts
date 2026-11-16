/**
 * BREATH REED · a blown reed on a bore (whisper -> feral).
 *
 * The rack has no self-oscillating instrument: its voice is additive, its bow is a pulse train into a bar. Here the
 * note is what happens when breath pressure meets a reed and a column of air:
 *
 *   breath p(t) --> reed (opens and closes with the pressure across it) --> bore (a delay line, a lossy open end) --+
 *                    ^------------------------------- reflected wave -------------------------------------------+
 *
 * Nothing is "played back". Below the threshold pressure there is only air through the tube; just above it the tone
 * speaks late and unsteadily; pushed, the reed beats shut and the sound hardens. One player per part (monophonic), so
 * breath, lip and tongue carry across notes: legato moves the pitch without a new attack, the throat can growl into the
 * mouthpiece, the tongue can flutter, a register vent can split the note into its octave, and the pitch leans on the
 * breath, drifts, scoops and falls. Rendered at 2x the rack rate and decimated. Deterministic: seeded only.
 */
import { RATE, curveAt, clamp } from '../studio-001/rack/curves.ts';
import type { ControlSpec, NoteEvent, PartPerformance, RenderContext } from '../studio-001/rack/types.ts';
import { LAB_VERSION, NOMINAL_RMS, controlAt, mulberry, num, rmsOf, spec, type LabInstrument } from './util.ts';

const OS = 2, SRO = RATE * OS, TAU = 2 * Math.PI, SIZE = 4096, MASK = SIZE - 1;
const hz = (midi: number) => 440 * Math.pow(2, (midi - 69) / 12);
/** Loop delay the model adds on top of its two delay lines, in oversampled frames (measured; see tests). */
const LOOP_EXTRA = 0;

const CONTROLS: ControlSpec[] = [
  spec('breath', 0, 1.5, 'breath scale (1 = what velocity and expression ask for; under about 0.15 only air; far above 1 the reed chokes); ride it for swells inside a note'),
  spec('bite', 0, 1, 'embouchure: loose and dark .. hard and bright (reed stiffness and bore brightness)'),
  spec('growl', 0, 1, 'throat growl sung into the mouthpiece'),
  spec('flutter', 0, 1, 'flutter-tongue depth'),
  spec('air', 0, 1, 'breath noise in and around the tone'),
  spec('overblow', 0, 1, 'register vent: 0 fundamental .. 1 broken into the upper octave, split tones on the way'),
  spec('vib', 0, 1.5, 'lip vibrato depth (arrives late in a held note)'),
  spec('drift', 0, 1, 'pitch instability: slow wander and breath-dependent pitch'),
  spec('bend', -7, 7, 'lip bend in semitones (continuous)'),
  spec('bore', 0, 1, 'what is heard: the hollow air column (0) .. the buzzing reed itself (1)'),
];
const BY_MACRO: Record<string, (m: number) => number> = {
  breath: m => 0.9 + 0.25 * m, bite: m => 0.22 + 0.6 * m, growl: m => Math.max(0, m - 0.45) * 1.1, flutter: () => 0, air: m => 0.5 - 0.3 * m,
  overblow: () => 0, vib: m => 0.6 - 0.25 * m, drift: m => 0.35 + 0.45 * m, bend: () => 0, bore: m => 0.15 + 0.45 * m,
};
const ARTICULATIONS: Record<string, string> = {
  tongued: 'the tongue releases the reed: a clear start',
  legato: 'no new attack: the pitch moves under continuing breath (slide in beats, default about 0.04 s)',
  breathy: 'subtone: slow, low pressure, mostly air until the note finds itself',
  accent: 'hard tongue and a pressure spike: the note barks, then settles',
  growl: 'throat growl for this note',
  flutter: 'flutter-tongue for this note',
  scoop: 'starts flat and bends up into the pitch (param bend, semitones, default 2)',
  fall: 'the pitch falls away as the breath lets go (param fall, semitones, default 5)',
  overblow: 'pushed until it breaks into the upper octave over the length of the note',
};

interface Plan { start: number; end: number; pitch: number; level: number; art: string; legato: boolean; glide: number; from: number; scoop: number; fall: number }
function simulate(perf: PartPerformance, ctx: RenderContext, notes: NoteEvent[], seed: number): [Float64Array, Float64Array] {
  const frames = ctx.frames, bs = ctx.beatSeconds, L = new Float64Array(frames), R = new Float64Array(frames), rnd = mulberry(seed);
  const lane: Record<string, (beat: number) => number> = {}; for (const c of CONTROLS) lane[c.name] = controlAt(perf, c, BY_MACRO[c.name]!);
  const expr = (b: number) => curveAt(perf.expression, b);
  const plan: Plan[] = notes.map((n, i) => {
    const prev = notes[i - 1], start = Math.round(n.beat * bs * RATE), art = n.articulation ?? 'tongued';
    const touching = prev !== undefined && (prev.beat + prev.beats) * bs * RATE >= start - 0.012 * RATE, legato = touching && (art === 'legato' || n.slide !== undefined);
    return { start, end: start + Math.max(1, Math.round(n.beats * bs * RATE)), pitch: n.pitch, level: clamp(n.velocity * (0.55 + 0.65 * expr(n.beat)), 0, 1), art, legato,
      glide: legato ? Math.max(0.005, n.slide !== undefined ? n.slide * bs : 0.04) : 0, from: prev?.pitch ?? n.pitch,
      scoop: art === 'scoop' || typeof n.params?.bend === 'number' ? num(n.params?.bend, 2) : 0, fall: art === 'fall' || typeof n.params?.fall === 'number' ? num(n.params?.fall, 5) : 0 };
  });
  const d0 = new Float64Array(SIZE); let wp = 0;
  const read = (buf: Float64Array, d: number): number => { const x = wp - d, i = Math.floor(x), f = x - i; return buf[i & MASK]! * (1 - f) + buf[(i + 1) & MASK]! * f; };
  let ni = -1, cur: Plan | undefined, p = 0, tongue = 1, chiff = 0, lp = 0, flPh = 0, g1 = rnd() * TAU, g2 = rnd() * TAU, vibPh = rnd() * TAU, slow = 0, slowTo = 0, drift = 0, driftTo = 0;
  let bn = 0, gn = 0, hl = 0, hr = 0, y1 = 0, dc = 0, pitchNow = notes[0]?.pitch ?? 60, since = 0, tone1 = 0, spike = 0, kick = 0;
  // control-rate values (refreshed every 32 frames)
  let cBreath = 1, cBite = 0.3, cGrowl = 0, cFlut = 0, cAir = 0.4, cOver = 0, cVib = 0.5, cDrift = 0.4, cBend = 0, cBore = 0.25;
  const first = plan[0]?.start ?? frames;
  for (let i = Math.max(0, first - 64); i < frames; i++) {
    while (ni + 1 < plan.length && i >= plan[ni + 1]!.start) {
      cur = plan[++ni]!; since = 0;
      if (!cur.legato) { tongue = cur.art === 'breathy' ? 1 : 0; chiff = cur.art === 'breathy' ? 0.35 : cur.art === 'accent' ? 1 : 0.6; spike = cur.art === 'accent' ? 1 : 0; kick = cur.art === 'breathy' ? 0 : 1; }
    }
    if ((i & 31) === 0) {
      const beat = i / RATE / bs;
      cBreath = lane.breath!(beat); cBite = lane.bite!(beat); cGrowl = lane.growl!(beat); cFlut = lane.flutter!(beat); cAir = lane.air!(beat); cOver = lane.overblow!(beat);
      cVib = lane.vib!(beat); cDrift = lane.drift!(beat); cBend = lane.bend!(beat); cBore = lane.bore!(beat);
      if (rnd() < 32 / (0.11 * RATE)) slowTo = rnd() * 2 - 1;
      if (rnd() < 32 / (0.4 * RATE)) driftTo = rnd() * 2 - 1;
      slow += 0.03 * (slowTo - slow); drift += 0.012 * (driftTo - drift);
      if (!cur || (i >= cur.end && p < 1e-4 && ni + 1 >= plan.length)) { if (ni + 1 >= plan.length && Math.abs(y1) < 1e-7) break; }
    }
    const on = cur !== undefined && i < cur.end, art = cur?.art ?? 'tongued', x = cur ? clamp(since / Math.max(1, cur.end - cur.start), 0, 1) : 0;
    // ---- breath: pressure follows the note, the tongue, the throat
    let target = 0;
    if (on && cur) {
      target = Math.pow(cur.level, 0.9) * cBreath * (art === 'breathy' ? 0.45 : 1) * (1 + 0.4 * spike);
      if (art === 'overblow') target *= 1 + 0.3 * x;
      if (cur.fall > 0 && x > 0.55) target *= 1 - 0.75 * ((x - 0.55) / 0.45);
    }
    const tau = target > p ? (art === 'breathy' ? 0.1 : art === 'accent' ? 0.004 : cur?.legato ? 0.03 : 0.012) : (art === 'breathy' ? 0.08 : 0.035);
    p += (target - p) * (1 - Math.exp(-1 / (tau * RATE)));
    tongue += (1 - tongue) * 0.0032; chiff *= 0.9985; spike *= 0.9996; kick *= 0.9992; since++;
    const growl = clamp(cGrowl + (art === 'growl' ? 0.6 : 0), 0, 1), flut = clamp(cFlut + (art === 'flutter' ? 0.85 : 0), 0, 1);
    let pe = p * (0.12 + 0.88 * tongue);
    if (flut > 0) { flPh += TAU * 25.5 * (1 + 0.07 * slow) / RATE; const pulse = 0.5 - 0.5 * Math.cos(flPh); pe *= 1 - 0.9 * flut * pulse * pulse; }
    const w = rnd() * 2 - 1; bn += 0.45 * (w - bn);
    if (growl > 0) { g1 += TAU * (83 + 11 * slow) / RATE; g2 += TAU * (127 - 9 * slow) / RATE; gn += 0.02 * (w - gn); pe *= 1 + growl * 0.75 * (0.6 * Math.sin(g1) + 0.4 * Math.sin(g2 + 1.3 * Math.sin(g1)) + 6 * gn); }
    if (pe < 0) pe = 0;
    // drive (0 silent .. 1 full) -> mouth pressure inside the window where this reed speaks: under about 0.1 there is
    // only air, the top of the window is where the reed starts to choke; a harder blow also firms the embouchure
    const bite = clamp(cBite + 0.3 * (pe - 0.6), 0, 1), pMin = Math.max(0.45, 0.9 - 0.75 * bite), pMax = 1.24 - 0.33 * bite;
    const frac = pe < 0.15 ? -0.2 + 2.13 * pe : Math.min(0.97, 0.12 + 0.8 * (pe - 0.15) + 0.2 * kick);
    const lg = 0.22 + 0.62 * bite, slope = 0.22 + 0.3 * bite, offset = 0.72 - 0.14 * bite;
    const air = clamp(cAir * (art === 'breathy' ? 2.2 : 1), 0, 1.5), pb = (pMin + (pMax - pMin) * frac) * Math.min(1, pe / 0.04) * (1 + (0.05 + 0.55 * air + 0.7 * chiff) * bn);
    // ---- pitch: note, slide, scoop, fall, lip bend, vibrato, wander, and the breath leaning on it
    let target_p = cur?.pitch ?? pitchNow;
    if (cur && cur.glide > 0) { const gx = clamp(since / (cur.glide * RATE), 0, 1); target_p = cur.from + (cur.pitch - cur.from) * gx * gx * (3 - 2 * gx); }
    if (cur && cur.scoop !== 0) { const sx = clamp(since / (0.16 * RATE), 0, 1); target_p -= cur.scoop * (1 - sx) * (1 - sx); }
    if (cur && cur.fall > 0 && x > 0.55) { const fx = (x - 0.55) / 0.45; target_p -= cur.fall * fx * fx; }
    pitchNow = target_p;
    vibPh += TAU * (5.1 + 0.4 * slow) / RATE;
    const vibOn = clamp((since / RATE - 0.22) / 0.45, 0, 1);
    const cents = 26 * cVib * vibOn * Math.sin(vibPh) + cDrift * (16 * drift + 5 * slow - 20 * (pe - 0.6)) + 100 * cBend;
    const over = clamp(cOver + (art === 'overblow' ? clamp((x - 0.25) / 0.5, 0, 1) : 0), 0, 1);
    // a closed-open tube: the wave returns inverted after one trip, so the delay is half a period
    const filt = (1 - lg) / lg, D = Math.max(2, SRO / (2 * hz(pitchNow) * Math.pow(2, cents / 1200)) - LOOP_EXTRA - filt);
    const D3 = Math.max(2, (D + LOOP_EXTRA + filt) / 3 - LOOP_EXTRA - filt), refl = 0.97 - 0.05 * (1 - bite);
    let acc = 0, flow = 0;
    for (let o = 0; o < OS; o++) {
      let x0 = read(d0, D);
      if (over > 0) x0 = (1 - over) * x0 + over * read(d0, D3); // register vent: a second, shorter way round
      lp += lg * (x0 - lp);
      const back = -refl * lp, diff = back - pb;
      let r = offset - slope * diff; if (r > 1) r = 1; else if (r < -1) r = -1; // reed: wide open .. beating shut
      const into = pb + diff * r;
      d0[wp & MASK] = into; wp++;
      acc += into; flow += (1 - r) * (pb - back); // the wave sent down the tube; the puff let through the reed
    }
    // ---- radiation: the bell passes the top, the tube keeps the bottom; breath hiss leaks around the tone
    const y = ((1 - cBore) * acc + cBore * 3.2 * flow) / OS; dc += 0.002 * (y - dc);
    const tone = (y - dc) * (0.12 + Math.pow(Math.min(1.3, pe), 1.5)), bright = tone + (0.6 + 2.2 * Math.min(1.2, pe)) * (tone - tone1); tone1 = tone; y1 = tone;
    const wl = rnd() * 2 - 1, wr = rnd() * 2 - 1; hl += 0.5 * (wl - hl); hr += 0.5 * (wr - hr);
    const hiss = 0.05 * air * pe;
    L[i] = bright + hiss * (wl - hl); R[i] = bright + hiss * (wr - hr);
  }
  return [L, R];
}

let scale: number | undefined;
export const BREATH_REED: LabInstrument = {
  id: 'breath-reed', family: 'breath-reed', name: 'Breath Reed', version: `${LAB_VERSION}+timbre-lab`,
  macro: { id: 'whisper-feral', label: 'whisper → feral', from: 'whisper', to: 'feral' },
  description: 'A reed blown against a bore, simulated: breath pressure, not an envelope, decides whether the note is air, a soft unsteady tone or a hard bark. One player per part (monophonic): legato moves the pitch under continuing breath, the throat growls, the tongue flutters, the pitch scoops, falls, drifts and leans on the breath, and a register vent splits the note into its octave.',
  range: [45, 84], articulations: ARTICULATIONS, controls: CONTROLS,
  setup: [spec('seed', 0, 4294967295, 'random seed (breath noise, drift, growl)')],
  params: { bend: 'semitones the note starts below its pitch (scoop)', fall: 'semitones the pitch falls over the end of the note' }, suggestedGainDb: -6,
  async render(perf, ctx) {
    if (scale === undefined) { // calibrate once: A3 at macro 0, velocity 0.8 is -20 dBFS RMS while it sounds
      const note: NoteEvent[] = [{ beat: 0, beats: 2, pitch: 57, velocity: 0.8 }];
      const ref = simulate({ notes: note, macro: 0, controls: {}, offsets: {}, expression: 0.7, setup: {}, breaths: [], motion: [] }, { ...ctx, beatSeconds: 0.5, frames: RATE }, note, 1);
      scale = NOMINAL_RMS / rmsOf(ref[0], Math.round(0.3 * RATE), Math.round(0.9 * RATE));
    }
    const sorted = [...perf.notes].sort((a, b) => a.beat - b.beat || a.pitch - b.pitch);
    const [l, r] = simulate(perf, ctx, sorted, num(perf.setup.seed, ctx.seed + 101 * ctx.partIndex));
    for (let i = 0; i < l.length; i++) { l[i] = l[i]! * scale; r[i] = r[i]! * scale; }
    return [l, r];
  },
};
