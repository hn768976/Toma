import { existsSync } from "node:fs";
import { Config } from "@remotion/cli/config";

// WebGL2 via ANGLE. Required for the three.js looks (KeywordGlobe,
// BlockchainPanels, BlockchainBuild) in headless Chromium.
Config.setChromiumOpenGlRenderer("angle");
Config.setVideoImageFormat("png");
Config.setPixelFormat("yuv420p");
Config.setCodec("h264");
Config.setCrf(16);
Config.setOverwriteOutput(true);
Config.setConcurrency(null);
Config.setDelayRenderTimeoutInMilliseconds(180000);

// Optional: reuse a pre-installed Chromium headless shell when one exists
// (some sandboxed CI images block Remotion's own browser download).
const localShell = process.env.REMOTION_BROWSER_EXECUTABLE;
if (localShell && existsSync(localShell)) {
  Config.setBrowserExecutable(localShell);
}
