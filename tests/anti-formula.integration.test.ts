// Anti-Formula Gate 1: audio-level checks of the HOOK//10 A / B1 / C proof. The committed C master matches its
// manifest; A and B1 are the committed v0.9 masters, untouched; C differs from A only in the voice and only from
// the withheld notes on; rebuilding C reproduces the committed bytes. FFmpeg-dependent checks skip without it.
import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { sha256, ffmpegVersion } from '../studio-001/rack/index.ts';
import { seamCheck, buildVersion } from '../studio-001/scores/hook10/build.ts';
import { C_VERSION, stemComparison } from '../studio-001/anti-formula/hook10/build.ts';
import type { Ledger } from '../studio-001/anti-formula/index.ts';

const read = (f: string) => JSON.parse(readFileSync(f, 'utf8')) as unknown;
const PROOF = 'proofs/anti-formula-gate1/hook10', V09 = 'proofs/v09-motif/hook10', SRC = 'studio-001/anti-formula/hook10';
interface Manifest {
  ffmpeg: string; candidates: string; baseline: { id: string; master?: string; masterSha256: string; rebuiltIdentical?: boolean; identicalToMasterOf?: string }[];
  versions: { id: string; scoreFile: string; scoreSha256: string; master: { file: string; frames: number; loudness: { lufs: number; truePeakDb: number }; clipped: number };
    loop: { foldMaxAbsError: number; tailFullyDecayed: boolean; seam: ReturnType<typeof seamCheck> }; technicalGate: Record<string, boolean>; v09StructureGate: { pass: boolean; checks: Record<string, boolean> };
    stemComparisonWithA: Awaited<ReturnType<typeof stemComparison>>; files: Record<string, { sha256: string; bytes: number }> }[];
}
const manifest = read(`${PROOF}/MANIFEST.json`) as Manifest, c = manifest.versions[0]!;

test('gate 1 proof: the committed C master matches its manifest, hashes and loop verification', () => {
  assert.deepEqual(manifest.versions.map(v => v.id), ['C'], 'exactly one C'); assert.match(manifest.candidates, /^Exactly one C was composed and rendered/);
  const sums = readFileSync(`${PROOF}/SHA256SUMS`, 'utf8').trim().split('\n').map(l => [l.slice(66), l.slice(0, 64)] as const);
  assert.deepEqual(sums.map(s => s[0]).sort(), Object.keys(c.files).sort());
  for (const [file, want] of sums) { assert.equal(sha256(readFileSync(join(PROOF, file))), want, file); assert.equal(c.files[file]!.sha256, want, file); }
  assert.equal(c.scoreFile, `${SRC}/hook10-c.score.json`); assert.equal(sha256(readFileSync(c.scoreFile)), c.scoreSha256, 'built from the committed C score');
  for (const [copy, original] of [['C/ledger.json', 'hook10-c.ledger.json'], ['C/plan.json', 'hook10-c.plan.json'], ['C/source.score.json', 'hook10-literal.score.json']] as const)
    assert.equal(readFileSync(join(PROOF, copy), 'utf8'), readFileSync(join(SRC, original), 'utf8'), `${copy} is the registered ${original}`);
  const wav = readFileSync(join(PROOF, c.master.file));
  assert.equal(wav.readUInt32LE(40) / 4, 441000, 'exactly 10.000 s, like A and B1'); assert.deepEqual(seamCheck(wav), c.loop.seam, 'seam statistics recomputed from the committed WAV');
  assert.equal(c.loop.seam.pass, true); assert.equal(c.loop.foldMaxAbsError, 0); assert.equal(c.loop.tailFullyDecayed, true);
  assert.ok(Object.values(c.technicalGate).every(Boolean), JSON.stringify(c.technicalGate));
  assert.ok(Math.abs(c.master.loudness.lufs + 16) <= 0.15 && c.master.loudness.truePeakDb <= -1 && c.master.clipped === 0, 'loudness-matched to A and B1: -16 LUFS, below -1 dBTP, no clipping');
  // recorded, not hidden: C keeps A's repeating pocket, which the v0.9 structure gate counts against it
  assert.deepEqual(Object.entries(c.v09StructureGate.checks).filter(([, ok]) => !ok).map(([k]) => k), ['maxLiteralRun <= 2 in every part']);
});

test('gate 1 proof: A and B1 are the committed v0.9 masters, byte for byte; the source renders to A', () => {
  const v09 = read(`${V09}/MANIFEST.json`) as { versions: { id: string; master: { file: string }; files: Record<string, { sha256: string }> }[] };
  for (const id of ['A', 'B1']) {
    const b = manifest.baseline.find(x => x.id === id)!, v = v09.versions.find(x => x.id === id)!;
    assert.equal(b.rebuiltIdentical, true, `${id}: rebuilt on the same path when C was rendered, identical to the committed files`);
    assert.equal(b.masterSha256, v.files[v.master.file]!.sha256); assert.equal(sha256(readFileSync(join(V09, v.master.file))), b.masterSha256, `${id}: the committed listening file is unchanged`);
  }
  const lit = manifest.baseline.find(x => x.id === 'A-as-motifs')!;
  assert.equal(lit.identicalToMasterOf, 'A'); assert.equal(lit.masterSha256, manifest.baseline.find(x => x.id === 'A')!.masterSha256, 'the Anti-Formula source renders to the same master as A');
});

test('gate 1 proof (audio): C differs from A only in the voice, and only from the first withheld note on', async () => {
  const s = await stemComparison(), ledger = read(`${SRC}/hook10-c.ledger.json`) as Ledger;
  assert.deepEqual(s, c.stemComparisonWithA, 'the manifest holds exactly these measurements');
  assert.deepEqual(s.parts.filter(p => p.identicalToA).map(p => p.part), ['bass', 'bars', 'clock'], 'the protected parts are sample-identical to A');
  const voice = s.parts.find(p => p.part === 'voice')!;
  assert.equal(voice.firstDifferingBeat, ledger.expectation.owed.expectedAtBeat, 'the voice is sample-identical to A until the beat the ledger names'); assert.equal(voice.firstDifferingFrame, 275625);
  const at = (beat: number) => s.voiceLevelDb.find(q => q.beat === beat)!;
  for (let b = 8; b < 10; b += 0.25) assert.equal(at(b).c, at(b).a, `beat ${b}: the cry is A's`);
  for (let b = 10.5; b < 12; b += 0.25) assert.ok(at(b).c! < at(b).a! - 20, `beat ${b}: the voice has stopped (${at(b).c} dB against ${at(b).a} dB in A)`);
  assert.ok(s.voiceBar4MaxLevelDifferenceDb <= 1.5, 'the unchanged cadence is sung at A\'s level');
});

test('gate 1 proof: rebuilding C reproduces the committed master', { skip: ffmpegVersion() !== manifest.ffmpeg && 'needs the FFmpeg build recorded in the manifest (loudness gain comes from its measurement)' }, async t => {
  const dir = mkdtempSync(join(tmpdir(), 'af-hook10-')); t.after(() => rmSync(dir, { recursive: true, force: true }));
  const built = await buildVersion(C_VERSION, dir, () => {});
  for (const [file, d] of Object.entries(built.files)) assert.equal(d.sha256, c.files[file]!.sha256, file);
});
