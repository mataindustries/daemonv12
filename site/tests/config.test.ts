// The owner-facing configuration stays valid and honest.
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {test} from 'node:test';
import {config} from '../src/config.ts';
import {outbound, siteOrigin} from '../src/links.ts';
import {engineVersion, repo, status, version} from '../src/site.ts';

test('configured URLs pass the outbound policy', () => {
  assert.doesNotThrow(() => outbound(config.supportUrl));
  assert.doesNotThrow(() => outbound(config.requestPackUrl, {allowMailto: true}));
  assert.doesNotThrow(() => outbound(config.contactUrl, {allowMailto: true}));
  assert.doesNotThrow(() => outbound(config.portfolioUrl));
  assert.doesNotThrow(() => outbound(config.ignition.videoUrl));
  assert.doesNotThrow(() => siteOrigin(config.siteUrl));
});

test('support, pack requests and analytics are configured for production', () => {
  assert.equal(new URL(config.supportUrl).hostname, 'buy.stripe.com');
  assert.equal(new URL(config.requestPackUrl).hostname, 'tally.so');
  assert.equal(config.analyticsMeasurementId, 'G-PXEFNNG7H3');
  assert.match(config.analyticsMeasurementId, /^G-[A-Z0-9]+$/);
});

test('the repository is the real one', () => {
  assert.equal(config.repoUrl, 'https://github.com/mataindustries/daemonv12');
});

test('site release matches the merged engine and all contracts link to main', () => {
  const pkg = JSON.parse(readFileSync(new URL('../../package.json', import.meta.url), 'utf8'));
  assert.equal(engineVersion, pkg.version);
  assert.equal(engineVersion, '0.7.0');
  assert.equal(version, '0.7');
  assert.equal(status, `Public beta · v${version}`);
  assert.match(repo('docs/V0_7_SAMPLER_ARTICULATION.md'), /\/blob\/main\//);
});

test('showcase and commercial paths use the verified destinations', () => {
  assert.equal(config.ignition.videoUrl, 'https://youtube.com/shorts/8_sCK9_PhbE');
  assert.equal(config.portfolioUrl, 'https://ziggurat.pages.dev/');
  assert.equal(new URL(config.contactUrl).pathname, 'matasergio741@gmail.com');
});

test('promo media paths are site-relative under /media/', () => {
  assert.match(config.promo.video, /^\/media\/[\w.-]+\.mp4$/);
  assert.match(config.promo.poster, /^\/media\/[\w.-]+\.jpg$/);
});
