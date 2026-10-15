# ONE SOUND pre-public-voting hardening

Scope: continuation of PR #22 on `feature/one-sound-showcase`. This record
supersedes the older remediation record's optional-Turnstile advice and its
unreproduced-cookie-race status. No deployment or enablement is authorized.

## Fixed: mandatory verification

New votes require a nonblank server Turnstile secret and a successful Siteverify
response with literal boolean `true`, the exact hostname/action, and an acceptable
challenge timestamp. Invalid credentials, missing challenges, provider rejection,
malformed responses and timeout cannot insert a vote. Existing authenticated
reveal and exact retry are checked before requiring verification, including when
voting is closed or the secret is unavailable. Cookie, CSRF and origin checks
are unchanged. Tests use only synthetic credentials and a local provider adapter.

## Fixed: request-size compatibility

The streaming ceiling is 16,384 bytes; the decoded token ceiling is 2,048 UTF-16
code units (supported ASCII tokens fit). This accommodates a 2,048-character token
even if every character is encoded as a six-byte JSON Unicode escape, plus 4 KiB
for normal fields and framing. The reader cancels at the first excessive chunk.
Malformed JSON/UTF-8 and excessive tokens fail before SQL or provider calls.
Tests cover ordinary and escaped maximum tokens at the exact byte ceiling,
2,049-character tokens, a 16,385-byte chunked stream and malformed UTF-8/JSON.

## Open: simultaneous fresh-tab cookie issuance

**NO-GO for public voting.** No production workaround is implemented.

Run from `site/` after building:

```sh
npm run qa:voting -- --reproduce-cookie-race
```

The optional diagnostic uses two Chromium pages in one fresh browser context,
the compiled Pages worker, real local D1, and synthetic Turnstile verification.
Both session requests reach the worker without cookies. It holds the second
response until the first page has committed a vote, then delivers the second
`Set-Cookie`. Assertions verify different signed cookies, replacement in the
browser cookie jar, loss of first-page recovery after reload, and two stored votes
after the second page votes. Explicit promise gates control the ordering; no
sleep-based timing or fabricated API responses are used. A successful diagnostic
means the vulnerability was reproduced, **not** remediated. It is opt-in to avoid
representing this known-bad outcome as a passing security regression.

### Design recommendation and limits

The server sees two independent unauthenticated requests before either cookie
exists. It cannot associate them without shared identity. Binding them to an IP,
fingerprint or a new persistent browser identifier would change privacy/security
semantics and is excluded here. Cookie response processing has no compare-and-set
operation; application JavaScript cannot inspect or reject an arriving HttpOnly
cookie overwrite. Reissuing a voted cookie adds another last-response-wins race.

An origin-wide bootstrap coordinator is the next design to evaluate: every
cooperating tab must serialize session issuance and wait for confirmed cookie
installation before releasing ownership. Require support and fail closed rather
than falling back to uncoordinated issuance. Web Locks alone around the current
fetch is not a demonstrated lifecycle solution: timeout, tab destruction, process
crash, navigation/BFCache and a response arriving after ownership loss must be
proven safe. A service/shared-worker coordinator changes the session lifecycle
and requires a separate design review and supported-browser matrix. Direct API
callers remain outside frontend coordination, as do deliberate cookie deletion
and separate devices; this is still an informal cookie-based ballot.

Before accepting that design, convert the diagnostic into a blocking regression
expecting one installed identity, successful recovery and exactly one vote. Add
late-response-after-abort, coordinator loss, unsupported-browser fail-closed,
closed-voting, reload and lost-vote-response cases. Do not ship a partial lock or
BroadcastChannel timer as a security fix. Keep both environments closed until
this issue and the existing operational launch requirements are resolved.

## Validation

Executed from `site/`:

- After priority 1: `npm run test:voting` — 20/20 passed.
- After priority 2: `npm run test:voting` — 21/21 passed.
- Final `npm run check` — typecheck, lint, 44/44 tests passed (21 voting tests),
  zero failures/skips. Includes absent, blank and invalid verification credentials.
- `npm run build` — client, SSR and prerender passed.
- `npm run qa:one-sound` — passed at 320/360/390/430/768/1440px, including
  playback, seeking, no-JS/error fallback, MIME/Range and homepage checks.
- `npm run qa:voting -- --reproduce-cookie-race` — compiled worker and all normal
  voting QA passed at 360/390/1440px; deterministic diagnostic confirmed the open
  race, loss of recovery and second insertion. This is not a fixed-race result.
- `npm audit --omit=dev --audit-level=high` — zero vulnerabilities, both in `site/`
  and the repository root.
- `git diff --check` — passed.

The initial browser launches failed because Chromium and its system libraries
were absent. Installed the existing Playwright dependency's matching Chromium
under `/tmp/one-sound-browsers` and its system dependencies, then reran successfully
with `CHROMIUM_PATH` pointing to that browser. No package or lockfile changed.
These are local Chromium/synthetic-provider checks, not live Siteverify or remote
Cloudflare runtime verification.

Production/preview configuration, D1 bindings, signing keys, model mapping and
frozen materials are unchanged. Both `VOTING_OPEN` values remain `false`.

**GO for independent review of the two fixes and the remaining design decision.
NO-GO for public voting.** Commit uses `[CF-Pages-Skip]`; no deployment, merge,
secret installation, new tracking or public-voting enablement is performed.
