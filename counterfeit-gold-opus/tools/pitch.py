"""Fundamental estimate (YIN-style difference function) of a mono window."""
import numpy as np
from wavio import RATE
def f0(x, fmin=40, fmax=1500):
    m = x.mean(axis=1) if x.ndim > 1 else x
    m = m - m.mean(); n = len(m); tmax = int(RATE / fmin); tmin = int(RATE / fmax)
    w = n - tmax
    if w < 256: return 0.0
    d = np.array([np.sum((m[:w] - m[t:t + w]) ** 2) for t in range(tmax + 1)])
    cm = d.copy(); cm[1:] = d[1:] * np.arange(1, tmax + 1) / np.maximum(np.cumsum(d[1:]), 1e-12); cm[0] = 1
    idx = [t for t in range(tmin, tmax) if cm[t] < 0.15 and cm[t] <= cm[t - 1] and cm[t] <= cm[t + 1]]
    t = idx[0] if idx else tmin + int(np.argmin(cm[tmin:tmax]))
    a, b, c = cm[t - 1], cm[t], cm[t + 1]; den = a - 2 * b + c
    return RATE / (t + (0.5 * (a - c) / den if den else 0))
def cents(hz, midi):
    return 1200 * np.log2(hz / (440 * 2 ** ((midi - 69) / 12))) if hz > 0 else float('nan')
