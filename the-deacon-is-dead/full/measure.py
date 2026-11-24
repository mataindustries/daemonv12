"""Measure a full-wake render: per section, each stem's RMS while it sounds, the mix RMS, the short-term loudness
(3 s, EBU R128) at the section's end, and the share of energy below 120 Hz.

    python3 the-deacon-is-dead/full/measure.py RENDER_DIR_OR_MASTER.wav [STEMS_DIR]
"""
import glob, json, os, re, subprocess, sys
import numpy as np
HERE = os.path.dirname(os.path.abspath(__file__)); sys.path.insert(0, os.path.join(os.path.dirname(HERE), 'tools'))
from wavio import read, RATE, db, rms, mono, band_share

arg = sys.argv[1]; BEAT = 0.625
mixf = arg if arg.endswith('.wav') else glob.glob(os.path.join(arg, '*.wav'))[0]
stemdir = sys.argv[2] if len(sys.argv) > 2 else (glob.glob(os.path.join(arg, '*.stems')) or [None])[0]
secs = json.load(open(os.path.join(HERE, 'sections.json')))
mix = read(mixf); end = len(mix) / RATE / BEAT
bounds = [(n, b, secs[i + 1][1] if i + 1 < len(secs) else end) for i, (n, b) in enumerate(secs)]
p = subprocess.run(['ffmpeg', '-hide_banner', '-nostats', '-i', mixf, '-af', 'ebur128', '-f', 'null', '-'], capture_output=True, text=True)
pts = [(float(m[1]), float(m[2])) for m in re.finditer(r't:\s*([\d.]+)\s+TARGET.*?S:\s*(-?[\d.]+|-inf)', p.stderr) if m[2] != '-inf']
short = lambda t: min(pts, key=lambda q: abs(q[0] - t))[1]
stems = sorted(glob.glob(os.path.join(stemdir, '*.wav'))) if stemdir else []
names = [os.path.basename(s)[:-4] for s in stems]; data = [mono(read(s)) for s in stems]
print('section          ' + ' '.join(f'{n[:6]:>6s}' for n in names) + '    mix  short  <120')
for name, a, e in bounds:
    i0, i1 = int(a * BEAT * RATE), min(int(e * BEAT * RATE), len(mix)); row = []
    for x in data:
        seg = x[i0:i1]; fr = [rms(seg[k:k + 2205]) for k in range(0, max(0, len(seg) - 2205), 2205)]
        live = [f for f in fr if f > 1e-3]
        row.append(f'{db(np.sqrt(np.mean(np.square(live)))):6.1f}' if live else '     -')
    seg = mix[i0:i1]
    print(f'{name:16s} ' + ' '.join(row) + f' {db(rms(mono(seg))):6.1f} {short(e * BEAT - 0.05):6.1f}  {band_share(seg, 20, 120):.2f}')
