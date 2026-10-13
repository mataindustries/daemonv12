// The one place the owner edits. Everything the page links to comes from here.
//
// Empty strings are intentional: the build renders the matching button in a
// visible "opening soon" state instead of inventing a destination.

export const config = {
  /**
   * Production origin without a trailing slash, e.g. 'https://daemonv12.pages.dev'.
   * Drives the canonical link, absolute Open Graph/Twitter image URLs and sitemap.xml.
   * Leave empty until the Cloudflare Pages URL (or a custom domain) is known.
   */
  siteUrl: 'https://daemonv12.pages.dev',

  /** Public repository. */
  repoUrl: 'https://github.com/mataindustries/daemonv12',

  /**
   * SUPPORT DEVELOPMENT: paste a Stripe Payment Link here
   * (https://buy.stripe.com/...). Opens in a new tab. No Stripe SDK is loaded.
   */
  supportUrl: 'https://buy.stripe.com/8x2bJ3bYDgs7arR1Zt3F600',

  /**
   * REQUEST A PACK: any https:// form URL (Tally, Typeform, Google Forms, a GitHub
   * issue template, ...) or a mailto: address. No payment is taken on this page.
   */
  requestPackUrl: 'https://tally.so/r/yPKRAp',

  /** Public Google Analytics 4 measurement ID; leave empty to disable GA4. */
  analyticsMeasurementId: 'G-PXEFNWG7H3',

  /**
   * V0.6 SAMPLE PERFORMANCE visibility. Keep false while V0.6 is in final review:
   * the section shows as "V0.6 · FINAL REVIEW", links point at `v06PreviewRef`, and
   * nothing else on the page (status line, capability strip, install snippet) claims it.
   * Flip to true once V0.6 is merged into main. That is the only change needed.
   */
  v06Released: true,

  /** Branch the V0.6 links use while v06Released is false. */
  v06PreviewRef: 'v06-sample-performance',

  /**
   * GLASS//FIRE web cut. Files live in public/media/ and are produced by
   * `npm run promo:web -- <final-master.mp4>`. If the video file is missing at build
   * time the page shows a designed placeholder frame instead of a broken player.
   */
  promo: {
    video: '/media/glass-fire-720p60.mp4',
    poster: '/media/glass-fire-poster.jpg',
    width: 1280,
    height: 720,
  },
} as const;

export type SiteConfig = typeof config;
