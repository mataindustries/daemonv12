import { test } from 'node:test';
import { checkDeterminism, checkPitchAndTimbre, checkTransitions,
  checkAmplitudeAndWav, checkValidation, checkResourceBounds } from './verify.mjs';

test('same pinned runtime, seed and performance produce identical WAV bytes', checkDeterminism);
test('morph and vowel alter spectra while independent pitch keeps the fundamental', checkPitchAndTimbre);
test('normal and rapid morph probes contain no oversized sample or curvature impulse', checkTransitions);
test('morph levels, dynamics, PCM encoding and endpoints remain bounded', checkAmplitudeAndWav);
test('invalid, ambiguous and unbounded performance inputs are rejected', checkValidation);
test('maximum supported duration and polyphony render within measured budgets', { timeout: 65000 }, checkResourceBounds);
