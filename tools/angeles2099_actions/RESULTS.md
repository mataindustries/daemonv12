# Gate A installer hotfix

The first real Gate A run, [41388741445](https://github.com/mataindustries/daemonv12/actions/runs/41388741445), failed after installing all nine hash-verified packages. Python was **3.11.14**, pip **26.2.2**, and the runner **ubuntu-24.04**. Rendering never started.

## Confirmed cause

The exact approved wheel has inconsistent compatibility metadata:

| Field | Actual value |
|---|---|
| Filename | `bpy-4.5.14-cp311-cp311-manylinux_2_28_x86_64.whl` |
| SHA-256 | `1697c44362887e3b714f54035f1167131801249b8b46ff226b615be4ce9cabde` |
| Internal WHEEL Tag | `cp39-cp39-manylinux_2_28_x86_64` |
| METADATA Requires-Python | `==3.11.*` |
| Native runtime | Blender `4.5.14 LTS`, CPython 3.11 |

CPython 3.11 supports the wheel filename's tag, while the internal CPython 3.9 ABI tag is unsupported. This reproduces pip's sole finding: `bpy 4.5.14 is not supported on this platform`. The wheel metadata is defective; the native Blender runtime initializes successfully. Neither the archive nor its installed metadata is rewritten.

## Focused fix

The offline install step invokes `verify_install.py` in place of the unconditional `pip check` command. The verifier:

- Rechecks all nine original wheel filenames and hashes, exact Python and production commit.
- Saves Python/SOABI/libc, all supported tags, raw installed bpy WHEEL metadata, package versions and pip's original result in `install-check.json` inside the existing artifact.
- Confirms the installed WHEEL metadata matches the hash-verified archive and the filename supports the current interpreter/platform.
- Validates every pinned version, Requires-Python and active Requires-Dist specifier, imports all nine packages, and initializes an actual Cycles CPU scene without rendering.
- Runs pip's check of the entire environment and allows only its exact, single bpy platform finding, only after proving this exact known metadata defect. Any other dependency/platform/tool failure, missing metadata, unexpected tag or native initialization failure remains fatal.

The renderer, dependency lock, source pin, native resolution, samples, motion blur, standard CPU runner, manual-only trigger, 90-minute cap, artifact budget and retention/resume behavior are unchanged. Existing Ubuntu CI gains only a regression-test step; no render trigger or production mode is added.

## Verification evidence

In an isolated **local Linux x86_64 CPU environment**, with Python **3.11.14** and pip **26.2.2**:

- All nine approved packages installed offline from the original hash-verified wheels.
- The original `pip check` failure was reproduced exactly; the filename tag was supported and the internal cp39 tag was not.
- The new verifier passed: Blender **4.5.14 LTS**, Cycles **CPU**, all pinned versions/imports and active dependency requirements valid, real scene/dependency-graph initialization successful, **zero frames rendered**.
- The full approved production generator at **`2a3208d3679a32e9f5ced303d6bc8baa1a237071`** built all animation and passed **14/14 scene checks**, including CRESTLINE v3/master locks. No production files changed and no frames were rendered.
- **25/25 unit tests passed**, including missing/conflicting dependencies, wrong Python/Blender versions, unsupported filename tags, unknown internal tags, extra pip failures, quality/storage guards and render resume tests. These tests run in existing CI as well.

The local environment used glibc **2.41**; this is not a GitHub runner timing or native-frame render result. The workflow will repeat the installer verifier on the actual Ubuntu runner before Gate A rendering. Review the hotfix PR's checks for the current remote CI result.

## After merge: Gate A only

Start a **new manual run** of **ANGELES2099 CPU Gate A** using the updated `main` branch, following [the Android instructions](README.md#activate-and-trigger-from-android). Leave `resume_run_id` blank: the failed run rendered no frames. Do not use GitHub's ordinary **Re-run jobs** on the old run, because it retains the old workflow commit and its failing install command.

Inspect `install-check.json`, `scene-check.json`, native PNGs, comparisons and measured render times from that new run. Actual GitHub CPU render timings and human visual approval remain pending. No teaser or full-film render is authorized or launched by this fix.

