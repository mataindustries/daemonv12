/** SAMPLE LAB 02: the offline generations, used only where the engine has no equivalent (reverse playback and
 * pitch-preserving time stretch). Each reads a WAV the lab made and writes a new one; nothing else is changed.
 * Run: node experiments/sample-lab-02/scripts/derive.ts <in.wav> <out.wav> reverse
 *      node experiments/sample-lab-02/scripts/derive.ts <in.wav> <out.wav> stretch <startSeconds> <endSeconds> <factor> */
import { readFileSync, writeFileSync } from 'node:fs';
import { pathToFileURL } from 'node:url';
import { frames, readWavFloat, scaleTo, sha256, stretch, taper, wavBytes } from './dsp.ts';

export type Derivation = { op: 'reverse' } | { op: 'stretch'; startSeconds: number; endSeconds: number; factor: number; peakDbfs: number };
export function derive(inPath: string, outPath: string, d: Derivation) {
  const raw = readFileSync(inPath);
  let bytes: Buffer;
  if (d.op === 'reverse') bytes = reversePcm(raw);
  else {
    const out = readWavFloat(raw).map(ch => stretch(ch.slice(frames(d.startSeconds), frames(d.endSeconds)), d.factor));
    for (const ch of out) taper(ch, 256, 256);
    scaleTo(out, d.peakDbfs);
    bytes = wavBytes(out);
  }
  writeFileSync(outPath, bytes);
  return { file: outPath, sha256: sha256(bytes), frames: (bytes.length - 44) / (bytes.readUInt16LE(22) * 2) };
}
/** Reverse the frames of a canonical 44-byte-header PCM16 WAV in place of the samples: a bit-exact mirror (every sample
 * value is kept; only the order of frames changes; channels stay paired). */
function reversePcm(raw: Buffer): Buffer {
  const ch = raw.readUInt16LE(22), block = 2 * ch, data = raw.subarray(44), n = data.length / block, out = Buffer.alloc(raw.length);
  if (raw.toString('ascii', 36, 40) !== 'data' || raw.readUInt16LE(34) !== 16) throw new Error('expected a canonical PCM16 WAV');
  raw.copy(out, 0, 0, 44);
  for (let i = 0; i < n; i++) data.copy(out, 44 + (n - 1 - i) * block, i * block, (i + 1) * block);
  return out;
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const [inPath, outPath, op, a, b, f] = process.argv.slice(2);
  console.log(derive(inPath!, outPath!, op === 'reverse' ? { op: 'reverse' } : { op: 'stretch', startSeconds: +a!, endSeconds: +b!, factor: +f!, peakDbfs: -1 }));
}
