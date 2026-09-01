/**
 * Builds one self-contained Remotion project per variant and zips it.
 *
 * Each archive is a project that renders on its own after `npm install`:
 * src/, package.json, tsconfig.json, remotion.config.ts, public/ (with the
 * Natural Earth TopoJSON) and a README for that composition. node_modules/,
 * out/ and .git/ are never copied in.
 *
 * Run with:  npm run package
 */
import {
  cpSync,
  existsSync,
  mkdirSync,
  readdirSync,
  readFileSync,
  rmSync,
  statSync,
  writeFileSync,
} from "node:fs";
import { execFileSync } from "node:child_process";
import path from "node:path";

const root = path.resolve(import.meta.dirname, "..");
const stagingRoot = path.join(root, "dist-package");
const rootPkg = JSON.parse(readFileSync(path.join(root, "package.json"), "utf8"));

const version = (name) => {
  const found = rootPkg.dependencies?.[name] ?? rootPkg.devDependencies?.[name];
  if (!found) throw new Error(`${name} is not a dependency of the host project`);
  return found;
};

const TARGETS = [
  {
    zip: "doc-approved.zip",
    dir: "doc-approved",
    compositionId: "DocApproved",
    outputName: "doc-approved",
    title: "Document Approval - approved",
    blurb:
      "A cyan checkmark inside a broken ring, six documents flanking it, five gold stars beneath, over a low-contrast world map and drifting data columns.",
  },
  {
    zip: "doc-rejected.zip",
    dir: "doc-rejected",
    compositionId: "DocRejected",
    outputName: "doc-rejected",
    title: "Document Rejected - rejected",
    blurb:
      "A red cross stamped inside a broken ring, six documents flanking it (three struck through), a struck-through \"0 / 5\" beneath, over a low-contrast world map and drifting data columns.",
  },
];

const packageJsonFor = (target) => ({
  name: target.dir,
  version: "1.0.0",
  description: target.title,
  license: "UNLICENSED",
  private: true,
  scripts: {
    dev: "remotion studio",
    render: `remotion render ${target.compositionId} out/${target.outputName}.mp4 --codec=h264 --crf=12 --concurrency=8`,
    preview: `remotion render ${target.compositionId} out/${target.outputName}-preview.mp4 --codec=h264 --crf=18 --scale=0.5`,
    "verify:loop": `node --import ./scripts/register-ts-hooks.mjs --experimental-strip-types scripts/verify-loop.ts ${target.compositionId}`,
    lint: "eslint src && tsc && tsc -p scripts",
  },
  dependencies: {
    "@remotion/bundler": version("@remotion/cli"),
    "@remotion/cli": version("@remotion/cli"),
    "@remotion/google-fonts": version("@remotion/google-fonts"),
    "@remotion/renderer": version("@remotion/cli"),
    "d3-geo": version("d3-geo"),
    react: version("react"),
    "react-dom": version("react-dom"),
    remotion: version("remotion"),
    "topojson-client": version("topojson-client"),
    zod: version("zod"),
  },
  devDependencies: {
    "@remotion/eslint-config-flat": version("@remotion/eslint-config-flat"),
    "@types/d3-geo": version("@types/d3-geo"),
    "@types/geojson": version("@types/geojson"),
    "@types/node": version("@types/node"),
    "@types/react": version("@types/react"),
    "@types/topojson-client": version("@types/topojson-client"),
    "@types/topojson-specification": version("@types/topojson-specification"),
    "@types/web": version("@types/web"),
    eslint: version("eslint"),
    typescript: version("typescript"),
  },
});

const REMOTION_CONFIG = `/**
 * All configuration options: https://remotion.dev/docs/config
 * Note: the Node.js APIs do not read this file.
 */

import { existsSync } from "node:fs";
import { Config } from "@remotion/cli/config";

Config.setRspack(true);
Config.setVideoImageFormat("jpeg");
// Neither composition has audio; without this Remotion still muxes a silent
// AAC track into every MP4.
Config.setMuted(true);
Config.setOverwriteOutput(true);

// Some sandboxed environments block downloading Remotion's own Chrome
// Headless Shell but ship a Playwright Chromium at this path. Reuse it there;
// on a normal machine the path does not exist and Remotion falls back to its
// own managed browser.
const playwrightHeadlessShell =
  "/opt/pw-browsers/chromium_headless_shell-1194/chrome-linux/headless_shell";
if (existsSync(playwrightHeadlessShell)) {
  Config.setBrowserExecutable(playwrightHeadlessShell);
}
`;

const INDEX_TS = `import { registerRoot } from "remotion";
import { RemotionRoot } from "./Root";

registerRoot(RemotionRoot);
`;

const ROOT_TSX = `import React from "react";
import { DocApprovalCompositions } from "./doc-approval/compositions";

export const RemotionRoot: React.FC = () => <DocApprovalCompositions />;
`;

const ESLINT_CONFIG = readFileSync(path.join(root, "eslint.config.mjs"), "utf8");

const GITIGNORE = `node_modules
out
dist
.DS_Store
`;

const sibling = (target) =>
  target.compositionId === "DocApproved" ? "DocRejected" : "DocApproved";

const readme = (target) => `# ${target.title}

${target.blurb}

## The composition

| | |
| --- | --- |
| Composition id | \`${target.compositionId}\` |
| Resolution | 3840 x 2160 (4K UHD) |
| Frame rate | 30 fps |
| Duration | 600 frames = 20.0 s |
| Loops | Yes - see "How the loop closes" below |
| Audio | None |

This project also contains the sibling composition \`${sibling(target)}\`. Both are
the same component driven by the \`variant\` prop, and every colour, mark, rating
row and label that differs between them lives in the single \`VARIANTS\` object in
\`src/doc-approval/variants.ts\`.

## Render

\`\`\`bash
npm install
npx remotion render ${target.compositionId} out/${target.outputName}.mp4 --codec=h264 --crf=12 --concurrency=8
\`\`\`

A faster 1080p check of the same frames:

\`\`\`bash
npx remotion render ${target.compositionId} out/${target.outputName}-preview.mp4 --codec=h264 --crf=18 --scale=0.5
\`\`\`

\`npx remotion studio\` opens the interactive editor.

> \`--concurrency\` may not exceed the machine's CPU core count; lower it if
> Remotion reports that.

## How the loop closes

Every frame is a pure function of \`useCurrentFrame()\` - no \`Date.now()\`, no
\`requestAnimationFrame\`, no CSS animation and no component state - so renders
are deterministic and repeatable.

Every continuous motion (the backdrop drift, the column drift, the square
flicker, the icon pulse, the documents' idle bob, the grain) is defined in
\`src/doc-approval/motion.ts\` with a period that divides 600 exactly, so the
piece is exactly 600-frame periodic once it has finished building.

\`\`\`bash
npm run verify:loop
\`\`\`

checks that in two ways: it asserts every motion in \`motion.ts\` has the
identical value at frame 0 and frame 600, and it renders full-resolution
stills 600 frames apart and compares them pixel by pixel.

Note that frames 0-220 are a one-shot build-on - the backdrop fades up, the
verdict icon draws on, the documents scale in, the rating row appears - so
frame 600 holds the finished state rather than reproducing the empty frame 0.
Frames 220-600 are the hold, and it is that hold which loops seamlessly.

## Map data

The continents are Natural Earth 1:110m land polygons, shipped as TopoJSON at
\`public/geo/ne_110m_land.topo.json\` (from the \`world-atlas\` distribution of
Natural Earth). **Natural Earth is public domain** - "no permission is needed
to use Natural Earth. Crediting the authors is unnecessary" - so no
attribution is required. The bundling wrapper's licence is included alongside
it at \`public/geo/WORLD-ATLAS-LICENSE.txt\`.

Antarctica is filtered out at load time, and the polygons are projected once
with \`d3-geo\`'s \`geoEquirectangular\` into an offscreen canvas; no frame
re-projects them.

## Layout of the source

\`\`\`
src/doc-approval/
  variants.ts      the only place any hex colour or label string is written
  layout.ts        frame geometry and the timeline; asserts loop periods
  motion.ts        every continuous motion, as pure functions of the frame
  geo.ts           Natural Earth load, Antarctica filter, projection
  fonts.ts         Inter via @remotion/google-fonts, gated with delayRender
  util.ts          seeded randomness and canvas helpers
  DocApproval.tsx  the composition: layer order and the stamp shake
  compositions.tsx <Composition> registration for both variants
  components/      WorldBackdrop, DataColumn, FrameBrackets, DocumentIcon,
                   VerdictIcon, RatingRow, Finish
\`\`\`

Everything is drawn to \`<canvas>\` elements through refs, once per React
render, with no \`requestAnimationFrame\`. The map, the frame brackets, each
document and the grain tiles are rasterised once into offscreen canvases and
blitted with transforms.

No real logos, no watermark, no audio.
`;

const walk = (dir) =>
  readdirSync(dir).flatMap((entry) => {
    const full = path.join(dir, entry);
    return statSync(full).isDirectory() ? walk(full) : [full];
  });

/**
 * Guards against shipping a project whose package.json is missing something
 * the source imports: every bare specifier in the staged tree has to resolve
 * to a declared dependency or a Node builtin.
 */
const checkDependencies = (stage, pkg) => {
  const declared = new Set([
    ...Object.keys(pkg.dependencies),
    ...Object.keys(pkg.devDependencies),
  ]);
  const missing = new Set();
  for (const file of walk(stage)) {
    if (!/\.(mts|cts|tsx?|jsx?|mjs|cjs)$/.test(file)) continue;
    const source = readFileSync(file, "utf8");
    for (const match of source.matchAll(/(?:from\s+|import\s*\(\s*)["']([^"']+)["']/g)) {
      const specifier = match[1];
      if (specifier.startsWith(".") || specifier.startsWith("node:")) continue;
      const parts = specifier.split("/");
      const name = specifier.startsWith("@") ? parts.slice(0, 2).join("/") : parts[0];
      // A bare `geojson` import is satisfied by the @types/geojson package.
      if (!declared.has(name) && !declared.has(`@types/${name}`)) {
        missing.add(`${name} (from ${path.relative(stage, file)})`);
      }
    }
  }
  if (missing.size > 0) {
    throw new Error(
      `Undeclared dependencies in ${path.basename(stage)}:\n  ${[...missing].join("\n  ")}`,
    );
  }
};

rmSync(stagingRoot, { recursive: true, force: true });
mkdirSync(stagingRoot, { recursive: true });

for (const target of TARGETS) {
  const stage = path.join(stagingRoot, target.dir);
  mkdirSync(path.join(stage, "src"), { recursive: true });

  cpSync(path.join(root, "src/doc-approval"), path.join(stage, "src/doc-approval"), {
    recursive: true,
  });
  cpSync(path.join(root, "public/geo"), path.join(stage, "public/geo"), { recursive: true });
  for (const file of ["scripts/verify-loop.ts", "scripts/ts-hooks.mjs", "scripts/register-ts-hooks.mjs", "scripts/tsconfig.json"]) {
    mkdirSync(path.join(stage, "scripts"), { recursive: true });
    cpSync(path.join(root, file), path.join(stage, file));
  }
  cpSync(path.join(root, "tsconfig.json"), path.join(stage, "tsconfig.json"));

  writeFileSync(path.join(stage, "src/index.ts"), INDEX_TS);
  writeFileSync(path.join(stage, "src/Root.tsx"), ROOT_TSX);
  writeFileSync(path.join(stage, "remotion.config.ts"), REMOTION_CONFIG);
  writeFileSync(path.join(stage, "eslint.config.mjs"), ESLINT_CONFIG);
  writeFileSync(path.join(stage, ".gitignore"), GITIGNORE);
  writeFileSync(path.join(stage, "README.md"), readme(target));
  writeFileSync(
    path.join(stage, "package.json"),
    `${JSON.stringify(packageJsonFor(target), null, 2)}\n`,
  );

  checkDependencies(stage, packageJsonFor(target));

  const zipPath = path.join(stagingRoot, target.zip);
  if (existsSync(zipPath)) rmSync(zipPath);
  execFileSync(
    "zip",
    ["-r", "-q", zipPath, target.dir, "-x", "*/node_modules/*", "*/out/*", "*/.git/*"],
    { cwd: stagingRoot, stdio: "inherit" },
  );
  console.log(`packaged ${target.zip}`);
}
