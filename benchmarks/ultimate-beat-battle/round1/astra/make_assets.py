"""Small deterministic source voices; no audio is arranged outside DaemonV12."""
from pathlib import Path
import hashlib
import json
import shutil
import wave
import numpy as np
from scipy.signal import butter, sosfilt

ROOT = Path(__file__).resolve().parent
REPO = ROOT.parents[3]
ASSETS = ROOT / 'assets'
SR = 44100
SEED = 601138
rng = np.random.default_rng(SEED)
catalog = []

def write(name, x, peak_db, recipe, fundamental=None):
    x = sosfilt(butter(2, 24, 'highpass', fs=SR, output='sos'), x)
    n = min(len(x), int(.018 * SR))
    x[-n:] *= np.linspace(1, 0, n) ** 2
    x *= 10 ** (peak_db/20) / np.max(np.abs(x))
    q = np.floor(x*32767 + .5).clip(-32768, 32767).astype('<i2')
    path = ASSETS / name
    with wave.open(str(path), 'wb') as w:
        w.setparams((1, 2, SR, len(q), 'NONE', 'not compressed'))
        w.writeframes(q.tobytes())
    catalog.append(dict(file='assets/'+name, origin='benchmark-only synthesis',
                        frames=len(q), seconds=len(q)/SR, sample_rate=SR, channels=1,
                        bits=16, peak_target_dbfs=peak_db, fundamental_hz=fundamental,
                        seed=SEED, recipe=recipe, sha256=hashlib.sha256(path.read_bytes()).hexdigest()))

ASSETS.mkdir(exist_ok=True)
f0 = 440 * 2**((62-69)/12)
t = np.arange(round(.46*SR))/SR
phase = 2*np.pi*f0*(t + .025*.009*(1-np.exp(-t/.009)))
reed = np.zeros_like(t)
for h in range(1, 35):
    core = .70 / h**1.45
    moving_formant = .28*np.exp(-.5*((h*f0-(730+1120*np.exp(-t/.045)))/280)**2)
    upper_formant = .05*np.exp(-.5*((h*f0-2650)/430)**2)
    reed += (core + moving_formant + upper_formant)*np.sin(h*phase+.055*h*np.exp(-t/.025))
reed += .018*rng.standard_normal(len(t))*np.exp(-t/.006)
reed *= (1-np.exp(-t/.0018))*np.exp(-t/.135)
write('rubber-reed-d4.wav', reed, -6,
      'D4 additive reed: 34 harmonic partials, a 1850-to-730 Hz falling formant, restrained 2650 Hz second formant, 2.5% 9 ms pitch settle, 1.8 ms attack, 135 ms amplitude decay, seeded 6 ms breath transient.', f0)

f0 = 440 * 2**((38-69)/12)
t = np.arange(round(.58*SR))/SR
phase = 2*np.pi*f0*(t+.07*.014*(1-np.exp(-t/.014)))
bass = np.sin(phase)
for h, level in [(2,.22),(3,.11),(4,.035),(5,.015)]:
    bass += level*np.sin(h*phase)*np.exp(-t/.15)
bass *= (1-np.exp(-t/.0035))*np.exp(-t/.22)
write('pocket-bass-d2.wav', bass, -5,
      'D2 sine body with 22%, 11%, 3.5%, 1.5% partials 2–5, 7% 14 ms pitch settle, 3.5 ms attack, 220 ms decay. Higher harmonics decay faster; mono.', f0)

t = np.arange(round(.24*SR))/SR
phase = 2*np.pi*(49*t + 100*.020*(1-np.exp(-t/.020)))
kick = np.sin(phase)*(1-np.exp(-t/.0007))*np.exp(-t/.054)
kick += .16*np.sin(2*np.pi*185*t)*np.exp(-t/.012)
noise = sosfilt(butter(2, [1700,6000], 'bandpass', fs=SR, output='sos'),rng.standard_normal(len(t)))
kick += .14*noise*np.exp(-t/.0024)
write('heel-kick.wav', kick, -5,
      '149-to-49 Hz analytic pitch drop (20 ms time constant), 54 ms body decay, 185 Hz 12 ms knock, seeded 2.4 ms band-passed click, mono.')

copies = [
    ('examples/assets/glasshouse/08-chrome-clap.wav','chrome-clap.wav'),
    ('examples/assets/glasshouse/09-pixel-hat.wav','pixel-hat.wav'),
    ('examples/assets/orbital-foundry/04-machine-tick.wav','machine-tick.wav'),
]
for source, name in copies:
    src = REPO/source
    dst = ASSETS/name
    shutil.copyfile(src,dst)
    catalog.append(dict(file='assets/'+name, origin='unaltered checked-in CC0 asset',
                        source=source, sha256=hashlib.sha256(dst.read_bytes()).hexdigest()))
for source, name in [('examples/assets/glasshouse/LICENSE','LICENSE-glasshouse'),
                     ('examples/assets/orbital-foundry/LICENSE','LICENSE-orbital-foundry')]:
    shutil.copyfile(REPO/source,ASSETS/name)
(ROOT/'assets-manifest.json').write_text(json.dumps(dict(seed=SEED,
    synthesis='Python/NumPy float64, SciPy SOS filters; 24 Hz high-pass, 18 ms endpoint taper, peak scaling, explicit floor(x*32767+0.5), PCM16. Reproducible in this recorded environment; asset hashes pin the portable sources.',
    sounds=catalog),indent=2)+'\n')
print(json.dumps({'sources':len(catalog),'total_wav_bytes':sum(p.stat().st_size for p in ASSETS.glob('*.wav'))}))
