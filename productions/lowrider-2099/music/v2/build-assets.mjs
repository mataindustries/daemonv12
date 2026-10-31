// Render every LOWRIDER//2099 v2 sound into ./assets (PCM16 44.1 kHz, mono or stereo) plus
// DaemonV12 kit files. The Mouth Drop is not here: it needs a rendered beat (build-mouth.mjs).
// Deterministic: the same Node version gives the same bytes. Run: node build-assets.mjs
import { writeFileSync, readFileSync, mkdirSync, rmSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { join } from 'node:path';
import * as S from './sounds.mjs';
import { TALKBOX } from '../../../../experiments/lowrider-2099/score.mjs';
import { BEAST, renderBeastPhrase } from '../../../../experiments/lowrider-2099/beast-phrases.mjs';

const ROOT = new URL('./assets/', import.meta.url).pathname;
for (const d of ['drums', '808x', 'lead', 'keys', 'voice', 'fx']) rmSync(join(ROOT, d), { recursive: true, force: true });
const manifest = [];
const NAMES = ['C', 'Db', 'D', 'Eb', 'E', 'F', 'Gb', 'G', 'Ab', 'A', 'Bb', 'B'];
const noteName = m => `${NAMES[m % 12]}${Math.floor(m / 12) - 1}`;
const S16 = S.S16;

function kit(dir, entries) {
  mkdirSync(join(ROOT, dir), { recursive: true });
  const samples = [];
  for (const e of entries) {
    const file = `${e.name}.wav`, path = join(ROOT, dir, file), info = S.writeWav(path, e.audio, e.peakDb ?? -1);
    samples.push({ name: e.name, pitch: e.pitch, file });
    manifest.push({ path: `assets/${dir}/${file}`, channels: info.channels, seconds: +info.seconds.toFixed(4), sha256: createHash('sha256').update(readFileSync(path)).digest('hex'), what: e.what });
  }
  writeFileSync(join(ROOT, dir, 'kit.json'), JSON.stringify({ formatVersion: 1, samples }, null, 2) + '\n');
}

kit('drums', [
  { name: 'kick', pitch: 36, audio: S.kick2(), peakDb: -2, what: 'layered kick: v1 knock + 95->68 Hz punch + beater (mono)' },
  { name: 'rim', pitch: 37, audio: S.V1.rim(), peakDb: -3, what: 'modal rim (v1)' },
  { name: 'snare', pitch: 38, audio: S.snare2(), peakDb: -2, what: 'tuned snare, decorrelated stereo wires' },
  { name: 'clap', pitch: 39, audio: S.clap2(), peakDb: -2, what: 'dry clap, 2.6 kHz crack, decorrelated stereo tail and air' },
  { name: 'snap', pitch: 40, audio: S.V1.snap(), peakDb: -3, what: 'finger snap (v1)' },
  { name: 'hat', pitch: 42, audio: S.hat2(0.035, 0.22), peakDb: -3, what: 'stereo metal hat, 11 kHz sizzle' },
  { name: 'hat-tick', pitch: 44, audio: S.hat2(0.016, 0.1, 43), peakDb: -3, what: 'short stereo hat for rolls' },
  { name: 'hat-open', pitch: 46, audio: S.hat2(0.26, 0.9, 45), peakDb: -3, what: 'stereo open hat' },
  { name: 'shaker', pitch: 70, audio: S.shaker2(false), peakDb: -3, what: 'stereo shaker push' },
  { name: 'shaker-pull', pitch: 69, audio: S.shaker2(true), peakDb: -3, what: 'stereo shaker pull' },
]);

kit('808x', [29, 32, 34, 36, 37, 39, 41].map(m => ({ name: noteName(m).toLowerCase(), pitch: m, audio: S.bass808x(m), peakDb: -3, what: `attitude 808 ${noteName(m)}: punch, drive, phone rasp` })));

kit('lead', [72, 75, 77, 79, 80, 82, 84, 85, 87].map(m => ({ name: noteName(m).toLowerCase(), pitch: m, audio: S.lead2(m), peakDb: -1, what: `stereo whine lead ${noteName(m)}: mono-anchored centre, +-7 c sides, octave whistle` })));

kit('keys', [
  { name: 'fm9', pitch: 60, audio: S.keys2([56, 60, 63, 67]), what: 'wide FM keys Fm9' },
  { name: 'dbmaj9', pitch: 61, audio: S.keys2([56, 60, 63, 65]), what: 'wide FM keys Dbmaj9' },
  { name: 'c7b9', pitch: 62, audio: S.keys2([55, 58, 61, 64]), what: 'wide FM keys C7b9' },
]);

// talkbox: the approved v1 answers, plus a 16th "wa-wa-wa-WA" fill climbing into the next bar
const TALK2 = {
  ...TALKBOX,
  'tb-wa-stutter': { seconds: 0.9, notes: [
    { t: 0, len: S16 - 0.015, midi: 60, syl: 'wah' }, { t: S16, len: S16 - 0.015, midi: 63, syl: 'wah' },
    { t: 2 * S16, len: S16 - 0.015, midi: 65, syl: 'wah' }, { t: 3 * S16, len: 1.6 * S16, midi: 68, syl: 'wow', to: 70, bendAt: S16 },
  ] },
};
kit('voice', [
  ...Object.entries(TALK2).map(([name, p], k) => ({ name: name.replace(/^tb-/, ''), pitch: 60 + k, audio: S.V1.talkbox(p), what: `talkbox ${name}` })),
  ...Object.entries(BEAST).map(([name, p], k) => ({ name, pitch: 72 + k, audio: renderBeastPhrase(p), what: `Wobble Beast ${name}` })),
  // the talking 808: the bass line says it
  { name: 'talk-waah-ow', pitch: 80, audio: S.talking808({ seconds: 1.2, notes: [
    { t: 0, len: 3 * S16, midi: 29, to: 41, bendAt: 0.03, bendLen: 0.16, syl: 'waah' },
    { t: 3 * S16, len: 3 * S16 - 0.02, midi: 41, to: 36, bendAt: S16, bendLen: 0.14, syl: 'oww' },
  ] }), what: 'talking 808 fill: WAAH (F1 up to F2) - OW (down to C2)' },
  { name: 'talk-drop', pitch: 81, audio: S.talking808({ seconds: 1.6, notes: [
    { t: 0, len: 8 * S16, midi: 41, to: 29, bendAt: 0.06, bendLen: 0.45, syl: 'wow' },
  ], size: 0.8 }), what: 'talking 808 drop: WOOOW diving F2 to F1 through a giant mouth' },
]);

kit('fx', [
  { name: 'hop', pitch: 50, audio: S.V1.hop(), what: 'hydraulic pssht + chassis clunk (v1)' },
  { name: 'riser', pitch: 51, audio: S.V1.riser(), peakDb: -3, what: 'noise riser (v1)' },
  { name: 'slam', pitch: 52, audio: S.slam(), peakDb: -3, what: 'drop impact: sub boom, blast, chassis clunk' },
  { name: 'hover', pitch: 53, audio: S.hoverSpinUp({ bars: 2, midi: 53 }), peakDb: -2, what: 'hover spin-up: the Beast cable winds from pulses into F3 over two bars' },
]);

writeFileSync(join(ROOT, 'MANIFEST.json'), JSON.stringify({ generator: 'productions/lowrider-2099/music/v2/build-assets.mjs', node: process.version, assets: manifest }, null, 2) + '\n');
console.log(`${manifest.length} v2 assets written`);
