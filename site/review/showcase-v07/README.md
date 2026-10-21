# Showcase v0.7 review

Implementation branch: `feature/daemonv12-showcase-v07`, based on main
`ea9dfbcef4ac54698313c300640ed0a7be74059e`. Review only; no merge or deployment.

The site now presents production engine v0.7 (`0.7.0` in structured data), with
source slices, musical gates, attack/release envelopes and track-local choke
groups. Copy follows the merged V0.7 contract. GHOST//SHIFT remains the V0.6
playback demonstration and links to the new ONE SOUND articulation comparison.

IGNITION 002 — V12 OVERDRIVE complements GLASS//FIRE. Its compact showcase includes
the supplied 128 BPM, 15-second loop, procedural V12 animation, Remotion / Three.js,
1080 × 1920, 60 fps and 900-frame facts. Credits distinguish music composition and
rendering through DaemonV12 from frame sequencing/rendering with Remotion and
procedural picture with Three.js. The YouTube link loads no embedded media.

GLASS//FIRE's media, playback logic, music data, stem visualizations and technical
explanation are preserved. No engine, Composer skill or benchmark branch changed.

## Public paths

- [IGNITION video](https://youtube.com/shorts/8_sCK9_PhbE)
- [Explore the technology on GitHub](https://github.com/mataindustries/daemonv12)
- [Request a custom pack through Tally](https://tally.so/r/yPKRAp)
- [Contact Sergio about paid creative coding, audio tooling or interactive prototypes](mailto:matasergio741@gmail.com?subject=Paid%20creative%20project%20with%20Sergio)
- [ENM Ventures portfolio](https://ziggurat.pages.dev/)
- [Existing Stripe support link](https://buy.stripe.com/8x2bJ3bYDgs7arR1Zt3F600)

The public email is verified in the
[portfolio source](https://github.com/mataindustries/digital-ziggurat/blob/25838be66e7ca8c55ddbfdf97191e45e2f2232ed/src/data/projects.js).
No payment products, fixed prices or turnaround promises were introduced.
Existing GA4 outbound events now cover showcase, contact, portfolio and GitHub
clicks alongside support and pack requests.

## Validation

- TypeScript, ESLint and production build passed.
- Site tests passed; 24 test cases also passed with
  `node --test --test-isolation=none tests/*.test.ts`.
- 99 Chromium 154 browser assertions passed. See [full QA log](browser-qa.log).
- Checked 360, 390, 430, 768, 1024 and 1440 px in normal and reduced motion.
- No horizontal overflow, clipped elements or console errors at those widths.
- Verified accessible link names, new-tab security, keyboard skip link, canonical
  URL, metadata, version consistency and functionality without JavaScript.
- GLASS//FIRE passed muted autoplay, pause outside the viewport, Watch with sound,
  blocked-autoplay fallback, reduced-motion, lazy loading, Save-Data and 3G checks.
- Every tracked link queued exactly one CTA event per click; one GA4 initialization
  and no additional page views. QA intercepted GA4 locally and sent no live events.

## Screenshots

These review artifacts are outside `public/` and are not shipped by the site build.

| View | Screenshot |
| --- | --- |
| 360 px | [IGNITION](phone-360-ignition.png) |
| 390 px | [IGNITION](phone-390-ignition.png), [paid work and portfolio](phone-390-contact.png) |
| 430 px | [IGNITION](phone-430-ignition.png) |
| Tablet, 768 px | [IGNITION](tablet-768-ignition.png) |
| Desktop, 1440 px | [IGNITION](desktop-1440-ignition.png) |

## Limitations

Browser QA ran against the local production build in Chromium, not on physical
devices or in Safari. Live YouTube/portfolio availability could not be checked
from the restricted environment; the supplied video URL and portfolio-source
contact were used. A verified public URL for the new GLASS//FIRE Short was not
available, so none was added. GA4 delivery should be checked in Realtime after an
approved deployment; this review does not send production analytics traffic.
