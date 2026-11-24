"""Per-section stem levels and band shares of a V2 render: python3 tools/v2sections.py RENDER_DIR"""
import sys, os, glob, json
from wavio import *
W = sys.argv[1].rstrip('/'); m = json.load(open(os.path.join(os.path.dirname(__file__), '..', 'v2', 'map.json')))
B = m['beatSeconds']; S = m['sections']; keys = list(S)
SECS = [(k, S[k], S[keys[i + 1]] if i + 1 < len(keys) else S[k] + 8) for i, k in enumerate(keys) if k != 'end']
stems = sorted(glob.glob(W + '/*.stems/*.wav'))
A = {os.path.basename(s)[:-4].split('-', 1)[-1] if os.path.basename(s)[2] == '-' else os.path.basename(s)[:-4]: read(s) for s in stems}
M = read(sorted(glob.glob(W + '/*.wav'))[0]); names = list(A)
print('%-12s' % 'section' + ''.join('%7s' % n[:6] for n in names) + '    MIX  <120Hz 120-500  >2kHz  mono-dB')
for sid, b0, b1 in SECS:
    i0, i1 = int(b0 * B * RATE), min(len(M), int(b1 * B * RATE)); seg = M[i0:i1]
    mono = seg.mean(axis=1); mono_change = db(rms(mono)) - db(rms(seg))
    print('%-12s' % sid + ''.join('%7.1f' % db(rms(A[n][i0:i1])) for n in names) + '%7.1f %6.1f%% %6.1f%% %6.1f%% %6.2f' % (db(rms(seg)), 100 * band_share(seg, 20, 120), 100 * band_share(seg, 120, 500), 100 * band_share(seg, 2000, 20000), mono_change))
