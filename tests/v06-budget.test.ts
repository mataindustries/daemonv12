// Sample-performance render budget: pathological transformed playback is rejected from project and
// WAV metadata before any interpolation, allocation or render work.
import { test, type TestContext } from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, mkdtempSync, mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { compileProjectFile, productionRoute, runCommand } from '../src/pipeline.ts';
import { playbackBudget } from '../src/sample-render.ts';
import { DaemonTools } from '../mcp/handlers.ts';
import { voiceCost, playbackPosition, playbackRateAt, PLAYBACK_WORK_LIMIT, PLAYBACK_VOICE_BYTES_LIMIT, type Pcm, type VoicePlayback } from '../src/render/index.ts';
import { tone, wav } from './helpers/tones.ts';

const WORK = 'interpolationTaps', BYTES = 'performedVoiceBytes';
const pcmOf = (frames: number, channels: 1 | 2 = 1): Pcm => ({ frames, channels, samples: new Int16Array(0) }); // costing reads only metadata
function workspace(t: TestContext, sources: Record<string, Buffer>) {
  const root = mkdtempSync(join(tmpdir(), 'daemon-v06-budget-')); t.after(() => rmSync(root, { recursive: true, force: true }));
  mkdirSync(join(root, 'assets'));
  for (const [file, bytes] of Object.entries(sources)) writeFileSync(join(root, 'assets', file), bytes);
  const path = join(root, 'cue.json');
  const compile = (value: unknown) => { writeFileSync(path, JSON.stringify(value)); return compileProjectFile(path); };
  return { root, path, compile };
}
const project = (notes: unknown[], clips = [{ bar: 1, pattern: 'p' }], extra: Record<string, unknown> = {}, sample = 'assets/vox.wav') =>
  ({ formatVersion: 1, title: 'Budget', bpm: 120, timeSignature: '4/4', bars: 2, ...extra, tracks: [{ id: 'vox', instrument: { type: 'sampler', sample }, clips, patterns: [{ id: 'p', bars: 1, notes }] }] });
// Astra's shape: 100 simultaneous quarter-speed notes repeated by 100 overlapping clips (10,000 voices).
const astra = (rate = 0.25) => project(Array.from({ length: 100 }, () => ({ start: '1:1', playbackRate: rate })), Array.from({ length: 100 }, () => ({ bar: 1, pattern: 'p' })));
const metric = (d: { received?: unknown } | undefined) => (d?.received as { metric?: string } | undefined)?.metric;

test('budget: the cost model counts the taps the interpolator really evaluates (conservatively, within 3%)', () => {
  const pcm = pcmOf(20000);
  for (const playback of [{ rate: 0.25, offset: 0 }, { rate: 0.7, offset: 500 }, { rate: 1.5, offset: 0 }, { rate: 4, offset: 0 }, { rate: 0.5, offset: 0, glide: { to: 2, frames: 30000 } }] as VoicePlayback[]) {
    const { work } = voiceCost(pcm, playback);
    let actual = 0, n = 0;
    for (; playbackPosition(playback, n) < pcm.frames; n++) {
      // The interpolator's loop bounds and table guard, counted without computing audio.
      const position = playbackPosition(playback, n), span = 32 / (0.92 * Math.min(1, 1 / playbackRateAt(playback, n)));
      for (let k = Math.ceil(position - span), end = Math.floor(position + span); k <= end; k++) if (Math.abs(k - position) * 0.92 * Math.min(1, 1 / playbackRateAt(playback, n)) * 512 < 32 * 512) actual++;
    }
    assert.ok(work >= actual, `${JSON.stringify(playback)}: estimate ${work} below actual ${actual}`);
    if (!playback.glide) assert.ok(work <= actual * 1.03, `${JSON.stringify(playback)}: estimate ${work} vs actual ${actual}`);
  }
});

test('budget: cost grows with slower rates, longer sources, wider kernels and more voices; channels cost memory, not work', () => {
  const at = (frames: number, rate: number, channels: 1 | 2 = 1, limit = Infinity, glide?: { to: number; frames: number }) =>
    voiceCost(pcmOf(frames, channels), { rate, offset: 0, ...(glide ? { glide } : {}) }, limit);
  assert.equal(at(44100, 0.25).work, 2 * at(44100, 0.5).work, 'half the rate, twice the frames');
  assert.equal(at(88200, 0.5).work, 2 * at(44100, 0.5).work, 'twice the source, twice the frames');
  assert.ok(at(44100, 4, 1, 1000).work > at(44100, 2, 1, 1000).work && at(44100, 2, 1, 1000).work > at(44100, 1.5, 1, 1000).work, 'pitching up widens the kernel per frame');
  assert.equal(at(44100, 0.5, 1, 1000).work, at(44100, 0.9, 1, 1000).work, 'at or below rate 1 the kernel width is fixed');
  assert.equal(at(44100, 0.5, 1, 1000, { to: 4, frames: 500 }).work, at(44100, 4, 1, 1000).work, 'a glide is charged at the fastest rate it reaches');
  assert.equal(at(44100, 0.5, 2).work, at(44100, 0.5, 1).work, 'a stereo voice shares its weights: same tap count');
  assert.equal(at(44100, 0.5, 2).bytes, 2 * at(44100, 0.5, 1).bytes, 'a stereo voice buffer is twice as large');
  assert.deepEqual(voiceCost(pcmOf(44100), { rate: 1, offset: 300 }), { work: 0, bytes: 0 }, 'rate 1 without a glide copies source frames');
  assert.deepEqual(voiceCost(pcmOf(44100)), { work: 0, bytes: 0 }, 'unperformed voices cost nothing');
});

test("budget: Astra's 10,000-voice quarter-speed shape is rejected promptly at validation, render and MCP, with nothing rendered", async t => {
  const w = workspace(t, { 'vox.wav': wav(tone(277.18, 41895, 9000)) });
  let started = performance.now();
  const compiled = w.compile(astra());
  const elapsed = performance.now() - started;
  assert.equal(compiled.timeline, null);
  assert.equal(compiled.diagnostics.length, 1);
  const d = compiled.diagnostics[0]!;
  assert.equal(d.code, 'OUT_OF_RANGE'); assert.equal(d.path, 'tracks[0]'); assert.equal(metric(d), WORK);
  assert.match(d.message, /exceeds the sample-performance render budget: its transformed sample voices need more than 1,000,000,000 interpolation steps/);
  assert.match(d.hint!, /fewer simultaneous or overlapping performed notes and clips/);
  assert.ok(elapsed < 2000, `rejected in ${elapsed.toFixed(0)} ms`);
  started = performance.now();
  const render = await runCommand('render', w.path, { outDir: join(w.root, 'out'), stems: true });
  assert.equal(render.exitCode, 1); assert.equal(metric(render.result.errors[0]), WORK);
  assert.equal(existsSync(join(w.root, 'out')), false, 'rejected before any output exists');
  assert.ok(performance.now() - started < 3000);
  assert.equal((await runCommand('validate', w.path)).exitCode, 1);
  // MCP: the serialized handler answers with the structured failure instead of rendering for minutes.
  const tools = new DaemonTools(w.root, { DAEMONV12_FFMPEG: '/missing/ffmpeg', DAEMONV12_FLUIDSYNTH: '/missing/fluidsynth' });
  writeFileSync(join(w.root, 'small.json'), JSON.stringify(project([{ start: '1:1', playbackRate: 0.25 }])));
  const read = await tools.call('daemonv12_project_read', { project: 'small.json' });
  const before = readFileSync(join(w.root, 'small.json'));
  started = performance.now();
  const patched = await tools.call('daemonv12_project_patch', { project: 'small.json', expectedSha256: read.sha256, edits: [
    { op: 'pattern_put', trackId: 'vox', pattern: { id: 'p', bars: 1, notes: astra().tracks[0]!.patterns[0]!.notes } },
    { op: 'clips_set', trackId: 'vox', clips: astra().tracks[0]!.clips }] });
  assert.equal(patched.ok, false); assert.equal(metric((patched.errors as unknown[])[0] as never), WORK);
  assert.deepEqual(readFileSync(join(w.root, 'small.json')), before, 'the rejected batch is not published');
  const rendered = await tools.call('daemonv12_render', { project: 'cue.json' });
  assert.equal(rendered.ok, false); assert.equal(metric((rendered.errors as unknown[])[0] as never), WORK);
  assert.ok(performance.now() - started < 4000, 'MCP answers promptly');
  // The same shape at rate 1 is the historical copy path: accepted.
  assert.deepEqual(w.compile(astra(1)).diagnostics.filter(x => x.severity === 'error'), []);
});

test('budget: exact boundary — the largest voice count within the limit validates, one more voice fails', t => {
  const w = workspace(t, { 'vox.wav': wav(tone(277.18, 30000, 9000)) });
  const perVoice = voiceCost(pcmOf(30000), { rate: 0.5, offset: 0 }).work, fits = Math.floor(PLAYBACK_WORK_LIMIT / perVoice);
  assert.ok(fits * perVoice <= PLAYBACK_WORK_LIMIT && (fits + 1) * perVoice > PLAYBACK_WORK_LIMIT);
  const voices = (count: number) => project(Array.from({ length: count }, () => ({ start: '1:1', playbackRate: 0.5 })));
  assert.deepEqual(w.compile(voices(fits)).diagnostics, [], `${fits} voices x ${perVoice} taps`);
  const over = w.compile(voices(fits + 1));
  assert.equal(over.timeline, null); assert.equal(metric(over.diagnostics[0]), WORK);
  assert.deepEqual(over.diagnostics[0]!.received, { metric: WORK, taps: `more than ${PLAYBACK_WORK_LIMIT}`, limit: PLAYBACK_WORK_LIMIT });
});

test('budget: one giant performed voice is refused before its buffer exists; stereo, mono and render boundaries are exact', t => {
  // At quarter speed a stereo voice needs 4 x frames x 2 channels x 8 bytes.
  const largest = PLAYBACK_VOICE_BYTES_LIMIT / 64;
  const stereo = (frames: number) => wav(new Int16Array(frames * 2), 2);
  const w = workspace(t, { 'fit.wav': stereo(largest), 'over.wav': stereo(largest + 1), 'mono.wav': wav(new Int16Array(largest + 1)) });
  const slow = (sample: string, extra: Record<string, unknown> = {}) => project([{ start: '1:1', playbackRate: 0.25 }], undefined, extra, sample);
  assert.deepEqual(w.compile(slow('assets/fit.wav')).diagnostics, [], 'exactly the per-voice limit');
  const over = w.compile(slow('assets/over.wav'));
  assert.equal(metric(over.diagnostics[0]), BYTES);
  assert.deepEqual(over.diagnostics[0]!.received, { metric: BYTES, bytes: PLAYBACK_VOICE_BYTES_LIMIT + 64, limit: PLAYBACK_VOICE_BYTES_LIMIT, tick: 0, file: 'assets/over.wav' });
  assert.match(over.diagnostics[0]!.message, /one performed voice of assets\/over\.wav would need a 129 MiB buffer; the limit is 128 MiB per voice/);
  assert.match(over.diagnostics[0]!.hint!, /less extreme slow playbackRate/);
  assert.deepEqual(w.compile(slow('assets/mono.wav')).diagnostics, [], 'a mono voice of the same length needs half the memory');
  // The production route stops voices at the permitted boundary, and so does the estimate.
  assert.deepEqual(w.compile(slow('assets/over.wav', { render: { duration: { seconds: 10 }, tail: 'none' } })).diagnostics, []);
});

test('budget: shipped projects stay far below it; the historical path is never charged; sums stay exact', () => {
  const ghost = compileProjectFile('examples/ghost-shift.json');
  assert.deepEqual(ghost.diagnostics, []);
  assert.equal(playbackBudget(ghost, productionRoute(ghost.project!), { work: PLAYBACK_WORK_LIMIT / 10, bytes: PLAYBACK_VOICE_BYTES_LIMIT / 100 }), undefined, 'GHOST//SHIFT fits in a tenth of the work budget and 1% of the voice memory');
  for (const name of ['glass-fire', 'glasshouse-audition', 'orbital-foundry-audition', 'sample-only-demo', 'sample-demo']) {
    const c = compileProjectFile(`examples/${name}.json`);
    assert.deepEqual(c.diagnostics.filter(d => d.severity === 'error'), [], name);
    assert.equal(playbackBudget(c, productionRoute(c.project!), { work: 0, bytes: 0 }), undefined, `${name} charges nothing`);
  }
  // The largest possible voice: a 600-second stereo source at a quarter of its speed, at the widest kernel.
  const worst = voiceCost(pcmOf(600 * 44100, 2), { rate: 0.25, offset: 0, glide: { to: 4, frames: 1 } });
  assert.ok(Number.isSafeInteger(worst.work) && Number.isSafeInteger(worst.bytes));
  // Accumulation stops at the first voice past the limit, so it can never exceed limit + one voice.
  assert.ok(Number.isSafeInteger(PLAYBACK_WORK_LIMIT + worst.work));
});
