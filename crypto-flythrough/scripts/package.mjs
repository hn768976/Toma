/**
 * Builds the two deliverable projects: one self-contained, independently
 * runnable Remotion project per variant, each containing only that version.
 *
 *   node scripts/package.mjs
 *
 * Produces dist/crypto-fly-teal/ and dist/crypto-fly-blue/ plus the two zips.
 * node_modules/, out/, dist/ and .git/ are never copied.
 */
import { cpSync, mkdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { execFileSync } from "node:child_process";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const dist = join(root, "dist");

const VARIANTS = {
  teal: {
    dir: "crypto-fly-teal",
    compositionId: "CryptoFlyTeal",
    outName: "crypto-fly-teal",
    title: "Crypto Code Flythrough — Teal",
    summary:
      "Horizontal lateral stream, right to left, with tumbling coins and a " +
      "camera travelling forward through the field.",
  },
  blue: {
    dir: "crypto-fly-blue",
    compositionId: "CryptoFlyBlue",
    outName: "crypto-fly-blue",
    title: "Crypto Code Flythrough — Blue",
    summary:
      "Vertical fall, straight down, no coins, from a camera that holds " +
      "position and looks slightly upward.",
  },
};

const EXCLUDE = new Set([
  "node_modules",
  "out",
  "dist",
  ".git",
  "package-lock.json",
  "scripts",
]);

/** Strips the other variant out of `variants.ts` so only one ships. */
const narrowVariants = (source, keep) => {
  const drop = keep === "teal" ? "blue" : "teal";
  const start = source.indexOf(`  ${drop}: {`);
  if (start === -1) throw new Error(`variant ${drop} not found`);
  const end = source.indexOf("\n  },\n", start);
  if (end === -1) throw new Error(`could not find end of variant ${drop}`);
  const withoutDrop = source.slice(0, start) + source.slice(end + "\n  },\n".length);
  return withoutDrop.replace(
    /export type VariantName = "teal" \| "blue";/,
    `export type VariantName = "${keep}";`,
  );
};

/** Registers only this variant's composition. */
const narrowRoot = (source, keep) => {
  const drop = keep === "teal" ? "Blue" : "Teal";
  const start = source.indexOf(`      <Composition\n        id="CryptoFly${drop}"`);
  if (start === -1) return source;
  const end = source.indexOf("      />\n", start);
  return source.slice(0, start) + source.slice(end + "      />\n".length);
};

const readme = (v, variantKey) => `# ${v.title}

A 4K "crypto code flythrough": fictional JavaScript fragments streaming past a
moving camera under heavy motion blur, built in Remotion with
\`@remotion/three\`.

${v.summary}

## The composition

| | |
|---|---|
| composition id | \`${v.compositionId}\` |
| resolution | **3840 x 2160 (4K UHD)** |
| duration | 270 frames |
| frame rate | 30 fps (9.0 seconds) |
| loops | yes — frame 270 is pixel-identical to frame 0 |
| audio | none |

The loop is seamless: every animated value is a pure function of
\`(frame % 270) / 270\`, and every element completes a whole number of screen
traversals over the 270 frames. It can be cut back to back indefinitely.

## Install and run

    npm install
    npm run dev          # opens Remotion Studio

## Render

4K, the delivery render:

    npx remotion render ${v.compositionId} out/${v.outName}.mp4 --codec=h264 --crf=12 --concurrency=4

A faster 1080p preview:

    npx remotion render ${v.compositionId} out/${v.outName}-preview.mp4 --codec=h264 --crf=18 --scale=0.5 --concurrency=4

Keep the concurrency low. This is a WebGL scene with a post-processing chain,
and each worker holds its own GPU context and its own copy of the shared
textures — 3D uses far more memory per worker than a 2D composition does.

## Extra dependencies

On top of a stock Remotion project this uses:

| package | why |
|---|---|
| \`@remotion/three\` | \`<ThreeCanvas>\`, which disables react-three-fiber's internal render loop so frames advance on Remotion's clock instead of wall time |
| \`three\` | the renderer |
| \`@react-three/fiber\` | React reconciler for three.js |
| \`@react-three/drei\` | \`<PerspectiveCamera>\` |
| \`@react-three/postprocessing\` + \`postprocessing\` | depth of field, bloom and vignette |

## Layout

    src/variants.ts        palette, stream axis, flow direction, coin count,
                           plane density and camera mode — the single source
                           of truth, and the only place a colour is written
    src/field.ts           depth bands, traversal maths, element placement
    src/code-fragments.ts  the fictional crypto JavaScript
    src/textures.ts        shared canvas textures (sharp and pre-smeared)
    src/scene/             camera rig, code field, coins, accents, effects
    src/CodeFlythrough.tsx the composition
    CAMERA-NOTES.md        camera setup, motion blur approach, DoF and bloom
                           settings, and the problems hit on the way

All code shown in the animation is invented for this piece. It is not taken
from any real library, SDK or exchange API, and there are no real logos.
`;

rmSync(dist, { recursive: true, force: true });
mkdirSync(dist, { recursive: true });

for (const [key, v] of Object.entries(VARIANTS)) {
  const target = join(dist, v.dir);
  cpSync(root, target, {
    recursive: true,
    filter: (src) => {
      const rel = src.slice(root.length + 1);
      if (!rel) return true;
      return !EXCLUDE.has(rel.split("/")[0]);
    },
  });

  const variantsPath = join(target, "src/variants.ts");
  writeFileSync(
    variantsPath,
    narrowVariants(readFileSync(variantsPath, "utf8"), key),
  );

  const rootPath = join(target, "src/Root.tsx");
  writeFileSync(rootPath, narrowRoot(readFileSync(rootPath, "utf8"), key));

  const pkgPath = join(target, "package.json");
  const pkg = JSON.parse(readFileSync(pkgPath, "utf8"));
  pkg.name = v.dir;
  pkg.description = v.title;
  writeFileSync(pkgPath, JSON.stringify(pkg, null, 2) + "\n");

  writeFileSync(join(target, "README.md"), readme(v, key));

  execFileSync("zip", ["-r", "-q", `../${v.dir}.zip`, v.dir], { cwd: dist });
  console.log(`built ${v.dir} and ${v.dir}.zip`);
}
