/** DaemonV12 Anti-Formula, Gate 1: public entry point. Sits above the v0.9 motif layer; changes nothing below it. */
export * from './types.ts';
export { observe, recallStatements, trackExpectation, formOf, literalMotifs, type TrackOptions } from './memory.ts';
export { applyAntiFormula, findRun, type Applied } from './apply.ts';
