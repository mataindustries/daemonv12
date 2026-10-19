// The approved master for IGNITION 002: SECOND WIND (lossless WAV). Locked: never regenerated,
// remastered, time-stretched or remixed by this project.
import {join} from 'node:path';

export const APPROVED_SHA256 = '6938bf3b8efd90d9c9818dc20689b71e408d9d22be1cab7e01da597da22a80e1';

/** Where the approved WAV is placed by hand (git-ignored). */
export const approvedWavPath = (root: string) => join(root, 'public', 'audio', 'ignition-002-second-wind.wav');
