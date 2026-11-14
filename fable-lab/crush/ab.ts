/**
 * DAEMON//CRUSH A/B build. Five seconds at 128 BPM using the existing V12 SIGNATURE pack, three sources:
 *   kick  SUB HAMMER + IRON PULSE layered (the pack's "drop kick" recipe), four on the floor
 *   bass  REACTOR, rolling sixteenths and two held notes (a neutral test pattern, not a composition)
 *   bus   kick + bass + NEON CLAP + GHOST TICK / OPEN CIRCUIT hats, the engine's plain sum
 * Three conditions per source:
 *   dry       what the unchanged engine renders, no effects
 *   existing  the engine's own effects (tanh `saturation` then FFmpeg `compressor`), rendered by the engine
 *   crush     the dry render through DAEMON//CRUSH
 * Every file of one source is set to the same integrated loudness, the loudest the dry file reaches at -1 dBTP,
 * with one gain per file and nothing else.
 *
 *   node fable-lab/crush/ab.ts NEW_DIR [--amount 0.7]        (needs FFmpeg with libmp3lame)
 *
 * The pack's WAVs are copied into a scratch project directory and read by the engine; no pack, engine, rack or
 * frozen instrument file is modified.
 */
import { spawnSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { cpSync, existsSync, mkdirSync, mkdtempSync, readFileSync, readdirSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { crush, SR, type Stereo, type CrushOptions } from './crush.ts';
import { aliasingProbe, ampDb, bandBalance, dbAmp, gain, intermodProbe, mp3, peak, r128, readWav, rms, round, transientStats, truePeak, writeWav16 } from './measure.ts';

const here = dirname(fileURLToPath(import.meta.url)), repo = resolve(here, '..', '..');
const PACK = join(repo, 'packs', 'v12-signature-v1', 'assets', 'v12-signature');
export const BPM = 128, SECONDS = 5, FRAMES = SR * SECONDS, CEILING_DBTP = -1, INPUT_PEAK_DB = -3;
/** The engine's own effects at a comparable intensity; one reasonable setting, not an exhaustive search. */
export const EXISTING_FX = [
  { type: 'saturation', driveDb: 10, mix: 1 },
  { type: 'compressor', thresholdDb: -16, ratio: 4, attackMs: 14, releaseMs: 120, makeupGainDb: 6 },
];
const json = (v: unknown) => JSON.stringify(v, null, 2) + '\n';
const sha256 = (b: Uint8Array) => createHash('sha256').update(b).digest('hex');

/** Engine position: beats from the start -> "bar:beat+ticks/3840". */
function at(beat: number): string {
  const tick = Math.round(beat * 960), off = tick % 960;
  return `${Math.floor(tick / 3840) + 1}:${Math.floor(tick % 3840 / 960) + 1}${off ? `+${off}/3840` : ''}`;
}
const beatFrame = (beat: number) => Math.round(Math.round(beat * 960) * Math.round(60_000_000 / BPM) * SR / 960_000_000);
export const KICK_BEATS = Array.from({ length: 11 }, (_, i) => i);

type Fx = typeof EXISTING_FX;
/** The test project. `trackFx` puts the effects on the kick and bass tracks (solo auditions), `masterFx` on the bus. */
export function project(opts: { trackFx?: Fx; masterFx?: Fx } = {}) {
  const kit = { type: 'drumkit', kit: 'assets/v12-signature/kit.json' };
  const kick = KICK_BEATS.flatMap(b => [
    { start: at(b), pitch: 'sub-hammer', velocity: 0.95, gate: '1/8', envelope: { attackSeconds: 0.001, releaseSeconds: 0.04 }, chokeGroup: 'kick' },
    { start: at(b), pitch: 'iron-pulse', velocity: b % 2 ? 0.74 : 0.84, chokeGroup: 'kick' },
  ]);
  const A1 = 1, C2 = 1.189207, G1 = 0.890899, short = { attackSeconds: 0.002, releaseSeconds: 0.025 }, held = { attackSeconds: 0.003, releaseSeconds: 0.05 };
  const roll = (beat: number, rate: number) => [[0.25, 0.92], [0.5, 0.74], [0.75, 0.83]].map(([o, v]) => ({ start: at(beat + o!), velocity: v, playbackRate: rate, gate: '1/16', envelope: short }));
  const bass = [
    ...[0, 1, 2, 3, 4, 5].flatMap(b => roll(b, A1)), ...roll(6, C2), ...roll(7, G1),
    { start: at(8.25), velocity: 0.95, playbackRate: A1, gate: '3/16', envelope: held },
    { start: at(9.25), velocity: 0.95, playbackRate: G1, gate: '3/16', envelope: held },
    { start: at(10.25), velocity: 0.9, playbackRate: A1, gate: '1/16', envelope: short },
  ];
  const hats = [
    ...KICK_BEATS.slice(0, 10).flatMap(b => [
      { start: at(b + 0.25), pitch: 'ghost-tick', velocity: 0.24, chokeGroup: 'hats' },
      b % 4 === 3 ? { start: at(b + 0.5), pitch: 'open-circuit', velocity: 0.5, gate: '1/8', envelope: { attackSeconds: 0.001, releaseSeconds: 0.05 }, chokeGroup: 'hats' }
        : { start: at(b + 0.5), pitch: 'ghost-tick', velocity: 0.55, chokeGroup: 'hats' },
      { start: at(b + 0.75), pitch: 'ghost-tick', velocity: 0.3, chokeGroup: 'hats' },
    ]),
  ];
  const clap = [1, 3, 5, 7, 9].map(b => ({ start: at(b), pitch: 'neon-clap', velocity: 0.78 }));
  const track = (id: string, instrument: unknown, gainDb: number, notes: unknown[], pan = 0, effects?: Fx) => ({
    id, instrument, mix: { gainDb, ...(pan ? { pan } : {}) }, ...(effects ? { effects } : {}), clips: [{ bar: 1, pattern: 'p' }], patterns: [{ id: 'p', bars: 3, notes }],
  });
  return {
    formatVersion: 1, title: 'DAEMON//CRUSH A/B source', bpm: BPM, timeSignature: '4/4', key: 'A minor', bars: 3, seed: 128,
    description: 'Five-second test pattern for the DAEMON//CRUSH A/B. V12 SIGNATURE assets only. Not a composition.',
    render: { duration: { seconds: SECONDS } },
    master: { gainDb: -3, ...(opts.masterFx ? { effects: opts.masterFx } : {}) },
    tracks: [
      track('kick', kit, -4.5, kick, 0, opts.trackFx),
      track('bass', { type: 'sampler', sample: 'assets/v12-signature/08-reactor.wav' }, -5, bass, 0, opts.trackFx),
      track('clap', kit, -7, clap),
      track('hats', kit, -8, hats, 0.15),
    ],
  };
}
/** Render a project with the unchanged engine CLI; returns the master and stems as floats. */
function engineRender(dir: string, name: string, proj: unknown) {
  writeFileSync(join(dir, `${name}.json`), json(proj));
  const r = spawnSync(process.execPath, [join(repo, 'bin', 'daemonv12.js'), 'render', join(dir, `${name}.json`), '--out-dir', join(dir, name), '--stems', '--json'], { encoding: 'utf8', maxBuffer: 1 << 28 });
  if (r.status !== 0) throw new Error(`engine render ${name} failed: ${r.stdout.slice(0, 2000)} ${r.stderr.slice(0, 2000)}`);
  const stem = (id: string) => readWav(join(dir, name, `${name}.stems`, `${id}.wav`));
  return { master: readWav(join(dir, name, `${name}.wav`)), kick: stem('kick'), bass: stem('bass') };
}
/** The same 20 ms raised-cosine fade at the 5 s cut for every condition. */
function fadeEnd(x: Stereo): Stereo {
  const n = Math.round(0.02 * SR), y: Stereo = [x[0].slice(0, FRAMES), x[1].slice(0, FRAMES)];
  for (const c of y) for (let i = 0; i < n; i++) c[FRAMES - 1 - i] = c[FRAMES - 1 - i]! * (0.5 - 0.5 * Math.cos(Math.PI * i / n));
  return y;
}
const normPeak = (x: Stereo, db: number) => gain(x, dbAmp(db) / peak(x));
/** Integrated loudness of a float buffer (written to a scratch WAV first: FFmpeg measures files). */
function lufsOf(x: Stereo, scratch: string): number { writeWav16(scratch, x); return r128(scratch).lufs; }

interface Condition { id: string; label: string; audio: Stereo; crushReport?: unknown }
function measure(file: string, x: Stereo, onsets: number[]) {
  const l = r128(file), pk = peak(x), tp = truePeak(x), r = rms(x);
  return {
    file: file.split('/').pop()!, sha256: sha256(readFileSync(file)),
    samplePeakDbfs: round(ampDb(pk)), truePeakDbtp: round(ampDb(tp)), truePeakDbtpFfmpeg: l.truePeakDb,
    rmsDbfs: round(ampDb(r)), integratedLufs: l.lufs, loudnessRangeLu: l.lra,
    crestDb: round(ampDb(pk) - ampDb(r)), peakToLoudnessDb: round(ampDb(tp) - l.lufs),
    ...transientStats(x, onsets), bandBalanceDb: bandBalance(x),
  };
}

export function build(outDir: string, amount: number) {
  const out = resolve(outDir); if (existsSync(out)) throw new Error(`refusing to write into an existing path: ${out}`);
  const work = mkdtempSync(join(tmpdir(), 'crush-ab-'));
  try {
    mkdirSync(join(work, 'assets')); cpSync(PACK, join(work, 'assets', 'v12-signature'), { recursive: true });
    const dry = engineRender(work, 'dry', project());
    const exSolo = engineRender(work, 'existing-solo', project({ trackFx: EXISTING_FX }));
    const exBus = engineRender(work, 'existing-bus', project({ masterFx: EXISTING_FX }));
    mkdirSync(out, { recursive: true });
    const kickOnsets = KICK_BEATS.map(beatFrame).filter(f => f < FRAMES);
    const opt: CrushOptions = { amount, ceilingDb: CEILING_DBTP, referenceDb: INPUT_PEAK_DB };
    const sources: { id: 'kick' | 'bass' | 'bus'; dry: Stereo; existing: Stereo; onsets: number[] }[] = [
      { id: 'kick', dry: dry.kick, existing: exSolo.kick, onsets: kickOnsets },
      { id: 'bass', dry: dry.bass, existing: exSolo.bass, onsets: [] },
      { id: 'bus', dry: dry.master, existing: exBus.master, onsets: kickOnsets },
    ];
    const report: Record<string, unknown> = {};
    for (const s of sources) {
      // CRUSH input calibration: the dry source at a fixed sample peak, so `amount` means the same on every source.
      const input = normPeak(s.dry, INPUT_PEAK_DB), c = crush(input, opt);
      const conds: Condition[] = [
        { id: 'dry', label: 'A-dry', audio: fadeEnd(s.dry) },
        { id: 'existing', label: 'E-existing-effects', audio: fadeEnd(s.existing) },
        { id: 'crush', label: 'B-crush', audio: fadeEnd(c.audio), crushReport: c.report },
      ];
      // Bring every condition to -1 dBTP, read its loudness there, and use the lowest as the common target.
      const scratch = join(work, 'probe.wav');
      const atCeiling = conds.map(k => { const x = gain(k.audio, dbAmp(CEILING_DBTP) / truePeak(k.audio)); return { x, lufs: lufsOf(x, scratch) }; });
      const target = Math.min(...atCeiling.map(k => k.lufs));
      const files: Record<string, unknown> = {};
      for (const [i, k] of conds.entries()) {
        let x = gain(atCeiling[i]!.x, dbAmp(target - atCeiling[i]!.lufs));
        const base = `crush-ab-${s.id}-${k.label}`, wav = join(out, `${base}.wav`);
        // one refinement after quantisation so the delivered files sit within 0.05 LU of each other
        let clipped = writeWav16(wav, x); const err = target - r128(wav).lufs;
        if (Math.abs(err) > 0.02) { x = gain(x, dbAmp(err)); clipped = writeWav16(wav, x); }
        mp3(wav, join(out, `${base}.mp3`));
        const m = { ...measure(wav, x, s.onsets), clippedSamples: clipped };
        const delivered = !(k.id === 'existing' && s.id !== 'bus'); // the solo existing-effects files are measured, not delivered
        if (!delivered) { rmSync(wav); rmSync(join(out, `${base}.mp3`)); }
        files[k.id] = { ...m, delivered, loudnessAtCeilingLufs: round(atCeiling[i]!.lufs), densityGainVsDryLu: round(atCeiling[i]!.lufs - atCeiling[0]!.lufs), ...(k.crushReport ? { crush: k.crushReport } : {}) };
      }
      report[s.id] = { targetLufs: round(target), files };
    }
    // Stage ablation on the bus: what each CRUSH stage contributes on its own, and what is lost without it.
    const busIn = normPeak(dry.master, INPUT_PEAK_DB), scratch = join(work, 'ablate.wav');
    const dryAt = (() => { const x = fadeEnd(dry.master); return lufsOf(gain(x, dbAmp(CEILING_DBTP) / truePeak(x)), scratch); })();
    const ablation = [
      ['all three stages', {}], ['drive only', { squeeze: false, clip: false }], ['squeeze only', { drive: false, clip: false }], ['clip only', { drive: false, squeeze: false }],
      ['without drive', { drive: false }], ['without squeeze', { squeeze: false }], ['without clip', { clip: false }],
    ].map(([name, sw]) => {
      const x = fadeEnd(crush(busIn, { ...opt, ...(sw as object) }).audio), y = gain(x, dbAmp(CEILING_DBTP) / truePeak(x)), l = lufsOf(y, scratch);
      return { stages: name, densityGainVsDryLu: round(l - dryAt), ...transientStats(y, kickOnsets), bandBalanceDb: bandBalance(y) };
    });
    // The knob: the bus at several amounts, each measured at -1 dBTP.
    const amountSweepBus = [0.25, 0.5, 0.7, 0.85, 1].map(a => {
      const c = crush(busIn, { ...opt, amount: a }), x = fadeEnd(c.audio), y = gain(x, dbAmp(CEILING_DBTP) / truePeak(x));
      return { amount: a, densityGainVsDryLu: round(lufsOf(y, scratch) - dryAt), ...transientStats(y, kickOnsets), maxReductionDb: c.report.maxReductionDb, meanReductionDb: c.report.meanReductionDb, maxShaveDb: c.report.maxShaveDb, clippedShare: c.report.clippedShare };
    });
    // Probes: steady test tones through each processor at the same calibration.
    const viaCrush = (x: Stereo) => crush(x, opt).audio;
    const engineTanh = (x: Stereo): Stereo => { const d = dbAmp(EXISTING_FX[0]!.driveDb!); return [x[0].map(v => Math.tanh(v * d)), x[1].map(v => Math.tanh(v * d))]; };
    const probes = {
      note: 'Steady test tones. A steady tone settles under the clipper once the compressor has closed, so crushDriveAndClipOnly switches the compressor off to keep the tone in the clipper. engineSaturation is the engine saturation formula (tanh at the output rate, src/render/dynamics.ts) at the drive used for the existing-effects condition.',
      aliasing: { crush: aliasingProbe(viaCrush), crushDriveAndClipOnly: aliasingProbe(x => crush(x, { ...opt, squeeze: false }).audio), engineSaturation: aliasingProbe(engineTanh), clean: aliasingProbe(x => x) },
      intermodulation: { crush: intermodProbe(viaCrush), engineSaturation: intermodProbe(engineTanh), clean: intermodProbe(x => x) },
    };
    // Bypass check: amount 0 must return the input bit for bit.
    const z = crush(busIn, { amount: 0 }).audio; let bypassDiff = 0; for (let c = 0; c < 2; c++) for (let i = 0; i < z[c]!.length; i++) bypassDiff = Math.max(bypassDiff, Math.abs(z[c]![i]! - busIn[c]![i]!));
    // One convenience file: the bus switching between A and B every bar (both already loudness-matched and aligned).
    const A = readWav(join(out, 'crush-ab-bus-A-dry.wav')), B = readWav(join(out, 'crush-ab-bus-B-crush.wav')), bar = beatFrame(4), xf = Math.round(0.004 * SR);
    const sw: Stereo = [new Float64Array(bar * 4), new Float64Array(bar * 4)];
    for (let c = 0; c < 2; c++) for (let i = 0; i < bar * 4; i++) {
      const seg = Math.floor(i / bar), pos = i % bar, src = i % (2 * bar); // two bars of pattern, repeated
      let w = seg % 2; // 0 = A, 1 = B
      if (pos < xf && seg > 0) { const t = 0.5 - 0.5 * Math.cos(Math.PI * pos / xf); w = seg % 2 ? t : 1 - t; }
      sw[c]![i] = A[c]![src]! * (1 - w) + B[c]![src]! * w;
    }
    writeWav16(join(out, 'crush-ab-bus-switch-A-B-A-B.wav'), sw); mp3(join(out, 'crush-ab-bus-switch-A-B-A-B.wav'), join(out, 'crush-ab-bus-switch-A-B-A-B.mp3'));
    // Evidence picture: the two bus files (already loudness-matched), whole file and the first beat.
    const pic = (c: string, trim: string) => `aformat=channel_layouts=mono${trim},showwavespic=s=1400x240:colors=${c}:scale=lin`;
    const png = spawnSync(process.env.DAEMONV12_FFMPEG || 'ffmpeg', ['-hide_banner', '-nostdin', '-v', 'error', '-y', '-i', join(out, 'crush-ab-bus-A-dry.wav'), '-i', join(out, 'crush-ab-bus-B-crush.wav'),
      '-filter_complex', `[0:a]${pic('0x7aa2f7', '')}[a];[1:a]${pic('0xf7768e', '')}[b];[0:a]atrim=0:0.46875,${pic('0x7aa2f7', '')}[c];[1:a]atrim=0:0.46875,${pic('0xf7768e', '')}[d];[a][b][c][d]vstack=inputs=4,format=rgb24[o]`,
      '-map', '[o]', '-frames:v', '1', '-fflags', '+bitexact', join(out, 'crush-ab-bus-waveforms.png')], { encoding: 'utf8' });
    if (png.status !== 0) throw new Error(`ffmpeg waveform picture: ${png.stderr}`);
    const ffv = spawnSync(process.env.DAEMONV12_FFMPEG || 'ffmpeg', ['-hide_banner', '-version'], { encoding: 'utf8' }).stdout.split('\n')[0];
    writeFileSync(join(out, 'REPORT.json'), json({
      schema: 'daemonv12.fable-lab.crush-ab/1', amount, bpm: BPM, seconds: SECONDS, frames: FRAMES, ceilingDbtp: CEILING_DBTP, crushInputPeakDbfs: INPUT_PEAK_DB,
      method: 'Each source: dry (engine, no effects), existing (engine saturation + compressor), crush (dry through DAEMON//CRUSH). All three brought to the same integrated loudness, the lowest any of them reaches at -1 dBTP, with one gain per file. densityGainVsDryLu is how much louder a condition is than dry when both peak at -1 dBTP.',
      existingEffects: EXISTING_FX, node: process.version, ffmpeg: ffv,
      sources: report, ablationBus: ablation, amountSweepBus, probes, bypass: { amountZeroMaxAbsDifference: bypassDiff },
      waveformPicture: 'crush-ab-bus-waveforms.png: rows 1-2 the whole five seconds (blue A dry, red B crush), rows 3-4 the first beat (468.75 ms). Same vertical scale; the files are at the same integrated loudness.',
      switchFile: 'crush-ab-bus-switch-A-B-A-B: bar 1 A (dry), bar 2 B (crush), bar 3 A, bar 4 B; 4 ms crossfades on the bar lines; 7.5 s.',
      hashes: { 'crush.ts': sha256(readFileSync(join(here, 'crush.ts'))), 'measure.ts': sha256(readFileSync(join(here, 'measure.ts'))), 'ab.ts': sha256(readFileSync(fileURLToPath(import.meta.url))) },
    }));
    writeFileSync(join(out, 'SHA256SUMS'), readdirSync(out).filter(f => f !== 'SHA256SUMS').sort().map(f => `${sha256(readFileSync(join(out, f)))}  ${f}\n`).join(''));
    return out;
  } finally { rmSync(work, { recursive: true, force: true }); }
}
if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const [dir, ...rest] = process.argv.slice(2), i = rest.indexOf('--amount'), amount = i >= 0 ? Number(rest[i + 1]) : 0.7;
  if (!dir || !(amount > 0 && amount <= 1)) { console.error('usage: node fable-lab/crush/ab.ts NEW_DIR [--amount 0.7]'); process.exit(2); }
  console.log(build(dir, amount));
}
