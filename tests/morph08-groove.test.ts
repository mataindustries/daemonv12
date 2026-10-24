import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { spawnSync } from 'node:child_process';
import { generator, renderCandidate, renderMotor } from '../experiments/morph-08/render.ts';
import { arrangements } from '../experiments/morph-08/arrangements.ts';
import { integratedLoudness, MASTER, softClip, truePeak } from '../experiments/morph-08/mix.ts';
import { validateEventMap, type EventMap } from '../src/sync/index.ts';
import { decodePcm } from '../src/render/index.ts';

const dir = 'experiments/morph-08/candidates', N = 352800, SLOT = 5512.5;
const hash = (bytes: Uint8Array | string) => createHash('sha256').update(bytes).digest('hex');
const report = JSON.parse(readFileSync(join(dir, 'verification.json'), 'utf8'));
const motor = renderMotor();
const renders: ({ a: typeof arrangements[number] } & Awaited<ReturnType<typeof renderCandidate>>)[] = [];
for (const a of arrangements) renders.push({ a, ...(await renderCandidate(a, motor)) });
const samples = (bytes: Uint8Array) => decodePcm(bytes).pcm!.samples;
const channels = (bytes: Uint8Array): [Float64Array, Float64Array] => {
  const s = samples(bytes), l = new Float64Array(s.length / 2), r = new Float64Array(s.length / 2);
  for (let i = 0; i < l.length; i++) { l[i] = s[2 * i]! / 32767; r[i] = s[2 * i + 1]! / 32767; }
  return [l, r];
};
const arranged = (map: EventMap, a: typeof arrangements[number]) => map.events.filter(e => a.parts.some(p => p.id === e.trackId));

test('MORPH//08: both candidates, stems, maps and engine projects regenerate byte-identically with Node alone', () => {
  assert.deepEqual(report.generator, generator);
  for (const { a, wav, stemWavs, events, schedule, projectText } of renders) {
    const recorded = report.candidates[a.id];
    assert.deepEqual(wav, readFileSync(join(dir, `${a.id}.wav`)), a.id);
    assert.deepEqual(Object.keys(stemWavs).sort(), ['bass', 'kick', 'lead', 'motor', 'perc']);
    for (const [name, bytes] of Object.entries(stemWavs)) {
      assert.deepEqual(bytes, readFileSync(join(dir, `${a.id}.stems`, `${name}.wav`)), `${a.id}/${name}`);
      assert.equal(recorded.stems[name].sha256, hash(bytes));
    }
    assert.equal(events, readFileSync(join(dir, `${a.id}.events.json`), 'utf8'));
    assert.equal(schedule, readFileSync(join(dir, `${a.id}.schedule.json`), 'utf8'));
    assert.equal(projectText, readFileSync(join(dir, `${a.id}.project.json`), 'utf8'));
    assert.equal(recorded.wav.sha256, hash(wav)); assert.equal(recorded.eventMap.sha256, hash(events));
    assert.equal(recorded.project.sha256, hash(projectText));
    // The MP3 is a listening copy whose bytes depend on the encoder build; check the recorded file.
    assert.equal(recorded.mp3.sha256, hash(readFileSync(join(dir, `${a.id}.mp3`))));
    assert.equal(recorded.mp3.bitrateKbps, 192);
  }
});

test('MORPH//08: the motor is MORPH//07 THE HYPNOTIC MOTOR, unchanged, and the MORPH//07 candidates are untouched', () => {
  const original = JSON.parse(readFileSync('experiments/morph-07/candidates/hypnotic-motor.events.json', 'utf8')) as EventMap;
  const motorTracks = new Set(original.events.map(e => e.trackId));
  for (const { a, map } of renders) assert.deepEqual(map.events.filter(e => motorTracks.has(e.trackId)), original.events, a.id);
  const m07 = JSON.parse(readFileSync('experiments/morph-07/candidates/verification.json', 'utf8'));
  for (const id of ['hypnotic-motor', 'awakening']) {
    assert.equal(hash(readFileSync(`experiments/morph-07/candidates/${id}.wav`)), m07.candidates[id].wav.sha256);
    assert.equal(hash(readFileSync(`experiments/morph-07/candidates/${id}.mp3`)), m07.candidates[id].mp3.sha256);
  }
});

test('MORPH//08: every onset is where the map says, locked to the motor, and audible in its stem and the master', () => {
  const window = 662; // 15 ms
  const peak = (s: Int16Array, from: number, to: number) => { let m = 0; for (let i = Math.max(0, from); i < to; i++) m = Math.max(m, Math.abs(s[2 * i]!), Math.abs(s[2 * i + 1]!)); return m; };
  for (const { a, map, triggers, stemWavs, wav } of renders) {
    const anchors = map.events.filter(e => e.trackId === 'commutator' || e.trackId === 'voice').map(e => e.sampleFrame);
    for (const part of a.parts) {
      const frames = map.events.filter(e => e.trackId === part.id).map(e => e.sampleFrame);
      // The map carries the engine's own trigger frames, one event per authored hit.
      assert.deepEqual(frames, triggers[part.id], `${a.id}/${part.id}`);
      assert.equal(frames.length, part.hits.length);
      const stem = samples(stemWavs[part.stem]!);
      for (const f of frames) {
        const rise = 20 * Math.log10((peak(stem, f, f + window) + 1) / (peak(stem, f - window, f) + 1));
        assert.ok(rise >= (part.id === 'kick' ? 40 : 3), `${a.id}/${part.id} at ${f} rises ${rise.toFixed(1)} dB`);
      }
    }
    for (const e of arranged(map, a)) {
      const nearest = Math.min(...anchors.map(x => Math.abs(x - e.sampleFrame)));
      // Locked hits sit within 0.3 ms (960 PPQ rounding) of the motor's own strike; the rest
      // fall only where the rotor is a pitch, not a rhythm (bar 4, beats 1-2).
      if (e.visualRoles!.includes('motor-locked')) assert.ok(nearest <= 13, `${a.id}/${e.trackId}/${e.eventId} is ${nearest} frames off the motor`);
      else assert.ok(e.sampleFrame >= 6 * 44100 && e.sampleFrame < 7 * 44100, `${a.id}/${e.trackId}/${e.eventId} is unlocked`);
    }
    // The band swings with the machine: bar 1's odd sixteenths land ~22 ms late, and the bar-3
    // downbeat kick waits for the motor's dragged strike.
    for (const e of arranged(map, a).filter(e => e.sampleFrame < 2 * 44100)) {
      const slot = Math.round(e.sampleFrame / SLOT), late = (e.sampleFrame - slot * SLOT) / 44.1;
      assert.ok(slot % 2 ? late > 20 && late < 24.5 : Math.abs(late) < 2, `${a.id}/${e.trackId} slot ${slot} is ${late.toFixed(1)} ms late`);
    }
    const bar3 = map.events.find(e => e.trackId === 'kick' && e.sampleFrame > 4 * 44100 - 2000)!;
    assert.ok(bar3.sampleFrame - 4 * 44100 > 25 * 44.1, `${a.id} bar-3 kick follows the drag`);
    // Each kick is audible in the master: its sub-150 Hz band jumps at the mapped frame.
    const m = samples(wav), lp = new Float64Array(N), k = 1 - Math.exp(-2 * Math.PI * 150 / 44100);
    let y1 = 0, y2 = 0;
    for (let i = 0; i < N; i++) { y1 += k * ((m[2 * i]! + m[2 * i + 1]!) / 2 - y1); y2 += k * (y1 - y2); lp[i] = y2; }
    const rms = (from: number, to: number) => { let s = 0; for (let i = from; i < to; i++) s += lp[(i + N) % N]! ** 2; return Math.sqrt(s / (to - from)); };
    for (const e of map.events.filter(e => e.trackId === 'kick'))
      assert.ok(20 * Math.log10(rms(e.sampleFrame, e.sampleFrame + 1323) / rms(e.sampleFrame - 1323, e.sampleFrame)) >= 3, `${a.id} kick ${e.eventId}`);
  }
});

test('MORPH//08: loudness-matched, unclipped masters with headroom; aligned stems; seamless eight-second loops', () => {
  const loudness: number[] = [];
  for (const { a, wav, stemWavs, map, engineFrames, mastered } of renders) {
    const recorded = report.candidates[a.id], pcm = decodePcm(wav).pcm!, [l, r] = channels(wav);
    assert.equal(pcm.channels, 2); assert.equal(pcm.frames, N);
    let peak = 0;
    for (const x of pcm.samples) peak = Math.max(peak, Math.abs(x));
    assert.equal(mastered.clipped, 0); assert.equal(recorded.wav.clippedSamples, 0);
    assert.ok(20 * Math.log10(peak / 32767) <= MASTER.ceilingDbfs + 0.01, `${a.id} sample peak`);
    assert.ok(20 * Math.log10(truePeak(l, r)) <= -1, `${a.id} true peak stays at or below -1 dBTP`);
    loudness.push(integratedLoudness(l, r));
    // Stems: five aligned, unclipped eight-second files that rebuild the master through the ceiling.
    const stems = Object.values(stemWavs).map(channels), trim = 10 ** (-MASTER.stemTrimDb / 20);
    for (const [name, bytes] of Object.entries(stemWavs)) {
      const s = decodePcm(bytes).pcm!;
      assert.equal(s.frames, N); assert.equal(recorded.stems[name].clippedSamples, 0);
      assert.ok(s.samples.every(x => Math.abs(x) < 32767), `${a.id}/${name} does not clip`);
    }
    let worst = 0;
    for (const [c, ch] of [l, r].entries()) for (let i = 0; i < N; i++)
      worst = Math.max(worst, Math.abs(softClip(trim * stems.reduce((s, st) => s + st[c]![i]!, 0)) - ch[i]!) * 32767);
    assert.ok(worst <= 8, `${a.id} stems rebuild the master within ${worst.toFixed(1)} LSB`);
    // Loop: the first downbeat opens the file, nothing is mapped past the seam, ring-outs that
    // cross the seam reappear at the start, and the seam step is an ordinary sample step.
    const kicks = map.events.filter(e => e.trackId === 'kick');
    assert.ok(kicks[0]!.sampleFrame < 441 && map.events.every(e => e.sampleFrame < N));
    assert.ok(Object.values(engineFrames).some(f => f > N), `${a.id} has sample tails to wrap`);
    assert.ok(samples(stemWavs.motor!).subarray(0, 128).some(x => x !== 0), 'the motor ring-out wraps onto the start');
    const steps = [0, 1].map(c => { const d: number[] = []; for (let i = 1; i < N; i++) d.push(Math.abs(pcm.samples[2 * i + c]! - pcm.samples[2 * i - 2 + c]!)); return d.sort((x, y) => x - y)[d.length >> 1]!; });
    for (const c of [0, 1]) assert.ok(Math.abs(pcm.samples[c]! - pcm.samples[2 * (N - 1) + c]!) <= steps[c]!, `${a.id} seam step on channel ${c}`);
    // FFmpeg's independent reading of the checked files agrees within a fraction of a LU.
    assert.ok(Math.abs(recorded.ffmpegLoudness.wav.integratedLufs - MASTER.targetLufs) < 0.5);
    assert.ok(recorded.ffmpegLoudness.wav.truePeakDbfs <= -1 && recorded.ffmpegLoudness.mp3.truePeakDbfs <= -1);
  }
  for (const value of loudness) assert.ok(Math.abs(value - MASTER.targetLufs) < 0.05, `integrated loudness ${value.toFixed(2)} LUFS`);
  const [x, y] = arrangements.map(a => report.candidates[a.id].ffmpegLoudness);
  assert.ok(Math.abs(x.wav.integratedLufs - y.wav.integratedLufs) <= 0.3 && Math.abs(x.mp3.integratedLufs - y.mp3.integratedLufs) <= 0.3);
});

test('MORPH//08: Sync Pack maps validate, carry motor and band roles and are reproduced by the sync CLI', t => {
  const work = mkdtempSync(join(tmpdir(), 'daemon-morph08-')); t.after(() => rmSync(work, { recursive: true, force: true }));
  for (const { a, map, events, schedule } of renders) {
    assert.deepEqual(validateEventMap(map), [], a.id);
    assert.deepEqual(map.clip, { startSampleFrame: 0, endSampleFrame: N });
    const roles = new Set(map.events.flatMap(e => e.visualRoles ?? []));
    for (const role of ['revolution', 'impact', 'torque', 'harmonic-transition', 'section', 'fusion', 'harmonic-lock', 'tine',
      'kick', 'low-end', 'bass', 'melody', 'hook', 'backbeat', 'hat', 'motor-locked', 'accent']) assert.ok(roles.has(role), `${a.id} exports ${role}`);
    writeFileSync(join(work, `${a.id}.schedule.json`), schedule);
    const cli = spawnSync(process.execPath, ['bin/daemonv12.js', 'sync', join(work, `${a.id}.schedule.json`), '--out', join(work, `${a.id}.json`), '--json'], { encoding: 'utf8' });
    assert.equal(cli.status, 0, cli.stdout + cli.stderr);
    assert.equal(readFileSync(join(work, `${a.id}.json`), 'utf8'), events);
  }
});
