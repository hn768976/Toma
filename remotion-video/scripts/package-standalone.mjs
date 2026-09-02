// Builds one standalone, runnable Remotion project per variant and zips it.
//
//   node scripts/package-standalone.mjs
//
// Each zip contains src/, package.json, tsconfig.json, remotion.config.ts,
// public/ and a README.md, and EXCLUDES node_modules/, out/ and .git/.
//
// Library components are VENDORED into the zip's src/lib. No import statement
// changes: remotion.config.ts points the shared `@lib` alias at ./src/lib when
// that directory exists, and at ../remotion-lib/src otherwise, so the same
// source tree works both in the monorepo and standalone.

import { cp, mkdir, readFile, rm, writeFile, readdir } from "node:fs/promises";
import { existsSync } from "node:fs";
import { execFile } from "node:child_process";
import path from "node:path";
import { promisify } from "node:util";

const run = promisify(execFile);
const ROOT = path.resolve(import.meta.dirname, "..");
const LIB = path.resolve(ROOT, "../remotion-lib/src");
const STAGE = path.join(ROOT, "dist-zip");

const VARIANTS = [
  { key: "wifi", comp: "HudCentreWifi", zip: "hud-centre-wifi", id: "BC-344", centre: "a wifi symbol: three concentric arcs pulsing outward above a filled dot" },
  { key: "crypto", comp: "HudCentreCrypto", zip: "hud-centre-crypto", id: "BC-754", centre: "the Bitcoin mark as a filled form with a chromatic fringe and internal scan bands" },
  { key: "radar", comp: "HudCentreRadar", zip: "hud-centre-radar", id: "BC-890", centre: "a full radar scope: polar grid, rotating sweep wedge, phosphor persistence and contacts" },
];

const FONT_FILES = [
  "BarlowCondensed-400.woff2",
  "BarlowCondensed-500.woff2",
  "BarlowCondensed-600.woff2",
  "RobotoMono-400.woff2",
  "RobotoMono-500.woff2",
  "RobotoMono-700.woff2",
];

const rootTsx = (comp, key) => `import { Composition } from "remotion";
import { HudCentre, hudCentreSchema } from "./hud-centre/HudCentre";
import { DURATION, FPS } from "./hud-centre/timing";
import { FRAME_H, FRAME_W } from "./hud-centre/layout";

export const RemotionRoot: React.FC = () => {
  return (
    <Composition
      id="${comp}"
      component={HudCentre}
      durationInFrames={DURATION}
      fps={FPS}
      width={FRAME_W}
      height={FRAME_H}
      schema={hudCentreSchema}
      defaultProps={{ variant: "${key}" as const }}
    />
  );
};
`;

const indexTs = `import { registerRoot } from "remotion";
import { RemotionRoot } from "./Root";

registerRoot(RemotionRoot);
`;

const remotionConfig = `import { existsSync } from "node:fs";
import path from "node:path";
import { Config } from "@remotion/cli/config";

Config.setRspack(true);
Config.setVideoImageFormat("jpeg");
Config.setOverwriteOutput(true);

// \`@lib\` resolves to the vendored copy of the shared component library in
// ./src/lib. NOTE: __dirname inside a Remotion config points at
// @remotion/cli's own directory, so project-relative paths must be anchored
// on process.cwd() instead.
const VENDORED_LIB_SRC = path.resolve(process.cwd(), "src/lib");
const LIB_SRC = path.resolve(process.cwd(), "../remotion-lib/src");

Config.overrideBundlerConfig((config) => ({
  ...config,
  resolve: {
    ...config.resolve,
    alias: {
      ...config.resolve?.alias,
      "@lib": existsSync(VENDORED_LIB_SRC) ? VENDORED_LIB_SRC : LIB_SRC,
    },
  },
}));
`;

const tsconfig = JSON.stringify(
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
      baseUrl: ".",
      paths: { "@lib/*": ["./src/lib/*"] },
    },
    include: ["src/**/*"],
    exclude: ["remotion.config.ts"],
  },
  null,
  2,
) + "\n";

const readme = (v, deps) => `# HUD Centre — ${v.key}

A 4K "HUD dashboard" motion graphic built in Remotion. 2D canvas only — no 3D,
no Three.js.

| | |
|---|---|
| **Composition id** | \`${v.comp}\` |
| **Resolution** | **4K — 3840 x 2160** |
| **Duration** | 450 frames = **15.0 s** |
| **Frame rate** | 30 fps |
| **Loops** | Yes — seamlessly. Frame 450 is pixel-identical to frame 0, and every periodic motion uses a period that divides 450, so the motion is continuous across the cut. |
| **Centre element** | ${v.centre} |
| **ID label** | \`${v.id}\` |

## Render at 4K

\`\`\`console
npm i
npx remotion render ${v.comp} out/${v.zip}.mp4 --codec=h264 --crf=12 --concurrency=8
\`\`\`

\`--concurrency\` must not exceed your CPU core count; drop it if unsure.

## Preview

\`\`\`console
npx remotion studio
\`\`\`

## How it is put together

The surrounding dashboard is a single component, \`<Dashboard>\`, that takes no
variant at all — it cannot see which version it is in, which is what
guarantees the panels are identical across the wifi, crypto and radar builds.
Only three values differ between versions, and they all live in one
\`VARIANTS\` object in \`src/hud-centre/variants.ts\`: the centre element type,
its accent colour, and the ID label.

Everything is drawn to \`<canvas>\` through a ref, once per React render, driven
entirely by \`useCurrentFrame()\`. There is no \`requestAnimationFrame\`, no
component state, no \`Date.now()\`, and all randomness goes through Remotion's
\`random()\` with stable string seeds — so a frame is a pure function of its
frame number and \`npx remotion render\` is deterministic and parallel-safe.

Each panel's static chrome (border, corner ticks, label strip, grids, axis
text) is rasterised once into an offscreen canvas and blitted; only values,
bars, arcs, the sweep and the centre element redraw per frame.

Typefaces (Barlow Condensed and Roboto Mono) are self-hosted from \`public/fonts\`
and gated behind \`delayRender()\`/\`continueRender()\`, so rendering never depends
on a network fetch. All numbers are set in the monospace face — Canvas2D
ignores \`font-variant-numeric\`, so a monospaced face is the only way to get
genuinely tabular figures.

${deps}
No real logos, no watermark, no audio.
`;

const libNote = `\`src/lib\` is a vendored copy of the shared \`remotion-lib\`
component library, so this project is standalone and runnable with no
dependency on the library checkout.

`;

const zipVariant = async (v, hasLib) => {
  const dir = path.join(STAGE, v.zip);
  await rm(dir, { recursive: true, force: true });
  await mkdir(path.join(dir, "src"), { recursive: true });
  await mkdir(path.join(dir, "public", "fonts"), { recursive: true });

  await cp(path.join(ROOT, "src/hud-centre"), path.join(dir, "src/hud-centre"), {
    recursive: true,
  });
  if (hasLib) {
    await cp(LIB, path.join(dir, "src/lib"), { recursive: true });
  }
  for (const f of FONT_FILES) {
    await cp(path.join(ROOT, "public/fonts", f), path.join(dir, "public/fonts", f));
  }

  await writeFile(path.join(dir, "src/Root.tsx"), rootTsx(v.comp, v.key));
  await writeFile(path.join(dir, "src/index.ts"), indexTs);
  await writeFile(path.join(dir, "remotion.config.ts"), remotionConfig);
  await writeFile(path.join(dir, "tsconfig.json"), tsconfig);
  await writeFile(path.join(dir, "README.md"), readme(v, hasLib ? libNote : ""));

  const base = JSON.parse(await readFile(path.join(ROOT, "package.json"), "utf8"));
  // Pin exact versions. Remotion requires every Remotion package AND zod to
  // resolve to one exact version; a caret lets a fresh `npm i` float zod to a
  // newer minor and Remotion then refuses to render with a version-mismatch
  // error. A distributable should not depend on when it was installed.
  const pick = (obj, keys) =>
    Object.fromEntries(
      keys.filter((k) => obj[k]).map((k) => [k, obj[k].replace(/^[\^~]/, "")]),
    );
  await writeFile(
    path.join(dir, "package.json"),
    JSON.stringify(
      {
        name: v.zip,
        version: "1.0.0",
        description: `4K HUD dashboard — ${v.key} centre element`,
        license: "UNLICENSED",
        private: true,
        scripts: {
          dev: "remotion studio",
          build: "remotion bundle",
          render: `remotion render ${v.comp} out/${v.zip}.mp4 --codec=h264 --crf=12`,
          lint: "tsc",
        },
        dependencies: pick(base.dependencies, [
          "@remotion/cli",
          "react",
          "react-dom",
          "remotion",
          "zod",
        ]),
        devDependencies: pick(base.devDependencies, [
          "@types/react",
          "@types/web",
          "typescript",
        ]),
      },
      null,
      2,
    ) + "\n",
  );

  const out = path.join(ROOT, `${v.zip}.zip`);
  await rm(out, { force: true });
  // -x excludes are belt-and-braces; the staging dir never contains them.
  await run("zip", ["-rq", out, ".", "-x", "node_modules/*", "out/*", ".git/*"], {
    cwd: dir,
  });
  const files = await readdir(dir);
  return { out, files };
};

const main = async () => {
  const hasLib = existsSync(LIB);
  if (!hasLib) console.warn("! remotion-lib not found — zips will have no src/lib");
  await rm(STAGE, { recursive: true, force: true });
  for (const v of VARIANTS) {
    const { out, files } = await zipVariant(v, hasLib);
    console.log(`built ${path.basename(out)}  [${files.sort().join(", ")}]`);
  }
};

await main();
