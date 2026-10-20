// npm run art [-- <machine ...>]: build the raw anatomy SVGs, then split them into parts.
import { execFileSync } from "node:child_process";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const here = dirname(fileURLToPath(import.meta.url));
const args = process.argv.slice(2);
for (const script of ["build-art.mjs", "split-parts.mjs"]) execFileSync(process.execPath, ["--disable-warning=ExperimentalWarning", join(here, script), ...args], { stdio: "inherit" });
