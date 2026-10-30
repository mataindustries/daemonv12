#!/usr/bin/env node
// Generates every source WAV for the three auditions, plus DaemonV12 kit JSON and a
// palette catalog with SHA-256 hashes. Deterministic: rerunning reproduces identical bytes.
//
//   node experiments/thingmania-ost/tools/make-sounds.mjs [a-sock-slide|b-fridge-light|c-low-battery-choir]
//
// Melodic instruments are "multisampled": one exactly tuned WAV per pitch, exposed as a
// DaemonV12 drumkit so notes pick a pitch by name. Glides/octave pops use playbackRate.
import { writeFileSync, mkdirSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { noteFreq, noteToMidi, hitName, normalize, writeWav, peak } from './dsp.mjs';
import * as I from './instruments.mjs';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const f = noteFreq;

// Kit entry helpers. `pitch` only selects a hit inside its kit; tuning is recorded separately.
const tuned = (notes, make, extra = {}) => notes.map((n) => ({ name: hitName(n), pitch: noteToMidi(n), tuning: n, make: () => make(n), ...extra }));
const named = (entries, base = 36) => entries.map(([name, tuning, make], k) => ({ name, pitch: base + k, tuning, make }));

const PALETTES = {
  'a-sock-slide': [
    { kit: 'bass', peakDb: -3, role: 'Squelch synth bass: saw/square through a resonant two-stage lowpass with a 75 ms cutoff sweep.',
      hits: tuned(['F1', 'E1', 'G1', 'A1', 'Bb1', 'B1', 'D2', 'Eb2'], (n) => I.squelchBass(f(n), { seed: noteToMidi(n) })) },
    { kit: 'whistle', peakDb: -4, role: 'Whistled lead: sine with 35-cent scoop, delayed 5.4 Hz vibrato and pitch-tracking breath.',
      hits: tuned(['B5', 'C6', 'C#6', 'D6', 'E6'], (n) => I.whistle(f(n), { seed: noteToMidi(n) })) },
    { kit: 'clav', peakDb: -4, role: 'Clav-like chord stabs (rootless voicings) and a muted scratch.',
      hits: named([
        ['em9', 'G3 D4 F#4 B4 (Em9, rootless)', () => I.clavChord(['G3', 'D4', 'F#4', 'B4'].map(f), { seed: 31 })],
        ['f13', 'A3 Eb4 G4 D5 (F13, rootless)', () => I.clavChord(['A3', 'Eb4', 'G4', 'D5'].map(f), { seed: 32, dur: 0.5 })],
        ['chk', 'muted Em9 scratch', () => I.clavChord(['G3', 'D4', 'F#4', 'B4'].map(f), { seed: 33, muted: true, dur: 0.1 })],
      ]) },
    { kit: 'drums', peakDb: -3, role: 'Tight synthesized funk kit.',
      hits: named([
        ['kick', 'sine 158->48 Hz', () => I.punchKick({ seed: 41 })],
        ['snare', '190/340 Hz body + noise', () => I.tightSnare({ seed: 42 })],
        ['hat-c', 'metallic, 35 ms', () => I.metalHat({ seed: 43 })],
        ['hat-o', 'metallic, 250 ms', () => I.metalHat({ seed: 44, dur: 0.5, tau: 0.25 })],
      ]) },
  ],
  'b-fridge-light': [
    { kit: 'bass', peakDb: -3, role: 'Ratio-1 FM bass with a decaying growl, lowpassed at 1.6 kHz.',
      hits: tuned(['E1', 'F1', 'Bb1', 'Db2'], (n) => I.fmBass(f(n), { seed: noteToMidi(n) })) },
    { kit: 'keys', peakDb: -4, role: 'Stereo FM electric-piano chords; constant-sum autopan keeps the mono fold steady.',
      hits: named([
        ['fm11', 'Ab3 Eb4 G4 Bb4 (Fm11, rootless)', () => I.fmKeysChord(['Ab3', 'Eb4', 'G4', 'Bb4'].map(f), { seed: 51, dur: 1.2 })],
        ['dbmaj9s11', 'Ab3 C4 Eb4 G4 (Dbmaj9#11 over the Db bass)', () => I.fmKeysChord(['Ab3', 'C4', 'Eb4', 'G4'].map(f), { seed: 52, dur: 1.2 })],
        ['bbm9', 'Ab3 Db4 F4 C5 (Bbm9)', () => I.fmKeysChord(['Ab3', 'Db4', 'F4', 'C5'].map(f), { seed: 53, dur: 1.2 })],
        ['emaj9', 'G#4 B4 D#5 F#5 (Emaj9, lifted an octave: the light)', () => I.fmKeysChord(['G#4', 'B4', 'D#5', 'F#5'].map(f), { seed: 54, dur: 2.0 })],
      ]) },
    { kit: 'bell', peakDb: -4, role: 'Inharmonic 3.5:1 FM glass bell.',
      hits: tuned(['Ab5', 'Bb5', 'B5', 'C6', 'Db6', 'Eb6'], (n) => I.glassBell(f(n))) },
    { kit: 'drums', peakDb: -3, role: 'Deep kick, cabinet knock, shaker and four tuned faucet drips (pitch = end of the plip).',
      hits: named([
        ['kick', 'sine 134->44 Hz, long', () => I.punchKick({ seed: 61, base: 44, sweep: 90, tau: 0.38, dur: 0.6 })],
        ['knock', 'wood modes 640/1510 Hz', () => I.cabinetKnock({ seed: 62 })],
        ['shaker', 'noise > 4.5 kHz', () => I.shaker({ seed: 63 })],
        ...['C6', 'Eb6', 'F6', 'Ab6'].map((n) => [`drip-${hitName(n)}`, `${n} (rises from ${n} / 2.3)`, () => I.drip(f(n) / 2.3)]),
      ]) },
  ],
  'c-low-battery-choir': [
    { kit: 'lead', peakDb: -4, role: 'Additive formant voice singing syllables; one WAV per syllable and pitch.',
      hits: named([
        ...['C5', 'D5', 'Bb4', 'Ab4'].map((n) => [`ba-${hitName(n)}`, `${n} "ba"`, () => I.voice(f(n), { dur: 0.32, onset: 'b', burst: 'b', vowel: 'a', glide: 0.04, ramp: 0.01, vibDepth: 0, scoop: -20, scale: 1.15, seed: noteToMidi(n) })]),
        ...['E5', 'G5', 'F#5', 'A5', 'D5', 'F5', 'C5', 'Eb5'].map((n) => [`da-${hitName(n)}`, `${n} "da"`, () => I.voice(f(n), { dur: 0.32, onset: 'd', burst: 'd', vowel: 'a', glide: 0.035, ramp: 0.008, vibDepth: 0, scoop: -15, scale: 1.15, seed: 100 + noteToMidi(n) })]),
        ...['F#5', 'G#5', 'E5', 'D5'].map((n) => [`dee-${hitName(n)}`, `${n} "dee"`, () => I.voice(f(n), { dur: 0.32, onset: 'd', burst: 'd', vowel: 'i', glide: 0.035, ramp: 0.006, vibDepth: 0, scoop: -25, scale: 1.15, seed: 200 + noteToMidi(n) })]),
        ...['E5', 'F#5', 'D5', 'C5'].map((n) => [`yah-${hitName(n)}`, `${n} "yaah" with vibrato`, () => I.voice(f(n), { dur: 0.95, onset: 'i', vowel: 'a', glide: 0.09, ramp: 0.03, vibDepth: 24, vibDelay: 0.15, scoop: -40, scale: 1.15, seed: 300 + noteToMidi(n) })]),
      ], 20) },
    { kit: 'bass', peakDb: -3, role: 'Vocal bass "doom": male /u/ formants with a sine body.',
      hits: [['C2', 0.5], ['G1', 0.5], ['Bb1', 0.5], ['Ab1', 0.95]].map(([n, dur]) => ({
        name: `doom-${hitName(n)}`, pitch: noteToMidi(n), tuning: n,
        make: () => I.voice(f(n), { dur, onset: 'd', burst: 'd', vowel: 'uMale', glide: 0.05, ramp: 0.01, tilt: 1.2, vibDepth: 0, scoop: -10, maxHz: 5000, sub: 1.0, seed: 400 + noteToMidi(n) }),
      })) },
    { kit: 'choir', peakDb: -4, role: 'Close-harmony choir chords, "ooh" and "oh-aah", sung twice per part at +/-7 cents.',
      hits: named([
        ['c', ['E4', 'G4', 'C5']], ['d', ['F#4', 'A4', 'D5']], ['bb', ['F4', 'Bb4', 'D5']], ['ab', ['Eb4', 'Ab4', 'C5']],
      ].flatMap(([name, notes], k) => [
        [`ooh-${name}`, `${notes.join(' ')} "ooh"`, () => I.choirChord(notes.map(f), { dur: 1.05, vowel: 'u', seed: 500 + 10 * k })],
        [`aah-${name}`, `${notes.join(' ')} "oh-aah"`, () => I.choirChord(notes.map(f), { dur: name === 'ab' ? 1.0 : 0.85, vowel: 'a', onset: 'o', seed: 600 + 10 * k })],
      ])) },
    { kit: 'kitchen', peakDb: -3, role: 'Household percussion: cardboard-box kick, spoon-on-pot-lid snare, rice shaker, kitchen-timer ding.',
      hits: named([
        ['box', 'sine 95->52 Hz + box resonance 240 Hz', () => I.boxKick({ seed: 71 })],
        ['lid', 'metal modes 512-4485 Hz + slap', () => I.potLid({ seed: 72 })],
        ['shaker', 'noise > 3.5 kHz, grainy', () => I.shaker({ seed: 73, hpHz: 3500, a: 0.01, tau: 0.04, dur: 0.1 })],
        ['ding', 'C7 small-bell partials', () => I.timerDing(f('C7'))],
      ]) },
  ],
};

const only = process.argv[2];
for (const [audition, groups] of Object.entries(PALETTES)) {
  if (only && only !== audition) continue;
  const catalog = { audition, generator: 'experiments/thingmania-ost/tools/make-sounds.mjs', format: '44100 Hz PCM16 WAV',
    origin: 'Synthesized from scratch by the generator; no recordings, samples, SoundFonts or third-party audio.', kits: [] };
  for (const g of groups) {
    const dir = join(ROOT, audition, 'assets', g.kit);
    const kit = { formatVersion: 1, samples: [] }, entries = [];
    for (const h of g.hits) {
      const chans = h.make();
      const preNormPeak = peak(chans);
      normalize(chans, g.peakDb);
      const file = `${h.name}.wav`;
      const info = writeWav(join(dir, file), chans);
      kit.samples.push({ name: h.name, pitch: h.pitch, file });
      entries.push({ name: h.name, file, tuning: h.tuning, seconds: Number((info.frames / 44100).toFixed(4)), ...info, peakDbfs: g.peakDb, preNormPeak: Number(preNormPeak.toFixed(4)) });
    }
    mkdirSync(dir, { recursive: true });
    writeFileSync(join(dir, 'kit.json'), JSON.stringify(kit, null, 2) + '\n');
    catalog.kits.push({ kit: `assets/${g.kit}/kit.json`, role: g.role, samples: entries });
  }
  catalog.totalBytes = catalog.kits.flatMap((k) => k.samples).reduce((s, x) => s + x.bytes, 0);
  writeFileSync(join(ROOT, audition, 'assets', 'palette.json'), JSON.stringify(catalog, null, 2) + '\n');
  console.log(`${audition}: ${catalog.kits.reduce((s, k) => s + k.samples.length, 0)} WAVs, ${(catalog.totalBytes / 1e6).toFixed(2)} MB`);
}
