// Applies to `remotion studio` and `remotion render` from this folder only.
// All configuration options: https://remotion.dev/docs/config
import {Config} from '@remotion/cli/config';

Config.setRspack(true);
Config.setVideoImageFormat('jpeg');
Config.setJpegQuality(92);
Config.setOverwriteOutput(true);
Config.setChromeMode('headless-shell');
// Machines that cannot download Chrome Headless Shell (offline CI, sandboxes)
// can point Remotion at an existing build instead.
if (process.env.REMOTION_BROWSER_EXECUTABLE) {
  Config.setBrowserExecutable(process.env.REMOTION_BROWSER_EXECUTABLE);
}
