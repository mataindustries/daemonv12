import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, existsSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { join } from 'node:path';
import { planCoin, SR, type CoinOptions } from '../instruments/bollo-coin/coin.ts';
import { renderBridge } from '../studio-001/v12-bridge/bridge.ts';
import { readWavInfo } from '../src/render/wav.ts';
import { cycle, duck, ride, sum, type Stereo } from '../sound-lab/lib.ts';

type Note = [number, number, number | string, number, Record<string, number | string>?];
interface Part { id: string; instrument: string; coin?: CoinOptions; notes?: Note[] }
const json = (p: string) => JSON.parse(readFileSync(p, 'utf8'));
const bollo = json('sound-lab/bollo/score.json') as { bpm: number; parts: Part[] }, grind = json('sound-lab/grind/score.json') as { bpm: number; parts: Part[] };
const beat = 60 / bollo.bpm, part = (id: string) => bollo.parts.find(p => p.id === id)!;

test('BOLLO: the bounce fills are locked to the tempo by physics, not by editing', () => {
  const p = part('bounce');
  assert.equal(p.coin!.restitution, 0.5);
  for (const [n, firstFlight] of [[p.notes![0]!, beat / 4], [p.notes![1]!, beat / 2]] as const) {
    const plan = planCoin({ ...p.coin, velocity: p.coin!.velocity! * n[3] }), c = plan.contacts.filter(x => x.regime === 'bounce');
    assert.ok(c.length >= 4);
    // every flight is half the one before, starting from a sixteenth (bar 1) or an eighth (bar 2)
    for (let i = 1; i < c.length; i++) assert.ok(Math.abs((c[i]!.seconds - c[i - 1]!.seconds) - firstFlight / 2 ** (i - 1)) < 2e-6);
    // so the bounce runs out two first-flights after it began: on the next beat (bar 2) or half-beat (bar 1)
    assert.ok(Math.abs(plan.motionEndSeconds - 2 * firstFlight) < 0.004);
  }
  // the eighth-note drop starts on beat 4 of bar 2 and ends on the downbeat of bar 3
  assert.equal(p.notes![1]![0], 7);
});

test('BOLLO: the spin starts at sixteenth-note rate and settles exactly on the downbeat', () => {
  const p = part('spin'), n = p.notes![0]!, plan = planCoin({ ...p.coin, velocity: p.coin!.velocity! * n[3] });
  assert.equal(plan.wobble!.startHz, 7);
  assert.ok(Math.abs(1 / plan.wobble!.startHz - beat / 4) < 1e-9, 'a sixteenth at 105 BPM is 1/7 s');
  const wobble = plan.contacts.filter(c => c.regime === 'wobble'), gaps = wobble.slice(1).map((c, i) => c.seconds - wobble[i]!.seconds);
  assert.ok(Math.abs(gaps[0]! / (beat / 4) - 1) < 0.05, 'first wobble interval is within 5 % of a sixteenth');
  for (let i = 1; i < gaps.length; i++) assert.ok(gaps[i]! < gaps[i - 1]! + 1e-9, 'the wobble only accelerates');
  // first wobble contact lands on beat 3 of bar 4 (beat 14); the final settling contact on beat 16, the next downbeat
  const frame = (seconds: number) => Math.round((n[0] * beat + seconds) * SR);
  assert.ok(Math.abs(frame(wobble[0]!.seconds) - Math.round(14 * beat * SR)) <= 1);
  assert.ok(Math.abs(frame(plan.contacts.at(-1)!.seconds) - Math.round(16 * beat * SR)) <= 1);
  assert.equal(plan.contacts.at(-1)!.regime, 'settle');
});

test('BOLLO: every coin part is the unchanged instrument, with no room send, and none is cut short', () => {
  const coins = bollo.parts.filter(p => p.instrument === 'bollo-coin');
  assert.equal(coins.length, 8);
  const report = json('sound-lab/bollo/audio/REPORT.json');
  assert.deepEqual(report.truncatedCoinEvents, []);
  assert.equal(report.settings.crush.coins, 'never processed');
});

test('GRIND: Living Bass slides keep one unbroken oscillator phase (no step at the note boundary)', async () => {
  const bass = grind.parts.find(p => p.id === 'bass808')! as Part & { controls: Record<string, number> };
  const score = { schema: 'daemonv12.signature-rack.score/1', title: 'slide probe', bpm: 120, key: 'A minor', tailSeconds: 0.3, masterGainDb: 0, sections: [{ id: 'a', bars: 2 }],
    parts: [{ id: 'b', instrument: 'living-bass', gainDb: 0, room: 0, controls: bass.controls, motion: [{ fromBeat: 0, toBeat: 16, preset: 'none' }],
      notes: [[0, 2, 'A1', 0.9, { articulation: 'accent' }], [2, 2, 'A2', 0.9, { articulation: 'legato', slide: 0.5 }], [4, 2, 'A1', 0.9, { articulation: 'legato', slide: 0.5 }]] }] };
  const x = (await renderBridge(score as never)).stems.get('b')![0];
  const step = (a: number, b: number) => { let m = 0; for (let i = Math.round(a * SR); i < Math.round(b * SR); i++) m = Math.max(m, Math.abs(x[i + 1]! - x[i]!)); return m; };
  const low = step(0.5, 0.95), high = step(1.5, 1.95), up = step(0.98, 1.3), down = step(1.98, 2.3);
  assert.ok(low > 0 && high > 1.5 * low, 'the octave is really reached');
  // a restarted oscillator would jump by up to the waveform's full height; a continuous one never moves faster than its highest pitch
  assert.ok(up <= high * 1.15 && down <= high * 1.15, `slide steps ${up.toFixed(4)}/${down.toFixed(4)} vs steady ${high.toFixed(4)}`);
});

test('GRIND: the score uses the approved kit and the 808 never passes a sample', () => {
  const ids = Object.fromEntries(grind.parts.map(p => [p.id, p.instrument]));
  assert.equal(ids.bass808, 'living-bass');
  for (const [id, sound] of [['kick', 'sub-hammer'], ['click', 'iron-pulse'], ['snare', 'titanium-crack'], ['clap', 'neon-clap'], ['hat', 'ghost-tick'], ['ohat', 'open-circuit']]) assert.equal(ids[id!], `v12-signature/${sound}`);
  const glides = grind.parts.find(p => p.id === 'bass808')!.notes!.filter(n => n[4]?.articulation === 'legato');
  assert.ok(glides.length >= 6 && glides.every(n => typeof n[4]!.slide === 'number'));
});

test('delivery: files match their checksums, lengths follow the tempo, and nothing exceeds -0.9 dBTP', () => {
  for (const [dir, loop, firstTail] of [['sound-lab/grind/audio', 16 * 60 / 140 * SR, SR], ['sound-lab/bollo/audio', 16 * 60 / 105 * SR, 0]] as const) {
    const sums = readFileSync(join(dir, 'SHA256SUMS'), 'utf8').trim().split('\n');
    assert.ok(sums.length >= 20);
    for (const line of sums) { const [hash, name] = line.split(/\s+/) as [string, string]; assert.ok(existsSync(join(dir, name)), name); assert.equal(createHash('sha256').update(readFileSync(join(dir, name))).digest('hex'), hash, name); }
    const report = json(join(dir, 'REPORT.json')) as { files: Record<string, { frames: number; truePeakDbtp: number }> };
    for (const [name, f] of Object.entries(report.files)) {
      const wav = readWavInfo(readFileSync(join(dir, `${name}.wav`)));
      assert.ok(wav.ok);
      assert.equal(wav.info.frames, f.frames); assert.equal(wav.info.sampleRate, 44100); assert.equal(wav.info.channels, 2); assert.equal(wav.info.bitsPerSample, 24);
      assert.ok(f.truePeakDbtp <= -0.9, `${name} true peak ${f.truePeakDbtp}`);
    }
    const names = Object.keys(report.files), one = report.files[names[0]!]!.frames, three = report.files[names.find(n => n.includes('three-cycles'))!]!.frames;
    assert.equal(three - one, 2 * loop, 'three cycles are exactly two loops longer than one');
    if (firstTail) assert.equal(one, loop + firstTail);
  }
});

test('lab helpers: cycle overlaps tails, duck and ride are exact at their corners', () => {
  const x: Stereo = [Float64Array.from([1, 1, 1, 1, 0.5, 0.25]), Float64Array.from([1, 1, 1, 1, 0.5, 0.25])];
  assert.deepEqual([...cycle(x, 4, 2)[0]], [1, 1, 1, 1, 1.5, 1.25, 1, 1, 0.5, 0.25]);
  const flat: Stereo = [new Float64Array(SR).fill(1), new Float64Array(SR).fill(1)];
  const d = duck(flat, [1000], 6, 10, 50)[0];
  assert.equal(d[0], 1); assert.ok(Math.abs(d[1000]! - 10 ** (-6 / 20)) < 1e-12); assert.equal(d[1000 + 441 + 2205 + 1], 1);
  const r = ride(flat, 100, 200, 0, 12)[0];
  assert.equal(r[100], 1); assert.ok(Math.abs(r[200]! - 10 ** (12 / 20)) < 1e-12); assert.ok(Math.abs(r[150]! - 10 ** (6 / 20)) < 1e-12);
  assert.equal(sum(flat, flat)[1][5], 2);
});
