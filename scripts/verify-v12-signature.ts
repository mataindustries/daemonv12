/** Reproducible V12 SIGNATURE verification: regenerate in a fresh process, inspect every source, compile and budget both
 * projects, render each twice into fresh directories and measure the showcase by section.
 * Run: node scripts/verify-v12-signature.ts [--deliver]
 * Writes packs/v12-signature-v1/v12-signature.verification.json. --deliver also copies the audition and showcase WAV,
 * MP3 and analysis into packs/v12-signature-v1/audio/. Analytical only: no listening session is claimed.
 */
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { copyFileSync, mkdirSync, mkdtempSync, readdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { compileProjectFile, productionRoute, runCommand } from '../src/pipeline.ts';
import { playbackBudget } from '../src/sample-render.ts';
import { createAudioProcessor, decodePcm, extractWavFrames, PLAYBACK_VOICE_BYTES_LIMIT, PLAYBACK_WORK_LIMIT } from '../src/render/index.ts';
import { DEFAULT_OUTPUT, PACK } from './generate-v12-signature.ts';
import { measure, packReport } from './inspect-v12-signature.ts';

const hash = (bytes: Uint8Array) => createHash('sha256').update(bytes).digest('hex');
const files = (root: string): string[] => readdirSync(root, { recursive: true, withFileTypes: true }).filter(e => e.isFile())
  .map(e => join(e.parentPath, e.name).slice(root.length + 1)).sort();
// Showcase sections at 128 BPM (1.875 s per bar).
export const SECTIONS = [
  { name: 'ignition', bars: '1-2', start: 0, end: 3.75 }, { name: 'orbit', bars: '3-6', start: 3.75, end: 11.25 },
  { name: 'ascension', bars: '7-8', start: 11.25, end: 15 }, { name: 'convergence (drop)', bars: '9-12', start: 15, end: 22.5 },
  { name: 'afterglow', bars: '13-14', start: 22.5, end: 26.25 }, { name: 'released tail', bars: '15', start: 26.25, end: 28 },
] as const;

/** Smallest work and per-voice byte limits the project still fits (bisection over the engine's own budget check). */
export function budgetUse(project: string) {
  const c = compileProjectFile(project), production = productionRoute(c.project!);
  const fits = (work: number, bytes: number) => playbackBudget(c, production, { work, bytes }) === undefined;
  let lo = 0, hi = PLAYBACK_WORK_LIMIT; while (hi - lo > 1000) { const mid = Math.floor((lo + hi) / 2); if (fits(mid, PLAYBACK_VOICE_BYTES_LIMIT)) hi = mid; else lo = mid; }
  let blo = 0, bhi = PLAYBACK_VOICE_BYTES_LIMIT; while (bhi - blo > 1024) { const mid = Math.floor((blo + bhi) / 2); if (fits(PLAYBACK_WORK_LIMIT, mid)) bhi = mid; else blo = mid; }
  return { interpolationTaps: hi, tapBudgetPercent: Number((100 * hi / PLAYBACK_WORK_LIMIT).toFixed(1)), largestVoiceBytes: bhi, voiceBudgetPercent: Number((100 * bhi / PLAYBACK_VOICE_BYTES_LIMIT).toFixed(2)) };
}

export async function verifyV12Signature(pack = DEFAULT_OUTPUT, deliver = false, env: NodeJS.ProcessEnv = process.env) {
  const scratch = mkdtempSync(join(tmpdir(), 'v12-signature-verify-'));
  try {
    // 1. A fresh process regenerates every file byte for byte.
    for (const script of ['scripts/generate-v12-signature.ts', 'scripts/create-v12-signature-projects.ts']) {
      const child = spawnSync(process.execPath, [script, join(scratch, 'regenerated')], { encoding: 'utf8' });
      assert.equal(child.status, 0, child.stderr);
    }
    const generated = files(join(scratch, 'regenerated'));
    for (const file of generated) assert.deepEqual(readFileSync(join(scratch, 'regenerated', file)), readFileSync(join(pack, file)), file);
    const regeneration = { files: generated.length, identical: true, hashes: Object.fromEntries(generated.filter(f => f.endsWith('.wav')).map(f => [f, hash(readFileSync(join(pack, f)))])) };

    // 2. Every source measured.
    const sources = packReport(pack);

    // 3. Both projects compile against the pack and fit the v0.7 render budget.
    const projects: Record<string, any> = {};
    for (const name of ['audition', 'showcase']) {
      const file = join(pack, `v12-signature-${name}.json`), c = compileProjectFile(file);
      assert.deepEqual(c.diagnostics.filter(d => d.severity === 'error'), [], name);
      projects[name] = { file, tracks: c.timeline!.tracks.length, notes: c.timeline!.tracks.reduce((s, t) => s + t.notes.length, 0), budget: budgetUse(file) };
    }

    // 4. Two fresh renders each; every artifact except MP3 must repeat.
    const processor = await createAudioProcessor({ env });
    for (const name of ['audition', 'showcase']) {
      if (name === 'showcase' && processor.diagnostic) { projects[name].render = { skipped: processor.diagnostic.message }; continue; }
      const options = (dir: string) => ({ outDir: join(scratch, name, dir), stems: true, env, ...(processor.value ? { format: 'wav,mp3' as const } : {}) });
      const first = await runCommand('render', projects[name].file, options('a')), second = await runCommand('render', projects[name].file, options('b'));
      assert.equal(first.exitCode, 0, JSON.stringify(first.result.errors)); assert.equal(second.exitCode, 0, JSON.stringify(second.result.errors));
      const a = files(join(scratch, name, 'a')).filter(f => !f.endsWith('.mp3')), b = files(join(scratch, name, 'b')).filter(f => !f.endsWith('.mp3'));
      assert.deepEqual(a, b);
      for (const f of a) assert.deepEqual(readFileSync(join(scratch, name, 'a', f)), readFileSync(join(scratch, name, 'b', f)), `${name}: ${f}`);
      const manifest = first.result.manifest as Record<string, any>, wav = first.result.artifacts.wav!, master = decodePcm(readFileSync(wav)).pcm!;
      const stems = first.result.artifacts.stems!.map(s => ({ trackId: s.trackId, frames: decodePcm(readFileSync(s.wav)).pcm!.frames }));
      const shape = measure(wav, { fundamentalHz: null });
      projects[name].render = {
        twoFreshRendersIdentical: true, artifactsCompared: a.length, wavSha256: hash(readFileSync(wav)), frames: master.frames, seconds: master.frames / 44100,
        stems: stems.length, stemsAlignedToMaster: stems.every(s => s.frames === master.frames), clippedSamples: manifest.mix?.clippedSamples ?? manifest.production?.master?.clippedSamples ?? 0,
        analysis: manifest.analysis?.master ?? null, stereo: shape.stereo, truePeakDbfsMeasured: shape.truePeakDbfs, dc: shape.dc,
        last10msPeakDbfs: (() => { let m = 0; for (let i = master.samples.length - 882; i < master.samples.length; i++) m = Math.max(m, Math.abs(master.samples[i]!)); return m ? Number((20 * Math.log10(m / 32768)).toFixed(1)) : null; })(),
        tools: { node: process.version, ffmpeg: processor.value?.identity.version ?? null },
      };
      if (name === 'showcase' && processor.value) {
        const bytes = readFileSync(wav);
        projects[name].sections = await Promise.all(SECTIONS.map(async s => {
          const path = join(scratch, `${s.name.split(' ')[0]}.wav`); writeFileSync(path, extractWavFrames(bytes, Math.round(s.start * 44100), Math.round(s.end * 44100)));
          const loud = await processor.value!.loudness(path), section = measure(path, { fundamentalHz: null });
          return { ...s, integratedLufs: loud.value?.integratedLufs ?? null, truePeakDbfs: loud.value?.truePeakDbfs ?? null, rmsDbfs: section.rmsDbfs, stereoCorrelation: section.stereo!.correlation, lowBandCorrelation: section.stereo!.lowBandCorrelation };
        }));
        projects[name].stemLoudness = Object.fromEntries((manifest.analysis.tracks as { trackId: string; analysis: { integratedLufs: number | null } }[]).map(t => [t.trackId, t.analysis.integratedLufs]));
      }
      if (deliver) {
        const out = join(pack, 'audio'); mkdirSync(out, { recursive: true });
        for (const f of files(join(scratch, name, 'a')).filter(f => /\.(wav|mp3)$/.test(f) && !f.includes('.stems/') || f.endsWith('.analysis.json'))) copyFileSync(join(scratch, name, 'a', f), join(out, f));
      }
    }
    const scripts = ['scripts/generate-v12-signature.ts', 'scripts/create-v12-signature-projects.ts', 'scripts/inspect-v12-signature.ts', 'scripts/verify-v12-signature.ts'];
    const report = { pack: { name: PACK.name, version: PACK.version, directory: pack }, sourceCode: Object.fromEntries(scripts.map(f => [f, hash(readFileSync(f))])),
      regeneration, lowLock: sources.lowLock, sources: sources.sounds, projects,
      method: sources.method, verification: 'Analytical measurements only; no listening session is claimed. Musical judgments need human listening.' };
    writeFileSync(join(pack, 'v12-signature.verification.json'), JSON.stringify(report, null, 2) + '\n');
    return report;
  } finally { rmSync(scratch, { recursive: true, force: true }); }
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const report = await verifyV12Signature(DEFAULT_OUTPUT, process.argv.includes('--deliver'));
  const show = report.projects.showcase;
  process.stdout.write(JSON.stringify({ regeneration: { files: report.regeneration.files, identical: true }, audition: report.projects.audition.render, showcase: show.render, sections: show.sections, budget: { audition: report.projects.audition.budget, showcase: show.budget } }, null, 2) + '\n');
}
