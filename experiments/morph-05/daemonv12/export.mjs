// CABLE//BEAST through DaemonV12: export the V3 record as a native DaemonV12 project.
//
// What the DaemonV12 sampler plays natively (faithful: these are one-shot samples):
//   kick, snare (incl. ghosts, the BIG snare and the toaster spring), cable toms, cable ticks
//   (a round-robin of 8), alarm bells and the press clank. Each hit is a drum-kit note at its
//   exact 960-PPQ position with its velocity; mix rides and the choke are track gain automation.
// What stays an external render (a physical model the sampler cannot reproduce), aligned from
// frame 0 and played as one sampler voice per stem: the cable, the Beast, the partner cable,
// the cable-clocked ratchets and the four rooms (their input is the whole mix).
// The DaemonV12 render is the PRE-MASTER mix (unity master, no master effects). The record's
// mastering (bus EQ, glue compression, loudness gain, soft clip, true-peak limiter) is external.
//
// Usage: node experiments/morph-05/daemonv12/export.mjs [OUT_DIR]
//   writes OUT_DIR/cable-beast.daemonv12.json + OUT_DIR/assets/ and OUT_DIR/reference/premaster.wav
import { mkdirSync, writeFileSync, rmSync } from 'node:fs';
import { join, resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { SR, writeWav, peakOf, dbToGain as db } from '../../morph-03/dsp.mjs';
import { bellHat } from '../../morph-03/household.mjs';
import { cableTom } from '../../morph-04/kit.mjs';
import { at } from '../../morph-04/perform.mjs';
import { render, makeKit, tickSample, tickPan, rideCurve, FRAMES } from '../record.mjs';
import { score } from '../v3.mjs';

const here = dirname(fileURLToPath(import.meta.url));
const out = resolve(process.argv[2] ?? join(here, 'project'));
const PROJECT = 'cable-beast.daemonv12.json';
rmSync(join(out, 'assets'), { recursive: true, force: true });
mkdirSync(join(out, 'assets'), { recursive: true });

const res = render(score, { stems: true });
const mixp = res.plan.mix, D = score.drums;

// constant-power pan baked into stereo assets (the record's pan law); the track itself stays at
// DaemonV12 pan 0, which is unity balance on both channels
const panned = (x, p, g = 1) => ({ L: x.map(v => v * g * Math.cos((p + 1) * Math.PI / 4)), R: x.map(v => v * g * Math.sin((p + 1) * Math.PI / 4)) });
const kitFiles = {};
const bellName = s => `bell-step-${String(s).replace('.', '-')}`;
function sample(kitName, name, bus, pitch) {
  const file = `${name}.wav`;
  writeWav(join(out, 'assets', kitName, file), bus, 16);
  (kitFiles[kitName] ??= []).push({ name, pitch, file });
  if (peakOf(bus) > 1) throw new Error(`${kitName}/${name} exceeds full scale`);
}

// ---- one-shots (the same constructors and parameters as record.mjs)
const kit = makeKit();
let pitch = 36;
for (const k of ['h', 'b', 'g']) sample('kick', `kick-${k}`, panned(kit.kick[k], 0), pitch++);
pitch = 36;
const snareKeys = new Map();
for (const [, v, k = 'h'] of D.snares) {
  const key = v > 1 ? `${k}-x${Math.round(v * 100)}` : k; // velocities above 1 are baked into the sample (DaemonV12: 0 < v <= 1)
  if (!snareKeys.has(key)) { snareKeys.set(key, `snare-${key}`); sample('snare', `snare-${key}`, panned(kit.snare[k], 0.04, Math.max(1, v)), pitch++); }
}
if ((D.springs ?? []).length) sample('snare', 'spring', panned(kit.spring, 0.04), pitch++);
pitch = 36;
const tomMidis = [...new Set((D.toms ?? []).map(([, m]) => m))];
for (const m of tomMidis) sample('toms', `tom-${m}`, panned(cableTom(m, { seed: 40 + m }), Math.max(-1, Math.min(1, (m - 47) / 6)) * 0.6), pitch++);
pitch = 36;
for (let k = 0; k < D.tickVariants; k++) sample('ticks', `tick-${k}`, panned(tickSample(k, D.tickVariants), tickPan(k)), pitch++);
pitch = 36;
for (const [s] of D.bells ?? []) { // the bell's right channel arrives 6 ms late at 0.6 (record.mjs)
  const b = bellHat(s % 2, 1.5, 300 + s), off = Math.round(0.006 * SR), L = new Float64Array(b.length + off), R = new Float64Array(b.length + off);
  for (let i = 0; i < b.length; i++) { L[i] += 0.8 * b[i]; R[i + off] += 0.6 * b[i]; }
  sample('metal', bellName(s), { L, R }, pitch++);
}
if ((D.clanks ?? []).length) sample('metal', 'clank', panned(kit.clank, -0.2), pitch++);
for (const [kitName, samples] of Object.entries(kitFiles)) writeFileSync(join(out, 'assets', kitName, 'kit.json'), JSON.stringify({ formatVersion: 1, samples }, null, 2) + '\n');

// ---- notes: exact 960-PPQ positions (16th = 1/16 whole; 32nds = 1/32)
const pos = step => {
  const bar = Math.floor(step / 16) + 1, beat = Math.floor((step % 16) / 4) + 1, off = step % 4; // in 16ths
  if (!off) return `${bar}:${beat}`;
  const num = Math.round(off * 2), den = 32; // off is a multiple of 1/2 sixteenth
  if (Math.abs(off * 2 - num) > 1e-9) throw new Error(`step ${step} is off the 32nd grid`);
  const g = (a, b) => (b ? g(b, a % b) : a), d = g(num, den);
  return `${bar}:${beat}+${num / d}/${den / d}`;
};
const vel = v => +Math.min(1, v).toFixed(6);
const notes = {
  kick: D.kicks.map(([s, v, k = 'h']) => ({ start: pos(s), pitch: `kick-${k}`, velocity: vel(v) })),
  snare: [...D.snares.map(([s, v, k = 'h']) => ({ start: pos(s), pitch: snareKeys.get(v > 1 ? `${k}-x${Math.round(v * 100)}` : k), velocity: v > 1 ? 1 : vel(v) })),
    ...(D.springs ?? []).map(([s, v]) => ({ start: pos(s), pitch: 'spring', velocity: vel(v) }))],
  toms: (D.toms ?? []).map(([s, m, v = 0.7]) => ({ start: pos(s), pitch: `tom-${m}`, velocity: vel(v) })),
  ticks: res.plan.ticks.map(([s, v], k) => ({ start: pos(s), pitch: `tick-${k % D.tickVariants}`, velocity: vel(v) })),
  metal: [...(D.bells ?? []).map(([s, v]) => ({ start: pos(s), pitch: bellName(s), velocity: vel(v) })),
    ...(D.clanks ?? []).map(([s, v]) => ({ start: pos(s), pitch: 'clank', velocity: vel(v) }))],
};

// ---- gain automation: the record's mix level + rides, and the choke (gated to -60 dB)
function gainLane(base, rideKey) {
  const ride = score.automation?.[rideKey] ? rideCurve(score.automation[rideKey]) : () => 0;
  const at6 = t => +t.toFixed(6);
  const pts = new Map();
  for (const [st] of score.automation?.[rideKey] ?? []) pts.set(at6(at(st)), { value: base + ride(at(st)), transition: 'linear' });
  for (const h of res.plan.gateSpans) {
    const a = at(h.from), b = at(h.to);
    pts.set(at6(a), { value: base + ride(a), transition: 'linear' });
    pts.set(at6(a + 0.006), { value: -60, transition: 'step' });
    pts.set(at6(b - 0.004), { value: -60, transition: 'linear' });
    pts.set(at6(b), { value: base + ride(b), transition: 'linear' });
  }
  if (!pts.size) return undefined;
  if (!pts.has(0)) pts.set(0, { value: base + ride(0), transition: 'linear' });
  return [...pts.entries()].sort((x, y) => x[0] - y[0]).map(([t, p]) => ({ at: { seconds: t }, value: +p.value.toFixed(4), transition: p.transition }));
}
const drumTrack = (id, base, rideKey, description) => {
  const lane = gainLane(base, rideKey);
  return {
    id, description, instrument: { type: 'drumkit', kit: `assets/${id}/kit.json` }, mix: { gainDb: +base.toFixed(4), pan: 0 },
    ...(lane ? { automation: { gainDb: lane } } : {}),
    clips: [{ bar: 1, pattern: `${id}-all` }], patterns: [{ id: `${id}-all`, bars: 14, notes: notes[id] }],
  };
};

// ---- external stems (aligned from frame 0, exactly FRAMES long), at their pre-master level
const EXTERNAL = ['cable', 'beast', 'cablePartner', 'ratchet', 'room', 'kitchen', 'garage', 'echo'];
const externalTrack = name => {
  const b = res.stems[name];
  if (b.L.length !== FRAMES) throw new Error(`${name}: ${b.L.length} frames`);
  writeWav(join(out, 'assets', 'external', `${name}.wav`), b, 16);
  const id = name.replace(/[A-Z]/g, c => '-' + c.toLowerCase());
  return {
    id, description: `External DSP render (MORPH//05 record.mjs), not a DaemonV12 instrument: the ${name} stem, aligned from frame 0.`,
    instrument: { type: 'sampler', sample: `assets/external/${name}.wav` }, mix: { gainDb: 0, pan: 0 },
    clips: [{ bar: 1, pattern: `${id}-all` }], patterns: [{ id: `${id}-all`, bars: 14, notes: [{ start: '1:1', velocity: 1 }] }],
  };
};

const project = {
  formatVersion: 1,
  title: 'CABLE//BEAST v3 (DaemonV12 pre-master)',
  description: 'MORPH//05 record, V3. Percussion one-shots are native DaemonV12 drum-kit notes; the physical-model cable, Beast, ratchets and rooms are aligned external stems. Unity master: this is the pre-master mix.',
  bpm: 120, timeSignature: '4/4', bars: 14, seed: 1,
  render: { duration: { seconds: 28 }, tail: 'none' },
  master: { gainDb: 0 },
  tracks: [
    drumTrack('kick', mixp.kick, 'kick', 'Membrane kick (MORPH//04 kit.mjs): native drum-kit notes.'),
    drumTrack('snare', mixp.snare, 'snare', 'Membrane snares, ghosts, BIG snare and toaster spring: native drum-kit notes.'),
    drumTrack('toms', mixp.toms, 'toms', 'Cable toms, one sample per pitch: native drum-kit notes.'),
    drumTrack('ticks', mixp.perc, 'perc', 'Cable ticks, round-robin of 8: native drum-kit notes.'),
    drumTrack('metal', mixp.perc, 'perc', 'Alarm bells and press clank: native drum-kit notes.'),
    ...EXTERNAL.map(externalTrack),
  ],
};
writeFileSync(join(out, PROJECT), JSON.stringify(project, null, 1) + '\n');
mkdirSync(join(out, 'reference'), { recursive: true });
const refStems = Object.fromEntries(['kick', 'snare', 'toms', 'ticks', 'metal'].map(k => [k, res.stems[k]]));
for (const [k, b] of Object.entries(refStems)) writeWav(join(out, 'reference', `${k}.wav`), b, 24);
writeWav(join(out, 'reference', 'premaster.wav'), res.premaster, 24);
writeFileSync(join(out, 'reference', 'events.json'), JSON.stringify(res.rows.filter(r => ['kick', 'snare', 'toms', 'perc'].includes(r.part)).map(r => ({ part: r.part, event: r.event, step: r.step, sampleFrame: r.sampleFrame })), null, 1) + '\n');
console.log(`wrote ${join(out, PROJECT)}: ${project.tracks.length} tracks; native notes:`, Object.fromEntries(Object.entries(notes).map(([k, v]) => [k, v.length])),
  'premaster peak', peakOf(res.premaster).toFixed(3));
