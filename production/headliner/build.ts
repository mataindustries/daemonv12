/** Genre-neutral offline authoring; no engine changes or imported audio. Node 22.18+. */
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { mkdirSync, readFileSync, readdirSync, writeFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const RATE = 44100;
export const ENGINE_BASE = 'e2962cc1a443c841cd6ca7cb2cc56c5ebabf0e99';
export const sha256 = (bytes: Uint8Array) => createHash('sha256').update(bytes).digest('hex');
export interface PerformanceNote {
  beat: number; midi: number; durationBeats: number; velocity: number;
  slideFrom?: number; vibratoCents?: number; expression?: [number, number];
}
interface Instrument {
  partials: number[]; attackSeconds: number; decaySeconds: number; sampleSeconds: number; noise: number;
}
interface Section { id: string; bars: number; development: string }
interface Trigger { beat: number; midi?: number; phrase?: string; velocity: number }
export interface Score {
  title: string; bpm: number; key: string; seed: number;
  instruments: Record<string, Instrument>;
  phrases: Record<string, { instrument: string; beats: number; notes: PerformanceNote[] }>;
  sections: Section[];
  tracks: { id: string; instrument: string; gainDb: number; pan: number; sections: Record<string, Trigger[]> }[];
  variations: Record<string, { omitTracks: string[] }>;
}
const id = (s: string) => assert.match(s, /^[a-z][a-z0-9-]{0,31}$/);
const bounded = (v: number, lo: number, hi: number) => assert.ok(Number.isFinite(v) && v >= lo && v <= hi, `${v} outside ${lo}..${hi}`);
const json = (value: unknown) => JSON.stringify(value, null, 2) + '\n';
export function files(root: string): string[] {
  root = resolve(root);
  const entries = readdirSync(root, { recursive: true, withFileTypes: true });
  assert.ok(entries.every(e => e.isFile() || e.isDirectory()), 'package contains a symlink or special file');
  return entries.filter(e => e.isFile())
    .map(e => join(e.parentPath, e.name).slice(root.length + 1)).sort();
}
/** Exact file-set verification catches missing, modified AND unlisted files. */
export function verifyPackage(root: string) {
  const lines = readFileSync(join(root, 'SHA256SUMS'), 'utf8').trim().split('\n');
  const expected = lines.map(line => {
    const m = /^([a-f0-9]{64})  ([a-zA-Z0-9/_.-]+)$/.exec(line); assert.ok(m, 'invalid hash entry');
    const name = m[2]!; assert.ok(!name.startsWith('/') && !name.split('/').includes('..'));
    assert.equal(sha256(readFileSync(join(root, name))), m[1], name); return name;
  });
  assert.deepEqual(files(root).filter(f => f !== 'SHA256SUMS'), expected.sort());
  return expected.length;
}
export function sealPackage(root: string) {
  writeFileSync(join(root, 'SHA256SUMS'), files(root).filter(f => f !== 'SHA256SUMS')
    .map(f => `${sha256(readFileSync(join(root, f)))}  ${f}\n`).join(''));
}
function validate(score: Score) {
  bounded(score.bpm, 20, 300); bounded(score.seed, 0, 0xffffffff); assert.ok(Number.isInteger(score.seed));
  bounded(score.sections.length, 1, 1000); bounded(score.tracks.length, 1, 15);
  for (const names of [score.sections.map(s => s.id), score.tracks.map(t => t.id)]) {
    names.forEach(id); assert.equal(new Set(names).size, names.length, 'duplicate ID');
  }
  for (const s of score.sections) { bounded(s.bars, 1, 1000); assert.ok(Number.isInteger(s.bars)); assert.ok(s.development.length); }
  const beatSeconds = Math.round(60_000_000 / score.bpm) / 1_000_000;
  assert.ok(score.sections.reduce((n, s) => n + s.bars, 0) * 4 * beatSeconds + 1 <= 600, 'engine duration limit');
  for (const [name, inst] of Object.entries(score.instruments)) {
    id(name); bounded(inst.partials.length, 1, 16); inst.partials.forEach(p => bounded(p, 0, 1));
    assert.ok(inst.partials.some(p => p > 0)); bounded(inst.attackSeconds, 0.001, 1);
    bounded(inst.decaySeconds, 0.01, 8); bounded(inst.sampleSeconds, 0.05, 10); bounded(inst.noise, 0, 0.1);
  }
  for (const [name, phrase] of Object.entries(score.phrases)) {
    id(name); assert.ok(score.instruments[phrase.instrument]); bounded(phrase.beats * beatSeconds, 0.05, 16);
    bounded(phrase.notes.length, 1, 128);
    for (const note of phrase.notes) {
      bounded(note.beat, 0, phrase.beats); bounded(note.midi, 24, 96); bounded(note.velocity, 0.01, 1);
      bounded(note.durationBeats, 0.01, phrase.beats - note.beat);
      if (note.slideFrom !== undefined) bounded(note.slideFrom, 24, 96);
      if (note.vibratoCents !== undefined) bounded(note.vibratoCents, 0, 100);
      if (note.expression) { assert.equal(note.expression.length, 2); note.expression.forEach(v => bounded(v, 0, 1)); }
    }
  }
  for (const track of score.tracks) {
    assert.ok(score.instruments[track.instrument]); bounded(track.gainDb, -60, 0); bounded(track.pan, -1, 1);
    for (const [section, notes] of Object.entries(track.sections)) {
      const s = score.sections.find(s => s.id === section); assert.ok(s, `unknown section ${section}`);
      for (const note of notes) {
        bounded(note.beat, 0, s.bars * 4 - 0.000001); bounded(note.velocity, 0.01, 1);
        assert.ok(Math.round(note.beat * 960) < s.bars * 3840, 'onset rounds outside section');
        assert.ok((note.midi !== undefined) !== (note.phrase !== undefined), 'choose a note or phrase');
        if (note.midi !== undefined) { bounded(note.midi, 24, 96); assert.ok(Number.isInteger(note.midi)); }
        if (note.phrase !== undefined) {
          const p = score.phrases[note.phrase]; assert.ok(p && p.instrument === track.instrument);
          assert.ok(note.beat + p.beats <= s.bars * 4, 'phrase crosses its section');
        }
      }
    }
  }
  for (const [name, variation] of Object.entries(score.variations)) {
    id(name); assert.notEqual(name, 'main');
    assert.ok(variation.omitTracks.length < score.tracks.length);
    variation.omitTracks.forEach(t => assert.ok(score.tracks.some(track => track.id === t)));
  }
}
/** Additive tone + seeded breath. Pitch, duration and expression are synthesized before rate-1 playback. */
function synth(inst: Instrument, notes: PerformanceNote[], seconds: number, beatSeconds: number, seed: number) {
  const samples = new Float64Array(Math.round(seconds * RATE)); let state = seed || 1;
  const random = () => { state ^= state << 13; state ^= state >>> 17; state ^= state << 5; return (state >>> 0) / 2147483648 - 1; };
  for (const note of notes) {
    const start = Math.round(note.beat * beatSeconds * RATE), duration = note.durationBeats * beatSeconds;
    let phase = 0;
    for (let i = 0; i < Math.round(duration * RATE) && start + i < samples.length; i++) {
      const t = i / RATE, u = t / duration;
      const midi = note.midi + ((note.slideFrom ?? note.midi) - note.midi) * Math.exp(-t / 0.045)
        + (note.vibratoCents ?? 0) / 100 * Math.sin(2 * Math.PI * 5 * t) * Math.min(1, t / 0.12);
      const hz = 440 * 2 ** ((midi - 69) / 12); phase += 2 * Math.PI * hz / RATE;
      let tone = 0;
      inst.partials.forEach((amplitude, p) => { if (hz * (p + 1) < RATE * 0.45) tone += amplitude * Math.sin(phase * (p + 1)); });
      const [a, b] = note.expression ?? [1, 1];
      const envelope = Math.min(1, t / inst.attackSeconds, (duration - t) / 0.035) * Math.exp(-t / inst.decaySeconds);
      samples[start + i]! += (tone + inst.noise * random()) * envelope * note.velocity * (a + (b - a) * u) * 0.22;
    }
  }
  // Canonical mono PCM16 WAV; reserve headroom, never normalize away expression.
  const bytes = Buffer.alloc(44 + samples.length * 2);
  bytes.write('RIFF'); bytes.writeUInt32LE(bytes.length - 8, 4); bytes.write('WAVEfmt ', 8);
  bytes.writeUInt32LE(16, 16); bytes.writeUInt16LE(1, 20); bytes.writeUInt16LE(1, 22);
  bytes.writeUInt32LE(RATE, 24); bytes.writeUInt32LE(RATE * 2, 28); bytes.writeUInt16LE(2, 32);
  bytes.writeUInt16LE(16, 34); bytes.write('data', 36); bytes.writeUInt32LE(samples.length * 2, 40);
  samples.forEach((v, i) => { assert.ok(Math.abs(v) < 1, 'source clips'); bytes.writeInt16LE(Math.round(v * 32767), 44 + i * 2); });
  return bytes;
}
function position(beat: number) {
  const tick = Math.round(beat * 960), off = tick % 960;
  return `${Math.floor(tick / 3840) + 1}:${Math.floor(tick % 3840 / 960) + 1}${off ? `+${off}/3840` : ''}`;
}
/** Writes a NEW self-contained source project; refuses to overwrite existing work. */
export function buildPackage(scoreFile: string, output: string) {
  const score = JSON.parse(readFileSync(scoreFile, 'utf8')) as Score; validate(score);
  const beatSeconds = Math.round(60_000_000 / score.bpm) / 1_000_000;
  const root = resolve(output); mkdirSync(root); mkdirSync(join(root, 'assets')); mkdirSync(join(root, 'source'));
  const write = (name: string, value: string | Buffer) => { mkdirSync(dirname(join(root, name)), { recursive: true }); writeFileSync(join(root, name), value); };
  write('score.json', json(score)); write('source/build.ts', readFileSync(fileURLToPath(import.meta.url)));
  const sounds: { file: string; sha256: string; frames: number; channels: number; sampleRate: number; bitsPerSample: number; recipe: unknown }[] = [];
  const tracks = score.tracks.map(track => {
    const inst = score.instruments[track.instrument]!, bank = new Map<string, { file: string; recipe: unknown; bytes: Buffer }>();
    const hit = (event: Trigger) => event.phrase ? `phrase-${event.phrase}` : `note-${event.midi}`;
    for (const event of Object.values(track.sections).flat()) {
      const name = hit(event); if (bank.has(name)) continue;
      const phrase = event.phrase ? score.phrases[event.phrase]! : undefined;
      const seconds = phrase ? phrase.beats * beatSeconds : inst.sampleSeconds;
      const notes = phrase?.notes ?? [{ beat: 0, midi: event.midi!, durationBeats: seconds / beatSeconds, velocity: 1 }];
      const recipe = { instrument: track.instrument, parameters: inst, notes, seconds, seed: score.seed };
      bank.set(name, { file: `assets/${track.id}/${name}.wav`, recipe, bytes: synth(inst, notes, seconds, beatSeconds, score.seed) });
    }
    assert.ok(bank.size > 0 && bank.size <= 128, 'kit must have 1..128 sounds');
    const samples = [...bank].map(([name, sound], pitch) => {
      write(sound.file, sound.bytes); sounds.push({ file: sound.file, sha256: sha256(sound.bytes), frames: (sound.bytes.length - 44) / 2,
        channels: 1, sampleRate: RATE, bitsPerSample: 16, recipe: sound.recipe });
      return { name, pitch, file: `${name}.wav` };
    });
    write(`assets/${track.id}/kit.json`, json({ formatVersion: 1, samples }));
    let bar = 1;
    const clips = score.sections.flatMap(section => { const at = bar; bar += section.bars; return track.sections[section.id]?.length ? [{ bar: at, pattern: section.id }] : []; });
    return { id: track.id, instrument: { type: 'drumkit', kit: `assets/${track.id}/kit.json` }, mix: { gainDb: track.gainDb, pan: track.pan }, clips,
      patterns: score.sections.filter(s => track.sections[s.id]?.length).map(s => ({ id: s.id, bars: s.bars,
        notes: track.sections[s.id]!.map(e => ({ start: position(e.beat), pitch: hit(e), velocity: e.velocity })) })) };
  });
  const bars = score.sections.reduce((n, s) => n + s.bars, 0);
  for (const [name, omitted] of [['main', []], ...Object.entries(score.variations).map(([name, v]) => [name, v.omitTracks])] as [string, string[]][]) {
    write(`${name}.json`, json({ formatVersion: 1, title: `${score.title} (${name})`, bpm: score.bpm, timeSignature: '4/4', key: score.key, bars, seed: score.seed,
      description: score.sections.map(s => `${s.id}: ${s.development}`).join('; '), render: { duration: { seconds: Number((bars * 4 * beatSeconds + 1).toFixed(6)) }, tail: { seconds: 1 } },
      master: { gainDb: -3 }, tracks: tracks.filter(t => !omitted.includes(t.id)) }));
  }
  write('catalog.json', json({ schema: 'daemonv12.headliner/1', engineBase: ENGINE_BASE, node: process.version,
    provenance: 'Original numerical additive synthesis and xorshift32 noise; no imported audio, presets, SoundFonts or reference-song content.',
    license: 'Generated audio: pending owner declaration; no new license granted.', generatorSha256: sha256(readFileSync(fileURLToPath(import.meta.url))),
    scoreSha256: sha256(Buffer.from(json(score))), sections: score.sections, sounds }));
  write('REPRODUCE.txt', `Node 22.18+; engine 0.7 at ${ENGINE_BASE}; FFmpeg with libmp3lame.\nVerify: (cd PACKAGE && sha256sum -c SHA256SUMS)\nRegenerate: node PACKAGE/source/build.ts PACKAGE/score.json NEW_PACKAGE\nRender from engine checkout: node bin/daemonv12.js render PACKAGE/main.json --out-dir NEW_RENDER --stems --format wav,mp3\nRender variations by replacing main.json. Sources are PCM16; no precision recovery is claimed.\n`);
  sealPackage(root); return root;
}
if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const [score, output] = process.argv.slice(2); assert.ok(score && output, 'usage: build.ts SCORE.json NEW_DIRECTORY');
  console.log(buildPackage(score, output));
}
