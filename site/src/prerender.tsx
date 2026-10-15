// Build-time renderer. `npm run build` bundles this for Node and scripts/prerender.ts calls
// renderPage() to write the final dist/index.html; the dev server calls it per request.
// The browser receives static HTML plus a ~2 kB enhancement script, never React.
import {renderToStaticMarkup} from 'react-dom/server';
import {config} from './config.ts';
import {Page} from './Page.tsx';
import {OneSound} from './OneSound.tsx';
import {origin, released06} from './site.ts';

export {config};

export type RenderOptions = {
  promoAvailable: boolean;
  path?: '/' | '/one-sound/';
  /** Hashed URL of the display font, preloaded because the hero is set in it. */
  displayFontHref?: string;
};

const TITLE = 'DaemonV12: give agents instruments';
const DESCRIPTION =
  'A headless, deterministic music engine for coding agents. Nine MCP tools compose, process, render and analyze music: WAV, MP3, MIDI and stems, no DAW.';

const esc = (v: string) => v.replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
const abs = (path: string) => (origin ? `${origin}${path}` : path);

export const headTags = ({promoAvailable, displayFontHref, path = '/'}: RenderOptions): string => {
  const showcase = path === '/one-sound/';
  const title = showcase ? 'ONE SOUND. THREE MINDS. — DaemonV12' : TITLE;
  const description = showcase ? 'One 1.5-second metallic sample. Three AI coding models. Listen to three anonymous 30-second beats made with DaemonV12. Vote for your favorite to reveal the models and community results.' : DESCRIPTION;
  const analyticsId = config.analyticsMeasurementId;
  if (analyticsId && !/^G-[A-Z0-9]+$/.test(analyticsId)) throw new Error('Invalid GA4 measurement ID in src/config.ts');
  const tags = [
    `<title>${esc(title)}</title>`,
    `<meta name="description" content="${esc(description)}">`,
    origin ? `<link rel="canonical" href="${esc(origin)}${path}">` : '',
    `<meta property="og:type" content="website">`,
    `<meta property="og:site_name" content="DaemonV12">`,
    `<meta property="og:title" content="${esc(title)}">`,
    `<meta property="og:description" content="${esc(description)}">`,
    origin ? `<meta property="og:url" content="${esc(origin)}${path}">` : '',
    `<meta property="og:image" content="${esc(abs('/og.png'))}">`,
    `<meta property="og:image:width" content="1200">`,
    `<meta property="og:image:height" content="630">`,
    `<meta property="og:image:alt" content="DAEMONV12: Give agents instruments.">`,
    !showcase && promoAvailable && origin ? `<meta property="og:video" content="${esc(abs(config.promo.video))}">` : '',
    !showcase && promoAvailable && origin ? `<meta property="og:video:type" content="video/mp4">` : '',
    `<meta name="twitter:card" content="summary_large_image">`,
    `<meta name="twitter:title" content="${esc(title)}">`,
    `<meta name="twitter:description" content="${esc(description)}">`,
    `<meta name="twitter:image" content="${esc(abs('/og.png'))}">`,
    displayFontHref ? `<link rel="preload" href="${esc(displayFontHref)}" as="font" type="font/woff2" crossorigin>` : '',
    analyticsId ? `<script async src="https://www.googletagmanager.com/gtag/js?id=${analyticsId}"></script>` : '',
    analyticsId ? `<script>window.dataLayer = window.dataLayer || [];function gtag(){dataLayer.push(arguments);}gtag('js', new Date());gtag('config', '${analyticsId}');</script>` : '',
    showcase ? '' : `<script type="application/ld+json">${JSON.stringify({
      '@context': 'https://schema.org',
      '@type': 'SoftwareApplication',
      name: 'DaemonV12',
      applicationCategory: 'MultimediaApplication',
      operatingSystem: 'Linux, macOS',
      softwareVersion: released06 ? '0.6' : '0.5',
      description: DESCRIPTION,
      codeRepository: config.repoUrl,
      ...(origin ? {url: `${origin}/`} : {}),
    }).replace(/</g, '\\u003c')}</script>`,
  ];
  return tags.filter(Boolean).join('\n    ');
};

export const renderPage = (template: string, options: RenderOptions): string => {
  if (!template.includes('<!--app-head-->') || !template.includes('<!--app-html-->')) throw new Error('index.html is missing its placeholders');
  return template
    .replace('<!--app-head-->', headTags(options))
    .replace('<!--app-html-->', renderToStaticMarkup(options.path === '/one-sound/' ? <OneSound /> : <Page promoAvailable={options.promoAvailable} />));
};

/** robots.txt and sitemap.xml contents; the sitemap only exists once siteUrl is set. */
export const crawlFiles = (): {robots: string; sitemap: string | null} => ({
  robots: `User-agent: *\nAllow: /\n${origin ? `\nSitemap: ${origin}/sitemap.xml\n` : ''}`,
  sitemap: origin
    ? `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n  <url><loc>${esc(origin)}/</loc></url>\n  <url><loc>${esc(origin)}/one-sound/</loc></url>\n</urlset>\n`
    : null,
});
