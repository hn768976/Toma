/**
 * Render a list of single frames with one bundle and one browser.
 * Used for look-dev contact sheets and for the verification loop
 * (frame 0 vs 600, cold-start frame 300).
 *
 *   npx tsx scripts/stills.ts --comp=CardRain-Gold --frames=0,120,240 --scale=0.5 --out=out/dev
 *   options: --props='{"loopCheck":true}'  --cold (fresh browser per frame)
 */
import { bundle } from "@remotion/bundler";
import { openBrowser, renderStill, selectComposition } from "@remotion/renderer";
import { existsSync, mkdirSync } from "node:fs";
import path from "node:path";

const arg = (name: string, fallback?: string) => {
  const hit = process.argv.find((a) => a.startsWith(`--${name}=`));
  return hit ? hit.slice(name.length + 3) : fallback;
};
const flag = (name: string) => process.argv.includes(`--${name}`);

const comp = arg("comp", "CardRain-Gold")!;
const frames = arg("frames", "0")!.split(",").map(Number);
const scale = Number(arg("scale", "0.5"));
const out = path.resolve(arg("out", "out/stills")!);
const inputProps = JSON.parse(arg("props", "{}")!);
const prefix = arg("prefix", comp)!;
const cold = flag("cold");

const headless = "/opt/pw-browsers/chromium_headless_shell-1194/chrome-linux/headless_shell";
const browserExecutable = existsSync(headless) ? headless : null;
const chromiumOptions = { gl: "angle" as const };

const main = async () => {
  mkdirSync(out, { recursive: true });
  const t0 = Date.now();
  const serveUrl = await bundle({ entryPoint: path.resolve("src/index.ts") });
  console.log(`bundled in ${((Date.now() - t0) / 1000).toFixed(1)}s`);

  let browser = cold ? null : await openBrowser("chrome", { browserExecutable, chromiumOptions });
  const composition = await selectComposition({
    serveUrl,
    id: comp,
    inputProps: { ...inputProps },
    browserExecutable,
    chromiumOptions,
    puppeteerInstance: browser ?? undefined,
  });
  for (const frame of frames) {
    if (cold) browser = await openBrowser("chrome", { browserExecutable, chromiumOptions });
    const file = path.join(out, `${prefix}_f${String(frame).padStart(3, "0")}.png`);
    const t = Date.now();
    await renderStill({
      serveUrl,
      composition,
      frame,
      output: file,
      scale,
      imageFormat: "png",
      inputProps: { ...inputProps },
      browserExecutable,
      chromiumOptions,
      puppeteerInstance: browser!,
      overwrite: true,
    });
    console.log(`frame ${frame} -> ${file} (${((Date.now() - t) / 1000).toFixed(1)}s)`);
    if (cold) {
      await browser!.close({ silent: true });
      browser = null;
    }
  }
  if (browser) await browser.close({ silent: true });
};

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
