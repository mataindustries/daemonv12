# ONE SOUND independent review and remediation

Review source: the complete preceding independent Sol Ultra review of PR #22,
commit `89903ce91f574b9a56d793a6d65c25d06384f26e`. The review found no critical/high
vulnerability and no authenticated-persisted-vote disclosure bypass. This record
includes its first finding (D1 writes on rejected requests), not just result-query
amplification and the frontend issue.

## Recovered findings and disposition

### F1 — Medium: rejected/throttled traffic keeps mutating D1

**Original evidence:** `functions/_lib/voting.ts:77–83,131–140,157–159` at the
reviewed commit. The limiter ran DELETE and UPSERT before cookie authentication
and before checking its cap or closed voting. In synthetic reproduction, 65
session requests caused 130 mutation statements (60 responses with 200, five
with 429); 125 missing-cookie vote requests with allowed Origin caused 250
mutation statements (120 responses with 403, five with 429). A direct client can
supply Origin. One host also consumes the coarse network's shared allowance.
Actual remote quota exhaustion/outage was not demonstrated.

**Recommended mitigation:** edge limits/restricted access, reject obviously
unauthenticated requests before SQL, and avoid attacker-triggered database work.

**Implemented:** authenticate cookies and validate vote input/CSRF before SQL.
Fresh anonymous closed-session checks return closed status without database work
or issuing reusable voting credentials. Open session issuance remains limited.
Remove per-request retention DELETE. Read saturated buckets without executing a
mutation statement; conditional UPSERT caps increments atomically under races.
A bounded 1024-entry isolate rejection cache skips SQL for known exhausted keys.
D1 remains authoritative after eviction/restart. Expiry allows requests again.

**Regression evidence:** real local D1 tests cover 65 concurrent session calls,
exactly 60 admissions and a stored count of 60, zero SQL on subsequent cached
rejections, zero mutation statements after worker reload, zero SQL for missing or
invalid sessions/invalid bodies/CSRF, and closed anonymous checks without cookies.
IPv4 sharing, normalized IPv6 /56 buckets, malformed IPs, and window rollover
are covered.

**Residual operational requirement:** a cold isolate can still issue a point
read, and distributed identities reach different buckets. Edge protection or
restricted preview access remains necessary. Private scheduled retention is now
the only expiry cleanup; configure it before ongoing/public operation. This task
does not provision it. A short-lived restricted synthetic preview must discard
its test database after use if maintenance is not configured.

### F2 — Medium: authenticated result-query amplification

**Original evidence:** `functions/_lib/voting.ts:116–120,145–155` and
`migrations/0001_one_sound.sql:10` at the reviewed commit. Successful votes,
exact retries, and reveals all executed a grouped COUNT over the experiment's
vote index. Reproduction: populate synthetic votes, inspect the SQLite plan,
and repeatedly reveal using a persisted synthetic voter. The covering index
avoided table fetches but still traversed matching votes on each result request.
Query growth was verified; production timing/billing/exhaustion was conditional.

**Recommended mitigation:** bounded authenticated refresh traffic, transactional
per-track counters or a server aggregate snapshot, preserving persisted-vote
authorization before revealing anything.

**Implemented:** new migration `0002_vote_totals.sql` backfills exactly three
counter rows, then maintains them with AFTER INSERT/DELETE triggers. A successful
insert and its count update share the same SQLite transaction. Ignored conflicts
do not fire the insert trigger. A missing counter aborts the write; vote updates
are forbidden, and retention deletes decrement counters atomically. Do not edit
the original migration. Apply all migrations with voting closed.

Result reads fetch only the three rows after authenticated persisted-vote lookup,
and reject incomplete/invalid totals. The existing first-primary session, voter
primary key, request UUID uniqueness, strict retry comparison, and no-store
responses remain. Vote/reveal calls share a 30-request per-voter allowance per
ten minutes across networks; coarse network limits remain in addition. Exact
retry still returns the persisted result after any throttle window resets.

**Regression evidence:** D1 backfill, missing-counter rollback, immutable votes,
retention deletion, concurrent identical/conflicting requests, cross-session UUID
collision, 18 simultaneous distinct voters, and exact counter values. D1 result
rows-read remains the same before/after inserting 1,500 synthetic votes. Concurrent
mixed retries/reveals from distinct prefixes cannot exceed the shared allowance.
Injected post-commit read/result failures return generic errors; retry and closed
recovery retain exactly one vote. Throttle-window recovery is tested.

### F3 — Low: voting-closed frontend state leaves submit enabled

**Original evidence:** `src/voting.ts:20–23,62–74,98–102` at the reviewed commit.
Load an open session, select a track, then close voting before submission. A 503
`voting_closed` response changes the note but leaves the stale open flag true,
so the button remains enabled. The backend still rejects new votes.

**Recommended mitigation:** update the voting state on closure and add a browser
regression.

**Implemented:** set `votingOpen=false` for `voting_closed` and the documented
unsupported `challenge_required` state. A later explicit status check can restore
availability. Throttle messaging now describes both session and network limits.

**Regression evidence:** browser QA loads an open ballot against the compiled
Pages worker, closes that actual worker's voting setting, submits, and verifies
the disabled "Voting is closed" button, hidden results, and unchanged vote count.
Reopening plus status recheck restores availability. Additional real-D1 browser
cases exercise changed selection after a lost committed response and failed
reveal followed by recovery, without creating another vote or counter increment.

## Other observations recovered from the review

These were not ranked verified vulnerabilities and are not represented as fixed
exploits:

| Observation | Evidence/reproduction from review | Mitigation/status |
| --- | --- | --- |
| Fresh-tab cookie replacement | Two simultaneous cookie-less session requests issue different cookies; a delayed response can replace the identity after a vote. Lost-response recovery under the replacement cookie may hit request-ID conflict. Code-derived risk; no real-browser reproduction in the review. | Cookie-only deduplication remains documented. Same-browser multi-tab continuity requires a separately tested bootstrap serialization design. Not changed in this focused patch. |
| Preview/production isolation and placeholder configuration | Wrangler uses an all-zero D1 ID, the base Pages origin, and no preview override. Different branch/hash hostname yields `403 invalid_origin`. Live isolation was not inspected. | Before preview, independently configure preview D1, synthetic mapping, distinct secrets, explicit preview vars, exact HTTPS origin, and `VOTING_OPEN=false`. No infrastructure/configuration of live environments occurred here. |
| Turnstile has no frontend widget | Backend validates provider success/hostname/action/age, but frontend sends no token. Setting the secret blocks new votes. Live provider replay was not tested. | Keep the optional secret unset until UI integration is implemented/reviewed. Existing provider decision/replay tests remain; HTTP failure, malformed JSON and timeout are now tested. |
| Retention and edge setup remain operator work | Pages Functions have no cron; closing voting does not stop authenticated recovery or all request work. | Follow operations requirements. Closure is not a disclosure kill switch for existing authorized voters. No public cleanup endpoint was added. |
| Existing browser identity limits | Clearing cookies or switching devices can vote again; revealed identities can be shared by legitimate voters. | Continue presenting this as an informal experiment, not a verified election. No human-identity guarantee is added. |
| Missing regression coverage and runtime validation | Prior review used synthetic adapters; Miniflare/browser suites were unavailable then. | This remediation runs the actual workerd/Miniflare D1 suite, production build and compiled-router Chromium QA. Remote HTTPS, actual binding selection, replica behavior and physical Android still require preview/operator validation. |

The review found no verified bypass of HMAC cookies, expiry, duplicate-cookie
rejection, CSRF/exact Origin checks, persisted-vote gating, unique constraints,
safe error responses, frontend text insertion, or ordinary exact-retry behavior.
These controls remain and are covered by the expanded suite. New tests add signed
expiry/horizon boundaries, cross-session CSRF, missing/null Origin, voted
cross-site reveal, stream size without Content-Length, invalid UTF-8 and generic
post-commit failures. Slow-body load behavior, cookie refusal, fresh-tab races,
live Siteverify replay, actual deployment secrets/isolation, and cloud replication
remain outside the executed checks.

## Validation and release decision

Executed validation on the final implementation:

- `npm run check`: typecheck, lint, and all 41 tests passed, including 18 actual
  workerd/Miniflare D1 security/integration tests; zero failures or skips.
- `npm run build`: production client and SSR/prerender build passed.
- `npm run qa:voting`: Pages Functions compilation and real-D1 Chromium QA
  passed at 360/390/1440px, including reload, dropped responses, mid-session
  closure, changed selection and failed-reveal recovery. Public artifact scan
  passed. Test-only instrumentation is absent from the compiled Pages worker.
- `npm run qa:one-sound`: 320/360/390/430/768/1440px layout, native playback,
  exclusivity, seek, no-JS/error fallback, MIME/Range and homepage checks passed.
- `wrangler d1 migrations apply VOTES_DB --local`: both migrations applied
  successfully through the actual migration command; no remote database used.
- `git diff --check`: passed.

Initial test-harness issues (stream duplex, stale D1 handles after worker reload,
and empty-header normalization) were corrected without weakening production
controls. All data and identity names are synthetic. No real mapping or
production secret was requested or used. Browser tests use Chromium mobile
emulation; physical Android and live Cloudflare HTTPS remain unverified.

**GO for a short-lived, restricted, isolated synthetic Cloudflare preview with
voting disabled by default**, after explicit preview DB/secret/origin selection
and application of both migrations. **NO-GO for unrestricted public voting**
until edge controls, retention maintenance and remote runtime/isolation checks
are complete. This code change does not merge, deploy, open voting, or provision
infrastructure. The push commit uses `[CF-Pages-Skip]`.
