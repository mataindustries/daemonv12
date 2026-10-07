import { compileProjectTextWithAssets, resultFor, summarize } from '../src/pipeline.ts';
import { parseProjectText } from '../src/project/load.ts';
import { fail, hash, Workspace } from './workspace.ts';
import type { Edit, ProjectDocument } from './schemas.ts';

export function loadDocument(workspace: Workspace, project: string) {
  const bytes = workspace.read(project, 'project');
  const loaded = parseProjectText(bytes.toString('utf8'));
  return {bytes, sha256: hash(bytes), loaded};
}
export function validateText(text: string, path: string) {
  const compiled = compileProjectTextWithAssets(text, path);
  return resultFor('validate', path, compiled.diagnostics,
    compiled.timeline ? summarize(compiled.project!, compiled.timeline) : null, compiled.omitted);
}
function assignFields(target: object, fields: object) {
  // Only schema-declared fields reach here. null removes optional authoring fields.
  for (const [key, value] of Object.entries(fields)) {
    if (value === null) delete (target as Record<string, unknown>)[key];
    else (target as Record<string, unknown>)[key] = value;
  }
}
export function applyEdits(source: ProjectDocument, edits: Edit[]): ProjectDocument {
  const result = structuredClone(source);
  for (const [i, edit] of edits.entries()) {
    const at = `edits[${i}]`;
    if (edit.op === 'project_update') { assignFields(result, edit.fields); continue; }
    if (edit.op === 'track_add') { result.tracks.push(edit.track); continue; }
    const track = result.tracks.find(t => t.id === edit.trackId);
    if (!track) fail('EDIT_TARGET_NOT_FOUND', at, `No track ${edit.trackId}.`, 'Read the project and use an existing track ID.');
    switch (edit.op) {
      case 'track_remove': result.tracks.splice(result.tracks.indexOf(track), 1); break;
      case 'track_update': assignFields(track, edit.fields); break;
      case 'clips_set': track.clips = edit.clips; break;
      case 'pattern_put': {
        const index = track.patterns.findIndex(p => p.id === edit.pattern.id);
        if (index === -1) track.patterns.push(edit.pattern); else track.patterns[index] = edit.pattern;
        break;
      }
      case 'pattern_remove':
      case 'notes_append': {
        const index = track.patterns.findIndex(p => p.id === edit.patternId);
        if (index === -1) fail('EDIT_TARGET_NOT_FOUND', at, `No pattern ${edit.patternId}.`, 'Use pattern_put to create the pattern first.');
        if (edit.op === 'pattern_remove') track.patterns.splice(index, 1);
        else track.patterns[index]!.notes.push(...edit.notes);
        break;
      }
    }
  }
  return result;
}
