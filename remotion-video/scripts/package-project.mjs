#!/usr/bin/env node
/**
 * Packages the Remotion project as a zip that someone else can unzip,
 * `npm install`, and render from -- including the 4K compositions.
 *
 *   node scripts/package-project.mjs [outputPath]
 *
 * Excludes node_modules, rendered output and caches: everything in the zip is
 * source. package-lock.json is kept so the install reproduces these versions.
 */
import { spawnSync } from "node:child_process";
import { mkdirSync, rmSync, statSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");

const output = resolve(
  process.argv[2] ?? join(root, "out", "remotion-gradients-project.zip"),
);
mkdirSync(dirname(output), { recursive: true });
rmSync(output, { force: true });

const EXCLUDES = [
  "node_modules/*",
  "out/*",
  ".git/*",
  ".remotion/*",
  "**/.DS_Store",
  "**/.cache/*",
];

// Zip the project directory itself so the archive unpacks into a folder
// rather than spraying files into the current directory.
const result = spawnSync(
  "zip",
  ["-r", "-q", output, "remotion-video", "-x", ...EXCLUDES.map((e) => `remotion-video/${e}`)],
  { cwd: dirname(root), stdio: "inherit" },
);

if (result.status !== 0) {
  console.error("zip failed");
  process.exit(result.status ?? 1);
}

const mb = (statSync(output).size / (1024 * 1024)).toFixed(2);
console.log(`Wrote ${output} (${mb} MB)`);
