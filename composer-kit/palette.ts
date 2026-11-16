/**
 * Sound palette: named patches on the existing Signature Rack instruments. Each patch is a journey, not a preset:
 * `[cold, hot]` pairs are where the sound sits at heat 0 and heat 1, so a section's heat (or a timbreMorph move)
 * moves the whole body of the sound, the way Chrome Stallion's bass goes warm -> machine.
 */
import type { Patch } from './core.ts';

export const PATCHES: Patch[] = [
  // ---------------------------------------------------------------- Living Bass
  { id: 'rubber-swagger', instrument: 'living-bass', character: 'rubbery',
    where: 'Round West-Coast pluck with finger slides. The default riff bass: verses, strut sections, anything that has to walk and grin.',
    macro: [0.05, 0.42], controls: { servo: 0.35, ratchet: 0, chassis: [0, 0.25] }, motion: ['eighths', 'eighths', 'sixteenths'],
    gainDb: -2, room: 0.04, humanize: { timingMs: 4, velocity: 0.06 } },
  { id: 'chrome-grinder', instrument: 'living-bass', character: 'dirty',
    where: 'Folded, geared, driven machine with chassis hits on accents. Payoffs and returns; too much for a first statement.',
    macro: [0.55, 0.95], motion: ['sixteenths', 'sixteenths', 'growl'], gainDb: -3, room: 0.04, humanize: { timingMs: 3, velocity: 0.05 } },
  { id: 'sub-whale', instrument: 'living-bass', character: 'rubbery',
    where: 'Almost pure sub that swells while held. Half-time floors and long notes under a break; write few, long notes.',
    macro: [0, 0.2], controls: { fold: [0.04, 0.12], pm: [0.2, 0.5], bright: [0.1, 0.22], hold: [0.7, 0.84], body: [0.25, 0.4], drive: [0.25, 0.5], chassis: 0 },
    motion: ['breath'], gainDb: -1, room: 0.02 },
  { id: 'ratchet-servo', instrument: 'living-bass', character: 'broken',
    where: 'Every slide climbs in semitone stairs and overshoots like a bad servo. Riffs with touching notes; great on the last bar of a phrase.',
    macro: [0.3, 0.6], controls: { ratchet: 1, servo: 1, chassis: [0.5, 1] }, motion: ['eighths', 'triplets'], slide: 0.14,
    gainDb: -3, room: 0.05, humanize: { timingMs: 3, velocity: 0.05 } },
  { id: 'gear-chopper', instrument: 'living-bass', character: 'mechanical',
    where: 'A held note chopped by a sub-octave gear, in triplets then revving. Gives a static bass line its own rhythm; floors and builds.',
    macro: [0.4, 0.75], controls: { gear: 0.7, grind: [0.35, 1], motion: 1, hold: [0.7, 0.84] }, motion: ['triplets', 'revving', 'thirty-seconds'],
    gainDb: -4, room: 0.04 },
  { id: 'tube-fuzz', instrument: 'living-bass', character: 'dirty',
    where: 'Saturated fuzz with no machine clank: all drive and fold. Lead-bass hooks an octave up, or a riff that should snarl without rattling.',
    macro: [0.3, 0.6], controls: { drive: 1, fold: [0.6, 1], pm: [1, 1.5], gear: 0, grind: [0, 0.3], chassis: 0, ratchet: 0, hold: [0.6, 0.8] },
    motion: ['none', 'eighths'], gainDb: -6, room: 0.06, humanize: { timingMs: 3, velocity: 0.05 } },
  { id: 'hollow-knock', instrument: 'living-bass', character: 'mechanical',
    where: 'More strike than tone: the gate snaps shut and the chassis knocks. Busy syncopated lines and ghost-note grooves where pitch should blur into drums.',
    macro: [0.2, 0.45], controls: { hold: [0.06, 0.2], bright: [0.4, 0.7], chassis: [0.7, 1], body: 0.45, fold: [0.25, 0.5] }, motion: ['none'],
    gainDb: 0, room: 0.08, humanize: { timingMs: 4, velocity: 0.08 } },

  // ---------------------------------------------------------------- Impossible Voice
  { id: 'warm-throat', instrument: 'impossible-voice', character: 'human',
    where: 'A plain human voice, close and unpolished. The one that sings the hook whole after a machine taught it; short, mostly stepwise lines.',
    macro: [0.02, 0.3], controls: { breath: [0.35, 0.25], vib: [0.8, 1.1], glass: [0.05, 0.2] }, params: { vowel: 'oh', to: 'ah' }, gainDb: -4, pan: -0.1, room: 0.18 },
  { id: 'wounded-cry', instrument: 'impossible-voice', character: 'human',
    where: 'Breathy voice that breaks upward at every onset. One- or two-note answers to a riff; never a whole melody.',
    macro: [0.08, 0.4], controls: { breath: [0.5, 0.35], vib: [1.2, 1.5], glass: [0.1, 0.3] }, setup: { vibRate: 5.8, vibCents: 38 },
    art: 'cry', params: { vowel: 'ah' }, gainDb: -5, pan: -0.2, room: 0.15 },
  { id: 'glass-choir', instrument: 'impossible-voice', character: 'glassy',
    where: 'Voice mostly heard through its ringing glass halo. Held notes in a break or over a floor; the "strange beauty" pad.',
    macro: [0.5, 0.85], controls: { glass: [0.7, 1], shimmer: [0.4, 0.9], breath: 0.2 }, setup: { haloDecay: 2.4, haloGain: 1.6, vowelTau: 0.4 },
    params: { vowel: 'oo', to: 'ah' }, gainDb: -7, pan: 0.15, room: 0.3 },
  { id: 'giant-undertone', instrument: 'impossible-voice', character: 'broken',
    where: 'A huge throat with a second series growling underneath. Low hums of menace under a floor drop; sing it low (G2–G3).',
    macro: [0.6, 0.9], controls: { under: [0.6, 1], breath: 0.12, tilt: [0.3, 0.55], split: [0.08, 0.25], vib: 0.5 }, setup: { size: -0.8 },
    params: { vowel: 'aw' }, gainDb: -5, room: 0.2 },
  { id: 'hollow-whistle', instrument: 'impossible-voice', character: 'glassy',
    where: 'Hollow reed-like voice with an overtone whistling above it. A lead that is not quite a person: take the hook off the bass with it.',
    macro: [0.45, 0.8], controls: { even: [0.15, 0], whistle: [0.7, 1], stretch: [0.008, 0.04], vib: 0.4, breath: 0.1 },
    params: { vowel: 'oo' }, gainDb: -5, pan: 0.1, room: 0.2 },
  { id: 'breath-ghost', instrument: 'impossible-voice', character: 'broken',
    where: 'Nearly all air, pitch barely there. Pickups, ghost doubles of the hook, the first thing heard in a quiet intro.',
    macro: [0.1, 0.35], controls: { breath: 1, tilt: [0.15, 0.3], vib: 0.2, disperse: [0.3, 0.8], whistle: 0 }, setup: { size: 0.5 },
    art: 'detached', params: { vowel: 'uh' }, gainDb: -2, pan: -0.1, room: 0.25 },

  // ---------------------------------------------------------------- Mechanical Orchestra
  { id: 'sitar-tine', instrument: 'mechanical-orchestra/tine', character: 'dirty',
    where: 'Steel tine buzzing against its bridge, tuned a little flat. Stab answers that cut through a bass riff; hook hand-offs.',
    macro: [0.5, 0.9], controls: { buzz: [0.65, 1], detune: -9 }, setup: { spread: 0.25 }, gainDb: -12, pan: 0.25, room: 0.18,
    humanize: { timingMs: 3, velocity: 0.08 } },
  { id: 'music-box', instrument: 'mechanical-orchestra/tine', character: 'glassy',
    where: 'Clean, slightly sharp tine: innocent. State a hook with it first so the dirty version later means something.',
    macro: [0, 0.15], controls: { buzz: 0, detune: 5 }, art: 'clean', gainDb: -11, pan: 0.2, room: 0.3, humanize: { timingMs: 2, velocity: 0.06 } },
  { id: 'alien-gong', instrument: 'mechanical-orchestra/bar', character: 'glassy',
    where: 'Detuned gong bar with beating twin modes and a long ring. One hit per phrase: the downbeat of a break, or a hook at half speed.',
    macro: [0.75, 1], controls: { hardness: [0.45, 0.9], damp: [1.1, 1.45], detune: [-12, -35] }, art: 'ring', gainDb: -10, room: 0.3 },
  { id: 'dead-marimba', instrument: 'mechanical-orchestra/bar', character: 'mechanical',
    where: 'Hard mallet on a damped bar: dry wooden tock that hockets left/right. Fast ostinatos, displaced cells, hooks that should feel typed.',
    macro: [0.05, 0.3], controls: { hardness: [0.85, 1.15], damp: [0.24, 0.4] }, setup: { spread: 0.5 }, gainDb: -7, room: 0.1,
    humanize: { timingMs: 2, velocity: 0.07 } },
  { id: 'laser-spring', instrument: 'mechanical-orchestra/spring', character: 'broken',
    where: 'Coil spring that chirps downward like a toy laser. Pickups into a section and single rude answers; a spice, not a part.',
    macro: [0.7, 1], controls: { bend: [0.14, 0.3], decay: [0.5, 1.4] }, art: 'twang', hotArt: 'laser', gainDb: -9, pan: -0.25, room: 0.2 },
  { id: 'rosin-drone', instrument: 'mechanical-orchestra/bow', character: 'dirty',
    where: 'Bowed bar pressed too hard: stick-slip chatter and a subharmonic below the note. Drones under breaks, a swell into the return.',
    macro: [0.6, 0.95], controls: { sub: [0.5, 1], chatter: [0.2, 0.55], attack: [0.7, 0.12] }, gainDb: -13, room: 0.25 },
  // ---------------------------------------------------------------- utility (rhythm and air)
  { id: 'clock-hat', instrument: 'mechanical-orchestra/clock', character: 'utility',
    where: 'Escapement tick/tock as the hi-hat; hot, the accents sprout tiny springs. The kit\'s default hat.',
    macro: [0.1, 0.8], controls: { zip: [0, 0.85] }, gainDb: -16, pan: -0.15, room: 0.1, humanize: { timingMs: 2.5, velocity: 0.12 } },
  { id: 'bearing-rain', instrument: 'mechanical-orchestra/bearings', character: 'utility',
    where: 'Seeded rain of tiny tuned pings on chord tones. Air above sparse sections; denser as heat rises.',
    macro: [0.2, 0.9], gainDb: -22, room: 0.35 },
  { id: 'kick', instrument: 'context/kick', character: 'utility', where: 'context kick', macro: 0, gainDb: -5, internal: true, humanize: { timingMs: 2, velocity: 0.05 } },
  { id: 'snare', instrument: 'context/snare', character: 'utility', where: 'context snare', macro: 0, gainDb: -8, room: 0.18, internal: true, humanize: { timingMs: 3, velocity: 0.06 } },
];
export function patch(id: string): Patch {
  const p = PATCHES.find(x => x.id === id);
  if (!p) throw new Error(`unknown patch "${id}" (have: ${PATCHES.filter(x => !x.internal).map(x => x.id).join(', ')})`);
  return p;
}
