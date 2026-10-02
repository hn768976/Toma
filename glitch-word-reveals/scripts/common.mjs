import { existsSync } from "node:fs";
import path from "node:path";

// remotion.config.ts does not apply to the Node APIs, so mirror it here.
const playwrightHeadlessShell =
  "/opt/pw-browsers/chromium_headless_shell-1194/chrome-linux/headless_shell";
export const browserExecutable = existsSync(playwrightHeadlessShell)
  ? playwrightHeadlessShell
  : null;

export const root = path.resolve(path.dirname(new URL(import.meta.url).pathname), "..");

// Same naming as src/words.ts (kept in sync by the id -> name rule).
export const outputNameFromId = (id) => id.replace("-", "_").replace(/-/g, "_");

// Without this the Node API runs Chrome in --single-process mode on Linux
// (2.5x slower here). The scripts only use the Node API to list compositions
// and read measured layouts; every pixel is rendered by the CLI.
export const chromiumOptions = { enableMultiProcessOnLinux: true };
