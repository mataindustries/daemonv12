// Reproduce from a checkout, using only Node. Never reads historical render assets.
import { createHash } from 'node:crypto';
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { resolve, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import assert from 'node:assert/strict';
import { generatePack } from './generate-morph-pack.ts';
import { compileProjectFile, runCommand } from '../src/pipeline.ts';
import { scheduledEventsFromTimeline } from '../src/sync-timeline.ts';
import { buildEventMap, cropEventMap, serializeEventMap } from '../src/sync/index.ts';
import { extractWavFrames, decodePcm } from '../src/render/index.ts';

const root = fileURLToPath(new URL('../', import.meta.url));
const destination = resolve(process.argv[2] ?? join(root, 'work/morph-sync-demo'));
assert.notEqual(destination, join(root, 'examples'), 'Choose a fresh demonstration directory.');
mkdirSync(destination, { recursive: true });
generatePack(destination);
const projectBytes = readFileSync(join(root, 'examples/morph-sync-demo.json'));
const project = join(destination, 'morph-sync-demo.json');
writeFileSync(project, projectBytes);
const sha = (bytes: Uint8Array) => createHash('sha256').update(bytes).digest('hex');
const source = { file: 'morph-sync-demo.json', sha256: sha(projectBytes),
  soundPack: { file: 'morph-v1.catalog.json', sha256: sha(readFileSync(join(destination, 'morph-v1.catalog.json'))) },
  adapter: 'daemonv12-resolved-timeline-v1' };
const compilation = compileProjectFile(project);
assert.ok(compilation.timeline, JSON.stringify(compilation.diagnostics));
const rendered = await runCommand('render', project, { outDir: join(destination, 'render'), stems: true, env: {} });
assert.equal(rendered.exitCode, 0, JSON.stringify(rendered.result.errors));
const wav = readFileSync(rendered.result.artifacts.wav!), pcm = decodePcm(wav).pcm!;
assert.equal((rendered.result.manifest!.mix as { clippedSamples: number }).clippedSamples, 0);
const events = scheduledEventsFromTimeline(compilation.timeline, source, 44100,
  { cable: ['cable-attack'], beast: ['voice'], ratchet: ['repeat'] });
const options = { sampleRate: 44100, fps: { numerator: 60, denominator: 1 }, source,
  clip: { startSampleFrame: 0, endSampleFrame: pcm.frames } };
const map = buildEventMap(events, options);
writeFileSync(join(destination, 'morph-sync-demo.schedule.json'), JSON.stringify({ ...options, events }, null, 2) + '\n');
const serialized = serializeEventMap(map);
writeFileSync(join(destination, 'morph-sync-demo.events.json'), serialized);
// A deliberately unaligned edit demonstrates subtraction before picture projection.
const start = 44101, end = 220517;
const clipMap = cropEventMap(map, start, end);
const clipWav = extractWavFrames(wav, start, end);
writeFileSync(join(destination, 'morph-sync-demo.clip.wav'), clipWav);
writeFileSync(join(destination, 'morph-sync-demo.clip.events.json'), serializeEventMap(clipMap));
assert.deepEqual(clipWav.subarray(44), wav.subarray(44 + start * 4, 44 + end * 4));
assert.deepEqual(clipMap.events.map(e => e.sampleFrame), map.events.filter(e => e.sampleFrame >= start && e.sampleFrame < end).map(e => e.sampleFrame));
const report = { composition: { frames: pcm.frames, sampleRate: 44100, events: events.length, sha256: sha(wav),
  eventMapSha256: sha(Buffer.from(serialized)), clippedSamples: 0 },
  clip: { startSampleFrame: start, endSampleFrame: end, frames: end - start, events: clipMap.events.length,
    sha256: sha(clipWav), eventMapSha256: sha(Buffer.from(serializeEventMap(clipMap))) } };
writeFileSync(join(destination, 'verification.json'), JSON.stringify(report, null, 2) + '\n');
process.stdout.write(JSON.stringify(report, null, 2) + '\n');
