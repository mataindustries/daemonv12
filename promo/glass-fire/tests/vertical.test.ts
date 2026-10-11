import assert from 'node:assert/strict';
import {readdirSync, readFileSync, statSync} from 'node:fs';
import {dirname, join} from 'node:path';
import {test} from 'node:test';
import {fileURLToPath} from 'node:url';
import {buildFixture} from '../src/data/fixture.ts';
import {envAt} from '../src/data/signals.ts';
import {SECONDS_PER_BAR} from '../src/timeline/grid.ts';
import {CTA_LINE} from '../src/vertical/config.ts';
import {V_CUES, vCue, vCueGrid, type VCueName} from '../src/vertical/cues.ts';
import {buildVData, EXTRAS_SCHEMA_ID, extrasSchema, type VerticalExtras} from '../src/vertical/data.ts';
import {CROSSFADE_SECONDS, CUTS, outSecondsOf, songBarOf, songSecondsAt, SPANS, V_BARS, V_DURATION_IN_FRAMES, V_DURATION_SECONDS, V_FPS, V_FRAMES_PER_BAR} from '../src/vertical/edit.ts';
import {sectionAtFrame, V_SECTION, V_SECTIONS} from '../src/vertical/sections.ts';

const near = (a: number, b: number, eps = 1e-9) => Math.abs(a - b) <= eps;

test('the vertical cut is ten whole bars of the song: 15.000 s, 900 frames at 60 fps', () => {
  assert.equal(V_BARS, 10);
  assert.equal(V_DURATION_SECONDS, 15);
  assert.equal(V_DURATION_IN_FRAMES, 900);
  assert.equal(V_DURATION_IN_FRAMES / V_FPS, 15);
  assert.equal(V_FRAMES_PER_BAR, 90);
  assert.deepEqual(
    Array.from({length: V_BARS}, (_, i) => songBarOf(i + 1)),
    [4, 5, 8, 9, 10, 11, 12, 14, 15, 16],
  );
});

test('every cut is a bar line in both timelines and an integer sample frame', () => {
  assert.equal(SPANS[0]!.outStart, 0);
  assert.equal(SPANS[SPANS.length - 1]!.outEnd, 15);
  for (let i = 0; i < SPANS.length; i++) {
    const s = SPANS[i]!;
    if (i > 0) assert.equal(s.outStart, SPANS[i - 1]!.outEnd, 'spans are contiguous');
    for (const edge of [s.songStart, s.songEnd, s.outStart, s.outEnd]) {
      assert.ok(Number.isInteger(edge / SECONDS_PER_BAR), `${edge} s is a bar line`);
      assert.ok(Number.isInteger(edge * 44100) && Number.isInteger(edge * 48000), `${edge} s is a whole sample frame`);
    }
  }
  assert.deepEqual(CUTS, [3, 10.5]);
  assert.ok(CROSSFADE_SECONDS > 0 && CROSSFADE_SECONDS <= 0.01, 'crossfades stay shorter than a 32nd note');
  // The song ends inside the cut: the last output sample is the master's last sample.
  assert.equal(SPANS[SPANS.length - 1]!.songEnd, 24);
});

test('time maps both ways and the edit only moves forward through the song', () => {
  let previous = -Infinity;
  for (let frame = 0; frame < V_DURATION_IN_FRAMES; frame++) {
    const out = frame / V_FPS;
    const song = songSecondsAt(out);
    assert.ok(song > previous, `song time advances at frame ${frame}`);
    previous = song;
    assert.ok(near(outSecondsOf(song)!, out, 1e-9), `round trip at frame ${frame}`);
  }
  assert.equal(outSecondsOf(8.0), null, 'song bar 6 is left out');
  assert.equal(outSecondsOf(19.0), null, 'song bar 13 is left out');
  assert.equal(songSecondsAt(3), 10.5, 'the first cut joins bar 5 to bar 8');
  assert.equal(songSecondsAt(10.5), 19.5, 'the second cut joins bar 12 to bar 14');
});

test('sections tile the 900 frames on bar lines', () => {
  assert.deepEqual(
    V_SECTIONS.map(s => [s.id, s.from, s.from + s.durationInFrames - 1, s.songBars]),
    [
      ['hook', 0, 89, [4]],
      ['drop1', 90, 269, [5, 8]],
      ['fakeout', 270, 449, [9, 10]],
      ['drop2', 450, 719, [11, 12, 14]],
      ['payoff', 720, 899, [15, 16]],
    ],
  );
  assert.equal(sectionAtFrame(0).id, 'hook');
  assert.equal(sectionAtFrame(899).id, 'payoff');
});

test('every vertical cue sits inside the section that uses it', () => {
  const owner: Record<VCueName, string> = {
    wordmark: 'hook', built: 'hook', instruments: 'hook', agents: 'hook', roll: 'hook',
    drop1: 'drop1', process: 'drop1', render: 'drop1', wordsOut: 'drop1',
    fakeHit: 'fakeout', oneSound: 'fakeout', mutated: 'fakeout', treeGlass: 'fakeout', treeReverse: 'fakeout', treeCrush: 'fakeout', treeChop: 'fakeout', collapse: 'fakeout',
    drop2: 'drop2', mcpOut: 'drop2', gm: 'drop2', performance: 'drop2',
    payoff: 'payoff', merge: 'payoff', simplify: 'payoff', finalWordmark: 'payoff', giveAgents: 'payoff', giveInstruments: 'payoff', cta: 'payoff',
  };
  assert.deepEqual(Object.keys(owner).sort(), Object.keys(V_CUES).sort(), 'every cue has an owner');
  for (const [name, section] of Object.entries(owner)) {
    assert.equal(sectionAtFrame(Math.ceil(vCueGrid(name as VCueName) * V_FPS - 1e-6)).id, section, name);
  }
  // The CTA is on screen for at least 1.25 s before the last frame.
  assert.ok(V_DURATION_SECONDS - vCueGrid('cta') >= 1.25);
});

test('the fixture, remapped through the edit, stays inside the cut and matches the song where it is heard', () => {
  const song = buildFixture();
  const v = buildVData(song, null).promo;
  assert.equal(v.master.envelope.values.length, 901);
  assert.equal(v.spectrum.values.length, 901);
  for (const id of ['kick', 'sub', 'glass', 'vox', 'clap', 'hat'] as const) {
    const onsets = v.stems[id].onsets;
    assert.ok(onsets.every((o, i) => o.t >= 0 && o.t < 15 && (i === 0 || o.t >= onsets[i - 1]!.t)), `${id} onsets sorted inside 0…15 s`);
    for (const o of onsets) {
      assert.ok(outSecondsOf(songSecondsAt(o.t)) !== null);
      if (o.duration !== undefined) assert.ok(o.t + o.duration <= SPANS.find(s => o.t >= s.outStart && o.t < s.outEnd)!.outEnd + 1e-6, `${id} note stops at its cut`);
    }
    for (let frame = 0; frame <= 900; frame += 7) {
      const out = frame / 60;
      assert.ok(near(envAt(v.stems[id].envelope, out), envAt(song.stems[id].envelope, songSecondsAt(out)), 1e-4), `${id} envelope at frame ${frame}`);
    }
  }
  // The Drop 1 downbeat (song 5:1 = 6.0 s) is heard at output 1.5 s; song bar 6 is gone.
  assert.ok(v.stems.kick.onsets.some(o => near(o.t, 1.5, 1e-6)));
  for (const id of ['kick', 'glass', 'hat'] as const) assert.equal(v.stems[id].onsets.length, song.stems[id].onsets.filter(o => outSecondsOf(o.t) !== null).length, `${id}: exactly the onsets inside the edit`);
  for (const lane of v.automation) assert.ok(lane.points.every((p, i) => i === 0 || p.t >= lane.points[i - 1]!.t), `${lane.id} sorted`);
  assert.ok(v.markers.every((m, i) => i === 0 || m.t >= v.markers[i - 1]!.t));
  assert.deepEqual(v.markers.filter(m => m.kind !== 'stop').map(m => m.id), ['hook', 'drop1', 'fakeout', 'drop2', 'payoff']);
});

test('vertical cues stay within their snap window of the grid', () => {
  const v = buildVData(buildFixture(), null).promo;
  for (const name of Object.keys(V_CUES) as VCueName[]) assert.ok(Math.abs(vCue(v, name) - vCueGrid(name)) <= 0.09 + 1e-9, name);
});

test('manifest triggers become exact onsets with GLASSHOUSE identities, cut at the edit', () => {
  const song = buildFixture();
  const extras: VerticalExtras = extrasSchema.parse({
    schema: EXTRAS_SCHEMA_ID,
    source: {master: 'a'.repeat(64), manifest: 'b'.repeat(64)},
    triggers: [
      {t: 4.5, track: 'glass', sample: 'glass-hit', role: 'glass', velocity: 1, duration: 1},
      {t: 7.4, track: 'sub', sample: 'sub-cs', role: 'sub', velocity: 0.9, duration: 0.857143},
      {t: 8.0, track: 'punch', sample: 'bass-punch-cs', role: 'kick', velocity: 1, duration: 0.32},
      {t: 12.0, track: 'punch', sample: 'bass-punch-cs', role: 'kick', velocity: 0.5, duration: 0.32},
    ],
    automation: [{id: 'track.sub.gain', label: 'SUB GAIN', target: 'sub', unit: 'dB', range: [-48, 6], points: [{t: 7.0, v: -1.5}, {t: 7.4, v: -1.5}, {t: 7.4, v: -60}]}],
    gates: [{t: 5.8125, duration: 0.1245}, {t: 17.3437, duration: 0.0308}],
    gm: [{track: 'pg-vib', program: 11, name: 'vibraphone'}],
    render: null,
  });
  const v = buildVData(song, extras);
  assert.ok(v.exact);
  assert.deepEqual(v.promo.stems.glass.onsets, [{t: 0, strength: 1, sample: 'glass-hit', duration: 1}]);
  assert.deepEqual(v.promo.stems.sub.onsets, [{t: 2.9, strength: 1, sample: 'sub-cs', duration: 0.1}], 'the sub stops at the first cut');
  assert.deepEqual(v.promo.stems.kick.onsets.map(o => [o.t, o.strength]), [[4.5, 0.5]], 'song bar 6 is cut; bar 9 lands at 4.5 s');
  assert.deepEqual(v.gates, [{t: 1.3125, duration: 0.1245}, {t: 9.8437, duration: 0.0308}]);
  assert.deepEqual(v.promo.markers.filter(m => m.kind === 'stop').map(m => m.t), [1.3125], 'only silences long enough to read become stops');
  const lane = v.promo.automation[0]!;
  assert.equal(lane.points[0]!.t, 0);
  assert.ok(lane.points.some(p => near(p.t, 2.9, 1e-6) && p.v === -60), 'the gate closes at 2.9 s');
  assert.equal(v.song.triggers, 4);
});

test('the call to action is one constant', () => {
  assert.equal(CTA_LINE, 'daemonv12.pages.dev');
  const src = join(dirname(fileURLToPath(import.meta.url)), '..', 'src');
  const files: string[] = [];
  const walk = (dir: string) => {
    for (const name of readdirSync(dir)) {
      const path = join(dir, name);
      if (statSync(path).isDirectory()) walk(path);
      else if (/\.(ts|tsx)$/.test(name)) files.push(path);
    }
  };
  walk(src);
  const holders = files.filter(f => /pages\.dev|github\.com\/mataindustries/.test(readFileSync(f, 'utf8')));
  assert.deepEqual(holders.map(f => f.slice(src.length + 1)), ['vertical/config.ts']);
});

test('copy timing gives every capability at least a second on screen', () => {
  const v = buildVData(buildFixture(), null).promo;
  assert.ok(vCue(v, 'mcpOut') - vCue(v, 'drop2') >= 1.0);
  assert.ok(vCue(v, 'performance') - vCue(v, 'gm') >= 1.0);
  assert.ok(V_SECTION.drop2.from / 60 + V_SECTION.drop2.durationInFrames / 60 - 0.375 - vCue(v, 'performance') >= 1.0);
});
