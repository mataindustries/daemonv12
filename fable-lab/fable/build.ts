/**
 * FABLE build: renders both candidates, mixes and masters them as seamless 15.000 s loops, loudness-matches them and
 * writes masters, three-cycle previews, stems, scores, event maps and a report with the audio checks.
 *
 *   node fable-lab/fable/build.ts NEW_DIR [A|B ...]          (needs FFmpeg with libmp3lame and flac)
 *
 * Set FABLE_CACHE=DIR to keep the dry stem renders between runs while a mix is being adjusted.
 */
import { spawnSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { existsSync, mkdirSync, readFileSync, readdirSync, writeFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { crush, type Stereo } from '../crush/crush.ts';
import { ampDb, bandBalance, dbAmp, gain, mp3, peak, r128, rms, round, transientStats, truePeak, writeWav16 } from '../crush/measure.ts';
import { lowerFable, renderFable, noteEvents, SR, type FableScore, type Lowered } from './bridge.ts';
import { cut, extend, fold, lp, sum, type Ctx } from './mix.ts';
import { scoreA, scoreB, mixA, mixB, MASTER } from './compose.ts';

const here = dirname(fileURLToPath(import.meta.url));
const ffmpeg = process.env.DAEMONV12_FFMPEG || 'ffmpeg';
export const LOOP_FRAMES = 661_500, CEILING_DBTP = -1, TAIL_SECONDS = 6, MASTER_PUSH_DB = 2.5;
export const CANDIDATES = [
  { id: 'A', label: 'FABLE-A-industrial-pursuit', score: scoreA, mix: mixA },
  { id: 'B', label: 'FABLE-B-chrome-funk', score: scoreB, mix: mixB },
] as const;
const json = (v: unknown) => JSON.stringify(v, null, 2) + '\n';
const sha256 = (b: Uint8Array) => createHash('sha256').update(b).digest('hex');
function ff(args: string[]) { const r = spawnSync(ffmpeg, ['-hide_banner', '-nostdin', '-v', 'error', '-y', ...args], { encoding: 'utf8' }); if (r.status !== 0) throw new Error(`ffmpeg ${args.join(' ')}: ${r.stderr}`); }
const flac = (wav: string, out: string) => ff(['-i', wav, '-c:a', 'flac', '-compression_level', '8', '-map_metadata', '-1', '-fflags', '+bitexact', '-flags:a', '+bitexact', out]);
const repeat = (x: Stereo, times: number): Stereo => x.map(c => { const y = new Float64Array(c.length * times); for (let k = 0; k < times; k++) y.set(c, k * c.length); return y; }) as Stereo;

/** Dry stems for a candidate, optionally cached as raw float32 files keyed by the lowered performance. */
async function stemsOf(l: Lowered, title: string, log: (s: string) => void): Promise<{ stems: Map<string, Stereo>; project: unknown; engineClipped: Record<string, number> }> {
  const cache = process.env.FABLE_CACHE, key = sha256(Buffer.from(JSON.stringify([l.rackScore, l.v12, TAIL_SECONDS]))).slice(0, 16), dir = cache ? join(cache, key) : undefined;
  if (dir && existsSync(join(dir, 'meta.json'))) {
    const meta = JSON.parse(readFileSync(join(dir, 'meta.json'), 'utf8')) as { ids: string[]; project: unknown; engineClipped: Record<string, number> }, stems = new Map<string, Stereo>();
    for (const id of meta.ids) { const f = new Float32Array(new Uint8Array(readFileSync(join(dir, `${id}.f32`))).buffer), n = f.length / 2; stems.set(id, [Float64Array.from(f.subarray(0, n)), Float64Array.from(f.subarray(n))]); }
    log(`stems from cache ${key}`); return { stems, project: meta.project, engineClipped: meta.engineClipped };
  }
  const r = await renderFable(l, title, TAIL_SECONDS, log);
  if (dir) {
    mkdirSync(dir, { recursive: true });
    for (const [id, x] of r.stems) { const f = new Float32Array(x[0].length * 2); f.set(x[0]); f.set(x[1], x[0].length); writeFileSync(join(dir, `${id}.f32`), Buffer.from(f.buffer)); }
    writeFileSync(join(dir, 'meta.json'), json({ ids: [...r.stems.keys()], project: r.project, engineClipped: r.engineClipped }));
  }
  return r;
}
/** The master stage: push the mix `pushDb` past the clipper's ceiling, then DAEMON//CRUSH with only its clipper on. */
function master(mix: Stereo, pushDb: number) {
  const g = dbAmp(CEILING_DBTP + pushDb) / peak(mix);
  return { ...crush(gain(mix, g), { ...MASTER, ceilingDb: CEILING_DBTP, referenceDb: -3 }), preGain: g };
}
/** Wrap-around statistics of the delivered PCM16 loop: the step from the last frame to the first against all steps. */
function seam(x: Stereo) {
  const n = x[0].length, steps: number[] = []; let wrap = 0;
  for (let c = 0; c < 2; c++) { for (let i = 1; i < n; i++) steps.push(Math.abs(x[c]![i]! - x[c]![i - 1]!)); wrap = Math.max(wrap, Math.abs(x[c]![0]! - x[c]![n - 1]!)); }
  steps.sort((a, b) => a - b);
  let below = 0; while (below < steps.length && steps[below]! <= wrap) below++;
  return { wrapStep: round(wrap, 5), medianStep: round(steps[steps.length >> 1]!, 5), p99Step: round(steps[Math.floor(steps.length * 0.99)]!, 5), wrapStepPercentile: round(100 * below / steps.length, 2) };
}
const corr = (x: Stereo) => { let ab = 0, aa = 0, bb = 0; for (let i = 0; i < x[0].length; i++) { ab += x[0][i]! * x[1][i]!; aa += x[0][i]! ** 2; bb += x[1][i]! ** 2; } return ab / Math.sqrt(aa * bb || 1); };

export async function build(outDir: string, ids: string[] = CANDIDATES.map(c => c.id), log: (s: string) => void = s => console.error(s)) {
  const out = resolve(outDir); if (existsSync(out)) throw new Error(`refusing to write into an existing path: ${out}`);
  const made: { c: (typeof CANDIDATES)[number]; score: FableScore; l: Lowered; ctx: Ctx; buses: Record<string, Stereo>; mixed: Stereo; project: unknown; engineClipped: Record<string, number>; rawPeaks: Record<string, number> }[] = [];
  for (const c of CANDIDATES.filter(x => ids.includes(x.id))) {
    const score = c.score(), l = lowerFable(score);
    for (const w of l.warnings) log(w);
    if (l.endBeat * 60 / l.bpm * SR !== LOOP_FRAMES) throw new Error(`${c.id}: the loop is not ${LOOP_FRAMES} frames`);
    const r = await stemsOf(l, score.title, log);
    const kicks = l.v12.find(p => p.id === 'kick')!.notes.map(n => Math.round(n.beat * 60 / l.bpm * SR));
    const ctx: Ctx = { loop: LOOP_FRAMES, pre: 4 * SR, post: SR / 2, bpm: l.bpm, kicks };
    const ext = new Map<string, Stereo>(), rawPeaks: Record<string, number> = {};
    for (const [id, x] of r.stems) rawPeaks[id] = round(ampDb(peak(x)));
    const s = (id: string) => { let e = ext.get(id); if (!e) { const x = r.stems.get(id); if (!x) throw new Error(`${c.id}: no stem "${id}" (${[...r.stems.keys()].join(', ')})`); e = extend(fold(x, LOOP_FRAMES), ctx); ext.set(id, e); } return e; };
    const m = c.mix(s, ctx);
    const unused = [...r.stems.keys()].filter(id => !ext.has(id)); if (unused.length) throw new Error(`${c.id}: stems not in the mix: ${unused.join(', ')}`);
    made.push({ c, score, l, ctx, buses: m.buses, mixed: m.mix, project: r.project, engineClipped: r.engineClipped, rawPeaks });
    log(`${c.id}: mixed`);
  }
  mkdirSync(out, { recursive: true });
  const scratch = join(out, '.probe.wav');
  // Master each candidate, find its loudness at the ceiling, and bring both to the lower one with a single gain.
  const mastered = made.map(m => {
    const ms = master(m.mixed, MASTER_PUSH_DB), loop = cut(ms.audio, m.ctx), g = dbAmp(CEILING_DBTP) / truePeak(loop), at = gain(loop, g);
    writeWav16(scratch, at); const lufs = r128(scratch).lufs;
    // For comparison only: the same mix through all three CRUSH stages at 0.7 (the whole-bus setting), also at -1 dBTP.
    const whole = cut(crush(gain(m.mixed, dbAmp(-3) / peak(m.mixed)), { amount: 0.7, ceilingDb: CEILING_DBTP, referenceDb: -3 }).audio, m.ctx), wAt = gain(whole, dbAmp(CEILING_DBTP) / truePeak(whole));
    writeWav16(scratch, wAt);
    return { m, ms, loop: at, trim: g, lufs, wholeBus: { loudnessAtCeilingLufs: r128(scratch).lufs, kick: transientStats(wAt, m.ctx.kicks), bandBalanceDb: bandBalance(wAt) } };
  });
  const target = Math.min(...mastered.map(x => x.lufs));
  const report: Record<string, unknown> = {};
  for (const x of mastered) {
    const { m } = x, dir = join(out, m.c.id); mkdirSync(join(dir, 'stems'), { recursive: true });
    let audio = gain(x.loop, dbAmp(target - x.lufs)), matchGain = x.trim * dbAmp(target - x.lufs);
    const wav = join(out, `${m.c.label}.wav`);
    let clipped = writeWav16(wav, audio); const err = target - r128(wav).lufs;
    if (Math.abs(err) > 0.02) { audio = gain(audio, dbAmp(err)); matchGain *= dbAmp(err); clipped = writeWav16(wav, audio); }
    mp3(wav, join(out, `${m.c.label}.mp3`), 320);
    const x3 = join(out, `.x3.wav`); writeWav16(x3, repeat(audio, 3)); mp3(x3, join(out, `${m.c.label}-loop-x3.mp3`), 256);
    // stems: the mix buses of one loop at the master's gain; they sum to the mix that enters the clipper
    const stemGain = x.ms.preGain * matchGain, stemInfo: Record<string, unknown> = {}; let stemSum: Stereo | undefined;
    for (const [name, bus] of Object.entries(m.buses)) {
      const st = gain(cut(bus, m.ctx), stemGain); stemSum = stemSum ? sum(stemSum, st) : st;
      const tmp = join(dir, 'stems', `.${name}.wav`), over = writeWav16(tmp, st); flac(tmp, join(dir, 'stems', `${name}.flac`));
      stemInfo[name] = { peakDbfs: round(ampDb(peak(st))), rmsDbfs: round(ampDb(rms(st))), clippedSamples: over };
    }
    writeFileSync(join(dir, 'score.json'), json(m.score));
    writeFileSync(join(dir, 'rack-score.json'), json(m.l.rackScore));
    writeFileSync(join(dir, 'v12-engine-project.json'), json(m.project));
    writeFileSync(join(dir, 'motif-report.json'), json(m.l.report));
    writeFileSync(join(dir, 'motif-events.json'), json(m.l.motifEvents));
    writeFileSync(join(dir, 'note-events.json'), json(noteEvents(m.l)));
    // ---- checks
    const l = r128(wav), pk = peak(audio), tp = truePeak(audio), kickSolo = gain(cut(m.buses.kick!, m.ctx), stemGain), onsets = m.ctx.kicks;
    const lowOf = (b: Stereo) => lp(b, 120, true), lowKick = lowOf(kickSolo), lowRest = lowOf(sum(...Object.entries(m.buses).filter(([k]) => k !== 'kick').map(([, b]) => gain(cut(b, m.ctx), stemGain))));
    const w = Math.round(0.08 * SR); let ek = 0, er = 0;
    for (const o of onsets) for (let i = o; i < Math.min(LOOP_FRAMES, o + w); i++) { ek += lowKick[0][i]! ** 2; er += lowRest[0][i]! ** 2; }
    const mean = (audio[0].reduce((a, v) => a + v, 0) + audio[1].reduce((a, v) => a + v, 0)) / (2 * LOOP_FRAMES);
    report[m.c.id] = {
      title: m.score.title, key: m.score.key, bpm: m.score.bpm, swing: m.score.swing, files: { wav: `${m.c.label}.wav`, mp3: `${m.c.label}.mp3`, loopX3: `${m.c.label}-loop-x3.mp3` },
      sha256: sha256(readFileSync(wav)), frames: audio[0].length, seconds: audio[0].length / SR,
      integratedLufs: l.lufs, loudnessRangeLu: l.lra, truePeakDbtp: round(ampDb(tp)), truePeakDbtpFfmpeg: l.truePeakDb, samplePeakDbfs: round(ampDb(pk)), rmsDbfs: round(ampDb(rms(audio))), crestDb: round(ampDb(pk) - ampDb(rms(audio))),
      clippedSamples: clipped, dcOffset: round(mean, 6), stereoCorrelation: round(corr(audio), 3), lowBandCorrelation: round(corr(lowOf(audio)), 3),
      bandBalanceDb: bandBalance(audio),
      kick: { onsets: onsets.length, inMaster: transientStats(audio, onsets), kickBusAlone: transientStats(kickSolo, onsets),
        note: 'frontToBodyDb of the kick bus alone is the kick as the pack plays it; inMaster is what is left after everything else is added and the master clipper has run',
        lowBandOthersVsKickDb: round(10 * Math.log10(er / ek)), lowBandNote: 'energy under 120 Hz of everything except the kick, relative to the kick, in the first 80 ms after each kick' },
      master: { pushDb: MASTER_PUSH_DB, stage: MASTER, clipperMaxShaveDb: x.ms.report.maxShaveDb, clipperShare: x.ms.report.clippedShare, loudnessAtCeilingLufs: x.lufs, matchGainDb: round(ampDb(matchGain)) },
      wholeBusCrush07ForComparison: x.wholeBus,
      seam: seam(audio), stems: stemInfo, stemSumPeakDbfs: round(ampDb(peak(stemSum!))), dryStemPeaksDbfs: m.rawPeaks, engineClippedSamples: m.engineClipped,
      motif: { warnings: m.l.warnings.length, report: m.l.report },
    };
  }
  writeFileSync(join(out, 'REPORT.json'), json({
    schema: 'daemonv12.fable-lab.fable/1', loopFrames: LOOP_FRAMES, sampleRate: SR, ceilingDbtp: CEILING_DBTP, targetLufs: round(target),
    method: 'Each part is rendered once, dry, with a 6 s tail (rack parts by the rack, V12 parts by the engine CLI) and folded onto one loop. Buses are processed on a wrapped buffer (4 s lead-in, 0.5 s lead-out) so every processor is in steady state at the loop point. The master is a peak-normalised push into the DAEMON//CRUSH clipper only. Both candidates are then set to the same integrated loudness, the lower of the two at -1 dBTP, with one gain each.',
    node: process.version, ffmpeg: spawnSync(ffmpeg, ['-hide_banner', '-version'], { encoding: 'utf8' }).stdout.split('\n')[0],
    candidates: report,
    hashes: Object.fromEntries(['bridge.ts', 'mix.ts', 'compose.ts', 'build.ts', '../crush/crush.ts'].map(f => [f, sha256(readFileSync(join(here, f)))])),
  }));
  for (const f of readdirSync(out, { recursive: true, encoding: 'utf8' })) if (/(^|\/)\.[^/]+\.wav$/.test(f)) spawnSync('rm', ['-f', join(out, f)]);
  const files = readdirSync(out, { recursive: true, withFileTypes: true }).filter(e => e.isFile() && e.name !== 'SHA256SUMS').map(e => join(e.parentPath, e.name).slice(out.length + 1)).sort();
  writeFileSync(join(out, 'SHA256SUMS'), files.map(f => `${sha256(readFileSync(join(out, f)))}  ${f}\n`).join(''));
  return out;
}
if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const [dir, ...ids] = process.argv.slice(2);
  if (!dir) { console.error('usage: node fable-lab/fable/build.ts NEW_DIR [A|B ...]'); process.exit(2); }
  build(dir, ids.length ? ids : undefined).then(o => console.log(o), e => { console.error((e as Error).stack); process.exit(1); });
}
