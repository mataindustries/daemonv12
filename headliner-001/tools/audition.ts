/** Dev harness: render individual patches to a directory for inspection. node tools/audition.ts <outDir> [names...] */
import { mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import * as I from './instruments.ts';
import { encodeWav, peakOf, SR, type Wave } from './dsp.ts';

const out = process.argv[2] ?? 'audition';
mkdirSync(out, { recursive: true });
const tickSec = (60 / 92) / 960;
const hook: I.VNote[] = [
  { t: 0, d: 480, p: 72, vowel: 'u', to: 'a', scoop: 2 },
  { t: 480, d: 480, p: 75, vowel: 'a' }, { t: 960, d: 1440, p: 77, vowel: 'o', to: 'a' },
  { t: 2400, d: 240, p: 75, vowel: 'a' }, { t: 2640, d: 720, p: 72, vowel: 'e', to: 'a' },
  { t: 3360, d: 480, p: 75, vowel: 'a' }, { t: 3840, d: 240, p: 77, vowel: 'a' },
  { t: 4080, d: 1680, p: 80, vowel: 'u', to: 'a', slide: 200, vib: 1.2 }, { t: 5760, d: 240, p: 79, vowel: 'a' },
  { t: 6000, d: 960, p: 77, vowel: 'o', fall: 300 },
];
const jobs: Record<string, () => Wave[]> = {
  kick: () => I.kick(), kickBoom: () => I.kick({ len: 2.2, decay: 0.85, drive: 2.2 }),
  snare: () => I.snare({ clap: 0.55 }), clap: () => I.snare({ body: 0.2, noise: 0.35, clap: 1, room: 0.3 }),
  snareVerb: () => I.snare({ clap: 0.5, verb: 0.55 }), rim: () => I.rim(),
  hat: () => I.hat(0.022, 0.12), hatOpen: () => I.hat(0.24, 0.8), hydraulic: () => I.hydraulic(), tick: () => I.tick(),
  anvil: () => I.modal(I.midiHz(84), [1, 2.76, 5.4, 8.93], [0.5, 0.3, 0.15, 0.08], [1, 0.5, 0.3, 0.15], 1.2, 0.5),
  chain: () => I.chain(), tom: () => I.tom(I.midiHz(48)), servo: () => I.servo(),
  subF1: () => I.sub(29), gritPluck: () => I.grit(29, true), gritHold: () => I.grit(29, false),
  pluckEb5: () => I.lpgPluck(75), pluckF5: () => I.lpgPluck(77), pluckC4: () => I.lpgPluck(60),
  ep: () => I.epChord([56, 63, 67, 72]), pad: () => I.padChord([53, 56, 63, 67, 72]), choir: () => I.choirChord([65, 68, 72], 'a'),
  voice: () => { const v = I.voicePhrase(hook, { tickSec }); return [v]; },
  rain: () => I.rain(8), lamp: () => I.lamp(6), impact: () => I.impact(), glitch: () => I.glitch(),
  siren: () => I.siren([[0, 72], [0.8, 77], [2.6, 75], [3.2, 80]], 8),
};
const names = process.argv.length > 3 ? process.argv.slice(3) : Object.keys(jobs);
for (const name of names) {
  const t0 = performance.now();
  const chs = jobs[name]!();
  const p = peakOf(chs), g = 0.7 / Math.max(1e-9, p);
  writeFileSync(join(out, `${name}.wav`), encodeWav(chs, g));
  let rms = 0; for (const c of chs) for (const v of c) rms += v * v; rms = Math.sqrt(rms / (chs.length * chs[0]!.length));
  console.log(`${name.padEnd(12)} ${(chs[0]!.length / SR).toFixed(2)}s ch${chs.length} rawPeak ${p.toFixed(3)} rms/peak ${(20 * Math.log10(rms / p)).toFixed(1)}dB  ${(performance.now() - t0).toFixed(0)}ms`);
}
