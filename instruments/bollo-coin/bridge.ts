/** Opt-in adapter. Existing bridge/motif/rack modules and registries remain byte-for-byte intact. */
import { renderBridge, type BridgeScore, type BridgeEvent } from '../../studio-001/v12-bridge/bridge.ts';
import { sha256 } from '../../studio-001/rack/frozen.ts';
import { panGains } from '../../studio-001/rack/render.ts';
import { renderCoin, coinOptions, COIN_VERSION, SR, type CoinOptions, type Stereo, type CoinPlan } from './coin.ts';

export type CoinBridgeScore = Omit<BridgeScore, 'parts'> & {
  parts: (BridgeScore['parts'][number] & { coin?: CoinOptions })[];
};
export interface CoinBridgeEvent { id: string; part: string; frame: number; naturalEndFrame: number; endFrame: number; truncated: boolean; plan: CoinPlan }
export async function renderCoinBridge(input: CoinBridgeScore) {
  const score = structuredClone(input), coins = new Map<string, { options: Required<CoinOptions>; gain: number; pan: number }>();
  for (const part of score.parts) {
    if (part.instrument !== 'bollo-coin') {
      if (part.coin !== undefined) throw new Error(`${part.id}: coin options require bollo-coin`);
      continue;
    }
    // Let the ORIGINAL bridge expand motifs, swing/humanization and exact absolute frame timing.
    // Its existing sample path rejects unsupported gestures/params. The temporary ghost-tick stem
    // is completely replaced below, never mixed into the delivered coin audio.
    for (const k of ['v12', 'macro', 'controls', 'offsets', 'expression', 'setup', 'breaths', 'motion', 'overtone'] as const)
      if (part[k] !== undefined) throw new Error(`${part.id}.${k}: unsupported on bollo-coin; use coin options`);
    if (part.room !== undefined && part.room !== 0) throw new Error(`${part.id}: coin room must be 0 in adapter v1`);
    const gainDb = part.gainDb ?? 0, pan = part.pan ?? 0;
    if (!Number.isFinite(gainDb) || gainDb < -60 || gainDb > 12 || !Number.isFinite(pan) || Math.abs(pan) > 1) throw new RangeError(`${part.id}: invalid gainDb/pan`);
    coins.set(part.id, { options: coinOptions(part.coin), gain: 10 ** (gainDb / 20), pan });
    delete part.coin; part.instrument = 'v12-signature/ghost-tick';
    part.gainDb = 0; part.pan = 0; part.room = 0;
  }
  const base = await renderBridge(score), events: BridgeEvent[] = [], coinEvents: CoinBridgeEvent[] = [];
  const frames = base.manifest.frames, master = 10 ** (base.manifest.masterGainDb / 20);
  // Leave the ordinary bridge's sum order and all sample/rack seed indices untouched when unused.
  if (!coins.size) return { ...base, manifest: { ...base.manifest, bolloVersion: COIN_VERSION, coinEvents } };
  for (const [id] of coins) base.stems.set(id, [new Float64Array(frames), new Float64Array(frames)]);
  for (const e of base.manifest.events) {
    const coin = coins.get(e.part);
    if (!coin) { events.push(e); continue; }
    const { sample: _sample, ...ordinary } = e;
    events.push({ ...ordinary, instrument: 'bollo-coin' });
    const seed = (coin.options.seed + Math.imul(coinEvents.filter(x => x.part === e.part).length, 0x9e3779b9)) >>> 0;
    // A note's velocity changes incoming mechanical speed AND acoustic impulse, not just output volume.
    const r = renderCoin({ ...coin.options, velocity: coin.options.velocity * e.velocity, seed });
    const naturalEndFrame = e.frame + r.plan.frames, endFrame = Math.min(frames, naturalEndFrame);
    const event = { id: e.id, part: e.part, frame: e.frame, naturalEndFrame, endFrame, truncated: endFrame < naturalEndFrame, plan: r.plan };
    coinEvents.push(event);
    const stem = base.stems.get(e.part)!, pans = panGains(coin.pan);
    for (let c = 0; c < 2; c++) for (let i = 0; i < endFrame - e.frame; i++) {
      // A capped acoustic tail has a 5 ms release; nominal note gates never interrupt coin motion.
      const fade = event.truncated ? Math.min(1, Math.max(0, (endFrame - e.frame - i - 1) / 220)) : 1;
      stem[c]![e.frame + i] = stem[c]![e.frame + i]! + r.audio[c]![i]! * coin.gain * pans[c]! * master * fade;
    }
  }
  const audio: Stereo = [new Float64Array(frames), new Float64Array(frames)];
  for (const st of base.stems.values()) for (let c = 0; c < 2; c++) for (let i = 0; i < frames; i++) audio[c]![i] = audio[c]![i]! + st[c]![i]!;
  return { audio, stems: base.stems, manifest: { ...base.manifest, schema: 'daemonv12.bollo-coin-bridge/1',
    scoreSha256: sha256(Buffer.from(JSON.stringify(input))), bolloVersion: COIN_VERSION, events, coinEvents,
    coinTiming: 'same absolute frames as original bridge; pitch ignored; note velocity scales incoming speed; natural physical release, nominal gate ignored; coin room send unsupported' } };
}
