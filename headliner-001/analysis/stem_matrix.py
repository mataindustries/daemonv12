#!/usr/bin/env python3
"""Per-section, per-stem K-weighted loudness (ungated, BS.1770-style pre-filter) for arrangement balance.

usage: stem_matrix.py <stems-dir> <master.wav> <bpm> "name:bar:bars,name:bar:bars,..."
Prints dB values relative to full scale (LUFS-like, ungated, so silence pulls a section down).
Evidence for "who carries this section", not a quality score.
"""
import sys, os, wave, math
import numpy as np

def read(path):
    with wave.open(path, 'rb') as w:
        x = np.frombuffer(w.readframes(w.getnframes()), dtype='<i2').astype(np.float64) / 32768.0
        return x.reshape(-1, w.getnchannels()), w.getframerate()

def coeffs(kind, f0, q, gain_db, fs):
    A = 10 ** (gain_db / 40); w = 2 * math.pi * f0 / fs; c = math.cos(w); s = math.sin(w); al = s / (2 * q)
    if kind == 'highshelf':
        sq = 2 * math.sqrt(A) * al
        b0 = A * ((A + 1) + (A - 1) * c + sq); b1 = -2 * A * ((A - 1) + (A + 1) * c); b2 = A * ((A + 1) + (A - 1) * c - sq)
        a0 = (A + 1) - (A - 1) * c + sq; a1 = 2 * ((A - 1) - (A + 1) * c); a2 = (A + 1) - (A - 1) * c - sq
    else:  # highpass
        b0 = (1 + c) / 2; b1 = -(1 + c); b2 = b0; a0 = 1 + al; a1 = -2 * c; a2 = 1 - al
    return np.array([b0, b1, b2]) / a0, np.array([1, a1 / a0, a2 / a0])

def response2(freqs, fs):
    """|H(f)|^2 of the BS.1770 K-weighting pre-filter (shelf + RLB high-pass), from the biquads' analytic response."""
    z = np.exp(-1j * 2 * np.pi * freqs / fs); h = np.ones_like(z)
    for kind, f0, q, g in (('highshelf', 1681.974, 0.7071752, 3.99984), ('highpass', 38.13547, 0.5003271, 0)):
        b, a = coeffs(kind, f0, q, g, fs)
        h = h * (b[0] + b[1] * z + b[2] * z * z) / (a[0] + a[1] * z + a[2] * z * z)
    return np.abs(h) ** 2

def kms(seg, fs, nfft=8192):
    """K-weighted mean square of a (frames, channels) segment, summed over channels (Welch, Hann, 50% overlap)."""
    win = np.hanning(nfft); hop = nfft // 2; H2 = response2(np.fft.rfftfreq(nfft, 1 / fs), fs)
    total = 0.0
    for ch in range(seg.shape[1]):
        x = seg[:, ch]
        if len(x) < nfft: x = np.pad(x, (0, nfft - len(x)))
        acc = 0.0; count = 0
        for i in range(0, len(x) - nfft + 1, hop):
            P = np.abs(np.fft.rfft(x[i:i + nfft] * win)) ** 2; P[1:-1] *= 2
            acc += np.sum(P * H2) / (nfft * np.sum(win ** 2)); count += 1
        total += acc / max(1, count)
    return total

def main():
    stems_dir, master, bpm, spec = sys.argv[1], sys.argv[2], float(sys.argv[3]), sys.argv[4]
    bar = 240 / bpm
    secs = [(n, int(b), int(l)) for n, b, l in (p.split(':') for p in spec.split(','))]
    files = [('MASTER', master)] + [(f[:-4], os.path.join(stems_dir, f)) for f in sorted(os.listdir(stems_dir)) if f.endswith('.wav')]
    print('%-12s' % 'stem' + ''.join('%9s' % n[:8] for n, _, _ in secs))
    for name, path in files:
        x, fs = read(path)
        row = []
        for n, b, l in secs:
            s0, s1 = int((b - 1) * bar * fs), int((b - 1 + l) * bar * fs)
            seg = x[s0:s1]
            if len(seg) == 0: row.append(float('nan')); continue
            ms = kms(seg, fs)
            row.append(-0.691 + 10 * math.log10(ms) if ms > 0 else float('-inf'))
        print('%-12s' % name[:12] + ''.join('%9.1f' % v for v in row))

if __name__ == '__main__':
    main()
