// Render-level QA for the vertical cut, through the real Remotion renderer.
//
//   npm run verify:vertical                                          # composition checks
//   npm run verify:vertical -- --video out/daemonv12-vertical-15s.mp4 # also the encoded file
//   npm run verify:vertical -- --sweep                               # copy layer every sixth frame
//
// Uses the final data in public/sync/ (run npm run vertical:prepare) and falls back to the fixture.
// Checks:
//   - locked metadata: 1080×1920, 60 fps, 900 frames, exactly 15.000 s; frame 900 does not exist;
//   - frame 0 works as a thumbnail: not black, the wordmark and the glass are on it, copy in the safe box;
//   - every copy beat, rendered with the copy layers alone: all copy inside the safe box
//     (x 162–918, y 300–1460), never touching a frame edge (no clipping, no horizontal overflow);
//   - the CTA is on the end card from its cue to the last frame, inside the safe box;
//   - two frames render byte-identically twice;
//   - with --video: ffprobe dimensions, frame count, duration, fps and the audio stream; the encoded
//     audio matches vertical-15s.wav; writes the 360×640 phone-preview contact sheet.
import {bundle} from '@remotion/bundler';
import {getCompositions, renderStill} from '@remotion/renderer';
import {spawnSync} from 'node:child_process';
import {createHash} from 'node:crypto';
import {existsSync, mkdirSync, readFileSync, writeFileSync} from 'node:fs';
import {dirname, join, resolve} from 'node:path';
import {fileURLToPath} from 'node:url';
import {parseArgs} from 'node:util';
import {CTA_LINE} from '../src/vertical/config.ts';
import {vCueGrid} from '../src/vertical/cues.ts';
import {V_DURATION_IN_FRAMES, V_FPS, V_HEIGHT, V_WIDTH} from '../src/vertical/edit.ts';
import {SAFE} from '../src/vertical/layout.ts';
import {inkBox, readLuma, type Box} from './lib/png.ts';
import {decodeWav} from './lib/wav.ts';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const out = join(root, 'out', 'verify-vertical');
mkdirSync(out, {recursive: true});
const {values} = parseArgs({options: {video: {type: 'string'}, data: {type: 'string'}, sweep: {type: 'boolean', default: false}}});
const synced = existsSync(join(root, 'public', 'sync', 'vertical-extras.json')) && existsSync(join(root, 'public', 'sync', 'promo-data.json'));
const dataSource = values.data === 'fixture' || (!values.data && !synced) ? 'fixture' : 'sync';
const browserExecutable = process.env.REMOTION_BROWSER_EXECUTABLE ?? null;

const results: [string, boolean, string][] = [];
const check = (name: string, ok: boolean, detail = '') => {
  results.push([name, ok, detail]);
  console.log(`${ok ? 'PASS' : 'FAIL'}  ${name}${detail ? `  (${detail})` : ''}`);
};
const sha = (path: string) => createHash('sha256').update(readFileSync(path)).digest('hex');
const fmtBox = (b: Box | null) => (b ? `x ${b.x0}–${b.x1}, y ${b.y0}–${b.y1}` : 'empty');
/** Copy may carry a chromatic fringe a few pixels wide at an entry; allow it. */
const TOLERANCE = 4;
const insideSafe = (b: Box) => b.x0 >= SAFE.left - TOLERANCE && b.x1 <= SAFE.right + TOLERANCE && b.y0 >= SAFE.top - TOLERANCE && b.y1 <= SAFE.bottom + TOLERANCE;
const clearOfEdges = (b: Box) => b.x0 > 0 && b.y0 > 0 && b.x1 < V_WIDTH - 1 && b.y1 < V_HEIGHT - 1;

console.log(`bundling… (data: ${dataSource})`);
const serveUrl = await bundle({entryPoint: join(root, 'src', 'index.ts'), rspack: true});
const props = (layers: 'all' | 'copy') => ({dataSource, audio: 'none', layers});
const comps = await getCompositions(serveUrl, {inputProps: props('all'), browserExecutable});
const main = comps.find(c => c.id === 'GlassFireVertical');
if (!main) throw new Error('GlassFireVertical composition missing');
// Renders use the props a composition was resolved with, so the copy layer is its own selection.
const copyLayer = (await getCompositions(serveUrl, {inputProps: props('copy'), browserExecutable})).find(c => c.id === 'GlassFireVertical')!;
check('GlassFireVertical is 1080×1920', main.width === V_WIDTH && main.height === V_HEIGHT, `${main.width}×${main.height}`);
check('GlassFireVertical is 60 fps', main.fps === V_FPS, `${main.fps}`);
check('GlassFireVertical is 900 frames', main.durationInFrames === V_DURATION_IN_FRAMES, `${main.durationInFrames}`);
check('15.000 s exactly', main.durationInFrames / main.fps === 15, `${main.durationInFrames / main.fps}`);
const landscape = comps.find(c => c.id === 'GlassFire');
check('the landscape GlassFire composition is unchanged in shape', landscape?.width === 1920 && landscape.height === 1080 && landscape.durationInFrames === 1440 && landscape.fps === 60, `${landscape?.width}×${landscape?.height}, ${landscape?.durationInFrames} f`);

const still = async (frame: number, layers: 'all' | 'copy', name = `${layers}-${String(frame).padStart(3, '0')}`) => {
  const output = join(out, `${name}.png`);
  await renderStill({composition: layers === 'copy' ? copyLayer : main, serveUrl, frame, output, inputProps: props(layers), imageFormat: 'png', browserExecutable, overwrite: true});
  return output;
};

// Frame 0: the thumbnail.
const first = readLuma(await still(0, 'all'));
let lit = 0;
for (const v of first.values) if (v > 24) lit++;
check('frame 0 is not black (no black hold)', lit > 0.03 * first.values.length, `${((lit / first.values.length) * 100).toFixed(1)} % of pixels lit`);
const firstCopy = inkBox(readLuma(await still(0, 'copy')));
check('frame 0 carries the wordmark, inside the safe box', !!firstCopy && insideSafe(firstCopy) && firstCopy.y1 < V_HEIGHT * 0.4, fmtBox(firstCopy));
const glassBand = inkBox(first, 160, [600, 880]);
check('frame 0 carries the GLASS.HIT waveform under the wordmark', !!glassBand && glassBand.x1 - glassBand.x0 > 500, fmtBox(glassBand));

// Every copy beat, copy layers only.
const COPY_FRAMES: [number, string][] = [
  [30, 'hook tagline'],
  [82, 'hook over the stop'],
  [110, 'COMPOSE.'],
  [160, 'PROCESS.'],
  [205, 'RENDER.'],
  [315, 'ONE SOUND.'],
  [352, 'MUTATED.'],
  [437, 'GLASS.HIT REVERSE CRUSH CHOP'],
  [505, '9 MCP TOOLS'],
  [620, '128 GM VOICES'],
  [692, 'SAMPLE PERFORMANCE'],
  [800, 'DAEMONV12 GIVE AGENTS'],
  [899, 'end card'],
];
for (const [frame, label] of COPY_FRAMES) {
  const box = inkBox(readLuma(await still(frame, 'copy')));
  check(`copy safe at frame ${frame} (${label})`, !!box && insideSafe(box) && clearOfEdges(box), fmtBox(box));
}

// The CTA: on the end card from its cue to the last frame.
const ctaFrom = Math.ceil(vCueGrid('cta') * V_FPS + 0.2 * V_FPS);
for (const frame of [ctaFrom, Math.round((ctaFrom + V_DURATION_IN_FRAMES - 1) / 2), V_DURATION_IN_FRAMES - 1]) {
  const img = readLuma(await still(frame, 'copy', `cta-${frame}`));
  const band = inkBox(img, 48, [1130, 1240]);
  check(`CTA "${CTA_LINE}" on screen at frame ${frame}`, !!band && band.x1 - band.x0 > 360 && insideSafe(band), fmtBox(band));
}

// --sweep: the copy layer every sixth frame of the cut, not only at the copy beats. Copy must
// never touch a frame edge; it may leave the safe box only during an entry overshoot.
if (values.sweep) {
  let edgeHits = 0;
  let outside = 0;
  let sampled = 0;
  const extent = {x0: Infinity, y0: Infinity, x1: -Infinity, y1: -Infinity};
  for (let frame = 0; frame < V_DURATION_IN_FRAMES; frame += 6) {
    const box = inkBox(readLuma(await still(frame, 'copy', 'sweep')));
    sampled++;
    if (!box) continue;
    if (!clearOfEdges(box)) edgeHits++;
    if (!insideSafe(box)) {
      outside++;
      console.log(`      frame ${frame}: copy outside the safe box (${fmtBox(box)})`);
    }
    extent.x0 = Math.min(extent.x0, box.x0);
    extent.y0 = Math.min(extent.y0, box.y0);
    extent.x1 = Math.max(extent.x1, box.x1);
    extent.y1 = Math.max(extent.y1, box.y1);
  }
  check(`sweep: copy never touches a frame edge (${sampled} frames)`, edgeHits === 0, `copy extent x ${extent.x0}–${extent.x1}, y ${extent.y0}–${extent.y1}`);
  check('sweep: copy outside the safe box only during entries (≤ 3 sampled frames)', outside <= 3, `${outside} of ${sampled} sampled frames`);
}

let pastEnd = false;
try {
  await still(V_DURATION_IN_FRAMES, 'all', 'past-end');
} catch {
  pastEnd = true;
}
check('frame 900 is out of range', pastEnd);

for (const frame of [150, 600]) {
  const a = sha(await still(frame, 'all', `det-${frame}-a`));
  const b = sha(await still(frame, 'all', `det-${frame}-b`));
  check(`frame ${frame} renders byte-identically twice`, a === b, a.slice(0, 12));
}

// ------------------------------------------------------------------ the encoded file
if (values.video) {
  const video = resolve(values.video);
  const probe = spawnSync('ffprobe', ['-v', 'error', '-count_frames', '-show_entries', 'stream=index,codec_type,codec_name,width,height,r_frame_rate,nb_read_frames,sample_rate,channels,pix_fmt:format=duration,size', '-of', 'json', video], {encoding: 'utf8'});
  if (probe.status !== 0) throw new Error(`ffprobe failed: ${probe.stderr}`);
  const info = JSON.parse(probe.stdout) as {streams: Record<string, string | number>[]; format: {duration: string; size: string}};
  const v = info.streams.find(s => s.codec_type === 'video');
  const a = info.streams.find(s => s.codec_type === 'audio');
  check('video is 1080×1920 H.264 yuv420p', v?.width === 1080 && v?.height === 1920 && v?.codec_name === 'h264' && v?.pix_fmt === 'yuv420p', `${v?.width}×${v?.height} ${v?.codec_name} ${v?.pix_fmt}`);
  check('video has exactly 900 frames', Number(v?.nb_read_frames) === 900, `${v?.nb_read_frames}`);
  check('video is 60 fps', v?.r_frame_rate === '60/1', `${v?.r_frame_rate}`);
  check('container duration is 15.000 s', Math.abs(Number(info.format.duration) - 15) < 0.0005, `${info.format.duration} s, ${(Number(info.format.size) / 1048576).toFixed(2)} MiB`);
  check('audio stream present (AAC stereo)', a?.codec_name === 'aac' && Number(a?.channels) === 2, `${a?.codec_name} ${a?.sample_rate} Hz ${a?.channels} ch`);

  // The encoded audio is the edited master: decode it back and compare.
  const wavPath = join(root, 'public', 'sync', 'vertical-15s.wav');
  if (dataSource === 'sync' && existsSync(wavPath)) {
    const decoded = join(out, 'decoded-audio.wav');
    spawnSync('ffmpeg', ['-v', 'error', '-y', '-i', video, '-vn', '-ac', '2', '-ar', '44100', '-c:a', 'pcm_s16le', decoded]);
    const ref = decodeWav(readFileSync(wavPath));
    const got = decodeWav(readFileSync(decoded));
    // AAC adds a small delay; find it, then measure the residual.
    const mono = (pcm: typeof ref) => pcm.channels[0]!.map((s, i) => (s + pcm.channels[1]![i]!) / 2);
    const r = mono(ref);
    const g = mono(got);
    let best = 0;
    let bestCorr = -1;
    const corrAt = (lag: number, step = 7) => {
      let xy = 0;
      let xx = 0;
      let yy = 0;
      for (let i = 0; i < r.length; i += step) {
        const j = i + lag;
        if (j < 0 || j >= g.length) continue;
        xy += r[i]! * g[j]!;
        xx += r[i]! * r[i]!;
        yy += g[j]! * g[j]!;
      }
      return xy / Math.sqrt(xx * yy || 1);
    };
    for (let lag = -2048; lag <= 2048; lag += 1) {
      const c = corrAt(lag, 29);
      if (c > bestCorr) {
        bestCorr = c;
        best = lag;
      }
    }
    const corr = corrAt(best, 1);
    let err = 0;
    let sig = 0;
    for (let i = 0; i < r.length; i++) {
      const j = i + best;
      if (j < 0 || j >= g.length) continue;
      err += (r[i]! - g[j]!) ** 2;
      sig += r[i]! ** 2;
    }
    const residualDb = 10 * Math.log10(err / sig);
    check('encoded audio is the edited master (correlation, residual)', corr > 0.995 && residualDb < -24, `r = ${corr.toFixed(5)}, residual ${residualDb.toFixed(1)} dB, offset ${best} samples, ${(got.frames / 44100).toFixed(3)} s decoded`);
  }

  // Phone preview: 24 evenly spaced frames at 360×640 on one sheet.
  const sheet = join(root, 'out', 'daemonv12-vertical-phone-360.png');
  const picks = Array.from({length: 24}, (_, i) => Math.round((i * (V_DURATION_IN_FRAMES - 1)) / 23));
  const select = picks.map(n => `eq(n\\,${n})`).join('+');
  const tile = spawnSync('ffmpeg', ['-v', 'error', '-y', '-i', video, '-vf', `select='${select}',scale=360:640:flags=lanczos,tile=6x4:padding=8:color=0x2a2a2a`, '-frames:v', '1', sheet], {encoding: 'utf8'});
  check('360×640 phone-preview sheet written', tile.status === 0 && existsSync(sheet), sheet.replace(root + '/', ''));
}

const failed = results.filter(r => !r[1]);
writeFileSync(join(out, 'report.json'), JSON.stringify({dataSource, results: results.map(([name, ok, detail]) => ({name, ok, detail}))}, null, 1) + '\n');
console.log(`\n${results.length - failed.length}/${results.length} checks passed (data: ${dataSource})`);
process.exit(failed.length ? 1 : 0);
