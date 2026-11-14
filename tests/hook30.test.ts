// HOOK//30 (two 30-second candidates developed from HOOK//10 B1): the frozen B1 benchmark keeps its bytes, both
// scores carry B1's motifs and first movement note for note, the motif transformations lower to the intended
// pitches, the event map is sample-accurate, and the committed masters, stems and manifest verify.
// FFmpeg-dependent checks skip without it.
import test from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { mkdtempSync, readFileSync, readdirSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { sha256, ffmpegVersion, type NoteInput } from '../studio-001/rack/index.ts';
import { beatFrame } from '../studio-001/rack/curves.ts';
import { lowerScore, motifReport, motifEvents, hook10Gate, normalizeAnyScore, onsetFrame } from '../studio-001/motif/index.ts';
import { seamCheck } from '../studio-001/scores/hook10/build.ts';
import { buildCandidate, eventMap, CANDIDATES, LOOP_FRAMES, EVENT_MAP_SCHEMA } from '../studio-001/scores/hook30/build.ts';
import { groove, ascension } from '../studio-001/scores/hook30/compose.ts';
import { integratedLufs, truePeakDb, wavChannels } from '../studio-001/scores/hook30/loudness.ts';

const read = (f: string) => JSON.parse(readFileSync(f, 'utf8')) as unknown;
const OUT = 'proofs/hook30', SCORES = 'studio-001/scores/hook30', HOOK10 = 'proofs/v09-motif/hook10';
type Score = Parameters<typeof eventMap>[0] & { motifs: { id: string }[]; annotations: { harmony: [number, string][]; cues: { id: string; beat: number }[] } };
const score = (id: string) => read(`${SCORES}/hook30-${id.toLowerCase()}.score.json`) as Score;
const b1 = read('studio-001/scores/hook10/hook10-b1.score.json') as { motifs: { id: string }[] };
type Plain = { beat: number; beats: number; pitch: number; velocity: number };
/** Notes of one part, as the rack will play them (repeats expanded, swing applied), restricted to a beat range. */
const played = (input: unknown, part: string, from: number, to: number): Plain[] =>
  normalizeAnyScore(input).parts.find(p => p.id === part)!.perf.notes.filter(n => n.beat >= from - 1e-9 && n.beat < to - 1e-9).map(n => ({ beat: +n.beat.toFixed(6), beats: n.beats, pitch: n.pitch, velocity: +n.velocity.toFixed(6) }));
const phrasePitches = (input: unknown, id: string) => { const ph = lowerScore(input).phrases.find(p => p.id === id); assert.ok(ph, `phrase ${id}`); return ph.notes.map(n => n.pitch); };
const phraseBeats = (input: unknown, id: string) => lowerScore(input).phrases.find(p => p.id === id)!.notes.map(n => n.beat);

test('the frozen HOOK//10 benchmark, the B1 score and the v0.9 motif layer keep their bytes', () => {
  // tests/fixtures/hook30-pinned.json holds the SHA-256 of every file of studio-001/motif and studio-001/scores/hook10, the
  // v0.9 contract and guide, and the HOOK//10 manifest and SHA256SUMS, read from PR #49's head (d65ef67).
  // HOOK//30 adds files beside these; it may never edit them.
  const PINNED = read('tests/fixtures/hook30-pinned.json') as Record<string, string>;
  for (const dir of ['studio-001/motif', 'studio-001/scores/hook10']) assert.deepEqual(readdirSync(dir).map(f => `${dir}/${f}`).sort(), Object.keys(PINNED).filter(f => f.startsWith(`${dir}/`)).sort(), `no file added to or removed from ${dir}`);
  for (const [file, want] of Object.entries(PINNED)) assert.equal(sha256(readFileSync(file)), want, file);
  // the B1 master the owner chose, byte for byte, and every other HOOK//10 file through the pinned SHA256SUMS
  assert.equal(sha256(readFileSync(`${HOOK10}/HOOK10-B1-motif-development.wav`)), '41c8541b546a46081e0d940bbef7c8cd34869434167728b5e602a3f3649e7a38');
  for (const line of readFileSync(`${HOOK10}/SHA256SUMS`, 'utf8').trim().split('\n')) assert.equal(sha256(readFileSync(join(HOOK10, line.slice(66)))), line.slice(0, 64), line.slice(66));
});

test('the committed scores are exactly what compose.ts writes', () => {
  assert.equal(readFileSync(`${SCORES}/hook30-groove.score.json`, 'utf8'), JSON.stringify(groove(), null, 2) + '\n');
  assert.equal(readFileSync(`${SCORES}/hook30-ascension.score.json`, 'utf8'), JSON.stringify(ascension(), null, 2) + '\n');
});

test('B1 DNA: the eight B1 motifs are carried verbatim and movement I plays B1 note for note', () => {
  for (const c of CANDIDATES) {
    const s = score(c.id);
    assert.deepEqual(s.motifs.slice(0, b1.motifs.length), b1.motifs, `${c.id}: hook, head, echo, stretto, cadence, riff, riff-half, pulse`);
    assert.deepEqual(b1.motifs.map(m => m.id), ['hook', 'head', 'echo', 'stretto', 'cadence', 'riff', 'riff-half', 'pulse']);
    for (const part of ['voice', 'bass', 'bars']) {
      const mine = played(s, part, 0, 16), theirs = played(b1, part, 0, 16);
      assert.equal(mine.length, theirs.length, `${c.id} ${part}: same number of notes in bars 1-4`);
      // GROOVE swings its sixteenths; pitches, durations and velocities are B1's, and so are the notated onsets
      assert.deepEqual(mine.map(n => [n.pitch, n.beats, n.velocity]), theirs.map(n => [n.pitch, n.beats, n.velocity]), `${c.id} ${part}: B1's pitches, lengths and velocities`);
    }
    const onsets = (input: unknown, part: string) => lowerScore(input).phrases.filter(p => p.part === part && p.at < 16).flatMap(p => p.notes.map(n => `${n.beat}:${n.pitch}`)).sort();
    for (const part of ['voice', 'bass', 'bars', 'clock']) assert.deepEqual(onsets(s, part), onsets(b1, part), `${c.id} ${part}: every B1 phrase note at its notated beat`);
    // the first thing heard is the hook itself, stated literally by the lead voice
    const first = lowerScore(s).phrases.find(p => p.id === 'voice.hook')!;
    assert.equal(first.literal, true); assert.equal(first.at, 0);
    assert.deepEqual(first.notes.map(n => n.pitch), [69, 77, 76, 72, 74], 'A4 F5 E5 C5 D5');
  }
});

test('structure: 12 bars, three movements, 1,323,000 frames, and the v0.9 structure gate', () => {
  assert.equal(LOOP_FRAMES, 1_323_000); assert.equal(beatFrame(48, 96), 1_323_000); assert.equal(LOOP_FRAMES / 44100, 30);
  for (const c of CANDIDATES) {
    const s = score(c.id), n = normalizeAnyScore(s), report = motifReport(s), gate = hook10Gate(report);
    assert.equal(n.bpm, 96); assert.equal(n.bars, 12); assert.equal(n.endBeat, 48); assert.equal(n.key.label, 'D minor');
    assert.deepEqual(n.sections.map(x => [x.id, x.bars]), [['recognition', 4], ['transformation', 4], ['payoff', 4]]);
    assert.equal(gate.pass, true, `${c.id}: ${JSON.stringify(gate.checks)}`);
    assert.equal(report.recognizability, 1); assert.deepEqual(report.unrecognizable, []);
    assert.ok(Object.values(report.maxLiteralRun).every(x => x <= 2), `${c.id}: no bar repeated more than once in a row: ${JSON.stringify(report.maxLiteralRun)}`);
    assert.ok(report.developingKinds.length >= 8, `${c.id}: ${report.developingKinds.join(', ')}`);
    assert.ok(report.statements.hook!.parts.length >= 4, `${c.id}: the hook is stated by ${report.statements.hook!.parts.join(', ')}`);
    assert.ok(report.statements.hook!.varied >= 30, `${c.id}: ${report.statements.hook!.varied} developed statements of the hook`);
    // the three movements are not copies. In the lead voice the only bars that come back are the hook itself at the
    // payoff (GROOVE; ASCENSION turns it major) and the inverted cadence that closes movements I and III ...
    const bar = (part: string, k: number) => played(s, part, 4 * k, 4 * k + 4).map(x => `${(x.beat - 4 * k).toFixed(3)}/${x.pitch}`).join(' ');
    const lead = Array.from({ length: 12 }, (_, k) => bar('voice', k)), returns: number[][] = [];
    for (let a = 0; a < 12; a++) for (let z = a + 1; z < 12; z++) if (lead[a] !== '' && lead[a] === lead[z]) returns.push([a + 1, z + 1]);
    assert.deepEqual(returns, c.id === 'GROOVE' ? [[1, 9], [4, 12]] : [[4, 12]], `${c.id}: lead bars that return`);
    // ... and no bar of the whole ensemble is ever played twice
    const whole = Array.from({ length: 12 }, (_, k) => n.parts.map(p => `${p.id}: ${bar(p.id, k)}`).join(' | '));
    assert.equal(new Set(whole).size, 12, `${c.id}: twelve different bars`);
  }
});

test('GROOVE: the transformations lower to the intended notes', () => {
  const s = score('GROOVE');
  assert.equal(normalizeAnyScore(s).swing, 0.55);
  assert.deepEqual(phrasePitches(s, 'bass.call'), [50, 58, 57, 53, 55], 'the bass sings the hook a fifth lower, an octave down: D3 Bb3 A3 F3 G3');
  assert.deepEqual(phraseBeats(s, 'bass.call'), [16.5, 17.25, 18.5, 19, 19.5], 'half a beat late');
  assert.deepEqual(phrasePitches(s, 'voice-2.reply'), [55, 64, 62, 58, 60], 'the low voice answers over C9: G3 E4 D4 Bb3 C4');
  assert.deepEqual([phrasePitches(s, 'bass.trade'), phrasePitches(s, 'voice.trade')], [[45, 53], [65, 74]], 'trading the rising sixth: A2-F3, then F4-D5');
  assert.deepEqual([phrasePitches(s, 'bars.mirror-f'), phrasePitches(s, 'bars.mirror-bb')], [[81, 72], [86, 77]], 'the mallets answer with the falling sixth');
  assert.deepEqual([phrasePitches(s, 'voice.hits-a'), phrasePitches(s, 'voice.hits-b'), phrasePitches(s, 'bass.hits-a'), phrasePitches(s, 'bass.hits-b')], [[74, 74], [73, 73], [40, 40], [39, 39]], 'Em7b5 to Eb9: D to D-flat over E to E-flat');
  assert.deepEqual([...phraseBeats(s, 'voice.hits-a'), ...phraseBeats(s, 'voice.hits-b')], [28, 28.75, 29.5, 30.25], 'four hits on the hook\'s dotted rhythm');
  assert.deepEqual(phrasePitches(s, 'voice.drop'), [69, 77, 76, 72, 74], 'the hook returns at pitch');
  assert.deepEqual(phrasePitches(s, 'voice.lift'), [72, 81, 79, 76, 77], 'answered a third higher: C5 A5 G5 E5 F5');
  assert.deepEqual(phrasePitches(s, 'voice-2.under-lift'), [69, 77, 76, 72, 74], 'with the original hook as its harmony');
  assert.deepEqual(phrasePitches(s, 'voice.reach'), [74, 82, 76, 84], 'D5-Bb5, E5-C6: the B1 climb an octave higher');
  assert.deepEqual(phrasePitches(s, 'voice.cadence-out'), [74, 65, 67, 70, 69], 'the inverted hook ends on A4, where the hook begins');
});

test('ASCENSION: the transformations lower to the intended notes', () => {
  const s = score('ASCENSION');
  assert.equal(normalizeAnyScore(s).swing, 0.5);
  assert.deepEqual(phrasePitches(s, 'bass.rise'), [46, 47, 48, 49], 'the bass climbs by semitones: Bb2 B2 C3 C#3');
  assert.deepEqual(phraseBeats(s, 'bass.rise'), [16, 20, 24, 28]);
  assert.deepEqual(phrasePitches(s, 'tines.rise'), [82, 83, 84, 85], 'tines mark the same line three octaves up');
  assert.deepEqual([phrasePitches(s, 'voice-2.canon-1'), phrasePitches(s, 'voice-2.canon-2'), phrasePitches(s, 'voice-2.canon-3')], [[53, 62, 60, 57, 58], [57, 65, 64, 60, 62], [58, 67, 65, 62, 64]], 'the low voice rises bar by bar');
  assert.deepEqual([phrasePitches(s, 'voice.canon-1'), phrasePitches(s, 'voice.canon-2')], [[69, 77, 76, 72, 74], [69, 77, 76, 72, 79]], 'the lead sings the hook at pitch twice; the second time it ends upwards on G5');
  assert.deepEqual([phraseBeats(s, 'voice.canon-1')[0], phraseBeats(s, 'voice.canon-2')[0]], [18, 22], 'two beats behind the low voice');
  assert.deepEqual(phrasePitches(s, 'voice.hang'), [79], 'the seventh of A7');
  assert.deepEqual(phrasePitches(s, 'bars.pickup-major'), [83, 79, 81], 'the pickup with a B natural');
  assert.deepEqual(phrasePitches(s, 'voice.major'), [69, 78, 76, 73, 74], 'the hook in D major: A4 F#5 E5 C#5 D5 (the G resolves to F-sharp)');
  assert.deepEqual(phrasePitches(s, 'voice.ascent'), [74, 83, 81, 78, 79], 'answered a fourth higher: D5 B5 A5 F#5 G5');
  assert.deepEqual(phrasePitches(s, 'voice-2.under-ascent'), [66, 74, 73, 69, 71], 'in parallel sixths below');
  assert.deepEqual(phrasePitches(s, 'voice.darken'), [74, 82, 76, 84], 'the same reach with a B-flat: G minor');
  assert.deepEqual(phrasePitches(s, 'bass.major'), [38, 38, 50, 45, 49, 50], 'the riff in D major (C-sharp)');
  assert.deepEqual(phrasePitches(s, 'voice.cadence-out'), [74, 65, 67, 70, 69]);
  const voice = played(s, 'voice', 0, 48), top = Math.max(...voice.map(n => n.pitch));
  assert.equal(top, 84); assert.ok(voice.find(n => n.pitch === 84)!.beat >= 40, 'the highest sung note is in the last movement');
});

test('the speeding mallets: eighths, triplets, sixteenths, shared by bars and tines', () => {
  for (const c of CANDIDATES) {
    const s = score(c.id), ph = (id: string) => lowerScore(s).phrases.find(p => p.id === id)!;
    const line = ['bars.call-1', 'tines.reply-1', 'bars.call-2', 'tines.reply-2'].flatMap(id => ph(id).notes);
    assert.deepEqual(line.map(n => n.beat), [40, 40.5, 41, 41.5, 42, 42.5, 43, 43.5], `${c.id}: eighths`);
    assert.deepEqual(line.map(n => n.pitch), phrasePitches(b1, 'bars.stretto'), `${c.id}: B1's stretto line, note for note, now alternating between bars and tines`);
    const triplets = ['bars.triplet-1', 'tines.triplet-2', 'bars.triplet-3'].flatMap(id => ph(id).notes);
    assert.deepEqual(triplets.map(n => +(n.beat - 44).toFixed(3)), [0, 0.333, 0.667, 1, 1.333, 1.667], `${c.id}: eighth triplets`);
    assert.deepEqual(triplets.map(n => n.pitch), [81, 89, 82, 91, 84, 93], `${c.id}: the climb continues past where B1 stopped`);
    const run = ['tines.run', 'tines.run-2'].flatMap(id => ph(id).notes);
    assert.deepEqual(run.map(n => n.beat), [46.25, 46.5, 46.75, 47, 47.25, 47.5, 47.75], `${c.id}: sixteenths`);
    assert.deepEqual(run.map(n => n.pitch), [88, 85, 86, 79, 88, 85, 93], `${c.id}: E6 C#6 D6, then the stretto cell at four times its first speed`);
    assert.deepEqual(ph('bars.pickup-loop').notes.map(n => [n.beat, n.pitch]), ph('bars.pickup').notes.map(n => [n.beat + 32, n.pitch]), `${c.id}: the B1 pickup closes the loop`);
    for (const id of ['bars.call-1', 'tines.reply-2', 'bars.triplet-3', 'tines.run-2']) assert.equal(ph(id).root, 'hook', `${id} derives from the hook`);
  }
});

test('event map: sample-accurate, complete, and equal to the committed file', () => {
  for (const c of CANDIDATES) {
    const s = score(c.id), map = eventMap(s), n = normalizeAnyScore(s), swing = s.swing ?? 0.5;
    assert.deepEqual(read(`${OUT}/${c.id}/event-map.json`), JSON.parse(JSON.stringify(map)), `${c.id}: committed event map`);
    assert.deepEqual(read(`${OUT}/${c.id}/motif-events.json`), JSON.parse(JSON.stringify(motifEvents(s))), `${c.id}: committed motif events`);
    assert.equal(map.schema, EVENT_MAP_SCHEMA); assert.equal(map.sampleRate, 44100); assert.equal(map.loopFrames, 1_323_000); assert.equal(map.bars, 12);
    assert.deepEqual(map.barGrid.map(b => b.frame), Array.from({ length: 12 }, (_, k) => k * 110_250), 'a bar is exactly 110,250 frames');
    assert.deepEqual(map.beatGrid.map(b => b.frame), Array.from({ length: 48 }, (_, k) => Math.round(k * 27_562.5)));
    assert.deepEqual(map.movements.map(m => [m.startBar, m.startFrame, m.endFrame]), [[1, 0, 441_000], [5, 441_000, 882_000], [9, 882_000, 1_323_000]]);
    // every note of every part is in the map, on the frame the rack places it
    assert.equal(map.notes.length, n.parts.reduce((sum, p) => sum + p.perf.notes.length, 0), `${c.id}: one event per performed note`);
    for (const e of map.notes) { assert.equal(e.frame, onsetFrame(e.beat, 96, swing), e.id); assert.ok(e.frame >= 0 && e.frame < LOOP_FRAMES, e.id); }
    for (const part of n.parts) {
      const want = part.perf.notes.map(x => `${Math.round(x.beat * n.beatSeconds * 44100)}:${x.pitch}`).sort(), got = map.notes.filter(e => e.part === part.id).map(e => `${e.frame}:${e.pitch}`).sort();
      assert.deepEqual(got, want, `${c.id} ${part.id}: map frames equal the frames of the normalised performance`);
    }
    assert.equal(map.phrases.length, lowerScore(s).phrases.length);
    for (const p of map.phrases) assert.ok(Array.isArray(p.chain) && typeof p.root === 'string' && p.endFrame! > p.frame, p.id);
    // harmony and cues: sorted, inside the loop, on the notated grid
    assert.equal(map.harmony[0]!.chord, 'Dm'); assert.equal(map.harmony[0]!.frame, 0);
    for (const list of [map.harmony, map.cues]) for (let i = 1; i < list.length; i++) assert.ok(list[i]!.frame >= list[i - 1]!.frame);
    assert.ok(map.cues.some(q => q.id === 'hook' && q.frame === 0) && map.cues.some(q => q.id === 'triplets' && q.frame === 1_212_750) && map.cues.some(q => q.id === 'loop' && q.frame === LOOP_FRAMES));
    // authored notes (not from phrases) keep their own ids
    const authored = s.parts.reduce((sum, p) => sum + ((p.notes as NoteInput[] | undefined)?.length ?? 0), 0);
    assert.equal(map.notes.filter(e => e.id.includes('.authored.')).length, authored);
  }
});

test('committed masters: manifest, hashes, exact length, loop verification, matched loudness, gates', () => {
  const manifest = read(`${OUT}/MANIFEST.json`) as { loopFrames: number; targetLufs: number; candidates: { id: string; scoreFile: string; scoreSha256: string;
    master: { file: string; frames: number; loudness: { lufs: number; truePeakDb: number }; loudnessLoopX3: { lufs: number }; clipped: number; samplePeakDb: number };
    loop: { foldMaxAbsError: number; tailFullyDecayed: boolean; seamResidueLsb: { renderFirstSample: number; renderLastSample: number }; loopX3IsThreeExactCopies: boolean; seam: ReturnType<typeof seamCheck> };
    stems: { list: { part: string; file: string; clipped: number }[]; sumVsMasterMaxAbsLsb: number; roundingBoundLsb: number }; eventMap: { failed: string[]; checkedAgainstAudio: number };
    technicalGate: Record<string, boolean>; files: Record<string, { sha256: string; bytes: number }> }[] };
  assert.equal(manifest.loopFrames, 1_323_000); assert.equal(manifest.targetLufs, -16); assert.deepEqual(manifest.candidates.map(v => v.id), ['GROOVE', 'ASCENSION']);
  const sums = readFileSync(`${OUT}/SHA256SUMS`, 'utf8').trim().split('\n').map(l => [l.slice(66), l.slice(0, 64)] as const);
  for (const [file, want] of sums) assert.equal(sha256(readFileSync(join(OUT, file))), want, file);
  for (const v of manifest.candidates) {
    assert.equal(sha256(readFileSync(v.scoreFile)), v.scoreSha256, `${v.id}: built from the committed score`);
    const wav = readFileSync(join(OUT, v.master.file));
    assert.equal(wav.toString('latin1', 0, 4), 'RIFF'); assert.equal(wav.readUInt16LE(22), 2); assert.equal(wav.readUInt32LE(24), 44100); assert.equal(wav.readUInt16LE(34), 16);
    assert.equal(wav.readUInt32LE(40) / 4, 1_323_000, `${v.id}: exactly 1,323,000 frames`); assert.equal(wav.length, 44 + 1_323_000 * 4); assert.equal(v.master.frames, 1_323_000);
    const pcm = new Int16Array(wav.buffer, wav.byteOffset + 44, 2 * 1_323_000); let top = 0; for (const x of pcm) top = Math.max(top, Math.abs(x));
    assert.ok(top < 32767, `${v.id}: no sample at full scale (peak ${top})`);
    assert.deepEqual(seamCheck(wav), v.loop.seam, `${v.id}: seam statistics recomputed from the committed WAV`);
    assert.equal(v.loop.seam.pass, true); assert.equal(v.loop.foldMaxAbsError, 0); assert.equal(v.loop.tailFullyDecayed, true); assert.equal(v.loop.loopX3IsThreeExactCopies, true);
    assert.deepEqual(v.loop.seamResidueLsb, { renderFirstSample: 0, renderLastSample: 0 });
    assert.ok(Object.values(v.technicalGate).every(Boolean), `${v.id}: ${JSON.stringify(v.technicalGate)}`);
    assert.ok(Math.abs(v.master.loudness.lufs + 16) <= 0.15 && Math.abs(v.master.loudnessLoopX3.lufs + 16) <= 0.15 && v.master.loudness.truePeakDb <= -1 && v.master.clipped === 0, `${v.id}: -16 LUFS, below -1 dBTP, no clipping`);
    assert.ok(v.stems.sumVsMasterMaxAbsLsb <= v.stems.roundingBoundLsb && v.stems.list.every(st => st.clipped === 0) && v.stems.list.some(st => st.part === 'room'));
    assert.deepEqual(v.eventMap.failed, []); assert.ok(v.eventMap.checkedAgainstAudio >= 100);
    for (const f of [v.master.file, v.master.file.replace('.wav', '.mp3'), v.master.file.replace('.wav', '-loop-x3.mp3'), `${v.id}/score.json`, `${v.id}/score.lowered.json`, `${v.id}/performance.json`, `${v.id}/motif-report.json`, `${v.id}/event-map.json`, ...v.stems.list.map(st => st.file)]) assert.ok(f in v.files, f);
    assert.deepEqual(read(join(OUT, v.id, 'score.json')), read(v.scoreFile));
  }
  const [a, b] = manifest.candidates;
  assert.ok(Math.abs(a!.master.loudness.lufs - b!.master.loudness.lufs) <= 0.1, 'the two candidates are level-matched');
});

test('loudness and true peak: an independent BS.1770 meter agrees with the FFmpeg numbers in the manifest', () => {
  // a 1 kHz sine at -20 dBFS peak in both channels is -20.0 LUFS by definition (BS.1770 calibration: 997 Hz at -18 dBFS stereo reads -18)
  const sine = Float64Array.from({ length: 5 * 44100 }, (_, i) => 0.1 * Math.sin(2 * Math.PI * 997 * i / 44100));
  assert.ok(Math.abs(integratedLufs([sine, sine]) + 20) < 0.05, `calibration tone reads ${integratedLufs([sine, sine]).toFixed(3)} LUFS`);
  // a sine sampled at its zero crossings and 45 degrees off its peaks: the samples reach 0.7071 but the true peak is 1.0
  const inter = Float64Array.from({ length: 4410 }, (_, i) => Math.sin(Math.PI / 2 * i + Math.PI / 4));
  assert.ok(Math.abs(truePeakDb([inter])) < 0.1, `inter-sample peak reads ${truePeakDb([inter]).toFixed(3)} dBTP`);
  const manifest = read(`${OUT}/MANIFEST.json`) as { candidates: { id: string; master: { file: string; loudness: { lufs: number; truePeakDb: number } } }[] };
  const own: number[] = [];
  for (const v of manifest.candidates) {
    const ch = wavChannels(readFileSync(join(OUT, v.master.file))), lufs = integratedLufs(ch), tp = truePeakDb(ch);
    assert.ok(Math.abs(lufs - v.master.loudness.lufs) <= 0.1, `${v.id}: ${lufs.toFixed(2)} LUFS here, ${v.master.loudness.lufs} from FFmpeg`);
    assert.ok(Math.abs(tp - v.master.loudness.truePeakDb) <= 0.15 && tp <= -1, `${v.id}: ${tp.toFixed(2)} dBTP here, ${v.master.loudness.truePeakDb} from FFmpeg`);
    own.push(lufs);
  }
  assert.ok(Math.abs(own[0]! - own[1]!) <= 0.1, `matched level: ${own.map(x => x.toFixed(2)).join(' and ')} LUFS`);
  // the B1 master the candidates are compared with sits at the same loudness
  assert.ok(Math.abs(integratedLufs(wavChannels(readFileSync(`${HOOK10}/HOOK10-B1-motif-development.wav`))) + 16) <= 0.1);
});

test('stems: the committed FLAC stems add up to the committed master', { skip: !ffmpegVersion() && 'needs FFmpeg to decode FLAC' }, () => {
  for (const c of CANDIDATES) {
    const wav = readFileSync(join(OUT, `${c.name}.wav`)), master = new Int16Array(wav.buffer, wav.byteOffset + 44, 2 * LOOP_FRAMES), sum = new Int32Array(master.length);
    const stems = readdirSync(join(OUT, c.id, 'stems')).filter(f => f.endsWith('.flac'));
    for (const f of stems) {
      const r = spawnSync(process.env.DAEMONV12_FFMPEG || 'ffmpeg', ['-hide_banner', '-nostdin', '-v', 'error', '-i', join(OUT, c.id, 'stems', f), '-f', 's16le', '-'], { maxBuffer: 1 << 28 });
      assert.equal(r.status, 0, f); assert.equal(r.stdout.length, 4 * LOOP_FRAMES, `${f}: exactly 1,323,000 frames`);
      const pcm = new Int16Array(r.stdout.buffer, r.stdout.byteOffset, 2 * LOOP_FRAMES); for (let i = 0; i < sum.length; i++) sum[i] = sum[i]! + pcm[i]!;
    }
    let worst = 0; for (let i = 0; i < sum.length; i++) worst = Math.max(worst, Math.abs(sum[i]! - master[i]!));
    assert.ok(worst <= Math.ceil(stems.length / 2) + 1, `${c.id}: ${stems.length} stems sum to the master within rounding (${worst} LSB)`);
  }
});

test('HOOK//30: rebuilding both candidates reproduces every committed file', { skip: ffmpegVersion() !== (read(`${OUT}/MANIFEST.json`) as { ffmpeg: string }).ffmpeg && 'needs the FFmpeg build recorded in the manifest (loudness gain and encoders come from it)' }, async t => {
  const dir = mkdtempSync(join(tmpdir(), 'hook30-')); t.after(() => rmSync(dir, { recursive: true, force: true }));
  const committed = (read(`${OUT}/MANIFEST.json`) as { candidates: { id: string; files: Record<string, { sha256: string }>; technicalGate: Record<string, boolean> }[] }).candidates;
  for (const c of CANDIDATES) {
    const built = await buildCandidate(c, dir, () => {}), want = committed.find(v => v.id === c.id)!;
    assert.deepEqual(Object.keys(built.files).sort(), Object.keys(want.files).sort());
    for (const [file, d] of Object.entries(built.files)) assert.equal(d.sha256, want.files[file]!.sha256, file);
    assert.deepEqual(built.technicalGate, want.technicalGate);
  }
});
