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

  /** Merged production engine; keep in sync with the root package and changelog. */
  engineVersion: '0.7.0',

  /** Public contact verified in mataindustries/digital-ziggurat/src/data/projects.js. */
  contactUrl: 'mailto:matasergio741@gmail.com?subject=Paid%20creative%20project%20with%20Sergio',
  portfolioUrl: 'https://ziggurat.pages.dev/',

  /** Owner-supplied public Short. Keep the full-resolution master out of this site. */
  ignition: {
    videoUrl: 'https://youtube.com/shorts/8_sCK9_PhbE',
  },

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
  analyticsMeasurementId: 'G-PXEFNNG7H3',

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
