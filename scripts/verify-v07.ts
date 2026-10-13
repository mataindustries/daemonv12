import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { runCommand } from '../src/pipeline.ts';
import { decodePcm, PCM_RATE, type Pcm } from '../src/render/index.ts';

export const ONE_SOUND_SOURCE = 'assets/orbital-foundry/06-low-boom.wav';
export const ONE_SOUND_SOURCE_SHA256 = '37decaa1b61b4afe42c0dd0a1b00e6cd1685eeb651d521849e47f9ff877d73a8';
const hash = (bytes: Uint8Array) => createHash('sha256').update(bytes).digest('hex');
function regionRms(pcm: Pcm, startSeconds: number, endSeconds: number) {
  let sum = 0, count = 0;
  for (let frame = Math.round(startSeconds * PCM_RATE); frame < Math.round(endSeconds * PCM_RATE); frame++) {
    for (let channel = 0; channel < pcm.channels; channel++) { sum += pcm.samples[frame * pcm.channels + channel]! ** 2; count++; }
  }
  return Math.sqrt(sum / count);
}

// This is an analytical acceptance check. It does not claim a listening session.
export async function verifyV07(outDir = resolve('renders/one-sound'), env: NodeJS.ProcessEnv = process.env) {
  const sourcePath = join('examples', ONE_SOUND_SOURCE), sourceBytes = readFileSync(sourcePath);
  assert.equal(hash(sourceBytes), ONE_SOUND_SOURCE_SHA256, 'use the existing original source without regeneration');
  const source = decodePcm(sourceBytes).pcm!;
  assert.equal(source.frames, 105840); assert.equal(source.channels, 1);
  mkdirSync(outDir, { recursive: true });
  const repeatedDir = mkdtempSync(join(tmpdir(), 'daemon-one-sound-repeat-'));
  const versions: Record<string, any> = {}, stemsByVersion: Record<string, Record<string, Pcm>> = {};
  try {
    for (const version of ['before', 'after']) {
      const project = `examples/one-sound-${version}.json`, firstDir = join(outDir, version);
      // Only these script-owned render directories are replaced; inputs are never written.
      rmSync(firstDir, { recursive: true, force: true });
      const first = await runCommand('render', project, { outDir: firstDir, stems: true, env });
      assert.equal(first.exitCode, 0, JSON.stringify(first.result.errors)); assert.deepEqual(first.result.warnings, []);
      const manifest = first.result.manifest as Record<string, any>, artifacts = first.result.artifacts;
      const master = decodePcm(readFileSync(artifacts.wav!)).pcm!;
      assert.equal(master.frames, 352800); assert.equal(manifest.analysis.master.clipping, false);
      assert.equal(manifest.mix.clippedSamples, 0); assert.equal(manifest.production.master.clippedSamples, 0);
      assert.ok(manifest.production.tracks.every((track: any) => track.clippedSamples === 0));
      assert.ok(manifest.analysis.master.truePeakDbfs < -1);
      assert.deepEqual(manifest.samples.assets.map((asset: any) => [asset.file, asset.sha256]), [[ONE_SOUND_SOURCE, ONE_SOUND_SOURCE_SHA256]]);
      assert.ok(manifest.samples.tracks.every((track: any) => track.triggers.every((trigger: any) => trigger.file === ONE_SOUND_SOURCE)));
      const stems = Object.fromEntries(artifacts.stems!.map(stem => [stem.trackId, decodePcm(readFileSync(stem.wav)).pcm!]));
      assert.deepEqual(Object.keys(stems), ['original', 'percussion', 'low-end']);
      for (const stem of Object.values(stems)) assert.equal(stem.frames, master.frames);
      for (let i = 0; i < master.samples.length; i++) {
        assert.equal(master.samples[i], Object.values(stems).reduce((sum, pcm) => sum + pcm.samples[i]!, 0), 'dry aligned stems sum to the master');
      }
      const paths = { master: artifacts.wav!, manifest: artifacts.manifest!, analysis: artifacts.analysis!,
        ...Object.fromEntries(artifacts.stems!.map(stem => [`stem:${stem.trackId}`, stem.wav])) };
      const hashes = Object.fromEntries(Object.entries(paths).map(([id, path]) => [id, hash(readFileSync(path))]));
      const second = await runCommand('render', project, { outDir: join(repeatedDir, version), stems: true, env });
      assert.equal(second.exitCode, 0, JSON.stringify(second.result.errors));
      const repeatedPaths = { master: second.result.artifacts.wav!, manifest: second.result.artifacts.manifest!, analysis: second.result.artifacts.analysis!,
        ...Object.fromEntries(second.result.artifacts.stems!.map(stem => [`stem:${stem.trackId}`, stem.wav])) };
      for (const [id, path] of Object.entries(repeatedPaths)) assert.equal(hash(readFileSync(path)), hashes[id], `${version} ${id}: two fresh renders`);
      versions[version] = { artifacts, frames: master.frames, alignedStems: Object.keys(stems).length,
        metrics: manifest.analysis.master, hashes, twoFreshRendersIdentical: true };
      stemsByVersion[version] = stems;
      if (version === 'after') {
        assert.equal(manifest.samples.articulation.name, 'daemonv12-articulation');
        assert.equal(manifest.samples.tracks.flatMap((track: any) => track.triggers).filter((trigger: any) => trigger.articulation).length, 19);
      }
    }
    assert.equal(versions.before.hashes['stem:original'], versions.after.hashes['stem:original'], 'the opening original is unchanged');
    assert.notEqual(versions.before.hashes.master, versions.after.hashes.master, 'articulation changes the groove');
    const regions = [
      { track: 'percussion', label: 'space after the first fast hit', startSeconds: 4.1, endSeconds: 4.4 },
      { track: 'low-end', label: 'bass gate leaves room before the next onset', startSeconds: 4.6, endSeconds: 4.7 },
    ].map(region => {
      const beforeRms = regionRms(stemsByVersion.before![region.track]!, region.startSeconds, region.endSeconds);
      const afterRms = regionRms(stemsByVersion.after![region.track]!, region.startSeconds, region.endSeconds);
      assert.ok(beforeRms > 10, JSON.stringify({ ...region, beforeRms }));
      assert.equal(afterRms, 0, `${region.track}: the articulated voice has finished before this gap`);
      return { ...region, beforeRmsPcm: beforeRms, afterRmsPcm: afterRms };
    });
    assert.equal(hash(readFileSync(sourcePath)), ONE_SOUND_SOURCE_SHA256, 'rendering never changes the original');
    const report = { source: { file: ONE_SOUND_SOURCE, sha256: ONE_SOUND_SOURCE_SHA256, frames: source.frames, channels: source.channels },
      versions, originalStemUnchanged: true, tailRegions: regions, verification: 'analytical; no listening session claimed' };
    writeFileSync(join(outDir, 'v07-acceptance.json'), JSON.stringify(report, null, 2) + '\n');
    return report;
  } finally { rmSync(repeatedDir, { recursive: true, force: true }); }
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const report = await verifyV07(); process.stdout.write(JSON.stringify(report, null, 2) + '\n');
}
