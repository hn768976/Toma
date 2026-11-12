/**
 * All configuration options: https://remotion.dev/docs/config
 */
import { existsSync } from "node:fs";
import { Config } from "@remotion/cli/config";

Config.setRspack(true);
Config.setVideoImageFormat("jpeg");
Config.setJpegQuality(95);
Config.setOverwriteOutput(true);
Config.setCodec("h264");
Config.setPixelFormat("yuv420p");
Config.setCrf(16);
// The scenes are WebGL2 (Three.js). ANGLE works with a GPU and falls back to
// software rendering on machines without one.
Config.setChromiumOpenGlRenderer("angle");

// Optional: reuse an already-installed Chrome Headless Shell instead of
// letting Remotion download one, e.g.
//   REMOTION_BROWSER=/path/to/headless_shell npx remotion render ...
const browser = process.env.REMOTION_BROWSER;
if (browser && existsSync(browser)) {
  Config.setBrowserExecutable(browser);
}
