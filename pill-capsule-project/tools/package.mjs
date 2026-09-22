// Builds pill-capsule-project.zip: source only, no node_modules, no .git, no
// render output. Verifies afterwards that the archive holds what it should.
import { execFileSync } from "node:child_process";
import { existsSync, rmSync } from "node:fs";

const ZIP = "pill-capsule-project.zip";
if (existsSync(ZIP)) rmSync(ZIP);

const INCLUDE = [
  "src", "tools", "package.json", "package-lock.json",
  "remotion.config.ts", "tsconfig.json", "eslint.config.mjs", ".prettierrc",
  ".gitignore", "README.md",
];

execFileSync(
  "zip",
  ["-r", "-q", ZIP, ...INCLUDE, "-x", "*/node_modules/*", "*/.git/*", "out/*"],
  { stdio: "inherit" },
);

const listing = execFileSync("unzip", ["-l", ZIP]).toString();
const missing = INCLUDE.filter((p) => !listing.includes(p.replace(/^\.\//, "")));
if (missing.length) {
  console.error(`Missing from the archive: ${missing.join(", ")}`);
  process.exit(1);
}
for (const forbidden of ["node_modules/", ".git/", "out/"]) {
  if (listing.includes(forbidden)) {
    console.error(`Archive contains ${forbidden}, which it must not.`);
    process.exit(1);
  }
}
console.log(listing.trim().split("\n").slice(-1)[0]);
console.log(`${ZIP} written.`);
