// Shared entry for the daemonv12 and daemonv12-mcp executables. A source checkout
// runs its TypeScript directly; an installed package runs the compiled dist/ build,
// because Node does not strip TypeScript types under node_modules. Kept as plain
// JavaScript so an unsupported Node still gets a readable error.
import { existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

export async function launch(name, entry, failureCode) {
  const fail = message => { process.stderr.write(`${name}: ${message}\n`); process.exitCode = failureCode; };
  const [major, minor] = process.versions.node.split('.').map(Number);
  if (major < 22 || (major === 22 && minor < 18))
    return fail(`Node.js >=22.18.0 is required; this is ${process.version}. Install a supported Node (for example with nvm or fnm) and retry.`);
  const root = new URL('../', import.meta.url);
  const source = new URL(`${entry}.ts`, root), compiled = new URL(`dist/${entry}.js`, root);
  const checkout = existsSync(source);
  const target = checkout ? source : existsSync(compiled) ? compiled : null;
  if (!target)
    return fail(`incomplete installation at ${fileURLToPath(root)}: neither ${entry}.ts nor dist/${entry}.js exists. Reinstall the package, or clone the repository and run npm ci.`);
  try {
    await import(target.href);
  } catch (error) {
    const dependency = error?.code === 'ERR_MODULE_NOT_FOUND' && /Cannot find package '([^']+)'/.exec(error.message)?.[1];
    if (!dependency) throw error;
    fail(`missing runtime dependency ${dependency}. ${checkout ? `Run npm ci in ${fileURLToPath(root)}.` : 'Reinstall daemonv12 so npm installs its dependencies.'}`);
  }
}
