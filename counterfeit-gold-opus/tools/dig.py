"""THE DIG: go through the printed record and write the chop notebook (beat/chops.json).

Only the master print is read (like a digger with the record and a tempo). Each chop is named by its position in the
record's own beats; the script finds the real onset near that position, starts the chop just before it on a zero
crossing, and records where the record's beat sits inside the chop (`leadSeconds`), so the production can put the
record's time, not the first transient, on its grid. Break hits are also ranked by how clean they are (energy in the
30 ms before the hit against the hit itself).

    python3 counterfeit-gold-opus/tools/dig.py
"""
import json, os, sys
import numpy as np
sys.path.insert(0, os.path.dirname(__file__))
from wavio import read, RATE, db, rms

HERE = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
PRINT = 'assets/record/the-velvet-hearse--two-coins-for-the-ferryman.wav'
BEAT_S = 0.573338          # usPerQuarter(104.650226) / 1e6: the record's beat as the rack played it
SWING = 0.56

x = read(os.path.join(HERE, PRINT)); mono = x.mean(axis=1); N = len(mono)

def swung(beat):
    s = beat * 4; k = round(s)
    return beat + (SWING - 0.5) * 0.5 if abs(s - k) < 1e-9 and k % 2 == 1 else beat

def t_of(beat):
    return swung(beat) * BEAT_S

HOP = 44     # ~1 ms
env = np.sqrt(np.convolve(mono ** 2, np.ones(HOP) / HOP, mode='same'))[::HOP]

def onset_near(t, win=0.03):
    """Time of the sharpest energy rise within +-win of t (1 ms resolution)."""
    i0, i1 = max(10, int((t - win) * RATE / HOP)), int((t + win) * RATE / HOP)
    best, bi = -1, i0
    for i in range(i0, i1):
        ref = env[i - 10:i - 2].mean() + 1e-6
        r = env[i:i + 3].mean() / ref
        if r > best: best, bi = r, i
    return bi * HOP / RATE, float(20 * np.log10(best))

def zero_cross_before(t, look=0.0015):
    i = int(t * RATE); j0 = max(1, i - int(look * RATE))
    for k in range(i, j0, -1):
        if mono[k - 1] <= 0 < mono[k] or mono[k - 1] >= 0 > mono[k]: return k / RATE
    return i / RATE

def chop(name, a, b, onset=True, pre=0.003, tail=0.0, role=''):
    tn = t_of(a); te = t_of(b) + tail
    if onset:
        to, rise = onset_near(tn)
        start = zero_cross_before(min(to, tn) - pre)
    else:
        to, rise, start = tn, 0.0, zero_cross_before(tn - pre)
    seg = mono[int(start * RATE):int(te * RATE)]
    return name, {'role': role, 'srcBeats': [a, b], 'offsetSeconds': round(max(0.0, start), 6), 'endSeconds': round(min(te, (N - 1) / RATE), 6),
                  'leadSeconds': round(tn - max(0.0, start), 6), 'onsetSeconds': round(to, 6), 'riseDb': round(rise, 1),
                  'peakDbfs': round(db(float(np.abs(seg).max())), 1) if len(seg) else None}

def hit(name, beat, length, role):
    n, c = chop(name, beat, beat + length, role=role)
    o = c['onsetSeconds']
    pre = mono[int((o - 0.03) * RATE):int((o - 0.001) * RATE)]; body = mono[int(o * RATE):int((o + 0.05) * RATE)]
    c['cleanDb'] = round(db(rms(body)) - db(rms(pre)), 1)
    return n, c

CHOPS = dict([
    # the record as found (head-a, no drum kit)
    chop('intro-head', 8.0, 16.0, role='head-a bars 1-2 straight: Fm9 coins and Eb, Db sigh'),
    chop('a-coins', 8.0, 10.5, role='head-a bar 1, beats 1-3: Fm9, the two coins, the scooped Eb'),
    chop('a-ferry', 20.0, 24.0, role='head-a bar 4: the Gb7#11, the ferryman C, E leading home, vibes fill'),
    chop('a-sigh', 2.5, 4.0, role='chime: Odile sighs one note over the bell'),
    chop('coins', 8.5, 8.98, role='the two coins alone (reed staccato C5 C5)'),
    chop('cry-oh', 15.75, 16.6, role='Odile, an "oh" that breaks upward'),
    # Odile's chorus
    chop('dedah', 48.5, 49.0, role='Odile sings the coins: "deh-dah"'),
    chop('scat', 56.0, 58.0, role='Odile scat run, eight sixteenths'),
    chop('scat-cry', 58.0, 59.5, role='Odile, the cry up to F5'),
    chop('fall', 60.0, 62.8, role='Odile, C5 falling a fourth'),
    # the crossing
    chop('seven', 67.5, 71.0, role='one 7/8 cycle: vibes riff, hands, log, bass, a breath'),
    chop('bark', 80.0, 81.3, role='reed bark and growl in the crossing'),
    chop('laser', 91.0, 92.0, role='the steel string chirping like a toy laser'),
    # stop
    chop('stab-1', 92.0, 92.7, role='tutti stab, Fm9'),
    chop('stab-2', 92.75, 93.6, role='tutti stab, Gb7#11'),
    chop('deacon', 94.0, 95.45, onset=False, pre=0.005, role='the Deacon alone: low F, plucked (cut 5 ms before his beat, not on the stab\'s room tail)'),
    # shout
    chop('s-coins', 96.0, 98.0, role='shout bar 1, beats 1-2: feral coins, bell, the band'),
    chop('s-ferry', 108.0, 112.0, role='shout bar 4: the overblown ferryman C over Gb7#11'),
    chop('overblow', 108.0, 110.25, role='the one overblown note'),
    chop('s-ferry-tail', 110.0, 112.0, role='shout bar 4, beats 3-4: the overblown C let go, Bb, Ab, E; the claps on the backbeat'),
    chop('swell-src', 96.0, 97.6, role='shout downbeat (bell and band), to be reversed'),
    # out
    chop('ferryman-end', 128.0, 131.0, role='the unresolved last hit: reed and voice fall a fifth, bass dives'),
    chop('bell', 0.0, 2.42, role='the viewing-room bell alone'),
    chop('bell-out', 131.0, 133.4, role='the last bell'),
    chop('tock', 4.0, 4.45, role='the viewing-room clock'),
    chop('breath-out', 134.25, 136.0, onset=False, pre=0.0, role="Odile's breath out"),
    # the break: every hit
    *[hit(f'kick-{i}', b, 0.45, 'break kick') for i, b in enumerate([24.0, 25.75, 26.5, 28.0, 29.5, 30.25])],
    *[hit(f'snare-{i}', b, 0.6, 'break snare') for i, b in enumerate([25.0, 27.0, 29.0, 30.75])],
    *[hit(f'hat-{i}', b, 0.22, 'break tick') for i, b in enumerate([24.5, 25.5, 26.0, 27.5, 28.5, 29.25, 30.0])],
    hit('conga-slap', 31.0, 0.24, 'conga slap'), hit('conga-open', 31.25, 0.24, 'conga open tone'),
    hit('conga-low', 31.5, 0.24, 'low conga open'), hit('conga-boom', 31.75, 0.5, 'low conga palm'),
])

out = {'print': PRINT, 'printFrames': N, 'recordBeatSeconds': BEAT_S, 'recordSwing': SWING,
       'note': 'offsetSeconds/endSeconds address the print; leadSeconds is how far the record\'s beat sits after the chop start (source seconds).',
       'chops': CHOPS}
os.makedirs(os.path.join(HERE, 'beat'), exist_ok=True)
with open(os.path.join(HERE, 'beat', 'chops.json'), 'w') as f: json.dump(out, f, indent=1)
for k, v in CHOPS.items():
    print('%-13s %6.2f-%6.2f  off %8.4f  lead %+5.1f ms  rise %5.1f dB%s' % (k, *v['srcBeats'], v['offsetSeconds'], 1000 * v['leadSeconds'], v['riseDb'],
          ('  clean %5.1f dB' % v['cleanDb']) if 'cleanDb' in v else ''))
