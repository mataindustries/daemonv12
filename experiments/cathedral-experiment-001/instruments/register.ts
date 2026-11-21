/**
 * Opt-in registration of the Cathedral Experiment instruments in the Signature Rack (the same mechanism as
 * timbre-lab/register.ts). The rack's files are hash-pinned and are not edited: for the current process only, this
 * module redirects the rack's registry module (and the Timbre Lab's, should that hook also be loaded) to
 * ./registry.ts, which lists the frozen instruments, the Timbre Lab instruments and the new ones. A process that does
 * not load this file sees exactly the approved rack.
 *
 *   node --import ./experiments/cathedral-experiment-001/instruments/register.ts studio-001/rack/cli.ts list
 *   node --import ./experiments/cathedral-experiment-001/instruments/register.ts studio-001/rack/cli.ts render SCORE.json OUT_DIR
 */
import { registerHooks } from 'node:module';

const RACK_REGISTRY = new URL('../../../studio-001/rack/registry.ts', import.meta.url).href;
const LAB_REGISTRY = new URL('../../../timbre-lab/registry.ts', import.meta.url).href;
const OUR_REGISTRY = new URL('./registry.ts', import.meta.url).href;
const FLAG = Symbol.for('daemonv12.cathedral-experiment.registered');
const state = globalThis as { [FLAG]?: boolean };
if (!state[FLAG]) {
  state[FLAG] = true;
  registerHooks({
    resolve(specifier, context, nextResolve) {
      const resolved = nextResolve(specifier, context);
      return resolved.url === RACK_REGISTRY || resolved.url === LAB_REGISTRY ? { ...resolved, url: OUR_REGISTRY } : resolved;
    },
  });
}
