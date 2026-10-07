import { mkdirSync, mkdtempSync, readdirSync } from 'node:fs';
import { dirname, join, relative } from 'node:path';
import { runCommand, resultFor } from '../src/pipeline.ts';
import { GM_PROGRAMS } from '../src/project/gm-programs.ts';
import { readAsset } from '../src/project/assets.ts';
import { parseKit } from '../src/project/sample-schema.ts';
import { decodePcm } from '../src/render/index.ts';
import { schemas, type ProjectDocument } from './schemas.ts';
import { applyEdits, loadDocument, validateText } from './projects.ts';
import { fail, hash, ToolFailure, Workspace } from './workspace.ts';

export type ToolResult = Record<string, unknown> & {ok: boolean};
const ok = (data: Record<string, unknown>): ToolResult => ({ok: true, errors: [], warnings: [], ...data});
function failure(error: unknown): ToolResult {
  const code = (error as NodeJS.ErrnoException)?.code;
  const known = error instanceof ToolFailure;
  return {ok: false, warnings: [], errors: [{code: known ? error.code : code === 'ENOENT' ? 'FILE_NOT_FOUND' : code === 'EEXIST' ? 'PROJECT_EXISTS' : code?.startsWith('E') ? 'FILE_ACCESS_FAILED' : 'INTERNAL_ERROR',
    severity: 'error', path: known ? error.path : '',
    message: known ? error.message : code === 'EEXIST' ? 'Project already exists.' : code === 'ENOENT' ? 'File or parent directory does not exist.' : 'Operation could not be completed.',
    hint: known ? error.hint : code === 'EEXIST' ? 'Choose a new path or use project_patch with the current revision.' : 'Check paths and permissions; unexpected failures require operator inspection.'}]};
}

export class DaemonTools {
  readonly workspace: Workspace;
  readonly env: NodeJS.ProcessEnv;
  private queue: Promise<unknown> = Promise.resolve();
  constructor(root: string, env: NodeJS.ProcessEnv = process.env) { this.workspace = new Workspace(root); this.env = {...env}; }
  // Serialize tools, including reads, so a client never observes an in-progress render/edit.
  call(name: string, args: unknown = {}): Promise<ToolResult> {
    const pending = this.queue.then(async () => {
      try {
        if (!Object.hasOwn(schemas, name)) fail('UNKNOWN_TOOL', name, 'Unknown DaemonV12 tool.', 'Use tools/list.');
        const schema = schemas[name as keyof typeof schemas];
        const parsed = schema.safeParse(args);
        if (!parsed.success) return {ok: false, warnings: [], errors: parsed.error.issues.map(issue => ({
          code: 'INVALID_ARGUMENT', severity: 'error', path: issue.path.join('.'), message: issue.message,
          hint: 'Use the input schema returned by tools/list.',
        }))};
        return await this.dispatch(name, parsed.data);
      } catch (error) { return failure(error); }
    });
    this.queue = pending.catch(() => undefined);
    return pending;
  }
  private async dispatch(name: string, args: unknown): Promise<ToolResult> {
    const ws = this.workspace;
    switch (name) {
      case 'daemonv12_project_create': {
        const {project, ...metadata} = schemas.daemonv12_project_create.parse(args);
        const path = ws.path(project, 'project', true);
        const document = {formatVersion: 1, ...metadata, tracks: [{id: 'lead', instrument: {type: 'gm', program: 'acoustic_grand_piano'}, patterns: [], clips: []}]};
        const text = JSON.stringify(document, null, 2) + '\n';
        const validation = validateText(text, path);
        if (!validation.ok) return {...validation, project};
        ws.publish(project, text);
        return {...validation, project, sha256: hash(text), nextActions: ['Use project_patch to add patterns, notes and clips to lead, or add tracks.', 'Use instruments_list / drumkits_list for sounds; render with stems when ready.']};
      }
      case 'daemonv12_project_read': {
        const a = schemas.daemonv12_project_read.parse(args);
        const loaded = loadDocument(ws, a.project);
        if (loaded.loaded.diagnostics.length) return {...resultFor('validate', a.project, loaded.loaded.diagnostics)};
        const validation = validateText(loaded.bytes.toString('utf8'), ws.path(a.project, 'project'));
        if (!validation.ok) return {...validation, project: a.project, sha256: loaded.sha256};
        const document = loaded.loaded.value as ProjectDocument;
        const selected = document.tracks.filter(t => !a.trackId || t.id === a.trackId);
        const allPatterns = selected.flatMap(t => t.patterns.filter(p => !a.patternId || p.id === a.patternId).map(p => ({trackId: t.id, ...p})));
        const patterns = allPatterns.slice(a.patternOffset, a.patternOffset + a.patternLimit).map(p => ({...p,
          notes: p.notes.slice(a.noteOffset, a.noteOffset + a.noteLimit), totalNotes: p.notes.length, noteOffset: a.noteOffset}));
        const {tracks: _, ...metadata} = document;
        return {...validation, project: a.project, sha256: loaded.sha256, document: {...metadata,
          tracks: selected.map(({patterns, clips, ...track}) => ({...track, totalPatterns: patterns.length,
            clips: clips.slice(a.clipOffset, a.clipOffset + 100), totalClips: clips.length, clipOffset: a.clipOffset})),
          patterns, totalPatterns: allPatterns.length, patternOffset: a.patternOffset}};
      }
      case 'daemonv12_project_validate': {
        const {project} = schemas.daemonv12_project_validate.parse(args);
        const loaded = loadDocument(ws, project);
        return {...validateText(loaded.bytes.toString('utf8'), ws.path(project, 'project')), project, sha256: loaded.sha256};
      }
      case 'daemonv12_project_patch': {
        const {project, expectedSha256, edits} = schemas.daemonv12_project_patch.parse(args);
        const loaded = loadDocument(ws, project);
        if (loaded.sha256 !== expectedSha256) fail('PROJECT_CONFLICT', project, 'Project changed since it was read.', 'Read the project again and retry with its sha256.');
        const path = ws.path(project, 'project');
        const current = validateText(loaded.bytes.toString('utf8'), path);
        if (!current.ok) return {...current, project, sha256: loaded.sha256};
        const proposed = applyEdits(loaded.loaded.value as ProjectDocument, edits);
        const text = JSON.stringify(proposed, null, 2) + '\n';
        const validation = validateText(text, path);
        if (!validation.ok) return {...validation, project, sha256: loaded.sha256};
        ws.publish(project, text, expectedSha256);
        return {...validation, project, sha256: hash(text)};
      }
      case 'daemonv12_instruments_list': {
        const a = schemas.daemonv12_instruments_list.parse(args);
        const gm = GM_PROGRAMS.filter(p => p.includes(a.query));
        const discovered = a.project ? this.discover(a.project) : {samples: [], warnings: []};
        const samples = discovered.samples.filter(p => p.includes(a.query));
        return ok({gm: gm.slice(a.offset, a.offset + a.limit), totalGm: gm.length,
          samples: samples.slice(a.offset, a.offset + a.limit), totalSamples: samples.length, offset: a.offset,
          instrumentTypes: ['gm', 'sampler', 'drumkit'], warnings: discovered.warnings});
      }
      case 'daemonv12_drumkits_list': {
        const a = schemas.daemonv12_drumkits_list.parse(args), found = this.discover(a.project);
        return ok({kits: found.kits.slice(a.offset, a.offset + a.limit), totalKits: found.kits.length, offset: a.offset, warnings: found.warnings});
      }
      case 'daemonv12_render': {
        const {project, stems, format} = schemas.daemonv12_render.parse(args);
        const path = ws.path(project, 'project');
        // Read limit and validation happen before allocation; engine still owns final compilation.
        const preflight = validateText(ws.read(project, 'project').toString('utf8'), path);
        if (!preflight.ok) return {...preflight, project};
        const base = ws.path('.daemonv12-renders', 'artifact', true);
        try { mkdirSync(base, {mode: 0o700}); } catch (error) { if ((error as NodeJS.ErrnoException).code !== 'EEXIST') throw error; }
        ws.path('.daemonv12-renders', 'artifact');
        const outDir = mkdtempSync(join(base, 'render-'));
        const {result} = await runCommand('render', path, {outDir, stems, format, env: this.env});
        const artifacts = Object.fromEntries(Object.entries(result.artifacts).map(([key, value]) => [key,
          Array.isArray(value) ? value.map(s => ({...s, wav: relative(ws.root, s.wav)})) : relative(ws.root, value)]));
        return {...result, project, artifacts, manifest: result.manifest ? compactManifest(result.manifest) : null};
      }
      case 'daemonv12_analyze': {
        const {audio} = schemas.daemonv12_analyze.parse(args);
        if (!audio.endsWith('.wav')) fail('PATH_UNSAFE', audio, 'Analysis accepts rendered WAV files.', 'Pass artifacts.wav or a stem WAV from render.');
        const path = ws.path(audio, 'artifact');
        const {result} = await runCommand('analyze', path, {env: this.env});
        return {...result, project: null, audio};
      }
      case 'daemonv12_render_info': {
        const {manifest, detail} = schemas.daemonv12_render_info.parse(args);
        if (!manifest.endsWith('.render.json')) fail('PATH_UNSAFE', manifest, 'Expected a render manifest.', 'Use artifacts.manifest returned by render.');
        const bytes = ws.read(manifest, 'artifact', 16 * 1024 * 1024);
        let value;
        try { value = JSON.parse(bytes.toString('utf8')); } catch { fail('INVALID_MANIFEST', manifest, 'Manifest is not valid JSON.', 'Render the project again.'); }
        if (value?.engine?.name !== 'daemonv12' || !value.wav || !value.project)
          fail('INVALID_MANIFEST', manifest, 'Not a DaemonV12 render manifest.', 'Use the manifest returned by render.');
        return ok({path: manifest, sha256: hash(bytes), manifest: detail === 'full' ? value : compactManifest(value)});
      }
      default: throw new Error('Unreachable tool.');
    }
  }
  private discover(project: string) {
    const ws = this.workspace, path = ws.path(project, 'project', true);
    const root = relative(ws.root, join(dirname(path), 'assets'));
    const files: string[] = [], warnings: unknown[] = [];
    let visited = 0;
    const walk = (directory: string, depth: number) => {
      if (depth > 12) fail('RESOURCE_LIMIT', root, 'Asset directories are nested too deeply.', 'Keep asset nesting below 12 directories.');
      const abs = ws.path(directory, 'asset');
      for (const entry of readdirSync(abs, {withFileTypes: true}).sort((a,b) => a.name < b.name ? -1 : a.name > b.name ? 1 : 0)) {
        if (++visited > 10000) fail('RESOURCE_LIMIT', root, 'Too many asset entries.', 'Keep the asset catalog below 10000 entries.');
        const child = `${directory}/${entry.name}`;
        if (entry.isSymbolicLink()) { warnings.push({code: 'PATH_UNSAFE', severity: 'warning', path: child, message: 'Symlink omitted from discovery.'}); continue; }
        if (entry.isDirectory()) walk(child, depth + 1);
        else if (entry.isFile() && /\.(json|wav)$/.test(entry.name)) { ws.path(child, 'asset'); files.push(relative(dirname(path), join(ws.root, child))); }
      }
    };
    try { walk(root, 0); } catch (error) { if ((error as NodeJS.ErrnoException).code !== 'ENOENT') throw error; }
    const samples: string[] = [], kits: {kit: string; samples: unknown[]}[] = [];
    for (const file of files) {
      const read = readAsset(path, file, file);
      if (read.diagnostic) { warnings.push(read.diagnostic); continue; }
      if (file.endsWith('.wav')) { if (!decodePcm(read.bytes!).error) samples.push(file); continue; }
      let raw;
      try { raw = JSON.parse(read.bytes!.toString('utf8')); } catch { continue; }
      const parsed = parseKit(raw, file);
      if (parsed.diagnostics.length) { warnings.push(...parsed.diagnostics); continue; }
      const candidate = {formatVersion: 1, title: 'Discovery', bpm: 120, bars: 1, timeSignature: '4/4',
        tracks: [{id: 'kit', instrument: {type: 'drumkit', kit: file}, clips: [], patterns: []}]};
      const validated = validateText(JSON.stringify(candidate), path);
      if (!validated.ok) { warnings.push(...validated.errors); continue; }
      kits.push({kit: file, samples: parsed.entries});
    }
    return {samples, kits, warnings: warnings.slice(0, 100)};
  }
}
function compactManifest(manifest: Record<string, unknown>) {
  const {samples, stems, ...rest} = manifest;
  return {...rest, ...(samples ? {samples: {assets: (samples as {assets: unknown}).assets}} : {}),
    ...(Array.isArray(stems) ? {stems: stems.map(({sample: _, ...stem}) => stem)} : {})};
}
