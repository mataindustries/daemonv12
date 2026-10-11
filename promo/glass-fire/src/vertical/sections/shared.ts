import {LANES_FULL} from '../../primitives/Arrangement.tsx';
import type {StemId} from '../../data/contract.ts';
import {STOP_MIN_SECONDS, type VData} from '../data.ts';
import type {ColumnsGeometry} from '../primitives/Columns.tsx';
import type {VSection} from '../sections.ts';

/** The column layout of Drop 1 (and of the hook, with its playhead low so the whole pre-drop is in view). */
export const DROP1_COLUMNS: ColumnsGeometry = {H: 1920, playheadY: 1150, pps: 720, top: 0, bottom: 1700, left: 94, columnWidth: 132, gap: 20};
export const HOOK_COLUMNS: ColumnsGeometry = {...DROP1_COLUMNS, playheadY: 1640, bottom: 1760};

/** With exact triggers every column draws its real GLASSHOUSE waveforms; otherwise only glass and vox do. */
export const sampleLanesOf = (data: VData): StemId[] => (data.exact ? LANES_FULL.map(l => l.id) : ['glass', 'vox']);

/** Output time of the first stop (a silence long enough to read) inside a section, or null. */
export const firstStopIn = (data: VData, section: VSection): number | null => {
  const from = section.from / 60;
  const to = (section.from + section.durationInFrames) / 60;
  return data.gates.find(g => g.duration >= STOP_MIN_SECONDS && g.t >= from && g.t < to)?.t ?? null;
};

/** Is t inside any silence of the cut (including the short gate slices)? */
export const gateAt = (data: VData, t: number, minimum = 0) => data.gates.some(g => g.duration >= minimum && t >= g.t && t < g.t + g.duration);
