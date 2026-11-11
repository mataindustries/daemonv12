/** Original WEST//GHOST auditions. Musical scores and all trajectories are explicit. */
import type { Performance, Curve } from './westghost-dsp.ts';
import type { Event, Score, ScoreTrack } from './generate-westghost.ts';

const curve = (...values: [number, number][]): Curve => values.map(([time, value]) => ({ time, value }));
const perform = (instrument: Performance['instrument'], note: number, gate: number, more: Partial<Performance> = {}): Performance => ({ instrument, note, gate, release: 0.16, velocity: 0.85, ...more });
export const referencePerformances: Record<string, Performance> = {
  'gravity-sustain-d1': perform('gravity', 26, 4, { release: 0.5, timbre: curve([0, 0.1], [1.2, 0.8], [2.5, 0.4], [4, 0.9]), pitch: curve([0, 26], [2, 26], [2.35, 33], [3, 33], [3.6, 26]) }),
  'gravity-impact-g1': perform('gravity', 31, 1.4, { articulation: 'impact', release: 0.25, timbre: curve([0, 0.9], [1.4, 0.2]) }),
  'vandal-sustain-d2': perform('vandal', 38, 4, { release: 0.4, timbre: curve([0, 0.15], [1.2, 0.8], [2, 0.3], [4, 0.95]), motion: curve([0, 0.15], [2, 0.75], [4, 0.4]) }),
  'vandal-bite-a2': perform('vandal', 45, 2.7, { articulation: 'bite', release: 0.2, timbre: curve([0, 0.9], [1.4, 0.25], [2.7, 0.75]), pitch: curve([0, 45], [1.8, 45], [2.2, 38]) }),
  'apparition-sustain-d4': perform('apparition', 62, 5, { release: 0.65, timbre: curve([0, 1], [1, 0.75], [2.2, 0], [3.2, 0.5], [5, 1]), expression: curve([0, 0.35], [1, 0.8], [3, 0.95], [5, 0.45]), breath: curve([0, 0.45], [1, 0.1], [4, 0.16], [5, 0.55]), motion: curve([0, 0.1], [3, 0.7]) }),
  'apparition-whisper-a4': perform('apparition', 69, 3.5, { articulation: 'whisper', release: 0.6, timbre: curve([0, 0.5], [1.3, 0.1], [3.5, 1]), breath: curve([0, 0.8], [1.5, 0.25], [3.5, 0.65]) }),
  'iron-bloom-strike-d3': perform('iron-bloom', 50, 3, { articulation: 'strike', release: 0.65, timbre: curve([0, 0.8], [0.5, 0.25], [3, 0.6]), motion: curve([0, 0.2], [3, 0.8]) }),
  'iron-bloom-bow-a3': perform('iron-bloom', 57, 5, { articulation: 'bow', release: 0.8, timbre: curve([0, 0.15], [2, 0.7], [5, 0.35]), expression: curve([0, 0.25], [1, 0.8], [3, 0.95], [5, 0.5]), motion: curve([0, 0.1], [4, 0.8]) }),
};
const track = (id: string, gainDb: number, pan = 0): ScoreTrack => ({ id, gainDb, pan, events: [] });
const add = (t: ScoreTrack, step: number, p: Performance) => t.events.push({ step, performance: p });
function dry(instrument: Performance['instrument'], roots: number[]): Score {
  const voice = track(instrument, -1.5);
  roots.forEach((note, k) => {
    const gate = 3.2, timbre = k % 2 ? curve([0, 0.85], [1.4, 0.15], [3.2, 0.6]) : curve([0, 0.1], [1.8, 0.8], [3.2, 0.3]);
    const articulation = instrument === 'iron-bloom' ? (k % 2 ? 'bow' : 'strike') : instrument === 'apparition' ? (k % 2 ? 'whisper' : 'sustain') : instrument === 'gravity' ? (k % 2 ? 'impact' : 'sustain') : (k % 2 ? 'bite' : 'sustain');
    add(voice, k * 32, perform(instrument, note, gate, { articulation, release: 0.5, timbre, seed: 300 + k, expression: curve([0, 0.35], [1, 0.9], [3.2, 0.55]), motion: curve([0, 0.1], [2.8, 0.8]), ...(instrument === 'gravity' || instrument === 'vandal' ? { pitch: curve([0, note], [1.3, note], [1.65, note + 5], [2.5, note + 5], [3.1, note]) } : {}) }));
  });
  return { id: `dry-${instrument}`, title: `WEST//GHOST 001 — ${instrument.toUpperCase()} dry performance`, description: 'Four native-pitch performances across multiple keys. Alternating articulations, fixed gain and continuous timbre/expression; no effects. This is an instrument audition, with no quality or listening claim.', bpm: 120, bars: 8, tracks: [voice] };
}
function bass(): Score {
  const sub = track('gravity', -4), mid = track('vandal', -3), kick = track('impact', -5), back = track('metal', -9, 0.12), tick = track('ticks', -16, -0.2);
  const roots = [26, 26, 29, 33, 31, 26, 24, 33, 26, 29, 31, 33, 26, 24];
  for (let bar = 0; bar < 14; bar++) {
    const base = bar * 16, note = roots[bar]!;
    const sparse = bar < 2 || bar % 4 === 3;
    for (const k of sparse ? [0, 9] : [0, 6, 10]) add(kick, base + k, perform('gravity', 26, 0.07, { release: 0.1, articulation: 'impact', velocity: k === 0 ? 0.95 : 0.78, timbre: curve([0, 0.6]) }));
    for (const k of sparse ? [3, 12] : [2, 5, 8, 13]) {
      const gate = k === 13 ? 0.22 : 0.18;
      add(sub, base + k, perform('gravity', note, gate, { release: 0.055, velocity: k === 2 || k === 12 ? 0.93 : 0.75, timbre: curve([0, 0.15], [gate, 0.7]), ...(k === 13 ? { pitch: curve([0, note], [0.09, note], [gate, Math.min(45, note + 7)]) } : {}) }));
    }
    if (bar >= 2) for (const k of sparse ? [4, 11] : [3, 7, 11, 14]) add(mid, base + k, perform('vandal', note + 12, k === 7 ? 0.32 : 0.18, { release: 0.07, velocity: k === 3 ? 0.95 : 0.7, articulation: k === 14 ? 'bite' : 'sustain', timbre: curve([0, 0.15 + 0.08 * (bar % 4)], [0.15, 0.9]), motion: curve([0, 0.2 + 0.16 * (bar % 4)]), seed: 100 + bar }));
    for (const k of [4, 12]) add(back, base + k, perform('iron-bloom', 62, 0.055, { release: 0.2, velocity: 0.68, articulation: 'strike', timbre: curve([0, 0.95]), motion: curve([0, 0.6]), seed: 44 + bar }));
    for (const k of sparse ? [2, 7, 14] : [1, 3, 7, 9, 11, 15]) add(tick, base + k, perform('iron-bloom', 82, 0.025, { release: 0.025, velocity: k === 7 ? 0.65 : 0.4, articulation: 'strike', timbre: curve([0, 0.7]), seed: 300 + k }));
  }
  // Expose a long, phase-continuous slide after the groove, with space for its release.
  add(sub, 224, perform('gravity', 26, 2.6, { release: 0.7, pitch: curve([0, 26], [0.9, 26], [1.3, 38], [1.8, 38], [2.6, 26]), timbre: curve([0, 0.15], [1.8, 0.95], [2.6, 0.3]) }));
  add(mid, 227, perform('vandal', 38, 1.6, { release: 0.5, timbre: curve([0, 0.15], [0.7, 0.95], [1.6, 0.25]), motion: curve([0, 0.3], [1.6, 0.85]) }));
  return { id: 'a-gravity-vandal', title: 'WEST//GHOST 001 A — GRAVITY × VANDAL', description: 'Original 32-second bass instrument demonstration: syncopated call/answer, reserved sub ownership, native continuous slides, changing harmonic bite and rhythmic filter motion. IRON supplies mechanical punctuation. Not a release composition.', bpm: 120, bars: 16, tracks: [sub, mid, kick, back, tick] };
}
function vocal(): Score {
  const lead = track('apparition', -3, -0.05), answer = track('whisper', -8, 0.25), bloom = track('bloom', -15, -0.25), low = track('gravity', -13);
  const phrase: [number, number, number][] = [[0, 62, 1.3], [12, 69, 1], [24, 65, 1.6], [40, 64, 2.2], [64, 62, 1.3], [76, 72, 1], [88, 69, 1.8], [108, 67, 1.8], [128, 65, 1.2], [140, 64, 1], [152, 62, 3.2]];
  phrase.forEach(([step, note, gate], k) => add(lead, step, perform('apparition', note, gate, { release: 0.45, timbre: curve([0, 0.85], [gate * 0.4, k % 2 ? 0.25 : 0], [gate, k % 3 ? 0.5 : 1]), expression: curve([0, 0.25], [0.2, 0.85], [gate, 0.5]), motion: curve([0, 0.12], [gate, 0.65]), breath: curve([0, 0.6], [0.18, 0.08], [gate, 0.3]), seed: 2000 + k })));
  for (const [step, note] of [[29, 74], [60, 69], [97, 76], [123, 72]] as const) add(answer, step, perform('apparition', note, 0.9, { articulation: 'whisper', release: 0.5, breath: curve([0, 0.8], [0.5, 0.25], [0.9, 0.7]), timbre: curve([0, 0.5], [0.9, 1]), seed: step }));
  for (const [step, note] of [[0, 50], [64, 53], [128, 57]] as const) add(bloom, step, perform('iron-bloom', note, 5.2, { articulation: 'bow', release: 1, expression: curve([0, 0.1], [2, 0.6], [5.2, 0.2]), timbre: curve([0, 0.15], [5.2, 0.65]) }));
  for (const [step, note] of [[8, 26], [72, 29], [136, 33]] as const) add(low, step, perform('gravity', note, 3.8, { release: 0.6, timbre: curve([0, 0.05]) }));
  return { id: 'b-apparition', title: 'WEST//GHOST 001 B — APPARITION', description: 'Original 24-second spectral melody demonstrating vowel trajectories, pressure, breath attacks, whisper answers, delayed vibrato and held articulation across D4–E5. Every note is synthesized at its final pitch and duration. Not a release composition.', bpm: 120, bars: 12, tracks: [lead, answer, bloom, low] };
}
function mechanical(): Score {
  const body = track('body', -5), strikes = track('strikes', -7, -0.15), answer = track('answer', -11, 0.3), bow = track('bow', -15, -0.25);
  for (let bar = 0; bar < 10; bar++) {
    const base = bar * 16, root = [38, 38, 41, 45, 43][bar % 5]!;
    for (const k of [0, 7, 10]) add(body, base + k, perform('iron-bloom', root, 0.14, { articulation: 'strike', release: 0.35, velocity: k === 0 ? 0.95 : 0.6, timbre: curve([0, 0.15 + bar % 3 * 0.28], [0.14, 0.75]), seed: 700 + k + bar }));
    for (const [k, offset] of [[3, 24], [6, 19], [12, 27], [15, 24]] as const) add(strikes, base + k, perform('iron-bloom', root + offset, 0.08, { release: 0.36, velocity: k === 12 ? 0.82 : 0.55, timbre: curve([0, 0.8], [0.08, 0.2]), motion: curve([0, (bar % 4) / 4]), seed: 900 + bar + k }));
    if (bar % 2) for (const k of [5, 9, 14]) add(answer, base + k, perform('iron-bloom', root + (k === 9 ? 24 : 31), 0.08, { release: 0.55, velocity: 0.6, timbre: curve([0, 0.2], [0.08, 0.8]), seed: 400 + k }));
  }
  for (const [step, note] of [[12, 62], [76, 65], [140, 69]] as const) add(bow, step, perform('iron-bloom', note, 4.8, { articulation: 'bow', release: 1.2, timbre: curve([0, 0.05], [2, 0.7], [4.8, 0.25]), motion: curve([0, 0.15], [4.8, 0.95]), expression: curve([0, 0.1], [1, 0.7], [4.8, 0.2]), seed: step }));
  add(strikes, 164, perform('iron-bloom', 62, 1.7, { release: 1.3, timbre: curve([0, 0.8], [1.7, 0.15]), seed: 999 }));
  return { id: 'c-iron-bloom', title: 'WEST//GHOST 001 C — IRON//BLOOM', description: 'Original 24-second mechanical instrument study: low body pulses, interlocking pitched spring/metal calls and sustained bowed blooms. Hardness, dispersion, excitation and velocity evolve coherently around D minor. Not a release composition.', bpm: 120, bars: 12, tracks: [body, strikes, answer, bow] };
}
export const demonstrationScores: Score[] = [
  dry('gravity', [26, 33, 38, 45]), dry('vandal', [38, 43, 50, 55]), dry('apparition', [50, 57, 62, 69]), dry('iron-bloom', [38, 50, 62, 74]), bass(), vocal(), mechanical(),
];
