# Run ANGELES//2099 on Colab from an Android phone

You need a Google account with Google Drive and a few hundred MB free on Drive. No paid APIs.
**Nothing here spends GPU render time until the owner types a budget and flips a `CONFIRM`.**
Colab does bill a GPU runtime for as long as it is connected, so disconnect when you are done
(Runtime › Disconnect and delete runtime).

## Open the notebook

1. On your phone, open Chrome and go to **colab.research.google.com**.
2. Tap **File** › **Open notebook** › **GitHub**, search for `mataindustries/daemonv12`, choose branch
   `claude/stoic-rubin-2kpv6u`, and open `productions/lowrider-2099/colab/ANGELES2099.ipynb`.
   (If the repository is private, sign in to GitHub when asked.) Cell 1 then fetches the project at
   the one commit written into it, so what renders is exactly what was reviewed.
3. Tap **Runtime** › **Change runtime type** › **T4 GPU** › **Save**.

## Check everything (renders nothing)

4. Tap **Runtime** › **Run all**.
5. When Colab asks for Google Drive access, allow it. Your work goes to `My Drive/ANGELES2099`.
6. Wait for cell 5 to say **"Inputs valid … Nothing was rendered."** Cells 6–10 then print why they
   did not render (no budget, no `CONFIRM`, no approval). That is the expected result.

If a cell stops with **HOW TO FIX**, do what it says, then Run all again. That is always safe:
finished work on Drive is reused only if every input that affects pixels is unchanged.

## Spend GPU time only after approval, one step at a time

| Step | Cell | What you change | What it does |
|---|---|---|---|
| Budget | 6 | `APPROVED_GPU_MINUTES = 15`, `APPROVER = "your name"` | Records the owner's limit on Drive. Every render is charged against it |
| One-frame test | 7 | `CONFIRM = True` | Renders frame 400 once (≤ 6 min of the budget) and measures real build and per-frame time on this GPU |
| GATE 03 proof | 8 | `CONFIRM = True` | Prints the padded estimate from that measurement; refuses if it exceeds what is left |
| Approve GATE 03 | 9 | `APPROVE_GATE03 = True` | Only after the owner has looked at the five frames |
| GATE 04 animatic | 10 | `CONFIRM = True` | The whole piece as a Workbench animatic with the soundtrack, as an MP4 on Drive |
| Status | 11 | nothing | Commit, budget ledger, measured timings, gates, renders |

Frames appear in **Drive › ANGELES2099 › renders › GATE03 › (a 12-character key)**. The key changes
whenever the scene, cameras, soundtrack, config or settings change, so stale frames are never
mistaken for current ones. Open them in the Drive app.

## If something goes wrong

| You see | Do this |
|---|---|
| "No CUDA/OptiX GPU" | Runtime › Change runtime type › T4 GPU, then Run all |
| "No GPU budget approved" | The owner sets a budget in cell 6 |
| "exceeds the remaining approved budget" | Stop. The owner decides whether to raise the budget |
| "Checked out …, expected …" | Runtime › Disconnect and delete runtime, then Run all |
| Disconnected or timed out | Reopen the notebook and Run all; finished frames are kept |
| "does not match its pinned SHA-256" | Run the cell again; the bad download was deleted |
| "Scene validation failed" | Don't render. Send `Drive/ANGELES2099/reports/scene-check-crest.json` to the producer |
| Free GPU quota used up | Wait until Colab offers a GPU again; nothing is lost |
