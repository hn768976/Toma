// Renders a strip of frames per machine for review: node scripts/contact.mjs <scale> <frames,...> [names...]
import { mkdirSync } from "node:fs";
import { join } from "node:path";
import { IDS, root, setup, still } from "./render-lib.mjs";

const scale = Number(process.argv[2] ?? 1 / 6);
const frames = (process.argv[3] ?? "0,75,150,225,300,375,450,525").split(",").map(Number);
const names = process.argv.slice(4).length ? process.argv.slice(4) : Object.keys(IDS);
const ctx = await setup();
const dir = join(root, "out", process.env.OUT ?? "contact");
mkdirSync(dir, { recursive: true });
for (const name of names) {
  for (const f of frames) {
    const ms = await still(ctx, IDS[name], f, join(dir, `${name}-${String(f).padStart(3, "0")}.png`), { scale, props: { look: process.env.LOOK ?? "workshop" } });
    process.stdout.write(`${name} ${f} ${ms.toFixed(0)}ms\n`);
  }
}
await ctx.browser.close({ silent: true });
