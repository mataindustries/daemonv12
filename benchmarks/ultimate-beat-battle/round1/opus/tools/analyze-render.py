"""Inspect one DaemonV12 render of the Opus Round 1 project.

    python3 tools/analyze-render.py output/vN [--png analysis/vN] [--json analysis/vN/summary.json]

Reads the master, stems, project.render.json and project.analysis.json written by
`daemonv12 render --stems --format wav,mp3`. Prints section energy, band balance, stem
activity, stereo image, vox pitch accuracy and low-end checks; optionally writes PNGs
(stem-activity heatmap, master spectrogram/waveform via the pinned FFmpeg) and a JSON summary.
Analytical evidence only: this is not listening.
"""
import json, os, subprocess, sys, zlib, struct
sys.path.insert(0, os.path.dirname(__file__))
from audiolib import *

BPM = 140
BAR_S = 4 * 428571 / 1e6  # engine tempo: round(60e6/140) us per quarter
SECTIONS = [("intro (wall)", 1, 2), ("hook reveal", 3, 4), ("drop A", 5, 8), ("switch", 9, 10), ("build", 11, 12), ("drop B", 13, 15), ("ending", 16, 16)]


def png(path, rgb):
    h, w, _ = rgb.shape
    raw = b"".join(b"\x00" + rgb[y].astype(np.uint8).tobytes() for y in range(h))
    def chunk(t, d):
        return struct.pack(">I", len(d)) + t + d + struct.pack(">I", zlib.crc32(t + d) & 0xFFFFFFFF)
    with open(path, "wb") as f:
        f.write(b"\x89PNG\r\n\x1a\n" + chunk(b"IHDR", struct.pack(">IIBBBBB", w, h, 8, 2, 0, 0, 0)) + chunk(b"IDAT", zlib.compress(raw, 9)) + chunk(b"IEND", b""))


def heat(v):  # 0..1 -> inferno-ish RGB
    v = np.clip(v, 0, 1)
    r = np.clip(1.6 * v, 0, 1); g = np.clip(1.6 * v - 0.55, 0, 1); b = np.clip(0.5 - np.abs(v - 0.3) * 1.4, 0, 1) + np.clip(v - 0.85, 0, 1) * 4
    return (np.stack([r, g, np.clip(b, 0, 1)], -1) * 255)


def log_spectrogram(m, width=1400, rows=360, fmin=30.0, fmax=16000.0, nfft=4096, hop=256):
    """Own STFT -> log-frequency image (power averaged per row; nearest bin where a row is narrower
    than a bin). Replaces FFmpeg showspectrumpic, whose log mode draws a fixed bright row even on
    pink noise. Bar lines every 4/4 bar at 140 BPM; -90..-10 dB colour range."""
    win = np.hanning(nfft)
    frames = []
    for i in range(0, len(m) - nfft, hop):
        frames.append(np.abs(np.fft.rfft(m[i:i + nfft] * win)) ** 2)
    S = np.array(frames).T / (np.sum(win) ** 2 / 4)
    fr = np.fft.rfftfreq(nfft, 1 / SR)
    edges = fmin * (fmax / fmin) ** (np.arange(rows + 1) / rows)
    img = np.zeros((rows, S.shape[1]))
    for r in range(rows):
        sel = (fr >= edges[r]) & (fr < edges[r + 1])
        img[rows - 1 - r] = S[sel].mean(axis=0) if sel.any() else S[np.argmin(np.abs(fr - np.sqrt(edges[r] * edges[r + 1])))]
    cols = np.linspace(0, img.shape[1] - 1, width).astype(int)
    v = (10 * np.log10(img[:, cols] + 1e-14) + 90) / 80
    rgb = heat(v)
    for b in range(17):
        c = int(round(b * BAR_S * SR / hop / (img.shape[1] - 1) * (width - 1)))
        if 0 <= c < width:
            rgb[:, c] = [70, 70, 140]
    for f in (60, 120, 500, 2000, 6000):
        r = rows - 1 - int(np.log(f / fmin) / np.log(fmax / fmin) * rows)
        rgb[r, ::4] = [60, 160, 60]
    return rgb


def bar_slices(n, bars=17):
    out = []
    for b in range(bars):
        a, z = int(round(b * BAR_S * SR)), int(round((b + 1) * BAR_S * SR))
        if a < n:
            out.append((b + 1, a, min(z, n)))
    return out


def main():
    d = sys.argv[1]
    png_dir = sys.argv[sys.argv.index("--png") + 1] if "--png" in sys.argv else None
    json_out = sys.argv[sys.argv.index("--json") + 1] if "--json" in sys.argv else None
    man = json.load(open(os.path.join(d, "project.render.json")))
    ana = json.load(open(os.path.join(d, "project.analysis.json")))
    x, _ = read_wav(os.path.join(d, "project.wav"))
    m = mono(x)
    summary = {"master": ana["master"], "sections": {}, "bars": [], "stems": {}}
    am = ana["master"]
    print(f"MASTER  {am['durationSeconds']} s  LUFS {am['integratedLufs']}  LRA {am['loudnessRangeLu']}  TP {am['truePeakDbfs']}  peak {am['peakDbfs']:.2f}  RMS {am['rmsDbfs']:.2f}  clipped(master) {man['production']['master']['clippedSamples']}  preClipPeak {man['production']['master']['preClipPeakDbfs']}")
    clipped = {t['trackId']: t['clippedSamples'] for t in man['production']['tracks']}
    if any(clipped.values()):
        print("  CLIPPED TRACKS:", {k: v for k, v in clipped.items() if v})
    print(f"  stereo correlation {correlation(x):.3f}   centroid {centroid(x):.0f} Hz")
    b = band_shares(x)
    print("  band power: " + "  ".join(f"{k}:{100*v:.1f}%" for k, v in b.items()))
    summary["bandShares"] = b

    # per-bar master energy + bands
    print("\nBAR  rms_dB  sub<60  60-120  120-500  0.5-2k  2-6k  >6k   corr")
    for bar, a, z in bar_slices(len(m)):
        seg = x[a:z]
        bs = band_shares(seg, nfft=4096)
        sub = bs["0-30"] + bs["30-60"]
        row = dict(bar=bar, rms=float(db(rms(mono(seg)))), sub=sub, low=bs["60-120"], lowmid=bs["120-250"] + bs["250-500"], mid=bs["500-2000"], pres=bs["2000-6000"], air=bs["6000-12000"] + bs["12000-22050"], corr=correlation(seg))
        summary["bars"].append(row)
        print(f"{bar:3d}  {row['rms']:6.1f}  {100*sub:5.1f}  {100*row['low']:6.1f}  {100*row['lowmid']:6.1f}  {100*row['mid']:6.1f} {100*row['pres']:5.1f} {100*row['air']:5.1f}  {row['corr']:.2f}")
    for name, s, e in SECTIONS:
        a, z = int(round((s - 1) * BAR_S * SR)), int(round(e * BAR_S * SR))
        summary["sections"][name] = float(db(rms(m[a:z])))
    print("\nSECTION RMS: " + "  ".join(f"{k} {v:.1f}" for k, v in summary["sections"].items()))
    tail = m[int(round(16 * BAR_S * SR)):]
    print(f"after authored end ({16*BAR_S:.2f}s): rms {db(rms(tail)):.1f} dB, last 0.25 s rms {db(rms(m[-int(0.25*SR):])):.1f} dB")

    # stems
    stems = [(s['trackId'], os.path.join(d, s['wav']['file'])) for s in man['stems']]
    lufs = {t['trackId']: t['analysis'] for t in ana.get('tracks', [])}
    print("\nSTEM         LUFS    peak   corr  centroid  <120Hz  active-bars (rms > -45 dB)")
    act_rows = []
    for tid, path in stems:
        y, _ = read_wav(path)
        ym = mono(y)
        bars = [float(db(rms(ym[a:z]))) for _, a, z in bar_slices(len(ym))]
        active = [i + 1 for i, v in enumerate(bars) if v > -45]
        bs = band_shares(y, nfft=4096)
        la = lufs.get(tid, {})
        summary["stems"][tid] = dict(lufs=la.get('integratedLufs'), peak=la.get('peakDbfs'), corr=correlation(y), centroid=centroid(y), low=bs["30-60"] + bs["60-120"] + bs["0-30"], bars=bars)
        print(f"{tid:11s} {str(la.get('integratedLufs')):>6s} {la.get('peakDbfs', 0):6.1f}  {correlation(y):5.2f}  {centroid(y):7.0f}  {100*summary['stems'][tid]['low']:5.1f}%  {active}")
        hop = int(SR * BAR_S / 16)
        nb = len(ym) // hop
        e = db(np.sqrt(np.mean(ym[: nb * hop].reshape(nb, hop) ** 2, axis=1)))
        act_rows.append((tid, e))

    # vox pitch accuracy from trigger provenance
    trig = {t['trackId']: t for t in man['samples']['tracks']}
    for tid in ("vox", "vox-low", "vox-harm"):
        if tid not in trig:
            continue
        y, _ = read_wav(os.path.join(d, f"project.stems/{tid}.wav"))
        ym = mono(y)
        errs = []
        for t in trig[tid]['triggers']:
            pb = t.get('playback', {})
            if 'glide' in pb or 'breath' in t['file']:
                continue
            if pb.get('voiceFrames', 10 ** 9) < int(0.07 * SR) + 2048:
                continue  # chop ends before the probe window (e.g. 60 ms stutter slices)
            r = pb.get('rate', 1)
            want = 415.305 * r
            if 'da-x' in t['file']:
                continue  # 60 ms stutter slices end before any probe window
            best = None
            for off in (0.07, 0.12):  # two probes; keep the more periodic one (a decaying previous
                a = t["frame"] + int(off * SR)  # note can make the first probe lock to a subharmonic)
                seg = ym[a:a + 2048]
                if len(seg) == 2048:
                    f, q = pitch_yin(seg, fmin=80, fmax=1400)
                    if f and (best is None or q < best[1]):
                        best = (f, q)
            if best is None:
                continue
            f0, ap = best
            if f0 and ap < 0.35:
                c = 1200 * np.log2(f0 / want)
                c = (c + 600) % 1200 - 600  # octave errors fold
                errs.append(c)
        if errs:
            errs = np.array(errs)
            print(f"\n{tid}: pitch check on {len(errs)} chops: median {np.median(errs):+.1f} c, |err|<30c {np.mean(np.abs(errs) < 30)*100:.0f}%, worst {errs[np.argmax(np.abs(errs))]:+.0f} c")
            summary.setdefault("voxPitch", {})[tid] = dict(n=int(len(errs)), median=float(np.median(errs)), within30=float(np.mean(np.abs(errs) < 30)))

    if png_dir:
        os.makedirs(png_dir, exist_ok=True)
        cols = max(len(e) for _, e in act_rows)
        img = np.zeros((len(act_rows) * 14 + 6, cols * 3, 3))
        for i, (tid, e) in enumerate(act_rows):
            v = (np.pad(e, (0, cols - len(e)), constant_values=-120) + 60) / 50
            img[i * 14 + 3: i * 14 + 15, :] = np.repeat(heat(v), 3, axis=0)[None, :, :].repeat(12, axis=0) if False else np.repeat(heat(v)[None, :, :], 12, axis=0).repeat(3, axis=1)
        for bar in range(17):  # bar lines
            c = bar * 16 * 3
            if c < img.shape[1]:
                img[:, c] = [90, 90, 160]
        png(os.path.join(png_dir, "stem-activity.png"), img)
        png(os.path.join(png_dir, "master-spectrogram.png"), log_spectrogram(mono(x)))
        ff = os.environ.get("DAEMONV12_FFMPEG", "ffmpeg")
        subprocess.run([ff, "-hide_banner", "-loglevel", "error", "-y", "-i", os.path.join(d, "project.wav"), "-lavfi", "showwavespic=s=1400x300:split_channels=1:colors=0x4fc3f7|0xffb74d", os.path.join(png_dir, "master-waveform.png")], check=True)
        print("\nPNG:", sorted(os.listdir(png_dir)), "  heatmap rows:", [t for t, _ in act_rows])
    if json_out:
        os.makedirs(os.path.dirname(json_out), exist_ok=True)
        json.dump(summary, open(json_out, "w"), indent=1)


if __name__ == "__main__":
    main()
