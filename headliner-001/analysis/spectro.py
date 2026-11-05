#!/usr/bin/env python3
"""Spectrogram / waveform PNG renderer for visual inspection (the producer cannot hear audio).

usage: spectro.py in.wav out.png [--start S] [--end S] [--bpm B --bar0 S] [--fmin 25] [--fmax 18000]
       [--height 360] [--pxps 80] [--title TEXT]
Log-frequency STFT magnitude (dB, 75 dB range), RMS strip on top, optional bar grid.
Read-only; numpy + zlib only. Evidence for design decisions, not a quality score.
"""
import argparse, struct, wave, zlib
import numpy as np

def read_wav(path):
    with wave.open(path, 'rb') as w:
        ch, sw, sr, n = w.getnchannels(), w.getsampwidth(), w.getframerate(), w.getnframes()
        raw = w.readframes(n)
    assert sw == 2, 'PCM16 only'
    x = np.frombuffer(raw, dtype='<i2').astype(np.float64) / 32768.0
    return x.reshape(-1, ch), sr

def colormap(v):
    # v in [0,1] -> RGB, dark-blue -> purple -> orange -> pale yellow ("sodium" palette)
    stops = np.array([[0.0, 8, 8, 20], [0.25, 45, 20, 90], [0.5, 150, 40, 110], [0.7, 235, 110, 40],
                      [0.88, 255, 200, 80], [1.0, 255, 250, 210]])
    out = np.zeros(v.shape + (3,))
    for c in range(3):
        out[..., c] = np.interp(v, stops[:, 0], stops[:, c + 1])
    return out.astype(np.uint8)

def png(path, rgb):
    h, w, _ = rgb.shape
    raw = b''.join(b'\x00' + rgb[y].tobytes() for y in range(h))
    def chunk(t, d):
        c = struct.pack('>I', len(d)) + t + d
        return c + struct.pack('>I', zlib.crc32(t + d) & 0xffffffff)
    data = b'\x89PNG\r\n\x1a\n' + chunk(b'IHDR', struct.pack('>IIBBBBB', w, h, 8, 2, 0, 0, 0))
    data += chunk(b'IDAT', zlib.compress(raw, 9)) + chunk(b'IEND', b'')
    open(path, 'wb').write(data)

# 5x7 bitmap font for a minimal title / labels
FONT = {}
_glyphs = {
    '0': '01110100011001110101110011000101110', '1': '00100011000010000100001000010001110',
    '2': '01110100010000100010001000100011111', '3': '11111000100010000010000011000101110',
    '4': '00010001100101010010111110001000010', '5': '11111100001111000001000011000101110',
    '6': '00110010001000011110100011000101110', '7': '11111000010001000100010000100001000',
    '8': '01110100011000101110100011000101110', '9': '01110100011000101111000010001001100',
    ':': '00000011000110000000011000110000000', '.': '00000000000000000000000000110001100',
    '-': '00000000000000011111000000000000000', ' ': '0' * 35, 'k': '10000100001001010100110001010010010',
    'H': '10001100011000111111100011000110001', 'z': '00000000001111100010001000100011111',
    's': '00000000000111110000011100000111110', '/': '00001000010001000100010001000010000',
}
for k, v in _glyphs.items():
    FONT[k] = np.array([int(b) for b in v]).reshape(7, 5)

def text(img, x, y, s, color=(230, 230, 230)):
    for ch in s:
        g = FONT.get(ch, FONT[' '])
        for r in range(7):
            for c in range(5):
                if g[r, c] and 0 <= y + r < img.shape[0] and 0 <= x + c < img.shape[1]:
                    img[y + r, x + c] = color
        x += 6

def main():
    ap = argparse.ArgumentParser()
    ap.add_argument('wav'); ap.add_argument('out')
    ap.add_argument('--start', type=float, default=0); ap.add_argument('--end', type=float, default=None)
    ap.add_argument('--bpm', type=float, default=None); ap.add_argument('--bar0', type=float, default=0.0)
    ap.add_argument('--fmin', type=float, default=25); ap.add_argument('--fmax', type=float, default=18000)
    ap.add_argument('--height', type=int, default=360); ap.add_argument('--pxps', type=float, default=80)
    ap.add_argument('--nfft', type=int, default=4096); ap.add_argument('--range', type=float, default=75)
    ap.add_argument('--title', default='')
    a = ap.parse_args()
    x, sr = read_wav(a.wav)
    mono = x.mean(axis=1)
    s0 = int(a.start * sr); s1 = len(mono) if a.end is None else min(len(mono), int(a.end * sr))
    seg = mono[s0:s1]
    width = max(50, int((s1 - s0) / sr * a.pxps))
    hop = max(1, (s1 - s0) // width)
    nfft = a.nfft; win = np.hanning(nfft)
    pad = np.concatenate([np.zeros(nfft // 2), seg, np.zeros(nfft)])
    freqs = np.fft.rfftfreq(nfft, 1 / sr)
    rows = np.geomspace(a.fmin, a.fmax, a.height)[::-1]
    spec = np.zeros((a.height, width)); rms = np.zeros(width)
    for i in range(width):
        frame = pad[i * hop: i * hop + nfft]
        if len(frame) < nfft: frame = np.pad(frame, (0, nfft - len(frame)))
        mag = np.abs(np.fft.rfft(frame * win)) / (nfft / 4)
        spec[:, i] = np.interp(rows, freqs, mag)
        c = seg[i * hop: i * hop + hop]
        rms[i] = np.sqrt(np.mean(c * c)) if len(c) else 0
    db = 20 * np.log10(spec + 1e-9)
    top = db.max()
    v = np.clip((db - (top - a.range)) / a.range, 0, 1)
    img = colormap(v)
    strip_h = 48
    strip = np.full((strip_h, width, 3), 12, dtype=np.uint8)
    rdb = 20 * np.log10(rms + 1e-9)
    for i in range(width):
        h = int(np.clip((rdb[i] + 60) / 60, 0, 1) * (strip_h - 2))
        strip[strip_h - 1 - h: strip_h - 1, i] = (90, 200, 160)
    full = np.concatenate([strip, img], axis=0)
    # frequency guides
    for f, lab in [(50, '50'), (100, '100'), (250, '250'), (500, '500'), (1000, '1k'), (2000, '2k'), (4000, '4k'), (8000, '8k'), (16000, '16k')]:
        if a.fmin < f < a.fmax:
            r = strip_h + int(np.argmin(np.abs(rows - f)))
            full[r, ::6] = (90, 90, 90)
            text(full, 2, r - 8, lab + 'Hz' if f < 1000 else lab, (170, 170, 170))
    if a.bpm:
        bar = 240 / a.bpm
        k = int(np.ceil((a.start - a.bar0) / bar))
        while True:
            t = a.bar0 + k * bar
            if t > (s1 / sr): break
            col = int((t - a.start) * sr / hop)
            if 0 <= col < width:
                full[strip_h:, col] = np.maximum(full[strip_h:, col], 70)
                text(full, col + 2, 2, str(k + 1), (240, 220, 120))
            k += 1
    if a.title: text(full, 2, strip_h - 10, a.title[:60].lower(), (255, 255, 255))
    png(a.out, full)
    print(f'{a.out}: {width}x{full.shape[0]} px, {(s1 - s0) / sr:.2f} s, peak {20*np.log10(np.abs(seg).max()+1e-12):.1f} dBFS')

if __name__ == '__main__':
    main()
