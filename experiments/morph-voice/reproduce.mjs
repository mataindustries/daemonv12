import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { resolve, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import assert from 'node:assert/strict';
import { build } from './build.mjs';
import { verifyCue } from './verify-cue.mjs';

const here = resolve(fileURLToPath(new URL('.', import.meta.url)));
const originalRoot = resolve(process.argv[2] || join(here, 'renders'));
const original = JSON.parse(readFileSync(join(originalRoot, 'provenance.json')));
const repeat = await build(join(here, 'work', 'repeat'));
verifyCue(originalRoot);
assert.deepEqual(repeat.provenance.audioHashes, original.audioHashes, 'Repeated WAV hashes differ');
for (const path of Object.keys(original.audioHashes)) {
  assert.deepEqual(readFileSync(join(originalRoot,path)), readFileSync(join(repeat.root,path)), path);
}
const result = {passed:true, comparison:'byte-for-byte, all generated WAVs, including cue assets, master and stems',
  wavFiles:Object.keys(original.audioHashes).length, node:process.version, audioHashes:original.audioHashes};
mkdirSync(join(originalRoot,'analysis'),{recursive:true});
writeFileSync(join(originalRoot,'analysis','repeatability.json'),JSON.stringify(result,null,2)+'\n');
console.log(`Byte-identical: ${result.wavFiles} WAV files.`);
