// EXPERIMENTAL score-local tempo map (STILL HERE V3). DaemonV12 0.7 has exactly one tempo per
// project; nothing here changes the engine or claims it supports tempo automation.
//
// A piece is a list of 4/4 sections laid end to end, e.g. [{ bpm: 120, bars: 2 }, { bpm: 150, bars: 5 }].
// A position is an absolute sixteenth count across the piece (every bar has 16, whatever its
// tempo); quarter-sixteenths are allowed. Each position has an exact time in integer
// microseconds. To render through the unmodified engine, the map is translated into an
// ordinary fixed-tempo project at `engineBpm`, chosen so every authored position lands on an
// integer engine tick. The engine's own ticksToFrames then returns exactly the frame the exact
// time gives (nearest frame, ties later) — checked for every event, never assumed.
import { ticksToFrames, usPerQuarter, formatPosition } from '../../../dist/src/timing/musical-time.js';

export const RATE = 44100, FPS = 60;

export function tempoMap(sections, { engineBpm, engineMeter = '4/4' }) {
  const [num, den] = engineMeter.split('/').map(Number), meter = { numerator: num, denominator: den };
  const engineTempo = usPerQuarter(engineBpm);
  if (engineTempo * engineBpm !== 60_000_000) throw new Error(`engine tempo ${engineBpm} BPM is not an integer microsecond quarter`);
  // section table in integer microseconds
  let us = 0, six = 0;
  const table = sections.map(s => {
    const usPer16 = 60_000_000 / s.bpm / 4;
    if (!Number.isInteger(usPer16)) throw new Error(`${s.bpm} BPM sixteenth is not whole microseconds`);
    const row = { ...s, fromSix: six, toSix: six + 16 * s.bars, fromUs: us, usPer16 };
    six = row.toSix; us += 16 * s.bars * usPer16;
    return row;
  });
  const totalUs = us, totalSix = six;
  const section = pos => {
    if (pos < 0 || pos > totalSix) throw new RangeError(`position ${pos} outside the map`);
    return table.find(r => pos < r.toSix) ?? table[table.length - 1];
  };
  const micro = pos => {
    const r = section(pos), u = r.fromUs + (pos - r.fromSix) * r.usPer16;
    if (!Number.isInteger(u)) throw new RangeError(`position ${pos} is not whole microseconds`);
    return u;
  };
  // engine ticks: 960 per quarter of engineTempo microseconds
  const tick = pos => {
    const t = micro(pos) * 960 / engineTempo;
    if (!Number.isInteger(t)) throw new RangeError(`position ${pos} (${micro(pos)} us) is off the ${engineBpm} BPM engine tick grid`);
    return t;
  };
  const exactFrame = pos => Math.floor((micro(pos) * RATE + 500_000) / 1_000_000);
  const frame = pos => {
    const f = ticksToFrames(tick(pos), engineTempo), e = exactFrame(pos);
    if (f !== e) throw new Error(`position ${pos}: engine frame ${f} != exact frame ${e}`);
    return f;
  };
  const musical = pos => {
    const r = section(pos), bar = Math.floor(pos / 16) + 1, beat = Math.floor((pos % 16) / 4) + 1, sub = pos % 4;
    return `${bar}.${beat}${sub ? `+${sub}/16` : ''} @ ${r.bpm} BPM`;
  };
  return {
    sections: table, engineBpm, engineTempo, engineMeter, totalUs, totalSix,
    /** Engine bars needed to hold the piece (the render container is set separately in seconds). */
    engineBars: Math.ceil(totalUs * 960 / engineTempo / (3840 * num / den)),
    micro, tick, exactFrame, frame, musical,
    sec: pos => micro(pos) / 1e6,
    picture: pos => Math.floor(frame(pos) * FPS / RATE),
    bpmAt: pos => section(pos).bpm,
    /** Pattern-relative engine position (patterns start at bar 1). */
    position: pos => formatPosition(tick(pos), meter),
    /** Engine position of a raw engine tick (physics-timed events snapped to the engine grid). */
    positionOfTick: t => formatPosition(t, meter),
    /** Inverse: the (possibly fractional) sixteenth position of an engine tick. */
    posOfTick: t => {
      const u = t * engineTempo / 960, r = table.find(row => u < row.fromUs + 16 * row.bars * row.usPer16) ?? table[table.length - 1];
      return r.fromSix + (u - r.fromUs) / r.usPer16;
    },
    /** Nearest engine tick to a time in seconds (for physics-timed events). */
    tickOfSeconds: s => Math.round(s * 1e6 * 960 / engineTempo),
    /** A duration in seconds as an engine whole-note fraction (gates), exact or refused. */
    duration: seconds => {
      const t = Math.round(seconds * 1e6) * 960 / engineTempo;
      if (!Number.isInteger(t) || t <= 0) throw new RangeError(`${seconds} s is not a whole number of engine ticks`);
      let a = t, b = 3840; while (b) [a, b] = [b, a % b];
      return `${t / a}/${3840 / a}`;
    },
    /** The section-local length of `n` sixteenths starting at pos, in seconds. */
    span: (pos, n) => (micro(pos + n) - micro(pos)) / 1e6,
  };
}

/** The STILL HERE V3 map: two bars at 120 BPM, then five at 150; ignition at 4.000 s. Engine: 150 BPM in 2/4. */
export const PROPULSION_MAP = () => tempoMap([{ bpm: 120, bars: 2 }, { bpm: 150, bars: 5 }], { engineBpm: 150, engineMeter: '2/4' });
/** The fixed-120 control: six bars at 120 BPM, natively one engine tempo. */
export const CONTROL_120_MAP = () => tempoMap([{ bpm: 120, bars: 2 }, { bpm: 120, bars: 4 }], { engineBpm: 120, engineMeter: '4/4' });
