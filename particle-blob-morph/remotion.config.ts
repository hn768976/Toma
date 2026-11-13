/**
 * Remotion CLI configuration.
 * Note: the Node.js APIs ignore this file; pass the options directly there.
 * All configuration options: https://remotion.dev/docs/config
 */
import { existsSync } from "node:fs";
import { Config } from "@remotion/cli/config";

Config.setVideoImageFormat("jpeg");
Config.setJpegQuality(95);
Config.setOverwriteOutput(true);
Config.setCodec("h264");
Config.setPixelFormat("yuv420p");
Config.setColorSpace("bt709");
Config.setCrf(18);
// WebGL / canvas rendering in headless Chrome. "swangle" (SwiftShader via ANGLE)
// works on every machine, including servers without a GPU. On a desktop with a
// GPU you can pass `--gl=angle` on the command line for much faster renders.
Config.setChromiumOpenGlRenderer("swangle");
Config.setConcurrency(4);

// Optional: reuse a locally installed Chromium headless shell if present
// (sandboxed CI images); otherwise Remotion downloads its own browser.
const localHeadlessShell = process.env.REMOTION_BROWSER_EXECUTABLE;
if (localHeadlessShell && existsSync(localHeadlessShell)) {
  Config.setBrowserExecutable(localHeadlessShell);
}
