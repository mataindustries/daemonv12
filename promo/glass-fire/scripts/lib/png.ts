// Minimal decoder for the 8-bit, non-interlaced PNGs Chrome writes for Remotion stills.
import {readFileSync} from 'node:fs';
import {inflateSync} from 'node:zlib';

export type Luma = {width: number; height: number; /** Brightest RGB channel per pixel, 0…255. */ values: Uint8Array};

export const readLuma = (path: string): Luma => {
  const bytes = readFileSync(path);
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
      if (body[8] !== 8 || body[12] !== 0) throw new Error(`${path}: only 8-bit non-interlaced PNG`);
      channels = ({2: 3, 6: 4, 0: 1, 4: 2} as Record<number, number>)[body[9]!] ?? 4;
    }
    if (type === 'IDAT') idat.push(body);
    offset += 12 + length;
  }
  const raw = inflateSync(Buffer.concat(idat));
  const stride = width * channels;
  const values = new Uint8Array(width * height);
  let prev = new Uint8Array(stride);
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
    }
    for (let x = 0; x < width; x++) {
      let m = 0;
      for (let k = 0; k < Math.min(3, channels); k++) m = Math.max(m, line[x * channels + k]!);
      values[y * width + x] = m;
    }
    prev = line;
  }
  return {width, height, values};
};

export type Box = {x0: number; y0: number; x1: number; y1: number; pixels: number};

/** Bounding box of pixels brighter than `threshold`, optionally inside a band of rows. */
export const inkBox = (img: Luma, threshold = 48, rows: [number, number] = [0, img.height]): Box | null => {
  let x0 = Infinity;
  let y0 = Infinity;
  let x1 = -Infinity;
  let y1 = -Infinity;
  let pixels = 0;
  for (let y = Math.max(0, rows[0]); y < Math.min(img.height, rows[1]); y++) {
    for (let x = 0; x < img.width; x++) {
      if (img.values[y * img.width + x]! <= threshold) continue;
      pixels++;
      if (x < x0) x0 = x;
      if (x > x1) x1 = x;
      if (y < y0) y0 = y;
      if (y > y1) y1 = y;
    }
  }
  return pixels ? {x0, y0, x1, y1, pixels} : null;
};
