/**
 * All configuration options: https://remotion.dev/docs/config
 */
import { existsSync, readdirSync } from "node:fs";
import { Config } from "@remotion/cli/config";

Config.setRspack(true);
// Lossless intermediate frames + standard (limited range) BT.709 H.264 output
Config.setVideoImageFormat("png");
Config.setColorSpace("bt709");
Config.setOverwriteOutput(true);
Config.setCodec("h264");
Config.setPixelFormat("yuv420p");
Config.setCrf(16);

// The scene is WebGL. "angle" (GPU) is used on macOS / Windows; on Linux,
// where render machines are usually headless and GPU-less, the software
// backend "swangle" is used because it works everywhere.
// Override with the REMOTION_GL env variable or the --gl flag.
type Gl = "angle" | "swangle" | "egl" | "angle-egl" | "vulkan";
Config.setChromiumOpenGlRenderer(
  (process.env.REMOTION_GL as Gl | undefined) ??
    (process.platform === "linux" ? "swangle" : "angle"),
);

// Optional: some sandboxed CI machines cannot download Remotion's managed
// Chrome Headless Shell but ship a Playwright one. Reuse it when present;
// on a normal machine this folder does not exist and nothing changes.
const pw = "/opt/pw-browsers";
if (existsSync(pw)) {
  const dir = readdirSync(pw).find((d) => d.startsWith("chromium_headless_shell"));
  const candidates = dir
    ? [`${pw}/${dir}/chrome-linux/headless_shell`, `${pw}/${dir}/chrome-headless-shell-linux64/chrome-headless-shell`]
    : [];
  const bin = candidates.find((c) => existsSync(c));
  if (bin) {
    Config.setBrowserExecutable(bin);
  }
}
