"""Per-section stem levels of an engine render of the beat: python3 tools/beatsections.py RENDER_DIR"""
import sys, os, glob
from wavio import *
W = sys.argv[1].rstrip('/'); BEAT = 0.681818
SECS = [('find', 0, 8), ('counterf1', 8, 24), ('counterf2', 24, 40), ('crossing', 40, 56), ('stop', 56, 60), ('shout', 60, 76), ('payment', 76, 86.5)]
stems = sorted(glob.glob(W + '/*.stems/*.wav'))
A = {os.path.basename(s)[3:-4] if os.path.basename(s)[2] == '-' else os.path.basename(s)[:-4]: read(s) for s in stems}
M = read(glob.glob(W + '/*.wav')[0])
names = list(A)
print('%-10s' % 'section' + ''.join('%7s' % n[:6] for n in names) + '    MIX  <150Hz  >2kHz')
for sid, b0, b1 in SECS:
    i0, i1 = int(b0 * BEAT * RATE), min(len(M), int(b1 * BEAT * RATE))
    print('%-10s' % sid + ''.join('%7.1f' % db(rms(A[n][i0:i1])) for n in names) + '%7.1f %6.1f%% %6.1f%%' % (db(rms(M[i0:i1])), 100 * band_share(M[i0:i1], 20, 150), 100 * band_share(M[i0:i1], 2000, 20000)))
