/**
 * Builds one self-contained, independently runnable project per version and
 * zips it.
 *
 * The working project holds all six versions in a single VARIANTS object. A
 * delivered zip should hold exactly one, so this slices variants.ts down to
 * the target version and the palette it uses, rewrites Root.tsx to register
 * only that composition, and writes a README for it. Everything else — the
 * shared particle system, the layers, the config — is copied verbatim.
 *
 * Usage: node scripts/package.mjs [outputDir]
 */

import { execFileSync } from "node:child_process";
import {
  cpSync,
  mkdirSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const projectRoot = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const distRoot = resolve(projectRoot, process.argv[2] ?? "dist");

/** Everything a delivered project needs. `out` and `node_modules` are never copied. */
const COPY = ["src", "public", "package.json", "tsconfig.json", "remotion.config.ts"];

const VERSIONS = [
  {
    id: "warpBlue",
    composition: "WarpBlue",
    zip: "warp-blue",
    palettes: ["BLUE"],
    loopConst: "WARP_LOOP",
    summary:
      "An off-centre core with a warm amber ring in an otherwise cold blue field, " +
      "with about 5000 particles streaking radially outward and moderate blue " +
      "nebulosity behind them.",
  },
  {
    id: "warpViolet",
    composition: "WarpViolet",
    zip: "warp-violet",
    palettes: ["VIOLET"],
    loopConst: "WARP_LOOP",
    summary:
      "A centred pure-white core with a violet halo and no warm ring, about 9000 " +
      "smaller and dimmer particles on longer streaks, and light dust — colder and " +
      "more synthetic than the blue version. A sector of the field bursts brighter " +
      "every 30-55 frames.",
  },
  {
    id: "warpAmber",
    composition: "WarpAmber",
    zip: "warp-amber",
    palettes: ["AMBER"],
    loopConst: "WARP_LOOP",
    summary:
      "The blue version inverted: a cool teal ring around a white core, placed on " +
      "the opposite side of the frame, in a warm field. About 2500 larger, brighter " +
      "particles on shorter streaks, with heavy dust that carries as much of the " +
      "frame as the particles do.",
  },
  {
    id: "fieldBlue",
    composition: "FieldBlue",
    zip: "field-blue",
    palettes: ["FIELD_BLUE"],
    loopConst: "FIELD_LOOP",
    summary:
      "About 14000 stars over a broad diagonal band of nebulosity — a galactic " +
      "plane. Star density follows the band and thins away from it, and the whole " +
      "field drifts slowly on a closed path.",
  },
  {
    id: "fieldTeal",
    composition: "FieldTeal",
    zip: "field-teal",
    palettes: ["FIELD_TEAL"],
    loopConst: "FIELD_LOOP",
    summary:
      "About 7000 stars in open space: no band, uniform density, isolated teal " +
      "clouds with large empty regions between them, and a stiller drift than the " +
      "blue starfield.",
  },
  {
    id: "fieldMono",
    composition: "FieldMono",
    zip: "field-mono",
    palettes: ["FIELD_MONO"],
    loopConst: "FIELD_LOOP",
    summary:
      "About 22000 stars on pure black with no dust and no colour, including " +
      "around 25 large stars with four-point diffraction spikes. Almost still — " +
      "the twinkle is the motion.",
  },
];

const variantsSource = readFileSync(join(projectRoot, "src/variants.ts"), "utf8");

/** Returns the text of a top-level `const NAME = {...} as const;` block. */
const paletteBlock = (name) => {
  const start = variantsSource.indexOf(`const ${name} = {`);
  if (start < 0) throw new Error(`palette ${name} not found`);
  const end = variantsSource.indexOf("} as const;", start);
  return variantsSource.slice(start, end + "} as const;".length);
};

/** Returns the text of one entry of the VARIANTS object, braces balanced. */
const variantBlock = (id) => {
  const start = variantsSource.indexOf(`\n  ${id}: {`);
  if (start < 0) throw new Error(`variant ${id} not found`);
  let depth = 0;
  let i = variantsSource.indexOf("{", start);
  for (; i < variantsSource.length; i++) {
    if (variantsSource[i] === "{") depth++;
    else if (variantsSource[i] === "}") {
      depth--;
      if (depth === 0) break;
    }
  }
  return variantsSource.slice(start + 1, i + 1).replace(/\n$/, "");
};

/** The type declarations, unchanged, with the id union narrowed to one version. */
const typeSection = (id) => {
  const start = variantsSource.indexOf("export type ParticleMode");
  const end = variantsSource.indexOf("const WARP_LOOP");
  return variantsSource
    .slice(start, end)
    .replace(
      /export type VariantId =\n(?:  \| "[a-zA-Z]+"\n)+  \| "[a-zA-Z]+";/,
      `export type VariantId = "${id}";`,
    )
    .replace(/\n+$/, "\n");
};

const loopLine = (name) => {
  const match = variantsSource.match(new RegExp(`const ${name} = \\d+;.*`));
  return match[0];
};

const buildVariants = (version) => {
  const family = version.loopConst === "WARP_LOOP" ? "warp" : "field";
  const header = `/**
 * The one place this version is described.
 *
 * It is one configuration of a particle system that runs in two modes:
 * "streak" flies particles radially outward from a core, "point" holds them
 * as stars in a slowly drifting field. This version runs in "${
   family === "warp" ? "streak" : "point"
 }" mode.
 * Everything that shapes it — palette, density, core, dust, timing — is a
 * value below. No hex literal appears anywhere else in the project.
 *
 * Every period below divides the loop length and every Lissajous frequency is
 * an integer, so the composition loops seamlessly.
 */
`;

  return [
    header,
    typeSection(version.id),
    loopLine(version.loopConst),
    loopLine("FPS"),
    "",
    ...version.palettes.map((name) => paletteBlock(name) + "\n"),
    `export const VARIANTS: Record<VariantId, Variant> = {`,
    variantBlock(version.id) + ",",
    "};",
    "",
    "export const VARIANT_IDS = Object.keys(VARIANTS) as VariantId[];",
    "",
  ].join("\n");
};

const VERSIONS_LOOP = {
  warpBlue: 168,
  warpViolet: 168,
  warpAmber: 168,
  fieldBlue: 390,
  fieldTeal: 390,
  fieldMono: 390,
};

const buildRoot = (version) => `import React from "react";
import { Composition } from "remotion";
import { SpaceField } from "./SpaceField";
import { VARIANTS } from "./variants";

/**
 * ${version.composition} — 4K (3840x2160), ${
   VERSIONS_LOOP[version.id]
 } frames at 30fps, seamless.
 */
export const RemotionRoot: React.FC = () => {
  return (
    <Composition
      id="${version.composition}"
      component={SpaceField}
      durationInFrames={VARIANTS.${version.id}.loopLength}
      fps={30}
      width={3840}
      height={2160}
      defaultProps={{ variant: "${version.id}" as const }}
    />
  );
};
`;

const buildReadme = (version) => {
  const frames = VERSIONS_LOOP[version.id];
  const seconds = (frames / 30).toFixed(1);
  const family = version.loopConst === "WARP_LOOP" ? "warp" : "field";
  return `# ${version.composition}

${version.summary}

## The piece

| | |
| --- | --- |
| Composition id | \`${version.composition}\` |
| Resolution | 4K — 3840 x 2160 |
| Duration | ${frames} frames (${seconds}s) |
| Frame rate | 30 fps |
| Loops | Yes — seamlessly. The last frame hands back to the first with no cut. |

It belongs to the **${family} family** of a set of six. The warp family (a core
with particles streaking radially away from it) runs 5.6s; the field family
(stars holding station in a drifting field) runs 13.0s. This one is a
${family} version, so it runs ${seconds}s.

There is no text, no logo, no watermark and no audio.

## Rendering it

\`\`\`sh
npm install
npx remotion render ${version.composition} out/${version.zip}.mp4 --codec=h264 --crf=12 --concurrency=8
\`\`\`

That renders at full 4K. Lower \`--concurrency\` if the machine has fewer than
eight cores — Remotion refuses a value above the core count. For a quick look,
add \`--scale=0.5\` for a 1080p version.

To open it in the Remotion studio and scrub through:

\`\`\`sh
npm run dev
\`\`\`

## How it is put together

Everything is drawn to 2D canvases — no 3D and no WebGL. Every layer is a pure
function of the frame number: no \`Date.now()\`, no \`requestAnimationFrame\`, no
CSS animation and no component state, which is what makes the render
deterministic and the loop exact. All randomness comes from Remotion's
\`random()\` with fixed string seeds, so the same frame always draws the same way.

| File | What it holds |
| --- | --- |
| \`src/variants.ts\` | The whole configuration of this version, and the only place a colour is written down. |
| \`src/particles.ts\` | The particle system: positions, sizes, brightnesses, colours, twinkle periods, dust blobs and timed events. Built once and reused every frame. |
| \`src/SpaceField.tsx\` | Stacks the layers. |
| \`src/components/\` | One component per layer: background wash, dust clouds, particles, core flare, and the vignette and grain finish. |

The dust layer is computed at 1/8 resolution and upscaled, since it is all soft
gradient; the particles are always drawn at full resolution.
`;
};

rmSync(distRoot, { recursive: true, force: true });
mkdirSync(distRoot, { recursive: true });

for (const version of VERSIONS) {
  const stage = join(distRoot, version.zip);
  mkdirSync(stage, { recursive: true });

  for (const entry of COPY) {
    cpSync(join(projectRoot, entry), join(stage, entry), { recursive: true });
  }

  const pkg = JSON.parse(readFileSync(join(stage, "package.json"), "utf8"));
  pkg.name = version.zip;
  pkg.description = `${version.composition} — 4K looping space particle field`;
  writeFileSync(join(stage, "package.json"), JSON.stringify(pkg, null, 2) + "\n");

  writeFileSync(join(stage, "src/variants.ts"), buildVariants(version));
  writeFileSync(join(stage, "src/Root.tsx"), buildRoot(version));
  writeFileSync(join(stage, "README.md"), buildReadme(version));

  execFileSync("zip", ["-rq", `../${version.zip}.zip`, "."], { cwd: stage });
  // The staging tree has served its purpose; leave only the zip behind.
  rmSync(stage, { recursive: true, force: true });
  console.log(`packaged ${version.zip}.zip`);
}
