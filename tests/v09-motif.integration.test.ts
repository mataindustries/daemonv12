// v0.9 motif development layer: audio-level checks. Approved rack sources and score/1 scores keep their bytes (S1), a score/2 renders
// exactly like the score it lowers to (S2), event frames sit where the rendered note begins (S8), and the committed
// HOOK//10 masters match their manifest and loop verification. FFmpeg-dependent checks skip without it.
import test from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, mkdtempSync, readFileSync, readdirSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { normalizeScore, performanceJson, renderScore, mixdown, wavBytes, verifyPackage, sha256, ffmpegVersion, type PartInput } from '../studio-001/rack/index.ts';
import { lowerScore, motifEvents, normalizeAnyScore, SCORE_SCHEMA_V2, type MotifInput, type PhraseInput, type ScoreInputV2 } from '../studio-001/motif/index.ts';
import { renderMotifToDirectory, bounceMotifPackage } from '../studio-001/motif/cli.ts';
import { foldLoop, seamCheck, buildVersion, VERSIONS, LOOP_FRAMES } from '../studio-001/scores/hook10/build.ts';

const hash = (v: unknown) => sha256(Buffer.from(JSON.stringify(v)));
const read = (f: string) => JSON.parse(readFileSync(f, 'utf8')) as unknown;
const HOOK10 = 'proofs/v09-motif/hook10';

test('S1: no file of the approved rack differs from main (eee072d)', () => {
  // SHA-256 of every studio-001/rack source on main. The motif layer lives beside the rack and may never edit it.
  const MAIN: Record<string, string> = {
    'cli.ts': '639fbf74a77f4fbba272a929f2293f301a80c0006e0b067439838c2beef0a108',
    'curves.ts': '2ad95943ef9036bc8a03ddb6fcb8ddd39dd2c884ead74406bbb270abd37a10e0',
    'docs.ts': 'e9de80e573f4c9da1d008a78dabce4210707be7956306ecf59dda57644ad50dc',
    'frozen.json': '15f8a55e504a3e23ff2ca313109da7c703bd015c5fad46b1fa17b4b8c95ef338',
    'frozen.ts': '6167ecc9eb3ca4ffdc79b91274353010db41e14c8fe2cb8e14aa889c0bb6cbef',
    'index.ts': 'bd10c8a2ef42716b9cac8ee2f4136b1d8c84cb762e5fbf78823e6bd4e69f63aa',
    'instruments.ts': 'f71204903745305649b365d986f2a093a0d43628757b478797b95f9d06789700',
    'package.ts': 'ec2746876885d63e86f17ffdf9c599d6cad8921d405996850c5c9272a545d151',
    'registry.ts': 'c8f773b0c23b59878e2f86769614d088c6128caaa8454e1decfe50facd934c19',
    'render.ts': '952a3c54dc08b1e0e9da5b0a6408db5e3b54fc20176b7eb350e241f9471e8d91',
    'score.ts': 'be6d52b5a19d60af3fd5b706f54e3d1be549ded7d6b811b890083a53937e1db8',
    'types.ts': 'a1b5fb48a6419f17fdcaddded0ee748cb8a929a3be30aa86c54516309e733955',
  };
  assert.deepEqual(readdirSync('studio-001/rack').sort(), Object.keys(MAIN).sort(), 'no file added to or removed from studio-001/rack');
  for (const [file, want] of Object.entries(MAIN)) assert.equal(sha256(readFileSync(`studio-001/rack/${file}`)), want, `studio-001/rack/${file}`);
  assert.equal(sha256(readFileSync('studio-001/INSTRUMENTS.md')), 'c9f8f1c6b82c599d58d1106930d3213715aad862353b2c8de4159cf02fde1e8c');
});

test('S1: committed score/1 scores normalise to the same performances as main (eee072d)', () => {
  // SHA-256 of JSON.stringify(performanceJson(normalizeScore(score, options))) computed on main before this change.
  const MAIN: [string, { transpose?: number; bpm?: number }, string][] = [
    ['crossing.score.json', {}, '8d734a18bdc417bc49a19f1b9ed4188ac4f55cf9585b06de798f2c23bb2b7674'],
    ['examples/bass-groove.score.json', {}, 'b176d35477513d87f5fd0ec2e93856cf58698115bd03f0e3823ea2ea60493933'],
    ['examples/bass-groove.score.json', { transpose: 5, bpm: 92 }, '27e0974b91f3b4bb9e89921d08938485af2c082e93726d8b97f65b663a233258'],
    ['examples/voice-duet.score.json', {}, '256d6b73b2450b8c7d013795b727750a20dbd1cb72b6f164cea66e83904fde1a'],
    ['examples/clockwork.score.json', {}, '8e0dd28889b48f43c3872edd699eb0e2fc8a94f56e93abc5e735d9bfdce438e9'],
  ];
  for (const [file, options, want] of MAIN) {
    assert.equal(hash(performanceJson(normalizeScore(read(`studio-001/scores/${file}`), options))), want, `${file} ${JSON.stringify(options)}`);
    assert.equal(hash(performanceJson(normalizeAnyScore(read(`studio-001/scores/${file}`), options))), want, `${file}: and through the motif layer's entry point`);
  }
});

const HOOK: MotifInput = { id: 'hook', role: 'hook', octave: 4, notes: [[0, 0.75, 4, 0.72, { params: { vowel: 'oh', to: 'ah' } }], [0.75, 1.25, 9, 0.9, { gesture: 'lift', params: { vowel: 'ah' } }], [2, 0.5, 8, 0.74], [2.5, 0.5, 6, 0.68], [3, 0.75, 7, 0.76, { gesture: 'fall' }]] };
const small = (extra: Partial<ScoreInputV2> = {}): ScoreInputV2 => ({
  schema: SCORE_SCHEMA_V2, title: 'S2', bpm: 96, key: 'D minor', seed: 3, tailSeconds: 0.5, masterGainDb: 0, sections: [{ id: 'a', bars: 2 }], motifs: [HOOK],
  parts: [
    { id: 'voice', instrument: 'impossible-voice', phrases: [{ motif: 'hook', at: 0 }, { motif: 'hook', at: { section: 'a', bar: 2 }, transforms: [{ op: 'invert', axis: 5.5 }] }] },
    { id: 'bass', instrument: 'living-bass', notes: [[0, 1, 'D2', 0.9]], phrases: [{ motif: 'hook', at: 4, fit: 'octave', transforms: [{ op: 'octave', by: -2 }, { op: 'fragment', from: 0, to: 2 }] }] },
    { id: 'bars', instrument: 'mechanical-orchestra/bar', humanize: { timingMs: 3, velocity: 0.1 }, phrases: [{ motif: 'hook', at: 0, transforms: [{ op: 'octave', by: 1 }, { op: 'scale', factor: 0.5 }, { op: 'sequence', steps: [0, -2, -4, 1], every: 2 }] }] },
  ], ...extra });
const wavHash = async (score: unknown, options: { transpose?: number } = {}) => sha256(wavBytes((await mixdown(await renderScore(normalizeAnyScore(score, options)))).context, 0.5).bytes);

test('S2: a score/2 and the score/1 it lowers to render identical audio', async () => {
  const input = small(), lowered = lowerScore(input).score;
  assert.equal(await wavHash(input), await wavHash(lowered));
  assert.equal(hash(performanceJson(normalizeAnyScore(input))), hash(performanceJson(normalizeScore(lowered))));
  assert.equal(await wavHash(input, { transpose: 3 }), await wavHash(lowered, { transpose: 3 }), 'and with --transpose');
  assert.notEqual(await wavHash(input), await wavHash(input, { transpose: 3 }));
});

test('render and bounce: rack outputs from the lowered score, plus the motif score, report and event map', async t => {
  const dir = mkdtempSync(join(tmpdir(), 'v09-render-')); t.after(() => rmSync(dir, { recursive: true, force: true }));
  const file = join(dir, 'small.score.json'), plainFile = join(dir, 'plain.score.json'), input = small();
  writeFileSync(file, JSON.stringify(input)); writeFileSync(plainFile, JSON.stringify(lowerScore(input).score));
  const r = await renderMotifToDirectory(file, join(dir, 'render'), { mp3: false }), p = await renderMotifToDirectory(plainFile, join(dir, 'render-plain'), { mp3: false });
  assert.ok(verifyPackage(r.root) > 8);
  for (const f of ['mix-dry.wav', 'mix-context.wav', 'performance.json']) assert.equal(sha256(readFileSync(join(r.root, f))), sha256(readFileSync(join(p.root, f))), `${f}: same bytes as rendering the lowered score with the rack`);
  assert.deepEqual(JSON.parse(readFileSync(join(r.root, 'score.json'), 'utf8')), lowerScore(input).score, 'score.json is the score/1 the rack rendered');
  assert.deepEqual(JSON.parse(readFileSync(join(r.root, 'motif', 'score.json'), 'utf8')), input);
  assert.equal((JSON.parse(readFileSync(join(r.root, 'motif', 'events.json'), 'utf8')) as { events: unknown[] }).events.length, motifEvents(input).events.length);
  assert.equal(existsSync(join(p.root, 'motif')), false, 'a score/1 gets exactly the rack output');
  const b = await bounceMotifPackage(file, join(dir, 'package'));
  assert.equal(b.clipped, 0); assert.ok(b.files > 12); assert.ok(existsSync(join(b.root, 'motif', 'report.json')) && existsSync(join(b.root, 'main.json')));
  assert.equal((JSON.parse(readFileSync(join(b.root, 'score.json'), 'utf8')) as { schema: string }).schema, 'daemonv12.signature-rack.score/1', 'the package stays reproducible by the rack alone');
});

test('S8 (audio): a rendered note begins exactly at its event frame', async () => {
  for (const [bpm, swing] of [[96, 0.5], [84, 0.55], [133, 0.6]] as const) for (const instrument of ['mechanical-orchestra/bar', 'mechanical-orchestra/clock', 'mechanical-orchestra/tine']) {
    const phrases: PhraseInput[] = [{ motif: 'one', at: 1.75 }], parts: (PartInput & { phrases: PhraseInput[] })[] = [{ id: 'p', instrument, setup: { spread: 0 }, phrases }];
    const input: ScoreInputV2 = { schema: SCORE_SCHEMA_V2, title: 'onset', bpm, key: 'C minor', swing, tailSeconds: 0.5, sections: [{ id: 'a', bars: 1 }], motifs: [{ id: 'one', octave: 5, notes: [[0, 0.5, 0]] }], parts };
    const audio = (await renderScore(normalizeAnyScore(input))).parts[0]!.audio[0], frame = motifEvents(input).events.find(e => e.kind === 'note')!.frame;
    // every one-shot waveform starts with a zero sample, so the first non-zero sample is the frame after the onset
    assert.equal(audio.findIndex(v => v !== 0), frame + 1, `${instrument} at ${bpm} BPM, swing ${swing}`);
  }
});

test('loop fold: y[n] = x[n] + x[n + loop], and the seam check sees a real discontinuity', () => {
  const x: [Float64Array, Float64Array] = [Float64Array.from([1, 2, 3, 4, 10, 20]), Float64Array.from([0, 0, 0, 0, 0.5, 0])];
  assert.deepEqual(foldLoop(x, 4).map(c => [...c]), [[11, 22, 3, 4], [0.5, 0, 0, 0]]);
  assert.throws(() => foldLoop(x, 2), /expected 2\.\.4/);
  const n = 44100, tone = (phase: number) => Float64Array.from({ length: n }, (_, i) => 0.5 * Math.sin(2 * Math.PI * (441 * i / 44100) + phase));
  const whole = wavBytes([tone(0), tone(0)]).bytes, cut = wavBytes([tone(0).map((v, i) => (i > n - 40 ? 0.9 : v)), tone(0)]).bytes; // 441 Hz has whole periods in one second
  assert.equal(seamCheck(whole).pass, true); assert.ok(seamCheck(whole).seamStepLsb <= seamCheck(whole).insideStepLsb.max);
  assert.equal(seamCheck(cut).pass, false, 'a jump at the wrap is caught');
});

test('HOOK//10: committed masters match their manifest, hashes, loop verification and gates', () => {
  const manifest = read(`${HOOK10}/MANIFEST.json`) as { loopFrames: number; versions: { id: string; condition: string; schema: string; scoreFile: string; scoreSha256: string; master: { file: string; frames: number; loudness: { lufs: number; truePeakDb: number }; clipped: number };
    loop: { foldMaxAbsError: number; tailFullyDecayed: boolean; seamResidueLsb: { renderFirstSample: number; renderLastSample: number }; seam: ReturnType<typeof seamCheck> }; technicalGate: Record<string, boolean>; gate?: { pass: boolean }; files: Record<string, { sha256: string; bytes: number }> }[] };
  assert.equal(manifest.loopFrames, 441000); assert.deepEqual(manifest.versions.map(v => v.id), ['A', 'B1', 'B2', 'B3']);
  const sums = readFileSync(`${HOOK10}/SHA256SUMS`, 'utf8').trim().split('\n').map(l => [l.slice(66), l.slice(0, 64)] as const);
  for (const [file, want] of sums) assert.equal(sha256(readFileSync(join(HOOK10, file))), want, file);
  for (const v of manifest.versions) {
    assert.equal(sha256(readFileSync(v.scoreFile)), v.scoreSha256, `${v.id}: built from the committed score`);
    const wav = readFileSync(join(HOOK10, v.master.file));
    assert.equal(wav.readUInt32LE(40) / 4, 441000, `${v.id}: exactly 10.000 s`); assert.equal(v.master.frames, 441000);
    assert.deepEqual(seamCheck(wav), v.loop.seam, `${v.id}: seam statistics recomputed from the committed WAV`);
    assert.equal(v.loop.seam.pass, true); assert.equal(v.loop.foldMaxAbsError, 0); assert.equal(v.loop.tailFullyDecayed, true);
    assert.deepEqual(v.loop.seamResidueLsb, { renderFirstSample: 0, renderLastSample: 0 });
    assert.ok(Object.values(v.technicalGate).every(Boolean), `${v.id}: ${JSON.stringify(v.technicalGate)}`);
    assert.ok(Math.abs(v.master.loudness.lufs + 16) <= 0.15 && v.master.loudness.truePeakDb <= -1 && v.master.clipped === 0, `${v.id}: -16 LUFS, below -1 dBTP, no clipping`);
    assert.equal(v.gate?.pass, v.condition === 'B' ? true : undefined, `${v.id}: the structure gate applies to condition B`);
    for (const f of [v.master.file, v.master.file.replace('.wav', '.mp3'), v.master.file.replace('.wav', '-loop-x3.mp3'), `${v.id}/score.json`, `${v.id}/performance.json`]) assert.ok(f in v.files, f);
  }
});

test('HOOK//10: rebuilding B1 reproduces the committed master', { skip: ffmpegVersion() !== (read(`${HOOK10}/MANIFEST.json`) as { ffmpeg: string }).ffmpeg && 'needs the FFmpeg build recorded in the manifest (loudness gain comes from its measurement)' }, async t => {
  const dir = mkdtempSync(join(tmpdir(), 'hook10-')); t.after(() => rmSync(dir, { recursive: true, force: true }));
  const built = await buildVersion(VERSIONS.find(v => v.id === 'B1')!, dir, () => {});
  const committed = (read(`${HOOK10}/MANIFEST.json`) as { versions: { id: string; files: Record<string, { sha256: string }> }[] }).versions.find(v => v.id === 'B1')!;
  assert.equal(LOOP_FRAMES, 441000);
  for (const [file, d] of Object.entries(built.files)) assert.equal(d.sha256, committed.files[file]!.sha256, file);
});
