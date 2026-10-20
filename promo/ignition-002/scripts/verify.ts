// Validates a rendered master and writes the QA evidence to out/qa/.
//
//   node scripts/verify.ts [--video out/IGNITION-002-INFINITE-REACTOR-15S-1080x1920.mp4]
//   node scripts/verify.ts --film v12        # V12 OVERDRIVE in out/v12
//
// Technical: H.264 High / yuv420p / 1080×1920 / 60 fps / exactly 900 frames and 15.000 s, AAC
// stereo, faststart (moov before mdat), size under 32 MiB.
// Loop: renders virtual frame 900 (frame 899 + 1/60 s) and compares it with frame 0; measures
// the decoded 899→0 transition against every other frame transition and against the other bar
// lines (the loop point is a downbeat); writes a seam strip, phase screenshots and a three-cycle
// file for human review.
// Audio: the muxed AAC is cross-correlated with the approved WAV (offset must be 0 samples) and
// the WAV's own loop point is checked for a click.
// Safety: counts luminance flashes per second, full frame and per quadrant.
import {spawnSync} from 'node:child_process';
import {createHash} from 'node:crypto';
import {existsSync, mkdirSync, openSync, readFileSync, readSync, closeSync, statSync, writeFileSync} from 'node:fs';
import {dirname, join, resolve, basename} from 'node:path';
import {fileURLToPath} from 'node:url';
import {parseArgs} from 'node:util';
import {SAFE} from '../src/layout.ts';
import {BAR, DURATION_IN_FRAMES, FPS, HEIGHT, LOOP, WIDTH} from '../src/timeline.ts';
import {APPROVED_SHA256, approvedWavPath} from './lib/approved.ts';
import {seamReport} from './lib/analyze.ts';
import {decodeWav, mixdown} from './lib/wav.ts';
import {filmOf} from './lib/deliverables.ts';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const {values} = parseArgs({options: {video: {type: 'string'}, film: {type: 'string', default: 'reactor'}}});
const film = filmOf(values.film);
const out = join(root, film.outDir);
const qa = join(out, 'qa');
mkdirSync(qa, {recursive: true});
const video = resolve(values.video ?? (existsSync(join(out, film.master)) ? join(out, film.master) : join(out, film.masterPictureOnly)));
if (!existsSync(video)) {
  console.error(`missing ${video}; run node scripts/render.ts master first`);
  process.exit(1);
}
const WAV = approvedWavPath(root);
const haveWav = existsSync(WAV) && createHash('sha256').update(readFileSync(WAV)).digest('hex') === APPROVED_SHA256;
const sync = JSON.parse(readFileSync(join(root, film.sync), 'utf8')) as {source: string; kick: {t: number; s: number}[]};

const sh = (cmd: string, args: string[], binary = false) => {
  const r = spawnSync(cmd, args, {cwd: root, maxBuffer: 1 << 30, encoding: binary ? 'buffer' : 'utf8'});
  if (r.status !== 0) throw new Error(`${cmd} ${args.join(' ')}\n${r.stderr?.toString()}`);
  return r.stdout as unknown as string & Buffer;
};
const sha = (path: string) => createHash('sha256').update(readFileSync(path)).digest('hex');

type Check = {name: string; ok: boolean; value: string};
const checks: Check[] = [];
const check = (name: string, ok: boolean, value: string | number) => checks.push({name, ok, value: String(value)});

// --- Container and streams -------------------------------------------------------------------
type Stream = Record<string, string | number | undefined> & {codec_type: string};
const probe = JSON.parse(sh('ffprobe', ['-v', 'error', '-count_frames', '-show_entries', 'stream=codec_type,codec_name,profile,pix_fmt,width,height,r_frame_rate,avg_frame_rate,nb_read_frames,start_time,duration,sample_rate,channels,channel_layout,bit_rate,color_space,color_transfer,color_primaries:format=duration,size,bit_rate', '-of', 'json', video])) as {streams: Stream[]; format: Record<string, string>};
const v = probe.streams.find(s => s.codec_type === 'video')!;
const a = probe.streams.find(s => s.codec_type === 'audio');
const size = statSync(video).size;
check('video codec H.264', v.codec_name === 'h264', `${v.codec_name} ${v.profile}`);
check('pixel format yuv420p', v.pix_fmt === 'yuv420p', String(v.pix_fmt));
check('resolution 1080×1920', v.width === WIDTH && v.height === HEIGHT, `${v.width}×${v.height}`);
check('frame rate 60 fps (constant)', v.r_frame_rate === '60/1' && v.avg_frame_rate === '60/1', `${v.r_frame_rate} avg ${v.avg_frame_rate}`);
check('exactly 900 frames', Number(v.nb_read_frames) === DURATION_IN_FRAMES, String(v.nb_read_frames));
check('video duration 15.000 s', Math.abs(Number(v.duration) - LOOP) < 0.0005, String(v.duration));
check('file duration 15.000 s', Math.abs(Number(probe.format.duration) - LOOP) < 0.0005, probe.format.duration!);
check('size under 32 MiB', size < 32 * 1048576, `${(size / 1048576).toFixed(2)} MiB`);
if (haveWav || a) {
  check('audio AAC stereo', a?.codec_name === 'aac' && Number(a?.channels) === 2, a ? `${a.codec_name} ${a.channels} ch ${a.sample_rate} Hz ${Math.round(Number(a.bit_rate) / 1000)} kb/s` : 'none');
  check('audio duration 15.000 s', !!a && Math.abs(Number(a.duration) - LOOP) < 0.0005, String(a?.duration));
  check('audio and video start together', !!a && Number(a.start_time) === 0 && Number(v.start_time) === 0, `v ${v.start_time} a ${a?.start_time}`);
} else {
  check('audio track (approved WAV unavailable)', false, 'none: picture-only master');
}

// Faststart: top-level boxes in order; moov must precede mdat.
const boxes: string[] = [];
{
  const fd = openSync(video, 'r');
  const head = Buffer.alloc(16);
  let pos = 0;
  while (pos < size) {
    readSync(fd, head, 0, 16, pos);
    let len = head.readUInt32BE(0);
    const type = head.toString('ascii', 4, 8);
    if (len === 1) len = Number(head.readBigUInt64BE(8));
    if (len < 8) break;
    boxes.push(type);
    pos += len;
  }
  closeSync(fd);
}
check('faststart (moov before mdat)', boxes.indexOf('moov') >= 0 && boxes.indexOf('moov') < boxes.indexOf('mdat'), boxes.join(' '));

// --- Decoded frames: seam, flashes, sync ----------------------------------------------------
const w = 270;
const h = 480;
const raw = sh('ffmpeg', ['-v', 'error', '-i', video, '-vf', `scale=${w}:${h}:flags=area,format=gray`, '-f', 'rawvideo', '-'], true) as Buffer;
const n = Math.floor(raw.length / (w * h));
const frame = (i: number) => raw.subarray(((i + n) % n) * w * h, (((i + n) % n) + 1) * w * h);
const mad = (A: Uint8Array, B: Uint8Array) => {
  let s = 0;
  for (let i = 0; i < A.length; i++) s += Math.abs(A[i]! - B[i]!);
  return s / A.length;
};
const accel = (i: number) => {
  // Change of the frame-to-frame change: mean |Y(i+1) − 2·Y(i) + Y(i−1)|.
  const A = frame(i - 1);
  const B = frame(i);
  const Cc = frame(i + 1);
  let s = 0;
  for (let k = 0; k < A.length; k++) s += Math.abs(Cc[k]! - 2 * B[k]! + A[k]!);
  return s / A.length;
};
const diffs = Array.from({length: n}, (_, i) => mad(frame(i), frame(i + 1))); // diffs[n-1] is 899 → 0
const sorted = (xs: number[]) => xs.slice().sort((p, q) => p - q);
const pct = (xs: number[], p: number) => sorted(xs)[Math.min(xs.length - 1, Math.round((p / 100) * (xs.length - 1)))]!;
const inner = diffs.slice(0, n - 1);
const seamDiff = diffs[n - 1]!;
const barLineDiffs = Array.from({length: 7}, (_, b) => {
  const f = Math.ceil(((b + 1) * BAR * FPS) - 1e-9);
  return diffs[f - 1]!;
});
const accels = Array.from({length: n}, (_, i) => accel(i));
const seamAccel = [accels[n - 1]!, accels[0]!];
const r3 = (x: number) => Math.round(x * 1000) / 1000;
check('seam 899→0 change within the range of the film’s own frame changes', seamDiff <= pct(inner, 99), `${r3(seamDiff)} (median ${r3(pct(inner, 50))}, p99 ${r3(pct(inner, 99))}, max ${r3(Math.max(...inner))})`);
check('seam 899→0 change comparable to the other bar-line downbeats', seamDiff <= Math.max(...barLineDiffs) * 1.25, `${r3(seamDiff)} vs bar lines ${barLineDiffs.map(r3).join(', ')}`);
check('motion continuity at the seam (second difference)', Math.max(...seamAccel) <= pct(accels.slice(1, n - 1), 99), `${seamAccel.map(r3).join(', ')} (median ${r3(pct(accels, 50))}, p99 ${r3(pct(accels, 99))})`);

// Flashes: a flash is a rise and fall of at least 10 % of full luminance with the dark state
// below 80 %, in the full frame or any quadrant (25 % of the screen). At most 3 per second.
const regions: [string, number, number, number, number][] = [
  ['full', 0, 0, w, h],
  ['top-left', 0, 0, w / 2, h / 2],
  ['top-right', w / 2, 0, w, h / 2],
  ['bottom-left', 0, h / 2, w / 2, h],
  ['bottom-right', w / 2, h / 2, w, h],
  ['centre', w / 4, h / 4, (3 * w) / 4, (3 * h) / 4],
];
const flashReport = regions.map(([name, fx0, fy0, fx1, fy1]) => {
  const [x0, y0, x1, y1] = [fx0, fy0, fx1, fy1].map(Math.round) as [number, number, number, number];
  const m = Array.from({length: n}, (_, i) => {
    const f = frame(i);
    let s = 0;
    let c = 0;
    for (let y = y0; y < y1; y++) for (let x = x0; x < x1; x++, c++) s += f[y * w + x]!;
    return s / c;
  });
  // Extremes with hysteresis of 10 % (25.5 levels).
  const events: number[] = [];
  let dir = 0;
  let ext = m[0]!;
  let extAt = 0;
  for (let i = 1; i < n * 3; i++) {
    const val = m[i % n]!;
    if (dir >= 0) {
      if (val > ext) {
        ext = val;
        extAt = i;
      } else if (ext - val >= 25.5) {
        if (dir === 1) events.push(extAt);
        dir = -1;
        ext = val;
        extAt = i;
      }
    }
    if (dir <= 0) {
      if (val < ext) {
        ext = val;
        extAt = i;
      } else if (val - ext >= 25.5 && ext < 204) {
        dir = 1;
        ext = val;
        extAt = i;
      }
    }
  }
  const peaks = events.filter(e => e >= n && e < 2 * n).map(e => e - n);
  let worst = 0;
  for (const p of peaks) worst = Math.max(worst, peaks.filter(q => q >= p && q < p + FPS).length);
  let maxStep = 0;
  for (let i = 0; i < n; i++) maxStep = Math.max(maxStep, Math.abs(m[(i + 1) % n]! - m[i]!));
  return {region: name, flashes: peaks.length, worstPerSecond: worst, maxFrameStep: r3(maxStep), meanY: r3(m.reduce((p, q) => p + q, 0) / n)};
});
check('no hazardous flashing (≤ 3 flashes in any second, any quadrant)', flashReport.every(r => Number.isFinite(r.meanY) && r.worstPerSecond <= 3), flashReport.map(r => `${r.region} ${r.worstPerSecond}/s`).join(', '));

// Visual response to the driving hits: the film's response region brightens on each kick.
const [rx0, ry0, rx1, ry1] = film.responseRegion.map((v, i) => Math.round(v * (i % 2 === 0 ? w : h))) as [number, number, number, number];
const core = Array.from({length: n}, (_, i) => {
  const f = frame(i);
  let s = 0;
  let c = 0;
  for (let y = ry0; y < ry1; y++) for (let x = rx0; x < rx1; x++, c++) s += f[y * w + x]!;
  return s / c;
});
const lags = sync.kick.map(k => {
  const kf = Math.round(k.t * FPS);
  let best = 0;
  let bestLag = 0;
  for (let d = -4; d <= 6; d++) {
    const rise = core[(kf + d + n) % n]! - core[(kf + d - 1 + n) % n]!;
    if (rise > best) {
      best = rise;
      bestLag = d;
    }
  }
  return bestLag;
});
const lagSorted = sorted(lags);
const medianLag = lagSorted[Math.floor(lagSorted.length / 2)]!;
check('picture responds on the kick frame (median lag ≤ 1 frame)', Math.abs(medianLag) <= 1, `median ${medianLag} frames; ${lags.filter(l => Math.abs(l) <= 1).length}/${lags.length} kicks within ±1 frame (sync source: ${sync.source})`);

// --- Virtual frame 900 == frame 0 (rendered, before compression) -----------------------------
const bundle = join(root, 'out', 'bundle');
const still = (path: string, frameNo: number, props?: Record<string, unknown>) => sh('npx', ['remotion', 'still', bundle, film.composition, path, `--frame=${frameNo}`, '--image-format=png', ...film.remotionFlags, ...(props ? [`--props=${JSON.stringify(props)}`] : [])]);
const stillGray = (path: string) => sh('ffmpeg', ['-v', 'error', '-i', path, '-vf', 'format=gray', '-f', 'rawvideo', '-'], true) as Buffer;
let virtualCheck = 'skipped (no bundle)';
if (existsSync(bundle)) {
  const s0 = join(qa, 'render-frame-0000.png');
  const s900 = join(qa, 'render-virtual-frame-0900.png');
  still(s0, 0);
  still(s900, 899, {audio: false, timeOffset: 1 / FPS});
  const d = mad(stillGray(s0), stillGray(s900));
  virtualCheck = `mean |Δ| = ${d.toFixed(4)} levels`;
  check('virtual frame 900 renders identical to frame 0', d < 0.01, virtualCheck);

  // Copy alone (every renderer layer off), measured against the platform-safe box.
  const copyPng = join(qa, 'copy-only.png');
  still(copyPng, 0, film.copyOnlyProps);
  const g = stillGray(copyPng);
  const lines = film.copyLines;
  const boxes = lines.map(([name, ya, yb, th]) => {
    let x0 = WIDTH;
    let x1 = 0;
    let y0 = HEIGHT;
    let y1 = 0;
    for (let y = ya; y < yb; y++) {
      for (let x = 0; x < WIDTH; x++) {
        if (g[y * WIDTH + x]! > th) {
          x0 = Math.min(x0, x);
          x1 = Math.max(x1, x);
          y0 = Math.min(y0, y);
          y1 = Math.max(y1, y);
        }
      }
    }
    return {name, x0, x1, y0, y1};
  });
  check('all copy inside the platform-safe box (x 162–918, y 300–1460)', boxes.every(b => b.x0 >= SAFE.left && b.x1 <= SAFE.right && b.y0 >= SAFE.top && b.y1 <= SAFE.bottom), boxes.map(b => `${b.name} x ${b.x0}–${b.x1} y ${b.y0}–${b.y1}`).join('; '));
}

// --- Evidence images and the three-cycle file ------------------------------------------------
const extract = (f: number, path: string, vf = 'null') => sh('ffmpeg', ['-v', 'error', '-y', '-i', video, '-vf', `select=eq(n\\,${f}),${vf}`, '-frames:v', '1', '-fps_mode', 'passthrough', path]);
const phases = [0, 225, 450, 675, 899];
const phaseFiles = phases.map(f => {
  const p = join(qa, `phase-${(f / FPS).toFixed(2)}s-frame-${String(f).padStart(3, '0')}.png`);
  extract(f, p);
  return p;
});
sh('ffmpeg', ['-v', 'error', '-y', ...phaseFiles.flatMap(p => ['-i', p]), '-filter_complex', `hstack=inputs=${phaseFiles.length},scale=2700:-1`, join(qa, 'phases-sheet.png')]);
const seamFrames = [897, 898, 899, 0, 1, 2];
const seamFiles = seamFrames.map(f => {
  const p = join(qa, `seam-${String(f).padStart(3, '0')}.png`);
  extract(f, p, 'crop=1080:1180:0:400,scale=540:-1');
  return p;
});
sh('ffmpeg', ['-v', 'error', '-y', ...seamFiles.flatMap(p => ['-i', p]), '-filter_complex', `hstack=inputs=${seamFiles.length}`, join(qa, 'seam-strip-897-898-899-0-1-2.png')]);

const loop3 = join(qa, film.key === 'reactor' ? 'IGNITION-002-loop-3x.mp4' : film.master.replace(/\.mp4$/, '-loop-3x.mp4'));
const audioIn = haveWav ? ['-stream_loop', '2', '-i', WAV] : [];
const audioMap = haveWav ? ['-map', '1:a:0', '-c:a', 'aac', '-b:a', '320k', '-ac', '2'] : [];
sh('ffmpeg', ['-v', 'error', '-y', '-stream_loop', '2', '-i', video, ...audioIn, '-map', '0:v:0', ...audioMap, '-c:v', 'copy', '-t', String(3 * LOOP), '-movflags', '+faststart', loop3]);
const loopProbe = JSON.parse(sh('ffprobe', ['-v', 'error', '-count_packets', '-show_entries', 'stream=codec_type,nb_read_packets,duration', '-of', 'json', loop3])) as {streams: Stream[]};
const lv = loopProbe.streams.find(s => s.codec_type === 'video')!;
check('three-cycle file plays 2,700 frames', Number(lv.nb_read_packets) === 3 * DURATION_IN_FRAMES, `${lv.nb_read_packets} frames, ${lv.duration} s`);

// --- Audio ---------------------------------------------------------------------------------
let audioReport: Record<string, unknown> = {available: haveWav};
if (haveWav && a) {
  const pcm = decodeWav(readFileSync(WAV));
  const sr = pcm.sampleRate;
  const ref = mixdown(pcm);
  const decoded = sh('ffmpeg', ['-v', 'error', '-i', video, '-map', '0:a:0', '-ac', '1', '-ar', String(sr), '-f', 'f32le', '-'], true) as Buffer;
  const got = new Float32Array(decoded.buffer, decoded.byteOffset, Math.floor(decoded.length / 4));
  const span = Math.min(3 * sr, ref.length - 4096);
  let bestLag = 0;
  let best = -Infinity;
  for (let lag = -2048; lag <= 2048; lag++) {
    let s = 0;
    for (let i = 4096; i < span; i += 3) s += ref[i]! * (got[i + lag] ?? 0);
    if (s > best) {
      best = s;
      bestLag = lag;
    }
  }
  let err = 0;
  let sig = 0;
  for (let i = 0; i < Math.min(ref.length, got.length); i++) {
    err += (ref[i]! - got[i]!) ** 2;
    sig += ref[i]! ** 2;
  }
  const snr = 10 * Math.log10(sig / Math.max(1e-12, err));
  check('muxed audio aligned with the approved WAV (offset 0 samples)', bestLag === 0, `${bestLag} samples; ${got.length} vs ${ref.length} samples; AAC SNR ${snr.toFixed(1)} dB`);
  const seam = seamReport(pcm.channels, sr);
  check('approved WAV loops without a click', seam.every(c => c.jump <= Math.max(c.p999Step, 0.02)), seam.map(c => `jump ${c.jump} (p99.9 step ${c.p999Step})`).join('; '));
  audioReport = {available: true, sampleRate: sr, offsetSamples: bestLag, aacSnrDb: Math.round(snr * 10) / 10, wavSeam: seam, wavSha256: APPROVED_SHA256};
}

// --- Checksums, report ----------------------------------------------------------------------
const files = [video, join(out, film.poster), loop3, ...(haveWav ? [WAV] : [])].filter(existsSync);
const sums = files.map(f => `${sha(f)}  ${basename(f)}`).join('\n') + '\n';
writeFileSync(join(out, 'SHA256SUMS.txt'), sums);
const report = {
  video: basename(video),
  sha256: sha(video),
  sizeBytes: size,
  boxes,
  probe,
  syncSource: sync.source,
  seam: {seamDiff: r3(seamDiff), medianDiff: r3(pct(inner, 50)), p99Diff: r3(pct(inner, 99)), maxDiff: r3(Math.max(...inner)), barLineDiffs: barLineDiffs.map(r3), seamAccel: seamAccel.map(r3), p99Accel: r3(pct(accels, 99)), virtualFrame900: virtualCheck},
  flash: flashReport,
  kickLagFrames: {median: medianLag, all: lags},
  audio: audioReport,
  checks,
};
writeFileSync(join(qa, 'verify.json'), JSON.stringify(report, null, 2) + '\n');

console.log(`\n${video}`);
for (const c of checks) console.log(`  ${c.ok ? 'PASS' : 'FAIL'}  ${c.name}: ${c.value}`);
console.log(`\n${sums}QA evidence in ${qa}`);
process.exit(checks.every(c => c.ok) ? 0 : 1);
