/** PERMITPULSE // THE MAPS DISAGREE — challenger score (Direction A, "machine voice").
 *
 * Form, music first:
 *   I   0.000–13.200  150 BPM half-time groove in F minor. Hook from frame 0; the riff and
 *                    the voice trade phrases; at 6.800 the floor tilts into triplets and
 *                    the harmony slips to Gb; the camera build climbs Db → Bbm → Gb → C7.
 *   gap 13.200–13.667  The machine stops mid-word. Only the triplet pulse keeps ticking.
 *   II  13.667–21.000  Metric modulation: that triplet pulse becomes the new sixteenth
 *                    (112.5 BPM). The same hook, sung over Dbmaj9, is suddenly a major-seventh
 *                    melody: the hidden structure.
 *   III 21.000–28.000  Back to 150 on the original beat grid; the hook's long note lands on
 *                    NEVER GUESS in F MAJOR. CTA stabs are the hook's own rhythm; the
 *                    afterglow ends on a bar line at 28.000 so a loop re-enters the hook.
 */
import { at, round6, type Hit, type Score, type TrackDef } from '../build-lib.ts';
import { bass, choir, hat, keys, kick, pluck, sfx, snare, sub, tok, voice, type VoiceParams } from '../synth/instruments.ts';

export const CUT = 41 / 3;                                   // frame 820 @ 60 fps
const CUES_BRIEF = 15.0, CUES_CARD = 17.4, CUES_VERIFY = 18.1, CUES_SEND = 23.6, CUES_URL = 23.8;
export const STOP = 13.2;                                    // the machine stops (bar 9, beat 2)
const k2 = (k: number) => round6(CUT + k * 2 / 15);           // section II sixteenths (112.5 BPM)
const s3 = (bar: number, step = 1) => round6(21.6 + (bar - 1) * 1.6 + (step - 1) * 0.1); // section III
const reverb = (roomSize: number, decaySeconds: number, wet: number) => ({ type: 'reverb', roomSize, decaySeconds, wet });

type Vow = VoiceParams['vowels'];
const V = (midi: number, dur: number, vowels: Vow, extra: Partial<VoiceParams> = {}) => voice({ midi, dur, vowels, ...extra });
const C = (midi: number, dur: number, vowels: Vow, extra: Partial<VoiceParams> & { wide?: boolean } = {}) => choir({ midi, dur, vowels, ...extra });

/** The hook rhythm: syllables on sixteenths 1, 3, 4 (wa-da-WAAH), then 10 and 12 (do-DOOO). */
function hook(t: (step: number) => number, notes: [number, number, number, number, number], level = 1, long = 0.5, tail = 0.42): Hit[] {
  const [wa, da, top, d1, d2] = notes;
  return [
    { at: t(1), v: 0.85 * level, s: V(wa, 0.14, [[0, 'u'], [0.05, 'a']], { pitch: [[0, -2], [0.045, 0]] }) },
    { at: t(3), v: 0.7 * level, s: V(da, 0.08, [[0, 'a']]) },
    { at: t(4), v: 1 * level, s: V(top, long, [[0, 'a'], [long * 0.55, 'a'], [long, 'o']], { pitch: [[0, -1.2], [0.05, 0]], vib: { cents: 28, hz: 5.6, delay: 0.18 } }) },
    ...(d1 ? [{ at: t(10), v: 0.75 * level, s: V(d1, 0.15, [[0, 'o']]) }] : []),
    ...(d2 ? [{ at: t(12), v: 0.9 * level, s: V(d2, tail, [[0, 'o'], [tail * 0.7, 'u']], { pitch: [[0, 0], [tail * 0.7, 0], [tail, -1]], vib: { cents: 32, hz: 5.4, delay: 0.1 } }) }] : []),
  ];
}
const step150 = (start: number) => (step: number) => round6(start + (step - 1) * 0.1);

/** Bass riff, 3-3-2 syncopation. Degrees are semitones above `root` for each scale colour. */
const RIFF = {
  minor: [[1, 0, 0.28, 1, 0.55], [4, 12, 0.08, 0, 0.4], [6, 0, 0.08, 0, 0.35], [7, 3, 0.14, 0.5, 0.6], [10, 0, 0.08, 0, 0.35], [11, 7, 0.12, 0.3, 0.5], [13, 10, 0.1, 0, 0.45], [14, 12, 0.08, 0, 0.4], [16, 8, 0.08, 0, 0.45]],
  hook: [[1, 0, 0.3, 1, 0.55], [7, 3, 0.14, 0.4, 0.6], [11, 7, 0.1, 0.3, 0.5], [14, 10, 0.1, 0, 0.45], [16, 12, 0.08, 0, 0.5]],
  major: [[1, 0, 0.28, 1, 0.5], [4, 12, 0.08, 0, 0.4], [6, 0, 0.08, 0, 0.35], [7, 4, 0.14, 0.5, 0.55], [10, 0, 0.08, 0, 0.35], [11, 7, 0.12, 0.3, 0.5], [13, 9, 0.1, 0, 0.45], [14, 12, 0.08, 0, 0.4], [16, 11, 0.08, 0, 0.45]],
  lydian: [[1, 0, 0.26, 1, 0.55], [4, 12, 0.08, 0, 0.45], [7, 7, 0.14, 0.5, 0.6], [9, 0, 0.08, 0, 0.35], [11, 12, 0.1, 0.3, 0.5], [13, 11, 0.1, 0, 0.5], [14, 12, 0.08, 0, 0.45], [16, 14, 0.08, 0, 0.5]],
  dorian: [[1, 0, 0.26, 1, 0.55], [4, 12, 0.08, 0, 0.45], [7, 3, 0.14, 0.5, 0.6], [9, 0, 0.08, 0, 0.35], [11, 12, 0.1, 0.3, 0.5], [13, 10, 0.1, 0, 0.5], [14, 7, 0.08, 0, 0.45], [16, 14, 0.08, 0, 0.55]],
} as const;
function riff(t: (step: number) => number, kind: keyof typeof RIFF, root: number, level = 1, until = Infinity): Hit[] {
  return RIFF[kind].filter(([step]) => t(step) < until).map(([step, semis, dur, accent, cut]) => ({
    at: t(step), v: (0.85 + 0.15 * accent) * level, s: bass({ midi: root + semis, dur, accent, cut, res: 0.6 }),
    gate: Math.min(dur + 0.01, until - t(step)), release: 0.012, choke: 'bass',
  }));
}
const chord = (start: number, notes: number[], dur: number, vowels: Vow, v = 0.5, extra: Partial<VoiceParams> & { wide?: boolean } = {}): Hit[] =>
  notes.map(m => ({ at: start, v, s: C(m, dur, vowels, extra) }));

export function challenger(version: 'c1' | 'c2' | 'c3'): Score {
  /** C2 includes every C2 change; C3 builds on C2. */
  const C2 = version !== 'c1', C3 = version === 'c3';
  const kickH: Hit[] = [], snareH: Hit[] = [], hatH: Hit[] = [], percH: Hit[] = [], bassH: Hit[] = [], subH: Hit[] = [];
  const voxH: Hit[] = [], choirH: Hit[] = [], keysH: Hit[] = [], arpH: Hit[] = [], picH: Hit[] = [], trnH: Hit[] = [];
  const K = (time: number, v = 1, variant: 'tight' | 'soft' | 'land' = 'tight') => kickH.push({ at: round6(time), s: kick(variant), v });
  const SN = (time: number, v = 0.9, variant: 'main' | 'ghost' | 'big' = 'main') => snareH.push({ at: round6(time), s: snare(variant), v });
  const HH = (time: number, v: number, variant: 'closed' | 'open' | 'tick' | 'accent' = 'closed') => hatH.push({ at: round6(time), s: hat(variant), v, ...(variant === 'closed' || variant === 'open' ? { choke: 'hh' } : {}) });

  // ================================================================ I. THE GROOVE (150 BPM)
  for (let bar = 1; bar <= 5; bar++) {
    for (const s of bar === 4 ? [1, 4, 11] : [1, 11]) if (!(bar === 5 && s === 11)) K(at(bar, s), s === 1 ? 1 : 0.8);
    if (bar < 5) SN(at(bar, 9));
    for (const s of [3, 7, 11, 15]) if (at(bar, s) < 6.8) HH(at(bar, s), 0.55, 'tick');
    if (bar >= 2) for (let s = 1; s <= 16 && at(bar, s) < 6.8; s++) {
      if (s === 15 && bar % 2 === 0) HH(at(bar, s), 0.5, 'open'); else HH(at(bar, s), [0.6, 0.25, 0.42, 0.25][(s - 1) % 4]!);
    }
  }
  picH.push({ at: 1.6, s: sfx('latch', 72), v: 0.9 });                    // the proposed unit lands on the bar-2 downbeat
  picH.push({ at: 3.1, s: sfx('seat', 84), v: 0.85 });                    // Map A seats: the pickup into bar 3
  picH.push({ at: 5.5, s: sfx('servo', 54), v: 0.75 });                   // Map B slides in, rising to 6.800
  picH.push({ at: 6.8, s: sfx('seat', 78), v: 0.7 });                    // ...and seats a tritone away (Gb)

  // The hook and its development
  voxH.push(...hook(step150(0), [72, 72, 75, 73, 72]));
  voxH.push({ at: at(2, 13), v: 0.45, s: V(73, 0.1, [[0, 'o']]) }, { at: at(2, 14), v: 0.5, s: V(72, 0.3, [[0, 'o'], [0.2, 'u']], { vib: { cents: 30, hz: 5.4, delay: 0.08 } }) });
  voxH.push(...hook(step150(at(3)), [72, 72, 75, 73, 72], 0.95));
  voxH.push(...hook(step150(at(4)), [72, 72, 77, 75, 73], 1, 0.5, 0.36));
  // 6.800: the melody turns unstable — a triplet stutter that will not land — then the amber line
  [0, 1, 2].forEach(i => voxH.push({ at: round6(6.8 + i * 0.4 / 3), v: 0.8 - i * 0.1, s: V(73 - (i === 2 ? 1 : 0), 0.09, [[0, 'a'], [0.06, 'e']], { grit: 0.5 }) }));
  voxH.push({ at: 7.2, v: 0.8, s: V(70, 0.28, [[0, 'e'], [0.2, 'a']], { grit: 0.3, pitch: [[0, 0], [0.18, 0], [0.28, -0.6]] }) });
  voxH.push({ at: 7.5, v: 0.85, s: V(80, 1.5, [[0, 'i'], [0.3, 'a'], [1.5, 'o']], { pitch: [[0, 0.6], [0.08, 0], [0.5, 0], [1.5, -1]], vib: { cents: 22, hz: 5.1, delay: 0.3 } }) });

  // Machine answers in bar 2-4: tuned gear toks, a falling Fm7 the voice leaves room for
  for (const bar of [2, 3, 4]) [[4, 77], [7, 75], [10, 72], [13, 68]].forEach(([s, m], i) => percH.push({ at: at(bar, s!), s: tok({ midi: m!, bright: 0.6 }), v: 0.75 - 0.08 * i }));

  // Bass: hook riff, groove riff, then 6.800 slips to Gb in triplets
  bassH.push(...riff(step150(0), 'hook', 29), ...riff(step150(at(2)), 'minor', 29), ...riff(step150(at(3)), 'minor', 29), ...riff(step150(at(4)), 'minor', 29));
  bassH.push({ at: 6.4, v: 1, s: bass({ midi: 29, dur: 0.3, accent: 1, cut: 0.55, res: 0.6 }), gate: 0.31, release: 0.012, choke: 'bass' });
  [0, 3, 5, 6, 8].forEach((i, n) => bassH.push({ at: round6(6.8 + i * 0.4 / 3), v: n === 0 ? 1 : 0.85, s: bass({ midi: [30, 30, 42, 33, 30][n]!, dur: 0.11, accent: n === 0 ? 1 : 0.3, cut: 0.65, res: 0.65 }), gate: 0.12, release: 0.012, choke: 'bass' }));
  // 6.800: the floor tilts — hats and kick/clap move onto the triplet grid; Gb choir
  for (let t = 6.8; t < 9.0 - 1e-6; t = round6(t + 0.4 / 3)) { HH(t, 0.55, 'accent'); HH(round6(t + 0.2 / 3), 0.3, 'tick'); }
  K(6.8); K(round6(7.2 + 0.4 / 3), 0.8); SN(round6(7.2 + 0.8 / 3));
  choirH.push(...chord(at(3), [53, 56, 60, 67], 1.55, [[0, 'u'], [1, 'o']]), ...chord(at(4), [53, 56, 60, 63], 1.55, [[0, 'o'], [1, 'u']]));
  choirH.push(...chord(6.8, [54, 58, 61, 65], 1.15, [[0, 'a'], [0.8, 'o']], 0.62, { attack: 0.03 }));

  // ---------------------------------------------------------------- camera build 8.0–13.2
  // Db (lydian riff) → Bbm (dorian) → Gb (double-time pump) → C7(b9), stop at 13.2 mid-word.
  bassH.push(...riff(step150(at(6)), 'lydian', 25), ...riff(step150(at(7)), 'dorian', 34));
  for (let e = 0; e < 8; e++) bassH.push({ at: round6(at(8) + e * 0.2), v: e % 3 === 0 ? 1 : 0.8, s: bass({ midi: 30 + (e % 2 ? 12 : 0), dur: 0.12, accent: e % 3 === 0 ? 0.8 : 0.2, cut: 0.6 + 0.04 * e, res: 0.65 }), gate: 0.13, release: 0.012, choke: 'bass' });
  bassH.push({ at: at(9), v: 1, s: bass({ midi: 36, dur: 0.38, accent: 1, cut: 0.8, res: 0.7 }), gate: 0.4, release: 0.008, choke: 'bass' });
  choirH.push(...chord(at(6), [49, 56, 60, 63], 1.55, [[0, 'u'], [1.2, 'o']], 0.5), ...chord(at(7), [53, 56, 60, 61], 1.55, [[0, 'o'], [1, 'a']], 0.52));
  choirH.push(...chord(at(8), [54, 58, 61, 65], 1.55, [[0, 'a'], [1.4, 'e']], 0.56), ...chord(at(9), [52, 58, 61, 64], 0.4, [[0, 'a']], 0.62, { attack: 0.02 }));
  // Kick and clap escalation: syncopated → four-on-the-floor double-time → roll into the stop
  [1, 7, 11].forEach(s => K(at(6, s), s === 1 ? 1 : 0.8)); SN(at(6, 9)); SN(at(6, 16), 0.5, 'ghost');
  [1, 4, 7, 11, 14].forEach(s => K(at(7, s), s === 1 ? 1 : 0.78)); SN(at(7, 9)); SN(at(7, 12), 0.5, 'ghost'); SN(at(7, 16), 0.55, 'ghost');
  [1, 5, 9, 13, 15].forEach(s => K(at(8, s), 0.95)); SN(at(8, 5)); SN(at(8, 13)); SN(at(8, 16), 0.6, 'ghost');
  K(at(9)); [1, 2, 3, 4].forEach(s => SN(at(9, s), 0.55 + 0.12 * s, s < 4 ? 'ghost' : 'main'));
  // Straight sixteenths return from 9.0 against the continuing triplets (3 against 4, rising)
  for (let t = 9.0; t < 13.2 - 1e-6; t = round6(t + 0.1)) HH(t, 0.25 + 0.3 * (t - 9) / 4.2 + (Math.round(t * 10) % 4 === 0 ? 0.15 : 0));
  for (let t = 9.0 + 0.4 / 3; t < 13.2 - 1e-6; t = round6(t + 0.4 / 3)) HH(t, 0.3 + 0.3 * (t - 9) / 4.2, 'tick');
  // Arp enters with the camera: 16ths through each chord, brightening
  const arpChords: [number, number[]][] = [[9.0, [61, 68, 65, 68, 72, 68, 65, 68]], [at(7), [58, 65, 61, 65, 72, 65, 61, 65]], [at(8), [54, 61, 58, 61, 65, 61, 58, 61]], [at(9), [60, 67, 64, 70, 73, 70, 64, 67]]];
  for (let t = 9.0, i = 0; t < 13.2 - 1e-6; t = round6(t + 0.1), i++) {
    const notes = [...arpChords].reverse().find(([start]) => t >= start - 1e-6)![1];
    arpH.push({ at: t, s: pluck({ midi: notes[i % 8]!, dur: 0.09, bright: 0.3 + 0.6 * (t - 9) / 4.2 }), v: [0.9, 0.5, 0.7, 0.5][i % 4]! });
  }
  // Voice develops instead of repeating: rising "wa-da" pairs, a held cry over Gb, the hook cut off on C7
  [[0, 77], [1, 77], [3, 80], [4, 80], [6, 82], [7, 82], [9, 84], [10, 84]].forEach(([k, m]) => voxH.push({ at: round6(at(7) + k! * 0.4 / 3), v: 0.62 + 0.03 * k!, s: V(m!, 0.08, [[0, k! % 3 === 0 ? 'u' : 'a'], [0.05, 'a']], { pitch: [[0, -1], [0.03, 0]] }) }));
  voxH.push({ at: at(8), v: 0.9, s: V(77, 1.45, [[0, 'a'], [0.9, 'a'], [1.45, 'e']], { pitch: [[0, -2], [0.12, 0]], vib: { cents: 26, hz: 5.8, delay: 0.25 } }) });
  voxH.push(...hook(step150(at(9)), [72, 72, 76, 0, 0], 1, 0.5));            // ...cut off mid-word by the stop

  // ================================================================ THE STOP (13.2) AND THE GAP
  trnH.push({ at: 13.2, s: sfx('stop', 41), v: 0.9 });
  // Only the conflicting triplet pulse survives, re-phased to land on the cut: C6 Db6 Eb6 → (F6)
  [[-3, 84], [-2, 85], [-1, 87]].forEach(([k, m]) => percH.push({ at: k2(k!), s: tok({ midi: m!, bright: 0.4, len: 0.12 }), v: 0.55 + 0.1 * (k! + 3) }));

  // ================================================================ II. THE REVEAL (112.5 BPM)
  // The triplet pulse is now the sixteenth. Same hook — sung over Dbmaj9 it is a major-seventh melody.
  trnH.push({ at: CUT, s: sfx('snap', 72), v: 0.6 });
  percH.push({ at: CUT, s: tok({ midi: 89, bright: 0.4, len: 0.16 }), v: 0.7 });
  if (C2) {
    // C2: the new world leaks in backwards under the ticking (quiet), then blooms wide and bright on frame 820
    trnH.push({ at: round6(CUT - 0.9 + 0.003), s: sfx('reverse', 61), v: 0.4 });
    [61, 65, 68, 72, 75, 80].forEach((m, i) => keysH.push({ at: CUT, s: keys({ midi: m, dur: 0.5, pan: -0.7 + 0.28 * i }), v: 0.62, gate: 1.2, release: 0.4 }));
  }
  const harmony: [number, number[], Vow, number][] = [
    [0, [49, 56, 60, 63, 65], [[0, 'u'], [0.25, 'a'], [2, 'o']], 2.1], [16, [46, 53, 56, 60, 61], [[0, 'o'], [1.4, 'a']], 1.55],
    [28, [54, 58, 61, 65, 68], [[0, 'a'], [1.5, 'o']], 1.55], [40, [48, 56, 60, 63], [[0, 'o'], [1, 'a']], 1.05], [48, [51, 56, 58, 63], [[0, 'a'], [0.8, 'e']], 0.8],
  ];
  harmony.forEach(([k, notes, vowels, dur]) => choirH.push(...chord(k2(k), notes, dur, C2 && k === 0 ? [[0, 'a'], [2, 'o']] : vowels, k === 0 ? 0.62 : 0.5, { attack: k === 0 ? 0.035 : 0.2, ...(C2 ? { wide: true } : {}) })));
  ([[0, 25, 2.1], [16, 34, 1.55], [28, 30, 1.55], [40, 32, 1.05]] as const).forEach(([k, m, d]) => subH.push({ at: k2(k), s: sub({ midi: m, dur: d }), v: 0.9 }));
  voxH.push(...hook((step) => k2(step - 1), [72, 72, 75, 73, 72], 0.9, 0.75, 0.75).map((h, i) => i === 4 ? { ...h, at: CUES_BRIEF } : h));
  // Answer phrase after the card cut: the line climbs to F over Gbmaj7 (its major seventh)
  [[26, 68, 0.12], [27, 70, 0.12], [28, 77, 0.9], [36, 75, 0.14], [37, 73, 0.5]].forEach(([k, m, d]) => voxH.push({ at: k2(k!), v: 0.78, s: V(m!, d!, [[0, 'a'], [d! * 0.7, 'o']], { vib: { cents: 24, hz: 5.4, delay: 0.2 } }) }));
  // Glass keys keep the new sixteenth moving in 3-3-2 accents
  const keyNotes: [number, number[]][] = [[0, [61, 65, 68, 72, 75, 72, 68, 65]], [16, [58, 61, 65, 68, 72, 68, 65, 61]], [28, [66, 70, 73, 77, 80, 77, 73, 70]], [40, [60, 63, 68, 72, 75, 72, 68, 63]]];
  for (let k = 0; k < 54; k++) {
    const notes = [...keyNotes].reverse().find(([start]) => k >= start)![1];
    keysH.push({ at: k2(k), s: keys({ midi: notes[k % 8]!, dur: 0.12, ...(C2 ? { pan: [-0.6, -0.3, 0, 0.3, 0.6, 0.3, 0, -0.3][k % 8]! } : {}) }), v: [0.6, 0.3, 0.3, 0.5, 0.3, 0.3, 0.5, 0.3][k % 8]! * (k < 10 ? 0.6 + 0.04 * k : 1), gate: 0.22, release: 0.12 });
    HH(k2(k), k % 4 === 0 ? 0.42 : 0.24, 'tick');
  }
  [0, 10, 16, 26, 28, 32, 42, 48, 52].forEach(k => K(k2(k), k === 28 ? 0.8 : 0.65, 'soft'));
  [24, 40, 44].forEach(k => SN(k2(k), k === 24 ? 0.45 : 0.6, k === 24 ? 'ghost' : 'main'));
  trnH.push({ at: CUES_CARD, s: sfx('snap', 72), v: 0.3 });
  picH.push({ at: CUES_VERIFY, s: sfx('zip', 75), v: 0.7 });              // the amber underline draws itself (Gb pentatonic)
  // Pre-payoff lift: acid bass returns on Ab, a short snare climb, voice rising
  bassH.push(...[40, 43, 46, 48, 50, 51, 52, 53].map((k, i) => ({ at: k2(k), v: 0.8 + 0.025 * i, s: bass({ midi: [32, 32, 44, 32, 34, 34, 36, 36][i]!, dur: 0.11, accent: i >= 6 ? 0.8 : 0.3, cut: 0.4 + 0.05 * i, res: 0.62 }), gate: 0.12, release: 0.012, choke: 'bass' })));
  [52, 53].forEach(k => SN(k2(k), 0.55 + 0.1 * (k - 52), 'ghost'));
  [[48, 68], [50, 70], [52, 72], [53, 72]].forEach(([k, m]) => voxH.push({ at: k2(k!), v: 0.7, s: V(m!, 0.1, [[0, 'u'], [0.05, 'a']]) }));

  // ================================================================ III. NEVER GUESS (150 BPM)
  // Pickup on the brand cut: the amber line zips up while the hook re-enters; WAAH lands on 21.500.
  picH.push({ at: C3 ? 21.0 : 21.03, s: sfx('zip', 77), v: 0.75 });      // C3: starts on the brand-cut frame itself
  SN(21.0, 0.45, 'ghost'); SN(21.1, 0.55, 'ghost');
  voxH.push(...hook(step150(21.2), [72, 72, 77, 74, 72], 1.05, 0.55, 0.5));   // F MAJOR: WAAH = F5, sigh D–C
  if (C2) voxH.push({ at: 21.5, v: 0.72, s: V(81, 0.55, [[0, 'a'], [0.3, 'a'], [0.55, 'o']], { pitch: [[0, -1.2], [0.05, 0]], vib: { cents: 26, hz: 5.3, delay: 0.18 } }) }); // C2: harmony a third above
  choirH.push(...chord(21.5, [41, 53, 57, 60, 65, 69], 1.65, [[0, 'a'], [1.2, 'o']], 0.6, { attack: 0.02 }));
  K(21.5, C3 ? 0.8 : 1, 'land'); SN(21.5, C3 ? 0.55 : 0.9, 'big'); HH(21.5, 0.6, 'open');
  if (C3) {
    // C3: a real chorus lift — the bright upper choir, the arp back in F major, open hats on the offbeats
    choirH.push(...chord(21.5, [65, 69, 72, 77], 1.6, [[0, 'a'], [1.3, 'o']], 0.5, { attack: 0.02, wide: true }));
    const lift: [number, number[]][] = [[21.6, [65, 69, 72, 77, 81, 77, 72, 69]], [23.2, [58, 62, 65, 70, 74, 70, 65, 62]]];
    for (let t = 21.6, i = 0; t < 24.8 - 1e-6; t = round6(t + 0.1), i++) {
      const notes = t >= 23.2 ? lift[1]![1] : lift[0]![1];
      arpH.push({ at: t, s: pluck({ midi: notes[i % 8]!, dur: 0.09, bright: 0.75 }), v: [0.85, 0.45, 0.65, 0.45][i % 4]! });
    }
    for (let bar = 1; bar <= 2; bar++) for (const st of [3, 7, 11, 15]) HH(s3(bar, st), 0.45, 'open');
  }
  subH.push({ at: 21.5, s: sub({ midi: 29, dur: 1.6 }), v: 1 });
  bassH.push({ at: 21.5, v: 1, s: bass({ midi: 29, dur: 0.1, accent: 1, cut: 0.7, res: 0.6 }), gate: 0.1, release: 0.012, choke: 'bass' });
  arpH.push(...[65, 69, 72, 77].map(m => ({ at: 21.5, s: pluck({ midi: m, dur: 0.35, bright: 0.9 }), v: 0.7 })));
  // Bars A–D (21.6, 23.2, 24.8, 26.4): the groove in F major
  const majorBars: [number, keyof typeof RIFF, number][] = [[1, 'major', 29], [2, 'major', 34], [3, 'dorian', 34], [4, 'major', 29]];
  for (const [bar, kind, root] of majorBars) {
    bassH.push(...riff(step150(s3(bar)), kind, root, bar === 4 ? 0.9 : 1, bar === 4 ? 27.4 : Infinity).filter(h => h.at > 21.55));
    for (const s of bar === 4 ? [1] : [1, 11]) if (s3(bar, s) > 21.55) K(s3(bar, s), s === 1 ? 1 : 0.8);
    if (bar < 4) SN(s3(bar, 9));
    for (let s = 1; s <= 16; s++) {
      const t = s3(bar, s);
      if (bar < 4) HH(t, [0.6, 0.25, 0.42, 0.25][(s - 1) % 4]!);
      if (s % 4 === 3) HH(t, bar === 4 ? 0.5 - 0.05 * s / 4 : 0.5, 'tick');   // ticks run on into the loop
    }
  }
  choirH.push(...chord(s3(2), [46, 53, 58, 62, 65, 72], 1.55, [[0, 'o'], [1, 'a']], 0.52), ...chord(s3(3), [46, 53, 58, 61, 65, 67], 1.55, [[0, 'o'], [1.2, 'u']], 0.5));
  if (!C3) choirH.push(...chord(s3(4), [41, 53, 57, 60, 65], 0.95, [[0, 'u'], [0.8, 'o']], 0.46));
  else {
    // C3 ending: a dry F-major pluck on the last bar line and a rhythmic button at 27.2 — no wash to fade,
    // the master is silent before 28.000 so a loop re-enters the hook cleanly.
    arpH.push(...[53, 57, 60, 65].map(m => ({ at: s3(4), s: pluck({ midi: m, dur: 0.25, bright: 0.6 }), v: 0.7 })));
    arpH.push({ at: s3(4, 9), s: pluck({ midi: 77, dur: 0.12, bright: 0.7 }), v: 0.6 });
    bassH.push({ at: s3(4, 9), v: 0.95, s: bass({ midi: 41, dur: 0.12, accent: 1, cut: 0.5, res: 0.55 }), gate: 0.13, release: 0.012, choke: 'bass' });
  }
  // The PermitPulse signature on the CTA: the hook's own wa-da-WAAH, SEND IT (23.6) / URL (23.8) / F (23.9)
  voxH.push(...hook(step150(CUES_SEND), [72, 72, 77, 0, 0], 1, 0.6));
  if (C2) voxH.push({ at: 23.9, v: 0.68, s: V(81, 0.6, [[0, 'a'], [0.33, 'a'], [0.6, 'o']], { pitch: [[0, -1.2], [0.05, 0]], vib: { cents: 26, hz: 5.3, delay: 0.18 } }) });
  [CUES_SEND, CUES_URL].forEach(t => { arpH.push(...[65, 70, 74].map(m => ({ at: t, s: pluck({ midi: m, dur: 0.12, bright: 0.8 }), v: C2 ? 0.85 : 0.65 }))); SN(t, C2 ? 0.75 : 0.55, 'ghost'); });
  arpH.push(...[65, 69, 72, 77].map(m => ({ at: round6(CUES_URL + 0.1), s: pluck({ midi: m, dur: 0.4, bright: 0.85 }), v: 0.62 })));
  // Afterglow: the minor sigh one last time over Bbm6, then the riff alone toward the loop point
  voxH.push({ at: s3(3, 10), v: 0.7, s: V(73, 0.15, [[0, 'o']]) }, { at: s3(3, 12), v: 0.8, s: V(72, 0.6, [[0, 'o'], [0.45, 'u']], { vib: { cents: 30, hz: 5.2, delay: 0.12 }, pitch: [[0, 0], [0.45, 0], [0.6, -1]] }) });
  [[4, 77], [7, 76], [10, 72], [13, 69]].forEach(([s, m], i) => percH.push({ at: s3(3, s!), s: tok({ midi: m!, bright: 0.5 }), v: 0.6 - 0.07 * i }));
  SN(s3(4, 9), 0.85); trnH.push({ at: s3(4, 9), s: sfx('seat', 89), v: 0.5 });

  // The stop is absolute: everything still sounding at 13.2 is released there (8 ms).
  for (const list of [kickH, snareH, hatH, bassH, voxH, choirH, arpH, subH]) for (const h of list)
    if (h.at < STOP && h.at > STOP - 2.2 && (h.gate === undefined || h.at + h.gate > STOP)) Object.assign(h, { gate: round6(STOP - h.at), attack: 0, release: 0.008 });

  const lane = (g: number, points: [number, number, boolean?][] = []) => [...points.map(([t, v, l]) => [t, g + v, l] as [number, number, boolean?]), [27.86, g, true], [27.98, -40]] as [number, number, boolean?][];
  const tracks: TrackDef[] = [
    { id: 'kick', role: 'music', description: 'Machine kick; half-time groove, double-time in the build, soft in the reveal.', hits: kickH, gainDb: -7, effects: [{ type: 'highpass', frequencyHz: 28 }], gain: lane(-7) },
    { id: 'snare', role: 'music', description: 'Mechanical clap/snare: backbeat, displaced at 6.8, roll into the stop.', hits: snareH, gainDb: C2 ? 0 : -6, effects: [reverb(0.35, 0.8, 0.18)], gain: lane(C2 ? 0 : -6) },
    { id: 'hats', role: 'music', description: 'Hats and escapement ticks: 16ths, the triplet layer, the new sixteenth after the cut.', hits: hatH, gainDb: C2 ? -4 : -8, effects: [{ type: 'highpass', frequencyHz: 2500 }], gain: lane(C2 ? -4 : -8) },
    { id: 'perc', role: 'music', description: 'Tuned gear toks: the machine answers the voice; the re-phased triplet pulse in the gap.', hits: percH, gainDb: C2 ? -9 : -12, effects: [{ type: 'delay', timeMs: 300, wet: 0.12 }, reverb(0.4, 0.9, 0.15)], gain: lane(C2 ? -9 : -12) },
    { id: 'bass', role: 'music', description: 'Ladder acid bass riff (3-3-2): F minor, Gb triplets, build pump, Ab lift, F major.', hits: bassH, gainDb: -8, effects: [{ type: 'highpass', frequencyHz: 30 }, { type: 'saturation', driveDb: 3, mix: 0.25 }, { type: 'compressor', thresholdDb: -18, ratio: 3, attackMs: 5, releaseMs: 80, makeupGainDb: 2 }], gain: lane(-8) },
    { id: 'sub', role: 'music', description: 'Round sub under the reveal and the payoff.', hits: subH, gainDb: C2 ? -18 : -9, effects: [{ type: 'highpass', frequencyHz: 24 }], gain: lane(C2 ? -18 : -9, C2 ? [[21.45, 0], [21.5, 5]] : []) },
    { id: 'voice', role: 'music', description: 'The machine voice: hook, stutter, amber line, build chops, reveal, NEVER GUESS, signature.', hits: voxH, gainDb: -4, effects: [{ type: 'highpass', frequencyHz: 160 }, { type: 'compressor', thresholdDb: -20, ratio: 3, attackMs: 4, releaseMs: 90, makeupGainDb: 2 }, { type: 'delay', timeMs: 300, wet: 0.13 }, reverb(0.5, 1.3, 0.17)],
      gain: lane(-4, C2 ? [[0, 2], [1.55, 2, true], [1.6, 0], [CUT, 0], [CUT + 0.01, -2], [20.4, -2, true], [21.0, 1]] : [[CUT, 0], [CUT + 0.01, -2], [20.4, -2, true], [21.0, 0]]) },
    { id: 'choir', role: 'music', description: 'Machine choir: Fm, Gb, build chords, the Dbmaj9 reveal, F major payoff.', hits: choirH, gainDb: -11, effects: [{ type: 'highpass', frequencyHz: 120 }, reverb(0.75, 2.2, 0.3)],
      gain: lane(-11, C2 ? [[8.0, 0, true], [13.15, 4], [CUT, 3], [CUT + 1.5, 3, true], [15.8, 1], [21.45, 1], [21.5, 4]] : [[8.0, 0, true], [13.15, 4], [CUT, 1], [21.45, 1], [21.5, 3]]) },
    { id: 'keys', role: 'music', description: 'FM glass keys: the new sixteenth in the reveal.', hits: keysH, gainDb: -16, effects: [{ type: 'highpass', frequencyHz: 200 }, { type: 'delay', timeMs: 400, wet: 0.15 }, reverb(0.6, 1.8, 0.25)], gain: lane(-16) },
    { id: 'arp', role: 'music', description: 'Plucked arp under the camera build; payoff and CTA stabs.', hits: arpH, gainDb: -14, effects: [{ type: 'highpass', frequencyHz: 180 }, { type: 'delay', timeMs: 300, wet: 0.15 }, reverb(0.55, 1.4, 0.2)], gain: lane(-14, [[9.0, -4, true], [13.15, 2]]) },
    { id: 'sfx-picture', role: 'sound-design', description: 'Picture-locked tactile events: unit latch (1.6), plate seats (3.1, 6.8), servo (5.5), underline zips (18.1, 21.0).', hits: picH, gainDb: -10, effects: [reverb(0.4, 0.9, 0.14)], gain: lane(-10), panLane: [[5.5, 0.55, true], [6.8, 0]] },
    { id: 'sfx-transitions', role: 'sound-design', description: 'Editorial transitions: the machine stop (13.2), paper snaps on the cuts (13.667, 17.4), final seat.', hits: trnH, gainDb: -10, effects: [reverb(0.45, 1.0, 0.15)], gain: lane(-10) },
  ];
  return {
    id: `challenger-${version}`, title: `PermitPulse - The Maps Disagree (Challenger ${version.toUpperCase()})`,
    description: 'Challenger score, Direction A (machine voice). 150 BPM half-time groove in F minor; metric modulation to 112.5 BPM on the 13.667 cut; F major payoff on NEVER GUESS. Generated by challenger/build.ts.',
    seconds: 28, tracks,
    // C3 master: a fast 2.5:1 glue compressor trims the stacked downbeat transients (about 2.5 dB of crest),
    // makeup set to match V3's loudness (-15.6 LUFS) for a fair A/B.
    master: C3 ? { gainDb: 6, effects: [{ type: 'highpass', frequencyHz: 20 }, { type: 'compressor', thresholdDb: -16, ratio: 2.5, attackMs: 2, releaseMs: 150, makeupGainDb: 1.7 }] }
      : { gainDb: C2 ? 5 : 3, effects: [{ type: 'compressor', thresholdDb: -16, ratio: C2 ? 2.5 : 2, attackMs: 15, releaseMs: 160 }] },
    sync: [
      { id: 'hook', track: 'voice', at: 0, roles: ['hook', 'wa'] }, { id: 'unit-lands', track: 'sfx-picture', at: 1.6, roles: ['latch', 'bar-2-downbeat'] },
      { id: 'source-a-seats', track: 'sfx-picture', at: 3.1, roles: ['seat', 'pickup'] }, { id: 'source-b-reveal', track: 'sfx-picture', at: 5.5, roles: ['servo'] },
      { id: 'maps-disagree', track: 'bass', at: 6.8, roles: ['triplet-flip', 'gb'] }, { id: 'amber-trace', track: 'voice', at: 7.5, roles: ['amber-line'] },
      { id: 'camera-move', track: 'arp', at: 9.0, roles: ['arp-enters', 'build'] }, { id: 'double-time', track: 'kick', at: at(8), roles: ['four-on-floor'] },
      { id: 'machine-stop', track: 'sfx-transitions', at: 13.2, roles: ['stop', 'gap'] }, { id: 'evidence-cut', track: 'choir', at: CUT, roles: ['metric-modulation', 'dbmaj9'] },
      { id: 'brief-established', track: 'voice', at: CUES_BRIEF, roles: ['hook-resolves'] }, { id: 'finding-card', track: 'choir', at: CUES_CARD, roles: ['gbmaj7'] },
      { id: 'verify-underline', track: 'sfx-picture', at: CUES_VERIFY, roles: ['zip'] }, { id: 'brand-cut', track: 'sfx-picture', at: 21.0, roles: ['pickup', 'zip'] },
      { id: 'never-guess', track: 'voice', at: 21.5, roles: ['waah', 'f-major'] }, { id: 'send-it', track: 'voice', at: CUES_SEND, roles: ['signature-wa'] },
      { id: 'url', track: 'voice', at: CUES_URL, roles: ['signature-da'] }, { id: 'loop-point', track: 'kick', at: s3(4), roles: ['last-bar'] },
    ],
  };
}
