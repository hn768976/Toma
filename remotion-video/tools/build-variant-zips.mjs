/**
 * Packages each variant as a standalone, independently runnable Remotion
 * project. Every zip carries only its own version: its Root.tsx registers a
 * single composition and its variants.ts holds that variant's data inlined
 * rather than a shared two-key lookup.
 *
 *   node tools/build-variant-zips.mjs
 */
import { execFileSync } from "node:child_process";
import { cpSync, mkdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const stage = join(root, "dist-variants");
const src = join(root, "src", "crypto-hud");

const VARIANTS = [
  {
    key: "cyan",
    zip: "crypto-hud-cyan.zip",
    dir: "crypto-hud-cyan",
    compositionId: "CryptoHudCyan",
    outName: "crypto-hud-cyan",
    title: "Crypto Symbol HUD — Cyan (Bitcoin)",
    blurb:
      "A glowing Bitcoin mark inside six continuously ticked, counter-rotating\nring bands, over a sparse field of mixed-hue bokeh.",
  },
  {
    key: "blue",
    zip: "crypto-hud-blue.zip",
    dir: "crypto-hud-blue",
    compositionId: "CryptoHudBlue",
    outName: "crypto-hud-blue",
    title: "Crypto Symbol HUD — Blue (generic token)",
    blurb:
      "An invented hexagonal token mark inside eight bands of broken arcs, over a\ndense field of mixed-hue bokeh. The composition is mirrored, so the mark sits\nright of centre with the rings extending left.",
  },
];

/** Rewrites variants.ts so only the requested variant's data is present. */
const inlineVariant = (source, key) => {
  const other = key === "cyan" ? "blue" : "cyan";
  const otherBands = key === "cyan" ? "BLUE_BANDS" : "CYAN_BANDS";

  // Drop the other variant's band array.
  const otherBandsStart = source.indexOf(`const ${otherBands}: BandSpec[] = [`);
  const otherBandsEnd = source.indexOf("\n];\n", otherBandsStart) + 4;
  let out = source.slice(0, otherBandsStart) + source.slice(otherBandsEnd);

  // Replace the two-key record with this variant's config alone.
  const recordStart = out.indexOf("export const VARIANTS:");
  const body = out.slice(recordStart);
  const keyStart = body.indexOf(`  ${key}: {`);
  const keyEnd = body.indexOf(`  ${other}: {`);
  const block =
    keyEnd > keyStart
      ? body.slice(keyStart, keyEnd)
      : body.slice(keyStart, body.lastIndexOf("};"));
  const inner = block
    .replace(`  ${key}: {`, "")
    .replace(/\s*\},\s*$/, "")
    .split("\n")
    .map((line) => (line.startsWith("    ") ? line.slice(2) : line))
    .join("\n");

  out =
    out.slice(0, recordStart) +
    `/** This project ships one variant; its data is inlined here. */\nexport const VARIANT: VariantConfig = {${inner}\n};\n`;

  // VariantName only existed to key the shared record.
  out = out.replace('export type VariantName = "cyan" | "blue";\n', "");
  return out.replace(
    "Every colour, geometry and behaviour switch that separates the two versions\n * lives in this file.",
    "Every colour, geometry and behaviour switch this piece has lives in this\n * file.",
  );
};

/** Drops the `variant` prop, since there is only one variant to select. */
const inlineHud = (source) => {
  const replacements = [
    [
      'import { VARIANTS, type VariantConfig, type VariantName } from "./variants";',
      'import { VARIANT, type VariantConfig } from "./variants";',
    ],
    [
      "export type CryptoHudProps = { variant: VariantName };\n\nexport const CryptoHud: React.FC<CryptoHudProps> = ({ variant }) => {\n  const cfg = VARIANTS[variant];",
      "export const CryptoHud: React.FC = () => {\n  const cfg = VARIANT;",
    ],
  ];
  let out = source;
  for (const [from, to] of replacements) {
    if (!out.includes(from)) {
      throw new Error(`CryptoHud.tsx no longer contains:\n${from}`);
    }
    out = out.replace(from, to);
  }
  return out;
};

const rootTsx = (v) => `import { Composition } from "remotion";
import { CryptoHud } from "./crypto-hud/CryptoHud";
import {
  CANVAS_H,
  CANVAS_W,
  DURATION,
  FPS,
} from "./crypto-hud/layout";

export const RemotionRoot: React.FC = () => {
  return (
    <Composition
      id="${v.compositionId}"
      component={CryptoHud}
      durationInFrames={DURATION}
      fps={FPS}
      width={CANVAS_W}
      height={CANVAS_H}
    />
  );
};
`;

const indexTs = `import { registerRoot } from "remotion";
import { RemotionRoot } from "./Root";

registerRoot(RemotionRoot);
`;

const packageJson = (v) =>
  `${JSON.stringify(
    {
      name: v.dir,
      version: "1.0.0",
      description: v.title,
      license: "UNLICENSED",
      private: true,
      scripts: {
        dev: "remotion studio",
        render: `remotion render ${v.compositionId} out/${v.outName}.mp4 --codec=h264 --crf=12 --concurrency=8`,
        lint: "tsc",
      },
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

const remotionConfig = `/**
 * Note: When using the Node.JS APIs, the config file doesn't apply. Instead,
 * pass options directly to the APIs.
 *
 * All configuration options: https://remotion.dev/docs/config
 */

import { Config } from "@remotion/cli/config";

Config.setVideoImageFormat("jpeg");
Config.setOverwriteOutput(true);
`;

const readme = (v) => `# ${v.title}

${v.blurb}

## The composition

| | |
| --- | --- |
| Composition id | \`${v.compositionId}\` |
| Resolution | **3840 x 2160 (4K UHD)** |
| Duration | 900 frames |
| Frame rate | 30 fps |
| Length | 30.0 seconds |
| Loop | Seamless — frame 900 is pixel-identical to frame 0 |

Every ring band completes a whole number of turns across the 900 frames, every
bokeh disc travels a closed path, and the glow pulse and scan-band texture both
wrap, so the clip can be looped end to end with no visible seam.

## Render at 4K

\`\`\`bash
npm install
npx remotion render ${v.compositionId} out/${v.outName}.mp4 --codec=h264 --crf=12 --concurrency=8
\`\`\`

Lower \`--concurrency\` if your machine has fewer cores than the value you pass;
Remotion rejects a concurrency higher than the available CPU count.

For a faster 1080p check, add \`--scale=0.5\`. Note that the canvas backing store
stays 3840 x 2160 regardless of \`--scale\`, so a half-scale render costs about
the same per frame as a full one.

## Preview in the studio

\`\`\`bash
npm run dev
\`\`\`

## How it is built

Everything is drawn to a single 2D canvas — no 3D, no WebGL, no Three.js.

- \`src/crypto-hud/variants.ts\` — the one place any colour, ring band or
  behaviour switch is defined. No hex literal lives anywhere else.
- \`src/crypto-hud/SymbolGlyph.tsx\` — the mark, drawn as a path (not a font
  glyph), carrying a drifting scan-band texture and a chromatic fringe made of
  three offset copies composited with \`lighter\`.
- \`src/crypto-hud/RingBand.tsx\` — each band's ticks, dashes and blocks are
  stamped to a sprite once and blitted with a rotation transform, so nothing is
  re-stroked per frame. Bands alternate direction.
- \`src/crypto-hud/BokehField.tsx\` — soft discs at three depths in mixed hues,
  with a subset drawn in front of the symbol so they partially occlude it.
- \`src/crypto-hud/CryptoHud.tsx\` — buckets everything into three depth buffers
  and blurs each exactly once. Bloom is baked into the sprites at mount rather
  than blurred per frame.

All motion comes from \`useCurrentFrame()\` and all randomness from Remotion's
\`random()\` with stable string seeds, so renders are deterministic and every
frame is a pure function of its frame number.

No audio, no watermark${v.key === "cyan" ? ".\n\nThe Bitcoin symbol is a community mark in general commercial use, not a\ncorporate trademark." : ", and the token mark is invented — it belongs to no\nexisting project, so the footage carries no dependency on anyone's branding."}
`;

rmSync(stage, { recursive: true, force: true });
mkdirSync(stage, { recursive: true });

for (const v of VARIANTS) {
  const dest = join(stage, v.dir);
  mkdirSync(join(dest, "src", "crypto-hud"), { recursive: true });
  mkdirSync(join(dest, "public"), { recursive: true });

  cpSync(src, join(dest, "src", "crypto-hud"), { recursive: true });
  writeFileSync(
    join(dest, "src", "crypto-hud", "variants.ts"),
    inlineVariant(readFileSync(join(src, "variants.ts"), "utf8"), v.key),
  );
  writeFileSync(
    join(dest, "src", "crypto-hud", "CryptoHud.tsx"),
    inlineHud(readFileSync(join(src, "CryptoHud.tsx"), "utf8")),
  );
  writeFileSync(join(dest, "src", "Root.tsx"), rootTsx(v));
  writeFileSync(join(dest, "src", "index.ts"), indexTs);
  writeFileSync(join(dest, "package.json"), packageJson(v));
  writeFileSync(join(dest, "tsconfig.json"), tsconfig);
  writeFileSync(join(dest, "remotion.config.ts"), remotionConfig);
  writeFileSync(join(dest, "README.md"), readme(v));
  writeFileSync(
    join(dest, "public", ".gitkeep"),
    "Static assets go here. This composition needs none.\n",
  );
  writeFileSync(
    join(dest, ".gitignore"),
    ["node_modules", "out", ".DS_Store", ""].join("\n"),
  );

  const zipPath = join(stage, v.zip);
  rmSync(zipPath, { force: true });
  execFileSync("zip", ["-rq", zipPath, v.dir], { cwd: stage });
  console.log(`built ${v.zip}`);
}
