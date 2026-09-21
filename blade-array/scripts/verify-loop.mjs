/**
 * Step 2 (loop closure) and step 3 (determinism).
 *
 * Loop closure: a 600-frame seamless loop means frame 600 equals frame 0, not
 * frame 599. Everything periodic in this project runs off `frame % 600`, which
 * is independent of durationInFrames, so the composition can simply be asked
 * for frame 600 and the two PNGs compared.
 *
 * Determinism: frame 300 rendered on its own from a cold start must be
 * byte-identical to frame 300 out of a sequential run.
 */
import { bundle } from "@remotion/bundler";
import { renderFrames, renderStill, selectComposition } from "@remotion/renderer";
import { createHash } from "node:crypto";
import { existsSync, mkdirSync, readFileSync, rmSync } from "node:fs";
import path from "node:path";
import { ALL } from "./ids.mjs";

const shell = "/opt/pw-browsers/chromium_headless_shell-1194/chrome-linux/headless_shell";
const browserExecutable = existsSync(shell) ? shell : null;
const chromiumOptions = { gl: "swangle" };
const scale = Number(process.env.SCALE ?? 0.5);

const ids = process.argv.slice(2);
const list = ids.length ? ids : ALL.map((c) => c.id);
const dir = path.resolve("out/verify");
rmSync(dir, { recursive: true, force: true });
mkdirSync(dir, { recursive: true });

const serveUrl = await bundle({ entryPoint: path.resolve("src/index.ts") });
const sha = (f) => createHash("sha256").update(readFileSync(f)).digest("hex").slice(0, 16);

let failures = 0;
for (const id of list) {
  const composition = await selectComposition({ serveUrl, id, inputProps: {}, browserExecutable, chromiumOptions });
  composition.durationInFrames = 601; // ask for the frame one past the loop

  const f0 = path.join(dir, `${id}_f0.png`);
  const f600 = path.join(dir, `${id}_f600.png`);
  for (const [frame, output] of [[0, f0], [600, f600]]) {
    await renderStill({ composition, serveUrl, output, frame, scale, imageFormat: "png",
      browserExecutable, chromiumOptions, overwrite: true, timeoutInMilliseconds: 300000 });
  }
  const loopOk = sha(f0) === sha(f600);

  // Frame 300 alone, cold, vs frame 300 from a sequential run of 298..302.
  const alone = path.join(dir, `${id}_f300_alone.png`);
  await renderStill({ composition, serveUrl, output: alone, frame: 300, scale, imageFormat: "png",
    browserExecutable, chromiumOptions, overwrite: true, timeoutInMilliseconds: 300000 });
  const seqDir = path.join(dir, `${id}_seq`);
  mkdirSync(seqDir, { recursive: true });
  await renderFrames({ composition, serveUrl, outputDir: seqDir, imageFormat: "png", scale,
    frameRange: [298, 302], onFrameUpdate: () => {}, onStart: () => {},
    browserExecutable, chromiumOptions, concurrency: 4, timeoutInMilliseconds: 300000 });
  const seq300 = path.join(seqDir, "element-300.png");
  const detOk = existsSync(seq300) && sha(alone) === sha(seq300);

  if (!loopOk || !detOk) failures++;
  console.log(`${id.padEnd(24)} loop(f0==f600): ${loopOk ? "PASS" : "FAIL"}   determinism(f300): ${detOk ? "PASS" : "FAIL"}`);
}
console.log(failures === 0 ? "\nAll loop and determinism checks passed." : `\n${failures} composition(s) failed.`);
process.exit(failures === 0 ? 0 : 1);
