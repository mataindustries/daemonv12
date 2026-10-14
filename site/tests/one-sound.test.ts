import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {readFileSync, readdirSync} from 'node:fs';
import {test} from 'node:test';

const read = (path: string) => readFileSync(new URL(`../${path}`, import.meta.url), 'utf8');
test('only the four verified anonymous audio assets are public', () => {
  const entries = read('docs/one-sound.sha256').trim().split('\n').map(line => line.split(/\s+/));
  const dir = new URL('../public/media/one-sound/', import.meta.url);
  assert.deepEqual(readdirSync(dir).sort(), entries.map(([, file]) => file).sort());
  for (const [hash, file] of entries) {
    assert.equal(createHash('sha256').update(readFileSync(new URL(file!, dir))).digest('hex'), hash, file);
  }
});
test('production showcase is static, anonymous and has a pending ballot', () => {
  const html = read('dist/one-sound/index.html');
  assert.equal((html.match(/<h1[ >]/g) ?? []).length, 1);
  assert.equal((html.match(/<audio /g) ?? []).length, 4);
  assert.equal((html.match(/preload="none"/g) ?? []).length, 4);
  assert.match(html, /canonical" href="https:\/\/daemonv12.pages.dev\/one-sound\/"/);
  assert.match(html, /<button[^>]*disabled/);
  assert.match(html, /Your choice is not sent or saved/);
  assert.match(html, /G-PXEFNNG7H3/);
  assert.ok(!/<form|autoplay|MODEL_TRACK_MAP|localStorage|sessionStorage/.test(html));
  assert.match(read('dist/sitemap.xml'), /\/one-sound\//);
});
