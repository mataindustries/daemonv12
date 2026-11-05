// Independent baseline comparison. Pass an archive of e2962cc; never checkout an
// active composition branch. --existing re-hashes retained output files rather
// than trusting saved hashes or rendering again.
import assert from 'node:assert/strict';
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { resolve, join, dirname, basename } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { createHash } from 'node:crypto';

if (process.argv.includes('--help') || process.argv.length < 4) {
  console.log('node scripts/verify-voice-reuse-legacy.mjs BASELINE_SOURCE OUTPUT_PREFIX [--existing]');
  process.exit(process.argv.includes('--help') ? 0 : 2);
}
const baselineRoot = resolve(process.argv[2]);
const prefix = resolve(process.argv[3]);
const candidateRoot = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const existing = process.argv.slice(4).includes('--existing');
const candidate = await import(pathToFileURL(join(candidateRoot, 'src/pipeline.ts')));
const baseline = await import(pathToFileURL(join(baselineRoot, 'src/pipeline.ts')));
const { VoiceSampleCache, sumFloat, mixPcm, createAudioProcessor } = await import('../src/render/index.ts');
const cases = ['examples/morph-sync-demo.json', 'examples/one-sound-after.json',
  'examples/ghost-shift.json', 'packs/v12-signature-v1/v12-signature-showcase.json'];
const sha256 = bytes => createHash('sha256').update(bytes).digest('hex');

async function group(sourceRoot, engine, suffix, reuseVoices = false) {
  const output = `${prefix}-${suffix}`;
  const results = [];
  for (const project of cases) {
    const name = basename(project, '.json'), outDir = join(output, name);
    if (!existing) {
      const result = await engine.runCommand('render', join(sourceRoot, project), { outDir, stems: true, reuseVoices });
      assert.equal(result.exitCode, 0, JSON.stringify(result.result.errors));
    }
    const manifest = JSON.parse(readFileSync(join(outDir, `${name}.render.json`)));
    results.push({ project,
      wav: sha256(readFileSync(join(outDir, `${name}.wav`))),
      midi: sha256(readFileSync(join(outDir, `${name}.mid`))),
      manifest: sha256(readFileSync(join(outDir, `${name}.render.json`))),
      stems: manifest.stems.map(stem => ({ trackId: stem.trackId,
        sha256: sha256(readFileSync(join(outDir, `${name}.stems`, engine.stemFileName(stem.trackId)))) })),
    });
    console.log(`${suffix}: ${name} ${results.at(-1).wav}`);
  }
  return results;
}
const old = await group(baselineRoot, baseline, 'baseline');
const current = await group(candidateRoot, candidate, 'candidate');
const reuse = await group(candidateRoot, candidate, 'reuse', true);
assert.deepEqual(current, old, 'default master/MIDI/stems/manifest must remain identical to archived main');
for (let i = 0; i < old.length; i++) for (const key of ['project', 'wav', 'midi', 'stems'])
  assert.deepEqual(reuse[i][key], old[i][key], `opt-in ${key}: ${old[i].project}`);

let seed = 0xF003;
const random = () => { seed ^= seed << 13; seed ^= seed >>> 17; seed ^= seed << 5; return (seed >>> 0) / 2 ** 32; };
for (let trial = 0; trial < 80; trial++) {
  // Equal-shaped, deliberately distinct sources exercise source-key isolation.
  const sources = Array.from({ length: 3 }, (_, source) => ({ frames: 300, channels: source % 2 + 1,
    samples: Int16Array.from({ length: 300 * (source % 2 + 1) }, (_, i) => Math.round(3000 * Math.sin(i * .13 + source))) }));
  const triggers = Array.from({ length: 20 }, (_, i) => {
    const pcm = sources[Math.floor(random() * 3)], rate = [.25, .75, 1, 1.5][Math.floor(random() * 4)];
    const playback = { rate, offset: Math.floor(random() * 20), ...(random() < .4 ? { glide: { to: random() < .5 ? .5 : 2, frames: 50 } } : {}) };
    const articulation = random() < .7 ? { attack: Math.floor(random() * 20), release: Math.floor(random() * 30),
      stop: Math.floor(random() * 200), ...(random() < .5 ? { end: 250 } : {}) } : undefined;
    return { pcm, playback, articulation, frame: i % 6 * 80, velocity: .1 + random() * .7 };
  });
  triggers.push({ ...triggers[0], frame: 550, velocity: .37,
    articulation: triggers[0].articulation ? { ...triggers[0].articulation, attack: 30 } : undefined });
  const cap = 500 + trial % 4 * 100;
  assert.deepEqual(sumFloat(triggers, 400, cap, new VoiceSampleCache()), sumFloat(triggers, 400, cap));
  assert.deepEqual(mixPcm(triggers, 400, new VoiceSampleCache()), mixPcm(triggers, 400));
}
const audio = await createAudioProcessor({ env: process.env });
assert.ok(audio.value, JSON.stringify(audio.diagnostic));
const report = {
  baselineCommit: 'e2962cc1a443c841cd6ca7cb2cc56c5ebabf0e99',
  runtime: { node: process.version, ffmpeg: audio.value.identity.version, platform: process.platform, architecture: process.arch },
  method: 'Independent archive of main; continuous render with stems; compare full WAV, MIDI, stem and manifest file SHA-256 with modified default, then audio/MIDI/stems with reuseVoices true. Opt-in manifest adds intentional reuse provenance.',
  defaultIdentical: { wav: true, midi: true, stems: true, manifest: true },
  reuseIdentical: { wav: true, midi: true, stems: true },
  adversarialCases: { seed: 61443, count: 80, exactCappedFloat64Mix: true, exactUncappedPcmMix: true,
    coverage: ['same-dimension distinct source PCM', 'offsets', 'glides', 'explicit source endpoints',
      'gate stop and envelope lengths', 'changed velocity and attack on repeated voice', 'different final output caps'] },
  cases: old, listening: 'No human listening claimed.',
};
mkdirSync(dirname(prefix), { recursive: true });
writeFileSync(`${prefix}-verification.json`, JSON.stringify(report, null, 2) + '\n');
console.log('PASS: archived-main/default/opt-in comparisons and 80 adversarial cache cases.');
