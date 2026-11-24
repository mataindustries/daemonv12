/**
 * Builds the phone listening page for COUNTERFEIT GOLD V2: one self-contained HTML file (audio embedded at 128 kbps),
 * with V2, V1, the LP and the Procession Take, V2's sections as tap-to-jump cues, and lock-screen controls.
 *   node counterfeit-gold-opus/v2/listen.ts OUT.html          (needs FFmpeg)
 * Times come from v2/map.json; nothing here is typed by hand twice.
 */
import { spawnSync } from 'node:child_process';
import { readFileSync, writeFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = dirname(fileURLToPath(import.meta.url)), ROOT = resolve(HERE, '..'), out = process.argv[2];
if (!out) { console.error('usage: node counterfeit-gold-opus/v2/listen.ts OUT.html'); process.exit(2); }
const map = JSON.parse(readFileSync(join(HERE, 'map.json'), 'utf8'));
const b64 = (file: string) => {
  const r = spawnSync('ffmpeg', ['-hide_banner', '-nostdin', '-v', 'error', '-i', join(ROOT, file), '-codec:a', 'libmp3lame', '-b:a', '128k', '-map_metadata', '-1', '-f', 'mp3', '-'], { maxBuffer: 1 << 28 });
  if (r.status !== 0) throw new Error(`ffmpeg ${file}: ${r.stderr}`);
  return r.stdout.toString('base64');
};
const esc = (s: string) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
const mmss = (t: number) => `${Math.floor(t / 60)}:${String(Math.floor(t % 60)).padStart(2, '0')}`;
const at = (beat: number) => beat * map.beatSeconds, S = map.sections;
const cues: [number, string, string][] = [
  [at(S.box), 'The box', 'The funeral at half speed, two tolls. Two coins. Odile bends a shout up a fifth into the drop.'],
  [at(S.counterfeit), 'Counterfeit', 'The LP cut so the ferryman\'s chord lands on the and-of-three; the eternal Deacon underneath.'],
  [at(S.crossing), 'The crossing', 'The LP\'s whole 7/8 crossing over 4/4 drums. The drums leave; then the kick follows the seven and the snare refuses.'],
  [at(S.convergence), 'Convergence', 'Seven bars of 7/8 are exactly seven bars of 4/4: the record\'s own stop-time stab lands on the one.'],
  [at(S.cut), 'Cut him loose', 'The second idea: the band\'s street take, the same tune in D7 blues, under hip-hop low end.'],
  [at(S.cut + 26), 'Two records, one chord', 'The LP\'s ferryman chord hits at the same moment as the street band\'s.'],
  [at(S.ezras), 'Three Ezras', 'The riff alone; then one reed player stacked into a horn section.'],
  [at(S.sink), 'The sink', 'The parade sinks a minor third and slows: the coin is being bitten.'],
  [at(S.bite), 'The bite', 'The coins, bright; the same coins an octave down: brass.'],
  [at(S.coc), 'Counterfeit of a counterfeit', 'V1 played as an old record, at half speed: an octave down, half time.'],
  [at(S.coc + 16), 'Odile raps', 'Her own syllables, re-sung into a line she never sang, with an impossible bend.'],
  [at(S.coc + 32), 'V1 wakes up', 'The old record snaps to its own speed; then the LP\'s feral chorus.'],
  [at(S.payment), 'Payment', 'The counterfeit one last time, answered by the horn section.'],
  [at(S.cadence), 'The cadence', 'The LP\'s unresolved chord, then the street\'s F major (now D): a cadence across two records.'],
  [at(S.coin), 'The coin', 'A coin spins down and falls flat, an octave too low. A breath.'],
];
const tracks = [
  { id: 'v2', title: 'Ferryman Takes Fakes (V2)', by: 'COUNTERFEIT GOLD · the definitive reconstruction', file: 'v2/delivery/FERRYMAN-TAKES-FAKES-V2.mp3', cues: true },
  { id: 'v1', title: 'Ferryman Takes Fakes (V1)', by: 'the first beat, kept for comparison', file: 'beat/ferryman-takes-fakes.mp3', cues: false },
  { id: 'lp', title: 'Two Coins for the Ferryman', by: 'The Velvet Hearse · LP, 1971 (imaginary)', file: 'source/the-velvet-hearse--two-coins-for-the-ferryman.mp3', cues: false },
  { id: 'street', title: 'Two Coins for the Ferryman (Procession Take)', by: 'The Velvet Hearse · unreleased (imaginary)', file: 'v2/procession/the-velvet-hearse--two-coins-procession-take.mp3', cues: false },
];
const audio = Object.fromEntries(tracks.map(t => [t.id, b64(t.file)]));
const html = `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>Counterfeit Gold</title><meta name="theme-color" content="#14110d">
<style>
:root{--bg:#14110d;--card:#1f1a14;--ink:#efe6d6;--dim:#a99a82;--gold:#d8b45a;--line:#3a3127}
*{box-sizing:border-box}body{margin:0;background:var(--bg);color:var(--ink);font:16px/1.5 system-ui,-apple-system,Segoe UI,Roboto,sans-serif}
main{max-width:640px;margin:0 auto;padding:20px 16px 48px}h1{font:700 28px/1.15 Georgia,serif;margin:8px 0 4px;color:var(--gold)}
.sub{color:var(--dim);margin:0 0 20px}.card{background:var(--card);border:1px solid var(--line);border-radius:14px;padding:14px;margin:14px 0}
.t{font-weight:650}.by{color:var(--dim);font-size:14px;margin-bottom:10px}audio{width:100%}
.cue{display:flex;gap:12px;width:100%;text-align:left;background:none;border:0;border-top:1px solid var(--line);color:var(--ink);padding:12px 2px;font:inherit;cursor:pointer}
.cue:first-of-type{border-top:0}.cue b{color:var(--gold);min-width:44px;font-variant-numeric:tabular-nums}.cue span{display:block;color:var(--dim);font-size:14px}
.cue.on{background:#2a2219}p.note{color:var(--dim);font-size:14px}
</style></head><body><main>
<h1>Counterfeit Gold</h1><p class="sub">An imaginary 1971 funeral-home band, its unreleased street take, and two beats made from them. Tap a cue to jump.</p>
${tracks.map(t => `<section class="card"><div class="t">${esc(t.title)}</div><div class="by">${esc(t.by)}</div>
<audio id="${t.id}" controls preload="metadata" src="data:audio/mpeg;base64,${audio[t.id]}"></audio>
${t.cues ? cues.map(([s, n, d]) => `<button class="cue" data-t="${s.toFixed(2)}"><b>${mmss(s)}</b><div>${esc(n)}<span>${esc(d)}</span></div></button>`).join('') : ''}</section>`).join('\n')}
<p class="note">Listening copies at 128 kbps. Masters: v2/delivery/FERRYMAN-TAKES-FAKES-V2.24.wav (PCM24) and the 320 kbps MP3 beside it.</p>
</main><script>
const players=[...document.querySelectorAll('audio')];
players.forEach(a=>a.addEventListener('play',()=>{players.forEach(b=>{if(b!==a)b.pause()});
 if('mediaSession' in navigator){const c=a.closest('.card');navigator.mediaSession.metadata=new MediaMetadata({title:c.querySelector('.t').textContent,artist:c.querySelector('.by').textContent,album:'Counterfeit Gold'})}}));
const v2=document.getElementById('v2'),cues=[...document.querySelectorAll('.cue')];
cues.forEach(c=>c.addEventListener('click',()=>{v2.currentTime=+c.dataset.t;v2.play()}));
v2.addEventListener('timeupdate',()=>{let on=null;cues.forEach(c=>{if(+c.dataset.t<=v2.currentTime+0.05)on=c});cues.forEach(c=>c.classList.toggle('on',c===on))});
</script></body></html>
`;
writeFileSync(out, html);
console.log(`${out}: ${(html.length / 1e6).toFixed(1)} MB, ${cues.length} cues`);
