// Builds the two deliverable zips in out/:
//   watercolour-stills.zip          the 35 PNGs
//   watercolour-stills-project.zip  source, package.json, lockfile, README
//                                   (no node_modules, .git or render output)
import { execFileSync } from "node:child_process";
import { readdirSync, rmSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const out = path.join(root, "out");
const stills = path.join(out, "stills");

const pngs = readdirSync(stills).filter((f) => /^WC_\d\d_.*\.png$/.test(f)).sort();
if (pngs.length !== 35) throw new Error(`expected 35 stills, found ${pngs.length}`);

const zip = (file, cwd, entries) => {
  rmSync(file, { force: true });
  // PNGs are already compressed; -0 stores them as they are
  execFileSync("zip", ["-q", "-X", ...(file.endsWith("stills.zip") ? ["-0"] : ["-r"]), file, ...entries], { cwd, stdio: "inherit" });
  console.log(path.relative(root, file));
};

zip(path.join(out, "watercolour-stills.zip"), stills, pngs);
zip(path.join(out, "watercolour-stills-project.zip"), root, [
  "README.md",
  "package.json",
  "package-lock.json",
  "tsconfig.json",
  "remotion.config.ts",
  ".gitignore",
  "src",
  "scripts",
]);
