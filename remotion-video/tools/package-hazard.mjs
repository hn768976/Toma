/**
 * Builds a standalone, single-composition Remotion project for one hazard
 * variant and zips it.
 *
 * Each zip carries its own copy of the vendored library so it needs nothing
 * outside itself, and registers only its own composition. node_modules, out
 * and .git are never copied in the first place.
 */
import { cpSync, mkdirSync, rmSync, writeFileSync } from "node:fs";
import { execFileSync } from "node:child_process";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const stagingRoot = resolve(root, "dist-zips");

const VARIANTS = [
  {
    key: "radiation",
    dir: "hazard-radiation",
    compositionId: "HazardRadiation",
    output: "hazard-radiation",
    title: "Hazard Symbol — Radiation",
    symbol: "the standard international radiation trefoil",
    shimmer:
      'Its energy fill runs "hot": a fast, high-contrast flicker with visible wisps escaping the blade edges.',
    flares: "Flares strike every 60-110 frames and last 5-8 frames.",
  },
  {
    key: "biohazard",
    dir: "hazard-biohazard",
    compositionId: "HazardBiohazard",
    output: "hazard-biohazard",
    title: "Hazard Symbol — Biohazard",
    symbol: "the standard international biohazard mark",
    shimmer:
      'Its energy fill runs "organic": slower and lower in contrast, weighted toward the noise field\'s low-frequency component, so it reads as something moving under the surface rather than crackling on it.',
    flares:
      "Flares are slower and longer than the radiation variant's — every 100-180 frames, lasting 12-18 frames with a softer onset.",
  },
];

const packageJson = (variant) =>
  JSON.stringify(
    {
      name: variant.dir,
      version: "1.0.0",
      description: `4K looping ${variant.key} hazard symbol, built with Remotion.`,
      license: "UNLICENSED",
      private: true,
      scripts: {
        dev: "remotion studio",
        build: "remotion bundle",
        render: `remotion render ${variant.compositionId} out/${variant.output}.mp4 --codec=h264 --crf=12 --concurrency=8`,
        typecheck: "tsc",
      },
      dependencies: {
        "@remotion/cli": "4.0.515",
        react: "19.2.3",
        "react-dom": "19.2.3",
        remotion: "4.0.515",
        // Pinned, not ranged: a standalone zip ships no lockfile, and Remotion
        // requires the exact zod version it was built against.
        zod: "4.4.3",
      },
      devDependencies: {
        "@types/react": "19.2.7",
        "@types/web": "0.0.166",
        typescript: "5.9.3",
      },
    },
    null,
    2,
  ) + "\n";

const rootTsx = (variant) => `import { Composition } from "remotion";
import { HazardSymbol, hazardSymbolSchema } from "./hazard/HazardSymbol";
import { WIDTH, HEIGHT, FPS, LOOP_FRAMES } from "./hazard/constants";

export const RemotionRoot: React.FC = () => {
  return (
    <Composition
      id="${variant.compositionId}"
      component={HazardSymbol}
      durationInFrames={LOOP_FRAMES}
      fps={FPS}
      width={WIDTH}
      height={HEIGHT}
      schema={hazardSymbolSchema}
      defaultProps={{ variant: "${variant.key}" as const }}
    />
  );
};
`;

const readme = (variant) => `# ${variant.title}

A 4K, seamlessly looping hazard-symbol animation built with
[Remotion](https://remotion.dev).

| | |
| --- | --- |
| Composition id | \`${variant.compositionId}\` |
| Resolution | 3840 x 2160 (4K UHD) |
| Duration | 600 frames — 20.0 seconds |
| Frame rate | 30 fps |
| Loops | Yes, seamlessly |
| Audio | None |

## Looping

The composition is a true loop: frame 0 and frame 600 are pixel-identical, so
it can be repeated with no visible seam. Every animated quantity — the two
noise bands of the energy fill, the ring's breathing, the rim glow's pulse, the
assembly's drift, the plate's light and the film grain — is a pure function of
\`frame % 600\` and uses a whole number of cycles per loop. The flare schedule
is laid out around the loop rather than along a timeline, so the gap from the
last flare back to the first obeys the same spacing rule as every other gap.

Nothing uses \`Math.random\`, \`Date.now\`, \`requestAnimationFrame\`, CSS
animation or component state, so frames may be rendered out of order across
workers and the render is reproducible.

## The symbol

This piece draws ${variant.symbol}. Both the radiation trefoil and the
biohazard mark are public-domain international safety symbols: neither carries
trademark restrictions, and their proportions are standardised rather than
stylised, so they are reproduced faithfully here.

${variant.shimmer} ${variant.flares}

## Rendering

Install once:

\`\`\`sh
npm install
\`\`\`

Render at full 4K:

\`\`\`sh
npx remotion render ${variant.compositionId} out/${variant.output}.mp4 --codec=h264 --crf=12 --concurrency=8
\`\`\`

\`--concurrency\` must not exceed your CPU core count; lower it if Remotion
rejects the value. Add \`--muted\` to omit the silent audio track that Remotion
writes by default.

A faster 1080p preview:

\`\`\`sh
npx remotion render ${variant.compositionId} out/${variant.output}-preview.mp4 --codec=h264 --crf=18 --scale=0.5
\`\`\`

Open the interactive editor with \`npm run dev\`.

## Layout

\`\`\`
src/
  index.ts                 Remotion entry point
  Root.tsx                 registers the composition
  hazard/
    HazardSymbol.tsx       orchestrator: owns the canvas and the finishing passes
    constants.ts           geometry and timing
    variants.ts            the only place a colour literal appears
    SymbolShape.tsx        the only module that knows which symbol is drawn
    OuterRing.tsx          the dark disc and the glowing ring
  lib/remotion-lib/        vendored shared components (see PROVENANCE.md)
\`\`\`
`;

const configTs = `/**
 * All configuration options: https://remotion.dev/docs/config
 */

import { Config } from "@remotion/cli/config";

Config.setRspack(true);
Config.setVideoImageFormat("jpeg");
Config.setOverwriteOutput(true);
`;

rmSync(stagingRoot, { recursive: true, force: true });
mkdirSync(stagingRoot, { recursive: true });

for (const variant of VARIANTS) {
  const stage = join(stagingRoot, variant.dir);
  mkdirSync(join(stage, "src"), { recursive: true });
  mkdirSync(join(stage, "public"), { recursive: true });

  cpSync(join(root, "src/hazard"), join(stage, "src/hazard"), { recursive: true });
  cpSync(join(root, "src/lib"), join(stage, "src/lib"), { recursive: true });
  cpSync(join(root, "src/index.ts"), join(stage, "src/index.ts"));
  cpSync(join(root, "tsconfig.json"), join(stage, "tsconfig.json"));

  writeFileSync(join(stage, "src/Root.tsx"), rootTsx(variant));
  writeFileSync(join(stage, "package.json"), packageJson(variant));
  writeFileSync(join(stage, "remotion.config.ts"), configTs);
  writeFileSync(join(stage, "README.md"), readme(variant));
  writeFileSync(
    join(stage, ".gitignore"),
    ["node_modules", "out", ".DS_Store", ".env", ""].join("\n"),
  );
  writeFileSync(
    join(stage, "public/.gitkeep"),
    "This composition loads no assets; the folder is here for ones you add.\n",
  );

  const zipPath = join(root, `${variant.dir}.zip`);
  rmSync(zipPath, { force: true });
  execFileSync("zip", ["-r", "-q", zipPath, variant.dir], { cwd: stagingRoot });
  console.log(`built ${variant.dir}.zip`);
}
