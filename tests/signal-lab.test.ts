import { test } from 'node:test';
import assert from 'node:assert/strict';
import { cpSync, mkdtempSync, readFileSync, readdirSync, rmSync, statSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { spawnSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { DaemonTools } from '../mcp/handlers.ts';
import { compileProjectFile, runCommand } from '../src/pipeline.ts';
import { readWavInfo } from '../src/render/wav.ts';
import { decodePcm } from '../src/render/index.ts';
import { parseKit } from '../src/project/sample-schema.ts';
import { ENGINE_VERSION } from '../src/version.ts';

const pack = resolve('packs/signal-lab/0.2.0');
const sha = (bytes: Uint8Array) => createHash('sha256').update(bytes).digest('hex');
const catalog = JSON.parse(readFileSync(join(pack, 'signal-lab.catalog.json'), 'utf8'));
const sums = readFileSync(join(pack, 'SHA256SUMS.txt'));
const verified = sums.toString().trim().split('\n').map(line => {
  const match = /^([a-f0-9]{64})  \.\/(.+)$/.exec(line)!;
  return { hash: match[1]!, path: match[2]! };
});
const files = (root: string) => readdirSync(root, { recursive: true, encoding: 'utf8' })
  .filter(file => statSync(join(root, file)).isFile()).sort();
function checkHashes(root: string) {
  assert.deepEqual(readFileSync(join(root, 'SHA256SUMS.txt')), sums);
  for (const entry of verified) assert.equal(sha(readFileSync(join(root, entry.path))), entry.hash, entry.path);
}

test('SIGNAL supplied bytes, PCM format, catalog, kits and pending rights stay fixed', () => {
  // Pins the independent source manifest, including the generator and source README.
  assert.equal(sha(sums), 'd7ae0947f52ce05274b774c722733ca41a46e870923e7880514ec52fd3f700f8');
  checkHashes(pack);
  assert.equal(catalog.generatorVersion, '0.2.0');
  assert.equal(catalog.rights.status, 'PENDING OWNER REVIEW');
  const metadata = JSON.parse(readFileSync(join(pack, 'package.json'), 'utf8'));
  assert.equal(metadata.version, '0.2.0'); assert.equal(metadata.private, true);
  assert.equal(metadata.license, 'UNLICENSED'); assert.equal(metadata.scripts, undefined);
  assert.equal(catalog.assets.length, 9); assert.equal(catalog.kits.length, 3);
  const expected: string[] = [];
  for (const asset of catalog.assets) {
    const path = `assets/signal-lab/${asset.file}`; expected.push(path);
    const bytes = readFileSync(join(pack, path)), info = readWavInfo(bytes);
    assert.equal(sha(bytes), asset.sha256, path); assert.ok(info.ok, path);
    assert.equal(info.info.formatTag, 1); assert.equal(info.info.bitsPerSample, 16);
    assert.equal(info.info.sampleRate, 44100);
    assert.equal(info.info.channels, asset.family === 'lead' ? 1 : 2);
    assert.equal(info.info.frames, (asset.family === 'pad' ? 8 : 4) * 44100);
    assert.equal(info.info.frames, asset.measured.frames);
    const pcm = decodePcm(bytes).pcm!; assert.ok(pcm);
    for (let channel = 0; channel < info.info.channels; channel++) {
      assert.equal(pcm.samples[channel], 0);
      assert.equal(pcm.samples[pcm.samples.length - 1 - channel], 0);
    }
  }
  for (const kit of catalog.kits) {
    const path = `assets/signal-lab/${kit.file}`; expected.push(path);
    const bytes = readFileSync(join(pack, path)); assert.equal(sha(bytes), kit.sha256, path);
    const parsed = parseKit(JSON.parse(bytes.toString()), path); assert.deepEqual(parsed.diagnostics, []);
    assert.deepEqual(parsed.entries, catalog.assets.filter((a: {family: string}) => a.family === kit.family)
      .map((a: {id: string; kitPitch: number; file: string}) => ({ name: a.id, pitch: a.kitPitch, sample: a.file.split('/')[1] })));
  }
  assert.deepEqual(files(join(pack, 'assets')).map(file => `assets/${file}`), expected.sort());
});

test('SIGNAL regenerates nine WAVs, three kits and catalog without replacing verified assets', { timeout: 180_000 }, t => {
  const root = mkdtempSync(join(tmpdir(), 'signal-regeneration-'));
  t.after(() => rmSync(root, { recursive: true, force: true }));
  const child = spawnSync(process.execPath, [join(pack, 'generate-signal-instruments.mjs'), root], { encoding: 'utf8', timeout: 170_000 });
  assert.equal(child.status, 0, `${child.error ?? ''}\n${child.stderr}`);
  const generated = verified.filter(entry => entry.path.startsWith('assets/') || entry.path === 'signal-lab.catalog.json');
  assert.equal(generated.length, 13);
  assert.deepEqual(files(root), generated.map(entry => entry.path).sort());
  for (const entry of generated) assert.deepEqual(readFileSync(join(root, entry.path)), readFileSync(join(pack, entry.path)), entry.path);
  checkHashes(pack);
});

test('SIGNAL optional tarball preserves sources and discovers all kits after explicit installation', { timeout: 120_000 }, async t => {
  const root = mkdtempSync(join(tmpdir(), 'signal-package-'));
  t.after(() => rmSync(root, { recursive: true, force: true }));
  const packed = spawnSync('npm', ['pack', pack, '--json', '--pack-destination', root], { encoding: 'utf8', timeout: 60_000 });
  assert.equal(packed.status, 0, `${packed.error ?? ''}\n${packed.stderr}`);
  const manifest = JSON.parse(packed.stdout)[0];
  assert.equal(manifest.filename, 'daemonv12-signal-lab-0.2.0.tgz');
  assert.deepEqual(manifest.files.map((f: {path: string}) => f.path).sort(),
    [...verified.map(entry => entry.path), 'SHA256SUMS.txt', 'INSTALL.md', 'package.json'].sort());
  assert.ok(manifest.size < 5_500_000); assert.ok(manifest.unpackedSize < 6_100_000);
  const extracted = spawnSync('tar', ['-xzf', join(root, manifest.filename), '-C', root], { encoding: 'utf8' });
  assert.equal(extracted.status, 0, extracted.stderr); checkHashes(join(root, 'package'));

  const api = new DaemonTools(root);
  const list = () => api.call('daemonv12_instruments_list', { project: 'cue.json', query: 'signal-lab', limit: 50 });
  assert.equal((await list()).totalSamples, 0, 'pack is opt-in');
  cpSync(join(root, 'package/assets'), join(root, 'assets'), { recursive: true });
  const samples = await list(); assert.equal(samples.ok, true); assert.deepEqual(samples.warnings, []);
  assert.equal(samples.totalSamples, 9);
  const kits = await api.call('daemonv12_drumkits_list', { project: 'cue.json' });
  assert.equal(kits.ok, true); assert.deepEqual(kits.warnings, []); assert.equal(kits.totalKits, 3);

  // A test-only playback smoke project, not a replacement for the supplied audition.
  const project = {formatVersion: 1, title: 'SIGNAL package smoke', bpm: 120, bars: 4, timeSignature: '4/4',
    tracks: catalog.kits.map((kit: {family: string; file: string}) => ({id: kit.family,
      instrument: {type: 'drumkit', kit: `assets/signal-lab/${kit.file}`},
      clips: [{bar: 1, pattern: 'hits'}], patterns: [{id: 'hits', bars: 4,
        notes: catalog.assets.filter((a: {family: string}) => a.family === kit.family)
          .map((a: {id: string}, i: number) => ({start: `${1 + Math.floor(i / 4)}:${1 + i % 4}`, pitch: a.id, velocity: 0.2}))}]}))};
  const input = join(root, 'cue.json'); writeFileSync(input, JSON.stringify(project));
  assert.deepEqual(compileProjectFile(input).diagnostics, []);
  assert.equal(ENGINE_VERSION, '0.7.0');
  const first = await runCommand('render', input, {outDir: join(root, 'first')});
  assert.equal(first.exitCode, 0, JSON.stringify(first.result));
  const second = await runCommand('render', input, {outDir: join(root, 'second')});
  assert.equal(second.exitCode, 0, JSON.stringify(second.result));
  const audio = readFileSync(first.result.artifacts.wav!);
  assert.deepEqual(audio, readFileSync(second.result.artifacts.wav!));
  assert.ok(decodePcm(audio).pcm!.samples.some(value => value !== 0));
});
