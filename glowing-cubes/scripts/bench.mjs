// Per-frame render time at 1080p (scale 0.5), one tab, first frame excluded.
//   node scripts/bench.mjs <CompositionId> <fromFrame> <toFrame> [perfFlags]
// perfFlags (debug, comma-separated) switch parts off to measure their cost:
//   nodof, nobloom, nosmaa, norefl
import { existsSync } from "node:fs";
import { bundle } from "@remotion/bundler";
import { renderMedia, selectComposition } from "@remotion/renderer";

const [id, from, to, perf = ""] = process.argv.slice(2);
const serveUrl = await bundle({ entryPoint: new URL("../src/index.ts", import.meta.url).pathname });
const pw = "/opt/pw-browsers/chromium_headless_shell-1194/chrome-linux/headless_shell";
const browserExecutable = existsSync(pw) ? pw : null;
const inputProps = { perf };
const chromiumOptions = { gl: "angle" };
const comp = await selectComposition({ serveUrl, id, inputProps, browserExecutable, chromiumOptions });
let first = 0;
let last = 0;
await renderMedia({
  serveUrl, composition: comp, inputProps, codec: "h264", outputLocation: "out/bench/bench.mp4",
  frameRange: [Number(from), Number(to)], scale: 0.5, concurrency: 1, imageFormat: "png",
  browserExecutable, chromiumOptions,
  onProgress: ({ renderedFrames }) => {
    if (renderedFrames === 1 && !first) first = Date.now();
    last = Date.now();
  },
});
console.log(`${id} perf=[${perf}] ${((last - first) / (Number(to) - Number(from)) / 1000).toFixed(2)} s/frame`);
