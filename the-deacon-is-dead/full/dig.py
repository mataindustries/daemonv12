"""THE DIG for the full wake: three generations of source, one chop notebook (full/chops.json).

  gen 1  the record print (assets/record/the-velvet-hearse--the-deacon-is-dead.wav), dug exactly as the short version's
         dig does (tools/dig.py): the real onset near the record's beat, a zero crossing before it, the beat inside it.
  gen 2  the approved short version (assets/short/, a byte-identical copy of production/the-deacon-knocks-back.wav),
         treated as a second record: 96 BPM, its
         beat 0 at its frame 0. Its chops start 6 ms before its grid on a zero crossing (its own hits land up to 4 ms early).
  gen 3  THE OTHER SIDE (assets/full/the-other-side.wav): fragments of gen 2 with their frame order reversed, bit-exact,
         laid end to end with silence between. Derived here, before the dig reads it. Each reversed chop lands on its end.

The approved short version's notebook (production/chops.json) is not touched.     python3 the-deacon-is-dead/full/dig.py
"""
import hashlib, json, os, struct, sys
import numpy as np
HERE = os.path.dirname(os.path.abspath(__file__)); ROOT = os.path.dirname(HERE)
sys.path.insert(0, os.path.join(ROOT, 'tools'))
from wavio import read, RATE, db, rms

GEN1, GEN2, GEN3 = 'assets/record/the-velvet-hearse--the-deacon-is-dead.wav', 'assets/short/the-deacon-knocks-back.wav', 'assets/full/the-other-side.wav'
APPROVED = 'production/the-deacon-knocks-back.wav'   # gen 2 is a byte-identical copy of it (the engine reads samples only under assets/)
assert open(os.path.join(ROOT, GEN2), 'rb').read() == open(os.path.join(ROOT, APPROVED), 'rb').read(), 'assets/short must equal the approved master'
REC_BEAT, REC_SWING, G2_BEAT = 0.51271, 0.54, 0.625
sha = lambda p: hashlib.sha256(open(os.path.join(ROOT, p), 'rb').read()).hexdigest()

# ------------------------------------------------------------------------------------------------ gen 3: the other side
def pcm16(path):
    b = open(path, 'rb').read(); p = 12; ch = data = None
    while p + 8 <= len(b):
        cid, size = b[p:p + 4], struct.unpack('<I', b[p + 4:p + 8])[0]
        if cid == b'fmt ': ch = struct.unpack('<H', b[p + 10:p + 12])[0]; assert struct.unpack('<H', b[p + 22:p + 24])[0] == 16
        elif cid == b'data': data = np.frombuffer(b[p + 8:p + 8 + size], dtype='<i2').reshape(-1, ch)
        p += 8 + size + (size & 1)
    return data

def wav16(frames):
    d = frames.astype('<i2').tobytes(); ch = frames.shape[1]
    return b'RIFF' + struct.pack('<I', 36 + len(d)) + b'WAVEfmt ' + struct.pack('<IHHIIHH', 16, 1, ch, RATE, RATE * ch * 2, ch * 2, 16) + b'data' + struct.pack('<I', len(d)) + d

g2 = pcm16(os.path.join(ROOT, GEN2))
REVERSE = [   # name, gen-2 beats [a, b): the slice starts 6 ms before its first beat
    ('g3-reply-rev', 4.0, 5.3, "the Deacon's reply from the short version's opening, backwards: an inhale into a thud"),
    ('g3-knocks-rev', 2.5, 4.0, "Iggy's three knocks from the short version's opening, backwards: three swells"),
    ('g3-scale-rev', 82.25, 84.0, 'the seven-knock scale from the short version, backwards: the dead climbing down'),
]
GAP = int(0.3 * RATE); parts, rev = [], {}
cursor = 0
for name, a, b, role in REVERSE:
    i0, i1 = int(round((a * G2_BEAT - 0.006) * RATE)), int(round((b * G2_BEAT - 0.006) * RATE))
    piece = g2[i0:i1][::-1]
    parts += [piece, np.zeros((GAP, 2), dtype='<i2')]
    rev[name] = {'role': role, 'from': GEN2, 'fromFrames': [i0, i1], 'operation': 'frame order reversed, bit-exact, no fades or gain',
                 'offsetSeconds': round(cursor / RATE, 6), 'endSeconds': round((cursor + len(piece)) / RATE, 6)}
    cursor += len(piece) + GAP
os.makedirs(os.path.join(ROOT, 'assets', 'full'), exist_ok=True)
open(os.path.join(ROOT, GEN3), 'wb').write(wav16(np.concatenate(parts)))

# ------------------------------------------------------------------------------------------------ onset helpers
class Source:
    def __init__(self, path, beat_s, swing):
        self.path, self.beat_s, self.swing = path, beat_s, swing
        self.mono = read(os.path.join(ROOT, path)).mean(axis=1); self.N = len(self.mono)
        self.env = np.sqrt(np.convolve(self.mono ** 2, np.ones(44) / 44, mode='same'))[::44]
    def t(self, beat):
        s = beat * 4; k = round(s)
        return (beat + (self.swing - 0.5) * 0.5 if abs(s - k) < 1e-9 and k % 2 == 1 else beat) * self.beat_s
    def onset_near(self, t, win=0.03):
        i0, i1 = max(10, int((t - win) * RATE / 44)), int((t + win) * RATE / 44); best, bi = -1, i0
        for i in range(i0, i1):
            r = self.env[i:i + 3].mean() / (self.env[i - 10:i - 2].mean() + 1e-6)
            if r > best: best, bi = r, i
        return bi * 44 / RATE, float(20 * np.log10(best))
    def zero_before(self, t, look=0.0015):
        i = int(t * RATE); m = self.mono
        for k in range(i, max(1, i - int(look * RATE)), -1):
            if m[k - 1] <= 0 < m[k] or m[k - 1] >= 0 > m[k]: return k / RATE
        return i / RATE
    def chop(self, gen, a, b, role, onset=True, pre=0.003, hit=False):
        tn, te = self.t(a), self.t(b)
        if onset: to, rise = self.onset_near(tn); start = self.zero_before(min(to, tn) - pre)
        else: to, rise, start = tn, 0.0, self.zero_before(tn - pre)
        start = max(0.0, start); seg = self.mono[int(start * RATE):int(te * RATE)]
        c = {'gen': gen, 'source': self.path, 'role': role, 'srcBeats': [a, b], 'offsetSeconds': round(start, 6), 'endSeconds': round(min(te, (self.N - 1) / RATE), 6),
             'leadSeconds': round(tn - start, 6), 'riseDb': round(rise, 1), 'peakDbfs': round(db(float(np.abs(seg).max())), 1)}
        if hit:
            o = to; pre_ = self.mono[int((o - 0.03) * RATE):int((o - 0.001) * RATE)]; body = self.mono[int(o * RATE):int((o + 0.05) * RATE)]
            c['cleanDb'] = round(db(rms(body)) - db(rms(pre_)), 1)
        return c

rec, sv = Source(GEN1, REC_BEAT, REC_SWING), Source(GEN2, G2_BEAT, 0.5)
C = {}
def r(name, a, b, role, **kw): C[name] = rec.chop(1, a, b, role, **kw)
def s(name, a, b, role): C[name] = sv.chop(2, a, b, role, onset=False, pre=0.006)

# gen 1: the record (the short version's chops, dug the same way, plus what the full wake needs)
r('door-lid', 0.0, 1.9, 'the door creaks open', onset=False)
for i, b in enumerate([2.5, 3.0, 3.5]): r(f'knock-{i + 1}', b, b + (0.48 if i == 2 else 0.45), f"Iggy's knock {i + 1} on the lid", hit=True)
r('boing-0', 4.0, 5.95, 'the hearse spring alone: twang on A1', hit=True)
r('whoop', 7.0, 7.45, "the urn's whoop, alone", hit=True)
r('lik-pick', 10.25, 12.0, 'the likembe picks up')
r('thumb-a', 12.0, 16.0, 'the likembe alone, one bar on the tonic')
r('thumb-b', 16.0, 18.5, 'the likembe bar that stops for the knocks')
r('kick', 52.0, 52.24, 'break: urn palm thud', hit=True)
r('snare', 53.0, 53.7, 'break: bead slap', hit=True)
r('tap', 55.75, 55.99, 'break: bead tap', hit=True)
r('coins', 52.25, 52.47, 'break: one shake of the collection plate', hit=True)
r('scrape', 57.5, 58.45, 'break: a stick along the coffin panels')
r('odile-ab', 60.0, 68.0, 'odile bars 1-2 as found (root 3)')
r('odile-cd', 68.0, 76.0, 'odile bars 3-4 as found (roots 1 and 6): the laugh and the long moan')
r('hihi', 60.75, 61.45, 'Odile: two quick squeaks')
r('ooo', 61.5, 62.5, 'Odile: a moan bent down')
r('laugh', 66.0, 67.0, 'Odile: four squeaks, a laugh')
for i in range(7):
    r(f'step-{i + 1}', 76.0 + 4 * i, 78.0 + 4 * i, f'stairs bar {i + 1}: beats 1-2 (root {i + 1})')
    if i < 4: r(f'stair-{i + 1}', 76.0 + 4 * i, 80.0 + 4 * i, f'stairs bar {i + 1} whole (root {i + 1}), half time')
r('stab-1', 104.0, 104.72, 'tutti stab'); r('stab-2', 104.75, 105.9, 'tutti stab and its ring')
for i, b in enumerate([108.5, 109.25, 110.0]): r(f'inside-{i + 1}', b, b + 0.72, f'the Deacon knocks from inside ({i + 1})', hit=True)
r('door-knock', 110.75, 112.0, 'the door, overpressure', onset=False)
r('shout-a', 112.0, 116.0, 'shout bar 1: the hook hot'); r('shout-b', 116.0, 118.5, 'shout bar 2 up to the knocks')
r('shout-bk', 116.0, 120.0, 'shout bar 2 whole: the third knock from inside')
r('scream', 113.75, 114.6, 'Odile screams: wee-oo')
r('out', 144.0, 148.0, 'the last hit, the spring as a laser, the coins spilling')
r('inside-out', 149.0, 149.9, 'the last knock from inside', hit=True)
r('door-out', 150.0, 152.6, 'the door closes', onset=False)

# gen 2: the short version as a record
s('g2-viewing', 0.0, 5.3, 'the short version opening: door, three knocks, the reply')
s('g2-groove', 16.0, 24.0, "the short version's wake, pair 2: reply, the one-shot groove, Odile, the knocks")
for k in range(16): s(f'g2a-{k}', 16.0 + k / 4, 16.25 + k / 4, f'the short version, wake pair 2, bar A, sixteenth {k}')
s('g2-laugh', 38.0, 40.0, "the short version's laugh stutter: he-he, he-he, he-he-he-he")
s('g2-scale', 82.25, 84.0, "the short version's seven-knock scale")

# gen 3: the other side (reversed chops land on their end: lead = their whole length)
for name, m in rev.items():
    C[name] = {'gen': 3, 'source': GEN3, 'role': m['role'], 'offsetSeconds': m['offsetSeconds'], 'endSeconds': m['endSeconds'],
               'leadSeconds': round(m['endSeconds'] - m['offsetSeconds'], 6), 'derivedFrom': {k: m[k] for k in ('from', 'fromFrames', 'operation')}}

out = {'sources': {GEN1: {'gen': 1, 'sha256': sha(GEN1), 'beatSeconds': REC_BEAT, 'swing': REC_SWING, 'madeBy': 'source/compose.ts on the Signature Rack and the Timbre Lab, printed once'},
                   GEN2: {'gen': 2, 'sha256': sha(GEN2), 'beatSeconds': G2_BEAT, 'parents': [GEN1], 'identicalTo': APPROVED, 'madeBy': 'production/build.ts: the approved short version, THE DEACON KNOCKS BACK'},
                   GEN3: {'gen': 3, 'sha256': sha(GEN3), 'parents': [GEN2], 'madeBy': 'full/dig.py: frame-reversed fragments of gen 2, bit-exact'}},
       'note': 'offsetSeconds/endSeconds address the source; leadSeconds is where the source beat (or a reversed chop\'s end) sits after the chop start.',
       'chops': C}
json.dump(out, open(os.path.join(HERE, 'chops.json'), 'w'), indent=1)
print(f'{len(C)} chops: ' + ', '.join(f'gen {g}: {sum(1 for c in C.values() if c["gen"] == g)}' for g in (1, 2, 3)))
for k in ['knock-1', 'inside-3', 'g2-viewing', 'g2a-0', 'g2-scale', 'g3-scale-rev']: print(' ', k, {x: C[k][x] for x in ('offsetSeconds', 'endSeconds', 'leadSeconds')})
