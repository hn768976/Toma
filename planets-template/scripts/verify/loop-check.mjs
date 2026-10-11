#!/usr/bin/env node
// Step 2: make every Spin composition 601 frames long (REMOTION_LOOP_CHECK),
// render frames 0 and 600 as PNG and require them to be pixel-identical.
import fs from "node:fs";
import path from "node:path";
import { getCompositions, renderStill } from "@remotion/renderer";
import { args, browserExecutable, chromiumOptions, freshBrowser, makeBundle, samePixels } from "./common.mjs";

const out = args.out ?? "out/verify/loop";
const scale = Number(args.scale ?? 1 / 3);
fs.mkdirSync(out, { recursive: true });
const envVariables = { REMOTION_LOOP_CHECK: "1" };
const serveUrl = await makeBundle();
const browser = await freshBrowser();
const comps = (await getCompositions(serveUrl, { puppeteerInstance: browser, browserExecutable, chromiumOptions, envVariables }))
  .filter((c) => c.id.endsWith("-Spin"));
let fail = 0;
for (const c of comps) {
  if (c.durationInFrames !== 601) throw new Error(`${c.id}: expected 601 frames with REMOTION_LOOP_CHECK, got ${c.durationInFrames}`);
  const files = [];
  for (const frame of [0, 600]) {
    const file = path.join(out, `${c.id}_f${frame}.png`);
    await renderStill({ composition: c, serveUrl, output: file, frame, scale, imageFormat: "png", puppeteerInstance: browser,
      browserExecutable, chromiumOptions, envVariables, overwrite: true, timeoutInMilliseconds: 300000 });
    files.push(file);
  }
  const r = await samePixels(files[0], files[1]);
  console.log(`${r.equal ? "PASS" : "FAIL"} ${c.id}: frame 0 vs 600 ${r.equal ? "identical" : `${r.diff} values differ (max ${r.maxd})`}`);
  if (!r.equal) fail++;
}
await browser.close({ silent: true });
process.exit(fail ? 1 : 0);
