/**
 * Generates studio-001/INSTRUMENTS.md from the live registry, so the reference can never drift from the code.
 *   node studio-001/rack/docs.ts            (write)       node studio-001/rack/docs.ts --check   (exit 1 if stale)
 */
import { readFileSync, writeFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { REPO_ROOT } from './frozen.ts';
import { registryDocument } from './registry.ts';
import { pitchName } from './curves.ts';

export const INSTRUMENTS_MD = join(REPO_ROOT, 'studio-001', 'INSTRUMENTS.md');
export function instrumentsMarkdown(): string {
  const doc = registryDocument(), out: string[] = [
    '# Signature Rack · instrument reference', '',
    `Generated from the registry by \`node studio-001/rack/docs.ts\` (rack ${doc.rackVersion}, interface ${doc.interfaceVersion}). Do not edit by hand.`, '',
    'Every instrument renders at a calibrated nominal level: a reference note at macro 0 and velocity 0.8 measures -20 dBFS RMS, so part gains compare across families. `Suggested gain` is the balance of the approved auditions. Controls accept a constant, `[[beat, value], ...]` ramps or `{ "steps": [[beat, value], ...], "glide": beats }`, either absolute (`controls`) or added to the macro mapping (`offsets`); values are clamped to the listed range.', '',
  ];
  for (const fam of ['living-bass', 'impossible-voice', 'mechanical-orchestra', 'context'] as const) {
    const list = doc.instruments.filter(i => i.family === fam);
    if (!list.length) continue;
    out.push(`## ${fam === 'context' ? 'Context instruments (for musical-context mixes)' : `${list[0]!.macro.label} · ${fam}`}`, '');
    for (const i of list) {
      out.push(`### \`${i.id}\` · ${i.name}`, '', i.description, '',
        `Version \`${i.version}\` · range ${pitchName(i.range[0])}–${pitchName(i.range[1])} (MIDI ${i.range[0]}–${i.range[1]}) · suggested gain ${i.suggestedGainDb} dB · macro \`${i.macro.label}\``, '');
      out.push('| Articulation | Effect |', '|---|---|', ...Object.entries(i.articulations).map(([k, v]) => `| \`${k}\` | ${v} |`), '');
      if (i.controls.length) out.push('| Control | Range | What it does |', '|---|---|---|', ...i.controls.map(c => `| \`${c.name}\` | ${c.min} … ${c.max} | ${c.description} |`), '');
      if (i.setup.length) out.push(`Setup (per part): ${i.setup.map(s => `\`${s.name}\` (${s.min} … ${s.max}: ${s.description})`).join('; ')}.`, '');
      if (Object.keys(i.params).length) out.push(`Per-note parameters: ${Object.entries(i.params).map(([k, v]) => `\`${k}\` (${v})`).join('; ')}.`, '');
    }
  }
  return out.join('\n');
}
if (process.argv[1] && resolve(process.argv[1]) === resolve(new URL(import.meta.url).pathname)) {
  const md = instrumentsMarkdown();
  if (process.argv.includes('--check')) { const ok = readFileSync(INSTRUMENTS_MD, 'utf8') === md; console.log(ok ? 'INSTRUMENTS.md is current' : 'INSTRUMENTS.md is stale'); process.exitCode = ok ? 0 : 1; }
  else { writeFileSync(INSTRUMENTS_MD, md); console.log(`wrote ${INSTRUMENTS_MD}`); }
}
