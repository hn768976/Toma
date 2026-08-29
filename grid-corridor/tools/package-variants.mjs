/**
 * Builds one self-contained, independently runnable Remotion project per
 * variant, and zips each. Every zip contains only its own composition, with
 * that variant's data inlined rather than importing a shared three-key object.
 *
 *   node tools/package-variants.mjs
 */
import { execFileSync } from "node:child_process";
import {
  cpSync,
  mkdirSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const stage = join(root, "dist-zips");

const VARIANTS = [
  {
    name: "teal",
    compositionId: "GridCorridorTeal",
    project: "grid-corridor-teal",
    output: "corridor-teal",
    blurb:
      "A teal molecular corridor: four tilted grid planes meeting at soft " +
      "seams, scattered with invented code blocks and molecular diagrams. " +
      "The camera rolls clockwise and the contents drift up-left.",
  },
  {
    name: "amber",
    compositionId: "GridCorridorAmber",
    project: "grid-corridor-amber",
    output: "corridor-amber",
    blurb:
      "The same corridor mirrored: the plane angles, the roll and the drift " +
      "are all negated, so the corners fall on the opposite side of frame. " +
      "Circuit schematics replace the molecules and half the type layer is " +
      "mathematical notation.",
  },
  {
    name: "green",
    compositionId: "GridCorridorGreen",
    project: "grid-corridor-green",
    output: "corridor-green",
    blurb:
      "No corridor and no grid: one flat wall of dense monospace scrolling " +
      "steadily upward, with larger molecular diagrams and node dots floating " +
      "softly in front of it. The camera holds.",
  },
];

const section = (source, tag) => {
  const open = `/* @${tag} */`;
  const close = `/* @end:${tag.split(":").pop()} */`;
  const from = source.indexOf(open);
  const to = source.indexOf(close);
  if (from < 0 || to < 0) throw new Error(`missing section ${tag}`);
  return {
    from,
    to: to + close.length,
    body: source.slice(from + open.length, to).trim(),
  };
};

/**
 * Strips the shared constants the single-variant project no longer references.
 * The header is a sequence of blank-line separated blocks, so a block that
 * declares an unreferenced const can simply be dropped whole, comment and all.
 */
const dropUnusedConsts = (header, names, usedIn) =>
  header
    .split("\n\n")
    .filter(
      (block) =>
        !names.some(
          (name) => block.includes(`const ${name}`) && !usedIn.includes(name),
        ),
    )
    .join("\n\n");

/** variants.ts with a single variant inlined and no registry. */
const buildVariantsModule = (source, name) => {
  let header = source.slice(0, source.indexOf("/* @variant:teal */")).trimEnd();
  const chosen = section(source, `variant:${name}`).body;
  const inlined = chosen.replace(
    new RegExp(
      `export const ${name.toUpperCase()}_VARIANT: VariantConfig = \\{`,
    ),
    "export const VARIANT: VariantConfig = {",
  );
  header = dropUnusedConsts(
    header,
    ["CORRIDOR_PLANES", "CORRIDOR_BUCKETS", "WALL_BUCKETS", "GLOW_BUCKET"],
    inlined,
  );
  const narrowed = header
    .replace(
      /export type VariantName =[^;]+;/,
      `export type VariantName = "${name}";`,
    )
    .trimEnd();
  return `${narrowed}

/** This project ships one version. Its data is inlined here. */
${inlined}

export const getVariant = (_name?: VariantName): VariantConfig => VARIANT;
`;
};

const buildRoot = (variant) => `import React from "react";
import { Composition } from "remotion";
import { DURATION_IN_FRAMES, FPS, HEIGHT, WIDTH } from "./constants";
import { GridCorridor } from "./GridCorridor";

export const RemotionRoot: React.FC = () => {
  return (
    <Composition
      id="${variant.compositionId}"
      component={GridCorridor}
      durationInFrames={DURATION_IN_FRAMES}
      fps={FPS}
      width={WIDTH}
      height={HEIGHT}
      defaultProps={{ variant: "${variant.name}" as const }}
    />
  );
};
`;

/**
 * The working project pins a sandbox-specific browser path; a delivered
 * project should not carry that, so it gets a clean config.
 */
const REMOTION_CONFIG = `/**
 * Note: when using the Node.JS APIs this config file does not apply.
 * All configuration options: https://remotion.dev/docs/config
 */
import { Config } from "@remotion/cli/config";

Config.setVideoImageFormat("jpeg");
Config.setOverwriteOutput(true);
Config.setChromiumOpenGlRenderer("angle");
// The piece has no audio, so no silent track is written.
Config.setMuted(true);
Config.setEnforceAudioTrack(false);
`;

const buildReadme = (variant) => `# ${variant.project}

${variant.blurb}

| | |
| --- | --- |
| Composition id | \`${variant.compositionId}\` |
| Resolution | 3840 x 2160 (4K UHD) |
| Duration | 360 frames at 30 fps — 12.0 seconds |
| Loop | Seamless. Frame 0 and frame 360 are pixel-identical. |

This is a 4K composition. Everything in it is a pure function of
\`useCurrentFrame()\`, and all randomness comes from Remotion's \`random()\`
with stable string seeds, so renders are deterministic and repeatable.

## Install

\`\`\`
npm install
\`\`\`

## Preview

\`\`\`
npx remotion studio
\`\`\`

## Render at 4K

\`\`\`
npx remotion render ${variant.compositionId} out/${variant.output}.mp4 --codec=h264 --crf=12 --concurrency=8
\`\`\`

A faster 1080p check, if you want one first:

\`\`\`
npx remotion render ${variant.compositionId} out/${variant.output}-preview.mp4 --codec=h264 --crf=18 --scale=0.5
\`\`\`

## Notes

- 2D canvas only. No 3D, no WebGL, no CSS animation, no \`requestAnimationFrame\`.
- The monospace face is loaded through \`@remotion/google-fonts\`, gated with
  \`delayRender()\` / \`continueRender()\`. A copy of the same face is vendored in
  \`public/fonts/\` so a render host with no access to the font CDN still gets
  Roboto Mono rather than a substitute.
- Depth of field is done with offscreen buffers blurred once each, never per
  element — at 4K, per-element blurring is not viable.
`;

/** The working lockfile, renamed so `npm ci` matches this project. */
const buildLockfile = (variant) => {
  const lock = JSON.parse(
    readFileSync(join(root, "package-lock.json"), "utf8"),
  );
  lock.name = variant.project;
  if (lock.packages?.[""]) lock.packages[""].name = variant.project;
  return `${JSON.stringify(lock, null, 2)}\n`;
};

const buildPackageJson = (variant) => {
  const base = JSON.parse(readFileSync(join(root, "package.json"), "utf8"));
  return `${JSON.stringify(
    {
      ...base,
      name: variant.project,
      description: `4K "${variant.name}" grid corridor animation (Remotion)`,
      scripts: {
        ...base.scripts,
        render: `remotion render ${variant.compositionId} out/${variant.output}.mp4 --codec=h264 --crf=12 --concurrency=8`,
      },
    },
    null,
    2,
  )}\n`;
};

rmSync(stage, { recursive: true, force: true });
mkdirSync(stage, { recursive: true });

const variantsSource = readFileSync(join(root, "src", "variants.ts"), "utf8");

for (const variant of VARIANTS) {
  const dir = join(stage, variant.project);
  mkdirSync(dir, { recursive: true });

  cpSync(join(root, "src"), join(dir, "src"), { recursive: true });
  cpSync(join(root, "public"), join(dir, "public"), { recursive: true });
  for (const file of ["tsconfig.json", ".gitignore"]) {
    cpSync(join(root, file), join(dir, file));
  }
  writeFileSync(join(dir, "remotion.config.ts"), REMOTION_CONFIG);
  writeFileSync(join(dir, "package-lock.json"), buildLockfile(variant));

  writeFileSync(
    join(dir, "src", "variants.ts"),
    buildVariantsModule(variantsSource, variant.name),
  );
  writeFileSync(join(dir, "src", "Root.tsx"), buildRoot(variant));
  writeFileSync(join(dir, "package.json"), buildPackageJson(variant));
  writeFileSync(join(dir, "README.md"), buildReadme(variant));

  const zip = join(root, `${variant.project}.zip`);
  rmSync(zip, { force: true });
  // node_modules, out and .git are never staged, so nothing to exclude.
  execFileSync("zip", ["-rq", zip, variant.project], { cwd: stage });
  console.log(`packaged ${variant.project}.zip`);
}
