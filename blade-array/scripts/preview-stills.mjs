/** One 1080p PNG still per composition, at the frame stored in its data row. */
import { bundle } from "@remotion/bundler";
import { renderStill, selectComposition } from "@remotion/renderer";
import { existsSync, mkdirSync, readFileSync } from "node:fs";
import path from "node:path";
import { ALL } from "./ids.mjs";

const shell = "/opt/pw-browsers/chromium_headless_shell-1194/chrome-linux/headless_shell";
const browserExecutable = existsSync(shell) ? shell : null;
const chromiumOptions = { gl: "swangle" };

const src = readFileSync(new URL("../src/compositions.ts", import.meta.url), "utf8");
const stillFrames = Object.fromEntries(
  [...src.matchAll(/id: "([^"]+)",\s*\n\s*outName: "[^"]+",\s*\n\s*stillFrame: (\d+)/g)]
    .map(([, id, f]) => [id, Number(f)]),
);

const outDir = path.resolve("out");
mkdirSync(outDir, { recursive: true });
const serveUrl = await bundle({ entryPoint: path.resolve("src/index.ts") });
for (const row of ALL) {
  const composition = await selectComposition({
    serveUrl, id: row.id, inputProps: {}, browserExecutable, chromiumOptions,
  });
  const frame = stillFrames[row.id] ?? 0;
  const output = path.join(outDir, `${row.outName}.png`);
  await renderStill({ composition, serveUrl, output, frame, scale: 0.5, imageFormat: "png",
    browserExecutable, chromiumOptions, overwrite: true, timeoutInMilliseconds: 300000 });
  console.log(`${output}  frame ${frame}`);
}
process.exit(0);
