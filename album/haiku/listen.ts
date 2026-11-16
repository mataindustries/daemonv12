/**
 * Builds the phone listening page for Seventeen Sparks, track 2 of WEIGHTS & MEASURES: one self-contained HTML file,
 * audio embedded.
 *   node album/haiku/listen.ts OUT.html
 * The track with its section map drawn to scale, the hook as five, seven, five with its cut, what to listen for,
 * then the groove, the hands and the sounds the track is built from. It reads the score and the spec, so every number
 * on the page is a number in the render, and it stops if the hook no longer reads as the brief says.
 */
import { readFileSync, writeFileSync } from 'node:fs';
import { PATCHES } from '../../composer-kit/palette.ts';
import { GROOVES } from '../../composer-kit/grooves.ts';

const ROOT = new URL('../..', import.meta.url).pathname, out = process.argv[2];
if (!out) { console.error('usage: node album/haiku/listen.ts OUT.html'); process.exit(2); }
const DIR = `${ROOT}album/haiku`;

type Opts = Record<string, unknown>;
type Note = [number, number, number, number, Opts?];
interface Score {
  title: string; bpm: number; key: string; swing: number; tailSeconds: number;
  sections: { id: string; bars: number; development: string }[];
  parts: { id: string; notes: Note[] }[];
}

const r = (x: number) => Math.round(x * 1000) / 1000;
const esc = (s: string) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
const json = (v: unknown) => JSON.stringify(v).split("<").join("\\u003c").split("\u2028").join("\\u2028").split("\u2029").join("\\u2029");
const b64 = (file: string) => readFileSync(file).toString('base64');
const mmss = (t: number) => `${Math.floor(t / 60)}:${String(Math.floor(t % 60)).padStart(2, '0')}`;
const PC = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'];
const name = (m: number) => `${PC[m % 12]}${Math.floor(m / 12) - 1}`;
const need = <T>(v: T | undefined, what: string): T => { if (v === undefined) throw new Error(`missing ${what}`); return v; };

const score = JSON.parse(readFileSync(`${DIR}/render/score.json`, 'utf8')) as Score;
const spec = JSON.parse(readFileSync(`${DIR}/seventeen-sparks.spec.json`, 'utf8')) as { title: string; world: string; groove: string };

// Sections in beats, then seconds: the section map is drawn to scale from these.
const beatSec = 60 / score.bpm;
let at = 0;
const sections = score.sections.map(s => { const from = at; at += s.bars * 4; return { id: s.id, note: s.development, from, to: at, fromSec: from * beatSec, toSec: at * beatSec }; });
const beats = at, music = beats * beatSec, tail = score.tailSeconds;
const section = (id: string) => need(sections.find(s => s.id === id), `section ${id}`);
const part = (id: string) => need(score.parts.find(p => p.id === id), `part ${id}`);

// The hook: the first full pass of the lead in the give section, moved to the start of its four-bar cell.
const giveAt = section('give').from;
const inCell = (n: Note) => n[0] >= giveAt && n[0] < giveAt + 16;
const cell = (id: string) => part(id).notes.filter(inCell).map(n => [r(n[0] - giveAt), n[1], n[2], n[3], n[4]] as Note);
const lead = cell('lead'), answer = cell('answer'), kicks = cell('kick'), snares = cell('snare');
const perBar = [0, 1, 2, 3].map(b => lead.filter(n => n[0] >= b * 4 && n[0] < b * 4 + 4).length);
if (perBar.join('-') !== '5-7-5-0') throw new Error(`the hook no longer reads five, seven, five and a cut: ${perBar.join('-')}`);
if (lead.slice(0, 4).map(n => name(n[2])).join(' ') !== 'E5 G5 B5 A5') throw new Error('the hook no longer begins with the ask');
if (answer.length !== 2 || answer.some(n => n[0] < 12)) throw new Error('the answer is no longer two notes in the cut');
const lanes = [...new Set([...lead, ...answer].map(n => n[2]))].sort((a, b) => b - a);
const last = part('lead').notes.reduce((a, b) => (b[0] > a[0] ? b : a));

// Audio: the track as rendered, the groove and the palette clips as the kit wrote them (no re-encoding).
const audio: Record<string, string> = { track: b64(`${DIR}/render/seventeen-sparks.mp3`) };
const groove = need(GROOVES.find(g => g.id === spec.groove), `groove ${spec.groove}`);
audio[`g-${groove.id}`] = b64(`${ROOT}composer-kit/auditions/grooves/${groove.id}.mp3`);
const patch = (id: string) => {
  const p = need(PATCHES.find(x => x.id === id), `patch ${id}`);
  audio[`p-${id}`] = b64(`${ROOT}composer-kit/auditions/palette/${id}.mp3`);
  return p;
};
const clip = (id: string, title: string, meta: string, tag: string, text: string) =>
  `<li class="clip"><button class="play" type="button" data-clip="${id}" data-name="${esc(title)}" aria-label="Play ${esc(title)}"><span class="ico"></span></button><div class="body"><div class="top"><span class="name">${esc(title)}</span><span class="tag t-${esc(tag)}">${esc(tag)}</span><span class="meta">${esc(meta)}</span></div><p>${esc(text)}</p><div class="bar"><i></i></div></div></li>`;
const palClip = (id: string) => { const p = patch(id); return clip(`p-${p.id}`, p.id, p.instrument.replace(/^.*\//, ''), p.character, p.where); };
const grooveHtml = clip(`g-${groove.id}`, groove.id, `${groove.bpm} BPM · swing ${groove.swing}`, 'groove', groove.feel);
const handsHtml = ['clay-whoop', 'log-tongue'].map(palClip).join('');
const soundsHtml = ['music-box', 'laser-spring', 'hollow-knock', 'bearing-rain'].map(palClip).join('');

// The hook as a picture: five, seven, five, then the cut. Notes are bars on a pitch grid; the groove's kick and
// snare sit underneath, so the snare-free placement of the hook can be seen rather than taken on trust.
const roll = (() => {
  const W = 340, LEFT = 40, RIGHT = 334, PX = (RIGHT - LEFT) / 16, TOP = 22, LANE = 18;
  const laneY = (m: number) => TOP + lanes.indexOf(m) * LANE + LANE / 2;
  const kickY = TOP + lanes.length * LANE + 12, snareY = kickY + 16, H = snareY + 16;
  const x = (b: number) => r(LEFT + b * PX);
  const width = (d: number) => r(Math.max(3, d * PX - 1.5));
  const shapes: string[] = [
    `<rect class="cut" x="${x(12)}" y="16" width="${r(4 * PX)}" height="${H - 22}"/>`,
    ...[0, 4, 8, 12, 16].map(b => `<line class="grid" x1="${x(b)}" x2="${x(b)}" y1="16" y2="${H - 6}"/>`),
    ...lanes.flatMap(m => [
      `<line class="guide" x1="${x(0)}" x2="${x(16)}" y1="${laneY(m)}" y2="${laneY(m)}"/>`,
      `<text class="lbl" x="${LEFT - 6}" y="${laneY(m) + 4}" text-anchor="end">${name(m)}</text>`]),
    `<text class="lbl strong" x="${x(2)}" y="12" text-anchor="middle">5</text>`,
    `<text class="lbl strong" x="${x(6)}" y="12" text-anchor="middle">7</text>`,
    `<text class="lbl strong" x="${x(10)}" y="12" text-anchor="middle">5</text>`,
    `<text class="cutlbl" x="${x(14)}" y="12" text-anchor="middle">cut</text>`,
    ...lead.map(n => `<rect class="${n[4]?.articulation === 'buzz' ? 'lead buzz' : 'lead'}" x="${r(x(n[0]) + 0.5)}" y="${laneY(n[2]) - 6}" width="${width(n[1])}" height="12" rx="2"/>`),
    ...answer.map(n => `<rect class="ans" x="${r(x(n[0]) + 0.5)}" y="${laneY(n[2]) - 6}" width="${width(n[1])}" height="12" rx="2"/>`),
    ...kicks.map(n => `<rect class="kick" x="${r(x(n[0]) - 2)}" y="${kickY - 4}" width="4" height="8"/>`),
    ...snares.map(n => `<rect class="snare" x="${r(x(n[0]) - 2.5)}" y="${snareY - 4}" width="5" height="8"/>`),
    `<text class="lbl" x="${LEFT - 6}" y="${kickY + 4}" text-anchor="end">kick</text>`,
    `<text class="lbl" x="${LEFT - 6}" y="${snareY + 4}" text-anchor="end">snare</text>`,
  ];
  const label = 'The hook in four bars: five notes, then seven, then five. The fourth bar is the cut, with only two notes of the laser spring in it. The one dashed note is the buzz. No note lands on a snare beat.';
  return `<svg viewBox="0 0 ${W} ${H}" role="img" aria-label="${esc(label)}">${shapes.join('')}</svg>`;
})();

// Section map: widths are seconds, so the two halves of the poem and the hole are seen as well as heard.
const SEC_CLASS: Record<string, string> = { bait: 's-cool', switch: 's-violet', hole: 's-hole', give: 's-hot' };
const map = sections.map((s, i) => `<button class="sec ${SEC_CLASS[s.id] ?? ''}" type="button" data-i="${i}" style="width:calc(${((100 * (s.to - s.from)) / beats).toFixed(3)}% - 2px)" aria-label="Jump to ${esc(s.id)}, ${mmss(s.fromSec)}">${esc(s.id)}</button>`).join('');
const sectionsJs = sections.map(s => ({ id: s.id, from: r(s.fromSec), to: r(s.toSec), note: s.note }));

const listen: [string, string][] = [
  [mmss(section('bait').fromSec), 'Half a poem, cold: five notes, then seven, over a bass that knocks.'],
  [mmss(part('answer').notes[0]![0] * beatSec), 'The laser answers in the gap: two notes, and the first one chirps down.'],
  [mmss(section('hole').fromSec), 'Stop-time, then a hole. The last line is held back.'],
  [mmss((giveAt + 8) * beatSec), `The last five arrives and the poem is whole. The track ends on ${name(last[2])}, a minor third above the tonic.`],
];
const listenHtml = listen.map(([t, text]) => `<li><time>${t}</time><span>${esc(text)}</span></li>`).join('');
const facts = `${score.key} · ${score.bpm} BPM · swing ${score.swing} · ${spec.groove} · ${Math.round(music)} s of music, then a ${tail} s ring · ends on ${name(last[2])}`;

const CSS = `
/* Plan. Palette: a workshop after closing, near-black with a violet cast; one neon magenta for the sign, cyan for the
   cold half, violet where the answer joins, yellow for the laser. Type: Unbounded for the sign, Space Grotesk for running
   text, JetBrains Mono for labels and times. Layout: one phone column. The track is the sign at the top, the haiku is
   drawn on the grid it sits on, and the groove, the hands and the sounds follow as plain lists. */
:root {
  --bg: #0d0b13; --panel: #171323; --line: #2d2842; --ink: #f3effc; --muted: #a79fc3;
  --neon: #ff4f9a; --cool: #58d6ee; --violet: #a98bff; --gold: #ffd166; --on-neon: #0d0b13;
  --glow: 0 0 22px rgba(255, 79, 154, 0.5);
  --display: "Unbounded", "Arial Black", system-ui, sans-serif;
  --text: "Space Grotesk", system-ui, sans-serif;
  --mono: "JetBrains Mono", ui-monospace, Menlo, monospace;
  color-scheme: dark;
}
@media (prefers-color-scheme: light) {
  :root:not([data-theme="dark"]) {
    --bg: #f5f1fb; --panel: #ffffff; --line: #d8cfe8; --ink: #1b1530; --muted: #5d5675;
    --neon: #d2196b; --cool: #0b7f98; --violet: #6441d6; --gold: #b07400; --on-neon: #ffffff;
    --glow: none; color-scheme: light;
  }
}
:root[data-theme="light"] {
  --bg: #f5f1fb; --panel: #ffffff; --line: #d8cfe8; --ink: #1b1530; --muted: #5d5675;
  --neon: #d2196b; --cool: #0b7f98; --violet: #6441d6; --gold: #b07400; --on-neon: #ffffff;
  --glow: none; color-scheme: light;
}
body { background: var(--bg); color: var(--ink); font: 400 15px/1.55 var(--text); }
.wrap { max-width: 44rem; margin: 0 auto; padding-block: 1.25rem 7.5rem; padding-left: max(16px, env(safe-area-inset-left, 0px)); padding-right: max(16px, env(safe-area-inset-right, 0px)); display: flex; flex-direction: column; gap: 2.5rem; }
*:focus-visible { outline: 2px solid var(--neon); outline-offset: 2px; }
h1 { font: 700 clamp(2.1rem, 10.5vw, 3.6rem)/0.98 var(--display); letter-spacing: -0.02em; margin: 0; text-wrap: balance; text-shadow: var(--glow); }
h2 { font: 600 1.15rem/1.2 var(--text); margin: 0; text-wrap: balance; }
h3 { font: 500 0.72rem/1 var(--mono); letter-spacing: 0.12em; text-transform: uppercase; color: var(--muted); margin: 0; }
p { margin: 0; }
.eyebrow { font: 500 0.72rem/1.2 var(--mono); letter-spacing: 0.1em; text-transform: uppercase; color: var(--muted); margin: 0; }
.lede { color: var(--muted); max-width: 60ch; }
.masthead { display: flex; flex-direction: column; gap: 0.9rem; }
nav.jump { display: flex; flex-wrap: wrap; gap: 0.5rem; }
nav.jump a { font: 500 0.78rem/1 var(--mono); color: var(--ink); text-decoration: none; border: 1px solid var(--line); padding: 0.55rem 0.75rem; }
section { display: flex; flex-direction: column; gap: 1rem; }
.deck { background: var(--panel); border: 1px solid var(--line); padding: 1rem; gap: 0.9rem; }
.tk-top { display: flex; align-items: center; gap: 0.9rem; }
.tk-title { min-width: 0; flex: 1; display: flex; flex-direction: column; gap: 0.3rem; }
.tk-title b { font: 700 1.1rem/1.15 var(--display); text-wrap: balance; }
.time { font: 400 0.75rem/1 var(--mono); color: var(--muted); font-variant-numeric: tabular-nums; }
.play { flex: none; width: 2.75rem; height: 2.75rem; border-radius: 50%; border: 2px solid var(--neon); background: transparent; display: grid; place-items: center; cursor: pointer; padding: 0; }
.tk-top .play { width: 3.5rem; height: 3.5rem; }
.play.on { background: var(--neon); }
.ico { width: 0; height: 0; border-style: solid; border-width: 0.5rem 0 0.5rem 0.8rem; border-color: transparent transparent transparent var(--neon); margin-left: 0.2rem; }
.play.on .ico { width: 0.8rem; height: 0.8rem; border: 0; margin: 0; background: linear-gradient(90deg, var(--on-neon) 0 35%, transparent 35% 65%, var(--on-neon) 65%); }
.seek { width: 100%; accent-color: var(--neon); margin: 0; height: 1.75rem; }
.map { display: flex; gap: 2px; }
.sec { flex: 0 0 auto; min-width: 0; height: 2.6rem; border: 0; padding: 0 0.3rem; cursor: pointer; font: 500 0.66rem/1 var(--mono); overflow: hidden; white-space: nowrap; opacity: 0.55; }
.sec.cur { opacity: 1; }
.sec.s-cool { background: var(--cool); color: var(--bg); }
.sec.s-violet { background: var(--violet); color: var(--bg); }
.sec.s-hot { background: var(--neon); color: var(--on-neon); }
.sec.s-hole { background: transparent; color: var(--muted); border: 1px dashed var(--muted); }
.legend { display: flex; flex-wrap: wrap; gap: 0.35rem 1rem; font: 400 0.75rem/1.4 var(--mono); color: var(--muted); }
.legend i { display: inline-block; width: 0.7rem; height: 0.7rem; margin-right: 0.35rem; vertical-align: -1px; }
.c-cool { background: var(--cool); } .c-violet { background: var(--violet); } .c-hot { background: var(--neon); }
.c-hole { background: transparent; border: 1px dashed var(--muted); }
.c-note { background: var(--neon); } .c-buzz { background: var(--neon); border: 1px dashed var(--ink); }
.c-laser { background: var(--gold); } .c-kick { background: var(--ink); } .c-snare { background: var(--muted); opacity: 0.55; }
.where { font: 400 0.95rem/1.45 var(--text); min-height: 2.9em; }
.where b { font: 600 0.8rem/1 var(--mono); color: var(--neon); margin-right: 0.45rem; }
.world { font: 400 0.9rem/1.5 var(--text); }
.facts { font: 400 0.75rem/1.6 var(--mono); color: var(--muted); }
figure.roll { margin: 0; background: var(--panel); border: 1px solid var(--line); padding: 0.75rem; display: flex; flex-direction: column; gap: 0.7rem; }
figure.roll svg { width: 100%; height: auto; display: block; max-width: 100%; }
figcaption { font: 400 0.9rem/1.5 var(--text); }
.grid { stroke: var(--line); stroke-width: 1; }
.guide { stroke: var(--line); stroke-width: 0.6; }
.cut { fill: var(--neon); fill-opacity: 0.12; }
.lead { fill: var(--neon); }
.buzz { fill: var(--neon); stroke: var(--ink); stroke-width: 1; stroke-dasharray: 2 1.5; }
.ans { fill: var(--gold); }
.kick { fill: var(--ink); }
.snare { fill: var(--muted); fill-opacity: 0.55; }
.lbl { font: 500 11px/1 var(--mono); fill: var(--muted); }
.lbl.strong { fill: var(--ink); font-weight: 600; }
.cutlbl { font: 600 11px/1 var(--mono); fill: var(--neon); }
.listen { list-style: none; margin: 0; padding: 0; border-top: 1px solid var(--line); }
.listen li { display: grid; grid-template-columns: 3.6rem minmax(0, 1fr); gap: 0.75rem; padding: 0.7rem 0; border-bottom: 1px solid var(--line); }
.listen time { font: 500 0.85rem/1.4 var(--mono); color: var(--neon); }
.group { display: flex; flex-direction: column; gap: 0.5rem; }
ul.clips { list-style: none; margin: 0; padding: 0; border-top: 1px solid var(--line); }
.clip { display: flex; gap: 0.75rem; padding: 0.75rem 0; border-bottom: 1px solid var(--line); align-items: flex-start; }
.body { min-width: 0; flex: 1; display: flex; flex-direction: column; gap: 0.3rem; }
.top { display: flex; flex-wrap: wrap; align-items: baseline; gap: 0.25rem 0.6rem; }
.name { font: 500 0.95rem/1.2 var(--mono); }
.meta { font: 400 0.75rem/1.2 var(--mono); color: var(--muted); }
.tag { font: 500 0.68rem/1 var(--mono); letter-spacing: 0.06em; text-transform: uppercase; }
.t-groove, .t-rubbery { color: var(--gold); }
.t-glassy { color: var(--cool); }
.t-broken, .t-dirty { color: var(--neon); }
.t-mechanical { color: var(--violet); }
.t-human { color: var(--ink); }
.t-utility { color: var(--muted); }
.clip p { font-size: 0.875rem; color: var(--muted); }
.bar { height: 2px; background: var(--line); }
.bar i { display: block; height: 100%; width: 0; background: var(--neon); }
.foot { font: 400 0.75rem/1.6 var(--mono); color: var(--muted); }
.now { position: fixed; left: 0; right: 0; bottom: 0; background: var(--panel); color: var(--ink); border-top: 1px solid var(--line); display: flex; align-items: center; gap: 0.75rem; padding-block: 0.7rem calc(0.7rem + env(safe-area-inset-bottom, 0px)); padding-left: max(16px, env(safe-area-inset-left, 0px)); padding-right: max(16px, env(safe-area-inset-right, 0px)); }
.now span { font: 500 0.85rem/1.2 var(--mono); min-width: 0; flex: 1; overflow-wrap: anywhere; }
.now button { font: 600 0.85rem/1 var(--text); background: var(--neon); color: var(--on-neon); border: 0; padding: 0.6rem 1rem; cursor: pointer; }
@media (prefers-reduced-motion: reduce) { * { transition: none !important; animation: none !important; } }
`;

const JS = `
var player = new Audio();
var current = null;
function $(s) { return document.querySelector(s); }
function fmt(t) { t = Math.max(0, t || 0); return Math.floor(t / 60) + ':' + String(Math.floor(t % 60)).padStart(2, '0'); }
function nameOf(id) { var b = document.querySelector('.play[data-clip="' + id + '"]'); return b && b.dataset.name ? b.dataset.name : id; }
function session() {
  try {
    if (!('mediaSession' in navigator) || !current) return;
    navigator.mediaSession.metadata = new MediaMetadata({ title: nameOf(current), artist: 'DaemonV12 · Weights & Measures', album: 'Track 2 of 6' });
    navigator.mediaSession.playbackState = player.paused ? 'paused' : 'playing';
  } catch (e) { /* lock-screen controls are optional */ }
}
function ui() {
  document.querySelectorAll('.play').forEach(function (b) { b.classList.toggle('on', b.dataset.clip === current && !player.paused); });
  $('#now').hidden = !current;
  if (current) { $('#now-name').textContent = nameOf(current); $('#toggle').textContent = player.paused ? 'Play' : 'Pause'; }
  session();
}
function play(id, at) {
  if (current === id) {
    if (at !== undefined) { player.currentTime = at; player.play().catch(function () {}); }
    else if (player.paused) { player.play().catch(function () {}); }
    else { player.pause(); }
    return;
  }
  current = id;
  player.src = 'data:audio/mpeg;base64,' + AUDIO[id];
  if (at !== undefined) player.addEventListener('loadedmetadata', function seekOnce() { player.currentTime = at; player.removeEventListener('loadedmetadata', seekOnce); });
  player.play().catch(function () {});
  document.querySelectorAll('.bar i').forEach(function (i) { i.style.width = '0'; });
  ui();
}
function mark(t) {
  var i = SECTIONS.findIndex(function (s) { return t >= s.from && t < s.to; });
  if (i < 0) i = SECTIONS.length - 1;
  document.querySelectorAll('.sec').forEach(function (b, k) { b.classList.toggle('cur', k === i); });
  var w = $('#where');
  if (w.dataset.i === String(i)) return;
  w.dataset.i = String(i);
  var s = SECTIONS[i], b = document.createElement('b');
  b.textContent = s.id;
  w.textContent = '';
  w.appendChild(b);
  w.appendChild(document.createTextNode(' ' + s.note));
}
document.querySelectorAll('.play').forEach(function (b) { b.addEventListener('click', function () { play(b.dataset.clip); }); });
document.querySelectorAll('.sec').forEach(function (b) { b.addEventListener('click', function () { play('track', SECTIONS[+b.dataset.i].from); }); });
$('#toggle').addEventListener('click', function () { play(current || 'track'); });
['play', 'pause', 'ended'].forEach(function (e) { player.addEventListener(e, ui); });
player.addEventListener('timeupdate', function () {
  if (!current || !player.duration) return;
  var f = player.currentTime / player.duration;
  if (current === 'track') {
    $('#seek').value = Math.round(f * 1000);
    $('#time').textContent = fmt(player.currentTime) + ' / ' + fmt(player.duration);
    mark(player.currentTime);
  } else {
    var btn = document.querySelector('.play[data-clip="' + current + '"]');
    var bar = btn && btn.parentElement.querySelector('.bar i');
    if (bar) bar.style.width = (f * 100) + '%';
  }
});
$('#seek').addEventListener('input', function (e) {
  if (current !== 'track') play('track');
  if (player.duration) player.currentTime = (e.target.value / 1000) * player.duration;
});
try {
  if ('mediaSession' in navigator) {
    navigator.mediaSession.setActionHandler('play', function () { player.play().catch(function () {}); });
    navigator.mediaSession.setActionHandler('pause', function () { player.pause(); });
  }
} catch (e) { /* optional */ }
mark(0);
ui();
`;

const html = `<title>Seventeen Sparks</title>
<meta name="claude:viewport-fit-sides" content="cover">
<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=JetBrains+Mono:wght@400;500&family=Space+Grotesk:wght@400;500;600&family=Unbounded:wght@500;700&display=swap">
<style>${CSS}</style>
<div class="wrap">
  <header class="masthead">
    <p class="eyebrow">Weights &amp; Measures · track 2 of 6</p>
    <h1>Seventeen Sparks</h1>
    <p class="lede">A music box says a haiku in seventeen notes. A laser spring answers it in the silence, and a clay pot and a log keep the time until the sparks are gone. Written for Haiku, the smallest model. Unofficial fan work, not affiliated with or endorsed by Anthropic.</p>
    <nav class="jump"><a href="#track">The track</a><a href="#haiku">The haiku</a><a href="#listen">Listen for</a><a href="#sounds">The sounds</a></nav>
  </header>

  <section id="track" class="deck" aria-label="The track">
    <div class="tk-top">
      <button class="play" type="button" data-clip="track" data-name="${esc(spec.title)}" aria-label="Play ${esc(spec.title)}"><span class="ico"></span></button>
      <div class="tk-title"><b>${esc(spec.title)}</b><span class="time" id="time">0:00 / ${mmss(music + tail)}</span></div>
    </div>
    <input class="seek" id="seek" type="range" min="0" max="1000" value="0" aria-label="Position in the track">
    <div class="map" id="map">${map}</div>
    <div class="legend"><span><i class="c-cool"></i>bait: half the poem</span><span><i class="c-violet"></i>switch: the answer joins</span><span><i class="c-hole"></i>hole: stop-time</span><span><i class="c-hot"></i>give: the whole poem</span></div>
    <p class="where" id="where" data-i="0"><b>${esc(sections[0]!.id)}</b> ${esc(sections[0]!.note)}</p>
    <p class="world">${esc(spec.world)}</p>
    <p class="facts">${esc(facts)}</p>
  </section>

  <section id="haiku">
    <h2>The haiku</h2>
    <figure class="roll">
      ${roll}
      <figcaption>Five notes, seven, five. Bar four is the cut: only the laser answers there. No note lands on a snare beat, and the one dashed note is the buzz.</figcaption>
    </figure>
    <p class="legend"><span><i class="c-note"></i>a note</span><span><i class="c-buzz"></i>the buzz</span><span><i class="c-laser"></i>the laser</span><span><i class="c-kick"></i>kick</span><span><i class="c-snare"></i>snare</span></p>
  </section>

  <section id="listen">
    <h2>Listen for</h2>
    <ul class="listen">${listenHtml}</ul>
  </section>

  <section id="sounds">
    <h2>The groove, the hands and the sounds</h2>
    <div class="group"><h3>Groove</h3><ul class="clips">${grooveHtml}</ul></div>
    <div class="group"><h3>Hands</h3><ul class="clips">${handsHtml}</ul></div>
    <div class="group"><h3>Sounds</h3><ul class="clips">${soundsHtml}</ul></div>
    <p class="foot">Palette clips play two bars, cold then hot. The groove plays two bars with its hands, kick and bass. The audio is inside this page. Built with the DaemonV12 Composer Kit: ${Math.round(music + tail)} s MP3 at 160 kbps.</p>
  </section>
</div>
<div class="now" id="now" hidden><span id="now-name"></span><button id="toggle" type="button">Pause</button></div>
<script>
var AUDIO = ${json(audio)};
var SECTIONS = ${json(sectionsJs)};
var TITLE = ${json(spec.title)};
</script>
<script>${JS}</script>
`;

writeFileSync(out, html);
console.log(`wrote ${out} (${(html.length / 1e6).toFixed(2)} MB; ${lead.length} hook notes in ${perBar.join('-')}; ${answer.length} laser notes; ${sections.length} sections; ${mmss(music)} of music)`);
