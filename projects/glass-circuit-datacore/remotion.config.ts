/**
 * Remotion CLI configuration for "Glass Circuit Datacore".
 * All configuration options: https://remotion.dev/docs/config
 */
import { existsSync } from "node:fs";
import { Config } from "@remotion/cli/config";
import { enableTailwind } from "@remotion/tailwind-v4";

Config.setRspack(true);
Config.setVideoImageFormat("jpeg");
Config.setJpegQuality(95);
Config.setOverwriteOutput(true);
Config.setDefaultPremountInSeconds(2);
// Software WebGL at 4K can take a while per frame on small machines.
Config.setDelayRenderTimeoutInMilliseconds(900000);
Config.overrideBundlerConfig(enableTailwind);

// Final deliverable settings (can be overridden on the command line).
Config.setCodec("h264");
Config.setPixelFormat("yuv420p");
Config.setCrf(16);

// WebGL 2 is required. "swangle" (SwiftShader via ANGLE) works on any machine,
// including GPU-less servers. On a machine with a GPU, set REMOTION_GL=angle
// for much faster renders.
Config.setChromiumOpenGlRenderer(
  (process.env.REMOTION_GL as "angle" | "swangle" | undefined) ?? "swangle",
);

// Some sandboxed environments block downloading Remotion's Chrome Headless
// Shell but ship a Playwright build. Use it when present; on a normal machine
// this path doesn't exist and Remotion uses its own managed browser.
const playwrightHeadlessShell =
  "/opt/pw-browsers/chromium_headless_shell-1243/chrome-headless-shell-linux64/chrome-headless-shell";
if (existsSync(playwrightHeadlessShell)) {
  Config.setBrowserExecutable(playwrightHeadlessShell);
}
