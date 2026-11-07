/** Composition-only bounce recipe. Uses the existing, frozen DaemonV12 rack and PCM24 renderer. */
import assert from 'node:assert/strict';
import { readFileSync, writeFileSync, mkdirSync, existsSync, readdirSync } from 'node:fs';
import { join, resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { normalizeScore } from '../../../studio-001/rack/score.ts';
import { renderScore, mixdown, placed, peak, type Stereo } from '../../../studio-001/rack/render.ts';
import { bouncePackage, sealPackage } from '../../../studio-001/rack/package.ts';
import { verifyFrozen, sha256 } from '../../../studio-001/rack/frozen.ts';
import { packageProduction24 } from '../../../scripts/headliner-production24.ts';

const here = dirname(fileURLToPath(import.meta.url));
const repo = resolve(here, '../../..');
const out = resolve(process.argv[2] ?? join(here, 'candidate'));
assert.ok(!existsSync(out), 'Choose a fresh output directory.');
const authored = JSON.parse(readFileSync(join(here, 'score.json'), 'utf8'));
const recipe = JSON.parse(readFileSync(join(here, 'loop-recipe.json'), 'utf8'));
const score = normalizeScore(authored);
assert.equal(score.bpm, 96);
assert.equal(score.endBeat, 16);
assert.equal(recipe.frames, 441000);
const freeze = verifyFrozen();
assert.deepEqual(freeze, [], 'The approved instrument freeze must remain intact.');
const n = recipe.frames, sr = recipe.sampleRate;
const rendered = await renderScore(score, console.log);
const mixes = await mixdown(rendered);
const smooth = (x: number) => { x = Math.max(0, Math.min(1, x)); return x * x * (3 - 2 * x); };
const foldReports: object[] = [];

function circular(chs: Stereo, id: string): Stereo {
  const result: Stereo = [new Float64Array(n), new Float64Array(n)];
  const fade = Math.round(recipe.tailFadeSeconds * sr);
  let fadedTailPeak = 0;
  for (let c = 0; c < 2; c++) {
    const src = chs[c]!;
    for (let i = 0; i < src.length; i++) {
      let g = 1;
      if (i >= src.length - fade) {
        g = 1 - smooth((i - (src.length - fade)) / (fade - 1));
        fadedTailPeak = Math.max(fadedTailPeak, Math.abs(src[i]!));
      }
      result[c]![i % n] += src[i]! * g;
    }
  }
  const h = recipe.hush;
  const floor = Math.pow(10, (id === 'room' ? h.roomGainDb : h.dryGainDb) / 20);
  for (let i = 0; i < n; i++) {
    const t = i / sr;
    const down = smooth((t - h.fromSeconds) / (h.downSeconds - h.fromSeconds));
    const up = smooth((t - h.holdUntilSeconds) / (h.upSeconds - h.holdUntilSeconds));
    const hush = 1 - (1 - floor) * down * (1 - up);
    const pan = (recipe.orbit[id] ?? 0) * Math.sin(2 * Math.PI * i / n);
    result[0][i] *= hush * (1 - Math.max(0, pan));
    result[1][i] *= hush * (1 + Math.min(0, pan));
  }
  foldReports.push({ id, sourceFrames: chs[0].length, outputFrames: n,
    tailFadeStartSeconds: (chs[0].length - fade) / sr,
    fadedTailPeakDbfs: fadedTailPeak ? 20 * Math.log10(fadedTailPeak) : null });
  return result;
}

for (const rp of rendered.parts) rp.audio = circular(rp.audio, rp.part.id);
mixes.room = circular(mixes.room, 'room');
rendered.frames = n;
const sum: Stereo = [mixes.room[0].slice(), mixes.room[1].slice()];
for (const rp of rendered.parts) {
  const st = placed(rp);
  for (let c = 0; c < 2; c++) for (let i = 0; i < n; i++) sum[c]![i] += st[c]![i]!;
}
// One predetermined linear headroom calibration before the first candidate render.
const gainDb = recipe.targetSamplePeakDbfs - 20 * Math.log10(peak(sum));
assert.ok(gainDb >= -60 && gainDb <= 12, 'Authored balance requires excessive gain.');
score.masterGainDb = gainDb;
mkdirSync(out, { recursive: true });
const source = join(out, 'source');
const bounce = bouncePackage(score, rendered, mixes, source);
assert.equal(bounce.clipped, 0);
for (const filename of ['main.json', 'dry.json']) {
  const file = join(source, filename);
  const project = JSON.parse(readFileSync(file, 'utf8'));
  project.render = { duration: { seconds: 10 }, tail: 'none' };
  project.master = { gainDb };
  project.description = 'THE NINTH LANDING. Circularly overlapped original rack performances; four bars, 96 BPM, 441000 frames. Regenerate with the composition build.ts and loop-recipe.json.';
  writeFileSync(file, JSON.stringify(project, null, 2) + '\n');
}
// Pinned fetched main, before this composition branch. Current HEAD may later include this delivery.
const engineCommit = 'eee072d71a7581913faebff95c935cae8c9be41b';
const generatorPaths = ['studio-001/rack', 'mutation-001/tools'];
const generators = generatorPaths.flatMap(dir => readdirSync(join(repo, dir))
  .filter(f => f.endsWith('.ts') || f === 'frozen.json').sort()
  .map(f => ({ file: `${dir}/${f}`, sha256: sha256(readFileSync(join(repo, dir, f))) })));
const provenance = { title: authored.title, engineCommit, node: process.version,
  sourceInstruments: 'Unmodified owner-approved Signature Rack: Impossible Voice, Mechanical Orchestra, Living Bass.',
  externalAudio: false, soundfont: null, sourcePolicy: 'New numeric performances. No external recordings or source-song excerpts.',
  loop: { ...recipe, masterGainDb: gainDb, operation: 'Circular overlap-add of six-second source tails, then periodic hush/orbit. Tail-only fade; no crossfade or fade-out of the master.', foldReports },
  freeze, generators, bounce,
  reference: JSON.parse(readFileSync(join(here, 'reference.json'), 'utf8')) };
// Retain recipes alongside the editable native project. Paths in build.ts assume the repository location.
for (const file of ['score.json', 'loop-recipe.json', 'build.ts', 'PROVENANCE.md', 'reference.json']) {
  if (existsSync(join(here, file))) writeFileSync(join(source, file), readFileSync(join(here, file)));
}
writeFileSync(join(source, 'loop-provenance.json'), JSON.stringify(provenance, null, 2) + '\n');
writeFileSync(join(source, 'REPRODUCE.txt'), 'From the pinned DaemonV12 repository, run the composition build.ts with a fresh output path. The score tail is a source allowance, circularly folded by loop-recipe.json. main.json is the exact 10-second native project. Render preserved assets with scripts/render-production24.ts. See the top-level README.\n');
sealPackage(source);
const extras = ['score.json', 'loop-recipe.json', 'build.ts', 'catalog.json', 'performance.json', 'registry.json', 'loop-provenance.json', 'PROVENANCE.md', 'reference.json'];
const delivered = await packageProduction24(join(source, 'main.json'), join(out, 'delivery'), {
  provenance: { engineCommit, composition: authored.title, loopMethod: provenance.loop.operation,
    sourceGeneratorSha256: sha256(readFileSync(join(here, 'build.ts'))),
    sourceRights: 'Original numeric performances of owner-approved engines; existing engine licensing unchanged.' },
  sourceFiles: extras.filter(f => existsSync(join(source, f))).map(f => ({ path: join(source, f), file: f })),
  licenseFiles: existsSync(join(here, 'PROVENANCE.md')) ? [join(here, 'PROVENANCE.md')] : [],
});
console.log(JSON.stringify({ output: out, masterGainDb: gainDb, master: delivered.manifest.master,
  stems: delivered.manifest.stems.map(s => ({ id: s.trackId, frames: s.analysis.frames, clipped: s.clippedSamples })) }, null, 2));
