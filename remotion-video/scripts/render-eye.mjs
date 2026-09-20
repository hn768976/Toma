// Renders the four Cyber Eye colourways with the Remotion CLI.
//   npm run render:eye          -> out/Eye-<name>-1080p.mp4 (delivery)
//   npm run render:eye:4k       -> out/Eye-<name>-4K.mp4
// Extra CLI flags are passed straight through, e.g.
//   npm run render:eye -- --concurrency=2 --frames=0-30
import { spawnSync } from "node:child_process";

const args = process.argv.slice(2);
const fourK = args.includes("--4k");
const passthrough = args.filter((a) => a !== "--4k");
const suffix = fourK ? "4K" : "1080p";
const names = ["Blue", "Crimson", "Navy", "Green"];

for (const name of names) {
  const id = `Eye-${name}-${suffix}`;
  const out = `out/${id}.mp4`;
  console.log(`\n=== Rendering ${id} -> ${out}`);
  const result = spawnSync(
    "npx",
    ["remotion", "render", id, out, "--codec=h264", "--muted", ...passthrough],
    { stdio: "inherit", shell: process.platform === "win32" },
  );
  if (result.status !== 0) {
    process.exit(result.status ?? 1);
  }
}
