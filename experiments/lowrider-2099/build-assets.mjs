// Render every LOWRIDER//2099 sound into ./assets as PCM16 mono 44.1 kHz WAV plus DaemonV12 kit
// files. Deterministic: same Node version -> same bytes. Run: node build-assets.mjs
import { writeFileSync, readFileSync, mkdirSync, rmSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { join } from 'node:path';
import * as I from './instruments.mjs';
import { TALKBOX } from './score.mjs';
import { BEAST, renderBeastPhrase } from './beast-phrases.mjs';

const ROOT = new URL('./assets/', import.meta.url).pathname;
rmSync(ROOT, { recursive: true, force: true });
const manifest = [];
const NAMES = ['C', 'Db', 'D', 'Eb', 'E', 'F', 'Gb', 'G', 'Ab', 'A', 'Bb', 'B'];
const noteName = m => `${NAMES[m % 12]}${Math.floor(m / 12) - 1}`;

function kit(dir, entries) {
  mkdirSync(join(ROOT, dir), { recursive: true });
  const samples = [];
  for (const e of entries) {
    const file = `${e.name}.wav`, path = join(ROOT, dir, file);
    const info = I.writeWav16(path, e.audio, e.peakDb ?? -1);
    samples.push({ name: e.name, pitch: e.pitch, file });
    manifest.push({ path: `assets/${dir}/${file}`, seconds: +info.seconds.toFixed(4), peakDb: e.peakDb ?? -1, sha256: createHash('sha256').update(readFileSync(path)).digest('hex'), what: e.what });
  }
  writeFileSync(join(ROOT, dir, 'kit.json'), JSON.stringify({ formatVersion: 1, samples }, null, 2) + '\n');
}

// lead: one file per pitch (played at rate 1; rate/glide only for scoops, slides and falls)
kit('lead', [72, 75, 77, 79, 80, 82, 84, 85, 87].map(m => ({
  name: noteName(m).toLowerCase(), pitch: m, audio: I.lead(m), peakDb: -1, what: `G-funk whine lead ${noteName(m)}`,
})));

// 808: one file per root used, so straight notes are exact copies and slides start in tune;
// two 808 voicings: A's rounder bounce 808 and B's dirty takeover 808 (more drive = more of it on a phone)
kit('808', [29, 32, 34, 36, 37, 39, 41].map(m => ({
  name: noteName(m).toLowerCase(), pitch: m, audio: I.bass808(m, 2.6, 0.75, 4.2), peakDb: -3, what: `saturated 808 ${noteName(m)}`,
})));
kit('808-dirty', [29, 32, 34, 36, 37, 39, 41].map(m => ({
  name: noteName(m).toLowerCase(), pitch: m, audio: I.bass808(m, 2.6, 0.9, 5.5), peakDb: -3, what: `distorted 808 ${noteName(m)}`,
})));

kit('drums', [
  { name: 'kick', pitch: 36, audio: I.kick(), peakDb: -2, what: 'short knock kick, 58 Hz end pitch, beater click' },
  { name: 'rim', pitch: 37, audio: I.rim(), peakDb: -3, what: 'modal rim' },
  { name: 'clap', pitch: 39, audio: I.clap(), what: 'dry four-burst clap' },
  { name: 'snap', pitch: 40, audio: I.snap(), peakDb: -3, what: 'finger snap' },
  { name: 'snare', pitch: 38, audio: I.snare(), what: 'tight tuned trap snare' },
  { name: 'hat', pitch: 42, audio: I.hat(0.035, 0.2), peakDb: -3, what: 'closed metal hat' },
  { name: 'hat-tick', pitch: 44, audio: I.hat(0.016, 0.1, 43), peakDb: -3, what: 'short hat for rolls' },
  { name: 'hat-open', pitch: 46, audio: I.hat(0.26, 0.9, 45), peakDb: -3, what: 'open hat' },
  { name: 'shaker', pitch: 70, audio: I.shaker(false), peakDb: -3, what: 'shaker push' },
  { name: 'shaker-pull', pitch: 69, audio: I.shaker(true), peakDb: -3, what: 'shaker pull' },
]);

kit('fx', [
  { name: 'hop', pitch: 50, audio: I.hop(), what: 'hydraulic pssht + chassis clunk' },
  { name: 'riser', pitch: 51, audio: I.riser(), peakDb: -3, what: 'one-bar noise riser' },
]);

kit('keys', [
  { name: 'fm9', pitch: 60, audio: I.keysChord([56, 60, 63, 67]), what: 'FM keys Fm9 (rootless Ab C Eb G)' },
  { name: 'dbmaj9', pitch: 61, audio: I.keysChord([56, 60, 63, 65]), what: 'FM keys Dbmaj9 (rootless Ab C Eb F)' },
  { name: 'c7b9', pitch: 62, audio: I.keysChord([55, 58, 61, 64]), what: 'FM keys C7b9 (G Bb Db E)' },
]);

kit('voice', [
  ...Object.entries(TALKBOX).map(([name, p], k) => ({ name: name.replace(/^tb-/, ''), pitch: 60 + k, audio: I.talkbox(p), what: `talkbox phrase ${name}: synth through the MORPH//03 vocal tract` })),
  ...Object.entries(BEAST).map(([name, p], k) => ({ name, pitch: 72 + k, audio: renderBeastPhrase(p), what: `Wobble Beast phrase ${name}: bowed cable through the MORPH//03 throat` })),
]);

writeFileSync(join(ROOT, 'MANIFEST.json'), JSON.stringify({ generator: 'experiments/lowrider-2099/build-assets.mjs', node: process.version, assets: manifest }, null, 2) + '\n');
console.log(`${manifest.length} assets written to ${ROOT}`);
