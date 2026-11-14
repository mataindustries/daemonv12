import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
import { renderCoin, planCoin, coinModes, coinOptions, wobbleHz, SR, type CoinOptions, type Stereo } from '../instruments/bollo-coin/coin.ts';
import { PRESETS } from '../instruments/bollo-coin/presets.ts';
import { renderCoinBridge, type CoinBridgeScore } from '../instruments/bollo-coin/bridge.ts';
import { statistics } from '../instruments/bollo-coin/proof.ts';
import { renderBridge, bridgeWav, type BridgeScore } from '../studio-001/v12-bridge/bridge.ts';
import { sha256, verifyFrozen } from '../studio-001/rack/frozen.ts';
import { readWavInfo } from '../src/render/wav.ts';
import { rms, peak, powerSpectrum, readWav } from '../fable-lab/crush/measure.ts';

const energy = (x: Stereo) => rms(x) ** 2 * x[0].length;
const proof = () => JSON.parse(readFileSync('instruments/bollo-coin/proof.score.json', 'utf8')) as CoinBridgeScore;

test('coin: restitution shrinks ballistic flights and impact energy; seed does not alter gravity', () => {
  for (const restitution of [0.25, 0.61, 0.85]) {
    const p = planCoin({ motion: 'bounce', restitution, spin: 0, velocity: 0.9 });
    const es = p.contacts.filter(e => e.regime === 'bounce');
    assert.ok(es.length >= 3 && es.length <= 40);
    for (let i = 1; i < es.length; i++) {
      const a = es[i - 1]!, b = es[i]!, dt = b.seconds - a.seconds;
      assert.ok(Math.abs(dt - 2 * (4 * a.strength * restitution) / 9.81) < 1e-12);
      assert.ok(Math.abs(b.strength / a.strength - restitution) < 1e-12);
      assert.ok(b.strength ** 2 < a.strength ** 2);
      assert.equal(b.frame, Math.round(b.seconds * SR));
      if (i > 1) assert.ok(Math.abs(dt / (a.seconds - es[i - 2]!.seconds) - restitution) < 1e-12);
    }
    const again = planCoin({ ...p.options, seed: 42 });
    assert.deepEqual(again.contacts.map(e => e.frame), p.contacts.map(e => e.frame));
    assert.equal(p.transitions.at(-1)!.state, 'rest');
    assert.ok(p.transitions.some(e => e.state === 'airborne'));
    assert.ok(p.transitions.some(e => e.state === 'bouncing'));
  }
});

test('coin: bounded accelerating wobble has an independent, stopping energy envelope', () => {
  const p = planCoin(PRESETS.spin), es = p.contacts.filter(e => e.regime === 'wobble');
  assert.ok(es.length > 60);
  let previous = 0;
  for (let i = 0; i <= 1000; i++) {
    const hz = wobbleHz(i / 1000, p.options.spin);
    assert.ok(hz >= previous && hz <= 160); previous = hz;
  }
  const intervals = es.slice(1).map((e, i) => e.frame - es[i]!.frame);
  for (let i = 1; i < intervals.length; i++) assert.ok(intervals[i]! <= intervals[i - 1]! + 1);
  assert.ok(intervals.at(-1)! < intervals[0]! / 5);
  assert.ok(Math.min(...intervals) >= Math.floor(SR / p.wobble!.maxHz));
  for (let i = 1; i < es.length; i++) assert.ok(es[i]!.strength <= es[i - 1]!.strength);
  assert.ok(es.at(-1)!.strength < es[0]!.strength / 100);
  assert.equal(p.contacts.at(-1)!.regime, 'settle');
  assert.equal(p.transitions.at(-1)!.state, 'rest');
  assert.ok(!p.transitions.some(e => e.state === 'bouncing' || e.state === 'airborne'));
  const a = planCoin({ ...PRESETS.bounce, restitution: 0.4 }), b = planCoin({ ...PRESETS.bounce, restitution: 0.8 });
  const relative = (x: typeof a) => x.contacts.filter(e => e.regime === 'wobble').map(e => Math.round((e.seconds - x.wobble!.start) * SR));
  assert.deepEqual(relative(a), relative(b), 'restitution affects bounce, never the wobble clock');
});

test('coin: rolling slows in space, has seam contacts, continuous texture, and transitions to rest', () => {
  const r = renderCoin({ ...PRESETS.roll, spin: 0 }), p = r.plan, roll = p.roll!;
  assert.equal(p.transitions[0]!.state, 'rolling'); assert.equal(p.transitions.at(-1)!.state, 'rest');
  const distance = roll.speed * roll.seconds / 2;
  const seamTime = roll.seconds * (1 - Math.sqrt(1 - 0.21 / distance));
  assert.ok(p.contacts.some(e => Math.abs(e.seconds - seamTime) < 1e-12));
  // Select real rendered windows at least 50 ms away from every contact: friction persists there.
  const windows: number[] = [];
  for (let t = 0.1; t < roll.seconds - 0.15; t += 0.025)
    if (p.contacts.every(e => Math.abs(t - e.seconds) > 0.06)) windows.push(rms(r.audio, Math.round(t * SR), Math.round((t + 0.005) * SR)));
  assert.ok(windows.length > 5 && windows.every(v => v > 1e-6));
  assert.ok(rms(r.audio, Math.round(0.1 * SR), Math.round(0.5 * SR)) > rms(r.audio, Math.round(1.7 * SR), Math.round(2.1 * SR)));
});

test('coin: deterministic numeric synthesis, seed sensitivity, exact lengths, stable poles and meaningful velocity', () => {
  for (const preset of Object.values(PRESETS)) {
    const before = JSON.stringify(preset), a = renderCoin(preset), b = renderCoin(preset);
    assert.equal(JSON.stringify(preset), before);
    assert.equal(sha256(bridgeWav(a.audio)), sha256(bridgeWav(b.audio)));
    assert.notEqual(sha256(bridgeWav(a.audio)), sha256(bridgeWav(renderCoin({ ...preset, seed: preset.seed + 99 }).audio)));
    assert.equal(a.audio[0].length, Math.round(a.plan.seconds * SR));
    assert.equal(a.audio[1].length, a.audio[0].length);
    assert.ok(a.audio.every(ch => ch.every(Number.isFinite)));
    assert.ok(peak(a.audio) < 0.95);
    assert.ok(a.audio.every(ch => ch.at(-1) === 0));
    for (const mode of a.modes) assert.ok(mode.radius > 0 && mode.radius < 1);
  }
  const a = renderCoin({ ...PRESETS.face, velocity: 0.3 }), b = renderCoin({ ...PRESETS.face, velocity: 0.9 });
  assert.ok(energy(b.audio) > energy(a.audio) * 8, 'incoming speed changes acoustic impulse');
  assert.equal(peak(renderCoin({ motion: 'spin', velocity: 0 }).audio), 0);
});

test('coin: PCM24 hashes reproduce in fresh Node processes', t => {
  const script = `import {renderCoin} from './instruments/bollo-coin/coin.ts';
    import {PRESETS} from './instruments/bollo-coin/presets.ts';
    import {bridgeWav} from './studio-001/v12-bridge/bridge.ts';
    import {sha256} from './studio-001/rack/frozen.ts';
    for (const [id,p] of Object.entries(PRESETS)) console.log(id,sha256(bridgeWav(renderCoin(p).audio)));`;
  const run = () => spawnSync(process.execPath, ['--input-type=module', '-e', script], { encoding: 'utf8' });
  const a = run();
  if ((a.error as NodeJS.ErrnoException | undefined)?.code === 'EPERM') { t.skip('sandbox blocks Node subprocesses; rerun outside sandbox'); return; }
  assert.equal(a.status, 0, a.stderr); assert.ifError(a.error);
  const b = run(); assert.equal(b.status, 0, b.stderr); assert.ifError(b.error);
  assert.equal(a.stdout.trim().split('\n').length, Object.keys(PRESETS).length);
  assert.equal(a.stdout, b.stdout);
});

test('coin: maximum supported spin/roll durations have bounded contact counts and exact finite sample lengths', () => {
  for (const motion of ['spin', 'roll'] as const) {
    const r = renderCoin({ motion, motionSeconds: 6, velocity: 1, spin: 1, damping: 0, seed: 0 });
    assert.ok(r.plan.seconds <= 7.5); assert.ok(r.plan.contacts.length < 1000);
    assert.equal(r.audio[0].length, Math.round(r.plan.seconds * SR));
    assert.ok(peak(r.audio) < 0.95); assert.ok(r.audio[0].at(-1) === 0);
  }
});

test('coin: supported extremes stay bounded, free of DC accumulation and excessive Nyquist energy', () => {
  for (const motion of ['face', 'edge', 'bounce', 'spin', 'roll'] as const) for (const high of [false, true]) {
    const p: CoinOptions = { motion, velocity: 1, strike: high ? 1 : 0, hardness: high ? 1 : 0,
      damping: high ? 0 : 1, material: high ? 1 : 0, size: high ? 0.7 : 1.4, spin: 1,
      restitution: 0.85, motionSeconds: 0.5, seed: high ? 0xffffffff : 0 };
    const r = renderCoin(p), s = statistics(r.audio);
    assert.ok(peak(r.audio) < 0.95);
    assert.ok(s.dc.every(v => Math.abs(v) < 1e-5), `${motion} DC: ${s.dc}`);
    assert.ok(s.truePeak4xDbfs < -0.5);
    const mono = r.audio[0].map((v, i) => (v + r.audio[1][i]!) / 2);
    // Entire onset, not just the tail: energy above 17 kHz versus the full spectrum.
    const spectrum = powerSpectrum(mono, 0, 32768);
    let total = 0, highEnergy = 0;
    for (let i = 1; i < spectrum.length; i++) { total += spectrum[i]!; if (i * SR / 32768 > 17000) highEnergy += spectrum[i]!; }
    assert.ok(highEnergy / total < 0.001, `${motion}: excessive HF ${10 * Math.log10(highEnergy / total)} dB`);
    assert.ok(r.modes.filter(m => m.enabled).every(m => m.hz < 15000));
  }
});

test('coin: distinct face/edge damping, size scaling, stereo and mono compatibility', () => {
  const face = renderCoin({ ...PRESETS.face, seed: 250 }), edge = renderCoin({ ...PRESETS.edge, seed: 250 });
  const sustain = (x: Stereo) => rms(x, 2205, 6615) / rms(x, 0, 2205);
  assert.ok(sustain(edge.audio) > sustain(face.audio) * 2);
  const small = coinModes({ size: 0.8 }), large = coinModes({ size: 1.2 });
  assert.ok(Math.abs(small[0]!.hz / large[0]!.hz - (1.2 / 0.8) ** 2) < 1e-12);
  for (const position of [-1, -0.5, 0, 0.5, 1]) {
    const r = renderCoin({ ...PRESETS.edge, position }), s = statistics(r.audio);
    assert.ok(s.monoRmsRelativeDb >= -3.011, 'equal-power panning has no polarity cancellation');
    if (position === -1) assert.equal(peak([r.audio[1], r.audio[1]]), 0);
    if (position === 1) assert.ok(rms([r.audio[0], r.audio[0]]) < 1e-15);
  }
  assert.ok(statistics(renderCoin(PRESETS.roll).audio).correlation > 0.85);
});

test('coin: unsupported controls and unsafe values fail explicitly', () => {
  for (const p of [{ velocity: NaN }, { damping: Infinity }, { velocity: -1 }, { size: 0 }, { size: 2 },
    { restitution: 1 }, { motionSeconds: 100 }, { seed: -1 }, { seed: 0.1 }, { position: 2 },
    { motion: 'grind' }, { bogus: 1 }, { hardness: undefined }] as CoinOptions[]) assert.throws(() => coinOptions(p));
});

test('coin bridge: motifs share original frame timing, immutable input, additive stems, five-second deterministic output', async () => {
  const score = proof(), before = JSON.stringify(score);
  const a = await renderCoinBridge(score), b = await renderCoinBridge(score);
  assert.equal(JSON.stringify(score), before);
  assert.equal(a.audio[0].length, 220500); assert.equal(a.audio[1].length, 220500);
  assert.equal(sha256(bridgeWav(a.audio)), sha256(bridgeWav(b.audio)));
  assert.deepEqual(a.manifest, b.manifest);
  for (const e of a.manifest.events) assert.equal(e.frame, Math.round(e.beat * 0.6 * SR));
  assert.ok(a.manifest.coinEvents.length > 20);
  assert.deepEqual(a.manifest.events.filter(e => e.part === 'face').slice(0, 5).map(e => e.frame), [0, 19845, 39690, 66150, 85995]);
  for (let c = 0; c < 2; c++) for (let i = 0; i < a.audio[c]!.length; i++) {
    let sum = 0; for (const st of a.stems.values()) sum += st[c]![i]!;
    assert.equal(sum, a.audio[c]![i]);
  }
  const proxy = structuredClone(score) as CoinBridgeScore;
  for (const part of proxy.parts) if (part.instrument === 'bollo-coin') {
    delete part.coin; part.instrument = 'v12-signature/ghost-tick'; part.gainDb = 0;
  }
  const old = await renderBridge(proxy);
  assert.deepEqual(a.stems.get('kick'), old.stems.get('kick'));
  assert.deepEqual(a.stems.get('clap'), old.stems.get('clap'));
  assert.ok(peak(a.audio) < 0.9);
});

test('coin bridge: ordinary V12/rack scores keep identical audio, room, seed indices and stems', async () => {
  const s = JSON.parse(readFileSync('proofs/v12-motif-bridge/proof.score.json', 'utf8')) as BridgeScore;
  const original = await renderBridge(s), optIn = await renderCoinBridge(s);
  assert.deepEqual(optIn.audio, original.audio);
  assert.deepEqual(optIn.stems, original.stems);
  assert.deepEqual(optIn.manifest.events, original.manifest.events);
  assert.deepEqual(verifyFrozen(), []);
});

test('coin bridge: off-grid/humanized timing, zero velocity, natural releases, output caps and invalid options', async () => {
  const s = proof(); s.sections = [{ id: 'test', bars: 1 }]; s.bpm = 127; s.swing = 0.64;
  s.parts = [{ id: 'coin', instrument: 'bollo-coin', coin: PRESETS.spin, gainDb: 0,
    humanize: { seed: 3, timingMs: 2 }, notes: [[0.1234567, 0.02, 60, 0.8]] }]; s.motifs = [];
  const r = await renderCoinBridge(s), e = r.manifest.events[0]!, c = r.manifest.coinEvents[0]!;
  assert.equal(c.frame, Math.round(e.beat * r.manifest.beatSeconds * SR));
  assert.ok(c.endFrame > e.noteEndFrame + 1000); assert.ok(c.truncated);
  assert.equal(r.audio[0].at(-1), 0);
  s.parts[0]!.humanize = undefined; s.parts[0]!.notes = [[0, 0.1, 60, 0]];
  assert.equal(peak((await renderCoinBridge(s)).audio), 0);
  s.parts[0]!.room = 0.2; await assert.rejects(renderCoinBridge(s), /room must be 0/);
  s.parts[0]!.room = 0; s.parts[0]!.controls = { hardness: 1 }; await assert.rejects(renderCoinBridge(s), /unsupported/);
  delete s.parts[0]!.controls; s.parts[0]!.notes = [[0, 0.1, 60, 0.8, { hardness: 0.2 }]];
  await assert.rejects(renderCoinBridge(s), /per-note params|unknown parameter/);
});

test('coin delivery: PCM24 and MP3 checksums, decoded sample counts, calibrated A/B and protected sources', t => {
  const dir = 'proofs/bollo-coin/audio';
  for (const line of readFileSync(`${dir}/SHA256SUMS`, 'utf8').trim().split('\n')) {
    const [hash, file] = line.split('  '); assert.equal(sha256(readFileSync(`${dir}/${file}`)), hash, file);
  }
  for (const file of readdirSync(dir).filter(f => f.endsWith('.wav'))) {
    const info = readWavInfo(readFileSync(`${dir}/${file}`)); assert.ok(info.ok);
    if (!info.ok) continue;
    assert.equal(info.info.sampleRate, 44100); assert.equal(info.info.channels, 2); assert.equal(info.info.bitsPerSample, 24);
    if (file.startsWith('F-')) assert.equal(info.info.frames, 220500);
    const mp3 = `${dir}/${file.replace('.wav', '.mp3')}`;
    const decoded = spawnSync('ffmpeg', ['-v', 'error', '-i', mp3, '-f', 's16le', '-ar', '44100', '-ac', '2', '-'], { maxBuffer: 5 * 1024 * 1024 });
    if (decoded.error && (decoded.error as NodeJS.ErrnoException).code === 'ENOENT') { t.diagnostic('ffmpeg unavailable; MP3 decode check skipped'); continue; }
    assert.equal(decoded.status, 0, decoded.stderr.toString()); assert.equal(decoded.stdout.length / 4, info.info.frames, mp3);
  }
  const qa = JSON.parse(readFileSync(`${dir}/qa.json`, 'utf8'));
  assert.ok(Math.abs(qa.records['F-BOLLO-5s-dry'].lufs - qa.records['H-BOLLO-5s-selective-CRUSH'].lufs) <= 0.11);
  assert.deepEqual(qa.crush.routing, ['face', 'bounce']);
  for (const s of Object.values(qa.records) as ReturnType<typeof statistics>[]) {
    assert.ok(s.truePeak4xDbfs < -1); assert.ok(s.monoRmsRelativeDb > -3.011);
    // The unchanged kick/clap have a small finite-window mean; coin-only DC is checked separately.
    assert.ok(s.dc.every(v => Math.abs(v) < 1e-4));
  }
  // PCM24 stems reconstruct delivered dry groove to within additive quantization error.
  const master = readWav(`${dir}/F-BOLLO-5s-dry.wav`), stems = readdirSync(`${dir}/stems`).map(f => readWav(`${dir}/stems/${f}`));
  let error = 0;
  for (let c = 0; c < 2; c++) for (let i = 0; i < master[c]!.length; i++)
    error = Math.max(error, Math.abs(stems.reduce((sum, st) => sum + st[c]![i]!, 0) - master[c]![i]!));
  assert.ok(error <= 5 / 8388608);
  for (const [f, hash] of Object.entries(qa.sourceHashes)) assert.equal(sha256(readFileSync(`instruments/bollo-coin/${f}`)), hash);
});
