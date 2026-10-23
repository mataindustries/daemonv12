# THE CIRCUIT — approval delivery

The MP4 in this directory is the finished eight-second proof for review. It has not
been rerendered. A container-only repair removed a duplicate MOOV header discovered
during remote download verification; every compressed video/audio packet and its
timestamp, and every decoded video pixel, is unchanged. The clean MP4 SHA-256 is
`aa268b662fb7693a481c03c563bc99cb3bec93b23bbd7279fc319a3c3ae24304`.

- [Download the finished MP4](the-circuit.mp4?raw=true)
- [Contact sheet from actual decoded MP4 frames](contact-sheet.jpg)
- [Frame extraction provenance](contact-sheet.frames.json)
- [Container repair and packet/pixel identity evidence](container-repair-verification.json)
- [Technical verification](../VERIFICATION.md)
- [Files added by original commit 683cb22](commit-683cb22-files.txt)
- [SHA-256 checksums](SHA256SUMS)

The MP4 is 1080 × 1920, H.264 High/yuv420p and AAC-LC, 480 frames at 60 fps.
Both streams begin at zero and present for exactly 8.000 seconds. Frames 456–479 are
completely black. It has one fast-start MOOV before the media payload. GitHub's raw
endpoint serves it as a direct file download; open the downloaded MP4 with an Android
video player. No physical Android-device playback test is claimed.

The review ZIP is kept outside Git history. Its destination is awaiting approval.
No YouTube upload, site deployment or product showcase release was made.
