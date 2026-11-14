/** Opt-in score/2 -> approved rack + existing DaemonV12 sample renderer.
 * No registry mutation, copied DSP, rewritten samples, or change to the score/2 contract.
 */
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { lowerScore, expandMotif, applyTransform } from '../motif/index.ts';
import type { ScoreInputV2, LoweredScore } from '../motif/types.ts';
import { normalizeScore } from '../rack/score.ts';
import { mixdown, type Stereo, type RenderedPart } from '../rack/render.ts';
import { engineEndFrames, keyOf } from '../rack/curves.ts';
import { REPO_ROOT, sha256, verifyFrozen } from '../rack/frozen.ts';
import type { ScoreInput } from '../rack/types.ts';
import { decodePcm, PCM_RATE, type Pcm, type PcmTrigger } from '../../src/render/pcm.ts';
import { voiceFrames } from '../../src/render/playback.ts';
import { sumFloatPrecise, quantize24 } from '../../src/render/precision.ts';
import { VoiceSampleCache } from '../../src/render/voice-cache.ts';

export const BRIDGE_VERSION = '1.0.0';
const PREFIX = 'v12-signature/';
const PACK = join(REPO_ROOT, 'packs/v12-signature-v1');
// This broad-range entry supplies the existing pure lowering/normalization rules only.
// It is NEVER rendered for a V12 part, nor inserted into the real registry.
const PROXY = 'context/snare';
export interface SampleOptions {
  mode?: 'pitched' | 'one-shot';
  /** Default true for pitched, false for one-shots. No sample looping/extension. */
  gate?: boolean;
  attackSeconds?: number;
  releaseSeconds?: number;
}
export type BridgePart = ScoreInputV2['parts'][number] & { v12?: SampleOptions };
export type BridgeScore = Omit<ScoreInputV2, 'parts'> & { parts: BridgePart[] };
interface Sound {
  id: string; file: string; rootMidi: number | null; kitPitch: number | null;
  sha256: string; channels: number; frames: number;
}
export interface BridgeEvent {
  id: string; part: string; instrument: string; beat: number; beats: number;
  pitch: number; velocity: number; frame: number; noteEndFrame: number;
  sample?: {
    file: string; sha256: string; rootMidi: number | null; kitPitch: number | null;
    mode: 'pitched' | 'one-shot'; rate: number; channels: number;
    gate: boolean; attackFrames: number; releaseFrames: number;
    naturalEndFrame: number; endFrame: number; truncated: boolean;
  };
}
const fail = (message: string): never => { throw new Error(`V12 bridge: ${message}`); };
const isV12 = (id: string) => id.startsWith(PREFIX);

function sampleOptions(part: BridgePart, sound: Sound): Required<SampleOptions> {
  for (const k of Object.keys(part.v12 ?? {}))
    if (!['mode', 'gate', 'attackSeconds', 'releaseSeconds'].includes(k)) fail(`${part.id}.v12.${k}: unsupported option`);
  const mode = part.v12?.mode ?? (sound.kitPitch !== null || sound.rootMidi === null ? 'one-shot' : 'pitched');
  if (!['pitched', 'one-shot'].includes(mode)) fail(`${part.id}: mode must be pitched or one-shot`);
  if (mode === 'pitched' && sound.rootMidi === null) fail(`${part.id}: ${sound.id} has no catalog root pitch`);
  const gate = part.v12?.gate ?? mode === 'pitched';
  if (typeof gate !== 'boolean') fail(`${part.id}.v12.gate: expected boolean`);
  const attackSeconds = part.v12?.attackSeconds ?? 0.001, releaseSeconds = part.v12?.releaseSeconds ?? 0.005;
  for (const [name, value] of Object.entries({ attackSeconds, releaseSeconds }))
    if (!Number.isFinite(value) || value < 0 || value > 10 || Number(value.toFixed(6)) !== value)
      fail(`${part.id}.${name}: 0..10 seconds, at most six decimals`);
  return { mode, gate, attackSeconds, releaseSeconds };
}

function prepare(input: BridgeScore | ScoreInput) {
  // JSON scores are copied: the authored score and all approved sources stay untouched.
  const score = structuredClone(input) as BridgeScore;
  if (!score || !Array.isArray(score.parts)) fail('expected a rack score/1 or motif score/2 with parts');
  const catalogBytes = readFileSync(join(PACK, 'v12-signature.catalog.json'));
  const catalog = JSON.parse(catalogBytes.toString()) as { sounds: Sound[]; provenance: string; license: string };
  const samples = new Map<string, { sound: Sound; options: Required<SampleOptions>; pcm: Pcm }>();
  const originals = new Map(score.parts.map(p => [p.id, p.instrument]));
  const all = new Map((score.motifs ?? []).map(m => [m.id, m]));
  for (const part of score.parts) {
    if (!isV12(part.instrument)) {
      if (part.v12 !== undefined) fail(`${part.id}: v12 options require a v12-signature/<sound-id> instrument`);
      continue;
    }
    const sound = catalog.sounds.find(s => PREFIX + s.id === part.instrument);
    if (!sound) fail(`${part.id}: unknown V12 sound ${part.instrument}`);
    // Continuous instrument controls have no meaning on a recorded sample. Fail explicitly.
    for (const k of ['macro', 'controls', 'offsets', 'expression', 'setup', 'breaths', 'motion', 'overtone'] as const)
      if (part[k] !== undefined) fail(`${part.id}.${k}: unsupported on V12 samples`);
    for (const ph of part.phrases ?? []) {
      if (ph.fit !== undefined && ph.fit !== 'error') fail(`${part.id}: V12 supports fit:error only; transpose the motif explicitly`);
      const motif = all.get(ph.motif);
      if (!motif) continue; // canonical lowerer reports unknown motifs
      let cell = expandMotif(motif, all, keyOf(score.key));
      for (const t of ph.transforms ?? []) cell = applyTransform(cell, t);
      for (const n of cell.notes) {
        if (n.articulation !== undefined || n.slide !== undefined || Object.keys(n.params ?? {}).length)
          fail(`${part.id}: sample motifs do not support articulations, slides or per-note params`);
        if (n.gesture && !['accent', 'soft', 'short'].includes(n.gesture))
          fail(`${part.id}: unsupported sample gesture ${n.gesture}; use accent, soft or short`);
      }
    }
    const options = sampleOptions(part, sound!);
    const bytes = readFileSync(join(PACK, sound!.file));
    if (sha256(bytes) !== sound!.sha256) fail(`${sound!.file}: differs from the original catalog hash`);
    const decoded = decodePcm(bytes);
    if (!decoded.pcm) fail(`${sound!.file}: ${decoded.error}`);
    const pcm = decoded.pcm!;
    if (pcm.channels !== sound!.channels || pcm.frames !== sound!.frames) fail(`${sound!.file}: catalog layout mismatch`);
    samples.set(part.id, { sound: sound!, options, pcm });
    delete part.v12;
    part.instrument = PROXY;
    part.gainDb ??= -6;
    part.room ??= 0;
    part.context ??= false;
  }
  const lowered: LoweredScore | undefined = score.schema === 'daemonv12.signature-rack.score/2' ? lowerScore(score) : undefined;
  const normalized = normalizeScore(lowered?.score ?? score);
  for (const part of normalized.parts) if (samples.has(part.id)) {
    const { sound, options } = samples.get(part.id)!;
    for (const n of part.perf.notes) {
      if (n.articulation !== undefined || n.slide !== undefined || Object.keys(n.params ?? {}).length)
        fail(`${part.id}: sample notes do not support articulations, slides or per-note params`);
      if (options.mode === 'pitched') n.pitch += normalized.transpose; // context proxy never transposes
      if (!Number.isFinite(n.pitch) || n.pitch < 0 || n.pitch > 127) fail(`${part.id}: invalid MIDI pitch ${n.pitch}`);
      const rate = options.mode === 'pitched' ? 2 ** ((n.pitch - sound.rootMidi!) / 12) : 1;
      if (rate < 0.25 || rate > 4) fail(`${part.id}: pitch ${n.pitch} exceeds the sampler's +/-24 semitone range from ${sound.rootMidi}`);
    }
  }
  return { normalized, lowered, samples, originals, catalog, catalogSha256: sha256(catalogBytes) };
}

/** Renders mixed rack/V12 scores at 44.1 kHz. Float channels use amplitude units (CRUSH compatible).
 * Exported stems include the score master gain; room is a separate wet stem. Their sum is audio.
 * Rack-only scores follow precisely the existing rendering/mixdown path, including part seed indices.
 */
export async function renderBridge(input: BridgeScore | ScoreInput) {
  const bad = verifyFrozen();
  if (bad.length) fail(`frozen-file integrity failed:\n${bad.join('\n')}`);
  const p = prepare(input), s = p.normalized;
  const frames = engineEndFrames(s.endBeat, s.bpm, s.tailSeconds);
  const parts: RenderedPart[] = [], events: BridgeEvent[] = [], cache = new VoiceSampleCache();
  for (const [partIndex, part] of s.parts.entries()) {
    const sample = p.samples.get(part.id), triggers: PcmTrigger[] = [];
    for (const [i, n] of part.perf.notes.entries()) {
      // NormalizeScore already applied swing/humanization. Match the rack's actual placement,
      // including off-grid beats; do not snap them a second time to the engine's 960 PPQ.
      const frame = Math.round(n.beat * s.beatSeconds * PCM_RATE);
      const noteEndFrame = Math.round((n.beat + n.beats) * s.beatSeconds * PCM_RATE);
      const e: BridgeEvent = { id: `${part.id}.n${i}`, part: part.id, instrument: p.originals.get(part.id)!,
        beat: n.beat, beats: n.beats, pitch: n.pitch, velocity: n.velocity, frame, noteEndFrame };
      if (sample) {
        const { sound, options, pcm } = sample;
        const playback = { rate: options.mode === 'pitched' ? 2 ** ((n.pitch - sound.rootMidi!) / 12) : 1, offset: 0 };
        const articulation = { attack: Math.round(options.attackSeconds * PCM_RATE), release: Math.round(options.releaseSeconds * PCM_RATE),
          ...(options.gate ? { stop: noteEndFrame - frame } : {}) };
        const naturalEndFrame = frame + voiceFrames(pcm, playback);
        const endFrame = n.velocity === 0 ? frame : Math.min(frames, frame + voiceFrames(pcm, playback, articulation));
        e.sample = { file: `packs/v12-signature-v1/${sound.file}`, sha256: sound.sha256, rootMidi: sound.rootMidi, kitPitch: sound.kitPitch,
          mode: options.mode, rate: playback.rate, channels: pcm.channels, gate: options.gate,
          attackFrames: articulation.attack, releaseFrames: articulation.release, naturalEndFrame, endFrame,
          truncated: endFrame < naturalEndFrame };
        if (n.velocity > 0) triggers.push({ frame, velocity: n.velocity, pcm, playback, articulation });
      }
      events.push(e);
    }
    let audio: Stereo;
    if (sample) {
      // Reuse the production sampler: its interpolation, envelope, stereo and resource guards.
      const interleaved = sumFloatPrecise(triggers, frames, frames, cache);
      audio = [new Float64Array(frames), new Float64Array(frames)];
      for (let i = 0; i < frames; i++) {
        audio[0][i] = interleaved[2 * i]! / 32768;
        audio[1][i] = interleaved[2 * i + 1]! / 32768;
      }
    } else {
      audio = await part.instrument.render(part.perf, { bpm: s.bpm, beatSeconds: s.beatSeconds, swing: s.swing,
        key: s.key, seed: s.seed, frames, partIndex });
    }
    parts.push({ part, audio });
  }
  const mixes = await mixdown({ score: s, frames, parts });
  const master = 10 ** (s.masterGainDb / 20), stems = new Map<string, Stereo>();
  for (const [id, st] of mixes.stems) stems.set(id, [st[0].map(v => v * master), st[1].map(v => v * master)]);
  stems.set('room', [mixes.room[0].map(v => v * master), mixes.room[1].map(v => v * master)]);
  return { audio: mixes.context, stems, manifest: {
    schema: 'daemonv12.v12-motif-bridge/1', bridgeVersion: BRIDGE_VERSION,
    title: s.title, sampleRate: PCM_RATE, frames, bpm: s.bpm, beatSeconds: s.beatSeconds, endBeat: s.endBeat,
    tailSeconds: s.tailSeconds, masterGainDb: s.masterGainDb,
    timing: 'actual normalized note onsets; nearest absolute frame, no second PPQ quantization; noteEndFrame is nominal gate release onset, not rack acoustic end',
    stemConvention: 'all stems include master gain; sum all parts and room to reconstruct master before quantization',
    scoreSha256: sha256(Buffer.from(JSON.stringify(input))), catalogSha256: p.catalogSha256,
    provenanceFile: 'packs/v12-signature-v1/PROVENANCE.md',
    provenanceSha256: sha256(readFileSync(join(PACK, 'PROVENANCE.md'))), provenance: p.catalog.provenance, license: p.catalog.license,
    frozenFilesVerified: true, warnings: p.lowered?.problems ?? [],
    // Symbolic provenance only; actual normalized/humanized notes are authoritative in events.
    phrases: p.lowered?.phrases ?? [], events, interpolation: cache.provenance(),
  } };
}

/** PCM24 preserves fractional sampler/mix results. No limiting or hidden normalization. */
export function bridgeWav(audio: Stereo): Buffer {
  if (audio[0].length !== audio[1].length) fail('unequal stereo channel lengths');
  const samples = new Float64Array(audio[0].length * 2);
  for (let i = 0; i < audio[0].length; i++) { samples[2 * i] = audio[0][i]! * 32768; samples[2 * i + 1] = audio[1][i]! * 32768; }
  const encoded = quantize24(samples);
  if (encoded.clippedSamples) fail(`${encoded.clippedSamples} samples would clip; lower part/master gain`);
  return encoded.bytes;
}
