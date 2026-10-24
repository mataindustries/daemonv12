import { parseArgs } from 'node:util';
import { readFileSync, writeFileSync, mkdirSync, renameSync, rmSync, realpathSync, existsSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { createHash } from 'node:crypto';
import { compileProjectFile } from '../pipeline.ts';
import { scheduledEventsFromTimeline } from '../sync-timeline.ts';
import { buildEventMap, cropEventMap, serializeEventMap, EventMapValidationError, type EventMapOptions, type ScheduledEvent } from '../sync/index.ts';
import { diagnostic, exitCodeFor, formatDiagnosticHuman, type Diagnostic } from '../diagnostics.ts';

export const syncUsage = `  daemonv12 sync <schedule.json> --out <event-map.json> [--fps N/D] [--start-sample N --end-sample N] [--project] [--json]

Schedule: {sampleRate, fps:{numerator,denominator}, source:{...}, events:[{sampleFrame,trackId,eventId,velocity,source:{...},visualRoles?:[...]}]}.
Existing event maps may also be cropped. Offsets are absolute integer sample frames;
start is inclusive, end exclusive. --project adapts a native DaemonV12 project.
Picture frames contain the event (floor), start at zero, and never set audio timing.`;

export async function runSyncCli(argv: string[]): Promise<number> {
  const json = argv.includes('--json');
  let errors: Diagnostic[] = [], output: string | undefined, eventCount = 0;
  try {
    let parsed: ReturnType<typeof parseArgs>;
    try {
      parsed = parseArgs({ args: argv, strict: true, allowPositionals: true, options: {
        out: { type: 'string' }, fps: { type: 'string' }, 'start-sample': { type: 'string' },
        'end-sample': { type: 'string' }, project: { type: 'boolean' }, json: { type: 'boolean' }, help: { type: 'boolean', short: 'h' },
      } });
    } catch (error) { throw { syncDiagnostics: [diagnostic('USAGE_ERROR', '', String(error), syncUsage)] }; }
    const { values, positionals } = parsed;
    if (values.help && positionals.length === 0) { process.stdout.write(syncUsage + '\n'); return 0; }
    if (positionals.length !== 1 || typeof values.out !== 'string' || values.help)
      throw { syncDiagnostics: [diagnostic('USAGE_ERROR', '', argv, syncUsage)] };
    const path = positionals[0]!;
    output = values.out;
    // Do not allow an export to overwrite its source, including symlink aliases.
    const identity = (file: string) => existsSync(file) ? realpathSync(file) : resolve(file);
    if (identity(path) === identity(output))
      throw { syncDiagnostics: [diagnostic('USAGE_ERROR', 'out', output, 'an output different from the input file')] };
    let bytes: Buffer;
    try { bytes = readFileSync(path); }
    catch (error) { throw { syncDiagnostics: [diagnostic('FILE_READ_FAILED', '', path, 'a readable schedule or project JSON', String(error))] }; }
    let input: unknown;
    try { input = JSON.parse(bytes.toString('utf8')); }
    catch (error) { throw { syncDiagnostics: [diagnostic('JSON_PARSE_ERROR', '', path, 'valid JSON', String(error))] }; }
    const fpsText = values.fps;
    let fps: EventMapOptions['fps'] | undefined;
    if (fpsText !== undefined) {
      if (typeof fpsText !== 'string' || !/^[1-9][0-9]*\/[1-9][0-9]*$/.test(fpsText))
        throw { syncDiagnostics: [diagnostic('USAGE_ERROR', 'fps', fpsText, 'positive rational FPS N/D, e.g. 60/1 or 60000/1001')] };
      const [numerator, denominator] = fpsText.split('/').map(Number);
      fps = { numerator: numerator!, denominator: denominator! };
    }
    let map;
    if (values.project) {
      const compilation = compileProjectFile(path);
      if (!compilation.timeline) throw { syncDiagnostics: compilation.diagnostics };
      const source = { file: path, sha256: createHash('sha256').update(bytes).digest('hex'), adapter: 'daemonv12-resolved-timeline-v1' };
      map = buildEventMap(scheduledEventsFromTimeline(compilation.timeline, source), { sampleRate: 44100, fps: fps ?? { numerator: 60, denominator: 1 }, source });
    } else if (input && typeof input === 'object' && 'kind' in input && input.kind === 'daemonv12-event-map') {
      // Rebuilding is unnecessary and could hide a corrupt derived frame.
      serializeEventMap(input);
      map = input as ReturnType<typeof buildEventMap>;
      if (fps) map = buildEventMap(map.events.map(({ sampleFrame, trackId, eventId, velocity, source, visualRoles }) =>
        ({ sampleFrame, trackId, eventId, velocity, source, ...(visualRoles ? { visualRoles } : {}) })),
        { sampleRate: map.sampleRate, fps, source: map.source, ...(map.clip ? { clip: map.clip } : {}) });
    } else {
      if (!input || typeof input !== 'object' || Array.isArray(input))
        throw { syncDiagnostics: [diagnostic('WRONG_TYPE', '', input, 'a schedule object')] };
      const schedule = input as Record<string, unknown>;
      const unknown = Object.keys(schedule).filter(key => !['events', 'sampleRate', 'fps', 'source', 'clip'].includes(key));
      if (unknown.length) throw { syncDiagnostics: unknown.map(key => diagnostic('UNKNOWN_FIELD', key, schedule[key], 'events, sampleRate, fps, source or clip')) };
      map = buildEventMap(schedule.events as ScheduledEvent[], { sampleRate: schedule.sampleRate, fps: fps ?? schedule.fps, source: schedule.source, ...(Object.hasOwn(schedule, 'clip') ? { clip: schedule.clip } : {}) } as EventMapOptions);
    }
    if (values['start-sample'] !== undefined || values['end-sample'] !== undefined) {
      const start = values['start-sample'], end = values['end-sample'];
      if (typeof start !== 'string' || typeof end !== 'string' || !/^\d+$/.test(start) || !/^\d+$/.test(end))
        throw { syncDiagnostics: [diagnostic('USAGE_ERROR', 'clip', { start, end }, 'both --start-sample N and --end-sample N as nonnegative integers')] };
      map = cropEventMap(map, Number(start), Number(end));
    }
    const serialized = serializeEventMap(map);
    let temporaryCreated = false;
    try {
      mkdirSync(dirname(output), { recursive: true });
      writeFileSync(`${output}.tmp`, serialized, { flag: 'wx' });
      temporaryCreated = true;
      renameSync(`${output}.tmp`, output);
    } catch (error) {
      if (temporaryCreated) rmSync(`${output}.tmp`, { force: true });
      throw { syncDiagnostics: [diagnostic('OUTPUT_WRITE_FAILED', 'out', output, 'a writable output path without a preexisting .tmp file', String(error))] };
    }
    eventCount = map.events.length;
  } catch (error) {
    if (error instanceof EventMapValidationError) errors = error.diagnostics;
    else if (error && typeof error === 'object' && 'syncDiagnostics' in error) errors = error.syncDiagnostics as Diagnostic[];
    else errors = [diagnostic('INTERNAL_ERROR', '', String(error), 'a valid schedule')];
  }
  if (json) process.stdout.write(JSON.stringify({ ok: !errors.length, command: 'sync', errors, ...(errors.length ? {} : { output, events: eventCount }) }, null, 2) + '\n');
  else if (errors.length) for (const d of errors) process.stderr.write(formatDiagnosticHuman(d) + '\n');
  else process.stdout.write(`Wrote ${output}: ${eventCount} synchronized events\n`);
  return exitCodeFor(errors);
}
