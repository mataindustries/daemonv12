// Sample frames are the authority. Picture frames are a derived, zero-based floor
// projection; consumers may translate that index into their own presentation API.
import type { Diagnostic } from '../diagnostics.ts';

export type JsonValue = null | boolean | number | string | JsonValue[] | { [key: string]: JsonValue };
export type SourceProvenance = { [key: string]: JsonValue };
export type JsonObject = SourceProvenance;
export interface RationalFps { numerator: number; denominator: number }
export interface SampleClip { startSampleFrame: number; endSampleFrame: number }
export interface ScheduledEvent {
  sampleFrame: number;
  trackId: string;
  eventId: string;
  velocity: number;
  visualRoles?: readonly string[];
  source: SourceProvenance;
}
export interface EventMapOptions {
  sampleRate: number;
  fps: RationalFps;
  source: SourceProvenance;
  clip?: SampleClip;
}
export interface MappedEvent extends ScheduledEvent {
  clipSampleFrame: number;
  pictureFrame: number;
  sourcePictureFrame: number;
}
export interface EventMap {
  formatVersion: 1;
  kind: 'daemonv12-event-map';
  sampleRate: number;
  fps: RationalFps;
  clip: SampleClip | null;
  source: SourceProvenance;
  events: MappedEvent[];
}

export class EventMapValidationError extends Error {
  readonly diagnostics: Diagnostic[];
  constructor(diagnostics: Diagnostic[]) {
    super(diagnostics.map(d => `${d.code} ${d.path || '(root)'}: ${d.message} ${d.hint ?? ''}`).join('\n'));
    this.name = 'EventMapValidationError';
    this.diagnostics = diagnostics;
  }
}

const MAX = BigInt(Number.MAX_SAFE_INTEGER);
const compareText = (a: string, b: string) => a < b ? -1 : a > b ? 1 : 0;
const compareEvents = (a: ScheduledEvent, b: ScheduledEvent) => a.sampleFrame - b.sampleFrame
  || compareText(a.trackId, b.trackId) || compareText(a.eventId, b.eventId);
const plainObject = (value: unknown): value is Record<string, unknown> => value !== null && typeof value === 'object'
  && !Array.isArray(value) && [Object.prototype, null].includes(Object.getPrototypeOf(value));
const denseArray = (value: readonly unknown[]) => Object.keys(value).length === value.length
  && Object.keys(value).every(key => /^(0|[1-9][0-9]*)$/.test(key) && Number(key) < value.length)
  && Object.getOwnPropertySymbols(value).length === 0;
const at = (parent: string, key: string | number) => typeof key === 'number' ? `${parent}[${key}]`
  : /^[A-Za-z_$][\w$]*$/.test(key) ? `${parent ? parent + '.' : ''}${key}` : `${parent}[${JSON.stringify(key)}]`;
function issue(ds: Diagnostic[], path: string, message: string, hint: string, code: Diagnostic['code'] = 'OUT_OF_RANGE'): void {
  ds.push({ code, severity: 'error', path, message, hint });
}
function fields(value: unknown, allowed: readonly string[], required: readonly string[], path: string, ds: Diagnostic[]): value is Record<string, unknown> {
  if (!plainObject(value)) {
    issue(ds, path, 'Expected a plain object.', 'Supply a JSON object with the documented fields.', 'WRONG_TYPE');
    return false;
  }
  for (const key of Object.keys(value)) if (!allowed.includes(key))
    issue(ds, at(path, key), 'Unknown field.', 'Remove this field or put source-specific metadata inside source.', 'UNKNOWN_FIELD');
  for (const key of required) if (!Object.hasOwn(value, key))
    issue(ds, at(path, key), 'Required field is missing.', `Supply ${key}.`, 'MISSING_FIELD');
  return true;
}
function integer(value: unknown, path: string, ds: Diagnostic[], minimum = 0): value is number {
  if (typeof value === 'number' && Number.isSafeInteger(value) && value >= minimum) return true;
  issue(ds, path, `Expected a safe integer from ${minimum} through ${Number.MAX_SAFE_INTEGER}.`, 'Use integer sample offsets, rates and rational FPS components; do not pass seconds or rounded picture positions.');
  return false;
}
function label(value: unknown, path: string, ds: Diagnostic[]): value is string {
  if (typeof value === 'string' && value.trim().length > 0) return true;
  issue(ds, path, 'Expected a nonempty string.', 'Supply a stable source identity or a semantic role.', 'WRONG_TYPE');
  return false;
}
function json(value: unknown, path: string, ds: Diagnostic[], ancestors = new Set<object>()): boolean {
  if (value === null || typeof value === 'string' || typeof value === 'boolean' || (typeof value === 'number' && Number.isFinite(value))) return true;
  if (!Array.isArray(value) && !plainObject(value)) {
    issue(ds, path, 'Source provenance must contain JSON values only.', 'Replace undefined, functions and custom objects with finite JSON values.', 'WRONG_TYPE');
    return false;
  }
  if (ancestors.has(value)) {
    issue(ds, path, 'Source provenance contains a cycle.', 'Supply an acyclic JSON object.', 'WRONG_TYPE');
    return false;
  }
  if (ancestors.size >= 128) {
    issue(ds, path, 'Source provenance nesting exceeds 128 containers.', 'Use at most 128 nested objects or arrays.', 'OUT_OF_RANGE');
    return false;
  }
  ancestors.add(value);
  let valid = true;
  for (const [key, child] of Object.entries(value)) valid = json(child, at(path, Array.isArray(value) ? Number(key) : key), ds, ancestors) && valid;
  if (Array.isArray(value) && !denseArray(value)) {
    issue(ds, path, 'Source arrays must be dense JSON arrays.', 'Fill every array element explicitly.', 'WRONG_TYPE');
    valid = false;
  }
  if (Object.getOwnPropertySymbols(value).length) {
    issue(ds, path, 'Source provenance has non-JSON symbol keys.', 'Use string keys only.', 'WRONG_TYPE');
    valid = false;
  }
  ancestors.delete(value);
  return valid;
}
function provenance(value: unknown, path: string, ds: Diagnostic[]): value is SourceProvenance {
  if (!plainObject(value) || Object.keys(value).length === 0) {
    issue(ds, path, 'Expected nonempty source provenance.', 'Record the source repository/ref/path, generator parameters or a stable source identifier.', 'WRONG_TYPE');
    return false;
  }
  return json(value, path, ds);
}
function fps(value: unknown, path: string, ds: Diagnostic[]): value is RationalFps {
  if (!fields(value, ['numerator', 'denominator'], ['numerator', 'denominator'], path, ds)) return false;
  const numerator = integer(value.numerator, at(path, 'numerator'), ds, 1);
  const denominator = integer(value.denominator, at(path, 'denominator'), ds, 1);
  return numerator && denominator;
}
function clip(value: unknown, path: string, ds: Diagnostic[]): value is SampleClip {
  if (!fields(value, ['startSampleFrame', 'endSampleFrame'], ['startSampleFrame', 'endSampleFrame'], path, ds)) return false;
  const start = integer(value.startSampleFrame, at(path, 'startSampleFrame'), ds);
  const end = integer(value.endSampleFrame, at(path, 'endSampleFrame'), ds);
  if (start && end && (value.endSampleFrame as number) < (value.startSampleFrame as number))
    issue(ds, path, 'Clip end precedes clip start.', 'Use the half-open interval [startSampleFrame, endSampleFrame).');
  return start && end && (value.endSampleFrame as number) >= (value.startSampleFrame as number);
}
function scheduled(value: unknown, path: string, ds: Diagnostic[], mapped = false): value is ScheduledEvent {
  const required = ['sampleFrame', 'trackId', 'eventId', 'velocity', 'source'];
  if (mapped) required.push('clipSampleFrame', 'pictureFrame', 'sourcePictureFrame');
  if (!fields(value, [...required, 'visualRoles'], required, path, ds)) return false;
  const before = ds.length;
  integer(value.sampleFrame, at(path, 'sampleFrame'), ds);
  label(value.trackId, at(path, 'trackId'), ds);
  label(value.eventId, at(path, 'eventId'), ds);
  if (typeof value.velocity !== 'number' || !Number.isFinite(value.velocity) || value.velocity < 0)
    issue(ds, at(path, 'velocity'), 'Velocity must be a finite nonnegative linear gain.', 'Preserve the scheduled gain, including accents above 1; do not reinterpret it as MIDI velocity.');
  provenance(value.source, at(path, 'source'), ds);
  if (Object.hasOwn(value, 'visualRoles')) {
    if (!Array.isArray(value.visualRoles)) issue(ds, at(path, 'visualRoles'), 'Expected an array of role strings.', 'Use e.g. ["impact", "pulse"], or omit visualRoles.', 'WRONG_TYPE');
    else {
      if (!denseArray(value.visualRoles)) issue(ds, at(path, 'visualRoles'), 'Visual roles must be a dense JSON array.', 'Fill every role element explicitly.', 'WRONG_TYPE');
      const roles = new Set<string>();
      value.visualRoles.forEach((role, i) => {
        if (label(role, at(at(path, 'visualRoles'), i), ds)) {
          if (roles.has(role)) issue(ds, at(at(path, 'visualRoles'), i), 'Duplicate visual role.', 'Keep each role once.', 'DUPLICATE_ID');
          roles.add(role);
        }
      });
    }
  }
  if (mapped) for (const key of ['clipSampleFrame', 'pictureFrame', 'sourcePictureFrame']) integer(value[key], at(path, key), ds);
  return before === ds.length;
}
function assertValid(ds: Diagnostic[]): void { if (ds.length) throw new EventMapValidationError(ds); }
function reduced(value: RationalFps): RationalFps {
  let a = BigInt(value.numerator), b = BigInt(value.denominator);
  while (b !== 0n) [a, b] = [b, a % b];
  return { numerator: Number(BigInt(value.numerator) / a), denominator: Number(BigInt(value.denominator) / a) };
}
function picture(sampleFrame: number, sampleRate: number, rate: RationalFps, path: string, ds: Diagnostic[]): number {
  const result = BigInt(sampleFrame) * BigInt(rate.numerator) / (BigInt(sampleRate) * BigInt(rate.denominator));
  if (result > MAX) {
    issue(ds, path, 'Derived picture frame exceeds the safe integer range.', 'Reduce the FPS or the source duration.');
    return 0;
  }
  return Number(result);
}
// Canonical serialization does not depend on object insertion order or locale.
function canonical(value: JsonValue): string {
  if (value === null || typeof value !== 'object') return JSON.stringify(value);
  if (Array.isArray(value)) return `[${value.map(canonical).join(',')}]`;
  return `{${Object.keys(value).sort(compareText).map(key => `${JSON.stringify(key)}:${canonical(value[key]!)}`).join(',')}}`;
}
const cloneSource = (value: SourceProvenance): SourceProvenance => JSON.parse(canonical(value)) as SourceProvenance;

/** Export custom score events directly; their integer absolute sample frames are never requantized. */
export function buildEventMap(events: readonly ScheduledEvent[], options: EventMapOptions): EventMap {
  const ds: Diagnostic[] = [];
  if (!fields(options, ['sampleRate', 'fps', 'source', 'clip'], ['sampleRate', 'fps', 'source'], 'options', ds)) assertValid(ds);
  integer(options.sampleRate, 'options.sampleRate', ds, 1);
  fps(options.fps, 'options.fps', ds);
  provenance(options.source, 'options.source', ds);
  if (Object.hasOwn(options, 'clip')) clip(options.clip, 'options.clip', ds);
  if (!Array.isArray(events)) issue(ds, 'events', 'Expected an array of scheduled events.', 'Pass custom scheduled events with authoritative sampleFrame values.', 'WRONG_TYPE');
  else {
    if (!denseArray(events)) issue(ds, 'events', 'Scheduled events must be a dense JSON array.', 'Fill every scheduled event element explicitly.', 'WRONG_TYPE');
    const identities = new Map<string, Set<string>>();
    events.forEach((event, i) => {
      if (!scheduled(event, `events[${i}]`, ds)) return;
      const track = identities.get(event.trackId) ?? new Set<string>();
      if (track.has(event.eventId)) issue(ds, `events[${i}].eventId`, 'Duplicate event identity within track.', 'Use a unique eventId for every scheduled occurrence in this track.', 'DUPLICATE_ID');
      track.add(event.eventId); identities.set(event.trackId, track);
    });
  }
  assertValid(ds);
  const rate = reduced(options.fps), bounds = options.clip ? { ...options.clip } : null;
  const start = bounds?.startSampleFrame ?? 0;
  const mapped = [...events].filter(event => event.sampleFrame >= start && (bounds === null || event.sampleFrame < bounds.endSampleFrame))
    .sort(compareEvents).map((event, i): MappedEvent => {
      const local = event.sampleFrame - start;
      return { sampleFrame: event.sampleFrame, clipSampleFrame: local,
        pictureFrame: picture(local, options.sampleRate, rate, `events[${i}].pictureFrame`, ds),
        sourcePictureFrame: picture(event.sampleFrame, options.sampleRate, rate, `events[${i}].sourcePictureFrame`, ds),
        trackId: event.trackId, eventId: event.eventId, velocity: event.velocity,
        ...(event.visualRoles === undefined ? {} : { visualRoles: [...event.visualRoles].sort(compareText) }), source: cloneSource(event.source) };
    });
  assertValid(ds);
  return { formatVersion: 1, kind: 'daemonv12-event-map', sampleRate: options.sampleRate, fps: rate,
    clip: bounds, source: cloneSource(options.source), events: mapped };
}

/** Validate a JSON-decoded map, including every derived timing value and canonical event order. */
export function validateEventMap(value: unknown): Diagnostic[] {
  const ds: Diagnostic[] = [];
  const required = ['formatVersion', 'kind', 'sampleRate', 'fps', 'clip', 'source', 'events'];
  if (!fields(value, required, required, '', ds)) return ds;
  if (value.formatVersion !== 1) issue(ds, 'formatVersion', 'Unsupported event-map version.', 'Use formatVersion 1.', 'UNSUPPORTED_FORMAT_VERSION');
  if (value.kind !== 'daemonv12-event-map') issue(ds, 'kind', 'Unexpected event-map kind.', 'Use daemonv12-event-map.', 'WRONG_TYPE');
  const validRate = integer(value.sampleRate, 'sampleRate', ds, 1);
  const validFps = fps(value.fps, 'fps', ds);
  const validClip = value.clip === null || clip(value.clip, 'clip', ds);
  provenance(value.source, 'source', ds);
  if (validFps) {
    const normalized = reduced(value.fps as RationalFps);
    if (normalized.numerator !== (value.fps as RationalFps).numerator || normalized.denominator !== (value.fps as RationalFps).denominator)
      issue(ds, 'fps', 'FPS must be reduced to its canonical rational form.', 'Build the map with buildEventMap to normalize the fraction.');
  }
  if (!Array.isArray(value.events)) {
    issue(ds, 'events', 'Expected an array of mapped events.', 'Use buildEventMap to generate and validate events.', 'WRONG_TYPE');
    return ds;
  }
  if (!denseArray(value.events)) issue(ds, 'events', 'Mapped events must be a dense JSON array.', 'Fill every mapped event element explicitly.', 'WRONG_TYPE');
  const identities = new Map<string, Set<string>>();
  let previous: ScheduledEvent | undefined;
  value.events.forEach((event, i) => {
    const path = `events[${i}]`;
    if (!scheduled(event, path, ds, true)) return;
    const e = event as MappedEvent;
    const track = identities.get(e.trackId) ?? new Set<string>();
    if (track.has(e.eventId)) issue(ds, `${path}.eventId`, 'Duplicate event identity within track.', 'Use a unique eventId for each scheduled occurrence.', 'DUPLICATE_ID');
    track.add(e.eventId); identities.set(e.trackId, track);
    if (previous && compareEvents(previous, e) > 0) issue(ds, path, 'Events are not in canonical timing and identity order.', 'Build the map with buildEventMap.');
    previous = e;
    if (e.visualRoles && e.visualRoles.some((role, j) => j > 0 && compareText(e.visualRoles![j - 1]!, role) > 0))
      issue(ds, `${path}.visualRoles`, 'Visual roles are not in canonical order.', 'Build the map with buildEventMap.');
    if (!validRate || !validFps || !validClip) return;
    const bounds = value.clip as SampleClip | null, start = bounds?.startSampleFrame ?? 0;
    if (e.sampleFrame < start || (bounds && e.sampleFrame >= bounds.endSampleFrame)) {
      issue(ds, `${path}.sampleFrame`, 'Event onset is outside the clip.', 'Keep events with startSampleFrame <= sampleFrame < endSampleFrame.');
      return;
    }
    const local = e.sampleFrame - start;
    const expected = { clipSampleFrame: local,
      pictureFrame: picture(local, value.sampleRate as number, value.fps as RationalFps, `${path}.pictureFrame`, ds),
      sourcePictureFrame: picture(e.sampleFrame, value.sampleRate as number, value.fps as RationalFps, `${path}.sourcePictureFrame`, ds) };
    for (const [key, timing] of Object.entries(expected)) if ((e as unknown as Record<string, unknown>)[key] !== timing)
      issue(ds, `${path}.${key}`, `Timing does not match the authoritative sample frame; expected ${timing}.`, 'Rebuild from sampleFrame; floor the exact rational projection after subtracting the clip sample offset.');
  });
  return ds;
}

/** Crop by absolute integer source bounds. Repeated crops intersect; discarded events cannot reappear. */
export function cropEventMap(value: unknown, startSampleFrame: number, endSampleFrame: number): EventMap {
  const ds = validateEventMap(value);
  const requested = { startSampleFrame, endSampleFrame };
  clip(requested, 'clip', ds);
  assertValid(ds);
  const map = value as EventMap;
  const start = Math.max(startSampleFrame, map.clip?.startSampleFrame ?? 0);
  // Disjoint intersections are represented as an empty interval at the later start.
  const end = Math.max(start, Math.min(endSampleFrame, map.clip?.endSampleFrame ?? endSampleFrame));
  const events = map.events.map(({ sampleFrame, trackId, eventId, velocity, visualRoles, source }): ScheduledEvent =>
    ({ sampleFrame, trackId, eventId, velocity, ...(visualRoles === undefined ? {} : { visualRoles }), source }));
  return buildEventMap(events, { sampleRate: map.sampleRate, fps: map.fps, source: map.source,
    clip: { startSampleFrame: start, endSampleFrame: end } });
}

/** Validated, byte-stable UTF-8 JSON with lexically sorted keys and a final newline. */
export function serializeEventMap(value: unknown): string {
  assertValid(validateEventMap(value));
  return canonical(value as JsonValue) + '\n';
}
