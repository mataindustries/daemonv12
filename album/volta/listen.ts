/**
 * Builds the Android listening page for track 3, Volta (one self-contained HTML file, audio embedded):
 *   node album/volta/listen.ts OUT.html
 * Reads volta.spec.json, render/score.json and render/volta.mp3, so every time and label on the page comes from the
 * build and not from this file. Same tokens and type as the Composer Kit listening page (composer-kit/listen.ts),
 * with a sunset accent for this track. Needs ffmpeg (the audio is re-encoded to 128 kbps to keep the page small).
 */
import { spawnSync } from 'node:child_process';
import { readFileSync, writeFileSync } from 'node:fs';

const HERE = new URL('.', import.meta.url).pathname, out = process.argv[2];
if (!out) { console.error('usage: node album/volta/listen.ts OUT.html'); process.exit(2); }

type Note = [number, number, string, number, Record<string, unknown>?];
interface Cell { bars: number; notes: Note[]; alt?: Note[] }
interface Spec { title: string; groove: string; voices: Record<string, { patch?: string; cell?: Cell }>; sections: { id: string; bars: number; heat: number }[]; moves: { move: string; section: string; heat?: number }[] }
interface Score { bpm: number; key: string; description: string; tailSeconds: number; sections: { id: string; bars: number; development: string }[]; kit: { log: string[] } }
const spec = JSON.parse(readFileSync(`${HERE}volta.spec.json`, 'utf8')) as Spec;
const score = JSON.parse(readFileSync(`${HERE}render/score.json`, 'utf8')) as Score;

function b64(file: string, kbps: number): string {
  const r = spawnSync('ffmpeg', ['-hide_banner', '-nostdin', '-v', 'error', '-i', file, '-codec:a', 'libmp3lame', '-b:a', `${kbps}k`, '-map_metadata', '-1', '-f', 'mp3', '-'], { maxBuffer: 1 << 28 });
  if (r.status !== 0) throw new Error(`ffmpeg ${file}: ${r.stderr}`);
  return r.stdout.toString('base64');
}
const esc = (s: string) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
const mmss = (t: number) => `${Math.floor(t / 60)}:${String(Math.floor(t % 60)).padStart(2, '0')}`;
const audio = b64(`${HERE}render/volta.mp3`, 128);

// ---- the sections, in seconds, drawn to scale
const beat = 60 / score.bpm, bar = 4 * beat;
let at = 0;
const sections = score.sections.map(s => {
  const from = at, heat = spec.sections.find(x => x.id === s.id)?.heat ?? 0;
  at += s.bars * bar;
  return { id: s.id, bars: s.bars, from, to: at, note: s.development, heat };
});
const total = at, file = total + score.tailSeconds, bars = sections.reduce((a, s) => a + s.bars, 0);
const sec = (id: string) => sections.find(s => s.id === id)!;
const heatLabel = (id: string) => {
  const rr = spec.moves.find(m => m.move === 'riffReturn' && m.section === id), h = sec(id).heat;
  return rr?.heat ? `${h} to ${rr.heat}` : `${h}`;
};

// ---- the cues: where each decision in the spec is heard
const lead = spec.voices.lead!.cell!, typed = spec.voices.answer!.cell!;
const whoop = lead.notes.find(n => n[4] && 'scoop' in n[4])![0], burst = typed.notes[0]![0], passBeats = lead.bars * 4;
const octB = sec('octave-b'), sestet = sec('sestet');
const cues = [
  { at: sec('octave-a').from, title: 'The ask', text: 'A C E D on four different vowels. It ends on D, so it should sound like a question. Does the voice talk?' },
  { at: sec('octave-a').from + whoop * beat, title: 'The whoop', text: 'One octave scoop, A up to A, the vowel sliding from oo to ee, then a hummed D. A human gesture, or a glitch?' },
  { at: octB.from + burst * beat, title: 'The typewriter', text: 'tk tk tk ding, in the voice’s rest and nowhere else. If you can hear it under the voice, that is a bug.' },
  { at: octB.to - 2 * bar, title: 'The lean', text: 'The ask again, a fourth higher, then a fifth. It should lean forward and not arrive.' },
  { at: sec('volta').from, title: 'The turn', text: 'The drummer is cut off mid-sentence. About four seconds of glass, on F instead of home. Is it too quiet on a phone speaker?' },
  { at: sestet.from, title: 'The return', text: 'The same lines with more breath. The first note should hit harder than anything before the turn.' },
  { at: sestet.from + (passBeats + whoop) * beat, title: 'The last question', text: 'A hummed E that falls, then the band stops on the bar line and the room rings out. It should feel like a question. Nothing should feel like home.' },
].map(c => ({ ...c, jump: Math.max(0, +(c.at - 0.5).toFixed(2)), at: +c.at.toFixed(2) }));

const moves = spec.moves.map(m => ({
  name: `${m.move} · ${m.section}`,
  why: ({
    liftEnding: 'The octave ends leaning forward, a fourth and then a fifth. The turn answers it with glass on F, not with the tonic.',
    negativeSpace: 'Six of the turn’s eight beats are glass and nothing else, so the return borrows the weight of the silence.',
    riffReturn: 'The voice was gone for the turn. The notes are known, so only its body changes: heat 0.6 to 0.9, more breath.',
  } as Record<string, string>)[m.move] ?? '',
}));
const calls = [
  ['The hook', 'The ask is spoken on a 3+3+2 figure that sits on the kicks, and no voice onset lands on a snare. One octave scoop with a vowel sweep is the late surprise. The cell ends on D and the answer on E, never on A: only track 6 may land home.'],
  ['The glass', 'The brief gave the pad no notes. It moves to F for the turn, the deceptive answer to the lift, and to D and A for the last two bars, so the glass never says A.'],
  ['The typewriter', 'A four-hit burst with a bell, only in the voice’s longest rest. In the first render the bell rang on into the voice, so the second moved it a full beat clear.'],
  ['The ending', 'The last note closes from oh to mm and falls. The band stops on the bar line and two seconds of room ring out.'],
  ['The length', `${bars} bars at ${score.bpm} BPM is ${total} s. The file is ${Math.round(file)} s with the room’s tail.`],
];

const html = `<title>Volta</title>
<meta name="claude:viewport-fit-sides" content="cover">
<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Bricolage+Grotesque:opsz,wght@12..96,500;12..96,700&family=IBM+Plex+Mono:wght@400;500&family=IBM+Plex+Sans:wght@400;500;600&display=swap">
<style>
/* layout: one phone column. The track card first (play, seek, the fourteen bars drawn to scale and coloured by heat), then seven things to listen for, then what was decided. */
:root {
  --bg: #e9ede8; --panel: #f7f9f5; --ink: #18221d; --muted: #55625a; --line: #cdd5cd; --accent: #a8431a; --on-accent: #ffffff;
  --seg-a: #3d6b7a; --seg-a-ink: #ffffff; --seg-b: #5d7440; --seg-b-ink: #ffffff; --seg-v: #d3e6e9; --seg-v-ink: #18221d; --seg-v-edge: #0f7f96; --seg-s: #b0451b; --seg-s-ink: #ffffff;
  --display: "Bricolage Grotesque", "Space Grotesk", system-ui, sans-serif; --text: "IBM Plex Sans", system-ui, sans-serif; --mono: "IBM Plex Mono", ui-monospace, monospace;
}
@media (prefers-color-scheme: dark) { :root:not([data-theme="light"]) {
  --bg: #101613; --panel: #19221e; --ink: #e4ebe6; --muted: #98a69d; --line: #2c3833; --accent: #f0906a; --on-accent: #1a0d07;
  --seg-a: #74b4c6; --seg-a-ink: #0b1316; --seg-b: #b4c77f; --seg-b-ink: #11160a; --seg-v: #1d3a41; --seg-v-ink: #d6f3f8; --seg-v-edge: #63cfe4; --seg-s: #f0906a; --seg-s-ink: #1a0d07; color-scheme: dark } }
:root[data-theme="dark"] {
  --bg: #101613; --panel: #19221e; --ink: #e4ebe6; --muted: #98a69d; --line: #2c3833; --accent: #f0906a; --on-accent: #1a0d07;
  --seg-a: #74b4c6; --seg-a-ink: #0b1316; --seg-b: #b4c77f; --seg-b-ink: #11160a; --seg-v: #1d3a41; --seg-v-ink: #d6f3f8; --seg-v-edge: #63cfe4; --seg-s: #f0906a; --seg-s-ink: #1a0d07; color-scheme: dark }
* { box-sizing: border-box; }
body { background: var(--bg); color: var(--ink); font: 400 16px/1.5 var(--text); -webkit-text-size-adjust: 100%; -webkit-tap-highlight-color: transparent; }
button { font: inherit; color: inherit; touch-action: manipulation; }
p, ol, dl, dd { margin: 0; }
.wrap { max-width: 40rem; margin: 0 auto; padding-block: 1.25rem 7rem; padding-left: max(16px, env(safe-area-inset-left, 0px)); padding-right: max(16px, env(safe-area-inset-right, 0px)); display: flex; flex-direction: column; gap: 2rem; }
header { display: flex; flex-direction: column; gap: 0.6rem; }
.eyebrow { font: 500 12px/1.3 var(--mono); letter-spacing: 0.12em; text-transform: uppercase; color: var(--muted); }
h1 { font: 700 clamp(3.25rem, 19vw, 5.5rem)/0.95 var(--display); letter-spacing: -0.035em; margin: 0; color: var(--accent); }
h2 { font: 700 1.4rem/1.15 var(--display); margin: 0; text-wrap: balance; }
.lede { color: var(--muted); max-width: 60ch; }
.facts { font: 400 13px/1.5 var(--mono); color: var(--muted); }
section { display: flex; flex-direction: column; gap: 0.9rem; }
.card { background: var(--panel); border: 1px solid var(--line); border-radius: 16px; padding: 16px; display: flex; flex-direction: column; gap: 14px; overflow: hidden; }
.top { display: flex; align-items: center; gap: 14px; }
.play { flex: none; width: 4rem; height: 4rem; border-radius: 50%; border: 0; background: var(--accent); display: grid; place-items: center; cursor: pointer; padding: 0; }
.ico { width: 0; height: 0; border-style: solid; border-width: 0.65rem 0 0.65rem 1.05rem; border-color: transparent transparent transparent var(--on-accent); margin-left: 0.25rem; }
.play.on .ico { width: 1.05rem; height: 1.15rem; border: 0; margin: 0; background: linear-gradient(90deg, var(--on-accent) 0 36%, transparent 36% 64%, var(--on-accent) 64%); }
.name { min-width: 0; flex: 1; display: flex; flex-direction: column; gap: 2px; }
.name b { font: 700 1.35rem/1.1 var(--display); }
.time { font: 400 14px/1.2 var(--mono); color: var(--muted); font-variant-numeric: tabular-nums; }
.seek { -webkit-appearance: none; appearance: none; width: 100%; height: 48px; margin: -6px 0; background: transparent; cursor: pointer; touch-action: manipulation; }
.seek::-webkit-slider-runnable-track { height: 4px; border-radius: 2px; background: linear-gradient(to right, var(--accent) var(--fill, 0%), var(--line) var(--fill, 0%)); }
.seek::-moz-range-track { height: 4px; border-radius: 2px; background: var(--line); }
.seek::-moz-range-progress { height: 4px; border-radius: 2px; background: var(--accent); }
.seek::-webkit-slider-thumb { -webkit-appearance: none; width: 28px; height: 28px; margin-top: -12px; border-radius: 50%; background: var(--accent); border: 4px solid var(--panel); box-shadow: 0 0 0 1px var(--accent); }
.seek::-moz-range-thumb { width: 20px; height: 20px; border-radius: 50%; background: var(--accent); border: 4px solid var(--panel); box-shadow: 0 0 0 1px var(--accent); }
.play:focus-visible, .seek:focus-visible, .sec:focus-visible, .cue:focus-visible, .chip:focus-visible, .now button:focus-visible { outline: 3px solid var(--accent); outline-offset: 2px; }
/* the map: widths are bars, so the turn is as narrow as it is short; the full-bleed band is the card's own width */
.mapwrap { margin-inline: -16px; display: flex; flex-direction: column; gap: 6px; }
.map { position: relative; display: flex; }
.sec { flex: var(--bars) 1 0%; min-width: 0; min-height: 60px; border: 0; border-left: 2px solid var(--panel); border-radius: 0; padding: 8px 5px; display: flex; flex-direction: column; justify-content: space-between; align-items: flex-start; gap: 2px; cursor: pointer; text-align: left; font: 500 12px/1.15 var(--mono); }
.sec:first-child { border-left: 0; }
.sec.cur { box-shadow: inset 0 -6px 0 var(--ink); }
.sec b { font-weight: 500; overflow-wrap: anywhere; }
.sec i { font-style: normal; font-size: 11px; }
.s-a { background: var(--seg-a); color: var(--seg-a-ink); } .s-b { background: var(--seg-b); color: var(--seg-b-ink); } .s-s { background: var(--seg-s); color: var(--seg-s-ink); }
.s-v { background: var(--seg-v); color: var(--seg-v-ink); box-shadow: inset 0 0 0 2px var(--seg-v-edge); }
.s-v.cur { box-shadow: inset 0 0 0 2px var(--seg-v-edge), inset 0 -6px 0 var(--ink); }
.legend { padding-inline: 16px; font: 400 12px/1.5 var(--mono); color: var(--muted); }
.head { position: absolute; top: -3px; bottom: -3px; left: calc(var(--p, 0) * 100%); width: 3px; margin-left: -1.5px; background: var(--ink); border-radius: 2px; pointer-events: none; }
.ruler { list-style: none; padding: 0; display: grid; grid-template-columns: repeat(${bars}, 1fr); font: 400 11px/1 var(--mono); color: var(--muted); font-variant-numeric: tabular-nums; }
.ruler li { text-align: center; padding-block: 3px; }
.ruler li.on { color: var(--accent); font-weight: 500; }
.where { font-size: 15px; min-height: 3.1em; }
.where b { display: block; font: 500 12px/1.4 var(--mono); letter-spacing: 0.06em; text-transform: uppercase; color: var(--accent); }
.row { display: flex; flex-wrap: wrap; align-items: center; gap: 10px; }
.chip { min-height: 48px; padding: 0 18px; border-radius: 999px; border: 1.5px solid var(--line); background: transparent; font: 500 14px/1 var(--mono); cursor: pointer; }
.chip[aria-pressed="true"] { background: var(--ink); color: var(--bg); border-color: var(--ink); }
.cues { list-style: none; padding: 0; border-top: 1px solid var(--line); }
.cue { display: grid; grid-template-columns: 3.1rem minmax(0, 1fr) 2.5rem; gap: 12px; align-items: start; width: 100%; min-height: 64px; padding: 14px 4px; background: transparent; border: 0; border-bottom: 1px solid var(--line); text-align: left; cursor: pointer; }
.cue .t { font: 500 14px/1.5 var(--mono); color: var(--accent); font-variant-numeric: tabular-nums; }
.cue b { display: block; font: 600 16px/1.35 var(--text); }
.cue .c span { display: block; font-size: 14px; color: var(--muted); }
.cue .go { width: 2.5rem; height: 2.5rem; border-radius: 50%; border: 1.5px solid var(--accent); display: grid; place-items: center; }
.cue .go::before { content: ""; border-style: solid; border-width: 0.4rem 0 0.4rem 0.65rem; border-color: transparent transparent transparent var(--accent); margin-left: 0.15rem; }
.cue.on { background: var(--panel); box-shadow: inset 3px 0 0 var(--accent); }
.dl { display: flex; flex-direction: column; border-top: 1px solid var(--line); }
.dl + h3 { margin-top: 0.9rem; }
.dl > div { display: flex; flex-direction: column; gap: 4px; padding-block: 12px; border-bottom: 1px solid var(--line); }
.dl dt { font: 500 13px/1.4 var(--mono); color: var(--accent); }
h3 { font: 500 12px/1.3 var(--mono); letter-spacing: 0.12em; text-transform: uppercase; color: var(--muted); margin: 0; }
.dl dd { font-size: 15px; }
.fine { font-size: 13px; color: var(--muted); max-width: 60ch; }
.now { position: fixed; left: 0; right: 0; bottom: 0; background: var(--ink); color: var(--bg); display: flex; align-items: center; gap: 12px; padding-block: 8px calc(8px + env(safe-area-inset-bottom, 0px)); padding-left: max(16px, env(safe-area-inset-left, 0px)); padding-right: max(16px, env(safe-area-inset-right, 0px)); }
.now span { font: 500 14px/1.2 var(--mono); min-width: 0; flex: 1; overflow-wrap: anywhere; font-variant-numeric: tabular-nums; }
.now button { min-height: 48px; min-width: 88px; font: 600 15px/1 var(--text); background: var(--bg); color: var(--ink); border: 0; border-radius: 999px; padding: 0 20px; cursor: pointer; }
@media (prefers-reduced-motion: reduce) { * { scroll-behavior: auto !important; } }
</style>
<div class="wrap">
  <header>
    <p class="eyebrow">Weights &amp; Measures · Track 3 of 6</p>
    <h1>Volta</h1>
    <p class="lede">${esc(score.description)}</p>
    <p class="facts">${esc(score.key)} · ${score.bpm} BPM · ${esc(spec.groove)} · ${bars} bars, ${total} s · honours Sonnet</p>
  </header>

  <section aria-label="The track">
    <div class="card">
      <div class="top">
        <button class="play" id="play" aria-label="Play Volta"><span class="ico"></span></button>
        <div class="name"><b>Volta</b><span class="time" id="time">0:00 / ${mmss(file)}</span></div>
      </div>
      <input class="seek" id="seek" type="range" min="0" max="1000" value="0" aria-label="Position in the track">
      <div class="mapwrap">
        <div class="map" id="map" role="group" aria-label="The four sections, drawn to scale">
          ${sections.map((s, i) => `<button class="sec s-${s.id === 'volta' ? 'v' : s.id.endsWith('-a') ? 'a' : s.id.endsWith('-b') ? 'b' : 's'}" data-i="${i}" style="--bars:${s.bars}" aria-label="Play ${esc(s.id)} from ${mmss(s.from)}"><b>${esc(s.id)}</b><i>${esc(heatLabel(s.id))}</i></button>`).join('')}
          <div class="head" id="head"></div>
        </div>
        <ol class="ruler" id="ruler" aria-hidden="true">${Array.from({ length: bars }, (_, i) => `<li>${i + 1}</li>`).join('')}</ol>
        <p class="legend">Fourteen bars, one line each: eight of octave, two of turn, four of sestet. The number in each block is its heat, 0 cold to 1 hot.</p>
      </div>
      <p class="where" id="where"><b>${esc(sections[0]!.id)}</b>${esc(sections[0]!.note)}</p>
      <div class="row"><button class="chip" id="loop" aria-pressed="false">Loop</button></div>
      <p class="time" id="msg" hidden></p>
    </div>
  </section>

  <section id="cues">
    <h2>Listen for</h2>
    <p class="lede">Nobody who made this could hear it, so your ears are the test. Each row jumps to half a second before the moment.</p>
    <ol class="cues">${cues.map((c, i) => `<li><button class="cue" data-i="${i}"><span class="t">${mmss(Math.round(c.at))}</span><span class="c"><b>${esc(c.title)}</b><span>${esc(c.text)}</span></span><span class="go" aria-hidden="true"></span></button></li>`).join('')}</ol>
  </section>

  <section id="decided">
    <h2>What was decided</h2>
    <h3>The three moves the brief named</h3>
    <dl class="dl">${moves.map(m => `<div><dt>${esc(m.name)}</dt><dd>${esc(m.why)}</dd></div>`).join('')}</dl>
    <h3>Where the brief was silent</h3>
    <dl class="dl">${calls.map(([k, v]) => `<div><dt>${esc(k!)}</dt><dd>${esc(v!)}</dd></div>`).join('')}</dl>
    <p class="fine">Checked on the audio: the scoop is a full octave, the lifted notes are on pitch, the turn sits at about −22 dBFS against −14 for the groove, and the typewriter is back to the groove’s floor within a quarter beat of the voice returning. Not checked: how any of it sounds.</p>
    <p class="fine">Unofficial fan tribute made with the DaemonV12 Composer Kit. Not affiliated with or endorsed by Anthropic.</p>
  </section>
</div>
<div class="now" id="now" hidden><span id="now-name"></span><button id="stop">Pause</button></div>
<audio id="player" preload="auto"></audio>
<script>
const AUDIO = ${JSON.stringify(audio)};
const SECTIONS = ${JSON.stringify(sections.map(s => ({ id: s.id, from: +s.from.toFixed(3), to: +s.to.toFixed(3), bars: s.bars, note: s.note })))};
const CUES = ${JSON.stringify(cues.map(c => ({ at: c.at, jump: c.jump })))};
const BAR = ${bar}, TOTAL = ${total};
const $ = (s, r = document) => r.querySelector(s), $$ = (s, r = document) => Array.from(r.querySelectorAll(s));
const fmt = t => Math.floor(t / 60) + ':' + String(Math.floor(t % 60)).padStart(2, '0');
const player = $('#player'), seek = $('#seek');
let dragging = false, raf = 0;
player.addEventListener('error', () => { const m = $('#msg'); m.hidden = false; m.textContent = 'The audio did not load in this browser.'; });
player.src = 'data:audio/mpeg;base64,' + AUDIO;

function sectionAt(t) { const i = SECTIONS.findIndex(s => t >= s.from && t < s.to); return i < 0 ? SECTIONS.length - 1 : i; }
function paint() {
  const t = player.currentTime || 0, d = player.duration || ${file}, i = sectionAt(t), p = Math.min(1, t / TOTAL);
  $('#map').style.setProperty('--p', p);
  if (!dragging) { seek.value = Math.round(Math.min(1, t / d) * 1000); seek.style.setProperty('--fill', (t / d * 100) + '%'); }
  $('#time').textContent = fmt(t) + ' / ' + fmt(d);
  $('#now-name').textContent = 'Volta \\u00b7 ' + fmt(t);
  $$('.sec').forEach((b, k) => b.classList.toggle('cur', k === i));
  const bar = Math.min(${bars}, Math.floor(t / BAR)) ;
  $$('#ruler li').forEach((li, k) => li.classList.toggle('on', t < TOTAL && k === bar));
  const w = $('#where'), s = SECTIONS[i];
  if (w.dataset.i !== String(i)) { w.dataset.i = String(i); w.textContent = ''; const b = document.createElement('b'); b.textContent = s.id; w.append(b, s.note); }
  let c = -1; CUES.forEach((q, k) => { if (t + 0.2 >= q.at) c = k; });
  $$('.cue').forEach((b, k) => b.classList.toggle('on', k === c && !player.paused));
}
function ui() {
  const playing = !player.paused;
  $('#play').classList.toggle('on', playing); $('#play').setAttribute('aria-label', playing ? 'Pause Volta' : 'Play Volta');
  $('#now').hidden = !playing; paint();
  cancelAnimationFrame(raf); if (playing) raf = requestAnimationFrame(function tick() { paint(); raf = requestAnimationFrame(tick); });
}
function go(at) { if (at !== undefined) player.currentTime = at; player.play().catch(() => {}); }
$('#play').addEventListener('click', () => { if (player.paused) go(player.ended ? 0 : undefined); else player.pause(); });
$('#stop').addEventListener('click', () => player.pause());
$$('.sec').forEach(b => b.addEventListener('click', () => go(SECTIONS[+b.dataset.i].from)));
$$('.cue').forEach(b => b.addEventListener('click', () => go(CUES[+b.dataset.i].jump)));
$('#loop').addEventListener('click', e => { player.loop = !player.loop; e.currentTarget.setAttribute('aria-pressed', String(player.loop)); });
seek.addEventListener('input', () => { dragging = true; seek.style.setProperty('--fill', (seek.value / 10) + '%'); if (player.duration) $('#time').textContent = fmt(seek.value / 1000 * player.duration) + ' / ' + fmt(player.duration); });
seek.addEventListener('change', () => { dragging = false; if (player.duration) player.currentTime = seek.value / 1000 * player.duration; paint(); });
['play', 'pause', 'ended', 'seeked', 'loadedmetadata'].forEach(e => player.addEventListener(e, ui));
try { if ('mediaSession' in navigator) {
  navigator.mediaSession.metadata = new MediaMetadata({ title: 'Volta', artist: 'DaemonV12 Composer Kit', album: 'Weights & Measures \\u00b7 track 3 of 6' });
  const h = (a, f) => { try { navigator.mediaSession.setActionHandler(a, f); } catch (e) {} };
  h('play', () => go()); h('pause', () => player.pause());
  h('seekbackward', () => { player.currentTime = Math.max(0, player.currentTime - 5); }); h('seekforward', () => { player.currentTime = Math.min(player.duration || 0, player.currentTime + 5); });
  h('seekto', d => { player.currentTime = d.seekTime; });
} } catch (e) {}
paint();
</script>
`;
writeFileSync(out, html);
console.log(`wrote ${out} (${(html.length / 1e6).toFixed(2)} MB; ${sections.length} sections, ${cues.length} cues; cues at ${cues.map(c => mmss(Math.round(c.at))).join(' ')})`);
