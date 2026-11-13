/**
 * All configuration options: https://remotion.dev/docs/config
 */
import { existsSync, readdirSync } from "node:fs";
import { Config } from "@remotion/cli/config";

Config.setVideoImageFormat("jpeg");
Config.setJpegQuality(95);
Config.setOverwriteOutput(true);
Config.setCodec("h264");
Config.setPixelFormat("yuv420p");
Config.setCrf(18);

// The scene is rendered with Three.js / WebGL 2, so Chrome needs a GL backend.
// "angle" uses the GPU (recommended on desktops). On GPU-less servers use the
// software renderer:  REMOTION_GL=swangle npx remotion render ...
// (or pass --gl=swangle on the command line).
type Gl = "angle" | "swangle" | "angle-egl" | "egl" | "swiftshader" | "vulkan";
let gl: Gl = (process.env.REMOTION_GL as Gl | undefined) ?? "angle";

// Some sandboxed/CI environments cannot download Remotion's Chrome Headless
// Shell but ship a Playwright one. Reuse it when present (and fall back to
// software GL there, since such machines have no GPU). On a normal machine
// this directory does not exist and Remotion uses its own managed browser.
const pw = "/opt/pw-browsers";
if (existsSync(pw)) {
  const dir = readdirSync(pw).find((d) => d.startsWith("chromium_headless_shell-"));
  const exe = dir ? `${pw}/${dir}/chrome-headless-shell-linux64/chrome-headless-shell` : null;
  if (exe && existsSync(exe)) {
    Config.setBrowserExecutable(exe);
    if (!process.env.REMOTION_GL) gl = "swangle";
  }
}
Config.setChromiumOpenGlRenderer(gl);
