// npm run demo:share: render the most complete DaemonV12 demo this machine supports,
// then print what it is, where it is, how long and loud it is, and how to listen.
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { formatDiagnosticHuman } from '../src/diagnostics.ts';
import { inspectEnvironment } from '../src/doctor.ts';
import { runCommand } from '../src/pipeline.ts';
import { analyzeWav } from '../src/render/index.ts';

const root = fileURLToPath(new URL('../', import.meta.url));
const { readiness } = await inspectEnvironment({ env: process.env });
const demos = [
  { ready: readiness.generalMidi && readiness.productionEffects && readiness.mp3, project: 'shoot-the-moon-locked-score.json', format: 'wav,mp3' as const,
    about: 'An original 24-bar cinematic score composed by an AI agent through the DaemonV12 MCP tools: Orbital Foundry samples plus four General MIDI voices.' },
  { ready: readiness.productionEffects && readiness.mp3, project: 'orbital-foundry-audition.json', format: 'wav,mp3' as const,
    about: 'A 30-second audition of Orbital Foundry, twelve original CC0 cinematic and industrial sounds in a 12-track arrangement.',
    skipped: 'General MIDI is not set up (FluidSynth and a SoundFont), so the agent-composed Shoot the Moon score was skipped.' },
  { ready: readiness.sampleOnly, project: 'sample-only-demo.json', format: undefined,
    about: 'A 20-second drum-kit and impact groove rendered by Node alone.',
    skipped: 'FFmpeg is not available, so the Orbital Foundry audition and the agent-composed score were skipped.' },
];
const demo = demos.find(candidate => candidate.ready);
if (!demo) {
  process.stderr.write('DaemonV12 needs Node.js >=22.18.0. Run npx --no-install daemonv12 doctor for details.\n');
  process.exit(1);
}

const outDir = join(root, 'renders', 'share'), started = process.hrtime.bigint();
process.stdout.write(`DaemonV12 share demo: rendering examples/${demo.project}${'skipped' in demo ? `\n  ${demo.skipped}` : ''}\n`);
const { result, exitCode } = await runCommand('render', join(root, 'examples', demo.project), { outDir, format: demo.format, env: process.env });
if (exitCode !== 0) {
  for (const error of result.errors) process.stderr.write(formatDiagnosticHuman(error) + '\n');
  process.stderr.write('Render failed. Run npx --no-install daemonv12 doctor to check the audio tools.\n');
  process.exit(exitCode);
}

const seconds = Number(process.hrtime.bigint() - started) / 1e9;
const summary = result.summary!, wav = result.artifacts.wav!, manifest = result.manifest!.wav as { durationSeconds: number; sha256: string };
const measured = (result.analysis as { master?: Record<string, number | boolean> } | undefined)?.master ?? analyzeWav(wav).value!;
const frames = Math.round(manifest.durationSeconds * 44100);
const loudness = [typeof measured.integratedLufs === 'number' ? `${measured.integratedLufs} LUFS integrated` : null,
  typeof measured.truePeakDbfs === 'number' ? `${measured.truePeakDbfs} dBTP true peak` : null,
  `${Number(measured.peakDbfs).toFixed(1)} dBFS sample peak`, measured.clipping ? 'CLIPPING' : 'no clipping'].filter(Boolean).join(', ');
const listen = result.artifacts.mp3 ?? wav;
const opener = process.platform === 'darwin' ? 'open' : process.platform === 'win32' ? 'start ""' : 'xdg-open';
process.stdout.write([
  '', `${summary.title}`, `  ${demo.about}`,
  `  ${summary.tracks} tracks, ${summary.notes} notes, ${summary.bars} bars of ${summary.timeSignature} at ${summary.bpm} BPM${summary.key ? `, ${summary.key}` : ''}`,
  '', `Rendered offline in ${seconds.toFixed(1)} s:`,
  `  WAV         ${wav}`,
  ...(result.artifacts.mp3 ? [`  MP3         ${result.artifacts.mp3}`] : []),
  `  Provenance  ${result.artifacts.manifest} (input, tool and output hashes)`,
  ...(result.artifacts.analysis ? [`  Analysis    ${result.artifacts.analysis}`] : []),
  `  Duration    ${manifest.durationSeconds.toFixed(3)} s (${frames.toLocaleString('en-US')} frames, 44.1 kHz 16-bit stereo)`,
  `  Loudness    ${loudness}`,
  `  SHA-256     ${manifest.sha256} (same inputs and tool versions reproduce these bytes)`,
  '', 'Listen:', `  ${opener} "${listen}"`,
  '  On a remote machine or container, download the file and play it locally.',
  '', 'Next:', `  Stems:   node bin/daemonv12.js render examples/${demo.project} --stems --out-dir renders/share`,
  '  Agents:  docs/MCP_CLIENTS.md (connect Claude Code, Codex CLI or any stdio MCP client)', ''].join('\n'));
