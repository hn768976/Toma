// Builds a self-contained, independently runnable Remotion project for ONE
// version of the formula field, and zips it.
//
//   node scripts/build-single-variant.mjs chem
//   node scripts/build-single-variant.mjs            # all three
//
// The package contains only that version: its Root.tsx registers a single
// composition, and its variants.ts holds that variant's data directly rather
// than a three-key object. node_modules, out and .git are never included.

import { execFile } from "node:child_process";
import { cp, mkdir, readFile, readdir, rm, writeFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { promisify } from "node:util";

const run = promisify(execFile);
const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const stageRoot = join(root, "packages");

/** Modules that are identical in every version. */
const SHARED = [
  "ast.ts",
  "blit.ts",
  "color.ts",
  "diagram.ts",
  "field.ts",
  "fonts.ts",
  "grain.ts",
  "layout.ts",
  "sprites.ts",
  "symbols.ts",
  "useCanvasPass.ts",
  "variant-types.ts",
  "BackgroundWash.tsx",
  "DepthLayer.tsx",
  "EquationLine.tsx",
  "NotationGlyph.tsx",
  "FormulaField.tsx",
];

const VERSIONS = {
  chem: {
    package: "formula-field-chem",
    composition: "FormulaFieldBlue",
    output: "formula-field-chem",
    title: "Formula Field — chemistry (blue, approaching)",
    blurb:
      "A field of chemical notation — skeletal structures and balanced equations —\n" +
      "travelling from far to near and spreading outward as it arrives.",
  },
  math: {
    package: "formula-field-math",
    composition: "FormulaFieldGreen",
    output: "formula-field-math",
    title: "Formula Field — mathematics (green, receding)",
    blurb:
      "A field of mathematical notation — integrals, matrices, built-up fractions —\n" +
      "retreating from the viewer and drawing inward toward a vanishing point set\n" +
      "just above frame centre.",
  },
  physics: {
    package: "formula-field-physics",
    composition: "FormulaFieldAmber",
    output: "formula-field-physics",
    title: "Formula Field — physics (amber, lateral drift)",
    blurb:
      "A field of physics notation — equations mixed half and half with diagrams —\n" +
      "drifting horizontally past the viewer at constant scale, depth showing only\n" +
      "as parallax, blur and brightness.",
  },
};

const readSrc = (p) => readFile(join(root, "src", p), "utf8");

const rootTsx = (v) => `import { Composition } from "remotion";
import { FormulaField } from "./formula-field/FormulaField";
import {
  DURATION_IN_FRAMES,
  FPS,
  HEIGHT,
  WIDTH,
} from "./formula-field/field";

export const RemotionRoot: React.FC = () => {
  return (
    <Composition
      id="${v.composition}"
      component={FormulaField}
      durationInFrames={DURATION_IN_FRAMES}
      fps={FPS}
      width={WIDTH}
      height={HEIGHT}
      defaultProps={{ variant: "${v.key}" as const }}
    />
  );
};
`;

const registryTs = (v) => `// How the composition's \`variant\` prop resolves to variant data.
//
// This project ships one version, so there is nothing to look up: the key can
// only be "${v.key}", and the data comes straight from variants.ts.

import type { Variant } from "./variant-types";
import { VARIANT, type VariantKey } from "./variants";

export const getVariant = (_key: VariantKey): Variant => VARIANT;
export type { VariantKey };
`;

const remotionConfig = `/**
 * All configuration options: https://remotion.dev/docs/config
 */

import { Config } from "@remotion/cli/config";

Config.setVideoImageFormat("jpeg");
Config.setOverwriteOutput(true);
`;

const packageJson = (v) =>
  JSON.stringify(
    {
      name: v.package,
      version: "1.0.0",
      description: v.title,
      license: "UNLICENSED",
      private: true,
      dependencies: {
        "@remotion/cli": "4.0.515",
        "@remotion/google-fonts": "4.0.515",
        react: "19.2.3",
        "react-dom": "19.2.3",
        remotion: "4.0.515",
      },
      devDependencies: {
        "@types/react": "19.2.7",
        "@types/web": "0.0.166",
        typescript: "5.9.3",
      },
      scripts: {
        dev: "remotion studio",
        build: "remotion bundle",
        render: `remotion render ${v.composition} out/${v.output}.mp4 --codec=h264 --crf=12 --concurrency=8`,
        "vendor-font": "node scripts/vendor-font.mjs",
        typecheck: "tsc",
      },
    },
    null,
    2,
  ) + "\n";

const readme = (v) => `# ${v.title}

${v.blurb}

## The composition

| | |
| --- | --- |
| Composition id | \`${v.composition}\` |
| Resolution | **3840 × 2160 (4K UHD)** |
| Duration | 600 frames |
| Frame rate | 30 fps |
| Running time | 20.0 s |
| Loop | **Seamless** — frame 600 is pixel-identical to frame 0, so the clip can be cut end to end with no visible join |

Every traversal of the depth range completes a whole number of times in 600
frames, every glow-pulse period divides 600, and the film grain is seeded on
\`frame % 600\`. Nothing in the piece reads a clock: each frame is a pure
function of \`useCurrentFrame()\`, so renders are deterministic and frames can
be distributed across workers in any order.

## Install

\`\`\`console
npm install
\`\`\`

## Preview

\`\`\`console
npm run dev
\`\`\`

## Render at 4K

\`\`\`console
npx remotion render ${v.composition} out/${v.output}.mp4 --codec=h264 --crf=12 --concurrency=8
\`\`\`

Lower \`--concurrency\` if you have fewer than 8 CPU cores — Remotion will not
accept a value above the core count. For a quick 1080p check, add
\`--scale=0.5\`.

## Typeface

The notation is set in IBM Plex Sans. The exact woff2 subsets that
\`@remotion/google-fonts\` points at are vendored into \`public/fonts\`, and the
faces are registered from there behind \`delayRender()\`, so a render never
depends on reaching \`fonts.gstatic.com\` — a fallback face substituted
mid-render would misplace every subscript in the piece. To refresh them:

\`\`\`console
npm run vendor-font
\`\`\`

## Layout of the source

| Path | What it is |
| --- | --- |
| \`src/formula-field/variants.ts\` | This version's palette, notation set, motion mode and depth range — the only place a colour or a formula is written |
| \`src/formula-field/ast.ts\` | Expression node types and the builders the notation is written with |
| \`src/formula-field/layout.ts\` | TeX-style layout: subscripts, fractions, radicals, big operators, matrices |
| \`src/formula-field/symbols.ts\` | Vector paths for every non-alphabetic symbol, and the stretchy fences |
| \`src/formula-field/diagram.ts\` | The structural-drawing engine used by the diagrams |
| \`src/formula-field/sprites.ts\` | Lays each notation item out once into offscreen canvases, one per palette tone |
| \`src/formula-field/field.ts\` | Where every glyph is, at any frame — all of the motion |
| \`src/formula-field/FormulaField.tsx\` | The composition: buffers, depth-of-field compositing, bloom, vignette, grain |
`;

const gitignore = `node_modules
dist
out
.DS_Store
.env
`;

const build = async (key) => {
  const v = { ...VERSIONS[key], key };
  const stage = join(stageRoot, v.package);
  await rm(stage, { recursive: true, force: true });
  await mkdir(join(stage, "src", "formula-field"), { recursive: true });
  await mkdir(join(stage, "scripts"), { recursive: true });

  for (const file of SHARED) {
    await cp(
      join(root, "src", "formula-field", file),
      join(stage, "src", "formula-field", file),
    );
  }

  // This version's data becomes the project's whole variants.ts.
  const variant = await readSrc(join("formula-field", "variants", `${key}.ts`));
  await writeFile(
    join(stage, "src", "formula-field", "variants.ts"),
    variant.replaceAll('from "../', 'from "./'),
  );
  await writeFile(join(stage, "src", "formula-field", "registry.ts"), registryTs(v));

  await writeFile(join(stage, "src", "Root.tsx"), rootTsx(v));
  await cp(join(root, "src", "index.ts"), join(stage, "src", "index.ts"));

  await cp(
    join(root, "public", "fonts", "ibm-plex-sans"),
    join(stage, "public", "fonts", "ibm-plex-sans"),
    { recursive: true },
  );
  await cp(join(root, "scripts", "vendor-font.mjs"), join(stage, "scripts", "vendor-font.mjs"));
  await cp(join(root, "tsconfig.json"), join(stage, "tsconfig.json"));
  await writeFile(join(stage, "remotion.config.ts"), remotionConfig);
  await writeFile(join(stage, "package.json"), packageJson(v));
  await writeFile(join(stage, "README.md"), readme(v));
  await writeFile(join(stage, ".gitignore"), gitignore);

  const zip = join(stageRoot, `${v.package}.zip`);
  await rm(zip, { force: true });
  await run("zip", ["-r", "-q", zip, v.package, "-x", "*/node_modules/*", "*/out/*", "*/.git/*"], {
    cwd: stageRoot,
  });

  const files = await readdir(stage, { recursive: true });
  console.log(`${v.package}.zip  (${files.length} entries, composition ${v.composition})`);
};

const wanted = process.argv.slice(2);
const keys = wanted.length > 0 ? wanted : Object.keys(VERSIONS);
await mkdir(stageRoot, { recursive: true });
for (const key of keys) {
  if (!VERSIONS[key]) throw new Error(`unknown version: ${key}`);
  await build(key);
}
