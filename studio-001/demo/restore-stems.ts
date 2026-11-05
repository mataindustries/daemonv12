/**
 * Restores the demo's lossless stems to the exact engine stem WAV bytes and checks them against DEMO.json.
 *   node studio-001/demo/restore-stems.ts NEW_DIR      (needs FFmpeg)
 * FLAC keeps the samples; this writes the engine's canonical 44-byte PCM16 header around them.
 */
import { spawnSync } from 'node:child_process';
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { sha256 } from '../rack/frozen.ts';

const here = dirname(fileURLToPath(import.meta.url)), out = resolve(process.argv[2] ?? '');
if (!process.argv[2] || existsSync(out)) throw new Error('usage: restore-stems.ts NEW_DIR (must not exist)');
mkdirSync(out, { recursive: true });
const demo = JSON.parse(readFileSync(join(here, 'DEMO.json'), 'utf8')) as { stems: Record<string, { decodesTo: string; wavSha256: string }> };
let bad = 0;
for (const [flac, { decodesTo, wavSha256 }] of Object.entries(demo.stems)) {
  const r = spawnSync(process.env.DAEMONV12_FFMPEG || 'ffmpeg', ['-hide_banner', '-nostdin', '-v', 'error', '-i', join(here, flac), '-f', 's16le', '-ac', '2', '-'], { maxBuffer: 1 << 30 });
  if (r.status !== 0) throw new Error(`ffmpeg: ${r.stderr}`);
  const pcm = r.stdout, h = Buffer.alloc(44);
  h.write('RIFF', 0); h.writeUInt32LE(36 + pcm.length, 4); h.write('WAVEfmt ', 8); h.writeUInt32LE(16, 16); h.writeUInt16LE(1, 20); h.writeUInt16LE(2, 22);
  h.writeUInt32LE(44100, 24); h.writeUInt32LE(44100 * 4, 28); h.writeUInt16LE(4, 32); h.writeUInt16LE(16, 34); h.write('data', 36); h.writeUInt32LE(pcm.length, 40);
  const wav = Buffer.concat([h, pcm]), ok = sha256(wav) === wavSha256; if (!ok) bad++;
  writeFileSync(join(out, decodesTo), wav);
  console.log(`${ok ? 'OK  ' : 'DIFF'} ${decodesTo}`);
}
if (bad) { console.error(`${bad} stem(s) differ from the engine render`); process.exitCode = 1; }
