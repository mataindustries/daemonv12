/** Timbre Lab entry point: registers the lab instruments, then hands back the (now extended) Signature Rack. */
import './register.ts';

export const rack = await import('../studio-001/rack/index.ts');
export { LAB_INSTRUMENTS } from './registry.ts';
