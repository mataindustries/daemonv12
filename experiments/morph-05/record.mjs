// MORPH//05 renderer: one score (v1.mjs, v2.mjs, v3.mjs) -> the 28-second record.
// One physical Tempo String plays the whole piece (its tension is rhythm or pitch), one Wobble
// Beast answers it, and the MORPH//04 physical percussion plays around them. Every instrument
// is the proven MORPH//03/04 implementation, imported read-only; this file only schedules,
// mixes and masters. Exact length: 28 s = 14 bars at 120 BPM = 1,234,800 frames at 44.1 kHz.
import { SR, stereo, addPan, addStereo, dbToGain as db, reverb, echo, compress, master, eqStereo, norm, shape, filt, clamp, follow, smooth, Biquad } from '../morph-03/dsp.mjs';
import { cable, curve } from '../morph-03/cable.mjs';
import { springSnare, bellHat, clank } from '../morph-03/household.mjs';
import { kick, snare, cableTom, cableTick } from '../morph-04/kit.mjs';
import {
  at, hz, noteName, notesOf, periodLane, notePoints, noteEvents, muteLane, grabGain, harmonicLanes, buzzLane, zapDisp, talkFilter,
  bassBands, place, duckUnder, holes, applyGain, ratchet, roundTrips,
} from '../morph-04/perform.mjs';
import { row, noteRows, position } from '../morph-04/events.mjs';
import { beast } from './beast.mjs';

export const BPM = 120, BARS = 14, STEPS = 224, SECONDS = 28, FRAMES = 1234800, TAIL = 1.5;
const LEN = SECONDS + TAIL;
export const SLACK = 0.375;

// cable states: loop gain, dispersion, loss cut-off, drive, bow, share of the sub kept in the mix
const MODE = {
  pitched: { gain: 0.992, disp: -0.22, bright: 5200, drive: 2.4, bow: 0, sub: 1 },
  bowed: { gain: 1.035, disp: -0.22, bright: 3800, drive: 2.4, bow: 1, sub: 1 },
  growl: { gain: 1.05, disp: -0.22, bright: 5200, drive: 2.6, bow: 1, sub: 1 },
  slack: { gain: 0.88, disp: -0.88, bright: 7000, drive: 1.6, bow: 0, sub: 0.5 },
  silent: { gain: 0.7, disp: -0.88, bright: 7000, drive: 1.6, bow: 0, sub: 0.5 },
};
const KEYS = ['gain', 'disp', 'bright', 'drive', 'bow', 'sub'];

/** Regions [{step, mode, ...}] -> per-key lanes. 'wind' ramps slack -> bowed; snap entries crack first. */
function regionLanes(regions) {
  const rs = regions.map((r, k) => ({ ...r, t0: at(r.step), t1: k + 1 < regions.length ? at(regions[k + 1].step) : LEN }));
  const value = (r, key, t) => {
    const u = clamp((t - r.t0) / Math.max(1e-6, r.t1 - r.t0), 0, 1);
    if (r.mode === 'wind') {
      const s = MODE.slack, b = MODE.bowed, w = t - r.t0;
      if (key === 'gain') return w < 0.6 ? s.gain + (0.99 - s.gain) * smooth(w / 0.6) : 0.99 + (b.gain - 0.99) * u;
      if (key === 'bow') return smooth((w - 0.5) / Math.max(0.01, r.t1 - r.t0 - 0.5));
      return s[key] + (b[key] - s[key]) * u;
    }
    const base = MODE[r.mode][key];
    if (r.snap) { // the crack: tension, brightness and drive collapse in tens of milliseconds
      const w = t - r.t0;
      if (key === 'gain') { const end = r.gain ?? [0.93, 0.9]; return w < 0.05 ? 1.05 - (1.05 - end[0]) * w / 0.05 : end[0] + (end[1] - end[0]) * u; }
      if (key === 'disp') return w < 0.08 ? -0.22 - 0.68 * w / 0.08 : -0.9;
      if (key === 'bright') return w < 0.1 ? 5200 + 2800 * w / 0.1 : 8000;
      if (key === 'drive') return w < 0.2 ? 2.6 - w * 5 : 1.6;
    }
    const o = r[key];
    return o === undefined ? base : Array.isArray(o) ? o[0] + (o[1] - o[0]) * u : o;
  };
  const lanes = {};
  for (const key of KEYS) lanes[key] = t => {
    let k = 0;
    while (k + 1 < rs.length && t >= rs[k + 1].t0) k++;
    const r = rs[k], v = value(r, key, t), ramp = r.ramp ?? 0.012;
    if (k > 0 && t < r.t0 + ramp && !r.snap) return value(rs[k - 1], key, r.t0) + (v - value(rs[k - 1], key, r.t0)) * smooth((t - r.t0) / ramp);
    return v;
  };
  lanes.modeAt = t => { let k = 0; while (k + 1 < rs.length && t >= rs[k + 1].t0) k++; return rs[k]; };
  lanes.regions = rs;
  return lanes;
}

/** The main cable's full automation. */
export function cableAutomation(score) {
  const C = score.cable, notes = notesOf(C.notes), R = regionLanes(C.regions);
  const pts = [...notePoints(notes)];
  for (const r of R.regions) {
    if (r.mode === 'wind') pts.push({ t: r.t0, period: 1 / hz(r.midi ?? 28), glide: r.t1 - r.t0, curve: 'ease' });
    if (r.snap) pts.push({ t: r.t0, dive: { to: r.to ?? SLACK, rate: 0.92, k: r.k ?? 0 } });
    if (r.mode === 'silent' && r.to) pts.push({ t: r.t0 + 0.05, period: r.to, glide: r.glide ?? 0.6, curve: 'lin' });
    if (r.mode === 'slack' && !r.snap && r.to) pts.push({ t: r.t0 - 0.002, period: r.to, glide: 0.001 });
  }
  const period = periodLane(pts, 1 / hz(notes[0]?.midi ?? 28));
  const grabs = C.grabs ?? [], grab = grabGain(grabs), mute = muteLane(notes, { from: 0, to: STEPS, grabs });
  const pitchedMode = t => R.modeAt(t).mode === 'pitched';
  return {
    notes, regions: R.regions, period,
    disp: zapDisp(R.disp, notes),
    gain: t => R.gain(t) * grab(t),
    bright: R.bright,
    damp: t => (grabs.some(g => t >= at(g.from) && t < at(g.to)) ? 0 : pitchedMode(t) ? mute(t) : 1),
    drive: R.drive,
    buzz: buzzLane(notes, t => (R.modeAt(t).mode === 'bowed' ? 0.25 : 0.05)),
    ...harmonicLanes(notes),
    bow: R.bow,
    subLevel: R.sub,
  };
}

// ---------------------------------------------------------------- the kit (MORPH//04 sounds)
function makeKit() {
  const spring = springSnare(21), crackS = snare({ f0: 170, decay: 0.32, wires: 0.25, crack: 1, crackMidi: 50, seed: 35 });
  const breakSnare = snare({ f0: 205, decay: 0.18, wires: 0.15, crack: 0.25, seed: 31 });
  const withSpring = (x, g) => { const y = new Float64Array(Math.max(x.length, spring.length)); place(y, x, 0, 1); place(y, spring, 0, g); return y; };
  const ks = new Float64Array(Math.round(0.4 * SR));
  const kit = {
    kick: { h: kick({ f0: 50, lift: 14, decay: 0.3, hard: 0.85, beater: 12, drive: 2.4 }), b: kick({ f0: 55, lift: 12, decay: 0.24, hard: 0.85, beater: 9, drive: 2 }), g: kick({ f0: 58, lift: 9, decay: 0.16, hard: 0.6, beater: 5, seed: 6 }) },
    snare: {
      h: snare({ f0: 178, decay: 0.28, wires: 0.24, crack: 0.45, seed: 23 }), b: withSpring(breakSnare, 0.35), g: snare({ f0: 215, decay: 0.1, wires: 0.08, hard: 0.5, seed: 33 }),
      big: snare({ f0: 165, decay: 0.4, wires: 0.32, crack: 0.9, crackMidi: 52, seed: 29 }),
    },
    spring, clank: clank(100, 1.15),
  };
  place(ks, kit.kick.b, 0, 1); place(ks, breakSnare, 0, 0.9);
  const cr = new Float64Array(Math.round(0.4 * SR)); place(cr, crackS, 0, 1); place(cr, springSnare(29, { boing: 1.4 }), 0, 0.6);
  kit.capture = { ks, crack: cr };
  return kit;
}

/** Expand tick sections into [step, velocity] using the cable's bright envelope where asked. */
function expandTicks(sections, cableBright) {
  const out = [];
  for (const s of sections) {
    const env = s.accent === 'cable' ? cableBright : null;
    let envMax = 0;
    if (env) for (let i = Math.round(at(s.from) * SR); i < Math.round(at(s.to) * SR); i++) envMax = Math.max(envMax, env[i]);
    for (let st = s.from; st < s.to - 1e-9; st += s.every ?? 1) {
      if ((s.skip ?? []).includes(st)) continue;
      let v = s.base ?? 0.15;
      if (s.accent === 'cable') v = 0.12 + 0.6 * clamp(env[Math.round((at(st) + 0.02) * SR)] / envMax, 0, 1) ** 1.5;
      else if (s.accent === 'five' && (st - s.from) % 5 === 0) v += s.amt ?? 0.45;
      else if (s.accent === 'eighths' && st % 2 === 0) v += s.amt ?? 0.2;
      out.push([st, +v.toFixed(3)]);
    }
  }
  return out;
}

/** Mix-automation lane: [[step, dB], ...], linear in dB between points (as DaemonV12 'linear'). */
export function rideCurve(pts) { return curve(pts.map(([st, g], k) => (k ? [at(st), g, 'lin'] : [at(st), g]))); }
/** Tick k: unique per tick by default (V1, V2); a round-robin of `variants` samples when set (V3). */
export const tickSample = (k, variants) => cableTick({ midi: 98 + (k % 4), decay: 0.05, seed: 100 + (variants ? k % variants : k) });
export const tickPan = k => (k % 2 ? 0.45 : -0.45);
export { makeKit };
const pan2 = (L, R, x, t, v, p) => { place(L, x, t, v * Math.cos((p + 1) * Math.PI / 4)); place(R, x, t, v * Math.sin((p + 1) * Math.PI / 4)); };

export function render(score, { stems: wantStems = false } = {}) {
  const n = Math.round(LEN * SR), mixp = { ...DEFAULT_MIX, ...score.mix };
  // ---------------- the cable (one instrument for the whole record)
  const A = cableAutomation(score), C = score.cable;
  const winds = A.regions.filter(r => r.mode === 'wind');
  const windStrikes = winds.flatMap(r => { const ts = roundTrips(A.period, r.t0, r.t1).slice(1); return ts.map((t, k) => ({ t, kind: 'pluck', hard: 0.75, amp: 0.35 + 0.35 * k / ts.length, pos: 0.13 })); });
  const events = [
    ...(C.strikes ?? []).map(s => ({ ...s, t: at(s.step) })), ...noteEvents(A.notes),
    ...A.regions.filter(r => r.snap).map(r => ({ t: r.t0, kind: 'crack', hard: 1, amp: r.crackAmp ?? 1.4 })),
    ...windStrikes,
  ];
  const main = cable({ seconds: LEN, ...A, events, stages: 160, seed: C.seed ?? 31 });
  const { sub, presence } = bassBands(talkFilter(main.out, A.notes, C.talks ?? []));
  applyGain(sub, A.subLevel);
  const brightEnv = follow(filt(filt(presence.slice(), 'hp', 1200, 0.7), 'hp', 1200, 0.7), 0.001, 0.04);
  // a second cable answers in the stereo field (slack, dotted-eighth round trip)
  const P = score.partner;
  const partner = cable({
    seconds: LEN, period: P.period ?? SLACK, disp: -0.92, stages: 120, gain: curve(P.gain.map(([s, g]) => [at(s), g])), bright: 9000, drive: 1.5,
    events: P.events.map(e => ({ kind: 'pluck', hard: 1, amp: 0.8, ...e, t: at(e.step) + (e.kind === 'crack' ? 0.01 : 0) })), seed: 47,
  }).out;
  norm(partner, 1); filt(partner, 'hp', 60, 0.7);

  // ---------------- the Beast
  const B = beast({ seconds: LEN, ...score.beast });
  const beastSub = B.sub.slice(), beastMid = B.mid.slice();
  if (mixp.beastCrest) { // stop-consonant releases ("ka", "kk") burst far above the voice: soft-limit them
    let acc = 0, cnt = 0;
    for (let i = 0; i < beastMid.length; i++) if (B.speaking(i / SR)) { acc += beastMid[i] ** 2; cnt++; }
    const T = Math.sqrt(acc / Math.max(1, cnt)) * 10 ** (mixp.beastCrest / 20);
    beastMid.set(shape(beastMid, v => T * Math.tanh(v / T), 1));
  }
  norm(beastMid, 1);
  norm(beastSub, 1);

  // ---------------- drums
  const kit = makeKit(), D = score.drums;
  const kicks = new Float64Array(n), snares = new Float64Array(n), toms = { L: new Float64Array(n), R: new Float64Array(n) }, perc = { L: new Float64Array(n), R: new Float64Array(n) };
  for (const [s, v, k = 'h'] of D.kicks) place(kicks, kit.kick[k], at(s), v);
  for (const [s, v, k = 'h'] of D.snares) place(snares, kit.snare[k], at(s), v);
  for (const [s, v] of D.springs ?? []) place(snares, kit.spring, at(s), v);
  const ticks = expandTicks(D.ticks ?? [], brightEnv);
  // with tickVariants the ticks are a round-robin of that many samples (reproducible by a sampler)
  const metal = mixp.splitPerc ? { L: new Float64Array(n), R: new Float64Array(n) } : perc;
  ticks.forEach(([s, v], k) => pan2(perc.L, perc.R, tickSample(k, D.tickVariants), at(s), v, tickPan(k)));
  for (const [s, v] of D.bells ?? []) { const b = bellHat(s % 2, 1.5, 300 + s); place(metal.L, b, at(s), v * 0.8); place(metal.R, b, at(s) + 0.006, v * 0.6); }
  for (const [s, v] of D.clanks ?? []) pan2(metal.L, metal.R, kit.clank, at(s), v, -0.2);
  for (const [s, m, v = 0.7] of D.toms ?? []) pan2(toms.L, toms.R, cableTom(m, { seed: 40 + m }), at(s), v, clamp((m - 47) / 6, -1, 1) * 0.6);
  // ratchets: the drums repeat once per round trip of the cable
  const ratch = new Float64Array(n), ratchetSlices = [];
  for (const r of score.ratchets ?? []) {
    const res = ratchet(kit.capture[r.capture], A.period, at(r.from), at(r.to), n, { gain: curve(r.gain.map(([s, g]) => [at(s), g])) });
    for (let i = 0; i < n; i++) ratch[i] += res.out[i];
    ratchetSlices.push({ ...r, slices: res.slices });
  }
  filt(ratch, 'lp', 7000, 0.7); filt(ratch, 'hp', 35, 0.7);
  // planned silences (the choke): drums, ratchet and rooms gated shut
  const gate = holes(score.holes ?? []);
  for (const x of new Set([kicks, snares, toms.L, toms.R, perc.L, perc.R, metal.L, metal.R, ratch])) applyGain(x, gate);

  // ---------------- mix automation (dB per source, linear between points; 0 dB outside)
  const auto = Object.fromEntries(Object.entries(score.automation ?? {}).map(([k, pts]) => [k, rideCurve(pts)]));
  const ride = (x, k) => (auto[k] ? applyGain(x, t => db(auto[k](t))) : x);
  ride(kicks, 'kick'); ride(snares, 'snare'); for (const ch of ['L', 'R']) for (const x of new Set([perc[ch], metal[ch]])) ride(x, 'perc'); for (const ch of ['L', 'R']) ride(toms[ch], 'toms');
  ride(presence, 'cablePresence'); ride(sub, 'cableSub');

  // ---------------- interplay
  const kickTimes = D.kicks.map(([s]) => at(s));
  duckUnder(sub, kickTimes, { depth: 0.8, hold: 0.025, release: 0.06 });
  duckUnder(beastSub, kickTimes, { depth: 0.8, hold: 0.025, release: 0.06 });
  // separation: the mouth gives way for 50 ms at each cable onset, so slaps and pops speak through it
  if (mixp.beastYield) duckUnder(beastMid, A.notes.filter(nt => nt.kind !== 'ghost').map(nt => at(nt.step)), { depth: mixp.beastYield, attack: 0.002, hold: 0.03, release: 0.05 });
  // when the Beast speaks, the cable's upper band steps back (its sub stays)
  const mouth = follow(beastMid, 0.002, 0.12);
  for (let i = 0; i < n; i++) { const d = 1 / (1 + mixp.beastDuck * mouth[i]); presence[i] *= d; partner[i] *= 0.5 + 0.5 * d; }
  const bass = new Float64Array(n);
  for (let i = 0; i < n; i++) bass[i] = sub[i] + presence[i];
  const bassClip = shape(norm(bass, 1), v => Math.tanh(1.35 * v) / Math.tanh(1.35), 1);
  if (mixp.beastComp) { // fast peak control on the mouth: its formant spikes stop driving the master clip
    const b = { L: beastMid, R: beastMid.slice() };
    compress(b, { threshold: mixp.beastComp.threshold, ratio: mixp.beastComp.ratio, attack: 0.002, release: 0.08, knee: 6, makeup: mixp.beastComp.makeup ?? 0 });
  }
  const beastClip = shape(beastMid, v => Math.tanh(1.3 * v) / Math.tanh(1.3), 1);
  ride(bassClip, 'cable'); ride(beastClip, 'beastMid'); ride(beastSub, 'beastSub'); ride(ratch, 'ratchet'); ride(partner, 'partner');

  // ---------------- mix (every source is its own stem; the stems sum to the pre-master mix)
  const stems = {}, bus = name => (stems[name] ??= stereo(LEN));
  const add = (name, x, gainDb, p = 0, delay = 0) => addPan(bus(name), x, delay, db(gainDb), p);
  add('cable', bassClip, mixp.cable);
  add('cablePartner', partner, mixp.partner, 0.65);
  add('beast', beastSub, mixp.beastSub);
  add('beast', beastClip, mixp.beastMid, -mixp.beastWidth, 0); add('beast', beastClip, mixp.beastMid, mixp.beastWidth, mixp.beastHaas);
  add('kick', kicks, mixp.kick);
  add('snare', snares, mixp.snare, 0.04);
  const percName = mixp.splitPerc ? 'ticks' : 'perc';
  addPan(bus(percName), perc.L, 0, db(mixp.perc), -1); addPan(bus(percName), perc.R, 0, db(mixp.perc), 1);
  if (mixp.splitPerc) { addPan(bus('metal'), metal.L, 0, db(mixp.perc), -1); addPan(bus('metal'), metal.R, 0, db(mixp.perc), 1); }
  addPan(bus('toms'), toms.L, 0, db(mixp.toms), -1); addPan(bus('toms'), toms.R, 0, db(mixp.toms), 1);
  add('ratchet', ratch, mixp.ratchet);
  // spaces: a big dark room (snare, snap, Beast), a kitchen for the break, a garage around the
  // cable and kick, and a dotted-eighth echo on the slack cable (its 3:4 keeps going)
  const roomIn = stereo(LEN), kitchenIn = stereo(LEN), garageIn = stereo(LEN), echoIn = stereo(LEN);
  addPan(roomIn, snares, 0, db(-4), 0); addPan(roomIn, beastMid, 0, db(-10), 0.1); addPan(roomIn, partner, 0, db(-9), 0.7);
  const slackMask = t => { const m = A.regions.find(r => t >= r.t0 && t < r.t1); return m && (m.mode === 'slack' || m.snap) ? 1 : 0; };
  const slackPresence = Float64Array.from(presence, (v, i) => v * slackMask(i / SR));
  addPan(roomIn, slackPresence, 0, db(-8), -0.35);
  for (const [x, g, p] of [[toms.L, -9, -0.6], [toms.R, -9, 0.6], [perc.L, -12, -0.8], [perc.R, -12, 0.8], [ratch, -10, 0]]) addPan(kitchenIn, x, 0, db(g), p);
  if (mixp.splitPerc) for (const [x, p] of [[metal.L, -0.8], [metal.R, 0.8]]) addPan(kitchenIn, x, 0, db(-12), p);
  addPan(garageIn, presence, 0, db(-6), -0.2); addPan(garageIn, kicks, 0, db(-14), 0.2);
  addPan(echoIn, slackPresence, 0, db(-8), -0.2);
  for (const b of [roomIn, kitchenIn, garageIn, echoIn]) for (const ch of ['L', 'R']) applyGain(b[ch], gate);
  const wet = {
    room: reverb(roomIn, { size: 1.8, rt60: 1.5, hfRatio: 0.35, predelay: 0.022, lowCut: 260, seed: 5 }),
    kitchen: reverb(kitchenIn, { size: 0.8, rt60: 0.7, hfRatio: 0.5, predelay: 0.012, lowCut: 220, seed: 17 }),
    garage: reverb(garageIn, { size: 0.55, rt60: 0.45, hfRatio: 0.4, predelay: 0.006, lowCut: 300, seed: 13 }),
    echo: echo(echoIn, { left: 3 * 0.125, right: 6 * 0.125, feedback: 0.35, lp: 4000, hp: 300, pingpong: true }),
  };
  for (const [name, b] of Object.entries(wet)) { for (const ch of ['L', 'R']) applyGain(b[ch], gate); addStereo(bus(name), b, 0, db(mixp[name])); }

  // ---------------- crop to the exact picture length, then the master
  const crop = b => ({ L: b.L.slice(0, FRAMES), R: b.R.slice(0, FRAMES) });
  const parts = Object.fromEntries(Object.entries(stems).map(([k, b]) => [k, crop(b)]));
  const mix = stereo(SECONDS);
  for (const b of Object.values(parts)) addStereo(mix, b);
  const premaster = { L: mix.L.slice(), R: mix.R.slice() };
  eqStereo(mix, [['hp', 28, 0.5412, 0], ['hp', 28, 1.3066, 0], ['peak', 240, 0.9, -2]]);
  const gr = compress(mix, { threshold: -12, ratio: 2, attack: 0.02, release: 0.12, knee: 8 });
  const tailBefore = Math.max(...['L', 'R'].map(ch => Math.sqrt(mix[ch].subarray(FRAMES - 2205).reduce((a, v) => a + v * v, 0) / 2205)));
  const mastering = master(mix, { targetLufs: mixp.targetLufs, ceilingDb: -1.2, release: 0.07, loop: true, softClip: 3 });
  // the music ends inside the container; a 40 ms fade only guarantees a click-free boundary
  const fade = Math.round(0.04 * SR);
  for (const ch of ['L', 'R']) for (let i = 0; i < fade; i++) mix[ch][FRAMES - 1 - i] *= smooth(i / fade);
  const meta = {
    bpm: BPM, bars: BARS, seconds: SECONDS, frames: mix.L.length, compressorMaxDb: gr.reduce((a, b) => Math.max(a, b), 0),
    preFadeLast50msRmsDb: +(20 * Math.log10(tailBefore + 1e-12)).toFixed(1), ...mastering,
  };
  const rows = eventRows(score, A, ticks, ratchetSlices, windStrikes);
  const lanes = {
    cablePeriod: A.period, cableDispersion: A.disp, cableLoopGain: A.gain, cableBrightHz: A.bright, cableDamp: A.damp, cableDrive: A.drive,
    cableBuzz: A.buzz, cableHarmonic: A.harmonic, cableHarmonicN: A.harmonicN, cableBow: A.bow, cableSubLevel: A.subLevel,
    beastPitchHz: B.pitch, beastLipDiameter: t => B.art(t).lipDiam, beastTongueIndex: t => B.art(t).tongueIndex, beastTongueDiameter: t => B.art(t).tongueDiam,
    beastVelum: t => B.art(t).velum, beastVoicing: t => B.art(t).voicing, drumGate: gate,
  };
  for (const [k, f] of Object.entries(score.automation ?? {})) lanes[`mix_${k}_dB`] = rideCurve(f);
  if (wantStems) return { bus: mix, meta, rows, lanes, stems: parts, premaster, plan: { ticks, mix: mixp, gateSpans: score.holes ?? [] } };
  return { bus: mix, meta, rows, lanes };
}

const DEFAULT_MIX = {
  cable: -4, partner: -10, beastSub: -10, beastMid: -2, kick: -3, snare: -2, perc: -4, toms: -10, ratchet: -10,
  room: 0, kitchen: -1, garage: 0, echo: -14, beastDuck: 1.2, targetLufs: -14, beastWidth: 0.45, beastHaas: 0.007, beastComp: null, beastCrest: null, beastYield: 0, splitPerc: false,
};

// ---------------------------------------------------------------- the exact event map
function eventRows(score, A, ticks, ratchets, windStrikes) {
  const D = score.drums, rows = [];
  rows.push(...noteRows(A.notes));
  for (const s of score.cable.strikes ?? []) rows.push(row(s.step, 'cable', `${s.kind} (strike)`, { velocity: s.amp, detail: s.detail ?? '' }));
  for (const r of A.regions) {
    if (r.snap) rows.push(row(r.step, 'cable', 'SNAP (crack)', { detail: `tension collapses to a ${(r.to ?? SLACK) * 1000} ms round trip` }));
    else if (r.mode === 'wind') rows.push(row(r.step, 'cable', 'WIND-UP', { detail: `round trip shrinks to ${noteName(r.midi ?? 28)} by ${position(r.step + (r.t1 - r.t0) / 0.125)}; re-struck every round trip` }));
    else if (r.mode !== 'pitched') rows.push(row(r.step, 'cable', `${r.mode}`, { detail: r.detail ?? '' }));
  }
  for (const w of windStrikes) rows.push(row(+(w.t / 0.125).toFixed(4), 'cable', 'wind strike', { velocity: +w.amp.toFixed(3), exactTime: w.t }));
  for (const g of score.cable.grabs ?? []) rows.push(row(g.from, 'cable', 'grab (hand stops the cable)', { detail: `until ${position(g.to)}` }));
  for (const t of score.cable.talks ?? []) rows.push(row(t.from, 'cable', 'bowed talk', { detail: `${t.per}-per-beat "yow" shapes until ${position(t.to)}` }));
  for (const p of score.partner.events) rows.push(row(p.step, 'cable partner', p.kind ?? 'pluck', { velocity: p.amp ?? 0.8 }));
  for (const p of score.beast.phrases) for (const c of p.cells) rows.push(row(c.step, 'beast', c.syl, { pitch: noteName(c.midi) + (c.toMidi !== undefined ? `->${noteName(c.toMidi)}` : ''), lengthSteps: c.len, detail: `${p.name}${c.sputter ? '; sputter' : ''}` }));
  for (const w of score.beast.winds ?? []) rows.push(row(w.from, 'beast', 'aah (wound up with the cable)', { pitch: `fry->${noteName(w.midi)}`, detail: `until ${position(w.to)}` }));
  for (const g of score.beast.gasps ?? []) rows.push(row(g, 'beast', 'gasp'));
  for (const g of score.beast.glitches ?? []) rows.push(row(g.step, 'beast', 'glitch (beat-repeat + crush)', { detail: `${g.repeats} repeats` }));
  for (const [s, v, k = 'h'] of D.kicks) rows.push(row(s, 'kick', { h: 'kick', b: 'break kick', g: 'ghost kick' }[k], { velocity: v }));
  for (const [s, v, k = 'h'] of D.snares) rows.push(row(s, 'snare', { h: 'half-time snare', b: 'break snare + spring', g: 'ghost snare', big: 'BIG snare (cable crack inside)' }[k], { velocity: v }));
  for (const [s, v] of D.springs ?? []) rows.push(row(s, 'snare', 'toaster spring', { velocity: v }));
  for (const [s, v] of ticks) rows.push(row(s, 'perc', 'cable tick', { velocity: v }));
  for (const [s, v] of D.bells ?? []) rows.push(row(s, 'perc', 'alarm-bell hat', { velocity: v }));
  for (const [s, v] of D.clanks ?? []) rows.push(row(s, 'perc', 'press clank', { velocity: v }));
  for (const [s, m, v = 0.7] of D.toms ?? []) rows.push(row(s, 'toms', 'cable tom', { pitch: noteName(m), velocity: v }));
  for (const r of ratchets) {
    rows.push(row(r.from, 'ratchet', `RATCHET (${r.capture})`, { detail: `${r.slices.length} repeats, one per cable round trip, until ${position(r.to)}` }));
    for (const sl of r.slices) rows.push(row(+(sl.t / 0.125).toFixed(4), 'ratchet', 'repeat', { detail: `${(sl.length * 1000).toFixed(1)} ms`, exactTime: sl.t }));
  }
  for (const h of score.holes ?? []) rows.push(row(h.from, 'all', h.label ?? 'CHOKE', { end: +at(h.to).toFixed(4), detail: `drums, ratchet and rooms gated until ${position(h.to)}` }));
  for (const s of score.sections) rows.push(row(s.step, 'section', s.name, { detail: s.detail }));
  // authoritative sample frame (nearest, ties later: the DaemonV12 rule) and the 60 fps picture frame
  for (const r of rows) {
    r.sampleFrame = Math.floor((r.exactTime ?? r.step * 0.125) * SR + 0.5);
    delete r.exactTime;
    r.frame60 = Math.floor(r.sampleFrame * 60 / SR);
  }
  return rows.sort((a, b) => a.step - b.step || a.part.localeCompare(b.part));
}
