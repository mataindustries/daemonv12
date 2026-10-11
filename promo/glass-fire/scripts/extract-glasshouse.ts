// Reads the real GLASSHOUSE WAVs from the DaemonV12 repository (read-only) and writes
// compact min/max waveform outlines the promo draws as its glass identity.
//
//   npm run glasshouse:extract
//
// Output: src/data/glasshouse-waveforms.json (committed; regenerate if the pack changes).
import {createHash} from 'node:crypto';
import {readFileSync, writeFileSync} from 'node:fs';
import {dirname, join, relative} from 'node:path';
import {fileURLToPath} from 'node:url';
import {decodeWav, mixdown} from './lib/wav.ts';

const here = dirname(fileURLToPath(import.meta.url));
const promoRoot = join(here, '..');
const examples = join(promoRoot, '..', '..', 'examples');
const catalogPath = join(examples, 'glasshouse.catalog.json');
const outPath = join(promoRoot, 'src', 'data', 'glasshouse-waveforms.json');
const BUCKETS = 480;

type CatalogSound = {id: string; name: string; seconds: number; note: string; fundamentalHz?: number | null; family: string; derivedFrom: string | null; file: string; sha256: string};
const catalog = JSON.parse(readFileSync(catalogPath, 'utf8')) as {pack: string; key: string; sounds: CatalogSound[]};

const round = (v: number) => Math.round(v * 1000) / 1000;
const sounds: Record<string, unknown> = {};
for (const sound of catalog.sounds) {
  const path = join(examples, sound.file);
  const bytes = readFileSync(path);
  const sha256 = createHash('sha256').update(bytes).digest('hex');
  if (sha256 !== sound.sha256) throw new Error(`${sound.file}: sha256 ${sha256} does not match the catalog`);
  const pcm = decodeWav(bytes, path);
  const mono = mixdown(pcm);
  const min: number[] = [];
  const max: number[] = [];
  let peak = 0;
  for (let b = 0; b < BUCKETS; b++) {
    const from = Math.floor((b * mono.length) / BUCKETS);
    const to = Math.max(from + 1, Math.floor(((b + 1) * mono.length) / BUCKETS));
    let lo = 0;
    let hi = 0;
    for (let i = from; i < to; i++) {
      const v = mono[i] ?? 0;
      if (v < lo) lo = v;
      if (v > hi) hi = v;
    }
    min.push(round(lo));
    max.push(round(hi));
    peak = Math.max(peak, -lo, hi);
  }
  sounds[sound.id] = {
    name: sound.name,
    note: sound.note,
    fundamentalHz: sound.fundamentalHz ?? null,
    family: sound.family,
    derivedFrom: sound.derivedFrom,
    seconds: pcm.frames / pcm.sampleRate,
    peak: round(peak),
    file: sound.file,
    sha256,
    min,
    max,
  };
}

const output = {
  source: relative(promoRoot, catalogPath).split('\\').join('/'),
  pack: catalog.pack,
  key: catalog.key,
  buckets: BUCKETS,
  sounds,
};
writeFileSync(outPath, JSON.stringify(output) + '\n');
console.log(`wrote ${relative(process.cwd(), outPath)}: ${Object.keys(sounds).length} sounds × ${BUCKETS} buckets`);
