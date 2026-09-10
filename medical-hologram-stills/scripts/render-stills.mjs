#!/usr/bin/env node
// Batch renderer: every subject x colourway from the manifest, as PNG
// stills, followed by ±1/255 dithering of the final image.
//
//   npm run render                       # everything in the manifest
//   npm run render -- --subject heart    # one subject (both colourways)
//   npm run render -- --colourway blue   # one colourway of every subject
//   npm run render -- --scale 0.25       # quick 1500x844 previews
//   npm run render -- --no-dither        # skip the dither pass
//   npm run render -- --out previews     # different output folder (default: out)
//
// Output names: out/<subject-id>_<colourway>.png

import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { bundle } from "@remotion/bundler";
import { renderStill, selectComposition } from "@remotion/renderer";
import { ditherPng } from "./dither-png.mjs";

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const MANIFEST = join(ROOT, "src", "subjects", "manifest.generated.json");

const args = process.argv.slice(2);
const opt = (name) => {
  const i = args.indexOf(`--${name}`);
  return i >= 0 ? args[i + 1] : undefined;
};
const flag = (name) => args.includes(`--${name}`);

const onlySubject = opt("subject");
const onlyColourway = opt("colourway");
const scale = Number(opt("scale") ?? 1);
const outDir = resolve(ROOT, opt("out") ?? "out");
const dither = !flag("no-dither");
const skipExisting = flag("skip-existing");
const format = opt("format") ?? "png"; // "png" (deliverable) or "jpeg" (previews only, never dithered)

// Some sandboxed dev environments block downloading Remotion's own Chrome
// Headless Shell but ship a Playwright Chromium here; reuse it if present.
const playwrightHeadlessShell = "/opt/pw-browsers/chromium_headless_shell-1194/chrome-linux/headless_shell";
const browserExecutable = existsSync(playwrightHeadlessShell) ? playwrightHeadlessShell : null;

const main = async () => {
  if (!existsSync(MANIFEST)) {
    console.error("✖ manifest missing — run `npm run prepare-subjects` first");
    process.exit(1);
  }
  const manifest = JSON.parse(readFileSync(MANIFEST, "utf8"));
  const jobs = [];
  for (const subject of manifest.subjects) {
    if (onlySubject && subject.id !== onlySubject) continue;
    for (const colourway of subject.colourways) {
      if (onlyColourway && colourway !== onlyColourway) continue;
      jobs.push({ subject, colourway, id: `${subject.id}-${colourway}`, file: `${subject.id}_${colourway}.${format === "jpeg" ? "jpg" : "png"}` });
    }
  }
  if (jobs.length === 0) {
    console.error("✖ nothing to render (check --subject / --colourway filters)");
    process.exit(1);
  }
  if (jobs.length > 30) {
    console.error(`✖ ${jobs.length} stills requested; the project limit is 30`);
    process.exit(1);
  }
  mkdirSync(outDir, { recursive: true });

  console.log(`Bundling…`);
  const serveUrl = await bundle({
    entryPoint: join(ROOT, "src", "index.ts"),
    // Match remotion.config.ts (the config file does not apply to the Node APIs).
    webpackOverride: (c) => c,
  });

  let n = 0;
  for (const job of jobs) {
    n++;
    const started = Date.now();
    const composition = await selectComposition({
      serveUrl,
      id: job.id,
      inputProps: { subjectId: job.subject.id, colourway: job.colourway },
      browserExecutable,
      timeoutInMilliseconds: 120000,
    });
    const output = join(outDir, job.file);
    if (skipExisting && existsSync(output)) {
      console.log(`↷ [${n}/${jobs.length}] ${job.file} exists, skipped`);
      continue;
    }
    const { buffer } = await renderStill({
      composition,
      serveUrl,
      output: null, // we post-process and write the PNG ourselves
      imageFormat: format,
      ...(format === "jpeg" ? { jpegQuality: 88 } : {}),
      scale,
      inputProps: { subjectId: job.subject.id, colourway: job.colourway },
      browserExecutable,
      timeoutInMilliseconds: 120000,
      chromiumOptions: { gl: "angle" },
    });
    let png = buffer;
    if (dither && format === "png") {
      // Seeded by the composition id so re-renders are byte-identical.
      let seed = 0;
      for (const ch of job.id) seed = (seed * 31 + ch.charCodeAt(0)) | 0;
      png = ditherPng(buffer, seed);
    }
    writeFileSync(output, png);
    const w = Math.round(composition.width * scale);
    const h = Math.round(composition.height * scale);
    console.log(`✔ [${n}/${jobs.length}] ${job.file}  ${w}x${h}  ${(png.length / 1e6).toFixed(1)} MB  ${((Date.now() - started) / 1000).toFixed(1)}s${dither && format === "png" ? "  (dithered)" : ""}`);
  }
  console.log(`Done: ${jobs.length} still(s) in ${outDir}`);
};

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
