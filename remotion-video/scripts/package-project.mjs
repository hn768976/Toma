/**
 * Packages the Remotion project for handover.
 *
 * Includes the generated `public/models` even though git ignores them, so the
 * archive renders straight after `npm install` with no preprocessing step.
 *
 * Excludes `node_modules`, `out`, and `public/models-src`. The raw Meshy
 * exports in models-src are only an input to `npm run models`, and the textured
 * aircraft alone is 22MB of JPEG — carrying both them and their processed
 * derivatives doubles the archive for no benefit to someone who just wants to
 * render. They are tracked in git, so `npm run models` still works in a clone.
 */
import { spawn } from "node:child_process";
import { existsSync } from "node:fs";

if (!existsSync("public/models/skyliner.glb")) {
  console.error("public/models is missing — run `npm run models` first.");
  process.exit(1);
}

const output = process.argv[2] ?? "../aviation-remotion-project.zip";

const zip = spawn(
  "zip",
  [
    "-r",
    "-q",
    output,
    ".",
    "-x",
    "node_modules/*",
    "-x",
    "out/*",
    "-x",
    "public/models-src/*",
    "-x",
    ".git/*",
    "-x",
    "*.DS_Store",
  ],
  { stdio: "inherit" },
);
zip.on("exit", (code) => {
  if (code === 0) console.log(`Wrote ${output}`);
  process.exit(code ?? 1);
});
