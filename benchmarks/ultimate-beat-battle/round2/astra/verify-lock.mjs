#!/usr/bin/env node
/**
 * Astra Round 2 lock audit. No engine, skill, or render output is modified.
 * Usage: node verify-lock.mjs RENDER_A RENDER_B [REPORT_JSON]
 * All supplied paths must stay inside this contestant's benchmark directory.
 */
import { createHash } from 'node:crypto';
import { createReadStream } from 'node:fs';
import { lstat, readdir, readFile, readlink, realpath, writeFile } from 'node:fs/promises';
import { execFileSync, spawn } from 'node:child_process';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ENGINE_BASE = 'ed75e9e2a0172266e56b292886ad7c1500677862';
const SKILL_COMMIT = '56dbdff62bf78e70e898f0dbb49f8044cd561655';
const PLUGIN = 'plugins/daemonv12-composer/';
const SKILL = `${PLUGIN}skills/daemonv12-composer/`;
const INSTALLED = '.agents/skills/daemonv12-composer/';
const ENGINE_PATHS = ['src/', 'bin/', 'scripts/', 'mcp/', 'dist/', 'package.json', 'package-lock.json', 'tsconfig.json'];
const ownDir = path.dirname(fileURLToPath(import.meta.url));
const repoDir = execFileSync('git', ['rev-parse', '--show-toplevel'], { cwd: ownDir, encoding: 'utf8' }).trim();
const posix = p => p.split(path.sep).join('/');
const relative = p => posix(path.relative(repoDir, p));
const sha = bytes => createHash('sha256').update(bytes).digest('hex');
const git = args => execFileSync('git', args, { cwd: repoDir, maxBuffer: 32 * 1024 * 1024 });

function assertOwn(p) {
  const rel = path.relative(ownDir, p);
  if (rel === '..' || rel.startsWith(`..${path.sep}`) || path.isAbsolute(rel)) {
    throw new Error(`Path is outside the authorized contestant directory: ${p}`);
  }
}
async function walk(dir, prefix = '') {
  const result = [];
  for (const entry of (await readdir(dir, { withFileTypes: true })).sort((a, b) => a.name.localeCompare(b.name))) {
    const name = posix(path.join(prefix, entry.name));
    if (entry.isDirectory()) result.push(...await walk(path.join(dir, entry.name), name));
    else result.push(name);
  }
  return result.sort();
}
async function digestFile(file) {
  const stat = await lstat(file);
  if (stat.isSymbolicLink()) {
    const target = Buffer.from(await readlink(file));
    return { sha256: sha(target), bytes: target.length, kind: 'symlink' };
  }
  if (!stat.isFile()) throw new Error(`Not a regular file: ${file}`);
  const hash = createHash('sha256');
  for await (const chunk of createReadStream(file)) hash.update(chunk);
  return { sha256: hash.digest('hex'), bytes: stat.size, kind: 'file' };
}
async function digestBlob(oid) {
  const child = spawn('git', ['cat-file', 'blob', oid], { cwd: repoDir, stdio: ['ignore', 'pipe', 'pipe'] });
  const completion = new Promise((resolve, reject) => {
    child.on('error', reject);
    child.on('close', code => code === 0 ? resolve() : reject(new Error(`git cat-file failed (${code}) for ${oid}`)));
  });
  const hash = createHash('sha256');
  let bytes = 0;
  child.stderr.resume();
  for await (const chunk of child.stdout) { hash.update(chunk); bytes += chunk.length; }
  await completion;
  return { sha256: hash.digest('hex'), bytes };
}
function tree(commit, prefix) {
  const args = ['ls-tree', '-r', '-z', commit];
  if (prefix) args.push('--', ...(Array.isArray(prefix) ? prefix : [prefix]));
  return git(args).toString('utf8').split('\0').filter(Boolean).map(record => {
    const tab = record.indexOf('\t');
    const [mode, type, oid] = record.slice(0, tab).split(' ');
    return { mode, type, oid, file: record.slice(tab + 1) };
  });
}
async function auditFiles(entries, mapFile = file => file) {
  const records = [];
  for (const entry of entries) {
    const workingFile = mapFile(entry.file);
    if (entry.type !== 'blob') {
      records.push({ file: workingFile, gitObject: entry.oid, status: 'unsupported-git-object', objectType: entry.type });
      continue;
    }
    const expected = await digestBlob(entry.oid);
    let actual;
    try { actual = await digestFile(path.join(repoDir, workingFile)); }
    catch (error) {
      records.push({ file: workingFile, expected, status: error.code === 'ENOENT' ? 'missing' : 'read-error', error: error.message });
      continue;
    }
    const kindMatches = actual.kind === (entry.mode === '120000' ? 'symlink' : 'file');
    records.push({
      file: workingFile, expected, actual,
      status: expected.sha256 === actual.sha256 && expected.bytes === actual.bytes && kindMatches ? 'identical' : 'different',
    });
  }
  return { checked: records.length, pass: records.every(r => r.status === 'identical'), differences: records.filter(r => r.status !== 'identical'), records };
}
function category(file) {
  if (/\.wav$/i.test(file)) return /(^|\/)(?:[^/]*\.stems|stems)(\/|$)/i.test(file) ? 'stems' : 'masterWav';
  if (/\.(?:mid|midi)$/i.test(file)) return 'midi';
  if (/(?:^|[/.])analysis\.json$/i.test(file)) return 'analysis';
  if (/(?:^|[/.])render\.json$/i.test(file)) return 'provenance';
  if (/\.mp3$/i.test(file)) return 'mp3';
  return null;
}
function jsonDifferences(left, right, pointer = '', result = []) {
  if (Object.is(left, right)) return result;
  if (left && right && typeof left === 'object' && typeof right === 'object' && Array.isArray(left) === Array.isArray(right)) {
    for (const key of [...new Set([...Object.keys(left), ...Object.keys(right)])].sort()) {
      if (result.length >= 100) break;
      jsonDifferences(left[key], right[key], `${pointer}/${key.replaceAll('~', '~0').replaceAll('/', '~1')}`, result);
    }
  } else result.push({ pointer: pointer || '/', a: left ?? null, b: right ?? null });
  return result;
}
async function compareRenders(dirA, dirB) {
  const namesA = await walk(dirA);
  const namesB = await walk(dirB);
  const setA = new Set(namesA), setB = new Set(namesB);
  const records = [];
  for (const file of [...new Set([...namesA, ...namesB])].sort()) {
    const group = category(file);
    if (!group) continue;
    const a = setA.has(file) ? await digestFile(path.join(dirA, file)) : null;
    const b = setB.has(file) ? await digestFile(path.join(dirB, file)) : null;
    const record = { file, category: group, contractRequired: group !== 'mp3', a, b,
      status: !a ? 'missing-a' : !b ? 'missing-b' : a.sha256 === b.sha256 && a.bytes === b.bytes && a.kind === b.kind ? 'identical' : 'different' };
    if (a && b && record.status === 'different' && ['analysis', 'provenance'].includes(group)) {
      try {
        record.jsonDifferencesFirst100 = jsonDifferences(JSON.parse(await readFile(path.join(dirA, file), 'utf8')), JSON.parse(await readFile(path.join(dirB, file), 'utf8')));
      } catch (error) { record.jsonComparisonError = error.message; }
    }
    records.push(record);
  }
  const requiredCategories = ['masterWav', 'stems', 'midi', 'analysis', 'provenance'];
  const groups = Object.fromEntries([...requiredCategories, 'mp3'].map(group => {
    const subset = records.filter(r => r.category === group);
    return [group, { count: subset.length, presentInBoth: subset.filter(r => r.a && r.b).length, identical: subset.filter(r => r.status === 'identical').length,
      pass: subset.length > 0 && subset.every(r => r.status === 'identical') }];
  }));
  const required = records.filter(r => r.contractRequired);
  const missingCategories = requiredCategories.filter(group => !groups[group].count);
  const differences = required.filter(r => r.status !== 'identical');
  return {
    directoryA: relative(dirA), directoryB: relative(dirB),
    comparison: 'Raw file SHA-256 and byte count, matched by relative path; no metadata normalization.',
    mp3Note: 'MP3 is compared when present but is outside the determinism contract.',
    requiredCategories, missingCategories, groups,
    pass: missingCategories.length === 0 && differences.length === 0,
    differences, records,
    ignoredFiles: [...new Set([...namesA, ...namesB])].filter(file => !category(file)).sort(),
  };
}
async function main() {
  const args = process.argv.slice(2);
  if (args.length < 2 || args.length > 3 || args.includes('--help')) {
    console.log('Usage: node benchmarks/ultimate-beat-battle/round2/astra/verify-lock.mjs RENDER_A RENDER_B [REPORT_JSON]');
    console.log('Paths are relative to the current working directory. Default report: Astra/determinism-report.json.');
    process.exitCode = args.includes('--help') ? 0 : 2;
    return;
  }
  const dirA = await realpath(path.resolve(args[0]));
  const dirB = await realpath(path.resolve(args[1]));
  const reportPath = path.resolve(args[2] ?? path.join(ownDir, 'determinism-report.json'));
  [dirA, dirB, reportPath].forEach(assertOwn);
  const reportRelA = path.relative(dirA, reportPath), reportRelB = path.relative(dirB, reportPath);
  if (dirA === dirB) throw new Error('The determinism check requires two different physical render directories.');
  if ((!reportRelA.startsWith('..') && !path.isAbsolute(reportRelA)) || (!reportRelB.startsWith('..') && !path.isAbsolute(reportRelB))) {
    throw new Error('Write the report outside the two frozen render directories.');
  }
  const pinDiff = git(['diff', '--name-status', ENGINE_BASE, SKILL_COMMIT]).toString('utf8').trim().split('\n').filter(Boolean).map(line => {
    const [status, ...files] = line.split('\t');
    return { status, files };
  });
  const pinCommitContract = { changes: pinDiff, pass: pinDiff.length > 0 && pinDiff.every(r => r.status === 'A' && r.files.every(file => file.startsWith(PLUGIN))) };
  const engineEntries = tree(ENGINE_BASE, ENGINE_PATHS);
  const engine = await auditFiles(engineEntries);
  engine.scope = ENGINE_PATHS;
  const expectedEngineFiles = new Set(engineEntries.map(entry => entry.file));
  engine.extraTrackedOrUnignoredFiles = git(['ls-files', '-z', '--cached', '--others', '--exclude-standard', '--', ...ENGINE_PATHS]).toString('utf8').split('\0').filter(Boolean).filter(file => !expectedEngineFiles.has(file));
  engine.pass &&= engine.extraTrackedOrUnignoredFiles.length === 0;
  engine.note = 'Every engine-base tracked runtime, build-tool, and configuration blob in the listed scope is compared with working-tree bytes. Benchmark and example compositions are excluded and never opened.';
  const pluginEntries = tree(SKILL_COMMIT, PLUGIN);
  const plugin = await auditFiles(pluginEntries);
  const expectedPluginFiles = new Set(pluginEntries.map(entry => entry.file.slice(PLUGIN.length)));
  plugin.extraFiles = (await walk(path.join(repoDir, PLUGIN))).filter(file => !expectedPluginFiles.has(file));
  plugin.pass &&= plugin.checked > 0 && plugin.extraFiles.length === 0;
  const skillEntries = pluginEntries.filter(entry => entry.file.startsWith(SKILL));
  const installedSkill = await auditFiles(skillEntries, file => `${INSTALLED}${file.slice(SKILL.length)}`);
  const expectedInstalledFiles = new Set(skillEntries.map(entry => entry.file.slice(SKILL.length)));
  installedSkill.extraFiles = (await walk(path.join(repoDir, INSTALLED))).filter(file => !expectedInstalledFiles.has(file));
  installedSkill.pass &&= installedSkill.checked > 0 && installedSkill.extraFiles.length === 0;
  const renders = await compareRenders(dirA, dirB);
  const report = {
    formatVersion: 1,
    scope: 'Ultimate Beat Battle — Round 2 / GPT-6 Astra',
    generatedAtUtc: new Date().toISOString(),
    headAtVerification: git(['rev-parse', 'HEAD']).toString('utf8').trim(),
    pins: { engineBase: ENGINE_BASE, composerSkillCommit: SKILL_COMMIT, pinCommitContract },
    environment: { node: process.version, platform: process.platform, architecture: process.arch },
    engine, plugin, installedSkill, renders,
    pass: pinCommitContract.pass && engine.pass && plugin.pass && installedSkill.pass && renders.pass,
  };
  await writeFile(reportPath, `${JSON.stringify(report, null, 2)}\n`);
  console.log(JSON.stringify({ report: relative(reportPath), pass: report.pass,
    engine: { checked: engine.checked, pass: engine.pass, differences: engine.differences.length },
    plugin: { checked: plugin.checked, pass: plugin.pass }, installedSkill: { checked: installedSkill.checked, pass: installedSkill.pass },
    determinism: { pass: renders.pass, groups: renders.groups, differences: renders.differences.length, missingCategories: renders.missingCategories } }, null, 2));
  if (!report.pass) process.exitCode = 1;
}
main().catch(error => { console.error(error.stack ?? error.message); process.exitCode = 2; });
