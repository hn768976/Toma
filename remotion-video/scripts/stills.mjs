// Render several stills from one bundle (faster than repeated `remotion still`).
// usage: node scripts/stills.mjs <outDir> <scale> <Comp:frame[:props-json]> ...
import { bundle } from "@remotion/bundler";
import { renderStill, selectComposition, openBrowser } from "@remotion/renderer";
import { existsSync, mkdirSync } from "node:fs";
import path from "node:path";

const [outDir, scaleArg, ...jobs] = process.argv.slice(2);
mkdirSync(outDir, { recursive: true });
const shell = "/opt/pw-browsers/chromium_headless_shell-1194/chrome-linux/headless_shell";
const browserExecutable = existsSync(shell) ? shell : null;
const serveUrl = process.env.SERVE_URL ?? (await bundle({ entryPoint: path.resolve("src/index.ts"), enableCaching: true }));
const browser = await openBrowser("chrome", { browserExecutable, chromiumOptions: { gl: "angle" } });
for (const job of jobs) {
  const [id, frameS, ...rest] = job.split(":");
  const inputProps = rest.length ? JSON.parse(rest.join(":")) : {};
  const composition = await selectComposition({ serveUrl, id, inputProps, puppeteerInstance: browser, chromiumOptions: { gl: "angle" }, browserExecutable });
  const frame = Number(frameS);
  const output = path.join(outDir, `${id}-${frame}${rest.length ? "-" + Object.values(inputProps).join("_") : ""}.png`);
  const t = Date.now();
  await renderStill({ serveUrl, composition, frame, output, inputProps, scale: Number(scaleArg), puppeteerInstance: browser, chromiumOptions: { gl: "angle" }, browserExecutable, imageFormat: "png", onBrowserLog: (l) => { if (!/Clock/.test(l.text)) console.log("[browser]", l.type, l.text.slice(0, 600)); } });
  console.log(`${output}  ${Date.now() - t} ms`);
}
await browser.close({ silent: true });
