import { existsSync } from "node:fs";
import { Config } from "@remotion/cli/config";

// Planets template render settings.
Config.setVideoImageFormat("png");
Config.setOverwriteOutput(true);
Config.setPixelFormat("yuv420p");
Config.setCodec("h264");
Config.setCrf(16);
// WebGL2 through ANGLE. On a machine with a GPU, "angle" uses it;
// set REMOTION_GL=swangle to force ANGLE's software (SwiftShader) backend.
Config.setChromiumOpenGlRenderer(
  (process.env.REMOTION_GL as "angle" | "swangle" | undefined) ?? "angle",
);
// Each tab holds ~0.5 GB of 8K maps; keep concurrency modest.
Config.setConcurrency(Number(process.env.REMOTION_CONCURRENCY ?? 2));
Config.setDelayRenderTimeoutInMilliseconds(300000);

// Sandboxed environments that block Remotion's browser download but ship a
// Playwright headless shell: reuse it. Elsewhere Remotion uses its own.
const playwrightHeadlessShell =
  "/opt/pw-browsers/chromium_headless_shell-1194/chrome-linux/headless_shell";
if (existsSync(playwrightHeadlessShell)) {
  Config.setBrowserExecutable(playwrightHeadlessShell);
}
