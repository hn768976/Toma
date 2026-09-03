/**
 * Build the three standalone, zippable Remotion projects for the
 * loading-bar set.
 *
 * Each output is a complete project on its own: the whole
 * src/loading-bar module (library helpers vendored in, so nothing is
 * imported from outside the zip), the two woff2 faces, a Root.tsx
 * registering that variant's composition, config files and a README.
 * node_modules/, out/ and .git/ are never copied.
 *
 * Usage: node scripts/package-loading-bar.mjs
 */
import { cpSync, mkdirSync, rmSync, writeFileSync, readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { execFileSync } from "node:child_process";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const stage = join(root, "dist-packages");

const TARGETS = [
  {
    variant: "upload",
    compId: "LoadingUpload",
    word: "UPLOADING",
    zip: "loading-upload",
    rhythm:
      "**steady** — climbs in even steps with a slow crawl around 28%, a " +
      "second plateau at 64% and the classic near-the-end stall at 94%.",
  },
  {
    variant: "download",
    compId: "LoadingDownload",
    word: "DOWNLOADING",
    zip: "loading-download",
    rhythm:
      "**burst** — a fast opening burst to 48%, a long stall through the " +
      "middle, a second burst to 83%, then a slow close.",
  },
  {
    variant: "process",
    compId: "LoadingProcess",
    word: "PROCESSING",
    zip: "loading-process",
    rhythm:
      "**grind** — slow and relentless, near-linear with only slight " +
      "easing. This variant also carries a small monospace percentage " +
      "readout above the bar's right end.",
  },
];

const pkgJson = (name) =>
  JSON.stringify(
    {
      name,
      version: "1.0.0",
      description: "4K neon loading-bar motion graphic (Remotion)",
      license: "UNLICENSED",
      private: true,
      scripts: {
        dev: "remotion studio",
        build: "remotion bundle",
        lint: "tsc",
      },
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
    },
    null,
    2,
  ) + "\n";

const rootTsx = (compId, variant) => `import { Composition } from "remotion";
import { LoadingBar } from "./loading-bar/LoadingBar";
import {
  DURATION_IN_FRAMES,
  FPS,
  WIDTH,
  HEIGHT,
} from "./loading-bar/constants";

export const RemotionRoot: React.FC = () => {
  return (
    <Composition
      id="${compId}"
      component={LoadingBar}
      durationInFrames={DURATION_IN_FRAMES}
      fps={FPS}
      width={WIDTH}
      height={HEIGHT}
      defaultProps={{ variant: "${variant}" as const }}
    />
  );
};
`;

const remotionConfig = `import { existsSync } from "node:fs";
import { Config } from "@remotion/cli/config";

Config.setVideoImageFormat("jpeg");
Config.setOverwriteOutput(true);

// Some sandboxed environments block downloading Remotion's own Chrome
// Headless Shell but ship a Playwright Chromium at this path. On a
// normal machine this path won't exist and Remotion uses its default
// managed browser.
const playwrightHeadlessShell =
  "/opt/pw-browsers/chromium_headless_shell-1194/chrome-linux/headless_shell";
if (existsSync(playwrightHeadlessShell)) {
  Config.setBrowserExecutable(playwrightHeadlessShell);
}
`;

const readme = (t) => `# ${t.word} — 4K loading bar

A one-shot neon loading-bar motion graphic built with
[Remotion](https://remotion.dev). 2D canvas only; no 3D, no Three.js.

| | |
| --- | --- |
| Composition id | \`${t.compId}\` |
| Resolution | **3840 × 2160 (4K UHD)** |
| Duration | **378 frames** |
| Frame rate | **30 fps** |
| Length | 12.6 seconds |
| Loops? | **No.** The bar fills, completes and holds. |
| Word | **${t.word}** |
| Audio | None |

## Fill rhythm

${t.rhythm}

Progress is defined as (frame, progress) waypoints in
\`src/loading-bar/variants.ts\` and eased between them, so the bar
advances in uneven steps with real pauses rather than sliding linearly.

## Install

\`\`\`sh
npm install
\`\`\`

## Preview

\`\`\`sh
npx remotion studio
\`\`\`

## Render 4K

\`\`\`sh
npx remotion render ${t.compId} out/${t.zip}.mp4 --codec=h264 --crf=12 --concurrency=8
\`\`\`

Lower \`--concurrency\` if the machine has fewer than 8 cores. For a fast
1080p check, add \`--scale=0.5\`.

## Layout

\`\`\`
src/
  index.ts                    registerRoot
  Root.tsx                    the single <Composition>
  loading-bar/
    LoadingBar.tsx            stacks the canvas layers
    variants.ts               THE only file holding a palette or a word
    layout.ts                 group geometry as fractions of the frame
    constants.ts              3840x2160, 30fps, 378 frames
    fonts.ts                  gated font loading
    WordMark.tsx              the word and its animated trailing dots
    PercentReadout.tsx        monospace % (the "process" variant only)
    lib/                      vendored, palette-agnostic library
      NeonBar.tsx             skewed outlined bar with a glowing fill
      MottledBackdrop.tsx     dark, unevenly lit surface
      SparkField.tsx          ~250 drifting dust motes
      FilmFinish.tsx          vignette + grain
      Canvas2D.tsx            one redraw per React render
      curve.ts tilt.ts shapes.ts neonStroke.ts postFx.ts
      rand.ts color.ts lowResUpscale.ts textFit.ts
public/
  fonts/                      the two woff2 faces, self-hosted
\`\`\`

All three palettes, words and fill curves live in
\`src/loading-bar/variants.ts\`; this project registers the
\`${t.variant}\` one.

## Determinism

Every layer is a pure function of \`useCurrentFrame()\`. No
\`Date.now()\`, no \`requestAnimationFrame\`, no CSS animation, no
component state, and all randomness goes through Remotion's
\`random()\` with stable string seeds — so frames rendered out of order
across workers are identical to a sequential render.
`;

rmSync(stage, { recursive: true, force: true });
mkdirSync(stage, { recursive: true });

for (const t of TARGETS) {
  const dir = join(stage, t.zip);
  mkdirSync(join(dir, "src"), { recursive: true });
  mkdirSync(join(dir, "public", "fonts"), { recursive: true });

  cpSync(join(root, "src", "loading-bar"), join(dir, "src", "loading-bar"), {
    recursive: true,
  });
  for (const font of ["Oswald-700-latin.woff2", "RobotoMono-500-latin.woff2"]) {
    cpSync(
      join(root, "public", "fonts", font),
      join(dir, "public", "fonts", font),
    );
  }
  cpSync(join(root, "tsconfig.json"), join(dir, "tsconfig.json"));
  writeFileSync(join(dir, "remotion.config.ts"), remotionConfig);
  writeFileSync(join(dir, "package.json"), pkgJson(t.zip));
  writeFileSync(
    join(dir, "src", "index.ts"),
    'import { registerRoot } from "remotion";\nimport { RemotionRoot } from "./Root";\n\nregisterRoot(RemotionRoot);\n',
  );
  writeFileSync(join(dir, "src", "Root.tsx"), rootTsx(t.compId, t.variant));
  writeFileSync(join(dir, "README.md"), readme(t));
  writeFileSync(
    join(dir, ".gitignore"),
    "node_modules\nout\n.env\n",
  );

  const zipPath = join(stage, `${t.zip}.zip`);
  rmSync(zipPath, { force: true });
  execFileSync("zip", ["-r", "-q", zipPath, t.zip], { cwd: stage });
  console.log(`packaged ${zipPath}`);
}

// Sanity check: nothing inside src/loading-bar may reach outside itself,
// or the zips would not be standalone. grep exits 1 when it finds
// nothing, which is the case we want.
let offenders = "";
try {
  offenders = execFileSync(
    "grep",
    ["-rEl", 'from "\\.\\./\\.\\./', join(root, "src", "loading-bar")],
    { encoding: "utf8", stdio: ["ignore", "pipe", "ignore"] },
  ).trim();
} catch {
  offenders = "";
}
if (offenders) {
  throw new Error(`loading-bar imports from outside itself:\n${offenders}`);
}
console.log("all packages standalone");
