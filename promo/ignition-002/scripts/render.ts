// Renders the deliverables.
//
//   node scripts/render.ts preview                 # out/IGNITION-002-preview-540x960.mp4
//   node scripts/render.ts master                  # out/IGNITION-002-INFINITE-REACTOR-15S-1080x1920.mp4 + poster
//   node scripts/render.ts master --picture-only   # no approved WAV yet: a clearly named silent master
//   node scripts/render.ts preview|master --film v12   # V12 OVERDRIVE into out/v12 (needs the approved WAV)
//
// The picture is rendered once by Remotion into a ProRes HQ mezzanine (no 4:2:0 round trip),
// then encoded once with two-pass x264 to fit the 32 MiB budget. The music is never routed
// through Remotion's mixer: AAC is encoded once, straight from the approved WAV at its own
// sample rate, trimmed to exactly 15.000 s with an edit list, and the file is faststart.
import {spawnSync} from 'node:child_process';
import {createHash} from 'node:crypto';
import {existsSync, mkdirSync, readFileSync, rmSync, statSync} from 'node:fs';
import {dirname, join} from 'node:path';
import {fileURLToPath} from 'node:url';
import {parseArgs} from 'node:util';
import {DURATION_IN_FRAMES, LOOP} from '../src/timeline.ts';
import {APPROVED_SHA256, approvedWavPath} from './lib/approved.ts';
import {filmOf} from './lib/deliverables.ts';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const WAV = approvedWavPath(root);

/** Average video bitrate: about 29 MiB of picture plus 0.6 MiB of 320 kb/s AAC over 15 s. */
const VIDEO_BITRATE = '16M';

const {values, positionals} = parseArgs({allowPositionals: true, options: {'picture-only': {type: 'boolean', default: false}, concurrency: {type: 'string'}, film: {type: 'string', default: 'reactor'}}});
const mode = positionals[0];
if (mode !== 'preview' && mode !== 'master') {
  console.error('usage: node scripts/render.ts preview|master [--film reactor|v12] [--picture-only]');
  process.exit(1);
}
const film = filmOf(values.film);
const out = join(root, film.outDir);
const work = join(out, 'work');
const bundle = join(root, 'out', 'bundle');
const concurrency = values.concurrency ?? String(film.concurrency);
const flags = film.remotionFlags;

const run = (cmd: string, args: string[], label: string) => {
  console.log(`\n▸ ${label}`);
  const r = spawnSync(cmd, args, {stdio: 'inherit', cwd: root, env: process.env});
  if (r.status !== 0) {
    console.error(`${label} failed`);
    process.exit(1);
  }
};
const remotion = (args: string[], label: string) => run('npx', ['remotion', ...args], label);

const sync = JSON.parse(readFileSync(join(root, film.sync), 'utf8')) as {source: string; audio: null | {sha256: string}};
const haveWav = existsSync(WAV) && createHash('sha256').update(readFileSync(WAV)).digest('hex') === APPROVED_SHA256;
if (haveWav && (sync.source !== 'analysis' || sync.audio?.sha256 !== APPROVED_SHA256)) {
  console.error(`The approved WAV is present but ${film.sync} is not its analysis. Run: ${film.analyze}`);
  process.exit(1);
}
if (mode === 'master' && !haveWav && !(values['picture-only'] && film.pictureOnlyAllowed)) {
  console.error(`The approved WAV is missing or does not match SHA-256 ${APPROVED_SHA256}:\n  ${WAV}\nPlace it there and run ${film.analyze}${film.pictureOnlyAllowed ? ', or pass --picture-only for a silent master' : ''}.`);
  process.exit(1);
}

mkdirSync(work, {recursive: true});
remotion(['bundle', 'src/index.ts', '--out-dir', bundle], 'bundle');

if (mode === 'preview') {
  const picture = join(work, 'preview.picture.mp4');
  remotion(['render', bundle, film.composition, picture, '--scale=0.5', '--crf=20', '--muted', `--concurrency=${concurrency}`, ...flags], `render ${film.composition} preview picture (540×960)`);
  const target = join(out, film.preview);
  const args = haveWav
    ? ['-v', 'error', '-y', '-i', picture, '-i', WAV, '-map', '0:v:0', '-map', '1:a:0', '-c:v', 'copy', '-c:a', 'aac', '-b:a', '192k', '-ac', '2', '-t', String(LOOP), '-movflags', '+faststart', target]
    : ['-v', 'error', '-y', '-i', picture, '-c:v', 'copy', '-movflags', '+faststart', target];
  run('ffmpeg', args, haveWav ? 'mux preview with the approved WAV' : 'preview without audio (approved WAV not present)');
  console.log(`\n${target}${haveWav ? '' : '  (silent: approved WAV not present)'}`);
  process.exit(0);
}

// Master.
const mezz = join(work, 'master.prores.mov');
remotion(['render', bundle, film.composition, mezz, '--codec=prores', '--prores-profile=hq', '--jpeg-quality=100', '--muted', `--concurrency=${concurrency}`, ...flags], `render ${film.composition} ProRes HQ mezzanine (1080×1920, 60 fps, 900 frames)`);

const target = join(out, haveWav ? film.master : film.masterPictureOnly);
const x264 = ['-c:v', 'libx264', '-preset', 'slow', '-b:v', VIDEO_BITRATE, '-maxrate', '24M', '-bufsize', '32M', '-pix_fmt', 'yuv420p', '-profile:v', 'high', '-level:v', '4.2', '-g', '60', '-bf', '3', '-x264-params', 'aq-mode=3:aq-strength=0.9', '-colorspace', 'bt709', '-color_primaries', 'bt709', '-color_trc', 'bt709', '-color_range', 'tv'];
const passlog = join(work, 'x264-2pass');
run('ffmpeg', ['-v', 'error', '-y', '-i', mezz, ...x264, '-pass', '1', '-passlogfile', passlog, '-an', '-f', 'null', '/dev/null'], 'x264 pass 1');
const audio = haveWav ? ['-i', WAV] : [];
const maps = haveWav ? ['-map', '0:v:0', '-map', '1:a:0', '-c:a', 'aac', '-b:a', '320k', '-ac', '2'] : ['-map', '0:v:0'];
run('ffmpeg', ['-v', 'error', '-y', '-i', mezz, ...audio, ...maps, ...x264, '-pass', '2', '-passlogfile', passlog, '-t', String(LOOP), '-movflags', '+faststart', '-tag:v', 'avc1', target], 'x264 pass 2 + AAC from the approved WAV');
for (const f of [`${passlog}-0.log`, `${passlog}-0.log.mbtree`]) rmSync(f, {force: true});

const poster = join(out, film.poster);
remotion(['still', bundle, film.composition, poster, `--frame=${film.posterFrame}`, '--image-format=png', ...flags], `poster (frame ${film.posterFrame})`);

const size = statSync(target).size;
console.log(`\n${target}\n  ${(size / 1048576).toFixed(2)} MiB, ${DURATION_IN_FRAMES} frames${haveWav ? '' : '  (PICTURE ONLY: no approved music)'}\n${poster}`);
console.log(`Next: node scripts/verify.ts${film.key === 'reactor' ? '' : ` --film ${film.key}`}`);
