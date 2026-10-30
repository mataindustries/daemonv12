#!/usr/bin/env node
// Writes final/manifest.json: every delivered file with its SHA-256, size and format facts, the
// project and tool hashes it came from, and the environment that rendered it. Run after
// render-final.mjs (it reads analysis/<slug>.checks.json).
//
//   node experiments/thingmania-ost/final/tools/manifest-final.mjs
import { readFileSync, writeFileSync, readdirSync, statSync, existsSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { join, dirname, relative } from 'node:path';
import { fileURLToPath } from 'node:url';
import { execFileSync } from 'node:child_process';

const HERE = join(dirname(fileURLToPath(import.meta.url)), '..');
const OST = join(HERE, '..'), REPO = join(OST, '..', '..');
const sha = (p) => createHash('sha256').update(readFileSync(p)).digest('hex');
const rel = (p) => relative(HERE, p);
const walk = (d) => (existsSync(d) ? readdirSync(d).flatMap((f) => (statSync(join(d, f)).isDirectory() ? walk(join(d, f)) : [join(d, f)])) : []);

const checks = Object.fromEntries(['main-theme', 'menu-mix', 'demo-mix'].map((s) => [s, JSON.parse(readFileSync(join(HERE, 'analysis', `${s}.checks.json`), 'utf8'))]));
const ROLE = {
  masters: 'final WAV master (PCM16 stereo 44.1 kHz)', stems: 'aligned stem (FLAC, lossless PCM16 stereo 44.1 kHz; same start and length as its master)',
  web: 'browser listening copy', previews: 'MP3 preview (192 kbps CBR)',
};
function wavFacts(p) {
  const b = readFileSync(p);
  return { sampleRate: b.readUInt32LE(24), channels: b.readUInt16LE(22), bitsPerSample: b.readUInt16LE(34), frames: b.readUInt32LE(40) / 4, seconds: Number((b.readUInt32LE(40) / 4 / 44100).toFixed(6)) };
}
const deliverableOf = (f) => (f.includes('main-theme') ? 'main-theme' : f.includes('menu-mix') ? 'menu-mix' : f.includes('demo-mix') ? 'demo-mix' : null);

const files = ['masters', 'stems', 'web', 'previews'].flatMap((dir) => walk(join(HERE, dir)).sort().map((p) => {
  const f = rel(p), slug = deliverableOf(f), c = checks[slug], ext = f.split('.').pop();
  const entry = { file: f, role: ROLE[dir], deliverable: slug, bytes: statSync(p).size, sha256: sha(p) };
  if (ext === 'wav') Object.assign(entry, wavFacts(p), { loop: c.loop ? 'seamless: cycle 2 of a continuous x3 render, bit-identical to cycle 3' : 'not a loop: real start and ending' });
  if (dir === 'stems') { const g = f.split('/').pop().replace('.flac', ''), s = c.encodes.stems[g]; Object.assign(entry, { group: g, tracks: c.stems.groups[g].tracks, frames: c.stems.alignment[g].frames, losslessRoundTrip: s.losslessRoundTrip, pcmSha256: s.wavPcmSha256 }); }
  if (dir === 'web' || (dir === 'previews' && !f.includes('x2-listen'))) { const e = c.encodes[ext]; Object.assign(entry, { decodedFrames: e.decodedFrames, exactLength: e.exactLength, alignmentLagFrames: e.bestLagFrames, decodedTruePeakDbtp: e.decodedTruePeakDbtp }); }
  if (f.includes('x2-listen')) Object.assign(entry, { seconds: c.encodes.listenX2.seconds, content: c.encodes.listenX2.content });
  return entry;
}));

const ffv = execFileSync(process.env.DAEMONV12_FFMPEG || 'ffmpeg', ['-version'], { encoding: 'utf8' }).split('\n')[0];
const toolFiles = [...walk(join(HERE, 'tools')), join(OST, 'tools', 'instruments.mjs'), join(OST, 'tools', 'dsp.mjs'), join(OST, 'tools', 'inspect-palette.mjs'), join(OST, 'hybrid-ac', 'tools', 'analysis-ac.mjs')];
const manifest = {
  title: 'THING//MANIA - Official Soundtrack (final package)',
  source: { approvedAudition: 'experiments/thingmania-ost/hybrid-ac/ac-01-groove-first.json (AC-01 GROOVE FIRST)', approvedMasterSha256: checks['main-theme'] && JSON.parse(readFileSync(join(HERE, 'analysis', 'summary.json'), 'utf8')).referenceAc01.masterWav },
  environment: { engine: `daemonv12 ${checks['main-theme'].engineVersion}`, node: process.version, ffmpeg: ffv,
    note: 'Rendering is deterministic: a second render of every project gives byte-identical masters, track stems and group stems (analysis/<slug>.checks.json, determinism).' },
  rights: 'Every sound is synthesized from scratch by experiments/thingmania-ost/tools/instruments.mjs (deterministic DSP, no randomness beyond seeded generators). No recordings, samples, loops, SoundFonts, General MIDI (FluidR3 GM) or third-party audio are used. All melodies and rhythms were written for THING//MANIA. No license is declared; that remains the owner\'s decision.',
  projects: ['main-theme', 'main-theme-x3', 'menu-mix', 'menu-mix-x3', 'demo-mix'].map((s) => ({ file: `${s}.json`, sha256: sha(join(HERE, `${s}.json`)) })),
  palette: { file: 'assets/palette.json', sha256: sha(join(HERE, 'assets', 'palette.json')), reuse: JSON.parse(readFileSync(join(HERE, 'assets', 'palette.json'), 'utf8')).reuse },
  tools: toolFiles.map((p) => ({ file: relative(REPO, p), sha256: sha(p) })),
  files,
};
writeFileSync(join(HERE, 'manifest.json'), JSON.stringify(manifest, null, 1) + '\n');
console.log(`manifest: ${files.length} files, ${(files.reduce((s, f) => s + f.bytes, 0) / 1e6).toFixed(1)} MB`);
