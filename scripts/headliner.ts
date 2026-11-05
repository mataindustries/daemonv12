/** Small v0.7 proof/delivery adapter. Run from the repository root. */
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { createReadStream, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { compileProjectFile, runCommand } from '../src/pipeline.ts';
import { decodePcm } from '../src/render/pcm.ts';
import { buildPackage, ENGINE_BASE, files, sealPackage, sha256, verifyPackage } from '../production/headliner/build.ts';

/** Stream archive contents to disk so full-song stems do not require another in-memory copy. */
export async function archivePackage(root: string, archive: string) {
  verifyPackage(root);
  assert.ok(!resolve(archive).startsWith(resolve(root) + '/'), 'archive must be outside package');
  const tar = spawnSync('tar', ['--sort=name', '--mtime=@0', '--owner=0', '--group=0', '--numeric-owner', '--mode=755',
    '--use-compress-program=gzip -n -9', '-cf', resolve(archive), '-C', resolve(root), '.']);
  assert.equal(tar.status, 0, tar.stderr?.toString());
  const hash = createHash('sha256');
  for await (const bytes of createReadStream(archive)) hash.update(bytes);
  return hash.digest('hex');
}
export async function verifyStarter(score: string, output: string) {
  const root = buildPackage(score, output), scratch = mkdtempSync(join(tmpdir(), 'headliner-'));
  try {
    // Exercise the shipped generator from outside its original location in a fresh process.
    const regenerated = join(scratch, 'regenerated');
    const child = spawnSync(process.execPath, [join(root, 'source/build.ts'), join(root, 'score.json'), regenerated], { encoding: 'utf8' });
    assert.equal(child.status, 0, child.stderr);
    assert.deepEqual(files(root), files(regenerated));
    for (const file of files(root)) assert.deepEqual(readFileSync(join(root, file)), readFileSync(join(regenerated, file)), file);
    const projects = files(root).filter(f => /^[a-z][a-z0-9-]*\.json$/.test(f) && !['score.json', 'catalog.json'].includes(f));
    const renders: Record<string, unknown> = {};
    for (const project of projects) {
      const compiled = compileProjectFile(join(root, project));
      assert.deepEqual(compiled.diagnostics.filter(d => d.severity === 'error'), [], project);
      const name = project.slice(0, -5), outDir = join(root, 'delivery', name);
      const rendered = await runCommand('render', join(root, project), { outDir, stems: true, format: 'wav,mp3', env: process.env });
      assert.equal(rendered.exitCode, 0, JSON.stringify(rendered.result));
      const master = decodePcm(readFileSync(rendered.result.artifacts.wav!)).pcm!;
      const duration = compiled.project!.render!.duration! as { seconds: number };
      assert.equal(master.frames, Math.round(duration.seconds * 44100));
      assert.ok(master.samples.some(v => Math.abs(v) > 100));
      assert.ok(master.samples.slice(-4410 * 2).every(v => v === 0), 'tail ends in silence');
      const stems = rendered.result.artifacts.stems!.map(s => ({ id: s.trackId, pcm: decodePcm(readFileSync(s.wav)).pcm! }));
      assert.equal(stems.length, compiled.project!.tracks.length);
      for (const s of stems) { assert.equal(s.pcm.frames, master.frames); assert.ok(s.pcm.samples.some(v => v !== 0)); }
      const manifest = rendered.result.manifest as { production: { processor: unknown; master: { clippedSamples: number }; tracks: { clippedSamples: number }[] } };
      assert.equal(manifest.production.master.clippedSamples, 0);
      assert.ok(manifest.production.tracks.every(t => t.clippedSamples === 0));
      // Main's second short render compares ALL artifacts, including MP3, on this exact toolchain.
      if (name === 'main') {
        const repeat = join(scratch, 'repeat');
        const second = await runCommand('render', join(root, project), { outDir: repeat, stems: true, format: 'wav,mp3', env: process.env });
        assert.equal(second.exitCode, 0, JSON.stringify(second.result));
        assert.deepEqual(files(outDir), files(repeat));
        for (const f of files(outDir)) assert.deepEqual(readFileSync(join(outDir, f)), readFileSync(join(repeat, f)), f);
      }
      renders[name] = { frames: master.frames, seconds: master.frames / 44100, stems: stems.length, aligned: true,
        wavSha256: sha256(readFileSync(rendered.result.artifacts.wav!)), artifacts: files(outDir).length, processor: manifest.production.processor };
    }
    const report = { engineBase: ENGINE_BASE, engineVersion: '0.7.0', node: process.version,
      regeneratedSourcePackage: true, repeatedMainAllArtifacts: true, renders,
      scope: 'Short analytical proof only; no listening approval or full-length rerender. Byte equality is toolchain-specific.' };
    writeFileSync(join(root, 'verification.json'), JSON.stringify(report, null, 2) + '\n'); sealPackage(root); verifyPackage(root);
    return report;
  } finally { rmSync(scratch, { recursive: true, force: true }); }
}
if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const [command, input, output] = process.argv.slice(2);
  assert.ok(input, 'usage: headliner.ts verify SCORE NEW_DIRECTORY | hashes PACKAGE | pack PACKAGE ARCHIVE.tar.gz');
  if (command === 'verify') { assert.ok(output); console.log(JSON.stringify(await verifyStarter(input, output), null, 2)); }
  else if (command === 'hashes') console.log(`verified ${verifyPackage(input)} files`);
  else if (command === 'pack') { assert.ok(output); console.log(await archivePackage(input, output)); }
  else throw new Error('unknown command');
}
