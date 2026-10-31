# Run ANGELES//2099 on Colab from an Android phone

You need a Google account with Google Drive and a few hundred MB free on Drive. No paid APIs.

## Open the notebook

1. On your phone, open Chrome and go to **colab.research.google.com**.
2. Tap **File** › **Open notebook** › **GitHub**, search for `mataindustries/daemonv12`, choose branch
   `claude/stoic-rubin-2kpv6u`, and open `productions/lowrider-2099/colab/ANGELES2099.ipynb`.
   (If the repository is private, sign in to GitHub when asked.)
3. Tap **Runtime** › **Change runtime type** › **T4 GPU** › **Save**.

## Check everything (renders nothing, uses about 5 minutes of T4 time)

4. Tap **Runtime** › **Run all**.
5. When Colab asks for Google Drive access, allow it. Your work goes to `My Drive/ANGELES2099`.
6. Wait for cell 5 to say **"Inputs valid … Nothing was rendered."**

If a cell stops with **HOW TO FIX**, do what it says, then Run all again. That's always safe:
finished work on Drive is kept, and nothing is rendered twice.

## Render only after approval

- **GATE 03 (five frames):** after the owner approves the music and the styleframes, scroll to
  cell 6, change `CONFIRM = False` to `CONFIRM = True`, and tap its play button. It prints the GPU
  time first (about 5 minutes on a T4, estimated before the first measurement).
- The frames appear in **Drive › ANGELES2099 › renders › GATE03**. Open them in the Drive app.
- **GATE 04 (motion preview)** stays locked until the owner sets `APPROVE_GATE03 = True` in
  cell 7 and runs it.

## If something goes wrong

| You see | Do this |
|---|---|
| "No CUDA/OptiX GPU" | Runtime › Change runtime type › T4 GPU, then Run all |
| Disconnected or timed out | Reopen the notebook and Run all; finished frames are kept |
| "does not match its pinned SHA-256" | Run the cell again; the bad download was deleted |
| "Scene validation failed" | Don't render. Send `Drive/ANGELES2099/reports/scene-check-crest.json` to the producer |
| Free GPU quota used up | Wait until Colab offers a GPU again; nothing is lost |
