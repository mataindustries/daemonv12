// Turn the final master and stems into public/sync/promo-data.json.
//
//   npm run analyze                       # reads public/sync/sync.json
//   npm run analyze -- --dir path/to/sync # another folder with the same layout
//
// See SYNC_HANDOFF.md for the folder layout and sync.json fields.
import {createHash} from 'node:crypto';
import {existsSync, readFileSync, writeFileSync} from 'node:fs';
import {dirname, join, relative, resolve} from 'node:path';
import {fileURLToPath} from 'node:url';
import {parseArgs} from 'node:util';
import {automationSchema, markerSchema, parsePromoData, STEM_IDS, type Onset, type StemId} from '../src/data/contract.ts';
import {cue, CUES, cueGrid, type CueName} from '../src/timeline/cues.ts';
import {DURATION_SECONDS} from '../src/timeline/grid.ts';
import {analyze, onsetsFromManifest, type RenderManifest, type TrackSelector} from './lib/analyze.ts';
import {decodeWav, mixdown} from './lib/wav.ts';
import {z} from 'zod';

const syncSchema = z.strictObject({
  master: z.string(),
  stems: z.strictObject(Object.fromEntries(STEM_IDS.map(id => [id, z.string()])) as Record<StemId, z.ZodString>),
  manifest: z.string().optional(),
  tracks: z.partialRecord(z.enum(STEM_IDS), z.union([z.array(z.string()).min(1), z.strictObject({tracks: z.array(z.string()).min(1), samples: z.array(z.string()).optional()})])).optional(),
  structure: z.string().optional(),
});

const here = dirname(fileURLToPath(import.meta.url));
const {values} = parseArgs({options: {dir: {type: 'string', default: join(here, '..', 'public', 'sync')}}});
const dir = resolve(values.dir!);
const configPath = join(dir, 'sync.json');
if (!existsSync(configPath)) {
  console.error(`missing ${configPath}\nSee SYNC_HANDOFF.md for the expected folder layout.`);
  process.exit(1);
}
const config = syncSchema.parse(JSON.parse(readFileSync(configPath, 'utf8')));
const sha = (bytes: Uint8Array) => createHash('sha256').update(bytes).digest('hex');

const load = (file: string) => {
  const path = join(dir, file);
  const bytes = readFileSync(path);
  return {path, sha256: sha(bytes), pcm: decodeWav(bytes, path)};
};

const master = load(config.master);
const rate = master.pcm.sampleRate;
const expected = DURATION_SECONDS * rate;
const problems: string[] = [];
const notes: string[] = [];
if (master.pcm.frames < expected - 1) problems.push(`master is ${(master.pcm.frames / rate).toFixed(6)} s; the promo is locked to ${DURATION_SECONDS}.000 s (${expected} frames at ${rate} Hz)`);
if (master.pcm.frames > expected + 1) notes.push(`master runs ${((master.pcm.frames - expected) / rate).toFixed(3)} s past 24.000 s; the tail is ignored`);

const stems = {} as Record<StemId, Float32Array>;
const stemHashes: Record<string, string> = {};
for (const id of STEM_IDS) {
  const stem = load(config.stems[id]);
  if (stem.pcm.sampleRate !== rate) problems.push(`stems.${id}: ${stem.pcm.sampleRate} Hz, master is ${rate} Hz`);
  if (Math.abs(stem.pcm.frames - master.pcm.frames) > 1) notes.push(`stems.${id}: ${stem.pcm.frames} frames vs master ${master.pcm.frames}; DaemonV12 stems should be sample-aligned`);
  stems[id] = mixdown(stem.pcm);
  stemHashes[id] = `${config.stems[id]} ${stem.sha256}`;
}
if (problems.length) {
  console.error(`cannot analyze:\n  - ${problems.join('\n  - ')}`);
  process.exit(1);
}

const onsets: Partial<Record<StemId, Onset[]>> = {};
if (config.manifest && config.tracks) {
  const manifest = JSON.parse(readFileSync(join(dir, config.manifest), 'utf8')) as RenderManifest;
  for (const [id, selector] of Object.entries(config.tracks) as [StemId, string[] | TrackSelector][]) {
    onsets[id] = onsetsFromManifest(manifest, Array.isArray(selector) ? {tracks: selector} : selector);
    if (!onsets[id]!.length) notes.push(`manifest gave no triggers for ${id}; check sync.json tracks`);
  }
}

let markers = undefined;
let automation = undefined;
if (config.structure) {
  const structure = JSON.parse(readFileSync(join(dir, config.structure), 'utf8')) as {markers?: unknown[]; automation?: unknown[]};
  markers = z.array(markerSchema).parse(structure.markers ?? []);
  automation = z.array(automationSchema).parse(structure.automation ?? []);
}

const data = parsePromoData(
  analyze({
    sampleRate: rate,
    master: mixdown(master.pcm),
    stems,
    onsets,
    markers,
    automation,
    source: {kind: 'analysis', generator: 'scripts/analyze-stems.ts', master: config.master, masterSha256: master.sha256, stems: stemHashes, sampleRate: rate},
  }),
);
const out = join(dir, 'promo-data.json');
writeFileSync(out, JSON.stringify(data) + '\n');

console.log(`wrote ${relative(process.cwd(), out)}`);
console.log(`master ${(master.pcm.frames / rate).toFixed(6)} s @ ${rate} Hz  sha256 ${master.sha256.slice(0, 16)}…`);
for (const id of STEM_IDS) {
  const list = data.stems[id].onsets;
  console.log(`  ${id.padEnd(5)} ${String(list.length).padStart(4)} onsets  ${onsets[id] ? '(manifest, exact)' : '(detected)'}  first ${list.slice(0, 3).map(o => o.t.toFixed(3)).join(', ')}`);
}
console.log(`markers: ${data.markers.map(m => `${m.id}@${m.t.toFixed(3)}`).join('  ')}`);
console.log(`automation lanes: ${data.automation.map(a => a.id).join(', ') || 'none (camera and effect labels stay neutral)'}`);
console.log('cue snapping (grid → music):');
for (const name of Object.keys(CUES) as CueName[]) {
  const delta = (cue(data, name) - cueGrid(name)) * 1000;
  if ('snap' in CUES[name]) console.log(`  ${name.padEnd(16)} ${CUES[name].at.padEnd(10)} ${Math.abs(delta) < 0.05 ? 'on grid' : `${delta > 0 ? '+' : ''}${delta.toFixed(1)} ms`}`);
}
for (const note of notes) console.log(`note: ${note}`);
