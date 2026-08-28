// Builds one self-contained Remotion project per shield HUD variant and zips
// each of them. Every package carries only its own variant's data, its own
// composition, and no trace of the other two.
//
//   node tools/build-shield-hud-packages.mjs
//
// Output: packages/shield-hud-<variant>/ and packages/shield-hud-<variant>.zip

import { cpSync, mkdirSync, readdirSync, rmSync, writeFileSync } from "node:fs";
import { execFileSync } from "node:child_process";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const projectRoot = join(dirname(fileURLToPath(import.meta.url)), "..");
const sourceDir = join(projectRoot, "src", "shield-hud");
const outputRoot = join(projectRoot, "packages");

const REMOTION_VERSION = "4.0.515";

const VARIANTS = [
  {
    key: "blue",
    constant: "BLUE",
    composition: "ShieldHudBlue",
    output: "shield-blue",
    title: 'v1 "blue" — intact shield, magenta accents',
    description:
      "A heraldic shield outline in deep navy, swept by a bright head that " +
      "leaves a decaying trail, over three steady readout columns.",
  },
  {
    key: "green",
    constant: "GREEN",
    composition: "ShieldHudGreen",
    output: "shield-green",
    title: 'v2 "green" — guard shield with an inner keyhole, denser panels',
    description:
      "A guard shield in near-black green — flat across a wide top, tapering " +
      "to a narrow tip — carrying a small keyhole inside it, with amber " +
      "accents, four busy readout columns, a scrolling log strip and a " +
      "three-circuit sweep.",
  },
  {
    key: "breach",
    constant: "BREACH",
    composition: "ShieldHudBreach",
    output: "shield-breach",
    title: 'v3 "breach" — fractured shield, failing panels',
    description:
      "The shield again, but broken: gaps in the outline, frayed ends, an " +
      "interior crack, a stuttering sweep, failing panels and slice tears.",
  },
];

const packageJson = (name) =>
  `${JSON.stringify(
    {
      name,
      version: "1.0.0",
      description: "Neon shield HUD — 4K Remotion composition",
      license: "UNLICENSED",
      private: true,
      scripts: {
        dev: "remotion studio",
        build: "remotion bundle",
        lint: "tsc",
      },
      dependencies: {
        "@remotion/cli": REMOTION_VERSION,
        "@remotion/google-fonts": REMOTION_VERSION,
        react: "19.2.3",
        "react-dom": "19.2.3",
        remotion: REMOTION_VERSION,
      },
      devDependencies: {
        "@types/react": "19.2.7",
        "@types/web": "0.0.166",
        typescript: "5.9.3",
      },
    },
    null,
    2,
  )}\n`;

const tsconfig = `${JSON.stringify(
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
)}\n`;

const remotionConfig = `import { Config } from "@remotion/cli/config";

Config.setVideoImageFormat("jpeg");
Config.setOverwriteOutput(true);
`;

const rootTsx = (variant) => `import { Composition } from "remotion";
import { ShieldHud } from "./shield-hud/ShieldHud";
import {
  DURATION_IN_FRAMES,
  FPS,
  HEIGHT,
  WIDTH,
} from "./shield-hud/constants";

export const RemotionRoot: React.FC = () => {
  return (
    <Composition
      id="${variant.composition}"
      component={ShieldHud}
      durationInFrames={DURATION_IN_FRAMES}
      fps={FPS}
      width={WIDTH}
      height={HEIGHT}
      defaultProps={{ variant: "${variant.key}" as const }}
    />
  );
};
`;

const indexTs = `import { registerRoot } from "remotion";
import { RemotionRoot } from "./Root";

registerRoot(RemotionRoot);
`;

const variantsIndex = (variant) => `import { ${variant.constant} } from "./${variant.key}";
import type { Variant } from "./types";

export * from "./types";

export type VariantKey = "${variant.key}";

/**
 * This project ships one version. Its palette, centre glyph path, glyph
 * integrity mode, panel density, panel behaviour and sweep mode all live in
 * ./${variant.key}.ts — nothing else in the project carries a hex value or a
 * glyph shape.
 */
export const VARIANTS: Record<VariantKey, Variant> = {
  ${variant.key}: ${variant.constant},
};
`;

const readme = (variant) => `# Neon shield HUD — ${variant.title}

${variant.description}

| | |
| --- | --- |
| Composition id | \`${variant.composition}\` |
| Resolution | 3840 x 2160 (4K UHD) |
| Duration | 330 frames — 11.0 seconds |
| Frame rate | 30 fps |
| Loop | Seamless: frame 330 is pixel-identical to frame 0 |

## Running it

\`\`\`bash
npm install
npm run dev        # Remotion Studio
\`\`\`

## Rendering at 4K

\`\`\`bash
npx remotion render ${variant.composition} out/${variant.output}.mp4 --codec=h264 --crf=12 --concurrency=8
\`\`\`

The composition is 4K, so this renders 3840x2160 with no scaling. For a
quicker 1080p check, add \`--scale=0.5\`.

## How it is put together

Everything is drawn to a single 3840x2160 canvas through a ref, once per
React render — no requestAnimationFrame, no component state, no CSS
animation. Every value is a pure function of \`useCurrentFrame()\`, and all
randomness comes from Remotion's \`random()\` with stable string seeds, so
renders are deterministic and the loop closes exactly.

- \`src/shield-hud/variants/\` — the version's palette, glyph path, integrity
  mode, panel density, panel behaviour and sweep mode.
- \`src/shield-hud/components/\` — \`BackgroundLayer\`, \`ReadoutColumn\`,
  \`AccentBar\`, \`BracketMarks\`, \`LogStrip\`, \`CentreGlyph\`, \`SweepHead\`.
- \`src/shield-hud/ShieldHud.tsx\` — clears the depth buffers, then composites
  them with one blur each: three depth buckets, the accent bloom, and the
  glyph's own bloom over the sharp copy.

The readout font is IBM Plex Mono, loaded through \`@remotion/google-fonts\`
and gated with \`delayRender()\` / \`continueRender()\`, so no frame is captured
before the face is available. Rendering therefore needs network access to
Google Fonts on first run.
`;

rmSync(outputRoot, { recursive: true, force: true });
mkdirSync(outputRoot, { recursive: true });

for (const variant of VARIANTS) {
  const name = `shield-hud-${variant.key}`;
  const dir = join(outputRoot, name);
  const src = join(dir, "src");

  mkdirSync(join(src, "shield-hud"), { recursive: true });
  mkdirSync(join(dir, "public"), { recursive: true });

  // The engine copies over verbatim; only the variant data differs.
  for (const entry of readdirSync(sourceDir, { withFileTypes: true })) {
    if (entry.name === "variants") continue;
    cpSync(join(sourceDir, entry.name), join(src, "shield-hud", entry.name), {
      recursive: true,
    });
  }

  const variantsDir = join(src, "shield-hud", "variants");
  mkdirSync(variantsDir, { recursive: true });
  cpSync(join(sourceDir, "variants", "types.ts"), join(variantsDir, "types.ts"));
  cpSync(
    join(sourceDir, "variants", `${variant.key}.ts`),
    join(variantsDir, `${variant.key}.ts`),
  );
  writeFileSync(join(variantsDir, "index.ts"), variantsIndex(variant));

  writeFileSync(join(src, "Root.tsx"), rootTsx(variant));
  writeFileSync(join(src, "index.ts"), indexTs);
  writeFileSync(join(dir, "package.json"), packageJson(name));
  writeFileSync(join(dir, "tsconfig.json"), tsconfig);
  writeFileSync(join(dir, "remotion.config.ts"), remotionConfig);
  writeFileSync(join(dir, "README.md"), readme(variant));
  writeFileSync(join(dir, ".gitignore"), "node_modules\nout\n.DS_Store\n");
  writeFileSync(
    join(dir, "public", ".gitkeep"),
    "# Remotion serves this directory via staticFile(); nothing is needed here.\n",
  );

  execFileSync("zip", ["-r", "-q", `${name}.zip`, name], { cwd: outputRoot });
  console.log(`built ${name}.zip`);
}
