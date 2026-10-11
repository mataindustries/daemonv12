// Muxes the vertical deliverable: the rendered picture (stream copy, untouched) plus AAC encoded
// once from the edited master WAV at its own 44.1 kHz, ending at exactly 15.000 s.
//
//   npm run render:vertical          # renders the picture, then runs this
//   node scripts/vertical-mux.ts [--video out/daemonv12-vertical-15s.video.mp4] [--out out/daemonv12-vertical-15s.mp4]
//
// Why not Remotion's own audio track: Remotion mixes at 48 kHz and its AAC track is padded to a
// whole AAC frame. 15 s at 48 kHz (720,000 samples) is not a multiple of 1024, so that track and
// the container would read 15.019 s. Encoding from the WAV with an explicit end writes an edit
// list that trims the encoder delay and the padding, so every stream and the file are 15.000 s.
import {spawnSync} from 'node:child_process';
import {existsSync} from 'node:fs';
import {dirname, join, resolve} from 'node:path';
import {fileURLToPath} from 'node:url';
import {parseArgs} from 'node:util';
import {V_DURATION_IN_FRAMES, V_DURATION_SECONDS} from '../src/vertical/edit.ts';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const {values} = parseArgs({
  options: {
    video: {type: 'string', default: join(root, 'out', 'daemonv12-vertical-15s.video.mp4')},
    audio: {type: 'string', default: join(root, 'public', 'sync', 'vertical-15s.wav')},
    out: {type: 'string', default: join(root, 'out', 'daemonv12-vertical-15s.mp4')},
  },
});
const video = resolve(values.video!);
const audio = resolve(values.audio!);
const output = resolve(values.out!);
for (const path of [video, audio]) {
  if (!existsSync(path)) {
    console.error(`missing ${path}\nRun npm run render:vertical (it prepares the audio and renders the picture first).`);
    process.exit(1);
  }
}

const mux = spawnSync('ffmpeg', ['-v', 'error', '-y', '-i', video, '-i', audio, '-map', '0:v:0', '-map', '1:a:0', '-c:v', 'copy', '-c:a', 'aac', '-b:a', '320k', '-t', String(V_DURATION_SECONDS), '-movflags', '+faststart', output], {encoding: 'utf8'});
if (mux.error || mux.status !== 0) {
  console.error(mux.error ? `ffmpeg is required: ${mux.error.message}` : mux.stderr);
  process.exit(1);
}

const probe = spawnSync('ffprobe', ['-v', 'error', '-count_frames', '-show_entries', 'stream=codec_type,codec_name,width,height,r_frame_rate,nb_read_frames,sample_rate,channels,duration:format=duration,size', '-of', 'json', output], {encoding: 'utf8'});
const info = JSON.parse(probe.stdout) as {streams: Record<string, string | number>[]; format: {duration: string; size: string}};
const v = info.streams.find(s => s.codec_type === 'video')!;
const a = info.streams.find(s => s.codec_type === 'audio')!;
const exact = Number(v.nb_read_frames) === V_DURATION_IN_FRAMES && Number(v.duration) === V_DURATION_SECONDS && Number(a.duration) === V_DURATION_SECONDS && Number(info.format.duration) === V_DURATION_SECONDS;
console.log(`${output}`);
console.log(`  video ${v.codec_name} ${v.width}×${v.height} ${v.r_frame_rate} fps, ${v.nb_read_frames} frames, ${v.duration} s`);
console.log(`  audio ${a.codec_name} ${a.sample_rate} Hz ${a.channels} ch, ${a.duration} s`);
console.log(`  file ${info.format.duration} s, ${(Number(info.format.size) / 1048576).toFixed(2)} MiB`);
if (!exact) {
  console.error('the muxed file is not exactly 900 frames and 15.000 s');
  process.exit(1);
}
