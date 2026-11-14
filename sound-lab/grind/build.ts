/**
 * GRIND · 808 performance audition. Four bars, 140 BPM, A minor: one 6.857 s cycle.
 *
 *   node sound-lab/grind/build.ts [output-dir]        (default sound-lab/grind/audio; needs FFmpeg for MP3/loudness)
 *
 * The 808 is the approved Living Bass played as one legato performance (its oscillator phase runs unbroken through
 * every slide); drums are V12 SIGNATURE one-shots through the motif bridge; DAEMON//CRUSH is applied to the 808 and
 * the snare/clap bus only. This file is a score and a mix. It adds no synthesis and changes no approved source.
 */
import { mkdirSync, writeFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createHash } from 'node:crypto';
import { renderBridge } from '../../studio-001/v12-bridge/bridge.ts';
import { bandBalance, transientStats, round } from '../../fable-lab/crush/measure.ts';
import { SR, type Stereo, sum, gainDb, toPeak, mono, hp, lp, crushed, clipTo, duck, room, cycle, fadeOut, writeAudio, loudness, ampDb, dbAmp, peak, rms, truePeak } from '../lib.ts';

const HERE = dirname(fileURLToPath(import.meta.url));
const OUT = process.argv[2] ?? join(HERE, 'audio');
const BPM = 140, BARS = 4, BEAT = Math.round(60 / BPM * SR), LOOP = BARS * 4 * BEAT; // 18,900 frames per beat, 302,400 per cycle
type N = [number, number, number | string, number, Record<string, number | string>?];

// ------------------------------------------------------------------------------------------------ the performance
// 808 line (Living Bass). Strikes carry `scoop: -7`: the pitch starts a fifth high and falls in over ~75 ms (the knock).
// `legato` notes do not re-strike: the pitch travels from where it is over `slide` beats.
const strike = (beat: number, beats: number, pitch: string, v = 0.92, extra: Record<string, number | string> = {}): N => [beat, beats, pitch, v, { articulation: 'accent', scoop: -7, ...extra }];
const tap = (beat: number, beats: number, pitch: string, v = 0.82, extra: Record<string, number | string> = {}): N => [beat, beats, pitch, v, { articulation: 'normal', scoop: -5, ...extra }];
const glide = (beat: number, beats: number, pitch: string, slide: number, extra: Record<string, number | string> = {}): N => [beat, beats, pitch, 0.9, { articulation: 'legato', slide, ...extra }];
const BASS: N[] = [
  // bar 1: the long threat, a stutter, then the first climb
  strike(0, 2.5, 'A1'), tap(2.5, 0.3, 'A1'), strike(3, 0.5, 'A1', 0.88), glide(3.5, 0.5, 'C2', 0.25),
  // bar 2: the flat second leans on the root, falls back, and the floor drops out
  strike(4, 1.5, 'Bb1'), glide(5.5, 0.5, 'A1', 0.3),
  tap(7.25, 0.25, 'A1'), tap(7.5, 0.25, 'A1', 0.88), glide(7.75, 0.25, 'A2', 0.22),
  // bar 3: the same threat, but the climb reaches a fifth and is dragged back down
  strike(8, 1.75, 'A1'), glide(9.75, 0.75, 'E2', 0.28), glide(10.5, 0.5, 'C2', 0.22),
  tap(11, 0.25, 'A1'), strike(11.5, 0.5, 'A1', 0.88, { dive: 5, diveBeats: 0.3 }),
  // bar 4: it starts high and is pulled down a step at a time, then falls away
  strike(12, 1, 'C2'), glide(13, 1, 'Bb1', 0.35), glide(14, 0.75, 'A1', 0.3, { dive: 12, diveBeats: 0.45 }),
];
const KICKS = [0, 2.5, 3, 4, 7.25, 7.5, 8, 11, 11.5, 12, 15.5];
const SNARES = [2, 6, 10, 14];
/** `count` hats from `from`, `div` to the beat, velocity ramping v0 -> v1. */
const roll = (from: number, count: number, div: number, v0: number, v1: number): N[] => Array.from({ length: count }, (_, k) => [from + k / div, 0.1, 60, v0 + (v1 - v0) * (count > 1 ? k / (count - 1) : 0)] as N);
const HATS: N[] = [
  // bar 1: eighths, a rising thirty-second burst into the snare, sixteenths out
  ...roll(0, 3, 2, 0.7, 0.5), ...roll(1.5, 4, 8, 0.3, 0.8), ...roll(2, 2, 2, 0.7, 0.5), ...roll(3, 2, 4, 0.6, 0.45),
  // bar 2: eighths, a triplet stumble, then nothing: the hats stop with the 808
  ...roll(4, 2, 2, 0.7, 0.5), ...roll(5, 3, 6, 0.75, 0.4), ...roll(5.5, 2, 4, 0.6, 0.45), [6, 0.1, 60, 0.6],
  ...roll(7.25, 3, 4, 0.5, 0.75),
  // bar 3: eighths, an off-beat push, a falling thirty-second burst after the snare
  ...roll(8, 4, 2, 0.7, 0.5), [9.75, 0.1, 60, 0.6], ...roll(10, 2, 2, 0.7, 0.5), ...roll(11, 4, 8, 0.8, 0.3), ...roll(11.5, 2, 4, 0.65, 0.45),
  // bar 4: eighths, triplets into the snare, a held breath, then the roll that closes the cycle
  ...roll(12, 3, 2, 0.7, 0.5), ...roll(13.5, 3, 6, 0.4, 0.75), ...roll(14, 2, 4, 0.7, 0.45),
  ...roll(15, 2, 4, 0.35, 0.45), ...roll(15.5, 4, 8, 0.45, 0.7),
];
const OPEN: N[] = [[3.5, 0.5, 60, 0.7], [13, 0.5, 60, 0.6]];
// A four-note bell figure over the 808: E-F-E falling to C, then answered upward to G. The semitone neighbour is the threat.
const BELL: N[] = [
  [0, 1.5, 'E5', 0.8], [1.5, 1.5, 'F5', 0.7], [3, 1, 'E5', 0.75], [4, 2, 'C5', 0.8],
  [8, 1.5, 'E5', 0.8], [9.5, 1.5, 'F5', 0.7], [11, 1, 'E5', 0.75], [12, 1.5, 'G5', 0.85], [13.5, 1.25, 'E5', 0.7],
];
const CHOIR: N[] = [[0, 6, 'A3', 0.8], [8, 6.75, 'A3', 0.8]];

const one = (id: string, sound: string, notes: N[], v12: Record<string, unknown> = {}) => ({ id, instrument: `v12-signature/${sound}`, gainDb: 0, pan: 0, room: 0, v12, notes });
export const score = {
  schema: 'daemonv12.signature-rack.score/1', title: 'GRIND - 808 performance audition', bpm: BPM, key: 'A minor',
  tailSeconds: 1, masterGainDb: 0, seed: 808,
  description: 'Original four-bar trap audition. Stems are rendered at unity and balanced in sound-lab/grind/build.ts.',
  sections: [{ id: 'grind', bars: BARS }],
  parts: [
    { id: 'bass808', instrument: 'living-bass', gainDb: 0, pan: 0, room: 0,
      // A sustained, smooth-sliding 808: gate held open, no chassis metal, no ratchet steps, no tempo-synced modulation.
      controls: { fold: 0.25, pm: 0.6, grind: 0, gear: 0, drive: 0.6, bright: 0.3, hold: 0.84, chassis: 0, ratchet: 0, servo: 0, motion: 0, harm: 0, body: 1 },
      motion: [{ fromBeat: 0, toBeat: 64, preset: 'none' }], setup: { seed: 808 }, notes: BASS },
    one('kick', 'sub-hammer', KICKS.map(b => [b, 0.2, 36, b % 4 === 0 ? 1 : 0.9] as N), { gate: true, releaseSeconds: 0.06 }),
    one('click', 'iron-pulse', KICKS.map(b => [b, 0.2, 35, b % 4 === 0 ? 1 : 0.85] as N), { gate: true, releaseSeconds: 0.03 }),
    one('snare', 'titanium-crack', SNARES.map(b => [b, 0.5, 38, 1] as N)),
    one('clap', 'neon-clap', SNARES.map(b => [b, 0.5, 39, 0.9] as N)),
    one('hat', 'ghost-tick', HATS),
    one('ohat', 'open-circuit', OPEN, { gate: true, releaseSeconds: 0.05 }),
    one('bell', 'signal', BELL, { mode: 'pitched', gate: true, releaseSeconds: 0.25 }),
    one('choir', 'specter', CHOIR, { mode: 'pitched', gate: true, attackSeconds: 0.04, releaseSeconds: 0.12 }),
  ],
};

// ------------------------------------------------------------------------------------------------------- the mix
export interface Mix { stems: Record<string, Stereo>; master: Stereo }
/** `process` false: static balance only. true: DAEMON//CRUSH on the 808 and the snare/clap bus, soft clip on the sum. */
function mix(raw: Map<string, Stereo>, kickFrames: number[], process: boolean): Mix {
  const s = (id: string) => raw.get(id)!;
  // Kick: the hammer's strike and first 86 ms of body (gated in the score), with the click layer on its front.
  // Its own soft clip takes 2.5 dB off the spike, so the master clipper has less to shave from the front later.
  const kickRaw = toPeak(sum(toPeak(hp(s('kick'), 40), -4), toPeak(hp(s('click'), 120), -10)), -1);
  const kick = process ? clipTo(kickRaw, -3.5) : gainDb(kickRaw, -2.5);
  // 808: mono, ducked 14 dB for the first 45 ms of every kick and back within 90 ms: the kick owns the hit, the 808
  // owns everything after it, and the two never sum at arbitrary phase.
  let bass = duck(toPeak(mono(hp(s('bass808'), 26)), -6), kickFrames, 14, 45, 90);
  // Selective CRUSH 1: the whole 808 at amount 0.7, pushed 3 dB past the -3 dBFS reference, 80 % wet. CRUSH shapes
  // the band under 150 Hz separately from the mids, so the sub gains sustain and harmonics without intermodulating.
  if (process) bass = toPeak(crushed(bass, 0.7, { pushDb: 3, mix: 0.8 }), -4);
  // Selective CRUSH 2: snare and clap together, 60 % wet. The kick and the hats never pass through CRUSH.
  let snare = sum(toPeak(s('snare'), -4), toPeak(hp(s('clap'), 250), -8));
  if (process) snare = toPeak(crushed(snare, 0.7, { mix: 0.6 }), -3.5);
  const hats = sum(toPeak(hp(s('hat'), 4000), -8), toPeak(hp(s('ohat'), 3000), -11));
  const bellDry = toPeak(hp(s('bell'), 400), -14), choirDry = toPeak(lp(hp(s('choir'), 160), 3200), -16);
  const music = duck(sum(bellDry, choirDry, gainDb(room(sum(bellDry, gainDb(choirDry, -4)), 1.6, 400), -3)), kickFrames, 2, 20, 120);
  const stems = { kick, snare, hats, bass808: bass, music };
  const total = sum(kick, snare, hats, bass, music);
  // Processed only: the sum is pushed PUSH_DB past the ceiling into the CRUSH soft clipper.
  const clipped = process ? clipTo(gainDb(total, PUSH_DB - 1 - ampDb(peak(total))), -1) : total;
  const master = gainDb(clipped, -1 - ampDb(truePeak(clipped))); // both versions end at exactly -1 dBTP (4x oversampled)
  return { stems, master };
}
const PUSH_DB = Number(process.env.GRIND_PUSH ?? 3);

// ----------------------------------------------------------------------------------------------------- delivery
const r = await renderBridge(score as never);
const kickFrames = r.manifest.events.filter(e => e.part === 'kick').map(e => e.frame);
const dry = mix(r.stems, kickFrames, false), wet = mix(r.stems, kickFrames, true);
mkdirSync(join(OUT, 'stems'), { recursive: true });
const files: Record<string, Stereo> = {
  'GRIND-A-dry': dry.master,
  'GRIND-B-crush': wet.master,
  'GRIND-C-three-cycles': fadeOut(cycle(wet.master, LOOP, 3), 30),
  'GRIND-D-dry-then-crush': sum(dry.master, delayed(wet.master, dry.master[0].length)),
};
function delayed(x: Stereo, lead: number): Stereo { return x.map(ch => { const y = new Float64Array(lead + ch.length); y.set(ch, lead); return y; }) as Stereo; }
const report: Record<string, unknown> = {};
for (const [name, audio] of Object.entries(files)) {
  const path = join(OUT, `${name}.wav`); writeAudio(path, audio);
  const l = loudness(path);
  report[name] = { seconds: round(audio[0].length / SR, 3), frames: audio[0].length, integratedLufs: l.lufs, truePeakDbtp: l.truePeakDb, samplePeakDbfs: round(ampDb(peak(audio))),
    crestDb: round(ampDb(peak(audio)) - ampDb(rms(audio))), bandBalanceDb: bandBalance(audio), kick: transientStats(audio, kickFrames) };
}
// Stems: exactly what the processed master sums (before the master clipper), and the dry 808 for comparison.
for (const [id, st] of Object.entries(wet.stems)) writeAudio(join(OUT, 'stems', `${id}.wav`), st);
writeAudio(join(OUT, 'stems', 'bass808-dry.wav'), dry.stems.bass808!);
writeAudio(join(OUT, 'stems', 'drums-only.wav'), sum(wet.stems.kick!, wet.stems.snare!, wet.stems.hats!));
writeFileSync(join(HERE, 'score.json'), JSON.stringify(score, null, 1) + '\n');
writeFileSync(join(OUT, 'events.json'), JSON.stringify({ schema: r.manifest.schema, bpm: BPM, framesPerBeat: BEAT, loopFrames: LOOP, sampleRate: SR, timing: r.manifest.timing, events: r.manifest.events }) + '\n');
const sha = (x: Stereo) => createHash('sha256').update(Buffer.from(x[0].buffer)).update(Buffer.from(x[1].buffer)).digest('hex');
writeFileSync(join(OUT, 'REPORT.json'), JSON.stringify({ title: score.title, bpm: BPM, key: score.key, loopFrames: LOOP, loopSeconds: round(LOOP / SR, 4),
  note: 'Measurements only. Nobody has listened to these files; no number here says the audition is good.',
  floatSha256: { dry: sha(dry.master), crush: sha(wet.master) }, files: report }, null, 1) + '\n');
// Kick/808 handover: level of the band under 150 Hz in 25 ms steps after each kick that has an 808 under it.
const low = lp(sum(wet.stems.kick!, wet.stems.bass808!), 150, true);
const handover = kickFrames.map(f => Array.from({ length: 10 }, (_, k) => round(ampDb(rms(low, f + k * 1102, f + (k + 1) * 1102)), 1)));
console.log(Object.entries(report).map(([k, v]) => { const x = v as { seconds: number; integratedLufs: number; truePeakDbtp: number; crestDb: number; kick: unknown; bandBalanceDb: Record<string, number> }; return `${k} ${x.seconds}s LUFS ${x.integratedLufs} TP ${x.truePeakDbtp} crest ${x.crestDb} ${JSON.stringify(x.kick)} ${Object.values(x.bandBalanceDb).join(' ')}`; }).join('\n'));
console.log('low band after each kick (dB, 25 ms steps):\n' + handover.map((h, i) => `  kick@${KICKS[i]} ${h.join(' ')}`).join('\n'));
for (const [id, st] of Object.entries(wet.stems)) console.log(`  stem ${id} peak ${round(ampDb(peak(st)))} rms ${round(ampDb(rms(st)))}`);
