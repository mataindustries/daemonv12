// STILL HERE V3 shared material: A's factory opening (heartbeat, 3+3+2 precision ticks, the cable
// turbine) and the helpers that turn a tempo-mapped score into DaemonV12 kit tracks.
import { SR, mtof, smooth, norm, Biquad } from '../lib/dsp.mjs';
import { cable } from '../lib/cable.mjs';
import { cableTick } from '../lib/kit.mjs';
import { periodLane, roundTrips } from '../lib/perform.mjs';
import { clank } from '../lib/household.mjs';
import { eKick, synthNote } from '../src/synths.mjs';
import { edges, hp4 } from '../src/instruments.mjs';

/** Absolute sixteenth of bar/beat/sixteenth (every bar has 16, at either tempo). */
export const P = (bar, beat = 1, six = 0) => (bar - 1) * 16 + (beat - 1) * 4 + six;
export const TRESILLO = [0, 3, 6, 8, 11, 14]; // A's 3+3+2 accent grid, kept as the precision DNA

/** The factory heartbeat: the kick asleep (low-passed, soft click) inside the MORPH press clank, tuned to the pedal. */
export function heartbeat(pedalHz, { seed = 3, plate = 0.5 } = {}) {
  const k = eKick({ f0: pedalHz, fStart: pedalHz * 3.2, decay: 0.5, click: 0.08, lowpass: 190, drive: 1.4, seed }), c = clank(seed, 97 / (pedalHz * 2));
  const y = new Float64Array(Math.max(k.length, c.length));
  for (let i = 0; i < y.length; i++) y[i] = (k[i] ?? 0) + plate * (c[i] ?? 0);
  return norm(edges(hp4(y, 30), 0.05), 0.9);
}

/** The heartbeat's press alone (the MORPH clank, high-passed at 150 Hz): the factory's accent without its sub. */
export function press(pedalHz, { seed = 3 } = {}) {
  return norm(edges(hp4(hp4(clank(seed, 97 / (pedalHz * 2)), 150), 150), 0.05), 0.9);
}

/** MORPH//04 cable ticks, four round-robin samples. */
export const tickKit = () => [0, 1, 2, 3].map(k => ({ name: `tick-${k + 1}`, pitch: 42 + k, audio: cableTick({ midi: 98 + k, decay: 0.045, seed: 100 + k }) }));

/**
 * The turbine (A's spool-up): a MORPH//03 cable wound from eighth-note round trips (0.25 s) into
 * `target`, bowed, then grabbed. Returns { audio (starting at `from`), trips (absolute seconds) }.
 */
export function turbine({ from = 3, pitched = 3.625, cut = 3.875, target, fadeOut = 0.004, level = 1, seed = 37 }) {
  const len = cut - from + fadeOut + 0.001, n = Math.round(len * SR);
  const period = periodLane([{ t: 0, period: 0.25, glide: 0.001 }, { t: 0.002, period: 1 / mtof(target), glide: pitched - from, curve: 'ease' }], 0.25);
  const trips = roundTrips(period, 0, cut - from);
  const span = pitched - from, raw = cable({
    seconds: len, period, disp: t => (t < span ? -0.88 + 0.66 * smooth(t / span) : -0.22), stages: 160,
    gain: t => (t < 0.6 ? 0.9 + 0.09 * smooth(t / 0.6) : 1.03), bright: t => 5200 + 2800 * smooth(t / 0.8), drive: 2.2,
    bow: t => smooth((t - 0.35) / 0.4), buzz: 0.2,
    events: [{ t: 0, kind: 'slap', hard: 1, amp: 1.1 }, ...trips.slice(1).map((tt, k) => ({ t: tt, kind: 'pluck', hard: 0.75, amp: 0.4 + 0.5 * k / trips.length, pos: 0.13 }))], seed,
  }).out;
  const y = hp4(raw, 35), c0 = Math.round((cut - from) * SR), f = Math.max(1, Math.round(fadeOut * SR));
  for (let i = 0; i < n; i++) y[i] *= (i < c0 - f ? 1 : i < c0 ? 0.5 + 0.5 * Math.cos(Math.PI * (i - c0 + f) / f) : 0) * level;
  return { audio: norm(y, 0.9), trips: trips.map(t => from + t) };
}

/**
 * Pitched one-shot kit for a list of notes: one sample per distinct midi, rendered long enough for
 * the longest note; the engine's v0.7 gate + release then shapes each note's length natively.
 */
export function pitchedKit(prefix, midis, render, { pitchOffset = 0 } = {}) {
  // `pitch` is only the kit's lookup key (never a repitch); an offset keeps variants of the same note unique
  return [...new Set(midis)].sort((a, b) => a - b).map(m => ({ name: `${prefix}${m}`, pitch: m + pitchOffset, audio: render(m) }));
}

/** Kit notes from [{pos, midi, len (sixteenths), vel}] with exact engine gates. */
export function gatedNotes(M, prefix, notes, { release = 0.04, attack = 0.001 } = {}) {
  return notes.map(n => ({ pos: n.pos, hit: `${prefix}${n.midi}`, vel: n.vel ?? 0.85, gate: M.duration(M.span(n.pos, n.len)), envelope: { attackSeconds: attack, releaseSeconds: n.release ?? release } }));
}

/**
 * Re-create a kit track's sum externally for a reverb send (FDN room): each note's sample at its
 * exact frame, gated like the engine (linear release after the gate). A send, not a substitute.
 */
export function sendSum(M, kit, notes, seconds = 12) {
  const n = seconds * SR, L = new Float64Array(n), R = new Float64Array(n), byName = Object.fromEntries(kit.map(k => [k.name, k.audio]));
  for (const nt of notes) {
    const a = byName[nt.hit], chs = a.L ? [a.L, a.R] : [a, a], f0 = M.frame(nt.pos);
    const gateF = nt.gate ? Math.round(evalFraction(nt.gate) * 4 * 60 / M.engineBpm * SR) : Infinity, rel = Math.max(1, Math.round((nt.envelope?.releaseSeconds ?? 0.005) * SR));
    for (let i = 0; i < chs[0].length && f0 + i < n; i++) {
      const g = i < gateF ? 1 : i < gateF + rel ? 1 - (i - gateF) / rel : 0;
      if (g <= 0) break;
      L[f0 + i] += chs[0][i] * g * nt.vel; R[f0 + i] += chs[1][i] * g * nt.vel;
    }
  }
  return { L, R };
}
const evalFraction = s => { const [a, b] = s.split('/').map(Number); return a / b; };

/** Exact-zero window helper for external stems (seconds). */
export function zero(chs, from, to) { for (const x of chs) for (let i = Math.round(from * SR); i < Math.min(x.length, Math.round(to * SR)); i++) x[i] = 0; }

/** Mid/side-safe stereo sum of two buffers with gains. */
export function mix2(a, ga, b, gb) { return Float64Array.from(a, (v, i) => v * ga + (b[i] ?? 0) * gb); }

export { synthNote, Biquad };
