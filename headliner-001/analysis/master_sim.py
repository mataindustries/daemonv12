#!/usr/bin/env python3
"""Offline reproduction of the DaemonV12 master chain on a render's pre-master stems, for choosing master settings.

The engine sums track PCM (stems), applies master gain, then ordered master effects; FFmpeg effects receive
samples / 32768 as f64le with the filter strings from src/render/ffmpeg.ts; saturation is the engine's
(1-mix)*v + mix*32767*tanh(v/32768*10^(drive/20)). This tool mirrors that, measures true peak / integrated
loudness / LRA with FFmpeg, and prints a table. It decides nothing by itself; the chosen chain is rendered by the
engine and re-measured there.

usage: master_sim.py <stems-dir> <chain.json>   (chain.json: list of {"gainDb":g,"effects":[...]} candidates)
"""
import sys, os, json, wave, subprocess, tempfile, re
import numpy as np

def read(path):
    with wave.open(path, 'rb') as w:
        return np.frombuffer(w.readframes(w.getnframes()), dtype='<i2').astype(np.float64).reshape(-1, w.getnchannels())

def ff_filters(effects):
    out = []
    for e in effects:
        if e['type'] in ('highpass', 'lowpass'): out.append(f"{e['type']}=f={e['frequencyHz']}:p=2:r=f64")
        elif e['type'] == 'compressor':
            out.append(f"acompressor=threshold={10 ** (e['thresholdDb'] / 20)}:ratio={e['ratio']}:attack={e['attackMs']}:release={e['releaseMs']}:makeup={10 ** (e.get('makeupGainDb', 0) / 20)}:knee=1:link=maximum:detection=rms")
        else: raise ValueError(e)
    return ','.join(out)

def run_ffmpeg(x, filters):
    p = subprocess.run(['ffmpeg', '-hide_banner', '-nostdin', '-nostats', '-threads', '1', '-filter_threads', '1', '-f', 'f64le', '-ar', '44100', '-ac', '2',
                        '-i', 'pipe:0', '-af', filters, '-c:a', 'pcm_f64le', '-f', 'f64le', 'pipe:1'], input=(x / 32768).astype('<f8').tobytes(), capture_output=True, check=True)
    return np.frombuffer(p.stdout, dtype='<f8').reshape(-1, 2) * 32768

def chain(x, gain_db, effects):
    y = x * 10 ** (gain_db / 20); i = 0
    while i < len(effects):
        if effects[i]['type'] == 'saturation':
            e = effects[i]; d = 10 ** (e['driveDb'] / 20)
            y = y * (1 - e['mix']) + 32767 * np.tanh(y / 32768 * d) * e['mix']; i += 1
        else:
            j = i
            while j < len(effects) and effects[j]['type'] != 'saturation': j += 1
            y = run_ffmpeg(y, ff_filters(effects[i:j])); i = j
    return y

def measure(y):
    q = np.clip(np.round(y), -32768, 32767).astype('<i2')
    with tempfile.NamedTemporaryFile(suffix='.wav', delete=False) as f: path = f.name
    with wave.open(path, 'wb') as w: w.setnchannels(2); w.setsampwidth(2); w.setframerate(44100); w.writeframes(q.tobytes())
    p = subprocess.run(['ffmpeg', '-hide_banner', '-nostats', '-i', path, '-af', 'ebur128=peak=true', '-f', 'null', '-'], capture_output=True, text=True)
    os.unlink(path)
    s = p.stderr[p.stderr.rfind('Summary:'):]
    g = lambda k: float(re.search(k + r':\s+(-?[\d.]+)', s).group(1))
    peak = 20 * np.log10(np.max(np.abs(q)) / 32768)
    return {'I': g('I'), 'LRA': g('LRA'), 'TP': g('Peak'), 'peak': round(float(peak), 2), 'clip': int(np.sum(np.abs(np.round(y)) > 32767))}

def main():
    stems, cands = sys.argv[1], json.load(open(sys.argv[2]))
    files = [os.path.join(stems, f) for f in sorted(os.listdir(stems)) if f.endswith('.wav')]
    x = sum(read(f) for f in files)
    for c in cands:
        r = measure(chain(x, c['gainDb'], c['effects']))
        print(json.dumps({'chain': c.get('name', ''), **r}))

if __name__ == '__main__':
    main()
