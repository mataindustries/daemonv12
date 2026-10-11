// The vertical cue sheet, in OUTPUT bars (bar 1 is song bar 4; see edit.ts). Every copy hit
// and cut is written in musical time; cues with `snap` move onto the real onset of that stem
// in the cut (exact manifest triggers when available) within ±window seconds.
import type {PromoData, StemId} from '../data/contract.ts';
import {snapToOnset} from '../data/signals.ts';
import {pos, ticksToSeconds} from '../timeline/grid.ts';

type CueDef = {at: string; snap?: StemId; window?: number};

export const V_CUES = {
  // 1 · HOOK (song bar 4): the hook's TING · ti-ti TANG plays the type in.
  wordmark: {at: '1:1'},
  built: {at: '1:1+1/8', snap: 'glass', window: 0.02},
  instruments: {at: '1:1+5/32', snap: 'glass', window: 0.02},
  agents: {at: '1:1+3/16'},
  roll: {at: '1:3', snap: 'clap'},
  // 2 · DROP 1 (song bars 5 and 8)
  drop1: {at: '2:1', snap: 'kick'},
  process: {at: '2:3', snap: 'clap'},
  render: {at: '3:1', snap: 'kick'},
  wordsOut: {at: '3:3', snap: 'clap'},
  // 3 · FAKEOUT (song bars 9–10)
  fakeHit: {at: '4:1', snap: 'kick'},
  oneSound: {at: '4:2', snap: 'glass'},
  mutated: {at: '4:4', snap: 'glass'},
  treeGlass: {at: '5:1'},
  treeReverse: {at: '5:2'},
  treeCrush: {at: '5:3'},
  treeChop: {at: '5:4', snap: 'glass'},
  collapse: {at: '5:4+1/8'},
  // 4 · DROP 2 (song bars 11, 12 and 14)
  drop2: {at: '6:1', snap: 'kick'},
  mcpOut: {at: '6:4'},
  gm: {at: '7:1', snap: 'kick'},
  performance: {at: '8:1', snap: 'kick'},
  // 5 · PAYOFF (song bars 15–16)
  payoff: {at: '9:1', snap: 'kick'},
  merge: {at: '9:1+1/8'},
  simplify: {at: '9:2+1/8'},
  finalWordmark: {at: '9:3', snap: 'glass'},
  giveAgents: {at: '9:4', snap: 'glass'},
  giveInstruments: {at: '10:1', snap: 'glass'},
  cta: {at: '10:1+1/8'},
} as const satisfies Record<string, CueDef>;

export type VCueName = keyof typeof V_CUES;

/** Written (unsnapped) output time of a cue in seconds. */
export const vCueGrid = (name: VCueName): number => ticksToSeconds(pos(V_CUES[name].at));

/** Resolved output time of a cue, snapped to the real music where requested. */
export const vCue = (data: PromoData, name: VCueName): number => {
  const def: CueDef = V_CUES[name];
  const grid = vCueGrid(name);
  return def.snap ? snapToOnset(data, def.snap, grid, def.window) : grid;
};
