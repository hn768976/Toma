/**
 * Packages the project for handoff: everything needed to open it and render,
 * with nothing that should be reinstalled or re-rendered.
 *
 *   node scripts/make-project-zip.mjs [--out=path/to/file.zip]
 */

import { execFileSync } from "node:child_process";
import { mkdirSync, rmSync, existsSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

const INCLUDE = [
  "src",
  "public",
  "scripts",
  "package.json",
  "package-lock.json",
  "tsconfig.json",
  "remotion.config.ts",
  "eslint.config.mjs",
  ".prettierrc",
  ".gitignore",
  "README.md",
];

const arg = process.argv.find((a) => a.startsWith("--out="));
const outFile = path.resolve(ROOT, arg ? arg.slice(6) : "dist/dental-3d-remotion-project.zip");

mkdirSync(path.dirname(outFile), { recursive: true });
if (existsSync(outFile)) {
  rmSync(outFile);
}

const missing = INCLUDE.filter((entry) => !existsSync(path.join(ROOT, entry)));
if (missing.length > 0) {
  throw new Error(`Missing from the project: ${missing.join(", ")}`);
}

execFileSync(
  "zip",
  ["-r", "-q", "-X", outFile, ...INCLUDE, "-x", "node_modules/*", "out/*", "dist/*"],
  { cwd: ROOT, stdio: "inherit" },
);

const { size } = await import("node:fs").then((fs) => fs.statSync(outFile));
console.log(`${path.relative(ROOT, outFile)}  ${(size / 1e6).toFixed(1)} MB`);
