/**
 * Remotion CLI configuration for the Plasma Orb project.
 * All options: https://remotion.dev/docs/config
 */
import { existsSync } from "node:fs";
import { Config } from "@remotion/cli/config";

Config.setRspack(true);
Config.setVideoImageFormat("jpeg");
Config.setJpegQuality(95);
Config.setOverwriteOutput(true);
Config.setDefaultPremountInSeconds(2);
// Everything is drawn with WebGL 2. "angle" uses the GPU when one exists and
// falls back to SwiftShader otherwise. Override with --gl=swangle if needed.
Config.setChromiumOpenGlRenderer("swangle");
// WebGL frames are heavy at 4K; keep two tabs in flight.
Config.setConcurrency(2);
// Each frame is fully deterministic and self-contained, so a long timeout
// only matters for slow software (CPU) rendering at 4K.
Config.setDelayRenderTimeoutInMilliseconds(120000);

// Sandboxed environments that cannot download Remotion's managed Chrome
// Headless Shell can point to a local one. On a normal machine none of these
// paths exist and Remotion uses its own managed browser.
const localHeadlessShells = [
  process.env.REMOTION_BROWSER_EXECUTABLE ?? "",
  "/opt/pw-browsers/chromium_headless_shell-1243/chrome-headless-shell-linux64/chrome-headless-shell",
];
const localShell = localHeadlessShells.find((p) => p && existsSync(p));
if (localShell) {
  Config.setBrowserExecutable(localShell);
}
