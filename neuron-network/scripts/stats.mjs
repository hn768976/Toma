/**
 * Build every look's geometry in Node and report the counts.
 *
 * Reports branch-segment counts per look and the per-frame draw calls, which
 * is the number that says whether branch merging actually happened.
 */
import { build } from "esbuild";
import { mkdirSync, rmSync } from "node:fs";
import path from "node:path";

// Build inside the project so the bundle can resolve `three` from node_modules.
const dir = path.resolve("node_modules/.neuron-stats");
mkdirSync(dir, { recursive: true });
const outfile = path.join(dir, "stats.mjs");

await build({
  entryPoints: ["scripts/stats-entry.ts"],
  bundle: true,
  format: "esm",
  platform: "node",
  outfile,
  external: ["three"],
  logLevel: "error",
});

const { run } = await import(outfile);
run();
rmSync(dir, { recursive: true, force: true });
