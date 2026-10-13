// Debug helper: render one still and print browser console output.
import { bundle } from "@remotion/bundler";
import { renderStill, selectComposition } from "@remotion/renderer";
const [id, frame = "0", out = "out/debug.png", scale = "0.3333333333333333"] = process.argv.slice(2);
const serveUrl = await bundle({ entryPoint: "src/index.ts" });
const opts = {
  serveUrl,
  chromiumOptions: { gl: "angle" },
  browserExecutable: "/opt/pw-browsers/chromium_headless_shell-1194/chrome-linux/headless_shell",
};
const composition = await selectComposition({ ...opts, id, inputProps: {} });
await renderStill({
  ...opts,
  composition,
  frame: Number(frame),
  output: out,
  scale: Number(scale),
  onBrowserLog: (l) => { if (!/GPU stall/.test(l.text)) console.log("[browser]", l.type, l.text); },
});
console.log("done");
