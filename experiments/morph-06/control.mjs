// MORPH//06 renderer control test, and the source of v3-levels.json.
// 1. Render the unchanged MORPH//05 V3 score with this renderer: the master must be bit-identical
//    to the approved V3 master. The normalisation peaks that render measured are V3's levels.
// 2. Render it again with those levels pinned: it must be bit-identical again, so pinning them in
//    A, B and C reproduces V3's levels and drive exactly.
// Usage: node experiments/morph-06/control.mjs   (writes experiments/morph-06/v3-levels.json)
import { readFileSync, writeFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createHash } from 'node:crypto';
import { encodeWav } from '../morph-03/dsp.mjs';
import { render, FRAMES } from './record.mjs';
import { score } from '../morph-05/v3.mjs';

const here = dirname(fileURLToPath(import.meta.url));
const approved = JSON.parse(readFileSync(join(here, '..', 'morph-05', 'audio', 'v3', 'cable-beast-v3.meta.json'), 'utf8')).wav24Sha256;
const sha = r => createHash('sha256').update(encodeWav(r.bus, 24)).digest('hex');

const free = render(score);
const levels = free.meta.levels.measured;
const pinned = render({ ...score, levels });
const result = {
  approvedV3Sha256: approved,
  unpinned: { sha256: sha(free), frames: free.bus.L.length },
  pinned: { sha256: sha(pinned), frames: pinned.bus.L.length },
};
result.pass = result.unpinned.sha256 === approved && result.pinned.sha256 === approved && free.bus.L.length === FRAMES && pinned.bus.L.length === FRAMES;
console.log(JSON.stringify(result, null, 1));
if (!result.pass) process.exit(1);
writeFileSync(join(here, 'v3-levels.json'), JSON.stringify({
  note: 'Normalisation peaks measured in the MORPH//05 V3 render (control.mjs). A, B and C pin them, so no later material changes the level or drive of what came before it.',
  levels,
}, null, 1) + '\n');
