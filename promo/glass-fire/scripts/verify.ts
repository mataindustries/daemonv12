// Render-level QA through the real Remotion renderer.
//
//   npm run verify                  # fixture data
//   npm run verify -- --data sync   # the analyzed final data in public/sync/
//
// Checks: locked composition metadata (1,440 frames, 60 fps, 1920×1080), act previews
// match the act table, the film ends on pure black and holds it to the last frame,
// frame 1440 does not exist, and the same frame renders byte-identically twice.
import {bundle} from '@remotion/bundler';
import {getCompositions, renderStill} from '@remotion/renderer';
import {createHash} from 'node:crypto';
import {mkdirSync, readFileSync} from 'node:fs';
import {dirname, join} from 'node:path';
import {inflateSync} from 'node:zlib';
import {fileURLToPath} from 'node:url';
import {parseArgs} from 'node:util';
import {ACTS} from '../src/timeline/acts.ts';
import {cueGrid} from '../src/timeline/cues.ts';
import {DURATION_IN_FRAMES, eventFrameFromSeconds, FPS} from '../src/timeline/grid.ts';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const out = join(root, 'out', 'verify');
mkdirSync(out, {recursive: true});
const {values} = parseArgs({options: {data: {type: 'string', default: 'fixture'}}});
const inputProps = {dataSource: values.data === 'sync' ? 'sync' : 'fixture', audio: 'none'};
const browserExecutable = process.env.REMOTION_BROWSER_EXECUTABLE ?? null;

const results: [string, boolean, string][] = [];
const check = (name: string, ok: boolean, detail = '') => {
  results.push([name, ok, detail]);
  console.log(`${ok ? 'PASS' : 'FAIL'}  ${name}${detail ? `  (${detail})` : ''}`);
};

/** Brightest RGB channel in an 8-bit non-interlaced PNG (Chrome's still output). */
const maxLuma = (png: string) => {
  const bytes = readFileSync(png);
  let offset = 8;
  let width = 0;
  let height = 0;
  let channels = 4;
  const idat: Buffer[] = [];
  while (offset < bytes.length) {
    const length = bytes.readUInt32BE(offset);
    const type = bytes.toString('ascii', offset + 4, offset + 8);
    const body = bytes.subarray(offset + 8, offset + 8 + length);
    if (type === 'IHDR') {
      width = body.readUInt32BE(0);
      height = body.readUInt32BE(4);
      if (body[8] !== 8 || body[12] !== 0) throw new Error(`${png}: only 8-bit non-interlaced PNG`);
      channels = ({2: 3, 6: 4, 0: 1, 4: 2} as Record<number, number>)[body[9]!] ?? 4;
    }
    if (type === 'IDAT') idat.push(body);
    offset += 12 + length;
  }
  const raw = inflateSync(Buffer.concat(idat));
  const stride = width * channels;
  let prev = new Uint8Array(stride);
  let max = 0;
  for (let y = 0; y < height; y++) {
    const filter = raw[y * (stride + 1)]!;
    const line = new Uint8Array(raw.subarray(y * (stride + 1) + 1, (y + 1) * (stride + 1)));
    for (let i = 0; i < stride; i++) {
      const a = i >= channels ? line[i - channels]! : 0;
      const b = prev[i]!;
      const c = i >= channels ? prev[i - channels]! : 0;
      const p = a + b - c;
      const pa = Math.abs(p - a);
      const pb = Math.abs(p - b);
      const pc = Math.abs(p - c);
      const predictor = filter === 1 ? a : filter === 2 ? b : filter === 3 ? (a + b) >> 1 : filter === 4 ? (pa <= pb && pa <= pc ? a : pb <= pc ? b : c) : 0;
      line[i] = (line[i]! + predictor) & 255;
      if (channels < 3 || i % channels < 3) max = Math.max(max, line[i]!);
    }
    prev = line;
  }
  return max;
};
const sha = (path: string) => createHash('sha256').update(readFileSync(path)).digest('hex');

console.log('bundling…');
const serveUrl = await bundle({entryPoint: join(root, 'src', 'index.ts'), rspack: true});
const comps = await getCompositions(serveUrl, {inputProps, browserExecutable});
const main = comps.find(c => c.id === 'GlassFire');
if (!main) throw new Error('GlassFire composition missing');
check('GlassFire is 1,440 frames', main.durationInFrames === DURATION_IN_FRAMES, `${main.durationInFrames}`);
check('GlassFire is 60 fps', main.fps === FPS, `${main.fps}`);
check('GlassFire is 1920×1080', main.width === 1920 && main.height === 1080, `${main.width}×${main.height}`);
check('24.000 s exactly', main.durationInFrames / main.fps === 24, `${main.durationInFrames / main.fps}`);
for (const act of ACTS) {
  const preview = comps.find(c => c.id.toLowerCase().endsWith(act.id === 'drop1' ? 'drop1' : act.id === 'drop2' ? 'drop2' : act.id));
  check(`act preview ${act.title} = ${act.durationInFrames} frames`, preview?.durationInFrames === act.durationInFrames, `${preview?.id} ${preview?.durationInFrames}`);
}

const still = async (frame: number, name: string) => {
  const output = join(out, `${name}.png`);
  await renderStill({composition: main, serveUrl, frame, output, inputProps, imageFormat: 'png', browserExecutable, overwrite: true});
  return output;
};

const blackFrom = eventFrameFromSeconds(cueGrid('black'));
for (const frame of [blackFrom, Math.round((blackFrom + DURATION_IN_FRAMES - 1) / 2), DURATION_IN_FRAMES - 1]) {
  const luma = maxLuma(await still(frame, `black-${frame}`));
  check(`frame ${frame} is pure black`, luma === 0, `max luma ${luma}`);
}
const lastContent = maxLuma(await still(blackFrom - 1, `last-content-${blackFrom - 1}`));
check(`frame ${blackFrom - 1} (before the cut) still has content`, lastContent > 0, `max luma ${lastContent}`);

let pastEnd = false;
try {
  await still(DURATION_IN_FRAMES, 'past-end');
} catch {
  pastEnd = true;
}
check('frame 1440 is out of range', pastEnd);

for (const frame of [455, 1060]) {
  const a = sha(await still(frame, `det-${frame}-a`));
  const b = sha(await still(frame, `det-${frame}-b`));
  check(`frame ${frame} renders byte-identically twice`, a === b, a.slice(0, 12));
}

const failed = results.filter(r => !r[1]);
console.log(`\n${results.length - failed.length}/${results.length} checks passed (data: ${inputProps.dataSource})`);
process.exit(failed.length ? 1 : 0);
