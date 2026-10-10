// The cue sheet: every scheduled visual event, written in musical time.
//
// A cue with `snap` follows the real music: if that stem has an onset within ±window of
// the written position, the cue moves onto the onset. With the fixture the two coincide;
// with analyzed stems a type hit lands on the actual hit, not the theoretical grid.
// Moving a cue is a one-line edit here; no act code changes.
import type {PromoData, StemId} from '../data/contract.ts';
import {snapToOnset} from '../data/signals.ts';
import {pos, ticksToSeconds} from './grid.ts';

type CueDef = {at: string; snap?: StemId; window?: number};

export const CUES = {
  // Act 1 · HOOK
  hairline: {at: '1:1+1/16'},
  wordmark: {at: '1:1+1/8'},
  glassBirth: {at: '1:3', snap: 'glass'},
  fracture: {at: '2:1', snap: 'glass'},
  crush: {at: '2:2', snap: 'glass'},
  reverse: {at: '2:3', snap: 'glass'},
  // Act 2 · IGNITION
  ignition: {at: '3:1'},
  automationIn: {at: '3:2'},
  mcpPatch: {at: '3:2+1/8'},
  mcpValidate: {at: '4:1+1/8'},
  mcpRender: {at: '4:3'},
  // Act 3 · DROP 1
  drop1: {at: '5:1', snap: 'kick'},
  noDaw: {at: '6:1', snap: 'kick'},
  justTools: {at: '7:1', snap: 'kick'},
  justToolsOut: {at: '7:3', snap: 'kick'},
  // Act 4 · FAKEOUT
  oneSound: {at: '9:1', snap: 'glass'},
  mutated: {at: '9:3', snap: 'glass'},
  treeRoot: {at: '10:1', snap: 'glass'},
  treeReverse: {at: '10:2', snap: 'glass'},
  treeCrush: {at: '10:3', snap: 'glass'},
  treeChop: {at: '10:4', snap: 'glass'},
  collapse: {at: '10:4+1/8'},
  // Act 5 · DROP 2
  drop2: {at: '11:1', snap: 'kick'},
  mcpToolsOut: {at: '11:4', snap: 'kick'},
  instruments: {at: '12:1', snap: 'kick'},
  instrumentsOut: {at: '12:3'},
  compose: {at: '14:1', snap: 'kick'},
  edit: {at: '14:2', snap: 'kick'},
  process: {at: '14:3', snap: 'kick'},
  render: {at: '14:4', snap: 'kick'},
  wordsOut: {at: '14:4+1/8'},
  // Act 6 · PAYOFF
  payoff: {at: '15:1', snap: 'kick'},
  merge: {at: '15:2+1/8'},
  simplify: {at: '15:3+1/8'},
  finalWordmark: {at: '15:4', snap: 'glass'},
  giveAgents: {at: '16:1', snap: 'glass'},
  giveInstruments: {at: '16:2', snap: 'glass'},
  black: {at: '16:4'},
} as const satisfies Record<string, CueDef>;

export type CueName = keyof typeof CUES;

/** Written (unsnapped) time of a cue in seconds: exact grid time. */
export const cueGrid = (name: CueName): number => ticksToSeconds(pos(CUES[name].at));

/** Resolved time of a cue in seconds, snapped to the real music where requested. */
export const cue = (data: PromoData, name: CueName): number => {
  const def: CueDef = CUES[name];
  const grid = cueGrid(name);
  return def.snap ? snapToOnset(data, def.snap, grid, def.window) : grid;
};
