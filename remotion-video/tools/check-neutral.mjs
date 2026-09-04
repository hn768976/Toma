/**
 * Verifies that a rendered still is genuinely neutral — no residual tint.
 * Usage: node tools/check-neutral.mjs out/V3_FoggyForestMono.png [more.png ...]
 */
import { existsSync } from "node:fs";
import { resolve } from "node:path";
import { openBrowser, stashPixels } from "./cdp.mjs";

const files = process.argv.slice(2).map((f) => resolve(f));
if (!files.length) throw new Error("usage: check-neutral.mjs <png>...");
for (const f of files) if (!existsSync(f)) throw new Error(`missing ${f}`);

const { evaluate, close } = await openBrowser(9341);

let failed = false;
for (const file of files) {
  await evaluate(stashPixels("img", file));
  const v = JSON.parse(
    await evaluate(`(() => {
      const { d, w, h } = window.__px.img;
      let maxDev = 0, sumDev = 0, n = 0, sumR = 0, sumG = 0, sumB = 0;
      for (let i = 0; i < d.length; i += 4) {
        const r = d[i], g = d[i + 1], b = d[i + 2];
        const dev = Math.max(r, g, b) - Math.min(r, g, b);
        if (dev > maxDev) maxDev = dev;
        sumDev += dev; sumR += r; sumG += g; sumB += b; n++;
      }
      return JSON.stringify({ w, h, maxDev, meanDev: sumDev / n,
        meanR: sumR / n, meanG: sumG / n, meanB: sumB / n });
    })()`),
  );

  // A neutral frame needs both: no pixel with a meaningful channel spread, and
  // no overall bias in any one channel.
  const bias = Math.max(v.meanR, v.meanG, v.meanB) - Math.min(v.meanR, v.meanG, v.meanB);
  const ok = v.maxDev <= 2 && bias <= 0.5;
  if (!ok) failed = true;
  console.log(
    `${ok ? "PASS" : "FAIL"}  ${file.split("/").pop()}  ${v.w}x${v.h}  ` +
      `max channel spread=${v.maxDev}  mean=${v.meanDev.toFixed(3)}  ` +
      `channel bias=${bias.toFixed(3)}  ` +
      `meanRGB=${v.meanR.toFixed(2)}/${v.meanG.toFixed(2)}/${v.meanB.toFixed(2)}`,
  );
}

close();
process.exit(failed ? 1 : 0);
