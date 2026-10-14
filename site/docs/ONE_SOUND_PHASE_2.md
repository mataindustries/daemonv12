# ONE SOUND: Phase 2 handoff

## Checkpoint and preview

Phase 1 is a static, prerendered `/one-sound/` page. React runs only at build time;
the existing small browser script coordinates native players. No voting API,
identity mapping, vote totals, cookies or browser storage have been implemented.
Radio selection previews the ballot only; the submit button is disabled.
The existing homepage Stripe/Tally links and corrected GA4 configuration are preserved.
GA4 receives normal page views; no listening or ballot-choice events are added.

From `site/`: `npm ci`, `npm run build`, `npm run preview`. Open
`http://localhost:4173/one-sound/`. `npm run dev` also renders this route.
Run `npm run check` and `CHROMIUM_PATH=/usr/bin/chromium npm run qa:one-sound`.
Browser QA uses Chromium mobile emulation, not a physical Android device.
Without JavaScript, native playback works but listeners must pause other players manually.

## Public media boundary

Only `Original_One_Sound.wav` and `Track_A.mp3`, `Track_B.mp3`, `Track_C.mp3`
from the supplied public ZIP are copied into `public/media/one-sound/`, unchanged.
Verify from that directory with `sha256sum -c ../../../docs/one-sound.sha256`.
All four match the supplied SHA-256 manifest. `ffprobe` reports 1.500000 seconds
for the WAV and 30.040816 seconds for each MP3 (including encoding padding).
The MP3s contain only matching generic Lavf/Lavc encoder tags; the WAV has no tags.
The organizer describes the MP3s as gain-only loudness-matched to -20 LUFS.
No private submissions, archives, production logs or model names belong in public assets.

## Exact next implementation step

On `feature/one-sound-showcase`, add a D1 migration and Pages Functions contract
tests using **synthetic** identities before connecting the ballot. Keep real voting
disabled until the migration, atomic duplicate-vote handling and reveal authorization
pass. Do not put the actual mapping in tests, fixtures, documentation, Git history,
HTML, JavaScript, JSON, source maps, analytics or build logs.

## Server contract

Use same-origin Pages Functions under `site/functions/api/one-sound/`.
Experiment ID: `one-sound-001`; allowed track IDs: `A`, `B`, `C` only.
All API responses (including errors) send `Cache-Control: private, no-store`;
never cache them at the CDN or service worker. Disable cross-origin access.

* `GET /api/one-sound/session`: issue a cryptographically random 256-bit session
  cookie when absent, return `{experimentId, votingOpen, hasVoted, csrfToken}`.
  Set `__Host-one-sound` with `Secure; HttpOnly; SameSite=Lax; Path=/`, no Domain,
  and a documented 90-day maximum lifetime. Sign/authenticate the token using
  `VOTE_COOKIE_SECRET`; reject invalid tokens. Do not return identities or totals.
* `POST /api/one-sound/vote`: JSON `{experimentId, trackId, requestId, csrfToken,
  turnstileToken?}`. Limit the body to 2 KiB; validate UUID requestId, enum track,
  exact experiment, voting-open flag, session, CSRF token and exact Origin.
  Validate Turnstile server-side when enabled (hostname, action, expiry and replay).
  Insert atomically; respond `201` only after persistence succeeds with
  `{experimentId, selectedTrack, reveal: {A, B, C}, results: {A, B, C, total}}`.
  Each reveal value is a model display name from the server secret. Results are
  SQL counts from committed votes, never client input or cached client totals.
* Exact retry with the same session/requestId/track returns `200` and the stored
  vote's reveal/results without inserting again. Any different request for an
  already-voted session returns `409 already_voted` without changing the vote.
* `GET /api/one-sound/reveal`: require an authenticated cookie **and a persisted
  vote for this experiment**; return the same reveal/results for reload recovery.
  Without that vote return `403 vote_required`, with no mapping or totals.
* Errors: `400` invalid input, `403` origin/CSRF/challenge failure, `413` body too
  large, `415` wrong content type, `429` throttled with Retry-After, `503` voting
  closed or unavailable. Errors never contain secrets, raw SQL or stack traces.

## D1 persistence and concurrency

Binding: `VOTES_DB`. Migration proposal:

```sql
CREATE TABLE votes (
  experiment_id TEXT NOT NULL CHECK (experiment_id = 'one-sound-001'),
  voter_hash TEXT NOT NULL,
  track_id TEXT NOT NULL CHECK (track_id IN ('A','B','C')),
  request_id TEXT NOT NULL,
  created_at INTEGER NOT NULL DEFAULT (unixepoch()),
  PRIMARY KEY (experiment_id, voter_hash),
  UNIQUE (experiment_id, request_id)
);
CREATE INDEX votes_counts ON votes(experiment_id, track_id);
```

`voter_hash` is a keyed HMAC of the random cookie identifier using a separate
`VOTER_HASH_SECRET`; do not store raw cookies. Use prepared statements and the
unique constraint as the final race guard, not a read-then-write check. Resolve
conflicts by reading the stored row and comparing requestId AND trackId. Use D1
primary/sequentially consistent reads for insert/retry/reveal (especially if read
replication is enabled). Count with `GROUP BY track_id`, fill absent IDs with zero,
and derive total from those counts. Validate secret mapping availability and shape
before accepting votes; fail closed if configuration is incomplete.

## Privacy and abuse controls

Limit one vote per experiment per cookie. Add Cloudflare rate limiting for session
creation and vote attempts, with conservative thresholds to avoid penalizing shared
networks. For risk signals, use short-lived rotating keyed hashes of coarse IP
prefixes, not permanent raw IP storage or browser fingerprinting. Keep rate-limit
state separate from votes; expire it within 24 hours. Document platform access-log
retention; never log cookies, CSRF tokens, IPs in application logs or the mapping.
Use Turnstile on suspicious traffic if needed; never use the challenge alone as a
vote identity. Explain the cookie and retention before submission. Delete per-voter
records after a documented results-finalization window (proposed: 90 days), retaining
only aggregate counts if needed; reveal recovery then expires too.

Cookie restrictions cannot eliminate vote manipulation: clearing cookies, changing
browsers/devices and distributed traffic can bypass them. IP throttling can affect
shared networks. Present results as an informal experiment, not a verified election.
A legitimate voter can copy/share the revealed identities; server gating cannot
prevent that. Do not claim ballot selection or full-track listening proves a human.

## Cloudflare configuration and release gate

Do not assume the existing website is correctly deployed. Inspect the Pages project,
Git integration, production branch, preview branch rules and custom domains before
any release. This checkpoint must not deploy; its commit uses `[CF-Pages-Skip]`.
Confirm automatic previews are disabled/excluded before future work-branch pushes.

Use root directory `site`, build command `npm ci && npm run build`, output `dist`,
and Node >=22.12 (pin a supported LTS). Pages Functions live in `site/functions`,
not `public`; configure routing so `/api/one-sound/*` reaches Functions and cannot
fall through to the static homepage. Explicitly restrict Functions invocation to
that API prefix. Verify the actual origin against `src/config.ts` for canonical,
Open Graph and sitemap URLs; the currently configured origin is not deployment proof.

Provision separate preview and production D1 databases and apply migrations to each
explicitly. Bind `VOTES_DB`; set `EXPERIMENT_ID`, `VOTING_OPEN=false` and `ALLOWED_ORIGIN`
as server configuration. Set `MODEL_TRACK_MAP` (JSON keyed by A/B/C) **only as a
Cloudflare server-side encrypted secret**, plus `VOTE_COOKIE_SECRET`,
`VOTER_HASH_SECRET`, and optional `TURNSTILE_SECRET_KEY`. Never use `VITE_*` variables
for these values, build-time substitution, committed `.env` or `.dev.vars` files.
Use synthetic mapping values in preview and local ignored secret files; configure
the real mapping directly in the production secret store through an authorized
operator. No actual identity is needed to implement or test the backend.

Before enabling voting: test concurrent duplicate inserts, idempotent retries,
invalid/forged/missing cookies, CSRF/origin rejection, challenge failures, rate limits,
closed voting, D1 failure, missing secrets, reload reveal authorization, and no-store
headers. Scan dist, source maps and public assets for identity leaks. Test frontend
pending/sending/success/error states and ensure failures keep the ballot recoverable.
Verify HTTPS, `/one-sound/` deep links, WAV `audio/wav`, MP3 `audio/mpeg`, byte-range
206 responses, and seek/resume on physical Android Chrome. Only after review and
explicit release authorization enable voting and deploy.
