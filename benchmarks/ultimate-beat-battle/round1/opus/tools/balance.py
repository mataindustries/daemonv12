"""Mix-balance view of a render: third-octave spectrum + slope per section, and group (bus) loudness.

    python3 tools/balance.py output/vN

Groups are summed from the exported stems (stems exclude master processing). Loudness uses the
pinned FFmpeg ebur128 filter on the summed group PCM written to a scratch WAV under output/.
"""
import os, subprocess, sys, json, re, struct
sys.path.insert(0, os.path.dirname(__file__))
from audiolib import *

BAR_S = 4 * 428571 / 1e6
GROUPS = {
    "bass": ["bass-a", "bass-b", "bass-c"],
    "drums": ["kick", "clap", "hats", "drums-far"],
    "vox": ["vox", "vox-low", "vox-harm"],
    "keys": ["keys", "keys-far", "choir"],
    "glass": ["glass", "glass-fx"],
}
SECTIONS = [("intro", 1, 4), ("dropA", 5, 8), ("switch", 9, 10), ("build", 11, 12), ("dropB", 13, 15)]


def write_wav(path, x):
    pcm = np.clip(np.round(x * 32768), -32768, 32767).astype("<i2").tobytes()
    with open(path, "wb") as f:
        f.write(b"RIFF" + struct.pack("<I", 36 + len(pcm)) + b"WAVEfmt " + struct.pack("<IHHIIHH", 16, 1, 2, SR, SR * 4, 4, 16) + b"data" + struct.pack("<I", len(pcm)) + pcm)


def lufs(path, start, end):
    ff = os.environ.get("DAEMONV12_FFMPEG", "ffmpeg")
    out = subprocess.run([ff, "-hide_banner", "-nostats", "-ss", str(start), "-to", str(end), "-i", path, "-af", "ebur128=peak=true", "-f", "null", "-"], capture_output=True, text=True).stderr
    m = re.findall(r"I:\s+(-?[\d.]+) LUFS", out)
    return float(m[-1]) if m else None


def third_octave(x):
    m = mono(x)
    nfft = 16384
    win = np.hanning(nfft)
    acc = np.zeros(nfft // 2 + 1)
    for i in range(0, len(m) - nfft, nfft // 2):
        acc += np.abs(np.fft.rfft(m[i:i + nfft] * win)) ** 2
    fr = np.fft.rfftfreq(nfft, 1 / SR)
    centers = 1000 * 2 ** (np.arange(-17, 14) / 3)  # 20 Hz .. 20 kHz
    lv = []
    for c in centers:
        sel = (fr >= c / 2 ** (1 / 6)) & (fr < c * 2 ** (1 / 6))
        lv.append(10 * np.log10(acc[sel].sum() + 1e-20))
    lv = np.array(lv)
    return centers, lv - lv.max()


def main():
    d = sys.argv[1]
    x, _ = read_wav(os.path.join(d, "project.wav"))
    print("THIRD-OCTAVE (dB re loudest band), slope = least-squares dB/oct over 100 Hz-10 kHz")
    hdr = None
    for name, s, e in SECTIONS:
        a, z = int((s - 1) * BAR_S * SR), int(e * BAR_S * SR)
        c, lv = third_octave(x[a:z])
        sel = (c >= 100) & (c <= 10000)
        slope = np.polyfit(np.log2(c[sel]), lv[sel], 1)[0]
        picks = [31.5, 63, 125, 250, 500, 1000, 2000, 4000, 8000, 12500]
        idx = [int(np.argmin(np.abs(c - p))) for p in picks]
        if hdr is None:
            hdr = "         " + " ".join(f"{p:>6g}" for p in picks) + "   slope"
            print(hdr)
        print(f"{name:8s} " + " ".join(f"{lv[i]:6.1f}" for i in idx) + f"   {slope:5.2f}")
    tmp = os.path.join(os.path.dirname(os.path.abspath(d)), "_scratch-groups", os.path.basename(os.path.abspath(d)))  # never inside the render dir
    os.makedirs(tmp, exist_ok=True)
    print("\nGROUP LUFS per section (stems summed; pre-master)")
    print("group    " + " ".join(f"{n:>8s}" for n, _, _ in SECTIONS))
    for g, members in GROUPS.items():
        acc = None
        for mbr in members:
            p = os.path.join(d, "project.stems", f"{mbr}.wav")
            if os.path.exists(p):
                y, _ = read_wav(p)
                acc = y if acc is None else acc + y
        if acc is None:
            continue
        path = os.path.join(tmp, f"{g}.wav")
        write_wav(path, acc)
        vals = []
        for n, s, e in SECTIONS:
            v = lufs(path, (s - 1) * BAR_S, e * BAR_S)
            vals.append(f"{v:8.1f}" if v is not None and v > -70 else "       -")
        print(f"{g:8s} " + " ".join(vals))


if __name__ == "__main__":
    main()
