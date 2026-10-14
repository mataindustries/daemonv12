# ONE SOUND Turnstile integration

## Behavior and security boundary

`src/turnstile.ts` loads only the official
`https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit` script.
The public site key is `0x4AAAAAAFXD2CJDuINrpM0q`; action is `one-sound-vote`.
A compact dark Managed widget fits the narrowest ballot. It loads only after an
open, unvoted session is established; closed voting and persisted-vote recovery
do not fetch the widget. Failure/expiry/timeout clear the current token, disable
new submissions and offer Retry verification. Script-load failure is recoverable.
Tokens exist only in memory and the HTTPS vote body, not browser storage or logs.
No identifiers are sent as Turnstile cData, and the automatic response field is off.

Each submission consumes the current token. A definite Siteverify rejection resets
the widget; the same selection retains its request UUID. After an uncertain response,
the previously submitted UUID/token remain usable for recovery even if verification
has expired. The server checks persisted votes before Siteverify; retries never add
a second vote. An unpersisted attempt with a consumed token is rejected and must
reverify. Changing selection still uses a new UUID, with the existing server rule
rejecting a second vote and the client recovering the original vote via reveal.
Refresh/status recovery does not require a token. Widgets are removed on success.

The backend is unchanged. Enforcement requires TURNSTILE_SECRET_KEY in the server
runtime; the widget alone cannot enforce protection. Never put that secret in a
VITE variable, Git, static content, analytics or client configuration. No mapping,
voter identifier or result is added to public assets. Both existing D1 bindings and
both `VOTING_OPEN=false` settings are unchanged. No deployment or secrets installation
was performed. The push uses `[CF-Pages-Skip]` and updates the existing PR branch.

## Automated checks

Run from `site/`:

```sh
npm run check
npm run build
npm run qa:one-sound
npm run qa:voting
```

Voting QA intercepts only the official client script with a synthetic widget and
mocks Siteverify; the compiled Pages router and D1 remain real local components.
Tests assert the site key/action, token submission, provider single-use behavior,
expiry/error/timeout callbacks, script failure/retry, new token with the same UUID
on rejection, expired-token exact retry after a lost response, and reload/reveal
without another widget or Siteverify call. The unchanged backend tests cover provider
hostname/action/age, timeout, malformed responses, replay rejection and persistence.
Audio QA covers widths 320–1440px. These tests do not establish live widget behavior.

## Real widget smoke test while preview voting stays closed

Once this commit is separately authorized for a protected preview deployment:

1. Sign in through the preview's access protection and open exactly
   `https://feature-one-sound-showcase.daemonv12.pages.dev/one-sound/`.
   Use this branch alias, not a hash deployment URL: the server's exact allowed
   origin is pinned to the alias. Check the served commit matches this change.
2. Confirm `/api/one-sound/session` reports `votingOpen:false`, the vote button is
   disabled, and no widget is normally loaded for a new visitor. Do not change
   either environment's voting flag for this smoke test.
3. To test the real public key/hostname/widget without making a vote or installing
   a secret, run this optional DevTools snippet on that protected page. It adds a
   temporary widget only to your tab; the token is never printed or submitted:

```js
const panel = document.createElement('div');
panel.style.cssText = 'padding:24px;background:#141416;color:white';
const note = document.createElement('p');
const widget = document.createElement('div');
panel.append(note, widget);
document.querySelector('main').prepend(panel);
const script = document.createElement('script');
script.src = 'https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit';
script.onload = () => window.turnstile.render(widget, {
  sitekey: '0x4AAAAAAFXD2CJDuINrpM0q', action: 'one-sound-vote',
  size: 'compact', theme: 'dark', 'response-field': false,
  callback: () => { note.textContent = 'Real widget verified; no vote submitted.'; },
  'error-callback': () => { note.textContent = 'Widget verification failed.'; },
  'expired-callback': () => { note.textContent = 'Token expired; no vote submitted.'; }
});
script.onerror = () => { note.textContent = 'Official script could not load.'; };
document.head.append(script);
```

Reload removes the temporary panel. This verifies the live widget and allowed
hostname only, not the application lifecycle or server Siteverify integration.
If a CSP is configured outside this repository, allow the official Turnstile origin
in script-src, frame-src and connect-src as required; do not self-host/proxy api.js.
Browser/content blockers and Cloudflare Access settings may need inspection.

## Full protected-preview acceptance (separate operator authorization required)

A successful voting test cannot run while `VOTING_OPEN=false`. Do not weaken that
setting as part of this code task. For a later explicitly authorized test window:

1. Verify Access protection restricts the feature preview to named testers. Confirm
   its isolated preview D1 binding and both applied migrations. Use synthetic model
   identities only and the existing exact preview ALLOWED_ORIGIN. Keep production
   voting false throughout.
2. An authorized operator configures the matching widget secret as the preview-only
   TURNSTILE_SECRET_KEY runtime secret. Preserve the other preview-only secrets.
   Never install or copy a production model mapping into preview.
3. Only for that authorized private test window, set preview voting true using the
   deployment's actual configuration source; deploy/redeploy the protected preview
   explicitly. Do not commit an open-voting setting or deploy production.
4. With a fresh browser session, verify the widget fits mobile, keyboard interaction
   works, and Vote & Reveal stays disabled until selection and verification succeed.
   Submit one vote; inspect that the request contains turnstileToken and that D1
   recorded exactly one row. Do not save/share raw request payloads, cookies or tokens.
5. Refresh and confirm reveal without a new widget. In another fresh session, wait
   for expiry, block the official script, and test Retry verification. Test a lost
   vote response using DevTools/offline controls, then Check voting status; confirm
   the count increases only once. Test Android Chrome on a physical device.
6. Restore preview voting false and redeploy the protected preview. Confirm both
   environment flags are false and a fresh visitor cannot vote. Remove test vote
   data only through the approved private cleanup procedure; never touch production.

Until these steps are separately authorized and executed, live Siteverify, real
Managed challenge behavior and physical-device results remain unverified.
