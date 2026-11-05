/** Direction A sketch: SODIUM HOURS — 92 BPM West Coast talkbox nocturne in F minor (16 bars, intro/groove/hook). */
import { Song, type Track } from './song.ts';
import { Palette } from './kits.ts';
import { CALL, ANSWER, ANSWER2, toVoice, toMachine, SWING } from './hook.ts';
import { m, ms, semis, swung, Feel } from './theory.ts';

export const CHORDS = {
  db: ms('Ab3', 'C4', 'Eb4', 'F4'), eb: ms('G3', 'Bb3', 'C4', 'F4'), fm: ms('Ab3', 'C4', 'Eb4', 'G4'), c7: ms('G3', 'Bb3', 'Db4', 'E4'),
  bb13: ms('Ab3', 'C4', 'D4', 'G4'),
};

export function groove(S: Song, P: Palette, T: Record<string, Track>, bar: number, variant: 'A' | 'B', feel: Feel, hatLevel = 1) {
  const k = P.kickMain(), sn = P.snareMain(), gh = P.ghost(), h = P.hatClosed(), oh = P.hatOpen(), hy = P.hydraulic();
  const sw = (s: number) => swung(s, SWING);
  const kicks = variant === 'A' ? [[1, 0.95], [8, 0.8], [11, 0.88]] : [[1, 0.95], [4, 0.72], [11, 0.86], [12, 0.6]];
  for (const [s, v] of kicks) T.kick!.add({ tick: S.at(bar, s!, sw(s!)), hit: k, v: v!, gate: 900, release: 0.06, choke: 'kick' });
  for (const s of [5, 13]) T.snare!.add({ tick: S.at(bar, s, 12 + feel.t(3)), hit: sn, v: feel.v(0.9, 0.04) });
  for (const s of variant === 'A' ? [10, 16] : [7, 15]) T.snare!.add({ tick: S.at(bar, s, sw(s) + feel.t(6)), hit: gh, v: feel.v(0.24, 0.06) });
  for (let s = 1; s <= 16; s += 2) {
    if (variant === 'A' && s === 15) { T.hats!.add({ tick: S.at(bar, s, feel.t(3)), hit: oh, v: 0.42 * hatLevel, choke: 'hats', gate: 420, release: 0.05 }); continue; }
    if (variant === 'B' && s === 15) { T.hats!.add({ tick: S.at(bar, s, 4), hit: hy, v: 0.5 * hatLevel }); continue; }
    T.hats!.add({ tick: S.at(bar, s, feel.t(4)), hit: h, v: feel.v(s % 4 === 1 ? 0.55 : 0.42, 0.05) * hatLevel, choke: 'hats' });
  }
  for (const s of variant === 'A' ? [12, 16] : [14]) T.hats!.add({ tick: S.at(bar, s, sw(s) + feel.t(4)), hit: h, v: feel.v(0.3, 0.05) * hatLevel, choke: 'hats' });
}

type BassNote = [step: number, len: number, pitch: string, v: number, slideFrom?: string];
export function bassBar(S: Song, P: Palette, T: Record<string, Track>, bar: number, notes: BassNote[], kicks: number[]) {
  for (const [step, len, pitch, v, from] of notes) {
    const midi = m(pitch), hit = P.bassNote(midi), tick = S.at(bar, step, swung(step, SWING));
    const onKick = kicks.includes(step), base = { tick, hit, v, gate: len * 240 - 30, attack: onKick ? 0.007 : 0.002, release: 0.05, choke: 'bass' };
    if (from) T.bass!.add({ ...base, rate: semis(m(from) - midi), glideTo: 1, glideTicks: 200 });
    else T.bass!.add(base);
  }
}

export function buildSketchA(): Song {
  const S = new Song('SODIUM HOURS (direction A sketch)', 92, 16, 'F minor',
    'Direction A: West Coast talkbox nocturne. Machine pluck states the hook; groove on Fm9-Bb13; the voice sings it over Db-Eb-Fm-C7.', 1);
  const P = new Palette(S, 'a'), feel = new Feel(1201);
  S.section('intro', 1, 4); S.section('groove', 5, 4); S.section('hook', 9, 8);
  const T: Record<string, Track> = {
    kick: S.track('kick', P.kick, 'Tuned F kick', { gainDb: -5.5 }),
    snare: S.track('snare', P.snare, 'Snare/clap, laid back ~9 ms', { gainDb: -6 }),
    hats: S.track('hats', P.hats, 'Hats, shaker, hydraulics', { gainDb: -1, pan: 0.15 }, [{ type: 'highpass', frequencyHz: 400 }]),
    bass: S.track('bass', P.bass, 'Round West Coast slide bass', { gainDb: -9.5 }),
    keys: S.track('keys', P.keys, 'FM electric piano comping', { gainDb: -6, pan: -0.2 }, [{ type: 'highpass', frequencyHz: 160 }]),
    pad: S.track('pad', P.pad, 'Night strings', { gainDb: -6 }, [{ type: 'highpass', frequencyHz: 180 }]),
    pluck: S.track('pluck', P.pluck, 'The machine: LPG pluck, dry', { gainDb: -11, pan: 0.1 }, [{ type: 'highpass', frequencyHz: 180 }]),
    pluckSpace: S.track('pluck-space', P.pluckSpace, 'Machine wet: hall + dotted-eighth ping-pong', { gainDb: -9 }),
    voice: S.track('voice', P.voice, 'The voice: talkbox lead, dry', { gainDb: -6 }, [{ type: 'highpass', frequencyHz: 150 }, { type: 'compressor', thresholdDb: -20, ratio: 3, attackMs: 6, releaseMs: 120, makeupGainDb: 2 }]),
    voiceSpace: S.track('voice-space', P.voiceSpace, 'Voice wet: hall + ping-pong', { gainDb: -8 }),
    atmos: S.track('atmos', P.atmos, 'Rain, lamp, siren', { gainDb: -8 }, [{ type: 'highpass', frequencyHz: 90 }]),
    fx: S.track('fx', P.fx, 'Swells and impacts', { gainDb: -10 }),
  };
  // ---------- atmosphere
  const rain = P.rain(24), lamp = P.lamp();
  T.atmos!.add({ tick: S.at(1), hit: rain, v: 0.9, gate: 8 * 3840, attack: 0.8, release: 2.5, choke: 'rain' });
  T.atmos!.add({ tick: S.at(9), hit: rain, v: 0.75, offset: 3, attack: 2.0, release: 1.5, choke: 'rain' });
  T.atmos!.add({ tick: S.at(1), hit: lamp, v: 0.6, attack: 1.5, release: 2 });
  T.atmos!.add({ tick: S.at(2, 1), hit: P.siren('siren', [[0, 72], [0.9, 77], [2.3, 75], [2.8, 80], [6.2, 79]], 9), v: 0.75 });
  // ---------- intro: the machine states the hook, straight grid, over the hook harmony
  const machine = toMachine([...CALL.slice(1), ...ANSWER]);
  for (const x of machine) {
    const hit = P.pluckNote(x.midi), tick = S.at(x.bar, x.step);
    T.pluck!.add({ tick, hit, v: x.v * 0.85 }); T.pluckSpace!.add({ tick, hit, v: x.v * 0.85 });
  }
  const prog = [CHORDS.db, CHORDS.eb, CHORDS.fm, CHORDS.c7], names = ['db', 'eb', 'fm', 'c7'];
  for (let b = 0; b < 4; b++) T.pad!.add({ tick: S.at(1 + b), hit: P.padChord(names[b]!, prog[b]!), v: 0.55, gate: 3840, attack: 0.3, release: 0.7, choke: 'pad' });
  T.bass!.add({ tick: S.at(3), hit: P.bassNote(m('F1')), v: 0.6, gate: 2 * 3840 - 200, attack: 0.4, release: 0.5, choke: 'bass' });
  T.fx!.add({ tick: S.at(4), hit: P.swell('swell-fm', [m('Ab4'), m('C5'), m('Eb5'), m('G5')], S.beatSec * 4), v: 0.7 });
  T.snare!.add({ tick: S.at(4, 13, 12), hit: P.ghost(), v: 0.35 }); T.snare!.add({ tick: S.at(4, 15, 0), hit: P.ghost(), v: 0.45 });
  T.hats!.add({ tick: S.at(4, 15, 6), hit: P.hydraulic(), v: 0.55 });
  // ---------- groove: Fm9 (5-6) Bb13 (7-8)
  for (let b = 5; b <= 8; b++) groove(S, P, T, b, b % 2 ? 'A' : 'B', feel);
  const kA = [1, 8, 11], kB = [1, 4, 11, 12];
  bassBar(S, P, T, 5, [[1, 5, 'F1', 0.95], [7, 1, 'F2', 0.7], [8, 1, 'Eb2', 0.75], [9, 2, 'C2', 0.85], [11, 3, 'Ab1', 0.9], [15, 1, 'Bb1', 0.7], [16, 1, 'B1', 0.7]], kA);
  bassBar(S, P, T, 6, [[1, 2, 'C2', 0.9], [4, 2, 'F1', 0.85], [7, 1, 'Ab1', 0.7], [9, 2, 'Bb1', 0.8], [11, 2, 'C2', 0.9], [13, 1, 'Eb2', 0.7], [15, 6, 'Bb1', 0.85, 'C2']], kB);
  bassBar(S, P, T, 7, [[7, 1, 'Bb2', 0.7], [8, 1, 'Ab2', 0.75], [9, 2, 'F2', 0.85], [11, 3, 'D2', 0.9], [15, 1, 'Eb2', 0.7], [16, 1, 'E2', 0.7]], kA);
  bassBar(S, P, T, 8, [[1, 2, 'F2', 0.9], [4, 2, 'Bb1', 0.85], [7, 1, 'D2', 0.7], [9, 2, 'Eb2', 0.8], [11, 2, 'F2', 0.9], [13, 1, 'Ab2', 0.7], [15, 6, 'Db2', 0.85, 'C2']], kB);
  const epComp = (bar: number, chord: number[], name: string, variant: 'A' | 'B') => {
    const hit = P.epChord(name, chord), hits = variant === 'A' ? [[3, 4, 0.62], [10, 1, 0.48], [12, 2, 0.55]] : [[3, 3, 0.6], [7, 1, 0.45], [11, 4, 0.58], [16, 1, 0.4]];
    for (const [s, len, v] of hits) T.keys!.add({ tick: S.at(bar, s!, swung(s!, SWING)), hit, v: v!, gate: len! * 240 - 20, release: 0.12, choke: 'ep' });
  };
  epComp(5, CHORDS.fm, 'ep-fm9', 'A'); epComp(6, CHORDS.fm, 'ep-fm9', 'B'); epComp(7, CHORDS.bb13, 'ep-bb13', 'A'); epComp(8, CHORDS.bb13, 'ep-bb13', 'B');
  // pluck answers in the groove: the hook's first cell, machine-straight, on the gaps
  for (const [bar, step, p] of [[5, 13, 'Eb5'], [5, 15, 'F5'], [6, 9, 'C5'], [7, 13, 'Eb5'], [7, 15, 'F5'], [8, 9, 'Ab5'], [8, 10, 'G5'], [8, 11, 'F5']] as const) {
    const hit = P.pluckNote(m(p)), tick = S.at(bar, step);
    T.pluck!.add({ tick, hit, v: 0.62 }); T.pluckSpace!.add({ tick, hit, v: 0.62 });
  }
  T.snare!.add({ tick: S.at(8, 13, 12), hit: P.snareVerb(), v: 0.85 });
  // ---------- hook: Db Eb Fm C7 x2, the voice sings
  for (let b = 9; b <= 16; b++) groove(S, P, T, b, b % 2 ? 'A' : 'B', feel, 0.85);
  const hookBass: Record<string, [number, number, string, number, string?][]> = {
    db: [[8, 2, 'Ab1', 0.8], [11, 3, 'Db2', 0.88], [15, 1, 'C2', 0.65], [16, 1, 'D2', 0.7]],
    eb: [[1, 6, 'Eb2', 0.92], [8, 2, 'Bb1', 0.8], [11, 3, 'Eb2', 0.88], [15, 1, 'Eb2', 0.6], [16, 1, 'E2', 0.7]],
    fm: [[1, 6, 'F1', 0.95], [8, 2, 'C2', 0.8], [11, 3, 'Ab1', 0.88], [15, 1, 'Bb1', 0.65], [16, 1, 'B1', 0.7]],
    c7: [[1, 6, 'C2', 0.92], [8, 2, 'G1', 0.8], [11, 2, 'C2', 0.86], [13, 1, 'Bb1', 0.65], [15, 6, 'Db2', 0.85, 'C2']],
  };
  for (let b = 9; b <= 16; b++) {
    const c = names[(b - 9) % 4]!, kicks = b % 2 ? kA : kB;
    bassBar(S, P, T, b, hookBass[c]!.filter(x => !(b === 13 && c === 'db' && x[0] === 1)), kicks);
    T.pad!.add({ tick: S.at(b), hit: P.padChord(c, prog[(b - 9) % 4]!), v: 0.7, gate: 3840, attack: 0.08, release: 0.6, choke: 'pad' });
  }
  T.keys!.add({ tick: S.at(12, 1), hit: P.epChord('ep-c7b9', CHORDS.c7), v: 0.5, gate: 1920, release: 0.4, choke: 'ep' });
  T.keys!.add({ tick: S.at(16, 1), hit: P.epChord('ep-c7b9', CHORDS.c7), v: 0.5, gate: 1920, release: 0.4, choke: 'ep' });
  const phrase = (name: string, notes: typeof CALL, originBar: number) => {
    const { start, notes: vn } = toVoice(notes, 0);
    const hit = P.voicePhrase(name, vn), tick = S.at(originBar) + start;
    T.voice!.add({ tick, hit, v: 0.9 }); T.voiceSpace!.add({ tick, hit, v: 0.9 });
  };
  phrase('hook-1', [...CALL, ...ANSWER], 8);
  phrase('hook-2', [...CALL, ...ANSWER2], 12);
  for (const [bar, step, p] of [[10, 13, 'C6'], [10, 14, 'Ab5'], [10, 15, 'F5'], [12, 14, 'E5'], [12, 15, 'G5'], [12, 16, 'Bb5'], [14, 13, 'C6'], [14, 14, 'Ab5'], [14, 15, 'F5']] as const) {
    const hit = P.pluckNote(m(p)), tick = S.at(bar, step, swung(step, SWING));
    T.pluck!.add({ tick, hit, v: 0.55 }); T.pluckSpace!.add({ tick, hit, v: 0.6 });
  }
  S.render = { duration: { bars: 17 }, tail: 'auto' };
  S.master = { gainDb: -2, effects: [{ type: 'highpass', frequencyHz: 28 }, { type: 'compressor', thresholdDb: -14, ratio: 2, attackMs: 25, releaseMs: 180 }] };
  return S;
}
