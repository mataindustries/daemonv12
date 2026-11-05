/** Author a deterministic 180 s production stress score using only existing repository sounds.
 * node scripts/create-headliner-stress.ts [workspace = work/headliner-stress/input]
 * Generated assets are byte copies, never resynthesized or relicensed here.
 */
import { copyFileSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { format } from './create-v12-signature-projects.ts';

export const STRESS_SECONDS = 180, STRESS_FRAMES = 7938000, STRESS_BARS = 96;
export const SECTIONS = [
  { name: 'cold ignition', firstBar: 1, startSeconds: 0, endSeconds: 15 },
  { name: 'displaced drive', firstBar: 9, startSeconds: 15, endSeconds: 45 },
  { name: 'pressure', firstBar: 25, startSeconds: 45, endSeconds: 60 },
  { name: 'first arrival', firstBar: 33, startSeconds: 60, endSeconds: 90 },
  { name: 'ghost chamber', firstBar: 49, startSeconds: 90, endSeconds: 105 },
  { name: 'reconstruction', firstBar: 57, startSeconds: 105, endSeconds: 120 },
  { name: 'second arrival and mutation', firstBar: 65, startSeconds: 120, endSeconds: 165 },
  { name: 'dissolution and released tails', firstBar: 89, startSeconds: 165, endSeconds: 180 },
] as const;
type Fields = Record<string, any>;
interface ScoreTrack extends Fields { id: string; notes: Fields[] }
const RATE = 44100, SIGNATURE = 'assets/v12-signature', MORPH = 'assets/morph-v1';
const fileNames = ['01-sub-hammer', '02-iron-pulse', '03-titanium-crack', '04-neon-clap', '05-ghost-tick', '06-open-circuit', '07-abyss', '08-reactor', '09-signal', '10-phantom', '11-event-horizon', '12-afterglow', '13-specter', '14-chrome-strike', '15-ascension', '16-convergence'];
const gcd = (a: number, b: number): number => b ? gcd(b, a % b) : a;
const fraction = (a: number, b: number) => { const g = gcd(a, b); return `${a / g}/${b / g}`; };
export function position(bar: number, units64 = 0): string {
  const total = (bar - 1) * 64 + units64, actualBar = Math.floor(total / 64) + 1, beat = Math.floor(total % 64 / 16) + 1, remainder = total % 16;
  return `${actualBar}:${beat}${remainder ? `+${fraction(remainder, 64)}` : ''}`;
}
const rate = (semitones: number) => Number((2 ** (semitones / 12)).toFixed(6));
const envelope = (attackSeconds = 0.004, releaseSeconds = 0.07) => ({ attackSeconds, releaseSeconds });
const point = (bar: number, units64: number, value: number, transition: 'linear' | 'step' = 'linear') => ({ at: { musical: position(bar, units64) }, value, transition });
const tonal = (semitones: number, velocity: number, gate = '1/8', env = envelope(), extra: Fields = {}): Fields => ({ velocity, ...(semitones ? { playbackRate: rate(semitones) } : {}), gate, envelope: env, ...extra });
const track = (id: string, description: string, instrument: Fields, gainDb: number, extra: Fields = {}): ScoreTrack => ({ id, description, instrument, mix: { gainDb }, notes: [], ...extra });
const sampler = (index: number) => ({ type: 'sampler', sample: `${SIGNATURE}/${fileNames[index - 1]}.wav` });
const note = (t: ScoreTrack, bar: number, units64: number, fields: Fields) => t.notes.push({ start: position(bar, units64), ...fields });
const active = (bar: number) => bar >= 9 && bar <= 88 && !(bar >= 49 && bar <= 56);
const drop = (bar: number) => bar >= 33 && bar <= 48 || bar >= 65 && bar <= 88;
// Am9 -> Fmaj7 -> Dm9 -> E7; all pad notes remain within C3-E4.
const bass = [0, -4, -7, -5]; // A1 F1 D1 E1
const pad = [[-5, 0, 3], [-4, 0, 7], [-7, -2, 5], [-5, -1, 2]];
const arp = [[0, 7, 3, 10], [-4, 0, 7, 3], [-7, 0, 5, 8], [-5, -1, 2, 7]];

/** The score is deliberately arranged, but is an engineering proof rather than HEADLINER 001. */
export function headlinerStressProject(): Fields {
  const kick = track('kick', 'Tight SUB HAMMER groove; same-frame IRON PULSE layers coexist at arrivals.', { type: 'drumkit', kit: `${SIGNATURE}/kit.json` }, -5.5);
  const snare = track('backbeat', 'Clap/snare backbeat, quiet displaced ghosts and authored build rolls.', { type: 'drumkit', kit: `${SIGNATURE}/kit.json` }, -7.5);
  const hats = track('hats', 'Velocity-shaped sixteenths with delayed sixteenth positions and track-local open-hat chokes.', { type: 'drumkit', kit: `${SIGNATURE}/kit.json` }, -9, { mix: { gainDb: -9, pan: 0.12 } });
  const chrome = track('chrome', 'Low chrome motif and section identity; delay and reverb ring continuously across every section.', sampler(14), -9, { effects: [{ type: 'delay', timeMs: 351.5625, wet: 0.15 }, { type: 'reverb', roomSize: 0.7, decaySeconds: 2.6, wet: 0.26 }] });
  const sub = track('abyss', 'One mono low-end owner with authored absolute gain pumping and occasional continuous playback-rate slides.', sampler(7), -8);
  const reactor = track('reactor', 'High-passed mid-bass answers with repeated rate glides; no additional sub owner.', sampler(8), -10, { effects: [{ type: 'highpass', frequencyHz: 120 }, { type: 'saturation', driveDb: 4, mix: 0.22 }] });
  const signal = track('signal', 'Broken four-note cell, its rhythm rotates by section; echoes continue over transitions.', sampler(9), -14, { mix: { gainDb: -14, pan: 0.15 }, effects: [{ type: 'delay', timeMs: 351.5625, wet: 0.23 }] });
  const lead = track('phantom', 'Original two-bar question and answer; exposed middle and a changed second arrival.', sampler(10), -9.5, { effects: [{ type: 'delay', timeMs: 234.375, wet: 0.13 }, { type: 'reverb', roomSize: 0.65, decaySeconds: 2.1, wet: 0.17 }] });
  const horizon = track('horizon', 'Sustained open fifths run across bars, cache reuse and arbitrary timeline divisions without retrigger.', sampler(11), -12, { effects: [{ type: 'highpass', frequencyHz: 95 }] });
  const afterglow = track('afterglow', 'Voice-led three-note chords lasting two bars; repitched harmony drives the original interpolation budget above 1b.', sampler(12), -14, { effects: [{ type: 'highpass', frequencyHz: 150 }, { type: 'reverb', roomSize: 0.6, decaySeconds: 1.5, wet: 0.15 }] });
  const choir = track('specter', 'Quiet long vowel phrases and contrary-motion answers; gain and pan move in absolute song time.', sampler(13), -15, { effects: [{ type: 'highpass', frequencyHz: 170 }, { type: 'reverb', roomSize: 0.75, decaySeconds: 2.8, wet: 0.28 }] });
  const riser = track('ascension', 'Last 3.75 seconds of the original riser align exactly to the four designed arrivals.', sampler(15), -12);
  const impact = track('convergence', 'Sparse original impacts at structural arrivals; conservative gain over the mono sub.', sampler(16), -12);
  const cable = track('cable', 'MORPH cable-pluck pitched replies above the bass, high-passed to preserve low-end ownership.', { type: 'sampler', sample: `${MORPH}/cable-pluck.wav` }, -12, { mix: { gainDb: -12, pan: -0.22 }, effects: [{ type: 'highpass', frequencyHz: 210 }, { type: 'delay', timeMs: 234.375, wet: 0.18 }] });
  const ratchet = track('ratchet', 'Individually scheduled MORPH ratchet ticks; rhythmic acceleration, not a pre-rendered loop.', { type: 'drumkit', kit: `${MORPH}/kit.json` }, -14, { mix: { gainDb: -14, pan: -0.13 } });
  const tracks = [kick, snare, hats, chrome, sub, reactor, signal, lead, horizon, afterglow, choir, riser, impact, cable, ratchet];

  for (let bar = 1; bar <= 88; bar++) {
    const harmony = Math.floor((bar - 1) / 2) % 4, root = bass[harmony]!;
    if (bar % 8 === 1) note(chrome, bar, 0, tonal(harmony === 3 ? -5 : -12, 0.62, '1/4', envelope(0.002, 0.6)));
    if (bar % 2 === 1) {
      note(horizon, bar, 0, tonal(root, bar < 9 ? 0.55 : 0.64, '2/1', envelope(0.25, 0.4), { offsetSeconds: 1.4 }));
      if (bar >= 5) for (const semitones of pad[harmony]!) note(afterglow, bar, 8, tonal(semitones, bar >= 49 && bar <= 56 ? 0.42 : 0.5, '7/4', envelope(0.1, 0.35)));
    }
    if (bar < 9) {
      if ([1, 5, 7].includes(bar)) note(kick, bar, 0, { pitch: 'sub-hammer', velocity: 0.7, gate: '1/8', envelope: envelope(0.001, 0.06) });
      if (bar >= 5) for (const [k, n] of [[0, 0], [28, 7], [52, 3]]) note(signal, bar, k!, tonal(n!, 0.42, '1/16', envelope(0.002, 0.07)));
      continue;
    }
    if (bar >= 49 && bar <= 56) {
      if (bar % 2) note(choir, bar, 24, tonal([0, 7, -2, 5][harmony]!, 0.7, '3/2', envelope(0.2, 0.35), { offsetSeconds: 0.9 }));
      note(cable, bar, 40, tonal(harmony % 2 ? 12 : 7, 0.55, '1/8', envelope(0.002, 0.08)));
      if (bar === 49) note(chrome, bar, 0, tonal(-12, 0.75, '1/2', envelope(0.002, 0.8)));
      continue;
    }
    const build = bar >= 25 && bar <= 32 || bar >= 57 && bar <= 64;
    const pull = [32, 64].includes(bar);
    if (!pull) {
      const kicks = drop(bar) ? [0, 24, 36, 56] : bar % 2 ? [0, 28, 40] : [0, 20, 44, 56];
      for (const [i, u] of kicks.entries()) {
        note(kick, bar, u, { pitch: 'sub-hammer', velocity: i ? 0.82 : 0.93, gate: '1/16', envelope: envelope(0.001, 0.045), chokeGroup: 'kick' });
        if (drop(bar) && i === 0) note(kick, bar, u, { pitch: 'iron-pulse', velocity: 0.55, gate: '1/16', envelope: envelope(0.001, 0.03), chokeGroup: 'kick' });
      }
      if (drop(bar)) note(sub, bar, 0, tonal(root, 0.74, '15/16', envelope(0.003, 0.055)));
      else for (const [i, u] of [8, 24, 36, 52].entries()) note(sub, bar, u, tonal(root, [0.65, 0.54, 0.63, 0.57][i]!, '1/16', envelope(0.003, 0.025)));
      for (const [i, u] of [12, 30, 48].entries()) note(reactor, bar, u, tonal(root, i === 1 ? 0.58 : 0.7, '1/8', envelope(0.003, 0.045), i === 2 && bar % 4 === 0 ? { glide: { to: rate(root + 7), duration: '1/8' } } : {}));
    }
    for (const u of [16, 48]) if (!pull || u === 16) note(snare, bar, u, { pitch: drop(bar) ? 'titanium-crack' : 'neon-clap', velocity: 0.76, gate: '1/8', envelope: envelope(0.001, 0.055) });
    if (bar % 2 === 0 && !pull) note(snare, bar, 44, { pitch: 'titanium-crack', velocity: 0.25, gate: '1/32', envelope: envelope(0.001, 0.02) });
    const roll = build && bar % 4 === 0;
    if (roll) for (let k = 0; k < 12; k++) note(snare, bar, 16 + k * 4, { pitch: 'titanium-crack', velocity: Number((0.23 + k * 0.033).toFixed(3)), gate: '1/32', envelope: envelope(0.001, 0.014), chokeGroup: 'roll' });
    for (let k = 0; k < (pull ? 12 : 16); k++) {
      // Every second offbeat is delayed by 1/64 (29.3 ms), preserving exact grid timing.
      const u = k * 4 + (k % 4 === 3 ? 1 : 0);
      if (bar < 17 && k % 2) continue;
      note(hats, bar, u, { pitch: k % 8 === 6 ? 'open-circuit' : 'ghost-tick', velocity: [0.52, 0.22, 0.38, 0.28][k % 4], gate: '1/32', envelope: envelope(0.001, 0.025), chokeGroup: 'hats' });
    }
    for (let k = 0; k < (pull ? 12 : 16); k++) {
      if (drop(bar) && k % 4 === 1 || bar % 4 === 0 && k >= 14) continue;
      const u = k * 4, cell = arp[harmony]!, shift = bar >= 65 ? 1 : 0;
      note(signal, bar, u, tonal(cell[(k + shift) % 4]!, k % 3 ? 0.39 : 0.55, '1/16', envelope(0.002, 0.035)));
    }
    if (drop(bar)) {
      // E5 -> G5 -> A5 / C5 -> B4 -> E5; rhythm and contour are unrelated to the Signature showcase.
      const figure: [number, number, string][] = bar % 2 ? [[0, 0, '1/4'], [20, 3, '1/8'], [40, 5, '3/8']] : [[8, -4, '1/8'], [28, -5, '1/4'], [52, 0, '1/8']];
      for (const [u, n, gate] of figure) note(lead, bar, u, tonal(n + (bar >= 81 && bar % 2 ? 7 : 0), 0.79, gate, envelope(0.007, 0.12)));
    } else if (bar % 4 === 3) note(choir, bar, 24, tonal(harmony === 3 ? -1 : 0, 0.58, '1/1', envelope(0.08, 0.25), { offsetSeconds: 1.2 }));
    if (bar % 2 === 0) for (const [u, pitch] of [[10, 7], [42, 12]]) note(cable, bar, u!, tonal(pitch!, 0.5, '1/16', envelope(0.002, 0.04)));
    if (bar % 4 === 0 || bar >= 73) for (let k = 0; k < (roll ? 8 : 3); k++) note(ratchet, bar, (roll ? 32 : 44) + k * 4, { pitch: k % 2 ? 'ratchet-open' : 'ratchet-tight', velocity: Number((0.36 + (k % 3) * 0.08).toFixed(3)), gate: '1/32', envelope: envelope(0.001, 0.012), ...(k % 3 === 2 ? { playbackRate: 1.33484 } : {}) });
  }
  for (const bar of [7, 31, 63, 79]) note(riser, bar, 0, { velocity: 0.68, offsetSeconds: 2.25, envelope: envelope(0.05, 0.005) });
  for (const bar of [9, 33, 65, 81, 89]) note(impact, bar, 0, { velocity: bar === 89 ? 0.52 : 0.65, envelope: envelope(0.001, 0.3) });
  // Reserve at least the final 3.75 s for dissipating FX before the exact 180 s cap.
  note(sub, 89, 0, tonal(0, 0.65, '2/1', envelope(0.004, 1.1)));
  note(horizon, 89, 0, tonal(0, 0.6, '3/1', envelope(0.2, 1.0), { offsetSeconds: 1.4 }));
  for (const n of pad[0]!) note(afterglow, 89, 8, tonal(n, 0.48, '11/4', envelope(0.15, 0.8)));
  note(lead, 89, 0, tonal(5, 0.7, '3/2', envelope(0.02, 0.7)));
  note(choir, 91, 0, tonal(0, 0.48, '3/2', envelope(0.2, 0.7), { offsetSeconds: 1.2 }));
  note(chrome, 91, 32, tonal(-12, 0.5, '1/2', envelope(0.002, 0.7)));
  note(cable, 92, 24, tonal(12, 0.42, '1/8', envelope(0.002, 0.12)));
  const pumping: Fields[] = [point(1, 0, -8)];
  for (let bar = 9; bar <= 88; bar++) if (active(bar)) for (const u of [0, 16, 32, 48]) {
    pumping.push(point(bar, u - 1, -8), point(bar, u, -16), point(bar, u + 5, -8));
  }
  pumping.push(point(89, 0, -8), point(94, 0, -30));
  sub.automation = { gainDb: pumping };
  signal.automation = { gainDb: [point(1, 0, -14), point(32, 48, -14), point(33, 0, -17), point(48, 0, -17), point(49, 0, -24), point(57, 0, -14), point(64, 48, -14), point(65, 0, -17), point(88, 0, -17), point(89, 0, -24)] };
  choir.automation = { pan: [point(1, 0, -0.15), point(33, 0, 0.15), point(49, 0, -0.2), point(65, 0, 0.2), point(89, 0, 0)], gainDb: [point(1, 0, -15), point(49, 0, -10), point(57, 0, -15), point(89, 0, -13), point(95, 0, -36)] };
  // A continuous song-wide fade gives existing delay/reverb tails a quiet terminal boundary.
  for (const t of tracks) if (t !== sub && t !== signal && t !== choir) t.automation = { gainDb: [point(1, 0, t.mix.gainDb), point(93, 0, t.mix.gainDb), point(96, 48, -60)] };
  return {
    formatVersion: 1, title: 'DAEMON FORGE 003 — 180-second production stress proof',
    description: 'Independent technical composition, not DAEMON HEADLINER 001. 96 bars at 128 BPM, exactly 180 s, 15 tracks. Original arrangement using only existing V12 SIGNATURE and MORPH assets; licensing remains pending. Tests continuous absolute-frame playback, repitched sustained chords, glide, gates/chokes, gain/pan automation and unreset delay/reverb tails. Requires explicit --reuse-voices; legacy budget intentionally rejects it.',
    bpm: 128, timeSignature: '4/4', key: 'A minor', bars: STRESS_BARS, seed: 3003,
    render: { duration: { seconds: STRESS_SECONDS }, tail: 'none' },
    master: { gainDb: -1.5, effects: [{ type: 'highpass', frequencyHz: 25 }, { type: 'compressor', thresholdDb: -14, ratio: 1.8, attackMs: 14, releaseMs: 150, makeupGainDb: 0 }] },
    tracks: tracks.map(({ notes, ...t }) => ({ ...t, clips: [{ bar: 1, pattern: 'score' }], patterns: [{ id: 'score', bars: STRESS_BARS, notes }] })),
  };
}

export function createHeadlinerStress(workspace = 'work/headliner-stress/input', proofDirectory = 'proofs/forge003') {
  mkdirSync(workspace, { recursive: true }); mkdirSync(proofDirectory, { recursive: true });
  const sources = [
    ...[...fileNames.map(f => `${f}.wav`), 'kit.json'].map(f => ({ source: `packs/v12-signature-v1/assets/v12-signature/${f}`, target: `${SIGNATURE}/${f}` })),
    ...['cable-pluck.wav', 'cable-slap.wav', 'beast-wom.wav', 'ratchet-open.wav', 'ratchet-tight.wav', 'kit.json'].map(f => ({ source: `examples/assets/morph-v1/${f}`, target: `${MORPH}/${f}` })),
  ];
  for (const { source, target } of sources) { mkdirSync(dirname(join(workspace, target)), { recursive: true }); copyFileSync(source, join(workspace, target)); }
  const project = headlinerStressProject(), bytes = format(project) + '\n';
  writeFileSync(join(workspace, 'headliner-stress.json'), bytes);
  writeFileSync(join(proofDirectory, 'headliner-stress.project.json'), bytes);
  const assetManifest = { sampleRate: RATE, projectFrames: STRESS_FRAMES, projectSeconds: STRESS_SECONDS, rights: 'Existing repository assets copied unchanged for owner-authorized internal proof. Signature and MORPH license status remains pending; no new license grant.', sources: sources.map(s => ({ ...s, sha256: createHash('sha256').update(readFileSync(s.source)).digest('hex'), bytes: readFileSync(s.source).length })), sections: SECTIONS };
  writeFileSync(join(proofDirectory, 'headliner-stress.assets.json'), JSON.stringify(assetManifest, null, 2) + '\n');
  return { project: join(workspace, 'headliner-stress.json'), tracks: project.tracks.length, notes: project.tracks.reduce((n: number, t: Fields) => n + t.patterns[0].notes.length, 0), frames: STRESS_FRAMES, seconds: STRESS_SECONDS };
}
if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) process.stdout.write(JSON.stringify(createHeadlinerStress(process.argv[2]), null, 2) + '\n');
