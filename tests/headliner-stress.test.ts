import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { createHeadlinerStress, STRESS_FRAMES, STRESS_SECONDS, SECTIONS } from '../scripts/create-headliner-stress.ts';
import { compileProjectFile } from '../src/pipeline.ts';
import { sampleTriggers } from '../src/sample-render.ts';
import { voiceCost, voiceFrames } from '../src/render/index.ts';

test('180-second proof regenerates its score and copied approved asset bytes; legacy budget rejects while bounded reuse fits', t => {
  const root = mkdtempSync(join(tmpdir(), 'headliner-stress-')); t.after(() => rmSync(root, { recursive: true, force: true }));
  const first = createHeadlinerStress(join(root, 'a'), join(root, 'proof-a')), second = createHeadlinerStress(join(root, 'b'), join(root, 'proof-b'));
  assert.deepEqual(readFileSync(first.project), readFileSync(second.project));
  const assetManifest = JSON.parse(readFileSync(join(root, 'proof-a/headliner-stress.assets.json'), 'utf8'));
  for (const s of assetManifest.sources) assert.deepEqual(readFileSync(join(root, 'a', s.target)), readFileSync(s.source));
  assert.equal(first.tracks, 15); assert.ok(first.notes > 3000); assert.equal(first.frames, STRESS_FRAMES); assert.equal(STRESS_SECONDS, 180);
  const old = compileProjectFile(first.project);
  assert.equal((old.diagnostics[0]!.received as { metric: string }).metric, 'interpolationTaps');
  const c = compileProjectFile(first.project, { reuseVoices: true }); assert.deepEqual(c.diagnostics, []);
  assert.equal(c.timeline!.usPerQuarter, 468750); assert.equal(c.timeline!.endTick, 96 * 4 * 960);
  let taps = 0;
  const boundaries = new Map(SECTIONS.slice(1).map(s => [Math.round(s.startSeconds * 44100), 0]));
  for (const track of c.timeline!.tracks) for (const n of sampleTriggers(c, track, STRESS_FRAMES)) {
    taps += voiceCost(n.pcm, n.playback, STRESS_FRAMES - n.frame, n.articulation).work;
    const endpoint = n.frame + Math.min(STRESS_FRAMES - n.frame, voiceFrames(n.pcm, n.playback, n.articulation));
    for (const [frame, count] of boundaries) if (n.frame < frame && endpoint > frame) boundaries.set(frame, count + 1);
  }
  assert.ok(taps > 1000000000, 'fixture must keep exercising the historical render blocker');
  assert.ok([...boundaries.values()].every(n => n > 0), 'sustained dry voices actually cross every authored section boundary');
  // Not invoking the full renderer here: independent short-form byte equivalence belongs to voice-reuse tests,
  // and the reproducible full two-render/stem-reconstruction proof is verify-headliner-stress.ts.
});
