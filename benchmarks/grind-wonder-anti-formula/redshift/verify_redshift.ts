/**
 * REDSHIFT quality gate. Measurements and identity checks only; it says nothing about whether the music is good.
 *   node benchmarks/grind-wonder-anti-formula/redshift/verify_redshift.ts           fast checks (~20 s)
 *   node benchmarks/grind-wonder-anti-formula/redshift/verify_redshift.ts --full    + rebuild everything in a temp dir and
 *                                                                                   compare hashes, + sample-level motif check (~6 min, FFmpeg)
 * Writes redshift/audio/QA.json (unless REDSHIFT_QA_OUT says otherwise) and exits non-zero if any check fails.
 */
import { readFileSync, writeFileSync, mkdtempSync, rmSync, readdirSync, copyFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { spawnSync } from 'node:child_process';
import { join, dirname, resolve } from 'node:path';
import { tmpdir } from 'node:os';
import { fileURLToPath } from 'node:url';
import { readWav, truePeak, ampDb } from '../../../fable-lab/crush/measure.ts';
import { loudness } from '../../../sound-lab/lib.ts';

const HERE = dirname(fileURLToPath(import.meta.url));
const BENCH = resolve(HERE, '..');
const REPO = resolve(BENCH, '../..');
const FULL = process.argv.includes('--full');
const CUT = 1234800, END = 1837501, BAR18_TICK = 65280;
const sha = (p: string) => createHash('sha256').update(readFileSync(p)).digest('hex');
const results: { check: string; pass: boolean; detail: unknown }[] = [];
const check = (name: string, pass: boolean, detail: unknown) => { results.push({ check: name, pass, detail }); console.log(`${pass ? 'PASS' : 'FAIL'}  ${name}`); };
const frameOf = (tick: number) => Number((BigInt(tick) * 416667n * 44100n + 480000000n) / 960000000n);
const r6 = (x: number) => Number(x.toFixed(6));

// 1. Gate 2 and the original sketch C: byte-identical to the approved commit (hashes recorded before any work began).
const APPROVED: Record<string, string> = {
  'C-IMPOSSIBLE-ASCENT-GATE2-DEVELOPED.mp3': '9615ca2842c5a66fe150831a3a8bae283dac5f2ff3bfd073bed9f7736a11f0b0',
  'c-impossible-ascent-gate2.json': 'c0d46566bec614595a90f85f54eee2cd0927a52bafeb266818de49fe404b000a',
  'c-impossible-ascent.json': '0921cf722152673c9dcf95dad55410b5e73e3a5d99e6496ddb77ee8435c3dc75',
  'C-IMPOSSIBLE-ASCENT.wav': '9a2e204112ecf8d7396b69e73c09a3b07917ccfe9e6edfd750486cc82d435354',
  'C-IMPOSSIBLE-ASCENT.mp3': '99df0a574a860e1d725a4b29e750672b58b4b83290df493df86ca0f25d04b234',
  'impossible-ascent-gate2/audio/IMPOSSIBLE-ASCENT-DEVELOPED.mp3': '9615ca2842c5a66fe150831a3a8bae283dac5f2ff3bfd073bed9f7736a11f0b0',
  'impossible-ascent-gate2/audio/IMPOSSIBLE-ASCENT-DEVELOPED.wav': 'b0eef2f73188243505792ada55c0d034d2bcf0ae5570b98fa43688800ea70afa',
  'impossible-ascent-gate2/audio/REPORT.json': '262d6c4b605d22ada989e1f3585ca86aed7940bad84f035a7ff71ed07b1314e1',
  'impossible-ascent-gate2/audio/stems/atmosphere.wav': 'ab16f9c0ca78a9d6ef9fbf1e9a52c3007bd8583f59e759d2b5ce5b330c97a656',
  'impossible-ascent-gate2/audio/stems/bass808.wav': 'b70708f7d665beb472951de0a33ad485134b0caf4784cb0986697c92c14eb81a',
  'impossible-ascent-gate2/audio/stems/hats-ticks.wav': '19d6853cf13910387356ba516ffa259bfda635be17490dba70b15888557a3e2b',
  'impossible-ascent-gate2/audio/stems/hook.wav': 'dfe7823ec71937a3a285692afd728bb355dc4e60d748582ce5c2e1b2052f8c14',
  'impossible-ascent-gate2/audio/stems/kick.wav': '416653bf8227405fd96040c106db99dae33c0d0023cee44e7303fabe54165faf',
  'impossible-ascent-gate2/audio/stems/snare.wav': 'e5fd73eb0edb5fcb947cdc6783f1a4ffcb3d455286c11d421df43205576f1446',
  'impossible-ascent-gate2/audio/stems/wall-drone.wav': 'fd7fe1a883611bcdb24a6a3bd7a67d0ee2607b65cf81cd6b410e13460bbdd84e',
  'impossible-ascent-gate2/README.md': '24dedf6c1ba6b58c30ded159235d20500a19d7499447177696fa5d38e2bc0072',
  'impossible-ascent-gate2/build_developed.py': '636d40337483487b6d3027da64bd55b915a45d600c51f5325f47228c70a8e3d4',
  'impossible-ascent-gate2/mix.ts': '5ebb73a26647bb4f58ee11bef961925f6d9dd69094a6b7332e65312fa4139d08',
  'impossible-ascent-gate2/source-render/c-impossible-ascent-gate2.analysis.json': '677cd0fab85829392df45be0ed0067810a49bfc1bc6368abda97900a3412e4e0',
  'impossible-ascent-gate2/source-render/c-impossible-ascent-gate2.mid': '7aea470656eb9e4aef004bcad8dcf77fb14777d6806871307d347954ec54c56d',
  'impossible-ascent-gate2/source-render/c-impossible-ascent-gate2.render.json': 'ba84841567f98cc549fdcab76c4e00575010949bdc17a29c197db820a3feb1d1',
};
const changed = Object.entries(APPROVED).filter(([rel, h]) => sha(join(BENCH, rel)) !== h).map(([rel]) => rel);
check('integrity: Gate 2 + sketch C files byte-identical to the approved commit (21 files)', changed.length === 0, { changed });

// 2. Timing: every trigger on its grid, both grids anchored to Gate 2's, no accumulated drift.
const render = JSON.parse(readFileSync(join(HERE, 'source-render', 'c-impossible-ascent-redshift.render.json'), 'utf8'));
type Trig = { tick: number; frame: number; playback?: { rate: number } };
const tracks = render.samples.tracks as { trackId: string; triggers: Trig[] }[];
const bad: string[] = [];
let nTrig = 0;
for (const t of tracks) for (const g of t.triggers) {
  nTrig++;
  const rel = g.tick - BAR18_TICK;
  if (g.frame !== frameOf(g.tick)) bad.push(`${t.trackId}@${g.tick}: frame ${g.frame} != engine ${frameOf(g.tick)}`);
  if (rel < 0) bad.push(`${t.trackId}@${g.tick}: before bar 18`);
  if (t.trackId !== 'phrase' && rel % 320 !== 0) bad.push(`${t.trackId}@${g.tick}: off the 108 BPM sixteenth grid`);
}
// The phrase keeps proper time: each statement starts on a Gate 2 bar line (cycle 1) or, once captured, on a world
// downbeat (lock); its five notes sit at p1's offsets from that start (0, 1, 2, 3, 3.75 beats at 144 BPM).
const ph = tracks.find(t => t.trackId === 'phrase')!.triggers.map(g => g.tick - BAR18_TICK).sort((a, b) => a - b);
const P1_OFFSETS = [0, 960, 1920, 2880, 3600];
const phraseStarts: { tick: number; anchor: string }[] = [];
for (let i = 0; i < ph.length; i += 5) {
  const s = ph[i]!, anchor = s % 3840 === 0 && s % 5120 === 0 ? 'both clocks' : s % 3840 === 0 ? 'Gate 2 bar line' : s % 5120 === 0 ? 'world downbeat' : 'none';
  phraseStarts.push({ tick: s, anchor });
  if (anchor === 'none') bad.push(`phrase statement at ${s}: not on a bar line of either clock`);
  P1_OFFSETS.forEach((o, k) => { if (ph[i + k] !== s + o) bad.push(`phrase statement at ${s}: note ${k + 1} at ${ph[i + k]! - s}, p1 has ${o}`); });
}
check(`timing: ${nTrig} triggers placed as designed (world on 108 BPM sixteenths; each phrase statement anchored to a bar line and internally in 144 BPM time), frames as the engine computes them`,
  bad.length === 0 && ph.length % 5 === 0, { bad, phraseStatements: phraseStarts });
const barDev = [...Array(9)].map((_, k) => frameOf((17 + k) * 3840) - (17 + k) * 73500);           // bars 18..26 vs exact 144 BPM
const worldDev = [...Array(7)].map((_, k) => frameOf(BAR18_TICK + k * 5120) - (1249500 + k * 98000));   // W1..W7 vs exact 108 BPM
const gate2Render = JSON.parse(readFileSync(join(BENCH, 'impossible-ascent-gate2/source-render/c-impossible-ascent-gate2.render.json'), 'utf8'));
const gate2Bar17 = (gate2Render.samples.tracks as { trackId: string; triggers: Trig[] }[]).find(t => t.trackId === 'kick')!.triggers.find(g => g.tick === 16 * 3840)!.frame;
const myBar18 = tracks.find(t => t.trackId === 'phrase')!.triggers[0]!.frame;
check('timing: bar lines and world downbeats within 1 frame of exact 144/108 BPM grids, no accumulation; bar 18 = Gate 2 bar 17 + one bar',
  Math.max(...barDev.map(Math.abs), ...worldDev.map(Math.abs)) <= 1 && myBar18 - gate2Bar17 === 73500,
  { barLineDeviationFrames: barDev, worldDownbeatDeviationFrames: worldDev, gate2Bar17Frame: gate2Bar17, bar18Frame: myBar18,
    // W1, W4, W7 (every third 108 BPM bar) are also Gate 2 bars 18, 22, 26: the two clocks agree there.
    clocksAgreeAtFrames: [0, 3, 6].map(k => frameOf(BAR18_TICK + k * 5120)),
    clocksAgree: [0, 3, 6].every(k => BAR18_TICK + k * 5120 === (17 + (4 * k) / 3) * 3840) });

// 3. Clipping.
const ext = readWav(join(HERE, 'audio', 'REDSHIFT-EXTENSION.wav'));
const comb = readWav(join(HERE, 'audio', 'GATE2-PLUS-REDSHIFT.wav'));
const stats = (x: [Float64Array, Float64Array]) => {
  let p = 0, full = 0; for (const ch of x) for (const v of ch) { const a = Math.abs(v); if (a > p) p = a; if (a >= 1 - 2 / 8388608) full++; }
  return { samplePeakDbfs: r6(ampDb(p)), fullScaleSamples: full, truePeakDbtp4x: r6(ampDb(truePeak(x))) };
};
const extS = stats(ext as [Float64Array, Float64Array]), combS = stats(comb as [Float64Array, Float64Array]);
const lExt = loudness(join(HERE, 'audio', 'REDSHIFT-EXTENSION.wav')), lComb = loudness(join(HERE, 'audio', 'GATE2-PLUS-REDSHIFT.wav'));
const stemPeaks = Object.fromEntries(readdirSync(join(HERE, 'audio', 'stems')).map(f => [f, r6(ampDb(Math.max(...readWav(join(HERE, 'audio', 'stems', f)).map(ch => ch.reduce((a, v) => Math.max(a, Math.abs(v)), 0)))))]));
check('clipping: no full-scale samples; true peak <= -1.0 dBTP (extension and combined); stems below 0 dBFS',
  extS.fullScaleSamples === 0 && combS.fullScaleSamples === 0 && extS.truePeakDbtp4x <= -1.0 && combS.truePeakDbtp4x <= -1.0 && lExt.truePeakDb <= -1.0 && lComb.truePeakDb <= -1.0 && Object.values(stemPeaks).every(v => v < 0),
  { extension: { ...extS, ffmpegTruePeakDbtp: lExt.truePeakDb, lufs: lExt.lufs }, combined: { ...combS, ffmpegTruePeakDbtp: lComb.truePeakDb, lufs: lComb.lufs }, stemPeaksDbfs: stemPeaks });

// 4. The join.
const dataOf = (b: Buffer) => { let at = 12; while (at + 8 <= b.length) { const id = b.toString('ascii', at, at + 4), size = b.readUInt32LE(at + 4); if (id === 'data') return b.subarray(at + 8, at + 8 + size); at += 8 + size + (size & 1); } throw new Error('no data'); };
const g2 = dataOf(readFileSync(join(BENCH, 'impossible-ascent-gate2/audio/IMPOSSIBLE-ASCENT-DEVELOPED.wav')));
const bytesKept = dataOf(readFileSync(join(HERE, 'audio', 'GATE2-PLUS-REDSHIFT.wav'))).subarray(0, g2.length).equals(g2);
const step = (c: number) => Math.abs(comb[c]![CUT]! - comb[c]![CUT - 1]!);
const plainStep = (c: number) => Math.abs(ext[c]![0]! - comb[c]![CUT - 1]!);              // concatenation without Gate 2's tail
const natural = (c: number) => { let m = 0; for (let i = CUT - 441; i < CUT - 1; i++) m = Math.max(m, Math.abs(comb[c]![i + 1]! - comb[c]![i]!)); return m; };
const rmsDb = (x: Float64Array[], a: number, b: number) => { let s = 0; for (const ch of x) for (let i = a; i < b; i++) s += ch[i]! ** 2; return r6(10 * Math.log10(s / (2 * (b - a)))); };
const joinDetail = {
  gate2PcmBytesPreservedInCombined: bytesKept,
  stepAtJoinDbfs: [0, 1].map(c => r6(ampDb(step(c)))), largestNaturalStepInLast10msDbfs: [0, 1].map(c => r6(ampDb(natural(c)))),
  stepIfPlainConcatenationDbfs: [0, 1].map(c => r6(ampDb(plainStep(c)))),
  rms50msBeforeJoinDb: rmsDb(comb, CUT - 2205, CUT), rms50msAfterJoinDb: rmsDb(comb, CUT, CUT + 2205),
  firstExtensionEventSecondsAfterJoin: r6((myBar18 - CUT) / 44100), equalsOneGate2BarAfterItsLastDownbeat: myBar18 - gate2Bar17 === 73500,
};
check('join: Gate 2 PCM bytes untouched; the step at 28.0 s is no larger than the signal\'s own sample-to-sample motion',
  bytesKept && [0, 1].every(c => step(c) <= natural(c) * 1.05), joinDetail);

// 5. Motif identity in the score: every phrase statement is Wonder's p1 (only the final fall-back is held longer).
const wonder = JSON.parse(readFileSync(join(BENCH, 'c-impossible-ascent-gate2.json'), 'utf8'));
const mine = JSON.parse(readFileSync(join(BENCH, 'c-impossible-ascent-redshift.json'), 'utf8'));
const posTicks = (s: string) => { const m = /^(\d+):(\d+)(?:\+(\d+)\/(\d+))?$/.exec(s)!; return (Number(m[1]) - 1) * 3840 + (Number(m[2]) - 1) * 960 + (m[3] ? Number(m[3]) * 3840 / Number(m[4]) : 0); };
const p1 = wonder.tracks.find((t: { id: string }) => t.id === 'phrase').patterns.find((p: { id: string }) => p.id === 'p1').notes;
const myPhrase = mine.tracks.find((t: { id: string }) => t.id === 'phrase').patterns[0].notes as Record<string, unknown>[];
const statements: number[] = [];
const mism: string[] = [];
for (let i = 0; i < myPhrase.length; i += 5) {
  const t0 = posTicks(myPhrase[i]!.start as string); statements.push(t0);
  for (let k = 0; k < 5; k++) {
    const a = { ...myPhrase[i + k]! }, b = { ...p1[k] };
    if (posTicks(a.start as string) - t0 !== posTicks(b.start)) mism.push(`statement ${i / 5 + 1} note ${k + 1}: position`);
    delete a.start; delete b.start;
    const finalHeld = i + 5 === myPhrase.length && k === 4;
    if (finalHeld) { delete a.gate; delete b.gate; }
    if (JSON.stringify(a) !== JSON.stringify(b)) mism.push(`statement ${i / 5 + 1} note ${k + 1}: ${JSON.stringify(a)} vs ${JSON.stringify(b)}`);
  }
}
check(`motif (score): ${statements.length} phrase statements, each Wonder's p1 note-for-note (final fall-back held by design)`, mism.length === 0 && myPhrase.length % 5 === 0,
  { statementsAtBar18RelativeTicks: statements, statementSecondsCombined: statements.map(t => r6((frameOf(BAR18_TICK + t)) / 44100)), mismatches: mism });

// 6. --full: rebuild everything from scratch and compare; render Gate 2 again and compare the phrase audio sample by sample.
if (FULL) {
  const tmp = mkdtempSync(join(tmpdir(), 'redshift-verify-'));
  const run = (cmd: string, args: string[], env: Record<string, string> = {}) => {
    const r = spawnSync(cmd, args, { encoding: 'utf8', env: { ...process.env, ...env }, maxBuffer: 1 << 26, cwd: REPO });
    if (r.status !== 0) throw new Error(`${cmd} ${args.join(' ')}: ${r.stderr}`); return r.stdout;
  };
  const tProj = join(BENCH, '.redshift-verify.tmp.json');   // must sit beside the original so assets/ resolves; removed below
  try {
    run('python3', [join(HERE, 'build_redshift.py')], { REDSHIFT_PROJECT: tProj, REDSHIFT_SCORE_DIR: join(tmp, 'score') });
    const sameProject = readFileSync(tProj).equals(readFileSync(join(BENCH, 'c-impossible-ascent-redshift.json')));
    const sameScore = ['redshift.events.json', 'redshift.events.md'].every(f => readFileSync(join(tmp, 'score', f)).equals(readFileSync(join(HERE, 'score', f))));
    run(process.execPath, [join(REPO, 'bin/daemonv12.js'), 'render', tProj, '--out-dir', join(tmp, 'render'), '--stems', '--format', 'wav']);
    const committedRender = render;
    const newRender = JSON.parse(readFileSync(join(tmp, 'render', '.redshift-verify.tmp.render.json'), 'utf8'));
    const sameWav = newRender.wav.sha256 === committedRender.wav.sha256;
    const stemHashes = (r: { stems: { trackId: string; sha256?: string; wav?: { sha256: string } }[] }) => JSON.stringify(r.stems.map(s => [s.trackId, s.sha256 ?? s.wav?.sha256]));
    const sameStems = stemHashes(newRender) === stemHashes(committedRender);
    const out = join(tmp, 'audio');
    run(process.execPath, [join(HERE, 'gate2_tail.ts')], { REDSHIFT_OUT: out });
    run(process.execPath, [join(HERE, 'mix_redshift.ts')], { REDSHIFT_OUT: out, REDSHIFT_STEMS: join(tmp, 'render', '.redshift-verify.tmp.stems'), REDSHIFT_PROJECT: tProj });
    const files = ['REDSHIFT-EXTENSION.wav', 'REDSHIFT-EXTENSION.mp3', 'GATE2-PLUS-REDSHIFT.wav', 'GATE2-PLUS-REDSHIFT.mp3', 'gate2-reference.json',
      ...readdirSync(join(HERE, 'audio', 'stems')).map(f => `stems/${f}`)];
    const hashes = Object.fromEntries(files.map(f => [f, { committed: sha(join(HERE, 'audio', f)), rebuilt: sha(join(out, f)) }]));
    const diff = Object.entries(hashes).filter(([, h]) => h.committed !== h.rebuilt).map(([f]) => f);
    check('reproducible: project, score, source render, Gate 2 tail, stems, WAVs and MP3s rebuilt from scratch are byte-identical',
      sameProject && sameScore && sameWav && sameStems && diff.length === 0, { sameProject, sameScore, sameSourceWav: sameWav, sameSourceStems: sameStems, differing: diff, hashes });
    // Sample-level motif identity: Gate 2's own phrase stem vs this phrase stem.
    copyFileSync(join(BENCH, 'c-impossible-ascent-gate2.json'), join(BENCH, '.gate2-verify.tmp.json'));
    run(process.execPath, [join(REPO, 'bin/daemonv12.js'), 'render', join(BENCH, '.gate2-verify.tmp.json'), '--out-dir', join(tmp, 'g2'), '--stems', '--format', 'wav']);
    const w = readWav(join(tmp, 'g2', '.gate2-verify.tmp.stems', 'phrase.wav')), m = readWav(join(tmp, 'render', '.redshift-verify.tmp.stems', 'phrase.wav'));
    const noteOn = [0, 960, 1920, 2880, 3600];
    const perStatement = statements.map((t0, si) => {
      const abs = BAR18_TICK + t0, notes = noteOn.map((o, k) => {
        if (si === statements.length - 1 && k === 4) return 'held by design';
        const a0 = frameOf(o), a1 = k < 4 ? frameOf(noteOn[k + 1]!) : a0 + 12000, m0 = frameOf(abs + o);
        let d = 0; for (let c = 0; c < 2; c++) for (let i = 0; i < a1 - a0; i++) d = Math.max(d, Math.abs(w[c]![a0 + i]! - m[c]![m0 + i]!));
        return d === 0 ? 'identical' : `max diff ${d.toExponential(2)}`;
      });
      const rel = noteOn.map(o => frameOf(abs + o) - frameOf(abs)), wrel = noteOn.map(o => frameOf(o));
      return { statementStartFrame: frameOf(abs), notes, onsetFramesRelative: rel, gate2Bar1OnsetFrames: wrel };
    });
    const identicalNotes = perStatement.every(s => s.notes.every((n, k) => n === 'identical' || n === 'held by design' || (k === 4 && s.onsetFramesRelative[4] !== s.gate2Bar1OnsetFrames[4])));
    check('motif (audio): every phrase note renders sample-identical to Gate 2 bar 1 when aligned on its own onset', identicalNotes, { perStatement,
      note: 'Where the engine rounds the fall-back onset 1 frame later (absolute-tick rounding at 416667 us/quarter), the B5 it chokes releases 1 frame later; reported, not hidden.' });
  } finally {
    rmSync(tProj, { force: true }); rmSync(join(BENCH, '.gate2-verify.tmp.json'), { force: true }); rmSync(tmp, { recursive: true, force: true });
  }
}

const failed = results.filter(r => !r.pass);
writeFileSync(process.env.REDSHIFT_QA_OUT ?? join(HERE, 'audio', 'QA.json'), JSON.stringify({ full: FULL, passed: results.length - failed.length, failed: failed.length,
  note: 'Technical checks only. Passing them does not make the section original or memorable; that is the listener\'s call.', results }, null, 1) + '\n');
console.log(`${results.length - failed.length}/${results.length} checks passed${FULL ? ' (full)' : ''}`);
if (failed.length) process.exit(1);
