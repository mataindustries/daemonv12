/**
 * BOLLO · coin-rhythm sketch. Four bars of electro-cumbia at 105 BPM in A major (one 9.143 s cycle) and a closing hit.
 *
 *   node sound-lab/bollo/build.ts [output-dir]        (default sound-lab/bollo/audio; needs FFmpeg for MP3/loudness)
 *
 * Every coin is the unchanged BOLLO coin instrument (PR #52) through its own bridge; the band is V12 SIGNATURE and
 * Living Bass. This file is a score and a mix: no synthesis is added and no approved source is changed.
 *
 * Why 105 BPM. The coin's mechanics run in physical seconds, so the tempo was chosen to fit them:
 *  - a sixteenth is 1/7 s, and a coin spun with `spin: 0` starts wobbling at exactly 7 contacts per second. The spin
 *    in bar 4 therefore starts as sixteenth notes, accelerates out of the grid, and (motionSeconds = two beats)
 *    settles flat exactly on the next downbeat;
 *  - with restitution 0.5 every flight is half the one before. Dropped at 2.80 m/s the coin's flights are an eighth,
 *    a sixteenth, a thirty-second, ... and the bounce runs out exactly one beat after it began.
 */
import { mkdirSync, writeFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createHash } from 'node:crypto';
import { renderCoinBridge, type CoinBridgeScore } from '../../instruments/bollo-coin/bridge.ts';
import { bandBalance, transientStats, round } from '../../fable-lab/crush/measure.ts';
import { SR, type Stereo, sum, gainDb, toPeak, mono, hp, lp, crushed, clipTo, duck, room, ride, shelfHi, cycle, fadeOut, writeAudio, loudness, ampDb, peak, rms, truePeak } from '../lib.ts';

const HERE = dirname(fileURLToPath(import.meta.url));
const OUT = process.argv[2] ?? join(HERE, 'audio');
const BPM = 105, BEAT = 60 / BPM * SR, LOOP = 16 * BEAT; // 25,200 frames per beat; 403,200 per cycle
const G = 9.81, EIGHTH = 60 / BPM / 2;
/** Note velocity (coin part velocity 1) whose first flight lasts `seconds` at restitution `e`: flight = 2·e·(4·velocity)/g. */
const dropFor = (seconds: number, e: number) => seconds * G / (8 * e);
const SPIN_LEAD = 0.055 / (60 / BPM); // the wobble starts 55 ms after the spin's first impact; place that impact early
type N = [number, number, number | string, number];
const at = (positions: number[], bar: number, v: number | number[] = 0.8, len = 0.1): N[] => positions.map((p, i) => [bar * 4 + p / 4, len, 60, Array.isArray(v) ? v[i % v.length]! : v]);

// ------------------------------------------------------------------------------------------------------ the coins
// Positions are sixteenths inside a bar (0..15). CALL is the rhythm the whole band plays in bar 4.
const CALL = [0, 3, 6];
const coins = (cycleBars: boolean) => [
  // The motor: a small coin ticking the cumbia scraper figure (down, up-up) on every beat, leaning on the upbeat.
  { id: 'guiro', instrument: 'bollo-coin', coin: { motion: 'edge', strike: 0.75, size: 0.74, damping: 0.95, hardness: 0.95, material: 0.7, velocity: 0.8, position: 0.4, seed: 311 },
    humanize: { velocity: 0.12, seed: 7 },
    notes: cycleBars ? [0, 1, 2].flatMap(bar => [0, 1, 2, 3].flatMap(b => at([b * 4, b * 4 + 2, b * 4 + 3], bar, [0.45, 0.9, 0.62]))).concat(at([0, 2, 3, 4, 6], 3, [0.45, 0.9, 0.62, 0.45, 0.9])) : [] },
  // Call: a large coin slapped flat. Three hits, 3 + 3 + 2 sixteenths.
  { id: 'face', instrument: 'bollo-coin', coin: { motion: 'face', strike: 0.08, size: 1, damping: 0.8, hardness: 0.88, velocity: 1, position: -0.3, seed: 255 },
    notes: cycleBars ? [...at(CALL, 0, [0.95, 0.8, 0.88]), ...at(CALL, 1, [0.95, 0.8, 0.88]), ...at(CALL, 2, [0.95, 0.8, 0.88]), ...at(CALL, 3, [1, 0.92, 1])] : [] },
  // Response: a quarter struck on its rim, answering in the second half of the bar.
  { id: 'rim', instrument: 'bollo-coin', coin: { motion: 'edge', strike: 0.96, size: 0.8, damping: 0.8, velocity: 1, position: 0.25, seed: 256 },
    notes: cycleBars ? [...at([10, 13], 0, [0.85, 0.7]), ...at([10, 11], 1, [0.85, 0.65]), ...at([10, 13, 14, 15], 2, [0.85, 0.6, 0.72, 0.85])] : [] },
  // Bounces locked to the tempo (restitution 0.5). Bar 1: a skip that starts on a sixteenth. Bar 2: a full drop on
  // beat 4 that runs out on the downbeat of bar 3.
  { id: 'bounce', instrument: 'bollo-coin', coin: { motion: 'bounce', strike: 0.85, restitution: 0.5, spin: 0.05, damping: 0.6, size: 0.85, velocity: 1, position: -0.15, seed: 252 },
    notes: cycleBars ? [[3.5, 0.1, 60, round(dropFor(EIGHTH / 2, 0.5), 6)], [7, 0.1, 60, round(dropFor(EIGHTH, 0.5), 6)]] as N[] : [] },
  // The transition: one quarter spun on the tile while the band is silent.
  { id: 'spin', instrument: 'bollo-coin', coin: { motion: 'spin', strike: 0.9, spin: 0, motionSeconds: round(2 * 60 / BPM, 6), damping: 0.55, size: 0.85, velocity: 1, position: 0, seed: 253 },
    notes: cycleBars ? [[14 - SPIN_LEAD, 0.1, 60, 0.92]] as N[] : [] },
  // The downbeat: a handful of three different coins hitting the floor a few milliseconds apart.
  ...([[0.74, 0.46, 0.62, -0.55, 0, 601], [0.82, 0.56, 0.74, 0.1, 0.012, 602], [0.92, 0.62, 0.55, 0.6, 0.027, 603]] as const).map(([size, restitution, v, position, late, seed], i) => (
    { id: `drop${i + 1}`, instrument: 'bollo-coin', coin: { motion: 'bounce', strike: 0.8, size, restitution, spin: 0.3, damping: 0.55, velocity: 1, position, seed },
      notes: [[late / (60 / BPM), 0.1, 60, v]] as N[] })),
].map(p => ({ gainDb: 0, pan: 0, room: 0, ...p }));

// ------------------------------------------------------------------------------------------------------- the band
const v12 = (id: string, sound: string, extra: Record<string, unknown>) => ({ id, instrument: `v12-signature/${sound}`, gainDb: 0, pan: 0, room: 0, ...extra });
const chord = (beat: number, pitches: string[], len = 0.2, v = 0.7): N[] => pitches.map(p => [beat, len, p, v]);
const A = ['A4', 'C#5', 'E5'], E7 = ['G#4', 'B4', 'D5'];
const bassNote = (beat: number, beats: number, pitch: string, v = 0.85, extra: Record<string, number | string> = {}) => [beat, beats, pitch, v, extra];
const band = (cycleBars: boolean) => [
  v12('kick', 'iron-pulse', { notes: cycleBars ? [...Array.from({ length: 12 }, (_, b) => [b, 0.25, 35, b % 4 === 0 ? 1 : 0.9] as N), ...at(CALL, 3, 1, 0.25)] : [[0, 0.25, 35, 1]] }),
  v12('clap', 'neon-clap', { notes: cycleBars ? [...[1, 3, 5, 7, 9, 11].map(b => [b, 0.5, 39, 0.85] as N), [13.5, 0.5, 39, 1]] : [] }),
  { id: 'bass', instrument: 'living-bass', gainDb: 0, pan: 0, room: 0,
    controls: { fold: 0.2, pm: 0.5, grind: 0, gear: 0, drive: 0.45, bright: 0.4, hold: 0.6, chassis: 0, ratchet: 0, servo: 0, motion: 0, harm: 0, body: 0.9 },
    motion: [{ fromBeat: 0, toBeat: 64, preset: 'none' }], setup: { seed: 105 },
    notes: cycleBars ? [
      // A: root, a ghosted push, the fifth, the octave, back through the fifth
      bassNote(0, 1.4, 'A1', 0.95, { articulation: 'accent' }), bassNote(1.5, 0.5, 'A1', 0.7, { articulation: 'staccato' }), bassNote(2, 0.9, 'E2'), bassNote(3, 0.5, 'A2', 0.8, { articulation: 'staccato' }), bassNote(3.5, 0.5, 'E2', 0.85, { articulation: 'legato', slide: 0.15 }),
      // E7: root, push, the fifth below, the seventh, the leading tone
      bassNote(4, 1.4, 'E2', 0.95, { articulation: 'accent' }), bassNote(5.5, 0.5, 'E2', 0.7, { articulation: 'staccato' }), bassNote(6, 0.9, 'B1'), bassNote(7, 0.5, 'D2', 0.8, { articulation: 'staccato' }), bassNote(7.5, 0.5, 'G#1', 0.85),
      // A again, walking up to the dominant
      bassNote(8, 1.4, 'A1', 0.95, { articulation: 'accent', scoop: 1 }), bassNote(9.5, 0.5, 'A1', 0.7, { articulation: 'staccato' }), bassNote(10, 0.9, 'E2'), bassNote(11, 0.5, 'C#2', 0.8, { articulation: 'staccato' }), bassNote(11.5, 0.5, 'D2', 0.85),
      // E7: the coin's call rhythm, then the last note falls an octave out of the way of the spin
      bassNote(12, 0.6, 'E2', 1, { articulation: 'accent' }), bassNote(12.75, 0.6, 'E2', 0.95, { articulation: 'accent' }), bassNote(13.5, 0.5, 'E2', 1, { articulation: 'accent', dive: 12, diveBeats: 0.35 }),
    ] : [bassNote(0, 2.5, 'A1', 1, { articulation: 'accent', scoop: 1 })] },
  // The hook: one bar, stated, moved down a step over the dominant, then lifted. A second voice a third below.
  ...[['lead', 0], ['lead2', -2]].map(([id, steps]) => v12(id as string, 'phantom', { v12: { releaseSeconds: 0.06 },
    phrases: cycleBars ? [
      { motif: 'hook', at: 0, transforms: [{ op: 'transpose', steps }] },
      { motif: 'hook', at: 4, transforms: [{ op: 'transpose', steps: (steps as number) - 1 }] },
      { motif: 'lift', at: 8, transforms: [{ op: 'transpose', steps }] },
      { motif: 'stops', at: 12, transforms: [{ op: 'transpose', steps }] },
    ] : [{ motif: 'last', at: 0, transforms: [{ op: 'transpose', steps }] }] })),
  // Off-beat chord stabs (the cumbia upbeat), then the call rhythm with everyone else in bar 4.
  v12('skank', 'signal', { v12: { releaseSeconds: 0.05 },
    notes: cycleBars ? [...[0, 2].flatMap(bar => [0.5, 1.5, 2.5, 3.5].flatMap(b => chord(bar * 4 + b, A))), ...[0.5, 1.5, 2.5, 3.5].flatMap(b => chord(4 + b, E7)),
      ...CALL.flatMap(p => chord(12 + p / 4, [...E7, 'E5'], 0.3, 0.85))] : chord(0, [...A, 'A5'], 1.5, 0.85) }),
];
const scoreOf = (cycleBars: boolean): CoinBridgeScore => ({
  schema: 'daemonv12.signature-rack.score/2', title: cycleBars ? 'BOLLO - coin rhythm sketch' : 'BOLLO - closing hit', bpm: BPM, key: 'A major',
  tailSeconds: cycleBars ? 1.2 : 0.4, masterGainDb: 0, seed: 250,
  sections: [{ id: cycleBars ? 'bollo' : 'hit', bars: cycleBars ? 4 : 1 }],
  motifs: [
    // steps of A major from A4: 4 = E5, 2 = C#5, 7 = A5, 6 = G#5, 5 = F#5
    { id: 'hook', role: 'hook', lengthBeats: 4, notes: [[0, 0.5, 4, 0.85], [0.5, 0.5, 2, 0.75], [1, 0.5, 4, 0.8], [1.5, 0.75, 7, 0.95], [2.25, 0.25, 6, 0.75], [2.5, 0.5, 5, 0.8], [3, 0.9, 4, 0.85]] },
    { id: 'lift', role: 'hook', lengthBeats: 4, notes: [[0, 0.5, 4, 0.85], [0.5, 0.5, 2, 0.75], [1, 0.5, 4, 0.8], [1.5, 0.75, 7, 0.95], [2.25, 0.25, 8, 0.8], [2.5, 0.5, 9, 0.95], [3, 0.9, 7, 0.9]] },
    { id: 'stops', role: 'hook', lengthBeats: 4, notes: [[0, 0.4, 8, 0.95], [0.75, 0.4, 8, 0.9], [1.5, 0.45, 6, 1]] },
    { id: 'last', role: 'hook', lengthBeats: 4, notes: [[0, 1.6, 7, 0.95]] },
  ],
  parts: [...band(cycleBars), ...coins(cycleBars)].filter(p => ('notes' in p ? (p.notes as unknown[]).length : true)) as never,
});
export const score = scoreOf(true), closing = scoreOf(false);

// -------------------------------------------------------------------------------------------------------- the mix
const COINS = ['guiro', 'face', 'rim', 'bounce', 'spin', 'drop1', 'drop2', 'drop3'] as const;
/** Coin levels are fixed gains (dB), not per-render normalisation, so the cycle and the closing hit match. */
const COIN_GAIN: Record<string, number> = { guiro: 11, face: 8, rim: 9, bounce: 19, spin: 13, drop1: 11, drop2: 11, drop3: 11 };
const BAND_GAIN = { kick: 1.5, clap: -4, bass: 9, lead: -3, lead2: -6, skank: -8 };
function mix(raw: Map<string, Stereo>, kickFrames: number[], process: boolean, spinFrame?: number) {
  const n = raw.get('kick')![0].length, s = (id: string) => raw.get(id) ?? ([new Float64Array(n), new Float64Array(n)] as Stereo);
  // Coins: close, fixed gains, a 4 dB shelf above 6.5 kHz, and a short hard room behind them (the tile floor).
  // The spin gets a fader ride: +12 dB over its two beats, so the chatter stays audible as it speeds up and weakens.
  // Coins never pass through CRUSH's drive or compressor.
  const spun = spinFrame === undefined ? s('spin') : ride(s('spin'), spinFrame, spinFrame + Math.round(2 * BEAT), 0, 12);
  const coinDry = shelfHi(sum(...COINS.map(id => gainDb(id === 'spin' ? spun : s(id), COIN_GAIN[id]!))), 6500, 4);
  const coin = sum(coinDry, gainDb(room(hp(coinDry, 800), 0.45, 800, 250, 4), -10));
  const kick = gainDb(s('kick'), BAND_GAIN.kick), clap = gainDb(hp(s('clap'), 300), BAND_GAIN.clap);
  // Bass: mono; pumped 5 dB by the four-on-the-floor kick. Selective CRUSH: amount 0.7, 60 % wet.
  let bass = duck(gainDb(mono(hp(s('bass'), 28)), BAND_GAIN.bass), kickFrames, 5, 20, 140);
  // Lead (two voices in thirds) and the off-beat stabs. Selective CRUSH: amount 0.7, 50 % wet, on this bus only.
  let synth = sum(gainDb(hp(s('lead'), 220), BAND_GAIN.lead), gainDb(hp(s('lead2'), 220), BAND_GAIN.lead2), gainDb(hp(s('skank'), 300), BAND_GAIN.skank));
  if (process) { bass = crushed(bass, 0.7, { mix: 0.6 }); synth = crushed(synth, 0.7, { mix: 0.5 }); }
  synth = duck(sum(synth, gainDb(room(synth, 0.9, 400, 105), -13)), kickFrames, 2.5, 15, 130);
  const bandBus = sum(kick, clap, bass, synth);
  return { coin, band: bandBus, total: sum(coin, bandBus), stems: { coins: coin, kick, clap, bass, synth } };
}

// ------------------------------------------------------------------------------------------------------ delivery
const main = await renderCoinBridge(score), end = await renderCoinBridge(closing);
const kicks = (r: typeof main) => r.manifest.events.filter(e => e.part === 'kick').map(e => e.frame);
const PUSH_DB = Number(process.env.BOLLO_PUSH ?? 3);
const spinFrame = main.manifest.coinEvents.find(e => e.part === 'spin')!.frame;
const body = mix(main.stems, kicks(main), true, spinFrame), hit = mix(end.stems, kicks(end), true);
const bodyDry = mix(main.stems, kicks(main), false, spinFrame), hitDry = mix(end.stems, kicks(end), false);
const delayed = (x: Stereo, lead: number): Stereo => x.map(ch => { const y = new Float64Array(lead + ch.length); y.set(ch, lead); return y; }) as Stereo;
/** `cycles` of the four bars, then the closing hit on the next downbeat. */
const arrange = (b: Stereo, h: Stereo, cycles: number) => sum(cycle(b, LOOP, cycles), delayed(h, cycles * LOOP));
// One gain for everything, so stems and previews keep their relationships. It is set from the BAND's peak: the band
// goes PUSH_DB into the soft clipper, and the coins' sub-millisecond tips ride over it into the same clipper.
const single = arrange(body.total, hit.total, 1);
const drive = PUSH_DB - 1 - ampDb(peak(arrange(body.band, hit.band, 1)));
const finish = (x: Stereo, clip: boolean) => { const y = clip ? clipTo(gainDb(x, drive), -1) : gainDb(x, drive - PUSH_DB); return fadeOut(y, 20); };
const trim = -1 - ampDb(truePeak(finish(single, true)));
const files: Record<string, Stereo> = {
  'BOLLO-A-sketch': gainDb(finish(single, true), trim),
  'BOLLO-B-three-cycles': gainDb(finish(arrange(body.total, hit.total, 3), true), trim),
  'BOLLO-C-coins-only': arrange(body.coin, hit.coin, 1),
  'BOLLO-D-band-only': gainDb(finish(arrange(body.band, hit.band, 1), true), trim),
  'BOLLO-E-no-crush': gainDb(finish(arrange(bodyDry.total, hitDry.total, 1), false), 0),
};
// The two unclipped auditions are simply set to -1 dBTP (their level is not their level inside the mix).
for (const k of ['BOLLO-C-coins-only', 'BOLLO-E-no-crush']) files[k] = fadeOut(gainDb(files[k]!, -1 - ampDb(truePeak(files[k]!))), 20);
mkdirSync(join(OUT, 'stems'), { recursive: true });
const kickFrames = kicks(main), report: Record<string, unknown> = {};
for (const [name, audio] of Object.entries(files)) {
  const path = join(OUT, `${name}.wav`); writeAudio(path, audio);
  const l = loudness(path);
  report[name] = { seconds: round(audio[0].length / SR, 3), frames: audio[0].length, integratedLufs: l.lufs, truePeakDbtp: l.truePeakDb, samplePeakDbfs: round(ampDb(peak(audio))),
    crestDb: round(ampDb(peak(audio)) - ampDb(rms(audio))), bandBalanceDb: bandBalance(audio), kick: transientStats(audio, kickFrames) };
}
// Stems: what the full mix sums before the master clipper. One shared gain for all five, low enough that the
// loudest (the coins, whose tips the master clipper would otherwise shave) stays under -0.5 dBFS.
const stemAudio = Object.entries(body.stems).map(([id, st]) => [id, arrange(st, hit.stems[id as keyof typeof hit.stems], 1)] as const);
const stemGain = Math.min(drive + trim, -0.5 - Math.max(...stemAudio.map(([, st]) => ampDb(truePeak(st)))));
for (const [id, st] of stemAudio) writeAudio(join(OUT, 'stems', `${id}.wav`), fadeOut(gainDb(st, stemGain), 20));
writeFileSync(join(HERE, 'score.json'), JSON.stringify(score, null, 1) + '\n');
writeFileSync(join(HERE, 'closing-hit.score.json'), JSON.stringify(closing, null, 1) + '\n');
const truncated = [...main.manifest.coinEvents, ...end.manifest.coinEvents].filter(e => e.truncated).map(e => e.id);
writeFileSync(join(OUT, 'events.json'), JSON.stringify({ schema: main.manifest.schema, bpm: BPM, framesPerBeat: BEAT, loopFrames: LOOP, sampleRate: SR, closingHitAtFrame: LOOP,
  timing: main.manifest.timing, coinTiming: 'coinTiming' in main.manifest ? main.manifest.coinTiming : undefined, events: main.manifest.events,
  coinEvents: main.manifest.coinEvents.map(e => ({ id: e.id, part: e.part, frame: e.frame, endFrame: e.endFrame, truncated: e.truncated, motionEndSeconds: e.plan.motionEndSeconds,
    contacts: e.plan.contacts.map(c => ({ seconds: round(c.seconds, 6), frame: e.frame + c.frame, regime: c.regime, strength: round(c.strength, 4) })) })),
  closingHit: { events: end.manifest.events, coinEvents: end.manifest.coinEvents.map(e => ({ id: e.id, part: e.part, frame: LOOP + e.frame, contacts: e.plan.contacts.length })) } }) + '\n');
const sha = (x: Stereo) => createHash('sha256').update(Buffer.from(x[0].buffer)).update(Buffer.from(x[1].buffer)).digest('hex');
const settings = { bpm: BPM, key: 'A major', sampleRate: SR, framesPerBeat: BEAT, loopFrames: LOOP, coinGainDb: COIN_GAIN, bandGainDb: BAND_GAIN,
  coinBus: { highShelfDb: 4, highShelfHz: 6500, roomSendDb: -10, roomRt60: 0.45, spinRideDb: [0, 12] }, crush: { bass: { amount: 0.7, mix: 0.6, inputPeakDbfs: -3 }, synth: { amount: 0.7, mix: 0.5, inputPeakDbfs: -3 }, coins: 'never processed', kickAndClap: 'not processed' },
  master: { bandPushIntoSoftClipDb: PUSH_DB, ceilingDbfs: -1, driveDb: round(drive, 3), trimDb: round(trim, 3), stemGainDb: round(stemGain, 3) } };
writeFileSync(join(OUT, 'REPORT.json'), JSON.stringify({ title: score.title, settings, truncatedCoinEvents: truncated,
  note: 'Measurements only. Nobody has listened to these files; no number here says the sketch is good.',
  floatSha256: { sketch: sha(files['BOLLO-A-sketch']!) }, files: report }, null, 1) + '\n');
console.log(Object.entries(report).map(([k, v]) => { const x = v as { seconds: number; integratedLufs: number; truePeakDbtp: number; crestDb: number; kick: unknown; bandBalanceDb: Record<string, number> }; return `${k} ${x.seconds}s LUFS ${x.integratedLufs} TP ${x.truePeakDbtp} crest ${x.crestDb} ${JSON.stringify(x.kick)} ${Object.values(x.bandBalanceDb).join(' ')}`; }).join('\n'));
for (const id of [...COINS, 'kick', 'clap', 'bass', 'lead', 'lead2', 'skank']) { const st = main.stems.get(id); if (st) console.log(`  raw ${id} peak ${round(ampDb(peak(st)))} rms ${round(ampDb(rms(st)))}`); }
for (const [id, st] of Object.entries(body.stems)) console.log(`  mix ${id} peak ${round(ampDb(peak(st)))} rms ${round(ampDb(rms(st)))}`);
console.log(`coin bus peak into the master clipper: ${round(ampDb(peak(body.coin)) + drive)} dBFS (ceiling -1; knee starts at -5)`);
console.log('truncated coin events:', truncated.join(', ') || 'none');
for (const e of main.manifest.coinEvents.filter(x => ['bounce', 'spin'].includes(x.part))) console.log(`  ${e.id} starts ${round(e.frame / BEAT, 4)} beats; contacts at beats ${e.plan.contacts.slice(0, 9).map(c => round((e.frame + c.frame) / BEAT, 3)).join(' ')}${e.plan.contacts.length > 9 ? ` ... ${e.plan.contacts.length} contacts, last at ${round((e.frame + e.plan.contacts.at(-1)!.frame) / BEAT, 3)}` : ''}`);
