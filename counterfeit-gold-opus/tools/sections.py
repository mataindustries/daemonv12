"""Per-section stem levels of a rack render: python3 tools/sections.py RENDER_DIR SCORE.json"""
import sys, json
from wavio import *
W, S = sys.argv[1].rstrip('/') + '/', sys.argv[2]
sc = json.load(open(S)); bs = round(60e6 / sc['bpm']) / 1e6
secs, b = [], 0
for s in sc['sections']:
    secs.append((s['id'], b * 4 * bs, (b + s['bars']) * 4 * bs)); b += s['bars']
stems = [p['id'] for p in sc['parts']] + ['room']
A = {s: read(W + 'stems/' + s + '.wav') for s in stems}
M = read(W + 'mix-context.wav')
print('%-9s' % 'section' + ''.join('%7s' % s[:6] for s in stems) + '    MIX  <150Hz  >2kHz')
for sid, t0, t1 in secs:
    i0, i1 = int(t0 * RATE), int(t1 * RATE)
    print('%-9s' % sid + ''.join('%7.1f' % db(rms(A[s][i0:i1])) for s in stems) + '%7.1f %6.1f%% %6.1f%%' % (db(rms(M[i0:i1])), 100 * band_share(M[i0:i1], 20, 150), 100 * band_share(M[i0:i1], 2000, 20000)))
