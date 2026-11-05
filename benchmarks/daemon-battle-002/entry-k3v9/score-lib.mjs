// Score-authoring helpers: build DaemonV12 v0.7 project JSON from note lists.
// Emits JSON only. No audio synthesis, processing or analysis happens here.
import fs from 'node:fs';

export const SRC = {
  kick: 'assets/v12-signature/01-sub-hammer.wav', iron: 'assets/v12-signature/02-iron-pulse.wav',
  crack: 'assets/v12-signature/03-titanium-crack.wav', clap: 'assets/v12-signature/04-neon-clap.wav',
  tick: 'assets/v12-signature/05-ghost-tick.wav', open: 'assets/v12-signature/06-open-circuit.wav',
  abyss: 'assets/v12-signature/07-abyss.wav', reactor: 'assets/v12-signature/08-reactor.wav',
  signal: 'assets/v12-signature/09-signal.wav', phantom: 'assets/v12-signature/10-phantom.wav',
  horizon: 'assets/v12-signature/11-event-horizon.wav', afterglow: 'assets/v12-signature/12-afterglow.wav',
  specter: 'assets/v12-signature/13-specter.wav', chrome: 'assets/v12-signature/14-chrome-strike.wav',
  ascension: 'assets/v12-signature/15-ascension.wav', convergence: 'assets/v12-signature/16-convergence.wav',
};
// Catalog root MIDI notes (individual roots; PHANTOM is E5).
export const ROOT = { kick: 33, iron: 33, abyss: 33, reactor: 33, convergence: 33, signal: 69, chrome: 69,
  ascension: 69, phantom: 76, horizon: 45, afterglow: 57, specter: 57, crack: 57 };
const PC = { C: 0, D: 2, E: 4, F: 5, G: 7, A: 9, B: 11 };
export function midi(name) {
  const m = /^([A-G])(#|b)?(-?\d)$/.exec(name);
  if (!m) throw new Error(`bad note ${name}`);
  return 12 * (+m[3] + 1) + PC[m[1]] + (m[2] === '#' ? 1 : m[2] === 'b' ? -1 : 0);
}
export const rate = (semis) => Number((2 ** (semis / 12)).toFixed(6));
// Position from a sixteenth-note index (0-based, 4/4).
export function pos(i) {
  if (typeof i === 'string') return i;
  const bar = Math.floor(i / 16) + 1, beat = Math.floor((i % 16) / 4) + 1, sub = i % 4;
  return `${bar}:${beat}${sub ? '+' + ['', '1/16', '1/8', '3/16'][sub] : ''}`;
}
const dur = (g) => (typeof g === 'string' ? g : `${g}/16`);
// One sampled note. inst selects the root; pitch is a note name (omit for unpitched / root).
export function N(inst, at, pitch, o = {}) {
  const note = { start: pos(at) };
  const semis = pitch ? midi(pitch) - ROOT[inst] : (o.semis ?? 0);
  if (semis !== 0) note.playbackRate = rate(semis);
  if (o.rate) note.playbackRate = o.rate;
  note.velocity = o.v ?? 0.8;
  if (o.off !== undefined) note.offsetSeconds = o.off;
  if (o.end !== undefined) note.endSeconds = o.end;
  if (o.g !== undefined) note.gate = dur(o.g);
  if (o.a !== undefined || o.r !== undefined) note.envelope = { attackSeconds: o.a ?? 0.001, releaseSeconds: o.r ?? 0.005 };
  if (o.choke) note.chokeGroup = o.choke;
  if (o.glide) note.glide = o.glide;
  return note;
}
// A track holding one pattern that spans the whole project (positions are then absolute).
export function T(id, sample, bars, notes, extra = {}) {
  const t = { id, instrument: { type: 'sampler', sample }, patterns: [{ id: 'all', bars, notes }], clips: [{ bar: 1, pattern: 'all' }] };
  return Object.assign(t, extra);
}
export function project(title, bpm, bars, tracks, extra = {}) {
  return Object.assign({ formatVersion: 1, title, bpm, timeSignature: '4/4', key: 'B minor', bars, tracks: tracks.filter((t) => t.patterns[0].notes.length) }, extra);
}
export function write(path, obj) { fs.writeFileSync(path, JSON.stringify(obj, null, 1) + '\n'); }
