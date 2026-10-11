// GLASSHOUSE identity at the playhead: when a sample fires, its pack name flashes in its
// column, read straight from the render manifest's trigger list.
import type {SampleId} from '../../data/contract.ts';
import type {LaneSpec} from '../../primitives/Arrangement.tsx';
import {C, mono} from '../../theme.ts';
import {lastIndexAt, type Trigger} from '../data.ts';
import {columnX, type ColumnsGeometry} from './Columns.tsx';

export const SAMPLE_LABEL: Record<SampleId, string> = {
  'glass-hit': 'GLASS.HIT',
  'glass-reverse': 'GLASS.REVERSE',
  'glass-crush': 'GLASS.CRUSH',
  'prism-impact': 'PRISM.IMPACT',
  'ghost-vox': 'GHOST.VOX',
  'vox-chip': 'VOX.CHIP',
  'bass-punch-cs': 'BASS.PUNCH',
  'sub-cs': 'SUB',
  'chrome-clap': 'CHROME.CLAP',
  'pixel-hat': 'PIXEL.HAT',
};

type Props = {
  triggers: readonly Trigger[];
  lanes: readonly LaneSpec[];
  geometry: ColumnsGeometry;
  now: number;
  /** Seconds a name stays lit after its trigger. */
  hold?: number;
  opacity?: number;
  u?: number;
};

export const TriggerTags = ({triggers, lanes, geometry, now, hold = 0.24, opacity = 1, u = 1}: Props) => {
  if (opacity <= 0) return null;
  return (
    <>
      {lanes.map((lane, i) => {
        let latest: Trigger | null = null;
        for (let k = lastIndexAt(triggers, now); k >= 0; k--) {
          const tr = triggers[k]!;
          if (now - tr.t > hold) break;
          if (tr.role === lane.id) {
            latest = tr;
            break;
          }
        }
        if (!latest) return null;
        const age = (now - latest.t) / hold;
        return (
          <div
            key={lane.id}
            style={{
              position: 'absolute',
              left: columnX(geometry, i),
              top: geometry.playheadY + 16 * u,
              translate: '-50% 0',
              ...mono(14 * u, 600, 0.06),
              color: age < 0.35 ? C.ink : C.g7,
              opacity: opacity * (1 - age * age) * (0.55 + 0.45 * latest.velocity),
            }}
          >
            {SAMPLE_LABEL[latest.sample]}
          </div>
        );
      })}
    </>
  );
};
