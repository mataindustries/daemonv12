export const diagnosticCodes = [
  'USAGE_ERROR', 'FILE_NOT_FOUND', 'FILE_READ_FAILED', 'JSON_PARSE_ERROR',
  'UNSUPPORTED_FORMAT_VERSION', 'MISSING_FIELD', 'UNKNOWN_FIELD', 'WRONG_TYPE',
  'OUT_OF_RANGE', 'INVALID_ID', 'DUPLICATE_ID', 'INVALID_TIME_SIGNATURE', 'INVALID_KEY',
  'UNSUPPORTED_INSTRUMENT_TYPE', 'UNKNOWN_GM_PROGRAM', 'INVALID_PITCH', 'INVALID_POSITION',
  'POSITION_OUT_OF_RANGE', 'INVALID_DURATION', 'OFF_GRID', 'NOTE_EXCEEDS_PATTERN',
  'UNKNOWN_PATTERN', 'CLIP_EXCEEDS_PROJECT', 'NOTE_OVERLAP', 'PATTERN_UNUSED', 'TRACK_EMPTY',
  'SOUNDFONT_NOT_FOUND', 'SOUNDFONT_INVALID', 'RENDERER_NOT_FOUND', 'RENDERER_FAILED',
  'OUTPUT_WRITE_FAILED', 'INTERNAL_ERROR',
] as const;
export type DiagnosticCode = typeof diagnosticCodes[number];
export interface Diagnostic {
  code: DiagnosticCode;
  severity: 'error' | 'warning';
  path: string;
  message: string;
  expected?: string;
  received?: unknown;
  hint?: string;
  line?: number;
  column?: number;
}
export type Parsed<T> = { value: T; diagnostic?: never } | { value?: never; diagnostic: Diagnostic };
export function diagnostic(code: DiagnosticCode, path: string, received: unknown,
  expected: string, hint?: string): Diagnostic {
  return { code, severity: 'error', path, message: `${code.toLowerCase().replaceAll('_', ' ')}: ${JSON.stringify(received) ?? 'missing value'}.`,
    expected, ...(received === undefined ? {} : { received }), ...(hint ? { hint } : {}) };
}
export function exitCodeFor(ds: readonly Diagnostic[]): number {
  return ds.reduce((highest, d) => Math.max(highest, d.severity === 'warning' ? 0
    : d.code === 'INTERNAL_ERROR' ? 4
    : /^(SOUNDFONT_|RENDERER_|OUTPUT_WRITE_FAILED)/.test(d.code) ? 3
    : ['USAGE_ERROR', 'FILE_NOT_FOUND', 'FILE_READ_FAILED'].includes(d.code) ? 2 : 1), 0);
}
export function levenshtein(a: string, b: string): number {
  let row = Array.from({ length: b.length + 1 }, (_, i) => i);
  for (let i = 0; i < a.length; i++) {
    const next = [i + 1];
    for (let j = 0; j < b.length; j++) next.push(Math.min(next[j]! + 1, row[j + 1]! + 1, row[j]! + (a[i] === b[j] ? 0 : 1)));
    row = next;
  }
  return row[b.length]!;
}
export function didYouMean(received: string, candidates: readonly string[], maxDistance: number): string | undefined {
  let best: string | undefined;
  let distance = maxDistance + 1;
  for (const candidate of candidates) {
    const d = levenshtein(received.toLowerCase(), candidate.toLowerCase());
    if (d < distance) { best = candidate; distance = d; }
  }
  return best;
}
export function formatPath(parent: string, key: string | number): string {
  if (typeof key === 'number') return `${parent}[${key}]`;
  return /^[A-Za-z_$][\w$]*$/.test(key) ? `${parent ? parent + '.' : ''}${key}` : `${parent}[${JSON.stringify(key)}]`;
}
export function formatDiagnosticHuman(d: Diagnostic): string {
  return [`${d.severity}[${d.code}] ${d.path || '(root)'}`, `  ${d.message}`,
    ...(d.expected === undefined ? [] : [`  expected: ${d.expected}`]),
    ...('received' in d ? [`  received: ${JSON.stringify(d.received)}`] : []),
    ...(d.hint ? [`  hint: ${d.hint}`] : [])].join('\n');
}
export function capDiagnostics(ds: readonly Diagnostic[]): { diagnostics: Diagnostic[]; omitted?: number } {
  return { diagnostics: ds.slice(0, 100), ...(ds.length > 100 ? { omitted: ds.length - 100 } : {}) };
}
