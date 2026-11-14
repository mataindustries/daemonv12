/**
 * Gate 2 mix for C - IMPOSSIBLE ASCENT (developed). Reads the DaemonV12 stem render of
 * ../c-impossible-ascent-gate2.json (build_developed.py) and mixes with DAEMON//CRUSH via the
 * unchanged sound-lab helpers. No synthesis, no engine changes.
 *   node benchmarks/grind-wonder-anti-formula/impossible-ascent-gate2/mix.ts
 * Needs FFmpeg for MP3/loudness (writeAudio/loudness from sound-lab/lib.ts).
 */
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { SR, type Stereo, sum, gainDb, toPeak, mono, hp, lp, crushed, clipTo, duck, room, writeAudio, loudness, ampDb, peak, rms, silence } from '../../../sound-lab/lib.ts';
import { readWav, round } from '../../../fable-lab/crush/measure.ts';

const HERE = dirname(fileURLToPath(import.meta.url));
const STEMS = join(HERE, 'source-render', 'c-impossible-ascent-gate2.stems');
const OUT = join(HERE, 'audio');
mkdirSync(join(OUT, 'stems'), { recursive: true });
const stem = (id: string): Stereo => readWav(join(STEMS, `${id}.wav`));
const pad = (x: Stereo, n: number): Stereo => x[0].length >= n ? x : [Object.assign(new Float64Array(n), x[0]), Object.assign(new Float64Array(n), x[1])] as unknown as Stereo;

// Kick onsets (frames) parsed from the authored project, for the 808 duck.
const proj = JSON.parse(readFileSync(join(HERE, '..', 'c-impossible-ascent-gate2.json'), 'utf8'));
const beatFrames = SR * 60 / proj.bpm;
function parseStart(s: string): number {
  const m = /^(\d+):(\d+)(?:\+(\d+)\/(\d+))?$/.exec(s)!;
  return (Number(m[1]) - 1) * 4 + (Number(m[2]) - 1) + (m[3] ? (Number(m[3]) / Number(m[4])) * 4 : 0);
}
const kickTrack = proj.tracks.find((t: { id: string }) => t.id === 'kick');
const pats = new Map(kickTrack.patterns.map((p: { id: string; notes: { start: string }[] }) => [p.id, p.notes.map(n => parseStart(n.start))]));
const kickFrames: number[] = kickTrack.clips.flatMap((c: { bar: number; pattern: string }) =>
  pats.get(c.pattern)!.map((b: number) => Math.round(((c.bar - 1) * 4 + b) * beatFrames)));

const N = stem('phrase')[0].length;
const S = (id: string) => pad(stem(id), N);

// Hook: dry Phantom plus a dark room; the identity stays in front.
const phraseDry = toPeak(S('phrase'), -11);
const hook = sum(phraseDry, gainDb(room(phraseDry, 1.9, 350), -6));
// Atmosphere: Specter shadow, Afterglow chords, Signal flecks, the two glass notes.
const atmoDry = sum(S('shadow'), S('chord'), S('flecks'), S('glass'));
const atmosphere = toPeak(sum(toPeak(atmoDry, -14), gainDb(room(toPeak(atmoDry, -16), 2.4, 300), -4)), -13);
// The trench: wall + Abyss pedal, low-passed and half-crushed so M1 presses down, not sparkles.
const wallDrone = toPeak(crushed(lp(sum(S('wall'), S('drone')), 850), 0.5, { mix: 0.5 }), -6);
// 808: Abyss + Reactor, ducked under every kick, then DAEMON//CRUSH (the GRIND recipe).
let bass808 = mono(sum(S('bass808'), hp(S('bass808-grit'), 30)));
bass808 = toPeak(crushed(duck(toPeak(hp(bass808, 26), -6), kickFrames, 12, 45, 90), 0.75, { pushDb: 3, mix: 0.85 }), -4.5);
// Trap drums, displaced as authored: kick owns its front (own soft clip), snare/clap crushed, hats never crushed.
const kick = toPeak(clipTo(toPeak(hp(S('kick'), 40), -3), -3.5), -3);
const snare = toPeak(crushed(sum(toPeak(S('snare'), -5), toPeak(hp(S('clap'), 250), -9)), 0.65, { mix: 0.6 }), -4.5);
const hatsTicks = toPeak(sum(hp(S('hats'), 4500), hp(S('ticks'), 5000), S('clang')), -9);

const stems: Record<string, Stereo> = { hook, atmosphere, 'wall-drone': wallDrone, bass808, kick, snare, 'hats-ticks': hatsTicks };
for (const [id, x] of Object.entries(stems)) writeAudio(join(OUT, 'stems', `${id}.wav`), x, false);

const total = sum(...Object.values(stems));
const clipped = clipTo(gainDb(total, 2 - 1 - ampDb(peak(total))), -1);
const { truePeak } = await import('../../../fable-lab/crush/measure.ts');
const master = gainDb(clipped, -1 - ampDb(truePeak(clipped)));
const masterPath = join(OUT, 'IMPOSSIBLE-ASCENT-DEVELOPED.wav');
writeAudio(masterPath, master);
const l = loudness(masterPath);
const sec = (a: number, b: number) => ({ rmsDb: round(ampDb(rms(master, Math.round(a * SR), Math.round(b * SR)))), peakDb: round(ampDb(Math.max(...[0, 1].map(c => { let p = 0; for (let i = Math.round(a * SR); i < Math.round(b * SR); i++) p = Math.max(p, Math.abs(master[c]![i]!)); return p; })))) });
const report = {
  title: proj.title, seconds: round(N / SR, 3), bpm: proj.bpm, integratedLufs: l.lufs, loudnessRangeLu: l.lra, truePeakDbtp: l.truePeakDb,
  note: 'Measurements only; nobody has listened. Movements: M1 TRAPPED 0-11.67s, M2 SOMETHING BREAKS 11.67-16.67s, M3 BREAKTHROUGH 16.67-28.0s.',
  movements: { 'M1-trapped': sec(0, 11.67), 'M2-breaks': sec(11.67, 16.67), 'M3-breakthrough': sec(16.67, 28.0) },
  stems: Object.fromEntries(Object.entries(stems).map(([k, x]) => [k, { peakDb: round(ampDb(peak(x))), rmsDb: round(ampDb(rms(x))) }])),
};
writeFileSync(join(OUT, 'REPORT.json'), JSON.stringify(report, null, 1) + '\n');
console.log(JSON.stringify(report, null, 1));
