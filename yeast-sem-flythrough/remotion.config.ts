/**
 * Note: When using the Node.JS APIs, the config file
 * doesn't apply. Instead, pass options directly to the APIs.
 *
 * All configuration options: https://remotion.dev/docs/config
 */

import { existsSync, readdirSync } from "node:fs";
import { Config } from "@remotion/cli/config";

Config.setRspack(true);
// PNG frames keep the encode in standard limited-range yuv420p (JPEG frames
// would produce full-range "yuvj420p") and avoid a lossy intermediate step.
Config.setVideoImageFormat("png");
Config.setOverwriteOutput(true);
Config.setCodec("h264");
Config.setPixelFormat("yuv420p");
Config.setCrf(16);

// The scenes are WebGL2 (Three.js). On Linux servers without a GPU the
// software renderer "swangle" always works; on macOS / Windows use the
// real GPU through ANGLE. Override at any time with `--gl=<renderer>`.
Config.setChromiumOpenGlRenderer(
  process.platform === "linux" ? "swangle" : "angle",
);

// Some sandboxed environments block downloading Remotion's own Chrome
// Headless Shell but ship a Playwright one. Reuse it when present; on a
// normal machine this folder does not exist and Remotion uses its own.
const pw = "/opt/pw-browsers";
if (existsSync(pw)) {
  const dir = readdirSync(pw).find((d) =>
    d.startsWith("chromium_headless_shell-"),
  );
  const exe = [
    `${pw}/${dir}/chrome-headless-shell-linux64/chrome-headless-shell`,
    `${pw}/${dir}/chrome-linux/headless_shell`,
  ].find((e) => existsSync(e));
  if (dir && exe) {
    Config.setBrowserExecutable(exe);
  }
}
