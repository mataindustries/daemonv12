# ONE SOUND Phase 2 operations and review

## Implemented

Pages Functions route `/api/one-sound/*` to the server-only voting module. The
session/vote/reveal contract in `ONE_SOUND_PHASE_2.md` is implemented. D1 unique
constraints enforce one vote per signed session and one use of each request UUID.
Retries compare both UUID and track; primary-consistent reads authorize reveal and
compute totals. Auth failures, database failures and missing configuration fail
closed with private/no-store JSON. No unauthenticated endpoint returns identities
or totals. No application request/secret logging is present.

The ballot obtains a session, submits a final choice, and shows server results.
Reload recovers an existing vote via the reveal endpoint. A request UUID stays in
memory for retries; nothing is stored in localStorage/sessionStorage. Errors offer
Check voting status. Native audio remains unchanged. GA4 remains configured for
page views; votes and identities are never sent as custom analytics events.

## Files

- `functions/_lib/voting.ts`: validation, cookies/CSRF, privacy rate limits, D1 and reveal.
- `functions/api/one-sound/[[path]].ts`: Pages router entry.
- `migrations/0001_one_sound.sql`: votes and temporary rate-limit tables.
- `wrangler.jsonc`, `public/_routes.json`: closed-by-default local scaffold and API scope.
- `src/voting.ts`, `src/OneSound.tsx`, `src/one-sound.css`: ballot and results UI.
- `tests/voting.test.ts`: workerd/Miniflare D1 security and concurrency tests.
- `scripts/qa-voting.ts`: compiled Pages worker + D1 + Chromium full-flow QA.

## Local verification (no Cloudflare account required)

From `site/`:

```sh
npm ci
npm run build
npm run check
npm run qa:one-sound
npm run qa:voting
```

`qa:voting` compiles the actual Pages router, starts an ephemeral local D1 instance
and serves the production site on localhost:8789. It uses synthetic names only,
opens real Chromium pages, inserts real local database rows and disposes the
instance afterward. Screenshots are ignored under `qa-output/`. Set `CHROMIUM_PATH`
if Chromium is elsewhere. No production resources are touched.

For an interactive local preview, create ignored `site/.dev.vars` with synthetic
mapping values and distinct random development keys only. Override ALLOWED_ORIGIN
to `http://localhost:8788` and VOTING_OPEN to `true` in that local file. Then:

```sh
WRANGLER_LOG_PATH=.wrangler/logs npx wrangler d1 migrations apply VOTES_DB --local
WRANGLER_LOG_PATH=.wrangler/logs npx wrangler pages dev dist --ip 127.0.0.1 --port 8788
```

Open `http://localhost:8788/one-sound/` (use localhost, whose Secure-cookie treatment
Chromium supports). Never weaken cookie attributes for development. `npm run preview`
serves static assets only and correctly keeps voting unavailable without Functions.

## Required bindings and secrets (names only)

D1 binding: `VOTES_DB`.

Server variables: `EXPERIMENT_ID`, `VOTING_OPEN`, `ALLOWED_ORIGIN`.

Encrypted server secrets: `MODEL_TRACK_MAP`, `VOTE_COOKIE_SECRET`,
`VOTER_HASH_SECRET`, `RATE_LIMIT_SECRET`.

Optional secret: `TURNSTILE_SECRET_KEY`.

Cookie, voter-hash and rate-limit secrets must be distinct, at least 32 characters,
and generated with a cryptographically secure random source. Keep them stable during
an experiment; rotation invalidates sessions/changes voter hashes and needs a planned
migration or experiment reset. Do not expose any secret through `VITE_*`, build-time
substitution, source maps, shell history, analytics, Git or application logs.

## Cloudflare setup — operator action required before any deployment

Nothing in this task provisions databases, changes a Pages project or deploys.
The Wrangler database ID is deliberately a non-production placeholder.

1. Inspect the actual Pages project, production branch, preview rules, custom
   domains and access logs. Confirm automatic feature-branch deployments are
   disabled/excluded. Commits use `[CF-Pages-Skip]` to avoid Pages Git builds.
2. Create separate preview and production D1 databases. Record each actual database
   ID in the appropriate deployment configuration/binding. Never point preview at
   production. Root is `site`, output is `dist`, build is `npm ci && npm run build`.
   Pin Node 24 LTS. Keep Functions under `site/functions`; `_routes.json` limits
   invocation to the API. The Wrangler compatibility date is pinned to 2026-07-30.
3. With the intended database selected, apply `0001_one_sound.sql` explicitly:
   `npx wrangler d1 migrations apply VOTES_DB --remote` for the configured binding.
   Confirm the target ID before running. Verify the resulting schema/indexes.
4. Set the required server variables and encrypted secrets in Pages runtime
   configuration, independently for preview and production. Use only synthetic
   names in preview. The organizer enters the real model mapping directly into
   the production encrypted secret store. No actual names are needed for review.
5. Keep `VOTING_OPEN=false` in production. Verify ALLOWED_ORIGIN against the exact
   HTTPS origin and `src/config.ts`. Do not use wildcard origins. Verify the API
   routes return JSON errors rather than homepage HTML when unavailable.
6. Add Cloudflare edge rate limiting to session/vote/reveal routes before public
   release (especially to protect D1 from high-volume scans). The included D1
   limiter protects the application but is not a volumetric DDoS defense.
7. Arrange scheduled retention maintenance (Pages Functions have no cron trigger).
   At least daily, run `DELETE FROM rate_limits WHERE expires_at <= unixepoch()`
   through a private scheduled Worker/job with the correct D1 binding. Each API
   request also deletes expired buckets; inactive sites still need this schedule
   to meet the 24-hour physical retention bound. Never expose cleanup via a public
   unauthenticated endpoint.
8. Agree on a results-finalization date and 90-day vote retention window. After
   finalization export anonymous aggregate counts if desired, then delete per-voter
   rows at expiry and close voting. Cookie expiry alone does not delete D1 rows.
   No automatic vote deletion is shipped because deleting live deduplication rows
   could permit repeat votes; configure the private retention job before launch.
9. After independent security review and explicit deployment authorization, test
   a synthetic preview deployment: HTTPS cookies, origin checks, D1 writes, no-store,
   refresh recovery, static deep links, audio MIME/Range and physical Android Chrome.
   Production voting can open only after a separately authorized release.

## Abuse controls and limits

The D1 limiter permits 60 session requests or 120 vote/reveal requests per ten-minute
bucket per coarse network prefix (IPv4 /24, IPv6 /56). These are separate buckets.
Only HMAC keys incorporating day and window are stored, not raw IPs or prefixes.
Cloudflare supplies CF-Connecting-IP; missing/malformed addresses fail closed. An
invalid cookie is rejected, never silently replaced. Inform users that clearing
cookies or switching devices/networks can bypass deduplication; shared networks
can also be throttled. This remains an informal experiment, not a verified election.

Optional Turnstile verification checks success, hostname, action and timestamp via
Siteverify; the provider enforces token expiration/replay. Exact persisted retries
skip a new challenge. The current UI does not include a Turnstile widget: **leave
TURNSTILE_SECRET_KEY unset** unless implementing and reviewing that UI first.
If set accidentally, new votes fail closed with a verification-required message.
Do not represent Turnstile as active protection when it is not configured.

## Validation and known limits

The executed suite covers simultaneous identical and conflicting votes, cross-session
UUID collision, persisted totals, exact retry, reload reveal, missing/forged/expired
cookies, CSRF/origin rejection, oversized and invalid bodies, missing bindings/secrets,
closed voting, database errors, rate limits/expiry and cache headers. Browser QA
uses actual local D1, including an intentionally dropped post-commit response.
Public artifacts are scanned for synthetic identity and secret-name leakage.

Local validation does not establish that the live Pages deployment works. No remote
D1, real mapping, production credentials, physical Android device, production rate
limit rules or retention scheduler were used/configured. Turnstile provider behavior
is not an end-to-end live integration test. Independent review should pay particular
attention to cookie key lifecycle, origin/proxy assumptions, rate-limit thresholds,
retention jobs, challenge integration if enabled, and preview/production isolation.

GO for independent code/security review. NO-GO for opening production voting until
operator setup, review findings, remote preview validation and release authorization
are complete.

### Executed checkpoint validation

- `npm run build`: passed; browser enhancement bundle approximately 7.2 kB uncompressed.
- `npm run check`: typecheck, lint and all 29 tests passed; zero failures/skips.
- `npm run build:functions`: compiled the actual Pages worker successfully.
- `wrangler d1 migrations apply VOTES_DB --local`: migration applied successfully.
- `npm run qa:one-sound`: six widths (320–1440px), actual audio playback/exclusivity,
  seek, no preload, no-JS/error fallback, MIME/Range and existing integrations passed.
- `npm run qa:voting`: 360/390/1440px vote/reveal/reload and post-commit lost-response
  retry passed against the compiled Pages worker and local D1. Artifact scan passed.
- Optional Siteverify decisions are tested with synthetic provider responses,
  including hostname/action/age rejection and provider replay failure; no live
  challenge was performed.

Initial tooling/harness and retry error-handling failures were corrected before the
final passing runs. Wrangler logs and generated worker bundles stay in ignored
`.wrangler/`, outside public assets.

When preparing separate Pages environments with Wrangler as the source of truth,
set production `d1_databases` to its actual ID and define a separate
`env.preview.d1_databases` entry for preview. Also explicitly define preview `vars`
(they are not inherited): EXPERIMENT_ID, VOTING_OPEN and ALLOWED_ORIGIN. Configure
secrets separately per environment; never copy production mapping into preview.
