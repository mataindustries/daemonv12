/**
 * Frozen-engine bridge. The three approved instrument families live, unmodified, in mutation-001/tools (owner-approved
 * after listening; their nine auditions are frozen). The rack never copies or edits that code: it verifies every
 * frozen file against studio-001/rack/frozen.json (SHA-256) and only then loads the modules, through typed views.
 * Dynamic imports keep the frozen sources outside the repository's strict typecheck without touching them.
 */
import { createHash } from 'node:crypto';
import { readFileSync, existsSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

export type Wave = Float64Array;
export type Lane = (t: number) => number;
export const REPO_ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..', '..');
export const FREEZE_FILE = join(REPO_ROOT, 'studio-001', 'rack', 'frozen.json');
export const sha256 = (b: Uint8Array) => createHash('sha256').update(b).digest('hex');

export interface FrozenEntry { path: string; sha256: string; role: 'engine' | 'audition-script' | 'audition' | 'manifest' }
export interface FreezeRecord {
  schema: 'daemonv12.signature-rack.freeze/1';
  sourceCommit: string; sourcePullRequest: string;
  approvals: Record<string, string>;
  note: string;
  files: FrozenEntry[];
}

const TOOLS = ['dsp.ts', 'instruments.ts', 'score.ts', 'lanes.ts', 'deliver.ts', 'living-bass.ts', 'impossible-voice.ts', 'mechanical-orchestra.ts'];
const SCRIPTS = ['a-living-bass.ts', 'b-impossible-voice.ts', 'c-mechanical-orchestra.ts'];
const AUDITIONS = [
  'a-living-bass/a1-living-bass-transformation-dry', 'a-living-bass/a2-living-bass-transformation-context', 'a-living-bass/a3-living-bass-states-dry',
  'b-impossible-voice/b1-impossible-voice-transformation-dry', 'b-impossible-voice/b2-impossible-voice-transformation-context', 'b-impossible-voice/b3-impossible-voice-states-dry',
  'c-mechanical-orchestra/c1-mechanical-orchestra-transformation-dry', 'c-mechanical-orchestra/c2-mechanical-orchestra-transformation-context', 'c-mechanical-orchestra/c3-mechanical-orchestra-states-dry',
];
/** The frozen file list (paths relative to the repository root). */
export function frozenPaths(): FrozenEntry['path'][] {
  return [
    ...TOOLS.map(f => `mutation-001/tools/${f}`), ...SCRIPTS.map(f => `mutation-001/tools/${f}`),
    ...AUDITIONS.flatMap(a => [`mutation-001/auditions/${a}.wav`, `mutation-001/auditions/${a}.mp3`]),
    'mutation-001/auditions/manifest.json', 'mutation-001/auditions/SHA256SUMS',
  ];
}
const roleOf = (p: string): FrozenEntry['role'] => p.endsWith('.wav') || p.endsWith('.mp3') ? 'audition'
  : p.endsWith('manifest.json') || p.endsWith('SHA256SUMS') ? 'manifest' : SCRIPTS.some(s => p.endsWith(s)) ? 'audition-script' : 'engine';

/** Compute a fresh freeze record from the working tree (used once, to write frozen.json). */
export function computeFreeze(sourceCommit: string): FreezeRecord {
  return {
    schema: 'daemonv12.signature-rack.freeze/1', sourceCommit, sourcePullRequest: 'mataindustries/daemonv12#43',
    approvals: {
      'living-bass': 'approved by the owner after listening (DAEMON//MUTATION 001 continue brief)',
      'impossible-voice': 'approved by the owner after listening (DAEMON//STUDIO 001 brief)',
      'mechanical-orchestra': 'approved by the owner after listening (DAEMON//STUDIO 001 brief)',
    },
    note: 'Approved engines, audition scripts, the nine audition recordings (WAV + MP3) and their manifests. Never edited; the rack loads the engines only after these hashes match.',
    files: frozenPaths().map(path => ({ path, sha256: sha256(readFileSync(join(REPO_ROOT, path))), role: roleOf(path) })),
  };
}
export function readFreeze(): FreezeRecord { return JSON.parse(readFileSync(FREEZE_FILE, 'utf8')) as FreezeRecord; }
/** Every frozen file whose bytes differ from the freeze record (empty when intact). */
export function verifyFrozen(roles?: FrozenEntry['role'][]): string[] {
  const bad: string[] = [];
  for (const f of readFreeze().files) {
    if (roles && !roles.includes(f.role)) continue;
    const p = join(REPO_ROOT, f.path);
    if (!existsSync(p)) { bad.push(`${f.path}: missing`); continue; }
    if (sha256(readFileSync(p)) !== f.sha256) bad.push(`${f.path}: SHA-256 differs from the freeze record`);
  }
  return bad;
}

let verified = false;
async function load<T>(file: string): Promise<T> {
  if (!verified) {
    const bad = verifyFrozen(['engine']);
    if (bad.length) throw new Error(`Refusing to load modified approved engines:\n${bad.join('\n')}`);
    verified = true;
  }
  return await import(pathToFileURL(join(REPO_ROOT, 'mutation-001', 'tools', file)).href) as T;
}

// ------------------------------------------------------------------ typed views of the frozen modules
export interface RngLike { next(): number; bi(): number; gauss(): number }
export interface DspModule {
  SR: number;
  midiHz(m: number): number;
  smooth(x: number): number;
  Rng: new (seed: number) => RngLike;
  peakOf(chs: Wave[]): number;
  encodeWav(chs: Wave[], gain: number): Buffer;
  fdnReverb(inL: Wave, inR: Wave, o: { rt60: number; size?: number; damp?: number; predelayMs?: number; mod?: number; lowCut?: number; seed?: number }, tailSeconds?: number): [Wave, Wave];
}
export interface BassNote { t: number; d: number; p: number; v?: number; art?: 'normal' | 'ghost' | 'accent' | 'stacc'; slide?: number; scoop?: number; dive?: number; diveSec?: number }
export interface LivingBassModule {
  livingBass(notes: BassNote[], o: { morph: Lane; motion?: Lane; over?: Record<string, Lane>; harmonics?: number[]; seed?: number; tail?: number }): Wave;
  bassMacro(m: number): Record<string, number>;
}
export interface MotionSegment { from: number; to: number; div: number; pattern: number[]; shape?: 'decay' | 'ramp' | 'gate' | 'hold'; tau?: number }
export interface ScoreModule { motionLane(g: { bpm: number; swing: number; beat: number; bar: number; s16: number }, segs: MotionSegment[]): Lane }
export interface VoiceNote { t: number; d: number; p: number; v?: number; vowel?: string; to?: string; slide?: number; scoop?: number; cry?: number; fall?: number }
export interface VoiceModule {
  impossibleVoice(notes: VoiceNote[], o: {
    morph: Lane; over?: Record<string, Lane>; overtone?: Lane; breaths?: { t: number; d: number; v?: number; kind: 'in' | 'out' }[];
    seed?: number; tail?: number; detune?: number; vibRate?: number; vibCents?: number; size?: number; vowelTau?: number;
  }): { dry: Wave; send: Wave };
  glassHalo(send: Wave, freqs: number[], decay?: number, gain?: number): Wave[];
  voiceMacro(m: number): Record<string, number>;
}
export interface OrchestraModule {
  malletBar(p: number, v: number, m: number, o?: { damp?: number; hard?: number; seed?: number; len?: number; cents?: number }): Wave;
  bowedBar(p: number, d: number, v: number, m: number, o?: { seed?: number; sub?: number; subN?: number; chatter?: number; attack?: number }): Wave;
  spring(p: number, v: number, m: number, o?: { len?: number; seed?: number; bend?: number; t60?: number }): Wave;
  tine(p: number, v: number, o?: { buzz?: number; seed?: number; cents?: number }): Wave;
  tick(v: number, tock: boolean, seed: number): Wave;
  barRatios(m: number): number[];
}
export interface InstrumentsModule {
  kick(o?: { f0?: number; len?: number; decay?: number; punch?: number; click?: number; drive?: number; start?: number; seed?: number }): Wave[];
  snare(o?: { body?: number; noise?: number; clap?: number; room?: number; len?: number; tone?: number; decay?: number; seed?: number; snap?: number; verb?: number }): Wave[];
}
export interface DeliverModule { r128(file: string): { lufs: number; lra: number; truePeakDb: number } }

export interface Frozen {
  dsp: DspModule; bass: LivingBassModule; score: ScoreModule; voice: VoiceModule; orchestra: OrchestraModule; instruments: InstrumentsModule; deliver: DeliverModule;
}
let cache: Promise<Frozen> | undefined;
/** Load all approved engines once (hash-verified). */
export function frozen(): Promise<Frozen> {
  cache ??= (async () => ({
    dsp: await load<DspModule>('dsp.ts'), bass: await load<LivingBassModule>('living-bass.ts'), score: await load<ScoreModule>('score.ts'),
    voice: await load<VoiceModule>('impossible-voice.ts'), orchestra: await load<OrchestraModule>('mechanical-orchestra.ts'),
    instruments: await load<InstrumentsModule>('instruments.ts'), deliver: await load<DeliverModule>('deliver.ts'),
  }))();
  return cache;
}
