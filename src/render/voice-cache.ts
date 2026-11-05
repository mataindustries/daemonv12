// Opt-in exact interpolation reuse. Cached values are unrounded source samples;
// velocity and the final voice envelope still run independently at each onset.
import type { Pcm } from './pcm.ts';
import { voiceCost, voiceFrames, voiceSamples, PLAYBACK_WORK_LIMIT, PLAYBACK_VOICE_BYTES_LIMIT,
  type VoicePlayback, type VoiceArticulation } from './playback.ts';

export function voiceReuseKey(pcm: Pcm, playback?: VoicePlayback, limit = Infinity, articulation?: VoiceArticulation): string | undefined {
  if (!playback || (playback.rate === 1 && !playback.glide)) return undefined;
  const frames = Math.max(0, Math.min(limit, voiceFrames(pcm, playback, articulation)));
  if (!frames) return undefined;
  // Explicit end also changes the interpolation's lower tap bound to offset.
  // stop/attack/release affect the rendered length or later gain, never its samples.
  return JSON.stringify([playback.rate, playback.offset, playback.glide?.to ?? null,
    playback.glide?.frames ?? null, articulation?.end ?? null, frames]);
}

export class VoiceSampleCache {
  private readonly sources = new Map<Pcm, Map<string, Float64Array>>();
  private work = 0;
  private bytes = 0;
  private misses = 0;
  private hits = 0;
  samples(pcm: Pcm, playback?: VoicePlayback, limit = Infinity, articulation?: VoiceArticulation): Int16Array | Float64Array {
    const key = voiceReuseKey(pcm, playback, limit, articulation);
    if (key === undefined) return voiceSamples(pcm, playback, limit, articulation);
    const stored = this.sources.get(pcm)?.get(key);
    if (stored) { this.hits++; return stored; }
    const cost = voiceCost(pcm, playback, limit, articulation);
    if (this.work + cost.work > PLAYBACK_WORK_LIMIT || this.bytes + cost.bytes > PLAYBACK_VOICE_BYTES_LIMIT)
      throw new RangeError('Interpolation reuse exceeds its preflight work or total cache memory budget.');
    const samples = voiceSamples(pcm, playback, limit, articulation) as Float64Array;
    let entries = this.sources.get(pcm);
    if (!entries) { entries = new Map(); this.sources.set(pcm, entries); }
    entries.set(key, samples);
    this.work += cost.work; this.bytes += samples.byteLength; this.misses++;
    return samples;
  }
  provenance() {
    return { algorithm: 'exact-interpolation-reuse-v1', interpolationTaps: this.work,
      cachedBytes: this.bytes, uniqueVoices: this.misses, reusedVoices: this.hits,
      workLimit: PLAYBACK_WORK_LIMIT, cacheBytesLimit: PLAYBACK_VOICE_BYTES_LIMIT,
      scope: 'one render; source PCM identity, playback rate/glide/offset, explicit endpoint and rendered frame count; velocity/envelope per onset; full continuous track/master processing' };
  }
}
