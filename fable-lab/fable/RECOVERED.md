# FABLE sketches — recovered, unfinished, unreviewed

These four files are the uncommitted work of the earlier FABLE session (2026-11-14, 02:06–02:24 UTC), which hit a
usage limit before anything was committed. They were rebuilt from that session's transcript: the four original file
writes plus its six later patches, replayed in order (every patch's exact-match assertion passed).

| File | What it is |
|---|---|
| `compose.ts` | Two candidate scores and their mixes: **A · INDUSTRIAL PURSUIT** and **B · CHROME FUNK** |
| `mix.ts` | Small mix helpers (filters, kick-keyed pump, CRUSH wrappers, room) |
| `build.ts` | Renders both candidates, folds each into a seamless loop, writes stems and `REPORT.json` |
| `bridge.ts` | That session's own carrier-based V12 adapter. It predates, and is superseded by, `studio-001/v12-bridge` (PR #51) |

Status when the session stopped: both candidates rendered end to end three times (about -10.5 LUFS, -1 dBTP); the
last patch (bass/stab pump depths) was applied but never rendered, and the lab typecheck had not completed.
**No audio survived** (renders lived in that session's scratch directory) and nobody has listened to either candidate.

Nothing here is wired into tests or other modules. Do not treat it as approved material. To hear it again:
`FABLE_CACHE=<dir> node fable-lab/fable/build.ts <new-output-dir>` (about three minutes; needs FFmpeg).
