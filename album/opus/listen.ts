/**
 * Builds the Android listening page for track 4 of the album (one self-contained HTML file, audio embedded):
 *   node album/opus/listen.ts OUT.html
 * The Long Work with its section map drawn to scale (width is seconds, colour is heat), the hook drawn on its 4-bar
 * cell, the calls made where the brief was vague, and what a phone speaker keeps. Lock-screen controls through the
 * Media Session API, one-bar skips, 48 px touch targets. Uses the album pages' type and tokens (album/listen.ts),
 * with the track's gold as the accent.
 */
import { readFileSync, writeFileSync } from 'node:fs';
import { PATCHES } from '../../composer-kit/palette.ts';

const HERE = new URL('.', import.meta.url).pathname, out = process.argv[2];
if (!out) { console.error('usage: node album/opus/listen.ts OUT.html'); process.exit(2); }
const esc = (s: string) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

type Opts = Record<string, string | number>;
type Note = [number, number, string, number?, Opts?];
interface Voice { patch?: string; cell?: { bars: number; notes: Note[]; alt?: Note[] } }
interface Section { id: string; bars: number; heat: number | Record<string, number> }
interface Spec { title: string; world: string; key: string; groove: string; bpm: number; hook: string; voices: Record<string, Voice>; sections: Section[]; moves: { move: string; section: string; from?: number; to?: number }[] }
interface Score { bpm: number; tailSeconds: number; sections: { id: string; bars: number; development: string }[] }
const spec = JSON.parse(readFileSync(`${HERE}the-long-work.spec.json`, 'utf8')) as Spec;
const score = JSON.parse(readFileSync(`${HERE}render/score.json`, 'utf8')) as Score;
const audio = readFileSync(`${HERE}render/the-long-work.mp3`).toString('base64');

// ---------------------------------------------------------------- time: sections in seconds, heat per section
const bar = 240 / score.bpm, beat = 60 / score.bpm;
const heatOf = (s: Section): [number, number] => {
  const morph = spec.moves.find(m => m.move === 'timbreMorph' && m.section === s.id);
  if (morph) return [morph.from ?? 0.1, morph.to ?? 0.9];
  const h = typeof s.heat === 'number' ? s.heat : s.heat[spec.hook] ?? 0.3;
  return [h, h];
};
let at = 0;
const sections = score.sections.map((x, i) => {
  const from = at; at += x.bars * bar;
  const [a, b] = heatOf(spec.sections[i]!);
  return { id: x.id, bars: x.bars, from, to: at, note: x.development, a, b, firstBar: Math.round(from / bar) + 1 };
});
const music = at, total = music + score.tailSeconds;
const mmss = (t: number) => `${Math.floor(t / 60)}:${String(Math.floor(t % 60)).padStart(2, '0')}`;
const mix = (h: number) => `color-mix(in oklab, var(--gold) ${Math.round(h * 100)}%, var(--stone))`;
const fill = (a: number, b: number) => (a === b ? mix(a) : `linear-gradient(90deg, ${mix(a)}, ${mix(b)})`);

// ---------------------------------------------------------------- the hook drawn on its cell
const PC: Record<string, number> = { C: 0, D: 2, E: 4, F: 5, G: 7, A: 9, B: 11 };
const midiOf = (p: string) => { const m = /^([A-G])(b|#)?(-?\d)$/.exec(p); if (!m) throw new Error(`pitch ${p}`); return 12 * (Number(m[3]) + 1) + PC[m[1]!]! + (m[2] === 'b' ? -1 : m[2] === '#' ? 1 : 0); };
const NAMES = ['C', 'D♭', 'D', 'E♭', 'E', 'F', 'G♭', 'G', 'A♭', 'A', 'B♭', 'B'];
const nameOf = (m: number) => `${NAMES[m % 12]}${Math.floor(m / 12) - 1}`;
const lead = spec.voices.lead!.cell!, answer = spec.voices.answer!.cell!, beats = lead.bars * 4;
const W = 420, L = 44, R = 10, TOP = 30, STEP = 6.5, HI = 61, LO = 38;
const x = (b: number) => +(L + (b / beats) * (W - L - R)).toFixed(1), y = (m: number) => +(TOP + (HI - m) * STEP).toFixed(1), H = Math.ceil(y(LO) + 12);
const strikes = lead.notes.map(n => ({ b: n[0], d: n[1], m: midiOf(n[2]), muted: n[4]?.articulation === 'muted' }));
const rests: [number, number][] = [];
strikes.forEach((s, i) => { const nx = strikes[i + 1]?.b ?? beats; if (nx - s.b > 2 + 1e-6 && !s.muted) rests.push([s.b + 2, nx]); });
const throat = answer.notes.map(n => { const m = midiOf(n[2]), o = n[4] ?? {}; return { b: n[0], d: n[1], m, fall: o.articulation === 'fall' ? Number(o.fall ?? 0) : 0, scoop: Number(o.scoop ?? 0), vowel: `${o.vowel ?? ''}${o.to ? `→${o.to}` : ''}` }; });
const used = [...new Set([...strikes.map(s => s.m), ...throat.map(t => t.m)])].sort((a, b) => b - a);
const hookSvg = `<svg class="cell" viewBox="0 0 ${W} ${H}" role="img" aria-labelledby="cell-t">
  <title id="cell-t">The hook's 4-bar cell: gong strikes ${strikes.map(s => nameOf(s.m)).join(' ')}, one every two beats, with a silent bar; the throat sings ${throat.map(t => nameOf(t.m)).join(' then ')}.</title>
  <defs><linearGradient id="ring" x1="0" x2="1" y1="0" y2="0"><stop offset="0" style="stop-color: var(--gold); stop-opacity: 0.75"/><stop offset="1" style="stop-color: var(--gold); stop-opacity: 0"/></linearGradient></defs>
  ${rests.map(([a, b]) => `<rect x="${x(a)}" y="${TOP - 10}" width="${x(b) - x(a)}" height="${H - TOP + 4}" class="rest"/><text x="${(x(a) + x(b)) / 2}" y="${H - 4}" class="lbl mid">silent bar</text>`).join('')}
  ${Array.from({ length: lead.bars + 1 }, (_, i) => `<line x1="${x(i * 4)}" x2="${x(i * 4)}" y1="${TOP - 12}" y2="${y(LO) + 2}" class="barline"/>`).join('')}
  ${Array.from({ length: lead.bars }, (_, i) => `<text x="${(x(i * 4) + x(i * 4 + 4)) / 2}" y="${TOP - 16}" class="lbl mid">bar ${i + 1}</text>`).join('')}
  ${used.map(m => `<line x1="${L}" x2="${W - R}" y1="${y(m)}" y2="${y(m)}" class="staff"/><text x="${L - 6}" y="${y(m) + 4}" class="lbl end">${nameOf(m)}</text>`).join('')}
  ${throat.map(t => { const x0 = x(t.b), x1 = x(t.b + t.d), y0 = y(t.m), bend = x(Math.min(0.6, t.d / 4)) - x(0);
    const start = t.scoop ? `M${x0} ${y(t.m - t.scoop)} Q${x0 + bend * 0.35} ${y0} ${x0 + bend} ${y0}` : `M${x0} ${y0}`;
    const end = t.fall ? ` L${x1 - bend} ${y0} Q${x1 - bend * 0.35} ${y0} ${x1} ${y(t.m - t.fall)}` : ` L${x1} ${y0}`;
    return `<path d="${start}${end}" class="throat"/>`; }).join('')}
  ${strikes.map((s, i) => { const nx = strikes[i + 1]?.b ?? beats, ring = Math.max(0, Math.min(s.d, nx - s.b));
    return s.muted ? `<rect x="${x(s.b) - 5}" y="${y(s.m) - 5}" width="10" height="10" class="knock"/>`
      : `<rect x="${x(s.b)}" y="${y(s.m) - 1.5}" width="${(x(s.b + ring) - x(s.b)).toFixed(1)}" height="3" fill="url(#ring)"/><circle cx="${x(s.b)}" cy="${y(s.m)}" r="6" class="strike"/>`; }).join('')}
</svg>`;

// ---------------------------------------------------------------- copy
const where = [
  { at: sections[0]!.from, label: `${sections[0]!.id}: the ask alone` },
  { at: sections[2]!.from, label: `${sections[2]!.id}: the whole tune, once` },
  { at: sections[3]!.from, label: `${sections[3]!.id}: the throat alone` },
];
const calls: [string, string][] = [
  ['Where the silent bar goes.', 'The brief puts a bar of rest inside the answer without saying where. It sits right after the ask, so the fourth hangs for a whole bar and the throat answers in that silence. Only then does the gong fall home, with a dead knock on A♭3 and then F3.'],
  ['Tonic versus the album thread.', 'The brief wants the answer to fall back to F3, but the album keeps the landing for track 6. The F3 is struck softly over a C pedal, so it sounds unresolved, and two beats later it is struck again as the next ask begins. The gong\'s last note in the track is B♭3, the question.'],
  ['Stagger order.', 'With the default order, stagger brings the gong in a bar late and cuts F3 and A♭3 from the first ask. So the order is written out: the gong and the grit first, then the bow at bar 3 under the hanging fourth.'],
  ['The bow\'s notes.', 'The brief gives none. The default drone would sit on F3 and C4, the hook\'s own notes, so the bow plays one C3 every two bars instead. That keeps it out of the gong\'s register, and a pedal on the fifth never lets anything settle.'],
  ['How the throat moves.', 'It sings the two long notes as written (A♭2, then C3, oo opening to aw). On top of that, the A♭2 falls a fourth at its end, the C3 scoops up a fifth, and the last ask in bloom gets a hummed "mm" pass, so the mouth opens again only when the throat is alone.'],
  ['The clock.', 'The bloom section plays the hat as written, and the kit\'s hat is a clock escapement. It stays cold (heat 0.2) and 3 dB down, so it only ticks the time and never sprouts springs in the one section the brief says hands carry.'],
  ['Gains.', 'The gong is up 3 dB because most of its energy is below 300 Hz, where a phone speaker plays almost nothing. The throat is down 2 dB so it stays under the gong.'],
];
const critique: [string, string, string][] = [
  ['1 · World', 'A hot clock sprouting springs in the hands-only bloom.', 'Clock kept, but cold and quiet, and named in the world sentence.'],
  ['11 · Ending', 'The throat repeated its last two bars, then everything stopped.', 'The throat hums under the last ask, then opens alone and sinks a fourth, away from the tonic.'],
  ['14 · Voice', 'Four identical long notes, one vowel move, A♭2 held across four bars.', 'A fall, a scoop, a hum and a shorter first note, so the vowel or the pitch moves every two bars.'],
];
const phone: [string, string][] = [['throat', '−29.7'], ['gong (the hook)', '−31.5'], ['skin', '−34.4'], ['log', '−35.1'], ['sub-whale bass', '−46.0'], ['bow', '−47.8']];
const ROLE: Record<string, string> = {
  lead: 'Owns the hook at half speed: F3 A♭3 C4 B♭3, one strike every two beats.',
  answer: 'Answers in the gong\'s silent bar; hums under the last ask; alone at the end, it sinks.',
  pad: 'One C3 every two bars: stick-slip chatter and a sub, a pedal on the fifth.',
  texture: 'Grit falling in the opening, high and sparse.',
  bass: 'The groove\'s own line, F1 and up: felt on headphones, gone on a phone.',
  perc: 'Palm booms on 3+3+2, a slap on three, finger taps; tight in lock, cavernous by bloom.',
  perc2: 'A wooden tongue knocking a three-sixteenth wheel across the hands.',
  hat: 'The one machine in the hall: a cold clock tick under bloom.',
};
const cast = [['lead', spec.voices.lead!.patch!], ['answer', spec.voices.answer!.patch!], ['pad', spec.voices.pad!.patch!], ['texture', spec.voices.texture!.patch!],
  ['bass', 'sub-whale'], ['perc', 'talking-skin'], ['perc2', 'log-tongue'], ['hat', 'clock-hat']].map(([role, id]) => ({ role: role!, id: id!, character: PATCHES.find(p => p.id === id)!.character }));

const html = `<title>The Long Work</title>
<meta name="claude:viewport-fit-sides" content="cover">
<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Bricolage+Grotesque:opsz,wght@12..96,500;12..96,700&family=IBM+Plex+Mono:wght@400;500&family=IBM+Plex+Sans:wght@400;500;600&display=swap">
<style>
/* layout: one phone-width column. The track is a slab with its section map to scale (width = seconds, gold = heat) under a playhead,
   then the hook on its 16-beat cell, the calls, the critique, the phone numbers and the cast; a fixed transport rides above the gesture bar while it plays */
:root {
  --bg: #e9ede8; --panel: #f7f9f5; --ink: #18221d; --muted: #5a675f; --line: #cdd5cd;
  --gold: #8f6410; --on-gold: #ffffff; --stone: #c3cbc4; --rest: #dde4dd;
  --dirty: #a8481f; --rubbery: #6b3fc4; --mechanical: #3f6278; --glassy: #0f7f96; --broken: #b62a62; --human: #8f6410; --utility: #5d6b63;
  --display: "Bricolage Grotesque", "Space Grotesk", system-ui, sans-serif; --text: "IBM Plex Sans", system-ui, sans-serif; --mono: "IBM Plex Mono", ui-monospace, monospace;
}
@media (prefers-color-scheme: dark) { :root:not([data-theme="light"]) {
  --bg: #101613; --panel: #19221e; --ink: #e4ebe6; --muted: #98a69d; --line: #2c3833;
  --gold: #e3b85a; --on-gold: #101613; --stone: #34413b; --rest: #1f2925;
  --dirty: #f0906a; --rubbery: #b79bff; --mechanical: #8fb4cc; --glassy: #63cfe4; --broken: #ff86b4; --human: #e3b85a; --utility: #9aa8a0; color-scheme: dark } }
:root[data-theme="dark"] {
  --bg: #101613; --panel: #19221e; --ink: #e4ebe6; --muted: #98a69d; --line: #2c3833;
  --gold: #e3b85a; --on-gold: #101613; --stone: #34413b; --rest: #1f2925;
  --dirty: #f0906a; --rubbery: #b79bff; --mechanical: #8fb4cc; --glassy: #63cfe4; --broken: #ff86b4; --human: #e3b85a; --utility: #9aa8a0; color-scheme: dark }
body { background: var(--bg); color: var(--ink); font: 400 16px/1.55 var(--text); -webkit-tap-highlight-color: transparent; }
.wrap { max-width: 42rem; margin: 0 auto; padding-block: 1.5rem 8rem; padding-left: max(16px, env(safe-area-inset-left, 0px)); padding-right: max(16px, env(safe-area-inset-right, 0px)); display: flex; flex-direction: column; gap: 2.5rem; }
h1 { font: 700 clamp(2.4rem, 12vw, 3.6rem)/0.95 var(--display); letter-spacing: -0.025em; margin: 0; text-wrap: balance; }
h2 { font: 700 1.45rem/1.15 var(--display); margin: 0; text-wrap: balance; }
.eyebrow { font: 500 0.72rem/1.3 var(--mono); letter-spacing: 0.12em; text-transform: uppercase; color: var(--muted); margin: 0; }
p { margin: 0; max-width: 62ch; }
header, section { display: flex; flex-direction: column; gap: 0.9rem; }
.world { font-size: 1.02rem; }
.facts { font: 400 0.78rem/1.55 var(--mono); color: var(--muted); font-variant-numeric: tabular-nums; }
.slab { background: var(--panel); border: 1px solid var(--line); border-radius: 16px; padding: 1rem; display: flex; flex-direction: column; gap: 0.85rem; }
.top { display: flex; align-items: center; gap: 0.9rem; }
button { font: inherit; color: inherit; touch-action: manipulation; }
.play { flex: none; width: 4rem; height: 4rem; border-radius: 50%; border: 0; background: var(--gold); display: grid; place-items: center; cursor: pointer; padding: 0; }
.ico { width: 0; height: 0; border-style: solid; border-width: 0.7rem 0 0.7rem 1.15rem; border-color: transparent transparent transparent var(--on-gold); margin-left: 0.3rem; }
.on .ico { width: 1.05rem; height: 1.15rem; border: 0; margin: 0; background: linear-gradient(90deg, var(--on-gold) 0 34%, transparent 34% 66%, var(--on-gold) 66%); }
.readout { min-width: 0; flex: 1; display: flex; flex-direction: column; gap: 0.2rem; }
.readout b { font: 700 1.3rem/1.1 var(--display); }
.clock { font: 500 0.95rem/1.2 var(--mono); font-variant-numeric: tabular-nums; }
.clock span { color: var(--muted); }
.seek { width: 100%; height: 3rem; margin: 0; accent-color: var(--gold); }
.map { position: relative; display: flex; gap: 2px; }
.sec { flex: 0 0 auto; min-width: 0; height: 3rem; border: 0; border-radius: 3px; padding: 0; cursor: pointer; opacity: 0.6; }
.sec.cur { opacity: 1; outline: 2px solid var(--ink); outline-offset: 1px; }
.sec.tail { background: var(--rest); cursor: default; }
.head { position: absolute; top: -4px; bottom: -4px; width: 2px; background: var(--ink); left: 0; pointer-events: none; }
.names { display: flex; gap: 2px; }
.names span { flex: 0 0 auto; min-width: 0; overflow: hidden; font: 500 0.7rem/1.35 var(--mono); color: var(--muted); white-space: nowrap; }
.names b { display: block; color: var(--ink); font-weight: 500; }
.now { font-size: 0.95rem; min-height: 3em; }
.now b { font: 500 0.82rem/1 var(--mono); color: var(--gold); margin-right: 0.45rem; }
.row { display: flex; flex-wrap: wrap; gap: 0.5rem; }
.chip { min-height: 3rem; border: 1px solid var(--line); border-radius: 999px; background: transparent; padding: 0 1rem; cursor: pointer; font: 500 0.82rem/1 var(--mono); font-variant-numeric: tabular-nums; }
.chip span { color: var(--muted); margin-left: 0.4rem; }
.cell { width: 100%; max-width: 36rem; height: auto; display: block; overflow: visible; }
.cell .lbl { font: 400 11px var(--mono); fill: var(--muted); }
.cell .mid { text-anchor: middle; } .cell .end { text-anchor: end; }
.cell .rest { fill: var(--rest); }
.cell .barline { stroke: var(--line); stroke-width: 1; }
.cell .staff { stroke: var(--line); stroke-width: 0.6; stroke-dasharray: 2 3; }
.cell .strike { fill: var(--gold); }
.cell .knock { fill: none; stroke: var(--gold); stroke-width: 2; }
.cell .throat { fill: none; stroke: var(--ink); stroke-width: 5; stroke-linecap: round; opacity: 0.78; }
.legend { display: flex; flex-wrap: wrap; gap: 0.35rem 1.1rem; font: 400 0.76rem/1.4 var(--mono); color: var(--muted); }
.legend i { display: inline-block; vertical-align: -1px; margin-right: 0.4rem; }
.k-strike { width: 0.7rem; height: 0.7rem; border-radius: 50%; background: var(--gold); }
.k-knock { width: 0.6rem; height: 0.6rem; border: 2px solid var(--gold); }
.k-throat { width: 1.1rem; height: 0.32rem; border-radius: 2px; background: var(--ink); opacity: 0.78; }
.k-rest { width: 0.8rem; height: 0.8rem; background: var(--rest); border: 1px solid var(--line); }
ol, ul { margin: 0; padding: 0; list-style: none; display: flex; flex-direction: column; }
.calls li { padding: 0.8rem 0; border-top: 1px solid var(--line); }
.calls li:last-child { border-bottom: 1px solid var(--line); }
.calls b { font-weight: 600; }
.crit { display: grid; gap: 0.6rem; }
.crit li { display: grid; grid-template-columns: 6.2rem minmax(0, 1fr); gap: 0.15rem 0.8rem; padding: 0.75rem 0; border-top: 1px solid var(--line); }
.crit .n { font: 500 0.78rem/1.5 var(--mono); color: var(--gold); grid-row: span 2; }
.crit .was { color: var(--muted); font-size: 0.92rem; }
.crit .now2 { font-size: 0.95rem; }
table { border-collapse: collapse; width: 100%; max-width: 26rem; font: 400 0.85rem/1.4 var(--mono); font-variant-numeric: tabular-nums; }
td { padding: 0.45rem 0; border-top: 1px solid var(--line); }
td:last-child { text-align: right; }
tr.hook td { color: var(--gold); font-weight: 500; }
.cast li { display: grid; grid-template-columns: 4.6rem minmax(0, 1fr); gap: 0.1rem 0.8rem; padding: 0.7rem 0; border-top: 1px solid var(--line); }
.cast .role { font: 500 0.78rem/1.6 var(--mono); color: var(--muted); grid-row: span 2; }
.cast .id { font: 500 0.92rem/1.3 var(--mono); }
.cast .id em { font-style: normal; font-size: 0.68rem; letter-spacing: 0.06em; text-transform: uppercase; margin-left: 0.5rem; }
.cast p { font-size: 0.9rem; color: var(--muted); }
.t-dirty { color: var(--dirty) } .t-rubbery { color: var(--rubbery) } .t-mechanical { color: var(--mechanical) } .t-glassy { color: var(--glassy) } .t-broken { color: var(--broken) } .t-human { color: var(--human) } .t-utility { color: var(--utility) }
footer { font: 400 0.76rem/1.6 var(--mono); color: var(--muted); overflow-wrap: anywhere; }
.dock { position: fixed; left: 0; right: 0; bottom: 0; background: var(--ink); color: var(--bg); display: flex; align-items: center; gap: 0.75rem; padding-block: 0.6rem calc(0.6rem + env(safe-area-inset-bottom, 0px)); padding-left: max(16px, env(safe-area-inset-left, 0px)); padding-right: max(16px, env(safe-area-inset-right, 0px)); }
.dock span { min-width: 0; flex: 1; font: 500 0.85rem/1.25 var(--mono); font-variant-numeric: tabular-nums; overflow-wrap: anywhere; }
.dock button { flex: none; min-width: 3rem; min-height: 3rem; border: 0; border-radius: 999px; background: var(--bg); color: var(--ink); font: 600 0.85rem/1 var(--text); padding: 0 1rem; cursor: pointer; }
.play:focus-visible, .sec:focus-visible, .chip:focus-visible, .seek:focus-visible, .dock button:focus-visible { outline: 2px solid var(--gold); outline-offset: 3px; }
</style>
<div class="wrap">
  <header>
    <p class="eyebrow">Weights &amp; Measures · track 4 of 6 · Opus</p>
    <h1>${esc(spec.title)}</h1>
    <p class="world">${esc(spec.world)}</p>
    <p class="facts">${esc(spec.key)} · ${score.bpm} BPM, held back from the groove's own 88 · ${sections.reduce((a, s) => a + s.bars, 0)} bars = ${music.toFixed(1)} s, then ${score.tailSeconds} s of ring · unofficial fan work, not affiliated with Anthropic</p>
  </header>

  <section aria-label="Player">
    <div class="slab" id="slab">
      <div class="top">
        <button class="play" id="play" aria-label="Play ${esc(spec.title)}"><span class="ico"></span></button>
        <div class="readout"><b>${esc(spec.title)}</b><span class="clock" id="clock">0:00 <span>/ ${mmss(total)} · bar 1 · beat 1</span></span></div>
      </div>
      <input class="seek" id="seek" type="range" min="0" max="1000" value="0" aria-label="Position in the track">
      <div class="map" id="map">${sections.map((s, i) => `<button class="sec" data-i="${i}" style="width:calc(${(100 * (s.to - s.from) / total).toFixed(3)}% - 2px); background:${fill(s.a, s.b)}" aria-label="Jump to ${s.id}, bar ${s.firstBar}, ${mmss(s.from)}"></button>`).join('')}<span class="sec tail" style="width:calc(${(100 * score.tailSeconds / total).toFixed(3)}% - 2px)" aria-hidden="true"></span><i class="head" id="head"></i></div>
      <div class="names" aria-hidden="true">${sections.map(s => `<span style="width:calc(${(100 * (s.to - s.from) / total).toFixed(3)}% - 2px)"><b>${s.id}</b>${s.bars} bars</span>`).join('')}</div>
      <p class="now" id="now" aria-live="polite"><b>${sections[0]!.id}</b>${esc(sections[0]!.note)}</p>
      <div class="row"><button class="chip" id="back" aria-label="Back one bar">−1 bar</button><button class="chip" id="fwd" aria-label="Forward one bar">+1 bar</button></div>
    </div>
    <p class="facts">Width is time; gold is heat, from cold stone (0) to full gold (1). The lock block fades from 0.1 to 0.6 because the hand drum's body opens bar by bar while its pattern repeats. Tap a block to jump.</p>
  </section>

  <section aria-labelledby="h-ask">
    <h2 id="h-ask">The ask, at half speed</h2>
    <p>Every hook on the album starts with the same four notes (tonic, minor third, fifth, fourth) and ends on the fourth, like a question. Here a gong strikes them one every two beats, and a throat answers underneath.</p>
    ${hookSvg}
    <div class="legend"><span><i class="k-strike"></i>gong strike, ringing on</span><span><i class="k-knock"></i>muted knock</span><span><i class="k-throat"></i>the throat: a fall at the end of A♭2, a scoop into C3</span><span><i class="k-rest"></i>no strike</span></div>
    <p class="facts">One pass of the cell is 4 bars, ${(lead.bars * bar).toFixed(1)} s. The opening plays only the first half; bloom plays it whole once, then asks again and gets no answer from the gong.</p>
    <div class="row">${where.map(w => `<button class="chip" data-at="${w.at.toFixed(2)}">${esc(w.label)}<span>${mmss(w.at)}</span></button>`).join('')}</div>
  </section>

  <section aria-labelledby="h-calls">
    <h2 id="h-calls">Calls the brief left open</h2>
    <ol class="calls">${calls.map(([b, t]) => `<li><p><b>${esc(b)}</b> ${esc(t)}</p></li>`).join('')}</ol>
    <p class="facts">The tempo is the brief's ${score.bpm} BPM, about 15% slower than the hand-procession groove's own 88, so the same hand pattern walks with more room between strokes. A bar is ${bar.toFixed(1)} s, so the 6-bar video loop is ${(6 * bar).toFixed(1)} s, exactly ${Math.round(6 * bar * 30)} frames at 30 fps.</p>
  </section>

  <section aria-labelledby="h-crit">
    <h2 id="h-crit">What the critique changed</h2>
    <p>The first draft passed the kit's own check with nothing flagged and still failed three lines of the taste list. One revision, one render.</p>
    <ol class="crit">${critique.map(([n, was, now]) => `<li><span class="n">${esc(n)}</span><span class="was">Draft: ${esc(was)}</span><span class="now2">${esc(now)}</span></li>`).join('')}</ol>
  </section>

  <section aria-labelledby="h-phone">
    <h2 id="h-phone">On a phone speaker</h2>
    <p>Each part of this render was measured through a filter that cuts below 300 Hz, the way a phone speaker does. In the opening the gong is the loudest thing. In bloom, the throat's continuous hum leads, the gong comes next, and the hands sit under it. The sub and the palm booms only arrive on headphones.</p>
    <table aria-label="Level in bloom through a phone-speaker filter, dB RMS"><tbody>${phone.map(([k, v]) => `<tr${k.startsWith('gong') ? ' class="hook"' : ''}><td>${esc(k)}</td><td>${v} dB</td></tr>`).join('')}</tbody></table>
    <p class="facts">The track is −20.2 LUFS integrated with a true peak of −1 dB. The cavernous palm boom in bloom sets that peak, so the normalizer cannot raise the quiet first 25 s any further. Bloom alone measures −18.5 LUFS; track 5 measures −17.8 overall.</p>
  </section>

  <section aria-labelledby="h-cast">
    <h2 id="h-cast">Cast</h2>
    <ul class="cast">${cast.map(c => `<li><span class="role">${c.role}</span><span class="id">${c.id}<em class="t-${c.character}">${c.character}</em></span><p>${esc(ROLE[c.role] ?? '')}</p></li>`).join('')}</ul>
  </section>

  <footer>Spec album/opus/the-long-work.spec.json · render album/opus/render/ · this page: node album/opus/listen.ts OUT.html</footer>
</div>
<div class="dock" id="dock" hidden><span id="dock-t"></span><button id="dock-b" aria-label="Pause">Pause</button></div>
<audio id="audio" preload="metadata"></audio>
<script>
const B64 = "${audio}";
const SECTIONS = ${JSON.stringify(sections.map(s => ({ id: s.id, from: +s.from.toFixed(3), to: +s.to.toFixed(3), note: s.note })))};
const BAR = ${bar}, BEAT = ${beat}, MUSIC = ${music}, TOTAL = ${total}, TITLE = ${JSON.stringify(spec.title)};
const $ = s => document.querySelector(s), audio = $('#audio'), fmt = t => Math.floor(t / 60) + ':' + String(Math.floor(t % 60)).padStart(2, '0');
(() => { const bin = atob(B64), bytes = new Uint8Array(bin.length); for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i); audio.src = URL.createObjectURL(new Blob([bytes], { type: 'audio/mpeg' })); })();
const dur = () => (audio.duration && isFinite(audio.duration) ? audio.duration : TOTAL);
const where = t => { const i = SECTIONS.findIndex(s => t >= s.from && t < s.to); return i < 0 ? (t >= MUSIC ? SECTIONS.length - 1 : 0) : i; };
const pos = t => t >= MUSIC ? 'ring' : 'bar ' + (Math.floor(t / BAR) + 1) + ' · beat ' + (Math.floor((t % BAR) / BEAT) + 1);
let shown = -1, raf = 0;
function draw() {
  const t = audio.currentTime || 0, i = where(t);
  $('#seek').value = String(Math.round(t / dur() * 1000));
  $('#head').style.left = (100 * t / dur()) + '%';
  const c = $('#clock'); c.firstChild.nodeValue = fmt(t) + ' '; c.lastChild.textContent = '/ ' + fmt(dur()) + ' · ' + pos(t);
  if (i !== shown) {
    shown = i; document.querySelectorAll('.sec[data-i]').forEach((b, k) => b.classList.toggle('cur', k === i));
    const n = $('#now'), b = document.createElement('b'); b.textContent = SECTIONS[i].id; n.replaceChildren(b, SECTIONS[i].note);
  }
  $('#dock-t').textContent = TITLE + ' · ' + SECTIONS[i].id + ' · ' + pos(t);
}
function loop() { draw(); if (!audio.paused) raf = requestAnimationFrame(loop); }
function ui() {
  const on = !audio.paused;
  $('#play').classList.toggle('on', on); $('#play').setAttribute('aria-label', (on ? 'Pause ' : 'Play ') + TITLE);
  $('#dock').hidden = !on; $('#dock-b').textContent = on ? 'Pause' : 'Play';
  if ('mediaSession' in navigator) try { navigator.mediaSession.playbackState = on ? 'playing' : 'paused'; } catch (e) {}
  cancelAnimationFrame(raf); if (on) raf = requestAnimationFrame(loop); else draw();
}
const toggle = () => (audio.paused ? audio.play().catch(() => {}) : audio.pause());
const go = (t, play) => { audio.currentTime = Math.max(0, Math.min(dur() - 0.05, t)); draw(); if (play && audio.paused) audio.play().catch(() => {}); };
const jumpBar = d => { const t = audio.currentTime || 0; go(d < 0 ? Math.floor(Math.max(0, t - 0.25) / BAR) * BAR : (Math.floor(t / BAR) + 1) * BAR); };
$('#play').addEventListener('click', toggle);
$('#dock-b').addEventListener('click', toggle);
$('#back').addEventListener('click', () => jumpBar(-1));
$('#fwd').addEventListener('click', () => jumpBar(1));
$('#seek').addEventListener('input', e => go(e.target.value / 1000 * dur()));
document.querySelectorAll('.sec[data-i]').forEach(b => b.addEventListener('click', () => go(SECTIONS[+b.dataset.i].from, true)));
document.querySelectorAll('.chip[data-at]').forEach(b => b.addEventListener('click', () => go(+b.dataset.at, true)));
['play', 'pause', 'ended'].forEach(e => audio.addEventListener(e, ui));
audio.addEventListener('loadedmetadata', draw);
audio.addEventListener('seeked', draw);
audio.addEventListener('timeupdate', () => {
  if (!('mediaSession' in navigator) || !navigator.mediaSession.setPositionState || !isFinite(audio.duration)) return;
  try { navigator.mediaSession.setPositionState({ duration: audio.duration, playbackRate: audio.playbackRate, position: Math.min(audio.currentTime, audio.duration) }); } catch (e) {}
});
document.addEventListener('keydown', e => {
  if (e.target instanceof HTMLInputElement || e.altKey || e.ctrlKey || e.metaKey) return;
  if (e.target instanceof HTMLButtonElement && (e.key === ' ' || e.key === 'Enter')) return; // the focused button handles it
  if (e.key === ' ' || e.key === 'k') { e.preventDefault(); toggle(); }
  else if (e.key === 'ArrowLeft' || e.key === 'j') jumpBar(-1);
  else if (e.key === 'ArrowRight' || e.key === 'l') jumpBar(1);
});
// Android: lock-screen and notification controls. A small cover is drawn here: a gold slab seen from its foot, four strikes above it.
if ('mediaSession' in navigator) try {
  const set = (a, h) => { try { navigator.mediaSession.setActionHandler(a, h); } catch (e) {} };
  set('play', () => audio.play().catch(() => {})); set('pause', () => audio.pause());
  set('seekbackward', () => jumpBar(-1)); set('seekforward', () => jumpBar(1));
  set('seekto', d => go(d.seekTime));
  set('previoustrack', () => { const i = where(audio.currentTime || 0); go(SECTIONS[(audio.currentTime || 0) - SECTIONS[i].from > 1 ? i : Math.max(0, i - 1)].from); });
  set('nexttrack', () => { const i = where(audio.currentTime || 0); if (i < SECTIONS.length - 1) go(SECTIONS[i + 1].from); });
  const meta = art => { navigator.mediaSession.metadata = new MediaMetadata({ title: TITLE, artist: 'Weights & Measures · track 4 · Opus', album: 'Weights & Measures', artwork: art }); };
  meta([]);
  const cv = document.createElement('canvas'); cv.width = cv.height = 512; const g = cv.getContext('2d');
  if (g) {
    g.fillStyle = '#19221e'; g.fillRect(0, 0, 512, 512);
    const grd = g.createLinearGradient(0, 120, 0, 470); grd.addColorStop(0, '#e3b85a'); grd.addColorStop(1, '#8f6410');
    g.fillStyle = grd; g.fillRect(176, 150, 160, 320);
    g.fillStyle = '#e3b85a'; [[150, 96], [214, 78], [278, 60], [342, 69]].forEach(([cx, cy]) => { g.beginPath(); g.arc(cx, cy, 13, 0, 7); g.fill(); });
    cv.toBlob(b => { if (b) try { meta([{ src: URL.createObjectURL(b), sizes: '512x512', type: 'image/png' }]); } catch (e) {} }, 'image/png');
  }
} catch (e) {}
draw();
</script>
`;
writeFileSync(out, html);
console.log(`wrote ${out} (${(html.length / 1e6).toFixed(2)} MB; ${sections.length} sections, ${music.toFixed(1)} s + ${score.tailSeconds} s tail)`);
