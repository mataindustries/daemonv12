/**
 * Opt-in registration of the Timbre Lab instruments in the Signature Rack.
 *
 * The rack's own files are hash-pinned by the v0.8 integration proof and its registry document is embedded, byte for
 * byte, in the approved CROSSING package, so they are not edited. Instead this module redirects the rack's registry
 * module to timbre-lab/registry.ts (same exports, frozen instruments first and unchanged, lab instruments after) for the
 * current process. Everything that resolves instruments through the rack (scores, renderScore, bounce, the Composer
 * Kit) then sees the lab instruments, and nothing changes for a process that does not load this file.
 *
 *   node --import ./timbre-lab/register.ts studio-001/rack/cli.ts list
 *   node --import ./timbre-lab/register.ts composer-kit/build.ts SPEC.json OUT_DIR
 * or, from code, `await import('./timbre-lab/index.ts')` before anything imports the rack.
 */
import { registerHooks } from 'node:module';

const RACK_REGISTRY = new URL('../studio-001/rack/registry.ts', import.meta.url).href;
const LAB_REGISTRY = new URL('./registry.ts', import.meta.url).href;
const FLAG = Symbol.for('daemonv12.timbre-lab.registered');
const state = globalThis as { [FLAG]?: boolean };
if (!state[FLAG]) {
  state[FLAG] = true;
  registerHooks({
    resolve(specifier, context, nextResolve) {
      const resolved = nextResolve(specifier, context);
      return resolved.url === RACK_REGISTRY ? { ...resolved, url: LAB_REGISTRY } : resolved;
    },
  });
}
