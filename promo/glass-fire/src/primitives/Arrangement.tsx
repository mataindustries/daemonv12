// The arrangement view: grid, markers, stem lanes, automation, spectrum and playhead on
// one shared TimeView. Acts 2, 3 and 5 configure it differently rather than redrawing it.
import type {ReactNode} from 'react';
import type {PromoData, StemId} from '../data/contract.ts';
import {automationMotion, automationSpread, hitAt} from '../data/signals.ts';
import type {Stage} from '../theme.ts';
import {AutomationCurve} from './AutomationCurve.tsx';
import {BeatGrid} from './BeatGrid.tsx';
import {EnergyBand} from './EnergyBand.tsx';
import {StemLane} from './StemLane.tsx';
import {SampleEvents} from './SampleEvents.tsx';
import {Playhead, TimelineMarkers} from './TimelineMarker.tsx';
import {visibleTimes, type TimeView} from './view.ts';

export type LaneSpec = {id: StemId; label: string};

export const LANES_IGNITION: LaneSpec[] = [
  {id: 'kick', label: 'KICK'},
  {id: 'sub', label: 'SUB'},
  {id: 'glass', label: 'GLASS'},
  {id: 'vox', label: 'VOX'},
  {id: 'hat', label: 'HAT'},
];
export const LANES_FULL: LaneSpec[] = [
  {id: 'kick', label: 'KICK'},
  {id: 'sub', label: 'SUB'},
  {id: 'glass', label: 'GLASS'},
  {id: 'vox', label: 'VOX'},
  {id: 'clap', label: 'CLAP'},
  {id: 'hat', label: 'HAT'},
];

const BLOCK_WIDTH: Record<StemId, number> = {kick: 12, sub: 10, glass: 9, vox: 8, clap: 10, hat: 3};

export type AutomationOverlay = {
  laneId: string;
  /** Which stem lane the curve rides over. */
  over: StemId;
  /** 'always' shows the readout; 'motion' shows it only while the value is moving. */
  label: 'always' | 'motion' | 'never';
  reveal?: number;
};

export type ArrangementProps = {
  data: PromoData;
  stage: Stage;
  view: TimeView;
  lanes: LaneSpec[];
  top: number;
  laneHeight: number;
  laneGap: number;
  labelX: number;
  /** Per-lane reveal 0…1 (index-aligned with lanes). */
  laneReveal?: number[];
  gridReveal?: number;
  sixteenths?: boolean;
  lockLead?: number;
  waveGain?: number;
  split?: number;
  automation?: AutomationOverlay[];
  spectrum?: {y: number; height: number; opacity?: number} | null;
  showMarkers?: boolean;
  /** Extra layers drawn above the lanes, inside the same SVG. */
  children?: ReactNode;
  iris?: boolean;
  /** Lanes drawn as real GLASSHOUSE sample clips instead of event blocks. */
  sampleLanes?: StemId[];
  /** Hide the playhead (Drop 2 draws its own in screen space). */
  playhead?: boolean;
};

export const laneCentre = (index: number, top: number, laneHeight: number, laneGap: number) => top + index * (laneHeight + laneGap) + laneHeight / 2;

export const Arrangement = ({
  data,
  stage,
  view,
  lanes,
  top,
  laneHeight,
  laneGap,
  labelX,
  laneReveal,
  gridReveal = 1,
  sixteenths = false,
  lockLead = 0,
  waveGain = 1,
  split = 0,
  automation = [],
  spectrum = null,
  showMarkers = true,
  children,
  iris = false,
  sampleLanes = [],
  playhead = true,
}: ArrangementProps) => {
  const {u} = stage;
  const bottom = top + lanes.length * (laneHeight + laneGap) - laneGap;
  const gridTop = top - 46 * u;
  const gridBottom = spectrum ? spectrum.y + spectrum.height : bottom;
  const kickHit = hitAt(data.stems.kick.onsets, view.now, {decay: 0.06});
  return (
    <>
      <BeatGrid view={view} y={gridTop} height={gridBottom - gridTop} reveal={gridReveal} sixteenths={sixteenths} numberY={gridTop - 22 * u} u={u} />
      {showMarkers ? <TimelineMarkers view={view} markers={data.markers} y={gridTop} height={gridBottom - gridTop} labelY={gridTop - 26 * u} u={u} opacity={gridReveal} /> : null}
      {spectrum ? <EnergyBand spectrum={data.spectrum} view={view} y={spectrum.y} height={spectrum.height} u={u} opacity={spectrum.opacity ?? 1} /> : null}
      {lanes.map((lane, i) => (
        <StemLane
          key={lane.id}
          stem={data.stems[lane.id]}
          label={lane.label}
          index={i}
          view={view}
          y={top + i * (laneHeight + laneGap)}
          height={laneHeight}
          labelX={labelX}
          u={u}
          reveal={laneReveal?.[i] ?? 1}
          lockLead={lockLead}
          blockWidth={BLOCK_WIDTH[lane.id]}
          waveGain={waveGain}
          split={split}
          iris={iris && lane.id === 'glass'}
          showBlocks={!sampleLanes.includes(lane.id)}
        />
      ))}
      {lanes.map((lane, i) =>
        sampleLanes.includes(lane.id) ? (
          <SampleEvents
            key={`samples-${lane.id}`}
            onsets={data.stems[lane.id].onsets}
            view={view}
            y={top + i * (laneHeight + laneGap) + laneHeight * 0.14}
            height={laneHeight * 0.72}
            u={u}
            fallback={lane.id === 'vox' ? 'vox-chip' : 'glass-hit'}
            opacity={laneReveal?.[i] ?? 1}
          />
        ) : null,
      )}
      {automation.map(a => {
        const laneIndex = lanes.findIndex(l => l.id === a.over);
        const lane = data.automation.find(l => l.id === a.laneId);
        if (!lane || laneIndex < 0) return null;
        const ly = top + laneIndex * (laneHeight + laneGap);
        const labelOpacity = a.label === 'always' ? 1 : a.label === 'motion' ? Math.min(1, automationMotion(lane, view.now) * 3) : 0;
        // Motion-gated lanes only draw where they actually move inside the window.
        const [w0, w1] = visibleTimes(view);
        const presence = a.label === 'motion' ? Math.min(1, automationSpread(lane, w0, w1) * 4) : 1;
        return <AutomationCurve key={a.laneId} lane={lane} view={view} y={ly - laneGap * 0.4} height={laneHeight + laneGap * 0.8} u={u} reveal={a.reveal ?? 1} labelOpacity={labelOpacity} opacity={presence} />;
      })}
      {children}
      {playhead ? <Playhead x={view.playheadX} y={gridTop - 8 * u} height={gridBottom - gridTop + 16 * u} u={u} flash={kickHit} opacity={gridReveal} /> : null}
    </>
  );
};
