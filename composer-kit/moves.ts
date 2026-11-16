/**
 * Form moves: section-level functions over a Draft (a score-in-progress). Each one is a compositional decision
 * with a reason to exist; `works` and `cheap` say when it earns its place and when it is a trick.
 * Spec usage: { "move": "floorDrop", "section": "floor", ...options }
 */
import { getInstrument } from '../studio-001/rack/registry.ts';
import { choke, cut, fit, hasPart, heatAt, isDrum, notesIn, part, plain, r3, RHYTHM, section, setHeat, tonicFrom, type Draft, type DPart, type N } from './core.ts';

type O = Record<string, unknown>;
export interface Move { id: string; does: string; works: string; cheap: string; options: string; apply(d: Draft, o: O): void }
const num = (v: unknown, d: number) => (typeof v === 'number' && Number.isFinite(v) ? v : d);
const str = (v: unknown, d: string) => (typeof v === 'string' ? v : d);
const list = (v: unknown, d: string[]) => (Array.isArray(v) ? v.map(String) : d);
const sec = (d: Draft, o: O) => section(d, str(o.section, ''));
const owner = (d: Draft) => part(d, d.hook.owner);
const rangeOf = (p: DPart) => (getInstrument(p.patch.instrument)?.range ?? [0, 127]) as [number, number];
const isBass = (p: DPart) => p.patch.instrument === 'living-bass';
const isVoice = (p: DPart) => p.patch.instrument === 'impossible-voice';
const kickPitch = (d: Draft) => tonicFrom(d, 28);
/** The hook cell tiled over [from, to). */
export function tileHook(d: Draft, from: number, to: number): N[] {
  const L = d.hook.bars * 4, out: N[] = [];
  for (let b = from, i = 0; b < to - 1e-6; b += L, i++) for (const n of i % 2 === 1 && d.hook.alt ? d.hook.alt : d.hook.notes) if (b + n[0] < to - 1e-6) out.push([r3(b + n[0]), n[1], n[2], n[3], n[4] ? { ...n[4] } : undefined]);
  return out;
}
/** A line re-voiced for another instrument: no ghosts, no foreign articulations, in range; sung legato for voices. */
function revoice(notes: N[], to: DPart, end: number): N[] {
  let line = plain(notes.filter(n => n[3] >= 0.55 && n[4]?.articulation !== 'ghost')).sort((a, b) => a[0] - b[0]);
  if (isVoice(to)) line = line.map((n, i) => [n[0], r3(Math.max(n[1], Math.min(2, (line[i + 1]?.[0] ?? end) - n[0]) - 0.05)), n[2], Math.min(0.75, n[3])] as N);
  return fit(line, rangeOf(to));
}
function clearTextures(p: DPart, from: number, to: number) {
  p.textures = p.textures.flatMap(t => t.toBeat <= from || t.fromBeat >= to ? [t] : [...(t.fromBeat < from ? [{ ...t, toBeat: from }] : []), ...(t.toBeat > to ? [{ ...t, fromBeat: to }] : [])]);
}

export const MOVES: Move[] = [
  { id: 'floorDrop', options: 'section, hat? (default true)',
    does: 'Drums fall to half-time (kick on one, snare on three), the bass shrinks to one long scooped note per bar with gear motion inside it, and the last bar keeps only its pickup.',
    works: 'After the hook has been stated twice at full speed: the body expects the next downbeat and gets twice the room instead. Put ONE new thing above it (a cry, a drone).',
    cheap: 'When nothing changes above the floor, or when it is the only idea in the track. A half-time section is not a breakdown unless something is exposed by it.',
    apply(d, o) {
      const s = sec(d, o), kp = kickPitch(d), hatT = tonicFrom(d, 84);
      for (const id of RHYTHM) if (hasPart(d, id)) cut(part(d, id), s.start, s.end);
      for (let b = s.start; b < s.end; b += 4) {
        if (hasPart(d, 'kick')) part(d, 'kick').notes.push([b, 0.5, kp, 1]);
        if (hasPart(d, 'snare')) part(d, 'snare').notes.push([b + 2, 0.5, 60, 0.95, { articulation: 'snare' }]);
        if (hasPart(d, 'hat') && o.hat !== false) part(d, 'hat').notes.push([b + 1, 0.1, hatT, 0.5, { articulation: 'tock' }], [b + 3, 0.1, hatT + 7, 0.4, { articulation: 'tick' }]);
      }
      if (!hasPart(d, 'bass')) return;
      const bass = part(d, 'bass'), tonic = tonicFrom(d, 28), old = notesIn(bass, s.start, s.end), bars = (s.end - s.start) / 4;
      const roots = Array.from({ length: bars }, (_, i) => old.find(n => n[0] >= s.start + i * 4 && n[0] < s.start + i * 4 + 4)?.[2] ?? tonic);
      if (bars >= 4 && roots.every(p => p === roots[0])) for (let i = 0; i < bars; i++) roots[i] = roots[i]! + [0, 0, -4, -2][i % 4]!;
      const pickup = old.filter(n => n[0] >= s.end - 1.5).map(n => [n[0], Math.min(n[1], 0.5), n[2], n[3], { articulation: 'staccato' }] as N);
      cut(bass, s.start, s.end);
      roots.forEach((p, i) => bass.notes.push([s.start + i * 4, 2.5, p, 0.95, { articulation: 'accent', scoop: 2 }]));
      bass.notes.push(...pickup);
      for (let i = 0; i < bars; i++) bass.motionBars[s.start / 4 + i] = i < bars / 2 ? 'triplets' : 'revving';
    } },
  { id: 'riffReturn', options: 'section, heat? (0.9), dive? (5 semitones), octave? (0)',
    does: 'The hook comes back whole on its owner, but the owner\'s body has changed: heat ramps to the top over the first half, first note re-struck harder, last note held and bent out.',
    works: 'After a section where the hook was absent, broken or on another instrument. The notes are the ones the listener already owns; only the body is new. That is why it hits harder instead of just louder.',
    cheap: 'If the riff returns at the same heat and register it is a repeat. If every other part also gets hotter it is a volume ramp. Change the owner, keep the room.',
    apply(d, o) {
      const s = sec(d, o), p = owner(d), heat = num(o.heat, 0.9), mid = (s.start + s.end) / 2;
      if (notesIn(p, s.start, s.end).length < d.hook.notes.length) { cut(p, s.start, s.end); p.notes.push(...tileHook(d, s.start, s.end)); }
      const mine = notesIn(p, s.start, s.end).sort((a, b) => a[0] - b[0]);
      for (const n of mine) { n[3] = Math.min(1, n[3] + 0.05); n[2] += 12 * num(o.octave, 0); }
      const first = mine[0], last = mine[mine.length - 1];
      if (first && isBass(p)) first[4] = { ...(first[4] ?? {}), articulation: 'accent', scoop: 2 };
      if (last) {
        last[1] = r3(Math.max(last[1], s.end - last[0] - 0.25));
        if (isBass(p) && num(o.dive, 5) > 0) last[4] = { ...(last[4] ?? {}), dive: num(o.dive, 5), diveBeats: r3(Math.min(1.5, last[1] / 2)) };
        if (isVoice(p)) last[4] = { ...(last[4] ?? {}), articulation: 'fall', fall: 1.5 };
      }
      setHeat(p, s.start, mid, Math.max(0, heat - 0.3), heat); setHeat(p, mid, s.end, heat);
      if (isBass(p)) p.motionBars[s.end / 4 - 1] = 'growl';
      if (hasPart(d, 'hat')) setHeat(part(d, 'hat'), s.start, s.end, Math.min(1, heat));
    } },
  { id: 'displace', options: 'section, part? (hook owner), by? (0.75 beats) | loop? (cycle length in beats, e.g. 3.5)',
    does: 'Shifts a part against the drums by a fraction of a beat (wrapping inside the section), or loops its first `loop` beats so the cell rolls across the barlines.',
    works: 'Once the listener knows the cell (two plain statements first). The drums stay put, so the ear hears the SAME thing land in the wrong place and leans in.',
    cheap: 'When the cell is not memorable yet, when the drums move too, or when it never resolves back onto the one.',
    apply(d, o) {
      const s = sec(d, o), p = part(d, str(o.part, d.hook.owner)), mine = notesIn(p, s.start, s.end), len = s.end - s.start;
      cut(p, s.start, s.end);
      if (typeof o.loop === 'number') {
        const L = o.loop, cell = mine.filter(n => n[0] - s.start < L - 1e-6);
        for (let b = s.start; b < s.end - 1e-6; b += L) for (const n of cell) if (b + n[0] - s.start < s.end - 1e-6) p.notes.push([r3(b + n[0] - s.start), Math.min(n[1], L), n[2], n[3], n[4]]);
      } else for (const n of mine) { let b = n[0] + num(o.by, 0.75); if (b >= s.end - 1e-6) b -= len; p.notes.push([r3(b), n[1], n[2], n[3], n[4]]); }
    } },
  { id: 'negativeSpace', options: 'section, beats? (2), at? ("end" | "start"), keep? ([part ids that keep playing])',
    does: 'Empties a window of the section: every part except `keep` stops and ringing notes are choked, so the hole is real.',
    works: 'Right before the return, or under one exposed sound (keep: one voice). Silence is the loudest contrast the rack has; the next downbeat borrows its weight.',
    cheap: 'As a reflex every four bars (it becomes a riser substitute), or when the thing after the hole is no bigger than the thing before it.',
    apply(d, o) {
      const s = sec(d, o), beats = num(o.beats, 2), keep = list(o.keep, []);
      const from = str(o.at, 'end') === 'start' ? s.start : s.end - beats, to = from + beats;
      for (const p of d.parts) if (!keep.includes(p.id)) { cut(p, from, to); choke(p, from); clearTextures(p, from, to); }
    } },
  { id: 'timbreMorph', options: 'section, part? (hook owner), from? (0.1), to? (0.9)',
    does: 'Ramps one part\'s heat across the section: the notes repeat while the patch travels cold -> hot (or back).',
    works: 'On a figure that repeats unchanged: repetition becomes development because the body is moving. One part at a time.',
    cheap: 'On everything at once (that is a filter sweep), or on a part whose notes are also changing (the ear cannot tell what moved).',
    apply(d, o) { const s = sec(d, o); setHeat(part(d, str(o.part, d.hook.owner)), s.start, s.end, num(o.from, 0.1), num(o.to, 0.9)); } },
  { id: 'handOff', options: 'section, to (part id), keep? (false: the owner goes quiet / a bass owner drops to a pedal)',
    does: 'The hook leaves its owner and is played by another part (ghosts dropped, re-registered, sung legato if it is a voice).',
    works: 'When the new instrument changes what the hook means: machine -> human, low -> high, pluck -> breath. The listener recognises it and hears it differently.',
    cheap: 'As an octave doubling with the owner still playing, or handed to a sound of the same family (tine -> marimba is a costume change, not a hand-off).',
    apply(d, o) {
      const s = sec(d, o), p = owner(d), to = part(d, str(o.to, ''));
      const whole = tileHook(d, s.start, s.end), mine = notesIn(p, s.start, s.end), src = mine.length >= whole.length ? mine : whole;
      cut(to, s.start, s.end); to.notes.push(...revoice(src, to, s.end));
      setHeat(to, s.start, s.end, Math.max(0.3, heatAt(to, s.start)));
      if (o.keep === true) return;
      cut(p, s.start, s.end);
      if (isBass(p)) for (let b = s.start; b < s.end; b += 4) p.notes.push([b, 3, tonicFrom(d, 28), 0.85, { articulation: 'accent' }]);
    } },
  { id: 'callAnswer', options: 'section, answer (part id)',
    does: 'Splits the hook: the owner plays the first half of each cell, the answer part finishes it in its own voice; the very last answer jumps up.',
    works: 'When the two sounds have opposite attacks (pluck vs sung, dry vs ringing) so the hook becomes a conversation. Leave the gap between them.',
    cheap: 'When the answer echoes the same notes every time, or both parts overlap so there is no question to answer.',
    apply(d, o) {
      const s = sec(d, o), p = owner(d), ans = part(d, str(o.answer, '')), L = d.hook.bars * 4;
      if (!notesIn(p, s.start, s.end).length) p.notes.push(...tileHook(d, s.start, s.end));
      const tail = notesIn(p, s.start, s.end).filter(n => (n[0] - s.start) % L >= L / 2 - 1e-6);
      p.notes = p.notes.filter(n => !tail.includes(n));
      cut(ans, s.start, s.end);
      const line = revoice(tail, ans, s.end), last = line[line.length - 1];
      if (last && last[2] + 12 <= rangeOf(ans)[1]) last[2] += 12;
      ans.notes.push(...line);
    } },
  { id: 'stopTime', options: 'section, bar? (-1 = last bar), hits? ([0, 1.5, 2.5] beats in the bar)',
    does: 'One bar where everything stops and the band hits a few unison stabs with silence between.',
    works: 'Once, as punctuation at the end of a statement or as the door into a floor drop. The hits should outline the hook\'s rhythm.',
    cheap: 'As the default fill, or more than once per track.',
    apply(d, o) {
      const s = sec(d, o), bars = (s.end - s.start) / 4, bar = num(o.bar, -1), b0 = s.start + 4 * (bar < 0 ? bars + bar : bar);
      const hits = (Array.isArray(o.hits) ? o.hits : [0, 1.5, 2.5]).map(Number), kp = kickPitch(d);
      for (const p of d.parts) { cut(p, b0, b0 + 4); choke(p, b0); clearTextures(p, b0, b0 + 4); }
      hits.forEach((h, i) => {
        if (hasPart(d, 'kick')) part(d, 'kick').notes.push([b0 + h, 0.25, kp, 1]);
        if (hasPart(d, 'snare') && i === hits.length - 1) part(d, 'snare').notes.push([b0 + h, 0.25, 60, 0.9, { articulation: 'clap' }]);
        if (hasPart(d, 'bass')) part(d, 'bass').notes.push([b0 + h, 0.3, tonicFrom(d, 28), 0.95, { articulation: 'staccato' }]);
        const p = owner(d), stab = d.hook.notes[0];
        if (!isBass(p) && !isDrum(p) && stab) p.notes.push([b0 + h, 0.3, stab[2], 0.8]);
      });
    } },
  { id: 'stagger', options: 'section, order? ([part ids, first enters first]), every? (1 bar)',
    does: 'Parts enter one after another (at most `every` bars apart, always all in by the last bar). Default order is strangest first: textures and leads, then bass, hat, snare, and the kick last.',
    works: 'For openings: the first sound heard defines the world, so lead with the one nobody expects and let the kick be the arrival.',
    cheap: 'In DAW order (kick, hat, bass, lead): everybody has heard that build. Also cheap if nothing interesting is alone at the start.',
    apply(d, o) {
      const s = sec(d, o), rank = (p: DPart) => (p.id === 'kick' ? 5 : p.id === 'snare' ? 4 : p.id === 'hat' || p.id === 'perc' ? 3 : p.id === 'bass' ? 2 : p.id === d.hook.owner ? 1 : 0);
      const playing = d.parts.filter(p => notesIn(p, s.start, s.end).length).sort((a, b) => rank(a) - rank(b)).map(p => p.id);
      const order = list(o.order, playing), bars = (s.end - s.start) / 4, step = Math.min(num(o.every, 1), (bars - 1) / Math.max(1, order.length - 1));
      order.forEach((id, i) => { const bar = Math.floor(i * step + 1e-6); if (bar > 0) cut(part(d, id), s.start, s.start + bar * 4); });
    } },
  { id: 'liftEnding', options: 'section, bars? (2), lift? ([5, 7] semitones: iv then V)',
    does: 'The last bars of the section climb: bass and hook are transposed up a fourth, then a fifth, so the phrase ends leaning forward.',
    works: 'Once, on the statement before a drop or a return: the harmony asks a question the next section answers (with the tonic, or with silence).',
    cheap: 'On every phrase ending (it turns into a chord loop), or before a section that does not resolve it.',
    apply(d, o) {
      const s = sec(d, o), bars = num(o.bars, 2), lift = (Array.isArray(o.lift) ? o.lift : [5, 7]).map(Number), from = s.end - bars * 4, half = bars * 2;
      for (const p of d.parts) if (!isDrum(p) && !RHYTHM.includes(p.id) && (p.id === 'bass' || p.id === d.hook.owner))
        for (const n of notesIn(p, from, s.end)) n[2] += n[0] < from + half ? lift[0]! : lift[1] ?? lift[0]!;
    } },
  { id: 'diveOut', options: 'section, part? (bass, else hook owner), semis? (5), beats? (1.5)',
    does: 'Ending gesture: the part\'s last note is held to the end of the section and bent down while everything else stops under it.',
    works: 'As the final sound of the track or the last thing before a hole. It is a signature only if the piece has earned an ending.',
    cheap: 'When it covers for a missing ending, or after a section that did not return the hook.',
    apply(d, o) {
      const s = sec(d, o), p = part(d, str(o.part, hasPart(d, 'bass') ? 'bass' : d.hook.owner)), beats = num(o.beats, 1.5);
      const mine = notesIn(p, s.start, s.end).sort((a, b) => a[0] - b[0]), last = mine[mine.length - 1];
      if (!last) return;
      const from = Math.min(last[0], s.end - beats);
      p.notes = p.notes.filter(n => n === last || !(n[0] > from && n[0] < s.end));
      last[1] = r3(s.end - last[0] - 0.1);
      if (isBass(p)) last[4] = { ...(last[4] ?? {}), dive: num(o.semis, 5), diveBeats: r3(Math.min(beats, last[1] * 0.75)) };
      if (isVoice(p)) last[4] = { ...(last[4] ?? {}), articulation: 'fall', fall: 2 };
      for (const q of d.parts) if (q !== p) { cut(q, from + 0.01, s.end); clearTextures(q, from, s.end); }
    } },
];
export function move(id: string): Move {
  const m = MOVES.find(x => x.id === id);
  if (!m) throw new Error(`unknown move "${id}" (have: ${MOVES.map(x => x.id).join(', ')})`);
  return m;
}
