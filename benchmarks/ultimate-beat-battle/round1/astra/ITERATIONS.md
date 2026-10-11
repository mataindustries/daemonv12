# Iteration decisions

## V01 — full concept render

Complete 27.826-second score, nine stems, all six sources; no clipping.
Measured −21.48 LUFS-I, −4.65 dBTP, 1.6 LU LRA, 18.26 dB crest factor.

Weakest three things:

1. Percussion detail is buried: needles −49.20 LUFS and knuckles −49.12 versus the master at −21.48. The groove is under-articulated. Raise those sources and give the clap more lower-mid body.
2. The harmonic opening is underweight: velvet −40.44 LUFS; 69.09% of mono spectral power lies at 45–120 Hz. Raise the keys, sustain the opening's chord voicings, and ease the bass.
3. The return is too literal. Bars 9–12 mostly replay the first section. Change the hook's register, rewrite replies, and explicitly shape the pause.

V02 keeps the compact motif and arrangement length. Changes are compositional and stem-specific; source assets are unchanged. Evidence is in `output/v01/`.

## V02 — harmonic opening and register change

Measured −20.57 LUFS-I, −5.75 dBTP, 1.9 LU LRA; zero clipping. The percussion is 10 dB more present at source, velvet rises to −28.62 LUFS, and 45–120 Hz power drops from 69.09% to 58.26%. The Bbmaj7-to-G13 middle now has sustained voicings. The returning D5 hook and later A4 variation change register without introducing a new tune. Retain these improvements over V01.

Weakest three things:

1. The octave-up return is shorter because speed changes duration as well as pitch. Bar 9 is approximately 0.7 dB below bar 10 in RMS. Give the short call a low answer rather than filling it with another high layer.
2. The final four bars are still too close to the opening groove. Withhold the third hook syllable, displace the backbeat, and replace the last turnaround with an isolated descending triplet.
3. Arbitrary source offsets start as high as 0.177 full scale, a potential extra click. Choose nearby low-amplitude source frames for the chops. Also leave the final D a small resolving scoop and a clear decay.

V03 makes those musical changes and raises only the final compressor makeup by 3.6 dB for practical playback level. Version comparisons use crest, band proportions, section shape and event inspection independently of that delivery gain. Evidence is in `output/v02/`.

## V03 — answer, stumble, punctuation; selected master

Measured −16.98 LUFS-I, −2.15 dBTP, 1.7 LU LRA, 16.70 dB crest. No track or master clipped. The sound-design assets remain identical to V01.

The return now answers its high call in the low reed register. In bar 13 the expected third syllable disappears and the backbeat moves; in bar 14 a descending triplet occupies the space cleared by drums and bass. The last D receives a one-semitone resolving scoop. Offset entrances were moved to lower-amplitude source frames; the largest reed onset step falls from 0.1770 to 0.0015 before velocity/gain/effects.

Against V02 at comparable level, the lead's global loudness changes only −0.12 LU while the lower answer becomes a larger part of the phrase. Bar 9's deficit to bar 10 narrows from 0.68 to 0.38 dB. Low-band share falls slightly again, to 57.15%, and the final coda has fewer events, not more. The retained 16.70 dB crest demonstrates that delivery gain did not flatten the transients.

Known tradeoffs: the mix remains bass-forward; the smallest high-frequency ticks are subtle; the 27.8-second form gives the harmonic opening only two bars. These are intentional enough that a further full rewrite is not clearly justified by the evidence. Retain V03.

All three serious versions were rendered completely with stems. Canonical V03 was copied byte-for-byte to `project.json`; final packaging is not a fourth musical version. Optional gain-matched MP3s in `output/comparison/` make human comparison practical. The selection above is analytical and musical reasoning, not a claim of human listening.
