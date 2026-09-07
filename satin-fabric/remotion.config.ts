/**
 * Note: when using the Node.js APIs this file does not apply; pass the
 * options directly instead. All options: https://remotion.dev/docs/config
 */
import { existsSync } from "node:fs";
import { Config } from "@remotion/cli/config";

Config.setRspack(true);

// PNG intermediate frames, not JPEG. This piece is nothing but huge, smooth,
// near-black gradients -- exactly what JPEG's chroma subsampling smears --
// and any artefact introduced here would survive into the H.264 encode.
Config.setVideoImageFormat("png");
Config.setOverwriteOutput(true);

// Headless Chromium needs an OpenGL backend for WebGL. "angle" is the right
// choice on a machine with a GPU; on a headless box without one, override at
// the call site with --gl=swangle (ANGLE over SwiftShader, software, slower).
Config.setChromiumOpenGlRenderer("angle");

// Some sandboxed environments block Remotion's own Chrome Headless Shell
// download but ship a Playwright Chromium. Use it there; on a normal machine
// this path does not exist and Remotion falls back to its managed browser.
const playwrightHeadlessShell =
  "/opt/pw-browsers/chromium_headless_shell-1194/chrome-linux/headless_shell";
if (existsSync(playwrightHeadlessShell)) {
  Config.setBrowserExecutable(playwrightHeadlessShell);
}
