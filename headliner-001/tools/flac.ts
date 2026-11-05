/**
 * Lossless storage for HEADLINER 001 audio. FLAC keeps the repository small; restore rebuilds the exact canonical
 * 44-byte-header PCM16 WAV bytes (as written by the generator and by the DaemonV12 engine) and verifies SHA-256.
 *
 *   node headliner-001/tools/flac.ts pack <wavRoot> <flacRoot>                 encode every *.wav (copies kit.json)
 *   node headliner-001/tools/flac.ts restore <flacRoot> <wavRoot> [sums...]    decode every *.flac, write WAV, verify
 *
 * `sums` are files of "<sha256>  <relative/path.wav>" lines or a catalog JSON ({sounds:[{file,sha256}]}).
 * Requires FFmpeg (same tool the engine already needs for production renders). Exit 1 on any mismatch.
 */
import { spawnSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { readdirSync, statSync, mkdirSync, copyFileSync, writeFileSync, readFileSync, existsSync } from 'node:fs';
import { join, relative, dirname } from 'node:path';

const walk = (root: string): string[] => readdirSync(root).flatMap(f => { const p = join(root, f); return statSync(p).isDirectory() ? walk(p) : [p]; });
const sha = (b: Uint8Array) => createHash('sha256').update(b).digest('hex');
function ff(args: string[], input?: Buffer): Buffer {
  const r = spawnSync('ffmpeg', ['-hide_banner', '-nostdin', '-v', 'error', ...args], { input, maxBuffer: 1 << 30 });
  if (r.status !== 0) throw new Error(`ffmpeg ${args.join(' ')}: ${r.stderr}`);
  return r.stdout;
}
/** Channel count from the FLAC STREAMINFO block (byte 20, bits 3..1, plus one). */
function flacChannels(bytes: Buffer): number { if (bytes.toString('latin1', 0, 4) !== 'fLaC') throw new Error('not FLAC'); return ((bytes[20]! >> 1) & 7) + 1; }
function wavHeader(dataBytes: number, channels: number): Buffer {
  const h = Buffer.alloc(44);
  h.write('RIFF', 0); h.writeUInt32LE(36 + dataBytes, 4); h.write('WAVE', 8); h.write('fmt ', 12); h.writeUInt32LE(16, 16);
  h.writeUInt16LE(1, 20); h.writeUInt16LE(channels, 22); h.writeUInt32LE(44100, 24); h.writeUInt32LE(44100 * channels * 2, 28);
  h.writeUInt16LE(channels * 2, 32); h.writeUInt16LE(16, 34); h.write('data', 36); h.writeUInt32LE(dataBytes, 40);
  return h;
}
const [cmd, from, to, ...sumFiles] = process.argv.slice(2);
if (!cmd || !from || !to) { console.error('usage: flac.ts pack|restore <from> <to> [sums...]'); process.exit(2); }
if (cmd === 'pack') {
  let n = 0, inBytes = 0, outBytes = 0;
  for (const f of walk(from)) {
    const rel = relative(from, f), dst = join(to, rel);
    mkdirSync(dirname(dst), { recursive: true });
    if (f.endsWith('.json')) { if (f !== dst) copyFileSync(f, dst); continue; }
    if (!f.endsWith('.wav')) continue;
    const wav = readFileSync(f);
    if (wav.length < 44 || wav.toString('latin1', 36, 40) !== 'data') throw new Error(`${rel}: not a canonical 44-byte-header WAV`);
    const flac = ff(['-f', 'wav', '-i', 'pipe:0', '-c:a', 'flac', '-compression_level', '8', '-fflags', '+bitexact', '-flags:a', '+bitexact', '-map_metadata', '-1', '-f', 'flac', 'pipe:1'], wav);
    writeFileSync(dst.replace(/\.wav$/, '.flac'), flac); n++; inBytes += wav.length; outBytes += flac.length;
  }
  console.log(`packed ${n} WAV -> FLAC: ${(inBytes / 1048576).toFixed(1)} MiB -> ${(outBytes / 1048576).toFixed(1)} MiB`);
} else if (cmd === 'restore') {
  const expected = new Map<string, string>();
  for (const s of sumFiles) {
    const text = readFileSync(s, 'utf8');
    if (s.endsWith('.json')) for (const x of (JSON.parse(text) as { sounds: { file: string; sha256: string }[] }).sounds) expected.set(x.file.replace(/^assets\//, ''), x.sha256);
    else for (const line of text.split('\n')) { const m = /^([0-9a-f]{64})\s+\*?(.+)$/.exec(line.trim()); if (m) expected.set(m[2]!, m[1]!); }
  }
  let n = 0, bad = 0, checked = 0;
  for (const f of walk(from)) {
    const rel = relative(from, f), dst = join(to, rel);
    mkdirSync(dirname(dst), { recursive: true });
    if (f.endsWith('.json')) { if (f !== dst) copyFileSync(f, dst); continue; }
    if (!f.endsWith('.flac')) continue;
    const flac = readFileSync(f), ch = flacChannels(flac);
    const pcm = ff(['-f', 'flac', '-i', 'pipe:0', '-f', 's16le', '-acodec', 'pcm_s16le', '-ac', String(ch), 'pipe:1'], flac);
    const wav = Buffer.concat([wavHeader(pcm.length, ch), pcm]), relWav = rel.replace(/\.flac$/, '.wav');
    writeFileSync(dst.replace(/\.flac$/, '.wav'), wav); n++;
    const key = [...expected.keys()].find(k => k === relWav || relWav.endsWith('/' + k) || k.endsWith('/' + relWav));
    if (key) { checked++; if (expected.get(key) !== sha(wav)) { bad++; console.error(`MISMATCH ${relWav}`); } }
  }
  console.log(`restored ${n} WAV files; verified ${checked} against SHA-256 (${bad} mismatches)`);
  if (bad || (expected.size && checked < expected.size)) { if (checked < expected.size) console.error(`only ${checked} of ${expected.size} expected files found`); process.exit(1); }
} else { console.error(`unknown command ${cmd}`); process.exit(2); }
void existsSync;
