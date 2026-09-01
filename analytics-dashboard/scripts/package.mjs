#!/usr/bin/env node
/**
 * Builds the two delivery zips:
 *
 *   dist/analytics-flat.zip    — the 2D dashboard only
 *   dist/analytics-tilted.zip  — the 3D version PLUS the full dashboard it needs
 *
 * Both exclude node_modules/, out/ and .git/. The flat package additionally
 * drops src/three, the three.js dependencies and the GL renderer config line,
 * so it installs and renders with a plain Remotion toolchain.
 */

import { execFileSync } from "node:child_process";
import { cpSync, mkdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const scriptDir = dirname(fileURLToPath(import.meta.url));
const root = resolve(scriptDir, "..");
const build = join(root, "build");
const dist = join(root, "dist");

const THREE_DEPS = [
  "@remotion/three",
  "@react-three/fiber",
  "@react-three/postprocessing",
  "postprocessing",
  "three",
];

const copyShared = (target) => {
  mkdirSync(target, { recursive: true });
  cpSync(join(root, "src"), join(target, "src"), { recursive: true });
  cpSync(join(root, "public"), join(target, "public"), { recursive: true });
  cpSync(join(root, "tsconfig.json"), join(target, "tsconfig.json"));
  cpSync(join(root, ".gitignore"), join(target, ".gitignore"));
};

const writePackageJson = (target, { name, description, dropThree }) => {
  const pkg = JSON.parse(readFileSync(join(root, "package.json"), "utf8"));
  pkg.name = name;
  pkg.description = description;
  if (dropThree) {
    for (const dep of THREE_DEPS) delete pkg.dependencies[dep];
    delete pkg.devDependencies["@types/three"];
  }
  writeFileSync(join(target, "package.json"), `${JSON.stringify(pkg, null, 2)}\n`);
};

const zip = (name, source) => {
  const output = join(dist, name);
  rmSync(output, { force: true });
  execFileSync(
    "zip",
    ["-r", "-q", output, ".", "-x", "node_modules/*", "out/*", ".git/*", "*.zip"],
    { cwd: source, stdio: "inherit" },
  );
  return output;
};

rmSync(build, { recursive: true, force: true });
mkdirSync(dist, { recursive: true });

// ── flat ──────────────────────────────────────────────────────────────────────
const flat = join(build, "analytics-flat");
copyShared(flat);
rmSync(join(flat, "src", "three"), { recursive: true, force: true });
cpSync(join(scriptDir, "Root.flat.tsx"), join(flat, "src", "Root.tsx"));
cpSync(join(scriptDir, "remotion.config.flat.ts"), join(flat, "remotion.config.ts"));
cpSync(join(scriptDir, "README.flat.md"), join(flat, "README.md"));
writePackageJson(flat, {
  name: "analytics-dashboard-flat",
  description: "4K analytics dashboard animation — flat 2D variant",
  dropThree: true,
});

// ── tilted ────────────────────────────────────────────────────────────────────
const tilted = join(build, "analytics-tilted");
copyShared(tilted);
cpSync(join(root, "remotion.config.ts"), join(tilted, "remotion.config.ts"));
cpSync(join(scriptDir, "README.tilted.md"), join(tilted, "README.md"));
cpSync(join(root, "CAMERA-NOTES.md"), join(tilted, "CAMERA-NOTES.md"));
writePackageJson(tilted, {
  name: "analytics-dashboard-tilted",
  description: "4K analytics dashboard animation — tilted 3D variant",
  dropThree: false,
});

for (const [name, source] of [
  ["analytics-flat.zip", flat],
  ["analytics-tilted.zip", tilted],
]) {
  console.log(`${name} -> ${zip(name, source)}`);
}
