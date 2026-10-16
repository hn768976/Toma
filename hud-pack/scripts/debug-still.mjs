// Debug helper: renders one still and prints browser console output.
import { bundle } from "@remotion/bundler";
import { renderStill, selectComposition } from "@remotion/renderer";
import path from "node:path";
const [id, frame = "0", out = "out/debug.png", scale = "0.3333333333333333"] = process.argv.slice(2);
const serveUrl = await bundle({ entryPoint: path.resolve("src/index.ts") });
const opts = {
  serveUrl, id, inputProps: { id: id.replace(/-/g, "_") },
  chromiumOptions: { gl: "angle" },
  browserExecutable: "/opt/pw-browsers/chromium_headless_shell-1194/chrome-linux/headless_shell",
  onBrowserLog: (l) => console.log("[browser]", l.type, l.text),
};
const composition = await selectComposition(opts);
await renderStill({ ...opts, composition, frame: Number(frame), output: out, scale: Number(scale), imageFormat: "png" });
console.log("done", out);
