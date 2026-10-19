// Renders one frame of any composition to PNG and prints browser logs.
//   GL=swangle node scripts/frame.mjs <id> <frame> <out.png> [scale]
import { getCompositions, renderStill } from "@remotion/renderer";
import { browserExecutable, chromiumOptions, makeBundle } from "./common.mjs";
const id = process.argv[2]; const frame = Number(process.argv[3] ?? 0); const out = process.argv[4];
const scale = Number(process.argv[5] ?? 1/3);
const serveUrl = await makeBundle();
const comps = await getCompositions(serveUrl, { browserExecutable, chromiumOptions });
const composition = comps.find((c) => c.id === id);
const t0 = Date.now();
await renderStill({ composition, serveUrl, output: out, frame, scale, browserExecutable, chromiumOptions, timeoutInMilliseconds: 900000,
  onBrowserLog: (l) => console.log("LOG", l.text.slice(0, 300)) });
console.log("ms", Date.now() - t0);
