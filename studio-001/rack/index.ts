/** DaemonV12 Signature Rack: public entry point. */
export * from './types.ts';
export { RACK_VERSION, getInstrument, listInstruments, registryDocument } from './registry.ts';
export { normalizeScore, performanceJson, type NormalizedScore, type NormalizedPart } from './score.ts';
export { renderScore, mixdown, placed, peak, panGains, type Rendered, type Mixes, type Stereo } from './render.ts';
export { bouncePackage, bounceKit, verifyPackage, sealPackage, packageFiles, containmentProblems, wavBytes, ENGINE_BASE } from './package.ts';
export { verifyFrozen, readFreeze, frozen, sha256, REPO_ROOT } from './frozen.ts';
export { renderToDirectory, ffmpegVersion, loudness } from './cli.ts';
export { pitchOf, pitchName, keyOf, curveAt, beatFrame, engineEndFrames, beatSecondsOf, haloPitches } from './curves.ts';
export { lowerScore, expandMotif, applyTransform, transformLabel, stepToMidi, cellPitches, SCALES, GESTURES, TRANSFORM_OPS, LIMITS as MOTIF_LIMITS, type LowerOptions } from './motif.ts';
export { motifReport, motifEvents, onsetFrame, hook10Gate, type MotifReport, type MotifEvents, type MotifEvent } from './motif-report.ts';
