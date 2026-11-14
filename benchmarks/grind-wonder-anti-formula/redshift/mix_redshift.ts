/**
 * REDSHIFT mix. Reads the DaemonV12 stem render of ../c-impossible-ascent-redshift.json (build_redshift.py) and mixes it
 * with Gate 2's own tools and recipe (sound-lab helpers, DAEMON//CRUSH). Two things are copied from Gate 2, not
 * re-decided (both measured by gate2_tail.ts from Wonder's unchanged pipeline, see audio/gate2-reference.json):
 *   - the phrase gets Gate 2's exact hook chain AND gain, so Wonder's phrase sounds exactly as it did;
 *   - the master gets Gate 2's exact push -> CRUSH soft clip (-1 dBFS) -> trim, so the extension is mastered like Gate 2
 *     and not separately loudness-maximised.
 * Frame 0 of every output is 28.0 s on the combined timeline (Gate 2's last frame + 1).
 *   audio/REDSHIFT-EXTENSION.wav/.mp3     the new section alone, 13.667 s
 *   audio/GATE2-PLUS-REDSHIFT.wav/.mp3     Gate 2's approved master (PCM bytes unchanged) followed by the extension, 41.667 s
 *   audio/stems/*.wav                      extension stems, pre-master (gate2-tail.wav comes from gate2_tail.ts)
 *   audio/REPORT.json                      measurements only
 *
 *   node benchmarks/grind-wonder-anti-formula/redshift/mix_redshift.ts      (needs FFmpeg; run gate2_tail.ts first)
 */
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { SR, type Stereo, sum, gainDb, toPeak, mono, hp, lp, crushed, clipTo, duck, room, writeAudio, loudness, ampDb, peak, rms, fadeOut } from '../../../sound-lab/lib.ts';
import { readWav, round, truePeak } from '../../../fable-lab/crush/measure.ts';

const HERE = dirname(fileURLToPath(import.meta.url));
const BENCH = join(HERE, '..');
const STEMS = process.env.REDSHIFT_STEMS ?? join(HERE, 'source-render', 'c-impossible-ascent-redshift.stems');
const OUT = process.env.REDSHIFT_OUT ?? join(HERE, 'audio');
const GATE2_MASTER = join(BENCH, 'impossible-ascent-gate2', 'audio', 'IMPOSSIBLE-ASCENT-DEVELOPED.wav');
const CUT = 1234800;                                      // Gate 2's frame count: the extension starts here
mkdirSync(join(OUT, 'stems'), { recursive: true });
const ref = JSON.parse(readFileSync(join(OUT, 'gate2-reference.json'), 'utf8'));
const { hookPreGainDb, masterPushDb, masterTrimDb } = ref.gains as Record<string, number>;

// Engine frame of an absolute tick (144 BPM -> 416667 us per quarter; nearest frame, ties later), as DaemonV12 renders it.
const frameOf = (tick: number) => Number((BigInt(tick) * 416667n * 44100n + 480000000n) / 960000000n);
const proj = JSON.parse(readFileSync(process.env.REDSHIFT_PROJECT ?? join(BENCH, 'c-impossible-ascent-redshift.json'), 'utf8'));
function ticksOf(trackId: string): number[] {
  const t = proj.tracks.find((x: { id: string }) => x.id === trackId);
  const clip = t.clips[0], notes = t.patterns[0].notes as { start: string }[];
  return notes.map(n => {
    const m = /^(\d+):(\d+)(?:\+(\d+)\/(\d+))?$/.exec(n.start)!;
    return (clip.bar - 1) * 3840 + (Number(m[1]) - 1) * 3840 + (Number(m[2]) - 1) * 960 + (m[3] ? Number(m[3]) * 3840 / Number(m[4]) : 0);
  });
}
const kickFrames = ticksOf('kick').map(t => frameOf(t) - CUT);

const S = (id: string): Stereo => { const x = readWav(join(STEMS, `${id}.wav`)); return [x[0].slice(CUT), x[1].slice(CUT)]; };
const N = S('phrase')[0].length;

// The phrase: Gate 2's hook chain with Gate 2's own gain (not re-normalised), dry plus the same dark room.
const phraseDry = gainDb(S('phrase'), hookPreGainDb);
const hook = sum(phraseDry, gainDb(room(phraseDry, 1.9, 350), -6));
// The dilated floor: Gate 2's 808 recipe (Abyss + Reactor, kick-ducked, DAEMON//CRUSH 0.75). The kick now lasts 4/3 as
// long, so its duck is redshifted too: Gate 2's 45 ms hold / 90 ms release become 60 / 120 ms.
let bass808 = mono(sum(S('bass808'), hp(S('bass808-grit'), 30)));
// Its CRUSH harmonics are darkened above 3 kHz (a redshifted spectrum, like every other world sound); the 150-400 Hz
// harmonics that carry the 808's line on phone speakers are untouched.
bass808 = toPeak(lp(crushed(duck(toPeak(hp(bass808, 26), -6), kickFrames, 12, 60, 120), 0.75, { pushDb: 3, mix: 0.85 }), 3000), -4.5);
// Kick and snare/clap exactly as Gate 2 treats them.
const kick = toPeak(clipTo(toPeak(hp(S('kick'), 40), -3), -3.5), -3);
const snare = toPeak(crushed(sum(toPeak(S('snare'), -5), toPeak(hp(S('clap'), 250), -9)), 0.65, { mix: 0.6 }), -4.5);
// The wall, as Gate 2's wall bus (low-passed, half-crushed); without the drone, which the new world does not have.
const wall = toPeak(crushed(lp(S('wall'), 850), 0.5, { mix: 0.5 }), -10);
// The clock: Gate 2's machine tick, now the steady 108 BPM beat. Its energy moved down with the redshift (high-pass 2.5 kHz).
const clock = toPeak(hp(S('clock'), 2500), -11);
// The glass: Gate 2's atmosphere treatment (dry + 2.4 s room).
const g = S('glass');
const glass = toPeak(sum(toPeak(g, -14), gainDb(room(toPeak(g, -16), 2.4, 300), -4)), -11);

const stems: Record<string, Stereo> = { hook, bass808, kick, snare, wall, clock, glass };
for (const [id, x] of Object.entries(stems)) writeAudio(join(OUT, 'stems', `${id}.wav`), x, false);

// Master: Gate 2's push -> soft clip at -1 dBFS -> trim, then a 40 ms fade on the last frames (the expected downbeat at
// 41.667 s never comes; the fade only removes the click of the cut).
const total = sum(...Object.values(stems));
const master = fadeOut(gainDb(clipTo(gainDb(total, masterPushDb), -1), masterTrimDb), 40);
const extPath = join(OUT, 'REDSHIFT-EXTENSION.wav');
writeAudio(extPath, master);

// Combined: Gate 2's approved samples, then the extension plus Gate 2's own natural tail (gate2_tail.ts).
const gate2 = readWav(GATE2_MASTER);
const tail = readWav(join(OUT, 'stems', 'gate2-tail.wav'));
if (gate2[0].length !== CUT || tail[0].length !== N) throw new Error('length mismatch');
const ext = sum(master, tail);
const combined: Stereo = [new Float64Array(CUT + N), new Float64Array(CUT + N)];
for (let c = 0; c < 2; c++) { combined[c]!.set(gate2[c]!, 0); combined[c]!.set(ext[c]!, CUT); }
const combPath = join(OUT, 'GATE2-PLUS-REDSHIFT.wav');
writeAudio(combPath, combined);
// Proof that Gate 2's PCM bytes went through unchanged.
const dataOf = (b: Buffer) => { let at = 12; while (at + 8 <= b.length) { const id = b.toString('ascii', at, at + 4), size = b.readUInt32LE(at + 4); if (id === 'data') return b.subarray(at + 8, at + 8 + size); at += 8 + size + (size & 1); } throw new Error('no data'); };
const g2pcm = dataOf(readFileSync(GATE2_MASTER));
const gate2BytesPreserved = dataOf(readFileSync(combPath)).subarray(0, g2pcm.length).equals(g2pcm);
if (!gate2BytesPreserved) throw new Error('combined file does not carry Gate 2 byte-for-byte');

// Measurements (not a verdict).
const at = (s: number) => Math.round(s * SR);
const sec = (x: Stereo, a: number, b: number) => ({ rmsDb: round(ampDb(rms(x, at(a), at(b)))), peakDb: round(ampDb(Math.max(...[0, 1].map(c => { let p = 0; for (let i = at(a); i < at(b); i++) p = Math.max(p, Math.abs(x[c]![i]!)); return p; })))) });
const lExt = loudness(extPath), lComb = loudness(combPath);
const report = {
  title: proj.title, note: 'Measurements only; nobody has listened. Extension frame 0 = 28.0 s of the combined timeline.',
  extension: { seconds: round(N / SR, 6), frames: N, integratedLufs: lExt.lufs, loudnessRangeLu: lExt.lra, truePeakDbtp: lExt.truePeakDb,
    samplePeakDbfs: round(ampDb(peak(master))), truePeakComputedDbtp: round(ampDb(truePeak(master))) },
  combined: { seconds: round((CUT + N) / SR, 6), frames: CUT + N, integratedLufs: lComb.lufs, loudnessRangeLu: lComb.lra, truePeakDbtp: lComb.truePeakDb, gate2BytesPreserved },
  sectionsCombinedTimeline: {
    'gate2-M3-breakthrough 16.67-28.0': sec(combined, 16.67, 28.0),
    'redshift-cycle1-two-clocks 28.333-35.0': sec(combined, 28.333, 35.0),
    'redshift-cycle2-lock 35.0-41.667': sec(combined, 35.0, 41.666),
  },
  masterChainFromGate2: { hookPreGainDb, masterPushDb, masterTrimDb, softClipCeilingDbfs: -1, endFadeMs: 40 },
  stems: Object.fromEntries(Object.entries(stems).map(([k, x]) => [k, { peakDb: round(ampDb(peak(x))), rmsDb: round(ampDb(rms(x))) }])),
};
writeFileSync(join(OUT, 'REPORT.json'), JSON.stringify(report, null, 1) + '\n');
console.log(JSON.stringify(report, null, 1));
