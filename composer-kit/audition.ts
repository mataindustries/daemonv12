/**
 * Short auditions (4–6 s) of every patch and groove.
 *   node composer-kit/audition.ts palette [id ...]
 *   node composer-kit/audition.ts grooves [id ...]
 * Patch auditions play the same phrase twice: bar 1 cold (heat 0.1), bar 2 hot (heat 0.95).
 */
import { writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { PATCHES, patch } from './palette.ts';
import { finalize, type Draft, type DPart, type N, type Patch } from './core.ts';
import { renderMp3 } from './render.ts';

const HERE = new URL('.', import.meta.url).pathname;
const G = 31; // G1
const twice = (bar: N[], end?: N[]): N[] => [...bar, ...(end ?? bar).map(n => [n[0] + 4, n[1], n[2], n[3], n[4]] as N)];
const PHRASES: Record<string, N[]> = {
  'living-bass': twice(
    [[0, 1, G, 0.95, { articulation: 'accent', scoop: 2 }], [1.25, 0.25, G, 0.5, { articulation: 'ghost' }], [1.5, 0.5, G + 3, 0.75], [2, 0.75, G + 5, 0.85], [3, 0.5, G + 7, 0.7, { articulation: 'staccato' }], [3.5, 0.5, G - 2, 0.75]],
    [[0, 1, G, 0.95, { articulation: 'accent', scoop: 2 }], [1.25, 0.25, G, 0.5, { articulation: 'ghost' }], [1.5, 0.5, G + 3, 0.75], [2, 0.75, G + 5, 0.85], [2.75, 1.25, G, 0.9, { slide: 0.12, dive: 4, diveBeats: 0.6 }]]),
  'sub-whale': [[0, 3.5, G, 0.9, { scoop: 3 }], [4, 2, G - 4, 0.9], [6, 2, G - 2, 0.85, { slide: 0.3 }]],
  'gear-chopper': [[0, 3.75, G, 0.9, { articulation: 'accent' }], [4, 2, G + 3, 0.9], [6, 2, G - 2, 0.9, { slide: 0.2 }]],
  'impossible-voice': [[0, 1.5, 67, 0.7], [1.5, 1, 70, 0.65], [2.5, 1.5, 74, 0.7], [4, 1, 72, 0.7], [5, 1, 70, 0.65], [6, 2, 67, 0.7, { fall: 0.8 }]],
  'giant-undertone': [[0, 2, 43, 0.75], [2, 2, 46, 0.7], [4, 4, 43, 0.75]],
  'glass-choir': [[0, 2, 67, 0.7], [2, 2, 74, 0.65], [4, 4, 70, 0.7]],
  'mechanical-orchestra/tine': twice([[0, 0.4, 79, 0.7], [0.75, 0.4, 82, 0.6], [1.5, 0.4, 86, 0.7], [2, 0.4, 84, 0.6], [2.75, 0.4, 82, 0.6], [3.5, 0.4, 79, 0.7]]),
  'mechanical-orchestra/bar': twice([[0, 0.5, 67, 0.75], [0.75, 0.5, 70, 0.65], [1.5, 0.5, 74, 0.75], [2, 0.5, 72, 0.65], [2.75, 0.5, 70, 0.65], [3.5, 0.5, 67, 0.75]]),
  'alien-gong': [[0, 4, 55, 0.85], [4, 2, 62, 0.75], [6, 2, 58, 0.8]],
  'mechanical-orchestra/spring': twice([[0, 0.5, 43, 0.85], [0.75, 0.5, 46, 0.7], [1.5, 0.5, 50, 0.8], [2, 0.5, 55, 0.75], [3, 0.5, 53, 0.7], [3.5, 0.5, 50, 0.75]]),
  'laser-spring': [[0, 1, 55, 0.85], [1.5, 1, 62, 0.8], [3, 1, 50, 0.8], [4, 1, 55, 0.85], [5.5, 1, 62, 0.8], [7, 1, 43, 0.85]],
  'mechanical-orchestra/bow': [[0, 4, 55, 0.8], [4, 4, 50, 0.8], [4, 4, 58, 0.7]],
  'mechanical-orchestra/clock': Array.from({ length: 32 }, (_, i) => [i / 4, 0.1, i % 4 === 0 ? 91 : 98, i % 4 === 0 ? 0.85 : i % 2 ? 0.35 : 0.6, { articulation: i % 4 === 0 ? 'tock' : 'tick' }] as N),
  // Timbre Lab instruments
  'breath-reed': twice([[0, 1, 67, 0.8], [1, 0.5, 70, 0.75], [1.5, 1, 74, 0.82], [2.5, 0.5, 72, 0.75], [3, 0.85, 67, 0.8, { articulation: 'fall' }]]),
  'feral-reed': [0, 4, 8, 12].flatMap(b => ([[0, 1, 67, 0.8], [1, 0.5, 70, 0.75], [1.5, 1, 74, 0.85], [2.5, 0.5, 72, 0.75], [3, 0.85, 67, 0.8]] as N[]).map(n => [n[0] + b, n[1], n[2], n[3]] as N)),
  'split-horn': [[0, 0.4, 67, 0.9], [0.75, 0.4, 70, 0.85], [1.5, 2.3, 62, 0.95, { articulation: 'overblow' }], [4, 0.4, 67, 0.9], [4.75, 0.4, 70, 0.85], [5.5, 2.3, 62, 0.95, { articulation: 'overblow' }]],
  'organic-percussion/skin': twice([[0, 0.5, 43, 0.95, { articulation: 'bass' }], [0.75, 0.25, 50, 0.4, { articulation: 'tap' }], [1, 0.4, 50, 0.9, { articulation: 'slap' }], [1.5, 0.5, 43, 0.7, { articulation: 'open' }],
    [2.25, 0.5, 50, 0.8, { articulation: 'open' }], [2.75, 0.25, 50, 0.35, { articulation: 'tap' }], [3, 0.5, 43, 0.85, { articulation: 'open' }], [3.5, 0.4, 50, 0.75, { articulation: 'slap' }]]),
  'organic-percussion/log': twice([[0, 0.5, 55, 0.8], [0.5, 0.25, 58, 0.6, { articulation: 'knuckle' }], [1.25, 0.25, 55, 0.5, { articulation: 'rim' }], [2, 0.5, 62, 0.8], [2.75, 0.25, 58, 0.55, { articulation: 'knuckle' }], [3.25, 0.25, 60, 0.6], [3.75, 0.25, 55, 0.5, { articulation: 'rim' }]]),
  'organic-percussion/pot': twice([[0, 0.75, 55, 0.85], [1, 0.25, 62, 0.5, { articulation: 'tap' }], [1.5, 0.25, 62, 0.55, { articulation: 'tap' }], [2, 1, 53, 0.85, { articulation: 'drop' }], [3.25, 0.5, 55, 0.75, { articulation: 'palm' }]]),
};
/** Patches whose audition is one continuous journey (heat 0 -> 1 over this many bars) instead of cold bar / hot bar. */
const JOURNEY: Record<string, number> = { 'feral-reed': 4 };

export function patchAudition(p: Patch): Draft {
  const pt: DPart = { id: 'sound', patch: p, notes: PHRASES[p.id] ?? PHRASES[p.instrument] ?? [], heat: JOURNEY[p.id] ? [{ from: 0, to: JOURNEY[p.id]! * 4, a: 0, b: 1 }] : [{ from: 0, to: 4, a: 0.1, b: 0.1 }, { from: 4, to: 8, a: 0.95, b: 0.95 }], motionBars: [],
    textures: p.instrument.endsWith('bearings') ? [{ fromBeat: 0, toBeat: 4, density: 5, pitches: [91, 94, 98, 101, 103] }, { fromBeat: 4, toBeat: 8, density: 12, pitches: [91, 94, 98, 101, 103] }] : [] };
  return { title: `audition ${p.id}`, bpm: 104, key: 'G minor', tonic: 7, minor: true, swing: 0.5, seed: 11, tailSeconds: 1, room: { rt60: 1.4, size: 1, damp: 6000, predelayMs: 12, lowCut: 250 },
    description: p.where, sections: JOURNEY[p.id] ? [{ id: 'journey', bars: JOURNEY[p.id]!, start: 0, end: JOURNEY[p.id]! * 4, note: 'heat 0 -> 1' }] : [{ id: 'cold', bars: 1, start: 0, end: 4, note: 'heat 0.1' }, { id: 'hot', bars: 1, start: 4, end: 8, note: 'heat 0.95' }], parts: [pt], hook: { owner: 'sound', bars: 1, notes: [] }, log: [] };
}

async function main() {
  const [what, ...ids] = process.argv.slice(2), rows: Record<string, unknown>[] = [];
  if (what === 'palette') {
    for (const p of PATCHES.filter(x => !x.internal && (!ids.length || ids.includes(x.id)))) {
      const r = await renderMp3(finalize(patchAudition(patch(p.id))), `${HERE}auditions/palette/${p.id}.mp3`);
      rows.push({ id: p.id, seconds: r.seconds, rawLufs: r.rawLufs }); console.log(`${p.id.padEnd(18)} ${r.seconds}s raw ${r.rawLufs} LUFS`);
    }
  } else if (what === 'grooves') {
    const { GROOVES } = await import('./grooves.ts'), { grooveAudition } = await import('./build.ts');
    for (const g of GROOVES.filter(x => !ids.length || ids.includes(x.id))) {
      const r = await renderMp3(grooveAudition(g.id), `${HERE}auditions/grooves/${g.id}.mp3`);
      rows.push({ id: g.id, seconds: r.seconds, rawLufs: r.rawLufs }); console.log(`${g.id.padEnd(18)} ${r.seconds}s raw ${r.rawLufs} LUFS`);
    }
  } else { console.error('usage: node composer-kit/audition.ts palette|grooves [id ...]'); process.exitCode = 2; return; }
  if (!ids.length) writeFileSync(`${HERE}auditions/${what}.json`, JSON.stringify(rows, null, 2) + '\n');
}
if (process.argv[1] && resolve(process.argv[1]) === resolve(new URL(import.meta.url).pathname)) main().catch(e => { console.error((e as Error).message); process.exitCode = 1; });
