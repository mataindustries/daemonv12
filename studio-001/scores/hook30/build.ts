/**
 * HOOK//30 build: renders each candidate with the unchanged rack (the score/2 is lowered first), folds the render's
 * tail back onto its start (the HOOK//10 loop method, reused from ../hook10/build.ts), brings every candidate to the
 * same loudness with one gain, and writes masters, listening copies, loop-aligned stems, the motif report, the motif
 * event map, a full musical event map for picture sync, and a manifest with every technical check.
 *
 *   node studio-001/scores/hook30/build.ts NEW_DIR [id ...]        (needs FFmpeg with libmp3lame and flac)
 *
 * The piece is 12 bars at 96 BPM: 48 beats of 625,000 µs = exactly 1,323,000 frames (30.000 s).
 * No limiter, compressor, EQ, crossfade or time-stretch is applied anywhere: one gain per candidate.
 */
import { spawnSync } from 'node:child_process';
import { existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { performanceJson } from '../../rack/score.ts';
import { renderScore, mixdown, peak, type Stereo } from '../../rack/render.ts';
import { wavBytes } from '../../rack/package.ts';
import { sha256 } from '../../rack/frozen.ts';
import { RATE, beatFrame, beatSecondsOf, pitchName, pitchOf } from '../../rack/curves.ts';
import { loudness, ffmpegVersion } from '../../rack/cli.ts';
import { lowerScore, motifReport, motifEvents, hook10Gate, normalizeAnyScore, onsetFrame } from '../../motif/index.ts';
import { foldLoop, seamCheck } from '../hook10/build.ts';

const here = dirname(fileURLToPath(import.meta.url));
export const LOOP_FRAMES = 1_323_000, BARS = 12, TARGET_LUFS = -16, CEILING_DBTP = -1;
export const EVENT_MAP_SCHEMA = 'daemonv12.hook30.event-map/1';
export const CANDIDATES: { id: string; file: string; name: string }[] = [
  { id: 'GROOVE', file: 'hook30-groove.score.json', name: 'HOOK30-GROOVE' },
  { id: 'ASCENSION', file: 'hook30-ascension.score.json', name: 'HOOK30-ASCENSION' },
];
const ffmpeg = process.env.DAEMONV12_FFMPEG || 'ffmpeg';
const json = (v: unknown) => JSON.stringify(v, null, 2) + '\n';
function ff(args: string[]) {
  const r = spawnSync(ffmpeg, ['-hide_banner', '-nostdin', '-v', 'error', '-y', ...args], { encoding: 'utf8' });
  if (r.status !== 0) throw new Error(`ffmpeg ${args.join(' ')}: ${r.stderr}`);
}
const BITEXACT = ['-map_metadata', '-1', '-fflags', '+bitexact', '-flags:a', '+bitexact'];
const mp3 = (wav: string, out: string) => ff(['-i', wav, '-codec:a', 'libmp3lame', '-b:a', '256k', ...BITEXACT, out]);
const flac = (wav: string, out: string) => ff(['-i', wav, '-codec:a', 'flac', '-compression_level', '8', ...BITEXACT, out]);
const db = (x: number) => (x > 0 ? 20 * Math.log10(x) : -Infinity);
const r2 = (x: number) => +x.toFixed(2);
const rmsOf = (chs: Float64Array[], a: number, z: number) => { let s = 0; for (const c of chs) for (let i = a; i < z; i++) s += c[i]! * c[i]!; return Math.sqrt(s / Math.max(1, chs.length * (z - a))); };
const repeat = (y: Stereo, times: number): Stereo => y.map(c => { const out = new Float64Array(c.length * times); for (let k = 0; k < times; k++) out.set(c, k * c.length); return out; }) as Stereo;
const pcmOf = (wav: Buffer) => new Int16Array(wav.buffer, wav.byteOffset + 44, (wav.length - 44) / 2);

interface Annotations { harmony: [number, string][]; cues: { id: string; beat: number; label: string }[] }
interface Authored { schema: string; bpm: number; swing?: number; sections: { id: string; bars: number; development?: string }[]; annotations?: Annotations; parts: { id: string; instrument: string; notes?: unknown[] }[] }

/**
 * The full musical event map of one candidate, for picture sync. Every frame is a sample index at 44.1 kHz inside the
 * 1,323,000-frame loop: `frame = round(swung(beat) * beatSeconds * 44100)`, the expression the rack places a note with.
 * It contains the grid (movements, bars, beats), the harmony and the named cues written in the score's `annotations`,
 * every motif statement (phrase) with its transform chain, and every note of every part (phrase notes and the few
 * authored ones). Velocities are as authored (the clock's seeded velocity humanisation is in performance.json).
 */
export function eventMap(authored: Authored, lowered = lowerScore(authored)) {
  const bpm = authored.bpm, swing = authored.swing ?? 0.5, frame = (beat: number) => onsetFrame(beat, bpm, swing), motif = motifEvents(authored, lowered);
  let bar = 0;
  const movements = authored.sections.map((s, i) => { const startBar = bar + 1; bar += s.bars; return { index: i + 1, id: s.id, startBar, bars: s.bars, startBeat: (startBar - 1) * 4, startFrame: beatFrame((startBar - 1) * 4, bpm), endFrame: beatFrame(bar * 4, bpm), development: s.development ?? '' }; });
  const ann = authored.annotations ?? { harmony: [], cues: [] };
  const authoredNotes = authored.parts.flatMap(part => (part.notes ?? []).map((n, k) => {
    const [beat, beats, pitch, velocity] = n as [number, number, string | number, number?];
    return { id: `${part.id}.authored.n${k}`, kind: 'note' as const, part: part.id, beat, frame: frame(beat), beats, pitch: pitchOf(pitch), velocity: velocity ?? 0.8 };
  }));
  const instruments = Object.fromEntries(authored.parts.map(p => [p.id, p.instrument]));
  const notes = [...motif.events.filter(e => e.kind === 'note'), ...authoredNotes].map(e => ({ ...e, pitchName: pitchName(e.pitch!) })).sort((a, b) => a.frame - b.frame || a.part.localeCompare(b.part) || a.pitch! - b.pitch!);
  return {
    schema: EVENT_MAP_SCHEMA, title: motif.title, sampleRate: RATE, bpm, swing, beatsPerBar: 4, bars: BARS, endBeat: motif.endBeat, loopFrames: motif.endFrame, loop: true,
    frameRule: 'frame = round(swung(beat) * beatSeconds * 44100); beatSeconds = 0.625 at 96 BPM; the file loops, so frame 1323000 is frame 0',
    instruments, movements,
    barGrid: Array.from({ length: BARS }, (_, k) => ({ bar: k + 1, beat: 4 * k, frame: beatFrame(4 * k, bpm) })),
    beatGrid: Array.from({ length: BARS * 4 }, (_, k) => ({ beat: k, bar: Math.floor(k / 4) + 1, frame: beatFrame(k, bpm) })),
    harmony: ann.harmony.map(([beat, chord]) => ({ beat, bar: Math.floor(beat / 4) + 1, frame: beatFrame(beat, bpm), chord })),
    cues: ann.cues.map(c => ({ ...c, bar: Math.floor(c.beat / 4) + 1, frame: frame(c.beat) })),
    phrases: motif.events.filter(e => e.kind === 'phrase').sort((a, b) => a.frame - b.frame || a.id.localeCompare(b.id)),
    notes,
  };
}

/**
 * Event-map check against the audio. For every note of a one-shot instrument (mallets, tines, clock, kick, snare)
 * whose part is silent just before it, the rendered part must be exactly zero up to the event frame and non-zero on
 * the frame after it (every one-shot waveform starts with a zero sample). The spring is a waveguide: its sound leaves
 * the delay line one period of the note after the pluck, so a spring note must begin within one period (plus 5 %) of
 * its event frame; the measured latencies are reported. Returns counts.
 */
function onsetCheck(map: ReturnType<typeof eventMap>, parts: { id: string; instrument: string; audio: Stereo }[]) {
  let checked = 0, total = 0; const failed: string[] = [], springMs: number[] = [];
  for (const part of parts) {
    if (!/^(mechanical-orchestra\/(bar|tine|clock|spring|bearings)|context\/)/.test(part.instrument)) continue;
    const spring = part.instrument === 'mechanical-orchestra/spring', mine = map.notes.filter(n => n.part === part.id), [l, r] = part.audio;
    const frames = [...new Set(mine.map(n => n.frame))].sort((a, b) => a - b);
    total += frames.length;
    for (const f of frames) {
      let quiet = true; for (let i = Math.max(0, f - 64); i <= f; i++) if (l[i] !== 0 || r[i] !== 0) { quiet = false; break; }
      if (!quiet) continue; // an earlier note still rings: its onset cannot be read from the waveform
      checked++;
      if (!spring) { if (l[f + 1] === 0 && r[f + 1] === 0) failed.push(`${part.id}@${f}`); continue; }
      const period = RATE / (440 * Math.pow(2, (Math.max(...mine.filter(n => n.frame === f).map(n => n.pitch!)) - 69) / 12)), limit = Math.ceil(1.05 * period) + 4;
      let first = -1; for (let i = 1; i <= limit; i++) if (l[f + i] !== 0 || r[f + i] !== 0) { first = i; break; }
      if (first < 0) failed.push(`${part.id}@${f}`); else springMs.push(1000 * first / RATE);
    }
  }
  return { oneShotOnsets: total, checkedAgainstAudio: checked, failed, ...(springMs.length ? { springLatencyMs: { min: +Math.min(...springMs).toFixed(2), max: +Math.max(...springMs).toFixed(2), note: 'waveguide: the sound begins one period of the note after its event frame' } } : {}) };
}

export async function buildCandidate(c: (typeof CANDIDATES)[number], out: string, log: (s: string) => void) {
  const file = join(here, c.file), authored = JSON.parse(readFileSync(file, 'utf8')) as Authored;
  const lowered = lowerScore(authored), score = normalizeAnyScore(authored), rendered = await renderScore(score, log), mixes = await mixdown(rendered);
  if (beatFrame(score.endBeat, score.bpm) !== LOOP_FRAMES || score.bars !== BARS) throw new Error(`${c.id}: the score is ${score.bars} bars, ${beatFrame(score.endBeat, score.bpm)} frames; expected ${BARS} bars, ${LOOP_FRAMES} frames`);
  const x = mixes.context, loop = foldLoop(x, LOOP_FRAMES), tailFrames = x[0].length - LOOP_FRAMES;
  let foldError = 0;
  for (let ch = 0; ch < 2; ch++) for (let n = 0; n < LOOP_FRAMES; n++) foldError = Math.max(foldError, Math.abs(loop[ch]![n]! - (x[ch]![n]! + (n < tailFrames ? x[ch]![n + LOOP_FRAMES]! : 0))));
  const tailEndDb = db(rmsOf(x, x[0].length - 4410, x[0].length)), bodyDb = db(rmsOf(x, 0, LOOP_FRAMES));
  const edge = (n: number) => Math.max(Math.abs(x[0][n]!), Math.abs(x[1][n]!));
  const dir = join(out, c.id); mkdirSync(join(dir, 'stems'), { recursive: true });
  // one gain: loudness measured on three passes of the loop (so the seam is inside the measurement), limited by the true-peak ceiling
  const probe = join(dir, 'probe.wav'), probeGain = 0.5 / Math.max(1e-9, peak(loop));
  writeFileSync(probe, wavBytes(repeat(loop, 3), probeGain).bytes);
  const l0 = loudness(probe)!; rmSync(probe);
  const gain = probeGain * Math.min(Math.pow(10, (TARGET_LUFS - l0.lufs) / 20), Math.pow(10, (CEILING_DBTP - 0.1 - l0.truePeakDb) / 20));
  const master = wavBytes(loop, gain), x3 = wavBytes(repeat(loop, 3), gain);
  if (master.clipped || x3.clipped) throw new Error(`${c.id}: clipped samples in the master`);
  const files: Record<string, { sha256: string; bytes: number }> = {};
  const note = (f: string) => { const b = readFileSync(join(out, f)); files[f] = { sha256: sha256(b), bytes: b.length }; };
  const put = (f: string, data: Buffer | string) => { writeFileSync(join(out, f), data); note(f); };
  put(`${c.name}.wav`, master.bytes); writeFileSync(join(dir, 'x3.wav'), x3.bytes);
  mp3(join(out, `${c.name}.wav`), join(out, `${c.name}.mp3`)); note(`${c.name}.mp3`);
  mp3(join(dir, 'x3.wav'), join(out, `${c.name}-loop-x3.mp3`)); note(`${c.name}-loop-x3.mp3`);
  // scores, performance, motif report and maps
  const report = motifReport(authored, lowered), gate = hook10Gate(report), map = eventMap(authored, lowered);
  put(`${c.id}/score.json`, json(authored)); put(`${c.id}/score.lowered.json`, json(lowered.score)); put(`${c.id}/performance.json`, json(performanceJson(score)));
  put(`${c.id}/motif-report.json`, json(report)); put(`${c.id}/motif-events.json`, json(motifEvents(authored, lowered))); put(`${c.id}/event-map.json`, json(map));
  // stems: every part and the room, folded exactly like the master and at the master gain, so they line up with the loop and sum to it
  const stemList: { part: string; file: string; rmsDb: number; peakDb: number; clipped: number }[] = [], sum = new Int32Array(2 * LOOP_FRAMES);
  for (const [id, st] of [...mixes.stems, ['room', mixes.room] as [string, Stereo]]) {
    const folded = foldLoop(st, LOOP_FRAMES), w = wavBytes(folded, gain), tmp = join(dir, 'stems', `${id}.wav`), f = `${c.id}/stems/${id}.flac`;
    writeFileSync(tmp, w.bytes); flac(tmp, join(out, f));
    const back = spawnSync(ffmpeg, ['-hide_banner', '-nostdin', '-v', 'error', '-i', join(out, f), '-f', 's16le', '-'], { maxBuffer: 1 << 28 });
    if (back.status !== 0 || !back.stdout.equals(w.bytes.subarray(44))) throw new Error(`${c.id}: ${f} does not decode to the stem's PCM`);
    rmSync(tmp); note(f);
    const pcm = pcmOf(w.bytes); for (let i = 0; i < sum.length; i++) sum[i] = sum[i]! + pcm[i]!;
    stemList.push({ part: id, file: f, rmsDb: r2(db(rmsOf(folded, 0, LOOP_FRAMES) * gain)), peakDb: r2(db(peak(folded) * gain)), clipped: w.clipped });
  }
  const m = pcmOf(master.bytes); let nullMax = 0; for (let i = 0; i < sum.length; i++) nullMax = Math.max(nullMax, Math.abs(sum[i]! - m[i]!));
  const stemBound = Math.ceil(stemList.length / 2) + 1; // each stem and the master round to the nearest LSB independently
  const measured = loudness(join(out, `${c.name}.wav`))!, measuredX3 = loudness(join(dir, 'x3.wav'))!, seam = seamCheck(master.bytes);
  rmSync(join(dir, 'x3.wav'));
  const x3pcm = pcmOf(x3.bytes); let x3Exact = true;
  for (let i = 0; i < x3pcm.length; i++) if (x3pcm[i] !== m[i % m.length]) { x3Exact = false; break; }
  // per-bar level of the master (plain RMS), to show the shape of the piece
  const barRms = Array.from({ length: BARS }, (_, k) => r2(db(rmsOf(loop, beatFrame(4 * k, score.bpm), beatFrame(4 * k + 4, score.bpm)) * gain)));
  const onsets = onsetCheck(map, rendered.parts.map(rp => ({ id: rp.part.id, instrument: rp.part.instrument.id, audio: rp.audio })));
  const residue = { renderFirstSample: Math.round(edge(0) * gain * 32767), renderLastSample: Math.round(edge(x[0].length - 1) * gain * 32767) };
  const floatPeakDb = r2(db(peak(loop) * gain));
  return {
    id: c.id, title: score.title, schema: authored.schema, scoreFile: `studio-001/scores/hook30/${c.file}`, scoreSha256: sha256(readFileSync(file)),
    bpm: score.bpm, swing: score.swing, key: score.key.label, bars: score.bars, notes: Object.fromEntries(score.parts.map(pt => [pt.id, pt.perf.notes.length])),
    master: { file: `${c.name}.wav`, frames: seam.frames, seconds: seam.frames / RATE, sampleRate: RATE, bits: 16, channels: 2, gainDb: +db(gain).toFixed(3), samplePeakDb: floatPeakDb, loudness: measured, loudnessLoopX3: measuredX3, clipped: master.clipped, barRmsDb: barRms },
    loop: {
      method: `tail fold: y[n] = x[n] + x[n + ${LOOP_FRAMES}]; no crossfade`, renderFrames: x[0].length, tailFrames, foldMaxAbsError: foldError,
      renderTailEndRmsDb: +tailEndDb.toFixed(1), bodyRmsDb: +bodyDb.toFixed(1), tailFullyDecayed: tailEndDb < bodyDb - 80, seamResidueLsb: residue, loopX3IsThreeExactCopies: x3Exact, seam,
    },
    stems: { format: 'FLAC, 44.1 kHz, 16-bit, stereo; loop-folded and at the master gain', list: stemList, sumVsMasterMaxAbsLsb: nullMax, roundingBoundLsb: stemBound },
    motif: { gate, coverage: report.coverage, statements: report.statements, developingKinds: report.developingKinds, crossPart: report.crossPart, recognizability: report.recognizability, variedStatements: report.variedStatements, maxLiteralRun: report.maxLiteralRun, cadence: report.cadence, droppedParams: report.droppedParams },
    eventMap: { file: `${c.id}/event-map.json`, phrases: map.phrases.length, notes: map.notes.length, cues: map.cues.length, harmonyChanges: map.harmony.length, ...onsets },
    technicalGate: {
      frames1323000: seam.frames === LOOP_FRAMES, noClipping: master.clipped === 0 && stemList.every(s => s.clipped === 0), truePeakAtMostMinus1: measured.truePeakDb <= CEILING_DBTP,
      loudnessOnTarget: Math.abs(measured.lufs - TARGET_LUFS) <= 0.15, seamContinuous: seam.pass && residue.renderFirstSample === 0 && residue.renderLastSample === 0,
      tailFullyDecayed: tailEndDb < bodyDb - 80, foldExact: foldError === 0, loopX3IsThreeExactCopies: x3Exact, stemsSumToMaster: nullMax <= stemBound,
      eventOnsetsMatchAudio: onsets.failed.length === 0 && onsets.checkedAgainstAudio > 0, motifGate: gate.pass,
    },
    files,
  };
}

if (process.argv[1] && resolve(process.argv[1]) === resolve(fileURLToPath(import.meta.url))) {
  const [outArg, ...only] = process.argv.slice(2);
  if (!outArg) throw new Error('usage: node studio-001/scores/hook30/build.ts NEW_DIR [id ...]');
  const out = resolve(outArg);
  if (existsSync(out)) throw new Error(`refusing to write into an existing path: ${out}`);
  if (!ffmpegVersion()) throw new Error('FFmpeg with libmp3lame is required');
  mkdirSync(out, { recursive: true });
  const candidates = [];
  for (const c of CANDIDATES) {
    if (only.length && !only.includes(c.id)) continue;
    console.error(`== ${c.id}`);
    candidates.push(await buildCandidate(c, out, s => console.error(`  ${s}`)));
  }
  const manifest = {
    schema: 'daemonv12.hook30.manifest/1', piece: 'HOOK//30', note: 'Plain measurements and symbolic structure checks. Nothing here says which candidate sounds better: that verdict is a human listening test.',
    targetLufs: TARGET_LUFS, ceilingDbtp: CEILING_DBTP, loopFrames: LOOP_FRAMES, seconds: LOOP_FRAMES / RATE, beatSeconds: beatSecondsOf(96), node: process.version, ffmpeg: ffmpegVersion(), candidates,
  };
  writeFileSync(join(out, 'MANIFEST.json'), json(manifest));
  const sums = candidates.flatMap(v => Object.entries(v.files).map(([f, d]) => `${d.sha256}  ${f}`)).sort((a, b) => a.slice(66).localeCompare(b.slice(66)));
  writeFileSync(join(out, 'SHA256SUMS'), sums.join('\n') + '\n');
  for (const v of candidates) console.log(`${v.id.padEnd(10)} ${v.master.loudness.lufs} LUFS  ${v.master.loudness.truePeakDb} dBTP  LRA ${v.master.loudness.lra}  seam step ${v.loop.seam.seamStepLsb} LSB (p99 inside ${v.loop.seam.insideStepLsb.p99})  stems null ${v.stems.sumVsMasterMaxAbsLsb} LSB  onsets ${v.eventMap.checkedAgainstAudio}/${v.eventMap.oneShotOnsets}  technical ${Object.values(v.technicalGate).every(Boolean) ? 'PASS' : 'FAIL ' + JSON.stringify(v.technicalGate)}`);
}
