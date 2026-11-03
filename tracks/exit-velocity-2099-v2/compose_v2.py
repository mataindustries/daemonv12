#!/usr/bin/env python3
"""Create V2 candidates from the original V3 score, without modifying it.

All sample paths are relative to this directory. The score keeps the original
140 BPM grid, the opening whistle contour and the asymmetric drum vocabulary.
"""
from pathlib import Path
from copy import deepcopy
from fractions import Fraction
import json

HERE = Path(__file__).resolve().parent
BASE = json.loads((HERE / 'original-v3-reference.json').read_text())

def bar(n):
    return int(n['start'].split(':', 1)[0])

def move(n, b):
    n['start'] = str(b) + ':' + n['start'].split(':', 1)[1]

def track(p, name):
    return next(t for t in p['tracks'] if t['id'] == name)

def notes(p, name):
    return track(p, name)['patterns'][0]['notes']

def add(p, name, start, velocity, pitch=None, semitone=0, gate=None, glide=None):
    n = {'start': start, 'velocity': velocity}
    if pitch:
        n['pitch'] = pitch
    if semitone:
        n['playbackRate'] = round(2 ** (semitone / 12), 6)
    if gate:
        n['gate'] = gate
        n['envelope'] = {'attackSeconds': .002, 'releaseSeconds': .035 if name in ('lead','answer','orbit') else .025}
        n['chokeGroup'] = name
    if glide:
        n['glide'] = {'to': round(2 ** (glide / 12), 6), 'duration': '1/16'}
    notes(p, name).append(n)

def palette(p, name):
    for t in p['tracks']:
        inst = t['instrument']
        for field in ('kit', 'sample'):
            if field in inst:
                inst[field] = f"assets/{name}/{Path(inst[field]).name}"

def mix(p, settings):
    for name, gain in settings.items():
        track(p, name)['mix']['gainDb'] = gain

def make_a():
    # New sound design alone, retaining the old score as a controlled comparison.
    p = deepcopy(BASE)
    p['title'] = 'EXIT VELOCITY // 2099 V2A - sound design'
    palette(p, 'b')
    return p

def develop(p):
    """Make the second half of each four-bar phrase answer the first.

    The original kickoff and return melody survive. Silence before the return
    makes room for a tiny stutter, while the post-return figure rotates rhythm.
    """
    # A thin percussive pickup across the end of the break resolves at bar 17.
    for start, v in [('16:4+1/16', .20), ('16:4+1/8', .26), ('16:4+3/16', .34)]:
        add(p, 'rim', start, v, pitch='rim')
    add(p, 'talk', '16:4+1/8', .45, semitone=-5, gate='1/16', glide=0)
    # Displaced, alternating mouth-shapes in the lead's gaps; no new low-end
    # event on the kick downbeat. Gates retain the bass/kick separation.
    for b in (6, 10, 18, 22, 26, 30):
        add(p, 'talk', f'{b}:2+1/16', .48, semitone=3 if b in (10,22) else -2, gate='1/16')
        add(p, 'talk', f'{b}:4+1/8', .43, semitone=5 if b in (18,26) else 0, gate='1/16')
    for b in (4, 8, 12, 20, 24, 28):
        add(p, 'clap', f'{b}:2+3/16', .20, pitch='clap')
        add(p, 'rim', f'{b}:4+1/8', .23, pitch='rim')
    # Make the groove turn inside out briefly after the peak: fewer hat ticks,
    # a syncopated response, then a clear return to the original motif.
    ns = notes(p, 'hats')
    ns[:] = [n for n in ns if not (25 <= bar(n) <= 26 and '+13/96' in n['start'])]
    for b in (25, 27):
        add(p, 'answer', f'{b}:4+1/8', .47, semitone=-9, gate='1/16')
        add(p, 'answer', f'{b}:4+3/16', .43, semitone=-5, gate='1/16')
    # Last bar: remove terminal metal ring so the whistle can sign the ending.
    notes(p, 'chrome')[:] = [n for n in notes(p, 'chrome') if bar(n) != 32]
    return p

def make_b():
    p = develop(make_a())
    p['title'] = 'EXIT VELOCITY // 2099 V2B - arrangement and groove'
    return p

def make_c():
    p = make_b()
    p['title'] = 'EXIT VELOCITY // 2099 V2C - integrated mix'
    # Conservative headroom. Sonic impact comes from the asset design and
    # score, not a master-gain jump. Track balances may be tuned after renders.
    mix(p, {'kick': -5.6, 'clap': -7.0, 'hats': -8.4, 'rim': -9.1,
            'chrome': -12.2, 'sub': -9.4, 'talk': -7.0, 'lead': -9.7,
            'answer': -11.5, 'haze': -18.3, 'motor': -13.5, 'orbit': -12.8})
    p['master']['gainDb'] = -4
    return p

def make_risk():
    p = make_c()
    p['title'] = 'EXIT VELOCITY // 2099 RISK - whistle becomes bass speech'
    # The tune is passed from whistle to machine: copy its exact contour and
    # rhythm to the F2 voice at bar 25. The lead rests for that bar, so the
    # surprise reads as a dialogue rather than an additional unison layer.
    source = [deepcopy(n) for n in notes(p, 'lead') if bar(n) == 25]
    notes(p, 'lead')[:] = [n for n in notes(p, 'lead') if bar(n) != 25]
    notes(p, 'talk')[:] = [n for n in notes(p, 'talk') if bar(n) != 25]
    for n in source:
        n.pop('glide', None)
        n['velocity'] = round(n['velocity'] * .83, 3)
        n['chokeGroup'] = 'talk'
        n['envelope']['releaseSeconds'] = .025
        notes(p, 'talk').append(n)
    return p

def make_final():
    p = make_risk()
    p['title'] = 'EXIT VELOCITY // 2099 V2 - final candidate'
    # Keep the opening identifiable but held back, then deepen the last two
    # bars of negative space. This leaves more room for the return to expand.
    for name in ('kick', 'clap', 'sub', 'talk', 'hats', 'rim', 'haze'):
        for n in notes(p, name):
            if bar(n) <= 8:
                n['velocity'] = round(n['velocity'] * .83, 3)
    for name in ('kick', 'sub'):
        notes(p, name)[:] = [n for n in notes(p, name) if bar(n) != 15]
    for name in ('kick', 'clap', 'sub', 'talk', 'lead'):
        for n in notes(p, name):
            if 17 <= bar(n) <= 24:
                n['velocity'] = round(min(.99, n['velocity'] * 1.055), 3)
    # A quiet left-hand reply moves against the existing right-hand orbit in
    # the payoff. These are independent notes, never anti-phase copies; bass
    # and kick stay central. The short offset leaves the lead contour intact.
    for b in (17, 19, 21, 23):
        add(p, 'answer', f'{b}:2+3/16', .32, semitone=-9, gate='1/16')
        add(p, 'answer', f'{b}:4+1/8', .29, semitone=-5, gate='1/16')
    track(p, 'orbit')['mix']['gainDb'] = -11.8
    return p

def excerpt(base, kind):
    # Same eight-bar passage as original bars 17-24 (13.714 seconds of grid).
    p = deepcopy(base)
    p['title'] = f'EXIT VELOCITY // 2099 - direction {kind.upper()}'
    p['bars'] = 8
    p['render']['duration']['seconds'] = 14.3
    for t in p['tracks']:
        pat = t['patterns'][0]
        pat['bars'] = 8
        pat['notes'] = [n for n in pat['notes'] if 17 <= bar(n) <= 24]
        for n in pat['notes']:
            move(n, bar(n)-16)
    palette(p, kind)
    if kind == 'a':
        # Warm, grounded cruise: leave room around the lead; the alternative
        # palette supplies a slower, heavier bass and drum personality.
        mix(p, {'kick': -5.2, 'clap': -6.7, 'talk': -8.2, 'haze': -18.7, 'orbit': -14})
        notes(p, 'talk')[:] = [n for n in notes(p, 'talk') if not (bar(n) % 2 == 0 and ':4+' in n['start'])]
    elif kind == 'b':
        # Offbeat call-and-response; tiny ghosts and added vowel syllables make
        # this materially different from the heavy option, beyond timbre.
        for b in (2,4,6,8):
            add(p, 'talk', f'{b}:2+1/16', .52, semitone=-2, gate='1/16')
            add(p, 'talk', f'{b}:4+1/8', .47, semitone=3, gate='1/16')
            add(p, 'clap', f'{b}:2+3/16', .22, pitch='clap')
        mix(p, {'talk': -6.6, 'answer': -11.2, 'haze': -19})
    else:
        # Cinematic scale through subtraction and return. Same pulse, but the
        # first two bars lose the sub and the last two regain orbit answers.
        for name in ('kick', 'sub'):
            notes(p, name)[:] = [n for n in notes(p, name) if bar(n) > 2]
        for name in ('hats', 'rim'):
            for n in notes(p, name):
                if bar(n) <= 2:
                    n['velocity'] = round(n['velocity'] * .55, 3)
        mix(p, {'haze': -14.8, 'motor': -11.5, 'lead': -10.2, 'talk': -8.2})
        add(p, 'motor', '2:4+1/16', .62)
    p['master']['gainDb'] = -4
    return p

def write(name, p):
    (HERE / f'{name}.json').write_text(json.dumps(p, indent=2) + '\n')

if __name__ == '__main__':
    a, b, c, risk = make_a(), make_b(), make_c(), make_risk()
    for name, p in [('v2a', a), ('v2b', b), ('v2c', c), ('risk', risk), ('final', make_final()),
                    ('treatment-a', excerpt(c, 'a')), ('treatment-b', excerpt(c, 'b')),
                    ('treatment-c', excerpt(c, 'c'))]:
        write(name, p)
    print('Wrote V2A, V2B, V2C, RISK and three passage treatments.')
