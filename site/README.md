# DaemonV12 site

The public landing page for DaemonV12: a single static page built with Vite, React and
TypeScript, prerendered to HTML at build time. The browser receives HTML, one inlined
stylesheet, two self-hosted fonts and a ~1 kB script. React never runs in the browser.

The site is **isolated from the DaemonV12 package**. It has its own `package.json` and
lockfile; the root package never builds, tests, type-checks or publishes `site/`, and does
not depend on Vite, React or Playwright (`tests/isolation.test.ts` checks this).

## Deploy on Cloudflare Pages

Nothing deploys automatically. To publish:

1. In the Cloudflare dashboard, open **Workers & Pages → Create → Pages → Connect to Git**
   and authorize GitHub for `mataindustries/daemonv12`.
2. Pick the repository, then set:

   | Setting | Value |
   |---|---|
   | Production branch | `main` (or `daemonv12-site` to preview before merging) |
   | Framework preset | None |
   | **Root directory** | `site` |
   | **Build command** | `npm run build` |
   | **Build output directory** | `dist` |

3. **Save and Deploy.** Cloudflare installs with `npm ci` from `site/package-lock.json`,
   builds, and publishes the site at `https://<project-name>.pages.dev`. The project name
   you choose in step 2 becomes the subdomain; every other branch and pull request gets its
   own preview URL.
4. Put that URL in `siteUrl` in `src/config.ts` (see below) and push, so the canonical
   link, social cards and `sitemap.xml` use it.

The build needs only what Vite 8 needs: Node 20.19+ or 22.12+. If a build log ever shows an
older Node, add the environment variable `NODE_VERSION` = `22` under **Settings →
Variables and Secrets**. The development scripts below (`qa`, `og`, `waveforms`,
`ghost-shift`) run TypeScript directly and need Node 22.18+ locally.

The build fails rather than shipping if any file exceeds Cloudflare Pages' 25 MiB
per-file limit, or if a URL in `src/config.ts` is not `https://` (or `mailto:` for pack
requests).

## The one file to edit: `src/config.ts`

| Field | What to put there | While empty |
|---|---|---|
| `siteUrl` | The production origin, e.g. `https://daemonv12.pages.dev` | No canonical link or sitemap; social images use relative URLs |
| `supportUrl` | A **Stripe Payment Link** (`https://buy.stripe.com/...`) | SUPPORT DEVELOPMENT renders as a dashed "Opening soon" state, not a link |
| `requestPackUrl` | Any `https://` form (Tally, Typeform, Google Forms, a GitHub issue template) or a `mailto:` address | REQUEST A PACK renders as "Requests open soon" |
| `analyticsMeasurementId` | Google Analytics 4 measurement ID (`G-...`) | No Google tag or custom CTA events |
| `v06Released` | `true` once V0.6 is merged into `main` | The V0.6 section is labelled **V0.6 · FINAL REVIEW** |
| `v06PreviewRef` | Branch the V0.6 links use before release | — |

**Payments.** The page has no Stripe SDK, no keys, no checkout and no payment code. The
support button is a plain link to an external Payment Link that opens in a new tab with
`rel="noopener noreferrer"`. Custom sound packs take no payment here: the request comes
first, and pricing follows once the scope is understood.

**Analytics.** The static HTML head loads Google's `gtag.js` asynchronously using
`analyticsMeasurementId`. The client enhancement script sends a
`daemonv12_cta_click` event with `cta_name` (`support` or `request-pack`) and
`link_url` when a configured call-to-action is clicked. It does not collect form
answers or payment information. Verify GA4 Realtime and the event report after
deploying. Assess applicable consent requirements before targeting visitors in
jurisdictions where they apply. The Google tag is an external third-party request.

**V0.6 release flip.** With `v06Released: false` the sample-performance section reads as a
preview ("In final review, not yet released"), its links point at the review branch, and
nothing else on the page claims V0.6: the status line says v0.5, the capability strip and
install snippet stay as they are. Setting it to `true` changes all of that at once: the
status becomes v0.6, a SAMPLE PERFORMANCE capability appears, links move to `main` and the
section offers `npm run demo:ghost-shift`.

## GLASS//FIRE video

The final promo master is not in the repository (renders are never committed). Produce the
web cut from it:

```sh
npm run promo:web -- /path/to/glass-fire-1080p60.mp4 [poster-seconds]
```

This writes two files to `public/media/`:

| File | Spec |
|---|---|
| `glass-fire-720p60.mp4` | H.264 High, 1280×720, source frame rate (60 fps), yuv420p, two-pass ~3.2 Mb/s, AAC 128 kb/s, `+faststart`: about 10 MiB for 24 s |
| `glass-fire-poster.jpg` | 1280×720 frame; the default 23.3 s is the payoff card (DAEMONV12 / GIVE AGENTS INSTRUMENTS.) before the cut to black |

Check the poster, then commit both files (`git add public/media`) so Cloudflare's build
has them. The build warns above 12 MiB and refuses anything over 25 MiB.

Until `public/media/glass-fire-720p60.mp4` exists, the build renders a designed
placeholder frame (the real GLASSHOUSE glass-hit outline, "the 24-second film lands here
soon" and a link to `promo/glass-fire`) instead of a broken player.

**Playback behavior.** The markup has `controls`, `muted`, `playsinline`, `loop` and
`preload="none"`, so nothing downloads at first paint and the player works without
JavaScript. After the page loads, the script starts the film muted when at least 30% of it
is in view, and pauses it when it leaves. It never autoplays under
`prefers-reduced-motion`, Save-Data or a 2G/3G connection; a play button shows instead,
and it shows too if the browser refuses autoplay. **Watch GLASS//FIRE** scrolls to the
film and plays it from the start with sound.

## Develop

```sh
npm ci
npm run dev          # http://localhost:5173, prerendered on each request
npm run build        # dist/
npm run preview      # serve dist/ on :4173
npm run check        # typecheck + lint + unit tests
npm run qa           # browser QA of dist/ (desktop + 430/390/360 px, reduced motion)
```

`npm run qa` serves `dist/` and drives Chromium through `playwright-core` (no browser
download; it uses `CHROMIUM_PATH` or `/opt/pw-browsers/chromium`). It checks horizontal
overflow, minimum text size, console errors, link security, the pending config states,
landmarks and keyboard entry, and, when the video exists, muted autoplay, reduced motion,
refused autoplay and the Watch button. Screenshots go to `qa-output/` (git-ignored).

### Generated assets

These are committed, so the build never reads outside `site/`:

| Command | Writes | From |
|---|---|---|
| `npm run waveforms` | `src/data/waveforms.json` | Peak envelopes of eight Orbital Foundry and GLASSHOUSE WAVs in `examples/assets/` |
| `npm run ghost-shift` | `src/data/ghost-shift.json` | The pitch trace of every ghost-vox voice in `examples/ghost-shift.json`, following the documented V0.6 rate/glide model |
| `npm run og` | `public/og.png`, `public/apple-touch-icon.png`, `public/favicon-32.png` | The page's fonts, palette and glass-hit outline |

## Facts on the page

Every number comes from the repository: `README.md`, `CHANGELOG.md`, `docs/`,
`examples/`, `reports/shoot-the-moon/REPORT.md` and `promo/glass-fire/`. When those
change, update `src/Page.tsx`. The adaptive game audio case describes what the engine
provides (bar-exact loop layers with aligned stems, per `docs/V0_5_TIMELINE_DYNAMICS.md`
and `examples/v05-loop-demo.json`); the switching between layers happens in the game.

## Files

```
index.html            template with <!--app-head--> / <!--app-html--> placeholders
vite.config.ts        build settings; dev server prerenders per request
src/config.ts         owner settings (URLs, V0.6 flag, promo paths)
src/site.ts           values derived from config (status line, links)
src/links.ts          outbound URL policy
src/Page.tsx          the page
src/visuals.tsx       SVG figures (waveforms, sync map, loop layers, act ruler, pitch trace)
src/outline.ts        waveform geometry shared with the OG script
src/prerender.tsx     renderPage(), head tags, robots/sitemap
src/client.ts         the only browser script (film behavior)
src/styles.css        the design system
src/data/             extracted repository data
scripts/prerender.mjs final build step
scripts/make-promo-web.sh, og.ts, extract-*.ts, qa.ts
tests/                node:test unit tests (dist checks run after a build)
public/               favicon, icons, OG image; media/ for the promo web cut
```

## ONE SOUND showcase (Phase 1)

`/one-sound/` is prerendered alongside the homepage. It uses the four verified public
listening files with native players and exclusive playback, and previews a disabled
ballot. No votes or identities are stored in the frontend. Run `npm run qa:one-sound`
after building (`CHROMIUM_PATH` selects an installed Chromium).
See [the Phase 2 contract and deployment handoff](docs/ONE_SOUND_PHASE_2.md).
