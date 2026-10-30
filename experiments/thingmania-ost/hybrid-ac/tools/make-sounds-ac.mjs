#!/usr/bin/env node
// Builds hybrid-ac/assets/ for the A+C experiment: every source WAV, a kit.json per instrument
// and palette.json with SHA-256 hashes. Deterministic: rerunning reproduces identical bytes.
//
//   node experiments/thingmania-ost/hybrid-ac/tools/make-sounds-ac.mjs
//
// Nothing new is invented at the DSP level. A's instruments are regenerated with A's exact
// recipes and seeds, and the script proves each one is byte-identical to the original WAV in
// a-sock-slide/assets. C's instruments (formant voice, close-harmony choir, kitchen kit) use
// C's recipes from ../../tools/instruments.mjs, re-pitched into A's key (E Dorian). C's kitchen
// percussion is also byte-identical to the original. The ding is retuned from C7 to E7.
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

// Short close-harmony stab: C's choirChord layout (each part sung twice at +/-7 cents, the
// copies leaning left and right) with the consonant burst of C's lead syllables, so the
// appliance choir can play rhythm, not only pads.
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

// C's choirChord, unchanged except that the two copies of each part lean further apart
// (0.85/0.15 instead of 0.7/0.3), so the choir is genuinely wide; L+R is unchanged for mono.
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

// C's lead syllable recipes, unchanged except for pitch, duration and seed.
const SYL = {
  ba: (n, o = {}) => I.voice(f(n), { dur: 0.4, onset: 'b', burst: 'b', vowel: 'a', glide: 0.04, ramp: 0.01, vibDepth: 0, scoop: -20, scale: 1.15, seed: noteToMidi(n), ...o }),
  da: (n, o = {}) => I.voice(f(n), { dur: 0.4, onset: 'd', burst: 'd', vowel: 'a', glide: 0.035, ramp: 0.008, vibDepth: 0, scoop: -15, scale: 1.15, seed: 100 + noteToMidi(n), ...o }),
  dee: (n, o = {}) => I.voice(f(n), { dur: 0.5, onset: 'd', burst: 'd', vowel: 'i', glide: 0.035, ramp: 0.006, vibDepth: 0, scoop: -25, scale: 1.15, seed: 200 + noteToMidi(n), ...o }),
  yah: (n, o = {}) => I.voice(f(n), { dur: 1.0, onset: 'i', vowel: 'a', glide: 0.09, ramp: 0.03, vibDepth: 24, vibDelay: 0.15, scoop: -40, scale: 1.15, seed: 300 + noteToMidi(n), ...o }),
};
const syl = (kind, n, o, note = '') => [`${kind}-${hitName(n)}`, `${n} "${kind}"${note}`, () => SYL[kind](n, o)];
// The kettle is a second, smaller appliance: higher formants, brighter tilt, its own seeds.
const KETTLE = { scale: 1.32, tilt: 0.95, scoop: -30 };
const kettle = (kind, n) => [`${kind}-${hitName(n)}`, `${n} "${kind}" (kettle: formant scale 1.32)`, () => SYL[kind](n, { ...KETTLE, seed: 900 + noteToMidi(n) + (kind === 'da' ? 40 : kind === 'dee' ? 80 : 0) })];

const tuned = (notes, make) => notes.map((n) => ({ name: hitName(n), pitch: noteToMidi(n), tuning: n, make: () => make(n) }));
const named = (entries, base = 36) => entries.map(([name, tuning, make, extra = {}], k) => ({ name, pitch: base + k, tuning, make, ...extra }));
const fromA = (kit, name) => ({ origin: { audition: 'a-sock-slide', file: `assets/${kit}/${name}.wav` } });
const fromC = (kit, name) => ({ origin: { audition: 'c-low-battery-choir', file: `assets/${kit}/${name}.wav` } });

const GROUPS = [
  // ----- A: SOCK SLIDE, regenerated with A's recipes and seeds -----
  { kit: 'bass', peakDb: -3, source: 'A', role: "A's squelch synth bass (saw/square, resonant two-stage lowpass, 75 ms sweep); plus one long F1 for AC-02's power failure.",
    hits: [...tuned(['F1', 'E1', 'G1', 'A1', 'Bb1', 'B1', 'D2', 'Eb2'], (n) => I.squelchBass(f(n), { seed: noteToMidi(n) })).map((h) => ({ ...h, ...fromA('bass', h.name) })),
      { name: 'f1-long', pitch: 60, tuning: 'F1 (A recipe, 1.3 s so a 3-semitone sag cannot run out of source)', make: () => I.squelchBass(f('F1'), { seed: noteToMidi('F1'), dur: 1.3 }) }] },
  { kit: 'whistle', peakDb: -4, source: 'A', role: "A's whistle: sine with a 35-cent scoop, delayed 5.4 Hz vibrato and pitch-tracking breath.",
    hits: tuned(['B5', 'C6', 'C#6', 'D6', 'E6'], (n) => I.whistle(f(n), { seed: noteToMidi(n) })).map((h) => ({ ...h, ...fromA('whistle', h.name) })) },
  { kit: 'clav', peakDb: -4, source: 'A', role: "A's clav stabs: rootless Em9, the F13 slip chord and a muted scratch.",
    hits: named([
      ['em9', 'G3 D4 F#4 B4 (Em9, rootless)', () => I.clavChord(['G3', 'D4', 'F#4', 'B4'].map(f), { seed: 31 }), fromA('clav', 'em9')],
      ['f13', 'A3 Eb4 G4 D5 (F13, rootless)', () => I.clavChord(['A3', 'Eb4', 'G4', 'D5'].map(f), { seed: 32, dur: 0.5 }), fromA('clav', 'f13')],
      ['chk', 'muted Em9 scratch', () => I.clavChord(['G3', 'D4', 'F#4', 'B4'].map(f), { seed: 33, muted: true, dur: 0.1 }), fromA('clav', 'chk')],
    ]) },
  { kit: 'drums', peakDb: -3, source: 'A', role: "A's tight synthesized funk kit.",
    hits: named([
      ['kick', 'sine 158->48 Hz', () => I.punchKick({ seed: 41 }), fromA('drums', 'kick')],
      ['snare', '190/340 Hz body + noise', () => I.tightSnare({ seed: 42 }), fromA('drums', 'snare')],
      ['hat-c', 'metallic, 35 ms', () => I.metalHat({ seed: 43 }), fromA('drums', 'hat-c')],
      ['hat-o', 'metallic, 250 ms', () => I.metalHat({ seed: 44, dur: 0.5, tau: 0.25 }), fromA('drums', 'hat-o')],
    ]) },
  // ----- C: LOW BATTERY CHOIR recipes, re-pitched into E Dorian -----
  { kit: 'voice', peakDb: -4, source: 'C', role: "The lead appliance (\"toaster\"): C's additive formant voice, one WAV per syllable and pitch, sung an octave below C's lead so it sits between the clav and the whistle.",
    hits: named([
      syl('ba', 'E4'), syl('ba', 'A4'),
      syl('da', 'G4'), syl('da', 'B4'), syl('da', 'C#5'), syl('da', 'E5'),
      syl('dee', 'A#4', {}, ' (the raised 4th of E = the Bb of the bass bend)'), syl('dee', 'D#5', {}, ' (the raised 4th of A)'),
      syl('yah', 'G4'), syl('yah', 'B4', { dur: 0.6 }), syl('yah', 'C#5'),
      syl('yah', 'D5', { dur: 1.4 }, ', 1.4 s for the 3-semitone sag'),
    ], 20) },
  { kit: 'kettle', peakDb: -4, source: 'C', role: 'A second, smaller appliance ("kettle") that harmonizes the tag in parallel fourths below: same recipe, higher formant scale.',
    hits: named([kettle('ba', 'B3'), kettle('da', 'D4'), kettle('dee', 'F4'), kettle('da', 'F#4')], 60) },
  { kit: 'choir', peakDb: -4, source: 'C', role: "C's close-harmony appliance choir (each part sung twice at +/-7 cents, the copies leaning 0.85/0.15 left/right for width), voiced for E Dorian; plus short stabs.",
    hits: named([
      ['aah-slip', 'G4 C5 D5 "oh-aah" (F6/9 sus over the F slip; sags onto E6/9 sus)', () => choirWide(['G4', 'C5', 'D5'].map(f), { dur: 1.5, vowel: 'a', onset: 'o', seed: 800 })],
      ['aah-em', 'B3 E4 G4 "oh-aah" (E minor)', () => choirWide(['B3', 'E4', 'G4'].map(f), { dur: 1.1, vowel: 'a', onset: 'o', seed: 810 })],
      ['aah-a', 'E4 A4 C#5 "oh-aah" (A major: the Dorian IV)', () => choirWide(['E4', 'A4', 'C#5'].map(f), { dur: 1.1, vowel: 'a', onset: 'o', seed: 820 })],
      ['dat-em7', 'G4 B4 D5 "da" stab (Em7 upper structure)', () => choirStab(['G4', 'B4', 'D5'].map(f), { seed: 830 })],
    ]) },
  { kit: 'kitchen', peakDb: -3, source: 'C', role: "C's household percussion (byte-identical) and the kitchen-timer ding retuned to E7.",
    hits: named([
      ['box', 'sine 95->52 Hz + box resonance 240 Hz', () => I.boxKick({ seed: 71 }), fromC('kitchen', 'box')],
      ['lid', 'metal modes 512-4485 Hz + slap', () => I.potLid({ seed: 72 }), fromC('kitchen', 'lid')],
      ['shaker', 'noise > 3.5 kHz, grainy', () => I.shaker({ seed: 73, hpHz: 3500, a: 0.01, tau: 0.04, dur: 0.1 }), fromC('kitchen', 'shaker')],
      ['ding', 'E7 small-bell partials (C used C7)', () => I.timerDing(f('E7'))],
    ]) },
];

const catalog = { experiment: 'hybrid-ac', generator: 'experiments/thingmania-ost/hybrid-ac/tools/make-sounds-ac.mjs',
  recipes: 'experiments/thingmania-ost/tools/instruments.mjs (unmodified)', format: '44100 Hz PCM16 WAV',
  origin: 'Synthesized from scratch by the generator; no recordings, samples, SoundFonts or third-party audio.', kits: [] };
let reused = 0, identical = 0;
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
    }
    entries.push(entry);
  }
  mkdirSync(dir, { recursive: true });
  writeFileSync(join(dir, 'kit.json'), JSON.stringify(kit, null, 2) + '\n');
  catalog.kits.push({ kit: `assets/${g.kit}/kit.json`, source: g.source, role: g.role, samples: entries });
}
catalog.reuse = { regeneratedFromOriginalRecipes: reused, byteIdenticalToOriginal: identical };
catalog.totalBytes = catalog.kits.flatMap((k) => k.samples).reduce((s, x) => s + x.bytes, 0);
writeFileSync(join(HERE, 'assets', 'palette.json'), JSON.stringify(catalog, null, 2) + '\n');
console.log(`hybrid-ac: ${catalog.kits.reduce((s, k) => s + k.samples.length, 0)} WAVs, ${(catalog.totalBytes / 1e6).toFixed(2)} MB; ` +
  `${identical}/${reused} reused sounds byte-identical to the A/C originals`);
if (identical !== reused) { console.error('A reused sound differs from its original.'); process.exitCode = 1; }
