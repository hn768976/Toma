// Dev/QC helper: render a handful of frames of a composition as JPEG stills.
//   node scripts/stills.mjs <compositionId> <outDir> <scale> <frame,frame,...>
import { bundle } from "@remotion/bundler";
import { openBrowser, renderStill, selectComposition } from "@remotion/renderer";
import { existsSync, mkdirSync, readdirSync } from "node:fs";
import path from "node:path";

const [id, outDir, scale = "0.25", frames = "0,60,120,180,240,300"] = process.argv.slice(2);
mkdirSync(outDir, { recursive: true });
let browserExecutable;
let gl = process.env.REMOTION_GL ?? "angle";
const pw = "/opt/pw-browsers";
if (existsSync(pw)) {
  const dir = readdirSync(pw).find((d) => d.startsWith("chromium_headless_shell-"));
  const exe = dir ? `${pw}/${dir}/chrome-headless-shell-linux64/chrome-headless-shell` : null;
  if (exe && existsSync(exe)) {
    browserExecutable = exe;
    if (!process.env.REMOTION_GL) gl = "swangle";
  }
}
const serveUrl = await bundle({ entryPoint: path.resolve("src/index.ts") });
const chromiumOptions = { gl };
const browser = await openBrowser("chrome", { browserExecutable, chromiumOptions });
const composition = await selectComposition({ serveUrl, id, puppeteerInstance: browser, browserExecutable, chromiumOptions });
for (const f of frames.split(",").map(Number)) {
  const output = path.join(outDir, `${id}-${String(f).padStart(4, "0")}.jpg`);
  await renderStill({ composition, serveUrl, output, frame: f, scale: Number(scale), imageFormat: "jpeg", jpegQuality: 92, puppeteerInstance: browser, browserExecutable, chromiumOptions });
  console.log("wrote", output);
}
await browser.close({ silent: true });
