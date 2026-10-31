// LOWRIDER//2099 score: the hook, the two arrangements, and the helpers that turn them into
// DaemonV12 projects. Positions are written as (bar, step) with step = 16th note 0-15
// (fractions allowed). Everything renders through the stock v0.7 sampler/drum-kit engine.
import { S16 } from './instruments.mjs';

// ---------- engine timing (mirrors src/timing: 960 PPQ, 4/4, usPerQuarter = 625000 at 96 BPM) ----------
export const T16 = 240, TBAR = 3840;
const gcd = (a, b) => (b ? gcd(b, a % b) : a);
/** Canonical BAR:BEAT(+N/D) for pattern-relative ticks. */
export function pos(t) {
  const bar = Math.floor(t / TBAR) + 1, r = t % TBAR, beat = Math.floor(r / 960) + 1, o = r % 960;
  if (!o) return `${bar}:${beat}`;
  const g = gcd(o, TBAR);
  return `${bar}:${beat}+${o / g}/${TBAR / g}`;
}
export function dur(t) { const g = gcd(t, TBAR); return `${t / g}/${TBAR / g}`; }
/** Nearest output frame of a tick, ties later. One bar is exactly 110250 frames, so whole-bar
 *  clip placement never changes the rounding of a pattern-relative tick. */
export const frameOf = t => Math.floor((t * 3675 + 64) / 128);
/** Swing: odd 16ths land `swing` ticks late (40 ticks = 58.3 % 16th swing). */
export const tick = (bar, step, swing = 0) => (bar - 1) * TBAR + Math.round(step * T16) + (swing && Number.isInteger(step) && step % 2 === 1 ? swing : 0);
export const semis = s => +(2 ** (s / 12)).toFixed(6);
const sec6 = s => +s.toFixed(6);

/** Read position (source frames) of a performed voice n output frames after onset (V0.6 closed form). */
function readPos(v, nOut) {
  const r0 = v.rate ?? 1, off = v.offsetFrames ?? 0;
  if (!v.glide) return off + nOut * r0;
  const r1 = v.glide.to, G = frameOf(v.t + v.glide.ticks) - frameOf(v.t);
  return nOut <= G ? off + nOut * (r0 + (r1 - r0) * nOut / (2 * G)) : off + G * (r0 + r1) / 2 + (nOut - G) * r1;
}

/**
 * A monophonic sampled line with expressive pitch: notes are {bar, step, pitch, len (16ths), vel,
 * scoop (semitones below, glide 16ths), fall: {at (16ths after onset), to (semitones), over (16ths)}}.
 * A fall is a second voice that starts at the exact source frame the first voice is reading when it
 * is gated off (equal 5 ms crossfade), then glides: a mid-note bend the sampler cannot do on one voice.
 */
export function line(notes, { swing = 0, release = 0.025, attack = 0.002 } = {}) {
  const out = [];
  for (const n of notes) {
    const t = tick(n.bar, n.step, swing), endT = t + Math.round(n.len * T16);
    const v = { t, rate: 1, offsetFrames: 0 };
    const note = { start: pos(t), pitch: n.pitch, velocity: n.vel ?? 0.85 };
    if (n.scoop) {
      v.rate = semis(-n.scoop); v.glide = { to: 1, ticks: Math.round((n.scoopLen ?? 0.5) * T16) };
      note.playbackRate = v.rate; note.glide = { to: 1, duration: dur(v.glide.ticks) };
    }
    if (n.rate && !n.scoop) { v.rate = n.rate; note.playbackRate = n.rate; }
    if (n.offset) { v.offsetFrames = Math.round(n.offset * 44100); note.offsetSeconds = n.offset; }
    if (n.fall) {
      const ft = t + Math.round(n.fall.at * T16);
      note.gate = dur(ft - t); note.envelope = { attackSeconds: attack, releaseSeconds: 0.005 };
      const p = readPos(v, frameOf(ft) - frameOf(t));
      const r0 = v.glide ? v.glide.to : v.rate;
      const fallNote = {
        start: pos(ft), pitch: n.pitch, velocity: note.velocity, playbackRate: r0,
        offsetSeconds: sec6(Math.round(p) / 44100),
        glide: { to: +(r0 * semis(n.fall.to)).toFixed(6), duration: dur(Math.round(n.fall.over * T16)) },
        gate: dur(endT - ft), envelope: { attackSeconds: 0.005, releaseSeconds: release },
      };
      out.push(note, fallNote);
    } else {
      note.gate = dur(endT - t); note.envelope = { attackSeconds: attack, releaseSeconds: release };
      out.push(note);
    }
  }
  return out;
}

/** Plain hits (drum kits, one-shots): [{bar, step, pitch?, vel, ...extra}] */
export function hits(list, { swing = 0 } = {}) {
  return list.map(h => {
    const { bar = 1, step, pitch, vel = 0.8, ...extra } = h;
    const note = { start: pos(tick(bar, step, swing)) };
    if (pitch !== undefined) note.pitch = pitch;
    note.velocity = vel;
    return { ...note, ...extra };
  });
}

// ======================================================================================
// THE HOOK (2 bars). Fm9 | Dbmaj9 . . C7(b9)
// Lead call on beats 1-2.5 (tresillo 3+3+2), talkbox answer on beats 3.5-4.
// ======================================================================================
export const hookLead = (bar = 1) => [
  // bar 1: C6 (scooped from Ab5), Ab5, F5 that falls to Eb5 on beat 3
  { bar, step: 0, pitch: 'C6', len: 2.5, vel: 0.92, scoop: 4, scoopLen: 0.5 },
  { bar, step: 3, pitch: 'Ab5', len: 1.5, vel: 0.8 },
  { bar, step: 6, pitch: 'F5', len: 3.5, vel: 0.86, fall: { at: 2, to: -2, over: 1 } },
  // bar 2: same head, then Db6 (scooped from C6) sighing down to C6
  { bar: bar + 1, step: 0, pitch: 'C6', len: 2.5, vel: 0.92, scoop: 4, scoopLen: 0.5 },
  { bar: bar + 1, step: 3, pitch: 'Ab5', len: 1.5, vel: 0.8 },
  { bar: bar + 1, step: 6, pitch: 'Db6', len: 3.5, vel: 0.88, scoop: 1, scoopLen: 0.5, fall: { at: 2, to: -1, over: 0.5 } },
];

// Talkbox answers, rendered as performed phrases (seconds from the phrase's first syllable).
export const TALKBOX = {
  'tb-ooh-wee': { seconds: 1.1, notes: [
    { t: 0, len: 2 * S16 - 0.012, midi: 60, syl: 'ooh', from: 58 },
    { t: 2 * S16, len: 3 * S16, midi: 63, syl: 'wee', to: 65, bendAt: 1.5 * S16 },
  ] },
  // the signature: E4 over the C7, the mouth growing from tiny to giant while the pitch holds
  'tb-yeah-shrink': { seconds: 1.15, notes: [
    { t: 0, len: 2 * S16 - 0.012, midi: 58, syl: 'yeah' },
    { t: 2 * S16, len: 4 * S16 - 0.02, midi: 64, syl: 'yeah', to: 65, bendAt: 3.1 * S16, bendLen: 0.09, size: [1.45, 0.7] },
  ] },
  // B's intro variant: the same answer, one word, more breath
  'tb-wow': { seconds: 1.1, notes: [
    { t: 0, len: 5 * S16, midi: 63, syl: 'wow', from: 60, glide: 0.08, to: 65, bendAt: 3 * S16 },
  ] },
};

export const hookTalkbox = (bar = 1) => [
  { bar, step: 10, pitch: 'ooh-wee', vel: 0.9 },
  { bar: bar + 1, step: 10, pitch: 'yeah-shrink', vel: 0.9 },
];

// 808 under the hook: root, octave pop on the "a" of 2, root, walk-up; bar 2 Db -> C slide home.
export const hook808 = (bar = 1) => [
  { bar, step: 0, pitch: 'F1', len: 5.5, vel: 0.95 },
  { bar, step: 7, pitch: 'F2', len: 1.5, vel: 0.8 },
  { bar, step: 10, pitch: 'F1', len: 3.5, vel: 0.9 },
  { bar, step: 14, pitch: 'Ab1', len: 2, vel: 0.85 },
  { bar: bar + 1, step: 0, pitch: 'Db2', len: 5.5, vel: 0.95 },
  { bar: bar + 1, step: 7, pitch: 'Db2', len: 1.5, vel: 0.75 },
  { bar: bar + 1, step: 10, pitch: 'C2', len: 6, vel: 0.92, fall: { at: 4, to: -7, over: 2 } },
];
