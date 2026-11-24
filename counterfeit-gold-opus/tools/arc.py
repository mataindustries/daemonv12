"""Short-term loudness (EBU R128 S, 3 s window) at the end of each bar: python3 tools/arc.py RENDER.wav BPM"""
import re, subprocess, sys
wav, bpm = sys.argv[1], float(sys.argv[2]); B = 4 * round(60e6 / bpm) / 1e6
out = subprocess.run(['ffmpeg', '-nostdin', '-hide_banner', '-i', wav, '-af', 'ebur128=metadata=1,ametadata=print:key=lavfi.r128.S', '-f', 'null', '-'], capture_output=True, text=True).stderr
vals, t = [], 0.0
for line in out.splitlines():
    m = re.search(r'pts_time:([\d.]+)', line)
    if m: t = float(m.group(1))
    m = re.search(r'lavfi.r128.S=(\S+)', line)
    if m:
        try: vals.append((t, float(m.group(1))))
        except ValueError: vals.append((t, -99.0))
labels = dict(a.split('=') for a in sys.argv[3:]) if len(sys.argv) > 3 else {}
bar = 1
while (bar - 1) * B < vals[-1][0]:
    te = min(bar * B, vals[-1][0]); s = min(vals, key=lambda v: abs(v[0] - te))[1]
    print('%2d %5.1fs %-12s %6.1f %s' % (bar, (bar - 1) * B, labels.get(str(bar), ''), s, '#' * max(0, int(s + 40)) if s == s else ''))
    bar += 1
