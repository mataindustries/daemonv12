/**
 * Form templates: 16–18 bar shapes (about 40 s) with contrast built in. A template gives sections and default
 * moves; a spec may replace either. Tokens in `play`: bass, drums (kick+snare), kick, snare, hat, perc, and any
 * voice name, optionally with a variant — name:head (first half of its cell), :tail, :once (first loop only),
 * :last (final loop only), and bass:groove (the groove's own bass line instead of the bass cell).
 */
export interface SectionSpec { id: string; bars: number; play: string[]; heat?: number | Record<string, number>; groove?: string; fill?: boolean; note?: string }
export interface MoveSpec { move: string; section: string; [option: string]: unknown }
export interface Form { id: string; shape: string; when: string; make(hook: string, has: (voice: string) => boolean): { sections: SectionSpec[]; moves: MoveSpec[] } }

/** Keep tokens whose voice exists; a later token for the same voice wins. */
function play(has: (v: string) => boolean, ...tokens: string[]): string[] {
  const out = new Map<string, string>();
  for (const t of tokens) { const name = t.split(':')[0]!; if (['bass', 'drums', 'kick', 'snare', 'hat', 'perc'].includes(name) || has(name)) out.set(name, t); }
  return [...out.values()];
}

export const FORMS: Form[] = [
  { id: 'stallion', shape: 'strut 4 · statement 4 · floor 4 · return 4',
    when: 'A riff strong enough to carry alone. Cold statement, answered statement, the floor drops to half-time, the same riff returns as a hotter body and dives out.',
    make: (h, has) => ({
      sections: [
        { id: 'strut', bars: 4, heat: 0.1, play: play(has, 'bass', 'drums', 'hat', `${h}:head`, ...(h === 'bass' ? ['bass'] : [])), note: 'the groove and the riff, nothing else' },
        { id: 'statement', bars: 4, heat: 0.28, play: play(has, 'bass', 'drums', 'hat', 'perc', h, 'answer'), note: 'full hook, answers arrive, ending lifts' },
        { id: 'floor', bars: 4, heat: 0.5, play: play(has, 'bass', 'drums', 'hat', 'pad', 'texture', 'answer:last'), note: 'half-time floor, one exposed sound' },
        { id: 'return', bars: 4, heat: 0.6, play: play(has, 'bass', 'drums', 'hat', 'perc', h, 'answer', 'texture'), note: 'the riff returns in a hotter body and dives out' },
      ],
      moves: [{ move: 'liftEnding', section: 'statement' }, { move: 'floorDrop', section: 'floor' }, { move: 'riffReturn', section: 'return' }],
    }) },
  { id: 'machine-first', shape: 'signal 4 · body 6 · void 2 · collide 6',
    when: 'A hook owned by a machine (lead) with a human voice as `answer`. The ear learns the tune from machinery, recognises it when a person sings it, then hears both argue.',
    make: (h, has) => ({
      sections: [
        { id: 'signal', bars: 4, heat: { [h]: 0.15, hat: 0.5 }, play: play(has, h, 'texture', 'hat'), fill: false, note: 'the hook alone, cold machinery; no bass, no drums' },
        { id: 'body', bars: 6, heat: 0.22, play: play(has, 'bass', 'drums', 'hat', `${h}:head`, 'answer'), note: 'groove enters; a voice takes the hook whole' },
        { id: 'void', bars: 2, heat: 0.15, play: play(has, 'pad', 'texture'), fill: false, note: 'almost nothing; no hook' },
        { id: 'collide', bars: 6, heat: 0.85, play: play(has, 'bass', 'drums', 'hat', 'perc', h, 'answer', 'texture'), note: 'machine and voice split the hook; hot' },
      ],
      moves: [...(has('answer') ? [{ move: 'handOff', section: 'body', to: 'answer', keep: true }, { move: 'callAnswer', section: 'collide', answer: 'answer' }] : []), { move: 'diveOut', section: 'collide' }],
    }) },
  { id: 'slow-burn', shape: 'seep 4 · lock 4 · bloom 6 · ash 2',
    when: 'A hook that works as fragments. Strangest sound first, the groove locks under hook-heads while the bass warms, the full hook only blooms at bar 9, then one voice is left.',
    make: (h, has) => ({
      sections: [
        { id: 'seep', bars: 4, heat: 0.15, play: play(has, 'pad', 'texture', `${h}:head`), fill: false, note: 'air and the first half of the hook' },
        { id: 'lock', bars: 4, heat: 0.3, play: play(has, 'bass', 'drums', 'hat', `${h}:head`, ...(h === 'bass' ? ['bass:groove'] : [])), note: 'groove locks; bass warms up bar by bar' },
        { id: 'bloom', bars: 6, heat: 0.7, play: play(has, 'bass', 'drums', 'hat', 'perc', 'pad', h, 'answer'), note: 'the whole hook at last, answered' },
        { id: 'ash', bars: 2, heat: 0.1, play: play(has, `${h}:once`, 'pad'), fill: false, note: 'the owner alone, cold' },
      ],
      moves: [{ move: 'stagger', section: 'seep' }, { move: 'timbreMorph', section: 'lock', part: 'bass', from: 0.1, to: 0.5 }],
    }) },
  { id: 'two-rooms', shape: 'room-a 4 · room-b 4 · doorway 4 · both 4',
    when: 'Two grooves (`groove` and `grooveB`) and two sound worlds. A dry riff room, a wet strange room without the hook, the riff displaced in the doorway, then the hook over room B\'s drums.',
    make: (h, has) => ({
      sections: [
        { id: 'room-a', bars: 4, heat: 0.2, play: play(has, 'bass', 'drums', 'hat', h), note: 'room A: dry, the hook' },
        { id: 'room-b', bars: 4, heat: 0.6, groove: 'B', play: play(has, 'bass:groove', 'drums', 'pad', 'texture', 'answer'), note: 'room B: other groove, no hook' },
        { id: 'doorway', bars: 4, heat: 0.35, play: play(has, 'bass', 'drums', 'hat', h), note: 'room A again, the hook knocked off the beat' },
        { id: 'both', bars: 4, heat: 0.6, groove: 'B', play: play(has, 'bass', 'drums', 'hat', 'perc', 'pad', h, 'answer'), note: 'the hook over room B' },
      ],
      moves: [{ move: 'displace', section: 'doorway', by: 0.75 }, { move: 'riffReturn', section: 'both', heat: 0.85 }],
    }) },
  { id: 'tease', shape: 'bait 4 · switch 4 · hole 2 · give 6',
    when: 'A hook with a strong second half. Only its head is heard, then head-and-answer, then a stop-time bar and a hole, and the whole hook is finally given, hot.',
    make: (h, has) => ({
      sections: [
        { id: 'bait', bars: 4, heat: 0.2, play: play(has, 'bass', 'drums', 'hat', `${h}:head`), note: 'half a hook' },
        { id: 'switch', bars: 4, heat: 0.4, play: play(has, 'bass', 'drums', 'hat', 'perc', `${h}:head`, 'answer'), note: 'still half; the answer fills the gap' },
        { id: 'hole', bars: 2, heat: 0.3, play: play(has, 'bass', 'drums', 'pad'), fill: false, note: 'stop-time, then nothing' },
        { id: 'give', bars: 6, heat: 0.6, play: play(has, 'bass', 'drums', 'hat', 'perc', h, 'answer', 'texture'), note: 'the whole hook, finally' },
      ],
      moves: [{ move: 'stopTime', section: 'hole', bar: 0 }, { move: 'negativeSpace', section: 'hole', beats: 3, keep: has('pad') ? ['pad'] : [] }, { move: 'riffReturn', section: 'give', heat: 0.9 }],
    }) },
];
export function form(id: string): Form {
  const f = FORMS.find(x => x.id === id);
  if (!f) throw new Error(`unknown form "${id}" (have: ${FORMS.map(x => x.id).join(', ')})`);
  return f;
}
