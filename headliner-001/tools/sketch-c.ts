/** Direction C sketch: GLASS COAST — 104 BPM, A Dorian, straight broken beat. West Coast synthesis as the identity:
 *  a five-note low-pass-gate ostinato in dotted eighths (3 against 4, 5-note cycle) and a metallic LPG hook.
 *  No talkbox: the machine never learns to sing here. 16 bars: lattice 1-4, beat 5-8, hook 9-16. */
import { Song, type Track } from './song.ts';
import { Palette } from './kits.ts';
import * as I from './instruments.ts';
import { m, ms, hitName, Feel } from './theory.ts';

export function buildSketchC(): Song {
  const S = new Song('GLASS COAST (direction C sketch)', 104, 16, 'A minor',
    'Direction C: Buchla-style polyrhythm. Dotted-eighth five-note LPG lattice, straight broken beat, wavefolded pluck bass, metallic LPG hook.', 3);
  const P = new Palette(S, 'c'), feel = new Feel(3301);
  S.section('lattice', 1, 4); S.section('beat', 5, 4); S.section('hook', 9, 8);
  const T: Record<string, Track> = {
    kick: S.track('kick', P.kick, 'Round kick', { gainDb: -6 }),
    snare: S.track('snare', P.snare, 'Dry clap and rim, displaced', { gainDb: -6, pan: 0.05 }),
    hats: S.track('hats', P.hats, 'Straight sixteenth hats and shaker', { gainDb: -2, pan: 0.25 }, [{ type: 'highpass', frequencyHz: 500 }]),
    bass: S.track('bass', P.bass, 'Wavefolded LPG bass', { gainDb: -7 }),
    pluck: S.track('pluck', P.pluck, 'Lattice: dotted-eighth LPG ostinato', { gainDb: -9, pan: -0.25 }, [{ type: 'highpass', frequencyHz: 200 }]),
    pluckSpace: S.track('pluck-space', P.pluckSpace, 'Lattice wet', { gainDb: -11, pan: 0.2 }),
    keys: S.track('keys', P.keys, 'Hook: metallic LPG lead', { gainDb: -7, pan: 0.15 }, [{ type: 'highpass', frequencyHz: 250 }, { type: 'delay', timeMs: 432.692, wet: 0.3 }]),
    pad: S.track('pad', P.pad, 'Glass pad', { gainDb: -8 }, [{ type: 'highpass', frequencyHz: 200 }]),
    atmos: S.track('atmos', P.atmos, 'Air', { gainDb: -12 }, [{ type: 'highpass', frequencyHz: 300 }]),
  };
  const foldBass = (midi: number) => P.bass.add(`fold-${hitName(midi)}`, () => I.lpgPluck(midi, 1.4, 1, 145, 0.75), 'Wavefolded LPG bass: 1:1 FM complex oscillator, sine folder, vactrol gate.', hitName(midi).toUpperCase());
  const lead = (midi: number) => P.keys.add(`lead-${hitName(midi)}`, () => I.lpgPluck(midi, 1.8, 3.01, 147, 1.25), 'Metallic LPG lead: 3.01:1 FM ratio (inharmonic shimmer), brighter fold, vactrol gate.', hitName(midi).toUpperCase());
  const k = P.kickSoft(), cl = P.clap(), rim = P.rimShot(), hat = P.hatClosed(), sh = P.shaker();
  // ---- lattice: five notes cycling every dotted eighth (3 sixteenths), against the 16-step bar
  const cycle = ms('A4', 'C5', 'E5', 'G5', 'D5');
  for (let i = 0, s16 = 0; s16 < 16 * 16; i++, s16 += 3) {
    const bar = Math.floor(s16 / 16) + 1, step = (s16 % 16) + 1, hit = P.pluckNote(cycle[i % 5]!), v = i % 5 === 0 ? 0.75 : 0.55;
    T.pluck!.add({ tick: S.at(bar, step), hit, v }); T.pluckSpace!.add({ tick: S.at(bar, step), hit, v });
  }
  const chords = [['am9', ms('C4', 'E4', 'G4', 'B4')], ['d9', ms('C4', 'E4', 'F#4', 'A4')], ['fmaj7', ms('C4', 'E4', 'A4', 'B4')], ['g6', ms('B3', 'D4', 'E4', 'G4')]] as const;
  for (let b = 1; b <= 16; b++) { const [name, ch] = chords[(b - 1) % 4]!; T.pad!.add({ tick: S.at(b), hit: P.padChord(name, [...ch], 6.2, 1.25), v: b <= 4 ? 0.5 : 0.65, gate: 3840, attack: 0.15, release: 0.5, choke: 'pad' }); }
  T.atmos!.add({ tick: S.at(1), hit: P.rain(24), v: 0.5, attack: 1, release: 2, gate: 16 * 3840 });
  // ---- broken beat (straight, no swing): two bars, snare displaced
  const beat = (bar: number, b: boolean) => {
    for (const s of b ? [1, 4, 9, 14] : [1, 6, 11]) T.kick!.add({ tick: S.at(bar, s), hit: k, v: s === 1 ? 0.95 : 0.8, choke: 'kick', gate: 600, release: 0.04 });
    for (const s of b ? [7, 13] : [5, 12]) T.snare!.add({ tick: S.at(bar, s), hit: cl, v: 0.85 });
    for (const s of b ? [16] : [15]) T.snare!.add({ tick: S.at(bar, s), hit: rim, v: 0.5 });
    for (let s = 1; s <= 16; s++) T.hats!.add({ tick: S.at(bar, s), hit: s % 2 ? hat : sh, v: feel.v(s % 4 === 3 ? 0.55 : 0.32, 0.04), choke: 'hats' });
  };
  const BASS: Record<string, [number, number, string][]> = {
    am9: [[1, 3, 'A1'], [6, 1, 'A1'], [8, 2, 'C2'], [11, 2, 'E2'], [14, 2, 'G1']],
    d9: [[1, 3, 'D2'], [6, 1, 'D2'], [8, 2, 'F#2'], [11, 2, 'A1'], [14, 2, 'C2']],
    fmaj7: [[1, 3, 'F1'], [4, 1, 'F2'], [9, 2, 'C2'], [12, 2, 'E2'], [14, 2, 'A1']],
    g6: [[1, 3, 'G1'], [6, 1, 'G2'], [9, 2, 'D2'], [11, 1, 'E2'], [14, 2, 'B1']],
  };
  for (let b = 5; b <= 16; b++) {
    beat(b, b % 2 === 0);
    const name = chords[(b - 1) % 4]![0];
    for (const [s, len, p] of BASS[name]!) T.bass!.add({ tick: S.at(b, s), hit: foldBass(m(p)), v: s === 1 ? 0.95 : 0.8, gate: len * 240, release: 0.06, choke: 'bass' });
  }
  // ---- hook: metallic LPG lead, syncopated, answered by the lattice
  const HOOK: [number, number, string][] = [[9, 1, 'E5'], [9, 4, 'G5'], [9, 7, 'A5'], [9, 13, 'C6'], [9, 15, 'B5'], [10, 1, 'A5'], [10, 9, 'G5'], [10, 11, 'E5'], [10, 14, 'D5'], [10, 16, 'E5'],
    [11, 1, 'A5'], [11, 3, 'G5'], [11, 4, 'E5'], [11, 8, 'C5'], [11, 10, 'D5'], [12, 1, 'B4'], [12, 3, 'D5'], [12, 4, 'E5'], [12, 12, 'G5'], [12, 14, 'A5'],
    [13, 1, 'E5'], [13, 4, 'G5'], [13, 7, 'A5'], [13, 13, 'C6'], [13, 15, 'D6'], [14, 1, 'E6'], [14, 7, 'D6'], [14, 9, 'C6'], [14, 11, 'A5'], [14, 14, 'G5'],
    [15, 1, 'A5'], [15, 3, 'G5'], [15, 4, 'E5'], [15, 8, 'C5'], [15, 10, 'D5'], [16, 1, 'B4'], [16, 3, 'D5'], [16, 4, 'E5'], [16, 7, 'A4']];
  for (const [bar, step, p] of HOOK) T.keys!.add({ tick: S.at(bar, step), hit: lead(m(p)), v: 0.85 });
  S.render = { duration: { bars: 17 }, tail: 'auto' };
  S.master = { gainDb: -2, effects: [{ type: 'highpass', frequencyHz: 28 }, { type: 'compressor', thresholdDb: -14, ratio: 2, attackMs: 25, releaseMs: 180 }] };
  return S;
}
