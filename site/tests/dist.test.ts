// Checks the production output when it exists (`npm run build` first). Skipped otherwise,
// so `npm test` works on a fresh checkout.
import assert from 'node:assert/strict';
import {existsSync, readFileSync, readdirSync, statSync} from 'node:fs';
import {join} from 'node:path';
import {test} from 'node:test';
import {fileURLToPath} from 'node:url';
import {config} from '../src/config.ts';

const site = fileURLToPath(new URL('..', import.meta.url));
const dist = join(site, 'dist');
const built = existsSync(join(dist, 'index.html'));
const html = built ? readFileSync(join(dist, 'index.html'), 'utf8') : '';
const opts = {skip: built ? false : 'run `npm run build` first'};
const walk = (dir: string): string[] => readdirSync(dir).flatMap(n => (statSync(join(dir, n)).isDirectory() ? walk(join(dir, n)) : [join(dir, n)]));

test('static HTML carries the page, metadata and one h1', opts, () => {
  assert.equal(html.match(/<h1[\s>]/g)?.length, 1);
  assert.match(html, /<title>DaemonV12: give agents instruments<\/title>/);
  assert.match(html, /<meta name="description" content="[^"]{80,}">/);
  for (const tag of ['og:title', 'og:description', 'og:image', 'twitter:card', 'twitter:image']) assert.match(html, new RegExp(`(property|name)="${tag}"`), tag);
  assert.match(html, /GIVE AGENTS/);
  assert.ok(!/\bundefined\b|\bNaN\b|\[object Object\]/.test(html.replace(/<script type="application\/ld\+json">.*?<\/script>/s, '')), 'no leaked values');
  assert.ok(existsSync(join(dist, 'og.png')) && existsSync(join(dist, 'favicon.svg')) && existsSync(join(dist, 'robots.txt')));
});

test('every new-tab link is https with noopener noreferrer', opts, () => {
  const anchors = html.match(/<a [^>]*target="_blank"[^>]*>/g) ?? [];
  assert.ok(anchors.length > 5);
  for (const a of anchors) {
    assert.match(a, /href="https:\/\//, a);
    assert.match(a, /rel="noopener noreferrer"/, a);
  }
});

test('configured support/request URLs render active links; empty URLs stay pending', opts, () => {
  if (config.supportUrl.trim().length === 0) assert.match(html, /<span class="btn btn--pending" role="link" aria-disabled="true" data-pending="support">/);
  else assert.match(html, /data-outbound="support"/);
  if (config.requestPackUrl.trim().length === 0) assert.match(html, /data-pending="request-pack"/);
  else assert.match(html, /data-outbound="request-pack"/);
  assert.ok(!/js\.stripe\.com|stripe\.js/i.test(html), 'no Stripe SDK');
});

test('V0.6 is presented according to the release flag', opts, () => {
  if (config.v06Released) {
    assert.match(html, /Public beta · v0\.6/);
    assert.ok(!/Final review/.test(html));
  } else {
    assert.match(html, /V0\.6 · Final review/);
    assert.match(html, /In final review, not yet released/);
    assert.match(html, /Public beta · v0\.5/);
    assert.ok(!html.includes('class="cap cap--new"'), 'capability strip does not claim V0.6');
    assert.ok(!html.includes('demo:ghost-shift'), 'no V0.6 command offered before release');
  }
});

test('the film is a real player only when the web cut exists', opts, () => {
  const hasVideo = existsSync(join(dist, config.promo.video.slice(1)));
  if (hasVideo) {
    assert.match(html, /<video[^>]*\bplaysinline\b[^>]*>|<video[^>]*playsInline/i);
    assert.match(html, /preload="none"/);
    assert.match(html, /\bcontrols\b/);
    assert.ok(!/<video[^>]*\bautoplay\b/i.test(html), 'autoplay is decided by the script, not the markup');
  } else {
    assert.ok(!html.includes('<video'), 'no broken player');
    assert.match(html, /film__pending/);
  }
});

test('no file exceeds the Cloudflare Pages 25 MiB limit', opts, () => {
  for (const file of walk(dist)) assert.ok(statSync(file).size <= 25 * 1024 * 1024, file);
});
