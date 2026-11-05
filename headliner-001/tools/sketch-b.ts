/** Direction B sketch: IRON PSALM — 140 BPM half-time industrial hymn in D minor. The hook is the bass riff;
 *  a dark chant answers it. Straight grid (no swing): machine-forward. 24 bars: intro 1-8, riff 9-16, psalm 17-24. */
import { Song, type Track } from './song.ts';
import { Palette } from './kits.ts';
import * as I from './instruments.ts';
import { m, ms, hitName, Feel } from './theory.ts';
import type { VNote } from './instruments.ts';

export function buildSketchB(): Song {
  const S = new Song('IRON PSALM (direction B sketch)', 140, 24, 'D minor',
    'Direction B: industrial half-time hymn. A wavefolded riff is the hook; anvils in 3-3-2; a chanted choir answers.', 2);
  const P = new Palette(S, 'b'), feel = new Feel(2201);
  S.section('intro', 1, 8); S.section('riff', 9, 8); S.section('psalm', 17, 8);
  const T: Record<string, Track> = {
    kick: S.track('kick', P.kick, 'Industrial kick tuned to D1', { gainDb: -5 }),
    snare: S.track('snare', P.snare, 'Big snare + clap on beat 3', { gainDb: -3 }),
    hats: S.track('hats', P.hats, 'Hats and ticks, straight', { gainDb: -2, pan: -0.2 }, [{ type: 'highpass', frequencyHz: 500 }]),
    metal: S.track('metal', P.metal, 'Anvil, pipe, chain, toms', { gainDb: -6, pan: 0.15 }),
    bass: S.track('bass', P.bass, 'Sub foundation under the riff', { gainDb: -10 }),
    grit: S.track('grit', P.grit, 'The riff: wavefolded grit bass', { gainDb: -6 }, [{ type: 'saturation', driveDb: 4, mix: 0.35 }]),
    choir: S.track('choir', P.choir, 'Chanted choir chords', { gainDb: -5 }, [{ type: 'highpass', frequencyHz: 160 }]),
    voice: S.track('voice', P.voice, 'Chant lead (dark formant voice)', { gainDb: -5 }, [{ type: 'highpass', frequencyHz: 140 }, { type: 'compressor', thresholdDb: -20, ratio: 3, attackMs: 8, releaseMs: 140, makeupGainDb: 2 }]),
    voiceSpace: S.track('voice-space', P.voiceSpace, 'Chant wet', { gainDb: -7 }),
    pad: S.track('pad', P.pad, 'Low strings drone', { gainDb: -7 }, [{ type: 'highpass', frequencyHz: 150 }]),
    fx: S.track('fx', P.fx, 'Impacts, booms', { gainDb: -6 }),
  };
  const kick = P.kick.add('kick-iron', () => I.kick({ f0: I.midiHz(26), decay: 0.2, drive: 3, click: 1.5, start: 380, seed: 13 }), 'Industrial kick: 380 Hz -> D1 (36.7 Hz) drop, 3x tanh drive, heavy click.', 'D1');
  const boom = P.kick.add('boom-d', () => I.kick({ f0: I.midiHz(26), len: 2.6, decay: 1.0, drive: 2.6, click: 0.7, seed: 17 }), 'Long D1 boom.', 'D1');
  const anvil = P.metal.add('anvil-d', () => I.modal(I.midiHz(86), [1, 2.76, 5.4, 8.93], [0.6, 0.35, 0.18, 0.09], [1, 0.55, 0.3, 0.15], 1.4, 0.6, 95), 'Anvil tuned to D6 (bar modes).', 'D6');
  const pipe = P.metal.add('pipe-a', () => I.modal(I.midiHz(57), [1, 2.0, 3.01, 4.03], [0.4, 0.3, 0.2, 0.1], [1, 0.5, 0.3, 0.2], 1.0, 0.6, 97, 0.6), 'Pipe tuned to A3.', 'A3');
  const ch = P.chain(), tl = P.metal.add('tom-d', () => I.tom(I.midiHz(38), 0.7, 115), 'Tom D2.', 'D2'), th = P.metal.add('tom-a', () => I.tom(I.midiHz(45), 0.6, 117), 'Tom A2.', 'A2');
  const sn = P.snareVerb(), cl = P.clap(), gh = P.ghost(), hat = P.hatClosed(), tk = P.tick();
  // ---- the riff (2 bars), [step, len, pitch, held?]
  const RIFF: [number, number, string, boolean][][] = [
    [[1, 3, 'D2', false], [4, 1, 'D2', false], [5, 2, 'F2', false], [7, 1, 'E2', false], [8, 3, 'D2', true], [11, 2, 'A1', true], [13, 1, 'C2', false], [14, 1, 'C#2', false], [15, 2, 'D2', true]],
    [[1, 4, 'Bb1', true], [5, 2, 'A1', false], [7, 1, 'G1', false], [8, 4, 'F1', true], [13, 1, 'G1', false], [14, 1, 'A1', false], [15, 1, 'Bb1', false], [16, 1, 'C#2', false]],
  ];
  const riff = (bar: number, half: number, level: number) => {
    for (const [step, len, p, held] of RIFF[half]!) {
      const midi = m(p), tick = S.at(bar, step);
      T.grit!.add({ tick, hit: P.gritNote(midi, !held), v: level * (held ? 0.9 : 0.8), gate: len * 240 - 25, release: 0.03, choke: 'grit' });
      if (step === 1 || held) T.bass!.add({ tick, hit: P.bassNote(midi - 12 >= 26 ? midi - 12 : midi), v: level * 0.9, gate: len * 240 - 25, attack: 0.004, release: 0.04, choke: 'bass' });
    }
  };
  const drums = (bar: number, b: boolean, full: number) => {
    for (const s of b ? [1, 3, 11] : [1, 7, 11]) T.kick!.add({ tick: S.at(bar, s), hit: kick, v: s === 1 ? 0.95 : 0.8, choke: 'kick', gate: 700, release: 0.05 });
    T.snare!.add({ tick: S.at(bar, 9), hit: sn, v: 0.92 }); T.snare!.add({ tick: S.at(bar, 9, 6), hit: cl, v: 0.6 });
    if (b) for (const s of [15, 16]) T.snare!.add({ tick: S.at(bar, s), hit: gh, v: feel.v(0.3, 0.05) });
    for (const [s, h, v] of (b ? [[7, anvil, 0.7], [14, ch, 0.6]] : [[4, anvil, 0.55], [12, pipe, 0.6], [15, anvil, 0.75]]) as [number, string, number][]) T.metal!.add({ tick: S.at(bar, s), hit: h, v });
    for (let s = 1; s <= 16; s++) {
      if (full < 1 && s % 2 === 0) continue;
      T.hats!.add({ tick: S.at(bar, s, feel.t(2)), hit: s % 4 === 3 ? tk : hat, v: feel.v(s % 2 ? 0.5 : 0.3, 0.05), choke: 'hats' });
    }
  };
  // ---- intro: drone, boom, anvils in 3-3-2 eighths, the riff teased in the dark
  const dm = ms('D4', 'F4', 'A4'), bb = ms('D4', 'F4', 'Bb4'), gm = ms('D4', 'G4', 'Bb4'), aa = ms('C#4', 'E4', 'A4');
  T.fx!.add({ tick: S.at(1), hit: P.impact(), v: 0.8 }); T.kick!.add({ tick: S.at(1), hit: boom, v: 0.9 });
  T.choir!.add({ tick: S.at(1), hit: P.choirChord('dm-u', dm, 'u', 7), v: 0.8, gate: 4 * 3840 - 480, attack: 1.2, release: 1.2 });
  T.choir!.add({ tick: S.at(5), hit: P.choirChord('bb-u', bb, 'u', 7), v: 0.8, gate: 4 * 3840 - 480, attack: 0.8, release: 1.2 });
  for (let b = 1; b <= 8; b++) for (const s of [1, 7, 13]) T.metal!.add({ tick: S.at(b, s), hit: anvil, v: 0.35 + 0.05 * b });
  for (let b = 5; b <= 8; b++) riff(b, (b - 5) % 2, 0.45 + 0.08 * (b - 5));
  for (let s = 1; s <= 16; s++) T.metal!.add({ tick: S.at(8, s), hit: s % 2 ? tl : th, v: 0.3 + s * 0.035 });
  // ---- riff section
  T.kick!.add({ tick: S.at(9), hit: boom, v: 0.85 }); T.fx!.add({ tick: S.at(9), hit: P.impact(), v: 0.7 });
  for (let b = 9; b <= 16; b++) { drums(b, b % 2 === 0, 0.5); riff(b, (b - 9) % 2, 1); }
  T.pad!.add({ tick: S.at(9), hit: P.padChord('pad-dm', ms('D3', 'A3', 'D4', 'F4'), 6.2, 0.8), v: 0.6, gate: 8 * 3840, attack: 2, release: 1.5 });
  // ---- psalm: chant over Dm Bb Gm A, hats doubled, riff continues
  T.kick!.add({ tick: S.at(17), hit: boom, v: 0.9 }); T.fx!.add({ tick: S.at(17), hit: P.impact(), v: 0.85 });
  const prog = [['dm-o', dm], ['bb-o', bb], ['gm-o', gm], ['a-o', aa]] as const;
  prog.forEach(([name, chord], i) => T.choir!.add({ tick: S.at(17 + 2 * i), hit: P.choirChord(name, [...chord], 'o', 6), v: 0.75, gate: 2 * 3840 - 120, attack: 0.25, release: 0.6, choke: 'choir' }));
  for (let b = 17; b <= 24; b++) { drums(b, b % 2 === 0, 1); riff(b, (b - 17) % 2, 1); }
  const chant: [number, number, number, string][] = [[17, 1, 8, 'A4'], [17, 9, 8, 'D5'], [18, 1, 4, 'C5'], [18, 5, 4, 'Bb4'], [18, 9, 8, 'A4'], [19, 1, 8, 'F4'], [19, 9, 8, 'Bb4'], [20, 1, 4, 'A4'], [20, 5, 4, 'G4'], [20, 9, 8, 'F4'],
    [21, 1, 8, 'G4'], [21, 9, 4, 'Bb4'], [21, 13, 4, 'D5'], [22, 1, 8, 'C5'], [22, 9, 8, 'Bb4'], [23, 1, 12, 'A4'], [23, 13, 4, 'C#5'], [24, 1, 12, 'D5']];
  const notes: VNote[] = chant.map(([bar, step, len, p]) => ({ t: S.at(bar, step) - S.at(17), d: len * 240 - (len >= 8 ? 60 : 30), p: m(p), vowel: 'o', to: 'o', vib: 0.6 }));
  const ph = P.voicePhrase('chant', notes, { formantScale: 0.86, vibCents: 14, vibRate: 4.8, breath: 0.09, buzz: 0.2 });
  T.voice!.add({ tick: S.at(17), hit: ph, v: 0.9 }); T.voiceSpace!.add({ tick: S.at(17), hit: ph, v: 0.9 });
  void hitName;
  S.render = { duration: { bars: 25 }, tail: 'auto' };
  S.master = { gainDb: -2, effects: [{ type: 'highpass', frequencyHz: 28 }, { type: 'compressor', thresholdDb: -14, ratio: 2, attackMs: 25, releaseMs: 180 }] };
  return S;
}
