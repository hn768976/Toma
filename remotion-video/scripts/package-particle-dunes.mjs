// Assembles the standalone Particle Dunes Remotion project and zips it.
//
// The clip lives in this repo's shared Remotion project, but the deliverable
// is a project that renders on its own machine at 4K. Rather than keeping a
// second copy of the source, this script pairs src/particle-dunes with the
// standalone-only scaffolding in packaging/particle-dunes.
//
//   node scripts/package-particle-dunes.mjs
//
// Writes deliverables/particle-dunes-project.zip. node_modules, .git and any
// render output are never copied in.

import { execFileSync } from "node:child_process";
import { cpSync, mkdirSync, rmSync, copyFileSync, existsSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const scaffold = join(root, "packaging", "particle-dunes");
const staging = join(root, "deliverables", ".particle-dunes-staging");
const projectDir = join(staging, "particle-dunes-project");
const zipPath = join(root, "deliverables", "particle-dunes-project.zip");

rmSync(staging, { recursive: true, force: true });
mkdirSync(join(projectDir, "src"), { recursive: true });

// The clip itself, verbatim from the shared project.
cpSync(join(root, "src", "particle-dunes"), join(projectDir, "src", "particle-dunes"), {
  recursive: true,
});

// Entry points live at src/ in the standalone layout.
for (const f of ["index.ts", "Root.tsx"]) {
  copyFileSync(join(scaffold, f), join(projectDir, "src", f));
}
for (const f of ["package.json", "remotion.config.ts", "tsconfig.json", "eslint.config.mjs"]) {
  copyFileSync(join(scaffold, f), join(projectDir, f));
}
// Stored unprefixed so it does not shadow this repo's own ignore rules.
copyFileSync(join(scaffold, "gitignore"), join(projectDir, ".gitignore"));
copyFileSync(join(root, "src", "particle-dunes", "README.md"), join(projectDir, "README.md"));
// The README belongs at the project root only.
rmSync(join(projectDir, "src", "particle-dunes", "README.md"));

rmSync(zipPath, { force: true });
execFileSync("zip", ["-r", "-q", zipPath, "particle-dunes-project"], { cwd: staging });
rmSync(staging, { recursive: true, force: true });

if (!existsSync(zipPath)) throw new Error("zip was not produced");
console.log(`wrote ${zipPath}`);
