// DAEMON//STUDIO 001 Signature Rack: frozen approvals, interface, determinism, articulation, pitch/tempo,
// clipping, asset containment, provenance and native-engine reproduction. FFmpeg-dependent checks skip without it.
import test from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { appendFileSync, mkdtempSync, readFileSync, readdirSync, rmSync, symlinkSync, writeFileSync, existsSync, unlinkSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import {
  normalizeScore, renderScore, mixdown, bouncePackage, bounceKit, verifyPackage, containmentProblems, verifyFrozen, readFreeze,
  registryDocument, getInstrument, sha256, RACK_INTERFACE_VERSION, SCORE_SCHEMA, beatFrame, engineEndFrames, placed, ffmpegVersion,
  type ScoreInput, type PartInput, type PartPerformance, type RenderContext,
} from '../studio-001/rack/index.ts';
import { instrumentsMarkdown, INSTRUMENTS_MD } from '../studio-001/rack/docs.ts';

const RATE = 44100;
const temp = (t: import('node:test').TestContext) => { const d = mkdtempSync(join(tmpdir(), 'signature-rack-')); t.after(() => rmSync(d, { recursive: true, force: true })); return d; };
const score = (parts: PartInput[], extra: Partial<ScoreInput> = {}): ScoreInput => ({ schema: SCORE_SCHEMA, title: 'Rack test', bpm: 120, key: 'C minor', seed: 7, tailSeconds: 0.5, masterGainDb: 0, sections: [{ id: 'a', bars: 1 }], parts, ...extra });
const ctx = (frames: number, extra: Partial<RenderContext> = {}): RenderContext => ({ bpm: 120, beatSeconds: 0.5, swing: 0.5, key: { tonic: 0, mode: 'minor', label: 'C minor' }, seed: 1, frames, partIndex: 0, ...extra });
const perf = (notes: PartPerformance['notes'], extra: Partial<PartPerformance> = {}): PartPerformance => ({ notes, macro: 0, controls: {}, offsets: {}, expression: 0.7, setup: {}, breaths: [], motion: [], ...extra });
async function one(id: string, p: PartPerformance, seconds: number, c: Partial<RenderContext> = {}) {
  const inst = getInstrument(id); assert.ok(inst, id);
  return inst.render(p, ctx(Math.round(seconds * RATE), c));
}
const rmsDb = (x: Float64Array, a: number, b: number) => { let s = 0; const z = Math.min(b, x.length); for (let i = a; i < z; i++) s += x[i]! * x[i]!; return 10 * Math.log10(s / Math.max(1, z - a) + 1e-30); };
const sec = (s: number) => Math.round(s * RATE);
/** Strongest frequency within +/- `cents` of `hz` (Hann-windowed DFT on a 0.5 s segment). */
function peakHz(x: Float64Array, from: number, hz: number, cents = 80) {
  const n = sec(0.5), seg = Array.from({ length: n }, (_, i) => x[from + i]! * (0.5 - 0.5 * Math.cos(2 * Math.PI * i / n)));
  let best = hz, bestM = -1;
  for (let c = -cents; c <= cents; c += 1) {
    const f = hz * 2 ** (c / 1200); let re = 0, im = 0;
    for (let i = 0; i < n; i++) { const w = 2 * Math.PI * f * i / RATE; re += seg[i]! * Math.cos(w); im -= seg[i]! * Math.sin(w); }
    const m = re * re + im * im; if (m > bestM) { bestM = m; best = f; }
  }
  return best;
}
const centsOff = (f: number, midi: number) => 1200 * Math.log2(f / (440 * 2 ** ((midi - 69) / 12)));
const engine = (...args: string[]) => spawnSync(process.execPath, ['bin/daemonv12.js', ...args], { encoding: 'utf8', maxBuffer: 1 << 26 });
const hasFfmpeg = ffmpegVersion() !== null;

test('approved engines, audition scripts, the nine auditions and their manifests match the freeze record', () => {
  assert.deepEqual(verifyFrozen(), []);
  const freeze = readFreeze();
  assert.equal(freeze.files.filter(f => f.role === 'audition').length, 18);
  assert.deepEqual(Object.keys(freeze.approvals).sort(), ['impossible-voice', 'living-bass', 'mechanical-orchestra']);
  // every generator hash each audition manifest recorded still matches the file on disk
  const manifest = JSON.parse(readFileSync('mutation-001/auditions/manifest.json', 'utf8')) as { mutations: Record<string, { generator: { file: string; sha256: string }[] }> };
  for (const [key, m] of Object.entries(manifest.mutations)) for (const g of m.generator) assert.equal(sha256(readFileSync(g.file)), g.sha256, `${key}: ${g.file}`);
});

test('registry: three versioned families with their transformation macros, controls, articulations and ranges', () => {
  const doc = registryDocument();
  assert.equal(doc.interfaceVersion, RACK_INTERFACE_VERSION);
  assert.deepEqual(JSON.parse(JSON.stringify(doc)), doc);
  const macro = (fam: string) => [...new Set(doc.instruments.filter(i => i.family === fam).map(i => i.macro.label))];
  assert.deepEqual(macro('living-bass'), ['warm → machine']);
  assert.deepEqual(macro('impossible-voice'), ['human → impossible']);
  assert.deepEqual(macro('mechanical-orchestra'), ['clockwork → alien machinery']);
  assert.equal(doc.instruments.filter(i => i.family === 'mechanical-orchestra').length, 6);
  for (const i of doc.instruments) {
    assert.match(i.version, /^\d+\.\d+\.\d+\+/);
    assert.ok(i.range[0] < i.range[1] && Object.keys(i.articulations).length > 0, i.id);
    for (const c of i.controls) assert.ok(c.min < c.max && c.description, `${i.id}.${c.name}`);
  }
  assert.equal(readFileSync(INSTRUMENTS_MD, 'utf8'), instrumentsMarkdown(), 'studio-001/INSTRUMENTS.md is stale: run node studio-001/rack/docs.ts');
});

test('scores fail with specific messages', () => {
  const bad = (p: PartInput[], extra: Partial<ScoreInput> = {}, re: RegExp) => assert.throws(() => normalizeScore(score(p, extra)), re);
  bad([{ id: 'x', instrument: 'nope' }], {}, /unknown "nope"/);
  bad([{ id: 'b', instrument: 'living-bass', notes: [[0, 1, 'C6', 0.8]] }], {}, /pitch 84 outside living-bass range/);
  bad([{ id: 'b', instrument: 'living-bass', notes: [[0, 1, 'C2', 0.8, { articulation: 'sung' }]] }], {}, /articulation "sung"/);
  bad([{ id: 'b', instrument: 'living-bass', controls: { glass: 1 } }], {}, /not a control of living-bass/);
  bad([{ id: '../escape', instrument: 'living-bass' }], {}, /lowercase id/);
  bad([{ id: 'v', instrument: 'impossible-voice', notes: [[0, 1, 'C4', 0.8, { vowel: 'xx' }]] }], {}, /vowel must be one of/);
  bad([{ id: 'b', instrument: 'living-bass' }], { schema: 'other' }, /schema/);
  bad([{ id: 'b', instrument: 'living-bass', notes: [[0, 1, 'C2', 0.8]] }], { transpose: 40 }, /transpose/);
  // the same score in another key and tempo normalises: pitches and the halo key follow, times stay in beats
  const n = normalizeScore(score([{ id: 'b', instrument: 'living-bass', notes: [[0, 1, 'C2', 0.8]] }]), { transpose: 5, bpm: 90 });
  assert.equal(n.parts[0]!.perf.notes[0]!.pitch, 41); assert.equal(n.key.label, 'F minor'); assert.equal(n.bpm, 90);
});

test('renders are deterministic; seeds and macros change them', async () => {
  const sc = score([
    { id: 'bass', instrument: 'living-bass', macro: [[0, 0], [4, 1]], notes: [[0, 1, 'C2', 0.9], [1, 1, 'Eb2', 0.8, { slide: 0.1 }], [2, 2, 'G1', 0.9]] },
    { id: 'voice', instrument: 'impossible-voice', macro: 0.5, notes: [[0, 2, 'G4', 0.7, { vowel: 'oh', to: 'ah' }], [2, 2, 'C5', 0.7, { vowel: 'ah' }]] },
    { id: 'bar', instrument: 'mechanical-orchestra/bar', notes: [[0, 1, 'C5', 0.7], [1, 1, 'G5', 0.6]] },
  ]);
  const digest = async (s: ScoreInput) => { const r = await renderScore(normalizeScore(s)); return r.parts.map(p => sha256(new Uint8Array(p.audio[0].buffer))).join(); };
  const a = await digest(sc);
  assert.equal(await digest(sc), a);
  assert.notEqual(await digest({ ...sc, seed: 8 }), a);
});

test('pitch stays in tune across registers and keys', async () => {
  for (const [id, midi, extra] of [['living-bass', 33, {}], ['living-bass', 43, {}], ['impossible-voice', 64, { vowel: 'oo' }], ['impossible-voice', 74, { vowel: 'oh' }], ['mechanical-orchestra/bar', 72, {}]] as [string, number, Record<string, string>][]) {
    const [l] = await one(id, perf([{ beat: 0, beats: 2, pitch: midi, velocity: 0.8, ...(Object.keys(extra).length ? { params: extra } : {}) }], id === 'impossible-voice' ? { controls: { vib: 0 } } : {}), 1.6);
    const off = centsOff(peakHz(l, sec(0.4), 440 * 2 ** ((midi - 69) / 12)), midi);
    assert.ok(Math.abs(off) < 15, `${id} MIDI ${midi}: ${off.toFixed(1)} cents`);
  }
  // a transposed score moves the sounding pitch by the interval
  for (const t of [0, 7]) {
    const r = await renderScore(normalizeScore(score([{ id: 'b', instrument: 'mechanical-orchestra/bar', notes: [[0, 2, 'C5', 0.8]] }]), { transpose: t }));
    const off = centsOff(peakHz(r.parts[0]!.audio[0], sec(0.1), 440 * 2 ** ((72 + t - 69) / 12)), 72 + t);
    assert.ok(Math.abs(off) < 15, `transpose ${t}: ${off.toFixed(1)} cents`);
  }
});

test('tempo moves onsets with the beat (engine frame arithmetic)', async () => {
  for (const bpm of [60, 132]) {
    const r = await renderScore(normalizeScore(score([{ id: 'b', instrument: 'mechanical-orchestra/bar', notes: [[2, 1, 'C5', 0.9]] }], { bpm })));
    const x = r.parts[0]!.audio[0]; let first = 0; while (first < x.length && Math.abs(x[first]!) < 1e-4) first++;
    assert.ok(Math.abs(first - beatFrame(2, bpm)) <= 2, `${bpm} BPM onset at ${first}, expected ${beatFrame(2, bpm)}`);
    assert.equal(r.frames, engineEndFrames(4, bpm, 0.5));
  }
});

test('articulations change the performance measurably', async () => {
  const bass = async (a: string) => (await one('living-bass', perf([{ beat: 0, beats: 2, pitch: 36, velocity: 0.9, articulation: a }]), 1.6))[0];
  const normal = await bass('normal'), stacc = await bass('staccato'), ghost = await bass('ghost'), accent = await bass('accent');
  assert.ok(rmsDb(stacc, sec(0.7), sec(0.9)) < rmsDb(normal, sec(0.7), sec(0.9)) - 20, 'staccato releases early');
  assert.ok(rmsDb(ghost, 0, sec(0.4)) < rmsDb(accent, 0, sec(0.4)) - 3, 'ghost is softer than accent');
  // at 60 BPM a detached note stops 0.2 s early; a legato pair keeps singing through the change
  const voice = async (notes: PartPerformance['notes']) => (await one('impossible-voice', perf(notes), 3.5, { bpm: 60, beatSeconds: 1 }))[0];
  const legato = await voice([{ beat: 0, beats: 1, pitch: 67, velocity: 0.7 }, { beat: 1, beats: 1, pitch: 72, velocity: 0.7, slide: 0.3 }]);
  const detached = await voice([{ beat: 0, beats: 1, pitch: 67, velocity: 0.7, articulation: 'detached' }, { beat: 1, beats: 1, pitch: 72, velocity: 0.7, articulation: 'detached' }]);
  const dip = (x: Float64Array) => Math.min(...[0.93, 0.95, 0.97].map(t => rmsDb(x, sec(t), sec(t + 0.02))));
  assert.ok(dip(legato) > dip(detached) + 6, 'legato keeps sounding between notes');
  const bow = (await one('mechanical-orchestra/bow', perf([{ beat: 0, beats: 3, pitch: 69, velocity: 0.8 }]), 2))[0];
  const mallet = (await one('mechanical-orchestra/bar', perf([{ beat: 0, beats: 3, pitch: 69, velocity: 0.8, articulation: 'muted' }]), 2))[0];
  assert.ok(rmsDb(bow, sec(1.0), sec(1.4)) > rmsDb(mallet, sec(1.0), sec(1.4)) + 20, 'a bowed note sustains, a muted strike does not');
});

test('expression, velocity and extreme controls cannot push an engine past its approved envelope', async () => {
  // regression: hold/bright above the approved macro range made the bass gate diverge (+20 dB)
  const [l] = await one('living-bass', perf([{ beat: 0, beats: 3, pitch: 36, velocity: 1, articulation: 'accent' }, { beat: 3, beats: 3, pitch: 31, velocity: 1 }],
    { macro: 1, expression: 1, controls: { hold: 1.5, bright: 1.5, drive: 1.5 }, motion: [{ fromBeat: 0, toBeat: 8, preset: 'growl' }] }), 3.5);
  const peakVal = l.reduce((m, v) => Math.max(m, Math.abs(v)), 0);
  assert.ok(peakVal < 1, `peak ${peakVal}`);
  assert.ok(rmsDb(l, 0, sec(3)) < -12, `rms ${rmsDb(l, 0, sec(3)).toFixed(1)} dBFS`);
});

test('transformation macros move each family in its documented direction', async () => {
  const centroid = (x: Float64Array, a: number, n: number) => { let num = 0, den = 0; for (let f = 50; f < 8000; f += 25) { let re = 0, im = 0; for (let i = 0; i < n; i += 2) { const w = 2 * Math.PI * f * i / RATE; re += x[a + i]! * Math.cos(w); im -= x[a + i]! * Math.sin(w); } const m = re * re + im * im; num += f * m; den += m; } return num / den; };
  const bass = async (m: number) => (await one('living-bass', perf([{ beat: 0, beats: 2, pitch: 36, velocity: 0.9 }], { macro: m }), 1.2))[0];
  assert.ok(centroid(await bass(1), sec(0.2), 4096) > 1.5 * centroid(await bass(0), sec(0.2), 4096), 'warm -> machine adds upper harmonics');
  // human -> impossible: an undertone series grows under the voice and the harmonic series bends (6th partial goes sharp)
  const voice = async (m: number) => (await one('impossible-voice', perf([{ beat: 0, beats: 2, pitch: 69, velocity: 0.8, params: { vowel: 'oh' } }], { macro: m, controls: { vib: 0 } }), 1.4))[0];
  const human = await voice(0), impossible = await voice(1);
  const at = (x: Float64Array, f: number) => { const n = sec(0.5); let re = 0, im = 0; for (let i = 0; i < n; i++) { const w = 2 * Math.PI * f * i / RATE, h = 0.5 - 0.5 * Math.cos(2 * Math.PI * i / n); re += x[sec(0.4) + i]! * h * Math.cos(w); im -= x[sec(0.4) + i]! * h * Math.sin(w); } return 10 * Math.log10(re * re + im * im + 1e-30); };
  assert.ok(at(impossible, 220) > at(human, 220) + 15, 'undertone at f0/2 appears');
  assert.ok(Math.abs(centsOff(peakHz(human, sec(0.4), 2640, 150), 69 + 31.02)) < 10 && centsOff(peakHz(impossible, sec(0.4), 2640, 150), 69 + 31.02) > 25, '6th partial bends sharp');
  // clockwork -> alien: the bar's second mode moves from 4 f0 (tuned) toward 1.493 f0 (alien gong)
  const bar = async (m: number) => (await one('mechanical-orchestra/bar', perf([{ beat: 0, beats: 2, pitch: 60, velocity: 0.8, articulation: 'ring' }], { macro: m }), 1.2))[0];
  const level = (x: Float64Array, ratio: number) => { const f = 261.63 * ratio, n = sec(0.3); let re = 0, im = 0; for (let i = 0; i < n; i++) { const w = 2 * Math.PI * f * i / RATE; re += x[sec(0.02) + i]! * Math.cos(w); im -= x[sec(0.02) + i]! * Math.sin(w); } return re * re + im * im; };
  const tuned = await bar(0), alien = await bar(1);
  assert.ok(level(tuned, 4) > 10 * level(tuned, 1.493) && level(alien, 1.493) > 10 * level(alien, 4), 'mode 2 travels from 4 f0 to 1.493 f0');
});

test('bounce: contained, sealed, reproducible packages whose phrases sit on engine frames; the engine accepts them', async t => {
  const dir = temp(t);
  const sc = score([
    { id: 'bass', instrument: 'living-bass', notes: [[0, 2, 'C2', 0.9], [2, 2, 'G1', 0.8, { slide: 0.1 }], [4, 4, 'C2', 0.9]] },
    { id: 'voice', instrument: 'impossible-voice', macro: [[0, 0], [8, 1]], notes: [[0, 3, 'G4', 0.7], [4, 3.5, 'Eb5', 0.7]] },
    { id: 'kick', instrument: 'context/kick', notes: [[0, 0.5, 'C1', 1], [4, 0.5, 'C1', 1]] },
  ], { sections: [{ id: 'a', bars: 1 }, { id: 'b', bars: 1 }] });
  const n = normalizeScore(sc), r = await renderScore(n), mixes = await mixdown(r);
  const rep = bouncePackage(n, r, mixes, join(dir, 'p1')), rep2 = bouncePackage(n, r, mixes, join(dir, 'p2'));
  assert.equal(rep.clipped, 0);
  assert.equal(readFileSync(join(dir, 'p1', 'SHA256SUMS'), 'utf8'), readFileSync(join(dir, 'p2', 'SHA256SUMS'), 'utf8'));
  assert.throws(() => bouncePackage(n, r, mixes, join(dir, 'p1')), /existing path/);
  for (const p of ['main.json', 'dry.json']) {
    assert.deepEqual(containmentProblems(join(dir, 'p1'), p), []);
    const v = engine('validate', join(dir, 'p1', p), '--json');
    assert.equal(v.status, 0, v.stdout + v.stderr); assert.equal(JSON.parse(v.stdout).ok, true);
  }
  const catalog = JSON.parse(readFileSync(join(dir, 'p1', 'catalog.json'), 'utf8')) as { sounds: { file: string; sha256: string; fromFrame: number; toFrame: number; section: string }[]; generator: { file: string; sha256: string }[]; scoreSha256: string; license: string };
  for (const s of catalog.sounds) {
    assert.equal(sha256(readFileSync(join(dir, 'p1', s.file))), s.sha256);
    assert.equal(s.fromFrame, beatFrame(s.section === 'a' ? 0 : 4, 120));
    assert.equal(s.toFrame, s.section === 'a' ? beatFrame(4, 120) : engineEndFrames(8, 120, 0.5));
  }
  for (const g of catalog.generator) assert.equal(sha256(readFileSync(g.file)), g.sha256, g.file);
  assert.equal(catalog.scoreSha256, sha256(readFileSync(join(dir, 'p1', 'score.json'))));
  assert.match(catalog.license, /PENDING OWNER DECLARATION/);
  const dry = JSON.parse(readFileSync(join(dir, 'p1', 'dry.json'), 'utf8')) as { tracks: { id: string }[] };
  assert.deepEqual(dry.tracks.map(x => x.id), ['bass', 'voice']);
  // tampering is detected
  assert.equal(verifyPackage(join(dir, 'p1')), readFileSync(join(dir, 'p1', 'SHA256SUMS'), 'utf8').trim().split('\n').length);
  appendFileSync(join(dir, 'p2', 'score.json'), ' '); assert.throws(() => verifyPackage(join(dir, 'p2')), /modified: score.json/);
  writeFileSync(join(dir, 'p1', 'extra.txt'), 'x'); assert.throws(() => verifyPackage(join(dir, 'p1')), /unlisted: extra.txt/); unlinkSync(join(dir, 'p1', 'extra.txt'));
  symlinkSync('/etc/hostname', join(dir, 'p1', 'link')); assert.throws(() => verifyPackage(join(dir, 'p1')), /link or special file/); unlinkSync(join(dir, 'p1', 'link'));
  const kitFile = join(dir, 'p1', 'assets', 'bass', 'kit.json'), kit = readFileSync(kitFile, 'utf8');
  writeFileSync(kitFile, kit.replace('"phrase-a.wav"', '"../../../outside.wav"'));
  assert.ok(containmentProblems(join(dir, 'p1'), 'main.json').some(p => /unsafe relative path/.test(p)));
  writeFileSync(kitFile, kit);
  await t.test('the engine render reproduces the rack stems', { skip: !hasFfmpeg && 'FFmpeg is not available' }, () => {
    const out = join(dir, 'render'), res = engine('render', join(dir, 'p1', 'main.json'), '--out-dir', out, '--stems', '--json');
    assert.equal(res.status, 0, res.stdout + res.stderr);
    const pcm = (f: string) => { const b = readFileSync(f); return new Int16Array(b.buffer, b.byteOffset + 44, (b.length - 44) / 2); };
    for (const rp of r.parts) {
      const st = pcm(join(out, 'main.stems', `${rp.part.id}.wav`)), [pl, pr] = placed(rp);
      assert.equal(st.length / 2, r.frames, rp.part.id);
      let worst = 0; for (let i = 0; i < r.frames; i++) worst = Math.max(worst, Math.abs(st[2 * i]! - pl[i]! * 32767), Math.abs(st[2 * i + 1]! - pr[i]! * 32767));
      assert.ok(worst <= 2, `${rp.part.id}: ${worst} LSB`);
    }
  });
});

test('kit export writes a native-pitch multisample kit the engine accepts', async t => {
  const dir = temp(t), out = join(dir, 'kit');
  const res = await bounceKit('mechanical-orchestra/bar', out, { pitches: [60, 64, 67], macro: 0.5, beats: 1, bpm: 120 });
  assert.equal(res.samples, 3); verifyPackage(out);
  const kit = JSON.parse(readFileSync(join(out, 'assets', 'mechanical-orchestra-bar', 'kit.json'), 'utf8')) as { samples: { name: string; pitch: number }[] };
  assert.deepEqual(kit.samples.map(s => [s.name, s.pitch]), [['note-60', 60], ['note-64', 64], ['note-67', 67]]);
  assert.deepEqual(containmentProblems(out, 'kit-demo.json'), []);
  const v = engine('validate', join(out, 'kit-demo.json'), '--json'); assert.equal(JSON.parse(v.stdout).ok, true, v.stdout);
  await assert.rejects(bounceKit('living-bass', join(dir, 'k2'), { pitches: [90] }), /outside living-bass range/);
});

test('committed CROSSING demo and example listening copies match their manifests', () => {
  const demo = 'studio-001/demo';
  for (const line of readFileSync(`${demo}/SHA256SUMS`, 'utf8').trim().split('\n')) { const [h, f] = line.split('  '); assert.equal(sha256(readFileSync(`${demo}/${f}`)), h, f); }
  const d = JSON.parse(readFileSync(`${demo}/DEMO.json`, 'utf8')) as { scoreSha256: string; files: Record<string, { engine: { clipping: boolean; durationSeconds: number }; r128: { lufs: number; truePeakDb: number } }>; determinism: Record<string, unknown> };
  assert.equal(d.scoreSha256, sha256(readFileSync('studio-001/scores/crossing.score.json')), 'demo was rendered from the committed score');
  const main = d.files['crossing.wav']!;
  assert.ok(main.engine.durationSeconds >= 45 && main.engine.durationSeconds <= 60 && !main.engine.clipping && main.r128.truePeakDb <= -1);
  assert.equal(d.determinism.bounceTwiceIdentical, true); assert.equal(d.determinism.engineRenderTwiceIdentical, true);
  // package manifest: text files hash-match; phrase WAVs are listed for regeneration
  const sums = readFileSync(`${demo}/package-manifest/SHA256SUMS`, 'utf8').trim().split('\n').map(l => l.split('  ') as [string, string]);
  for (const [h, f] of sums) if (!f.endsWith('.wav')) assert.equal(sha256(readFileSync(`${demo}/package-manifest/${f}`)), h, f);
  assert.ok(sums.filter(([, f]) => f.endsWith('.wav')).length >= 30);
  // the committed demo was bounced by exactly the current rack sources (any rack change requires node studio-001/demo/build.ts)
  const cat = JSON.parse(readFileSync(`${demo}/package-manifest/catalog.json`, 'utf8')) as { generator: { file: string; sha256: string }[] };
  const rackFiles = readdirSync('studio-001/rack').filter(f => f.endsWith('.ts')).map(f => `studio-001/rack/${f}`).concat('studio-001/rack/frozen.json').sort();
  assert.deepEqual(cat.generator.map(g => g.file).sort(), rackFiles);
  for (const g of cat.generator) assert.equal(sha256(readFileSync(g.file)), g.sha256, `${g.file} changed after the demo was built`);
  normalizeScore(JSON.parse(readFileSync('studio-001/scores/crossing.score.json', 'utf8')));
  const ex = JSON.parse(readFileSync('studio-001/scores/examples/audio/EXAMPLES.json', 'utf8')) as { files: Record<string, { mp3Sha256: string; score: string }> };
  for (const [f, v] of Object.entries(ex.files)) { assert.equal(sha256(readFileSync(`studio-001/scores/examples/audio/${f}`)), v.mp3Sha256, f); assert.ok(existsSync(v.score)); normalizeScore(JSON.parse(readFileSync(v.score, 'utf8'))); }
});
