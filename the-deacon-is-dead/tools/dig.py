"""THE DIG: go through the printed record and write the chop notebook (production/chops.json).

Only the print and the record's tempo and swing are read, as a digger would have them. Each chop is named for what is
in it and addressed by the record's own beats. The script finds the real onset near that beat (the sharpest energy
rise within 30 ms), starts the chop on a zero crossing just before it, and records where the record's beat sits inside
the chop (`leadSeconds`), so the production can put the record's time, not the first transient, on its grid.
Single hits are also scored for cleanliness (energy in the 30 ms before the hit against the hit itself).

    python3 the-deacon-is-dead/tools/dig.py
"""
import json, os, sys
import numpy as np
sys.path.insert(0, os.path.dirname(__file__))
from wavio import read, RATE, db, rms

HERE = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
PRINT = 'assets/record/the-velvet-hearse--the-deacon-is-dead.wav'
BEAT_S = 0.51271           # usPerQuarter(117.025311) / 1e6: the record's beat as the rack played it
SWING = 0.54

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
    start = max(0.0, start)
    seg = mono[int(start * RATE):int(te * RATE)]
    return name, {'role': role, 'srcBeats': [a, b], 'offsetSeconds': round(max(0.0, start), 6), 'endSeconds': round(min(te, (N - 1) / RATE), 6),
                  'leadSeconds': round(tn - max(0.0, start), 6), 'onsetSeconds': round(to, 6), 'riseDb': round(rise, 1),
                  'peakDbfs': round(db(float(np.abs(seg).max())), 1) if len(seg) else None}

def hit(name, beat, length, role, **kw):
    n, c = chop(name, beat, beat + length, role=role, **kw)
    o = c['onsetSeconds']
    pre = mono[int((o - 0.03) * RATE):int((o - 0.001) * RATE)]; body = mono[int(o * RATE):int((o + 0.05) * RATE)]
    c['cleanDb'] = round(db(rms(body)) - db(rms(pre)), 1)
    return n, c

CHOPS = dict([
    # lid: the house and the objects, one at a time
    chop('door-lid', 0.0, 1.9, onset=False, role='the preparation-room door creaks open (bowed hinge, bite)'),
    hit('knock-1', 2.5, 0.45, "Iggy's first knock on the lid (A, dry)"),
    hit('knock-2', 3.0, 0.45, "Iggy's second knock"),
    hit('knock-3', 3.5, 0.48, "Iggy's third knock"),
    hit('boing-0', 4.0, 1.95, 'the hearse spring alone: twang on the tonic, A1'),
    hit('boing-4', 6.0, 0.95, 'the hearse spring again: twang four steps up (a fifth 16 cents flat), over the first one\'s tail'),
    hit('whoop', 7.0, 0.45, 'the urn alone: a whoop up to the neutral third'),
    hit('thud', 7.5, 0.45, 'the urn alone: palm thud'),
    chop('lik-pick', 10.25, 12.0, role='the likembe picks up (its first note is clean)'),
    # thumb: the likembe alone
    chop('thumb-a', 12.0, 16.0, role='the likembe alone, one bar on the tonic: the ostinato'),
    chop('thumb-b', 16.0, 18.5, role='the likembe bar that stops for the knocks (before them)'),
    # the break: single hits
    hit('kick', 52.0, 0.24, 'break: urn palm thud (the kick)'),
    hit('kick-2', 54.5, 0.24, 'break: urn palm thud, softer'),
    hit('snare', 53.0, 0.7, 'break: bead snare slap'),
    hit('snare-2', 55.0, 0.45, 'break: bead snare slap, second'),
    hit('tap', 55.75, 0.24, 'break: bead tap (ghost)'),
    hit('coins', 52.25, 0.22, 'break: one shake of the collection plate'),
    hit('rim', 52.5, 0.24, 'break: the coffin rail (rim click)'),
    chop('scrape', 57.5, 58.45, role='break: a stick dragged along the coffin panels (guiro)'),
    # odile: the friction drum
    chop('odile-ab', 60.0, 68.0, role='odile bars 1-2 as found: the friction drum talking over likembe, spring and urn (root 3)'),
    chop('wee', 60.0, 60.7, role='Odile: "wee" (rub bent up)'),
    chop('hihi', 60.75, 61.45, role='Odile: two quick squeaks'),
    chop('ooo', 61.5, 62.5, role='Odile: a moan bent down'),
    chop('laugh', 66.0, 67.0, role='Odile: four squeaks, a laugh'),
    chop('moan', 67.0, 68.3, role='Odile: the moan after the laugh'),
    # stairs: the first two beats of each step
    *[chop(f'step-{i + 1}', 76.0 + 4 * i, 78.0 + 4 * i, role=f'stairs bar {i + 1}: beats 1-2, root {i + 1} of seven') for i in range(7)],
    # knock: stabs, silence, knocks from inside, the door
    chop('stab-1', 104.0, 104.72, role='tutti stab'),
    chop('stab-2', 104.75, 105.9, role='tutti stab, its ring into silence'),
    hit('inside-1', 108.5, 0.72, 'the Deacon knocks from inside (E, muffled)'),
    hit('inside-2', 109.25, 0.72, 'the second knock from inside'),
    hit('inside-3', 110.0, 0.72, 'the third knock from inside'),
    chop('door-knock', 110.75, 112.0, onset=False, role='the door, overpressure: a groan'),
    # shout
    chop('shout-a', 112.0, 116.0, role='shout bar 1: the hook hot (root 0)'),
    chop('shout-b', 116.0, 118.5, role='shout bar 2 up to the knocks'),
    chop('shout-bk', 116.0, 120.0, role='shout bar 2 whole: two knocks from Iggy, the third from inside'),
    chop('scream', 113.75, 114.6, role='Odile screams: wee-oo, wide'),
    # out
    chop('out', 144.0, 148.0, tail=0.0, role='the last hit, the spring as a laser, the coins spilling'),
    hit('inside-out', 149.0, 0.9, 'the last knock from inside'),
    chop('door-out', 150.0, 152.6, onset=False, role='the door closes (overpressure groan)'),
])

out = {'print': PRINT, 'printFrames': N, 'recordBeatSeconds': BEAT_S, 'recordSwing': SWING,
       'note': "offsetSeconds/endSeconds address the print; leadSeconds is how far the record's beat sits after the chop start (source seconds).",
       'chops': CHOPS}
os.makedirs(os.path.join(HERE, 'production'), exist_ok=True)
with open(os.path.join(HERE, 'production', 'chops.json'), 'w') as f: json.dump(out, f, indent=1)
for k, v in CHOPS.items():
    print('%-11s %6.2f-%6.2f  off %8.4f  lead %+6.1f ms  rise %5.1f dB  peak %6.1f%s' % (k, *v['srcBeats'], v['offsetSeconds'], 1000 * v['leadSeconds'], v['riseDb'], v['peakDbfs'],
          ('  clean %5.1f dB' % v['cleanDb']) if 'cleanDb' in v else ''))
