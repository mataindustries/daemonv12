/**
 * SODIUM HOURS — full single. 92 BPM, 4/4, F minor, 70 bars + tail.
 *
 *  bars   section              job
 *  1-8    INTRO "haze"         the machine states the hook; rain, sodium lamp, a distant siren foreshadows the cry
 *  9-16   GROOVE "boulevard"   the pocket alone: drums, slide-bass riff, keys; no lead (restraint)
 *  17-24  HOOK 1 "voice"       the voice sings call/answer twice; the machine answers in the gaps
 *  25-32  VERSE "overpass"     development: new kick pattern, 3-3-2 metal, grit appears in the pops, voice ad-libs
 *  33-40  BREAKDOWN "mulholland" beatless; the hook at half speed over a reharmonization ending Neapolitan -> V
 *  41-48  HOOK 2 "freeway"     heaviest groove, grit bass fully open, choir under the hook
 *  49-52  SIGNAL LOSS          3-3-3-3-4 stop-time against the bar, voice stutter, two beats of silence
 *  53-64  FINAL "sodium hours" the choir sings the hook with the voice; new C6 summit; E resolves to F over F MAJOR
 *  65-70  OUTRO "dawn"         the machine plays the motif with the new E natural; last rain, low hit, choir tail
 */
import { Song, type Track, type Hit } from './song.ts';
import { Palette } from './kits.ts';
import { CALL, ANSWER, ANSWER2, ANSWER3, ANSWER_PEAK, RESOLVE, FRAGMENTS, augment, toVoice, toMachine, SWING, type HookNote } from './hook.ts';
import { m, ms, semis, swung, Feel } from './theory.ts';

const C = {
  db: ms('Ab3', 'C4', 'Eb4', 'F4'), eb: ms('G3', 'Bb3', 'C4', 'F4'), fm: ms('Ab3', 'C4', 'Eb4', 'G4'), c7: ms('G3', 'Bb3', 'Db4', 'E4'),
  bb13: ms('Ab3', 'C4', 'D4', 'G4'), bbm9: ms('Db4', 'F4', 'Ab4', 'C5'), cm7: ms('G3', 'Bb3', 'Eb4', 'G4'), dbf: ms('F3', 'Ab3', 'Db4', 'F4'),
  gb: ms('F3', 'Bb3', 'Db4', 'F4'), c7sus: ms('G3', 'Bb3', 'C4', 'F4'), fmaj9: ms('A3', 'C4', 'E4', 'G4'), db11: ms('F3', 'G3', 'C4', 'F4'),
  fm9g: ms('Ab3', 'C4', 'Eb4', 'G4'), fm9ab: ms('Ab3', 'C4', 'Eb4', 'Ab4'), fm9bb: ms('Ab3', 'C4', 'Eb4', 'Bb4'), fm9f: ms('Ab3', 'C4', 'Eb4', 'F4'), fm7eb: ms('F3', 'Ab3', 'C4', 'Eb4'),
  bb9f: ms('Ab3', 'C4', 'D4', 'F4'), bb13d: ms('Ab3', 'D4', 'G4', 'D5'), bb13c: ms('Ab3', 'D4', 'G4', 'C5'), bb13ab: ms('C4', 'D4', 'G4', 'Ab4'),
};
const HOOK_PROG = ['db', 'eb', 'fm', 'c7'] as const;
const ROOT: Record<string, string> = { db: 'Db3', eb: 'Eb3', fm: 'F3', c7: 'C3' };

export function buildSingle(opts: { bed?: boolean } = {}): Song {
  const BED = !!opts.bed;  // instrumental bed (alternate mix): no lead voice, no sung ensemble, no voice stutter
  const S = new Song(BED ? 'SODIUM HOURS (instrumental bed)' : 'SODIUM HOURS', 92, 70, 'F minor',
    BED ? 'DAEMON//HEADLINER 001 alternate mix: the full arrangement without the lead voice, its wet track and the sung ensemble (sync/TV bed). Same assets and mix as the main master.'
      : 'DAEMON//HEADLINER 001. A machine city learning to sing: the motif is heard as machine (LPG pluck), voice (talkbox), then choir. Original synthesis only.', 92);
  const P = new Palette(S, 'single'), feel = new Feel(9201);
  const sections: [string, number, number][] = [['intro', 1, 8], ['groove', 9, 8], ['hook-1', 17, 8], ['verse', 25, 8], ['breakdown', 33, 8], ['hook-2', 41, 8], ['signal-loss', 49, 4], ['final', 53, 12], ['outro', 65, 6]];
  for (const [n, b, l] of sections) S.section(n, b, l);
  const T: Record<string, Track> = {
    kick: S.track('kick', P.kick, 'Tuned F kick and the low boom', { gainDb: -11 }, [{ type: 'saturation', driveDb: 5, mix: 0.85 }]),
    snare: S.track('snare', P.snare, 'Snare/clap laid back ~9 ms, ghosts, rim, hall accents', { gainDb: -3.5 }, [{ type: 'saturation', driveDb: 3, mix: 0.5 }]),
    hats: S.track('hats', P.hats, 'Swung hats, open hats, shaker, lowrider hydraulics, machine ticks', { gainDb: 6.5, pan: 0.32 }, [{ type: 'highpass', frequencyHz: 400 }]),
    metal: S.track('metal', P.metal, 'Straight-grid 3-3-2 metal: pipe, anvil, chain, toms, servo', { gainDb: -8, pan: -0.4 }, [{ type: 'highpass', frequencyHz: 120 }]),
    bass: S.track('bass', P.bass, 'Round West Coast slide bass', { gainDb: -9.5 }),
    grit: S.track('grit', P.grit, 'Industrial grit layer: withheld until the verse pops, open from Hook 2', { gainDb: -12 }, [{ type: 'saturation', driveDb: 3, mix: 0.3 }]),
    keys: S.track('keys', P.keys, 'FM electric piano', { gainDb: -4, pan: -0.35 }, [{ type: 'highpass', frequencyHz: 160 }]),
    pad: S.track('pad', P.pad, 'Night strings', { gainDb: -7 }, [{ type: 'highpass', frequencyHz: 190 }]),
    pluck: S.track('pluck', P.pluck, 'The machine: low-pass-gate pluck, dry', { gainDb: -11, pan: 0.35 }, [{ type: 'highpass', frequencyHz: 180 }]),
    'pluck-space': S.track('pluck-space', P.pluckSpace, 'Machine wet: FDN hall + dotted-eighth ping-pong', { gainDb: -8 }),
    voice: S.track('voice', P.voice, 'The voice: synthetic talkbox lead, dry', { gainDb: -3.5 }, [{ type: 'highpass', frequencyHz: 150 }, { type: 'compressor', thresholdDb: -20, ratio: 3, attackMs: 6, releaseMs: 120, makeupGainDb: 2 }]),
    'voice-space': S.track('voice-space', P.voiceSpace, 'Voice wet: FDN hall + dotted-eighth ping-pong', { gainDb: -8.5 }),
    choir: S.track('choir', P.choir, 'Choir chords and the ensemble that sings the final hook', { gainDb: -6.5 }, [{ type: 'highpass', frequencyHz: 170 }]),
    atmos: S.track('atmos', P.atmos, 'Rain over freeway rumble, sodium lamp, distant siren', { gainDb: -8 }, [{ type: 'highpass', frequencyHz: 90 }]),
    fx: S.track('fx', P.fx, 'Impacts, reverse swells, signal-loss glitch', { gainDb: -10 }),
  };
  const at = (bar: number, step = 1, extra = 0) => S.at(bar, step, extra);
  const sw = (step: number) => swung(step, SWING);
  const add = (t: string, h: Hit) => T[t]!.add(h);
  const both = (dry: string, wet: string, h: Hit, wetV = h.v) => { add(dry, h); add(wet, { ...h, v: wetV }); };

  // ================================================================ helpers
  const K = { main: P.kickMain(), boom: P.kickBoom(), soft: P.kickSoft() };
  const SN = { main: P.snareMain(), verb: P.snareVerb(), clap: P.clap(), ghost: P.ghost(), rim: P.rimShot() };
  const H = { c: P.hatClosed(), o: P.hatOpen(), sh: P.shaker(), hy: P.hydraulic(), tk: P.tick() };
  const MT = { anvil: P.anvil(), tl: P.tomLow(), th: P.tomHigh() };
  const kick = (bar: number, step: number, v: number, hit = K.main) => add('kick', { tick: at(bar, step, sw(step)), hit, v, gate: hit === K.boom ? undefined : 900, release: 0.06, choke: 'kick' });
  const hat = (bar: number, step: number, v: number, hit = H.c, extra = 0) => add('hats', { tick: at(bar, step, sw(step) + extra + feel.t(4)), hit, v: feel.v(v, 0.04), choke: hit === H.c || hit === H.o ? 'hats' : undefined, ...(hit === H.o ? { gate: 420, release: 0.05 } : {}) });
  const snare = (bar: number, step: number, v: number, hit = SN.main) => add('snare', { tick: at(bar, step, (hit === SN.ghost ? sw(step) + feel.t(6) : 12 + feel.t(3))), hit, v: feel.v(v, 0.03) });

  /** The West Coast pocket. 'A'/'B' two-bar pattern; 'overpass' and 'freeway' are later variants. */
  function drums(bar: number, kind: 'A' | 'B' | 'OA' | 'OB' | 'FA' | 'FB', o: { hats?: number; ghosts?: boolean; open?: boolean; metal?: string; clap?: boolean; hydro?: boolean; lift?: boolean; kickScale?: number } = {}) {
    const hl = o.hats ?? 1, ks = o.kickScale ?? 1;
    const kicks: Record<string, [number, number][]> = {
      A: [[1, 0.95], [8, 0.8], [11, 0.88]], B: [[1, 0.95], [4, 0.72], [11, 0.86], [12, 0.6]],
      OA: [[1, 0.95], [4, 0.7], [8, 0.82], [11, 0.86]], OB: [[1, 0.95], [7, 0.78], [11, 0.86], [14, 0.66]],
      FA: [[1, 1], [3, 0.7], [8, 0.84], [11, 0.9]], FB: [[1, 1], [4, 0.75], [8, 0.8], [11, 0.9], [12, 0.62], [15, 0.7]],
    };
    for (const [s, v] of kicks[kind]!) kick(bar, s, v * ks);
    snare(bar, 5, 0.92); snare(bar, 13, 0.9);
    if (o.clap) { add('snare', { tick: at(bar, 5, 16), hit: SN.clap, v: 0.5 }); add('snare', { tick: at(bar, 13, 16), hit: SN.clap, v: 0.55 }); }
    if (o.ghosts !== false) for (const s of kind.endsWith('A') ? [10, 16] : [7, 15]) snare(bar, s, 0.24, SN.ghost);
    const sixteenths = kind.startsWith('F') || kind.startsWith('O');
    for (let s = 1; s <= 16; s++) {
      const odd = s % 2 === 1;
      if (!sixteenths && !odd && ![12, 16].includes(s) && !(kind === 'B' && s === 14)) continue;
      if (s === 15 && (kind === 'A' || kind === 'FA' || kind === 'OA') && o.open !== false) { hat(bar, s, 0.42 * hl, H.o); continue; }
      if (s === 15 && (kind === 'B' || kind === 'FB') && o.hydro !== false) { add('hats', { tick: at(bar, 15, 4), hit: H.hy, v: 0.52 * hl }); continue; }
      if (o.lift && odd && s % 4 === 3) { hat(bar, s, 0.36 * hl, H.o); continue; }
      hat(bar, s, (s % 4 === 1 ? 0.55 : odd ? 0.44 : 0.28) * hl);
    }
    if (kind.startsWith('F') && o.open !== false) hat(bar, 7, 0.34 * hl, H.o);
    if (o.metal) {  // straight machine grid against the swing: 3+3+2 per half bar
      const pipe = P.pipeAt(m(o.metal));
      for (const [s, hit, v] of [[1, pipe, 0.62], [4, MT.anvil, 0.32], [7, pipe, 0.5], [9, pipe, 0.58], [12, MT.anvil, 0.36], [15, pipe, 0.48]] as [number, string, number][])
        add('metal', { tick: at(bar, s), hit, v: feel.v(v, 0.04) });
    }
  }
  type BN = [step: number, len: number, pitch: string, v: number, slideFrom?: string];
  function bass(bar: number, notes: BN[], kicks: number[], grit?: 'pops' | 'all' | 'held') {
    for (const [step, len, pitch, v, from] of notes) {
      const midi = m(pitch), tick = at(bar, step, sw(step)), onKick = kicks.includes(step);
      const base: Hit = { tick, hit: P.bassNote(midi), v, gate: len * 240 - 30, attack: onKick ? 0.007 : 0.002, release: 0.05, choke: 'bass' };
      add('bass', from ? { ...base, rate: semis(m(from) - midi), glideTo: 1, glideTicks: 200 } : base);
      const pop = midi >= m('Bb1') && len <= 2;
      if (grit === 'all' || (grit === 'pops' && pop) || (grit === 'held' && len >= 3)) {
        const g = P.gritNote(midi, len <= 2);
        add('grit', from ? { tick, hit: g, v: v * 0.85, gate: len * 240 - 30, release: 0.04, choke: 'grit', rate: semis(m(from) - midi), glideTo: 1, glideTicks: 200 }
          : { tick, hit: g, v: v * 0.85, gate: len * 240 - 30, release: 0.04, choke: 'grit' });
      }
    }
  }
  const pad = (bar: number, chord: keyof typeof C, v: number, bars = 1, attack = 0.08) => add('pad', { tick: at(bar), hit: P.padChord(`pad-${chord}`, C[chord], 5.6), v, gate: bars * 3840, attack, release: 0.7, choke: 'pad' });
  const ep = (bar: number, step: number, chord: keyof typeof C, v: number, len: number) => add('keys', { tick: at(bar, step, sw(step)), hit: P.epChord(`ep-${chord}`, C[chord]), v, gate: len * 240 - 20, release: 0.14, choke: 'ep' });
  const pluck = (bar: number, step: number, p: string | number, v: number, swing = false, wet = v) => {
    const midi = typeof p === 'number' ? p : m(p);
    both('pluck', 'pluck-space', { tick: at(bar, step, swing ? sw(step) : 0), hit: P.pluckNote(midi), v }, wet);
  };
  const phrase = (name: string, notes: HookNote[], originBar: number, v = 0.9, wet = 0.9, opts = {}) => {
    const { start, notes: vn } = toVoice(notes, 0);
    if (BED) return { tick: at(originBar) + start, notes: vn };
    const hit = P.voicePhrase(name, vn, opts), tick = at(originBar) + start;
    both('voice', 'voice-space', { tick, hit, v }, wet);
    return { tick, notes: vn };
  };
  const hookBass: Record<string, BN[]> = {
    db: [[8, 2, 'Ab1', 0.8], [11, 3, 'Db2', 0.88], [15, 1, 'C2', 0.65], [16, 1, 'D2', 0.7]],
    eb: [[1, 6, 'Eb2', 0.92], [8, 2, 'Bb1', 0.8], [11, 3, 'Eb2', 0.88], [15, 1, 'Eb2', 0.6], [16, 1, 'E2', 0.7]],
    fm: [[1, 6, 'F1', 0.95], [8, 2, 'C2', 0.8], [11, 3, 'Ab1', 0.88], [15, 1, 'Bb1', 0.65], [16, 1, 'B1', 0.7]],
    c7: [[1, 6, 'C2', 0.92], [8, 2, 'G1', 0.8], [11, 2, 'C2', 0.86], [13, 1, 'Bb1', 0.65], [15, 6, 'Db2', 0.85, 'C2']],
  };
  const hookBass2: Record<string, BN[]> = {  // second-half line: octave pops and a walk into each chord
    db: [[8, 2, 'Ab1', 0.82], [11, 2, 'Db2', 0.88], [13, 1, 'Db3', 0.55], [14, 1, 'Ab2', 0.6], [15, 1, 'C2', 0.65], [16, 1, 'D2', 0.72]],
    eb: [[1, 6, 'Eb2', 0.92], [8, 2, 'Bb1', 0.8], [11, 2, 'Eb2', 0.88], [13, 1, 'Eb3', 0.55], [14, 1, 'Bb2', 0.6], [16, 1, 'E2', 0.72]],
    fm: [[1, 6, 'F1', 0.96], [8, 2, 'C2', 0.82], [11, 2, 'F2', 0.86], [13, 1, 'Ab1', 0.7], [15, 1, 'Bb1', 0.66], [16, 1, 'B1', 0.72]],
    c7: [[1, 6, 'C2', 0.94], [8, 2, 'G1', 0.82], [11, 2, 'C2', 0.86], [13, 1, 'E2', 0.65], [15, 6, 'Db2', 0.86, 'C2']],
  };
  const KA = [1, 8, 11], KB = [1, 4, 11, 12];

  // ================================================================ 1. INTRO "haze" (1-8)
  const rain = P.rain(24), lamp = P.lamp();
  add('atmos', { tick: at(1), hit: rain, v: 0.95, gate: 8 * 3840, attack: 0.5, release: 3, choke: 'rain' });
  add('atmos', { tick: at(1), hit: lamp, v: 0.7, attack: 1.2, release: 2 });
  add('atmos', { tick: at(3), hit: P.siren('siren', [[0, 72], [0.9, 77], [2.3, 75], [2.8, 80], [6.2, 79]], 9), v: 0.8 });
  // The machine can state the call but cannot finish the phrase: its answer breaks off after one cell.
  // The full answer, and its E natural, are first heard from the voice in bars 19-20.
  for (const x of toMachine(CALL.slice(1))) pluck(x.bar, x.step, x.midi, x.v * 0.72, false, x.v * 0.95);
  for (const x of toMachine(CALL.slice(1))) pluck(x.bar + 4, x.step, x.midi, x.v * 0.85, false, x.v * 0.8);
  for (const x of toMachine(ANSWER.slice(0, 4))) pluck(x.bar + 4, x.step, x.midi, x.v * 0.8, false, x.v * 0.85);
  pluck(7, 13, 'Ab4', 0.42, false, 0.7);
  HOOK_PROG.forEach((c, i) => { pad(1 + i, c, 0.42, 1, 0.4); pad(5 + i, c, 0.6, i === 3 ? 0.75 : 1, 0.12); });
  for (let b = 5; b <= 8; b++) ep(b, 1, HOOK_PROG[(b - 5) % 4]!, 0.4, b === 8 ? 12 : 14);
  for (const [b, p, len] of [[5, 'Db2', 14], [6, 'Eb2', 14], [7, 'F1', 14], [8, 'C2', 10]] as const) add('bass', { tick: at(b), hit: P.bassNote(m(p)), v: 0.62, gate: len * 240, attack: 0.25, release: 0.4, choke: 'bass' });
  for (let b = 7; b <= 8; b++) for (let s = 1; s <= 16; s += 2) hat(b, s, b === 7 ? 0.2 + s * 0.008 : 0.32, H.tk);
  kick(7, 1, 0.55, K.soft); kick(8, 1, 0.65, K.soft);
  add('fx', { tick: at(8), hit: P.swell('swell-fm', ms('Ab4', 'C5', 'Eb5', 'G5'), S.beatSec * 3), v: 0.6 });
  snare(8, 10, 0.3, SN.ghost); snare(8, 11, 0.38, SN.ghost); add('hats', { tick: at(8, 11, 4), hit: H.hy, v: 0.5 });
  // bar 8 beat 4: everything but the rain stops (the C7 pad/bass/keys are gated before step 13)

  // ================================================================ 2. GROOVE "boulevard" (9-16)
  const RIFF: BN[][] = [
    [[1, 5, 'F1', 0.95], [7, 1, 'F2', 0.7], [8, 1, 'Eb2', 0.75], [9, 2, 'C2', 0.85], [11, 3, 'Ab1', 0.9], [15, 1, 'Bb1', 0.7], [16, 1, 'B1', 0.7]],
    [[1, 2, 'C2', 0.9], [4, 2, 'F1', 0.85], [7, 1, 'Ab1', 0.7], [9, 2, 'Bb1', 0.8], [11, 2, 'C2', 0.9], [13, 1, 'Eb2', 0.7], [15, 6, 'Bb1', 0.85, 'C2']],
    [[7, 1, 'Bb2', 0.7], [8, 1, 'Ab2', 0.75], [9, 2, 'F2', 0.85], [11, 3, 'D2', 0.9], [15, 1, 'Eb2', 0.7], [16, 1, 'E2', 0.7]],
    [[1, 2, 'F2', 0.9], [4, 2, 'Bb1', 0.85], [7, 1, 'D2', 0.7], [9, 2, 'Eb2', 0.8], [11, 2, 'F2', 0.9], [13, 1, 'Ab2', 0.7], [15, 6, 'F1', 0.85, 'Eb2']],
  ];
  const RIFF_END: BN[] = [[1, 2, 'Bb1', 0.9], [4, 2, 'Bb1', 0.75], [7, 2, 'D2', 0.75], [9, 3, 'C2', 0.9], [12, 1, 'C2', 0.65], [13, 1, 'E2', 0.7], [15, 6, 'Db2', 0.88, 'C2']];
  for (let b = 9; b <= 16; b++) {
    if (b < 16) drums(b, b % 2 ? 'A' : 'B', { hats: 0.95 });
    bass(b, b === 16 ? RIFF_END : RIFF[(b - 9) % 4]!, b % 2 ? KA : KB);
  }
  // bar 16: the drums break on beats 3-4 (bass and keys keep talking), the hall snare re-opens the door
  kick(16, 1, 0.95); kick(16, 4, 0.72); snare(16, 5, 0.9); snare(16, 7, 0.24, SN.ghost);
  for (const s of [1, 3, 5, 7, 9, 11]) hat(16, s, s === 1 ? 0.55 : 0.42);
  add('kick', { tick: at(9), hit: K.boom, v: 0.45 });
  const rain2 = P.rain(23, 'rain-2', 207);
  for (const [b, hit, off] of [[9, rain2, 0.4], [17, rain, 0.6], [25, rain2, 0.2]] as const) add('atmos', { tick: at(b), hit, v: 0.85, offset: off, gate: 8 * 3840, attack: 2.5, release: 2, choke: 'rain' });
  // Keys comping with a moving top line, so the groove carries the mid register with the lead muted:
  // G Ab Bb | Ab G F Eb | G F G | D C G Ab  (voicings keep Ab3 as a common tone)
  const LINE: [number, number, number, keyof typeof C][][] = [
    [[3, 4, 0.64, 'fm9g'], [10, 1, 0.5, 'fm9ab'], [12, 2, 0.58, 'fm9bb']],
    [[3, 3, 0.62, 'fm9ab'], [7, 1, 0.48, 'fm9g'], [11, 4, 0.6, 'fm9f'], [16, 1, 0.44, 'fm7eb']],
    [[3, 4, 0.64, 'bb13'], [10, 1, 0.5, 'bb9f'], [12, 2, 0.58, 'bb13']],
    [[3, 3, 0.62, 'bb13d'], [7, 1, 0.48, 'bb13c'], [11, 4, 0.6, 'bb13'], [16, 1, 0.44, 'bb13ab']],
  ];
  for (let b = 9; b <= 15; b++) for (const [s, len, v, c] of LINE[(b - 9) % 4]!) ep(b, s, c, v, len);
  ep(16, 3, 'bb13d', 0.62, 4); ep(16, 9, 'c7', 0.64, 6);
  for (const [b, s, p] of [[9, 13, 'Eb5'], [9, 15, 'F5'], [10, 9, 'C5'], [11, 13, 'Eb5'], [11, 15, 'F5'], [12, 9, 'Ab5'], [12, 10, 'G5'], [12, 11, 'F5'], [13, 13, 'Eb5'], [13, 15, 'F5'], [14, 9, 'C5'], [15, 13, 'Eb5'], [15, 15, 'F5']] as const) pluck(b, s, p, 0.58);
  for (const s of [9, 11, 13, 14, 15]) add('hats', { tick: at(12, s, sw(s)), hit: H.hy, v: 0.3 + s * 0.02 });  // the lowrider bounce
  add('fx', { tick: at(16), hit: P.swell('swell-db', ms('Ab4', 'C5', 'Eb5', 'F5'), S.beatSec * 4), v: 0.55 });
  snare(16, 13, 0.85, SN.verb);

  // ================================================================ 3. HOOK 1 "voice" (17-24)
  phrase('hook-a', [...CALL, ...ANSWER], 16);
  phrase('hook-b', [...CALL, ...ANSWER2], 20);
  const toF: BN[] = [[1, 6, 'C2', 0.92], [8, 2, 'G1', 0.8], [11, 2, 'C2', 0.86], [13, 1, 'Bb1', 0.65], [15, 1, 'Eb2', 0.7], [16, 1, 'E2', 0.74]];
  for (let b = 17; b <= 24; b++) {
    const c = HOOK_PROG[(b - 17) % 4]!;
    drums(b, b % 2 ? 'A' : 'B', { hats: 0.74, ghosts: false, open: false, hydro: b === 24, kickScale: 0.84 });
    bass(b, b === 24 ? toF : hookBass[c]!, b % 2 ? KA : KB);
    pad(b, c, 0.55);
  }
  ep(20, 1, 'c7', 0.48, 8); ep(24, 1, 'c7', 0.5, 8);
  for (const [b, s, p] of [[18, 13, 'C6'], [18, 14, 'Ab5'], [18, 15, 'F5'], [20, 14, 'E5'], [20, 15, 'G5'], [20, 16, 'Bb5'], [22, 13, 'C6'], [22, 14, 'Ab5'], [22, 15, 'F5']] as const) pluck(b, s, p, 0.52, true, 0.62);
  snare(24, 13, 0.8, SN.verb);

  // ================================================================ 4. VERSE "overpass" (25-32): development
  const VERSE_HARM = ['fm', 'fm', 'bb13', 'bb13', 'db', 'db', 'c7sus', 'c7'] as const;
  const VERSE_BASS: BN[][] = [
    [[1, 5, 'F1', 0.95], [7, 1, 'F2', 0.72], [8, 1, 'Eb2', 0.76], [9, 2, 'C2', 0.85], [11, 3, 'Ab1', 0.9], [14, 1, 'F2', 0.6], [15, 1, 'Bb1', 0.7], [16, 1, 'B1', 0.7]],
    [[1, 2, 'C2', 0.9], [4, 2, 'F1', 0.85], [7, 1, 'F2', 0.65], [9, 2, 'Ab1', 0.8], [11, 2, 'Bb1', 0.86], [13, 1, 'C2', 0.72], [15, 6, 'Bb1', 0.85, 'C2']],
    [[7, 1, 'Bb2', 0.72], [8, 1, 'Ab2', 0.76], [9, 2, 'F2', 0.85], [11, 3, 'D2', 0.9], [14, 1, 'Bb2', 0.6], [15, 1, 'Eb2', 0.7], [16, 1, 'E2', 0.7]],
    [[1, 2, 'F2', 0.9], [4, 2, 'Bb1', 0.85], [7, 1, 'Bb2', 0.65], [9, 2, 'D2', 0.8], [11, 2, 'Eb2', 0.86], [13, 1, 'F2', 0.72], [15, 6, 'Db2', 0.86, 'C2']],
    [[8, 2, 'Ab1', 0.82], [11, 3, 'Db2', 0.88], [14, 1, 'Db3', 0.55], [15, 1, 'C2', 0.65], [16, 1, 'Db2', 0.7]],
    [[1, 6, 'Db2', 0.9], [8, 2, 'F2', 0.78], [11, 3, 'Ab1', 0.86], [14, 1, 'Ab2', 0.55], [15, 1, 'B1', 0.65], [16, 1, 'C2', 0.7]],
    [[1, 6, 'C2', 0.92], [8, 2, 'G1', 0.8], [11, 3, 'C2', 0.86], [14, 1, 'C3', 0.55], [15, 1, 'Bb1', 0.66], [16, 1, 'B1', 0.7]],
    [[1, 6, 'C2', 0.94]],
  ];
  for (let b = 25; b <= 32; b++) {
    const i = b - 25, kind = b % 2 ? 'OA' : 'OB';
    const root = { fm: 'F3', bb13: 'Bb2', db: 'Db3', c7sus: 'C3', c7: 'C3' }[VERSE_HARM[i]!]!;
    if (b < 32) drums(b, kind, { hats: 0.9, metal: b >= 27 ? root : undefined });
    bass(b, VERSE_BASS[i]!, kind === 'OA' ? [1, 4, 8, 11] : [1, 7, 11, 14], 'pops');
  }
  // bar 32: the groove breaks at beat 3 and the leading tone hangs over the edge
  kick(32, 1, 0.95); snare(32, 5, 0.9); hat(32, 1, 0.5); hat(32, 3, 0.4); hat(32, 5, 0.45); hat(32, 7, 0.38);
  add('fx', { tick: at(32, 9), hit: P.swell('swell-db', ms('Ab4', 'C5', 'Eb5', 'F5'), S.beatSec * 2), v: 0.6 });
  for (const [b, s, len, v] of [[25, 3, 4, 0.55], [25, 11, 3, 0.48], [26, 3, 6, 0.55], [27, 3, 4, 0.55], [27, 11, 3, 0.5], [28, 3, 6, 0.55], [29, 1, 8, 0.52], [29, 11, 4, 0.48], [30, 3, 10, 0.5], [31, 1, 8, 0.5], [32, 1, 8, 0.5]] as const) ep(b, s, VERSE_HARM[b - 25]!, v, len);
  pad(29, 'db', 0.5, 2, 0.6); pad(31, 'c7sus', 0.6); pad(32, 'c7', 0.7, 1);
  phrase('frag-1', FRAGMENTS['frag-1']!, 25, 0.88, 1.05);
  phrase('frag-2', FRAGMENTS['frag-2']!, 27, 0.9, 1.05);
  phrase('frag-3', FRAGMENTS['frag-3']!, 29, 0.9, 1.0);
  phrase('frag-4', FRAGMENTS['frag-4']!, 31, 0.9, 1.15);
  for (const [b, s, p] of [[25, 1, 'Eb5'], [25, 3, 'F5'], [25, 9, 'Eb5'], [25, 10, 'C5'], [27, 1, 'Eb5'], [27, 3, 'F5'], [27, 9, 'Eb5'], [27, 10, 'C5'], [28, 13, 'C6'], [28, 15, 'Ab5'], [29, 1, 'F5'], [29, 3, 'Ab5'], [31, 13, 'G5'], [31, 15, 'E5']] as const) pluck(b, s, p, 0.55);

  // ================================================================ 5. BREAKDOWN "mulholland" (33-40): beatless, half speed
  const BD_HARM = ['db', 'bbm9', 'eb', 'cm7', 'fm', 'dbf', 'gb', 'c7'] as const;
  const BD_ROOT = ['Db2', 'Bb1', 'Eb2', 'C2', 'F1', 'F1', 'Gb1', 'C2'];
  add('atmos', { tick: at(33), hit: rain, v: 0.95, offset: 6, gate: 8 * 3840, attack: 1.5, release: 3, choke: 'rain' });
  add('atmos', { tick: at(35), hit: P.siren('siren', [[0, 72], [0.9, 77], [2.3, 75], [2.8, 80], [6.2, 79]], 9), v: 0.7 });
  add('kick', { tick: at(33), hit: K.boom, v: 0.5 }); add('fx', { tick: at(33), hit: P.impact(), v: 0.4 });
  BD_HARM.forEach((c, i) => {
    const b = 33 + i;
    pad(b, c, 0.85, 1, i === 0 ? 0.05 : 0.15);
    add('choir', { tick: at(b), hit: P.choirChord(`ch-${c}`, C[c].map(x => x + 12), i < 4 ? 'u' : 'a', 6), v: 0.55 + 0.04 * i, gate: 3840, attack: 0.3, release: 0.9, choke: 'choir' });
    add('bass', { tick: at(b), hit: P.bassNote(m(BD_ROOT[i]!)), v: 0.52, gate: 3840 - 120, attack: 0.08, release: 0.3, choke: 'bass' });
    ep(b, 1, c, 0.32, 15);
  });
  const SLOW = augment([...CALL, ...ANSWER]);
  phrase('slow', SLOW, 31, 0.5, 1.0, { vibCents: 34, glideSec: 0.06 });
  // the machine in the distance: dotted-eighth lattice of the hook's cell, accelerating to straight sixteenths in bar 40
  const cell = ms('Eb5', 'F5', 'C5', 'Ab4');
  for (let i = 0, s16 = 2 * 16; s16 < 7 * 16; i++, s16 += 3) pluck(33 + Math.floor(s16 / 16), (s16 % 16) + 1, cell[i % 4]!, 0.2 + 0.25 * (s16 / (7 * 16)), false, 0.45);
  for (let s = 1; s <= 12; s++) pluck(40, s, cell[(s - 1) % 4]!, 0.3 + s * 0.035, false, 0.5);
  for (const s of [1, 5, 9]) add('metal', { tick: at(39, s), hit: MT.tl, v: 0.35 + s * 0.02 });
  for (const s of [1, 3, 5, 7, 9, 10, 11, 12, 13, 14, 15, 16]) add('metal', { tick: at(40, s), hit: s % 2 ? MT.tl : MT.th, v: 0.4 + s * 0.028 });
  for (const s of [9, 10, 11, 12, 13, 14, 15, 16]) snare(40, s, 0.16 + s * 0.035, SN.ghost);
  add('fx', { tick: at(39, 9), hit: P.swell('swell-c', ms('G4', 'Bb4', 'Db5', 'E5'), S.beatSec * 4.5), v: 0.7 });
  // bar 40 beat 4: silence before the freeway

  // ================================================================ 6. HOOK 2 "freeway" (41-48): heaviest
  add('kick', { tick: at(41), hit: K.boom, v: 0.72 }); add('fx', { tick: at(41), hit: P.impact(), v: 0.8 });
  phrase('hook-a', [...CALL, ...ANSWER], 40);
  phrase('hook-c', [...CALL, ...ANSWER3], 44);  // V5: the ceiling climbs Ab5 (hook 1) -> Bb5 (hook 2) -> C6 (final)
  for (let b = 41; b <= 48; b++) {
    const c = HOOK_PROG[(b - 41) % 4]!, kind = b % 2 ? 'FA' : 'FB';
    drums(b, kind, { hats: 1, metal: ROOT[c], clap: true });
    bass(b, b === 48 ? toF : hookBass2[c]!, kind === 'FA' ? [1, 3, 8, 11] : [1, 4, 8, 11, 12, 15], 'all');
    pad(b, c, 0.66);
    add('choir', { tick: at(b), hit: P.choirChord(`ch-${c}`, C[c].map(x => x + 12), 'a', 6), v: 0.55, gate: 3840, attack: 0.12, release: 0.6, choke: 'choir' });
  }
  for (const [b, s, p] of [[42, 13, 'C6'], [42, 14, 'Ab5'], [42, 15, 'F5'], [44, 14, 'E5'], [44, 15, 'G5'], [44, 16, 'Bb5'], [46, 13, 'C6'], [46, 14, 'Ab5'], [46, 15, 'F5'], [48, 14, 'E5'], [48, 15, 'G5']] as const) pluck(b, s, p, 0.5, true, 0.6);

  // ================================================================ 7. SIGNAL LOSS (49-52): 3-3-3-3-4 against the bar
  const hitAll = (bar: number, step: number, low: string, v: number) => {
    kick(bar, step, v); add('snare', { tick: at(bar, step, 6), hit: SN.verb, v: v * 0.7 });
    add('metal', { tick: at(bar, step), hit: MT.anvil, v: v * 0.5 });
    add('bass', { tick: at(bar, step), hit: P.bassNote(m(low)), v, gate: 600, release: 0.05, choke: 'bass' });
    add('grit', { tick: at(bar, step), hit: P.gritNote(m(low) + 12, true), v: v * 0.9, gate: 560, release: 0.04, choke: 'grit' });
  };
  for (const b of [49, 50]) for (const s of [1, 4, 7, 10, 13]) hitAll(b, s, b === 50 && (s === 4 || s === 10) ? 'Gb1' : 'F1', s === 1 ? 0.95 : 0.8);
  for (let b = 49; b <= 51; b++) for (let s = 1; s <= 16; s++) add('hats', { tick: at(b, s), hit: H.tk, v: s % 4 === 1 ? 0.4 : 0.22 });
  // voice stutter: the Ab5 cry sliced into sixteenth repeats, as if the signal is dropping out
  const cry = toVoice([...CALL, ...ANSWER], 0), cryOffset = Number(((cry.notes[7]!.t + 230) * S.tickSec).toFixed(6));
  if (!BED) {
    for (let s = 1; s <= 8; s++) add('voice', { tick: at(51, s), hit: 'hook-a', v: 0.85 - s * 0.04, offset: cryOffset, gate: 150, attack: 0.002, release: 0.012, choke: 'stutter' });
    add('voice-space', { tick: at(51, 8), hit: 'hook-a', v: 0.9, offset: cryOffset, gate: 900, attack: 0.002, release: 0.5 });
  }
  for (const s of [9, 12, 15]) hitAll(51, s, 'F1', 0.85);
  add('fx', { tick: at(51, 9), hit: P.glitch(), v: 0.6 }); add('fx', { tick: at(50, 13), hit: P.glitch(), v: 0.45 });
  for (const s of [1, 4, 7]) hitAll(52, s, s === 7 ? 'C2' : 'F1', 0.9);
  // bar 52 beats 3-4: total silence (the rain is gated out too)
  add('atmos', { tick: at(49), hit: rain, v: 0.8, offset: 2, gate: 3 * 3840 + 1920, attack: 0.5, release: 0.08, choke: 'rain' });

  // ================================================================ 8. FINAL "sodium hours" (53-64)
  add('kick', { tick: at(53), hit: K.boom, v: 0.75 }); add('fx', { tick: at(53), hit: P.impact(), v: 0.9 });
  add('atmos', { tick: at(53), hit: rain2, v: 0.7, offset: 0.5, gate: 8 * 3840, attack: 2, release: 3, choke: 'rain' });
  const fa = [...CALL, ...ANSWER], fp = [...CALL, ...ANSWER_PEAK], fr = [...CALL, ...RESOLVE];
  phrase('hook-a-final', fa.map(x => ({ ...x, v: Math.min(1, (x.v ?? 0.8) + 0.06), vib: (x.vib ?? 1) * 1.15 })), 52, 0.92, 0.95, { seed: 777, vibCents: 31 }); phrase('hook-peak', fp, 56, 0.95, 0.95); phrase('hook-final', fr, 60, 0.95, 1.05);
  const ens = (name: string, notes: HookNote[], originBar: number, v: number) => {
    if (BED) return;
    const { start, notes: vn } = toVoice(notes, 0);
    add('choir', { tick: at(originBar) + start, hit: P.ensemble(name, vn, { vibCents: 22, breath: 0.07 }, 4, -12), v });
  };
  ens('ens-a', fa, 52, 0.82); ens('ens-peak', fp, 56, 0.88); ens('ens-final', fr, 60, 0.92);
  const FINAL_HARM = ['db', 'eb', 'fm', 'c7', 'db', 'eb', 'fm', 'c7', 'db', 'eb'] as const;
  // RISK PASS (V4): the final cadence (61-63) broadens into half time — kick on 1, hall snare + clap on beat 3,
  // long bass roots — while tempo, voice and ensemble continue. Accents land on structural melody notes.
  const HALF_TIME_CADENCE = true;
  const halfDrums = (bar: number, kicks: number[], root: string) => {
    for (const s of kicks) kick(bar, s, s === 1 ? 1 : 0.76);
    add('snare', { tick: at(bar, 9, 12), hit: SN.verb, v: 0.92 }); add('snare', { tick: at(bar, 9, 16), hit: SN.clap, v: 0.62 });
    for (const s of [1, 3, 5, 9, 11, 13]) hat(bar, s, (s % 4 === 1 ? 0.56 : 0.42) * 1.05);
    for (const s of [7, 15]) hat(bar, s, 0.42, H.o);
    const pipe = P.pipeAt(m(root));
    for (const [s, hit, v] of [[1, pipe, 0.62], [4, MT.anvil, 0.32], [7, pipe, 0.5], [9, pipe, 0.58], [12, MT.anvil, 0.36], [15, pipe, 0.48]] as [number, string, number][]) add('metal', { tick: at(bar, s), hit, v });
  };
  const HALF_BASS: BN[][] = [
    [[1, 8, 'Db2', 0.95], [9, 6, 'Ab1', 0.86], [15, 2, 'D2', 0.72]],
    [[1, 8, 'Eb2', 0.95], [9, 4, 'Bb1', 0.86], [13, 2, 'Eb2', 0.7], [15, 2, 'F1', 0.78]],
    [[1, 8, 'Gb1', 0.96], [9, 6, 'C2', 0.95], [15, 2, 'E2', 0.8]],
  ];
  for (let b = 53; b <= 62; b++) {
    const c = FINAL_HARM[b - 53]!, kind = b % 2 ? 'FA' : 'FB';
    if (HALF_TIME_CADENCE && b >= 61) {
      halfDrums(b, b === 61 ? [1, 11] : [1, 8, 11], ROOT[c]!);
      bass(b, HALF_BASS[b - 61]!, [1, 8, 11], 'all');
      pad(b, c, 0.74);
      continue;
    }
    drums(b, kind, { hats: 1.08, metal: ROOT[c], clap: true, lift: true });
    if (b <= 60) add('choir', { tick: at(b), hit: P.choirChord(`ch-${c}`, C[c].map(x => x + 12), 'a', 6), v: 0.4, gate: 3840, attack: 0.12, release: 0.6, choke: 'choir-c' });
    const toGb: BN[] = [[1, 6, 'Eb2', 0.92], [8, 2, 'Bb1', 0.8], [11, 2, 'Eb2', 0.88], [13, 1, 'Eb3', 0.55], [15, 2, 'F1', 0.8]];
    bass(b, b === 62 ? toGb : hookBass2[c]!, kind === 'FA' ? [1, 3, 8, 11] : [1, 4, 8, 11, 12, 15], 'all');
    pad(b, c, 0.74);
  }
  for (const b of [57, 61]) add('fx', { tick: at(b), hit: P.impact(), v: 0.5 });
  // bar 63: Neapolitan Gbmaj7 (beats 1-2) -> C7b9 (beats 3-4); bar 64: F MAJOR
  if (HALF_TIME_CADENCE) { halfDrums(63, [1, 11, 15], 'C3'); bass(63, HALF_BASS[2]!, [1, 11, 15], 'all'); }
  else {
    drums(63, 'FA', { hats: 1.08, metal: 'C3', clap: true, lift: true });
    bass(63, [[1, 6, 'Gb1', 0.95], [8, 1, 'Db2', 0.8], [9, 6, 'C2', 0.95], [15, 2, 'E2', 0.8]], [1, 3, 8, 11], 'all');
  }
  add('pad', { tick: at(63), hit: P.padChord('pad-gb', C.gb, 5.6), v: 0.72, gate: 1920, attack: 0.05, release: 0.35, choke: 'pad' });
  add('pad', { tick: at(63, 9), hit: P.padChord('pad-c7', C.c7, 5.6), v: 0.72, gate: 1920, attack: 0.05, release: 0.35, choke: 'pad' });
  add('choir', { tick: at(63), hit: P.choirChord('ch-gb', C.gb.map(x => x + 12), 'a', 6), v: 0.5, gate: 1920, attack: 0.1, release: 0.4, choke: 'choir-c' });
  add('choir', { tick: at(63, 9), hit: P.choirChord('ch-c7', C.c7.map(x => x + 12), 'a', 6), v: 0.52, gate: 1920, attack: 0.1, release: 0.4, choke: 'choir-c' });
  // the resolution: drums stop, F major opens (A natural), the voice lands on F5
  add('kick', { tick: at(64), hit: K.boom, v: 0.85 }); add('fx', { tick: at(64), hit: P.impact(), v: 0.85 });
  add('bass', { tick: at(64), hit: P.bassNote(m('F1'), 5.2), v: 0.95, gate: 2 * 3840, attack: 0.006, release: 1.2, choke: 'bass' });
  add('grit', { tick: at(64), hit: P.gritNote(m('F2'), false), v: 0.7, gate: 3840, release: 0.8, choke: 'grit' });
  add('pad', { tick: at(64), hit: P.padChord('pad-fmaj9', C.fmaj9, 5.6), v: 0.85, gate: 2 * 3840, attack: 0.05, release: 1.5, choke: 'pad' });
  add('choir', { tick: at(64), hit: P.choirChord('ch-fmaj9', C.fmaj9.map(x => x + 12), 'a', 7), v: 0.65, gate: 2 * 3840, attack: 0.2, release: 2, choke: 'choir-c' });
  snare(64, 1, 0.7, SN.verb);
  for (const [b, s, p] of [[53, 13, 'C6'], [54, 13, 'C6'], [54, 14, 'Ab5'], [54, 15, 'F5'], [56, 14, 'E5'], [56, 15, 'G5'], [56, 16, 'Bb5'], [58, 13, 'C6'], [58, 14, 'Ab5'], [58, 15, 'F5']] as const) pluck(b, s, p, 0.48, true, 0.6);
  // the machine sings along above the city: the hook's cell as a high dotted-eighth lattice
  const hi = ms('Eb6', 'F6', 'C6', 'Ab5');
  for (let i = 0, s16 = 0; s16 < 10 * 16; i++, s16 += 3) pluck(53 + Math.floor(s16 / 16), (s16 % 16) + 1, hi[i % 4]!, 0.16 + 0.06 * Math.sin(i * 0.7), false, 0.3);

  // ================================================================ 9. OUTRO "dawn" (65-70)
  add('atmos', { tick: at(65), hit: rain, v: 0.9, offset: 4, gate: 5 * 3840, attack: 1.5, release: 4, choke: 'rain' });
  add('atmos', { tick: at(65), hit: lamp, v: 0.55, attack: 2, release: 3 });
  ep(66, 1, 'fmaj9', 0.42, 16);
  add('pad', { tick: at(66), hit: P.padChord('pad-fmaj9', C.fmaj9, 5.6), v: 0.6, gate: 3840, attack: 0.3, release: 1, choke: 'pad' });
  add('pad', { tick: at(67), hit: P.padChord('pad-db11', C.db11, 5.6), v: 0.6, gate: 2 * 3840, attack: 0.4, release: 1, choke: 'pad' });
  ep(67, 1, 'db11', 0.38, 16);
  add('bass', { tick: at(67), hit: P.bassNote(m('Db2')), v: 0.6, gate: 2 * 3840 - 200, attack: 0.3, release: 0.8, choke: 'bass' });
  // the machine has learned the leading tone: its motif now rises E -> F
  const DAWN: [number, number, string][] = [[65, 1, 'E5'], [65, 3, 'F5'], [65, 9, 'E5'], [65, 10, 'C5'], [65, 13, 'E5'], [65, 15, 'F5'], [66, 1, 'A5'], [66, 9, 'G5'], [66, 10, 'F5'],
    [67, 1, 'Eb5'], [67, 3, 'F5'], [67, 9, 'Eb5'], [67, 10, 'C5'], [68, 1, 'Ab4'], [68, 5, 'C5'], [69, 1, 'E5'], [69, 3, 'F5']];
  for (const [b, s, p] of DAWN) pluck(b, s, p, 0.62, false, 0.85);
  add('kick', { tick: at(69), hit: K.boom, v: 0.78 });
  add('bass', { tick: at(69), hit: P.bassNote(m('F1'), 5.2), v: 0.8, gate: 3840 + 1920, attack: 0.006, release: 2, choke: 'bass' });
  add('pad', { tick: at(69), hit: P.padChord('pad-fmaj9', C.fmaj9, 5.6), v: 0.62, gate: 3840 + 1920, attack: 0.05, release: 2.5, choke: 'pad' });
  add('choir', { tick: at(69), hit: P.choirChord('ch-fmaj9-end', C.fmaj9.map(x => x + 12), 'a', 10.5, 6, 2.2), v: 0.6, attack: 0.3, release: 3, choke: 'choir-c' });

  // ================================================================ automation and master
  const lvl = (track: string, points: [number, number, boolean?][]) => { T[track]!.auto.gainDb = points.map(([bar, value, linear]) => ({ tick: (bar - 1) * 3840, value, linear })); };
  lvl('atmos', [[1, -6, true], [5, -7], [9, -13], [17, -15], [25, -14], [33, -7], [41, -15], [49, -11], [53, -15], [65, -7, true], [71, -9]]);
  lvl('pad', [[1, -9], [9, -7], [17, -8], [33, -11], [41, -4.5], [53, -3.5], [64, -3.5], [65, -7]]);
  lvl('keys', [[1, -6], [9, 1.5], [17, -6], [25, -2], [33, -9], [41, -8], [65, -5]]);
  lvl('grit', [[25, -15], [41, -6.5], [49, -6], [53, -6]]);
  lvl('choir', [[33, -13], [41, -6.5], [53, -3.5], [64, -4]]);
  lvl('voice-space', [[17, -6], [25, -4], [33, -6], [41, -4.5], [49, -3], [53, -4], [61, -3.5]]);
  lvl('pluck-space', [[1, -6], [9, -8], [33, -9], [53, -6], [65, -5]]);
  S.render = { duration: { seconds: 186.5 }, tail: 'auto' };
  // Master: gentle glue (only the loudest passages compress), a 6 dB tanh soft clip, then a 0 dB tanh ceiling stage.
  // Chosen offline with analysis/master_sim.py (reproduces the engine chain) for <= -1.0 dBTP with macro-dynamics kept.
  S.master = { gainDb: -4, effects: [{ type: 'highpass', frequencyHz: 28 }, { type: 'compressor', thresholdDb: -11, ratio: 1.6, attackMs: 30, releaseMs: 250 }, { type: 'saturation', driveDb: 6, mix: 1 }, { type: 'saturation', driveDb: 0, mix: 1 }] };
  return S;
}
