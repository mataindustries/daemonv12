"""THE V2 DIG: three records and two prints, one chop notebook (v2/chops.json).

Sources (all inside counterfeit-gold-opus/assets/):
  lp       the LP print, "Two Coins for the Ferryman" (F minor, 104.650226 BPM, swing 0.56)        generation 1
  street   the unreleased Procession Take (F, 104.650226 BPM, swing 0.6)                            generation 1
  v1       FERRYMAN TAKES FAKES, V1 master (D minor, 88 BPM): sampled as a record                    generation 2
  eternal  the Deacon's note, spliced to last forever (v2/prints.ts)                                generation 2
  reversed two LP slices in reverse frame order (v2/prints.ts)                                       generation 2

For record chops the script finds the real onset near the record's beat and starts the chop on a zero crossing just
before it; `leadSeconds` says where the record's beat sits inside the chop so the production puts the record's time
on its grid. V1 and the prints are addressed exactly (they are already on a known grid).

    python3 counterfeit-gold-opus/v2/dig.py
"""
import json, os, sys
import numpy as np
HERE = os.path.dirname(os.path.abspath(__file__)); ROOT = os.path.dirname(HERE)
sys.path.insert(0, os.path.join(ROOT, 'tools'))
from wavio import read, RATE, db, rms

V1_CHOPS = json.load(open(os.path.join(ROOT, 'beat', 'chops.json')))['chops']
PRINTS = json.load(open(os.path.join(HERE, 'prints.json')))
SRC = {
    'lp': {'file': 'assets/record/the-velvet-hearse--two-coins-for-the-ferryman.wav', 'beat': 0.573338, 'swing': 0.56, 'generation': 1},
    'street': {'file': 'assets/record/the-velvet-hearse--two-coins-procession-take.wav', 'beat': 0.573338, 'swing': 0.6, 'generation': 1},
    'v1': {'file': 'assets/v1/ferryman-takes-fakes-v1.wav', 'beat': 0.681818, 'swing': 0.5, 'generation': 2},
    'eternal': {'file': 'assets/v2/eternal-deacon.wav', 'beat': None, 'swing': 0.5, 'generation': 2},
    'reversed': {'file': 'assets/v2/reversed.wav', 'beat': None, 'swing': 0.5, 'generation': 2},
}
AUDIO = {k: read(os.path.join(ROOT, v['file'])).mean(axis=1) for k, v in SRC.items()}
HOP = 44
ENV = {k: np.sqrt(np.convolve(m ** 2, np.ones(HOP) / HOP, mode='same'))[::HOP] for k, m in AUDIO.items()}

def t_of(src, beat):
    s = beat * 4; k = round(s); sw = SRC[src]['swing']
    if abs(s - k) < 1e-9 and k % 2 == 1: beat += (sw - 0.5) * 0.5
    return beat * SRC[src]['beat']

def onset_near(src, t, win=0.03):
    env = ENV[src]; i0, i1 = max(10, int((t - win) * RATE / HOP)), int((t + win) * RATE / HOP)
    best, bi = -1, i0
    for i in range(i0, i1):
        r = env[i:i + 3].mean() / (env[i - 10:i - 2].mean() + 1e-6)
        if r > best: best, bi = r, i
    return bi * HOP / RATE

def zero_before(src, t, look=0.0015):
    m = AUDIO[src]; i = int(t * RATE); j0 = max(1, i - int(look * RATE))
    for k in range(i, j0, -1):
        if m[k - 1] <= 0 < m[k] or m[k - 1] >= 0 > m[k]: return k / RATE
    return i / RATE

CHOPS = {}
def chop(name, src, a, b, onset=True, pre=0.003, role='', align='beat'):
    """align='beat': the record's beat lands on the grid (its humanized feel kept). align='attack': the detected attack
    lands on the grid, for notes that are stacked or stuttered, where a few ms of feel become a flam."""
    tn, te = t_of(src, a), t_of(src, b)
    found = onset_near(src, tn)
    start = zero_before(src, (min(found, tn) if onset else tn) - pre)
    start = max(0.0, start)
    CHOPS[name] = {'src': src, 'role': role, 'srcBeats': [a, b], 'offsetSeconds': round(start, 6), 'endSeconds': round(min(te, (len(AUDIO[src]) - 1) / RATE), 6),
                   'leadSeconds': round((found if align == 'attack' else tn) - start, 6), 'align': align}

def exact(name, src, start, end, lead=0.0, role=''):
    CHOPS[name] = {'src': src, 'role': role, 'offsetSeconds': round(start, 6), 'endSeconds': round(end, 6), 'leadSeconds': round(lead, 6)}

# ---- the LP: V1's notebook carried over unchanged, plus what V2 needs
for k, v in V1_CHOPS.items():
    CHOPS[k] = {'src': 'lp', **{kk: vv for kk, vv in v.items() if kk in ('role', 'srcBeats', 'offsetSeconds', 'endSeconds', 'leadSeconds')}, 'from': 'V1 notebook'}
chop('crossing-run', 'lp', 64.0, 92.0, role='the whole 7/8 crossing, eight cycles: 28 record beats = 7 bars of 4/4')
chop('stop-bar', 'lp', 92.0, 96.0, role='the stop bar whole: two stabs, silence, the Deacon alone, his pickups')
chop('clink', 'lp', 8.5, 8.74, role='one coin (the first reed staccato)')
chop('deh', 'lp', 48.5, 48.75, role='Odile: "deh"', align='attack')
chop('dah', 'lp', 48.75, 49.0, role='Odile: "dah"', align='attack')
for i in range(8):
    chop(f'scat-{i}', 'lp', 56.0 + 0.25 * i, 56.25 + 0.25 * i, role=f'Odile scat syllable {i + 1} of 8', align='attack')

# ---- the Procession Take
chop('dirge', 'street', 0.0, 8.0, role='to the cemetery: two tolls, the theme at half speed, hums, the pram tuba')
chop('roll-shout', 'street', 17.5, 20.0, role="the press roll swelling under Odile's shout, bent up a fifth; the mourners' HAH")
chop('roll-late', 'street', 18.5, 20.0, role='the loud end of the press roll and the HAH')
chop('line', 'street', 20.0, 52.0, role='the second line home, eight bars: F7 Bb7 F7 C7 F7 Bb7 F7|Gb7#11 F7')
chop('riff', 'street', 52.0, 56.0, role='THE RIFF: Brother Ezra alone')
for i, (a, b) in enumerate([(52.0, 52.5), (52.5, 52.75), (52.75, 53.0), (53.0, 53.5), (53.5, 54.0), (54.0, 55.0), (55.0, 55.25), (55.25, 55.5), (55.5, 56.0)]):
    chop(f'riff-{i}', 'street', a, b, role=f'riff note {i + 1} of 9', align='attack')
chop('shout-a', 'street', 60.0, 72.0, role='the shout chorus, three bars: the riff over the band, Odile above')
chop('shout-4', 'street', 72.0, 76.0, role='the last shout bar: C5 growl, Bb, A, E, G')
chop('home', 'street', 76.0, 86.0, role='the band holds F major; the bell for the living')

# ---- V1 as a record (exact: V1 is on the 88 BPM grid)
for name, a, b, role in [('v1-shout-1', 60, 68, "V1's shout, first pass: s-coins, s-ferry, its tail, the record's claps"),
                         ('v1-shout-2', 68, 76, "V1's shout, second pass: ends in Odile's stuttered scat")]:
    s, e = a * 0.681818, b * 0.681818
    exact(name, 'v1', zero_before('v1', s - 0.002), e, s - zero_before('v1', s - 0.002), role)
    CHOPS[name]['srcBeats'] = [a, b]

# ---- the prints
exact('eternal', 'eternal', 0.0, PRINTS['eternal']['seconds'] - 0.001, 0.004, "the Deacon plucks, and the note never dies")
exact('eternal-hold', 'eternal', 0.5, PRINTS['eternal']['seconds'] - 0.001, 0.0, 'the eternal note without its pluck, for legato slides')
for s in PRINTS['reversed']['slices']:
    a, b = s['sheetSeconds']; exact(s['id'], 'reversed', a, b, b - a, s['why'] + ' (lead = whole slice: it lands at its end)')

for v in CHOPS.values(): v['generation'] = SRC[v['src']]['generation']
out = {'note': 'offsetSeconds/endSeconds address each source file; leadSeconds is where the record\'s beat sits after the chop start (source seconds).',
       'sources': SRC, 'chops': CHOPS}
json.dump(out, open(os.path.join(HERE, 'chops.json'), 'w'), indent=1)
print(f'{len(CHOPS)} chops from {len(SRC)} sources')
for k in ['crossing-run', 'stop-bar', 'clink', 'deh', 'dah', 'scat-0', 'scat-7', 'dirge', 'roll-shout', 'line', 'riff', 'riff-0', 'riff-5', 'shout-a', 'home', 'v1-shout-1', 'eternal', 'bell-reversed', 'swell-reversed']:
    c = CHOPS[k]; print('%-14s %-8s off %9.4f end %9.4f lead %+6.1f ms' % (k, c['src'], c['offsetSeconds'], c['endSeconds'], 1000 * c['leadSeconds']))
