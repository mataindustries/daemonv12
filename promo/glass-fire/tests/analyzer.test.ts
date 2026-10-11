import assert from 'node:assert/strict';
import {test} from 'node:test';
import {buildClick, CLICK_RATE} from '../scripts/click-track.ts';
import {analyze, detectOnsets, envelopeOf, onsetsFromManifest, type RenderManifest} from '../scripts/lib/analyze.ts';
import {decodeWav, encodeWav16} from '../scripts/lib/wav.ts';
import {parsePromoData, STEM_IDS, type Onset, type StemId} from '../src/data/contract.ts';
import {buildFixture, mulberry32} from '../src/data/fixture.ts';
import {DURATION_SECONDS, SECONDS_PER_BEAT} from '../src/timeline/grid.ts';

const RATE = 44100;
const silence = () => new Float32Array(DURATION_SECONDS * RATE);

/** Render percussive hits at known times: a stand-in for a real stem. */
const synth = (onsets: readonly Onset[], kind: 'kick' | 'hat') => {
  const out = silence();
  const noise = mulberry32(99);
  for (const o of onsets) {
    const start = Math.round(o.t * RATE);
    const length = Math.round((kind === 'kick' ? 0.25 : 0.06) * RATE);
    for (let i = 0; i < length && start + i < out.length; i++) {
      const env = Math.exp(-i / ((kind === 'kick' ? 0.05 : 0.01) * RATE));
      const v = kind === 'kick' ? Math.sin((2 * Math.PI * 58 * i) / RATE) + (i < 40 ? 0.5 : 0) : noise() * 2 - 1;
      out[start + i]! += 0.7 * o.strength * env * v;
    }
  }
  return out;
};

const matchWithin = (truth: readonly Onset[], found: readonly Onset[], ms: number) => {
  const missing = truth.filter(o => !found.some(f => Math.abs(f.t - o.t) <= ms / 1000));
  const extra = found.filter(f => !truth.some(o => Math.abs(f.t - o.t) <= ms / 1000));
  return {missing, extra};
};

test('detects the reference click on the exact 160 BPM grid', () => {
  const click = buildClick();
  const onsets = detectOnsets(click, CLICK_RATE);
  assert.equal(onsets.length, 64);
  onsets.forEach((o, beat) => assert.ok(Math.abs(o.t - beat * SECONDS_PER_BEAT) < 0.0005, `beat ${beat}: ${o.t}`));
});

test('recovers fixture kick and hat onsets from synthesized stems within 2 ms', () => {
  const fixture = buildFixture();
  for (const kind of ['kick', 'hat'] as const) {
    const truth = fixture.stems[kind].onsets;
    const found = detectOnsets(synth(truth, kind), RATE);
    const {missing, extra} = matchWithin(truth, found, 2);
    assert.deepEqual(missing.map(o => o.t), [], `${kind}: missed onsets`);
    assert.deepEqual(extra.map(o => o.t), [], `${kind}: spurious onsets`);
  }
});

test('analyze() produces a valid PromoData document with stops found in the master', () => {
  const fixture = buildFixture();
  const kick = synth(fixture.stems.kick.onsets, 'kick');
  const hat = synth(fixture.stems.hat.onsets, 'hat');
  const master = new Float32Array(kick.length);
  for (let i = 0; i < master.length; i++) master[i] = 0.6 * kick[i]! + 0.4 * hat[i]!;
  const stems = Object.fromEntries(STEM_IDS.map(id => [id, id === 'kick' ? kick : id === 'hat' ? hat : silence()])) as Record<StemId, Float32Array>;
  const data = parsePromoData(analyze({sampleRate: RATE, master, stems}));
  assert.equal(data.source.kind, 'analysis');
  assert.equal(data.master.envelope.values.length, 1441);
  assert.equal(data.spectrum.values.length, 1441);
  assert.equal(data.spectrum.values[0]!.length, 8);
  assert.equal(data.stems.glass.onsets.length, 0);
  // The drop-1 stop (bar 6 beat 4, 8.625–9.000 s) is silent in this master.
  assert.ok(data.markers.some(m => m.kind === 'stop' && m.t <= 8.63 && m.t + m.duration! >= 8.99), 'stop found');
  assert.ok(data.markers.some(m => m.id === 'drop1' && m.t === 6));
});

test('envelope is normalized, frame-rate, and silent where the audio is', () => {
  const audio = silence();
  for (let i = RATE * 10; i < RATE * 11; i++) audio[i] = 0.5 * Math.sin(i / 10);
  const env = envelopeOf(audio, RATE);
  assert.equal(env.rate, 60);
  assert.equal(Math.max(...env.values), 1);
  assert.equal(env.values[60 * 5], 0);
  assert.ok(env.values[60 * 10 + 30]! > 0.99);
});

test('manifest triggers give exact onsets with GLASSHOUSE sample ids', () => {
  const manifest: RenderManifest = {
    samples: {
      assets: [{file: 'assets/glasshouse/02-glass-reverse.wav', frames: 37800, sampleRate: 44100}],
      tracks: [
        {trackId: 'glass', triggers: [{file: 'assets/glasshouse/01-glass-hit.wav', tick: 0, frame: 33075, velocity: 0.9}, {file: 'assets/glasshouse/02-glass-reverse.wav', tick: 0, frame: 99225, velocity: 0.6}]},
        {trackId: 'drums', triggers: [{file: 'assets/glasshouse/08-chrome-clap.wav', tick: 0, frame: 44100, velocity: 1}, {file: 'assets/glasshouse/09-pixel-hat.wav', tick: 0, frame: 50000, velocity: 1}]},
      ],
    },
  };
  const glass = onsetsFromManifest(manifest, {tracks: ['glass']});
  assert.deepEqual(glass, [
    {t: 0.75, strength: 1, sample: 'glass-hit'},
    {t: 2.25, strength: 0.667, sample: 'glass-reverse', duration: 0.857143},
  ]);
  assert.deepEqual(onsetsFromManifest(manifest, {tracks: ['drums'], samples: ['chrome-clap']}), [{t: 1, strength: 1, sample: 'chrome-clap'}]);
});

test('WAV codec round-trips 16-bit PCM', () => {
  const a = Float32Array.from({length: 100}, (_, i) => Math.sin(i / 3) * 0.8);
  const decoded = decodeWav(encodeWav16([a, a], 48000));
  assert.equal(decoded.sampleRate, 48000);
  assert.equal(decoded.channels.length, 2);
  assert.ok(decoded.channels[1]!.every((v, i) => Math.abs(v - a[i]!) < 1 / 16000));
});
