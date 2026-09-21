/**
 * Step 2 (loop closure) and step 3 (determinism).
 *
 * Loop closure: a 600-frame seamless loop means frame 600 equals frame 0,
 * not frame 599. The composition is temporarily extended to 601 frames so
 * frame 600 can be rendered at all, and the two PNGs must be identical.
 *
 * Determinism: frame 300 rendered alone from a cold start must be
 * byte-identical to frame 300 rendered as part of a sequence.
 */
import { bundle } from "@remotion/bundler";
import { getCompositions, renderFrames, renderStill } from "@remotion/renderer";
import { createHash } from "node:crypto";
import { existsSync, mkdirSync, readFileSync, readdirSync, rmSync } from "node:fs";
import path from "node:path";

const args = process.argv.slice(2);
const ids = args.filter((a) => !a.startsWith("--"));
const flag = (n, d) => (args.find((a) => a.startsWith(`--${n}=`)) ?? `--${n}=${d}`).split("=")[1];
const scale = Number(flag("scale", "0.25"));
const outDir = flag("out", "out/verify");

const shell = "/opt/pw-browsers/chromium_headless_shell-1194/chrome-linux/headless_shell";
const browserExecutable = existsSync(shell) ? shell : null;
const common = { browserExecutable, chromiumOptions: { gl: "angle" }, timeoutInMilliseconds: 300000 };

rmSync(outDir, { recursive: true, force: true });
mkdirSync(outDir, { recursive: true });

const serveUrl = await bundle({ entryPoint: path.resolve("src/index.ts"), onProgress: () => {} });
const comps = await getCompositions(serveUrl, { browserExecutable });
const targets = comps.filter((c) => ids.length === 0 || ids.includes(c.id));

const sha = (f) => createHash("sha256").update(readFileSync(f)).digest("hex").slice(0, 16);

const results = [];
for (const comp of targets) {
  // --- loop closure -------------------------------------------------------
  const extended = { ...comp, durationInFrames: comp.durationInFrames + 1 };
  const f0 = path.join(outDir, `${comp.id}_loop_0.png`);
  const fN = path.join(outDir, `${comp.id}_loop_${comp.durationInFrames}.png`);
  await renderStill({ composition: extended, serveUrl, output: f0, frame: 0, scale, overwrite: true, ...common });
  await renderStill({
    composition: extended, serveUrl, output: fN,
    frame: comp.durationInFrames, scale, overwrite: true, ...common,
  });
  const loopOk = sha(f0) === sha(fN);

  // --- determinism --------------------------------------------------------
  const seqDir = path.join(outDir, `${comp.id}_seq`);
  mkdirSync(seqDir, { recursive: true });
  await renderFrames({
    composition: comp, serveUrl, imageFormat: "png", outputDir: seqDir,
    frameRange: [298, 301], scale, concurrency: 1,
    onStart: () => {}, onFrameUpdate: () => {}, ...common,
  });
  const alone = path.join(outDir, `${comp.id}_alone_300.png`);
  await renderStill({ composition: comp, serveUrl, output: alone, frame: 300, scale, overwrite: true, ...common });
  const seqFile = readdirSync(seqDir).find((f) => /0*300\.png$/.test(f));
  const detOk = Boolean(seqFile) && sha(path.join(seqDir, seqFile)) === sha(alone);

  results.push({ id: comp.id, loopOk, detOk, hash0: sha(f0), hashN: sha(fN) });
  console.log(
    `${comp.id.padEnd(24)} loop=${loopOk ? "PASS" : "FAIL"}  determinism=${detOk ? "PASS" : "FAIL"}`,
  );
}

const failed = results.filter((r) => !r.loopOk || !r.detOk);
console.log(`\n${results.length - failed.length}/${results.length} passed both checks`);
if (failed.length) {
  console.log("failed:", failed.map((f) => f.id).join(", "));
  process.exitCode = 1;
}
