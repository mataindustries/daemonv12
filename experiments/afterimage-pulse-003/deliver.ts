/**
 * Fill experiments/afterimage-pulse-003/delivery/ from a final full-length build (replaced on each run). V1/V2's deliver script, adapted.
 *
 *   afterimage-pulse-full.wav     the record, 24-bit / 44.1 kHz, matched toward -14 LUFS under a -1 dBTP ceiling
 *   afterimage-pulse-full.mp3     the same, 320 kbps (phone-ready; mono fold-down measured)
 *   stems/*.flac                  ten key stems, lossless: the exact PCM16 sums of the engine's track stems (pre-master,
 *                                 unchanged level), each checked by decoding it back
 *   source/afterimage-pulse-full.mid  every part as MIDI (drums on channel 10)
 *   provenance/                   build manifests (candidate and final), QA before and after the fix pass, freeze check,
 *                                 the Cathedral instrument verification, source and sample hashes, rack and engine
 *                                 render manifests, licensing declarations, V1- and V2-unchanged checks
 *   SHA256SUMS
 *
 *   node experiments/afterimage-pulse-003/build.ts --candidate && python3 -I experiments/afterimage-pulse-003/qa/measure.py \
 *     experiments/afterimage-pulse-003/build --json experiments/afterimage-pulse-003/build/qa-candidate.json
 *   node experiments/afterimage-pulse-003/build.ts && node experiments/afterimage-pulse-003/deliver.ts
 */
import { spawnSync } from 'node:child_process';
import { copyFileSync, existsSync, mkdirSync, readFileSync, readdirSync, rmSync, statSync, writeFileSync } from 'node:fs';
import { join, relative } from 'node:path';
import { pitchOf } from '../../studio-001/rack/curves.ts';
import { HERE, NAME, REPO, sha } from './build.ts';
import { BPM, GHOSTS, HATS, KICKS, SAMPLE_FILES, SCORES, SNARES, type RackNote } from './compose.ts';

const BUILD = join(HERE, 'build'), OUT = join(HERE, 'delivery'), P = join(OUT, 'provenance'), PY = process.env.PYTHON || 'python3';
const manifest = JSON.parse(readFileSync(join(BUILD, 'manifest.json'), 'utf8')) as { stage: string; stems: { id: string }[] };
if (!manifest.stage.startsWith('final')) throw new Error(`build/ holds the ${manifest.stage} build: run build.ts without --candidate`);
for (const f of ['qa-candidate.json', 'manifest-candidate.json']) if (!existsSync(join(BUILD, f))) throw new Error(`missing build/${f} (from a --candidate build and its QA)`);

const qa = spawnSync(PY, ['-I', join(HERE, 'qa', 'measure.py'), BUILD, '--json', join(BUILD, 'qa-final.json')], { encoding: 'utf8', maxBuffer: 64 << 20 });
if (qa.status !== 0) throw new Error(`QA failed: ${qa.stderr}`);
const freeze = spawnSync(process.execPath, ['studio-001/rack/cli.ts', 'freeze'], { cwd: REPO, encoding: 'utf8' });
writeFileSync(join(BUILD, 'freeze-check.txt'), `$ node studio-001/rack/cli.ts freeze\n${freeze.stdout}${freeze.stderr}exit ${freeze.status}\n`);
if (freeze.status !== 0) throw new Error('freeze check failed: an approved engine, script or audition changed');

// ------------------------------------------------------------------ the Cathedral instruments, as delivered (commit e79412f)
const CATHEDRAL = 'experiments/cathedral-experiment-001';
const catSums = spawnSync('git', ['show', 'e79412f:experiments/cathedral-experiment-001/delivery/provenance/sources.SHA256SUMS'], { cwd: REPO, encoding: 'utf8' });
const cg4Sums = spawnSync('git', ['show', '6654bc4:experiments/concrete-gospel-004/delivery/provenance/sources.SHA256SUMS'], { cwd: REPO, encoding: 'utf8' });
if (catSums.status !== 0 || cg4Sums.status !== 0) throw new Error('cannot read the approved manifests (fetch claude/kind-ritchie-1r5oyt)');
const want = (txt: string, prefix: string) => new Map(txt.split('\n').filter(l => l.includes('instruments/')).map(l => { const [h, f] = l.split(/\s+/); return [f!.replace(prefix, ''), h!] as [string, string]; }));
const fromCat = want(catSums.stdout, ''), fromCg4 = want(cg4Sums.stdout, '../cathedral-experiment-001/');
const instruments = [...fromCat.keys()].map(f => {
  const actual = sha(readFileSync(join(REPO, CATHEDRAL, f)));
  return { file: `${CATHEDRAL}/${f}`, sha256: actual, cathedralManifest: actual === fromCat.get(f), concreteGospelFullLengthManifest: actual === fromCg4.get(f) };
});
if (!instruments.every(i => i.cathedralManifest && i.concreteGospelFullLengthManifest)) throw new Error('a Cathedral instrument source differs from the approved manifests');

// ------------------------------------------------------------------ MIDI (type 1, 960 PPQ)
const vlq = (n: number) => { const out = [n & 0x7f]; while ((n >>= 7)) out.unshift((n & 0x7f) | 0x80); return out; };
const text = (type: number, s: string) => [0xff, type, ...vlq(Buffer.byteLength(s)), ...Buffer.from(s)];
function track(name: string, ch: number, program: number | null, notes: { beat: number; beats: number; pitch: number; vel: number }[], meta: number[][] = []): Buffer {
  const ev: [number, number[]][] = [[0, text(0x03, name)], ...meta.map(m => [0, m] as [number, number[]]), ...(program === null ? [] : [[0, [0xc0 | ch, program]] as [number, number[]]])];
  for (const n of notes) {
    const on = Math.round(n.beat * 960), off = Math.max(on + 1, Math.round((n.beat + n.beats) * 960)), v = Math.max(1, Math.min(127, Math.round(n.vel * 127)));
    ev.push([on, [0x90 | ch, n.pitch, v]], [off, [0x80 | ch, n.pitch, 0]]);
  }
  ev.sort((a, b) => a[0] - b[0] || (a[1][0]! & 0xf0) - (b[1][0]! & 0xf0));
  const bytes: number[] = []; let t = 0;
  for (const [tick, e] of ev) { bytes.push(...vlq(tick - t), ...e); t = tick; }
  bytes.push(0, 0xff, 0x2f, 0);
  const h = Buffer.alloc(8); h.write('MTrk', 0); h.writeUInt32BE(bytes.length, 4);
  return Buffer.concat([h, Buffer.from(bytes)]);
}
const NAMES: Record<string, [string, number]> = {
  lead: ['THRONE//VOLT lead', 81], pad: ['THRONE//VOLT pad', 89], bass: ['Living Bass', 38], voice: ['Impossible Voice', 54],
  echo: ['Afterimage music box (Mechanical Orchestra bar)', 10], log: ['Hollow log (Timbre Lab)', 115], skin: ['Hand skin (Timbre Lab)', 116], clock: ['Escapement clock (Mechanical Orchestra)', 113],
  bass_choir: ['HEAVEN//MASS basses', 52], tenor: ['HEAVEN//MASS tenors', 52], alto: ['HEAVEN//MASS altos', 52], soprano: ['HEAVEN//MASS sopranos', 52],
};
const parts = SCORES.flatMap(s => (s.score.parts as { id: string; notes: RackNote[] }[]).map(p => ({ key: s.id === 'choir-low' && p.id === 'bass' ? 'bass_choir' : p.id, notes: p.notes })));
const CH = [0, 1, 2, 3, 4, 5, 6, 7, 8, 10, 11, 12, 13, 14];
const us = Math.round(60e6 / BPM);
const drumNotes = [...KICKS.map(([b, v]) => ({ beat: b, beats: 0.25, pitch: 36, vel: v })), ...SNARES.map(([b, v]) => ({ beat: b, beats: 0.25, pitch: 38, vel: v })),
  ...GHOSTS.map(([b, v]) => ({ beat: b, beats: 0.125, pitch: 37, vel: v })), ...HATS.map(([b, v, k]) => ({ beat: b, beats: 0.125, pitch: k === 'open' ? 46 : k === 'tick' ? 44 : 42, vel: v }))];
const tracks = [
  track('AFTERIMAGE//PULSE', 0, null, [], [[0xff, 0x51, 3, (us >> 16) & 0xff, (us >> 8) & 0xff, us & 0xff], [0xff, 0x58, 4, 4, 2, 24, 8], [0xff, 0x59, 2, 4, 0]]),
  ...parts.map((p, i) => track(NAMES[p.key]![0], CH[i]!, NAMES[p.key]![1], p.notes.map(([beat, beats, pitch, vel]) => ({ beat, beats, pitch: pitchOf(pitch), vel })))),
  track('Drums (V12 Signature and GLASSHOUSE one-shots)', 9, null, drumNotes),
];
if (parts.length > CH.length) throw new Error('too many parts for the MIDI channels');
const hdr = Buffer.alloc(14); hdr.write('MThd', 0); hdr.writeUInt32BE(6, 4); hdr.writeUInt16BE(1, 8); hdr.writeUInt16BE(tracks.length, 10); hdr.writeUInt16BE(960, 12);

// ------------------------------------------------------------------ delivery/
rmSync(OUT, { recursive: true, force: true });
for (const d of ['stems', 'source', 'provenance/rack', 'provenance/engine']) mkdirSync(join(OUT, d), { recursive: true });
for (const ext of ['wav', 'mp3']) copyFileSync(join(BUILD, 'out', `${NAME}.${ext}`), join(OUT, `${NAME}.${ext}`));
const pcm = (wav: string) => { const b = readFileSync(wav); let o = 12; while (o + 8 <= b.length) { const id = b.toString('ascii', o, o + 4), len = b.readUInt32LE(o + 4); if (id === 'data') return b.subarray(o + 8, o + 8 + len); o += 8 + len + (len & 1); } throw new Error(`${wav}: no data`); };
const ffm = (args: string[]) => { const r = spawnSync(process.env.DAEMONV12_FFMPEG || 'ffmpeg', ['-hide_banner', '-nostdin', '-v', 'error', '-y', ...args]); if (r.status !== 0) throw new Error(`ffmpeg: ${r.stderr}`); };
for (const s of manifest.stems) {
  const wav = join(BUILD, 'out', 'stems', `${s.id}.wav`), flac = join(OUT, 'stems', `${s.id}.flac`), back = join(BUILD, 'out', `${s.id}.roundtrip.wav`);
  ffm(['-i', wav, '-c:a', 'flac', '-compression_level', '8', '-map_metadata', '-1', '-fflags', '+bitexact', '-flags:a', '+bitexact', flac]);
  ffm(['-i', flac, '-c:a', 'pcm_s16le', '-map_metadata', '-1', '-fflags', '+bitexact', '-flags:a', '+bitexact', back]);
  if (!pcm(wav).equals(pcm(back))) throw new Error(`${s.id}: FLAC round trip is not bit-exact`);
  rmSync(back);
}
writeFileSync(join(OUT, 'source', `${NAME}.mid`), Buffer.concat([hdr, ...tracks]));

// provenance
copyFileSync(join(BUILD, 'manifest.json'), join(P, 'build-manifest.json'));
copyFileSync(join(BUILD, 'manifest-candidate.json'), join(P, 'build-manifest-candidate.json'));
copyFileSync(join(BUILD, 'qa-candidate.json'), join(P, 'qa-candidate.json'));
copyFileSync(join(BUILD, 'qa-final.json'), join(P, 'qa-final.json'));
copyFileSync(join(BUILD, 'freeze-check.txt'), join(P, 'freeze-check.txt'));
for (const f of [`${NAME}.render.json`, `${NAME}.analysis.json`]) if (existsSync(join(BUILD, 'engine', 'render', f))) copyFileSync(join(BUILD, 'engine', 'render', f), join(P, 'engine', f));
for (const s of SCORES) for (const f of ['render.json', 'performance.json']) if (existsSync(join(BUILD, 'rack', s.id, f))) copyFileSync(join(BUILD, 'rack', s.id, f), join(P, 'rack', `${s.id}.${f}`));
writeFileSync(join(P, 'cathedral-instruments.json'), JSON.stringify({
  source: 'branch claude/kind-ritchie-1r5oyt (also claude/elegant-faraday-y4ohq7), commit e79412f "Cathedral Experiment: listening files, lossless WAVs and provenance"; checked out byte for byte at its original path so its relative imports and opt-in registration hook work unchanged',
  registration: 'node --import ./experiments/cathedral-experiment-001/instruments/register.ts studio-001/rack/cli.ts render ... (also registers the Timbre Lab; the rack, its registry and the frozen engines are not edited)',
  verifiedAgainst: ['e79412f:experiments/cathedral-experiment-001/delivery/provenance/sources.SHA256SUMS', '6654bc4:experiments/concrete-gospel-004/delivery/provenance/sources.SHA256SUMS'],
  instruments,
}, null, 1) + '\n');
const srcFiles = ['compose.ts', 'build.ts', 'deliver.ts', 'qa/measure.py', 'README.md', '.gitignore', ...readdirSync(join(HERE, 'source')).sort().map(f => `source/${f}`)];
const lines = [...srcFiles.map(f => `${sha(readFileSync(join(HERE, f)))}  ${f}`),
  ...instruments.map(i => `${i.sha256}  ../../${i.file}`),
  ...SAMPLE_FILES.map(([, src]) => `${sha(readFileSync(join(REPO, src)))}  ../../${src}`)];
writeFileSync(join(P, 'sources.SHA256SUMS'), lines.join('\n') + '\n');
writeFileSync(join(P, 'licensing.json'), JSON.stringify({
  status: 'PROVISIONAL. Private research asset. No licence is granted and no commercial clearance is claimed.',
  made_of: 'Numeric parameters and seeded noise (rack, Timbre Lab and Cathedral instruments) plus seven one-shot WAVs from two packs in this repository. No recordings of performers, no third-party samples, no SoundFonts, impulse responses, presets or paid APIs.',
  components: [
    { what: 'Living Bass, Impossible Voice, Mechanical Orchestra (bar, clock)', source: 'Signature Rack 1.0.0 (mutation-001 A/B/C), frozen', licence: 'pending the owner\'s declaration' },
    { what: 'Hollow log, hand skin', source: 'Timbre Lab 0.1.0 (not frozen)', licence: 'pending the owner\'s declaration' },
    { what: 'THRONE//VOLT, HEAVEN//MASS', source: 'Cathedral Experiment 0.1.0 at e79412f (not frozen)', licence: 'pending the owner\'s declaration' },
    { what: 'IRON PULSE, TITANIUM CRACK, GHOST TICK, OPEN CIRCUIT', source: 'packs/v12-signature-v1 (PROVENANCE.md)', licence: 'pending the owner\'s declaration' },
    { what: 'bass punch, chrome clap, pixel hat', source: 'examples/assets/glasshouse', licence: 'CC0 1.0 (examples/assets/glasshouse/LICENSE)' },
    { what: 'composition, arrangement, code', source: 'this directory, written by an AI agent for the owner', licence: 'authorship and work-for-hire status to be recorded by the owner' },
  ],
  v1v2: 'The full-length record develops AFTERIMAGE//PULSE V1 and V2 (experiments/afterimage-pulse-001 and -002, unchanged): the hook, its performance lanes, the groove, the glitch, the afterimage choir passage and the cascade are reused material from V1/V2, written by the same agent for the owner.',
  inspiration: 'The brief named a commercial recording as a broad stylistic reference. Nothing was sampled, transcribed or analysed from it; the melody, harmony, rhythm, bass phrases and arrangement are new.',
}, null, 1) + '\n');

// V1 and V2 must be untouched: each delivery verifies against its own SHA256SUMS and git sees no change in either directory
let prior = '';
for (const [dir, commit] of [['afterimage-pulse-001', '97f9467'], ['afterimage-pulse-002', 'e171a9d']] as const) {
  const sums = spawnSync('sha256sum', ['-c', 'SHA256SUMS'], { cwd: join(REPO, 'experiments', dir, 'delivery'), encoding: 'utf8' });
  const st = spawnSync('git', ['status', '--porcelain', '--', `experiments/${dir}`], { cwd: REPO, encoding: 'utf8' });
  const df = spawnSync('git', ['diff', '--stat', commit, '--', `experiments/${dir}`], { cwd: REPO, encoding: 'utf8' });
  if (sums.status !== 0 || st.stdout.trim() || df.stdout.trim()) throw new Error(`${dir} changed:\n${sums.stdout}${st.stdout}${df.stdout}`);
  prior += `$ (cd experiments/${dir}/delivery && sha256sum -c SHA256SUMS)\n${sums.stdout}$ git status --porcelain -- experiments/${dir}\n(nothing)\n$ git diff --stat ${commit} -- experiments/${dir}\n(nothing: identical to its commit)\n\n`;
}
writeFileSync(join(P, 'v1-v2-unchanged.txt'), prior);
const files: string[] = [];
const walk = (d: string) => { for (const f of readdirSync(d).sort()) { const p = join(d, f); statSync(p).isDirectory() ? walk(p) : files.push(p); } };
walk(OUT);
writeFileSync(join(OUT, 'SHA256SUMS'), files.filter(f => !f.endsWith('SHA256SUMS')).map(f => `${sha(readFileSync(f))}  ${relative(OUT, f)}`).join('\n') + '\n');
console.log(`delivery: ${files.length} files; FLAC stems bit-exact; MIDI ${tracks.length} tracks; Cathedral instruments verified (${instruments.length})`);
