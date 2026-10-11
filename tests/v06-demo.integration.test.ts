// GHOST//SHIFT acceptance: one source sample performs a complete lead through playback rate,
// glides and offsets, renders as a production cue and can be authored by an agent over MCP.
import { test, type TestContext } from 'node:test';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { cpSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { Client } from '@modelcontextprotocol/client';
import { StdioClientTransport } from '@modelcontextprotocol/client/stdio';
import { compileProjectFile, runCommand } from '../src/pipeline.ts';
import { createAudioProcessor, decodePcm } from '../src/render/index.ts';
import { parsePosition, ticksToFrames } from '../src/timing/musical-time.ts';
import { pitch } from './helpers/tones.ts';

const GHOST = 'assets/glasshouse/04-ghost-vox.wav', CS4 = 440 * 2 ** (-8 / 12), TEMPO = Math.round(60000000 / 140);
const project = JSON.parse(readFileSync('examples/ghost-shift.json', 'utf8'));
const processor = await createAudioProcessor({ env: process.env });
const hash = (bytes: Uint8Array) => createHash('sha256').update(bytes).digest('hex');
const temp = (t: TestContext) => { const dir = mkdtempSync(join(tmpdir(), 'daemon-ghost-')); t.after(() => rmSync(dir, { recursive: true, force: true })); return dir; };
type Note = { start: string; playbackRate?: number; offsetSeconds?: number; glide?: { to: number; duration: string } };
type Track = { id: string; instrument: { type: string; sample?: string }; clips: { bar: number; pattern: string }[]; patterns: { id: string; bars: number; notes: Note[] }[] };
const frameAt = (clipBar: number, start: string, bars: number) => ticksToFrames((clipBar - 1) * 3840 + parsePosition(start, { numerator: 4, denominator: 4 }, bars).value!, TEMPO);
const cents = (found: number, target: number) => 1200 * Math.log2(found / target);

test('GHOST//SHIFT: one ghost-vox source performs the whole lead, and every hook chop lands on its note', async t => {
  assert.deepEqual(compileProjectFile('examples/ghost-shift.json').diagnostics, []);
  const tracks = project.tracks as Track[], ghost = tracks.filter(track => track.instrument.sample === GHOST);
  assert.deepEqual(ghost.map(track => track.id), ['ghost-hook', 'ghost-high', 'ghost-fx', 'ghost-bass']);
  assert.deepEqual(tracks.filter(track => !ghost.includes(track)).map(track => track.id), ['drums', 'sub'], 'support is drums and sub only');
  const notes = ghost.flatMap(track => track.patterns.flatMap(pattern => pattern.notes));
  assert.ok(new Set(notes.map(n => n.playbackRate ?? 1)).size >= 8, 'many playback rates');
  assert.ok(new Set(notes.map(n => n.offsetSeconds ?? 0)).size >= 8, 'many source offsets');
  assert.ok(notes.some(n => n.glide && n.glide.to > (n.playbackRate ?? 1)), 'an upward glide');
  assert.ok(notes.some(n => n.glide?.to === 0.25 && (n.playbackRate ?? 1) === 1), 'a tape stop');
  assert.ok(notes.some(n => !n.playbackRate && !n.offsetSeconds && !n.glide), 'the untouched source is heard too');

  // Without production fields the project takes the Node-only route: stems are the exact performed voices.
  const root = temp(t);
  cpSync('examples/assets/glasshouse', join(root, 'assets/glasshouse'), { recursive: true });
  const dry = structuredClone(project);
  delete dry.render; delete dry.master;
  for (const track of dry.tracks) { delete track.mix; delete track.effects; }
  writeFileSync(join(root, 'dry.json'), JSON.stringify(dry));
  const r = await runCommand('render', join(root, 'dry.json'), { outDir: join(root, 'out'), stems: true });
  assert.equal(r.exitCode, 0, JSON.stringify(r.result.errors));
  const stem = (id: string) => decodePcm(readFileSync(join(root, `out/dry.stems/${id}.wav`))).pcm!.samples;
  const hook = stem('ghost-hook'), hookTrack = ghost[0]!, pattern = hookTrack.patterns.find(p => p.id === 'hook')!;
  let checked = 0;
  for (const clip of hookTrack.clips.filter(c => c.pattern === 'hook')) pattern.notes.forEach((note, i) => {
    const frame = frameAt(clip.bar, note.start, pattern.bars), next = pattern.notes[i + 1] ? frameAt(clip.bar, pattern.notes[i + 1]!.start, pattern.bars) : frame + 8000;
    const target = CS4 * (note.playbackRate ?? 1), found = pitch(hook, frame + 500, Math.min(1600, next - frame - 1000), target, 7, 2);
    assert.ok(Math.abs(cents(found, target)) < 30, `bar ${clip.bar} ${note.start}: ${found.toFixed(1)} Hz for ${target.toFixed(1)} Hz`);
    checked++;
  });
  assert.equal(checked, 24);
  // Glides follow their linear-in-rate trajectory: measured pitch tracks C#4 x rate at each window's centre.
  const follows = (samples: Int16Array, clipBar: number, r0: number, r1: number, glideTicks: number, times: number[]) => {
    const frame = frameAt(clipBar, '1:1', 1), frames = ticksToFrames((clipBar - 1) * 3840 + glideTicks, TEMPO) - frame;
    for (const seconds of times) {
      const start = Math.round(seconds * 44100), centre = start + 750, rate = centre < frames ? r0 + (r1 - r0) * centre / frames : r1, target = CS4 * rate;
      const found = pitch(samples, frame + start, 1500, target, 4, 2);
      assert.ok(Math.abs(cents(found, target)) < 30, `bar ${clipBar} +${seconds} s: ${found.toFixed(1)} Hz for ${target.toFixed(1)} Hz`);
    }
  };
  follows(stem('ghost-fx'), 7, 1, 0.25, 1920, [0.02, 0.2, 0.4, 0.6, 0.8, 0.95, 1.05]); // tape stop, then the held C#2
  follows(stem('ghost-fx'), 4, 0.25, 1, 3840, [0.05, 0.25, 0.45, 0.65]); // spin-up riser before the second riser enters
  follows(stem('ghost-bass'), 5, 0.5, 0.25, 960, [0.02, 0.15, 0.3, 0.5, 0.7]); // bass dive, then the held C#2
});

test('GHOST//SHIFT renders exactly 12 s of WAV, MP3, six stems and analysis repeatably; an agent authors the identical performance over stdio MCP', { skip: processor.diagnostic?.message ?? false }, async t => {
  const options = { outDir: temp(t), stems: true, format: 'wav,mp3' as const, env: process.env };
  const first = await runCommand('render', 'examples/ghost-shift.json', options);
  assert.equal(first.exitCode, 0, JSON.stringify(first.result.errors)); assert.deepEqual(first.result.warnings, []);
  const manifest = first.result.manifest as Record<string, any>, artifacts = first.result.artifacts, master = manifest.analysis.master;
  assert.equal(master.frames, 529200); assert.equal(master.clipping, false); assert.ok(master.truePeakDbfs < -1);
  assert.ok(master.integratedLufs >= -18 && master.integratedLufs <= -13, JSON.stringify(master));
  assert.equal(manifest.production.master.clippedSamples, 0);
  assert.equal(artifacts.stems!.length, 6);
  for (const s of artifacts.stems!) assert.equal(decodePcm(readFileSync(s.wav)).pcm!.frames, 529200);
  assert.ok(readFileSync(artifacts.mp3!).length > 10000);
  const performed = manifest.samples.tracks.flatMap((track: { triggers: { playback?: object }[] }) => track.triggers).filter((x: { playback?: object }) => x.playback);
  assert.equal(performed.length, 52, '44 ghost-vox triggers (the hook plays twice) and 8 kit hits'); assert.equal(manifest.samples.playback.name, 'daemonv12-playback');
  const lufs = Object.fromEntries(manifest.analysis.tracks.map((x: { trackId: string; analysis: { integratedLufs: number } }) => [x.trackId, x.analysis.integratedLufs]));
  assert.ok(Math.max(lufs['ghost-hook'], lufs['ghost-fx'], lufs['ghost-bass']) > Math.max(lufs.drums, lufs.sub) + 3, 'the transformed vocal is the star');
  const outputs = [artifacts.wav!, artifacts.manifest!, artifacts.analysis!, ...artifacts.stems!.map(s => s.wav)].map(file => [file, readFileSync(file)] as const);
  assert.equal((await runCommand('render', 'examples/ghost-shift.json', options)).exitCode, 0);
  for (const [file, bytes] of outputs) assert.deepEqual(readFileSync(file), bytes, file);

  const root = temp(t);
  cpSync('examples/assets', join(root, 'assets'), { recursive: true });
  const client = new Client({ name: 'ghost-shift', version: '1' });
  await client.connect(new StdioClientTransport({ command: process.execPath, args: [resolve('bin/daemonv12-mcp.js'), '--root', root] }));
  t.after(async () => { await client.close(); });
  const call = async (name: string, args: Record<string, unknown>) => (await client.callTool({ name: `daemonv12_${name}`, arguments: args })).structuredContent as Record<string, any>;
  const { title, bpm, timeSignature, key, bars, seed, render, master: mix, description, tracks } = project;
  let current = await call('project_create', { project: 'ghost.json', title, bpm, timeSignature, key, bars, seed, render, master: mix });
  assert.equal(current.ok, true, JSON.stringify(current));
  current = await call('project_patch', { project: 'ghost.json', expectedSha256: current.sha256, edits: [
    { op: 'project_update', fields: { description } }, ...tracks.map((track: object) => ({ op: 'track_add', track })), { op: 'track_remove', trackId: 'lead' }] });
  assert.equal(current.ok, true, JSON.stringify(current.errors));
  const rendered = await call('render', { project: 'ghost.json', stems: true });
  assert.equal(rendered.ok, true, JSON.stringify(rendered.errors));
  assert.equal(hash(readFileSync(join(root, rendered.artifacts.wav))), hash(outputs[0]![1]), 'MCP-authored master equals the example');
  for (const s of rendered.artifacts.stems) assert.equal(hash(readFileSync(join(root, s.wav))), hash(readFileSync(artifacts.stems!.find(x => x.trackId === s.trackId)!.wav)));
});
