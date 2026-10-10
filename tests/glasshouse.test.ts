import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, readFileSync, readdirSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { spawnSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { fileName, generatePack, GLASS, sounds, synthesize, TUNING } from '../scripts/generate-glasshouse.ts';
import { families, load, measure, pitch } from '../scripts/inspect-glasshouse.ts';
import { decodePcm } from '../src/render/index.ts';
import { readWavInfo } from '../src/render/wav.ts';
import { compileProjectFile } from '../src/pipeline.ts';
import { parseKit } from '../src/project/sample-schema.ts';
import { DaemonTools } from '../mcp/handlers.ts';
const directory = 'examples/assets/glasshouse';
const hash = (b: Uint8Array) => createHash('sha256').update(b).digest('hex');
const catalog = JSON.parse(readFileSync('examples/glasshouse.catalog.json', 'utf8'));
const generated = [...sounds.map((_, i) => fileName(i)), 'kit.json'];
// Requested bounds (seconds) for each sound; 1/16 at 140 BPM is 0.107 s.
const bounds: Record<string, [number, number]> = {
  'glass-hit': [0.6, 1.2], 'glass-reverse': [0.5, 1], 'glass-crush': [0.25, 0.6], 'ghost-vox': [0.5, 1.2], 'vox-chip': [0.04, 0.107],
  'bass-punch-cs': [0.2, 0.4], 'sub-cs': [0.5, 1], 'chrome-clap': [0.2, 0.45], 'pixel-hat': [0.02, 0.07], 'prism-impact': [1, 2],
};

test('GLASSHOUSE regenerates byte-identical WAVs, kit, catalog and audition, in-process and in a fresh process', t => {
  const first = mkdtempSync(join(tmpdir(), 'glasshouse-a-')), second = mkdtempSync(join(tmpdir(), 'glasshouse-b-'));
  t.after(() => { rmSync(first, { recursive: true, force: true }); rmSync(second, { recursive: true, force: true }); });
  generatePack(first);
  const child = spawnSync(process.execPath, ['scripts/generate-glasshouse.ts', second], { encoding: 'utf8' });
  assert.equal(child.status, 0, child.stderr);
  for (const root of [first, second]) {
    assert.deepEqual(readdirSync(join(root, 'assets/glasshouse')).sort(), [...generated].sort());
    for (const file of generated) assert.deepEqual(readFileSync(join(root, 'assets/glasshouse', file)), readFileSync(join(directory, file)), file);
    assert.deepEqual(readFileSync(join(root, 'glasshouse.catalog.json')), readFileSync('examples/glasshouse.catalog.json'));
  }
  // Deterministic hashes: the catalog pins every WAV, and a direct re-synthesis reproduces each one.
  for (const [i, entry] of catalog.sounds.entries()) assert.equal(hash(synthesize(i)), entry.sha256, entry.id);
  const audition = spawnSync(process.execPath, ['scripts/create-glasshouse-audition.ts', first], { encoding: 'utf8' });
  assert.equal(audition.status, 0, audition.stderr);
  assert.deepEqual(readFileSync(join(first, 'glasshouse-audition.json')), readFileSync('examples/glasshouse-audition.json'));
  assert.deepEqual(compileProjectFile(join(first, 'glasshouse-audition.json')).diagnostics, []);
});

test('GLASSHOUSE: ten unique PCM16/44100 sources, intentional channels, headroom, no clipping, no DC, zero endpoints, useful durations', () => {
  assert.deepEqual(readdirSync(directory).sort(), [...generated, 'LICENSE', 'README.md'].sort());
  const hashes = new Set<string>();
  for (const [i, s] of sounds.entries()) {
    const entry = catalog.sounds[i], bytes = readFileSync(join('examples', entry.file)), info = readWavInfo(bytes);
    assert.ok(info.ok, s.id); assert.equal(info.info.formatTag, 1); assert.equal(info.info.sampleRate, 44100);
    assert.equal(info.info.bitsPerSample, 16); assert.equal(info.info.channels, s.channels, s.id);
    const pcm = decodePcm(bytes).pcm!, seconds = pcm.frames / 44100;
    assert.equal(pcm.frames, entry.frames); assert.equal(pcm.frames, Math.round(s.seconds * 44100));
    assert.ok(seconds >= bounds[s.id]![0] && seconds <= bounds[s.id]![1], `${s.id} lasts ${seconds} s`);
    let peak = 0, mean = 0;
    for (const v of pcm.samples) { peak = Math.max(peak, Math.abs(v)); mean += v; assert.ok(v > -32768 && v < 32767, s.id); }
    assert.ok(Math.abs(20 * Math.log10(peak / 32768) - s.peak) < 0.003, s.id);
    assert.ok(s.peak <= -5, `${s.id} keeps at least 5 dB of headroom`);
    assert.ok(Math.abs(mean / pcm.samples.length / 32768) < 0.0005, `${s.id} DC`);
    for (let c = 0; c < s.channels; c++) { assert.equal(pcm.samples[c], 0, s.id); assert.equal(pcm.samples[pcm.samples.length - 1 - c], 0, s.id); }
    // No accidental truncation: the final 5 ms are at least 30 dB below peak, except the reverse, whose 5 ms taper is its boundary.
    if (s.id !== 'glass-reverse') {
      const tail = pcm.samples.slice(-Math.round(0.005 * 44100) * s.channels);
      assert.ok(Math.max(...tail.map(Math.abs)) < peak / 31.6, `${s.id} tail`);
    }
    if (s.channels === 2) assert.ok(pcm.samples.some((v, j) => j % 2 === 0 && v !== pcm.samples[j + 1]), s.id);
    assert.equal(entry.sha256, hash(bytes)); assert.equal(entry.bytes, bytes.length); hashes.add(entry.sha256);
  }
  assert.equal(hashes.size, 10);
  const total = catalog.sounds.reduce((sum: number, s: { bytes: number }) => sum + s.bytes, 0);
  assert.ok(total < 1_000_000, `pack stays small: ${total} bytes`);
});

test('GLASSHOUSE tuning: every tuned sound sits on C# within 5 cents', () => {
  for (const s of catalog.sounds.filter((s: { fundamentalHz: number | null }) => s.fundamentalHz !== null)) {
    const audio = load(join('examples', s.file));
    // The reverse is tuned where it lands (final 0.2 s); the others after their 30 ms onset glides.
    const start = s.id === 'glass-reverse' ? audio.frames - 8820 : 1323, length = s.id === 'glass-reverse' ? 8820 : Math.min(audio.frames - 1323, 22050);
    const found = pitch(audio.mono, s.fundamentalHz, start, length);
    assert.ok(Math.abs(found.cents) < 5, `${s.id}: ${JSON.stringify(found)}`);
  }
  assert.equal(TUNING['C#2'].toFixed(3), '69.296'); assert.equal(TUNING['C#5'].toFixed(3), '554.365');
});

test('GLASSHOUSE spectral roles: clean sub, phone-audible punch, bright glass, dark crush, airy hat, wide prism with mono low end', () => {
  const m = Object.fromEntries(catalog.sounds.map((s: { id: string; file: string; fundamentalHz: number | null }) => [s.id, measure(join('examples', s.file), s.fundamentalHz)]));
  const band = (id: string, name: string) => m[id]!.bandPowerPercent[name] as number;
  assert.ok(band('sub-cs', '30-120 Hz') > 99, 'sub is a clean low sine');
  assert.ok(band('bass-punch-cs', '120-500 Hz') + band('bass-punch-cs', '500-2000 Hz') > 25, 'punch translates to small speakers');
  assert.ok(m['bass-punch-cs']!.lastTenthDb < m['bass-punch-cs']!.firstTenthDb - 30, 'punch has no long tail');
  assert.ok(band('glass-hit', '2000-6000 Hz') > 3 && band('glass-hit', '6000-12000 Hz') > 0.1, 'glass sparkles');
  assert.ok(band('glass-crush', '120-500 Hz') > 50 && band('glass-hit', '120-500 Hz') < 1, 'crush moves the glass into the low mids');
  assert.ok(band('glass-crush', '500-2000 Hz') > 15, 'crush keeps a mid call, not only boom');
  assert.ok(m['glass-reverse']!.lastTenthDb > m['glass-reverse']!.firstTenthDb + 30, 'reverse rises into its boundary');
  assert.ok(m['glass-reverse']!.envelopePeakMs > 800, 'reverse peaks at the end');
  assert.ok(band('ghost-vox', '2000-6000 Hz') + band('ghost-vox', '6000-12000 Hz') > 1, 'vox has air');
  assert.ok(m['vox-chip']!.envelopePeakMs <= 15 && m['vox-chip']!.decayTo40dBMs! <= 100, 'chip attacks sharply and clears a sixteenth');
  assert.ok(band('pixel-hat', '0-30 Hz') + band('pixel-hat', '30-120 Hz') + band('pixel-hat', '120-500 Hz') + band('pixel-hat', '500-2000 Hz') < 0.5, 'hat has no lows');
  assert.ok(band('pixel-hat', '12000-22050 Hz') < 25, 'hat is not dominated by fizz');
  assert.ok(band('chrome-clap', '120-500 Hz') < 40 && band('chrome-clap', '2000-6000 Hz') > 15, 'clap is a clap, not a tom');
  assert.ok(m['chrome-clap']!.stereoCorrelation! > 0.7 && m['chrome-clap']!.lowBandCorrelation! > 0.99, 'clap width is controlled');
  assert.ok(m['prism-impact']!.stereoCorrelation! < 0.8 && m['prism-impact']!.stereoCorrelation! > 0.2, 'prism is wide yet mono-safe');
  assert.ok(m['prism-impact']!.lowBandCorrelation! > 0.9, 'prism low end is centered');
  assert.ok(m['glass-reverse']!.lowBandCorrelation! > 0.9, 'reverse fundamental is not phase-scrambled');
});

test('GLASSHOUSE families: shared glass modes, sliced vox and a phase-locked low pair', () => {
  const f = families();
  const has = (ratios: number[], r: number) => ratios.some(x => Math.abs(x / r - 1) < 0.015);
  // Among the eight strongest peaks (relative to each sound's own C#), all three carry the glass's inharmonic bar modes.
  for (const [id, ratios] of Object.entries(f.glassModeRatios))
    for (const r of [1, 2, 2.756, 5.404]) assert.ok(has(ratios, r), `${id} carries glass mode ${r}: ${ratios}`);
  assert.ok(f.voxProfileSimilarity.chipToVox > 0.9, JSON.stringify(f.voxProfileSimilarity));
  assert.ok(f.voxProfileSimilarity.chipToVox > f.voxProfileSimilarity.clapToVox + 0.2 && f.voxProfileSimilarity.chipToVox > f.voxProfileSimilarity.hatToVox + 0.2);
  assert.ok(f.lowLayer.peakDbfsAtUnity < -0.5, 'punch + sub at velocity 1 do not clip');
  assert.ok(f.lowLayer.coherentGainDb > 1.5 && f.lowLayer.punchToSubCorrelation > 0.85, JSON.stringify(f.lowLayer));
  assert.deepEqual(catalog.families.glass.modeRatios, GLASS.map(m => m.ratio));
  for (const s of catalog.sounds) if (s.derivedFrom) assert.equal(catalog.families[s.family].parent, s.derivedFrom, s.id);
});

test('GLASSHOUSE catalog, kit references and existing MCP discovery agree', async () => {
  assert.equal(catalog.pack, 'GLASSHOUSE'); assert.equal(catalog.license, 'CC0-1.0'); assert.equal(catalog.sampleRate, 44100);
  assert.deepEqual(catalog.sounds.map((s: { id: string }) => s.id), sounds.map(s => s.id));
  catalog.sounds.forEach((s: { file: string }, i: number) => assert.equal(s.file, `assets/glasshouse/${fileName(i)}`));
  const raw = JSON.parse(readFileSync(join(directory, 'kit.json'), 'utf8')), kit = parseKit(raw, 'kit');
  assert.deepEqual(kit.diagnostics, []);
  const rhythmic = catalog.sounds.filter((s: { pitch: number | null }) => s.pitch !== null);
  assert.deepEqual(kit.entries, rhythmic.map((s: { id: string; pitch: number; file: string }) => ({ name: s.id, pitch: s.pitch, sample: s.file.split('/').at(-1) })));
  assert.deepEqual(kit.entries.map(e => e.name), ['glass-hit', 'glass-crush', 'vox-chip', 'bass-punch-cs', 'sub-cs', 'chrome-clap', 'pixel-hat']);
  for (const e of kit.entries) assert.ok(readWavInfo(join(directory, e.sample)).ok, e.sample);
  const api = new DaemonTools(resolve('.'));
  const samples = await api.call('daemonv12_instruments_list', { project: 'examples/glasshouse-audition.json', query: 'glasshouse', limit: 50 });
  assert.equal(samples.ok, true); assert.deepEqual(samples.warnings, []); assert.equal(samples.totalSamples, 10);
  const kits = await api.call('daemonv12_drumkits_list', { project: 'examples/glasshouse-audition.json' });
  assert.equal(kits.ok, true); assert.deepEqual(kits.warnings, []);
  assert.ok((kits.kits as { kit: string }[]).some(k => k.kit === 'assets/glasshouse/kit.json'));
});

test('GLASSHOUSE audition: native project using all ten sounds, kit for rhythm, samplers for gestures', () => {
  const project = JSON.parse(readFileSync('examples/glasshouse-audition.json', 'utf8'));
  assert.equal(project.bpm, 140); assert.equal(project.key, 'C# minor'); assert.doesNotMatch(project.title, /GLASS\/\/FIRE/);
  const compiled = compileProjectFile('examples/glasshouse-audition.json');
  assert.deepEqual(compiled.diagnostics, []);
  assert.deepEqual(compiled.timeline!.tracks.map(t => t.id), sounds.map(s => s.id));
  assert.ok(compiled.timeline!.tracks.every(t => t.notes.length > 0));
  const seconds = project.bars * 4 * 60 / project.bpm;
  assert.ok(seconds >= 20 && seconds <= 30, `${seconds} s`);
  for (const track of project.tracks) {
    const sound = sounds.find(s => s.id === track.id)!;
    assert.equal(track.instrument.type, sound.pitch !== null ? 'drumkit' : 'sampler', track.id);
    if (sound.pitch !== null) assert.ok(track.patterns[0].notes.every((n: { pitch: string }) => n.pitch === track.id), track.id);
  }
});
