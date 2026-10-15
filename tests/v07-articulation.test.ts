// Frame-domain articulation tests. Musical parsing, choke resolution and render provenance
// are exercised separately; these tests isolate source reads, gains and preflight work.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  decodePcm, mixPcm, sumFloat, voiceFrames, voiceSamples, voiceGain, voiceCost,
  playbackPosition, playbackRateAt, PLAYBACK_VOICE_BYTES_LIMIT,
  type Pcm, type PcmTrigger, type VoicePlayback, type VoiceArticulation,
} from '../src/render/index.ts';

const pcmOf = (values: readonly number[] | Int16Array, channels: 1 | 2 = 1): Pcm => {
  const samples = values instanceof Int16Array ? values : Int16Array.from(values);
  return { frames: samples.length / channels, channels, samples };
};
const dc = (frames: number, channels: 1 | 2 = 1, amplitude = 12000) =>
  pcmOf(Int16Array.from({ length: frames * channels }, () => amplitude), channels);
const articulation = (fields: Partial<VoiceArticulation> = {}): VoiceArticulation =>
  ({ attack: 0, release: 0, ...fields });
const left = (values: ArrayLike<number>) => Array.from({ length: values.length / 2 }, (_, i) => values[i * 2]!);

test('V0.7 frames: an exclusive source end and output gate select the earliest ending without extending a short source', () => {
  const pcm = dc(100);
  assert.equal(voiceFrames(pcm, undefined, articulation({ end: 1 })), 1);
  assert.equal(voiceFrames(pcm, { rate: 1, offset: 99 }, articulation({ end: 100 })), 1);
  assert.equal(voiceFrames(pcm, { rate: 0.25, offset: 99 }, articulation({ end: 100 })), 4);
  assert.equal(voiceFrames(pcm, { rate: 4, offset: 98 }, articulation({ end: 100 })), 1);
  assert.equal(voiceFrames(pcm, undefined, articulation({ stop: 3 })), 3);
  assert.equal(voiceFrames(pcm, undefined, articulation({ stop: 3, release: 4 })), 7);
  assert.equal(voiceFrames(pcm, undefined, articulation({ end: 5, stop: 3, release: 4 })), 5);
  assert.equal(voiceFrames(pcm, undefined, articulation({ stop: 150, release: 20 })), 100);
  assert.equal(voiceFrames(pcm, undefined, articulation({ stop: 0 })), 0, 'an onset choke may suppress a voice completely');
  assert.equal(voiceSamples(pcm, undefined, Infinity, articulation({ stop: 0 })).length, 0);
});

test('V0.7 gain: exact attack/release truth tables cover overlapping ramps, one-frame release and tiny voices', () => {
  const cases: [VoiceArticulation, number, number[]][] = [
    [articulation(), 3, [1, 1, 1]],
    [articulation({ attack: 2 }), 5, [0, 0.5, 1, 1, 1]],
    [articulation({ release: 3 }), 6, [1, 1, 1, 1, 0.5, 0]],
    [articulation({ stop: 2, attack: 4, release: 3 }), 5, [0, 0.25, 0.5, 0.25, 0]],
    [articulation({ attack: 8, release: 10 }), 3, [0, 0.125, 0]],
    [articulation({ release: 1 }), 4, [1, 1, 1, 0]],
    [articulation({ attack: 1, release: 1 }), 1, [0]],
    [articulation({ release: 5 }), 1, [0]],
  ];
  for (const [shape, frames, expected] of cases)
    assert.deepEqual(Array.from({ length: frames }, (_, n) => voiceGain(shape, n, frames)), expected, JSON.stringify(shape));
  assert.equal(voiceGain(undefined, 0, 1), 1, 'historical voices have unity gain at both boundaries');
  assert.equal(voiceGain(undefined, 9, 10), 1);
});

test('V0.7 short fades: sources longer than two frames stay audible when attack and release fill the voice', () => {
  for (let frames = 3; frames <= 20; frames++) for (const attack of [1, 4, 8, 44, 220]) for (const release of [frames, frames + 1, 221]) {
    const shape = articulation({ attack, release });
    const gains = Array.from({ length: frames }, (_, n) => voiceGain(shape, n, frames));
    assert.equal(gains[0], 0);
    assert.equal(gains.at(-1), 0);
    assert.ok(gains.some(gain => gain > 0), JSON.stringify({ frames, attack, release }));
    const peak = Math.max(...gains), peakFrame = gains.indexOf(peak);
    for (let n = 0; n < frames; n++) {
      assert.ok(Number.isFinite(gains[n]!) && gains[n]! >= 0 && gains[n]! <= 1);
      assert.ok(gains[n]! <= Math.min(1, n / attack) + 1e-15, 'compressing fades must never raise the authored attack gain');
      if (n > 0 && n <= peakFrame) assert.ok(gains[n]! >= gains[n - 1]!);
      if (n > peakFrame) assert.ok(gains[n]! <= gains[n - 1]!);
    }
  }
  const rendered = mixPcm([{ frame: 0, velocity: 1, pcm: dc(3), articulation: articulation({ attack: 8, release: 10 }) }], 1);
  assert.deepEqual(left(decodePcm(rendered.bytes).pcm!.samples), [0, 1500, 0]);
  assert.equal(rendered.clippedSamples, 0);
  for (const frames of [1, 2]) {
    const shape = articulation({ attack: 8, release: 10 });
    assert.ok(Array.from({ length: frames }, (_, n) => voiceGain(shape, n, frames)).every(gain => gain === 0), 'fewer than three frames cannot contain two silent edges and an audible interior');
  }
});

test('V0.7 fade overlap: source and output lengths cross the release/attack thresholds without abrupt attenuation', () => {
  const shape = articulation({ attack: 44, release: 221 });
  let previousPeak = 0;
  for (let frames = 3; frames <= 270; frames++) {
    const gains = Array.from({ length: frames }, (_, n) => voiceGain(shape, n, frames));
    const peak = Math.max(...gains);
    assert.ok(peak >= previousPeak - 1e-15, `longer source unexpectedly quieter at ${frames} frames`);
    assert.ok(peak - previousPeak <= 1 / 44 + 1e-15, 'peak changes only by the authored per-frame attack step');
    assert.equal(gains[0], 0); assert.equal(gains.at(-1), 0);
    for (let n = 0; n < frames; n++) assert.ok(gains[n]! <= Math.min(1, n / 44) + 1e-15);
    previousPeak = peak;
  }
  for (const frames of [220, 221, 222, 264, 265]) {
    const source = dc(frames), full = dc(300);
    const natural = decodePcm(mixPcm([{ frame: 0, pcm: source, velocity: 1, articulation: shape }], 1).bytes).pcm!.samples;
    const capped = sumFloat([{ frame: 0, pcm: full, velocity: 1, articulation: shape }], 1, frames);
    assert.deepEqual([...natural], [...capped], `source and output boundaries agree at ${frames} frames`);
  }
  const gated = articulation({ attack: 44, release: 221, stop: 9 });
  for (const frames of [220, 221, 222, 229, 230]) {
    const gains = Array.from({ length: frames }, (_, n) => voiceGain(gated, n, frames));
    assert.ok(Math.max(...gains) <= 9 / 44 + 1e-15, 'an early gate cannot raise its frozen attack level');
    for (let n = 10; n < frames; n++) assert.ok(gains[n]! <= gains[n - 1]! + 1e-15, 'gain never rises after note-off');
    assert.equal(gains.at(-1), 0);
  }
  assert.equal(voiceGain(gated, 9, 230), 9 / 44, 'complete scheduled release begins on the gate at the current attack level');
});

test('V0.7 envelopes: raw voice samples stay unscaled; PCM and float mixers apply exactly one per-voice envelope', () => {
  const pcm = dc(12), shape = articulation({ stop: 5, attack: 2, release: 3 });
  assert.deepEqual([...voiceSamples(pcm, undefined, Infinity, shape)], Array(8).fill(12000));
  const trigger: PcmTrigger = { frame: 2, pcm, velocity: 0.5, articulation: shape };
  const expected = [0, 0, 0, 3000, 6000, 6000, 6000, 6000, 3000, 0, 0, 0];
  const rendered = mixPcm([trigger], 12), decoded = decodePcm(rendered.bytes).pcm!;
  assert.equal(rendered.frames, 12); assert.equal(rendered.clippedSamples, 0);
  assert.deepEqual(left(decoded.samples), expected);
  assert.deepEqual(left(sumFloat([trigger], 12)), expected);
  for (let frame = 0; frame < 12; frame++) assert.equal(decoded.samples[frame * 2], decoded.samples[frame * 2 + 1], 'mono expands equally into stereo');
});

test('V0.7 source boundary: explicit slices use silence beyond both edges of their own source interval', () => {
  for (const channels of [1, 2] as const) for (const rate of [0.25, 0.7, 1.5, 4]) {
    const offset = 100, end = 104;
    const source = pcmOf(Int16Array.from({ length: 240 * channels }, (_, k) => {
      const frame = Math.floor(k / channels);
      return frame >= offset && frame < end ? 0 : (k % 2 ? -30000 : 30000);
    }), channels);
    const playback = { rate, offset }, shape = articulation({ end });
    const voice = voiceSamples(source, playback, Infinity, shape);
    assert.ok(voice.length > 0);
    assert.ok([...voice].every(v => v === 0), `outside-slice sound leaked into ${channels}-channel slice at rate ${rate}`);
  }
});

test('V0.7 source boundary: changing samples outside a tiny nonzero slice cannot change its performed voice', () => {
  for (const channels of [1, 2] as const) {
    const offset = 40, end = 43;
    const source = (poison: number) => pcmOf(Int16Array.from({ length: 100 * channels }, (_, k) => {
      const frame = Math.floor(k / channels), c = k % channels;
      return frame >= offset && frame < end ? (frame - offset + 1) * (c === 0 ? 2000 : -3000) : poison;
    }), channels);
    const shape = articulation({ end }), a = source(32000), b = source(-32000);
    for (const playback of [{ rate: 0.5, offset }, { rate: 2, offset }, { rate: 0.25, offset, glide: { to: 4, frames: 9 } }]) {
      assert.deepEqual(voiceSamples(a, playback, Infinity, shape), voiceSamples(b, playback, Infinity, shape), JSON.stringify(playback));
      assert.ok([...voiceSamples(a, playback, Infinity, shape)].every(Number.isFinite));
    }
    assert.deepEqual([...voiceSamples(a, { rate: 1, offset }, Infinity, shape)], [...a.samples.subarray(offset * channels, end * channels)], 'rate-one slices retain the exact copy path');
  }
});

test('V0.7 interpolation compatibility: adding an envelope or gate without an explicit slice keeps V0.6 source taps', () => {
  const pcm = pcmOf(Int16Array.from({ length: 800 }, (_, n) => (n * 761 % 24001) - 12000));
  const playback = { rate: 1.37, offset: 123, glide: { to: 0.61, frames: 150 } };
  const historical = voiceSamples(pcm, playback), shape = articulation({ stop: 40, attack: 5, release: 7 });
  const voice = voiceSamples(pcm, playback, Infinity, shape);
  assert.deepEqual(voice, historical.subarray(0, 47), 'envelopes belong to the mixer and do not replace V0.6 interpolation');
  assert.strictEqual(voiceSamples(pcm), pcm.samples, 'unperformed historical voices remain in-place');
  assert.deepEqual(voiceSamples(pcm, playback, Infinity, undefined), historical);
});

test('V0.7 output boundary: an explicit production cap positions the release at the rendered endpoint', () => {
  const pcm = dc(30), shape = articulation({ attack: 2, release: 3 });
  const trigger: PcmTrigger = { frame: 3, velocity: 1, pcm, articulation: shape };
  const output = sumFloat([trigger], 1, 10);
  assert.equal(output.length, 20);
  assert.deepEqual(left(output), [0, 0, 0, 0, 6000, 12000, 12000, 12000, 6000, 0]);
  assert.equal(voiceSamples(pcm, undefined, 7, shape).length, 7);
  assert.equal(voiceGain(shape, 6, 7), 0);
  assert.deepEqual(left(sumFloat([{ ...trigger, articulation: undefined }], 1, 10)), [0, 0, 0, 12000, 12000, 12000, 12000, 12000, 12000, 12000], 'the cap never silently fades historical voices');
});

test('V0.7 source boundary: natural exhaustion wins over a gate and release, without fabricated trailing frames', () => {
  const pcm = pcmOf([10000, 10000, 10000, 10000, 10000]), shape = articulation({ stop: 20, attack: 1, release: 3 });
  const result = mixPcm([{ frame: 0, velocity: 1, pcm, articulation: shape }], 1);
  assert.equal(result.frames, 5);
  assert.deepEqual(left(decodePcm(result.bytes).pcm!.samples), [0, 10000, 10000, 5000, 0]);
  const lastFrame = mixPcm([{ frame: 0, velocity: 1, pcm: pcmOf([16000]), articulation: articulation({ attack: 1, release: 1 }) }], 1);
  assert.deepEqual([...decodePcm(lastFrame.bytes).pcm!.samples], [0, 0]);
});

test('V0.7 stereo: both channels follow the same envelope while retaining their source balance', () => {
  const pcm = pcmOf(Int16Array.from({ length: 16 }, (_, n) => n % 2 ? -8000 : 4000), 2);
  const result = mixPcm([{ frame: 0, velocity: 0.75, pcm, articulation: articulation({ attack: 2, release: 3 }) }], 8);
  const values = decodePcm(result.bytes).pcm!.samples;
  assert.deepEqual([...values.slice(0, 6)], [0, 0, 1500, -3000, 3000, -6000]);
  assert.deepEqual([...values.slice(-6)], [3000, -6000, 1500, -3000, 0, 0]);
  assert.equal(result.clippedSamples, 0);
});

test('V0.7 DC continuity: attack and release reach silent boundaries with bounded adjacent-frame changes', () => {
  const pcm = dc(2000), shape = articulation({ end: 1800, stop: 700, attack: 128, release: 256 });
  const values = left(decodePcm(mixPcm([{ frame: 7, velocity: 1, pcm, articulation: shape }], 2000).bytes).pcm!.samples);
  assert.equal(values[7], 0);
  assert.equal(values[7 + 956 - 1], 0);
  assert.ok(values.slice(7 + 956).every(value => value === 0));
  let previous = 0;
  for (const value of values) {
    assert.ok(Math.abs(value - previous) <= 94, `${previous} → ${value} exceeds the declared linear slope`);
    assert.ok(value >= 0 && value <= 12000);
    previous = value;
  }
});

test('V0.7 malformed frame articulation: preflight and reads reject invalid bounds on both interpolation and copy paths', () => {
  const pcm = dc(30), invalid: Record<string, unknown>[] = [
    { end: 0 }, { end: 31 }, { end: 4 }, { end: -1 }, { end: 4.5 },
    { stop: -1 }, { stop: 1.5 }, { stop: Infinity }, { stop: NaN },
    { attack: -1 }, { attack: 1.5 }, { attack: Infinity }, { attack: NaN },
    { release: -1 }, { release: 1.5 }, { release: Infinity }, { release: NaN },
    { attack: Number.MAX_SAFE_INTEGER + 1 }, { release: '4' }, { end: null },
  ];
  for (const fields of invalid) for (const rate of [1, 1.5]) {
    const shape = { ...articulation(), ...fields } as unknown as VoiceArticulation, playback = { rate, offset: 4 };
    assert.throws(() => voiceFrames(pcm, playback, shape), RangeError, JSON.stringify(fields));
    assert.throws(() => voiceSamples(pcm, playback, Infinity, shape), RangeError, JSON.stringify(fields));
    assert.throws(() => voiceCost(pcm, playback, Infinity, shape), RangeError, JSON.stringify(fields));
  }
});

test('V0.7 property: source endpoints, glides and gates agree with an independent first-crossing frame search', () => {
  let state = 0x6b8429f1;
  const next = (maximum: number) => { state ^= state << 13; state ^= state >>> 17; state ^= state << 5; return (state >>> 0) % maximum; };
  const rates = [0.25, 0.5, 0.7, 1, 1.25, 2, 4];
  for (let trial = 0; trial < 100; trial++) {
    const channels = (1 + next(2)) as 1 | 2, pcm = dc(30 + next(200), channels, 1000);
    const offset = next(pcm.frames), end = offset + 1 + next(pcm.frames - offset);
    const playback: VoicePlayback = { rate: rates[next(rates.length)]!, offset,
      ...(trial % 3 ? { glide: { to: rates[next(rates.length)]!, frames: 1 + next(300) } } : {}) };
    const shape = articulation({ end, stop: next(200), attack: next(12), release: next(12) });
    let crossing = 0;
    while (playbackPosition(playback, crossing) < end) crossing++;
    const expected = Math.min(crossing, shape.stop! + shape.release), label = `trial ${trial}: ${JSON.stringify({ playback, shape })}`;
    assert.equal(voiceFrames(pcm, playback, shape), expected, label);
    const limit = next(100), rendered = Math.min(expected, limit), voice = voiceSamples(pcm, playback, limit, shape);
    assert.equal(voice.length, rendered * channels, label);
    if (crossing > 0) assert.ok(playbackPosition(playback, crossing - 1) < end && playbackPosition(playback, crossing) >= end, label);
    for (let n = 0; n < rendered; n++) {
      const gain = voiceGain(shape, n, rendered);
      assert.ok(Number.isFinite(gain) && gain >= 0 && gain <= 1, label);
      for (let c = 0; c < channels; c++) assert.ok(Number.isFinite(voice[n * channels + c]!), label);
    }
    if (rendered > 0 && shape.release > 0) assert.equal(voiceGain(shape, rendered - 1, rendered), 0, label);
  }
});

test('V0.7 work: a stopped accelerating glide is charged only for rendered frames and the rates it reaches', () => {
  const pcm: Pcm = { frames: 44100 * 600, channels: 2, samples: new Int16Array(0) };
  const playback: VoicePlayback = { rate: 0.25, offset: 0, glide: { to: 4, frames: 1000000 } };
  const shape = articulation({ stop: 30, release: 10 });
  const cost = voiceCost(pcm, playback, Infinity, shape), legacyCapped = voiceCost(pcm, playback, 40);
  assert.equal(cost.bytes, 40 * 2 * 8);
  assert.ok(cost.work < legacyCapped.work / 2, 'the unrendered high-rate end of the glide must not inflate articulated work');
  assert.ok(cost.bytes < PLAYBACK_VOICE_BYTES_LIMIT);
  assert.deepEqual(voiceCost(pcm, playback, 7, shape), voiceCost(pcm, playback, Infinity, articulation({ stop: 7 })), 'output cap and hard gate account for the same rendered interval');
  assert.deepEqual(voiceCost(pcm, { rate: 1, offset: 0 }, Infinity, shape), { work: 0, bytes: 0 }, 'gain does not force allocation on the copy path');
  assert.deepEqual(voiceCost(pcm, playback, Infinity, articulation({ stop: 0 })), { work: 0, bytes: 0 });
});

test('V0.7 work property: cost stays above actual interpolation taps for glides crossing a source end or gate', () => {
  const pcm = dc(1000);
  for (const playback of [
    { rate: 0.25, offset: 10, glide: { to: 4, frames: 2000 } },
    { rate: 4, offset: 10, glide: { to: 0.25, frames: 2000 } },
    { rate: 1.5, offset: 998, glide: { to: 0.5, frames: 1 } },
    { rate: 0.7, offset: 0 },
  ] as VoicePlayback[]) for (const shape of [articulation({ end: 1000, stop: 50, release: 7 }), articulation({ end: 20 }), articulation({ stop: 1 })]) {
    // The last case's offset may lie beyond a requested end; only test valid source intervals.
    if (shape.end !== undefined && shape.end <= playback.offset) continue;
    const frames = voiceFrames(pcm, playback, shape), cost = voiceCost(pcm, playback, Infinity, shape);
    let actual = 0;
    for (let n = 0; n < frames; n++) {
      const position = playbackPosition(playback, n), cutoff = 0.92 * Math.min(1, 1 / playbackRateAt(playback, n)), span = 32 / cutoff;
      for (let k = Math.ceil(position - span), end = Math.floor(position + span); k <= end; k++)
        if (Math.abs(k - position) * cutoff * 512 < 32 * 512) actual++;
    }
    assert.ok(cost.work >= actual, `${JSON.stringify({ playback, shape })}: charged ${cost.work}, actual ${actual}`);
    assert.equal(cost.bytes, frames * 8);
  }
});

test('V0.7 overlapping voices: per-voice quantization and addition remain independent of trigger order', () => {
  const source = pcmOf([511, -733, 977, -1229, 1481, -1723, 1993, -2221, 2473, -2711, 2957, -3203]);
  const triggers: PcmTrigger[] = [
    { frame: 0, velocity: 0.51, pcm: source, articulation: articulation({ stop: 6, attack: 2, release: 3 }) },
    { frame: 2, velocity: 0.37, pcm: source, articulation: articulation({ end: 8, attack: 1, release: 4 }) },
    { frame: 3, velocity: 0.23, pcm: source, playback: { rate: 1.5, offset: 0 }, articulation: articulation({ stop: 3, attack: 1, release: 2 }) },
  ];
  const forward = mixPcm(triggers, 15), backward = mixPcm([...triggers].reverse(), 15);
  assert.deepEqual(forward.bytes, backward.bytes);
  assert.equal(forward.clippedSamples, 0);
  const floating = sumFloat(triggers, 15);
  assert.deepEqual(floating, sumFloat([...triggers].reverse(), 15));
  assert.deepEqual([...decodePcm(forward.bytes).pcm!.samples], [...floating]);
  // At frame 2, the newly attacking voice is silent; the first voice has reached unity.
  assert.equal(floating[4], Math.round(977 * 0.51));
});

// Performance guard without wall-clock assertions: gain work is counted, not timed.
test('V0.7 mixer cost: articulated voices evaluate gain once per output frame, independent of source channels', () => {
  const reads = (shape: VoiceArticulation) => {
    let count = 0;
    const counted = new Proxy(shape, { get(target, key, receiver) { if (key === 'release') count++; return Reflect.get(target, key, receiver); } });
    return { counted, count: () => count };
  };
  const shape = articulation({ attack: 3, release: 4 });
  const single = reads(shape); voiceGain(single.counted, 5, 40);
  const perCall = single.count();
  assert.ok(perCall >= 1, 'voiceGain reads the release field on every evaluation');
  // Fixed per-voice validation reads are independent of length, so the difference between two
  // lengths isolates the per-frame gain work exactly.
  const total = (mix: (trigger: PcmTrigger) => unknown, frames: number, channels: 1 | 2) => {
    const counter = reads(shape);
    mix({ frame: 0, pcm: dc(frames, channels), velocity: 0.5, articulation: counter.counted });
    return counter.count();
  };
  for (const channels of [1, 2] as const) {
    assert.equal(total(t => mixPcm([t], 80), 80, channels) - total(t => mixPcm([t], 40), 40, channels), perCall * 40, `mixPcm ${channels}-channel source: one evaluation per frame, not per channel`);
    assert.equal(total(t => sumFloat([t], 80), 80, channels) - total(t => sumFloat([t], 40), 40, channels), perCall * 40, `sumFloat ${channels}-channel source: one evaluation per frame, not per channel`);
  }
});

test('V0.7 compatibility: unarticulated voices keep the historical per-voice rounding in both mixers, with and without performance', () => {
  const values = Array.from({ length: 64 }, (_, i) => Math.round(20000 * Math.sin(i * 0.37)) - (i % 3) * 7);
  const naive = (voice: ArrayLike<number>, channels: 1 | 2, velocity: number, frames: number, at: number, total: number) => {
    const out = new Float64Array(total * 2);
    for (let i = 0; i < frames; i++) for (let c = 0; c < 2; c++) out[(at + i) * 2 + c] += Math.round(voice[i * channels + (channels === 1 ? 0 : c)]! * velocity);
    return out;
  };
  for (const channels of [1, 2] as const) for (const velocity of [0.37, 1, 0.8]) for (const playback of [undefined, { rate: 1.5, offset: 3 }] as (VoicePlayback | undefined)[]) {
    const pcm = pcmOf(channels === 1 ? values : [...values, ...values.slice().reverse()], channels);
    const voice = voiceSamples(pcm, playback), frames = voice.length / channels, at = 5, total = at + frames + 4;
    const expected = naive(voice, channels, velocity, frames, at, total);
    const trigger: PcmTrigger = { frame: at, pcm, velocity, ...(playback ? { playback } : {}) };
    assert.deepEqual(Array.from(sumFloat([trigger], total)), Array.from(expected), `sumFloat ${channels}ch v=${velocity} ${playback ? 'performed' : 'plain'}`);
    const mixed = decodePcm(mixPcm([trigger], total).bytes).pcm!;
    assert.deepEqual(Array.from(mixed.samples), Array.from(expected, v => Math.max(-32768, Math.min(32767, v))), `mixPcm ${channels}ch v=${velocity} ${playback ? 'performed' : 'plain'}`);
  }
});
