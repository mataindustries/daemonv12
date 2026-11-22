/**
 * The rack registry plus the Timbre Lab instruments plus the Cathedral Experiment instruments: the same exports as
 * studio-001/rack/registry.ts. The frozen instruments come first, unchanged and in their order; then the Timbre Lab's;
 * then THRONE//VOLT, CATHEDRAL//ENGINE (great, swell, pedal) and HEAVEN//MASS (bass, tenor, alto, soprano).
 * Loaded in place of the rack registry only in a process that imported ./register.ts.
 */
import { instrumentList } from '../../../studio-001/rack/instruments.ts';
import { RACK_INTERFACE_VERSION, type InstrumentInfo, type RackInstrument } from '../../../studio-001/rack/types.ts';
import { ORGANIC_PERCUSSION } from '../../../timbre-lab/skin.ts';
import { BREATH_REED } from '../../../timbre-lab/reed.ts';
import { THRONE_VOLT } from './throne-volt.ts';
import { CATHEDRAL_ENGINE } from './cathedral-engine.ts';
import { HEAVEN_MASS } from './heaven-mass.ts';
import type { LabInstrument } from './common.ts';

export const RACK_VERSION = '1.0.0';
export const CATHEDRAL_INSTRUMENTS: LabInstrument[] = [THRONE_VOLT, ...CATHEDRAL_ENGINE, ...HEAVEN_MASS];
const TIMBRE_LAB = [...ORGANIC_PERCUSSION, BREATH_REED] as unknown as RackInstrument[];
// Lab families are not in the frozen `Family` union; every consumer treats the family as a plain string.
const REGISTRY = new Map<string, RackInstrument>([...instrumentList(), ...TIMBRE_LAB, ...(CATHEDRAL_INSTRUMENTS as unknown as RackInstrument[])].map(i => [i.id, i]));

export function getInstrument(id: unknown): RackInstrument | undefined { return typeof id === 'string' ? REGISTRY.get(id) : undefined; }
export function listInstruments(): InstrumentInfo[] {
  return [...REGISTRY.values()].map(({ render: _render, ...info }) => info);
}
/** JSON-serialisable registry document, lab instruments included. */
export function registryDocument() {
  return { schema: 'daemonv12.signature-rack.registry/1', interfaceVersion: RACK_INTERFACE_VERSION, rackVersion: RACK_VERSION, instruments: listInstruments() };
}
