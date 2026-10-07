import { readFileSync } from 'node:fs';
import { diagnostic, type Diagnostic } from '../diagnostics.ts';
export interface LoadResult { value?: unknown; diagnostics: Diagnostic[]; bytes?: Uint8Array }
export function parseProjectText(text: string): LoadResult {
  text = text.replace(/^\uFEFF/, '');
  try { return { value: JSON.parse(text) as unknown, diagnostics: [] }; }
  catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    const d = diagnostic('JSON_PARSE_ERROR', '', text, 'valid JSON');
    d.message = message;
    const lc = /\(line (\d+) column (\d+)\)/.exec(message);
    const pos = /position (\d+)/.exec(message);
    if (lc) { d.line = +lc[1]!; d.column = +lc[2]!; }
    else if (pos) { const prefix = text.slice(0, +pos[1]!); d.line = prefix.split('\n').length; d.column = prefix.length - prefix.lastIndexOf('\n'); }
    let offset = pos ? +pos[1]! : undefined;
    if (offset === undefined && d.line !== undefined) offset = text.split('\n').slice(0, d.line - 1).reduce((n, s) => n + s.length + 1, 0) + d.column! - 1;
    if (offset !== undefined && /\d+[/:]\d+/.test(text.slice(Math.max(0, offset - 5), offset + 6))) d.hint = 'Durations and positions are strings: write "1/4".';
    return { diagnostics: [d] };
  }
}
export function loadProject(path: string): LoadResult {
  let bytes: Uint8Array;
  try { bytes = readFileSync(path); }
  catch (error) {
    const code = (error as NodeJS.ErrnoException).code;
    return { diagnostics: [diagnostic(code === 'ENOENT' ? 'FILE_NOT_FOUND' : 'FILE_READ_FAILED', '', path, 'readable project JSON file')] };
  }
  return { ...parseProjectText(Buffer.from(bytes).toString('utf8')), bytes };
}
