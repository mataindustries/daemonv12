// The arrangement turned on its side for portrait: time runs DOWN the frame.
//
// The shared primitives (StemLane, SampleEvents, AutomationCurve, BeatGrid, markers, playhead)
// draw unchanged in a landscape coordinate space that is rotated −90°: inner x (time) becomes
// screen y and inner y (lanes) becomes screen x. The future falls from the top of the frame
// into a horizontal playhead; what has sounded is filled in below it. Six stems become six
// columns, so a 1920-pixel-tall frame shows more than a bar of music at once.
import {Arrangement, type ArrangementProps} from '../../primitives/Arrangement.tsx';
import type {TimeView} from '../../primitives/view.ts';

export type ColumnsGeometry = {
  /** Screen height (the inner time axis length). */
  H: number;
  /** Screen y of "now". */
  playheadY: number;
  /** Pixels per second along the time axis. */
  pps: number;
  /** Screen y where the columns begin (far future) and end (past). */
  top: number;
  bottom: number;
  /** Screen x of the first column's left edge. */
  left: number;
  columnWidth: number;
  gap: number;
};

export const columnsView = (g: ColumnsGeometry, now: number): TimeView => ({now, playheadX: g.H - g.playheadY, pps: g.pps, left: g.H - g.bottom, right: g.H - g.top});

/** Screen y of a time. */
export const timeY = (g: ColumnsGeometry, now: number, t: number) => g.playheadY - (t - now) * g.pps;

/** Screen x of a column's centre. */
export const columnX = (g: ColumnsGeometry, index: number) => g.left + index * (g.columnWidth + g.gap) + g.columnWidth / 2;

export const columnsRight = (g: ColumnsGeometry, count: number) => g.left + count * g.columnWidth + (count - 1) * g.gap;

type Props = Omit<ArrangementProps, 'view' | 'top' | 'laneHeight' | 'laneGap' | 'labelX'> & {
  geometry: ColumnsGeometry;
  now: number;
  /** Inner x of the lane labels: they read upward from this distance above the bottom edge. */
  labelInset?: number;
};

export const Columns = ({geometry: g, now, labelInset = 34, ...arrangement}: Props) => (
  <g transform={`translate(0 ${g.H}) rotate(-90)`}>
    <Arrangement {...arrangement} view={columnsView(g, now)} top={g.left} laneHeight={g.columnWidth} laneGap={g.gap} labelX={labelInset} />
  </g>
);
