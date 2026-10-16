// Dev helper: bundle once, render several stills of one composition, tile them.
// usage: node scripts/sheet.mjs <CompositionId> <frames comma list> <out.png> [scale] [cols]
import { bundle } from "@remotion/bundler";
import { renderStill, selectComposition } from "@remotion/renderer";
import { execFileSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
const [id, framesArg, out, scale = "0.3333333333333333", cols = "3"] = process.argv.slice(2);
const frames = framesArg.split(",").map(Number);
const serveUrl = await bundle({ entryPoint: path.resolve("src/index.ts") });
const exe = "/opt/pw-browsers/chromium_headless_shell-1194/chrome-linux/headless_shell";
const opts = {
  serveUrl, id, inputProps: { id: id.replace(/-/g, "_") },
  chromiumOptions: { gl: "angle" },
  ...(fs.existsSync(exe) ? { browserExecutable: exe } : {}),
  onBrowserLog: (l) => { if (l.type === "error") console.log("[browser]", l.text); },
};
const composition = await selectComposition(opts);
const tmp = fs.mkdtempSync("/tmp/sheet-");
const files = [];
for (const f of frames) {
  const o = path.join(tmp, `f${String(f).padStart(4, "0")}.png`);
  const t0 = Date.now();
  await renderStill({ ...opts, composition, frame: f, output: o, scale: Number(scale), imageFormat: "png" });
  console.log("frame", f, Date.now() - t0, "ms");
  files.push(o);
}
if (files.length === 1) fs.copyFileSync(files[0], out);
else {
  const c = Number(cols);
  const rows = Math.ceil(files.length / c);
  const args = ["-v", "error", "-y"];
  files.forEach((f) => args.push("-i", f));
  const lbl = files.map((_, i) => `[${i}:v]drawtext=text='${frames[i]}':x=10:y=10:fontsize=28:fontcolor=white:box=1:boxcolor=black@0.6[v${i}]`).join(";");
  args.push("-filter_complex", `${lbl};${files.map((_, i) => `[v${i}]`).join("")}xstack=inputs=${files.length}:layout=${files.map((_, i) => `${(i % c) === 0 ? "0" : Array.from({length: i % c}, () => "w0").join("+")}_${Math.floor(i / c) === 0 ? "0" : Array.from({length: Math.floor(i / c)}, () => "h0").join("+")}`).join("|")}:fill=black[o]`, "-map", "[o]", out);
  if (files.length === 1) {}
  execFileSync("ffmpeg", args);
}
console.log("wrote", out);
