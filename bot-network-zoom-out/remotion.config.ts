/**
 * All configuration options: https://remotion.dev/docs/config
 */
import { existsSync } from "node:fs";
import { Config } from "@remotion/cli/config";

// PNG frames keep the encode in standard (limited-range) yuv420p / BT.709.
Config.setVideoImageFormat("png");
Config.setColorSpace("bt709");
Config.setOverwriteOutput(true);
Config.setCodec("h264");
Config.setPixelFormat("yuv420p");
Config.setCrf(16);
// WebGL (Three.js) needs a GL backend in headless Chrome. "angle" uses the
// GPU when there is one; "swangle" is the software fallback that works
// everywhere (CI, containers). Override with --gl=angle on a GPU machine.
Config.setChromiumOpenGlRenderer("swangle");

// Some sandboxed environments cannot download Remotion's own Chrome Headless
// Shell but ship a Playwright one. Reuse it when present; on a normal machine
// these paths do not exist and Remotion downloads its managed browser.
const candidates = [
  process.env.REMOTION_BROWSER_EXECUTABLE,
  "/opt/pw-browsers/chromium_headless_shell-1243/chrome-headless-shell-linux64/chrome-headless-shell",
].filter(Boolean) as string[];
const found = candidates.find((p) => existsSync(p));
if (found) {
  Config.setBrowserExecutable(found);
}
