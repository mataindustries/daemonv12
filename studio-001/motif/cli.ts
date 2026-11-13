/**
 * DaemonV12 motif layer command line (score/2). Every command lowers the score to a plain score/1 and then uses the
 * unchanged Signature Rack; a score/1 file is passed straight through.
 *   node studio-001/motif/cli.ts expand SCORE.json [--out NEW_FILE] [--report NEW_FILE] [--events NEW_FILE]
 *   node studio-001/motif/cli.ts render SCORE.json NEW_DIR [--transpose N] [--bpm X] [--normalize LUFS] [--no-mp3]
 *   node studio-001/motif/cli.ts bounce SCORE.json NEW_PACKAGE [--transpose N] [--bpm X]
 * `render` and `bounce` write what the rack writes (its score.json is the lowered score/1, so the rack alone can
 * reproduce the result) plus motif/score.json (as authored), motif/report.json and motif/events.json.
 */
import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { normalizeScore } from '../rack/score.ts';
import { renderScore, mixdown } from '../rack/render.ts';
import { bouncePackage, containmentProblems, sealPackage, verifyPackage, ENGINE_BASE } from '../rack/package.ts';
import { renderToDirectory } from '../rack/cli.ts';
import { isMotifScore } from './index.ts';
import { lowerScore } from './motif.ts';
import { motifReport, motifEvents } from './report.ts';
import type { LoweredScore } from './types.ts';

const json = (v: unknown) => JSON.stringify(v, null, 2) + '\n';
export interface MotifRenderOptions { transpose?: number; bpm?: number; normalize?: number; mp3?: boolean; log?: (s: string) => void }
const lowerOptions = (o: { transpose?: number }) => (o.transpose !== undefined ? { transpose: o.transpose } : {});
/** Add the authored motif score, its report and its event map to a rack output directory, then re-seal it. */
function addMotifFiles(root: string, authored: unknown, lowered: LoweredScore, bpm?: number) {
  mkdirSync(join(root, 'motif'));
  writeFileSync(join(root, 'motif', 'score.json'), json(authored));
  writeFileSync(join(root, 'motif', 'report.json'), json(motifReport(authored, lowered)));
  writeFileSync(join(root, 'motif', 'events.json'), json(motifEvents(authored, lowered, bpm !== undefined ? { bpm } : {})));
  sealPackage(root);
}
/** The rack's direct render for a score/1 or score/2 file. */
export async function renderMotifToDirectory(scoreFile: string, out: string, o: MotifRenderOptions = {}) {
  const authored = JSON.parse(readFileSync(scoreFile, 'utf8')) as unknown;
  if (!isMotifScore(authored)) return renderToDirectory(scoreFile, out, o);
  const lowered = lowerScore(authored, lowerOptions(o)), tmp = mkdtempSync(join(tmpdir(), 'motif-lowered-'));
  try {
    writeFileSync(join(tmp, 'score.json'), json(lowered.score));
    const r = await renderToDirectory(join(tmp, 'score.json'), out, o);
    addMotifFiles(r.root, authored, lowered, o.bpm);
    return r;
  } finally { rmSync(tmp, { recursive: true, force: true }); }
}
/** The rack's native bounce for a score/1 or score/2 file. */
export async function bounceMotifPackage(scoreFile: string, out: string, o: { transpose?: number; bpm?: number; log?: (s: string) => void } = {}) {
  const authored = JSON.parse(readFileSync(scoreFile, 'utf8')) as unknown, lowered = isMotifScore(authored) ? lowerScore(authored, lowerOptions(o)) : undefined;
  const score = normalizeScore(lowered ? lowered.score : authored, { ...(o.transpose !== undefined ? { transpose: o.transpose } : {}), ...(o.bpm !== undefined ? { bpm: o.bpm } : {}) });
  const rendered = await renderScore(score, o.log), report = bouncePackage(score, rendered, await mixdown(rendered), out);
  const bad = [...containmentProblems(report.root, 'main.json'), ...containmentProblems(report.root, 'dry.json')];
  if (bad.length) throw new Error(`containment: ${bad.join('; ')}`);
  if (lowered) addMotifFiles(report.root, authored, lowered, o.bpm);
  return { ...report, files: verifyPackage(report.root), engineBase: ENGINE_BASE };
}
function args(argv: string[]) {
  const pos: string[] = [], flags: Record<string, string | true> = {};
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i]!;
    if (a.startsWith('--')) { const next = argv[i + 1]; if (next !== undefined && !next.startsWith('--')) { flags[a.slice(2)] = next; i++; } else flags[a.slice(2)] = true; }
    else pos.push(a);
  }
  return { pos, flags };
}
const numFlag = (f: Record<string, string | true>, k: string) => (typeof f[k] === 'string' ? Number(f[k]) : undefined);

async function main() {
  const [cmd, ...rest] = process.argv.slice(2), { pos, flags } = args(rest), log = (s: string) => console.error(s);
  const common = { ...(numFlag(flags, 'transpose') !== undefined ? { transpose: numFlag(flags, 'transpose')! } : {}), ...(numFlag(flags, 'bpm') !== undefined ? { bpm: numFlag(flags, 'bpm')! } : {}) };
  switch (cmd) {
    case 'expand': {
      if (pos.length !== 1) throw new Error('usage: expand SCORE.json [--out NEW_FILE] [--report NEW_FILE] [--events NEW_FILE]');
      const input = JSON.parse(readFileSync(pos[0]!, 'utf8')) as unknown, lowered = lowerScore(input);
      normalizeScore(lowered.score); // the lowered score must be a valid score/1 before anything is written
      const outputs: [string, () => string][] = [['out', () => json(lowered.score)], ['report', () => json(motifReport(input, lowered))], ['events', () => json(motifEvents(input, lowered))]];
      for (const [flag] of outputs) if (typeof flags[flag] === 'string' && existsSync(resolve(flags[flag]))) throw new Error(`refusing to overwrite an existing file: ${resolve(flags[flag])}`);
      for (const [flag, make] of outputs) if (typeof flags[flag] === 'string') writeFileSync(resolve(flags[flag]), make());
      for (const w of lowered.problems) log(w);
      if (typeof flags.out !== 'string') process.stdout.write(json(lowered.score));
      return;
    }
    case 'render': {
      if (pos.length !== 2) throw new Error('usage: render SCORE.json NEW_DIR [--transpose N] [--bpm X] [--normalize LUFS] [--no-mp3]');
      const r = await renderMotifToDirectory(pos[0]!, pos[1]!, { ...common, ...(numFlag(flags, 'normalize') !== undefined ? { normalize: numFlag(flags, 'normalize')! } : {}), mp3: !flags['no-mp3'], log });
      console.log(json({ root: r.root, seconds: r.frames / 44100, files: r.files }).trimEnd()); return;
    }
    case 'bounce': {
      if (pos.length !== 2) throw new Error('usage: bounce SCORE.json NEW_PACKAGE [--transpose N] [--bpm X]');
      console.log(json(await bounceMotifPackage(pos[0]!, pos[1]!, { ...common, log })).trimEnd()); return;
    }
    default: console.error(readFileSync(fileURLToPath(import.meta.url), 'utf8').split('\n').slice(1, 9).join('\n')); process.exitCode = 2;
  }
}
if (process.argv[1] && resolve(process.argv[1]) === resolve(fileURLToPath(import.meta.url))) main().catch(e => { console.error((e as Error).message); process.exitCode = 1; });
