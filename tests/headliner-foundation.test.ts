import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { existsSync, mkdtempSync, mkdirSync, readFileSync, rmSync, symlinkSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { test } from 'node:test';
import { buildPackage, files, verifyPackage, type Score } from '../production/headliner/build.ts';
import { archivePackage, verifyStarter } from '../scripts/headliner.ts';
import { compileProjectFile } from '../src/pipeline.ts';
const example = 'production/headliner/example.score.json';

test('portable native multisamples, phrase performance, sections and shared-asset variation', t => {
  const tmp = mkdtempSync(join(tmpdir(), 'headliner-source-')); t.after(() => rmSync(tmp, { recursive: true, force: true }));
  const root = buildPackage(example, join(tmp, 'package')); verifyPackage(root);
  assert.equal(verifyPackage(root + '/'), verifyPackage(root));
  const main = compileProjectFile(join(root, 'main.json')), reduced = compileProjectFile(join(root, 'reduced.json'));
  assert.deepEqual(main.diagnostics.filter(d => d.severity === 'error'), []);
  assert.deepEqual(reduced.diagnostics.filter(d => d.severity === 'error'), []);
  assert.equal(main.project!.bars, 4); assert.equal(main.project!.tracks.length, 3); assert.equal(reduced.project!.tracks.length, 2);
  const project = JSON.parse(readFileSync(join(root, 'main.json'), 'utf8'));
  assert.deepEqual(project.tracks[2].clips.map((c: { bar: number }) => c.bar), [2, 4]);
  assert.ok(project.tracks.flatMap((tr: { patterns: { notes: object[] }[] }) => tr.patterns.flatMap(p => p.notes)).every((n: object) => !('playbackRate' in n)));
  const catalog = JSON.parse(readFileSync(join(root, 'catalog.json'), 'utf8'));
  assert.ok(catalog.sounds.some((s: { file: string }) => s.file.includes('note-62')));
  assert.ok(catalog.sounds.some((s: { recipe: { notes: object[] } }) => s.recipe.notes.length === 3));
  assert.throws(() => buildPackage(example, root), /EEXIST/);
  writeFileSync(join(root, 'extra.txt'), 'unlisted'); assert.throws(() => verifyPackage(root)); rmSync(join(root, 'extra.txt'));
  symlinkSync('score.json', join(root, 'link.json')); assert.throws(() => verifyPackage(root), /symlink/); rmSync(join(root, 'link.json'));
  const source = files(root).find(f => f.endsWith('.wav'))!; writeFileSync(join(root, source), 'tampered');
  assert.throws(() => verifyPackage(root), new RegExp(source));
});

test('invalid section, pitch, phrase bounds and variation fail before writing', t => {
  const tmp = mkdtempSync(join(tmpdir(), 'headliner-invalid-')); t.after(() => rmSync(tmp, { recursive: true, force: true }));
  const mutations = [
    (s: Score) => { s.tracks[0]!.sections.unknown = [{ beat: 0, midi: 60, velocity: 0.5 }]; },
    (s: Score) => { s.tracks[0]!.sections.question![0]!.midi = 200; },
    (s: Score) => { s.phrases.lift!.notes[0]!.durationBeats = 20; },
    (s: Score) => { s.variations.reduced!.omitTracks = ['unknown']; },
    (s: Score) => { s.tracks[0]!.sections.question![0]!.beat = 3.9999; },
  ];
  for (const mutate of mutations) {
    const score = JSON.parse(readFileSync(example, 'utf8')) as Score; mutate(score);
    const path = join(tmp, 'score.json'); writeFileSync(path, JSON.stringify(score));
    assert.throws(() => buildPackage(path, join(tmp, 'never-created')));
  }
});

test('variation names cannot overwrite canonical score, catalog, verification or main project', t => {
  const tmp = mkdtempSync(join(tmpdir(), 'headliner-reserved-')); t.after(() => rmSync(tmp, { recursive: true, force: true }));
  for (const name of ['main', 'score', 'catalog', 'verification']) {
    const score = JSON.parse(readFileSync(example, 'utf8')) as Score;
    score.variations = { [name]: { omitTracks: [score.tracks[0]!.id] } };
    const path = join(tmp, `${name}.json`), output = join(tmp, `${name}-package`);
    writeFileSync(path, JSON.stringify(score));
    assert.throws(() => buildPackage(path, output), /reserved variation name/);
    assert.equal(existsSync(output), false, name);
  }
});

test('production proof honors configured FFmpeg and fails instead of falling back', t => {
  const tmp = mkdtempSync(join(tmpdir(), 'headliner-ffmpeg-')); t.after(() => rmSync(tmp, { recursive: true, force: true }));
  const missing = join(tmp, 'missing-configured-ffmpeg');
  const child = spawnSync(process.execPath, ['scripts/headliner.ts', 'verify', example, join(tmp, 'package')], {
    encoding: 'utf8', env: { ...process.env, DAEMONV12_FFMPEG: missing },
  });
  assert.equal(child.status, 1, child.stderr);
  assert.match(child.stderr, /AUDIO_TOOL_NOT_FOUND/);
  assert.ok(child.stderr.includes(missing), child.stderr);
});

test('short v0.7 WAV/MP3 proof, aligned stems, deterministic archive and extracted hashes', async t => {
  const tmp = mkdtempSync(join(tmpdir(), 'headliner-proof-')); t.after(() => rmSync(tmp, { recursive: true, force: true }));
  const root = join(tmp, 'package'), report = await verifyStarter(example, root);
  assert.deepEqual(Object.keys(report.renders).sort(), ['main', 'reduced']);
  const a = join(tmp, 'a.tar.gz'), b = join(tmp, 'b.tar.gz');
  assert.equal(await archivePackage(root, a), await archivePackage(root, b));
  const extracted = join(tmp, 'extracted'); mkdirSync(extracted);
  const unpack = spawnSync('tar', ['-xzf', a, '-C', extracted], { encoding: 'utf8' }); assert.equal(unpack.status, 0, unpack.stderr);
  assert.equal(verifyPackage(extracted), verifyPackage(root));
});
