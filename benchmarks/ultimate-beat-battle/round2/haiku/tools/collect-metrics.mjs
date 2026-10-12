#!/usr/bin/env node
// Collect diagnostic metrics for the locked render. Evidence only; nothing here is a quality score.
// Usage: node collect-metrics.mjs <project.json> <render-dir> <out.json>
import { createHash } from 'node:crypto';
import { readFileSync, statSync, writeFileSync } from 'node:fs';
import { basename, join } from 'node:path';

const [projectPath, renderDir, outPath] = process.argv.slice(2);
const project = JSON.parse(readFileSync(projectPath, 'utf8'));
const analysis = JSON.parse(readFileSync(join(renderDir, 'project.analysis.json'), 'utf8'));
const manifest = JSON.parse(readFileSync(join(renderDir, 'project.render.json'), 'utf8'));
const sha256 = (path) => createHash('sha256').update(readFileSync(path)).digest('hex');

let notes = 0;
let sampledTriggers = 0;
let patterns = 0;
const rates = new Set();
let glides = 0;
let offsets = 0;
let performedNotes = 0;
const assets = new Set();
const effectTypes = new Set();
let effectCount = 0;
let automationLanes = 0;
let automationPoints = 0;
for (const track of project.tracks) {
  const kit = track.instrument.kit;
  const sample = track.instrument.sample;
  if (kit) assets.add(kit);
  if (sample) assets.add(sample);
  for (const e of track.effects ?? []) {
    effectTypes.add(e.type);
    effectCount += 1;
  }
  for (const lane of Object.values(track.automation ?? {})) {
    automationLanes += 1;
    automationPoints += lane.length;
  }
  patterns += track.patterns.length;
  for (const p of track.patterns) {
    for (const n of p.notes) {
      notes += 1;
      sampledTriggers += 1;
      if (n.playbackRate !== undefined) {
        rates.add(n.playbackRate);
        performedNotes += 1;
      }
      if (n.glide) glides += 1;
      if (n.offsetSeconds !== undefined) offsets += 1;
    }
  }
}
const sizeKb = (statSync(projectPath).size / 1024).toFixed(1);

const metrics = {
  engine: { name: 'daemonv12', version: manifest.engine.version, commit: 'ed75e9e2a0172266e56b292886ad7c1500677862' },
  composerSkillCommit: '56dbdff62bf78e70e898f0dbb49f8044cd561655',
  track: { title: project.title, bpm: project.bpm, meter: project.timeSignature, key: project.key, bars: project.bars,
    durationSeconds: analysis.master.durationSeconds, frames: analysis.master.frames },
  iterations: { serious: 4, labels: ['v1', 'v2', 'v3', 'v4'], lock: 'v4' },
  counts: {
    tracks: project.tracks.length,
    stems: project.tracks.length,
    patterns,
    triggers: notes,
    sampledTriggers,
    distinctAssets: assets.size,
    distinctPlaybackRates: rates.size,
    performedTriggers: performedNotes,
    glides: glides,
    sourceOffsets: offsets,
    automationLanes,
    automationPoints,
    trackEffects: effectCount,
    effectTypes: [...effectTypes].sort(),
    masterEffects: project.master.effects.map((e) => e.type),
  },
  audio: {
    samplePeakDbfs: analysis.master.peakDbfs,
    truePeakDbfs: analysis.master.truePeakDbfs,
    integratedLufs: analysis.master.integratedLufs,
    loudnessRangeLu: analysis.master.loudnessRangeLu,
    rmsDbfs: analysis.master.rmsDbfs,
    fullScaleSamples: analysis.master.fullScaleSamples,
    clipping: analysis.master.clipping,
    trackClippedSamples: manifest.production.tracks.reduce((s, t) => s + t.clippedSamples, 0),
  },
  files: {
    projectJsonBytes: Number(sizeKb) * 1024,
    projectJsonKb: Number(sizeKb),
    projectSha256: sha256(projectPath),
    masterWavSha256: sha256(join(renderDir, 'project.wav')),
    masterWavBytes: statSync(join(renderDir, 'project.wav')).size,
    masterMp3Sha256: sha256(join(renderDir, 'project.mp3')),
    midSha256: sha256(join(renderDir, 'project.mid')),
    analysisSha256: sha256(join(renderDir, 'project.analysis.json')),
    renderManifestSha256: sha256(join(renderDir, 'project.render.json')),
  },
  renderTimeApproxSeconds: 20,
  note: 'Diagnostic evidence only. Not a quality score.',
};
writeFileSync(outPath, `${JSON.stringify(metrics, null, 2)}\n`);
console.log(`wrote ${basename(outPath)}: ${metrics.counts.tracks} tracks, ${metrics.counts.triggers} triggers, ${metrics.counts.distinctPlaybackRates} rates, ${metrics.counts.glides} glides, ${metrics.counts.sourceOffsets} offsets`);
