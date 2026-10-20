// The V12 analyser against this track's ground truth, established by three independent analyses
// (percussive template matching, harmonic tracking, band structure), all of which agreed:
//  - kick on every beat except 3:1 (full stop) and bar 5 (kicks displaced to the offbeats), plus a
//    pickup kick at 6:4:3: 32 kicks, all of nearly equal level;
//  - claps on 2 and 4; on beats 2, 3, 4 in bar 3; on the offbeats in bar 5;
//  - a full stop at 3.75–3.98 s, broken by a brass stab out of silence at 3:1:3 (3.984 s);
//  - the loudest brass stab at 3:3:3; a held A4 with a fall in bar 2; a legato swell from 6:1:1;
//  - offbeat bass absent in bars 3 and 5; the payoff at 6:1:1 (9.375 s), where the on-beat kick returns.
// Two adversarial skeptics re-measured every claim; this test asserts only what they confirmed.
// Runs only where the approved WAV has been placed (it is never committed).
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {existsSync, readFileSync} from 'node:fs';
import {join} from 'node:path';
import {test} from 'node:test';
import {describe, dropouts, frameLevels, gridOnsets, separate, snap, structuralAccents, tailHits} from '../scripts/lib/analyze-v12.ts';
import {APPROVED_SHA256, approvedWavPath} from '../scripts/lib/approved.ts';
import {decodeWav, mixdown} from '../scripts/lib/wav.ts';

const wav = approvedWavPath(join(import.meta.dirname, '..'));
const present = existsSync(wav) && createHash('sha256').update(readFileSync(wav)).digest('hex') === APPROVED_SHA256;

const KICKS = ['1:1:1', '1:2:1', '1:3:1', '1:4:1', '2:1:1', '2:2:1', '2:3:1', '2:4:1', '3:2:1', '3:3:1', '3:4:1', '4:1:1', '4:2:1', '4:3:1', '4:4:1', '5:1:3', '5:2:3', '5:3:3', '5:4:3', '6:1:1', '6:2:1', '6:3:1', '6:4:1', '6:4:3', '7:1:1', '7:2:1', '7:3:1', '7:4:1', '8:1:1', '8:2:1', '8:3:1', '8:4:1'];
const CLAPS = ['1:2:1', '1:4:1', '2:2:1', '2:4:1', '3:2:1', '3:3:1', '3:4:1', '4:2:1', '4:4:1', '5:1:3', '5:2:3', '5:3:3', '5:4:3', '6:2:1', '6:4:1', '7:2:1', '7:4:1', '8:2:1', '8:4:1'];

test('V12 analysis matches the reconciled ground truth', {skip: present ? false : 'approved WAV not present'}, () => {
  const pcm = decodeWav(readFileSync(wav));
  const L = separate(mixdown(pcm), pcm.sampleRate);
  const kick = snap(gridOnsets(L, 'kick', 6, 9));
  assert.deepEqual(kick.map(k => describe(k.t)), KICKS, 'kick positions');
  assert.ok(Math.min(...kick.map(k => k.s)) > 0.5, 'groove kicks are of similar level');

  const snare = tailHits(L, 6.5).map(e => describe(e.t));
  for (const c of CLAPS) assert.ok(snare.includes(c), `clap ${c} missing`);
  for (const offbeat of ['1:1:3', '1:2:3', '2:1:3', '8:3:3']) assert.ok(!snare.includes(offbeat), `hat/brass at ${offbeat} taken for a clap`);

  const brass = snap(gridOnsets(L, 'brass', 6, 9));
  const pos = brass.map(b => describe(b.t));
  assert.ok(pos.includes('3:1:3'), 'stab out of silence at 3:1:3');
  assert.equal(describe([...brass].sort((a, b) => b.s - a.s)[0]!.t), '3:3:3', 'loudest stab');
  assert.ok(pos.filter(p => p.startsWith('7:')).length >= 8, 'dense riff in bar 7');

  const loud = frameLevels(L, 'full', 36, 0.03);
  const drops = dropouts(loud, 0.3, 0.1);
  assert.equal(drops.length, 1);
  assert.ok(drops[0]!.start >= 3.74 && drops[0]!.end <= 3.99, JSON.stringify(drops));

  const bass = frameLevels(L, 'bass', 30, 0.06);
  const perBar = Array.from({length: 8}, (_, b) => bass.slice(b * 112.5, (b + 1) * 112.5).reduce((p, q) => p + q, 0) / 112.5);
  const lowest = perBar.map((v, i) => [v, i + 1] as const).sort((a, b) => a[0] - b[0]).slice(0, 2).map(x => x[1]).sort();
  assert.deepEqual(lowest, [3, 5], `bass per bar ${perBar.map(v => v.toFixed(2))}`);

  const accents = structuralAccents(kick, brass, drops).map(a => describe(a.t));
  assert.deepEqual(accents, ['3:1:3', '6:1:1']);
});
