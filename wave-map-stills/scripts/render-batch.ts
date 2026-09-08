/**
 * Renders the batch: each of the twelve compositions in two palettes — 24
 * stills at 3840x2160, into out/stills/.
 *
 *   node --experimental-strip-types scripts/render-batch.ts
 *   node --experimental-strip-types scripts/render-batch.ts c03 c07   # a subset
 *   CONCURRENCY=1 node --experimental-strip-types scripts/render-batch.ts
 *
 * Or, via package.json:  npm run batch
 */
import {spawn} from "node:child_process";
import {mkdirSync} from "node:fs";
import {dirname, join} from "node:path";
import {fileURLToPath} from "node:url";
import {jobs, BATCH, type Job} from "./batch.ts";
import {COMPOSITIONS} from "../src/lib/compositions.ts";
import {PALETTES} from "../src/lib/palettes.ts";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const outDir = join(root, "out", "stills");

const render = (job: Job) =>
  new Promise<void>((resolve, reject) => {
    const props = JSON.stringify({
      seed: job.seed,
      palette: job.palette,
      composition: job.composition,
    });
    const child = spawn(
      "npx",
      [
        "remotion",
        "still",
        "WaveMap",
        join(outDir, job.name),
        `--props=${props}`,
      ],
      {cwd: root, stdio: "ignore"},
    );
    child.on("error", reject);
    child.on("close", (code) => {
      if (code === 0) {
        console.log(`  rendered ${job.name}`);
        resolve();
      } else {
        reject(new Error(`${job.name} failed with exit code ${code}`));
      }
    });
  });

for (const entry of BATCH) {
  if (!COMPOSITIONS[entry.composition]) {
    throw new Error(`Unknown composition: ${entry.composition}`);
  }
  for (const p of entry.palettes) {
    if (!PALETTES[p]) {
      throw new Error(`Unknown palette: ${p}`);
    }
  }
}

const wanted = process.argv.slice(2);
const queue = jobs().filter(
  (j) => wanted.length === 0 || wanted.includes(j.composition),
);
mkdirSync(outDir, {recursive: true});

const concurrency = Math.max(1, Number(process.env.CONCURRENCY ?? 3));
console.log(
  `Rendering ${queue.length} stills at 3840x2160, ${concurrency} at a time.`,
);

let next = 0;
const worker = async (): Promise<void> => {
  for (;;) {
    const i = next++;
    if (i >= queue.length) {
      return;
    }
    await render(queue[i]);
  }
};

await Promise.all(
  Array.from({length: Math.min(concurrency, queue.length)}, worker),
);
console.log(`Done — ${queue.length} stills in out/stills/`);
