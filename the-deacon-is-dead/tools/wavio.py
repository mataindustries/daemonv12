"""PCM16/PCM24 WAV reading and small analysis helpers for THE DEACON IS DEAD (numpy only)."""
import struct, numpy as np
RATE = 44100

def read(path):
    b = open(path, 'rb').read()
    assert b[:4] == b'RIFF' and b[8:12] == b'WAVE', path
    p, ch, data, bits = 12, None, None, 16
    while p + 8 <= len(b):
        cid, size = b[p:p+4], struct.unpack('<I', b[p+4:p+8])[0]
        if cid == b'fmt ':
            fmt, ch, rate = struct.unpack('<HHI', b[p+8:p+16]); bits = struct.unpack('<H', b[p+22:p+24])[0]
            assert fmt == 1 and rate == RATE and bits in (16, 24), (path, fmt, rate, bits)
        elif cid == b'data':
            if bits == 16: data = np.frombuffer(b[p+8:p+8+size], dtype='<i2').astype(np.float64) / 32768.0
            else:
                raw = np.frombuffer(b[p+8:p+8+size], dtype=np.uint8).reshape(-1, 3).astype(np.int32)
                v = raw[:, 0] | (raw[:, 1] << 8) | (raw[:, 2] << 16); v = np.where(v >= 1 << 23, v - (1 << 24), v)
                data = v.astype(np.float64) / 8388608.0
        p += 8 + size + (size & 1)
    return data.reshape(-1, ch)

def db(x):
    return 20 * np.log10(max(float(x), 1e-9))

def rms(x):
    return float(np.sqrt(np.mean(x ** 2))) if len(x) else 0.0

def mono(x):
    return x.mean(axis=1) if x.ndim > 1 else x

def centroid(x):
    m = mono(x)
    if len(m) < 2048: return 0.0
    spec = np.abs(np.fft.rfft(m * np.hanning(len(m))))
    f = np.fft.rfftfreq(len(m), 1 / RATE)
    return float((spec * f).sum() / max(spec.sum(), 1e-12))

def band_share(x, lo, hi):
    m = mono(x)
    spec = np.abs(np.fft.rfft(m)) ** 2
    f = np.fft.rfftfreq(len(m), 1 / RATE)
    return float(spec[(f >= lo) & (f < hi)].sum() / max(spec.sum(), 1e-12))
