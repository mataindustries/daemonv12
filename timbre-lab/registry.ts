/**
 * The rack registry plus the Timbre Lab instruments: the same exports as studio-001/rack/registry.ts. The frozen
 * instruments come from the rack's own list, unchanged and in their order; lab instruments follow. Loaded in place of
 * the rack registry only in a process that imported timbre-lab/register.ts.
 */
import { instrumentList } from '../studio-001/rack/instruments.ts';
import { RACK_INTERFACE_VERSION, type InstrumentInfo, type RackInstrument } from '../studio-001/rack/types.ts';
import { ORGANIC_PERCUSSION } from './skin.ts';
import { BREATH_REED } from './reed.ts';
import type { LabInstrument } from './util.ts';

export const RACK_VERSION = '1.0.0';
export const LAB_INSTRUMENTS: LabInstrument[] = [...ORGANIC_PERCUSSION, BREATH_REED];
// A lab family is not in the frozen `Family` union; every consumer treats the family as a plain string.
const REGISTRY = new Map<string, RackInstrument>([...instrumentList(), ...(LAB_INSTRUMENTS as unknown as RackInstrument[])].map(i => [i.id, i]));

export function getInstrument(id: unknown): RackInstrument | undefined { return typeof id === 'string' ? REGISTRY.get(id) : undefined; }
export function listInstruments(): InstrumentInfo[] {
  return [...REGISTRY.values()].map(({ render: _render, ...info }) => info);
}
/** JSON-serialisable registry document, lab instruments included. */
export function registryDocument() {
  return { schema: 'daemonv12.signature-rack.registry/1', interfaceVersion: RACK_INTERFACE_VERSION, rackVersion: RACK_VERSION, instruments: listInstruments() };
}
