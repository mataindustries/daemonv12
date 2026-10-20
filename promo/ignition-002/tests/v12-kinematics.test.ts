// The V12 mechanism must be geometrically exact and exactly periodic before anything is shaded.
import assert from 'node:assert/strict';
import {test} from 'node:test';
import {CRANK_REVS, CYLINDERS, FIRING_ORDER, GEO, THROW_PHASE, camAngle, combustion, crankAngle, crankPinAt, crankSpeed, cyclePhase, exhaustLift, intakeLift, pistonPose} from '../src/v12/kinematics.ts';
import {BAR, LOOP} from '../src/timeline.ts';

const TAU = Math.PI * 2;

test('twelve cylinders, six per bank, banks 60° apart, staggered along a common crank', () => {
  assert.equal(CYLINDERS.length, 12);
  assert.equal(CYLINDERS.filter(c => c.bank === 'R').length, 6);
  const right = CYLINDERS.find(c => c.n === 1)!;
  const left = CYLINDERS.find(c => c.n === 7)!;
  assert.ok(Math.abs(right.beta - left.beta - Math.PI / 3) < 1e-12, 'included angle 60°');
  assert.ok(Math.abs(right.z - left.z - 2 * GEO.stagger) < 1e-12, 'rods side by side on one throw');
  assert.equal(new Set(CYLINDERS.map(c => c.n)).size, 12);
});

test('every rod keeps its length and every piston stays on its bore axis, at every crank angle', () => {
  for (const cyl of CYLINDERS) {
    for (let i = 0; i < 720; i++) {
      const theta = (i / 720) * 2 * TAU;
      const p = pistonPose(cyl, theta);
      const len = Math.hypot(p.wristPin[0] - p.crankPin[0], p.wristPin[1] - p.crankPin[1]);
      assert.ok(Math.abs(len - GEO.l) < 1e-9, `cyl ${cyl.n} rod length ${len}`);
      const across = p.wristPin[0] * Math.cos(cyl.beta) - p.wristPin[1] * Math.sin(cyl.beta);
      assert.ok(Math.abs(across) < 1e-9, `cyl ${cyl.n} piston off axis`);
      assert.ok(p.travel >= -1e-9 && p.travel <= 1 + 1e-9);
      // The crank pin stays on its circle.
      assert.ok(Math.abs(Math.hypot(...p.crankPin) - GEO.r) < 1e-12);
    }
  }
});

test('each cylinder reaches top dead centre exactly at its firing angle, and firings are 60° apart', () => {
  const fires = CYLINDERS.map(c => c.fireAt).sort((a, b) => a - b);
  for (let i = 0; i < 12; i++) assert.ok(Math.abs(fires[i]! - (Math.PI / 6 + (i * Math.PI) / 3)) < 1e-12);
  for (const c of CYLINDERS) {
    const p = pistonPose(c, c.fireAt);
    assert.ok(Math.abs(p.pin - (GEO.r + GEO.l)) < 1e-9, `cyl ${c.n} not at TDC when firing`);
    assert.ok(combustion(cyclePhase(c, c.fireAt + 0.1)) > 0.8);
  }
  assert.deepEqual(FIRING_ORDER, [1, 11, 5, 10, 4, 7, 6, 8, 2, 9, 3, 12]);
  assert.equal(THROW_PHASE.length, 6);
});

test('pistons never collide with the cylinder head and clear the crank', () => {
  for (const c of CYLINDERS) {
    const tdc = pistonPose(c, c.fireAt);
    assert.ok(tdc.pin + GEO.pinBelowCrown < GEO.deck, 'crown below the deck at TDC');
    const bdc = pistonPose(c, c.fireAt + Math.PI);
    assert.ok(bdc.pin - (GEO.pistonH - GEO.pinBelowCrown) > GEO.r + 0.05, 'skirt clears the crank pin circle at BDC');
  }
});

test('crank turns exactly ten revolutions per loop, one per bar outside OVERDRIVE, with continuous speed', () => {
  assert.equal(crankAngle(0), 0);
  assert.ok(Math.abs(crankAngle(LOOP - 1e-9) - CRANK_REVS * TAU) < 1e-6);
  for (const b of [0, 1, 2, 3, 4]) assert.ok(Math.abs(crankAngle(b * BAR) - b * TAU) < 1e-6, `bar ${b + 1}`);
  for (const b of [6, 7]) assert.ok(Math.abs(crankAngle(b * BAR) - (b + 2) * TAU) < 1e-6, `bar ${b + 1}`);
  assert.ok(Math.abs(crankSpeed(LOOP - 1e-6) - crankSpeed(0)) < 1e-6);
  const h = 1e-4;
  const vEnd = (CRANK_REVS * TAU - crankAngle(LOOP - h)) / h;
  const vStart = (crankAngle(h) - crankAngle(0)) / h;
  assert.ok(Math.abs(vEnd - vStart) < 1e-3, `${vEnd} vs ${vStart}`);
  // The blip really revs the engine: peak speed well above idle.
  let peak = 0;
  for (let t = 0; t < LOOP; t += 0.01) peak = Math.max(peak, crankSpeed(t));
  assert.ok(peak > 2 && peak < 2.6, `peak ${peak}`);
});

test('cams turn at half crank speed and land on the same phase at the loop point; valves follow', () => {
  assert.ok(Math.abs(camAngle(CRANK_REVS * TAU) - 5 * TAU) < 1e-12);
  for (const c of CYLINDERS) {
    for (const t of [0, 3.3, 7.6, 12.4]) {
      const a = cyclePhase(c, crankAngle(t));
      const b = cyclePhase(c, crankAngle(t + LOOP - 1e-12));
      assert.ok(Math.abs(a - b) < 1e-6 || Math.abs(Math.abs(a - b) - 2 * TAU) < 1e-6);
    }
    // Overlap: both valves open around exhaust TDC, never both closed during the exhaust stroke.
    const overlap = cyclePhase(c, c.fireAt + 2 * Math.PI);
    assert.ok(exhaustLift(overlap) > 0 && intakeLift(overlap) > 0);
    assert.equal(intakeLift(cyclePhase(c, c.fireAt + 0.3)), 0);
  }
  void crankPinAt;
});
