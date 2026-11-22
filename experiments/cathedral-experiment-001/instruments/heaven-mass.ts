/**
 * HEAVEN//MASS · a synthetic celestial choir in four sections (intimate -> heavenly).
 *
 * Builds on the Impossible Voice's additive source-filter idea (every harmonic its own partial, its amplitude a glottal
 * tilt times a five-formant cascade evaluated at its frequency, so vowels move without filter jumps) and turns it into
 * a CHOIR rather than one voice copied:
 *
 * - FOUR THROATS. Bass, tenor, alto and soprano each have their own sung-vowel formant table (textbook-style averages,
 *   hand-adjusted). The male tables cluster F3-F5, so a singer's "ring" emerges from the cascade itself; the female
 *   tables spread and widen the upper formants (sweet, not harsh). Altos and sopranos tune F1 above the fundamental on
 *   high notes, as trained singers do. Each section also has its own source tilt, vibrato habits, stereo seat,
 *   low-cut, low-mid dip and (upper voices) de-harshing.
 * - REAL SINGERS. Every singer in a section has their own tuning, slow drift, jitter, vibrato rate/depth/delay, onset
 *   timing, scoop, intonation settle, vowel timing, tract length, breathiness and seat. An `ensemble` control brings
 *   singers in one by one, so a passage can literally grow from one voice per part to a full choir. Optional
 *   OCTAVISTS sing an octave under the basses (dark "oo"), for depth that does not crowd the low mids.
 * - BREATH AND AIR. Pitch-synchronous aspiration through the section's formants, audible inhales before phrases, and
 *   an `air` sheen above 5 kHz (unvoiced, following each singer) for height without harsh harmonics.
 * - SPACE. Each section feeds the Nave at a depth set per part (distance, pre-delay, size, damping); its tail is
 *   high-passed so a deep room never turns into low-mid mud.
 * No words, no language, no real singer modelled. Deterministic (seeded); original code.
 */
import { RATE, clamp, curveAt, smooth } from '../../../studio-001/rack/curves.ts';
import type { ControlSpec, NoteEvent, PartPerformance, RenderContext } from '../../../studio-001/rack/types.ts';
import { Bq, LAB_VERSION, TAU, Tpt, Wander, blank, calibrated, controlAt, fsin, gaussOf, hashSeed, hz, mulberry, nave, num, panLR, spec, str, win, type LabInstrument, type Stereo } from './common.ts';

const CR = 32, STEP = CR / RATE;
type Vowel = 'mm' | 'oo' | 'oh' | 'aw' | 'ah' | 'uh' | 'eh' | 'ee';
type Table = Record<Vowel, [number[], number[], number]>; // F1..F5 (Hz), B1..B5 (Hz), mouth low-pass (Hz)

// Sung-vowel targets per section (approximate published averages for sung vowels, hand-adjusted; "mm" is a closed,
// nasal hum: wide upper bandwidths and a mouth low-pass).
const BASS: Table = {
  oo: [[350, 600, 2400, 2675, 2950], [40, 80, 100, 120, 120], 9000], oh: [[400, 750, 2400, 2600, 2900], [40, 80, 100, 120, 120], 9000],
  aw: [[500, 850, 2400, 2600, 2900], [50, 80, 100, 120, 120], 9000], ah: [[600, 1040, 2250, 2450, 2750], [60, 70, 110, 120, 130], 9000],
  uh: [[540, 1100, 2300, 2500, 2800], [55, 75, 105, 120, 125], 9000], eh: [[400, 1620, 2400, 2800, 3100], [40, 80, 100, 120, 120], 9000],
  ee: [[250, 1750, 2600, 3050, 3340], [60, 90, 100, 120, 120], 9000], mm: [[260, 1000, 2250, 2600, 2900], [70, 200, 300, 350, 400], 750],
};
const TENOR: Table = {
  oo: [[350, 600, 2700, 2900, 3300], [40, 60, 100, 120, 120], 9000], oh: [[400, 800, 2600, 2800, 3000], [40, 80, 100, 120, 120], 9000],
  aw: [[520, 900, 2600, 2850, 3050], [50, 80, 100, 120, 120], 9000], ah: [[650, 1080, 2650, 2900, 3250], [80, 90, 120, 130, 140], 9000],
  uh: [[580, 1150, 2600, 2900, 3200], [65, 85, 110, 125, 130], 9000], eh: [[400, 1700, 2600, 3200, 3580], [70, 80, 100, 120, 120], 9000],
  ee: [[290, 1870, 2800, 3250, 3540], [40, 90, 100, 120, 120], 9000], mm: [[280, 1100, 2500, 2900, 3300], [70, 200, 300, 350, 400], 850],
};
const ALTO: Table = {
  oo: [[325, 700, 2530, 3500, 4950], [50, 60, 170, 280, 320], 9000], oh: [[450, 800, 2830, 3500, 4950], [70, 80, 100, 210, 220], 9000],
  aw: [[600, 950, 2800, 3500, 4950], [75, 85, 110, 210, 220], 9000], ah: [[800, 1150, 2800, 3500, 4950], [80, 90, 120, 210, 220], 9000],
  uh: [[700, 1250, 2750, 3500, 4950], [80, 90, 120, 210, 220], 9000], eh: [[400, 1600, 2700, 3300, 4950], [60, 80, 120, 240, 320], 9000],
  ee: [[350, 1700, 2700, 3700, 4950], [50, 100, 120, 240, 320], 9000], mm: [[300, 1200, 2700, 3500, 4950], [80, 220, 320, 380, 450], 900],
};
const SOPRANO: Table = {
  oo: [[325, 700, 2700, 3800, 4950], [50, 60, 170, 290, 320], 9000], oh: [[450, 800, 2830, 3800, 4950], [70, 80, 100, 210, 220], 9000],
  aw: [[620, 980, 2850, 3850, 4950], [75, 85, 110, 210, 220], 9000], ah: [[800, 1150, 2900, 3900, 4950], [80, 90, 120, 210, 220], 9000],
  uh: [[700, 1300, 2850, 3850, 4950], [80, 90, 120, 210, 220], 9000], eh: [[350, 2000, 2800, 3600, 4950], [60, 100, 120, 240, 320], 9000],
  ee: [[270, 2140, 2950, 3900, 4950], [60, 90, 100, 190, 190], 9000], mm: [[300, 1300, 2800, 3800, 4950], [80, 220, 320, 380, 450], 950],
};
const VOWELS: Vowel[] = ['mm', 'oo', 'oh', 'aw', 'ah', 'uh', 'eh', 'ee'];
const asVowel = (v: unknown, d: Vowel): Vowel => (typeof v === 'string' && (VOWELS as string[]).includes(v) ? v as Vowel : d);

/** Section EQ on the bus: [kind, Hz, dB, Q]. Low shelf = depth of the fundamentals, peaks = low-mid dip, ring/presence, de-harsh. */
type Eq = ['lowshelf' | 'peak', number, number, number];
interface SectionDef {
  id: string; name: string; range: [number, number]; table: Table; tilt: number; soft: number; bw: [number, number, number]; vibRate: number; vibCents: number; center: number; spread: number;
  hp: number; eq: Eq[]; breath: number; f1Tune: boolean; octavist: boolean; ref: number; description: string;
}
// Measured on the first smoke render: the sopranos had almost nothing above 2 kHz (no height) and the basses put 57 % of
// their energy into 250-500 Hz (mud). Hence wider male F1/F2 bandwidths (choral blend, softer low-mid peaks), a
// higher-pole correction in the cascade, brighter upper-voice sources, and these per-section EQs.
const SECTIONS: SectionDef[] = [
  { id: 'heaven-mass/bass', name: 'HEAVEN//MASS Bass', range: [36, 64], table: BASS, tilt: 1.1, soft: 0.92, bw: [1.7, 1.3, 1], vibRate: 4.9, vibCents: 20, center: -0.12, spread: 0.32, hp: 34,
    eq: [['lowshelf', 120, 3.5, 0.7], ['peak', 330, -5, 0.8], ['peak', 2600, 2, 1.2]], breath: 0.1, f1Tune: false, octavist: true, ref: 48,
    description: 'Basses (C2-E4): the longest tract and a clustered ring, fundamentals lifted and the low mids carved; optional octavists an octave below for depth without mud.' },
  { id: 'heaven-mass/tenor', name: 'HEAVEN//MASS Tenor', range: [48, 72], table: TENOR, tilt: 1.0, soft: 0.92, bw: [1.5, 1.25, 1], vibRate: 5.3, vibCents: 24, center: 0.22, spread: 0.32, hp: 70,
    eq: [['peak', 380, -3.5, 0.9], ['peak', 2900, 2.5, 1.2]], breath: 0.12, f1Tune: false, octavist: false, ref: 57,
    description: 'Tenors (C3-C5): bright male ring, the warm inner core.' },
  { id: 'heaven-mass/alto', name: 'HEAVEN//MASS Alto', range: [53, 77], table: ALTO, tilt: 0.9, soft: 0.85, bw: [1.2, 1.1, 1.6], vibRate: 5.4, vibCents: 26, center: 0.44, spread: 0.38, hp: 110,
    eq: [['peak', 440, -2.5, 1], ['peak', 2800, 3, 1], ['peak', 4800, -2, 1.2]], breath: 0.17, f1Tune: true, octavist: false, ref: 64,
    description: 'Altos (F3-F5): dark, round female tone with soft upper formants.' },
  { id: 'heaven-mass/soprano', name: 'HEAVEN//MASS Soprano', range: [60, 86], table: SOPRANO, tilt: 0.8, soft: 0.85, bw: [1.1, 1.05, 1.6], vibRate: 5.7, vibCents: 30, center: -0.44, spread: 0.42, hp: 150,
    eq: [['peak', 520, -1.5, 1], ['peak', 2800, 2.5, 0.9], ['peak', 5200, -2.5, 1.2]], breath: 0.2, f1Tune: true, octavist: false, ref: 69,
    description: 'Sopranos (C4-D6): formant-tuned high notes, presence at 3 kHz, de-harshed above 5 kHz, airy and soaring.' },
];

const CONTROLS: ControlSpec[] = [
  spec('ensemble', 0, 1, 'how many of the section\'s singers sing (singers join one by one)'),
  spec('breath', 0, 1, 'aspiration in the tone and the depth of the inhales before phrases'),
  spec('air', 0, 1, 'unvoiced sheen above 5 kHz that follows the singers: height without harshness'),
  spec('effort', 0, 1, 'vocal effort: brighter, richer source as it rises'),
  spec('vib', 0, 2, 'vibrato depth scale (each singer keeps their own rate and depth)'),
  spec('width', 0, 1.2, 'how far the singers spread around the section\'s seat'),
  spec('room', 0, 1.5, 'send to the Nave'),
  spec('octavist', 0, 1, 'octavists an octave under the basses (bass section only)'),
  spec('tract', -1, 1, 'throat size: -1 giant (formants down 15 %) .. 1 small (up 15 %)'),
];
const BY_MACRO: Record<string, (m: number) => number> = {
  ensemble: m => 0.2 + 0.8 * m, breath: m => 0.5 - 0.25 * m, air: m => 0.05 + 0.5 * m, effort: m => 0.25 + 0.55 * m, vib: m => 0.6 + 0.5 * m,
  width: m => 0.35 + 0.65 * m, room: m => 0.12 + 0.5 * m, octavist: m => 0.8 * win(m, 0.65, 0.95), tract: () => 0,
};
const SETUP: ControlSpec[] = [
  spec('seed', 0, 4294967295, 'random seed (who the singers are)'),
  spec('singers', 1, 12, 'singers in the section (default 6)'),
  spec('octavists', 0, 4, 'octavists under the basses (default 2; bass section only)'),
  spec('tuning', 0, 25, 'spread of the singers\' tuning in cents (default 5)'),
  spec('timing', 0, 60, 'spread of the singers\' onsets in ms (default 18)'),
  spec('depth', 0, 1, 'distance in the Nave: pre-delay, size and decay grow with it (default 0.5)'),
  spec('lowCut', 40, 500, 'high-pass on the room tail in Hz (default 140)'),
  spec('center', -1, 1, 'override the section\'s seat in the stereo field'),
  spec('centre', 0, 1, 'section tuning centred on the written pitch (1, default) or free (0: every singer\'s own offset)'),
];
const ARTICULATIONS: Record<string, string> = {
  sung: 'fresh onset: a small scoop and the singer settles into tune', legato: 'glides from the previous note (slide in beats, else about 75 ms)',
  hum: 'closed "mm" unless a vowel is given', swell: 'slow bloom onset (about 0.4 s)', detached: 'shorter (80 %)',
  fall: 'sighing fall at the end (param fall, semitones, default 1)', breathy: 'extra breath at the onset',
};
const PARAMS: Record<string, string> = {
  vowel: `one of ${VOWELS.join(', ')}`, to: 'vowel reached by the end of the note', fall: 'semitones', scoop: 'cents below the pitch where the onset starts (default per singer 15-45)',
  cents: 'fine tuning of this note in cents (just-intoned chord tones)',
};

// ------------------------------------------------------------------ singers
interface Seg { t0: number; t1: number; pitch: number; vel: number; vA: Vowel; vB: Vowel; legato: boolean; glide: number; fall: number; scoop: number; art: string; restBefore: number }
interface Singer { k: number; octavist: boolean; detune: number; vibRate: number; vibDepth: number; vibDelay: number; vibPh: number; timing: number; fScale: number; breath: number; gain: number; panOff: number; scoop: number; glideMul: number; vowelSkew: number; seed: number }
type Lanes = Record<string, (beat: number) => number>;

function segsOf(notes: NoteEvent[], bs: number, expr: (b: number) => number): Seg[] {
  const sorted = [...notes].sort((a, b) => a.beat - b.beat || b.pitch - a.pitch), out: Seg[] = [];
  sorted.forEach((n, i) => {
    const prev = sorted[i - 1], art = n.articulation ?? 'sung', p = n.params ?? {}, t0 = n.beat * bs, d = n.beats * bs;
    // a choir line slurs notes that touch (a `legato` articulation or a slide is the same, with a chosen glide)
    const prevEnd = prev ? (prev.beat + prev.beats) * bs : -Infinity, legato = !!prev && prevEnd >= t0 - 0.03;
    const vA = asVowel(p.vowel, art === 'hum' ? 'mm' : 'oh');
    out.push({ t0, t1: t0 + (art === 'detached' ? 0.8 * d : d - 0.01), pitch: n.pitch + num(p.cents, 0) / 100, vel: clamp(n.velocity * (0.45 + 0.8 * expr(n.beat)), 0, 1.2),
      vA, vB: asVowel(p.to, vA), legato, glide: n.slide !== undefined ? n.slide * bs : 0.075, fall: art === 'fall' || typeof p.fall === 'number' ? num(p.fall, 1) : 0,
      scoop: num(p.scoop, -1), art, restBefore: prev ? t0 - prevEnd : 10 });
  });
  return out;
}

function makeSingers(def: SectionDef, count: number, octavists: number, seed: number, tuning: number, timing: number, centre: boolean): Singer[] {
  const out: Singer[] = [];
  for (let k = 0; k < count + (def.octavist ? octavists : 0); k++) {
    const r = mulberry(hashSeed(seed, k, 17)), g = gaussOf(r), oct = k >= count;
    out.push({
      // the first singer of a section is the one heard alone in intimate passages: the steadiest intonation
      k, octavist: oct, detune: clamp(g() * tuning, -2.2 * tuning, 2.2 * tuning) * (oct ? 0.6 : k === 0 ? 0.35 : 1), vibRate: def.vibRate * (1 + 0.06 * g()) * (oct ? 0.85 : 1),
      vibDepth: def.vibCents * (0.75 + 0.5 * r()) * (oct ? 0.5 : 1), vibDelay: 0.22 + 0.3 * r(), vibPh: r(), timing: clamp(g() * timing, -2.5 * timing, 2.5 * timing) / 1000,
      fScale: (1 + 0.03 * g()) * (oct ? 0.92 : 1), breath: 0.7 + 0.6 * r(), gain: Math.pow(10, clamp(g(), -2, 2) * 1.2 / 20) * (oct ? 0.9 : 1),
      // octavists stand just either side of the centre; for singers this is only the seat jitter (the seat is added below)
      panOff: oct ? (k % 2 ? 0.12 : -0.12) : 0.07 * clamp(g(), -2, 2), scoop: 15 + 30 * r(), glideMul: 0.8 + 0.4 * r(), vowelSkew: 0.1 * g(),
      seed: hashSeed(seed, k, 911),
    });
  }
  // QA fix F2: the seeded detunes of one section can average several cents off (the candidate's sopranos sat ~8 cents
  // sharp of their just A). A section tunes to its chord as a group: the other singers are centred on the written pitch
  // (their spread kept) and the first singer, the one heard alone, keeps its own small offset.
  if (centre) for (const grp of [out.filter(s => !s.octavist && s.k > 0), out.filter(s => s.octavist)]) {
    const m = grp.reduce((a, s) => a + s.detune, 0) / Math.max(1, grp.length); for (const s of grp) s.detune -= m;
  }
  // seats fill from the section's centre outward, alternating sides: the first singer is in the middle of the section,
  // and each singer who joins widens it
  const seats = Array.from({ length: count }, (_, j) => (count > 1 ? (j / (count - 1)) * 2 - 1 : 0)).sort((a, b) => Math.abs(a) - Math.abs(b) || a - b);
  out.filter(s => !s.octavist).forEach((s, i) => { s.panOff = (seats[i] ?? 0) + s.panOff; });
  return out;
}

interface Buses { L: Float64Array; R: Float64Array; aL: Float64Array; aR: Float64Array; hL: Float64Array; hR: Float64Array; iL: Float64Array; iR: Float64Array; fMean: Float64Array }

function renderSinger(def: SectionDef, s: Singer, segs: Seg[], lanes: Lanes, bs: number, K: number, buses: Buses) {
  if (!segs.length) return;
  const frames = buses.L.length, rnd = mulberry(s.seed), g = gaussOf(rnd), noise = mulberry(s.seed ^ 0x2545f491);
  const drift = new Wander(s.seed + 1, 0.12, STEP), jit = new Wander(s.seed + 2, 22, STEP), shim = new Wander(s.seed + 3, 18, STEP), vw = new Wander(s.seed + 4, 0.3, STEP);
  const tab = def.table, F = [...tab.oo[0]], Bw = [...tab.oo[1]], lpv = [tab.oo[2]];
  // singer-specific timeline
  const ts = segs.map(sg => ({ ...sg, t0: sg.t0 + s.timing + (sg.legato ? 0.3 : 1) * g() * 0.006, t1: sg.t1 + 0.5 * s.timing + g() * 0.01, pitch: (s.octavist ? sg.pitch - 12 : sg.pitch) }));
  if (s.octavist) for (const sg of ts) { sg.vA = sg.vA === 'mm' ? 'mm' : 'oo'; sg.vB = sg.vB === 'mm' ? 'mm' : 'oo'; }
  const voiced = ts.filter(sg => !s.octavist || sg.pitch >= 29);
  if (!voiced.length) return;
  const first = voiced[0]!, last = voiced[voiced.length - 1]!;
  const inhales = voiced.filter(sg => !sg.legato && sg.restBefore > 0.45).map(sg => { const d = 0.25 + 0.2 * rnd(); return [sg.t0 - d - 0.06, sg.t0 - 0.06, 0.6 + 0.4 * rnd()] as [number, number, number]; });
  const startT = Math.min(first.t0, ...inhales.map(x => x[0])) - 0.02, endT = last.t1 + 0.9;
  const b0 = Math.max(0, Math.floor(startT / STEP)), b1 = Math.min(Math.floor(frames / CR), Math.ceil(endT / STEP));
  const NH = 48, amp = new Float64Array(NH), ampN = new Float64Array(NH);
  let si = -1, seg = voiced[0]!, pitch = first.pitch, off = 0, settle = 0, level = 0, vibEnv = 0, vibPh = s.vibPh, phase = rnd(), aspN = 0, aspS = 0, airN = 0, airS = 0, inhN = 0, inhS = 0;
  let gl = 0.7, gr = 0.7, f0 = hz(pitch), nh = 1;
  for (let b = b0; b < b1; b++) {
    const t = b * STEP, beat = t / bs;
    while (si + 1 < voiced.length && t >= voiced[si + 1]!.t0) {
      si++; seg = voiced[si]!;
      if (!seg.legato || si === 0) { pitch = seg.pitch; off = -(seg.scoop >= 0 ? seg.scoop : s.scoop) / 100; settle = clamp(g() * 0.08, -0.2, 0.2); vibEnv = 0; }
    }
    const sounding = si >= 0, gate = sounding && t < seg.t1, tn = t - seg.t0, d = Math.max(0.05, seg.t1 - seg.t0);
    // ---------------------------------------------------------------- lanes
    const ens = Math.max(lanes.ensemble!(beat), 1 / K), eg = s.octavist ? lanes.octavist!(beat) : smooth(clamp(ens * K - s.k, 0, 1));
    const effort = clamp(lanes.effort!(beat) + 0.25 * (seg.vel - 0.75), 0, 1.3), vibS = lanes.vib!(beat), breath = lanes.breath!(beat), air = lanes.air!(beat);
    const width = lanes.width!(beat), tract = lanes.tract!(beat);
    [gl, gr] = panLR(clamp(def.center + def.spread * width * s.panOff, -1, 1));
    // ---------------------------------------------------------------- pitch
    let target = seg.pitch;
    if (seg.fall && gate && tn > d - 0.35) target -= seg.fall * smooth((tn - (d - 0.35)) / 0.35);
    const glideTau = (seg.legato ? seg.glide * s.glideMul : 0.02) / 3;
    pitch += (target - pitch) * (1 - Math.exp(-STEP / Math.max(0.003, glideTau)));
    off *= Math.exp(-STEP / 0.07); settle *= Math.exp(-STEP / 0.25);
    vibEnv += ((gate && tn > s.vibDelay ? 1 : 0) - vibEnv) * (STEP / 0.45);
    vibPh += STEP * s.vibRate * (1 + 0.04 * vw.next());
    // on a long held note the singers listen and converge: individual detune and drift shrink, the chord locks and rings
    const conv = gate && d > 1.2 ? 1 - 0.65 * smooth((tn - 0.4) / 1.8) : 1;
    const cents = (s.detune + 3 * drift.next()) * conv + 2.2 * jit.next() + vibS * s.vibDepth * vibEnv * Math.sin(TAU * vibPh);
    f0 = hz(pitch + off + settle) * Math.pow(2, cents / 1200);
    // ---------------------------------------------------------------- level
    const atk = seg.art === 'swell' ? 0.4 : 0.07 + 0.05 * rnd(), lT = gate ? Math.pow(Math.min(1, seg.vel), 1.2) * s.gain * eg * (0.9 + 0.12 * Math.sin(Math.PI * clamp(tn / d, 0, 1))) : 0;
    const legDip = seg.legato && tn < 0.05 && seg.glide < 0.06 ? 0.85 + 0.15 * tn / 0.05 : 1;
    level += (lT * legDip - level) * (1 - Math.exp(-STEP / (lT > level ? atk : 0.16)));
    const shimmer = 1 + 0.025 * shim.next();
    // ---------------------------------------------------------------- vowel and formants (anticipate the next vowel in rests)
    const nextSeg = voiced[si + 1], soon = !gate && nextSeg !== undefined && nextSeg.t0 - t < 0.4;
    const va = tab[soon ? nextSeg!.vA : sounding ? seg.vA : first.vA], vb = tab[soon ? nextSeg!.vA : sounding ? seg.vB : first.vA];
    const x = soon || !sounding ? 0 : smooth(clamp(tn / Math.max(0.2, (0.85 + s.vowelSkew) * d), 0, 1)), c = 1 - Math.exp(-STEP / 0.09);
    const sc = s.fScale * Math.pow(2, 0.2 * tract);
    for (let k = 0; k < 5; k++) {
      const ft = Math.exp((1 - x) * Math.log(va[0][k]!) + x * Math.log(vb[0][k]!)) * sc;
      F[k] = F[k]! * Math.pow(ft / F[k]!, c); Bw[k] = Bw[k]! + ((1 - x) * va[1][k]! + x * vb[1][k]! - Bw[k]!) * c;
    }
    lpv[0] = lpv[0]! * Math.pow(Math.exp((1 - x) * Math.log(va[2]) + x * Math.log(vb[2])) / lpv[0]!, c);
    // trained upper voices tune F1 above f0 and pull F2 up toward 2 f0 on high notes (vowel modification)
    const F1 = def.f1Tune ? Math.max(F[0]!, 1.08 * f0) : F[0]!, B1 = Bw[0]! * def.bw[0] * (def.f1Tune && F1 > F[0]! ? 1 + (F1 / F[0]! - 1) * 0.6 : 1), B2 = Bw[1]! * def.bw[1];
    const F2 = def.f1Tune ? Math.max(F[1]!, 2.16 * f0) : F[1]!;
    if (s.k === 0) for (let k = 0; k < 4; k++) buses.fMean[b * 4 + k] = k === 0 ? F1 : F[k]!;
    // ---------------------------------------------------------------- harmonic amplitudes: source tilt x formant cascade
    // x higher-pole correction (the tract's resonances above F5, a gentle rising shelf). Octavists: dark, closed mouth.
    const tilt = def.tilt + 0.3 - 0.6 * Math.min(1, effort) + (s.octavist ? 0.9 : 0) + 0.15 * breath * s.breath;
    const mouth = s.octavist ? Math.min(lpv[0]!, 280) : lpv[0]!;
    nh = Math.min(NH, Math.max(1, Math.floor(10500 / Math.max(30, f0))));
    let ss = 0;
    for (let n = 1; n <= nh; n++) {
      const f = n * f0;
      let c = 1;
      for (let k = 0; k < 5; k++) { const Fk = k === 0 ? F1 : k === 1 ? F2 : F[k]!, Bk = k === 0 ? B1 : k === 1 ? B2 : k === 2 ? Bw[2]! * def.bw[2] : Bw[k]!, dd = Fk * Fk - f * f; c *= Fk * Fk / Math.sqrt(dd * dd + f * f * Bk * Bk); }
      // a softened cascade (choral blend: peaks and the slope above F2 slightly gentler) x higher-pole correction
      let h = Math.pow(n, -tilt) * Math.sqrt(1 + (f / 2800) ** 2) * Math.pow(c, def.soft);
      h /= Math.sqrt(1 + (f / mouth) ** 4);
      ampN[n - 1] = h; ss += h * h;
    }
    const norm = (0.25 / Math.sqrt(ss + 1e-18)) * level * shimmer;
    for (let n = 0; n < nh; n++) ampN[n] = ampN[n]! * norm;
    for (let n = nh; n < NH; n++) ampN[n] = 0;
    aspN = level * breath * s.breath * def.breath * 2.2 * (seg.art === 'breathy' && tn < 0.4 ? 2.5 : 1);
    airN = level * air * 0.14; // measured on the first renders: 0.06 left the 4-8 kHz band nearly empty (0.2 %)
    let inh = 0; for (const [a, z, v] of inhales) if (t >= a && t < z + 0.03) { const xi = (t - a) / (z - a); inh = Math.max(inh, v * (xi < 1 ? smooth(xi) * smooth(xi) : Math.max(0, 1 - (t - z) / 0.03))); }
    inhN = inh * breath * 0.05 * s.gain * (s.octavist ? 0 : 1) * Math.max(eg, 0);
    // ---------------------------------------------------------------- audio: harmonics by rotation, aspiration, air, inhale
    const i0 = b * CR, dph = f0 / RATE;
    for (let j = 0; j < CR; j++) {
      const i = i0 + j; if (i >= frames) break;
      const w = j / CR;
      phase += dph; if (phase >= 1) phase -= 1;
      const s1 = fsin(phase), c1 = fsin(phase + 0.25);
      let sn = s1, cn = c1, v = 0;
      for (let n = 0; n < nh; n++) {
        const a = amp[n]! + (ampN[n]! - amp[n]!) * w;
        v += a * sn;
        const s2 = sn * c1 + cn * s1; cn = cn * c1 - sn * s1; sn = s2;
      }
      const gp = 0.5 + 0.5 * c1, nz = noise() * 2 - 1;
      const asp = (aspS + (aspN - aspS) * w) * (0.25 + 0.75 * gp * gp * gp) * nz;
      const ai = (airS + (airN - airS) * w) * (noise() * 2 - 1), ih = (inhS + (inhN - inhS) * w) * nz;
      buses.L[i] = buses.L[i]! + v * gl; buses.R[i] = buses.R[i]! + v * gr;
      buses.aL[i] = buses.aL[i]! + asp * gl; buses.aR[i] = buses.aR[i]! + asp * gr;
      buses.hL[i] = buses.hL[i]! + ai * gl; buses.hR[i] = buses.hR[i]! + ai * gr;
      buses.iL[i] = buses.iL[i]! + ih * gl; buses.iR[i] = buses.iR[i]! + ih * gr;
    }
    amp.set(ampN); aspS = aspN; airS = airN; inhS = inhN;
  }
}

const dryCache = new Map<string, Stereo>();
function renderSectionDry(def: SectionDef, perf: PartPerformance, ctx: RenderContext): Stereo {
  const bs = ctx.beatSeconds, s = perf.setup, lanes: Lanes = {};
  for (const c of CONTROLS) lanes[c.name] = controlAt(perf, c, BY_MACRO[c.name]!);
  const seed = num(s.seed, ctx.seed + 101 * ctx.partIndex), K = Math.round(clamp(num(s.singers, 6), 1, 12)), O = Math.round(clamp(num(s.octavists, 2), 0, 4));
  const key = JSON.stringify([def.id, perf.notes, perf.macro, perf.controls, perf.offsets, perf.expression, seed, K, O, s.tuning, s.timing, s.center, s.centre, ctx.frames, bs]);
  const hit = dryCache.get(key); if (hit) return [hit[0].slice(), hit[1].slice()];
  const sec = { ...def, center: typeof s.center === 'number' ? clamp(s.center, -1, 1) : def.center };
  const n = ctx.frames, blocks = Math.ceil(n / CR) + 1;
  const buses: Buses = { L: new Float64Array(n), R: new Float64Array(n), aL: new Float64Array(n), aR: new Float64Array(n), hL: new Float64Array(n), hR: new Float64Array(n), iL: new Float64Array(n), iR: new Float64Array(n), fMean: new Float64Array(blocks * 4) };
  const expr = (b: number) => curveAt(perf.expression, b);
  const segs = segsOf(perf.notes, bs, expr);
  for (const singer of makeSingers(sec, K, O, seed, clamp(num(s.tuning, 5), 0, 25), clamp(num(s.timing, 18), 0, 60), num(s.centre, 1) !== 0)) renderSinger(sec, singer, segs, lanes, bs, K, buses);
  // aspiration through the section's formants (singer 0's current shape), the air band, the inhales
  const fb = [new Tpt(), new Tpt(), new Tpt(), new Tpt()], fbR = [new Tpt(), new Tpt(), new Tpt(), new Tpt()], wts = [1, 0.7, 0.42, 0.26];
  const airHL = new Bq('hp', 5000, 0.7), airHR = new Bq('hp', 5000, 0.7), airLL = new Bq('lp', 13000, 0.7), airLR = new Bq('lp', 13000, 0.7);
  const inBL = new Bq('bp', 1800, 0.7), inBR = new Bq('bp', 1800, 0.7);
  const hpL = new Bq('hp', def.hp, 0.7), hpR = new Bq('hp', def.hp, 0.7);
  const eqL = def.eq.map(([k, f, g, q]) => new Bq(k, f, q, g)), eqR = def.eq.map(([k, f, g, q]) => new Bq(k, f, q, g));
  for (let b = 0; b * CR < n; b++) {
    for (let k = 0; k < 4; k++) { const f = buses.fMean[b * 4 + k] || [500, 1100, 2700, 3500][k]!; fb[k]!.set(f, f / [90, 110, 160, 220][k]!); fbR[k]!.set(f, f / [90, 110, 160, 220][k]!); }
    for (let i = b * CR; i < Math.min(n, (b + 1) * CR); i++) {
      let aL = 0, aR = 0; const xL = buses.aL[i]!, xR = buses.aR[i]!;
      for (let k = 0; k < 4; k++) { fb[k]!.tick(xL); fbR[k]!.tick(xR); aL += fb[k]!.bpn * wts[k]!; aR += fbR[k]!.bpn * wts[k]!; }
      let L = buses.L[i]! + aL * 0.9, R = buses.R[i]! + aR * 0.9;
      L = hpL.tick(L); R = hpR.tick(R);
      for (let e = 0; e < eqL.length; e++) { L = eqL[e]!.tick(L); R = eqR[e]!.tick(R); }
      L += airLL.tick(airHL.tick(buses.hL[i]!)) + inBL.tick(buses.iL[i]!);
      R += airLR.tick(airHR.tick(buses.hR[i]!)) + inBR.tick(buses.iR[i]!);
      buses.L[i] = L; buses.R[i] = R;
    }
  }
  dryCache.set(key, [buses.L.slice(), buses.R.slice()]);
  return [buses.L, buses.R];
}

function makeSection(def: SectionDef): LabInstrument {
  const render = (perf: PartPerformance, ctx: RenderContext, calibrating = false): Stereo => {
    const dry = renderSectionDry(def, perf, ctx), mode = calibrating ? 'dry' : str(perf.setup.output, 'mix');
    if (mode === 'dry') return dry;
    const s = perf.setup, bs = ctx.beatSeconds, depth = clamp(num(s.depth, 0.5), 0, 1), room = controlAt(perf, CONTROLS[6]!, BY_MACRO.room!);
    const sL = new Float64Array(dry[0].length), sR = new Float64Array(dry[0].length);
    for (let i = 0; i < sL.length; i++) { const gn = room(i / RATE / bs); sL[i] = dry[0][i]! * gn; sR[i] = dry[1][i]! * gn; }
    const wet = nave(sL, sR, { rt60: 2.2 + 3.8 * depth, size: 1 + 0.8 * depth, predelayMs: 18 + 40 * depth, lowCut: clamp(num(s.lowCut, 140), 40, 500), damp: 6500 - 2500 * depth,
      early: 0.7 - 0.3 * depth, late: 1, width: 1.1, seed: num(s.seed, 23) + 31 });
    if (mode === 'wet') return wet;
    for (let c = 0; c < 2; c++) for (let i = 0; i < dry[c]!.length; i++) dry[c]![i] = dry[c]![i]! + wet[c]![i]!;
    return dry;
  };
  return {
    id: def.id, family: 'heaven-mass', name: def.name, version: `${LAB_VERSION}+cathedral-experiment`,
    macro: { id: 'intimate-heavenly', label: 'intimate → heavenly', from: 'intimate', to: 'heavenly' },
    description: `${def.description} An ensemble of individually different singers (tuning, drift, vibrato, timing, tract, breath, seat) on an additive source-filter voice with this section's own formants; singers join as the ensemble grows; breath, air and the Nave.`,
    range: def.range, articulations: ARTICULATIONS, controls: CONTROLS,
    setup: [...SETUP, { name: 'output', min: 0, max: 0, description: '"mix" (default: voices plus the Nave), "dry" or "wet"' }],
    params: PARAMS, suggestedGainDb: -3,
    async render(perf, ctx) {
      const scale = await calibrated(def.id, async () => render(
        { notes: [{ beat: 0, beats: 2.4, pitch: def.ref, velocity: 0.8, params: { vowel: 'oh' } }], macro: 0, controls: {}, offsets: {}, expression: 0.7, setup: { seed: 1, centre: 0 }, breaths: [], motion: [] },
        { bpm: 120, beatSeconds: 0.5, swing: 0.5, key: { tonic: 9, mode: 'minor', label: 'A minor' }, seed: 1, frames: Math.round(1.6 * RATE), partIndex: 0 }, true), 0.3, 1.15);
      if (!perf.notes.length) return blank(ctx.frames);
      const st = render(perf, ctx);
      for (const c of st) for (let i = 0; i < c.length; i++) c[i] = c[i]! * scale;
      return st;
    },
  };
}

export const HEAVEN_MASS: LabInstrument[] = SECTIONS.map(makeSection);
export const HEAVEN_SECTIONS = SECTIONS;
