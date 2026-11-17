/**
 * DaemonV12 / ENM Studio sonic logo: three stings rendered by the unchanged Signature Rack with the Timbre Lab
 * instruments registered, each normalised to -16 LUFS integrated (true peak at most -1 dBTP), then the phone listening page.
 *   node promo/sonic-logo/build.ts                 # renders promo/sonic-logo/render/*.mp3 + *.wav, render.json, listen.html
 *   node promo/sonic-logo/build.ts --page-only     # rebuilds listen.html from the existing renders
 */
import '../../timbre-lab/register.ts';
import { spawnSync } from 'node:child_process';
import { mkdtempSync, mkdirSync, readFileSync, writeFileSync, copyFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

const HERE = new URL('.', import.meta.url).pathname, OUT = join(HERE, 'render'), TARGET_LUFS = -16;
const FFMPEG = process.env.DAEMONV12_FFMPEG || 'ffmpeg';
function ff(args: string[]) { const r = spawnSync(FFMPEG, ['-hide_banner', '-nostdin', '-v', 'error', '-y', ...args], { encoding: 'utf8' }); if (r.status !== 0) throw new Error(`ffmpeg: ${r.stderr}`); }

export const VARIANTS = [
  { id: 'full', file: 'full.score.json', name: 'Full', use: 'Intros, title cards, the front of a trailer.' },
  { id: 'short', file: 'short.score.json', name: 'Short', use: 'Bumpers, app sounds, anywhere a second and a half is all you get.' },
  { id: 'tail', file: 'tail.score.json', name: 'Quiet tail', use: 'The last thing in a video: the same two syllables, hummed, into a long halo.' },
] as const;

interface Info { id: string; name: string; use: string; title: string; description: string; seconds: number; lufs: number; truePeakDb: number; rawLufs: number; normalizeGainDb: number; mp3: string; wav: string }

async function render(): Promise<Info[]> {
  const { renderToDirectory, loudness } = await import('../../studio-001/rack/cli.ts');
  mkdirSync(OUT, { recursive: true });
  const infos: Info[] = [];
  for (const v of VARIANTS) {
    const score = JSON.parse(readFileSync(join(HERE, v.file), 'utf8')) as { title: string; description: string };
    const work = mkdtempSync(join(tmpdir(), 'logo-')), out = join(work, 'out');
    try {
      const r = await renderToDirectory(join(HERE, v.file), out, { normalize: TARGET_LUFS, mp3: false, log: s => console.log(`  ${v.id}: ${s}`) });
      const meta = JSON.parse(readFileSync(join(out, 'render.json'), 'utf8')) as { normalizeGainDb: number };
      const seconds = +(r.frames / 44100).toFixed(3), mixed = join(out, 'mix-context.wav'), wav = join(OUT, `${v.id}.wav`), mp3 = join(OUT, `${v.id}.mp3`);
      // The rack cuts at the end of its tail; a 60 ms fade keeps that cut from clicking on a phone speaker.
      // The rack stops its gain where the true peak would pass -1 dBTP. A sting is all transient, so the last few dB to
      // the target come from a short look-ahead limiter on the hits only; two passes land the integrated figure.
      let gainDb = 0;
      for (let pass = 0; pass < 2; pass++) {
        const l0 = loudness(pass === 0 ? mixed : wav)!; gainDb += TARGET_LUFS - l0.lufs;
        ff(['-i', mixed, '-af', `volume=${gainDb.toFixed(3)}dB,alimiter=limit=0.891:attack=2:release=80:level=false,afade=t=out:st=${(seconds - 0.06).toFixed(3)}:d=0.06`, '-c:a', 'pcm_s24le', wav]);
      }
      ff(['-i', wav, '-codec:a', 'libmp3lame', '-b:a', '192k', '-map_metadata', '-1', '-fflags', '+bitexact', '-flags:a', '+bitexact', mp3]);
      const l = loudness(wav)!;
      infos.push({ id: v.id, name: v.name, use: v.use, title: score.title, description: score.description, seconds, lufs: l.lufs, truePeakDb: l.truePeakDb, rawLufs: +(l.lufs - meta.normalizeGainDb - gainDb).toFixed(1), normalizeGainDb: +(meta.normalizeGainDb + gainDb).toFixed(3), mp3: `render/${v.id}.mp3`, wav: `render/${v.id}.wav` });
      copyFileSync(join(out, 'performance.json'), join(OUT, `${v.id}.performance.json`));
      console.log(`${v.id}: ${seconds} s, ${l.lufs} LUFS, true peak ${l.truePeakDb} dBTP (raw ${infos.at(-1)!.rawLufs} LUFS, gain ${(meta.normalizeGainDb + gainDb).toFixed(2)} dB, limiter ${gainDb.toFixed(2)} dB)`);
    } finally { rmSync(work, { recursive: true, force: true }); }
  }
  writeFileSync(join(OUT, 'render.json'), JSON.stringify({ schema: 'daemonv12.sonic-logo.render/1', targetLufs: TARGET_LUFS, node: process.version, variants: infos }, null, 2) + '\n');
  return infos;
}

function page(infos: Info[]) {
  const b64 = (file: string) => { const r = spawnSync(FFMPEG, ['-hide_banner', '-nostdin', '-v', 'error', '-i', file, '-codec:a', 'libmp3lame', '-b:a', '128k', '-map_metadata', '-1', '-f', 'mp3', '-'], { maxBuffer: 1 << 26 }); if (r.status !== 0) throw new Error(`ffmpeg ${file}: ${r.stderr}`); return r.stdout.toString('base64'); };
  const esc = (s: string) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
  const audio = Object.fromEntries(infos.map(i => [i.id, b64(join(HERE, i.mp3))]));
  const html = `<!doctype html>
<html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">
<title>DaemonV12 Sonic Logo</title>
<meta name="description" content="Three variants of the DaemonV12 / ENM Studio signature sting, rendered at -16 LUFS.">
<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Bricolage+Grotesque:opsz,wght@12..96,500;12..96,700&family=IBM+Plex+Mono:wght@400;500&family=IBM+Plex+Sans:wght@400;500;600&display=swap">
<style>
:root { --bg: #e9ede8; --panel: #f7f9f5; --ink: #18221d; --muted: #5a675f; --line: #cdd5cd; --accent: #2743d6; --on-accent: #ffffff; --glassy: #0f7f96; --human: #8f6410;
  --display: "Bricolage Grotesque", system-ui, sans-serif; --text: "IBM Plex Sans", system-ui, sans-serif; --mono: "IBM Plex Mono", ui-monospace, monospace; }
@media (prefers-color-scheme: dark) { :root:not([data-theme="light"]) { --bg: #101613; --panel: #19221e; --ink: #e4ebe6; --muted: #98a69d; --line: #2c3833; --accent: #93a5ff; --on-accent: #0b1020; --glassy: #63cfe4; --human: #e3b85a; color-scheme: dark } }
:root[data-theme="dark"] { --bg: #101613; --panel: #19221e; --ink: #e4ebe6; --muted: #98a69d; --line: #2c3833; --accent: #93a5ff; --on-accent: #0b1020; --glassy: #63cfe4; --human: #e3b85a; color-scheme: dark }
* { box-sizing: border-box } html, body { margin: 0 } body { background: var(--bg); color: var(--ink); font: 400 15px/1.5 var(--text); -webkit-text-size-adjust: 100% }
.wrap { max-width: 40rem; margin: 0 auto; padding-block: 1.5rem 3rem; padding-left: max(16px, env(safe-area-inset-left, 0px)); padding-right: max(16px, env(safe-area-inset-right, 0px)); display: flex; flex-direction: column; gap: 1.75rem }
h1 { font: 700 clamp(2rem, 9vw, 3rem)/1 var(--display); letter-spacing: -0.02em; margin: 0; text-wrap: balance } h2 { font: 700 1.2rem/1.1 var(--display); margin: 0 }
h3 { font: 500 0.72rem/1 var(--mono); letter-spacing: 0.12em; text-transform: uppercase; color: var(--muted); margin: 0 } p { margin: 0 } header { display: flex; flex-direction: column; gap: 0.75rem } header p, .lede { color: var(--muted); max-width: 60ch }
.card { background: var(--panel); border: 1px solid var(--line); border-radius: 14px; padding: 1rem; display: flex; flex-direction: column; gap: 0.75rem }
.top { display: flex; align-items: center; gap: 0.9rem } .play { flex: none; width: 3.5rem; height: 3.5rem; border-radius: 50%; border: 1.5px solid var(--accent); background: transparent; display: grid; place-items: center; cursor: pointer; padding: 0 }
.play:focus-visible, .loop:focus-visible { outline: 2px solid var(--accent); outline-offset: 2px }
.ico { width: 0; height: 0; border-style: solid; border-width: 0.6rem 0 0.6rem 1rem; border-color: transparent transparent transparent var(--accent); margin-left: 0.25rem }
.play.on { background: var(--accent) } .play.on .ico { width: 1rem; height: 1rem; border: 0; margin: 0; background: linear-gradient(90deg, var(--on-accent) 0 35%, transparent 35% 65%, var(--on-accent) 65%) }
.title { min-width: 0; flex: 1; display: flex; flex-direction: column; gap: 0.2rem } .meta { font: 400 0.75rem/1.4 var(--mono); color: var(--muted); font-variant-numeric: tabular-nums }
.card p { font-size: 0.9rem; color: var(--muted) } .bar { height: 3px; background: var(--line); border-radius: 2px; overflow: hidden } .bar i { display: block; height: 100%; width: 0; background: var(--accent) }
.row { display: flex; flex-wrap: wrap; gap: 0.5rem; align-items: center } .loop { font: 500 0.8rem/1 var(--mono); border: 1px solid var(--line); background: transparent; color: var(--ink); border-radius: 999px; padding: 0.55rem 0.85rem; cursor: pointer }
.loop[aria-pressed="true"] { background: var(--ink); color: var(--bg); border-color: var(--ink) } .use { font: 500 0.8rem/1.3 var(--text); color: var(--ink) }
.map { display: grid; grid-template-columns: 1fr; gap: 0.4rem; font: 400 0.8rem/1.4 var(--mono); color: var(--muted) } .map b { color: var(--ink); font-weight: 500 } .map .h { color: var(--human) } .map .g { color: var(--glassy) }
table { border-collapse: collapse; width: 100%; font: 400 0.78rem/1.4 var(--mono) } td, th { text-align: left; padding: 0.4rem 0.5rem 0.4rem 0; border-bottom: 1px solid var(--line); vertical-align: top } th { color: var(--muted); font-weight: 500 } td.n { font-variant-numeric: tabular-nums; white-space: nowrap }
</style></head><body>
<div class="wrap">
  <header>
    <h3>DaemonV12 · ENM Studio</h3>
    <h1>The sonic logo</h1>
    <p>Two syllables: a clay pot and a hand on a skin say the first, a voice cries the second and turns to glass. Organic body, digital edge. Three cuts, all at -16 LUFS. Headphones or a decent speaker: the first syllable lives under 200 Hz and a phone will only hint at it.</p>
  </header>
  ${infos.map(i => `<article class="card">
    <div class="top"><button class="play" data-clip="${i.id}" aria-label="Play ${esc(i.name)}"><span class="ico"></span></button>
      <div class="title"><h2>${esc(i.name)}</h2><span class="meta">${i.seconds.toFixed(2)} s · ${i.lufs.toFixed(1)} LUFS · peak ${i.truePeakDb.toFixed(1)} dBTP</span></div></div>
    <div class="bar"><i></i></div>
    <p class="use">${esc(i.use)}</p>
    <p>${esc(i.description)}</p>
    <div class="row"><button class="loop" data-loop="${i.id}" aria-pressed="false">Loop with 2 s of silence</button></div>
  </article>`).join('\n  ')}
  <section class="card">
    <h3>What you are hearing</h3>
    <div class="map">
      <div><b>0.00 s</b> <span class="h">clay pot</span> whoops up to D3 while a palm booms the skin on D2: the organic syllable.</div>
      <div><b>0.25 s</b> a slap on the skin and <span class="h">two knuckle knocks</span> on the hollow log, D4 then A4: the machine tick.</div>
      <div><b>0.50 s</b> the <span class="g">impossible voice</span> cries up to A4 with a reed bark under it, then slides to D5 as the human macro runs to impossible: glass halo, shimmer, the harmonics bend.</div>
      <div><b>0.50 s on</b> a detuned <span class="g">gong bar</span> on D5 and A5 and a scatter of tuned <span class="g">bearing pings</span> ring the edge out.</div>
      <div>Short is the same score at 160 BPM with a shorter ring. Quiet tail drops the slap, hums instead of cries, and lets the halo decay for three seconds.</div>
    </div>
  </section>
  <section class="card">
    <h3>Measurements</h3>
    <table><tr><th>Cut</th><th>Length</th><th>Integrated</th><th>True peak</th><th>Raw before gain</th></tr>
    ${infos.map(i => `<tr><td>${esc(i.name)}</td><td class="n">${i.seconds.toFixed(2)} s</td><td class="n">${i.lufs.toFixed(1)} LUFS</td><td class="n">${i.truePeakDb.toFixed(1)} dBTP</td><td class="n">${i.rawLufs.toFixed(1)} LUFS</td></tr>`).join('')}
    </table>
    <p>Rendered by the Signature Rack with the Timbre Lab registered; scores in <span class="meta">promo/sonic-logo/*.score.json</span>, WAV masters (24-bit) and 192 kbit/s MP3 in <span class="meta">promo/sonic-logo/render/</span>.</p>
  </section>
</div>
<script>
const AUDIO = ${JSON.stringify(audio)};
const player = new Audio(); let current = null, loopId = null, gapTimer = null;
const $ = (s, r = document) => r.querySelector(s);
function ui() { document.querySelectorAll('.play').forEach(b => b.classList.toggle('on', b.dataset.clip === current && !player.paused)); document.querySelectorAll('.loop').forEach(b => b.setAttribute('aria-pressed', String(b.dataset.loop === loopId))); }
function start(id) { current = id; player.src = 'data:audio/mpeg;base64,' + AUDIO[id]; player.play().catch(() => {}); document.querySelectorAll('.bar i').forEach(i => { i.style.width = '0'; }); }
function play(id) { clearTimeout(gapTimer); if (loopId && loopId !== id) loopId = null; if (current === id) { player.paused ? player.play() : player.pause(); ui(); return; } start(id); }
document.querySelectorAll('.play').forEach(b => b.addEventListener('click', () => play(b.dataset.clip)));
document.querySelectorAll('.loop').forEach(b => b.addEventListener('click', () => { const id = b.dataset.loop; clearTimeout(gapTimer); if (loopId === id) { loopId = null; player.pause(); } else { loopId = id; start(id); } ui(); }));
['play', 'pause', 'ended'].forEach(e => player.addEventListener(e, ui));
player.addEventListener('ended', () => { if (loopId === current) gapTimer = setTimeout(() => { if (loopId === current) start(current); }, 2000); });
player.addEventListener('timeupdate', () => { if (!current || !player.duration) return; const btn = document.querySelector('.play[data-clip="' + current + '"]'); const bar = btn && btn.closest('.card').querySelector('.bar i'); if (bar) bar.style.width = (player.currentTime / player.duration * 100) + '%'; });
</script>
</body></html>
`;
  writeFileSync(join(HERE, 'listen.html'), html);
  console.log(`wrote ${join(HERE, 'listen.html')} (${(html.length / 1e6).toFixed(2)} MB)`);
}

const infos = process.argv.includes('--page-only') ? (JSON.parse(readFileSync(join(OUT, 'render.json'), 'utf8')) as { variants: Info[] }).variants : await render();
page(infos);
