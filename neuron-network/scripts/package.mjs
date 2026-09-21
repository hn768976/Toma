/**
 * Build the delivery zip: the Remotion project, ready to render at 4K
 * elsewhere. Excludes node_modules, .git and render output.
 */
import { execFileSync } from "node:child_process";
import { existsSync, rmSync } from "node:fs";
import path from "node:path";

const out = path.resolve(process.argv[2] ?? "../neuron-network-project.zip");
if (existsSync(out)) rmSync(out);

const include = [
  "src",
  "scripts",
  "package.json",
  "package-lock.json",
  "tsconfig.json",
  "remotion.config.ts",
  "README.md",
  ".gitignore",
].filter((p) => existsSync(p));

execFileSync(
  "zip",
  ["-r", "-q", out, ...include, "-x", "*/node_modules/*", "*/out/*", "*.log"],
  { stdio: "inherit" },
);

const size = execFileSync("du", ["-h", out]).toString().split("\t")[0];
console.log(`${out}  ${size}`);
console.log(include.join("\n"));
