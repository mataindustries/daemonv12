/**
 * CATHEDRAL//ENGINE · a synthetic pipe organ in three divisions (whisper -> full organ).
 *
 * No recorded organ, no preset: every pipe that speaks is its own small model.
 *
 *   key -> (tracker delay) -> pipe valve opens -> SPEECH: each harmonic builds at its own rate (upper ones first, big
 *          pipes slower), a chiff burst over harmonics 2-8 plus mouth noise, a small pitch flare that settles
 *       -> STEADY: a rank-specific harmonic recipe (principal, stopped flute, open flute, string, trumpet, oboe, posaune,
 *          with per-pipe voicing scatter) at a slightly scattered tuning, alive with slow wind flutter
 *       -> RELEASE: the valve closes, harmonics die at their own rates, the pitch droops a few cents
 *
 * The pipes share one WIND SYSTEM per division: the wind they draw sags the reservoir pressure (second-order dynamics
 * with a little overshoot), so a big chord makes every sounding pipe a few cents flatter and a touch softer before it
 * recovers, and the tremulant shakes the same pressure. Ranks are drawstops with continuous levels (registration can
 * change mid-phrase); compound ranks are built pipe by pipe: the Mixture's ranks break back an octave when they climb
 * too high, the 32' is a resultant (16' + 10 2/3') with a little real 32' under it, the Celeste is a string pair
 * beating against itself. The Swell is ENCLOSED: its shades change both level and brightness. Pipes stand on the
 * C side or the C# side of their chest (the pedal in two towers), so a scale walks across the stereo field, and every
 * division can feed the NAVE, a large stone-space model whose tail is high-passed so the cathedral sits above an 808.
 * Deterministic (seeded); original code. Only the shared filters and the Nave come from common.ts.
 */
import { RATE, clamp, curveAt, smooth } from '../../../studio-001/rack/curves.ts';
import type { ControlSpec, NoteEvent, PartPerformance, RenderContext } from '../../../studio-001/rack/types.ts';
import { Bq, LAB_VERSION, Tpt, Wander, blank, calibrated, controlAt, dbAmp, fsin, gaussOf, hashSeed, hz, mulberry, nave, num, panLR, spec, str, win, type LabInstrument, type Stereo } from './common.ts';

const CR = 32, STEP = CR / RATE;

type Kind = 'principal' | 'octave' | 'narrow' | 'stopped' | 'flute' | 'string' | 'reed' | 'oboe' | 'bombarde' | 'sine';
interface SubPipe { ratio: number; kind: Kind; gain: number; cents: number; pan: number; weight: number }
interface RankDef { name: string; label: string; description: string; pipes: (midi: number) => SubPipe[] }
interface DivisionDef {
  id: string; name: string; range: [number, number]; description: string; ranks: RankDef[]; enclosed: boolean;
  center: number; width: number; towers: boolean; distance: number; byMacro: Record<string, (m: number) => number>; suggestedGainDb: number;
}

// ------------------------------------------------------------------ harmonic recipes and speech
const roll = (F: number, fc: number) => 1 / Math.sqrt(1 + (F / fc) ** 4);
const bump = (F: number, fc: number, oct: number, db: number) => 1 + (dbAmp(db) - 1) * Math.exp(-((Math.log2(F / fc) / oct) ** 2));
const MAXN: Record<Kind, number> = { principal: 16, octave: 14, narrow: 7, stopped: 9, flute: 6, string: 28, reed: 30, oboe: 26, bombarde: 30, sine: 1 };
function recipe(kind: Kind, n: number, F: number): number {
  switch (kind) {
    case 'principal': return Math.pow(n, -1.25) * (n === 2 ? 1.15 : n === 3 ? 0.9 : 1) * roll(F, 6500);
    case 'octave': return Math.pow(n, -1.15) * roll(F, 7500);
    case 'narrow': return Math.pow(n, -1.5) * roll(F, 7000);
    case 'stopped': return (n % 2 ? 1 : 0.04) * Math.pow(n, -1.45) * (n === 3 ? 1.25 : 1) * roll(F, 3200);
    case 'flute': return Math.pow(n, -2.2) * (n === 2 ? 1.4 : 1) * roll(F, 4000);
    case 'string': return Math.pow(n, -0.8) * bump(F, 2400, 1, 5) * roll(F, 9000) * (n === 1 ? 0.7 : 1);
    case 'reed': return Math.pow(n, -0.55) * bump(F, 1500, 1.2, 6) * roll(F, 7000) * (n === 1 ? 0.8 : 1);
    case 'oboe': return Math.pow(n, -0.75) * bump(F, 1100, 0.9, 7) * roll(F, 5500) * (n === 1 ? 0.45 : 1);
    case 'bombarde': return Math.pow(n, -0.6) * bump(F, 900, 1.2, 5) * roll(F, 5000) * (n === 1 ? 0.9 : 1);
    default: return n === 1 ? 1 : 0;
  }
}
interface Speech { tau: number; exp: number; chiff: number; chiffTau: number; lo: number; hi: number; flare: number; flareTau: number; breath: number; band: number; flue: boolean; offTau: number }
const SPEECH: Record<Kind, Speech> = {
  principal: { tau: 0.03, exp: 0.45, chiff: 0.55, chiffTau: 0.035, lo: 2, hi: 8, flare: -8, flareTau: 0.03, breath: 0.006, band: 4, flue: true, offTau: 0.025 },
  octave: { tau: 0.026, exp: 0.45, chiff: 0.5, chiffTau: 0.032, lo: 2, hi: 8, flare: -7, flareTau: 0.03, breath: 0.006, band: 4, flue: true, offTau: 0.022 },
  narrow: { tau: 0.022, exp: 0.4, chiff: 0.45, chiffTau: 0.03, lo: 2, hi: 6, flare: -6, flareTau: 0.025, breath: 0.004, band: 3.5, flue: true, offTau: 0.02 },
  stopped: { tau: 0.036, exp: 0.45, chiff: 0.95, chiffTau: 0.028, lo: 2, hi: 7, flare: -5, flareTau: 0.03, breath: 0.012, band: 3, flue: true, offTau: 0.03 },
  flute: { tau: 0.032, exp: 0.45, chiff: 0.85, chiffTau: 0.03, lo: 2, hi: 5, flare: -6, flareTau: 0.03, breath: 0.016, band: 2.5, flue: true, offTau: 0.028 },
  string: { tau: 0.07, exp: 0.4, chiff: 0.45, chiffTau: 0.06, lo: 2, hi: 10, flare: 5, flareTau: 0.05, breath: 0.004, band: 5, flue: true, offTau: 0.03 },
  reed: { tau: 0.012, exp: 0.3, chiff: 0.75, chiffTau: 0.04, lo: 3, hi: 12, flare: 12, flareTau: 0.04, breath: 0.002, band: 6, flue: false, offTau: 0.016 },
  oboe: { tau: 0.016, exp: 0.3, chiff: 0.55, chiffTau: 0.04, lo: 3, hi: 10, flare: 9, flareTau: 0.04, breath: 0.002, band: 5, flue: false, offTau: 0.016 },
  bombarde: { tau: 0.024, exp: 0.3, chiff: 0.65, chiffTau: 0.05, lo: 2, hi: 10, flare: 10, flareTau: 0.05, breath: 0.002, band: 5, flue: false, offTau: 0.02 },
  sine: { tau: 0.09, exp: 0.4, chiff: 0, chiffTau: 0.03, lo: 2, hi: 2, flare: 0, flareTau: 0.03, breath: 0, band: 2, flue: true, offTau: 0.05 },
};

// ------------------------------------------------------------------ ranks and divisions
const sp = (ratio: number, kind: Kind, gain: number, weight: number, cents = 0, pan = 0): SubPipe => ({ ratio, kind, gain, cents, pan, weight });
const simple = (name: string, label: string, description: string, ratio: number, kind: Kind, gain: number, weight: number): RankDef =>
  ({ name, label, description, pipes: () => [sp(ratio, kind, gain, weight)] });
/** Mixture IV: 2', 1 1/3', 1', 2/3', each breaking back an octave whenever its pipe would sound above 3.3 kHz. */
const MIXTURE: RankDef = {
  name: 'mixture', label: "Mixture IV", description: "compound crown: four high principal ranks (2', 1 1/3', 1', 2/3') that break back an octave above 3.3 kHz",
  pipes: midi => [4, 6, 8, 12].map((r, k) => { let ratio = r; while (hz(midi) * ratio > 3300 && ratio > 2) ratio /= 2; return sp(ratio, 'narrow', 0.3, 0.35, 0, (k - 1.5) * 0.07); }),
};
const GREAT: RankDef[] = [
  simple('bourdon16', "Bourdon 16'", 'stopped wood an octave below: gravity under the chorus', 0.5, 'stopped', 0.62, 1.5),
  simple('principal8', "Principal 8'", 'the backbone: open metal diapason', 1, 'principal', 1, 1),
  simple('octave4', "Octave 4'", 'principal an octave up', 2, 'octave', 0.68, 0.6),
  simple('twelfth', "Twelfth 2 2/3'", 'narrow principal at the twelfth (3rd harmonic)', 3, 'narrow', 0.42, 0.4),
  simple('fifteenth', "Fifteenth 2'", 'principal two octaves up', 4, 'narrow', 0.48, 0.4),
  MIXTURE,
  simple('trumpet8', "Trumpet 8'", 'chorus reed: brass fire', 1, 'reed', 0.82, 1.3),
];
const SWELL: RankDef[] = [
  simple('gedackt8', "Gedackt 8'", 'stopped flute: round, hooty, chiffy', 1, 'stopped', 0.72, 0.8),
  { name: 'celeste8', label: "Viole Celeste 8' II", description: 'string pair, the second rank tuned sharp: a slow shimmer', pipes: () => [sp(1, 'string', 0.42, 0.5, 0, -0.06), sp(1, 'string', 0.42, 0.5, 6.5, 0.06)] },
  simple('flute4', "Flute 4'", 'open flute an octave up', 2, 'flute', 0.45, 0.5),
  simple('hautbois8', "Hautbois 8'", 'soft nasal reed', 1, 'oboe', 0.6, 0.9),
];
const PEDAL: RankDef[] = [
  { name: 'contra32', label: "Contra 32' (resultant)", description: "resultant 32': a 16' and a 10 2/3' whose difference tone is the 32', with a little real 32' under it", pipes: () => [sp(0.5, 'stopped', 0.6, 1.4), sp(0.75, 'stopped', 0.34, 0.9), sp(0.25, 'sine', 0.42, 0.6)] },
  simple('subbass16', "Subbass 16'", 'stopped wood: round deep fundamental', 0.5, 'stopped', 1, 1.6),
  simple('octave8', "Octave 8'", 'pedal principal: definition an octave up', 1, 'principal', 0.62, 0.8),
  simple('posaune16', "Posaune 16'", 'pedal reed: the floor shakes', 0.5, 'bombarde', 0.92, 1.8),
];
const lvl = (from: number, to: number, max = 1) => (m: number) => max * win(m, from, to);
const DIVISIONS: DivisionDef[] = [
  {
    id: 'cathedral-engine/great', name: 'CATHEDRAL//ENGINE Great', range: [36, 96], enclosed: false, center: 0, width: 0.62, towers: false, distance: 1, suggestedGainDb: -6,
    description: 'Unenclosed main division: principal chorus 8-4-2 2/3-2, Mixture IV, Bourdon 16\' and Trumpet 8\'.',
    ranks: GREAT,
    byMacro: { principal8: () => 0.78, octave4: lvl(0.12, 0.3, 0.85), fifteenth: lvl(0.3, 0.48, 0.85), twelfth: lvl(0.42, 0.58, 0.8), mixture: lvl(0.52, 0.72), bourdon16: lvl(0.6, 0.78, 0.8), trumpet8: lvl(0.72, 0.92) },
  },
  {
    id: 'cathedral-engine/swell', name: 'CATHEDRAL//ENGINE Swell', range: [36, 96], enclosed: true, center: 0.08, width: 0.4, towers: false, distance: 1.35, suggestedGainDb: -6,
    description: "Enclosed division behind the Great: Gedackt 8', Viole Celeste II, Flute 4', Hautbois 8'; its shades change level and brightness.",
    ranks: SWELL,
    byMacro: { gedackt8: () => 0.9, celeste8: lvl(0.08, 0.28, 0.9), flute4: lvl(0.25, 0.45, 0.8), hautbois8: lvl(0.45, 0.7, 0.9) },
  },
  {
    id: 'cathedral-engine/pedal', name: 'CATHEDRAL//ENGINE Pedal', range: [36, 67], enclosed: false, center: 0, width: 1, towers: true, distance: 0.9, suggestedGainDb: -6,
    description: "Pedal towers left and right: Contra 32' (resultant), Subbass 16', Octave 8', Posaune 16'. Written at 8' pitch (C2-G4): a written F2 sounds F1 on the 16'.",
    ranks: PEDAL,
    byMacro: { subbass16: () => 0.9, octave8: lvl(0.15, 0.35, 0.85), contra32: lvl(0.45, 0.65, 0.9), posaune16: lvl(0.65, 0.85, 0.9) },
  },
];

const COMMON_CONTROLS: ControlSpec[] = [
  spec('swell', 0, 1, 'swell shades (enclosed division): 0 closed (soft, dark) .. 1 open; expression rides on top'),
  spec('wind', 0, 1, 'wind flexibility: how far big chords sag the pressure (0 = rock steady)'),
  spec('trem', 0, 1, 'tremulant depth (shakes the shared wind)'),
  spec('chiff', 0, 2, 'speech transient intensity (chiff, blat, mouth noise)'),
  spec('space', 0, 1.5, 'send to the Nave (wet level in mix/wet output)'),
];
const CONTROL_DEFAULTS: Record<string, (m: number) => number> = { swell: m => 0.15 + 0.85 * m, wind: () => 0.45, trem: () => 0, chiff: () => 1, space: () => 0.45 };
const SETUP: ControlSpec[] = [
  spec('seed', 0, 4294967295, 'random seed (pipe voicing, tuning scatter, key action, wind flutter)'),
  spec('rt60', 1.5, 10, 'Nave reverberation time in seconds'),
  spec('size', 0.6, 2.2, 'Nave size (delay scale)'),
  spec('predelay', 5, 150, 'Nave pre-delay in ms'),
  spec('lowCut', 40, 500, 'high-pass on the Nave tail in Hz (keeps the cathedral off the 808)'),
  spec('damp', 1500, 14000, 'Nave high-frequency damping in Hz'),
  spec('width', 0, 1.3, 'stereo width of the chest layout and the Nave'),
  spec('tuning', 0, 6, 'pipe tuning scatter in cents'),
  spec('lowMono', 0, 400, 'below this frequency (Hz) the division is mono, centred for a trap mix (default 140 pedal, 110 manuals; 0 = the pure chest layout)'),
];
const ARTICULATIONS: Record<string, string> = {
  normal: 'organ legato touch (gate 98 %)', detached: 'non-legato (gate 78 %)', staccato: 'short (gate 45 %)',
  soft: 'slow key: gentler, slower speech, little chiff', marcato: 'fast key: crisp speech, strong chiff and reed blat',
};
const PARAMS: Record<string, string> = {
  sag: 'cents the note droops over its last 40 % as the key is let up slowly (pallet half closed), max 100',
  cents: 'fine tuning of this note in cents', chiff: 'speech transient multiplier for this note',
};

// ------------------------------------------------------------------ rendering
interface Pipe { on: number; off: number; f: number; kind: Kind; gain: number; pan: number; weight: number; rank: number; vel: number; art: string; sag: number; chiffMul: number; seed: number; midi: number }
type Lanes = Record<string, (beat: number) => number>;

function pipesOf(def: DivisionDef, notes: NoteEvent[], bs: number, lanes: Lanes, seed: number, tuning: number, width: number): Pipe[] {
  const out: Pipe[] = [];
  notes.forEach((n, ni) => {
    const r = mulberry(hashSeed(seed, ni, n.pitch, n.beat)), g = gaussOf(r), art = n.articulation ?? 'normal', p = n.params ?? {};
    const gate = art === 'detached' ? 0.78 : art === 'staccato' ? 0.45 : 0.98;
    const keyDelay = r() * 0.006 * (art === 'soft' ? 1.6 : art === 'marcato' ? 0.5 : 1), on0 = n.beat * bs + keyDelay, off = n.beat * bs + n.beats * bs * gate;
    def.ranks.forEach((rank, ri) => {
      const lane = lanes[rank.name]!;
      let any = false; for (let k = 0; k <= 16 && !any; k++) if (lane(n.beat + (n.beats * k) / 16) > 0.002) any = true;
      if (!any) return;
      rank.pipes(n.pitch).forEach((s, si) => {
        const side = n.pitch % 2 === 0 ? -1 : 1;
        const pan = def.towers ? side * (0.74 + 0.2 * clamp((67 - n.pitch) / 31, 0, 1))
          : def.center + side * def.width * (0.12 + 0.78 * (1 - clamp((n.pitch - 36) / 60, 0, 1))) + 0.05 * ((ri % 3) - 1) + s.pan;
        const cents = s.cents + num(p.cents, 0) + g() * tuning;
        out.push({ on: on0 + r() * 0.0025, off, f: hz(n.pitch) * s.ratio * Math.pow(2, cents / 1200), kind: s.kind, gain: s.gain, pan: clamp(pan * width, -1, 1),
          weight: s.weight, rank: ri, vel: n.velocity, art, sag: Math.min(100, Math.max(0, num(p.sag, 0))), chiffMul: num(p.chiff, 1), seed: hashSeed(seed, ni, ri, si, n.pitch), midi: n.pitch });
      });
    });
  });
  return out;
}

/** Shared wind pressure at control rate: demand from every open pipe sags the reservoir (2nd-order, slight overshoot). */
function windPressure(pipes: Pipe[], lanes: Lanes, def: DivisionDef, bs: number, blocks: number, seed: number): Float64Array {
  const demand = new Float64Array(blocks);
  for (const p of pipes) {
    const b0 = Math.max(0, Math.floor(p.on / STEP)), b1 = Math.min(blocks, Math.ceil((p.off + 0.05) / STEP)), lane = lanes[def.ranks[p.rank]!.name]!;
    for (let b = b0; b < b1; b++) demand[b] = demand[b]! + p.weight * lane((b * STEP) / bs);
  }
  const P = new Float64Array(blocks), w = 2 * Math.PI * 3.2, z = 0.45, flutter = new Wander(seed + 77, 1.3, STEP);
  let s = 0, v = 0;
  for (let b = 0; b < blocks; b++) {
    const beat = (b * STEP) / bs, wind = lanes.wind!(beat), trem = lanes.trem!(beat), D = demand[b]!;
    const target = wind * 0.05 * D / (D + 8);
    const a = w * w * (target - s) - 2 * z * w * v; v += a * STEP; s += v * STEP;
    P[b] = 1 - s + trem * 0.032 * Math.sin(2 * Math.PI * 5.7 * b * STEP) + wind * 0.0016 * flutter.next();
  }
  return P;
}

function renderPipe(p: Pipe, P: Float64Array, lane: (beat: number) => number, chiffLane: (beat: number) => number, bs: number, L: Float64Array, R: Float64Array) {
  const sp0 = SPEECH[p.kind], r = mulberry(p.seed), g = gaussOf(r), frames = L.length;
  const f0 = p.f, H: number[] = [];
  for (let n = 1; n <= MAXN[p.kind]; n++) { if (n * f0 > 11500) break; H.push(recipe(p.kind, n, n * f0) * Math.pow(10, 0.075 * g())); }
  if (!H.length) return;
  let ss = 0; for (const a of H) ss += a * a;
  const norm = p.gain / Math.sqrt(ss), Hn = H.length;
  const touch = p.art === 'soft' ? 1.6 : p.art === 'marcato' ? 0.7 : 1.25 - 0.4 * p.vel;
  const tau1 = clamp(sp0.tau * Math.pow(220 / f0, sp0.exp), sp0.tau * 0.4, sp0.tau * 5) * touch;
  const tauN = H.map((_, k) => tau1 * Math.pow(k + 1, -0.55)), offTau = sp0.offTau * Math.pow(Math.max(0.3, 220 / f0), 0.3);
  const chiffBase = sp0.chiff * p.chiffMul * (p.art === 'soft' ? 0.4 : p.art === 'marcato' ? 1.5 : 0.6 + 0.6 * p.vel);
  const prof = H.map((_, k) => { const n = k + 1; return n >= sp0.lo && n <= sp0.hi ? 1.8 * Math.exp(-(((n - (sp0.lo + sp0.hi) / 2) / ((sp0.hi - sp0.lo) / 2 + 0.8)) ** 2)) : 0; });
  const phase = H.map(() => r()), cur = new Float64Array(Hn), nxt = new Float64Array(Hn);
  const nf = new Tpt().set(Math.min(9000, sp0.band * f0), 1.4), flut = new Wander(p.seed + 5, 0.9, STEP), pw = new Wander(p.seed + 9, 0.6, STEP);
  const [gl, gr] = panLR(p.pan), sens = sp0.flue ? 300 : 80, aExp = sp0.flue ? 1.5 : 2;
  const startB = Math.max(0, Math.floor(p.on / STEP)), endT = p.off + 6 * offTau + 0.05, endB = Math.min(Math.ceil(endT / STEP), Math.floor(frames / CR));
  let speakAt = -1, lvlS = 0, nzS = 0, nzN = 0, fNow = f0;
  const noise = mulberry(p.seed ^ 0x9e3779b9);
  for (let b = startB; b < endB; b++) {
    const t = b * STEP, beat = t / bs, level = lane(beat);
    if (speakAt < 0) { if (t >= p.on && level > 0.02) speakAt = t; else continue; }
    lvlS += (level - lvlS) * 0.08;
    const age = t - speakAt, Pb = P[Math.min(P.length - 1, b)]!, released = t > p.off, ch = chiffBase * chiffLane(beat);
    // pitch: onset flare, wind, slow wander, slow key-up sag, release droop
    let cents = sp0.flare * Math.exp(-age / sp0.flareTau) + sens * (Pb - 1) + 0.35 * pw.next();
    if (p.sag > 0) { const x = clamp((t - (p.off - 0.4 * (p.off - p.on))) / (0.4 * (p.off - p.on)), 0, 1); cents -= p.sag * x * x; }
    if (released) cents -= 6 * (1 - Math.exp(-(t - p.off) / 0.04));
    fNow = f0 * Math.pow(2, cents / 1200);
    const amp = norm * lvlS * Math.pow(Math.max(0.5, Pb), aExp) * (1 + 0.03 * flut.next()) * (p.sag > 0 ? 1 - 0.004 * Math.max(0, -cents) : 1);
    const chiffT = Math.exp(-age / sp0.chiffTau) * (1 - Math.exp(-age / 0.004));
    for (let k = 0; k < Hn; k++) {
      let e = 1 - Math.exp(-age / tauN[k]!);
      e *= 1 + ch * prof[k]! * chiffT;
      if (released) e *= Math.exp(-(t - p.off) / (offTau * Math.pow(k + 1, -0.3)));
      nxt[k] = H[k]! * amp * e;
    }
    nzN = amp * (ch * 0.22 * Math.exp(-age / (sp0.chiffTau * 0.8)) + sp0.breath) * (released ? Math.exp(-(t - p.off) / 0.02) : 1);
    if (b === Math.max(startB, Math.floor(speakAt / STEP))) { cur.set(nxt); nzS = 0; }
    const i0 = b * CR;
    for (let j = 0; j < CR; j++) {
      const i = i0 + j, x = j / CR;
      let v = 0;
      for (let k = 0; k < Hn; k++) {
        const a = cur[k]! + (nxt[k]! - cur[k]!) * x;
        phase[k] = phase[k]! + fNow * (k + 1) / RATE;
        v += a * fsin(phase[k]!);
      }
      const nz = nzS + (nzN - nzS) * x;
      if (nz > 1e-7) { nf.tick(noise() * 2 - 1); v += nz * nf.bpn * 1.6; }
      L[i] = L[i]! + v * gl; R[i] = R[i]! + v * gr;
    }
    for (let k = 0; k < Hn; k++) phase[k] = phase[k]! - Math.floor(phase[k]!);
    cur.set(nxt); nzS = nzN;
  }
}

const dryCache = new Map<string, Stereo>();
async function renderDivision(def: DivisionDef, perf: PartPerformance, ctx: RenderContext): Promise<{ dry: Stereo; setup: Record<string, number | string> }> {
  const bs = ctx.beatSeconds, s = perf.setup;
  const lanes: Lanes = {};
  for (const r of def.ranks) lanes[r.name] = controlAt(perf, spec(r.name, 0, 1, ''), def.byMacro[r.name] ?? (() => 0));
  for (const c of COMMON_CONTROLS) lanes[c.name] = controlAt(perf, c, CONTROL_DEFAULTS[c.name]!);
  const seed = num(s.seed, ctx.seed + 101 * ctx.partIndex), tuning = clamp(num(s.tuning, 1.2), 0, 6), width = clamp(num(s.width, 1), 0, 1.3);
  const key = JSON.stringify([def.id, perf.notes, perf.macro, perf.controls, perf.offsets, perf.expression, seed, tuning, width, s.lowMono, ctx.frames, bs]);
  const hit = dryCache.get(key);
  if (hit) return { dry: [hit[0].slice(), hit[1].slice()], setup: s as Record<string, number | string> };
  const L = new Float64Array(ctx.frames), R = new Float64Array(ctx.frames), blocks = Math.ceil(ctx.frames / CR) + 1;
  const pipes = pipesOf(def, perf.notes, bs, lanes, seed, tuning, width);
  const P = windPressure(pipes, lanes, def, bs, blocks, seed);
  for (const p of pipes) renderPipe(p, P, lanes[def.ranks[p.rank]!.name]!, lanes.chiff!, bs, L, R);
  // QA fix F1: the chest layout puts each fundamental on its side (a pedal F stands in the right tower), which left the
  // bar-12 low end 15 dB lopsided in the trap mix. Below `lowMono` Hz the side signal is removed (Linkwitz-Riley
  // 4th-order low-pass of S = (L - R) / 2): the lows sit in the middle, the layout is kept above.
  const lowMono = clamp(num(s.lowMono, def.towers ? 140 : 110), 0, 400);
  if (lowMono > 0) {
    // zero-phase (forward and backward) so that S - LP(S) is an exact complement: a minimum-phase low-pass lags ~52
    // degrees at 44 Hz for a 140 Hz split, which left the side only 1 dB down there (measured; the first version of F1)
    const S = new Float64Array(L.length);
    for (let i = 0; i < L.length; i++) S[i] = 0.5 * (L[i]! - R[i]!);
    new Bq('lp', lowMono, Math.SQRT1_2).run(S); new Bq('lp', lowMono, Math.SQRT1_2).run(S); S.reverse();
    new Bq('lp', lowMono, Math.SQRT1_2).run(S); new Bq('lp', lowMono, Math.SQRT1_2).run(S); S.reverse();
    for (let i = 0; i < L.length; i++) { L[i] = L[i]! - S[i]!; R[i] = R[i]! + S[i]!; }
  }
  // expression and (for the enclosed division) the swell box: level and brightness from the shades
  const expr = (b: number) => curveAt(perf.expression, b);
  const lpL = new Tpt(), lpR = new Tpt();
  for (let b = 0; b * CR < ctx.frames; b++) {
    const beat = (b * STEP) / bs, ex = expr(beat);
    let gain = 1 + 0.35 * (ex - 0.7), cutoff = 0;
    if (def.enclosed) { const sw = clamp(lanes.swell!(beat) + 0.8 * (ex - 0.7), 0, 1); gain = 0.13 + 0.87 * Math.pow(sw, 1.6); cutoff = 700 * Math.pow(20, sw); lpL.set(cutoff, 0.6); lpR.set(cutoff, 0.6); }
    for (let i = b * CR; i < Math.min(ctx.frames, (b + 1) * CR); i++) {
      if (def.enclosed) { L[i] = lpL.tick(L[i]!) * gain; R[i] = lpR.tick(R[i]!) * gain; } else { L[i] = L[i]! * gain; R[i] = R[i]! * gain; }
    }
  }
  const dry: Stereo = [L, R];
  dryCache.set(key, [L.slice(), R.slice()]);
  return { dry, setup: s as Record<string, number | string> };
}

function naveFor(def: DivisionDef, dry: Stereo, perf: PartPerformance, ctx: RenderContext): Stereo {
  const s = perf.setup, bs = ctx.beatSeconds, spaceLane = controlAt(perf, COMMON_CONTROLS[4]!, CONTROL_DEFAULTS.space!);
  const sendL = new Float64Array(dry[0].length), sendR = new Float64Array(dry[1].length);
  for (let i = 0; i < sendL.length; i++) { const g = spaceLane(i / RATE / bs) * def.distance; sendL[i] = dry[0][i]! * g; sendR[i] = dry[1][i]! * g; }
  return nave(sendL, sendR, {
    rt60: clamp(num(s.rt60, 5.2), 1.5, 10), size: clamp(num(s.size, 1.6), 0.6, 2.2), predelayMs: clamp(num(s.predelay, 48), 5, 150),
    lowCut: clamp(num(s.lowCut, 170), 40, 500), damp: clamp(num(s.damp, 4800), 1500, 14000), width: clamp(num(s.width, 1), 0, 1.3),
    early: 0.5 * def.distance, late: 1, seed: num(s.seed, 4099) + 17,
  });
}

function makeDivision(def: DivisionDef): LabInstrument {
  const controls = [...def.ranks.map(r => spec(r.name, 0, 1, `${r.label}: ${r.description}`)), ...COMMON_CONTROLS];
  const render = async (perf: PartPerformance, ctx: RenderContext, calibrating = false): Promise<Stereo> => {
    const { dry } = await renderDivision(def, perf, ctx), mode = calibrating ? 'dry' : str(perf.setup.output, 'mix');
    if (mode === 'dry') return dry;
    const wet = naveFor(def, dry, perf, ctx);
    if (mode === 'wet') return wet;
    for (let c = 0; c < 2; c++) for (let i = 0; i < dry[c]!.length; i++) dry[c]![i] = dry[c]![i]! + wet[c]![i]!;
    return dry;
  };
  return {
    id: def.id, family: 'cathedral-engine', name: def.name, version: `${LAB_VERSION}+cathedral-experiment`,
    macro: { id: 'whisper-full-organ', label: 'whisper → full organ', from: 'whisper', to: 'full organ' },
    description: `${def.description} Pipe-by-pipe synthesis: per-harmonic speech, chiff and mouth noise, voicing and tuning scatter, a shared wind system that sags under big chords, C/C# chest layout, and the Nave space (high-passed tail). The macro is a crescendo pedal: stops enter in order.`,
    range: def.range, articulations: ARTICULATIONS, controls,
    setup: [...SETUP, { name: 'output', min: 0, max: 0, description: '"mix" (default: pipes plus the Nave), "dry" (pipes only) or "wet" (the Nave only)' }],
    params: PARAMS, suggestedGainDb: def.suggestedGainDb,
    async render(perf, ctx) {
      // reference: macro 0 (the first stops of the crescendo); an enclosed division with its shades open, so that
      // closing the box reads as quieter than nominal, as an expression pedal should; the raw chest (no low-mono crossover)
      const scale = await calibrated(def.id, () => render(
        { notes: [{ beat: 0, beats: 2.4, pitch: def.id.endsWith('pedal') ? 45 : 69, velocity: 0.8 }], macro: 0, controls: def.enclosed ? { swell: 1 } : {}, offsets: {}, expression: 0.7, setup: { seed: 1, lowMono: 0 }, breaths: [], motion: [] },
        { bpm: 120, beatSeconds: 0.5, swing: 0.5, key: { tonic: 9, mode: 'minor', label: 'A minor' }, seed: 1, frames: Math.round(1.6 * RATE), partIndex: 0 }, true), 0.25, 1.15);
      if (!perf.notes.length) return blank(ctx.frames);
      const st = await render(perf, ctx);
      for (const c of st) for (let i = 0; i < c.length; i++) c[i] = c[i]! * scale;
      return st;
    },
  };
}

export const CATHEDRAL_ENGINE: LabInstrument[] = DIVISIONS.map(makeDivision);
export const CATHEDRAL_DIVISIONS = DIVISIONS;
export { smooth };
