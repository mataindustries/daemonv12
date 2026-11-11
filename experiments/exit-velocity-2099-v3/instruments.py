"""Original synthesis instruments for EXIT VELOCITY // 2099 V3.

No samples: deterministic oscillators and seeded noise. All functions return mono
float32 audio at SR; pitched instruments include their release after `dur`.
Velocity controls amplitude and brightness, not just gain. Instruments are
rendered independently so arrangements can resample or pan them freely.
"""
import numpy as np
from scipy import signal

SR = 48000


def _time(d):
    return np.arange(max(1, int(round(d * SR))), dtype=np.float64) / SR


def _phase(freq, t, cents=0):
    return 2 * np.pi * np.cumsum(np.broadcast_to(freq, t.shape) * (2 ** (cents / 1200))) / SR


def _env(t, dur, attack=0.008, release=0.12):
    on = np.minimum(1., t / attack)
    off = np.exp(-np.maximum(0., t - dur) * (6.9 / release))
    return on * off


def _soft(x, amount=1.2):
    return np.tanh(amount * x) / np.tanh(amount)


def rubber(freq, dur, velocity=1.0):
    """Elastic, pitch-bent phase-distortion pluck; dur is held-note length."""
    t = _time(dur + 0.18)
    # Tiny attack scoop and falling modulation index give a hand-plucked edge.
    f = freq * (1 + 0.016 * np.exp(-t / .028))
    ph = _phase(f, t)
    index = (1.05 + .5 * velocity) * np.exp(-t / .19) + .17
    # PM on a triangle-like core, with a second harmonic that closes on release.
    carrier = np.sin(ph + index * np.sin(ph * 2 + .15))
    body = np.sin(ph) * .38 + .14 * np.sin(ph * 2) * np.exp(-t / .10)
    click = np.sin(ph * 5.01) * np.exp(-t / .012) * .16
    env = _env(t, dur, .003, .18) * (.65 + .35 * np.exp(-t / .22))
    return (velocity * .55 * _soft(carrier * .65 + body + click) * env).astype(np.float32)


def bass(freq, dur, velocity=1.0):
    """Vowel-moving mono bass, with a stable sine foundation and short release."""
    t = _time(dur + .10)
    ph = _phase(freq * (1 + .005 * np.exp(-t / .025)), t)
    # Evolving harmonic weights give a rounded /ow/ formant while leaving the
    # fundamental predictable. Non-integer near-formant partials are avoided.
    vowel = .5 + .5 * np.sin(2 * np.pi * 1.8 * t + .3)
    upper = sum((1 / k) * np.sin(k * ph + .12 * np.sin(2*np.pi*.8*t)) *
                np.exp(-((k * freq - (500 + 460*vowel)) / 450)**2)
                for k in range(2, 14))
    sub = np.sin(ph)
    tone = _soft(.9*sub + (.8 + .35*velocity)*upper, 1.3)
    env = _env(t, dur, .006, .10) * (.83 + .17*np.exp(-t/.12))
    return (velocity * .56 * tone * env).astype(np.float32)


def glass(freq, dur, velocity=1.0):
    """Struck resonator with controlled inharmonicity and tuned fundamental."""
    t = _time(dur + .55)
    # A gently inharmonic bell overtone stack, damped in order of brightness.
    partials = [(1,1,.85), (2.004,.43,.34), (3.012,.18,.20),
                (4.07,.12,.11), (5.43,.07,.07)]
    x = sum(a*np.sin(2*np.pi*freq*r*t + .11*r) * np.exp(-t/tau)
            for r,a,tau in partials)
    # A short mallet tap, deterministic for identical notes.
    rng = np.random.default_rng(int(freq * 19) % (2**32))
    noise = signal.lfilter([1, -.93], [1], rng.standard_normal(len(t)))
    x += .06*noise*np.exp(-t/.006)
    x *= np.minimum(1, t/.0015) * np.exp(-np.maximum(0,t-dur)*5)
    return (velocity * .48 * _soft(x)).astype(np.float32)


def reed(freq, dur, velocity=1.0):
    """Synthetic breathy reed with a talking resonant spectrum."""
    t = _time(dur + .14)
    f = freq*(1 + .006*np.exp(-t/.045) + .002*np.sin(2*np.pi*5.2*t))
    ph = _phase(f,t)
    vowel = .5 + .5*np.sin(2*np.pi*1.15*t)
    x = np.zeros_like(t)
    for k in range(1, 15):
        amplitude = (1/k) * (.20 + np.exp(-((k*freq-(850+650*vowel))/550)**2))
        x += amplitude*np.sin(k*ph)
    rng = np.random.default_rng(int(freq*23) % (2**32))
    breath = signal.lfilter([1,-.96],[1],rng.standard_normal(len(t)))
    x += .025*breath
    env = _env(t,dur,.014,.14)
    return (velocity*.40*_soft(x,1.1)*env).astype(np.float32)


def kick(velocity=1.0):
    """Tuned, short kick with an acoustic-like beater and clean sub tail."""
    t = _time(.48)
    f = 47 + 130*np.exp(-t/.018)
    ph = _phase(f,t)
    body = np.sin(ph)*np.exp(-t/.125)
    rng = np.random.default_rng(183)
    click = rng.standard_normal(len(t))*np.exp(-t/.003)
    x = _soft(body*1.12 + .12*click, 1.25)
    x *= np.minimum(1,t/.0008)*np.exp(-np.maximum(0,t-.28)*24)
    return (velocity*.76*x).astype(np.float32)


def snare(velocity=1.0, seed=19):
    """Dry synthetic skin plus short noisy wire; no external samples."""
    t = _time(.28)
    rng = np.random.default_rng(seed)
    noise = rng.standard_normal(len(t))
    sos = signal.butter(2, [900, 8500], btype='bandpass', fs=SR, output='sos')
    wire = signal.sosfilt(sos, noise)*np.exp(-t/.058)
    skin = (np.sin(2*np.pi*185*t) + .48*np.sin(2*np.pi*287*t))*np.exp(-t/.045)
    x = _soft(.8*wire + .43*skin, 1.3)
    x *= np.minimum(1,t/.001)
    return (velocity*.54*x).astype(np.float32)


def rim(velocity=1.0, seed=73):
    """Short woody rim hit with a metallic edge."""
    t = _time(.09)
    rng = np.random.default_rng(seed)
    noise = rng.standard_normal(len(t))*np.exp(-t/.0025)
    body = (np.sin(2*np.pi*880*t) + .62*np.sin(2*np.pi*1620*t))*np.exp(-t/.012)
    return (velocity*.43*_soft(.75*body + .22*noise)*np.minimum(1,t/.0006)).astype(np.float32)


def hat(velocity=1.0, seed=42, open_hat=False):
    """Bright but damped metallic hat with independently seeded noise."""
    duration = .20 if open_hat else .075
    t = _time(duration)
    rng = np.random.default_rng(seed)
    noise = rng.standard_normal(len(t))
    sos = signal.butter(2, 5600, btype='highpass', fs=SR, output='sos')
    hiss = signal.sosfilt(sos,noise)
    metal = sum(np.sin(2*np.pi*f*t) for f in (6311, 7883, 9011))/3
    decay = .065 if open_hat else .014
    x = (.75*hiss + .25*metal)*np.exp(-t/decay)*np.minimum(1,t/.0007)
    return (velocity*.22*x).astype(np.float32)
