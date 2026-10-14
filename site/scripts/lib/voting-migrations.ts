import {readFileSync, readdirSync} from 'node:fs';
import type {D1Database} from '@cloudflare/workers-types';
import {unstable_splitSqlQuery} from 'wrangler';

// Use Wrangler's SQL parser so trigger bodies are kept intact. Each migration
// is one D1 batch transaction, matching the deployment migration boundary.
export async function applyVotingMigrations(db: D1Database, names?: string[]) {
  const directory = new URL('../../migrations/', import.meta.url);
  for (const name of names ?? readdirSync(directory).filter(name => name.endsWith('.sql')).sort()) {
    const sql = readFileSync(new URL(name, directory), 'utf8');
    await db.batch(unstable_splitSqlQuery(sql).map(statement => db.prepare(statement)));
  }
}
