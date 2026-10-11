import {existsSync} from 'node:fs';
import {fileURLToPath} from 'node:url';
import react from '@vitejs/plugin-react';
import {defineConfig, type Plugin} from 'vite';

/** Dev server only: render the static page on each request, as the build does once. */
const devPrerender = (): Plugin => ({
  name: 'daemonv12-dev-prerender',
  apply: 'serve',
  transformIndexHtml: {
    order: 'pre',
    async handler(html, ctx) {
      if (!ctx.server) return html;
      const mod = (await ctx.server.ssrLoadModule('/src/prerender.tsx')) as typeof import('./src/prerender.tsx');
      const video = fileURLToPath(new URL(`./public${mod.config.promo.video}`, import.meta.url));
      return mod.renderPage(html, {promoAvailable: existsSync(video)});
    },
  },
});

export default defineConfig({
  plugins: [react(), devPrerender()],
  build: {
    target: 'es2020',
    assetsInlineLimit: 0,
    cssCodeSplit: false,
  },
});
