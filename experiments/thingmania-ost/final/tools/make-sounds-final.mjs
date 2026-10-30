#!/usr/bin/env node
// Builds final/assets/ for the THING//MANIA official soundtrack: every source WAV, a kit.json
// per instrument and palette.json with SHA-256 hashes. Deterministic: rerunning reproduces
// identical bytes.
//
//   node experiments/thingmania-ost/final/tools/make-sounds-final.mjs
//
// The soundtrack is AC-01 GROOVE FIRST grown into a full theme, so its palette is AC-01's.
// Every sound AC-01 uses is regenerated here with the exact AC-01 recipe and seed, and the
// script proves each one byte-identical to the approved WAV in hybrid-ac/assets. New sounds
// are the same instruments at new pitches or voicings (the riff transposed to A, C and D; the
// whistle's harmony notes; clav and choir chords for the new harmony; the menu's hummed pads;
// the kettle-boil riser). They call the recipes in ../../tools/instruments.mjs unmodified.
import { writeFileSync, mkdirSync, readFileSync, existsSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createHash } from 'node:crypto';
import { noteFreq, noteToMidi, hitName, normalize, writeWav, peak, buffer, mixInto } from '../../tools/dsp.mjs';
import * as I from '../../tools/instruments.mjs';

const HERE = join(dirname(fileURLToPath(import.meta.url)), '..');
const OST = join(HERE, '..');
const f = noteFreq;
const sha = (p) => createHash('sha256').update(readFileSync(p)).digest('hex');

// ---------- AC-01's two choir layouts, copied verbatim from hybrid-ac/tools/make-sounds-ac.mjs ----------
// Short close-harmony stab: C's choirChord layout with the consonant burst of C's lead syllables.
function choirStab(freqs, { dur = 0.34, seed = 700, lean = 0.85 } = {}) {
  const L = buffer(dur), R = buffer(dur);
  freqs.forEach((fr, k) => {
    for (const side of [-1, 1]) {
      const [v] = I.voice(fr, { dur, vowel: 'a', onset: 'd', burst: 'd', glide: 0.035, ramp: 0.008, tilt: 1.35, vibDepth: 0,
        scoop: -15, breath: 0.03, detune: 7 * side, scale: 1.15, seed: seed + 17 * k + (side > 0 ? 5 : 0) });
      mixInto(side < 0 ? L : R, v, lean);
      mixInto(side < 0 ? R : L, v, 1 - lean);
    }
  });
  return [L, R];
}
// C's choirChord with the two copies of each part leaning 0.85/0.15 (AC-01's wide choir).
function choirWide(freqs, { dur = 1.0, vowel = 'u', onset = null, seed = 12, lean = 0.85 } = {}) {
  const L = buffer(dur), R = buffer(dur);
  freqs.forEach((fr, k) => {
    for (const side of [-1, 1]) {
      const [v] = I.voice(fr, { dur, vowel, onset, glide: 0.07, tilt: 1.35, vibDepth: 14, vibRate: 5.1 + 0.3 * k + 0.2 * side,
        vibDelay: 0.12, scoop: -20, breath: 0.03, detune: 7 * side, seed: seed + 17 * k + (side > 0 ? 5 : 0), ramp: 0.05 });
      mixInto(side < 0 ? L : R, v, lean);
      mixInto(side < 0 ? R : L, v, 1 - lean);
    }
  });
  return [L, R];
}

// C's lead syllable recipes as AC-01 used them (pitch, duration and seed only).
const SYL = {
  ba: (n, o = {}) => I.voice(f(n), { dur: 0.4, onset: 'b', burst: 'b', vowel: 'a', glide: 0.04, ramp: 0.01, vibDepth: 0, scoop: -20, scale: 1.15, seed: noteToMidi(n), ...o }),
  da: (n, o = {}) => I.voice(f(n), { dur: 0.4, onset: 'd', burst: 'd', vowel: 'a', glide: 0.035, ramp: 0.008, vibDepth: 0, scoop: -15, scale: 1.15, seed: 100 + noteToMidi(n), ...o }),
  dee: (n, o = {}) => I.voice(f(n), { dur: 0.5, onset: 'd', burst: 'd', vowel: 'i', glide: 0.035, ramp: 0.006, vibDepth: 0, scoop: -25, scale: 1.15, seed: 200 + noteToMidi(n), ...o }),
  yah: (n, o = {}) => I.voice(f(n), { dur: 1.0, onset: 'i', vowel: 'a', glide: 0.09, ramp: 0.03, vibDepth: 24, vibDelay: 0.15, scoop: -40, scale: 1.15, seed: 300 + noteToMidi(n), ...o }),
};
const syl = (kind, n, o, note = '') => [`${kind}-${hitName(n)}`, `${n} "${kind}"${note}`, () => SYL[kind](n, o), fromAC('voice', `${kind}-${hitName(n)}`)];
const KETTLE = { scale: 1.32, tilt: 0.95, scoop: -30 };
const kettle = (kind, n) => [`${kind}-${hitName(n)}`, `${n} "${kind}" (kettle: formant scale 1.32)`,
  () => SYL[kind](n, { ...KETTLE, seed: 900 + noteToMidi(n) + (kind === 'da' ? 40 : kind === 'dee' ? 80 : 0) }), fromAC('kettle', `${kind}-${hitName(n)}`)];

const fromAC = (kit, name) => ({ origin: { audition: 'hybrid-ac', file: `assets/${kit}/${name}.wav` } });
// Pitched kits: kit pitch = the note's MIDI number, so a project note "E1" plays e1.wav.
const tuned = (notes, make, origin) => notes.map((n) => ({ name: hitName(n), pitch: noteToMidi(n), tuning: n, make: () => make(n), ...(origin ? origin(hitName(n)) : {}) }));
const named = (entries, base = 36) => entries.map(([name, tuning, make, extra = {}], k) => ({ name, pitch: base + k, tuning, make, ...extra }));
const NEW = (why) => ({ isNew: why });

// Pads for the menu mix: the appliances hum. AC-01's wide choir layout with C's closed "oo"
// vowel and no consonant, long enough to hold one bar (2.2625 s) plus its release.
const hum = (notes, seed) => () => choirWide(notes.map(f), { dur: 2.6, vowel: 'u', onset: 'o', seed });

const GROUPS = [
  { kit: 'bass', peakDb: -3, role: "A's squelch synth bass (saw/square, resonant two-stage lowpass, 75 ms sweep). New pitches carry the riff to A, C and D in the development.",
    hits: [
      ...tuned(['F1', 'E1', 'G1', 'A1', 'Bb1', 'B1', 'D2', 'Eb2'], (n) => I.squelchBass(f(n), { seed: noteToMidi(n) }), (h) => fromAC('bass', h)),
      ...tuned(['C2', 'E2', 'F2', 'F#2', 'G2', 'G#2'], (n) => I.squelchBass(f(n), { seed: noteToMidi(n) }))
        .map((h) => ({ ...h, ...NEW('riff transposed to A, C and D (bars 9-12)') })),
    ] },
  { kit: 'whistle', peakDb: -4, role: "A's whistle: sine with a 35-cent scoop, delayed 5.4 Hz vibrato and pitch-tracking breath. New pitches are the harmony a sixth below the hook and the bar-10 answer in A.",
    hits: [
      ...tuned(['B5', 'C6', 'C#6', 'D6', 'E6'], (n) => I.whistle(f(n), { seed: noteToMidi(n) }), (h) => fromAC('whistle', h)),
      ...tuned(['D5', 'E5', 'F#5', 'G5', 'A5', 'D#6'], (n) => I.whistle(f(n), { seed: noteToMidi(n) }))
        .map((h) => ({ ...h, ...NEW('harmony a sixth under the hook (D5-G5); the whistle copying the A tag (A5, D#6)') })),
    ] },
  { kit: 'clav', peakDb: -4, role: "A's clav stabs. New rootless voicings move one or two voices at a time: Em9 -> A13 changes only D4 to C#4 (the Dorian 6th).",
    hits: named([
      ['em9', 'G3 D4 F#4 B4 (Em9, rootless)', () => I.clavChord(['G3', 'D4', 'F#4', 'B4'].map(f), { seed: 31 }), fromAC('clav', 'em9')],
      ['f13', 'A3 Eb4 G4 D5 (F13, rootless)', () => I.clavChord(['A3', 'Eb4', 'G4', 'D5'].map(f), { seed: 32, dur: 0.5 }), fromAC('clav', 'f13')],
      ['chk', 'muted Em9 scratch', () => I.clavChord(['G3', 'D4', 'F#4', 'B4'].map(f), { seed: 33, muted: true, dur: 0.1 }), fromAC('clav', 'chk')],
      ['a13', 'G3 C#4 F#4 B4 (A13, rootless: the Dorian IV)', () => I.clavChord(['G3', 'C#4', 'F#4', 'B4'].map(f), { seed: 34 }), NEW('development harmony, bars 9-10')],
      ['cmaj9', 'G3 B3 D4 E4 (Cmaj9, rootless: bVI)', () => I.clavChord(['G3', 'B3', 'D4', 'E4'].map(f), { seed: 35 }), NEW('bVI hit, bar 11')],
      ['d69', 'A3 B3 E4 F#4 (D6/9, rootless: bVII)', () => I.clavChord(['A3', 'B3', 'E4', 'F#4'].map(f), { seed: 36 }), NEW('bVII hit, bar 12')],
    ]) },
  { kit: 'drums', peakDb: -3, role: "A's tight synthesized funk kit.",
    hits: named([
      ['kick', 'sine 158->48 Hz', () => I.punchKick({ seed: 41 }), fromAC('drums', 'kick')],
      ['snare', '190/340 Hz body + noise', () => I.tightSnare({ seed: 42 }), fromAC('drums', 'snare')],
      ['hat-c', 'metallic, 35 ms', () => I.metalHat({ seed: 43 }), fromAC('drums', 'hat-c')],
      ['hat-o', 'metallic, 250 ms', () => I.metalHat({ seed: 44, dur: 0.5, tau: 0.25 }), fromAC('drums', 'hat-o')],
    ]) },
  { kit: 'voice', peakDb: -4, role: 'The lead appliance ("toaster"): C\'s additive formant voice, exactly AC-01\'s twelve syllables.',
    hits: named([
      syl('ba', 'E4'), syl('ba', 'A4'),
      syl('da', 'G4'), syl('da', 'B4'), syl('da', 'C#5'), syl('da', 'E5'),
      syl('dee', 'A#4', {}, ' (the raised 4th of E = the Bb of the bass bend)'), syl('dee', 'D#5', {}, ' (the raised 4th of A)'),
      syl('yah', 'G4'), syl('yah', 'B4', { dur: 0.6 }), syl('yah', 'C#5'),
      syl('yah', 'D5', { dur: 1.4 }, ', 1.4 s'),
    ], 20) },
  { kit: 'kettle', peakDb: -4, role: 'The second appliance ("kettle"), harmonizing the tag a fourth below: exactly AC-01\'s four syllables.',
    hits: named([kettle('ba', 'B3'), kettle('da', 'D4'), kettle('dee', 'F4'), kettle('da', 'F#4')], 60) },
  { kit: 'choir', peakDb: -4, role: "AC-01's close-harmony appliance choir (each part sung twice at +/-7 cents, the copies leaning 0.85/0.15). New: 'da' stabs for the bVI-bVII hits.",
    hits: named([
      ['aah-slip', 'G4 C5 D5 "oh-aah" (sags onto E6/9 sus)', () => choirWide(['G4', 'C5', 'D5'].map(f), { dur: 1.5, vowel: 'a', onset: 'o', seed: 800 }), fromAC('choir', 'aah-slip')],
      ['aah-em', 'B3 E4 G4 "oh-aah" (E minor)', () => choirWide(['B3', 'E4', 'G4'].map(f), { dur: 1.1, vowel: 'a', onset: 'o', seed: 810 }), fromAC('choir', 'aah-em')],
      ['aah-a', 'E4 A4 C#5 "oh-aah" (A major: the Dorian IV)', () => choirWide(['E4', 'A4', 'C#5'].map(f), { dur: 1.1, vowel: 'a', onset: 'o', seed: 820 }), fromAC('choir', 'aah-a')],
      ['dat-em7', 'G4 B4 D5 "da" stab (Em7 upper structure)', () => choirStab(['G4', 'B4', 'D5'].map(f), { seed: 830 }), fromAC('choir', 'dat-em7')],
      ['dat-c', 'E4 G4 C5 "da" stab (C, first inversion)', () => choirStab(['E4', 'G4', 'C5'].map(f), { seed: 840 }), NEW('bVI hit, bar 11')],
      ['dat-d', 'F#4 A4 D5 "da" stab (D, first inversion)', () => choirStab(['F#4', 'A4', 'D5'].map(f), { seed: 850 }), NEW('bVII hit, bar 12')],
    ]) },
  { kit: 'hum', peakDb: -4, role: 'Menu mix only: the appliance choir humming the theme\'s harmony on a closed "oo" (AC-01\'s wide choir layout, vowel u). Formants sit below 1 kHz, leaving 2-6 kHz free for UI sounds.',
    hits: named([
      ['hum-em9', 'G3 D4 F#4 B4 "oo" (Em9)', hum(['G3', 'D4', 'F#4', 'B4'], 870), NEW('menu pad')],
      ['hum-a13', 'G3 C#4 F#4 B4 "oo" (A13)', hum(['G3', 'C#4', 'F#4', 'B4'], 880), NEW('menu pad')],
      ['hum-c', 'G3 B3 E4 "oo" (Cmaj7)', hum(['G3', 'B3', 'E4'], 890), NEW('menu pad')],
      ['hum-d', 'A3 D4 F#4 "oo" (D)', hum(['A3', 'D4', 'F#4'], 900), NEW('menu pad')],
    ]) },
  { kit: 'kitchen', peakDb: -3, role: "C's household percussion: cardboard-box kick, spoon on pot lid, rice-jar shaker (byte-identical to AC-01's, which are byte-identical to C's).",
    hits: named([
      ['box', 'sine 95->52 Hz + box resonance 240 Hz', () => I.boxKick({ seed: 71 }), fromAC('kitchen', 'box')],
      ['lid', 'metal modes 512-4485 Hz + slap', () => I.potLid({ seed: 72 }), fromAC('kitchen', 'lid')],
      ['shaker', 'noise > 3.5 kHz, grainy', () => I.shaker({ seed: 73, hpHz: 3500, a: 0.01, tau: 0.04, dur: 0.1 }), fromAC('kitchen', 'shaker')],
    ]) },
  { kit: 'fx', peakDb: -3, role: 'Kitchen FX: the E7 timer ding (AC-01) and a kettle coming to the boil (A\'s whistle recipe at E5, held 1.6 s, glided up an octave in the score).',
    hits: named([
      ['ding', 'E7 small-bell partials', () => I.timerDing(f('E7')), fromAC('kitchen', 'ding')],
      ['boil', 'E5 whistle, 1.6 s (glided E5 -> E6 in the score)', () => I.whistle(f('E5'), { seed: noteToMidi('E5') + 500, dur: 1.6 }), NEW('the charge-up riser into the hook return, bar 12')],
    ]) },
];

const catalog = { experiment: 'final', generator: 'experiments/thingmania-ost/final/tools/make-sounds-final.mjs',
  recipes: 'experiments/thingmania-ost/tools/instruments.mjs (unmodified)', format: '44100 Hz PCM16 WAV',
  origin: 'Synthesized from scratch by the generator; no recordings, samples, SoundFonts, General MIDI or third-party audio.', kits: [] };
let reused = 0, identical = 0, fresh = 0;
for (const g of GROUPS) {
  const dir = join(HERE, 'assets', g.kit);
  const kit = { formatVersion: 1, samples: [] }, entries = [];
  for (const h of g.hits) {
    const chans = h.make();
    const preNormPeak = peak(chans);
    normalize(chans, g.peakDb);
    const file = `${h.name}.wav`;
    const info = writeWav(join(dir, file), chans);
    kit.samples.push({ name: h.name, pitch: h.pitch, file });
    const entry = { name: h.name, file, tuning: h.tuning, seconds: Number((info.frames / 44100).toFixed(4)), ...info, peakDbfs: g.peakDb, preNormPeak: Number(preNormPeak.toFixed(4)) };
    if (h.origin) {
      const orig = join(OST, h.origin.audition, h.origin.file);
      const origSha = existsSync(orig) ? sha(orig) : null;
      entry.reusedFrom = { ...h.origin, sha256: origSha, byteIdentical: origSha === info.sha256 };
      reused++; if (entry.reusedFrom.byteIdentical) identical++;
    } else { entry.newForFinal = h.isNew ?? true; fresh++; }
    entries.push(entry);
  }
  mkdirSync(dir, { recursive: true });
  writeFileSync(join(dir, 'kit.json'), JSON.stringify(kit, null, 2) + '\n');
  catalog.kits.push({ kit: `assets/${g.kit}/kit.json`, role: g.role, samples: entries });
}
catalog.reuse = { regeneratedFromAc01: reused, byteIdenticalToAc01: identical, newSounds: fresh };
catalog.totalBytes = catalog.kits.flatMap((k) => k.samples).reduce((s, x) => s + x.bytes, 0);
writeFileSync(join(HERE, 'assets', 'palette.json'), JSON.stringify(catalog, null, 2) + '\n');
console.log(`final: ${reused + fresh} WAVs, ${(catalog.totalBytes / 1e6).toFixed(2)} MB; ${identical}/${reused} AC-01 sounds byte-identical; ${fresh} new`);
if (identical !== reused) { console.error('A reused sound differs from its AC-01 original.'); process.exitCode = 1; }
