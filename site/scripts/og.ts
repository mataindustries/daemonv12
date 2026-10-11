// Renders the social card and PNG icons from the site's own identity: Archivo, the
// GLASS//FIRE palette and the real GLASSHOUSE glass-hit outline. No external generator.
//
//   npm run og      → public/og.png (1200×630), public/apple-touch-icon.png (180),
//                     public/favicon-32.png (32)
//
// Needs Chromium: set CHROMIUM_PATH, or it uses /opt/pw-browsers/chromium.
import {existsSync, readFileSync} from 'node:fs';
import {join} from 'node:path';
import {fileURLToPath} from 'node:url';
import {chromium} from 'playwright-core';
import {outlinePath} from '../src/outline.ts';

const site = fileURLToPath(new URL('..', import.meta.url));
const fonts = join(site, 'node_modules', '@fontsource-variable');
// Inlined as data URLs: setContent pages cannot load file:// fonts.
const dataUrl = (path: string) => `data:font/woff2;base64,${readFileSync(path).toString('base64')}`;
const archivo = dataUrl(join(fonts, 'archivo', 'files', 'archivo-latin-wdth-normal.woff2'));
const mono = dataUrl(join(fonts, 'jetbrains-mono', 'files', 'jetbrains-mono-latin-wght-normal.woff2'));
const waveforms = JSON.parse(readFileSync(join(site, 'src', 'data', 'waveforms.json'), 'utf8')) as Record<string, {env: number[]}>;
const glass = waveforms['glass-hit'];
if (!glass) throw new Error('glass-hit outline missing; run npm run waveforms');

const IRIS = `<linearGradient id="iris" x1="0" x2="1"><stop offset="0" stop-color="#8FE6FF"/><stop offset=".36" stop-color="#B3A6FF"/><stop offset=".68" stop-color="#FFB0D6"/><stop offset="1" stop-color="#FFE0A6"/></linearGradient>`;

const base = `
  @font-face { font-family: A; src: url(${archivo}) format('woff2'); font-weight: 100 900; font-stretch: 62% 125%; }
  @font-face { font-family: M; src: url(${mono}) format('woff2'); font-weight: 100 800; }
  * { margin: 0; box-sizing: border-box; }
  html, body { background: #000; }
`;

const og = `<!doctype html><html><head><style>${base}
  body { width: 1200px; height: 630px; position: relative; overflow: hidden; color: #fff; font-family: A; }
  .grid { position: absolute; inset: 0; background: repeating-linear-gradient(90deg, transparent 0 74px, rgba(255,255,255,.035) 74px 75px); }
  .brand { position: absolute; left: 72px; top: 64px; display: flex; align-items: center; gap: 20px; font-weight: 400; font-stretch: 125%; font-size: 22px; letter-spacing: .32em; }
  .brand i { display: block; width: 120px; height: 1px; background: linear-gradient(90deg,#8FE6FF,#B3A6FF 36%,#FFB0D6 68%,#FFE0A6); }
  h1 { position: absolute; left: 66px; top: 128px; font-weight: 800; font-stretch: 88%; font-size: 152px; line-height: .84; letter-spacing: -.03em; text-transform: uppercase; }
  svg { position: absolute; left: 72px; right: 72px; bottom: 112px; width: 1056px; height: 84px; }
  .meta { position: absolute; left: 72px; right: 72px; bottom: 56px; display: flex; justify-content: space-between; font-family: M; font-size: 18px; letter-spacing: .1em; text-transform: uppercase; color: #A2A5AB; }
  .meta b { color: #fff; font-weight: 600; }
  .reg { position: absolute; width: 18px; height: 18px; border: 0 solid #6C6F76; }
</style></head><body>
  <div class="grid"></div>
  <span class="reg" style="left:28px;top:28px;border-top-width:1px;border-left-width:1px"></span>
  <span class="reg" style="right:28px;top:28px;border-top-width:1px;border-right-width:1px"></span>
  <span class="reg" style="left:28px;bottom:28px;border-bottom-width:1px;border-left-width:1px"></span>
  <span class="reg" style="right:28px;bottom:28px;border-bottom-width:1px;border-right-width:1px"></span>
  <div class="brand">DAEMONV12<i></i></div>
  <h1>Give agents<br>instruments.</h1>
  <svg viewBox="0 0 1056 84" preserveAspectRatio="none"><defs>${IRIS}</defs>
    <line x1="0" x2="1056" y1="42" y2="42" stroke="#2B2C30"/>
    <path d="${outlinePath(glass, 1056, 84)}" fill="rgba(179,166,255,.08)" stroke="url(#iris)" stroke-width="1.5" vector-effect="non-scaling-stroke"/>
  </svg>
  <div class="meta"><span><b>Headless music engine for agents</b></span><span>9 MCP tools · WAV / MP3 / stems</span></div>
</body></html>`;

const icon = (size: number) => `<!doctype html><html><head><style>${base} body { width: ${size}px; height: ${size}px; }</style></head><body>
  <svg width="${size}" height="${size}" viewBox="0 0 64 64" xmlns="http://www.w3.org/2000/svg"><defs>${IRIS}</defs>
    <rect width="64" height="64" fill="#000"/>
    <path d="M14 46 26 18M30 46 42 18" stroke="#fff" stroke-width="6" stroke-linecap="square" fill="none"/>
    <rect x="8" y="52.5" width="48" height="3" fill="url(#iris)"/>
  </svg></body></html>`;

const executablePath = process.env.CHROMIUM_PATH ?? (existsSync('/opt/pw-browsers/chromium') ? '/opt/pw-browsers/chromium' : undefined);
const browser = await chromium.launch({executablePath});
const shoot = async (html: string, width: number, height: number, file: string) => {
  const page = await browser.newPage({viewport: {width, height}});
  await page.setContent(html, {waitUntil: 'load'});
  await page.evaluate(() => document.fonts.ready);
  await page.screenshot({path: join(site, 'public', file), type: 'png'});
  await page.close();
  console.log(`wrote public/${file}`);
};
await shoot(og, 1200, 630, 'og.png');
await shoot(icon(180), 180, 180, 'apple-touch-icon.png');
await shoot(icon(32), 32, 32, 'favicon-32.png');
await browser.close();
