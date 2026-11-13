/**
 * Rack adapters: each maps the common performance interface (types.ts) onto one frozen, owner-approved engine.
 * Every instrument is calibrated so that a reference note at macro 0, velocity 0.8 has -20 dBFS RMS: part gains
 * then mean the same thing across families. Adapters never change the engines' sound; they only translate time,
 * pitch, articulation, expression and control curves.
 */
import { frozen, type BassNote, type MotionSegment, type VoiceNote, type Wave } from './frozen.ts';
import { RATE, curveAt, laneOf, clamp, smooth, haloPitches } from './curves.ts';
import type { ControlSpec, Curve, NoteEvent, PartPerformance, RackInstrument, RenderContext } from './types.ts';

const ADAPTER = '1.0.0';
const NOMINAL_RMS = 0.1; // -20 dBFS
const rms = (w: Wave, a: number, b: number) => { let s = 0; const e = Math.min(b, w.length); for (let i = a; i < e; i++) s += w[i]! * w[i]!; return Math.sqrt(s / Math.max(1, e - a)); };
const scaleCache = new Map<string, number>();
async function calibrated(id: string, ref: () => Promise<Wave>, from: number, to: number): Promise<number> {
  let k = scaleCache.get(id);
  if (k === undefined) { k = NOMINAL_RMS / rms(await ref(), Math.round(from * RATE), Math.round(to * RATE)); scaleCache.set(id, k); }
  return k;
}
const blank = (frames: number): [Float64Array, Float64Array] => [new Float64Array(frames), new Float64Array(frames)];
function addAt(dst: Float64Array, src: Wave, offset: number, gain: number) {
  for (let i = 0; i < src.length; i++) { const j = i + offset; if (j >= 0 && j < dst.length) dst[j] = dst[j]! + src[i]! * gain; }
}
const num = (v: unknown, d: number) => (typeof v === 'number' && Number.isFinite(v) ? v : d);
const str = (v: unknown, d: string) => (typeof v === 'string' ? v : d);
const ctl = (perf: PartPerformance, name: string): Curve | undefined => perf.controls[name];
/** Absolute control lane: explicit curve, else the macro mapping plus an optional offset. */
/** Absolute control lane (explicit curve, else macro mapping + offset), always clamped to the control's safe range. */
function controlLane(perf: PartPerformance, ctx: RenderContext, c: ControlSpec, macroMap: (m: number) => Record<string, number>): ((t: number) => number) | undefined {
  const abs = perf.controls[c.name], off = perf.offsets[c.name];
  if (abs !== undefined) { const l = laneOf(abs, ctx.beatSeconds); return (t: number) => clamp(l(t), c.min, c.max); }
  if (off === undefined) return undefined;
  const morph = laneOf(perf.macro, ctx.beatSeconds), o = laneOf(off, ctx.beatSeconds);
  return (t: number) => clamp((macroMap(clamp(morph(t), 0, 1))[c.name] ?? 0) + o(t), c.min, c.max);
}
const spec = (name: string, min: number, max: number, description: string): ControlSpec => ({ name, min, max, description });

// ============================================================ LIVING BASS (warm -> machine)
// Ranges are the envelope the approved warm -> machine macro spans. Measured: past hold 0.84 or bright 1 (with motion)
// the engine's vactrol release time constant turns negative and the gate diverges, so the rack never goes there.
const BASS_CONTROLS = [
  spec('fold', 0, 1, 'sine-folder gain: harmonic richness'), spec('pm', 0, 1.5, '1:1 phase modulation: saw-like edge'),
  spec('grind', 0, 1.15, '1:2 phase modulation: sub-octave grind'), spec('gear', 0, 0.7, 'phase-locked sub-octave chopper depth'),
  spec('drive', 0, 1, 'asymmetric tube drive'), spec('bright', 0, 1, 'low-pass-gate opening range'),
  spec('hold', 0, 0.84, 'gate opening while a note is held'), spec('chassis', 0, 1, 'metal chassis strikes and ratchet clicks'),
  spec('ratchet', 0, 1, 'slides step through semitones'), spec('servo', 0, 1, '0 damped finger slide .. 1 overshooting servo'),
  spec('motion', 0, 1, 'depth of the tempo-synced modulation'), spec('harm', 0, 1, 'octave/fifth harmonic selector'),
  spec('body', 0, 1, 'harmonic body over the constant sub'),
];
const MOTION_PRESETS: Record<string, Omit<MotionSegment, 'from' | 'to'>> = {
  none: { div: 2, pattern: [1], shape: 'hold' },
  breath: { div: 1, pattern: [1, 0.5], tau: 0.6 },
  eighths: { div: 2, pattern: [1, 0.35], tau: 0.5 },
  sixteenths: { div: 4, pattern: [1, 0.15, 0.55, 0.25, 0.85, 0.1, 0.45, 0.9, 1, 0.2, 0.6, 0.15, 0.8, 0.35, 0.5, 0.7], tau: 0.4 },
  triplets: { div: 6, pattern: [1, 0.3, 0.55], tau: 0.45 },
  revving: { div: 6, pattern: [1, 0.6, 0.8], shape: 'ramp' },
  'thirty-seconds': { div: 8, pattern: [1, 0.5], tau: 0.5 },
  growl: { div: 16, pattern: [1, 0.6], tau: 0.6 },
};
const BASS_ART: Record<string, 'normal' | 'ghost' | 'accent' | 'stacc'> = { normal: 'normal', accent: 'accent', ghost: 'ghost', staccato: 'stacc', legato: 'normal' };
const BASS_GATE: Record<string, number> = { normal: 0.9, accent: 0.9, ghost: 0.5, staccato: 0.45, legato: 1 };
/** Articulations scale the composer's velocity (the approved audition derived velocity from articulation: ghost 0.5, accent 1). */
const BASS_VEL: Record<string, number> = { ghost: 0.6, accent: 1.15 };
const livingBass: RackInstrument = {
  id: 'living-bass', family: 'living-bass', name: 'Living Bass', version: `${ADAPTER}+mutation-001-A`,
  macro: { id: 'warm-machine', label: 'warm → machine', from: 'warm', to: 'machine' },
  description: 'West Coast low-pass-gated complex oscillator over a phase-locked sine sub that turns, continuously and in tempo, into a folded, geared, driven machine with ratcheting servo slides and metal chassis strikes.',
  range: [24, 60],
  articulations: {
    normal: 'plucked through the low-pass gate (gate 90 %)', accent: 'harder strike (velocity x1.15), chassis hit at the machine end', ghost: 'soft (velocity x0.6), short (50 %)',
    staccato: 'short (45 %)', legato: 'no re-strike; travels from the previous pitch (slide, default 0.06 s)',
  },
  controls: BASS_CONTROLS,
  setup: [spec('seed', 0, 4294967295, 'random seed for drift and chassis noise')],
  params: { scoop: 'semitones to rise from on a fresh strike', dive: 'semitones to dive at the end of the note', diveBeats: 'length of the dive in beats' },
  suggestedGainDb: -3,
  async render(perf, ctx) {
    const F = await frozen(), bs = ctx.beatSeconds;
    const scale = await calibrated('living-bass', async () => F.bass.livingBass([{ t: 0, d: 0.5, p: 36, v: 0.8, art: 'normal' }], { morph: () => 0, seed: 1, tail: 0.3 }), 0, 0.5);
    const expr = laneOf(perf.expression, bs), morph = laneOf(perf.macro, bs);
    const sorted = [...perf.notes].sort((a, b) => a.beat - b.beat);
    const notes: BassNote[] = sorted.map(n => {
      const a = n.articulation ?? 'normal', e = expr(n.beat * bs);
      const bn: BassNote = { t: n.beat * bs, d: n.beats * bs * (BASS_GATE[a] ?? 0.9), p: n.pitch, v: clamp(n.velocity * (BASS_VEL[a] ?? 1) * (0.55 + 0.65 * e), 0, 1), art: BASS_ART[a] ?? 'normal' };
      if (n.slide !== undefined || a === 'legato') bn.slide = n.slide !== undefined ? n.slide * bs : 0.06;
      if (n.params?.scoop !== undefined) bn.scoop = num(n.params.scoop, 0);
      if (n.params?.dive !== undefined) { bn.dive = num(n.params.dive, 0); bn.diveSec = num(n.params.diveBeats, 0.5) * bs; }
      return bn;
    });
    for (let i = 1; i < notes.length; i++) if (notes[i]!.slide !== undefined) notes[i - 1]!.d = Math.max(notes[i - 1]!.d, notes[i]!.t - notes[i - 1]!.t + 0.02);
    const over: Record<string, (t: number) => number> = {};
    for (const c of BASS_CONTROLS) { const l = controlLane(perf, ctx, c, F.bass.bassMacro); if (l) over[c.name] = l; }
    const holdBase = over.hold ?? ((t: number) => F.bass.bassMacro(clamp(morph(t), 0, 1)).hold ?? 0.42);
    over.hold = (t: number) => clamp(holdBase(t) * (0.75 + 0.36 * expr(t)), 0, 0.84);
    const g = { bpm: ctx.bpm, swing: ctx.swing, beat: bs, bar: 4 * bs, s16: bs / 4 };
    const spans = perf.motion.length ? perf.motion : [{ fromBeat: 0, toBeat: 1e6, preset: 'sixteenths' as const }];
    const segs: MotionSegment[] = spans.map(s => ({ ...(MOTION_PRESETS[s.preset ?? ''] ?? { div: s.div ?? 4, pattern: s.pattern ?? [1], shape: s.shape, tau: s.tau }), from: s.fromBeat / 4, to: s.toBeat / 4 }));
    const out = blank(ctx.frames);
    if (!notes.length) return out;
    const w = F.bass.livingBass(notes, { morph, motion: F.score.motionLane(g, segs), over, seed: num(perf.setup.seed, ctx.seed + 101 * ctx.partIndex), tail: 0.6 });
    addAt(out[0], w, 0, scale); addAt(out[1], w, 0, scale);
    return out;
  },
};

// ============================================================ IMPOSSIBLE VOICE (human -> impossible)
const VOICE_CONTROLS = [
  spec('breath', 0, 1, 'pitch-synchronous aspiration'), spec('tilt', 0, 1, 'source tilt: soft .. bright'), spec('size', -1, 1, 'tract scale (formants)'),
  spec('split', 0, 0.3, 'each formant divides into two peaks'), spec('stretch', 0, 0.05, 'harmonic n at n^(1+stretch): the series bends into a bell'),
  spec('under', 0, 1, 'undertone series under the voice'), spec('whistle', 0, 1, 'overtone-singing melody (overtone lane)'),
  spec('glass', 0, 1, 'send to the sympathetic glass halo'), spec('shimmer', 0, 1, 'vibrato migrates into the spectrum'),
  spec('even', 0, 1, 'even harmonics (1 = normal, 0 = hollow)'), spec('disperse', 0, 1, 'harmonics drift apart, high ones linger'),
  spec('vib', 0, 1.5, 'vibrato depth scale'),
];
export const VOWELS = ['mm', 'oo', 'oh', 'aw', 'ah', 'uh', 'eh', 'ee'];
const impossibleVoice: RackInstrument = {
  id: 'impossible-voice', family: 'impossible-voice', name: 'Impossible Voice', version: `${ADAPTER}+mutation-001-B`,
  macro: { id: 'human-impossible', label: 'human → impossible', from: 'human', to: 'impossible' },
  description: 'Additive source-filter voice (no words, no language, no real singer): vowels drift, breath and cries, then bent harmonic series, split formants, undertones, an overtone melody, spectral shimmer and a sympathetic glass halo tuned to the key.',
  range: [43, 84],
  articulations: {
    sung: 'fresh onset with a small scoop', legato: 'glides from the previous note (slide in beats, default about 0.06 s)', detached: 'shorter (80 %)',
    cry: 'upward voice-break flip at the onset (param cry, semitones, default 1)', fall: 'sighing fall at the end (param fall, semitones, default 0.8)', hum: 'closed-mouth "mm" unless a vowel is given',
  },
  controls: VOICE_CONTROLS,
  setup: [spec('size', -1, 1, 'fixed tract scale (giant .. small)'), spec('detune', -50, 50, 'cents'), spec('vibRate', 3, 8, 'Hz'),
    spec('vibCents', 0, 60, 'vibrato depth'), spec('vowelTau', 0.03, 0.6, 'vowel glide time constant (s)'), spec('seed', 0, 4294967295, 'random seed'),
    spec('haloDecay', 0.2, 3, 'glass resonator decay (s)'), spec('haloGain', 0, 3, 'halo level scale')],
  params: { vowel: `one of ${VOWELS.join(', ')}`, to: 'vowel reached by the end of the note', scoop: 'semitones', cry: 'semitones', fall: 'semitones' },
  suggestedGainDb: 0,
  async render(perf, ctx) {
    const F = await frozen(), bs = ctx.beatSeconds;
    const scale = await calibrated('impossible-voice', async () => F.voice.impossibleVoice([{ t: 0, d: 1, p: 69, v: 0.8, vowel: 'oh' }], { morph: () => 0, seed: 1, tail: 0.3 }).dry, 0.1, 1);
    const expr = laneOf(perf.expression, bs), morph = laneOf(perf.macro, bs);
    const notes: VoiceNote[] = [...perf.notes].sort((a, b) => a.beat - b.beat).map((n: NoteEvent) => {
      const a = n.articulation ?? 'sung', p = n.params ?? {};
      const vn: VoiceNote = { t: n.beat * bs, d: a === 'detached' ? n.beats * bs * 0.8 : n.beats * bs - 0.02, p: n.pitch, v: clamp(n.velocity, 0, 1),
        vowel: str(p.vowel, a === 'hum' ? 'mm' : 'oh') };
      if (typeof p.to === 'string') vn.to = p.to;
      if (n.slide !== undefined) vn.slide = n.slide * bs;
      if (p.scoop !== undefined) vn.scoop = num(p.scoop, 0.45);
      if (p.cry !== undefined || a === 'cry') vn.cry = num(p.cry, 1);
      if (p.fall !== undefined || a === 'fall') vn.fall = num(p.fall, 0.8);
      return vn;
    });
    const out = blank(ctx.frames);
    if (!notes.length) return out;
    const over: Record<string, (t: number) => number> = {};
    for (const c of VOICE_CONTROLS) { const l = controlLane(perf, ctx, c, F.voice.voiceMacro); if (l) over[c.name] = l; }
    const tiltBase = over.tilt ?? ((t: number) => F.voice.voiceMacro(clamp(morph(t), 0, 1)).tilt ?? 0.45);
    over.tilt = (t: number) => clamp(tiltBase(t) + 0.3 * (expr(t) - 0.7), 0, 1);
    const s = perf.setup, opts = {
      morph, over, breaths: perf.breaths.map(b => ({ t: b.beat * bs, d: b.beats * bs, v: b.velocity ?? 0.5, kind: b.kind })),
      seed: num(s.seed, ctx.seed + 101 * ctx.partIndex), tail: 1.4, detune: num(s.detune, 0), vibRate: num(s.vibRate, 5.2), vibCents: num(s.vibCents, 30),
      size: num(s.size, 0), vowelTau: num(s.vowelTau, 0.12), ...(perf.overtone !== undefined ? { overtone: laneOf(perf.overtone, bs) } : {}),
    };
    const { dry, send } = F.voice.impossibleVoice(notes, opts);
    for (let i = 0; i < dry.length; i++) { const g = 0.35 + 0.93 * expr(i / RATE); dry[i] = dry[i]! * g; send[i] = send[i]! * g; }
    const halo = Array.isArray(s.halo) ? s.halo : haloPitches(ctx.key);
    const [hl, hr] = F.voice.glassHalo(send, halo.map(F.dsp.midiHz), num(s.haloDecay, 1.1), 30 * num(s.haloGain, 1));
    addAt(out[0], dry, 0, scale); addAt(out[1], dry, 0, scale); addAt(out[0], hl!, 0, scale); addAt(out[1], hr!, 0, scale);
    return out;
  },
};

// ============================================================ MECHANICAL ORCHESTRA (clockwork -> alien machinery)
type OneShot = (n: NoteEvent, m: number, at: (name: string, d: number) => number, seed: number, bs: number) => Wave;
interface MachineDef {
  id: string; name: string; description: string; range: [number, number]; articulations: Record<string, string>; controls: ControlSpec[];
  params: Record<string, string>; gainDb: number; spread: number; randomPan: boolean;
  ref: () => Promise<Wave>; refWindow: [number, number]; play: (F: Awaited<ReturnType<typeof frozen>>) => OneShot;
}
const MACHINES: MachineDef[] = [
  {
    id: 'mechanical-orchestra/bar', name: 'Modal bar', range: [48, 96], gainDb: -8, spread: 0.45, randomPan: false,
    description: 'Mallet-struck modal bar; mode ratios travel from a consonant tuned bar (1:4:10, motor tremolo) through a free-free bar to an alien gong with beating twin modes. Consecutive notes hocket left/right (setup spread).',
    articulations: { strike: 'mallet', soft: 'soft mallet', hard: 'hard mallet', muted: 'damped short', ring: 'long ring' },
    controls: [spec('hardness', 0, 1.2, 'mallet hardness'), spec('damp', 0.2, 1.5, 'decay scale (default 0.75 - 0.2 macro)'), spec('detune', -50, 50, 'cents')],
    params: { hardness: 'per-note mallet hardness', damp: 'per-note decay scale' },
    ref: async () => (await frozen()).orchestra.malletBar(69, 0.8, 0), refWindow: [0, 0.3],
    play: F => (n, m, at, seed) => {
      const a = n.articulation ?? 'strike';
      const hard = num(n.params?.hardness, a === 'soft' ? 0.25 : a === 'hard' ? 0.9 : at('hardness', 0.5));
      const damp = num(n.params?.damp, a === 'muted' ? 0.25 : a === 'ring' ? 1.3 : at('damp', 0.75 - 0.2 * m));
      return F.orchestra.malletBar(n.pitch, n.velocity, m, { seed, damp, hard, cents: at('detune', 0) });
    },
  },
  {
    id: 'mechanical-orchestra/bow', name: 'Friction-bowed bar', range: [43, 84], gainDb: -14, spread: 0.3, randomPan: false,
    description: 'The same bar driven by friction (stick-slip pulses plus rosin noise). Toward the alien end, bow overpressure skips slips: subharmonics an octave, then a twelfth, below.',
    articulations: { swell: 'slow bow (attack about 0.45 s)', bite: 'fast attack, scratchier', overpressure: 'octave subharmonic', 'fifth-under': 'twelfth-below subharmonic' },
    controls: [spec('sub', 0, 1, 'overpressure (default from the macro)'), spec('chatter', 0, 0.6, 'irregular slips'), spec('attack', 0.02, 2, 'bow attack (s)')],
    params: { attack: 'seconds' },
    ref: async () => (await frozen()).orchestra.bowedBar(69, 1.5, 0.8, 0), refWindow: [0.5, 1.5],
    play: F => (n, m, at, seed, bs) => {
      const a = n.articulation ?? 'swell';
      let sub = at('sub', 0.85 * smooth((m - 0.55) / 0.4)), subN = m > 0.88 ? 3 : 2, chatter = at('chatter', 0.04 + 0.3 * m), attack = num(n.params?.attack, at('attack', 0.45));
      if (a === 'bite') { attack = 0.06; chatter += 0.15; }
      if (a === 'overpressure') { sub = Math.max(sub, 0.9); subN = 2; }
      if (a === 'fifth-under') { sub = Math.max(sub, 0.85); subN = 3; }
      return F.orchestra.bowedBar(n.pitch, n.beats * bs, n.velocity, m, { seed, sub, subN, chatter, attack });
    },
  },
  {
    id: 'mechanical-orchestra/spring', name: 'Dispersive spring', range: [28, 72], gainDb: -5, spread: 0, randomPan: false,
    description: 'Coil-spring waveguide with an all-pass dispersion chain, tuned on its low harmonics; from a near-harmonic plucked steel string to a long chirping laser spring.',
    articulations: { pluck: 'default', twang: 'strong attack pitch bend', damped: 'short, palm-muted', laser: 'maximum dispersion regardless of the macro' },
    controls: [spec('bend', 0, 0.3, 'attack twang (default 0.02 + 0.08 macro)'), spec('decay', 0.1, 4, 'T60 seconds (default by pitch and macro)')],
    params: {},
    ref: async () => (await frozen()).orchestra.spring(33, 0.8, 0), refWindow: [0, 0.3],
    play: F => (n, m, at, seed) => {
      const a = n.articulation ?? 'pluck', mm = a === 'laser' ? 1 : m;
      const o: { seed: number; bend: number; t60?: number; len?: number } = { seed, bend: at('bend', 0.02 + 0.08 * mm) * (a === 'twang' ? 3 : 1) };
      const decay = ctlDefault(at, 'decay');
      if (decay !== undefined) o.t60 = decay;
      if (a === 'damped') { o.t60 = 0.4; o.len = 0.7; }
      return F.orchestra.spring(n.pitch, n.velocity, mm, o);
    },
  },
  {
    id: 'mechanical-orchestra/tine', name: 'Buzzing tine', range: [60, 100], gainDb: -11, spread: 0.2, randomPan: false,
    description: 'Clamped steel tine (cantilever modes) with a sitar-like bridge-contact buzz that grows toward the alien end.',
    articulations: { pluck: 'default', clean: 'no buzz', buzz: 'full buzz' },
    controls: [spec('buzz', 0, 1, 'bridge buzz (default from the macro)'), spec('detune', -50, 50, 'cents')],
    params: {},
    ref: async () => (await frozen()).orchestra.tine(81, 0.8), refWindow: [0, 0.3],
    play: F => (n, m, at, seed) => {
      const a = n.articulation ?? 'pluck';
      const buzz = a === 'clean' ? 0 : a === 'buzz' ? 1 : at('buzz', 0.9 * smooth((m - 0.3) / 0.6));
      return F.orchestra.tine(n.pitch, n.velocity, { buzz, seed, cents: at('detune', 0) });
    },
  },
  {
    id: 'mechanical-orchestra/clock', name: 'Escapement clock', range: [60, 100], gainDb: -14, spread: 0.15, randomPan: false,
    description: 'Escapement tick (small high modes) or tock (lower modes). Toward the alien end accented ticks (velocity >= 0.5) sprout tiny high springs tuned to the note pitch.',
    articulations: { tick: 'high escapement tick', tock: 'lower knock' },
    controls: [spec('zip', 0, 1, 'spring zips on accented ticks (default from the macro)')],
    params: {},
    ref: async () => (await frozen()).orchestra.tick(1, false, 1), refWindow: [0, 0.03],
    play: F => (n, m, at, seed) => {
      const t = F.orchestra.tick(n.velocity, n.articulation === 'tock', seed), zip = at('zip', smooth((m - 0.4) / 0.5));
      if (zip <= 0.01 || n.velocity < 0.5) return t;
      const z = F.orchestra.spring(n.pitch, 0.35 * n.velocity, 1, { len: 0.35, t60: 0.3, seed: seed + 7 }), out = new Float64Array(Math.max(t.length, z.length));
      // zips share the clock's calibration and sit at the approved audition's ratio (gain 1.6 x zip over the tick)
      for (let i = 0; i < out.length; i++) out[i] = (t[i] ?? 0) + (z[i] ?? 0) * 1.6 * zip;
      return out;
    },
  },
  {
    id: 'mechanical-orchestra/bearings', name: 'Bearings', range: [72, 108], gainDb: -22, spread: 0.8, randomPan: true,
    description: 'Tiny tuned metal pings (short bars) for textures; use a part `textures` block for seeded Poisson rain over chord tones.',
    articulations: { ping: 'default' },
    controls: [],
    params: {},
    ref: async () => (await frozen()).orchestra.malletBar(93, 0.8, 0, { damp: 0.3, hard: 0.95 }), refWindow: [0, 0.3],
    play: F => (n, m, _at, seed) => F.orchestra.malletBar(n.pitch, n.velocity, m, { damp: 0.3, hard: 0.95, seed }),
  },
];
function ctlDefault(at: (name: string, d: number) => number, name: string): number | undefined { const v = at(name, NaN); return Number.isNaN(v) ? undefined : v; }

function machine(def: MachineDef): RackInstrument {
  return {
    id: def.id, family: 'mechanical-orchestra', name: def.name, version: `${ADAPTER}+mutation-001-C`,
    macro: { id: 'clockwork-alien', label: 'clockwork → alien machinery', from: 'clockwork', to: 'alien machinery' },
    description: def.description, range: def.range, articulations: def.articulations, controls: def.controls,
    setup: [spec('seed', 0, 4294967295, 'random seed'), spec('spread', 0, 1, `stereo spread (default ${def.spread}${def.randomPan ? ', random per note' : ', alternating left/right'})`)],
    params: def.params, suggestedGainDb: def.gainDb,
    async render(perf, ctx) {
      const F = await frozen(), bs = ctx.beatSeconds, play = def.play(F);
      const scale = await calibrated(def.id, def.ref, def.refWindow[0], def.refWindow[1]);
      const rng = new F.dsp.Rng(num(perf.setup.seed, ctx.seed + 101 * ctx.partIndex)), spread = num(perf.setup.spread, def.spread), expr = (b: number) => curveAt(perf.expression, b);
      const out = blank(ctx.frames), sorted = [...perf.notes].sort((a, b) => a.beat - b.beat || a.pitch - b.pitch);
      sorted.forEach((n, k) => {
        const m = clamp(curveAt(perf.macro, n.beat), 0, 1), at = (name: string, d: number) => { const c = ctl(perf, name), sp = def.controls.find(x => x.name === name); return c === undefined ? d : sp ? clamp(curveAt(c, n.beat), sp.min, sp.max) : curveAt(c, n.beat); };
        const e = expr(n.beat), seed = 1000 + k * 7 + Math.round(n.pitch);
        const w = play({ ...n, velocity: clamp(n.velocity * (0.55 + 0.65 * e), 0, 1) }, m, at, seed, bs);
        const pan = def.randomPan ? spread * rng.bi() : (k % 2 ? 1 : -1) * spread, off = Math.round(n.beat * bs * RATE);
        addAt(out[0], w, off, scale * Math.min(1, 1 - pan)); addAt(out[1], w, off, scale * Math.min(1, 1 + pan));
      });
      return out;
    },
  };
}

// ============================================================ CONTEXT (unchanged SODIUM HOURS drum patches, for musical context only)
const contextKick: RackInstrument = {
  id: 'context/kick', family: 'context', name: 'Context kick', version: `${ADAPTER}+headliner-001`, range: [24, 48],
  macro: { id: 'none', label: 'none', from: '-', to: '-' },
  description: 'Tuned kick from the HEADLINER 001 toolkit (unchanged); pitch sets the body pitch. For musical-context mixes.',
  articulations: { hit: 'default', short: 'tighter body' }, controls: [], setup: [], params: {}, suggestedGainDb: -8,
  async render(perf, ctx) {
    const F = await frozen(), out = blank(ctx.frames);
    const scale = await calibrated('context/kick', async () => F.instruments.kick({ f0: F.dsp.midiHz(31) })[0]!, 0, 0.3);
    for (const n of perf.notes) {
      const w = F.instruments.kick({ f0: F.dsp.midiHz(n.pitch), decay: n.articulation === 'short' ? 0.18 : 0.28 })[0]!, off = Math.round(n.beat * ctx.beatSeconds * RATE);
      addAt(out[0], w, off, scale * n.velocity); addAt(out[1], w, off, scale * n.velocity);
    }
    return out;
  },
};
const contextSnare: RackInstrument = {
  id: 'context/snare', family: 'context', name: 'Context snare', version: `${ADAPTER}+headliner-001`, range: [0, 127],
  macro: { id: 'none', label: 'none', from: '-', to: '-' },
  description: 'Snare/clap from the HEADLINER 001 toolkit (unchanged). Pitch is ignored. For musical-context mixes.',
  articulations: { snare: 'snare with clap layer', ghost: 'soft short snare', clap: 'clap-forward' }, controls: [], setup: [], params: {}, suggestedGainDb: -12,
  async render(perf, ctx) {
    const F = await frozen(), out = blank(ctx.frames);
    const kinds = { snare: F.instruments.snare({ clap: 0.45 }), ghost: F.instruments.snare({ body: 0.5, noise: 0.6, clap: 0, room: 0.08, len: 0.25, decay: 0.045, seed: 25 }), clap: F.instruments.snare({ body: 0.2, noise: 0.35, clap: 1, room: 0.3, seed: 23 }) };
    const scale = await calibrated('context/snare', async () => mono(kinds.snare), 0, 0.3);
    for (const n of perf.notes) {
      const k = kinds[(n.articulation ?? 'snare') as keyof typeof kinds] ?? kinds.snare, off = Math.round(n.beat * ctx.beatSeconds * RATE);
      addAt(out[0], k[0]!, off, scale * n.velocity); addAt(out[1], k[1] ?? k[0]!, off, scale * n.velocity);
    }
    return out;
  },
};
const mono = (w: Wave[]) => w.length === 1 ? w[0]! : w[0]!.map((v, i) => 0.5 * (v + w[1]![i]!));

/** All rack instruments (registry order). */
export function instrumentList(): RackInstrument[] {
  return [livingBass, impossibleVoice, ...MACHINES.map(machine), contextKick, contextSnare];
}
