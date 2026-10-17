// Resumable PNG-sequence render: node scripts/render-seq.mjs <compId> <outDir> [scale]
// Renders only frames whose PNG is missing, in contiguous runs, so a restart
// loses nothing. Remotion zero-pads frame numbers to 3 digits here (f000.png).
import { renderFrames, selectComposition, openBrowser } from "@remotion/renderer";
import path from "node:path";
import fs from "node:fs";

const [id, outDir, scaleArg = "0.3333333333333333"] = process.argv.slice(2);
const serveUrl = path.resolve(process.env.SERVE || "build");
const shell = "/opt/pw-browsers/chromium_headless_shell-1194/chrome-linux/headless_shell";
fs.mkdirSync(outDir, { recursive: true });
const browser = await openBrowser("chrome", {
  browserExecutable: fs.existsSync(shell) ? shell : null,
  chromiumOptions: { gl: "angle" },
});
const composition = await selectComposition({ serveUrl, id, inputProps: {}, puppeteerInstance: browser });
const N = composition.durationInFrames;
const pad = (f) => String(f).padStart(String(N - 1).length, "0");
// Recover frames from an interrupted run; the newest few may be truncated.
const tmpDir = outDir + ".partial";
if (fs.existsSync(tmpDir)) {
  const files = fs.readdirSync(tmpDir).map((f) => ({ f, t: fs.statSync(path.join(tmpDir, f)).mtimeMs }));
  files.sort((x, y) => x.t - y.t);
  files.slice(0, Math.max(0, files.length - 6)).forEach(({ f }) => fs.renameSync(path.join(tmpDir, f), path.join(outDir, f)));
}
const missing = [];
for (let f = 0; f < N; f++) if (!fs.existsSync(path.join(outDir, `f${pad(f)}.png`))) missing.push(f);
const runs = [];
for (const f of missing) {
  const last = runs[runs.length - 1];
  if (last && last[1] === f - 1) last[1] = f;
  else runs.push([f, f]);
}
console.log(`${id}: ${missing.length}/${N} frames to render in ${runs.length} run(s)`);
const tmp = outDir + ".partial";
for (const [a, b] of runs) {
  fs.rmSync(tmp, { recursive: true, force: true });
  fs.mkdirSync(tmp, { recursive: true });
  await renderFrames({
    composition, serveUrl, inputProps: {}, puppeteerInstance: browser,
    outputDir: tmp, imageFormat: "png", scale: Number(scaleArg),
    frameRange: [a, b], concurrency: Number(process.env.CONC || 2),
    chromiumOptions: { gl: "angle" }, timeoutInMilliseconds: 240000,
    imageSequencePattern: "f[frame].[ext]",
    onStart: () => {},
    // Move each finished frame out of the scratch dir straight away.
    onFrameUpdate: (_n, frame) => {
      const src = path.join(tmp, `f${pad(frame)}.png`);
      if (fs.existsSync(src)) fs.renameSync(src, path.join(outDir, `f${pad(frame)}.png`));
    },
  });
  for (const f of fs.readdirSync(tmp)) fs.renameSync(path.join(tmp, f), path.join(outDir, f));
}
fs.rmSync(tmp, { recursive: true, force: true });
await browser.close({ silent: true });
console.log(`${id}: complete`);
