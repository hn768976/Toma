import { existsSync } from "node:fs";
import { Config } from "@remotion/cli/config";

/**
 * The stages are photographic: gradients on a near-black field (look 1),
 * a true-black field that doubles as a screen-blend overlay (look 2) and a
 * soft near-white field (look 3). JPEG intermediates would band all three,
 * so frames are captured as PNG.
 */
Config.setVideoImageFormat("png");
Config.setStillImageFormat("png");
Config.setOverwriteOutput(true);
Config.setCodec("h264");
Config.setPixelFormat("yuv420p");
Config.setCrf(16);

/**
 * WebGL in headless Chromium. "angle" is the documented default here; on a
 * machine without a GPU, "swangle" (ANGLE over SwiftShader) is what actually
 * gets a context and is what the timings in the README were measured with.
 * Override per machine with PODIUM_GL=angle|swangle|egl|vulkan.
 */
Config.setChromiumOpenGlRenderer(
  (process.env.PODIUM_GL ?? "swangle") as "angle" | "swangle" | "egl" | "vulkan",
);

// Software GL is memory-hungry; one tab per core is plenty.
if (process.env.PODIUM_CONCURRENCY) {
  Config.setConcurrency(Number(process.env.PODIUM_CONCURRENCY));
}

// Some sandboxed environments block Remotion's own Chrome Headless Shell
// download but ship a Playwright Chromium. Reuse it when present.
const playwrightHeadlessShell =
  "/opt/pw-browsers/chromium_headless_shell-1194/chrome-linux/headless_shell";
if (existsSync(playwrightHeadlessShell)) {
  Config.setBrowserExecutable(playwrightHeadlessShell);
}
