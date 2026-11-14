import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, existsSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { join } from 'node:path';
import { planCoin, type CoinOptions } from '../instruments/bollo-coin/coin.ts';
import { dbAmp, type Stereo } from '../sound-lab/lib.ts';
import { shape, taps, chain } from '../sound-lab/upgrade/tools.ts';

const json = (p: string) => JSON.parse(readFileSync(p, 'utf8'));
const ones = (n: number): Stereo => [new Float64Array(n).fill(1), new Float64Array(n).fill(1)];
const near = (a: number, b: number, eps = 1e-9) => assert.ok(Math.abs(a - b) < eps, `${a} != ${b}`);

test('upgrade: the keyed shaper lifts the front, settles to sustain, recovers to unity, and is unity before the first onset', () => {
  const sr = 44100, y = shape(ones(sr), [1000], { attackDb: 3, holdMs: 5, releaseMs: 10, sustainDb: -2, recoverMs: 20 });
  near(y[0][999]!, 1); near(y[0][1000]!, dbAmp(3)); near(y[0][1000 + 220]!, dbAmp(3));
  near(y[1][1000 + 220 + 441]!, dbAmp(-2), 1e-3); near(y[0][1000 + 220 + 441 + 882 + 5]!, 1);
  // without recovery the sustain level holds until the next onset, which restarts the curve
  const z = shape(ones(4000), [100, 3000], { attackDb: 2, holdMs: 1, releaseMs: 1, sustainDb: -6 });
  near(z[0][2999]!, dbAmp(-6)); near(z[0][3000]!, dbAmp(2));
});

test('upgrade: clatter taps are plain delayed copies at their gains and pans; chain spaces items exactly', () => {
  const x: Stereo = [new Float64Array(2000), new Float64Array(2000)]; x[0][0] = 1; x[1][0] = 1;
  const y = taps(x, [[10, -6, 0], [20, -12, -1]]);
  near(y[0][441]!, dbAmp(-6)); near(y[1][441]!, dbAmp(-6));
  near(y[0][882]!, dbAmp(-12) * Math.SQRT2); near(y[1][882]!, 0);
  assert.equal(y[0].reduce((a, v, i) => a + (v !== 0 && i !== 441 && i !== 882 ? 1 : 0), 0), 0);
  const c = chain([ones(3), ones(2)], 4); assert.equal(c[0].length, 9); assert.deepEqual([...c[0]], [1, 1, 1, 0, 0, 0, 0, 1, 1]);
});

test('upgrade: the original masters and the approved G1/G2/B1/B2 files are byte-for-byte unchanged', () => {
  for (const dir of ['sound-lab/grind/audio', 'sound-lab/bollo/audio', 'sound-lab/upgrade/audio/grind', 'sound-lab/upgrade/audio/bollo', 'sound-lab/upgrade/audio/grind-final', 'sound-lab/upgrade/audio/bollo-final']) {
    if (!existsSync(join(dir, 'SHA256SUMS'))) continue;
    const sums = readFileSync(join(dir, 'SHA256SUMS'), 'utf8').trim().split('\n');
    assert.ok(sums.length >= 10);
    for (const line of sums) { const [hash, file] = line.split(/\s+/); assert.equal(createHash('sha256').update(readFileSync(join(dir, file!))).digest('hex'), hash, file); }
  }
});

// The B1/B2 coin tone overrides, as delivered. Every coin contact must land on the same frame with the same strength.
const report = (name: string) => json(`sound-lab/upgrade/audio/${name}/REPORT.json`);
test('upgrade: BOLLO tone overrides touch only damping, hardness or material, and move no coin contact', { skip: !existsSync('sound-lab/upgrade/audio/bollo/REPORT.json') }, () => {
  for (const name of ['bollo', 'bollo-final']) if (existsSync(`sound-lab/upgrade/audio/${name}/REPORT.json`)) checkTone(name);
});
function checkTone(name: string) {
  const r = report(name), score = json('sound-lab/bollo/score.json') as { parts: { id: string; coin?: CoinOptions; notes?: [number, number, number, number][] }[] };
  assert.equal(r.originalReproduced, true); assert.equal(r.coinContactTimingIdentical, true);
  let checked = 0;
  for (const v of Object.values(r.settings) as { coinTone?: Record<string, Partial<CoinOptions>> }[]) for (const [id, tone] of Object.entries(v.coinTone ?? {})) {
    assert.deepEqual(Object.keys(tone).filter(k => !['damping', 'hardness', 'material'].includes(k)), [], id);
    const p = score.parts.find(x => x.id === id)!;
    for (const n of p.notes!) {
      const a = planCoin({ ...p.coin, velocity: p.coin!.velocity! * n[3] }), b = planCoin({ ...p.coin, ...tone, velocity: p.coin!.velocity! * n[3] });
      assert.deepEqual(b.contacts.map(c => [c.frame, c.strength]), a.contacts.map(c => [c.frame, c.strength])); checked++;
    }
  }
  assert.ok(checked > 40);
}

test('upgrade: every delivered comparison is loudness-matched, under -1 dBTP, never at full scale, and the original mixes reproduce', { skip: !existsSync('sound-lab/upgrade/audio/grind/REPORT.json') }, () => {
  for (const name of ['grind', 'bollo', 'grind-final', 'bollo-final']) {
    if (!existsSync(`sound-lab/upgrade/audio/${name}/REPORT.json`)) continue;
    const r = report(name); assert.equal(r.originalReproduced, true);
    const files = Object.entries(r.files) as [string, { single: { integratedLufs: number; truePeakDbtp: number; samplesAtFullScale: number } }][];
    assert.equal(files.length, name.endsWith('final') ? 4 : 3, name);
    for (const [k, f] of files) {
      assert.ok(Math.abs(f.single.integratedLufs - r.loudnessTargetLufs) <= 0.1, `${name} ${k} loudness`);
      assert.ok(f.single.truePeakDbtp <= -1, `${name} ${k} true peak`); assert.equal(f.single.samplesAtFullScale, 0);
    }
  }
});

test('upgrade: the GRIND hybrid is G1 and G2 stages in one pipeline (G1 kick, duck and clip stages; G2 growl held off the kick)', { skip: !existsSync('sound-lab/upgrade/audio/grind-final/REPORT.json') }, () => {
  const { settings: s } = report('grind-final'), f = s['FINAL-hybrid'], g1 = s['G1-punch'], g2 = s['G2-menace'];
  assert.deepEqual(f.kick, g1.kick); assert.deepEqual(f.master, g1.master); assert.deepEqual(f.hats, g1.hats); assert.deepEqual(f.snare, g2.snare);
  const { grit, ...bass } = f.bass, { grit: _none, ...g1bass } = g1.bass; assert.deepEqual(bass, g1bass); assert.equal(_none, undefined);
  const { kickDuck, ...growl } = grit; assert.deepEqual(growl, g2.bass.grit); assert.ok(kickDuck.db >= g1.bass.duckDb && kickDuck.holdMs >= g1.bass.duckHoldMs);
  // the kick keeps G1's restored front with the growl added
  assert.ok(report('grind-final').files['FINAL-hybrid'].single.kick.frontToBodyDb >= report('grind-final').files['G1-punch'].single.kick.frontToBodyDb - 0.3);
});
