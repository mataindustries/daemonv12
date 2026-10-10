/** Author the native GLASSHOUSE pack audition (not GLASS//FIRE). Audio always renders through DaemonV12.
 * Run: node scripts/create-glasshouse-audition.ts [output project directory]
 */
import { writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileName, sounds } from './generate-glasshouse.ts';
type Id = typeof sounds[number]['id'];
const index = (id: Id) => sounds.findIndex(s => s.id === id);
const notes: { start: string; velocity: number; pitch?: string }[][] = sounds.map(() => []);
// Steps are 32nd notes inside a 4/4 bar (0–31); offsets stay below one beat as the position grammar requires.
const OFFSETS = ['', '+1/32', '+1/16', '+3/32', '+1/8', '+5/32', '+3/16', '+7/32'];
function hit(id: Id, bar: number, step32: number, velocity: number) {
  const i = index(id), kit = sounds[i]!.pitch !== null;
  notes[i]!.push({ start: `${bar}:${1 + Math.floor(step32 / 8)}${OFFSETS[step32 % 8]}`, velocity: Number(velocity.toFixed(3)), ...(kit ? { pitch: id } : {}) });
}
const s16 = (step: number) => step * 2;

// 14 bars of 4/4 at 140 BPM = 24 s. 1–2 glass family, 3–4 vox, 5–10 beat, 11–12 break and build, 13 payoff, 14 release.
const motif = [[0, 0.86], [3, 0.7], [6, 0.78], [10, 0.62], [12, 0.74]] as const; // 3-3-4-2 sixteenths
for (const bar of [1, 2]) for (const [step, v] of motif) hit('glass-hit', bar, s16(step), bar === 2 && step === 12 ? 0.5 : v);
hit('glass-crush', 1, s16(14), 0.72); hit('glass-crush', 2, s16(8), 0.8);
for (const bar of [2, 4, 10, 12]) hit('glass-reverse', bar, s16(8), bar === 12 ? 0.85 : 0.72); // two beats into the next downbeat
for (const bar of [3, 4, 11]) hit('ghost-vox', bar, 0, 0.82);
hit('ghost-vox', 12, 0, 0.7);
for (const [bar, steps] of [[3, [8, 10, 11, 14]], [4, [8, 9, 10, 11, 12, 13, 14, 15]]] as const)
  steps.forEach((step, k) => hit('vox-chip', bar, s16(step), 0.5 + 0.4 * (k % 2 ? 0.6 : 1)));
for (const bar of [3, 4]) hit('glass-hit', bar, s16(6), 0.42);
for (let step = 0; step < 16; step++) hit('pixel-hat', 4, s16(step), [0.42, 0.22, 0.32, 0.24][step % 4]!);

// Half-time beat: low pair together, clap on beat 3, sixteenth hats, chip hook, crush bass-calls, glass punctuation.
const low = [[0, 1], [7, 0.78], [10, 0.86]] as const;
for (let bar = 5; bar <= 10; bar++) {
  for (const [step, v] of low) { hit('bass-punch-cs', bar, s16(step), v); hit('sub-cs', bar, s16(step), v); }
  if (bar % 2 === 0) hit('bass-punch-cs', bar, s16(14), 0.6);
  hit('chrome-clap', bar, s16(8), 0.92);
  if (bar % 2 === 0) hit('chrome-clap', bar, s16(15), 0.34);
  for (let step = 0; step < 16; step++) hit('pixel-hat', bar, s16(step), [0.72, 0.36, 0.55, 0.42][step % 4]! - (step === 8 ? 0.2 : 0));
  if (bar === 8 || bar === 10) for (const step of [28, 29, 30, 31]) hit('pixel-hat', bar, step, 0.3 + 0.08 * (step - 28));
  for (const [step, v] of [[3, 0.72], [6, 0.58], [11, 0.66], [13, 0.5]] as const) if (bar >= 7) hit('vox-chip', bar, s16(step), v);
  if (bar >= 6) hit('glass-crush', bar, s16(bar % 2 ? 13 : 5), 0.78);
  if (bar % 2 === 1) hit('glass-hit', bar, s16(0), 0.66);
  hit('glass-hit', bar, s16(bar % 2 ? 11 : 6), 0.5);
}
hit('ghost-vox', 9, 0, 0.62);

// Break, build and payoff.
hit('sub-cs', 11, 0, 0.82); hit('bass-punch-cs', 11, 0, 0.7);
for (const step of [0, 3, 6, 10, 12]) hit('glass-hit', 11, s16(step), 0.56);
for (let step = 0; step < 16; step += 2) hit('pixel-hat', 11, s16(step), 0.3);
for (let step = 0; step < 32; step++) hit('pixel-hat', 12, step, 0.22 + 0.5 * step / 31);
for (let step = 8; step < 16; step++) hit('vox-chip', 12, s16(step), 0.4 + 0.45 * (step - 8) / 7);
hit('chrome-clap', 12, s16(8), 0.6); hit('chrome-clap', 12, s16(12), 0.7); hit('chrome-clap', 12, s16(14), 0.8);
hit('prism-impact', 13, 0, 0.9);
hit('bass-punch-cs', 13, 0, 0.85); hit('sub-cs', 13, 0, 0.85); hit('glass-hit', 13, 0, 0.6); hit('chrome-clap', 13, 0, 0.45);
hit('glass-hit', 14, 0, 0.42); hit('vox-chip', 14, s16(8), 0.42);

const mix: Record<Id, { gainDb: number; pan: number }> = {
  'glass-hit': { gainDb: -1, pan: 0.12 }, 'glass-reverse': { gainDb: -1, pan: 0 }, 'glass-crush': { gainDb: -2, pan: -0.08 },
  'ghost-vox': { gainDb: -3, pan: 0 }, 'vox-chip': { gainDb: -2, pan: -0.18 }, 'bass-punch-cs': { gainDb: -7, pan: 0 },
  'sub-cs': { gainDb: -9, pan: 0 }, 'chrome-clap': { gainDb: 0, pan: 0 }, 'pixel-hat': { gainDb: 0, pan: 0.22 }, 'prism-impact': { gainDb: -2, pan: 0 },
};
const effects: Partial<Record<Id, object[]>> = {
  'glass-hit': [{ type: 'reverb', roomSize: 0.55, decaySeconds: 1.4, wet: 0.16 }],
  'ghost-vox': [{ type: 'reverb', roomSize: 0.6, decaySeconds: 1.6, wet: 0.2 }],
  'vox-chip': [{ type: 'delay', timeMs: 321, wet: 0.14 }], // dotted eighth at 140 BPM
};
const project = {
  formatVersion: 1, title: 'GLASSHOUSE — Pack Audition',
  description: 'Twenty-four-second pack audition at 140 BPM in C# minor: the glass family, the vox chop, the phase-locked low pair, a half-time beat and the prism payoff. All ten sounds are original generated assets. Not GLASS//FIRE.',
  bpm: 140, timeSignature: '4/4', key: 'C# minor', bars: 14, seed: 140,
  master: { gainDb: 1.4, effects: [] },
  tracks: sounds.map((s, i) => ({
    id: s.id, description: s.role,
    instrument: s.pitch !== null ? { type: 'drumkit', kit: 'assets/glasshouse/kit.json' } : { type: 'sampler', sample: `assets/glasshouse/${fileName(i)}` },
    mix: mix[s.id], ...(effects[s.id] ? { effects: effects[s.id] } : {}),
    clips: [{ bar: 1, pattern: 'audition' }], patterns: [{ id: 'audition', bars: 14, notes: notes[i] }],
  })),
};
writeFileSync(join(process.argv[2] ?? 'examples', 'glasshouse-audition.json'), JSON.stringify(project, null, 2) + '\n');
