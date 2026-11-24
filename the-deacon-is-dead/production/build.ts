/**
 * THE DEACON KNOCKS BACK · a production made only from one printed record.
 *
 * Source: THE VELVET HEARSE, "The Deacon Is Dead" (1972, imaginary), printed once by the Signature Rack and the Timbre
 * Lab (assets/record/the-velvet-hearse--the-deacon-is-dead.wav). Every sound here is read from that print by the
 * unchanged DaemonV12 sampler: slices, rates, glides, gates, envelopes and choke groups, plus per-track effects.
 * Nothing is synthesised and nothing is derived offline.
 *
 * The record is in seven equal steps to the octave. It plays at 0.820336 of its speed, which is two steps of its own
 * scale: 117.03 BPM becomes 96 BPM, each record beat one grid beat, and every pitch stays inside the seven-step
 * lattice. Re-pitched chops move by whole steps too: rate = R x 2^(k/7).
 *
 * The record mourned him. Here he answers. The hook is a conversation: every second bar the band stops for Iggy's three
 * knocks on the lid, and the next downbeat is the Deacon's reply, his knock from inside slowed to the tonic an octave
 * under the bass.
 *
 *   bars  1-2   VIEWING        the door groans at half speed; three knocks; the reply; the likembe picks up
 *   bars  3-8   WAKE           rebuilt from one-shots: the urn is the kick, the bead slap the snare, coins the hats,
 *                              the hearse spring a new bass line with glides, the likembe alone underneath. Three
 *                              knock-and-reply pairs; Odile's drum answers in the second and third
 *   bars  9-10  ODILE          the floor: the record as found, her drum talking over the likembe a fourth higher;
 *                              then she cannot stop laughing
 *   bars 11-14  SEVEN STEPS    the pallbearers' seven bars cut to seven half-bars: the harmony climbs a step every two
 *                              beats over a four-on-the-floor march; two stabs
 *   bar  15     KNOCK          silence, the door; knock .. knock .. and the third knock from inside is the drop
 *   bars 16-21  KNOCKS BACK    the record's hot shout; the knocks turn into a tune: as found, then a neutral triad,
 *                              then the coffin's whole seven-step scale, each answered from inside
 *   bar  22     CLOSED CASKET  the record's last hit and the spring's laser; one more knock from inside; the door
 *
 *   node the-deacon-is-dead/production/build.ts [TAG]     (needs FFmpeg; writes the project, renders into work/TAG)
 */
import { execFileSync } from 'node:child_process';
import { readFileSync, rmSync, writeFileSync } from 'node:fs';
import { dirname, join, relative, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { formatPosition } from '../../src/timing/musical-time.ts';

const HERE = dirname(fileURLToPath(import.meta.url)), ROOT = resolve(HERE, '..'), REPO = resolve(ROOT, '..');
const CLI = join(REPO, 'bin', 'daemonv12.js'), WORK = join(ROOT, 'work');
export const TITLE = 'THE DEACON KNOCKS BACK', SLUG = 'the-deacon-knocks-back';
const BPM = 96, PPQ = 960, WHOLE = 4 * PPQ, BEAT_S = Math.round(60e6 / BPM) / 1e6, TICK_S = BEAT_S / PPQ, BARS = 23, SECONDS = 58.5;
const dig = JSON.parse(readFileSync(join(HERE, 'chops.json'), 'utf8'));
const PRINT: string = dig.print;
/** The record's beat onto this grid: pitch and tempo move together, as on a turntable (two steps of seven down). */
export const R = +(dig.recordBeatSeconds / BEAT_S).toFixed(6);
/** Rate for `k` steps of seven-per-octave above the slowed record. */
const st = (k: number) => +(R * 2 ** (k / 7)).toFixed(6);
/** The reply: the knock from inside (recorded three steps under the tonic) moved down to the tonic an octave below. */
const REPLY = st(-4);

// ------------------------------------------------------------------------------------------------ placing chops
type Track = 'lik' | 'knock' | 'reply' | 'kick' | 'snare' | 'hat' | 'bass' | 'whoop' | 'odile' | 'loop' | 'stabs' | 'door';
interface Ev { track: Track; beat: number; chop: string; rate?: number; vel?: number; gate?: number; ms?: number; attack?: number; release?: number; choke?: string; glide?: [number, number] }
const events: Ev[] = [];
const put = (track: Track, beat: number, chop: string, o: Omit<Ev, 'track' | 'beat' | 'chop'> = {}) => { if (!dig.chops[chop]) throw new Error(`no chop ${chop}`); events.push({ track, beat, chop, ...o }); };
let seed = 1972;
const rnd = () => { let t = (seed = (seed + 0x6d2b79f5) >>> 0); t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
const jitter = (ms: number) => (rnd() * 2 - 1) * ms;
/** The record's swing (0.54 on sixteenths), so new parts sit in the loops' pocket. */
const sw = (beat: number) => { const s = beat * 4, k = Math.round(s); return Math.abs(s - k) < 1e-9 && ((k % 2) + 2) % 2 === 1 ? beat + 0.02 : beat; };

/** The sampler note for one event: the record's beat inside the chop lands on `beat` (plus `ms` of feel). */
function note(e: Ev) {
  const rate = e.rate ?? R, c = dig.chops[e.chop];
  const tick = Math.max(0, Math.round(sw(e.beat) * PPQ - c.leadSeconds / rate / TICK_S + (e.ms ?? 0) / 1000 / TICK_S));
  const n: Record<string, unknown> = { tick, velocity: +Math.min(1, Math.max(0.01, e.vel ?? 1)).toFixed(3) };
  if (Math.abs(rate - 1) > 1e-9) n.playbackRate = rate;
  if (c.offsetSeconds > 0) n.offsetSeconds = c.offsetSeconds;
  n.endSeconds = c.endSeconds;
  if (e.gate !== undefined) n.gate = `${Math.max(1, Math.round(e.gate * PPQ))}/${WHOLE}`;
  n.envelope = { attackSeconds: e.attack ?? 0.002, releaseSeconds: e.release ?? 0.012 };
  if (e.choke) n.chokeGroup = e.choke;
  if (e.glide) n.glide = { to: e.glide[0], duration: `${Math.max(1, Math.round(e.glide[1] * PPQ))}/${WHOLE}` };
  return n;
}

// ------------------------------------------------------------------------------------------------ the parts (grid beats)
const S = (slot: number) => slot / 4;
const drum = { attack: 0.0005, release: 0.03 };
const kickHit = (b: number, v: number, ms = 0) => put('kick', b, 'kick', { ...drum, gate: 0.4, vel: v, ms: ms + jitter(2) });
const snareHit = (b: number, v: number, ms = 14) => put('snare', b, 'snare', { ...drum, gate: 0.62, release: 0.06, vel: v, ms: ms + jitter(3) });
const ghost = (b: number, v = 0.5) => put('snare', b, 'tap', { ...drum, gate: 0.2, vel: v, ms: 8 + jitter(3) });
const hats = (b0: number, slots: number, vel = 1) => { for (let s = 0; s < slots; s++) put('hat', b0 + S(s), 'coins', { attack: 0.0005, release: 0.01, gate: 0.18, vel: (s % 4 === 2 ? 0.95 : s % 2 ? 0.55 : 0.7) * vel + jitter(0.06), ms: jitter(3) }); };
/** Refinement R1: Iggy knocks an octave (seven steps) above the record, crisp wood a phone can hear, against the Deacon's
 * deep reply. In the creative pass they sat at the record's pitch (90 Hz here), 83 % of their energy below 120 Hz. */
const KNOCK_UP = 7;
/** Iggy's three knocks (slots 10 12 14), optionally re-pitched by steps. */
const knocks = (b0: number, steps: [number, number, number] = [0, 0, 0], v = 1) =>
  (['knock-1', 'knock-2', 'knock-3'] as const).forEach((c, i) => put('knock', b0 + 2.5 + 0.5 * i, c, { rate: st(steps[i] + KNOCK_UP), gate: 0.45, release: 0.04, vel: v }));
/** The Deacon's reply on a downbeat. Refinement R2: a one-beat thud (it was 1.6 beats, a sub drone under the groove). */
const reply = (b: number, v = 1) => put('reply', b, 'inside-3', { rate: REPLY, gate: 1, release: 0.2, vel: v, choke: 'reply' });
/** The spring bass, one bar. A: tonic, a long fifth, the neutral third, a seventh that glides home. B: tonic, a fifth that sags, then silence.
 * On a bar the Deacon opens, his reply is the downbeat: no spring there. */
const bassBar = (b0: number, knockBar: boolean, replied = false) => {
  const sp = (slot: number, k: number, gate: number, v: number, glide?: [number, number]) =>
    put('bass', b0 + S(slot), 'boing-0', { rate: st(k), gate, vel: v, choke: 'bass', attack: 0.002, release: 0.05, ms: -4, ...(glide ? { glide: [st(glide[0]), glide[1]] as [number, number] } : {}) });
  if (!replied) sp(0, 0, 0.7, 1);
  if (!knockBar) { sp(6, 4, 1.1, 0.95); sp(11, 2, 0.35, 0.72); sp(14, 6, 0.5, 0.85, [7, 0.25]); }
  else sp(6, 4, 1.05, 0.95, [3, 0.6]);
};

// bars 1-2, VIEWING
put('door', 0, 'door-lid', { rate: R / 2, gate: 2.3, attack: 0.05, release: 0.25, vel: 0.9 });
knocks(0);
reply(4);
put('bass', 5.5, 'boing-0', { rate: R, gate: 0.9, release: 0.1, vel: 0.8, choke: 'bass' });
put('lik', 6.25, 'lik-pick', { gate: 1.75, choke: 'lik', release: 0.02 });

// bars 3-8, WAKE: three knock-and-reply pairs
for (let p = 0; p < 3; p++) {
  const A = 8 + 8 * p, B = A + 4;
  put('lik', A, 'thumb-a', { gate: 4, choke: 'lik', release: 0.015 });
  put('lik', B, 'thumb-b', { gate: 2.45, choke: 'lik', release: 0.04 });
  knocks(B);
  if (p > 0) reply(A, 0.95);
  // drums: kick 1, a-of-1, and-of-3, a-of-4 | 1, a-of-2, then out for the knocks
  if (p === 0) kickHit(A, 1);   // after that the reply is the downbeat
  kickHit(A + S(3), 0.45); kickHit(A + S(10), 0.92); kickHit(A + S(14), 0.4);
  kickHit(B, 1); kickHit(B + S(7), 0.7);
  snareHit(A + 1, 0.95); snareHit(A + 3, 0.95); snareHit(B + 1, 0.95);
  if (p > 0) { ghost(A + S(7)); ghost(A + S(9), 0.4); ghost(A + S(15), 0.45); ghost(B + S(6), 0.4); }
  hats(A, 16, p ? 1 : 0.8); hats(B, 10, p ? 1 : 0.8);
  bassBar(A, false, p > 0); bassBar(B, true);
  if (p > 0) put('whoop', A + S(9), 'whoop', { gate: 0.4, vel: 0.85, ms: -3 });
  if (p === 1) put('odile', A + S(7), 'hihi', { gate: 0.6, vel: 0.95, release: 0.04 });
  if (p === 2) put('odile', A + S(6), 'ooo', { gate: 0.9, vel: 0.95, release: 0.06 });
}

// bars 9-10, ODILE: the record as found (root 3), then the laugh stutters
reply(32);
put('loop', 32, 'odile-ab', { gate: 6, choke: 'loop', release: 0.03 });
put('odile', 38, 'laugh', { gate: 0.5, vel: 1, choke: 'laugh', release: 0.02 });
put('odile', 38.5, 'laugh', { gate: 0.5, vel: 1, choke: 'laugh', release: 0.02 });
put('odile', 39, 'laugh', { gate: 1, vel: 1, choke: 'laugh', release: 0.03 });
hats(38, 8, 0.55);

// bars 11-14, SEVEN STEPS: one step every two beats, a march underneath
for (let i = 0; i < 7; i++) put('loop', 40 + 2 * i, `step-${i + 1}`, { gate: 2, choke: 'loop', release: 0.015 });
for (let q = 0; q < 14; q++) {
  kickHit(40 + q, 0.7 + 0.3 * q / 13);
  if (q % 2) snareHit(40 + q, 0.75 + 0.2 * q / 13, 10);
  hats(40 + q, 4, 0.6 + 0.4 * q / 13);
}
for (const s of [1, 2, 3]) ghost(52 + 1 + S(s), 0.35 + 0.15 * s);
for (const [b, c] of [[54, 'stab-1'], [54.75, 'stab-2']] as [number, string][]) { put('stabs', b, c, { gate: c === 'stab-1' ? 0.7 : 1.2, release: 0.12 }); kickHit(b, 1); }

// bar 15, KNOCK: silence, the door lifting, knock .. knock .. and the third is the downbeat
put('door', 56.25, 'door-knock', { rate: R / 2, gate: 1.9, attack: 0.1, release: 0.3, vel: 0.85 });
put('reply', 58.5, 'inside-1', { gate: 0.7, release: 0.06 });
put('reply', 59.25, 'inside-2', { gate: 0.7, release: 0.06 });

// bars 16-21, KNOCKS BACK
const TUNES: [number, number, number][] = [[0, 0, 0], [0, 2, 4]];
for (let p = 0; p < 3; p++) {
  const A = 60 + 8 * p, B = A + 4;
  if (p === 0) put('reply', A, 'inside-3', { gate: 0.7, release: 0.06 });
  reply(A, 1);
  put('loop', A, 'shout-a', { gate: 4, choke: 'loop', release: 0.015 });
  if (p === 0) put('loop', B, 'shout-bk', { gate: 4, choke: 'loop', release: 0.04 });        // as found: the third knock is his
  else put('loop', B, 'shout-b', { gate: p === 2 ? 2.2 : 2.45, choke: 'loop', release: 0.04 });
  if (p === 1) knocks(B, TUNES[1]!);
  if (p === 2) for (let k = 0; k < 7; k++) put('knock', B + 2.25 + S(k), k % 3 === 0 ? 'knock-1' : k % 3 === 1 ? 'knock-2' : 'knock-3', { rate: st(k + KNOCK_UP), gate: 0.3, release: 0.03, vel: 0.85 + 0.02 * k });
  kickHit(A + S(10), 0.9); kickHit(A + S(14), 0.45); kickHit(B, 1); kickHit(B + S(7), 0.75);
  snareHit(A + 1, 1); snareHit(A + 3, 1); snareHit(B + 1, 1);
  ghost(A + S(7), 0.5); ghost(A + S(15), 0.5);
  hats(A, 16); hats(B, p === 2 ? 9 : 10);
}

// bar 22, CLOSED CASKET
reply(84, 1);
put('loop', 84, 'out', { gate: 4, choke: 'loop', release: 0.5 });
put('reply', 88, 'inside-out', { rate: REPLY, gate: 1.5, release: 0.3, vel: 0.9 });
put('door', 88.75, 'door-out', { gate: 2.6, attack: 0.05, release: 0.4, vel: 0.85 });

// ------------------------------------------------------------------------------------------------ the project
const m = { numerator: 4, denominator: 4 };
const TRACKS: Record<Track, { description: string; gainDb: number; pan?: number; effects: object[] }> = {
  lik: { description: "Lucius's likembe alone (the record's thumb section and pickup), seven equal steps, the bed under the wake.", gainDb: 2, pan: 0.15,
    effects: [{ type: 'highpass', frequencyHz: 220 }, { type: 'lowpass', frequencyHz: 8000 }, { type: 'saturation', driveDb: 6, mix: 0.3 }] },
  knock: { description: "Iggy's three knocks on the lid, as found, as a neutral triad, as the coffin's seven-step scale; an octave above the record (R1).", gainDb: 3,
    effects: [{ type: 'highpass', frequencyHz: 120 }, { type: 'saturation', driveDb: 15, mix: 0.55 }, { type: 'compressor', thresholdDb: -18, ratio: 3, attackMs: 3, releaseMs: 90, makeupGainDb: 2 }, { type: 'reverb', roomSize: 0.3, decaySeconds: 0.6, wet: 0.08 }] },
  reply: { description: 'The Deacon\'s knock from inside at 0.552 of its speed: the tonic an octave under the bass, saturated so a phone hears it; also his three knocks before the drop, as recorded.', gainDb: -3,
    effects: [{ type: 'lowpass', frequencyHz: 4000 }, { type: 'saturation', driveDb: 18, mix: 0.6 }, { type: 'compressor', thresholdDb: -16, ratio: 3, attackMs: 8, releaseMs: 160, makeupGainDb: 2 }] },
  kick: { description: 'The urn: one palm thud from the break.', gainDb: 1,
    effects: [{ type: 'highpass', frequencyHz: 32 }, { type: 'saturation', driveDb: 8, mix: 0.4 }, { type: 'compressor', thresholdDb: -16, ratio: 4, attackMs: 5, releaseMs: 80, makeupGainDb: 3 }] },
  snare: { description: 'The rosary-bead snare: one slap and one ghost tap from the break, laid back.', gainDb: 6, pan: 0.05,
    effects: [{ type: 'highpass', frequencyHz: 140 }, { type: 'saturation', driveDb: 8, mix: 0.4 }, { type: 'compressor', thresholdDb: -18, ratio: 3, attackMs: 4, releaseMs: 110, makeupGainDb: 2 }, { type: 'reverb', roomSize: 0.35, decaySeconds: 0.8, wet: 0.1 }] },
  hat: { description: 'One shake of the collection plate, on every sixteenth.', gainDb: 11, pan: -0.25,
    effects: [{ type: 'highpass', frequencyHz: 1400 }, { type: 'lowpass', frequencyHz: 13000 }] },
  bass: { description: 'The hearse spring tried once on the tonic, played as a new bass line in seven equal steps, with glides.', gainDb: 0,
    effects: [{ type: 'lowpass', frequencyHz: 2600 }, { type: 'saturation', driveDb: 9, mix: 0.4 }, { type: 'compressor', thresholdDb: -18, ratio: 3, attackMs: 8, releaseMs: 140, makeupGainDb: 2 }] },
  whoop: { description: "The urn's whoop, tried once.", gainDb: 8, pan: 0.2, effects: [{ type: 'highpass', frequencyHz: 90 }] },
  odile: { description: "Odile's friction drum: squeaks, a moan, a laugh that stutters.", gainDb: 6, pan: -0.2,
    effects: [{ type: 'highpass', frequencyHz: 200 }, { type: 'lowpass', frequencyHz: 5000 }, { type: 'delay', timeMs: 469, wet: 0.16 }, { type: 'reverb', roomSize: 0.5, decaySeconds: 1.4, wet: 0.14 }] },
  loop: { description: 'The record as found: two bars of Odile, the seven steps cut to half-bars, the hot shout, the last bar.', gainDb: -1,
    effects: [{ type: 'highpass', frequencyHz: 55 }, { type: 'saturation', driveDb: 4, mix: 0.25 }, { type: 'compressor', thresholdDb: -18, ratio: 2.5, attackMs: 12, releaseMs: 120, makeupGainDb: 2 }] },
  stabs: { description: "The record's two tutti stabs.", gainDb: 0, effects: [{ type: 'highpass', frequencyHz: 60 }, { type: 'saturation', driveDb: 6, mix: 0.35 }] },
  door: { description: 'The preparation-room door: opening at half speed, lifting at half speed, closing.', gainDb: 8, pan: -0.35,
    effects: [{ type: 'highpass', frequencyHz: 45 }, { type: 'reverb', roomSize: 0.7, decaySeconds: 2.2, wet: 0.22 }] },
};

export function project() {
  const order = Object.keys(TRACKS) as Track[];
  return {
    formatVersion: 1, title: TITLE,
    description: 'A production made only from one printed record: THE VELVET HEARSE, "The Deacon Is Dead" (1972, imaginary), a funeral home played as a band in seven equal steps. Slowed two of its own steps to 96 BPM, rebuilt from one-shots, with the Deacon answering every knock from inside.',
    bpm: BPM, timeSignature: '4/4', bars: BARS, seed: 1972,   // no key: seven equal steps have no 12-tone key
    render: { duration: { seconds: SECONDS }, tail: 'auto' },
    // the compressor's 0.1 ms attack catches the bead snare's spikes; tanh at full mix is the soft ceiling.
    // Refinement R3: makeup 5.5 -> 6.5 dB, to the true-peak guardrail (R1 had taken the knocks' sub energy out).
    master: { gainDb: 0, effects: [{ type: 'highpass', frequencyHz: 24 }, { type: 'compressor', thresholdDb: -12, ratio: 2.5, attackMs: 0.1, releaseMs: 90, makeupGainDb: 6.5 }, { type: 'saturation', driveDb: 0, mix: 1 }] },
    tracks: order.map(id => {
      const t = TRACKS[id], notes = events.filter(e => e.track === id).map(note).sort((a, b) => (a.tick as number) - (b.tick as number));
      return {
        id, description: t.description, instrument: { type: 'sampler', sample: PRINT },
        mix: { gainDb: t.gainDb, ...(t.pan ? { pan: t.pan } : {}) }, effects: t.effects, clips: [{ bar: 1, pattern: 'song' }],
        patterns: [{ id: 'song', bars: BARS, notes: notes.map(({ tick, ...rest }) => ({ start: formatPosition(tick as number, m), ...rest })) }],
      };
    }),
  };
}

// ------------------------------------------------------------------------------------------------ build
if (import.meta.url === `file://${process.argv[1]}`) {
  const proj = project();
  const file = join(ROOT, `${SLUG}.json`);
  writeFileSync(file, JSON.stringify(proj, null, 1) + '\n');
  const tag = process.argv[2] ?? 'beat', out = join(WORK, tag);
  rmSync(out, { recursive: true, force: true });
  const t0 = Date.now();
  const res = JSON.parse(execFileSync(process.execPath, [CLI, 'render', file, '--out-dir', out, '--stems', '--format', 'wav,mp3', '--reuse-voices', '--json'], { encoding: 'utf8', maxBuffer: 1 << 28 }));
  if (!res.ok) throw new Error(JSON.stringify(res.errors ?? res, null, 1));
  const manifest = JSON.parse(readFileSync(join(out, `${SLUG}.render.json`), 'utf8'));
  const an = JSON.parse(execFileSync(process.execPath, [CLI, 'analyze', join(out, `${SLUG}.wav`), '--json'], { encoding: 'utf8' })).analysis;
  console.log(`${TITLE}: ${relative(REPO, out)} in ${((Date.now() - t0) / 1000).toFixed(1)} s; ${an.durationSeconds ?? ''} s, ${an.integratedLufs} LUFS, ${an.truePeakDbfs} dBTP, LRA ${an.loudnessRangeLu}`);
  const prod = manifest.production ?? {};
  console.log(`master clipped ${prod.master?.clippedSamples} pre-clip peak ${prod.master?.preClipPeakDbfs}`);
  for (const t of prod.tracks ?? []) console.log(`  ${t.trackId.padEnd(7)} clipped ${String(t.clippedSamples).padStart(6)}  pre-clip peak ${t.preClipPeakDbfs}`);
  console.log(`events: ${events.length}; rate ${R}; reply rate ${REPLY}`);
  if (res.warnings?.length) console.log('warnings:', JSON.stringify(res.warnings).slice(0, 800));
}
