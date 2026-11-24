"""Per-section balance of a production render: each stem's RMS while it sounds, the mix's RMS and short-term peak,
and the share of energy below 120 Hz.

    python3 the-deacon-is-dead/tools/beatbalance.py RENDER_DIR
"""
import glob, os, sys
import numpy as np
sys.path.insert(0, os.path.dirname(__file__))
from wavio import read, RATE, db, rms, mono, band_share

root = sys.argv[1]; BEAT = 0.625
SECS = [('viewing', 0, 8), ('wake-1', 8, 16), ('wake-2', 16, 24), ('wake-3', 24, 32), ('odile', 32, 40), ('steps', 40, 56),
        ('knock', 56, 60), ('back-1', 60, 68), ('back-2', 68, 76), ('back-3', 76, 84), ('closed', 84, 93.6)]
mixf = glob.glob(os.path.join(root, '*.wav'))[0]
stems = sorted(glob.glob(os.path.join(root, '*.stems', '*.wav')))
names = [os.path.basename(s)[:-4] for s in stems]
data = [mono(read(s)) for s in stems]; mix = read(mixf)
print('section  ' + ' '.join(f'{n[:6]:>7s}' for n in names) + '     mix   <120Hz')
for sid, a, e in SECS:
    i0, i1 = int(a * BEAT * RATE), min(int(e * BEAT * RATE), len(mix))
    row = []
    for x in data:
        seg = x[i0:i1]; hop = 2205
        fr = [rms(seg[k:k + hop]) for k in range(0, len(seg) - hop, hop)]
        live = [f for f in fr if f > 10 ** (-60 / 20)]
        row.append(f'{db(np.sqrt(np.mean(np.square(live)))):7.1f}' if live else '      -')
    m = mix[i0:i1]
    print(f'{sid:8s} ' + ' '.join(row) + f'  {db(rms(mono(m))):6.1f}   {band_share(m, 20, 120):.2f}')
