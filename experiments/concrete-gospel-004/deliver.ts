/**
 * Copy the finished record into experiments/concrete-gospel-004/delivery/ (replaced on each run):
 *
 *   concrete-gospel-full-length.wav   the record, 24-bit / 44.1 kHz, -14 LUFS integrated, under -1 dBTP
 *   concrete-gospel-full-length.mp3   the same, 320 kbps (phone-ready: the same loudness, checked in mono too)
 *   stems/                            seven instrument stems as FLAC (lossless: the exact PCM16 stems, checked by decoding
 *                                     each one back; pre-master, unchanged in level, they sum to the mix before the master
 *                                     bus). The WAV stems are in build/out/stems after a build.
 *   source/concrete-gospel-full-length.mid   the arrangement as MIDI (every part, the drums on channel 10)
 *   provenance/                       build manifests, QA before and after the fix pass, freeze check, V2 verification,
 *                                     rack and engine manifests, source hashes
 *   SHA256SUMS
 *
 *   node experiments/concrete-gospel-004/build.ts && PYTHON=python3 node experiments/concrete-gospel-004/deliver.ts
 */
import { spawnSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { copyFileSync, existsSync, mkdirSync, readFileSync, readdirSync, rmSync, statSync, writeFileSync } from 'node:fs';
import { join, relative } from 'node:path';
import { pitchOf } from '../../studio-001/rack/curves.ts';
import { REPO, V2_BUILD } from '../cathedral-experiment-001/backing.ts';
import { HERE, NAME } from './build.ts';
import { BPM, KICKS, SCORES, SNARES, type RackNote } from './compose.ts';

const BUILD = join(HERE, 'build'), OUT = join(HERE, 'delivery'), P = join(OUT, 'provenance'), PY = process.env.PYTHON || 'python3';
const sha = (b: Uint8Array) => createHash('sha256').update(b).digest('hex');
const manifest = JSON.parse(readFileSync(join(BUILD, 'manifest.json'), 'utf8')) as { stage: string; stems: { id: string }[] };
if (!manifest.stage.startsWith('final')) throw new Error(`build/ holds the ${manifest.stage} build: run build.ts without --candidate`);
for (const f of ['qa-candidate.json', 'manifest-candidate.json']) if (!existsSync(join(BUILD, f))) throw new Error(`missing build/${f} (from a --candidate build and its QA)`);

const qa = spawnSync(PY, ['-I', join(HERE, 'qa', 'measure.py'), BUILD, '--json', join(BUILD, 'qa-final.json')], { encoding: 'utf8', maxBuffer: 64 << 20 });
if (qa.status !== 0) throw new Error(`QA failed: ${qa.stderr}`);
const freeze = spawnSync(process.execPath, ['studio-001/rack/cli.ts', 'freeze'], { cwd: REPO, encoding: 'utf8' });
writeFileSync(join(BUILD, 'freeze-check.txt'), `$ node studio-001/rack/cli.ts freeze\n${freeze.stdout}${freeze.stderr}exit ${freeze.status}\n`);
if (freeze.status !== 0) throw new Error('freeze check failed: an approved engine, script or audition changed');

// ------------------------------------------------------------------ MIDI (type 1, 960 PPQ)
const vlq = (n: number) => { const out = [n & 0x7f]; while ((n >>= 7)) out.unshift((n & 0x7f) | 0x80); return out; };
const text = (type: number, s: string) => [0xff, type, ...vlq(Buffer.byteLength(s)), ...Buffer.from(s)];
function track(name: string, ch: number, program: number | null, notes: { beat: number; beats: number; pitch: number; vel: number }[], meta: number[][] = []): Buffer {
  const ev: [number, number[]][] = [[0, text(0x03, name)], ...meta.map(m => [0, m] as [number, number[]]), ...(program === null ? [] : [[0, [0xc0 | ch, program]] as [number, number[]]])];
  for (const n of notes) {
    const on = Math.round(n.beat * 960), off = Math.max(on + 1, Math.round((n.beat + n.beats) * 960)), v = Math.max(1, Math.min(127, Math.round(n.vel * 127)));
    ev.push([on, [0x90 | ch, n.pitch, v]], [off, [0x80 | ch, n.pitch, 0]]);
  }
  ev.sort((a, b) => a[0] - b[0] || (a[1][0]! & 0xf0) - (b[1][0]! & 0xf0));
  const bytes: number[] = []; let t = 0;
  for (const [tick, e] of ev) { bytes.push(...vlq(tick - t), ...e); t = tick; }
  bytes.push(0, 0xff, 0x2f, 0);
  const h = Buffer.alloc(8); h.write('MTrk', 0); h.writeUInt32BE(bytes.length, 4);
  return Buffer.concat([h, Buffer.from(bytes)]);
}
const NAMES: Record<string, [string, number]> = {
  bass808: ['808 (V2 Living Bass)', 38], volt: ['THRONE//VOLT lead', 81], great: ['CATHEDRAL//ENGINE Great', 19], swell: ['CATHEDRAL//ENGINE Swell', 19], pedal: ['CATHEDRAL//ENGINE Pedal (8\' pitch)', 19],
  bass: ['HEAVEN//MASS basses', 52], tenor: ['HEAVEN//MASS tenors', 52], alto: ['HEAVEN//MASS altos', 52], soprano: ['HEAVEN//MASS sopranos', 52], 'soprano-2': ['HEAVEN//MASS second sopranos', 52], descant: ['HEAVEN//MASS descant', 52],
};
const parts = SCORES.flatMap(s => (s.score.parts as { id: string; notes: RackNote[] }[]).map(p => p));
const CH = [0, 1, 2, 3, 4, 5, 6, 7, 8, 10, 11, 12, 13, 14];
const us = Math.round(60e6 / BPM);
const tracks = [
  track('Concrete Gospel (Full-Length Edition)', 0, null, [], [[0xff, 0x51, 3, (us >> 16) & 0xff, (us >> 8) & 0xff, us & 0xff], [0xff, 0x58, 4, 4, 2, 24, 8], [0xff, 0x59, 2, 0xfc, 1]]),
  ...parts.map((p, i) => track(NAMES[p.id]![0], CH[i]!, NAMES[p.id]![1], p.notes.map(([beat, beats, pitch, vel]) => ({ beat, beats, pitch: pitchOf(pitch), vel })))),
  track('Kick and snare (V2 hits)', 9, null, [...KICKS.map(([b, v]) => ({ beat: b, beats: 0.25, pitch: 36, vel: v * 0.9 })), ...SNARES.map(b => ({ beat: b, beats: 0.25, pitch: 38, vel: 0.9 }))]),
];
const hdr = Buffer.alloc(14); hdr.write('MThd', 0); hdr.writeUInt32BE(6, 4); hdr.writeUInt16BE(1, 8); hdr.writeUInt16BE(tracks.length, 10); hdr.writeUInt16BE(960, 12);

// ------------------------------------------------------------------ delivery/
rmSync(OUT, { recursive: true, force: true });
for (const d of ['stems', 'source', 'provenance/rack', 'provenance/engine']) mkdirSync(join(OUT, d), { recursive: true });
for (const ext of ['wav', 'mp3']) copyFileSync(join(BUILD, 'out', `${NAME}.${ext}`), join(OUT, `${NAME}.${ext}`));
const pcm = (wav: string) => { const b = readFileSync(wav); let o = 12; while (o + 8 <= b.length) { const id = b.toString('ascii', o, o + 4), len = b.readUInt32LE(o + 4); if (id === 'data') return b.subarray(o + 8, o + 8 + len); o += 8 + len + (len & 1); } throw new Error(`${wav}: no data`); };
const ffm = (args: string[]) => { const r = spawnSync(process.env.DAEMONV12_FFMPEG || 'ffmpeg', ['-hide_banner', '-nostdin', '-v', 'error', '-y', ...args]); if (r.status !== 0) throw new Error(`ffmpeg: ${r.stderr}`); };
for (const s of manifest.stems) {
  const wav = join(BUILD, 'out', 'stems', `${s.id}.wav`), flac = join(OUT, 'stems', `${s.id}.flac`), back = join(BUILD, 'out', `${s.id}.roundtrip.wav`);
  ffm(['-i', wav, '-c:a', 'flac', '-compression_level', '8', '-map_metadata', '-1', '-fflags', '+bitexact', '-flags:a', '+bitexact', flac]);
  ffm(['-i', flac, '-c:a', 'pcm_s16le', '-map_metadata', '-1', '-fflags', '+bitexact', '-flags:a', '+bitexact', back]);
  if (!pcm(wav).equals(pcm(back))) throw new Error(`${s.id}: FLAC round trip is not bit-exact`);
  rmSync(back);
}
writeFileSync(join(OUT, 'source', `${NAME}.mid`), Buffer.concat([hdr, ...tracks]));
copyFileSync(join(BUILD, 'manifest.json'), join(P, 'build-manifest.json'));
copyFileSync(join(BUILD, 'manifest-candidate.json'), join(P, 'build-manifest-candidate.json'));
for (const f of ['qa-candidate.json', 'qa-final.json', 'freeze-check.txt']) copyFileSync(join(BUILD, f), join(P, f));
copyFileSync(join(V2_BUILD, 'verify.json'), join(P, 'v2-backing-verify.json'));
for (const s of SCORES) for (const f of ['render.json', 'performance.json']) copyFileSync(join(BUILD, 'rack', s.id, f), join(P, 'rack', `${s.id}.${f}`));
for (const f of ['render.json', 'analysis.json']) copyFileSync(join(BUILD, 'engine', 'render', `${NAME}.${f}`), join(P, 'engine', `${NAME}.${f}`));
const sources: string[] = [];
const walk = (d: string) => { for (const e of readdirSync(d).sort()) { const p = join(d, e); if (['build', 'delivery', '__pycache__'].includes(e)) continue; if (statSync(p).isDirectory()) walk(p); else sources.push(p); } };
walk(HERE); walk(join(HERE, '..', 'cathedral-experiment-001', 'instruments')); walk(join(HERE, '..', 'cathedral-experiment-001', 'upstream'));
for (const f of ['backing.ts', 'build.ts']) sources.push(join(HERE, '..', 'cathedral-experiment-001', f));
writeFileSync(join(P, 'sources.SHA256SUMS'), sources.map(p => `${sha(readFileSync(p))}  ${relative(HERE, p)}`).join('\n') + '\n');
const files: string[] = [];
const walk2 = (d: string) => { for (const e of readdirSync(d).sort()) { const p = join(d, e); if (statSync(p).isDirectory()) walk2(p); else if (e !== 'SHA256SUMS') files.push(p); } };
walk2(OUT);
writeFileSync(join(OUT, 'SHA256SUMS'), files.map(p => `${sha(readFileSync(p))}  ${relative(OUT, p)}`).join('\n') + '\n');
console.log(`delivered ${files.length} files to ${relative(process.cwd(), OUT)}; freeze: ${freeze.stdout.trim()}`);
