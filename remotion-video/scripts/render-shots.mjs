/**
 * Renders every aviation shot at one delivery resolution.
 *
 * Usage:
 *   node scripts/render-shots.mjs            # 1080p into out/1080p
 *   node scripts/render-shots.mjs 4k         # 4K into out/4k
 *   node scripts/render-shots.mjs 4k 3       # only shot 3
 *
 * Shots render one at a time on purpose. Each one compiles a large unrolled
 * cloud shader and holds several full-resolution render targets, so running
 * them concurrently costs more in contention than it saves in wall clock.
 */
import { spawn } from "node:child_process";
import { mkdirSync } from "node:fs";

const SHOTS = [
  "Shot01-ContainerAscent",
  "Shot02-ContainerWall",
  "Shot03-ContainerCanyon",
  "Shot04-CloudCruise",
  "Shot05-OverheadSilhouette",
  "Shot06-AirportSign",
];

const resolution = (process.argv[2] ?? "1080p").toLowerCase() === "4k" ? "4K" : "1080p";
const only = process.argv[3] ? Number(process.argv[3]) : null;
const outDir = `out/${resolution.toLowerCase()}`;
mkdirSync(outDir, { recursive: true });

const run = (composition, output) =>
  new Promise((resolve, reject) => {
    const child = spawn(
      "npx",
      [
        "remotion",
        "render",
        composition,
        output,
        "--codec=h264",
        // Constant-quality x264. 18 keeps the cloud gradients clean; the sky in
        // these shots is exactly the kind of smooth ramp that bands first.
        "--crf=18",
        "--pixel-format=yuv420p",
        "--log=info",
      ],
      { stdio: "inherit", shell: process.platform === "win32" },
    );
    child.on("exit", (code) =>
      code === 0 ? resolve() : reject(new Error(`${composition} exited with ${code}`)),
    );
  });

for (const [index, shot] of SHOTS.entries()) {
  if (only !== null && only !== index + 1) continue;
  const composition = `${shot}-${resolution}`;
  const output = `${outDir}/${shot}-${resolution}.mp4`;
  console.log(`\n=== ${composition} -> ${output}`);
  const started = Date.now();
  await run(composition, output);
  console.log(`=== ${composition} done in ${Math.round((Date.now() - started) / 1000)}s`);
}
