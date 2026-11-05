/** Rebuild, render twice and validate WEST//GHOST. Analytical checks; no listening claim.
 * node scripts/verify-westghost.ts --deliver
 */
import assert from 'node:assert/strict';
import { copyFileSync, existsSync, mkdirSync, readFileSync, readdirSync, writeFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { createHash } from 'node:crypto';
import { pathToFileURL } from 'node:url';
import { generatePack, DEFAULT_PACK, synthesize, measure as sourceMeasure } from './generate-westghost.ts';
import { demonstrationScores } from './westghost-scores.ts';
import { frequency, SR } from './westghost-dsp.ts';
import { load, spectrum } from './inspect-glasshouse.ts';
import { pitchTrack } from './inspect-v12-signature.ts';
import { compileProjectFile, runCommand } from '../src/pipeline.ts';
import { decodePcm } from '../src/render/index.ts';
const hash = (x: Uint8Array) => createHash('sha256').update(x).digest('hex');
const files = (root: string) => readdirSync(root, { recursive: true, withFileTypes: true }).filter(e => e.isFile()).map(e => join(e.parentPath, e.name).slice(root.length + 1)).sort();
const energy = (x: Float64Array) => x.reduce((e, v) => e + v * v, 0);
// Resume only complete outputs whose project, assets and exported bytes still match.
// A partial or mismatching saved render is evidence to inspect, never permission to erase it.
function savedRender(directory: string, id: string, source: string) {
  const file = join(directory, `${id}.render.json`);
  if (!existsSync(file)) return undefined;
  const manifest = JSON.parse(readFileSync(file, 'utf8'));
  assert.equal(manifest.project.sha256, hash(readFileSync(source)), `${id}: saved project identity`);
  for (const asset of manifest.samples.assets) assert.equal(hash(readFileSync(join(resolve(source, '..'), asset.file))), asset.sha256, `${id}: ${asset.file}`);
  for (const identity of [manifest.wav, manifest.midi, manifest.mp3, ...manifest.stems.map((s: any) => s.wav)]) {
    assert.ok(identity, `${id}: missing export identity`);
    assert.equal(hash(readFileSync(join(directory, identity.file))), identity.sha256, `${id}: ${identity.file}`);
  }
  assert.ok(existsSync(join(directory, `${id}.analysis.json`)), `${id}: missing analysis`);
  return manifest;
}
function stereo(path: string) {
  const x = load(path), a = x.channel(0), b = x.channel(1);
  const corr = (l: Float64Array, r: Float64Array) => { let lr = 0, ll = 0, rr = 0; for (let i = 0; i < l.length; i++) { lr += l[i]! * r[i]!; ll += l[i]! ** 2; rr += r[i]! ** 2; } return lr / Math.sqrt(ll * rr); };
  const low = (input: Float64Array) => { let out = input; for (let k = 0; k < 2; k++) { let y = 0; const c = 1 - Math.exp(-2 * Math.PI * 150 / SR); out = out.map(v => (y += c * (v - y))); } return out; };
  const la = low(a), lb = low(b), monoLow = la.map((v, i) => (v + lb[i]!) / 2);
  return { correlation: corr(a, b), monoFoldDownDb: 10 * Math.log10(energy(x.mono) / ((energy(a) + energy(b)) / 2)), lowBandMethod: 'two cascaded one-pole 150 Hz low-passes', lowBandCorrelation: corr(la, lb), lowBandMonoFoldDownDb: 10 * Math.log10(energy(monoLow) / ((energy(la) + energy(lb)) / 2)) };
}
export async function verifyWestghost(pack = DEFAULT_PACK, deliver = false) {
  const work = resolve('work/westghost-verification'); mkdirSync(work, { recursive: true });
  const sources = JSON.parse(readFileSync(join(pack, 'westghost001.catalog.json'), 'utf8')).generatorSources;
  const generationId = hash(Buffer.from(JSON.stringify(sources))).slice(0, 16), rebuilt = join(work, `rebuilt-${generationId}`);
  const marker = join(work, `rebuilt-${generationId}.complete.json`);
  if (!existsSync(marker)) {
    assert.ok(!existsSync(rebuilt), 'Partial source regeneration is preserved; inspect it and choose a new work directory before retrying.');
    generatePack(rebuilt); writeFileSync(marker, JSON.stringify({ files: files(rebuilt), sources }, null, 2) + '\n');
  }
  {
    const generated = files(rebuilt);
    assert.deepEqual(generated, JSON.parse(readFileSync(marker, 'utf8')).files);
    for (const name of generated) assert.deepEqual(readFileSync(join(rebuilt, name)), readFileSync(join(pack, name)), name);
    const projects = [];
    for (const score of demonstrationScores) {
      const source = join(pack, `${score.id}.json`), compilation = compileProjectFile(source);
      assert.deepEqual(compilation.diagnostics, []);
      const delivered = join(pack, 'audio');
      const a = savedRender(delivered, score.id, source) ? delivered : join(work, score.id, 'first');
      const b = join(work, score.id, 'replay');
      for (const directory of [a, b]) if (!savedRender(directory, score.id, source)) {
        assert.ok(!existsSync(directory), `${score.id}: partial output is preserved at ${directory}; inspect before retrying.`);
        const result = await runCommand('render', source, { outDir: directory, stems: true, format: 'wav,mp3', env: process.env });
        assert.equal(result.exitCode, 0, JSON.stringify(result.diagnostics));
      }
      const compared = files(a).filter(f => f.startsWith(`${score.id}.`) && !f.endsWith('.mp3'));
      assert.deepEqual(compared, files(b).filter(f => !f.endsWith('.mp3')));
      for (const file of compared) assert.deepEqual(readFileSync(join(a, file)), readFileSync(join(b, file)), `${score.id}/${file}`);
      const wav = join(a, `${score.id}.wav`), pcm = decodePcm(readFileSync(wav)).pcm!;
      const manifest = savedRender(a, score.id, source)!;
      const analysis = manifest.analysis.master;
      const stems: { trackId: string; frames: number; sha256: string }[] = manifest.stems.map((s: any) => ({ trackId: s.trackId, frames: decodePcm(readFileSync(join(a, s.wav.file))).pcm!.frames, sha256: hash(readFileSync(join(a, s.wav.file))) }));
      assert.ok(stems.every(s => s.frames === pcm.frames)); assert.equal(analysis.clipping, false);
      assert.ok(manifest.production.tracks.every((t: any) => t.clippedSamples === 0));
      const image = stereo(wav); assert.ok(image.lowBandMonoFoldDownDb > -0.2); assert.ok(analysis.truePeakDbfs < -1);
      projects.push({ id: score.id, notes: compilation.timeline!.tracks.reduce((s, t) => s + t.notes.length, 0), frames: pcm.frames, seconds: pcm.frames / SR, wavSha256: hash(readFileSync(wav)), twoFreshRendersIdentical: true, comparedArtifacts: compared.length, analysis, stereo: image, stems });
      if (deliver) {
        const out = join(pack, 'audio'); mkdirSync(out, { recursive: true });
        for (const file of files(a).filter(f => f.startsWith(`${score.id}.`))) {
          const destination = join(out, file); mkdirSync(destination.slice(0, destination.lastIndexOf('/')), { recursive: true });
          if (resolve(a) !== resolve(out)) {
            if (existsSync(destination)) assert.deepEqual(readFileSync(destination), readFileSync(join(a, file)), `${score.id}: preserve existing ${destination}`);
            else copyFileSync(join(a, file), destination);
          }
        }
      }
      console.log(`${score.id}: ${pcm.frames / SR}s, ${analysis.integratedLufs} LUFS, ${analysis.truePeakDbfs} dBTP, repeated artifacts identical`);
    }
    const pitch = [26, 38, 50].map(note => {
      const x = synthesize({ instrument: 'gravity', note, gate: 2, release: 0.2 });
      return { note, expectedHz: frequency(note), ...pitchTrack(x, frequency(note), 0.3, 1.8) };
    });
    const spectral = ['gravity', 'vandal', 'apparition', 'iron-bloom'].map(instrument => {
      const x = synthesize({ instrument: instrument as any, note: instrument === 'apparition' ? 62 : 38, gate: 2, release: 0.2, timbre: [{ time: 0, value: 0.8 }] });
      const power = spectrum(x, Math.round(0.5 * SR), 65536, 65536); let all = 0, high = 0;
      power.forEach((p, k) => { all += p; if (k * SR / 65536 >= 16000) high += p; });
      return { instrument, ...sourceMeasure(x), bandAbove16kHzDbRelative: 10 * Math.log10(high / all), interpretation: 'High-band energy check, not an alias measurement or quality score' };
    });
    const report = { pack: 'WEST//GHOST 001', status: 'experimental independent prototypes', license: 'pending-owner-declaration', engineBase: 'e2962cc1a443c841cd6ca7cb2cc56c5ebabf0e99', node: process.version, regeneration: { files: generated.length, identical: true }, nativePrecision: 'Float64 synthesis -> PCM16 portable sources -> unchanged v0.7 production. No higher-fidelity release export claim.', methods: { source: 'Original synthesis only; no input audio, SoundFont, IR, learned voice or presets', boundaries: 'Native pitch/duration; integrated oscillator phase; fixed silent source endpoints; gate+release checked against engine absolute rounded tempo/frame boundaries', mono: 'All sources mono. Stereo contexts use track balance only. Fold-down compared against mean channel energy; no decorrelation process', pitch: 'Autocorrelation around expected pitch, parabolic lag refinement; GRAVITY steady native notes', spectral: '65536-point Hann-windowed power, steady high-timbre note; aggregate energy above16k does not isolate aliasing' }, listening: 'No human listening or perceived-quality judgment performed. Demonstrations are provisional instrument studies.', pitch, spectral, projects };
    writeFileSync(join(pack, 'westghost001.verification.json'), JSON.stringify(report, null, 2) + '\n');
    return report;
  }
}
if (process.argv[1] && pathToFileURL(resolve(process.argv[1])).href === import.meta.url) await verifyWestghost(DEFAULT_PACK, process.argv.includes('--deliver'));
