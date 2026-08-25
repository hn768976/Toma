import {Config} from '@remotion/cli/config';

// Dark, smooth-gradient frames band badly at low intermediate quality.
Config.setVideoImageFormat('jpeg');
Config.setJpegQuality(95);
Config.setOverwriteOutput(true);

// Use a locally installed Chromium when available (e.g. sandboxed CI
// environments where Remotion cannot download its headless shell).
if (process.env.REMOTION_BROWSER_EXECUTABLE) {
  Config.setBrowserExecutable(process.env.REMOTION_BROWSER_EXECUTABLE);
}
