import { test, type TestContext } from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { chmodSync, copyFileSync, existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { tmpdir } from 'node:os';

const script = resolve('scripts/bootstrap-audio-tools.sh');
const source = readFileSync(script, 'utf8');
const linux = { skip: process.platform !== 'linux' && 'Rootless bootstrap targets Linux.' };
const hash = (path: string) => createHash('sha256').update(readFileSync(path)).digest('hex');
function executable(path: string, text: string) { writeFileSync(path, text); chmodSync(path, 0o755); }
function command(command: string, args: string[], env?: NodeJS.ProcessEnv) {
  const result = spawnSync(command, args, { encoding: 'utf8', env, timeout: 10000 });
  assert.equal(result.status, 0, result.stdout + result.stderr); return result;
}

// Exercise the real shell flow with tiny local artifacts, real ar/tar and real
// SHA-256 verification. Only downloads and conda installation are substituted.
function fixture(t: TestContext) {
  const dir = mkdtempSync(join(tmpdir(), 'daemonv12-bootstrap-')); t.after(() => rmSync(dir, { recursive: true, force: true }));
  const bin = join(dir, 'bin'), scripts = join(dir, 'scripts'), data = join(dir, 'data');
  for (const path of [bin, scripts, join(data, 'usr/share/sounds/sf2'), join(data, 'usr/share/doc/fluid-soundfont-gm')]) mkdirSync(path, { recursive: true });
  const sf = join(data, 'usr/share/sounds/sf2/FluidR3_GM.sf2'); writeFileSync(sf, Buffer.from('RIFF0000sfbk'));
  writeFileSync(join(data, 'usr/share/doc/fluid-soundfont-gm/copyright'), 'Test fixture copyright notice\n');
  const tar = join(dir, 'data.tar.xz'), deb = join(dir, 'soundfont.deb');
  command('tar', ['-cJf', tar, '-C', data, './usr']); command('ar', ['rc', deb, tar]);
  const mamba = join(dir, 'micromamba');
  executable(mamba, `#!/usr/bin/env bash
set -eu
prefix=''
while (($#)); do if [[ $1 == --prefix ]]; then prefix=$2; shift 2; else shift; fi; done
[[ \$\{BOOTSTRAP_FAKE_MODE:-\} != runtime-fail ]] || exit 9
mkdir -p "$prefix/bin" "$prefix/conda-meta"
touch "$prefix/conda-meta/history"
cat > "$prefix/bin/fluidsynth" <<'EOF'
#!/usr/bin/env bash
printf 'FluidSynth runtime version 2.3.7\\n'
EOF
cat > "$prefix/bin/ffmpeg" <<'EOF'
#!/usr/bin/env bash
case "$*" in
  *-version*) printf 'ffmpeg version 6.1.1\\n' ;;
  *-filters*) printf ' ... highpass A->A\\n ... lowpass A->A\\n ... aecho A->A\\n ... loudnorm A->A\\n' ;;
  *-encoders*) [[ \$\{BOOTSTRAP_FAKE_MODE:-\} == missing-mp3 ]] || printf ' A....D libmp3lame MP3\\n' ;;
esac
EOF
chmod +x "$prefix/bin/fluidsynth" "$prefix/bin/ffmpeg"
`);
  executable(join(bin, 'curl'), `#!/usr/bin/env bash
set -eu
url='' target=''
while (($#)); do
  case "$1" in https://*) url=$1; shift ;; --output) target=$2; shift 2 ;; *) shift ;; esac
done
printf '%s\\n' "$url" >> "$BOOTSTRAP_DOWNLOAD_LOG"
[[ \$\{BOOTSTRAP_FAKE_MODE:-\} != download-fail ]] || exit 22
if [[ \$\{BOOTSTRAP_FAKE_MODE:-\} == corrupt ]]; then printf 'corrupt' > "$target";
elif [[ $url == *micromamba-linux-64 ]]; then cp "$BOOTSTRAP_FIXTURE_DIR/micromamba" "$target";
else cp "$BOOTSTRAP_FIXTURE_DIR/soundfont.deb" "$target"; fi
`);
  executable(join(bin, 'uname'), '#!/usr/bin/env bash\nif [[ $1 == -s ]]; then echo Linux; else echo "${BOOTSTRAP_ARCH:-x86_64}"; fi\n');
  executable(join(bin, 'getconf'), '#!/usr/bin/env bash\necho "${BOOTSTRAP_GLIBC:-glibc 2.39}"\n');
  const testScript = join(scripts, 'bootstrap-audio-tools.sh');
  writeFileSync(testScript, source.replace('ffc3cb8d52d4d6b354bdbb979c407719c485392b74e462cbd50811aa88e58f85', hash(mamba))
    .replace('6f531493ac4e4d9772fd96b2488ea1790af81c196135fbdd25997da0781fc60e', hash(deb))
    .replace('74594e8f4250680adf590507a306655a299935343583256f3b722c48a1bc1cb0', hash(sf)));
  copyFileSync('scripts/audio-tools-linux-64.lock', join(scripts, 'audio-tools-linux-64.lock'));
  const prefix = join(dir, "audio tools 'quoted'"), log = join(dir, 'downloads.log');
  const env = { ...process.env, PATH: `${bin}:${process.env.PATH}`, BOOTSTRAP_FIXTURE_DIR: dir, BOOTSTRAP_DOWNLOAD_LOG: log };
  const run = (args: string[] = ['--prefix', prefix], extra: NodeJS.ProcessEnv = {}) => spawnSync('bash', [testScript, ...args], { env: { ...env, ...extra }, encoding: 'utf8', timeout: 10000 });
  return { dir, prefix, log, run, env };
}

test('bootstrap syntax, help, controlled HTTPS sources and every locked package integrity', linux, () => {
  command('bash', ['-n', script]); const help = command('bash', [script, '--help']); assert.match(help.stdout, /--prefix/);
  assert.doesNotMatch(source, /\bsudo\b|apt-get\s+install|dpkg\s+-i|shell\s+init|\.bashrc|\.zshrc/);
  assert.match(source, /--proto '=https'/); assert.match(source, /--safety-checks enabled/);
  const lock = readFileSync('scripts/audio-tools-linux-64.lock', 'utf8').split('\n').filter(line => line && !line.startsWith('#') && line !== '@EXPLICIT');
  assert.ok(lock.length > 2);
  for (const line of lock) assert.match(line, /^https:\/\/conda\.anaconda\.org\/conda-forge\/(linux-64|noarch)\/[^#]+#[0-9a-f]{64}$/);
  assert.ok(lock.some(line => line.includes('/fluidsynth-2.3.7-'))); assert.ok(lock.some(line => line.includes('/ffmpeg-6.1.1-gpl_')));
});
test('bootstrap installs in a prefix with spaces, retains notices, prints usable exports and reruns offline', linux, t => {
  const f = fixture(t), first = f.run(); assert.equal(first.status, 0, first.stdout + first.stderr);
  assert.equal(existsSync(join(f.prefix, '.bootstrap-lock')), false); assert.equal(existsSync(join(f.prefix, '.bootstrap-stage')), false);
  assert.ok(existsSync(join(f.prefix, 'soundfonts/FluidR3-GM.copyright')));
  assert.equal(readFileSync(f.log, 'utf8').trim().split('\n').length, 2);
  const exports = readFileSync(join(f.prefix, 'env.sh'), 'utf8');
  const second = f.run([], { DAEMONV12_AUDIO_PREFIX: f.prefix, BOOTSTRAP_FAKE_MODE: 'download-fail' }); assert.equal(second.status, 0, second.stderr);
  assert.equal(readFileSync(f.log, 'utf8').trim().split('\n').length, 2); assert.equal(readFileSync(join(f.prefix, 'env.sh'), 'utf8'), exports);
  const applied = command('bash', ['-c', 'source "$1/env.sh"; "$DAEMONV12_FLUIDSYNTH" --version; test -r "$DAEMONV12_SOUNDFONT"; "$DAEMONV12_FFMPEG" -version', 'bootstrap-test', f.prefix], f.env);
  assert.match(applied.stdout, /2\.3\.7/); assert.match(applied.stdout, /6\.1\.1/);
});
test('bootstrap rejects corrupted downloads before executing or installing them, and releases its lock', linux, t => {
  const f = fixture(t), result = f.run(undefined, { BOOTSTRAP_FAKE_MODE: 'corrupt' });
  assert.equal(result.status, 1); assert.match(result.stderr, /SHA-256 mismatch/);
  assert.equal(existsSync(join(f.prefix, 'runtime')), false); assert.equal(existsSync(join(f.prefix, '.bootstrap-lock')), false);
  const retry = f.run(); assert.equal(retry.status, 0, retry.stderr);
});
test('bootstrap refuses unsafe prefixes, unsupported hosts and unknown arguments without downloading', linux, t => {
  const f = fixture(t);
  for (const [args, env, expected] of [
    [['--prefix', '/usr/local/daemonv12-should-never-exist'], {}, /system directory/],
    [['--prefix', 'relative'], {}, /must be absolute/],
    [['--prefix'], {}, /requires an absolute/],
    [['--unknown'], {}, /Unknown argument/],
    [['--prefix', f.prefix], { BOOTSTRAP_ARCH: 'aarch64' }, /Only Linux x86_64/],
    [['--prefix', f.prefix], { BOOTSTRAP_GLIBC: 'glibc 2.27' }, /glibc >= 2.28/],
    [['--prefix', f.prefix], { BOOTSTRAP_GLIBC: 'musl 1.2' }, /glibc-based/],
  ] as const) {
    const result = f.run([...args], env); assert.equal(result.status, 1); assert.match(result.stderr, expected);
  }
  assert.equal(existsSync(f.log), false);
});
test('bootstrap fails clearly on network/runtime/capability problems and recovers interrupted provisioning', linux, t => {
  const f = fixture(t);
  let result = f.run(undefined, { BOOTSTRAP_FAKE_MODE: 'download-fail' }); assert.equal(result.status, 1); assert.match(result.stderr, /Download failed/);
  result = f.run(undefined, { BOOTSTRAP_FAKE_MODE: 'runtime-fail' }); assert.equal(result.status, 1); assert.match(result.stderr, /provisioning failed/);
  result = f.run(undefined, { BOOTSTRAP_FAKE_MODE: 'missing-mp3' }); assert.equal(result.status, 1); assert.match(result.stderr, /missing libmp3lame/);
  assert.equal(existsSync(join(f.prefix, 'env.sh')), false);
  result = f.run(); assert.equal(result.status, 0, result.stderr);
});
test('bootstrap preserves unmanaged installs, prevents concurrent writes and refuses a different lock', linux, t => {
  const f = fixture(t); mkdirSync(join(f.prefix, 'runtime'), { recursive: true });
  let result = f.run(); assert.equal(result.status, 1); assert.match(result.stderr, /unmanaged runtime/);
  rmSync(join(f.prefix, 'runtime'), { recursive: true }); mkdirSync(join(f.prefix, '.bootstrap-lock'));
  result = f.run(); assert.equal(result.status, 1); assert.match(result.stderr, /Another bootstrap/);
  rmSync(join(f.prefix, '.bootstrap-lock'), { recursive: true }); writeFileSync(join(f.prefix, '.daemonv12-audio-lock'), 'different lock\n');
  result = f.run(); assert.equal(result.status, 1); assert.match(result.stderr, /different audio lock/);
  assert.equal(readFileSync(join(f.prefix, '.daemonv12-audio-lock'), 'utf8'), 'different lock\n');
});
