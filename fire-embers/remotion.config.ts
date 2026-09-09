/**
 * Note: when using the Node.js APIs this file does not apply — pass the same
 * options directly to the APIs instead.
 * https://remotion.dev/docs/config
 */

import { existsSync } from "node:fs";
import { Config } from "@remotion/cli/config";

Config.setRspack(true);
Config.setOverwriteOutput(true);

// Frames are captured as PNG rather than JPEG. This plate is almost entirely
// near-black gradient, and a lossy intermediate would band it before x264 ever
// sees it.
Config.setVideoImageFormat("png");

// Low CRF keeps the black floor at a true 0,0,0 and the haze free of blocking.
Config.setCrf(14);

// These are silent overlay plates. Without this Remotion muxes in a silent AAC
// track, which shows up in ffprobe and is dead weight in an editor's bin.
Config.setEnforceAudioTrack(false);
Config.setMuted(true);

// Escape hatch for locked-down environments that cannot download Remotion's own
// Chrome Headless Shell. Leave it unset on a normal machine and Remotion
// downloads and manages the browser itself.
const browserExecutable = process.env.REMOTION_BROWSER_EXECUTABLE;
if (browserExecutable && existsSync(browserExecutable)) {
  Config.setBrowserExecutable(browserExecutable);
}
