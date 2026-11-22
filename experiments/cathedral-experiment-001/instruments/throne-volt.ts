/**
 * THRONE//VOLT · an analog-style lead and polysynth (smoulder -> blaze).
 *
 * Each voice is a small analog circuit, simulated at twice the rack rate:
 *
 *   saw A (master) ---------+
 *   saw B (+det, left)  ----+
 *   saw B' (-det, right) ---+--> hot mixer (soft clip) --> 2-pole high-pass --> 4-pole ladder (resonance, drive,
 *   saw S hard-synced to A -+        ^ audio-rate cutoff FM from the sub ("growl")      key-tracked, enveloped)
 *   square C, an octave down+                                                     --> throat (two soft vowel peaks)
 *                                                                                 --> VCA --> asymmetric tube ("heat")
 *
 * Everything an analog player leans on is modelled rather than faked with effects: oscillators drift independently
 * (slow random walk) and every fresh attack lands a few cents off and settles; an accent sags the supply for a moment;
 * portamento is an RC lag; the sync oscillator's ratio rides the filter envelope (a vowel-like scream); a held note
 * blooms (the filter opens a little and the vibrato arrives late) instead of dying; a release closes the filter as it
 * fades. Discontinuities of every oscillator, including sync resets, are band-limited with a one-sample-delayed
 * polyBLEP. Polyphonic: chords are separate voices; a legato note continues the voice nearest in pitch, so chord
 * changes glide voice by voice. Deterministic (seeded noise and drift only); no samples, no presets.
 */
import { RATE, clamp, curveAt, smooth } from '../../../studio-001/rack/curves.ts';
import type { ControlSpec, NoteEvent, PartPerformance, RenderContext } from '../../../studio-001/rack/types.ts';
import { LAB_VERSION, Tpt, Wander, blank, calibrated, controlAt, dcBlock, expMap, hashSeed, hz, labDsp, mulberry, num, spec, win, type LabDsp, type LabInstrument, type Stereo } from './common.ts';

const OS = 2, FS = RATE * OS, CR = 8, STEP = CR / FS;

export const THRONE_CONTROLS: ControlSpec[] = [
  spec('cutoff', 60, 14000, 'ladder cutoff in Hz at C4 (key-tracked from there)'),
  spec('res', 0, 3.9, 'ladder resonance (about 4 self-oscillates)'),
  spec('env', 0, 6, 'filter envelope depth in octaves (scaled by velocity)'),
  spec('drive', 0, 1, 'mixer and ladder input drive: thickness and grit before the filter'),
  spec('heat', 0, 1, 'asymmetric tube saturation after the VCA: even harmonics, density'),
  spec('sync', 0, 1, 'level and sweep of the hard-synced oscillator: the vocal scream'),
  spec('detune', 0, 30, 'partner oscillators, cents either side of the master'),
  spec('sub', 0, 1, 'square an octave below'),
  spec('growl', 0, 1, 'audio-rate filter FM from the sub: a snarl inside the tone'),
  spec('vib', 0, 45, 'vibrato depth in cents (arrives late in a held note)'),
  spec('bloom', 0, 1, 'held notes open up over about two seconds'),
  spec('width', 0, 1, 'partner oscillators split left/right (0 = mono)'),
  spec('air', 0, 1, 'breath of noise in the attack'),
  spec('vowel', 0, 1, 'two soft throat peaks (an open "aw") mixed after the filter'),
];
const BY_MACRO: Record<string, (m: number) => number> = {
  cutoff: m => expMap(m, 440, 2900), res: m => 0.9 + 1.4 * m, env: m => 1.7 + 1.5 * m, drive: m => 0.25 + 0.55 * m,
  heat: m => 0.2 + 0.45 * m, sync: m => 0.55 * win(m, 0.3, 0.9), detune: m => 6 + 5 * m, sub: m => 0.45 + 0.15 * m,
  growl: m => 0.2 * win(m, 0.6, 1), vib: m => 7 + 5 * m, bloom: () => 0.5, width: m => 0.45 + 0.35 * m, air: m => 0.15 + 0.1 * m,
  vowel: m => 0.12 + 0.13 * m,
};
export const THRONE_ARTICULATIONS: Record<string, string> = {
  normal: 'velocity-shaped attack (harder = faster and brighter), gate 97 %',
  accent: 'hard attack: the filter spikes, the supply sags a few cents and recovers',
  legato: 'no new attack: the voice glides from the previous pitch (slide in beats, else setup glide) and the filter re-blooms a little',
  swell: 'slow brass-like swell of level and filter (about half a second)',
  stab: 'short and punchy (40 % gate)',
  scoop: 'starts below and rises into the pitch (param scoop, semitones, default 1.5)',
  fall: 'the pitch falls away at the end of the note, accelerating like a moan (param fall, semitones, default 3)',
};
export const THRONE_SETUP: ControlSpec[] = [
  spec('seed', 0, 4294967295, 'random seed (drift, slop, noise)'),
  spec('glide', 0.005, 1, 'default portamento time in seconds for legato notes without a slide'),
  spec('attack', 0.001, 0.2, 'base attack time in seconds (velocity shortens it)'),
  spec('release', 0.02, 3, 'release time in seconds (the filter closes with it)'),
  spec('vibRate', 3, 8, 'vibrato rate in Hz'),
  spec('drift', 0, 20, 'oscillator drift and attack slop in cents'),
  spec('keytrack', 0, 1, 'how far the cutoff follows the keyboard'),
  spec('lowcut', 30, 400, 'high-pass before the ladder in Hz (keeps the lows for the 808)'),
];
export const THRONE_PARAMS: Record<string, string> = {
  scoop: 'semitones to rise from on a fresh attack', fall: 'semitones the pitch falls over the end of the note', fallBeats: 'length of the fall in beats (default: the last 45 % of the note, at most 1.5 beats)',
  cents: 'fine tuning of this note in cents (e.g. just-intoned chord tones)',
};

interface Seg { t0: number; end: number; t1: number; pitch: number; vel: number; art: string; glide: number; scoop: number; fall: number; fallDur: number }
interface Chain { segs: Seg[] }

/** Group notes into voices: a legato note continues the sounding voice nearest in pitch; anything else starts one. */
export function chainsOf(notes: NoteEvent[], bs: number, defGlide: number, expr: (b: number) => number): Chain[] {
  const chains: Chain[] = [], claimed = new Map<Chain, number>();
  for (const n of [...notes].sort((a, b) => a.beat - b.beat || a.pitch - b.pitch)) {
    const art = n.articulation ?? 'normal', t0 = n.beat * bs, len = n.beats * bs;
    const v = clamp(n.velocity * (0.55 + 0.65 * expr(n.beat)), 0, 1);
    const p = n.params ?? {}, fall = art === 'fall' || typeof p.fall === 'number' ? num(p.fall, 3) : 0;
    const fallDur = fall ? (typeof p.fallBeats === 'number' ? p.fallBeats * bs : Math.min(1.5 * bs, 0.45 * len)) : 0;
    const seg: Seg = { t0, end: t0 + len, t1: t0 + len * (art === 'stab' ? 0.4 : 0.97), pitch: n.pitch + num(p.cents, 0) / 100, vel: v, art,
      glide: n.slide !== undefined ? Math.max(0.004, n.slide * bs) : defGlide, scoop: art === 'scoop' || typeof p.scoop === 'number' ? num(p.scoop, 1.5) : 0, fall, fallDur };
    const legato = art === 'legato' || n.slide !== undefined;
    let best: Chain | undefined, bestD = Infinity;
    if (legato) for (const c of chains) {
      const last = c.segs[c.segs.length - 1]!;
      if (last.end < t0 - 0.03 || last.t0 >= t0 - 1e-6 || claimed.get(c) === t0) continue;
      const d = Math.abs(last.pitch - seg.pitch); if (d < bestD) { bestD = d; best = c; }
    }
    if (best) { const last = best.segs[best.segs.length - 1]!; last.t1 = Math.max(last.t1, t0); best.segs.push(seg); claimed.set(best, t0); }
    else { const c = { segs: [seg] }; chains.push(c); claimed.set(c, t0); }
  }
  return chains;
}

/** One-sample-delayed polyBLEP for a single oscillator: `prev` is final once the next sample has been stepped. */
class Bl {
  prev = 0; cur = 0;
  next(naive: number) { this.prev = this.cur; this.cur = naive; }
  jump(J: number, d: number) { this.prev += J * d * d * 0.5; this.cur -= J * (1 - d) * (1 - d) * 0.5; }
}

type Lanes = Record<string, (beat: number) => number>;
interface VoltOptions { seed: number; glide: number; attack: number; release: number; vibRate: number; drift: number; keytrack: number; lowcut: number }

function renderChain(D: LabDsp, chain: Chain, lanes: Lanes, expr: (b: number) => number, bs: number, o: VoltOptions, seed: number, outL: Float64Array, outR: Float64Array) {
  const segs = chain.segs, first = segs[0]!, last = segs[segs.length - 1]!;
  const rel = o.release, tailEnd = last.t1 + rel * 5 + 0.05;
  const i0 = Math.max(0, Math.floor(first.t0 * FS)), i1 = Math.min(outL.length, Math.ceil(tailEnd * FS));
  if (i1 <= i0) return;
  const rnd = mulberry(seed), noise = mulberry(seed ^ 0x5bd1e995);
  const wA = new Wander(seed + 1, 0.33, STEP), wB = new Wander(seed + 2, 0.29, STEP), wB2 = new Wander(seed + 3, 0.37, STEP), wS = new Wander(seed + 4, 0.31, STEP), wC = new Wander(seed + 5, 0.27, STEP), wV = new Wander(seed + 6, 0.2, STEP);
  const A = new Bl(), BL = new Bl(), BR = new Bl(), S = new Bl(), C = new Bl();
  let pa = rnd(), pbl = rnd(), pbr = rnd(), ps = 0, pc = rnd();
  const hpL = new Tpt().set(o.lowcut, 0.6, FS), hpR = new Tpt().set(o.lowcut, 0.6, FS), ladL = new D.Ladder(FS), ladR = new D.Ladder(FS);
  const v1L = new Tpt().set(700, 2.6, FS), v2L = new Tpt().set(1180, 3, FS), v1R = new Tpt().set(715, 2.6, FS), v2R = new Tpt().set(1160, 3, FS);
  // voice state
  let si = 0, seg = first, pitch = first.pitch - first.scoop, slop = 0, sag = 0, vibEnv = 0, vibPh = rnd(), bloomT = first.t0;
  let onT = first.t0, relT = -1, ampE = 0, ampRel = 0, fltE = 0, fltRel = 0, velS = first.vel, spike = 0, legBump = 0;
  let aAtk = 0.01, fAtk = 0.02, fDec = 0.5;
  // control-rate values
  let res = 1, sync = 0, sub = 0.5, growl = 0, width = 0.5, air = 0.2, vowel = 0.15, heat = 0.3;
  let fcBase = 1000, kRes = 1, gComp = 1, ladDrive = 1, mixDrive = 1, mixNorm = 1, heatD = 1, heatNorm = 1, wl = 0.75, wr = 0.25;
  let dtA = 0, dtBl = 0, dtBr = 0, dtS = 0, dtC = 0, lvlA = 0, lvlB = 0, nT = 0;
  const fresh = (s: Seg) => {
    onT = s.t0; relT = -1; slop = (rnd() * 2 - 1) * o.drift * 0.8; vibEnv = 0; bloomT = s.t0;
    aAtk = s.art === 'swell' ? 0.42 : s.art === 'accent' ? 0.0015 : o.attack + (1 - s.vel) * 0.022;
    fAtk = s.art === 'swell' ? 0.5 : 0.012 + (1 - s.vel) * 0.03; fDec = 0.38 + 0.4 * (1 - s.vel);
    if (s.art === 'accent') { sag = -14; spike = 1; } else spike = 0.35 * s.vel;
    pitch = s.pitch - s.scoop;
  };
  fresh(first);
  for (let i = i0; i < i1; i++) {
    const t = i / FS;
    while (si + 1 < segs.length && t >= segs[si + 1]!.t0) {
      seg = segs[++si]!;
      legBump = 0.28 * seg.vel; vibEnv *= 0.5; if (seg.art === 'accent') { spike = 0.8; sag = -8; }
      bloomT = Math.max(bloomT, seg.t0 - 0.6);
    }
    const gate = t < seg.t1 || si + 1 < segs.length;
    if (!gate && relT < 0) { relT = t; ampRel = ampE; fltRel = fltE; }
    if ((i - i0) % CR === 0) {
      const beat = t / bs, ex = expr(beat);
      const cut = lanes.cutoff!(beat), env = lanes.env!(beat), drive = lanes.drive!(beat), det = lanes.detune!(beat), vib = lanes.vib!(beat), bloom = lanes.bloom!(beat);
      res = lanes.res!(beat); heat = lanes.heat!(beat); sync = lanes.sync!(beat); sub = lanes.sub!(beat); growl = lanes.growl!(beat);
      width = lanes.width!(beat); air = lanes.air!(beat); vowel = lanes.vowel!(beat);
      // envelopes: one fresh attack per voice; legato notes continue it
      if (relT < 0) {
        // the first block can begin a fraction of a sample before the note: never take a power of a negative time
        const tOn = Math.max(0, t - onT);
        ampE = tOn < aAtk ? Math.pow(tOn / aAtk, 0.7) : 0.86 + 0.14 * Math.exp(-(tOn - aAtk) / 0.28);
        fltE = tOn < fAtk ? smooth(tOn / fAtk) : 0.32 + 0.68 * Math.exp(-(tOn - fAtk) / fDec);
      } else {
        const tr = t - relT;
        ampE = ampRel * Math.exp(-tr / (rel / 4.6)); fltE = fltRel * Math.exp(-tr / (rel / 3.2));
      }
      velS += (seg.vel - velS) * (1 - Math.exp(-STEP / 0.04));
      spike *= Math.exp(-STEP / 0.06); legBump *= Math.exp(-STEP / 0.18); sag *= Math.exp(-STEP / 0.07); slop *= Math.exp(-STEP / 0.12);
      // pitch: RC glide toward the target; scoop rises, falls accelerate (a moan)
      let target = seg.pitch;
      if (seg.fall && seg.fallDur > 0) { const fx = clamp((t - (seg.end - seg.fallDur)) / seg.fallDur, 0, 1); target -= seg.fall * fx * fx; }
      const tau = seg === first ? (seg.scoop ? 0.05 : 0.004) : seg.glide / 3;
      pitch += (target - pitch) * (1 - Math.exp(-STEP / Math.max(1e-4, tau)));
      vibEnv += ((gate && t - seg.t0 > 0.32 ? 1 : 0) - vibEnv) * (STEP / 0.6);
      vibPh += STEP * o.vibRate * (1 + 0.05 * wV.next());
      const cents = vib * vibEnv * Math.sin(2 * Math.PI * vibPh) + slop + sag;
      const fA = hz(pitch + cents / 100);
      dtA = fA * Math.pow(2, o.drift * 0.6 * wA.next() / 1200) / FS;
      dtBl = fA * Math.pow(2, (det + o.drift * 0.5 * wB.next()) / 1200) / FS;
      dtBr = fA * Math.pow(2, (-det + o.drift * 0.5 * wB2.next()) / 1200) / FS;
      dtS = fA * (1.5 + 2.6 * sync * (0.35 + 0.65 * fltE) + 0.4 * spike) * Math.pow(2, o.drift * 0.3 * wS.next() / 1200) / FS;
      dtC = 0.5 * fA * Math.pow(2, o.drift * 0.4 * wC.next() / 1200) / FS;
      const bloomE = smooth((t - bloomT - 0.25) / 2.2), v = velS;
      const octs = env * (fltE * (0.35 + 0.65 * v) + 0.6 * spike + legBump) + bloom * 0.55 * bloomE + 1.25 * (ex - 0.7);
      fcBase = cut * Math.pow(2, o.keytrack * (pitch - 60) / 12 + octs);
      kRes = clamp(res + 0.5 * spike, 0, 3.95); gComp = 1 + 0.42 * kRes;
      ladDrive = 1 + 2.2 * drive; mixDrive = 1 + 2.4 * drive; mixNorm = 0.5 / Math.tanh(mixDrive * 0.5);
      heatD = 1 + 3.5 * heat; { const sh = 1 / Math.cosh(heatD * 0.18); heatNorm = 1 / (heatD * sh * sh); }
      wl = 0.5 * (1 + width); wr = 0.5 * (1 - width);
      lvlA = Math.pow(velS, 1.25) * ampE; lvlB = lvlA;
      nT = air * (0.05 + 0.5 * Math.exp(-(t - onT) / 0.03)) * 0.12;
      if (growl <= 0.001) { const fc = clamp(fcBase, 30, FS * 0.42); ladL.set(fc); ladR.set(fc * 1.025); }
    }
    // ----------------------------------------------------------------- oscillators (one-sample-delayed polyBLEP)
    pa += dtA; A.next(0); let wrapped = false, dW = 0;
    if (pa >= 1) { pa -= 1; wrapped = true; dW = pa / dtA; }
    A.cur = 2 * pa - 1; if (wrapped) A.jump(-2, dW);
    pbl += dtBl; BL.next(0); if (pbl >= 1) { pbl -= 1; BL.cur = 2 * pbl - 1; BL.jump(-2, pbl / dtBl); } else BL.cur = 2 * pbl - 1;
    pbr += dtBr; BR.next(0); if (pbr >= 1) { pbr -= 1; BR.cur = 2 * pbr - 1; BR.jump(-2, pbr / dtBr); } else BR.cur = 2 * pbr - 1;
    S.next(0);
    if (wrapped) { // hard sync: the slave restarts where the master wrapped (fractional position dW samples ago)
      const before = ps + dtS * (1 - dW), vb = 2 * (before - Math.floor(before)) - 1;
      ps = dtS * dW; S.cur = 2 * ps - 1; S.jump(-1 - vb, dW);
    } else {
      ps += dtS; if (ps >= 1) { ps -= 1; S.cur = 2 * ps - 1; S.jump(-2, ps / dtS); } else S.cur = 2 * ps - 1;
    }
    const pcPrev = pc; pc += dtC; C.next(0);
    if (pc >= 1) { pc -= 1; C.cur = pc < 0.5 ? 1 : -1; C.jump(2, pc / dtC); }
    else { C.cur = pc < 0.5 ? 1 : -1; if (pcPrev < 0.5 && pc >= 0.5) C.jump(-2, (pc - 0.5) / dtC); }
    // ----------------------------------------------------------------- hot mixer
    const core = 0.55 * A.prev + 0.62 * sync * S.prev + 0.55 * sub * C.prev;
    let mL = core + 0.5 * (BL.prev * wl + BR.prev * wr) + nT * (noise() * 2 - 1);
    let mR = core + 0.5 * (BL.prev * wr + BR.prev * wl) + nT * (noise() * 2 - 1);
    mL = Math.tanh(mixDrive * 0.5 * mL) * mixNorm; mR = Math.tanh(mixDrive * 0.5 * mR) * mixNorm;
    // ----------------------------------------------------------------- high-pass, ladder (audio-rate growl), throat
    if (growl > 0.001) { const tri = 1 - 4 * Math.abs(pc - 0.5), fc = clamp(fcBase * Math.pow(2, growl * 1.3 * tri), 30, FS * 0.42); ladL.set(fc); ladR.set(fc * 1.025); }
    hpL.tick(mL); hpR.tick(mR);
    let yL = ladL.tick(hpL.hp, kRes, ladDrive) * gComp, yR = ladR.tick(hpR.hp, kRes, ladDrive) * gComp;
    if (vowel > 0.001) {
      v1L.tick(yL); v2L.tick(yL); v1R.tick(yR); v2R.tick(yR);
      yL += vowel * (v1L.bpn * 0.55 + v2L.bpn * 0.35); yR += vowel * (v1R.bpn * 0.55 + v2R.bpn * 0.35);
    }
    // ----------------------------------------------------------------- VCA, then tube heat
    yL *= lvlA; yR *= lvlB;
    if (heat > 0.001) {
      const b = Math.tanh(heatD * 0.18), tL = (Math.tanh(heatD * (yL + 0.18)) - b) * heatNorm, tR = (Math.tanh(heatD * (yR + 0.18)) - b) * heatNorm;
      yL += heat * (tL - yL); yR += heat * (tR - yR);
    }
    outL[i] = outL[i]! + yL; outR[i] = outR[i]! + yR;
  }
}

async function renderVolt(perf: PartPerformance, ctx: RenderContext): Promise<Stereo> {
  const D = await labDsp(), bs = ctx.beatSeconds, s = perf.setup;
  const lanes: Lanes = {};
  for (const c of THRONE_CONTROLS) lanes[c.name] = controlAt(perf, c, BY_MACRO[c.name]!);
  const expr = (b: number) => curveAt(perf.expression, b);
  const o: VoltOptions = {
    seed: num(s.seed, ctx.seed + 101 * ctx.partIndex), glide: clamp(num(s.glide, 0.07), 0.005, 1), attack: clamp(num(s.attack, 0.006), 0.001, 0.2),
    release: clamp(num(s.release, 0.35), 0.02, 3), vibRate: clamp(num(s.vibRate, 5.1), 3, 8), drift: clamp(num(s.drift, 3.5), 0, 20),
    keytrack: clamp(num(s.keytrack, 0.6), 0, 1), lowcut: clamp(num(s.lowcut, 120), 30, 400),
  };
  const nOS = ctx.frames * OS, L = new Float64Array(nOS), R = new Float64Array(nOS);
  chainsOf(perf.notes, bs, o.glide, expr).forEach((c, k) => renderChain(D, c, lanes, expr, bs, o, hashSeed(o.seed, k, c.segs[0]!.pitch, c.segs[0]!.t0), L, R));
  const st: Stereo = [D.decimate(L, OS).slice(0, ctx.frames), D.decimate(R, OS).slice(0, ctx.frames)];
  dcBlock(st[0]); dcBlock(st[1]);
  return st;
}

export const THRONE_VOLT: LabInstrument = {
  id: 'throne-volt', family: 'throne-volt', name: 'THRONE//VOLT', version: `${LAB_VERSION}+cathedral-experiment`,
  macro: { id: 'smoulder-blaze', label: 'smoulder → blaze', from: 'smoulder', to: 'blaze' },
  description: 'Analog-style polysynth lead: a master saw, two drifting partner saws split left/right, a hard-synced scream oscillator and a sub square, through a hot mixer, a resonant 4-pole ladder with audio-rate growl, a throat colour and tube heat. Portamento, accents that sag the supply, held notes that bloom, releases that close the filter. Simulated at 2x and band-limited; deterministic.',
  range: [24, 96],
  articulations: THRONE_ARTICULATIONS,
  controls: THRONE_CONTROLS,
  setup: THRONE_SETUP,
  params: THRONE_PARAMS,
  suggestedGainDb: -4,
  async render(perf, ctx) {
    const scale = await calibrated('throne-volt', () => renderVolt(
      { notes: [{ beat: 0, beats: 2.4, pitch: 69, velocity: 0.8 }], macro: 0, controls: {}, offsets: {}, expression: 0.7, setup: { seed: 1 }, breaths: [], motion: [] },
      { bpm: 120, beatSeconds: 0.5, swing: 0.5, key: { tonic: 9, mode: 'minor', label: 'A minor' }, seed: 1, frames: Math.round(1.6 * RATE), partIndex: 0 }), 0.15, 1.15);
    if (!perf.notes.length) return blank(ctx.frames);
    const st = await renderVolt(perf, ctx);
    for (const c of st) for (let i = 0; i < c.length; i++) c[i] = c[i]! * scale;
    return st;
  },
};
