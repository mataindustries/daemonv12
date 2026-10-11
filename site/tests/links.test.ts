// Outbound link policy: every configurable URL is checked at build time.
import assert from 'node:assert/strict';
import {test} from 'node:test';
import {outbound, siteOrigin} from '../src/links.ts';

test('an empty URL renders the pending state instead of a link', () => {
  assert.equal(outbound(''), null);
  assert.equal(outbound('   '), null);
  assert.equal(outbound('', {allowMailto: true}), null);
});

test('https links open in a new tab without opener or referrer', () => {
  assert.deepEqual(outbound('https://buy.stripe.com/test_123'), {
    href: 'https://buy.stripe.com/test_123',
    target: '_blank',
    rel: 'noopener noreferrer',
  });
});

test('mailto is allowed only where configured, and stays in the same tab', () => {
  assert.deepEqual(outbound('mailto:packs@example.com', {allowMailto: true}), {href: 'mailto:packs@example.com'});
  assert.throws(() => outbound('mailto:packs@example.com'), /Unsupported URL/);
  assert.throws(() => outbound('mailto:nobody', {allowMailto: true}), /Unsupported URL/);
});

test('unsafe or malformed URLs fail the build', () => {
  for (const bad of ['http://buy.stripe.com/x', 'javascript:alert(1)', 'data:text/html,hi', 'ftp://x.y', 'buy.stripe.com/x', '//buy.stripe.com/x']) {
    assert.throws(() => outbound(bad, {allowMailto: true}), /URL in src\/config\.ts/, bad);
  }
});

test('siteUrl becomes a bare https origin', () => {
  assert.equal(siteOrigin(''), '');
  assert.equal(siteOrigin('https://daemonv12.pages.dev/'), 'https://daemonv12.pages.dev');
  assert.equal(siteOrigin('https://daemonv12.pages.dev/some/path'), 'https://daemonv12.pages.dev');
  assert.throws(() => siteOrigin('http://daemonv12.pages.dev'), /https/);
});
