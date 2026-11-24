"""Short-term loudness (EBU R128, 3 s window) at the end of each production section, plus the drop's jump.

    python3 the-deacon-is-dead/tools/arc.py AUDIO.wav
"""
import re, subprocess, sys
wav = sys.argv[1]; BEAT = 0.625
SECS = [('viewing', 8), ('wake-1', 16), ('wake-2', 24), ('wake-3', 32), ('odile', 40), ('steps', 56), ('knock', 60), ('back-1', 68), ('back-2', 76), ('back-3', 84), ('closed', 92)]
p = subprocess.run(['ffmpeg', '-hide_banner', '-nostats', '-i', wav, '-af', 'ebur128', '-f', 'null', '-'], capture_output=True, text=True)
pts = [(float(m[1]), float(m[2])) for m in re.finditer(r't:\s*([\d.]+)\s+TARGET.*?S:\s*(-?[\d.]+|-inf)', p.stderr) if m[2] != '-inf']
at = lambda t: min(pts, key=lambda q: abs(q[0] - t))[1]
print('  '.join(f'{n} {at(b * BEAT - 0.05):.1f}' for n, b in SECS))
print(f'drop: 1.5 s before {at(59.9 * BEAT):.1f} -> 1.5 s after {at(62.4 * BEAT):.1f} LUFS (short-term)')
