// QA still: representative frames of the whole film on one sheet, rendered by Remotion
// itself (each cell is the real composition frozen at one frame), so it shows exactly
// what the renderer produces.
import {AbsoluteFill, Freeze, Sequence} from 'remotion';
import {GlassFire, type GlassFireProps} from './GlassFire.tsx';
import {C, display, mono} from './theme.ts';
import {actAtFrame} from './timeline/acts.ts';
import {musicalTimeAtFrame} from './timeline/grid.ts';

export const SHEET_FRAMES = [
  8, 30, 46, 60, 92, 115, 140, 172,
  186, 215, 262, 330,
  362, 400, 455, 530, 545, 600, 690,
  726, 766, 812, 860, 892,
  905, 930, 990, 1060, 1172, 1195, 1240,
  1262, 1305, 1352, 1400, 1439,
];
export const SHEET = {cols: 6, cellW: 400, cellH: 225, label: 34, gap: 16, header: 96};
export const SHEET_WIDTH = SHEET.cols * SHEET.cellW + (SHEET.cols + 1) * SHEET.gap;
export const SHEET_HEIGHT = SHEET.header + Math.ceil(SHEET_FRAMES.length / SHEET.cols) * (SHEET.cellH + SHEET.label + SHEET.gap) + SHEET.gap;

export const ContactSheet = (props: GlassFireProps) => (
  <AbsoluteFill style={{background: '#0E0E10'}}>
    <div style={{position: 'absolute', left: SHEET.gap, top: 28, display: 'flex', gap: 28, alignItems: 'baseline'}}>
      <span style={{...display(40, 900, 112, 0), color: C.ink}}>GLASS//FIRE</span>
      <span style={{...mono(16, 500, 0.12), color: C.g7}}>
        {`CONTACT SHEET · ${SHEET_FRAMES.length} FRAMES · DATA: ${props.data?.source.kind.toUpperCase() ?? '?'} · 1920×1080 · 60 FPS · 1,440 F`}
      </span>
    </div>
    {SHEET_FRAMES.map((frame, i) => {
      const x = SHEET.gap + (i % SHEET.cols) * (SHEET.cellW + SHEET.gap);
      const y = SHEET.header + Math.floor(i / SHEET.cols) * (SHEET.cellH + SHEET.label + SHEET.gap);
      const m = musicalTimeAtFrame(frame);
      return (
        <div key={frame} style={{position: 'absolute', left: x, top: y}}>
          <div style={{...mono(13, 500, 0.08), color: C.g8, height: SHEET.label, display: 'flex', gap: 14}}>
            <span style={{color: C.ink}}>{`F${String(frame).padStart(4, '0')}`}</span>
            <span>{`${(frame / 60).toFixed(3)} s`}</span>
            <span>{`${m.bar}:${m.beat}`}</span>
            <span style={{color: C.g6}}>{actAtFrame(frame).title}</span>
          </div>
          <div style={{position: 'relative', width: SHEET.cellW, height: SHEET.cellH, overflow: 'hidden', outline: `1px solid ${C.g4}`}}>
            <div style={{position: 'absolute', width: 1920, height: 1080, scale: String(SHEET.cellW / 1920), transformOrigin: '0 0'}}>
              <Freeze frame={frame}>
                <Sequence width={1920} height={1080} name={`F${frame}`}>
                  <GlassFire {...props} audio="none" />
                </Sequence>
              </Freeze>
            </div>
          </div>
        </div>
      );
    })}
  </AbsoluteFill>
);
