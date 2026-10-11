// Writes the placeholder data as a JSON file: a complete, valid example of the
// PromoData contract that the analyzer must produce for the final song.
//
//   npm run fixture:export   →  out/fixture.promo-data.json
import {mkdirSync, writeFileSync} from 'node:fs';
import {dirname, join} from 'node:path';
import {fileURLToPath} from 'node:url';
import {parsePromoData} from '../src/data/contract.ts';
import {buildFixture} from '../src/data/fixture.ts';

const target = join(dirname(fileURLToPath(import.meta.url)), '..', 'out', 'fixture.promo-data.json');
mkdirSync(dirname(target), {recursive: true});
writeFileSync(target, JSON.stringify(parsePromoData(buildFixture()), null, 1) + '\n');
console.log(`wrote ${target}`);
