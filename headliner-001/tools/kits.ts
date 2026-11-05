/** Kit factory: registers HEADLINER 001 sounds into a Song's kits with provenance recipes. */
import * as I from './instruments.ts';
import { Song, Kit } from './song.ts';
import { hitName } from './theory.ts';
import type { Wave } from './dsp.ts';

const memo = new Map<string, Wave[]>();
const once = (key: string, f: () => Wave[]) => () => { let w = memo.get(key); if (!w) { w = f(); memo.set(key, w); } return w; };

export class Palette {
  song: Song; kick: Kit; snare: Kit; hats: Kit; metal: Kit; bass: Kit; grit: Kit; keys: Kit; pad: Kit;
  pluck: Kit; pluckSpace: Kit; voice: Kit; voiceSpace: Kit; choir: Kit; atmos: Kit; fx: Kit; tag: string;
  constructor(song: Song, tag: string) {
    this.song = song; this.tag = tag;
    const k = (name: string, family: string, peakDb = -1) => song.kit(name, { peakDb, recipeFamily: family });
    this.kick = k('kick', 'drums'); this.snare = k('snare', 'drums'); this.hats = k('hats', 'drums', -3); this.metal = k('metal', 'drums', -3);
    this.bass = k('bass', 'bass'); this.grit = k('grit', 'bass', -2); this.keys = k('keys', 'harmony', -2); this.pad = k('pad', 'harmony', -2);
    this.pluck = k('pluck', 'machine', -2); this.pluckSpace = k('pluck-space', 'machine', -3); this.voice = k('voice', 'voice', -1);
    this.voiceSpace = k('voice-space', 'voice', -3); this.choir = k('choir', 'voice', -2); this.atmos = k('atmos', 'atmosphere', -4); this.fx = k('fx', 'fx', -1);
  }
  // ---- drums
  kickMain() { return this.kick.add('kick', () => I.kick(), 'Sine body with two-stage exponential pitch drop (300 Hz -> F1 43.65 Hz), beater click (high-passed seeded noise + 3.1/1.45 kHz blips), tanh drive, 2x oversampled.', 'F1'); }
  kickBoom() { return this.kick.add('kick-boom', () => I.kick({ len: 2.4, decay: 0.95, drive: 2.3, click: 0.8 }), 'Long tuned kick (F1) with 0.95 s body decay and heavier drive: the arrival boom.', 'F1'); }
  kickSoft() { return this.kick.add('kick-soft', () => I.kick({ decay: 0.18, click: 0.35, drive: 1.3, start: 190 }), 'Short, rounder kick for ghost kicks: gentler drop from 190 Hz, less click.', 'F1'); }
  snareMain() { return this.snare.add('snare', () => I.snare({ clap: 0.55 }), 'Two-mode tuned body (182/287 Hz with pitch bend), band-passed noise, snap burst, four-burst clap layer, FDN room 0.42 s.'); }
  snareVerb() { return this.snare.add('snare-verb', () => I.snare({ clap: 0.5, verb: 0.55 }), 'Main snare plus a 2.1 s damped FDN hall tail baked in: the cinematic accent.'); }
  clap() { return this.snare.add('clap', () => I.snare({ body: 0.2, noise: 0.35, clap: 1, room: 0.3, seed: 23 }), 'Clap-forward variant: four 1.35 kHz band-passed noise bursts and a short room.'); }
  ghost() { return this.snare.add('ghost', () => I.snare({ body: 0.5, noise: 0.6, clap: 0, room: 0.08, len: 0.25, decay: 0.045, seed: 25 }), 'Soft short snare for ghost notes.'); }
  rimShot() { return this.snare.add('rim', () => I.rim(), 'Rimshot click: 1.72 kHz / 870 Hz modes and a resonant noise tick.'); }
  hatClosed() { return this.hats.add('hat', () => I.hat(0.022, 0.12), 'Six-square metal cluster (generic analog-cymbal method), band-pass 9.4 kHz, 22 ms decay.'); }
  hatOpen() { return this.hats.add('hat-open', () => I.hat(0.24, 0.8, 0.95, 53), 'Same metal cluster, 240 ms decay: open hat.'); }
  shaker() { return this.hats.add('shaker', () => I.shaker(), 'Band-passed 6.8 kHz noise with a 6 ms swell: shaker.'); }
  hydraulic() { return this.hats.add('hydraulic', () => I.hydraulic(), 'Lowrider hydraulics: pneumatic band-pass hiss sweeping 7.3 -> 2.1 kHz plus a 98 -> 52 Hz piston thump.'); }
  tick() { return this.hats.add('tick', () => I.tick(), 'Machine tick: resonant 5.2 kHz noise and a 7.3 kHz blip, 5.5 ms.'); }
  anvil() { return this.metal.add('anvil', () => I.modal(I.midiHz(84), [1, 2.76, 5.4, 8.93], [0.5, 0.3, 0.15, 0.08], [1, 0.5, 0.3, 0.15], 1.2, 0.5), 'Modal bar strike tuned to C6 (free-free bar ratios 1, 2.76, 5.40, 8.93), stereo-split modes.', 'C6'); }
  pipe() { return this.metal.add('pipe', () => I.modal(I.midiHz(53), [1, 2.0, 3.01, 4.03, 5.1], [0.45, 0.32, 0.2, 0.12, 0.08], [1, 0.5, 0.35, 0.2, 0.12], 1.0, 0.6, 93, 0.6), 'Struck pipe tuned to F3: near-harmonic tube modes with a breathy strike.', 'F3'); }
  pipeAt(midi: number) { const h = `pipe-${hitName(midi)}`; return this.metal.add(h, () => I.modal(I.midiHz(midi), [1, 2.0, 3.01, 4.03, 5.1], [0.26, 0.18, 0.12, 0.08, 0.05], [1, 0.45, 0.3, 0.18, 0.1], 0.6, 0.6, 93 + midi, 0.6), `Struck pipe tuned to ${hitName(midi).toUpperCase()}, short (0.26 s body): follows the chord root so the 3-3-2 grid never drones.`, hitName(midi).toUpperCase()); }
  chain() { return this.metal.add('chain', () => I.chain(), 'Chain rattle: eleven small modal contacts at seeded intervals and pans.'); }
  tomLow() { return this.metal.add('tom-low', () => I.tom(I.midiHz(48)), 'Pitched tom C3: sine with 45% pitch drop and breath noise.', 'C3'); }
  tomHigh() { return this.metal.add('tom-high', () => I.tom(I.midiHz(53), 0.5, 113), 'Pitched tom F3.', 'F3'); }
  servo() { return this.metal.add('servo', () => I.servo(), 'Servo chirp: rising FM sweep 380 -> 1780 Hz with a panning motion.'); }
  // ---- bass
  bassNote(midi: number, len = 3.0) { const h = hitName(midi); return this.bass.add(h, () => I.bassWarm(midi, len), 'West Coast round bass: sine fundamental + saw through a 2x-oversampled ZDF ladder with a 70 ms filter envelope, tanh.', h.toUpperCase()); }
  gritNote(midi: number, pluck: boolean) { const h = `${hitName(midi)}-${pluck ? 'p' : 'h'}`; return this.grit.add(h, () => I.grit(midi, pluck), `Industrial grit bass (${pluck ? 'plucked' : 'held growl'}): detuned saws + sub-octave pulse, 4x-oversampled driven ladder, sine wavefolder, tube stage, high-passed at 95 Hz.`, hitName(midi).toUpperCase()); }
  // ---- harmony
  epChord(name: string, midis: number[], len = 3.6) { return this.keys.add(name, () => I.epChord(midis, len), `FM electric-piano chord (tine ratio 1 + 14x bark, stereo tremolo 4.6 Hz): MIDI ${midis.join(' ')}.`, name); }
  padChord(name: string, midis: number[], len = 6.2, bright = 1) { return this.pad.add(name, () => I.padChord(midis, len, 181, bright), `Night strings: six detuned saws per note, L/R split, breathing low-pass, baked 3.2 s FDN hall: MIDI ${midis.join(' ')}.`, name); }
  choirChord(name: string, midis: number[], vowel: I.Vowel = 'a', len = 7, hold?: number, fade = 0) { return this.choir.add(name, () => I.choirChord(midis, vowel, len, 191, 0.7, hold ?? len - 0.6, fade), `Synthetic choir: four formant voices per note (vowel ${vowel}), independent vibrato/detune, baked 3.6 s FDN hall${fade ? `, voices fade over ${fade} s and the hall decays inside the sample` : ''}: MIDI ${midis.join(' ')}.`, name); }
  // ---- machine (low-pass gate pluck), dry and wet
  pluckNote(midi: number, bright = 1) {
    const h = `${hitName(midi)}${bright !== 1 ? '-b' : ''}`, render = once(`pluck-${h}-${this.tag}`, () => I.lpgPluck(midi, 1.7, 2, 141, bright));
    this.pluckSpace.add(h, () => I.spaceFor(render()[0]!, this.song.beatSec, { rt60: 2.2, verb: 0.55, delay: 0.6, fb: 0.42 }), 'Wet-only space for the pluck: damped 8-line FDN hall + dotted-eighth ping-pong.', hitName(midi).toUpperCase());
    return this.pluck.add(h, render, 'Low-pass-gate pluck: 2:1 FM complex oscillator, sine wavefolder, vactrol-style gate whose decay lengthens as it dims, 2x oversampled.', hitName(midi).toUpperCase());
  }
  // ---- voice phrases, dry and wet
  voicePhrase(name: string, notes: I.VNote[], opts: Partial<I.VoiceOpts> = {}) {
    const render = once(`voice-${name}-${this.tag}`, () => [I.voicePhrase(notes, { tickSec: this.song.tickSec, ...opts })]);
    this.voiceSpace.add(name, () => I.spaceFor(render()[0]!, this.song.beatSec, { rt60: 2.8, verb: 0.75, delay: 0.42, fb: 0.36 }), 'Wet-only space for the voice phrase: FDN hall (2.8 s) + dotted-eighth ping-pong.');
    return this.voice.add(name, render, `Synthetic talkbox phrase (${notes.length} notes): saw+pulse source, five-formant vowel bank, portamento, delayed vibrato, breath; one continuous legato take.`);
  }
  ensemble(name: string, notes: I.VNote[], opts: Partial<I.VoiceOpts> = {}, voices = 4, octave = -12) {
    return this.choir.add(name, () => I.ensemblePhrase(notes, { tickSec: this.song.tickSec, ...opts }, voices, octave), `Ensemble phrase: ${voices} formant voices sing the hook ${octave ? `${octave > 0 ? '+' : ''}${octave} semitones` : 'in unison'}, independent vibrato/detune/timing, stereo spread, baked 3 s FDN hall.`);
  }
  // ---- atmosphere and fx
  rain(len = 24, name = 'rain', seed = 201) { return this.atmos.add(name, () => I.rain(len, seed), `Night rain (seed ${seed}): seeded droplet resonances, pink hiss bed, brown-noise freeway rumble, two passing-car sweeps.`); }
  lamp() { return this.atmos.add('lamp', () => I.lamp(12), 'Sodium lamp: flickering odd-heavy buzz tuned to F2 with a band-passed edge.', 'F2'); }
  siren(name: string, contour: [number, number][], len = 9) { return this.atmos.add(name, () => I.siren(contour, len), 'Distant siren tracing the hook\'s slide contour, low-passed 1.8 kHz, drowned in a 4.8 s FDN hall.'); }
  impact() { return this.fx.add('impact', () => I.impact(), 'Impact: 83 -> 31 Hz sub drop, low-passed noise burst, F5-tuned modal ring, 3.8 s FDN hall.'); }
  swell(name: string, midis: number[], len: number) { return this.fx.add(name, () => I.reverseSwell(I.choirChord(midis, 'a', 2.5, 197, 0.05), len), 'Reverse swell: a short choir chord drowned in a long FDN hall, reversed to breathe into a downbeat.'); }
  glitch() { return this.fx.add('glitch', () => I.glitch(), 'Signal-loss glitch: sample-held, bit-reduced F3/F4 buzz with stutter gating.'); }
}
