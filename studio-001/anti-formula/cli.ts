/**
 * DaemonV12 Anti-Formula (Gate 1) command line. Reads and writes JSON only; rendering stays with the motif CLI.
 *   node studio-001/anti-formula/cli.ts observe SCORE.json
 *       print what the layer remembers about a score/2: each motif's statements and the expectations they teach
 *   node studio-001/anti-formula/cli.ts apply SOURCE.json PLAN.json --out NEW_SCORE.json --ledger NEW_LEDGER.json
 *       apply the plan's one decision; write the changed score/2 and the ledger (never overwrites)
 * Then, with the unchanged tools:  node studio-001/motif/cli.ts render NEW_SCORE.json NEW_DIR
 */
import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { applyAntiFormula } from './apply.ts';
import { observe } from './memory.ts';
import type { ScoreInputV2 } from '../motif/types.ts';

export const json = (v: unknown) => JSON.stringify(v, null, 2) + '\n';
const read = (f: string) => JSON.parse(readFileSync(f, 'utf8')) as unknown;

function main() {
  const [cmd, ...rest] = process.argv.slice(2), pos: string[] = [], flags: Record<string, string> = {};
  for (let i = 0; i < rest.length; i++) { if (rest[i]!.startsWith('--')) flags[rest[i]!.slice(2)] = rest[++i] ?? ''; else pos.push(rest[i]!); }
  if (cmd === 'observe' && pos.length === 1) { process.stdout.write(json(observe(read(pos[0]!) as ScoreInputV2))); return; }
  if (cmd === 'apply' && pos.length === 2 && flags.out && flags.ledger) {
    const out = resolve(flags.out), ledger = resolve(flags.ledger);
    for (const f of [out, ledger]) if (existsSync(f)) throw new Error(`refusing to overwrite an existing file: ${f}`);
    const applied = applyAntiFormula(read(pos[0]!), read(pos[1]!));
    writeFileSync(out, json(applied.score)); writeFileSync(ledger, json(applied.ledger));
    if (applied.lowered.problems.length) console.error(`${applied.lowered.problems.length} motif-layer warnings (foreign params dropped; list them with: node studio-001/motif/cli.ts expand ${flags.out})`);
    const l = applied.ledger;
    console.error(`${l.intervention.kind} at ${l.intervention.target} (bar ${l.intervention.bar}): ${l.intervention.transform}; ${l.payoff.state === 'resolved' ? `resolved by ${l.payoff.phrase} at beat ${l.payoff.beat} (${l.payoff.note.name})` : 'left open on purpose'}`);
    return;
  }
  console.error(readFileSync(fileURLToPath(import.meta.url), 'utf8').split('\n').slice(1, 8).join('\n')); process.exitCode = 2;
}
if (process.argv[1] && resolve(process.argv[1]) === resolve(fileURLToPath(import.meta.url))) { try { main(); } catch (e) { console.error((e as Error).message); process.exitCode = 1; } }
