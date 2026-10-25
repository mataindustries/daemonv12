import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, readFileSync, readdirSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { spawnSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { CHROME, DEFAULT_OUTPUT, fileName, frameCount, GHOST_VOWEL, PACK, rate, sounds, synthesize } from '../scripts/generate-v12-signature.ts';
import { audition, showcase } from '../scripts/create-v12-signature-projects.ts';
import { lowLock, packReport } from '../scripts/inspect-v12-signature.ts';
import { budgetUse } from '../scripts/verify-v12-signature.ts';
import { decodePcm } from '../src/render/index.ts';
import { readWavInfo } from '../src/render/wav.ts';
import { compileProjectFile } from '../src/pipeline.ts';
import { parseKit } from '../src/project/sample-schema.ts';
import { DaemonTools } from '../mcp/handlers.ts';

const pack = DEFAULT_OUTPUT, directory = join(pack, PACK.directory);
const hash = (b: Uint8Array) => createHash('sha256').update(b).digest('hex');
const catalog = JSON.parse(readFileSync(join(pack, 'v12-signature.catalog.json'), 'utf8'));
const generated = [...sounds.map((_, i) => fileName(i)), 'kit.json'];
const report = packReport(pack);
const measured = Object.fromEntries(report.sounds.map((s: { id: string }) => [s.id, s])) as Record<string, any>;
const band = (id: string, name: string) => measured[id]!.bandPowerPercent[name] as number;

test('V12 SIGNATURE regenerates byte-identical WAVs, kit, catalog and projects in a fresh process', t => {
  const root = mkdtempSync(join(tmpdir(), 'v12-signature-')); t.after(() => rmSync(root, { recursive: true, force: true }));
  for (const script of ['scripts/generate-v12-signature.ts', 'scripts/create-v12-signature-projects.ts']) {
    const child = spawnSync(process.execPath, [script, root], { encoding: 'utf8' });
    assert.equal(child.status, 0, child.stderr);
  }
  assert.deepEqual(readdirSync(join(root, PACK.directory)).sort(), [...generated].sort());
  for (const file of generated) assert.deepEqual(readFileSync(join(root, PACK.directory, file)), readFileSync(join(directory, file)), file);
  for (const file of ['v12-signature.catalog.json', 'v12-signature-audition.json', 'v12-signature-showcase.json'])
    assert.deepEqual(readFileSync(join(root, file)), readFileSync(join(pack, file)), file);
  // In-process synthesis of the cheapest sounds reproduces the catalog hashes too.
  for (const id of ['ghost-tick', 'iron-pulse', 'abyss']) { const i = sounds.findIndex(s => s.id === id); assert.equal(hash(synthesize(i)), catalog.sounds[i].sha256, id); }
});

test('V12 SIGNATURE: sixteen PCM16/44100 sources with headroom, no clipping or DC, zero endpoints, hashes in the catalog', () => {
  assert.deepEqual(readdirSync(directory).sort(), [...generated].sort());
  assert.equal(sounds.length, 16); assert.equal(new Set(sounds.map(s => s.id)).size, 16);
  const hashes = new Set<string>();
  for (const [i, s] of sounds.entries()) {
    const entry = catalog.sounds[i], bytes = readFileSync(join(pack, entry.file)), info = readWavInfo(bytes);
    assert.ok(info.ok, s.id); assert.equal(info.info.formatTag, 1); assert.equal(info.info.sampleRate, 44100);
    assert.equal(info.info.bitsPerSample, 16); assert.equal(info.info.channels, s.channels, s.id);
    const pcm = decodePcm(bytes).pcm!; assert.equal(pcm.frames, entry.frames); assert.equal(pcm.frames, frameCount(i));
    let peak = 0; for (const v of pcm.samples) { peak = Math.max(peak, Math.abs(v)); assert.ok(v > -32768 && v < 32767, s.id); }
    assert.ok(Math.abs(20 * Math.log10(peak / 32767) - s.peak) < 0.01, `${s.id} peak`);
    const m = measured[s.id]!;
    assert.ok(m.truePeakDbfs <= s.peak + 1.5 && m.truePeakDbfs < -3, `${s.id} true peak ${m.truePeakDbfs}`);
    assert.ok(Math.abs(m.dc) < 5e-4, `${s.id} DC ${m.dc}`); assert.equal(m.clippedSamples, 0);
    assert.deepEqual(m.endpoints, { firstFrameZero: true, lastFrameZero: true }, s.id);
    // No accidental truncation: the last 5 ms sit 30 dB under the peak, except the riser, whose peak is its boundary.
    if (s.id !== 'ascension') { const tail = pcm.samples.slice(-221 * s.channels); assert.ok(Math.max(...tail.map(Math.abs)) < peak / 31.6, `${s.id} tail`); }
    if (s.channels === 2) assert.ok(pcm.samples.some((v, j) => j % 2 === 0 && v !== pcm.samples[j + 1]), `${s.id} is genuinely stereo`);
    assert.equal(entry.sha256, hash(bytes)); assert.equal(entry.bytes, bytes.length); hashes.add(entry.sha256);
  }
  assert.equal(hashes.size, 16);
  const total = catalog.sounds.reduce((sum: number, s: { bytes: number }) => sum + s.bytes, 0);
  assert.ok(total < 12_000_000, `pack stays under 12 MB: ${total}`);
});

test('V12 SIGNATURE melodic sources last long enough for held phrases across their recommended range', () => {
  const minimum: Record<string, [number, number]> = { // [seconds at root, seconds at the highest recommended rate]
    abyss: [7.5, 4.5], reactor: [5, 3], signal: [4, 2.4], phantom: [5.5, 3.5], 'event-horizon': [9, 6], afterglow: [7.5, 5], specter: [6, 4] };
  for (const [id, [atRoot, atTop]] of Object.entries(minimum)) {
    const entry = catalog.sounds.find((s: { id: string }) => s.id === id);
    assert.ok(entry.seconds >= atRoot, `${id} lasts ${entry.seconds} s`);
    assert.ok(entry.playback.sourceSecondsAtHighestRate >= atTop, `${id} at ${entry.playback.recommendedNotes[1]}: ${entry.playback.sourceSecondsAtHighestRate} s`);
    assert.equal(entry.playback.recommendedRates[1], rate(entry.playback.recommendedSemitones[1]));
    // Held, not plucked: the level halfway through stays within 12 dB of the peak.
    assert.ok(measured[id]!.envelope.levelDbAt['50%'] > -12, `${id} sustains: ${JSON.stringify(measured[id]!.envelope.levelDbAt)}`);
  }
  assert.equal(catalog.rateTable['7'], 1.498307); assert.equal(catalog.rateTable['-12'], 0.5); assert.equal(catalog.rateTable['0'], 1);
});

test('V12 SIGNATURE tuning: every tonal source sits on its root (A, or E5 for PHANTOM)', () => {
  const tuned = catalog.sounds.filter((s: { fundamentalHz: number | null }) => s.fundamentalHz !== null).map((s: { id: string }) => s.id);
  assert.deepEqual(tuned, ['sub-hammer', 'iron-pulse', 'titanium-crack', 'abyss', 'reactor', 'signal', 'phantom', 'event-horizon', 'afterglow', 'specter', 'chrome-strike', 'ascension', 'convergence']);
  const vibrato = new Set(['phantom', 'specter']), spectral = new Set(['titanium-crack', 'chrome-strike']);
  // The riser glides 2^(t/6): in its final 0.1 s the A3 line sweeps 434.95 -> 440 Hz and lands on A4 at the last frame.
  const riser = measured['ascension']!.tuning.spectralPeak.hz;
  assert.ok(riser > 440 * 2 ** (-0.1 / 6) * 0.997 && riser < 440 * 1.003, `ascension lands on A4: ${riser} Hz`);
  for (const id of tuned.filter((id: string) => id !== 'ascension')) {
    const t = measured[id]!.tuning;
    if (spectral.has(id)) { assert.ok(Math.abs(t.spectralPeak.cents) < 5, `${id}: ${JSON.stringify(t)}`); continue; }
    assert.ok(Math.abs(t.medianCents) < (id === 'iron-pulse' ? 12 : id === 'convergence' ? 10 : 5), `${id}: ${JSON.stringify(t)}`);
    if (vibrato.has(id)) assert.ok(t.p90Cents < 35 && t.p10Cents > -35, `${id} vibrato stays within ±35 cents`);
    else if (!['iron-pulse', 'convergence', 'sub-hammer'].includes(id)) assert.ok(t.p90Cents - t.p10Cents < 8, `${id} is stable: ${JSON.stringify(t)}`);
  }
  assert.equal(catalog.sounds.find((s: { id: string }) => s.id === 'phantom').rootNote, 'E5');
  assert.equal(catalog.sounds.find((s: { id: string }) => s.id === 'abyss').fundamentalHz, 55);
});

test('V12 SIGNATURE low end: every A1 source adds in phase with ABYSS; basses and impacts stay mono below 150 Hz', () => {
  const lock = lowLock(pack);
  for (const [id, value] of Object.entries(lock)) assert.ok(value.fundamentalCorrelation > 0.75, `${id}: ${JSON.stringify(value)}`);
  assert.ok(lock['sub-hammer'].sumPeakDbfs < 0 && lock['reactor'].sumPeakDbfs < -1, JSON.stringify(lock));
  assert.ok(band('abyss', '30-120 Hz') > 98, 'ABYSS is a clean sub');
  assert.ok(measured['convergence']!.stereo.lowBandCorrelation > 0.95 && measured['event-horizon']!.stereo.lowBandCorrelation > 0.95);
  assert.ok(measured['reactor']!.stereo.lowBandMonoFoldDownDb > -1, 'REACTOR folds to mono without losing its low band');
});

test('V12 SIGNATURE is click-free and mono-compatible', () => {
  for (const s of sounds) {
    const m = measured[s.id]!;
    if (s.id !== 'ascension') assert.ok(m.clickDb < 8, `${s.id}: isolated HF burst ${m.clickDb} dB at ${m.clickAtSeconds} s`);
    if (s.channels === 2) {
      assert.ok(m.stereo.correlation > 0.3, `${s.id} correlation ${m.stereo.correlation}`);
      assert.ok(m.stereo.monoFoldDownDb > -1.8, `${s.id} mono fold-down ${m.stereo.monoFoldDownDb} dB`);
    }
  }
});

test('V12 SIGNATURE spectral roles: deep kick, punchy kick, bright snare and clap, airy hats, rich mid-bass, bright leads', () => {
  assert.ok(band('sub-hammer', '30-120 Hz') > 80 && band('iron-pulse', '120-500 Hz') + band('iron-pulse', '500-2000 Hz') > 20, 'kicks differ: weight vs punch');
  assert.ok(measured['iron-pulse']!.envelope.decayTo40dBSeconds < measured['sub-hammer']!.envelope.decayTo40dBSeconds - 0.3, 'IRON PULSE is the short one');
  assert.ok(band('titanium-crack', '2000-6000 Hz') + band('titanium-crack', '6000-12000 Hz') > 25, 'snare cracks');
  assert.ok(band('neon-clap', '120-500 Hz') < 1 && band('neon-clap', '2000-6000 Hz') > 30, 'clap is bright, not boomy');
  for (const id of ['ghost-tick', 'open-circuit']) assert.ok(band(id, '120-500 Hz') + band(id, '500-2000 Hz') === 0 && band(id, '12000-22050 Hz') < 45, `${id} band`);
  assert.ok(measured['open-circuit']!.envelope.decayTo20dBSeconds > 5 * measured['ghost-tick']!.envelope.decayTo20dBSeconds, 'open hat rings, closed hat ticks');
  // For a 55 Hz bass the 30–120 Hz band also holds the second harmonic, so judge the harmonics above it.
  assert.ok(band('reactor', '120-500 Hz') + band('reactor', '500-2000 Hz') > 35, 'REACTOR is a mid-bass, not a second sub');
  assert.ok(measured['phantom']!.centroidHz.middle > 1300 && measured['signal']!.centroidHz.start > measured['signal']!.centroidHz.middle, 'leads: bright unison, plucked attack');
  assert.ok(measured['event-horizon']!.centroidHz.middle !== measured['event-horizon']!.centroidHz.end && measured['event-horizon']!.envelope.attackTo3dBSeconds > 1, 'pad swells and evolves');
  assert.ok(band('specter', '500-2000 Hz') > 30, 'vowel formants carry the voice');
  assert.ok(measured['ascension']!.envelope.levelDbAt['10%'] < measured['ascension']!.envelope.levelDbAt['90%'] - 25, 'riser rises');
  assert.ok(measured['ascension']!.centroidHz.end > 2 * measured['ascension']!.centroidHz.start, 'riser brightens');
  assert.ok(measured['convergence']!.envelope.decayTo40dBSeconds > 3, 'impact has a long tail');
});

test('V12 SIGNATURE catalog, kit and existing MCP discovery agree; shared identity is recorded', async () => {
  assert.equal(catalog.pack, 'V12 SIGNATURE'); assert.equal(catalog.version, '1.0.0'); assert.equal(catalog.sampleRate, 44100);
  assert.match(catalog.license, /pending owner declaration/, 'no license is asserted before the owner decides');
  assert.deepEqual(catalog.sounds.map((s: { id: string }) => s.id), sounds.map(s => s.id));
  catalog.sounds.forEach((s: { file: string }, i: number) => assert.equal(s.file, `${PACK.directory}/${fileName(i)}`));
  assert.deepEqual(catalog.identity.chrome.ratios, CHROME.map(m => Number(m.ratio.toFixed(6))));
  assert.deepEqual(catalog.identity.ghostVowel.ah, GHOST_VOWEL.ah);
  const kit = parseKit(JSON.parse(readFileSync(join(directory, 'kit.json'), 'utf8')), 'kit');
  assert.deepEqual(kit.diagnostics, []);
  assert.deepEqual(kit.entries.map(e => [e.name, e.pitch]), [['sub-hammer', 36], ['iron-pulse', 35], ['titanium-crack', 38], ['neon-clap', 39], ['ghost-tick', 42], ['open-circuit', 46], ['chrome-strike', 53]]);
  const api = new DaemonTools(resolve('.')), project = `${pack}/v12-signature-showcase.json`;
  const samples = await api.call('daemonv12_instruments_list', { project, query: 'v12-signature', limit: 50 });
  assert.equal(samples.ok, true); assert.deepEqual(samples.warnings, []); assert.equal(samples.totalSamples, 16);
  const kits = await api.call('daemonv12_drumkits_list', { project });
  assert.equal(kits.ok, true); assert.ok((kits.kits as { kit: string }[]).some(k => k.kit === `${PACK.directory}/kit.json`));
});

test('V12 SIGNATURE projects: audition covers all sixteen, showcase is a 28 s pack-only composition within the v0.7 budget', () => {
  const used = (project: any) => new Set(project.tracks.flatMap((t: any) => t.instrument.type === 'sampler' ? [t.instrument.sample.split('/').at(-1).replace(/^\d+-|\.wav$/g, '')]
    : t.patterns.flatMap((p: any) => p.notes.map((n: any) => n.pitch))));
  for (const [name, project] of [['audition', audition()], ['showcase', showcase()]] as const) {
    const file = join(pack, `v12-signature-${name}.json`);
    assert.deepEqual(JSON.parse(readFileSync(file, 'utf8')), JSON.parse(JSON.stringify(project)), `${name} is the script output`);
    const compiled = compileProjectFile(file);
    assert.deepEqual(compiled.diagnostics, [], name);
    assert.ok(project.tracks.length <= 15);
    assert.ok(project.tracks.every((t: any) => t.instrument.type !== 'gm' && (t.instrument.sample ?? t.instrument.kit).startsWith(`${PACK.directory}/`)), `${name} uses only pack assets`);
    assert.deepEqual([...used(project)].sort(), sounds.map(s => s.id).sort(), `${name} plays all sixteen sounds`);
  }
  const show = showcase() as any;
  assert.equal(show.bpm, 128); assert.deepEqual(show.render.duration, { seconds: 28 }); assert.ok(show.bars * 4 * 60 / show.bpm >= 20);
  // The hook: PHANTOM's tresillo phrase over Am F G E, resolving to A5 on bar 13.
  const phantom = show.tracks.find((t: any) => t.id === 'phantom').patterns[0].notes;
  assert.deepEqual(phantom.map((n: any) => n.start), ['9:1', '9:2+1/8', '9:4', '10:1', '10:2+1/8', '10:4', '11:1', '11:2+1/8', '11:4', '12:1', '12:2+1/8', '12:4', '13:1']);
  assert.deepEqual(phantom.map((n: any) => n.playbackRate ?? 1), [1, 1.33484, 1.189207, 1.059463, 1, 0.793701, 0.890899, 1.189207, 1.059463, 1, 1.259921, 1.498307, 1.33484]);
  // Every sustained instrument is articulated with a gate and an envelope.
  for (const id of ['abyss', 'phantom', 'afterglow', 'event-horizon', 'specter'])
    assert.ok(show.tracks.find((t: any) => t.id === id).patterns[0].notes.every((n: any) => n.gate && n.envelope), id);
  const budget = budgetUse(join(pack, 'v12-signature-showcase.json'));
  assert.ok(budget.tapBudgetPercent < 70 && budget.voiceBudgetPercent < 5, JSON.stringify(budget));
});
