// node tools/snap.mjs <outDir> <dpr> <lookId>:<f1,f2,...> [...]
import { createRequire } from "node:module";
const { chromium } = createRequire(import.meta.url)("playwright");
import { execSync } from "node:child_process";
import { writeFileSync, mkdirSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const [outDir, dprArg, ...specs] = process.argv.slice(2);
mkdirSync(outDir, { recursive: true });
const bundle = join(outDir, "harness.js");
execSync(
  `${root}/node_modules/.bin/esbuild ${root}/tools/harness-entry.ts --bundle --format=iife --outfile=${bundle} --log-level=warning`,
  { stdio: "inherit" },
);
const browser = await chromium.launch({
  args: ["--use-angle=swiftshader", "--enable-unsafe-swiftshader", "--ignore-gpu-blocklist"],
});
const page = await browser.newPage();
page.on("console", (m) => console.log("[page]", m.text()));
page.on("pageerror", (e) => console.log("[pageerror]", e.message));
await page.setContent("<html><body style='margin:0;background:#333'></body></html>");
await page.addScriptTag({ path: bundle });
for (const spec of specs) {
  const [id, frames] = spec.split(":");
  for (const f of frames.split(",").map(Number)) {
    const t0 = Date.now();
    const { url, ms } = await page.evaluate(
      ([id, f, d]) => window.renderFrame(id, f, d),
      [id, f, Number(dprArg)],
    );
    writeFileSync(join(outDir, `${id}_${String(f).padStart(3, "0")}.png`), Buffer.from(url.split(",")[1], "base64"));
    console.log(`${id} f${f}: draw ${ms.toFixed(0)}ms, total ${Date.now() - t0}ms`);
  }
}
await browser.close();
