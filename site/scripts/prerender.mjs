// Final build step: render the page into dist/index.html, inline the (small) stylesheet,
// preload the display font, write robots.txt/sitemap.xml and enforce Cloudflare Pages'
// per-file limit. Runs after `vite build` (client) and `vite build --ssr` (renderer).
//
// Plain JavaScript (type-checked through JSDoc) so the Cloudflare build needs nothing
// newer than Vite itself does.
// @ts-check
import {existsSync, readFileSync, readdirSync, rmSync, statSync, unlinkSync, writeFileSync} from 'node:fs';
import {dirname, join, relative} from 'node:path';
import {fileURLToPath, pathToFileURL} from 'node:url';

const site = join(dirname(fileURLToPath(import.meta.url)), '..');
const dist = join(site, 'dist');
const ssr = join(site, '.ssr');
const MiB = 1024 * 1024;
const CLOUDFLARE_FILE_LIMIT = 25 * MiB;
const VIDEO_BUDGET = 12 * MiB;

const entry = readdirSync(ssr).find(f => /^prerender\.m?js$/.test(f));
if (!entry) throw new Error('SSR bundle missing; run `npm run build`');
/** @type {typeof import('../src/prerender.tsx')} */
const {renderPage, crawlFiles, config} = await import(pathToFileURL(join(ssr, entry)).href);

/** @param {string} dir @returns {string[]} */
const walk = dir => readdirSync(dir).flatMap(name => (statSync(join(dir, name)).isDirectory() ? walk(join(dir, name)) : [join(dir, name)]));

// 1. Is the GLASS//FIRE web cut present? (public/ is copied into dist/ by Vite.)
const videoPath = join(dist, config.promo.video.replace(/^\//, ''));
const posterPath = join(dist, config.promo.poster.replace(/^\//, ''));
const promoAvailable = existsSync(videoPath);
if (promoAvailable && !existsSync(posterPath)) throw new Error(`${config.promo.poster} is missing; run npm run promo:web`);
if (promoAvailable) {
  const size = statSync(videoPath).size;
  if (size > VIDEO_BUDGET) console.warn(`! ${config.promo.video} is ${(size / MiB).toFixed(1)} MiB (budget ${VIDEO_BUDGET / MiB} MiB)`);
} else {
  console.warn(`! ${config.promo.video} not found: rendering the GLASS//FIRE placeholder frame. See README.md, "GLASS//FIRE video".`);
}

// 2. Render, inline CSS, preload the display font.
let template = readFileSync(join(dist, 'index.html'), 'utf8');
const assets = walk(join(dist, 'assets')).map(p => '/' + relative(dist, p).split('\\').join('/'));
const font = assets.find(a => /\/archivo-latin-wdth-normal-[\w-]+\.woff2$/.test(a));
if (!font) throw new Error('display font was not emitted');

template = template.replace(/<link rel="stylesheet"[^>]*href="(\/assets\/[^"]+\.css)"[^>]*>/g, (_, /** @type {string} */ href) => {
  const file = join(dist, href);
  const css = readFileSync(file, 'utf8');
  unlinkSync(file);
  return `<style>${css}</style>`;
});

const html = renderPage(template, {promoAvailable, displayFontHref: font});
writeFileSync(join(dist, 'index.html'), html);

// 3. Crawlers.
const {robots, sitemap} = crawlFiles();
writeFileSync(join(dist, 'robots.txt'), robots);
if (sitemap) writeFileSync(join(dist, 'sitemap.xml'), sitemap);
else if (existsSync(join(dist, 'sitemap.xml'))) unlinkSync(join(dist, 'sitemap.xml'));

// 4. Cloudflare Pages rejects any single file over 25 MiB.
for (const file of walk(dist)) {
  const size = statSync(file).size;
  if (size > CLOUDFLARE_FILE_LIMIT) throw new Error(`${relative(site, file)} is ${(size / MiB).toFixed(1)} MiB; Cloudflare Pages allows 25 MiB per file`);
}

rmSync(ssr, {recursive: true, force: true});
const total = walk(dist).reduce((sum, f) => sum + statSync(f).size, 0);
console.log(`prerendered dist/index.html (${(Buffer.byteLength(html) / 1024).toFixed(1)} kB) · promo ${promoAvailable ? 'video' : 'placeholder'} · dist ${(total / MiB).toFixed(2)} MiB`);
