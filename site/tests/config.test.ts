// The owner-facing configuration stays valid and honest.
import assert from 'node:assert/strict';
import {test} from 'node:test';
import {config} from '../src/config.ts';
import {outbound, siteOrigin} from '../src/links.ts';
import {released06, repo06, status, version} from '../src/site.ts';

test('configured URLs pass the outbound policy', () => {
  assert.doesNotThrow(() => outbound(config.supportUrl));
  assert.doesNotThrow(() => outbound(config.requestPackUrl, {allowMailto: true}));
  assert.doesNotThrow(() => siteOrigin(config.siteUrl));
});

test('the repository is the real one', () => {
  assert.equal(config.repoUrl, 'https://github.com/mataindustries/daemonv12');
});

test('the V0.6 flag drives the status line and V0.6 links together', () => {
  assert.equal(typeof config.v06Released, 'boolean');
  assert.equal(version, released06 ? '0.6' : '0.5');
  assert.equal(status, `Public beta · v${version}`);
  assert.match(repo06('docs/V0_6_SAMPLE_PERFORMANCE.md'), released06 ? /\/blob\/main\// : new RegExp(`/blob/${config.v06PreviewRef}/`));
});

test('promo media paths are site-relative under /media/', () => {
  assert.match(config.promo.video, /^\/media\/[\w.-]+\.mp4$/);
  assert.match(config.promo.poster, /^\/media\/[\w.-]+\.jpg$/);
});
