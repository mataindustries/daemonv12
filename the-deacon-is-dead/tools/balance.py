"""Per-section balance of a rack render: each stem's RMS (only while it sounds) and peak, and the mix RMS.

    python3 the-deacon-is-dead/tools/balance.py RENDER_DIR
"""
import json, os, sys
import numpy as np
sys.path.insert(0, os.path.dirname(__file__))
from wavio import read, RATE, db, rms, mono

root = sys.argv[1]
score = json.load(open(os.path.join(root, 'score.json')))
beat_s = round(60e6 / score['bpm']) / 1e6
secs, b = [], 0
for s in score['sections']: secs.append((s['id'], b, b + 4 * s['bars'])); b += 4 * s['bars']
stems = sorted(f[:-4] for f in os.listdir(os.path.join(root, 'stems')) if f.endswith('.wav'))
data = {s: read(os.path.join(root, 'stems', s + '.wav')) for s in stems}
mix = read(os.path.join(root, 'mix-context.wav'))
print('section   ' + ' '.join(f'{s[:7]:>8s}' for s in stems) + '      mix')
for sid, a, e in secs:
    i0, i1 = int(a * beat_s * RATE), int(e * beat_s * RATE)
    row = []
    for s in stems:
        x = mono(data[s][i0:i1]); hop = 2205
        frames = [rms(x[k:k + hop]) for k in range(0, len(x) - hop, hop)]
        live = [f for f in frames if f > 10 ** (-60 / 20)]
        row.append(f'{db(np.sqrt(np.mean(np.square(live)))):8.1f}' if live else '       -')
    print(f'{sid:9s} ' + ' '.join(row) + f'  {db(rms(mono(mix[i0:i1]))):7.1f}')
print('peak      ' + ' '.join(f'{db(np.abs(data[s]).max()):8.1f}' for s in stems) + f'  {db(np.abs(mix).max()):7.1f}')
