/**
 * Renders every command in src/commands.ts: one mp4 and one still each.
 *
 *   node scripts/render-all.mjs                 # 1080p previews (--scale=0.5)
 *   node scripts/render-all.mjs --scale=1       # full 4K masters
 *   node scripts/render-all.mjs --only=VCR-Play,VCR-Stop
 */

import {spawnSync} from "node:child_process";
import {mkdirSync, readFileSync} from "node:fs";
import {dirname, join} from "node:path";
import {fileURLToPath} from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const arg = (name, fallback) => {
  const hit = process.argv.find((a) => a.startsWith(`--${name}=`));
  return hit ? hit.slice(name.length + 3) : fallback;
};

const scale = arg("scale", "0.5");
const only = arg("only", "").split(",").filter(Boolean);
const outDir = join(root, "out");

// The command table is plain data, so it can be read without a TS toolchain.
const source = readFileSync(join(root, "src/commands.ts"), "utf8");
const commands = [...source.matchAll(/\{\s*id:\s*"([^"]+)",\s*file:\s*"([^"]+)",[\s\S]*?stillFrame:\s*(\d+),/g)]
  .map(([, id, file, stillFrame]) => ({id, file, stillFrame: Number(stillFrame)}))
  .filter(({id}) => only.length === 0 || only.includes(id));

if (commands.length === 0) throw new Error("No commands matched");
mkdirSync(outDir, {recursive: true});

const run = (args) => {
  const result = spawnSync("npx", ["remotion", ...args], {
    cwd: root,
    stdio: "inherit",
  });
  if (result.status !== 0) process.exit(result.status ?? 1);
};

for (const {id, file, stillFrame} of commands) {
  console.log(`\n=== ${id} ===`);
  run(["render", id, join("out", `${file}.mp4`), `--scale=${scale}`]);
  run([
    "still",
    id,
    join("out", `${file}.png`),
    `--scale=${scale}`,
    `--frame=${stillFrame}`,
  ]);
}

console.log(`\nDone: ${commands.length} clip(s) in ${outDir}`);
