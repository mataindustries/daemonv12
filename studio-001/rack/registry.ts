/** Portable instrument registry: ids, versions, macros, controls, articulations and ranges for every rack instrument. */
import { instrumentList } from './instruments.ts';
import { RACK_INTERFACE_VERSION, type InstrumentInfo, type RackInstrument } from './types.ts';

export const RACK_VERSION = '1.0.0';
const REGISTRY = new Map<string, RackInstrument>(instrumentList().map(i => [i.id, i]));

export function getInstrument(id: unknown): RackInstrument | undefined { return typeof id === 'string' ? REGISTRY.get(id) : undefined; }
export function listInstruments(): InstrumentInfo[] {
  return [...REGISTRY.values()].map(({ render: _render, ...info }) => info);
}
/** JSON-serialisable registry document (what `cli.ts list` prints and packages embed). */
export function registryDocument() {
  return { schema: 'daemonv12.signature-rack.registry/1', interfaceVersion: RACK_INTERFACE_VERSION, rackVersion: RACK_VERSION, instruments: listInstruments() };
}
