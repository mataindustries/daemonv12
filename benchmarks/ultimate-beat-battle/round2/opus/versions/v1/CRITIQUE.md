# V1 critique — three weakest musical results

Render: `renders/v1/project.wav` (ignored), snapshot `versions/v1/project.json`.
Master: −17.88 LUFS, −4.19 dBTP, LRA 2.6 LU, no clipping. Method: `tools/analyze.py`
(2048-pt Hann STFT; section windows on bar lines; stem activity maps per sixteenth).

1. **The garage swing is not actually audible; bars 1–2 have dead air (0.0–3.6 s and
   throughout).** Evidence: hats stem RMS −53 dB in bars 1–2 and −42 dB elsewhere vs.
   kick −28 dB; per-sixteenth activity map shows no hat step above −45 dB except the
   open-hat "ands"; in bars 1–2 steps 11–16 (1.1–1.8 s, 2.9–3.6 s) only the halo and a
   −52 dB metal strike sound. The metal "third voice" (stem −50 to −54 dB) is inaudible.
   Cause: an 85 ms −9 dBFS tick at velocities 0.2–0.7, −11 dB track gain and a 2.5 kHz
   high-pass; metal at −15 dB with a high-pass. The rhythm identity promised by the
   thesis exists only on paper. Change: make the shuffle a performed part (accents,
   ghosts, offbeat steel open hat on its own track), raise it ~6 dB, make ticks carry the
   swing from bar 1, and make the metal reply audible so bars 1–2 have pulse instead of
   holes.

2. **The payoff entrance is smaller and darker than the build (16.12 s, bars 10–13).**
   Evidence: section RMS −17.9 dB (payoff) vs −16.9 dB (build); on the payoff's first beat
   upper-mid is −14.4 dB vs −3.0 dB average in the build; voice stem drops from −21.6 to
   −27.6 dB; growl stem (now carrying the hook) −27.8 dB; L/R correlation 1.00 in every
   section (no stereo contrast anywhere). Cause: the role swap hands the call to a G2
   vowel bass mixed at −9 dB, so the hook register collapses to 100–700 Hz under the
   kick/sub, and nothing widens. Change: make the vowel bass a forward, bright
   upper-mid voice (+6 dB, more drive, open low-pass), put a full-band hit on the payoff
   downbeat, and give the payoff answers and open hats stereo placement so the image
   opens only there.

3. **The build's low end is a wall that pre-spends the payoff (10.75–14.33 s, bars 7–8).**
   Evidence: four back-to-back 7.6-step sub notes; sub stem −17.4 dB RMS (loudest of the
   track, vs −22.5 dB in the groove), sub band +11.1 dB, highest of any section; the
   activity map shows the sub continuous under every kick, so the gear cycle's 3-against-4
   accents have no low-end articulation. Cause: a sustained pedal chosen for "pressure".
   Change: make the build's bass rhythmic and lighter — short sub hits that lock to the
   gear cycle, with a rising sequence into the stall — and reserve sustained weight for
   the payoff.
