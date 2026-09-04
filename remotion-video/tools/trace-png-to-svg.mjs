#!/usr/bin/env node
// Traces a black-on-white silhouette PNG to a clean SVG.
//
//   node tools/trace-png-to-svg.mjs <input.png> [output.svg]
//   node tools/trace-png-to-svg.mjs --all          # every PNG in public/trees
//
// The supplied tree artwork is black on an opaque white background. Keying
// that to alpha at runtime works, but it bakes the silhouette at the source
// PNG's resolution. Tracing it to vector instead means the treeline stays
// crisp at any output size, which matters most for the near-tier trees at 4K.
//
// Pure JS (the `potrace` npm package), so this needs no system binary.
import { readdirSync, readFileSync, writeFileSync } from "node:fs";
import { basename, dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { createRequire } from "node:module";

const require = createRequire(import.meta.url);
const potrace = require("potrace");
const { PNG } = require("pngjs");

const HERE = dirname(fileURLToPath(import.meta.url));
const TREE_DIR = resolve(HERE, "..", "public", "trees");

const TRACE_OPTIONS = {
  // Mid-grey cut. The source art is bilevel apart from antialiasing, so the
  // exact value barely matters — but keep it central so needle tips, which are
  // all partial coverage, land on the side that preserves them.
  threshold: 150,
  // Keep small speckles: the reference silhouettes carry tiny interior holes
  // between the frond layers, and those are what stop the shape reading as a
  // flat blob.
  turdSize: 2,
  alphaMax: 1,
  optCurve: true,
  optTolerance: 0.2,
  blackOnWhite: true,
  color: "#000000",
  background: "transparent",
};

// Flatten any alpha onto white before tracing, so a PNG that is already
// transparent traces the same as one with a painted white background.
const flattenToWhite = (file) => {
  const png = PNG.sync.read(readFileSync(file));
  const { width, height, data } = png;
  for (let i = 0; i < data.length; i += 4) {
    const a = data[i + 3] / 255;
    for (let k = 0; k < 3; k++) {
      data[i + k] = Math.round(data[i + k] * a + 255 * (1 - a));
    }
    data[i + 3] = 255;
  }
  return { buffer: PNG.sync.write(png), width, height };
};

const trace = (buffer) =>
  new Promise((res, rej) => {
    const tracer = new potrace.Potrace(TRACE_OPTIONS);
    tracer.loadImage(buffer, (err) => {
      if (err) return rej(err);
      res(tracer.getSVG());
    });
  });

// Replace potrace's opening tag wholesale with a canonical one. Merging into
// it risks emitting a duplicate attribute, which is an XML parse error — the
// SVG then silently fails to render as an <img>.
const normalise = (svg, width, height) =>
  svg
    .replace(
      /<svg[^>]*>/,
      `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}"` +
        ` viewBox="0 0 ${width} ${height}">`,
    )
    // Drop any painted white ground; the silhouette must sit on transparency.
    .replace(/<rect[^>]*fill="?#?fff(fff)?"?[^>]*\/>/gi, "");

const convert = async (input, output) => {
  const { buffer, width, height } = flattenToWhite(input);
  const svg = normalise(await trace(buffer), width, height);
  writeFileSync(output, svg);
  const bytes = Buffer.byteLength(svg);
  console.log(
    `${basename(input)} -> ${basename(output)}  (${width}x${height}, ${(bytes / 1024).toFixed(1)} KB)`,
  );
};

const args = process.argv.slice(2);
if (args.length === 0) {
  console.error("usage: trace-png-to-svg.mjs <input.png> [output.svg] | --all");
  process.exit(1);
}

if (args[0] === "--all") {
  const pngs = readdirSync(TREE_DIR).filter((f) =>
    f.toLowerCase().endsWith(".png"),
  );
  if (pngs.length === 0) {
    console.error(`No PNGs found in ${TREE_DIR}`);
    process.exit(1);
  }
  for (const file of pngs) {
    await convert(
      join(TREE_DIR, file),
      join(TREE_DIR, file.replace(/\.png$/i, ".svg")),
    );
  }
} else {
  const input = resolve(args[0]);
  const output = args[1] ? resolve(args[1]) : input.replace(/\.png$/i, ".svg");
  await convert(input, output);
}
