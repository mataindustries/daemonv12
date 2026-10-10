import assert from 'node:assert/strict';
import {test} from 'node:test';
import {ACT, ACTS, actAtFrame} from '../src/timeline/acts.ts';
import {CUES, cueGrid, type CueName} from '../src/timeline/cues.ts';
import {
  barFrame,
  barTicks,
  beatsBetween,
  DURATION_IN_FRAMES,
  dur,
  eventFrame,
  eventFrameFromSeconds,
  FPS,
  FRAMES_PER_BAR,
  musicalTimeAtFrame,
  pos,
  ticksToFrames,
  ticksToSeconds,
  TOTAL_TICKS,
} from '../src/timeline/grid.ts';

test('locked duration: 24.000 s at 60 fps is exactly 1,440 frames and 16 bars', () => {
  assert.equal(DURATION_IN_FRAMES, 1440);
  assert.equal(ticksToFrames(TOTAL_TICKS), 1440);
  assert.equal(ticksToSeconds(TOTAL_TICKS), 24);
  assert.equal(DURATION_IN_FRAMES / FPS, 24);
});

test('every bar boundary is an exact integer frame, 90 apart', () => {
  for (let bar = 1; bar <= 17; bar++) {
    const frame = barFrame(bar);
    assert.ok(Number.isInteger(frame), `bar ${bar} → ${frame}`);
    assert.equal(frame, (bar - 1) * FRAMES_PER_BAR);
  }
  assert.equal(barFrame(17), 1440);
});

test('beats are 22.5 frames: odd beats fall between frames and land on the next one', () => {
  assert.equal(ticksToFrames(pos('1:2')), 22.5);
  assert.equal(eventFrame(pos('1:2')), 23);
  assert.equal(eventFrame(pos('1:3')), 45);
  assert.equal(eventFrame(pos('1:4')), 68);
  assert.equal(eventFrame(pos('16:4')), 1418);
  // Sixteenths are 5.625 frames; the mapping is exact (dyadic), never drifting.
  assert.equal(ticksToFrames(pos('1:1+1/16')), 5.625);
  assert.equal(ticksToFrames(pos('9:3+3/16')), 720 + 45 + 16.875);
  for (let beat = 0; beat < 64; beat++) assert.equal(ticksToFrames(beat * 960), beat * 22.5);
});

test('seconds from analysis snap to the first frame at or after the event', () => {
  assert.equal(eventFrameFromSeconds(6), 360);
  assert.equal(eventFrameFromSeconds(0.1), 6);
  assert.equal(eventFrameFromSeconds(0.375), 23);
  assert.equal(eventFrameFromSeconds(6.0000001), 361);
});

test('DaemonV12 position notation', () => {
  assert.equal(pos('1:1'), 0);
  assert.equal(pos('3:2+1/8'), 9120); // docs/V0_SPEC.md §3.3 example
  assert.equal(pos('16:4+3/16'), barTicks(16) + 3 * 960 + 720);
  assert.equal(dur('1/32'), 120);
  assert.throws(() => pos('0:1'));
  assert.throws(() => pos('17:1'));
  assert.throws(() => pos('1:5'));
  assert.throws(() => pos('1:1+1/4'), /shorter than one beat/);
  assert.throws(() => pos('1:1+1/7'), /tick grid/);
});

test('musical time at frame', () => {
  assert.deepEqual(musicalTimeAtFrame(0), {bar: 1, beat: 1, sixteenth: 1, beatPhase: 0, barPhase: 0, beats: 0});
  const m = musicalTimeAtFrame(360);
  assert.equal(m.bar, 5);
  assert.equal(m.beat, 1);
  const last = musicalTimeAtFrame(1439);
  assert.equal(last.bar, 16);
  assert.equal(last.beat, 4);
  assert.equal(musicalTimeAtFrame(5000).bar, 16);
});

test('beatsBetween returns exact beat times and flags bar lines', () => {
  const beats = beatsBetween(1.4, 3.1);
  assert.deepEqual(
    beats.map(b => [b.index, b.seconds, b.isBar]),
    [
      [4, 1.5, true],
      [5, 1.875, false],
      [6, 2.25, false],
      [7, 2.625, false],
      [8, 3, true],
    ],
  );
});

test('acts match the locked frame ranges and tile the piece without gaps', () => {
  const expected: [string, number, number][] = [
    ['hook', 0, 179],
    ['ignition', 180, 359],
    ['drop1', 360, 719],
    ['fakeout', 720, 899],
    ['drop2', 900, 1259],
    ['payoff', 1260, 1439],
  ];
  assert.deepEqual(
    ACTS.map(a => [a.id, a.from, a.from + a.durationInFrames - 1]),
    expected,
  );
  for (const a of ACTS) assert.equal(a.from % FRAMES_PER_BAR, 0, `${a.id} starts on a bar line`);
  assert.equal(actAtFrame(0).id, 'hook');
  assert.equal(actAtFrame(1439).id, 'payoff');
  assert.equal(ACT.drop2.from, 900);
});

test('no scheduled content extends past the final frame', () => {
  const last = ACTS[ACTS.length - 1]!;
  assert.equal(last.from + last.durationInFrames, DURATION_IN_FRAMES);
  for (const name of Object.keys(CUES) as CueName[]) {
    const frame = eventFrame(pos(CUES[name].at));
    assert.ok(frame >= 0 && frame < DURATION_IN_FRAMES, `${name} at frame ${frame}`);
  }
  // The film cuts to black before the end and holds it to frame 1439.
  assert.ok(eventFrame(pos(CUES.black.at)) < DURATION_IN_FRAMES - 1);
});

test('every cue sits inside the act that uses it', () => {
  const owner: Record<string, string> = {
    hairline: 'hook', wordmark: 'hook', glassBirth: 'hook', fracture: 'hook', crush: 'hook', reverse: 'hook',
    ignition: 'ignition', automationIn: 'ignition', mcpPatch: 'ignition', mcpValidate: 'ignition', mcpRender: 'ignition',
    drop1: 'drop1', noDaw: 'drop1', justTools: 'drop1', justToolsOut: 'drop1',
    oneSound: 'fakeout', mutated: 'fakeout', treeRoot: 'fakeout', treeReverse: 'fakeout', treeCrush: 'fakeout', treeChop: 'fakeout', collapse: 'fakeout',
    drop2: 'drop2', mcpToolsOut: 'drop2', instruments: 'drop2', instrumentsOut: 'drop2', compose: 'drop2', edit: 'drop2', process: 'drop2', render: 'drop2', wordsOut: 'drop2',
    payoff: 'payoff', merge: 'payoff', simplify: 'payoff', finalWordmark: 'payoff', giveAgents: 'payoff', giveInstruments: 'payoff', black: 'payoff',
  };
  assert.deepEqual(Object.keys(owner).sort(), Object.keys(CUES).sort(), 'every cue has an owner');
  for (const [name, act] of Object.entries(owner)) {
    assert.equal(actAtFrame(cueGrid(name as CueName) * FPS).id, act, name);
  }
});
