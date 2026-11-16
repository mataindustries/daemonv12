/**
 * Builds the phone listening page for the album work (one self-contained HTML file, audio embedded):
 *   node album/listen.ts OUT.html
 * The Mythos/Fable track with its section map drawn to scale, then the Timbre Lab patch and hand-groove auditions.
 * Uses the Composer Kit listening page's tokens and type (composer-kit/listen.ts).
 */
import { spawnSync } from 'node:child_process';
import { readFileSync, writeFileSync } from 'node:fs';
import { PATCHES } from '../composer-kit/palette.ts';
import { GROOVES } from '../composer-kit/grooves.ts';

const ROOT = new URL('..', import.meta.url).pathname, out = process.argv[2];
if (!out) { console.error('usage: node album/listen.ts OUT.html'); process.exit(2); }
function b64(file: string, kbps: number): string {
  const r = spawnSync('ffmpeg', ['-hide_banner', '-nostdin', '-v', 'error', '-i', file, '-codec:a', 'libmp3lame', '-b:a', `${kbps}k`, '-map_metadata', '-1', '-f', 'mp3', '-'], { maxBuffer: 1 << 28 });
  if (r.status !== 0) throw new Error(`ffmpeg ${file}: ${r.stderr}`);
  return r.stdout.toString('base64');
}
const esc = (s: string) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
const audio: Record<string, string> = {};

const DIR = `${ROOT}album/fable`, spec = JSON.parse(readFileSync(`${DIR}/two-names-for-one-fire.spec.json`, 'utf8')) as { title: string; world: string; key: string };
interface Score { bpm: number; sections: { id: string; bars: number; development: string }[] }
const sides = ['a', 'b'].map(x => JSON.parse(readFileSync(`${DIR}/render/score-${x}.json`, 'utf8')) as Score);
let at = 0;
const sections = sides.flatMap((s, si) => s.sections.map(x => { const from = at; at += x.bars * 240 / s.bpm; return { id: x.id, side: si, bpm: s.bpm, bars: x.bars, from, to: at, note: x.development }; }));
const total = at, switchAt = sections.find(s => s.side === 1)!.from;
audio.track = b64(`${DIR}/render/two-names-for-one-fire.mp3`, 128);

const LAB = ['breath-reed', 'organic-percussion'];
const patches = PATCHES.filter(p => LAB.some(f => p.instrument.startsWith(f))).map(p => { audio[`p-${p.id}`] = b64(`${ROOT}composer-kit/auditions/palette/${p.id}.mp3`, 80); return p; });
const grooves = GROOVES.filter(g => g.perc2).map(g => { audio[`g-${g.id}`] = b64(`${ROOT}composer-kit/auditions/grooves/${g.id}.mp3`, 80); return g; });
const row = (id: string, name: string, meta: string, tag: string, text: string) =>
  `<li class="clip"><button class="play" data-clip="${id}" aria-label="Play ${esc(name)}"><span class="ico"></span></button><div class="body"><div class="top"><span class="name">${esc(name)}</span>${tag ? `<span class="tag t-${tag}">${tag}</span>` : ''}<span class="meta">${esc(meta)}</span></div><p>${esc(text)}</p><div class="bar"><i></i></div></div></li>`;
const mmss = (t: number) => `${Math.floor(t / 60)}:${String(Math.floor(t % 60)).padStart(2, '0')}`;

const html = `<title>Two Names Listening</title>
<meta name="claude:viewport-fit-sides" content="cover">
<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Bricolage+Grotesque:opsz,wght@12..96,500;12..96,700&family=IBM+Plex+Mono:wght@400;500&family=IBM+Plex+Sans:wght@400;500;600&display=swap">
<style>
/* layout: one phone-width column; the track first with its section map drawn to scale, then channel strips; a fixed transport while something plays */
:root {
  --bg: #e9ede8; --panel: #f7f9f5; --ink: #18221d; --muted: #5a675f; --line: #cdd5cd; --accent: #2743d6; --on-accent: #ffffff;
  --side-a: #55635b; --side-b: #9c2f24; --on-side: #ffffff;
  --dirty: #a8481f; --rubbery: #6b3fc4; --mechanical: #3f6278; --glassy: #0f7f96; --broken: #b62a62; --human: #8f6410; --utility: #5d6b63;
  --display: "Bricolage Grotesque", "Space Grotesk", system-ui, sans-serif; --text: "IBM Plex Sans", system-ui, sans-serif; --mono: "IBM Plex Mono", ui-monospace, monospace;
}
@media (prefers-color-scheme: dark) { :root:not([data-theme="light"]) {
  --bg: #101613; --panel: #19221e; --ink: #e4ebe6; --muted: #98a69d; --line: #2c3833; --accent: #93a5ff; --on-accent: #0b1020;
  --side-a: #8b9a91; --side-b: #e2685a; --on-side: #101613;
  --dirty: #f0906a; --rubbery: #b79bff; --mechanical: #8fb4cc; --glassy: #63cfe4; --broken: #ff86b4; --human: #e3b85a; --utility: #9aa8a0; color-scheme: dark } }
:root[data-theme="dark"] {
  --bg: #101613; --panel: #19221e; --ink: #e4ebe6; --muted: #98a69d; --line: #2c3833; --accent: #93a5ff; --on-accent: #0b1020;
  --side-a: #8b9a91; --side-b: #e2685a; --on-side: #101613;
  --dirty: #f0906a; --rubbery: #b79bff; --mechanical: #8fb4cc; --glassy: #63cfe4; --broken: #ff86b4; --human: #e3b85a; --utility: #9aa8a0; color-scheme: dark }
body { background: var(--bg); color: var(--ink); font: 400 15px/1.5 var(--text); }
.wrap { max-width: 44rem; margin: 0 auto; padding-block: 1.5rem 7rem; padding-left: max(16px, env(safe-area-inset-left, 0px)); padding-right: max(16px, env(safe-area-inset-right, 0px)); display: flex; flex-direction: column; gap: 2.25rem; }
h1 { font: 700 clamp(2rem, 9vw, 3rem)/1 var(--display); letter-spacing: -0.02em; margin: 0; text-wrap: balance; }
h2 { font: 700 1.5rem/1.1 var(--display); margin: 0; text-wrap: balance; }
h3 { font: 500 0.72rem/1 var(--mono); letter-spacing: 0.12em; text-transform: uppercase; color: var(--muted); margin: 0; }
p { margin: 0; }
header p, .lede { color: var(--muted); max-width: 60ch; }
header { display: flex; flex-direction: column; gap: 0.75rem; }
nav { display: flex; flex-wrap: wrap; gap: 0.5rem; }
nav a { font: 500 0.8rem/1 var(--mono); color: var(--ink); text-decoration: none; border: 1px solid var(--line); border-radius: 999px; padding: 0.55rem 0.8rem; }
section { display: flex; flex-direction: column; gap: 1rem; }
.group { display: flex; flex-direction: column; gap: 0.5rem; }
ul { list-style: none; margin: 0; padding: 0; border-top: 1px solid var(--line); }
.clip { display: flex; gap: 0.75rem; padding: 0.75rem 0; border-bottom: 1px solid var(--line); align-items: flex-start; }
.body { min-width: 0; flex: 1; display: flex; flex-direction: column; gap: 0.3rem; }
.top { display: flex; flex-wrap: wrap; align-items: baseline; gap: 0.25rem 0.6rem; }
.name { font: 500 0.95rem/1.2 var(--mono); }
.meta { font: 400 0.75rem/1.2 var(--mono); color: var(--muted); }
.tag { font: 500 0.68rem/1 var(--mono); letter-spacing: 0.06em; text-transform: uppercase; }
.t-dirty { color: var(--dirty) } .t-rubbery { color: var(--rubbery) } .t-mechanical { color: var(--mechanical) } .t-glassy { color: var(--glassy) } .t-broken { color: var(--broken) } .t-human { color: var(--human) } .t-utility { color: var(--utility) }
.clip p { font-size: 0.875rem; color: var(--muted); }
.play { flex: none; width: 2.75rem; height: 2.75rem; border-radius: 50%; border: 1.5px solid var(--accent); background: transparent; display: grid; place-items: center; cursor: pointer; padding: 0; }
.play:focus-visible, nav a:focus-visible, .seek:focus-visible, .sec:focus-visible, .now button:focus-visible { outline: 2px solid var(--accent); outline-offset: 2px; }
.ico { width: 0; height: 0; border-style: solid; border-width: 0.5rem 0 0.5rem 0.8rem; border-color: transparent transparent transparent var(--accent); margin-left: 0.2rem; }
.play.on { background: var(--accent); }
.play.on .ico { width: 0.8rem; height: 0.8rem; border: 0; margin: 0; background: linear-gradient(90deg, var(--on-accent) 0 35%, transparent 35% 65%, var(--on-accent) 65%); }
.bar { height: 2px; background: transparent; }
.bar i { display: block; height: 100%; width: 0; background: var(--accent); }
.track { background: var(--panel); border: 1px solid var(--line); border-radius: 14px; padding: 1rem; display: flex; flex-direction: column; gap: 0.9rem; }
.tk-top { display: flex; align-items: center; gap: 0.9rem; }
.tk-top .play { width: 3.5rem; height: 3.5rem; }
.tk-title { min-width: 0; flex: 1; display: flex; flex-direction: column; gap: 0.25rem; }
.tk-title b { font: 700 1.35rem/1.1 var(--display); text-wrap: balance; }
.time { font: 400 0.75rem/1 var(--mono); color: var(--muted); font-variant-numeric: tabular-nums; }
.seek { width: 100%; accent-color: var(--accent); margin: 0; height: 1.75rem; }
/* the section map: widths are seconds, so the two tempos are seen as well as heard */
.map { display: flex; gap: 2px; }
.sec { flex: 0 0 auto; min-width: 0; height: 2.6rem; border: 0; padding: 0 0.3rem; cursor: pointer; font: 500 0.66rem/1 var(--mono); color: var(--on-side); overflow: hidden; text-overflow: clip; white-space: nowrap; opacity: 0.55; }
.sec.a { background: var(--side-a); } .sec.b { background: var(--side-b); }
.sec.cur { opacity: 1; }
.sec:first-child { border-radius: 6px 0 0 6px; } .sec:last-child { border-radius: 0 6px 6px 0; }
.legend { display: flex; flex-wrap: wrap; gap: 0.3rem 1rem; font: 400 0.75rem/1.3 var(--mono); color: var(--muted); }
.legend i { display: inline-block; width: 0.7rem; height: 0.7rem; border-radius: 2px; margin-right: 0.35rem; vertical-align: -1px; }
.where { font: 400 0.875rem/1.45 var(--text); min-height: 2.6em; }
.where b { font: 500 0.8rem/1 var(--mono); margin-right: 0.4rem; }
.facts { font: 400 0.75rem/1.5 var(--mono); color: var(--muted); }
.now { position: fixed; left: 0; right: 0; bottom: 0; background: var(--ink); color: var(--bg); display: flex; align-items: center; gap: 0.75rem; padding-block: 0.7rem calc(0.7rem + env(safe-area-inset-bottom, 0px)); padding-left: max(16px, env(safe-area-inset-left, 0px)); padding-right: max(16px, env(safe-area-inset-right, 0px)); }
.now span { font: 500 0.85rem/1.2 var(--mono); min-width: 0; flex: 1; overflow-wrap: anywhere; }
.now button { font: 600 0.85rem/1 var(--text); background: var(--bg); color: var(--ink); border: 0; border-radius: 999px; padding: 0.6rem 1rem; cursor: pointer; }
</style>
<div class="wrap">
  <header>
    <h3>DaemonV12 · Weights &amp; Measures</h3>
    <h1>One reed, whisper to feral</h1>
    <p>The Mythos/Fable track from the tribute album, and the new breath reed and hand percussion it is built on. Nobody who made these could hear them, so your ears are the test. Unofficial fan work, not affiliated with Anthropic.</p>
    <nav><a href="#track">The track</a><a href="#patches">New patches</a><a href="#grooves">Hand grooves</a></nav>
  </header>

  <section id="track">
    <h2>Track 5 of 6</h2>
    <article class="track">
      <div class="tk-top"><button class="play" data-clip="track" aria-label="Play ${esc(spec.title)}"><span class="ico"></span></button>
        <div class="tk-title"><b>${esc(spec.title)}</b><span class="time" id="time">0:00 / ${mmss(total + 2)}</span></div></div>
      <input class="seek" id="seek" type="range" min="0" max="1000" value="0" aria-label="Position in the track">
      <div class="map" id="map">${sections.map((s, i) => `<button class="sec ${'ab'[s.side]}" data-i="${i}" style="width:calc(${(100 * (s.to - s.from) / total).toFixed(3)}% - 2px)" aria-label="Jump to ${s.id}, ${mmss(s.from)}">${s.id}</button>`).join('')}</div>
      <div class="legend"><span><i style="background:var(--side-a)"></i>side A · Fable · ${sides[0]!.bpm} BPM in twelve</span><span><i style="background:var(--side-b)"></i>side B · Mythos · ${sides[1]!.bpm} BPM straight</span><span>switch at ${mmss(switchAt)}</span></div>
      <p class="where" id="where"><b>${sections[0]!.id}</b>${esc(sections[0]!.note)}</p>
      <p>${esc(spec.world)}</p>
      <p class="facts">${esc(spec.key)} · the same four-note hook on both sides (G B♭ D C) · a triplet of side A is an eighth note of side B, and the last bar of side A is one drum rolling in that pulse</p>
    </article>
  </section>

  <section id="patches">
    <h2>New patches</h2>
    <p class="lede">Each clip plays one phrase cold, then hot. The exception is feral-reed: four passes of one phrase while the breath rises from whisper to feral without a break.</p>
    <div class="group"><h3>Breath reed · whisper to feral</h3><ul>${patches.filter(p => p.instrument === 'breath-reed').map(p => row(`p-${p.id}`, p.id, 'breath-reed', p.character, p.where)).join('')}</ul></div>
    <div class="group"><h3>Hand percussion · tight to cavernous</h3><ul>${patches.filter(p => p.instrument !== 'breath-reed').map(p => row(`p-${p.id}`, p.id, p.instrument.replace('organic-percussion/', ''), p.character, p.where)).join('')}</ul></div>
  </section>

  <section id="grooves">
    <h2>Hand grooves</h2>
    <p class="lede">Two bars each: the hands, a light kick and the groove's own bass line. Headphones help with the low drum; the slaps and the log are what a phone speaker carries.</p>
    <ul>${grooves.map(g => row(`g-${g.id}`, g.id, `${g.bpm} BPM · ${g.perc!.patch} + ${g.perc2!.patch}`, '', g.feel)).join('')}</ul>
  </section>
</div>
<div class="now" id="now" hidden><span id="now-name"></span><button id="stop">Stop</button></div>
<script>
const AUDIO = ${JSON.stringify(audio)};
const SECTIONS = ${JSON.stringify(sections.map(s => ({ id: s.id, from: +s.from.toFixed(3), to: +s.to.toFixed(3), note: s.note })))};
const TITLE = ${JSON.stringify(spec.title)};
const player = new Audio(); let current = null;
const $ = (s, r = document) => r.querySelector(s), fmt = t => Math.floor(t / 60) + ':' + String(Math.floor(t % 60)).padStart(2, '0');
function ui() {
  document.querySelectorAll('.play').forEach(b => b.classList.toggle('on', b.dataset.clip === current && !player.paused));
  $('#now').hidden = !current || player.paused;
  if (current) $('#now-name').textContent = current === 'track' ? TITLE : current.slice(2);
}
function play(id, at) {
  if (current === id) { if (at !== undefined) { player.currentTime = at; player.play().catch(() => {}); } else if (player.paused) player.play().catch(() => {}); else player.pause(); return; }
  current = id; player.src = 'data:audio/mpeg;base64,' + AUDIO[id];
  if (at !== undefined) player.addEventListener('loadedmetadata', () => { player.currentTime = at; }, { once: true });
  player.play().catch(() => {});
  document.querySelectorAll('.bar i').forEach(i => { i.style.width = '0'; });
}
function mark(t) {
  let i = SECTIONS.findIndex(s => t >= s.from && t < s.to); if (i < 0) i = SECTIONS.length - 1;
  document.querySelectorAll('.sec').forEach((b, k) => b.classList.toggle('cur', k === i));
  const w = $('#where'), s = SECTIONS[i];
  if (w.dataset.i !== String(i)) { w.dataset.i = String(i); w.textContent = ''; const b = document.createElement('b'); b.textContent = s.id; w.append(b, s.note); }
}
document.querySelectorAll('.play').forEach(b => b.addEventListener('click', () => play(b.dataset.clip)));
document.querySelectorAll('.sec').forEach(b => b.addEventListener('click', () => play('track', SECTIONS[+b.dataset.i].from)));
$('#stop').addEventListener('click', () => player.pause());
['play', 'pause', 'ended'].forEach(e => player.addEventListener(e, ui));
player.addEventListener('timeupdate', () => {
  if (!current || !player.duration) return;
  const f = player.currentTime / player.duration;
  if (current === 'track') { $('#seek').value = Math.round(f * 1000); $('#time').textContent = fmt(player.currentTime) + ' / ' + fmt(player.duration); mark(player.currentTime); }
  else { const btn = document.querySelector('.play[data-clip="' + current + '"]'), bar = btn && btn.parentElement.querySelector('.bar i'); if (bar) bar.style.width = (f * 100) + '%'; }
});
$('#seek').addEventListener('input', e => { if (current !== 'track') play('track'); if (player.duration) player.currentTime = (e.target.value / 1000) * player.duration; });
mark(0);
</script>
`;
writeFileSync(out, html);
console.log(`wrote ${out} (${(html.length / 1e6).toFixed(1)} MB; switch at ${switchAt.toFixed(1)} s; ${patches.length} patches, ${grooves.length} grooves)`);
