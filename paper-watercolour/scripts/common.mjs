import { bundle } from "@remotion/bundler";
import { existsSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

export const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
// --gl: "angle" on a GPU machine (recommended), "swangle" for CPU-only boxes.
export const GL = process.env.GL || "angle";
const pwShell = "/opt/pw-browsers/chromium_headless_shell-1194/chrome-linux/headless_shell";
export const browserExecutable = existsSync(pwShell) ? pwShell : null;
export const chromiumOptions = { gl: GL };

export const makeBundle = () =>
  bundle({ entryPoint: path.join(ROOT, "src/index.ts"), publicDir: path.join(ROOT, "public") });
