/**
 * BOLLO · A-to-S mix pass. The approved score (../bollo/score.json, ../bollo/closing-hit.score.json) keeps every
 * note, tempo and coin mechanic; B1/B2 change only coin *tone* parameters that do not touch the mechanics
 * (damping, hardness) and the mix.
 *
 *   node sound-lab/upgrade/bollo.ts [output-dir]        (default sound-lab/upgrade/audio/bollo)
 *
 * `ORIGINAL` reproduces ../bollo/build.ts's sketch exactly (float SHA-256 checked against the committed
 * REPORT.json before anything is written). Coin contact timing is checked frame-for-frame against the original.
 */
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { tmpdir } from 'node:os';
import { fileURLToPath } from 'node:url';
import { renderCoinBridge, type CoinBridgeScore } from '../../instruments/bollo-coin/bridge.ts';
import { coinModes } from '../../instruments/bollo-coin/coin.ts';
import { SR, type Stereo, sum, gainDb, mono, hp, bell, crushed, clipTo, duck, room, ride, shelfHi, cycle, fadeOut, writeAudio, ampDb, peak, rms, truePeak } from '../lib.ts';
import { shape, taps, band, cachedStems, floatSha, chain, delayed, matchLoudness, qa, round } from './tools.ts';

const HERE = dirname(fileURLToPath(import.meta.url));
const OUT = process.argv[2] ?? join(HERE, 'audio', 'bollo');
const SCRATCH = process.env.SOUNDLAB_SCRATCH ?? join(tmpdir(), 'soundlab-upgrade');
const load = (f: string) => JSON.parse(readFileSync(join(HERE, '..', 'bollo', f), 'utf8')) as CoinBridgeScore;
const SCORE = load('score.json'), CLOSING = load('closing-hit.score.json');
const ORIGINAL_SHA = (JSON.parse(readFileSync(join(HERE, '..', 'bollo', 'audio', 'REPORT.json'), 'utf8')) as { floatSha256: { sketch: string } }).floatSha256.sketch;
const BPM = 105, BEAT = 60 / BPM * SR, LOOP = 16 * BEAT;
const COINS = ['guiro', 'face', 'rim', 'bounce', 'spin', 'drop1', 'drop2', 'drop3'] as const;
type Coin = typeof COINS[number];

export interface BolloSettings {
  name: string; note: string;
  /** Coin TONE overrides per part. Only damping, hardness and material are allowed: none of them moves a contact. */
  coinTone?: Partial<Record<Coin, { damping?: number; hardness?: number; material?: number }>>;
  coinGain: Record<Coin, number>;
  coinBus: { shelfHz: number; shelfDb: number; roomDb: number; roomRt60: number; spinRide: [number, number];
    /** per-part cut at the coin's own lowest mode pair (the pitched "ting"), dB and Q */
    fundamentalCut?: { db: number; q: number };
    /** keyed by every physical contact: ring after `holdMs` falls to `sustainDb` (dry, short coins) */
    damp?: { attackDb: number; holdMs: number; releaseMs: number; sustainDb: number };
    /** lift where the floor slap lives (the table contact, 0.8-2 kHz) */
    contact?: { hz: number; db: number; q: number };
    /** short multi-tap clatter on the struck parts (B2), [ms, dB, pan] */
    clatter?: { parts: Coin[]; taps: [number, number, number][]; hpHz: number };
    /** parallel CRUSH on the coin bus, band-limited (B2) */
    grit?: { lo: number; hi: number; amount: number; levelDb: number };
    /** extra level on the call/answer accents (B2) */
    accentDb?: Partial<Record<Coin, number>>;
    /** synth bus ducked under the face call (B2): dB */
    synthUnderCallDb?: number;
    /** CRUSH soft clip on the coin bus with its ceiling this many dB from the band's peak: only the sub-millisecond
     *  contact spikes are shaved here, so the master clipper no longer has to (B1/B2) */
    tipClipRelBandDb?: number };
  band: { kick: number; clap: number; bass: number; lead: number; lead2: number; skank: number };
  pushDb: number;
}
export const ORIGINAL: BolloSettings = {
  name: 'original', note: 'The approved BOLLO-A-sketch mix, reproduced exactly.',
  coinGain: { guiro: 11, face: 8, rim: 9, bounce: 19, spin: 13, drop1: 11, drop2: 11, drop3: 11 },
  coinBus: { shelfHz: 6500, shelfDb: 4, roomDb: -10, roomRt60: 0.45, spinRide: [0, 12] },
  band: { kick: 1.5, clap: -4, bass: 9, lead: -3, lead2: -6, skank: -8 }, pushDb: 3,
};
const METAL: BolloSettings['coinTone'] = {
  // Damping to the top of its range and the hardest contact: shorter ring, sharper force pulse, the instrument's own
  // low-pass opened from ~10.5 to 11 kHz. Restitution, spin, velocity, size, strike and seed are untouched.
  guiro: { damping: 1, hardness: 1 }, face: { damping: 1, hardness: 1 }, rim: { damping: 1, hardness: 1 },
  bounce: { damping: 0.9, hardness: 1 }, spin: { damping: 0.85, hardness: 1 },
  drop1: { damping: 1, hardness: 1 }, drop2: { damping: 1, hardness: 1 }, drop3: { damping: 1, hardness: 1 },
};
export const B1: BolloSettings = {
  name: 'B1-quarters', note: 'Short, dry, sharp: damped coins, the pitched lowest mode cut, contact lifted, room nearly gone.',
  coinTone: METAL,
  coinGain: { guiro: 16, face: 14, rim: 14, bounce: 24, spin: 18, drop1: 16, drop2: 16, drop3: 16 },
  coinBus: { shelfHz: 7000, shelfDb: 3, roomDb: -20, roomRt60: 0.3, spinRide: [0, 12],
    fundamentalCut: { db: -6, q: 5 }, damp: { attackDb: 1, holdMs: 6, releaseMs: 18, sustainDb: -9 }, contact: { hz: 1400, db: 3, q: 0.8 }, tipClipRelBandDb: -2.5 },
  band: ORIGINAL.band, pushDb: 3,
};
export const B2: BolloSettings = {
  name: 'B2-party-money', note: 'The quarters, exaggerated: clatter taps, gritty parallel coins, louder call accents, synth tucked under the call.',
  coinTone: METAL,
  coinGain: { guiro: 14, face: 12, rim: 12, bounce: 22, spin: 17, drop1: 15, drop2: 15, drop3: 15 },
  coinBus: { shelfHz: 7000, shelfDb: 3, roomDb: -15, roomRt60: 0.35, spinRide: [0, 12],
    fundamentalCut: { db: -4, q: 5 }, damp: { attackDb: 2, holdMs: 6, releaseMs: 22, sustainDb: -7 }, contact: { hz: 1400, db: 4, q: 0.8 },
    clatter: { parts: ['guiro', 'face', 'rim'], taps: [[9, -9, -0.7], [17, -12, 0.7], [28, -16, -0.3]], hpHz: 1200 },
    grit: { lo: 1500, hi: 9000, amount: 0.8, levelDb: -11 }, accentDb: { face: 3, rim: 2 }, synthUnderCallDb: 3, tipClipRelBandDb: -2 },
  band: ORIGINAL.band, pushDb: 3,
};

const withTone = (s: CoinBridgeScore, tone: BolloSettings['coinTone']): CoinBridgeScore => !tone ? s :
  { ...s, parts: (s.parts as { id: string; coin?: object }[]).map(p => p.coin && tone[p.id as Coin] ? { ...p, coin: { ...p.coin, ...tone[p.id as Coin] } } : p) as never };
type Render = { stems: Map<string, Stereo>; manifest: { events: { part: string; frame: number }[]; coinEvents: { part: string; frame: number; plan: { contacts: { frame: number }[] } }[] } };
const render = (s: CoinBridgeScore) => cachedStems({ bollo: s }, () => renderCoinBridge(s) as never) as unknown as Promise<Render>;

function mix(r: Render, s: BolloSettings, score: CoinBridgeScore, spinFrame?: number) {
  const raw = r.stems, n = raw.get('kick')![0].length, st = (id: string) => raw.get(id) ?? ([new Float64Array(n), new Float64Array(n)] as Stereo);
  const kickFrames = r.manifest.events.filter(e => e.part === 'kick').map(e => e.frame), C = s.coinBus;
  const contacts = (part: string) => r.manifest.coinEvents.filter(e => e.part === part).flatMap(e => e.plan.contacts.map(c => e.frame + c.frame));
  const coinOf = (id: Coin) => {
    let x = id === 'spin' && spinFrame !== undefined ? ride(st('spin'), spinFrame, spinFrame + Math.round(2 * BEAT), C.spinRide[0], C.spinRide[1]) : st(id);
    if (C.fundamentalCut) {
      const part = (score.parts as { id: string; coin?: object }[]).find(p => p.id === id);
      if (part?.coin) { const m = coinModes(part.coin); x = bell(bell(x, m[0]!.hz, C.fundamentalCut.db, C.fundamentalCut.q), m[1]!.hz, C.fundamentalCut.db / 2, C.fundamentalCut.q); }
    }
    if (C.damp) x = shape(x, contacts(id), { ...C.damp, recoverMs: 0 });
    return gainDb(x, s.coinGain[id] + (C.accentDb?.[id] ?? 0));
  };
  const parts = Object.fromEntries(COINS.map(id => [id, coinOf(id)])) as Record<Coin, Stereo>;
  let coinDry = shelfHi(sum(...COINS.map(id => parts[id])), C.shelfHz, C.shelfDb);
  if (C.contact) coinDry = bell(coinDry, C.contact.hz, C.contact.db, C.contact.q);
  if (C.clatter) coinDry = sum(coinDry, hp(taps(sum(...C.clatter.parts.map(id => parts[id])), C.clatter.taps), C.clatter.hpHz));
  if (C.grit) coinDry = sum(coinDry, gainDb(band(crushed(coinDry, C.grit.amount), C.grit.lo, C.grit.hi), C.grit.levelDb));
  let coin = sum(coinDry, gainDb(room(hp(coinDry, 800), C.roomRt60, 800, 250, 4), C.roomDb));
  const B = s.band, kick = gainDb(st('kick'), B.kick), clap = gainDb(hp(st('clap'), 300), B.clap);
  let bass = duck(gainDb(mono(hp(st('bass'), 28)), B.bass), kickFrames, 5, 20, 140);
  let synth = sum(gainDb(hp(st('lead'), 220), B.lead), gainDb(hp(st('lead2'), 220), B.lead2), gainDb(hp(st('skank'), 300), B.skank));
  bass = crushed(bass, 0.7, { mix: 0.6 }); synth = crushed(synth, 0.7, { mix: 0.5 });
  synth = duck(sum(synth, gainDb(room(synth, 0.9, 400, 105), -13)), kickFrames, 2.5, 15, 130);
  if (C.synthUnderCallDb) synth = duck(synth, r.manifest.coinEvents.filter(e => e.part === 'face').map(e => e.frame), C.synthUnderCallDb, 25, 90);
  const bandBus = sum(kick, clap, bass, synth);
  if (C.tipClipRelBandDb !== undefined) { const g = -ampDb(peak(bandBus)); coin = gainDb(clipTo(gainDb(coin, g), C.tipClipRelBandDb), -g); }
  return { coin, band: bandBus, total: sum(coin, bandBus), stems: { coins: coin, kick, clap, bass, synth }, kickFrames };
}
const arrange = (b: Stereo, h: Stereo, cycles: number) => sum(cycle(b, LOOP, cycles), delayed(h, cycles * LOOP));
async function master(s: BolloSettings) {
  const score = withTone(SCORE, s.coinTone), closing = withTone(CLOSING, s.coinTone);
  const main = await render(score), end = await render(closing);
  const spinFrame = main.manifest.coinEvents.find(e => e.part === 'spin')!.frame;
  const body = mix(main, s, score, spinFrame), hit = mix(end, s, closing);
  const drive = s.pushDb - 1 - ampDb(peak(arrange(body.band, hit.band, 1)));
  const finish = (x: Stereo) => fadeOut(clipTo(gainDb(x, drive), -1), 20);
  const trim = -1 - ampDb(truePeak(finish(arrange(body.total, hit.total, 1))));
  const out = (cycles: number) => gainDb(finish(arrange(body.total, hit.total, cycles)), trim);
  const stems = Object.fromEntries(Object.entries(body.stems).map(([id, x]) => [id, arrange(x, hit.stems[id as keyof typeof hit.stems], 1)]));
  const coinsOnly = arrange(body.coin, hit.coin, 1);
  return { single: out(1), three: out(3), stems, stemGain: drive + trim, coinsOnly, kickFrames: body.kickFrames, contacts: main.manifest.coinEvents.flatMap(e => e.plan.contacts.map(c => e.frame + c.frame)), drive, trim };
}

// ------------------------------------------------------------------------------------------------- delivery
const only = (process.env.BOLLO_ONLY ?? 'B1,B2').split(',');
const variants = [B1, B2].filter(v => only.some(o => v.name.startsWith(o)));
const results: Record<string, Awaited<ReturnType<typeof master>>> = { original: await master(ORIGINAL) };
const sha = floatSha(results.original!.single);
if (sha !== ORIGINAL_SHA) throw new Error(`ORIGINAL mix does not reproduce the approved sketch: ${sha} != ${ORIGINAL_SHA}`);
for (const v of variants) {
  results[v.name] = await master(v);
  const a = results.original!.contacts, b = results[v.name]!.contacts;
  if (a.length !== b.length || a.some((f, i) => f !== b[i])) throw new Error(`${v.name}: coin contact timing changed`);
}
mkdirSync(OUT, { recursive: true });
const matched = matchLoudness(Object.fromEntries(Object.entries(results).map(([k, r]) => [k, r.single])), SCRATCH);
const label = (k: string) => k === 'original' ? 'BOLLO-original' : `BOLLO-${k}`;
const report: Record<string, unknown> = {};
// Coins-only auditions share one gain (the loudest version at -1 dBTP), so their levels compare directly.
const coinGain = -1 - Math.max(...Object.values(results).map(r => ampDb(truePeak(r.coinsOnly))));
for (const [k, x] of Object.entries(matched.out)) {
  const r = results[k]!, g = matched.gains[k]!, p = join(OUT, `${label(k)}.wav`); writeAudio(p, x);
  const three = gainDb(r.three, g), p3 = join(OUT, `${label(k)}-three-cycles.wav`); writeAudio(p3, three);
  const coinsOnly = gainDb(r.coinsOnly, coinGain), pc = join(OUT, `${label(k)}-coins-only.wav`); writeAudio(pc, fadeOut(coinsOnly, 20));
  report[k] = { matchGainDb: g, coinBusPeakIntoClipperDbfs: round(ampDb(peak(r.stems.coins!)) + r.drive), single: qa(x, p, { onsets: r.kickFrames }), threeCycles: qa(three, p3, { loopFrames: Math.round(LOOP) }),
    coinsOnly: { ...qa(coinsOnly, pc, { onsets: r.contacts }), note: 'one shared gain for every version (the loudest at -1 dBTP), so coin levels compare directly' } };
}
const order = Object.keys(matched.out);
writeAudio(join(OUT, `BOLLO-AB-${order.map(k => k === 'original' ? 'orig' : k.split('-')[0]).join('-')}.wav`), chain(order.map(k => matched.out[k]!), SR));
writeAudio(join(OUT, `BOLLO-AB-coins-only-${order.map(k => k === 'original' ? 'orig' : k.split('-')[0]).join('-')}.wav`), chain(order.map(k => gainDb(results[k]!.coinsOnly, coinGain)), SR / 2));
for (const v of variants) { const r = results[v.name]!, sg = Math.min(r.stemGain, -0.5 - Math.max(...Object.values(r.stems).map(x => ampDb(truePeak(x)))));
  for (const [id, x] of Object.entries(r.stems)) writeAudio(join(OUT, 'stems', v.name, `${id}.wav`), fadeOut(gainDb(x, sg), 20)); }
writeFileSync(join(OUT, 'REPORT.json'), JSON.stringify({ title: 'BOLLO A-to-S mix pass', loudnessTargetLufs: matched.target, originalFloatSha256: sha, originalReproduced: true,
  coinContactTimingIdentical: true, settings: Object.fromEntries([ORIGINAL, ...variants].map(v => [v.name, v])), files: report }, null, 1) + '\n');
for (const [k, v] of Object.entries(report)) console.log(k, JSON.stringify(v));
