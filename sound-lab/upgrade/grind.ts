/**
 * GRIND · A-to-S mix pass. The approved score (../grind/score.json) is rendered unchanged; only the mix moves.
 *
 *   node sound-lab/upgrade/grind.ts [output-dir]        (default sound-lab/upgrade/audio/grind)
 *
 * `ORIGINAL` reproduces ../grind/build.ts's processed mix exactly (its float SHA-256 is checked against the
 * committed REPORT.json before anything is written). G1 and G2 are that mix with named settings changed.
 */
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { tmpdir } from 'node:os';
import { fileURLToPath } from 'node:url';
import { renderBridge } from '../../studio-001/v12-bridge/bridge.ts';
import { SR, type Stereo, sum, gainDb, toPeak, mono, hp, lp, bell, shelfHi, crushed, clipTo, duck, room, ride, cycle, fadeOut, writeAudio, ampDb, peak, rms, truePeak } from '../lib.ts';
import { shape, band, cachedStems, floatSha, chain, matchLoudness, qa, monoCheck, round } from './tools.ts';

const HERE = dirname(fileURLToPath(import.meta.url));
const OUT = process.argv[2] ?? join(HERE, 'audio', 'grind');
const SCRATCH = process.env.SOUNDLAB_SCRATCH ?? join(tmpdir(), 'soundlab-upgrade');
const score = JSON.parse(readFileSync(join(HERE, '..', 'grind', 'score.json'), 'utf8'));
const ORIGINAL_SHA = (JSON.parse(readFileSync(join(HERE, '..', 'grind', 'audio', 'REPORT.json'), 'utf8')) as { floatSha256: { crush: string } }).floatSha256.crush;
const BPM = 140, BEAT = Math.round(60 / BPM * SR), LOOP = 16 * BEAT;

/** Every mix decision as data. Unset optional fields mean "exactly what the original did". */
export interface GrindSettings {
  name: string; note: string;
  kick: { hammerPeak: number; clickPeak: number; clickHp: number; ownClipDb: number | null; transient?: { attackDb: number; holdMs: number; releaseMs: number; sustainDb: number; recoverMs: number } };
  bass: { duckDb: number; duckHoldMs: number; duckReleaseMs: number; crush: { amount: number; pushDb: number; mix: number }; peak: number;
    /** parallel growl: the 808 above `hpHz`, crushed hard, blended under the main 808 (G2) */
    grit?: { hpHz: number; lpHz: number; amount: number; pushDb: number; levelDb: number; rideBars34Db: number;
      /** duck the growl itself under each kick, after CRUSH (whose drive lifts the 808's ducked gap back up) */
      kickDuck?: { db: number; holdMs: number; releaseMs: number } };
    /** a cut in the 808 where the kick's punch lives, so the two stop competing (G1) */
    kickPocket?: { hz: number; db: number; q: number } };
  snare: { crush: { amount: number; mix: number }; peak: number; clapPeak: number; presence?: { hz: number; db: number } };
  hats: { tickPeak: number; openPeak: number; shelf?: { hz: number; db: number } };
  music: { bellPeak: number; choirPeak: number; choirLp: number; duckDb: number; bellPresence?: { hz: number; db: number; q: number }; choirCrush?: { amount: number; mix: number } };
  master: { pushDb: number; /** clip the non-kick bus first by this much, so the master clipper meets the kick with less (G1/G2) */ busPushDb?: number };
}
export const ORIGINAL: GrindSettings = {
  name: 'original', note: 'The approved GRIND-B-crush mix, reproduced exactly.',
  kick: { hammerPeak: -4, clickPeak: -10, clickHp: 120, ownClipDb: -3.5 },
  bass: { duckDb: 14, duckHoldMs: 45, duckReleaseMs: 90, crush: { amount: 0.7, pushDb: 3, mix: 0.8 }, peak: -4 },
  snare: { crush: { amount: 0.7, mix: 0.6 }, peak: -3.5, clapPeak: -8 },
  hats: { tickPeak: -8, openPeak: -11 },
  music: { bellPeak: -14, choirPeak: -16, choirLp: 3200, duckDb: 2 },
  master: { pushDb: 3 },
};
export const G1: GrindSettings = {
  name: 'G1-punch', note: 'Kick front restored, kick and 808 separated, bell and drone brought forward.',
  // No kick self-clip; a keyed 3 dB lift on the first 7 ms, the body after it 1.5 dB down. The click layer up 3 dB.
  kick: { hammerPeak: -4, clickPeak: -7, clickHp: 120, ownClipDb: -2.5, transient: { attackDb: 2, holdMs: 8, releaseMs: 14, sustainDb: -1, recoverMs: 60 } },
  // 808 held under the kick 20 ms longer and released over the same 90 ms; a 3 dB pocket at the hammer's punch.
  bass: { duckDb: 16, duckHoldMs: 55, duckReleaseMs: 90, crush: { amount: 0.7, pushDb: 3, mix: 0.8 }, peak: -4 },
  snare: { crush: { amount: 0.7, mix: 0.6 }, peak: -3.5, clapPeak: -8 },
  hats: { tickPeak: -7, openPeak: -10, shelf: { hz: 9000, db: 1.5 } },
  music: { bellPeak: -9.5, choirPeak: -13, choirLp: 4500, duckDb: 2, bellPresence: { hz: 2800, db: 3, q: 0.9 } },
  // The 808/snare/music bus takes the clipping (2.5 dB) so the master clipper has only 1 dB left to take off the kick.
  master: { pushDb: 2.5, busPushDb: 4 },
};
export const G2: GrindSettings = {
  name: 'G2-menace', note: 'A crushed mid-range growl under the 808, harder snare, louder drone; contrast from bars 1-2 to 3-4.',
  kick: { hammerPeak: -4, clickPeak: -8, clickHp: 120, ownClipDb: -2.5, transient: { attackDb: 2, holdMs: 6, releaseMs: 14, sustainDb: -1, recoverMs: 60 } },
  bass: { duckDb: 16, duckHoldMs: 55, duckReleaseMs: 90, crush: { amount: 0.8, pushDb: 4, mix: 0.85 }, peak: -4,
    grit: { hpHz: 280, lpHz: 5200, amount: 1, pushDb: 8, levelDb: -7, rideBars34Db: 3 } },
  snare: { crush: { amount: 0.9, mix: 0.75 }, peak: -3.5, clapPeak: -7, presence: { hz: 2200, db: 2.5 } },
  hats: { tickPeak: -8, openPeak: -10.5 },
  music: { bellPeak: -12, choirPeak: -10.5, choirLp: 2600, duckDb: 3, choirCrush: { amount: 0.8, mix: 0.5 } },
  master: { pushDb: 3.5, busPushDb: 5 },
};
/**
 * The owner's pick: G1's kick, separation, bell and headroom with G2's growl, snare, dark drone and bar-3 rise.
 * One pipeline, not two mixes summed: every stage below is G1's setting or G2's, plus one envelope on the growl.
 */
export const FINAL: GrindSettings = {
  name: 'FINAL-hybrid', note: 'G1 PUNCH kick, duck, bell, hats and master; G2 MENACE growl (ducked under the kick), snare and drone.',
  kick: G1.kick,
  // G1's 808 path and duck. The growl rides on top of it, held off each kick so the kick front stays G1's.
  bass: { ...G1.bass, grit: { ...G2.bass.grit!, kickDuck: { db: 18, holdMs: 55, releaseMs: 90 } } },
  snare: G2.snare,
  hats: G1.hats,
  // G1's clear bell with G2's darker, crushed drone, 1 dB under G2's level so the bell stays in front.
  music: { ...G1.music, choirPeak: -11.5, choirLp: G2.music.choirLp, choirCrush: G2.music.choirCrush, duckDb: G2.music.duckDb },
  // G1's clip stages: no extra clipping for the added layer.
  master: G1.master,
};

export interface Mix { stems: Record<string, Stereo>; master: Stereo }
export function mixGrind(raw: Map<string, Stereo>, kickFrames: number[], set: GrindSettings, kickHz: number): Mix {
  const s = (id: string) => raw.get(id)!, K = set.kick, B = set.bass, S = set.snare, H = set.hats, M = set.music;
  let kickRaw = toPeak(sum(toPeak(hp(s('kick'), 40), K.hammerPeak), toPeak(hp(s('click'), K.clickHp), K.clickPeak)), -1);
  if (K.transient) kickRaw = toPeak(shape(kickRaw, kickFrames, K.transient), -1);
  const kick = K.ownClipDb === null ? gainDb(kickRaw, -2.5) : clipTo(kickRaw, K.ownClipDb);
  let bass = duck(toPeak(mono(hp(s('bass808'), 26)), -6), kickFrames, B.duckDb, B.duckHoldMs, B.duckReleaseMs);
  let grit: Stereo | undefined;
  if (B.grit) {
    // Growl layer: only the 808's harmonics above hpHz, driven hard through CRUSH, low-passed so it snarls rather than fizzes.
    grit = lp(crushed(hp(bass, B.grit.hpHz, true), B.grit.amount, { pushDb: B.grit.pushDb }), B.grit.lpHz, true);
    grit = ride(gainDb(grit, B.grit.levelDb), 8 * BEAT - 2205, 8 * BEAT, 0, B.grit.rideBars34Db);
    if (B.grit.kickDuck) grit = duck(grit, kickFrames, B.grit.kickDuck.db, B.grit.kickDuck.holdMs, B.grit.kickDuck.releaseMs);
  }
  bass = toPeak(crushed(bass, B.crush.amount, { pushDb: B.crush.pushDb, mix: B.crush.mix }), B.peak);
  if (B.kickPocket) bass = bell(bass, B.kickPocket.hz || kickHz, B.kickPocket.db, B.kickPocket.q);
  if (grit) bass = sum(bass, gainDb(grit, B.peak - ampDb(peak(bass)) ));
  let snare = sum(toPeak(s('snare'), -4), toPeak(hp(s('clap'), 250), S.clapPeak));
  snare = toPeak(crushed(snare, S.crush.amount, { mix: S.crush.mix }), S.peak);
  if (S.presence) snare = toPeak(bell(snare, S.presence.hz, S.presence.db, 1), S.peak);
  let hats = sum(toPeak(hp(s('hat'), 4000), H.tickPeak), toPeak(hp(s('ohat'), 3000), H.openPeak));
  if (H.shelf) hats = shelfHi(hats, H.shelf.hz, H.shelf.db);
  let bellDry = toPeak(hp(s('bell'), 400), M.bellPeak), choirDry = toPeak(lp(hp(s('choir'), 160), M.choirLp), M.choirPeak);
  if (M.bellPresence) bellDry = toPeak(bell(bellDry, M.bellPresence.hz, M.bellPresence.db, M.bellPresence.q), M.bellPeak);
  if (M.choirCrush) choirDry = toPeak(crushed(choirDry, M.choirCrush.amount, { mix: M.choirCrush.mix }), M.choirPeak);
  const music = duck(sum(bellDry, choirDry, gainDb(room(sum(bellDry, gainDb(choirDry, -4)), 1.6, 400), -3)), kickFrames, M.duckDb, 20, 120);
  const stems = { kick, snare, hats, bass808: bass, music };
  let total: Stereo;
  if (set.master.busPushDb === undefined) total = sum(kick, snare, hats, bass, music);
  else {
    // Bus clip: everything but the kick and hats is pushed into the CRUSH soft clipper at the level it will sit in
    // the master, then the kick and hats are added on top. The fronts that matter most never meet that clipper.
    const rest = sum(snare, bass, music), all = sum(kick, snare, hats, bass, music), g = set.master.pushDb - 1 - ampDb(peak(all));
    const restClipped = gainDb(clipTo(gainDb(rest, g + set.master.busPushDb), -1), -set.master.busPushDb - g);
    total = sum(kick, hats, restClipped);
  }
  const clipped = clipTo(gainDb(total, set.master.pushDb - 1 - ampDb(peak(total))), -1);
  const master = gainDb(clipped, -1 - ampDb(truePeak(clipped)));
  return { stems, master };
}

/** Frequency of the strongest spectral peak 30-200 Hz in the first 80 ms of a single kick (for the 808 pocket). */
function kickPunchHz(kick: Stereo, at: number): number {
  let best = 60, bestP = 0;
  for (let f = 30; f <= 200; f += 1) {
    let re = 0, im = 0; for (let i = 0; i < 3528; i++) { const v = kick[0][at + i]! * (0.5 - 0.5 * Math.cos(2 * Math.PI * i / 3528)); re += v * Math.cos(2 * Math.PI * f * i / SR); im += v * Math.sin(2 * Math.PI * f * i / SR); }
    const p = re * re + im * im; if (p > bestP) { bestP = p; best = f; }
  }
  return best;
}

// ------------------------------------------------------------------------------------------------- delivery
const r = await cachedStems({ grind: score }, () => renderBridge(score as never) as never) as unknown as { stems: Map<string, Stereo>; manifest: { events: { part: string; frame: number }[] } };
const kickFrames = r.manifest.events.filter(e => e.part === 'kick').map(e => e.frame);
const kickHz = kickPunchHz(r.stems.get('kick')!, kickFrames[0]!);
const orig = mixGrind(r.stems, kickFrames, ORIGINAL, kickHz);
const origSha = floatSha(orig.master);
if (origSha !== ORIGINAL_SHA) throw new Error(`ORIGINAL mix does not reproduce the approved master: ${origSha} != ${ORIGINAL_SHA}`);
const only = (process.env.GRIND_ONLY ?? 'G1,G2').split(',');
const variants = [G1, G2, FINAL].filter(v => only.some(o => v.name.startsWith(o)));
const mixes: Record<string, Mix> = { original: orig };
for (const v of variants) mixes[v.name] = mixGrind(r.stems, kickFrames, v, kickHz);

mkdirSync(OUT, { recursive: true });
const singles = Object.fromEntries(Object.entries(mixes).map(([k, m]) => [k, m.master]));
const matched = matchLoudness(singles, SCRATCH);
const label = (k: string) => k === 'original' ? 'GRIND-original' : `GRIND-${k}`;
const report: Record<string, unknown> = {};
const seamOf = (x: Stereo) => fadeOut(cycle(x, LOOP, 3), 30);
/** Final mode (FINAL in GRIND_ONLY): three-cycle, stems and events only for the hybrid; the others are comparison singles. */
const finalMode = variants.includes(FINAL);
/** Kick/808 handover, as in ../grind/build.ts: the band under 150 Hz in 25 ms steps after each kick, averaged over kicks. */
const lowAfterKick = (st: Record<string, Stereo>) => { const low = lp(sum(st.kick!, st.bass808!), 150, true);
  return Array.from({ length: 10 }, (_, k) => round(kickFrames.reduce((a, f) => a + ampDb(rms(low, f + k * 1102, f + (k + 1) * 1102)), 0) / kickFrames.length, 1)); };
if (finalMode) writeFileSync(join(OUT, 'events.json'), JSON.stringify({ schema: (r.manifest as { schema?: string }).schema, bpm: BPM, framesPerBeat: BEAT, loopFrames: LOOP, sampleRate: SR, events: r.manifest.events }) + '\n');
for (const [k, x] of Object.entries(matched.out)) {
  const p = join(OUT, `${label(k)}.wav`); writeAudio(p, x);
  if (finalMode && k !== FINAL.name) { report[k] = { matchGainDb: matched.gains[k], single: qa(x, p, { onsets: kickFrames }), mono: monoCheck(x, SCRATCH), lowBandAfterKickDb: lowAfterKick(mixes[k]!.stems) }; continue; }
  const three = seamOf(x), p3 = join(OUT, `${label(k)}-three-cycles.wav`); writeAudio(p3, three);
  report[k] = { matchGainDb: matched.gains[k], single: qa(x, p, { onsets: kickFrames }), threeCycles: qa(three, p3, { loopFrames: LOOP }),
    ...(finalMode ? { mono: monoCheck(x, SCRATCH), lowBandAfterKickDb: lowAfterKick(mixes[k]!.stems) } : {}) };
}
// A/B/C: one cycle each, original first, 1 s apart, all at the same loudness.
const order = Object.keys(matched.out);
writeAudio(join(OUT, `GRIND-AB-${order.map(k => k === 'original' ? 'orig' : k.split('-')[0]).join('-')}.wav`), chain(order.map(k => matched.out[k]!), SR));
for (const v of finalMode ? [FINAL] : variants) for (const [id, st] of Object.entries(mixes[v.name]!.stems)) writeAudio(join(OUT, 'stems', v.name, `${id}.wav`), st);
writeFileSync(join(OUT, 'REPORT.json'), JSON.stringify({ title: 'GRIND A-to-S mix pass', loudnessTargetLufs: matched.target, kickPunchHz: kickHz,
  originalFloatSha256: origSha, originalReproduced: true, settings: Object.fromEntries([ORIGINAL, ...variants].map(v => [v.name, v])), files: report }, null, 1) + '\n');
for (const [k, v] of Object.entries(report)) { const x = v as { matchGainDb: number; single: Record<string, unknown> }; console.log(k, x.matchGainDb, JSON.stringify(x.single)); }
