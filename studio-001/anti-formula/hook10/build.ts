/**
 * Anti-Formula Gate 1 listening proof: HOOK//10 A / B1 / C on one render path.
 *
 *   node studio-001/anti-formula/hook10/build.ts NEW_DIR        (needs FFmpeg with libmp3lame; about 30 s of CPU)
 *
 * It reuses the unchanged HOOK//10 build (`studio-001/scores/hook10/build.ts`: rack render, tail fold, one gain to
 * -16 LUFS) for every version, so C is made exactly the way A and B1 were made.
 *   - A and B1 are rebuilt in a scratch directory and compared, file by file, with the committed v0.9 proof. They
 *     are not written again: the listening files for A and B1 stay the committed ones in proofs/v09-motif/hook10.
 *   - The score/2 transcription of A (the Anti-Formula source) is rendered and its master compared with A's.
 *   - C (source + plan, applied by the Anti-Formula layer) is rendered ONCE into NEW_DIR with its ledger.
 * The manifest holds measurements and hashes only. Nothing in it says which version sounds better.
 */
import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { sha256 } from '../../rack/frozen.ts';
import { ffmpegVersion } from '../../rack/cli.ts';
import { buildVersion, VERSIONS, LOOP_FRAMES, TARGET_LUFS, CEILING_DBTP } from '../../scores/hook10/build.ts';
import { renderScore } from '../../rack/render.ts';
import { normalizeAnyScore } from '../../motif/index.ts';
import { applyAntiFormula } from '../apply.ts';
import { json } from '../cli.ts';

const here = dirname(fileURLToPath(import.meta.url)), V09 = resolve(here, '../../../proofs/v09-motif/hook10');
const REL = '../../anti-formula/hook10'; // buildVersion resolves score files from studio-001/scores/hook10
export const C_VERSION = { id: 'C', file: `${REL}/hook10-c.score.json`, label: 'C-anti-formula', condition: 'B' as const };
const SOURCE_VERSION = { id: 'A-as-motifs', file: `${REL}/hook10-literal.score.json`, label: 'A-as-motifs', condition: 'B' as const };
const read = (f: string) => JSON.parse(readFileSync(f, 'utf8')) as unknown;
const db1 = (x: number) => (x > 0 ? +(20 * Math.log10(x)).toFixed(1) : null);

/**
 * Signal evidence of what the one decision changed, from the rack's own stems (before the room, the fold and the
 * loudness gain): A (through its transcription) and C are rendered and compared sample by sample.
 * Per part: whether the stem is identical, and the first beat where it is not. For the voice: its level in every
 * quarter beat of bars 3 and 4 in A and in C. Levels are RMS in dBFS; `null` is digital silence.
 */
export async function stemComparison() {
  const stems = async (file: string) => (await renderScore(normalizeAnyScore(read(join(here, file))), () => {})).parts;
  const a = await stems('hook10-literal.score.json'), c = await stems('hook10-c.score.json'), beat = LOOP_FRAMES / 16;
  const parts = a.map((p, i) => {
    const x = p.audio, y = c[i]!.audio; let first = -1;
    for (let n = 0; n < x[0].length && first < 0; n++) if (x[0][n] !== y[0][n] || x[1][n] !== y[1][n]) first = n;
    return { part: p.part.id, identicalToA: first < 0, firstDifferingFrame: first < 0 ? null : first, firstDifferingBeat: first < 0 ? null : +(first / beat).toFixed(4) };
  });
  const v = a.findIndex(p => p.part.id === 'voice'), level = (x: Float64Array, from: number) => { let t = 0; const s = Math.round(from * beat), e = Math.round((from + 0.25) * beat); for (let n = s; n < e; n++) t += x[n]! * x[n]!; return db1(Math.sqrt(t / (e - s))); };
  const voiceLevelDb = Array.from({ length: 32 }, (_, k) => ({ beat: 8 + k / 4, a: level(a[v]!.audio[0], 8 + k / 4), c: level(c[v]!.audio[0], 8 + k / 4) }));
  const bar4 = voiceLevelDb.filter(q => q.beat >= 12).map(q => Math.abs(q.a! - q.c!));
  return { method: 'stems rendered by the rack from hook10-literal.score.json (identical to A) and hook10-c.score.json; left channel levels, RMS dBFS per quarter beat', parts, voiceLevelDb,
    voiceBar4MaxLevelDifferenceDb: +Math.max(...bar4).toFixed(1),
    note: 'The cadence in bar 4 has the same notes in A and C and the voice sings them at nearly the same level, but not sample for sample: the voice engine carries its phase and noise state on from what it sang before. Whether that is audible is for the listener.' };
}

if (process.argv[1] && resolve(process.argv[1]) === resolve(fileURLToPath(import.meta.url))) {
  const outArg = process.argv[2];
  if (!outArg) throw new Error('usage: node studio-001/anti-formula/hook10/build.ts NEW_DIR');
  const out = resolve(outArg), log = (s: string) => console.error(`  ${s}`);
  if (existsSync(out)) throw new Error(`refusing to write into an existing path: ${out}`);
  if (!ffmpegVersion()) throw new Error('FFmpeg with libmp3lame is required');
  // the committed C score and ledger must be what the committed source and plan produce: nothing is rendered from a stale file
  const applied = applyAntiFormula(read(join(here, 'hook10-literal.score.json')), read(join(here, 'hook10-c.plan.json')));
  for (const [file, want] of [['hook10-c.score.json', json(applied.score)], ['hook10-c.ledger.json', json(applied.ledger)]] as const)
    if (readFileSync(join(here, file), 'utf8') !== want) throw new Error(`${file} is stale: regenerate it with node studio-001/anti-formula/cli.ts apply`);

  const committed = read(join(V09, 'MANIFEST.json')) as { ffmpeg: string; versions: { id: string; master: { file: string; gainDb: number; loudness: unknown }; files: Record<string, { sha256: string }> }[] };
  const sameTools = committed.ffmpeg === ffmpegVersion(), scratch = mkdtempSync(join(tmpdir(), 'af-hook10-'));
  const baseline: Record<string, unknown>[] = [];
  let a: Awaited<ReturnType<typeof buildVersion>> | undefined;
  try {
    for (const id of ['A', 'B1']) {
      console.error(`== ${id} (rebuilt to check the baseline; not written)`);
      const built = await buildVersion(VERSIONS.find(v => v.id === id)!, scratch, log), want = committed.versions.find(v => v.id === id)!;
      const differing = Object.entries(built.files).filter(([f, d]) => want.files[f]?.sha256 !== d.sha256).map(([f]) => f);
      if (sameTools && differing.length) throw new Error(`${id}: rebuilt files differ from the committed v0.9 proof: ${differing.join(', ')}`);
      baseline.push({ id, committedIn: 'proofs/v09-motif/hook10', master: want.master.file, masterSha256: want.files[want.master.file]!.sha256, filesCompared: Object.keys(built.files).length, rebuiltIdentical: differing.length === 0, loudness: want.master.loudness });
      if (id === 'A') a = built;
    }
    console.error('== A as motifs (the Anti-Formula source; not written)');
    const lit = await buildVersion(SOURCE_VERSION, scratch, log), litSha = lit.files[lit.master.file]!.sha256, aSha = a!.files[a!.master.file]!.sha256;
    if (litSha !== aSha) throw new Error('the score/2 transcription of A does not render to the same master as A');
    baseline.push({ id: 'A-as-motifs', scoreFile: 'studio-001/anti-formula/hook10/hook10-literal.score.json', masterSha256: litSha, identicalToMasterOf: 'A' });

    console.error('== C (rendered once)');
    mkdirSync(out, { recursive: true });
    const c = await buildVersion(C_VERSION, out, log), { gate, ...rest } = c, files = { ...c.files };
    for (const [name, from] of [['C/ledger.json', 'hook10-c.ledger.json'], ['C/plan.json', 'hook10-c.plan.json'], ['C/source.score.json', 'hook10-literal.score.json']] as const) {
      const bytes = readFileSync(join(here, from)); writeFileSync(join(out, name), bytes); files[name] = { sha256: sha256(bytes), bytes: bytes.length };
    }
    const version = { ...rest, scoreFile: 'studio-001/anti-formula/hook10/hook10-c.score.json', planFile: 'studio-001/anti-formula/hook10/hook10-c.plan.json', sourceFile: 'studio-001/anti-formula/hook10/hook10-literal.score.json',
      ledger: { file: 'C/ledger.json', intervention: `${applied.ledger.intervention.kind} ${applied.ledger.intervention.target}: ${applied.ledger.intervention.transform}`, notes: applied.ledger.unchanged.notes, payoff: applied.ledger.payoff },
      stemComparisonWithA: await stemComparison(),
      v09StructureGate: { ...gate, note: 'The v0.9 HOOK//10 gate asks for no bar repeated more than once in a row in any part. C keeps the bass, clock and mallet pocket of A on purpose, so that one check fails by design. It is recorded, not hidden, and it is not a listening result.' },
      files };
    const manifest = {
      schema: 'daemonv12.anti-formula.gate1.manifest/1', benchmark: 'HOOK//10 A / B1 / C',
      note: 'Measurements, hashes and a record of how the files were made. Nothing here says which version sounds better: that is the producer\'s listening decision, and all three may be rejected.',
      candidates: 'Exactly one C was composed and rendered. No alternative C was rendered, auditioned or discarded.',
      targetLufs: TARGET_LUFS, ceilingDbtp: CEILING_DBTP, loopFrames: LOOP_FRAMES, node: process.version, ffmpeg: ffmpegVersion(), sameFfmpegAsV09Proof: sameTools, baseline, versions: [version],
    };
    writeFileSync(join(out, 'MANIFEST.json'), json(manifest));
    writeFileSync(join(out, 'SHA256SUMS'), Object.entries(files).map(([f, d]) => `${d.sha256}  ${f}`).sort((x, y) => x.slice(66).localeCompare(y.slice(66))).join('\n') + '\n');
    console.log(`C   ${c.master.loudness.lufs} LUFS  ${c.master.loudness.truePeakDb} dBTP  technical ${Object.values(c.technicalGate).every(Boolean) ? 'PASS' : 'FAIL'}  baseline A/B1 rebuilt identical: ${baseline.slice(0, 2).every(b => b.rebuiltIdentical)}`);
  } finally { rmSync(scratch, { recursive: true, force: true }); }
}
