// Small strict wire format. Paths are relative to the experiment definition.
export class LabError extends Error {
  constructor(code, message, repair, details) { super(message); Object.assign(this, { code, repair, details }); }
}
export function requireLab(ok, code, message, repair, details) {
  if (!ok) throw new LabError(code, message, repair, details);
}
export function object(v, keys, at) {
  requireLab(v && typeof v === 'object' && !Array.isArray(v) && Object.keys(v).every(k => keys.includes(k)),
    'INVALID_DEFINITION', `Invalid fields at ${at}.`, `Use only: ${keys.join(', ')}.`);
}
const integer = v => Number.isSafeInteger(v) && v >= 0;
const text = v => typeof v === 'string' && v.trim().length > 0;
export function definition(v) {
  object(v, ['version', 'source', 'candidates', 'seed', 'frames', 'window', 'loudness', 'constraints'], 'experiment');
  requireLab(v.version === 1 && text(v.source) && text(v.seed) && integer(v.frames) && v.frames > 0 && v.frames <= 26460000,
    'INVALID_DEFINITION', 'Expected version 1, source, private seed and 1–26460000 frames.', 'See agent-lab/README.md.');
  requireLab(Array.isArray(v.candidates) && v.candidates.length === 3, 'CANDIDATE_COUNT', 'Exactly three candidates are required.', 'Supply three distinct project JSON files.');
  for (const c of v.candidates) {
    object(c, ['id', 'project', 'hypothesis'], 'candidate');
    requireLab(text(c.id) && text(c.project) && text(c.hypothesis), 'INVALID_CANDIDATE', 'Each candidate needs id, project and hypothesis.', 'State the creative hypothesis in plain language.');
  }
  requireLab(new Set(v.candidates.map(c => c.id)).size === 3, 'DUPLICATE_CANDIDATE', 'Candidate ids must be unique.', 'Assign three different ids.');
  object(v.window, ['startFrame', 'frames'], 'window');
  requireLab(integer(v.window.startFrame) && integer(v.window.frames) && v.window.frames > 0 && v.window.startFrame + v.window.frames <= v.frames,
    'INVALID_WINDOW', 'Listening window must fit the track.', 'Use 44100 Hz sample frames; end is exclusive.');
  object(v.loudness, ['targetLufs', 'ceilingDbtp'], 'loudness');
  requireLab(Number.isFinite(v.loudness.targetLufs) && v.loudness.targetLufs >= -60 && v.loudness.targetLufs <= -5 &&
    Number.isFinite(v.loudness.ceilingDbtp) && v.loudness.ceilingDbtp <= -1 && v.loudness.ceilingDbtp >= -12,
    'INVALID_LOUDNESS', 'Target must be −60…−5 LUFS; ceiling −12…−1 dBTP.', 'Use targetLufs: -23, ceilingDbtp: -1.');
  requireLab(Array.isArray(v.constraints), 'INVALID_CONSTRAINT', 'constraints must be an array.', 'Use [] when no timing constraints are declared.');
  for (const c of v.constraints) {
    const common = ['kind', 'track'];
    if (c?.kind === 'triggers') {
      object(c, [...common, 'frames'], 'triggers');
      requireLab(text(c.track) && Array.isArray(c.frames) && c.frames.every(f => integer(f) && f < v.frames), 'INVALID_CONSTRAINT', 'Invalid trigger frames.', 'Supply the complete ordered list of scheduled frames for this track.');
    } else if (c?.kind === 'onset' || c?.kind === 'silence') {
      object(c, [...common, 'startFrame', 'endFrame', ...(c.kind === 'onset' ? ['expectedFrame', 'toleranceFrames', 'thresholdFraction', 'minPeakDbfs'] : ['maxPeakDbfs'])], c.kind);
      requireLab(text(c.track) && integer(c.startFrame) && integer(c.endFrame) && c.endFrame > c.startFrame && c.endFrame <= v.frames,
        'INVALID_CONSTRAINT', 'Invalid audio search window.', 'Use a nonempty window inside the track. Use track: "$master" for the master.');
      requireLab(c.kind === 'silence' ? Number.isFinite(c.maxPeakDbfs) && c.maxPeakDbfs <= 0 :
        integer(c.expectedFrame) && c.expectedFrame >= c.startFrame && c.expectedFrame < c.endFrame && integer(c.toleranceFrames) &&
        c.thresholdFraction > 0 && c.thresholdFraction <= 1 && Number.isFinite(c.minPeakDbfs) && c.minPeakDbfs <= 0,
        'INVALID_CONSTRAINT', 'Invalid audio timing threshold.', 'Declare explicit onset tolerance, thresholdFraction and minPeakDbfs, or maxPeakDbfs for silence.');
    } else requireLab(false, 'INVALID_CONSTRAINT', 'Unknown timing constraint.', 'Use triggers, onset or silence.');
  }
  return v;
}
