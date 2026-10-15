import type {BrowserContext} from 'playwright-core';
// Only intercepted by browser QA. Never bundled into the application.
const script = `
let current, next = 0;
window.__turnstileMock = {renders: 0, removed: 0,
  expire() { current['expired-callback'](); },
  fail() { current['error-callback'](); },
  timeout() { current['timeout-callback'](); }
};
window.turnstile = {
  render(container, options) {
    if (options.sitekey !== '0x4AAAAAAFXD2CJDuINrpM0q' || options.action !== 'one-sound-vote' || options.size !== 'compact') throw Error('Wrong Turnstile options');
    current = options; window.__turnstileMock.renders++;
    const id = String(++next);
    container.textContent = 'Synthetic browser verification';
    setTimeout(() => options.callback('synthetic-token-' + crypto.randomUUID()), 20);
    return id;
  },
  remove() { window.__turnstileMock.removed++; },
  reset() { throw Error('Expected explicit removal before a new challenge'); }
};`;
export async function mockTurnstile(context: BrowserContext) {
  await context.route('https://**/*', route => route.fulfill({status: 200, body: ''}));
  await context.route('https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit', route => route.fulfill({status: 200, contentType: 'text/javascript', body: script}));
}
