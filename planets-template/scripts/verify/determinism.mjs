#!/usr/bin/env node
// Step 3: render a still from a cold start (fresh bundle + fresh browser)
// and compare it byte for byte with another render.
//   --mode=twice  --comps=A,B   : render each hero still twice, cold, compare
//   --mode=vs-seq --comp=A --seq=dir --frame=300 : cold still vs frame from
//                                  a full (multi-threaded) sequence render
import fs from "node:fs";
import path from "node:path";
import { selectComposition, renderStill } from "@remotion/renderer";
import { args, browserExecutable, chromiumOptions, freshBrowser, makeBundle, samePixels } from "./common.mjs";

const out = args.out ?? "out/verify/determinism";
const scale = Number(args.scale ?? 1 / 3);
fs.mkdirSync(out, { recursive: true });

async function coldStill(id, frame, file) {
  const serveUrl = await makeBundle();
  const browser = await freshBrowser();
  const composition = await selectComposition({ serveUrl, id, puppeteerInstance: browser, browserExecutable, chromiumOptions });
  await renderStill({ composition, serveUrl, output: file, frame, scale, imageFormat: "png", puppeteerInstance: browser,
    browserExecutable, chromiumOptions, overwrite: true, timeoutInMilliseconds: 300000 });
  await browser.close({ silent: true });
  return file;
}

let fail = 0;
if ((args.mode ?? "twice") === "twice") {
  for (const id of args.comps.split(",")) {
    const frame = id.endsWith("-Spin") ? 300 : 400;
    const a = await coldStill(id, frame, path.join(out, `${id}_f${frame}_a.png`));
    const b = await coldStill(id, frame, path.join(out, `${id}_f${frame}_b.png`));
    const r = await samePixels(a, b);
    const bytes = fs.readFileSync(a).equals(fs.readFileSync(b));
    console.log(`${r.equal && bytes ? "PASS" : "FAIL"} ${id} frame ${frame}: pixels ${r.equal ? "identical" : `${r.diff} differ`}, PNG bytes ${bytes ? "identical" : "differ"}`);
    if (!r.equal) fail++;
  }
} else {
  const frame = Number(args.frame ?? 300);
  const cold = await coldStill(args.comp, frame, path.join(out, `${args.comp}_f${frame}_cold.png`));
  const seqFile = fs.readdirSync(args.seq).filter((f) => f.endsWith(".png")).sort()[frame];
  const r = await samePixels(cold, path.join(args.seq, seqFile));
  console.log(`${r.equal ? "PASS" : "FAIL"} ${args.comp} frame ${frame}: cold still vs full-render frame (${seqFile}): ${r.equal ? "identical" : `${r.diff} values differ (max ${r.maxd})`}`);
  if (!r.equal) fail++;
}
process.exit(fail ? 1 : 0);
