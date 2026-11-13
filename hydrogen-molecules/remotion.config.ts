/**
 * Remotion CLI configuration.
 * All options: https://remotion.dev/docs/config
 *
 * Compositions are authored at 3840x2160 (4K UHD).
 *   4K render:     npx remotion render <CompId> out/<name>-4k.mp4
 *   1080p render:  npx remotion render <CompId> out/<name>-1080p.mp4 --scale=0.5
 */
import { existsSync } from "node:fs";
import { Config } from "@remotion/cli/config";

Config.setVideoImageFormat("jpeg");
Config.setJpegQuality(95);
Config.setOverwriteOutput(true);
Config.setCodec("h264");
Config.setPixelFormat("yuv420p");
// Standard limited-range BT.709 output (yuv420p, tv range) instead of full-range yuvj420p.
Config.setColorSpace("bt709");
Config.setCrf(16);
// WebGL2 via SwiftShader (ANGLE + Vulkan) works on GPU-less machines/servers.
Config.setChromiumOpenGlRenderer("swangle");

// Optional: sandboxed environments that cannot download Remotion's own
// Chrome Headless Shell can point to a local one via REMOTION_BROWSER.
// When unset (normal machines), Remotion downloads and uses its own browser.
const browser = process.env.REMOTION_BROWSER;
if (browser && existsSync(browser)) {
  Config.setBrowserExecutable(browser);
}
