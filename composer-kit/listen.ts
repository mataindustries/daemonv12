/**
 * Builds the phone listening page (one self-contained HTML file, audio embedded):
 *   node composer-kit/listen.ts OUT.html
 * Palette auditions, groove auditions, then every sketch in composer-kit/sketches/ blind (maker hidden until reveal).
 * A sketch's maker comes from the optional "maker" field of its spec.
 */
import { spawnSync } from 'node:child_process';
import { existsSync, readdirSync, readFileSync, writeFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { join } from 'node:path';
import { PATCHES } from './palette.ts';
import { GROOVES } from './grooves.ts';

const HERE = new URL('.', import.meta.url).pathname, out = process.argv[2];
if (!out) { console.error('usage: node composer-kit/listen.ts OUT.html'); process.exit(2); }
/** Re-encode for the page so the whole file stays small enough for a phone. */
function b64(file: string, kbps: number): string {
  const r = spawnSync('ffmpeg', ['-hide_banner', '-nostdin', '-v', 'error', '-i', file, '-codec:a', 'libmp3lame', '-b:a', `${kbps}k`, '-map_metadata', '-1', '-f', 'mp3', '-'], { maxBuffer: 1 << 28 });
  if (r.status !== 0) throw new Error(`ffmpeg ${file}: ${r.stderr}`);
  return r.stdout.toString('base64');
}
const esc = (s: string) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
const audio: Record<string, string> = {};

const palette = PATCHES.filter(p => !p.internal).map(p => { audio[`p-${p.id}`] = b64(`${HERE}auditions/palette/${p.id}.mp3`, 80); return p; });
const grooves = GROOVES.map(g => { audio[`g-${g.id}`] = b64(`${HERE}auditions/grooves/${g.id}.mp3`, 80); return g; });
const sketches = readdirSync(`${HERE}sketches`).filter(f => f.endsWith('.spec.json')).map(f => {
  const spec = JSON.parse(readFileSync(`${HERE}sketches/${f}`, 'utf8')) as Record<string, any>, dir = `${HERE}sketches/${f.replace('.spec.json', '')}`;
  if (!existsSync(dir)) return null;
  const mp3 = readdirSync(dir).find(x => x.endsWith('.mp3')), score = JSON.parse(readFileSync(join(dir, 'score.json'), 'utf8')) as Record<string, any>;
  if (!mp3) return null;
  const owner = spec.hook ?? 'bass';
  return { key: createHash('sha256').update(String(spec.title)).digest('hex'), title: String(spec.title), maker: String(spec.maker ?? 'unknown'), world: String(spec.world ?? ''), file: join(dir, mp3),
    facts: `${score.key} · ${score.bpm} BPM · groove ${spec.groove}${spec.grooveB ? ` + ${spec.grooveB}` : ''} · form ${spec.sections ? 'own sections' : spec.form ?? 'stallion'} · hook on ${owner} (${spec.voices?.[owner]?.patch ?? 'groove bass'}) · moves: ${(score.kit?.log ?? []).join(', ') || 'none'}`,
    sections: (score.sections as { id: string; bars: number }[]).map(s => `${s.id} ${s.bars}`).join(' · ') };
}).filter(x => x !== null).sort((a, b) => a.key.localeCompare(b.key));
sketches.forEach((s, i) => { audio[`s-${i}`] = b64(s.file, 128); });

const FAMILY: [string, string][] = [['living-bass', 'Living Bass'], ['impossible-voice', 'Impossible Voice'], ['mechanical-orchestra', 'Mechanical Orchestra'], ['breath-reed', 'Breath Reed'], ['organic-percussion', 'Organic Percussion']];
const row = (id: string, name: string, meta: string, tag: string, text: string) =>
  `<li class="clip"><button class="play" data-clip="${id}" aria-label="Play ${esc(name)}"><span class="ico"></span></button><div class="body"><div class="top"><span class="name">${esc(name)}</span>${tag ? `<span class="tag t-${tag}">${tag}</span>` : ''}<span class="meta">${esc(meta)}</span></div><p>${esc(text)}</p><div class="bar"><i></i></div></div></li>`;

const html = `<title>Composer Kit Listening</title>
<meta name="claude:viewport-fit-sides" content="cover">
<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Bricolage+Grotesque:opsz,wght@12..96,500;12..96,700&family=IBM+Plex+Mono:wght@400;500&family=IBM+Plex+Sans:wght@400;500;600&display=swap">
<style>
/* layout: one phone-width column of channel strips; a fixed transport at the bottom while something plays */
:root {
  --bg: #e9ede8; --panel: #f7f9f5; --ink: #18221d; --muted: #5a675f; --line: #cdd5cd; --accent: #2743d6; --on-accent: #ffffff;
  --dirty: #a8481f; --rubbery: #6b3fc4; --mechanical: #3f6278; --glassy: #0f7f96; --broken: #b62a62; --human: #8f6410; --utility: #5d6b63;
  --display: "Bricolage Grotesque", "Space Grotesk", system-ui, sans-serif; --text: "IBM Plex Sans", system-ui, sans-serif; --mono: "IBM Plex Mono", ui-monospace, monospace;
}
@media (prefers-color-scheme: dark) { :root:not([data-theme="light"]) {
  --bg: #101613; --panel: #19221e; --ink: #e4ebe6; --muted: #98a69d; --line: #2c3833; --accent: #93a5ff; --on-accent: #0b1020;
  --dirty: #f0906a; --rubbery: #b79bff; --mechanical: #8fb4cc; --glassy: #63cfe4; --broken: #ff86b4; --human: #e3b85a; --utility: #9aa8a0; color-scheme: dark } }
:root[data-theme="dark"] {
  --bg: #101613; --panel: #19221e; --ink: #e4ebe6; --muted: #98a69d; --line: #2c3833; --accent: #93a5ff; --on-accent: #0b1020;
  --dirty: #f0906a; --rubbery: #b79bff; --mechanical: #8fb4cc; --glassy: #63cfe4; --broken: #ff86b4; --human: #e3b85a; --utility: #9aa8a0; color-scheme: dark }
body { background: var(--bg); color: var(--ink); font: 400 15px/1.5 var(--text); }
.wrap { max-width: 44rem; margin: 0 auto; padding-block: 1.5rem 7rem; padding-left: max(16px, env(safe-area-inset-left, 0px)); padding-right: max(16px, env(safe-area-inset-right, 0px)); display: flex; flex-direction: column; gap: 2.25rem; }
h1 { font: 700 clamp(2rem, 9vw, 3rem)/1 var(--display); letter-spacing: -0.02em; margin: 0; text-wrap: balance; }
h2 { font: 700 1.5rem/1.1 var(--display); margin: 0; }
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
.play:focus-visible, nav a:focus-visible, .btn:focus-visible, .pick:focus-visible, .seek:focus-visible { outline: 2px solid var(--accent); outline-offset: 2px; }
.ico { width: 0; height: 0; border-style: solid; border-width: 0.5rem 0 0.5rem 0.8rem; border-color: transparent transparent transparent var(--accent); margin-left: 0.2rem; }
.play.on { background: var(--accent); }
.play.on .ico { width: 0.8rem; height: 0.8rem; border: 0; margin: 0; background: linear-gradient(90deg, var(--on-accent) 0 35%, transparent 35% 65%, var(--on-accent) 65%); }
.bar { height: 2px; background: transparent; }
.bar i { display: block; height: 100%; width: 0; background: var(--accent); }
.sketch { background: var(--panel); border: 1px solid var(--line); border-radius: 14px; padding: 1rem; display: flex; flex-direction: column; gap: 0.9rem; }
.sk-top { display: flex; align-items: center; gap: 0.9rem; }
.sk-top .play { width: 3.5rem; height: 3.5rem; }
.letter { font: 700 2.25rem/1 var(--display); }
.sk-title { min-width: 0; flex: 1; display: flex; flex-direction: column; gap: 0.2rem; }
.time { font: 400 0.75rem/1 var(--mono); color: var(--muted); font-variant-numeric: tabular-nums; }
.seek { width: 100%; accent-color: var(--accent); margin: 0; height: 1.75rem; }
.pick { align-self: flex-start; font: 500 0.8rem/1 var(--mono); border: 1px solid var(--line); background: transparent; color: var(--ink); border-radius: 999px; padding: 0.6rem 0.9rem; cursor: pointer; }
.pick[aria-pressed="true"] { background: var(--ink); color: var(--bg); border-color: var(--ink); }
.reveal { border-top: 1px dashed var(--line); padding-top: 0.8rem; display: flex; flex-direction: column; gap: 0.35rem; }
.reveal b { font: 700 1.1rem/1.2 var(--display); }
.reveal .who { font: 500 0.75rem/1 var(--mono); letter-spacing: 0.08em; text-transform: uppercase; color: var(--accent); }
.reveal .facts { font: 400 0.75rem/1.5 var(--mono); color: var(--muted); }
.btn { font: 600 1rem/1 var(--text); background: var(--accent); color: var(--on-accent); border: 0; border-radius: 12px; padding: 1rem 1.2rem; cursor: pointer; }
.sketches { display: flex; flex-direction: column; gap: 1rem; }
.now { position: fixed; left: 0; right: 0; bottom: 0; background: var(--ink); color: var(--bg); display: flex; align-items: center; gap: 0.75rem; padding-block: 0.7rem calc(0.7rem + env(safe-area-inset-bottom, 0px)); padding-left: max(16px, env(safe-area-inset-left, 0px)); padding-right: max(16px, env(safe-area-inset-right, 0px)); }
.now span { font: 500 0.85rem/1.2 var(--mono); min-width: 0; flex: 1; overflow-wrap: anywhere; }
.now button { font: 600 0.85rem/1 var(--text); background: var(--bg); color: var(--ink); border: 0; border-radius: 999px; padding: 0.6rem 1rem; cursor: pointer; }
</style>
<div class="wrap">
  <header>
    <h3>DaemonV12 · Composer Kit</h3>
    <h1>Listen before you trust it</h1>
    <p>${palette.length} patches, ${grooves.length} grooves and ${sketches.length} blind sketches, all rendered by the unchanged Signature Rack. Nobody who made these could hear them. Your ears are the test. Headphones help: a lot of this lives below 100 Hz.</p>
    <nav><a href="#palette">Palette</a><a href="#grooves">Grooves</a><a href="#sketches">Blind sketches</a></nav>
  </header>

  <section id="palette">
    <h2>Palette</h2>
    <p class="lede">Each clip plays one phrase twice: first cold, then hot. A patch is a journey between those two bodies, so listen for how far it travels.</p>
    ${FAMILY.map(([fam, label]) => `<div class="group"><h3>${label}</h3><ul>${palette.filter(p => p.instrument.startsWith(fam)).map(p => row(`p-${p.id}`, p.id, p.instrument.replace('mechanical-orchestra/', ''), p.character, p.where)).join('')}</ul></div>`).join('\n    ')}
  </section>

  <section id="grooves">
    <h2>Grooves</h2>
    <p class="lede">Two bars each: kick, snare, clock hat and the groove's own bass line. None is four-on-the-floor.</p>
    <ul>${grooves.map(g => row(`g-${g.id}`, g.id, `${g.bpm} BPM · swing ${g.swing}`, '', g.feel)).join('')}</ul>
  </section>

  <section id="sketches">
    <h2>Blind sketches</h2>
    <p class="lede">About 40 seconds each, same loudness. One was made by the model that built the kit; the others by smaller models given only the skill and the kit. Mark the one you would play again, then reveal.</p>
    <div class="sketches">
    ${sketches.map((s, i) => `<article class="sketch" data-i="${i}">
      <div class="sk-top"><button class="play" data-clip="s-${i}" aria-label="Play sketch ${'ABCDEF'[i]}"><span class="ico"></span></button>
        <div class="sk-title"><span class="letter">Sketch ${'ABCDEF'[i]}</span><span class="time" id="time-${i}">0:00</span></div></div>
      <input class="seek" id="seek-${i}" type="range" min="0" max="1000" value="0" aria-label="Position in sketch ${'ABCDEF'[i]}">
      <button class="pick" id="pick-${i}" aria-pressed="false">I would play this again</button>
      <div class="reveal" hidden><span class="who">${esc(s.maker)}</span><b>${esc(s.title)}</b><p>${esc(s.world)}</p><p class="facts">${esc(s.facts)}</p><p class="facts">${esc(s.sections)}</p></div>
    </article>`).join('\n    ')}
    </div>
    <button class="btn" id="reveal">Reveal who made what</button>
  </section>
</div>
<div class="now" id="now" hidden><span id="now-name"></span><button id="stop">Stop</button></div>
<script>
const AUDIO = ${JSON.stringify(audio)};
const player = new Audio(); let current = null;
const $ = (s, r = document) => r.querySelector(s), fmt = t => Math.floor(t / 60) + ':' + String(Math.floor(t % 60)).padStart(2, '0');
function ui() {
  document.querySelectorAll('.play').forEach(b => b.classList.toggle('on', b.dataset.clip === current && !player.paused));
  $('#now').hidden = !current || player.paused;
  if (current) $('#now-name').textContent = current.startsWith('s-') ? 'Sketch ' + 'ABCDEF'[+current.slice(2)] : current.slice(2);
}
function play(id) {
  if (current === id) { player.paused ? player.play() : player.pause(); return; }
  current = id; player.src = 'data:audio/mpeg;base64,' + AUDIO[id]; player.play().catch(() => {});
  document.querySelectorAll('.bar i').forEach(i => { i.style.width = '0'; });
}
document.querySelectorAll('.play').forEach(b => b.addEventListener('click', () => play(b.dataset.clip)));
$('#stop').addEventListener('click', () => player.pause());
['play', 'pause', 'ended'].forEach(e => player.addEventListener(e, ui));
player.addEventListener('timeupdate', () => {
  if (!current || !player.duration) return;
  const f = player.currentTime / player.duration, btn = document.querySelector('.play[data-clip="' + current + '"]');
  if (current.startsWith('s-')) { const i = current.slice(2); $('#seek-' + i).value = Math.round(f * 1000); $('#time-' + i).textContent = fmt(player.currentTime) + ' / ' + fmt(player.duration); }
  else { const bar = btn && btn.parentElement.querySelector('.bar i'); if (bar) bar.style.width = (f * 100) + '%'; }
});
document.querySelectorAll('.seek').forEach(s => s.addEventListener('input', () => { const id = 's-' + s.id.slice(5); if (current !== id) play(id); if (player.duration) player.currentTime = (s.value / 1000) * player.duration; }));
let picks = {}; try { picks = JSON.parse(localStorage.getItem('kit-picks') || '{}'); } catch (e) {}
document.querySelectorAll('.pick').forEach(b => {
  const i = b.id.slice(5); b.setAttribute('aria-pressed', String(!!picks[i]));
  b.addEventListener('click', () => { picks[i] = !picks[i]; b.setAttribute('aria-pressed', String(picks[i])); try { localStorage.setItem('kit-picks', JSON.stringify(picks)); } catch (e) {} });
});
$('#reveal').addEventListener('click', e => { document.querySelectorAll('.reveal').forEach(r => { r.hidden = false; }); e.target.hidden = true; });
</script>
`;
writeFileSync(out, html);
console.log(`wrote ${out} (${(html.length / 1e6).toFixed(1)} MB, ${sketches.length} sketches: ${sketches.map((s, i) => `${'ABCDEF'[i]}=${s.maker}`).join(', ')})`);
