/** SAMPLE LAB 03 — OBJECT ORCHESTRA: MUTATION. 120 BPM, four bars of 4/4 (8.000 s), A minor.
 *
 * No new instruments. One bar of SAMPLE LAB 02's kitchen band is printed once (TAKE: the mug-bass, the drips and the
 * mug at its own pitch), and the other three bars are mutations of that record:
 *  - Bar 1, TAKE: the riff. Mug boom, "plink-PLINK", and a water drop that bounces (a geometric accelerando, ratio 0.72)
 *    into the bar line. A water drop cannot bounce; this one does.
 *  - Bar 2, MIRROR: TAKE reversed (C's temporal inversion). The bar line is the mirror, so the drop bounces back out of
 *    it, slower and slower, the drips suck backwards and the booms swell into their own attacks, ending in a swell into
 *    bar 3's boom. The live drums keep playing forwards, but on the mirrored grid: the kick pattern is the retrograde of
 *    bar 1's, and every human offset flips sign, so the laid-back snare of bar 1 rushes in bar 2.
 *  - Bar 3, COPY OF A COPY: TAKE's opening cell (boom, plink, PLINK) chopped 3+3+3+3+2+2 and climbing A A C D E G. The
 *    last two chops squeeze the whole three-sixteenth cell into two sixteenths, so the bar accelerates as it climbs.
 *  - Bar 4, SINK and LANDING: the opening drops a major third into F minor at 0.79 speed, so for a moment the band drags
 *    at 95 BPM behind 120 BPM drums. Then the coin spins up, and the bar-1 bounce returns a major third higher on G#
 *    (the enharmonic twin of F minor's Ab, carried by the mug's own tierce). Coin and drop both land on the A of the
 *    next downbeat.
 * Run: node experiments/sample-lab-03/scripts/mutation.ts (writes projects/take.json and mutation.json) */
import { readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { clock, rate, type Ev, type Note } from '../../sample-lab-02/scripts/score.ts';
import { HITS } from '../../sample-lab-02/scripts/object-orchestra.ts';
import { MUG_HZ, COIN } from '../../sample-lab-02/scripts/object-sources.ts';
import { readWavFloat, fft, RATE } from '../../sample-lab-02/scripts/dsp.ts';

export const BPM = 120;
export const c = clock(BPM, '4/4', 4), c1 = clock(BPM, '4/4', 1);
const S = 'assets/sources/', MUG_PRINT = 'assets/prints/mug-quarter.wav', TAKE = 'assets/prints/take.wav', MIRROR = 'assets/derived/mirror.wav';
const SIXTEENTH_S = 60 / BPM / 4, BAR_S = 4 * 60 / BPM;
const hzOf = (midi: number) => 440 * 2 ** ((midi - 69) / 12);
/** Bar (1-based within the pattern), sixteenth and a human offset in ms. */
const at = (clk: typeof c, bar: number, s: number, ms = 0) => clk.at(1 + 4 * (bar - 1), s, ms);

// ================================================================ generation: TAKE (the record the loop mutates)
const A1 = 33, D2 = 38, E2 = 40, C6 = 84, D6 = 86, E6 = 88, G6 = 91, A6 = 93;
function boom(midi: number, velocity: number, gate: string, from?: number): Omit<Note, 'start'> {
  const r = (m: number) => +(hzOf(m) / (MUG_HZ / 4)).toFixed(6);   // mug-quarter.wav sounds A3
  return { velocity, gate, playbackRate: r(from ?? midi), ...(from !== undefined ? { glide: { to: r(midi), duration: '1/16' } } : {}),
    envelope: { attackSeconds: 0.003, releaseSeconds: 0.07 }, chokeGroup: 'bass' };
}
/** The pitch each drop of the approved drips.wav actually rings at, measured from the recording (spectral peak 8-54 ms
 * after the splash, once the bubble's upward chirp has settled). SAMPLE LAB 02 tuned drops by their starting pitch, so
 * its drips sounded 6-22% sharp of the written notes; this lab tunes them by ear-equivalent measurement instead. */
export const DROP_HZ: number[] = (() => {
  const [l, r] = readWavFloat(readFileSync(join(dirname(fileURLToPath(import.meta.url)), '..', '..', 'sample-lab-02', 'projects', 'assets', 'sources', 'drips.wav')));
  return HITS.drips.map((at, k) => {
    if (!HITS.dripHz[k]) return 0;
    const n = 16384, w = 2048, re = new Float64Array(n), im = new Float64Array(n), s0 = Math.round((at + 0.008) * RATE);
    for (let i = 0; i < w; i++) re[i] = 0.5 * (l![s0 + i]! + r![s0 + i]!) * (0.5 - 0.5 * Math.cos(2 * Math.PI * i / w));
    fft(re, im);
    let best = 0, bk = 0;
    for (let b = Math.ceil(600 * n / RATE); b < 3500 * n / RATE; b++) { const m = Math.hypot(re[b]!, im[b]!); if (m > best) { best = m; bk = b; } }
    const a = Math.hypot(re[bk - 1]!, im[bk - 1]!), c0 = Math.hypot(re[bk + 1]!, im[bk + 1]!);
    return +((bk + 0.5 * (a - c0) / (a - 2 * best + c0)) * RATE / n).toFixed(2);
  });
})();
/** A drop retuned to `midi` from the drop whose measured pitch is nearest. */
function drip(midi: number, velocity: number, gate = '1/16'): Omit<Note, 'start'> {
  const target = hzOf(midi);
  let best = -1;
  DROP_HZ.forEach((h, k) => { if (h && (best < 0 || Math.abs(Math.log(h / target)) < Math.abs(Math.log(DROP_HZ[best]! / target)))) best = k; });
  const r = target / DROP_HZ[best]!;
  return { velocity, offsetSeconds: HITS.drips[best]! - 0.002, endSeconds: HITS.drips[best]! + 0.3, ...(Math.abs(r - 1) > 1e-4 ? { playbackRate: +r.toFixed(6) } : {}),
    gate, envelope: { attackSeconds: 0.0005, releaseSeconds: 0.03 } };
}
const take = (s: number, ms: number, note: Omit<Note, 'start'>): Ev => ({ ...at(c1, 1, s, ms), note });

const TAKE_BASS: Ev[] = [
  take(0, 0, boom(A1, 1.0, '3/16')), take(3, 10, boom(A1, 0.55, '1/16')), take(6, 6, boom(E2, 0.85, '1/8')),
  take(10, 8, boom(D2, 0.7, '1/16')), take(11, 14, boom(E2, 0.8, '1/16', D2)),
];
const TAKE_MUG: Ev[] = [take(0, 14, { velocity: 0.75, offsetSeconds: HITS.mug[0]! - 0.001, endSeconds: HITS.mug[0]! + 1.6, gate: '1/4', envelope: { attackSeconds: 0.001, releaseSeconds: 0.25 } })];
// The riff's drips: plink-PLINK, then a falling answer; odd sixteenths swing late.
const RIFF: [number, number, number, number][] = [[1, 19, E6, 0.55], [2, 0, A6, 0.75], [5, 18, G6, 0.5], [6, 0, E6, 0.65], [8, 0, D6, 0.55], [9, 20, E6, 0.5], [10, 0, C6, 0.5]];
/** The bounce: one E6 drop hitting from beat 4 at intervals shrinking by 0.72, converging on the bar line, each hit
 * 0.8 as loud as the last. Returned as [seconds into the bar, velocity]. */
export const BOUNCE_RATIO = 0.72;
export const BOUNCE: [number, number][] = (() => {
  const out: [number, number][] = [], start = 12 * SIXTEENTH_S;
  let t = start, gap = (BAR_S - start) * (1 - BOUNCE_RATIO), v = 0.62;
  while (gap > 0.012) { out.push([t, v]); t += gap; gap *= BOUNCE_RATIO; v *= 0.8; }
  return out;
})();
const TAKE_DRIPS: Ev[] = [
  ...RIFF.map(([s, ms, midi, v]) => take(s, ms, drip(midi, v))),
  ...BOUNCE.map(([sec, v]) => { const t = Math.round(sec / BAR_S * c1.cycle); return { t, nominal: t, note: drip(E6, v, '1/32') }; }),
];
export const TAKE_EVENTS: Record<string, Ev[]> = { bass: TAKE_BASS, mug: TAKE_MUG, drips: TAKE_DRIPS };

/** The TAKE print: one bar of the band, plus a second of room so every chop reads real audio. */
export function takeProject() {
  const o = { cycles: 1 };
  return {
    formatVersion: 1,
    title: 'TAKE (SAMPLE LAB 03 print)',
    description: 'One bar of the SAMPLE LAB 02 kitchen band, printed once: the mug four octaves down, the drips and the mug at its own pitch, ending in a drop that bounces into the bar line. The MUTATION loop is made only from this print, its reversal and the live drums and coin.',
    bpm: BPM, timeSignature: '4/4', key: 'A minor', bars: 1, seed: 1,
    render: { duration: { seconds: 3 }, tail: 'none' },
    master: { gainDb: -5 },   // headroom: the three parts peak together on the downbeat
    tracks: [
      c1.track('bass', 'mug-quarter.wav at quarter speed again: one spoon tap four octaves down.', MUG_PRINT, TAKE_BASS,
        { ...o, gainDb: -3.8, effects: [{ type: 'highpass', frequencyHz: 36 }, { type: 'lowpass', frequencyHz: 1100 }, { type: 'saturation', driveDb: 4, mix: 0.3 }] }),
      c1.track('mug', 'The mug at its own pitch, 14 ms behind the boom.', `${S}mug.wav`, TAKE_MUG,
        { ...o, gainDb: -1, pan: 0.3, effects: [{ type: 'highpass', frequencyHz: 400 }, { type: 'lowpass', frequencyHz: 11000 }] }),
      c1.track('drips', 'The riff on retuned drops, then one drop bouncing into the bar line.', `${S}drips.wav`, TAKE_DRIPS,
        { ...o, gainDb: 1.5, pan: -0.2, effects: [{ type: 'highpass', frequencyHz: 600 }] }),
    ],
  };
}

// ================================================================ the loop
const ev = (bar: number, s: number, ms: number, note: Omit<Note, 'start'>): Ev => ({ ...at(c, bar, s, ms), note });
const hard = { attackSeconds: 0, releaseSeconds: 0 };

// Bar 1 plays TAKE's first bar as recorded; bar 2 plays its mirror. Both cut exactly on the bar line, with no ramps, so
// the junction is sample-continuous (the mirror's first frame is the take's last).
const WHOLE: Ev[] = [ev(1, 0, 0, { velocity: 1, offsetSeconds: 0, endSeconds: BAR_S, gate: '1/1', envelope: hard })];
const MIRRORED: Ev[] = [ev(2, 0, 0, { velocity: 1, offsetSeconds: 0, endSeconds: BAR_S, gate: '1/1', envelope: hard })];

// Bar 3: the opening cell, 3+3+3+3+2+2, climbing. Each chop reads as much of TAKE as fills its slot at its rate, so
// the 2-sixteenth chops squeeze the whole 3-sixteenth cell (and its next boom) into less time.
export const CELLS: [s: number, slot: number, semis: number, ms: number, v: number][] = [
  [0, 3, 0, 0, 1], [3, 3, 0, 6, 0.9], [6, 3, 3, 3, 0.92], [9, 3, 5, 8, 0.94], [12, 2, 7, 4, 0.96], [14, 2, 10, 10, 1],
];
const CELL_EVENTS: Ev[] = CELLS.map(([s, slot, semis, ms, v]) => {
  const r = rate(semis), ticks = slot * 240;
  return ev(3, s, ms, { velocity: v, offsetSeconds: 0, endSeconds: +(slot * SIXTEENTH_S * r + 0.02).toFixed(6), ...(semis ? { playbackRate: r } : {}),
    gate: `${ticks}/3840`, envelope: { attackSeconds: 0.002, releaseSeconds: 0.012 }, chokeGroup: 'cells' });
});

// Bar 4: the sink (TAKE's first second, a major third down), then the bounce again, a major third up, landing on 1.
export const SINK = { semis: -4, sourceSeconds: 1.0 };
export const LANDING = { semis: 4, fromSeconds: 1.585 };   // after the bass tail has died: the bounce alone
const sinkRate = rate(SINK.semis), landRate = rate(LANDING.semis);
const landLength = (BAR_S - LANDING.fromSeconds) / landRate;                 // seconds the squeezed bounce lasts
const landAt = Math.round((BAR_S - landLength) / BAR_S * 3840);              // ticks into bar 4
const SINK_EVENTS: Ev[] = [
  ev(4, 0, 0, { velocity: 1, offsetSeconds: 0, endSeconds: SINK.sourceSeconds, playbackRate: sinkRate, gate: '5/8', envelope: { attackSeconds: 0.002, releaseSeconds: 0.05 }, chokeGroup: 'cells' }),
  { t: 3 * 3840 + landAt, nominal: 3 * 3840 + landAt, note: { velocity: 1, offsetSeconds: LANDING.fromSeconds, endSeconds: BAR_S, playbackRate: landRate, gate: '1/4', envelope: { attackSeconds: 0.003, releaseSeconds: 0.003 } } },
];

// Drums: box kick and book snare, forwards in every bar. Bar 2 is bar 1 mirrored about the bar line (retrograde
// positions, offsets with their sign flipped), plus the drop's impact on the mirror itself.
const box = (bar: number, s: number, ms: number, v: number, hit: number): Ev =>
  ev(bar, s, ms, { velocity: v, offsetSeconds: HITS.box[hit]! - 0.001, endSeconds: HITS.box[hit]! + 0.6, gate: '1/8', envelope: { attackSeconds: 0.0005, releaseSeconds: 0.06 } });
const book = (bar: number, s: number, ms: number, v: number, hit: number): Ev =>
  ev(bar, s, ms, { velocity: v, offsetSeconds: HITS.book[hit]! - 0.001, endSeconds: HITS.book[hit]! + 0.5, gate: '1/8', envelope: { attackSeconds: 0.0005, releaseSeconds: 0.08 } });
type Hit = [s: number, ms: number, v: number, hit: number];
const KICK_1: Hit[] = [[0, 0, 0.9, 0], [7, 9, 0.62, 1], [10, 5, 0.85, 2]], SNARE_1: Hit[] = [[4, 24, 0.92, 0], [12, 29, 0.95, 2]];
const mirror = (hits: Hit[]): Hit[] => hits.filter(([s, ms]) => s > 0 || ms > 0).map(([s, ms, v, hit]) => [16 - s, -ms, v, hit]);
const KICK: Ev[] = [
  ...KICK_1.map(([s, ms, v, h]) => box(1, s, ms, v, h)),
  box(2, 0, 0, 0.6, 3), ...mirror(KICK_1).map(([s, ms, v, h]) => box(2, s, ms, v, h)),
  box(3, 0, 0, 0.95, 0), box(3, 6, 6, 0.8, 2), box(3, 12, 4, 0.85, 1),
  box(4, 0, 0, 0.9, 0),
];
const SNARE: Ev[] = [
  ...SNARE_1.map(([s, ms, v, h]) => book(1, s, ms, v, h)),
  ...mirror(SNARE_1).map(([s, ms, v, h]) => book(2, s, ms, v, h)),
  book(3, 4, 22, 0.9, 1), book(3, 12, 26, 0.95, 2),
  book(4, 4, 38, 0.9, 1), book(4, 12, 31, 0.85, 3),
];
// The coin is spun in bar 4 so that it falls exactly on the loop's downbeat (as in SAMPLE LAB 02).
const coinStart = at(c, 4, 7), fallAt = COIN.startAt + COIN.spinSeconds, lead = (c.cycle - coinStart.t) * 60 / (BPM * 960);
const COIN_EVENTS: Ev[] = [{ ...coinStart, note: { velocity: 0.9, offsetSeconds: +(fallAt - lead).toFixed(6), gate: '3/4', envelope: { attackSeconds: 0.05, releaseSeconds: 0.2 } } }];

export const TRACK_EVENTS: Record<string, Ev[]> = { take: [...WHOLE, ...CELL_EVENTS, ...SINK_EVENTS], mirror: MIRRORED, kick: KICK, snare: SNARE, coin: COIN_EVENTS };
/** What each event of the `take` and `mirror` tracks reads, for the event map. */
export function regionOf(track: string, offsetSeconds: number, playbackRate: number): string | undefined {
  if (track === 'mirror') return 'mirror: TAKE bar 1 reversed';
  if (track !== 'take') return undefined;
  if (offsetSeconds >= LANDING.fromSeconds - 1e-9) return `landing: TAKE bounce, +${LANDING.semis} semitones`;
  if (Math.abs(playbackRate - sinkRate) < 1e-6) return `sink: TAKE 0-${SINK.sourceSeconds} s, ${SINK.semis} semitones`;
  return Math.abs(playbackRate - 1) < 1e-6 ? 'TAKE' : 'cell: TAKE opening, transposed';
}

/** `cycles` identical four-bar cycles: the delivered project uses two, the seam proof three. */
export function mutation(cycles = 2) {
  const o = { cycles };
  return {
    formatVersion: 1,
    title: 'MUTATION (SAMPLE LAB 03, OBJECT ORCHESTRA)',
    description: 'One printed bar of the SAMPLE LAB 02 kitchen band, then three mutations of it: mirrored, chopped 3+3+3+3+2+2 and climbing, sunk a major third, landing with a spun coin and a G# bounce on the A of the downbeat. 120 BPM, four bars (8.000 s); two cycles plus a bar of tail room, the deliverable is the second cycle.',
    bpm: BPM, timeSignature: '4/4', key: 'A minor', bars: 4 * cycles, seed: 1,
    render: { duration: { bars: 4 * cycles + 1 }, tail: 'auto' },
    master: {
      gainDb: -3,
      effects: [
        { type: 'highpass', frequencyHz: 28 },
        { type: 'compressor', thresholdDb: -18, ratio: 2.2, attackMs: 3, releaseMs: 120, makeupGainDb: 4.3 },
        { type: 'saturation', driveDb: 3, mix: 0.25 },
      ],
    },
    tracks: [
      c.track('take', 'TAKE: bar 1 as printed, bar 3 chopped and climbing, bar 4 sunk a major third, then the bounce on G#.', TAKE, TRACK_EVENTS.take!,
        { ...o, gainDb: 1, effects: [{ type: 'saturation', driveDb: 3, mix: 0.2 }] }),
      c.track('mirror', 'TAKE bar 1 reversed (bar 2).', MIRROR, MIRRORED,
        { ...o, gainDb: 2, effects: [{ type: 'saturation', driveDb: 3, mix: 0.2 }] }),
      c.track('kick', 'A fist on a cardboard box; bar 2 mirrors bar 1.', `${S}box.wav`, KICK,
        { ...o, gainDb: -0.5, effects: [{ type: 'lowpass', frequencyHz: 5000 }, { type: 'saturation', driveDb: 9, mix: 0.5 }] }),
      c.track('snare', 'A hardback book on the table: late in bars 1 and 3, early in the mirror, dragging in the sink.', `${S}book.wav`, SNARE,
        { ...o, gainDb: 0, pan: -0.05, effects: [{ type: 'highpass', frequencyHz: 120 }, { type: 'saturation', driveDb: 11, mix: 0.6 }, { type: 'lowpass', frequencyHz: 11000 }] }),
      c.track('coin', 'A spun coin falling flat on the loop downbeat.', `${S}coin.wav`, COIN_EVENTS,
        { ...o, gainDb: 1.5, pan: 0.15, effects: [{ type: 'highpass', frequencyHz: 150 }] }),
    ],
  };
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const dir = join(dirname(fileURLToPath(import.meta.url)), '..', 'projects');
  writeFileSync(join(dir, 'take.json'), JSON.stringify(takeProject(), null, 2) + '\n');
  writeFileSync(join(dir, 'mutation.json'), JSON.stringify(mutation(), null, 2) + '\n');
  console.log(dir);
}
