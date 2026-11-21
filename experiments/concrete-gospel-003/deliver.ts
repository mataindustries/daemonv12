/**
 * Copy the finished V3 sketch into experiments/concrete-gospel-003/delivery/ (replaced on each run):
 *
 *   concrete-gospel-v3-dark-to-divine.wav / .mp3   the sketch: 16 bars and the final chord's ring, -14 LUFS, 24-bit / 320 kbps
 *   reference/concrete-gospel-v2-reference.*         Concrete Gospel V2, all 16 bars, at the same loudness (for A/B)
 *   stems/                                           seven instrument stems (PCM16, pre-master, unchanged in level)
 *   source/concrete-gospel-v3.mid                    the arrangement as MIDI: lead, organ divisions, choir parts, the V2
 *                                                    808 and kick/snare (for a DAW; pitch bends and timbre are not in it)
 *   provenance/                                      build manifest, QA before and after the fix pass, freeze check, V2
 *                                                    backing verification, rack and engine manifests, source hashes
 *   SHA256SUMS
 *
 *   node experiments/concrete-gospel-003/build.ts && PYTHON=python3 node experiments/concrete-gospel-003/deliver.ts
 * (deliver.ts runs the final QA and the freeze check itself; build/qa-candidate.json must come from a --candidate build.)
 */
import { spawnSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { copyFileSync, existsSync, mkdirSync, readFileSync, readdirSync, rmSync, statSync, writeFileSync } from 'node:fs';
import { join, relative } from 'node:path';
import { pitchOf } from '../../studio-001/rack/curves.ts';
import { REPO, V2_BUILD } from '../cathedral-experiment-001/backing.ts';
import * as V2 from '../cathedral-experiment-001/upstream/concrete-gospel-002/compose.ts';
import { HERE } from './build.ts';
import { BPM, KICK_BEATS, SCORES, SNARE_BEATS, type RackNote } from './compose.ts';

const BUILD = join(HERE, 'build'), OUT = join(HERE, 'delivery'), P = join(OUT, 'provenance'), PY = process.env.PYTHON || 'python3';
const sha = (b: Uint8Array) => createHash('sha256').update(b).digest('hex');
const manifest = JSON.parse(readFileSync(join(BUILD, 'manifest.json'), 'utf8')) as { stage: string; listening: { id: string }[]; stems: { id: string }[] };
if (!manifest.stage.startsWith('final')) throw new Error(`build/ holds the ${manifest.stage} build: run build.ts without --candidate`);
if (!existsSync(join(BUILD, 'qa-candidate.json'))) throw new Error('missing build/qa-candidate.json (QA of a --candidate build)');

// ------------------------------------------------------------------ the final QA and the freeze check
const qa = spawnSync(PY, ['-I', join(HERE, 'qa', 'measure.py'), BUILD, '--json', join(BUILD, 'qa-final.json')], { encoding: 'utf8', maxBuffer: 64 << 20 });
if (qa.status !== 0) throw new Error(`QA failed: ${qa.stderr}`);
const freeze = spawnSync(process.execPath, ['studio-001/rack/cli.ts', 'freeze'], { cwd: REPO, encoding: 'utf8' });
writeFileSync(join(BUILD, 'freeze-check.txt'), `$ node studio-001/rack/cli.ts freeze\n${freeze.stdout}${freeze.stderr}exit ${freeze.status}\n`);
if (freeze.status !== 0) throw new Error('freeze check failed: an approved engine, script or audition changed');

// ------------------------------------------------------------------ MIDI (type 1, 960 PPQ): the arrangement for a DAW
const vlq = (n: number) => { const out = [n & 0x7f]; while ((n >>= 7)) out.unshift((n & 0x7f) | 0x80); return out; };
const text = (type: number, s: string) => [0xff, type, ...vlq(Buffer.byteLength(s)), ...Buffer.from(s)];
function track(name: string, ch: number, program: number | null, notes: { beat: number; beats: number; pitch: number; vel: number }[], meta: number[][] = []): Buffer {
  const ev: [number, number[]][] = [[0, text(0x03, name)], ...meta.map(m => [0, m] as [number, number[]]), ...(program === null ? [] : [[0, [0xc0 | ch, program]] as [number, number[]]])];
  for (const n of notes) {
    const on = Math.round(n.beat * 960), off = Math.max(on + 1, Math.round((n.beat + n.beats) * 960)), v = Math.max(1, Math.min(127, Math.round(n.vel * 127)));
    ev.push([on, [0x90 | ch, n.pitch, v]], [off, [0x80 | ch, n.pitch, 0]]);
  }
  ev.sort((a, b) => a[0] - b[0] || (a[1][0]! & 0xf0) - (b[1][0]! & 0xf0)); // at equal ticks, note-offs (0x80) before note-ons
  const bytes: number[] = []; let t = 0;
  for (const [tick, e] of ev) { bytes.push(...vlq(tick - t), ...e); t = tick; }
  bytes.push(0, 0xff, 0x2f, 0);
  const h = Buffer.alloc(8); h.write('MTrk', 0); h.writeUInt32BE(bytes.length, 4);
  return Buffer.concat([h, Buffer.from(bytes)]);
}
const notesOf = (ns: RackNote[]) => ns.map(([beat, beats, p, vel]) => ({ beat, beats, pitch: pitchOf(p), vel }));
const parts = SCORES.flatMap(s => (s.score.parts as { id: string; instrument: string; notes: RackNote[] }[]).map(p => ({ ...p, score: s.id })));
const NAMES: Record<string, [string, number]> = {   // part -> [track name, General MIDI program (zero-based)]
  volt: ['THRONE//VOLT lead', 81], great: ['CATHEDRAL//ENGINE Great', 19], swell: ['CATHEDRAL//ENGINE Swell', 19], pedal: ['CATHEDRAL//ENGINE Pedal (8\' pitch)', 19],
  bass: ['HEAVEN//MASS basses', 52], tenor: ['HEAVEN//MASS tenors', 52], alto: ['HEAVEN//MASS altos', 52], soprano: ['HEAVEN//MASS sopranos', 52], 'soprano-2': ['HEAVEN//MASS second sopranos', 52], descant: ['HEAVEN//MASS descant', 52],
};
const CH = [0, 1, 2, 3, 4, 5, 6, 7, 8, 10, 11, 12, 13];          // channel 10 (index 9) is left for the drums
const v2bass = (V2.rackScore.parts.find(p => p.id === 'bass808')!.notes as RackNote[]);
const conductor = (() => {
  const us = Math.round(60e6 / BPM);
  return track('Concrete Gospel V3: Dark to Divine', 0, null, [], [[0xff, 0x51, 3, (us >> 16) & 0xff, (us >> 8) & 0xff, us & 0xff], [0xff, 0x58, 4, 4, 2, 24, 8], [0xff, 0x59, 2, 0xfc, 1]]);
})();
const tracks = [conductor, ...parts.map((p, i) => track(NAMES[p.id]![0], CH[i]!, NAMES[p.id]![1], notesOf(p.notes))),
  track('808 (Concrete Gospel V2, unchanged; reference)', CH[parts.length]!, 38, notesOf(v2bass)),
  track('Kick and snare (Concrete Gospel V2, unchanged; reference)', 9, null, [...KICK_BEATS.map(b => ({ beat: b, beats: 0.25, pitch: 36, vel: 0.9 })), ...SNARE_BEATS.map(b => ({ beat: b, beats: 0.25, pitch: 38, vel: 0.9 }))])];
const hdr = Buffer.alloc(14); hdr.write('MThd', 0); hdr.writeUInt32BE(6, 4); hdr.writeUInt16BE(1, 8); hdr.writeUInt16BE(tracks.length, 10); hdr.writeUInt16BE(960, 12);

// ------------------------------------------------------------------ delivery/
rmSync(OUT, { recursive: true, force: true });
for (const d of ['reference', 'stems', 'source', 'provenance/rack', 'provenance/engine']) mkdirSync(join(OUT, d), { recursive: true });
for (const ext of ['wav', 'mp3']) {
  copyFileSync(join(BUILD, 'out', `concrete-gospel-v3.${ext}`), join(OUT, `concrete-gospel-v3-dark-to-divine.${ext}`));
  copyFileSync(join(BUILD, 'out', `concrete-gospel-v2-reference.${ext}`), join(OUT, 'reference', `concrete-gospel-v2-reference.${ext}`));
}
for (const s of manifest.stems) copyFileSync(join(BUILD, 'out', 'stems', `${s.id}.wav`), join(OUT, 'stems', `${s.id}.wav`));
writeFileSync(join(OUT, 'source', 'concrete-gospel-v3.mid'), Buffer.concat([hdr, ...tracks]));
copyFileSync(join(BUILD, 'manifest.json'), join(P, 'build-manifest.json'));
copyFileSync(join(BUILD, 'manifest-candidate.json'), join(P, 'build-manifest-candidate.json'));
for (const f of ['qa-candidate.json', 'qa-final.json', 'freeze-check.txt']) copyFileSync(join(BUILD, f), join(P, f));
copyFileSync(join(V2_BUILD, 'verify.json'), join(P, 'v2-backing-verify.json'));
for (const s of SCORES) for (const f of ['render.json', 'performance.json']) copyFileSync(join(BUILD, 'rack', s.id, f), join(P, 'rack', `${s.id}.${f}`));
for (const f of ['render.json', 'analysis.json']) copyFileSync(join(BUILD, 'engine', 'render', `concrete-gospel-v3.${f}`), join(P, 'engine', `concrete-gospel-v3.${f}`));
// every source file of V3 (composition, pipeline, QA, generated scores and project) and the Cathedral sources it uses
const sources: string[] = [];
const walk = (d: string) => { for (const e of readdirSync(d).sort()) { const p = join(d, e); if (['build', 'delivery', '__pycache__'].includes(e)) continue; if (statSync(p).isDirectory()) walk(p); else sources.push(p); } };
walk(HERE); walk(join(HERE, '..', 'cathedral-experiment-001', 'instruments')); walk(join(HERE, '..', 'cathedral-experiment-001', 'upstream'));
for (const f of ['backing.ts', 'build.ts']) sources.push(join(HERE, '..', 'cathedral-experiment-001', f));
writeFileSync(join(P, 'sources.SHA256SUMS'), sources.map(p => `${sha(readFileSync(p))}  ${relative(HERE, p)}`).join('\n') + '\n');
const files: string[] = [];
const walk2 = (d: string) => { for (const e of readdirSync(d).sort()) { const p = join(d, e); if (statSync(p).isDirectory()) walk2(p); else if (e !== 'SHA256SUMS') files.push(p); } };
walk2(OUT);
writeFileSync(join(OUT, 'SHA256SUMS'), files.map(p => `${sha(readFileSync(p))}  ${relative(OUT, p)}`).join('\n') + '\n');
console.log(`delivered ${files.length} files to ${relative(process.cwd(), OUT)}; freeze: ${freeze.stdout.trim()}`);
