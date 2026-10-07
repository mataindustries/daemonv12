import type { Timeline } from '../timing/timeline.ts';
export function encodeVlq(value: number): number[] {
  const bytes = [value & 0x7f];
  while ((value = Math.floor(value / 128)) > 0) bytes.unshift((value & 0x7f) | 0x80);
  return bytes;
}
function be(value: number, count: number): number[] {
  return Array.from({ length: count }, (_, i) => (value >>> (8 * (count - i - 1))) & 0xff);
}
function chunk(name: string, bytes: number[]): number[] {
  return [...new TextEncoder().encode(name), ...be(bytes.length, 4), ...bytes];
}
function metaText(text: string): number[] {
  const bytes = new TextEncoder().encode(text);
  return [0xff, 0x03, ...encodeVlq(bytes.length), ...bytes];
}
interface Event { tick: number; rank: number; pitch: number; bytes: number[] }
function track(events: Event[], endTick: number): number[] {
  events.sort((a,b) => a.tick-b.tick || a.rank-b.rank || a.pitch-b.pitch);
  const bytes: number[] = [];
  let previous = 0;
  for (const event of events) {
    bytes.push(...encodeVlq(event.tick - previous), ...event.bytes);
    previous = event.tick;
  }
  bytes.push(...encodeVlq(endTick - previous), 0xff, 0x2f, 0);
  return chunk('MTrk', bytes);
}
export function encodeSmf(timeline: Timeline, trackId?: string): Uint8Array {
  // Select after channel assignment: stem chunks match their master chunks byte for byte.
  const selected = timeline.tracks.map((part, index) => ({ part, index }))
    .filter(({ part }) => trackId === undefined || part.id === trackId);
  if (trackId !== undefined && selected.length !== 1) throw new Error(`Unknown or ambiguous MIDI track: ${trackId}`);
  const meter = timeline.timeSignature;
  const conductor: Event[] = [
    { tick:0, rank:0, pitch:0, bytes:metaText(timeline.title) },
    { tick:0, rank:1, pitch:0, bytes:[0xff,0x58,4,meter.numerator,Math.log2(meter.denominator),96/meter.denominator,8] },
  ];
  if (timeline.key) conductor.push({ tick:0, rank:2, pitch:0, bytes:[0xff,0x59,2,timeline.key.sharpsFlats & 0xff,timeline.key.mode==='minor'?1:0] });
  conductor.push({ tick:0, rank:3, pitch:0, bytes:[0xff,0x51,3,...be(timeline.usPerQuarter,3)] });
  const chunks = [chunk('MThd',[0,1,...be(selected.length+1,2),...be(timeline.ppq,2)]),track(conductor,timeline.endTick)];
  selected.forEach(({ part, index: i }) => {
    const channel = i < 9 ? i : i+1;
    const events: Event[] = [
      { tick:0, rank:0, pitch:0, bytes:metaText(part.id) },
      { tick:0, rank:1, pitch:0, bytes:[0xc0|channel,part.instrument.program] },
    ];
    for (const note of part.notes) {
      events.push({ tick:note.tick, rank:3, pitch:note.pitch, bytes:[0x90|channel,note.pitch,Math.max(1,Math.min(127,Math.round(note.velocity*127)))] },
        { tick:note.tick+note.durationTicks, rank:2, pitch:note.pitch, bytes:[0x80|channel,note.pitch,0x40] });
    }
    chunks.push(track(events,timeline.endTick));
  });
  return Uint8Array.from(chunks.flat());
}
