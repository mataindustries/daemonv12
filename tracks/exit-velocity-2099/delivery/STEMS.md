# Aligned stems

The twelve 44.1 kHz stereo WAV stems are in a ZIP split into two files to fit the upload limit. Download both parts into the same directory and reassemble them:

```sh
cat exit-velocity-2099-stems.zip.part-00 exit-velocity-2099-stems.zip.part-01 > exit-velocity-2099-stems.zip
unzip -t exit-velocity-2099-stems.zip
unzip exit-velocity-2099-stems.zip
```

The stems begin at time zero, last 56 seconds, and include track processing. They do not include the final master gain. See MASTERING-QA.md for reproduction, verification and hashes.
