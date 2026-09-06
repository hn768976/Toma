/**
 * Note: when rendering through the Node.JS APIs this file does not apply —
 * pass the same options directly to the API instead.
 *
 * All options: https://remotion.dev/docs/config
 */

import { existsSync } from "node:fs";
import { Config } from "@remotion/cli/config";

Config.setOverwriteOutput(true);

// There is no sound in either composition, so don't let the encoder attach a
// silent AAC track — it is a few hundred kb/s of nothing in a delivered file.
Config.setMuted(true);

// The strokes are drawn on white with normal alpha blending; JPEG's chroma
// subsampling puts visible mosquito noise in the white around the dense
// ridges, so hand PNG frames to the encoder instead.
Config.setVideoImageFormat("png");

// WebGL: ANGLE is the fastest renderer that still gives correct instanced
// rendering. On a machine with no GPU (CI, containers) override this on the
// command line with `--gl=swangle` — same output, roughly 3x slower.
Config.setChromiumOpenGlRenderer("angle");

// Some sandboxed dev environments block downloading Remotion's own Chrome
// Headless Shell but ship a Playwright Chromium at this path. Reuse it there;
// on a normal machine this path won't exist and Remotion falls back to its
// own managed browser.
const playwrightHeadlessShell =
  "/opt/pw-browsers/chromium_headless_shell-1194/chrome-linux/headless_shell";
if (existsSync(playwrightHeadlessShell)) {
  Config.setBrowserExecutable(playwrightHeadlessShell);
}
