// Dev helper: renders one still through the Node API and prints browser logs.
// node scripts/debug-still.mjs <compositionId> <frame> <out.png> [scale] [inputPropsJSON]
import { bundle } from "@remotion/bundler";
import { renderStill, selectComposition } from "@remotion/renderer";
import { existsSync } from "node:fs";
import path from "node:path";
const [id = "AcronymCubes-CBDC", frame = "0", out = "out/debug.png", scale = "0.3333333333333333", props = "{}"] =
  process.argv.slice(2);
const inputProps = JSON.parse(props);
const serveUrl = await bundle({ entryPoint: path.resolve("src/index.ts") });
const exe = "/opt/pw-browsers/chromium_headless_shell-1194/chrome-linux/headless_shell";
const common = {
  serveUrl,
  browserExecutable: existsSync(exe) ? exe : null,
  chromiumOptions: { gl: "angle" },
  inputProps,
  onBrowserLog: (l) => console.log("[browser]", l.type, l.text),
};
const composition = await selectComposition({ ...common, id });
await renderStill({ ...common, composition, frame: Number(frame), output: out, scale: Number(scale), timeoutInMilliseconds: 240000 });
console.log("done");
