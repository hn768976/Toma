// Times one 4K (3840×2160) frame of the given clips: bundle and browser reused,
// one warm-up render, then the median of three.
import { join } from "node:path";
import { IDS, root, setup, still } from "./render-lib.mjs";

const names = process.argv.slice(2).length ? process.argv.slice(2) : ["OverbalancedWheel", "WaterScrewMill"];
const ctx = await setup();
for (const name of names) {
  const out = join(root, "renders", `.time-${name}.png`);
  await still(ctx, IDS[name], 300, out, { scale: 1 });
  const t = [];
  for (let i = 0; i < 3; i++) t.push(await still(ctx, IDS[name], 300 + i, out, { scale: 1 }));
  t.sort((a, b) => a - b);
  console.log(`${name}: one 4K frame ${(t[1] / 1000).toFixed(2)} s (runs ${t.map((x) => (x / 1000).toFixed(2)).join(", ")})`);
}
await ctx.browser.close({ silent: true });
