/**
 * Builds the two standalone, independently runnable Remotion projects.
 *
 * Each output contains only one variant: the shared two-key VARIANTS object is
 * cut down to the single key that project needs, using the region markers in
 * ShieldStatus.tsx, and Root.tsx registers only that composition.
 */

import { execFileSync } from "node:child_process";
import { cpSync, mkdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const BUILD = join(ROOT, "build");

const VARIANTS = {
  active: {
    dir: "shield-active",
    compId: "ShieldActive",
    outName: "shield-active",
    title: "Shield Status HUD — ACTIVE",
    loops: true,
  },
  breach: {
    dir: "shield-breach",
    compId: "ShieldBreach",
    outName: "shield-breach",
    title: "Shield Status HUD — BREACH",
    loops: false,
  },
};

const stripOtherVariant = (source, keep) => {
  const drop = keep === "active" ? "breach" : "active";
  const start = source.indexOf(`/* #region variant:${drop} */`);
  const endMarker = `/* #endregion variant:${drop} */`;
  const end = source.indexOf(endMarker);
  if (start < 0 || end < 0) throw new Error(`variant markers for ${drop} not found`);
  let out = source.slice(0, start) + source.slice(end + endMarker.length);
  out = out.replace(
    'export type VariantName = "active" | "breach";',
    `export type VariantName = "${keep}";`,
  );
  // Tidy the blank line the removed region leaves behind.
  return out.replace(/\n[ \t]*\n[ \t]*\/\* #region/g, "\n  /* #region");
};

const PACKAGE_JSON = (name) =>
  JSON.stringify(
    {
      name,
      version: "1.0.0",
      description: "4K shield status HUD, rendered on canvas with Remotion",
      license: "UNLICENSED",
      private: true,
      dependencies: {
        "@remotion/cli": "4.0.515",
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
        lint: "tsc",
      },
    },
    null,
    2,
  ) + "\n";

const TSCONFIG =
  JSON.stringify(
    {
      compilerOptions: {
        target: "ES2018",
        module: "Preserve",
        moduleResolution: "Bundler",
        jsx: "react-jsx",
        strict: true,
        noEmit: true,
        lib: ["es2015"],
        esModuleInterop: true,
        skipLibCheck: true,
        forceConsistentCasingInFileNames: true,
        noUnusedLocals: true,
      },
      exclude: ["remotion.config.ts"],
    },
    null,
    2,
  ) + "\n";

const REMOTION_CONFIG = `/**
 * Note: when using the Node.JS APIs, this config file does not apply.
 * Pass the options directly to the APIs instead.
 *
 * All configuration options: https://remotion.dev/docs/config
 */

import { Config } from "@remotion/cli/config";

Config.setVideoImageFormat("jpeg");
Config.setOverwriteOutput(true);
// The piece has no audio; this keeps a silent track out of the output.
Config.setMuted(true);
`;

const rootTsx = (v) => `import { Composition } from "remotion";
import { ShieldStatus } from "./shield/ShieldStatus";

export const RemotionRoot: React.FC = () => {
  return (
    <Composition
      id="${v.compId}"
      component={ShieldStatus}
      durationInFrames={900}
      fps={30}
      width={3840}
      height={2160}
      defaultProps={{ variant: "${v.key}" as const }}
    />
  );
};
`;

const readme = (v) => `# ${v.title}

A 4K "shield status HUD" built entirely on a 2D \`<canvas>\` with Remotion.
No 3D, no Three.js, no WebGL — one affine-transformed plane, three offscreen
depth buffers, and a heavy condensed sans over a field of fictional code.

## The composition

| | |
| --- | --- |
| Composition id | \`${v.compId}\` |
| Resolution | **3840 x 2160 (4K UHD)** |
| Duration | 900 frames |
| Frame rate | 30 fps (30.0 seconds) |
| Loops? | **${v.loops ? "Yes" : "No"}** — ${
  v.loops
    ? "frame 0 and frame 900 are pixel-identical, so it can be played back to back seamlessly."
    : "this version is a one-shot. Data cards go dark permanently and code panels corrupt as the piece progresses, so frame 900 differs from frame 0 by design. Do not loop it."
} |

## Render

Install once:

\`\`\`sh
npm install
\`\`\`

Full 4K render:

\`\`\`sh
npx remotion render ${v.compId} out/${v.outName}.mp4 --codec=h264 --crf=12 --concurrency=8
\`\`\`

A quick 1080p preview (same composition, captured at half scale):

\`\`\`sh
npx remotion render ${v.compId} out/${v.outName}-preview.mp4 --codec=h264 --crf=18 --scale=0.5
\`\`\`

Interactive preview:

\`\`\`sh
npm run dev
\`\`\`

## How it is put together

* **One tilted plane.** A single \`ctx.setTransform()\` rotates by -16 degrees and
  shears so the right side compresses about 8%. Parallel lines stay parallel —
  it is deliberately not a perspective projection. The plane's local y axis is
  the depth proxy: lower-left is near, upper-right is far.
* **Depth of field.** Elements are bucketed into three offscreen buffers — near,
  mid and far — and each buffer is blurred exactly once with
  \`ctx.filter = 'blur(Npx)'\` on the way in. Per-element blurring would be
  unusably slow at 4K. Near and far render at half resolution; the focal band
  around the shield renders full size and sharp.
* **Deterministic by construction.** Every value is a pure function of
  \`useCurrentFrame()\`. No \`Date.now()\`, no \`requestAnimationFrame\`, no CSS
  animation, no component state. All randomness goes through Remotion's
  \`random()\` with stable string seeds.${
    v.loops
      ? "\n  Every animation period divides 900, the surround tiles along the drift axis\n  and translates by exactly one tile over the 900 frames, the outline sweep\n  completes exactly three circuits, and no glitch event straddles the seam."
      : ""
  }
* **Prerendered texture.** Each code panel and data card is laid out once into a
  small offscreen canvas and then blitted with transforms. Only the rerolling
  values are drawn per frame.
* **Fictional content.** All the code in the panels is invented — made-up
  function names, variables and comments. Nothing is reproduced from any real
  library and there are no copyright headers, logos or watermarks. No audio.

## Fonts

IBM Plex Mono and Barlow Condensed, both under the SIL Open Font License, are
self-hosted from \`public/fonts\` rather than fetched at render time. Loading is
gated with \`delayRender()\`/\`continueRender()\`, so no frame is ever captured
against a fallback face and the project renders with no network access.

## Layout

\`\`\`
src/
  index.ts                 registerRoot
  Root.tsx                 registers ${v.compId} only
  shield/
    ShieldStatus.tsx       VARIANTS, the five components, the frame pipeline
    plane.ts               the plane transform, depth buckets, buffers
    shieldPath.ts          the shield outline, sampled with arc lengths
    layout.ts              the seeded surround: panels, cards, rows, points
    fonts.ts               font loading, gated with delayRender
public/fonts/              the two self-hosted woff2 faces
\`\`\`
`;

const SHIELD_FILES = [
  "ShieldStatus.tsx",
  "plane.ts",
  "shieldPath.ts",
  "layout.ts",
  "fonts.ts",
];

const zip = (dir, name) => {
  try {
    execFileSync("zip", ["-r", "-q", join(BUILD, name), dir], { cwd: BUILD });
    return "zip";
  } catch {
    execFileSync(
      "python3",
      ["-m", "zipfile", "-c", join(BUILD, name), dir],
      { cwd: BUILD },
    );
    return "python3 -m zipfile";
  }
};

rmSync(BUILD, { recursive: true, force: true });
mkdirSync(BUILD, { recursive: true });

const source = readFileSync(join(ROOT, "src/shield/ShieldStatus.tsx"), "utf8");

for (const [key, meta] of Object.entries(VARIANTS)) {
  const v = { ...meta, key };
  const dest = join(BUILD, v.dir);
  mkdirSync(join(dest, "src/shield"), { recursive: true });
  mkdirSync(join(dest, "public/fonts"), { recursive: true });

  for (const file of SHIELD_FILES) {
    const from = join(ROOT, "src/shield", file);
    const text =
      file === "ShieldStatus.tsx"
        ? stripOtherVariant(source, key)
        : readFileSync(from, "utf8");
    writeFileSync(join(dest, "src/shield", file), text);
  }

  writeFileSync(join(dest, "src/index.ts"), readFileSync(join(ROOT, "src/index.ts")));
  writeFileSync(join(dest, "src/Root.tsx"), rootTsx(v));
  writeFileSync(join(dest, "package.json"), PACKAGE_JSON(v.dir));
  writeFileSync(join(dest, "tsconfig.json"), TSCONFIG);
  writeFileSync(join(dest, "remotion.config.ts"), REMOTION_CONFIG);
  writeFileSync(join(dest, "README.md"), readme(v));
  writeFileSync(
    join(dest, ".gitignore"),
    ["node_modules", "out", "dist", ".DS_Store", ""].join("\n"),
  );

  for (const font of [
    "IBMPlexMono-Regular-latin.woff2",
    "IBMPlexMono-Medium-latin.woff2",
    "BarlowCondensed-Bold-latin.woff2",
  ]) {
    cpSync(join(ROOT, "public/fonts", font), join(dest, "public/fonts", font));
  }

  const how = zip(v.dir, `${v.dir}.zip`);
  console.log(`built build/${v.dir}.zip (via ${how})`);
}
