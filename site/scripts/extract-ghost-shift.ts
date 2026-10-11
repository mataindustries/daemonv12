// Reads examples/ghost-shift.json (the V0.6 GHOST//SHIFT demo) and writes the pitch trace
// the site draws: every performed ghost-vox voice as semitones over time, following the
// engine's documented model (docs/V0_6_SAMPLE_PERFORMANCE.md): rate moves linearly over
// the glide, read position is the integral of rate, and a voice ends where the source
// runs out or the 12-second render boundary cuts it. Nothing here touches the engine;
// it is a drawing of the authored data. Run with `npm run ghost-shift` (needs the V0.6 example).
import {readFileSync, writeFileSync} from 'node:fs';
import {dirname, join} from 'node:path';
import {fileURLToPath} from 'node:url';
import {readWav} from './lib/wav.ts';

type Glide = {to: number; duration: string};
type Note = {start: string; pitch?: string; playbackRate?: number; offsetSeconds?: number; glide?: Glide};
type Track = {id: string; instrument: {type: string; sample?: string}; clips: {bar: number; pattern: string}[]; patterns: {id: string; notes: Note[]}[]};
type Project = {bpm: number; render: {duration: {seconds: number}}; tracks: Track[]};

const site = join(dirname(fileURLToPath(import.meta.url)), '..');
const examples = join(site, '..', 'examples');
const project = JSON.parse(readFileSync(join(examples, 'ghost-shift.json'), 'utf8')) as Project;

const TPB = 960;
const WHOLE = TPB * 4;
const secondsPerTick = 60 / project.bpm / TPB;
const end = project.render.duration.seconds;

/** "B:b" or "B:b+N/D" → ticks from the pattern start (whole-note fractions, 4/4). */
const positionTicks = (pos: string): number => {
  const m = /^(\d+):(\d+)(?:\+(\d+)\/(\d+))?$/.exec(pos);
  if (!m) throw new Error(`unsupported position ${pos}`);
  const frac = m[3] ? (Number(m[3]) / Number(m[4])) * WHOLE : 0;
  return (Number(m[1]) - 1) * WHOLE + (Number(m[2]) - 1) * TPB + frac;
};
const fractionTicks = (d: string): number => {
  const [n, den] = d.split('/').map(Number);
  return ((n ?? 0) / (den ?? 1)) * WHOLE;
};

const semis = (rate: number) => 12 * Math.log2(rate);
const r3 = (v: number) => Math.round(v * 1000) / 1000;

type Voice = {t0: number; t1: number; points: [number, number][]; glide: 'up' | 'down' | null};
const voices: Record<string, Voice[]> = {};
const GHOST = 'assets/glasshouse/04-ghost-vox.wav';

// Counted as docs/V0_6_SAMPLE_PERFORMANCE.md and tests/v06-demo.integration.test.ts do:
// over the authored ghost-vox notes, distinct values including the defaults.
const authored = project.tracks.filter(t => t.instrument.sample === GHOST).flatMap(t => t.patterns.flatMap(p => p.notes));
const counts = {
  rates: new Set(authored.map(n => n.playbackRate ?? 1)).size,
  offsets: new Set(authored.map(n => n.offsetSeconds ?? 0)).size,
  glidesUp: authored.filter(n => n.glide && n.glide.to > (n.playbackRate ?? 1)).length,
  glidesDown: authored.filter(n => n.glide && n.glide.to < (n.playbackRate ?? 1)).length,
};

for (const track of project.tracks) {
  for (const clip of track.clips) {
    const pattern = track.patterns.find(p => p.id === clip.pattern);
    if (!pattern) throw new Error(`${track.id}: missing pattern ${clip.pattern}`);
    for (const note of pattern.notes) {
      if (track.instrument.sample !== GHOST) continue;
      const r0 = note.playbackRate ?? 1;

      const source = readWav(join(examples, track.instrument.sample));
      const F = source.samples.length;
      const sr = source.rate;
      const t0 = ((clip.bar - 1) * WHOLE + positionTicks(note.start)) * secondsPerTick;
      const r1 = note.glide?.to ?? r0;
      const G = note.glide ? fractionTicks(note.glide.duration) * secondsPerTick * sr : 0;
      const offset = Math.round((note.offsetSeconds ?? 0) * sr);
      const rateAt = (n: number) => (n < G ? r0 + ((r1 - r0) * n) / G : r1);
      const positionAt = (n: number) => (n <= G ? offset + n * (r0 + ((r1 - r0) * n) / (2 * G)) : offset + (G * (r0 + r1)) / 2 + (n - G) * r1);
      // First output frame whose read position reaches the source length.
      let lo = 0;
      let hi = Math.ceil((F - offset) / Math.min(r0, r1)) + 1;
      while (lo < hi) {
        const mid = Math.floor((lo + hi) / 2);
        if (positionAt(mid) >= F) hi = mid;
        else lo = mid + 1;
      }
      const t1 = Math.min(end, t0 + lo / sr);
      const steps = note.glide ? 24 : 1;
      const points: [number, number][] = [];
      for (let s = 0; s <= steps; s++) {
        const t = t0 + ((t1 - t0) * s) / steps;
        points.push([r3(t), r3(semis(rateAt((t - t0) * sr)))]);
      }
      (voices[track.id] ??= []).push({t0: r3(t0), t1: r3(t1), points, glide: note.glide ? (r1 > r0 ? 'up' : 'down') : null});
    }
  }
}

const out = {
  source: 'examples/ghost-shift.json',
  seconds: end,
  bpm: project.bpm,
  sourceSeconds: r3(readWav(join(examples, GHOST)).seconds),
  counts,
  voices,
};
writeFileSync(join(site, 'src', 'data', 'ghost-shift.json'), JSON.stringify(out) + '\n');
console.log(JSON.stringify(out.counts), Object.entries(voices).map(([k, v]) => `${k}:${v.length}`).join(' '));
