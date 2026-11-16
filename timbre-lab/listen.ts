/**
 * Builds the phone listening page for the Timbre Lab auditions: one self-contained HTML file, audio embedded.
 *   node timbre-lab/listen.ts OUT.html
 */
import { readFileSync, writeFileSync } from 'node:fs';
import { ORGANIC_PERCUSSION } from './skin.ts';
import { BREATH_REED } from './reed.ts';

const HERE = new URL('.', import.meta.url).pathname, out = process.argv[2];
if (!out) { console.error('usage: node timbre-lab/listen.ts OUT.html'); process.exit(2); }
interface ClipInfo { id: string; family: string; compare: boolean; title: string; listen: string; bpm: number; key: string; bars: number; instruments: string[] }
const { clips } = JSON.parse(readFileSync(`${HERE}auditions/auditions.json`, 'utf8')) as { clips: ClipInfo[] };
const esc = (s: string) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
const b64 = (id: string) => readFileSync(`${HERE}auditions/${id}.mp3`).toString('base64');

const families = [
  { id: 'organic-percussion', name: 'Organic percussion', macro: 'tight → cavernous', instruments: ORGANIC_PERCUSSION,
    what: 'A hand or mallet is a mass that collides with a skin, a wooden tongue or a clay pot. How hard, where and with what it lands decides the sound; a hand that stays mutes it, a squeeze bends it, a wet finger makes it moan.' },
  { id: 'breath-reed', name: 'Breath reed', macro: 'whisper → feral', instruments: [BREATH_REED],
    what: 'A reed blown against a column of air. Breath pressure decides between air, an unsteady soft tone and a bark; one player carries legato, tongue, growl, flutter, bends and a register break across the notes.' },
];
const clip = (c: ClipInfo, n: number) => `
    <article class="clip${c.compare ? ' compare' : ''}">
      <p class="tag">${c.compare ? 'Existing rack' : `Clip ${n}`}<span>${esc(c.key)} · ${c.bpm} BPM · ${c.bars} bars</span></p>
      <h3>${esc(c.title)}</h3>
      <audio id="a-${c.id}" controls preload="metadata" src="data:audio/mpeg;base64,${b64(c.id)}"></audio>
      <p class="listen">${esc(c.listen)}</p>
      <p class="uses">${c.instruments.map(i => `<code>${esc(i)}</code>`).join(' ')}</p>
    </article>`;
const section = (f: typeof families[number]) => {
  const own = clips.filter(c => c.family === f.id && !c.compare), cmp = clips.filter(c => c.family === f.id && c.compare);
  return `
  <section id="${f.id}">
    <header class="fam">
      <p class="macro">${esc(f.macro)}</p>
      <h2>${esc(f.name)}</h2>
      <p class="what">${esc(f.what)}</p>
      <ul class="inst">${f.instruments.map(i => `<li><b>${esc(i.name)}</b> <code>${esc(i.id)}</code><span>${Object.keys(i.articulations).map(esc).join(' · ')}</span></li>`).join('')}</ul>
    </header>${own.map((c, i) => clip(c, i + 1)).join('')}${cmp.map(c => clip(c, 0)).join('')}
  </section>`;
};

const html = `<title>Timbre Lab Auditions</title>
<meta name="claude:viewport-fit-sides" content="cover">
<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600&family=Space+Grotesk:wght@500;700&display=swap">
<style>
/* layout: one reading column; each family opens with a quiet header, then its clips as plain rows; the comparison clip is set apart by a dashed rule */
:root { --bg: #eef0ec; --surface: #f8f9f6; --fg: #18211d; --muted: #5b6861; --line: #cfd6cf; --accent: #1d6b58; --compare: #7a5a2b;
  --display: "Space Grotesk", "Inter", system-ui, sans-serif; --body: "Inter", system-ui, -apple-system, "Segoe UI", Roboto, sans-serif; --mono: ui-monospace, "SF Mono", Menlo, Consolas, monospace; }
@media (prefers-color-scheme: dark) { :root:not([data-theme="light"]) { --bg: #121815; --surface: #19211d; --fg: #e6ebe6; --muted: #98a59e; --line: #2c3731; --accent: #6fcdb2; --compare: #d3a765; color-scheme: dark } }
:root[data-theme="dark"] { --bg: #121815; --surface: #19211d; --fg: #e6ebe6; --muted: #98a59e; --line: #2c3731; --accent: #6fcdb2; --compare: #d3a765; color-scheme: dark }
body { background: var(--bg); color: var(--fg); font: 400 1rem/1.55 var(--body); padding-block: 1.5rem 3rem; padding-left: max(16px, env(safe-area-inset-left, 0px)); padding-right: max(16px, env(safe-area-inset-right, 0px)); }
main { max-width: 40rem; margin: 0 auto; display: flex; flex-direction: column; gap: 2.5rem; }
h1, h2, h3 { font-family: var(--display); text-wrap: balance; margin: 0; line-height: 1.15; }
h1 { font-size: 1.9rem; font-weight: 700; letter-spacing: -0.01em; }
h2 { font-size: 1.45rem; font-weight: 700; }
h3 { font-size: 1.1rem; font-weight: 500; }
p { margin: 0; }
code { font: 0.8em var(--mono); color: var(--muted); overflow-wrap: anywhere; }
.intro { display: flex; flex-direction: column; gap: 0.75rem; }
.intro p { color: var(--muted); max-width: 34rem; }
.intro nav { display: flex; flex-wrap: wrap; gap: 0.5rem 1.25rem; font-weight: 500; }
a { color: var(--accent); text-underline-offset: 0.2em; }
a:focus-visible, audio:focus-visible { outline: 2px solid var(--accent); outline-offset: 3px; }
section { display: flex; flex-direction: column; gap: 1.25rem; }
.fam { display: flex; flex-direction: column; gap: 0.6rem; padding-top: 1.25rem; border-top: 2px solid var(--fg); }
.macro, .tag { font: 600 0.72rem var(--body); letter-spacing: 0.08em; text-transform: uppercase; color: var(--accent); }
.what { max-width: 34rem; }
.inst { list-style: none; margin: 0; padding: 0; display: flex; flex-direction: column; gap: 0.5rem; font-size: 0.9rem; }
.inst li { display: flex; flex-wrap: wrap; gap: 0.1rem 0.5rem; align-items: baseline; min-width: 0; }
.inst span { flex-basis: 100%; color: var(--muted); }
.clip { display: flex; flex-direction: column; gap: 0.6rem; padding: 1rem; background: var(--surface); border: 1px solid var(--line); border-radius: 6px; min-width: 0; }
.clip.compare { background: transparent; border-style: dashed; border-color: var(--compare); }
.clip.compare .tag { color: var(--compare); }
.tag { display: flex; flex-wrap: wrap; justify-content: space-between; gap: 0.25rem 1rem; }
.tag span { color: var(--muted); font-weight: 500; letter-spacing: 0.02em; text-transform: none; font-variant-numeric: tabular-nums; }
audio { width: 100%; height: 2.75rem; }
.listen { font-size: 0.95rem; }
.uses { display: flex; flex-wrap: wrap; gap: 0.25rem 0.75rem; }
footer { color: var(--muted); font-size: 0.85rem; border-top: 1px solid var(--line); padding-top: 1rem; }
</style>
<main>
  <div class="intro">
    <h1>Timbre Lab Auditions</h1>
    <p>Two new instrument families for the DaemonV12 rack, each built as a new synthesis engine. Four short clips per family, then the closest sound the rack already had playing the same notes. Headphones help: the drums are quiet between hits on purpose.</p>
    <nav>${families.map(f => `<a href="#${f.id}">${esc(f.name)}</a>`).join('')}</nav>
  </div>${families.map(section).join('')}
  <footer>Rendered by <code>node timbre-lab/audition.ts</code>. Percussion clips share one loudness, reed clips another, so each comparison is level-matched. Nothing here is approved or in the Composer Kit yet.</footer>
</main>
<script>
// one clip at a time
const players = [...document.querySelectorAll('audio')];
players.forEach(p => p.addEventListener('play', () => players.forEach(q => { if (q !== p) q.pause(); })));
</script>
`;
writeFileSync(out, html);
console.log(`wrote ${out} (${(html.length / 1048576).toFixed(1)} MB, ${clips.length} clips)`);
