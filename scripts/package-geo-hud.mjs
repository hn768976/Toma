#!/usr/bin/env node
/**
 * Builds the three standalone deliverables:
 *
 *   dist/geo-hud-blue.zip
 *   dist/geo-hud-green.zip
 *   dist/geo-hud-tilted.zip
 *
 * Each is a self-contained, independently runnable Remotion project containing
 * only one version - its own Root.tsx registering a single composition, only
 * the components that version needs, only the dependencies it needs, and a
 * VARIANTS object trimmed to the variants it actually uses.
 *
 * node_modules/, out/ and .git/ are never copied.
 *
 * Usage: node scripts/package-geo-hud.mjs
 */
import { execFileSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const PROJECT = path.join(ROOT, "remotion-video");
const BUILD = path.join(ROOT, "build");
const DIST = path.join(ROOT, "dist");

const read = (p) => fs.readFileSync(p, "utf8");
const write = (p, s) => {
  fs.mkdirSync(path.dirname(p), { recursive: true });
  fs.writeFileSync(p, s);
};

/** Remove a `  <key>: { ... },` entry from the VARIANTS object literal. */
const dropVariantEntry = (source, key) => {
  const start = source.indexOf(`\n  ${key}: {`);
  if (start === -1) throw new Error(`variant entry ${key} not found`);
  const end = source.indexOf("\n  },\n", start);
  if (end === -1) throw new Error(`variant entry ${key} is not terminated`);
  return source.slice(0, start) + source.slice(end + "\n  },".length);
};

/** Remove a top-level `const NAME: Palette = { ... };` declaration. */
const dropPalette = (source, name) => {
  const start = source.indexOf(`const ${name}: Palette = {`);
  if (start === -1) throw new Error(`palette ${name} not found`);
  const end = source.indexOf("\n};\n", start);
  return source.slice(0, start) + source.slice(end + "\n};\n".length);
};

const dropTextureSourceExport = (source) => {
  const marker = "/** The variant whose dashboard content v3 re-renders (v1). */";
  const start = source.indexOf(marker);
  if (start === -1) return source;
  return source.slice(0, start).trimEnd() + "\n";
};

/** Trim leading comment lines that only describe variants this build drops. */
const trimVariants = (source, keep) => {
  let out = source;
  for (const name of ["blue", "green", "tilted"]) {
    if (!keep.includes(name)) out = dropVariantEntry(out, name);
  }
  if (!keep.includes("green")) out = dropPalette(out, "GREEN_PALETTE");
  if (!keep.includes("blue") && !keep.includes("tilted")) {
    out = dropPalette(out, "BLUE_PALETTE");
  }
  if (!keep.includes("tilted")) out = dropTextureSourceExport(out);
  out = out.replace(
    /export type VariantName = [^;]+;/,
    `export type VariantName = ${keep.map((k) => `"${k}"`).join(" | ")};`,
  );
  return out;
};

const BASE_DEPENDENCIES = {
  "@remotion/cli": "4.0.515",
  "@remotion/google-fonts": "4.0.515",
  "d3-geo": "^3.1.1",
  react: "19.2.3",
  "react-dom": "19.2.3",
  remotion: "4.0.515",
  "topojson-client": "^3.1.0",
};

const THREE_DEPENDENCIES = {
  "@react-three/fiber": "^9.7.0",
  "@react-three/postprocessing": "^3.1.1",
  "@remotion/three": "4.0.515",
  postprocessing: "^6.39.4",
  three: "^0.185.1",
};

const BASE_DEV_DEPENDENCIES = {
  "@types/d3-geo": "^3.1.1",
  "@types/react": "19.2.7",
  "@types/topojson-client": "^3.1.5",
  "@types/web": "0.0.166",
  typescript: "5.9.3",
};

const sorted = (obj) =>
  Object.fromEntries(Object.entries(obj).sort(([a], [b]) => (a < b ? -1 : 1)));

const TARGETS = [
  {
    name: "geo-hud-blue",
    compositionId: "GeoHudBlue",
    component: "GeoHud",
    componentImport: './geo-hud/GeoHud"',
    variant: "blue",
    keepVariants: ["blue"],
    three: false,
    outputName: "geohud-blue",
    title: 'Blue "geodata" flat dashboard',
    description:
      "A locked-off 4K geodata HUD: a Natural Earth world map with rotating " +
      "country highlights and pulsing sonar target rings, surrounded by a " +
      "symmetrical grid of readouts, bar charts, line traces, ring gauges, " +
      "progress strips, toggle rows and log panels.",
  },
  {
    name: "geo-hud-green",
    compositionId: "GeoHudGreen",
    component: "GeoHud",
    componentImport: './geo-hud/GeoHud"',
    variant: "green",
    keepVariants: ["green"],
    three: false,
    outputName: "geohud-green",
    title: 'Green "network" offset dashboard',
    description:
      "The same dashboard system in a different arrangement and domain: the " +
      "map sits in the left 45% of the frame with a connector mesh between " +
      "the highlighted nodes, the right side is a dense three-column stack of " +
      "small panels, and one full-width line trace runs along the bottom.",
  },
  {
    name: "geo-hud-tilted",
    compositionId: "GeoHudTilted",
    component: "GeoHudTilted",
    componentImport: './geo-hud/GeoHudTilted"',
    variant: "tilted",
    keepVariants: ["blue", "tilted"],
    three: true,
    outputName: "geohud-tilted",
    title: "Tilted dashboard on a plane in 3D",
    description:
      "The blue dashboard re-rendered every frame into an offscreen canvas, " +
      "mapped onto a rounded tilted plane in @remotion/three, with a camera " +
      "moving across it on a closed path, depth of field, light bloom and a " +
      "drifting reflection sheen.",
  },
];

/** Files under src/geo-hud that every build needs. */
const SHARED_SOURCES = [
  "constants.ts",
  "dashboard.ts",
  "finish.ts",
  "fonts.ts",
  "layout.ts",
  "paint.ts",
  "rand.ts",
  "variants.ts",
  "vocab.ts",
  "map/geo.ts",
  "map/markers.ts",
  "panels/BarChart.ts",
  "panels/LineTrace.ts",
  "panels/PanelChrome.ts",
  "panels/ProgressStrip.ts",
  "panels/ReadoutBlock.ts",
  "panels/RingGauge.ts",
  "panels/TargetRing.ts",
  "panels/TextPanel.ts",
  "panels/TitlePlate.ts",
  "panels/ToggleRow.ts",
  "panels/WorldMapPanel.ts",
];

const rootTsx = (target) => `import { Composition } from "remotion";
import { ${target.component} } from "${target.componentImport};
import {
  DURATION_IN_FRAMES,
  FPS,
  HEIGHT,
  WIDTH,
} from "./geo-hud/constants";

export const RemotionRoot: React.FC = () => {
  return (
    <Composition
      id="${target.compositionId}"
      component={${target.component}}
      durationInFrames={DURATION_IN_FRAMES}
      fps={FPS}
      width={WIDTH}
      height={HEIGHT}
      defaultProps={{ variant: "${target.variant}" as const }}
    />
  );
};
`;

const indexTs = `import { registerRoot } from "remotion";
import { RemotionRoot } from "./Root";

registerRoot(RemotionRoot);
`;

const remotionConfig = (target) => `/**
 * Note: when using the Node.JS APIs, this config file does not apply. Pass the
 * options directly to the APIs instead.
 *
 * All configuration options: https://remotion.dev/docs/config
 */
import { Config } from "@remotion/cli/config";

Config.setVideoImageFormat("jpeg");
Config.setOverwriteOutput(true);
// This composition carries no audio. Without both of these Remotion muxes a
// silent AAC track, which also stretches the file past an exact 30.000s.
Config.setMuted(true);
Config.setEnforceAudioTrack(false);
${
  target.three
    ? `
// ${target.compositionId} renders through @remotion/three, so headless Chrome
// needs an explicit WebGL renderer or it can produce black frames. "swangle"
// (software ANGLE) works on a machine with no GPU and renders identically
// everywhere; on a box with a working GPU, "angle" is considerably faster.
Config.setChromiumOpenGlRenderer("swangle");
`
    : ""
}`;

const tsconfig = `{
  "compilerOptions": {
    "target": "ES2018",
    "module": "Preserve",
    "moduleResolution": "Bundler",
    "jsx": "react-jsx",
    "strict": true,
    "noEmit": true,
    "lib": ["es2015"],
    "esModuleInterop": true,
    "skipLibCheck": true,
    "forceConsistentCasingInFileNames": true,
    "noUnusedLocals": true
  },
  "exclude": ["remotion.config.ts"]
}
`;

const gitignore = `node_modules/
out/
.DS_Store
`;

const readme = (target) => `# ${target.name} — ${target.title}

${target.description}

## The composition

| | |
| --- | --- |
| Composition id | \`${target.compositionId}\` |
| Resolution | **3840 × 2160 (4K UHD)** |
| Duration | 900 frames |
| Frame rate | 30 fps (30.0 seconds) |
| Loops | **Yes** — frame 900 is pixel-identical to frame 0, so the clip can be looped without a cut |
| Audio | None |

Every value on screen is a pure function of \`useCurrentFrame()\`, and all
randomness comes from Remotion's \`random()\` with stable string seeds — no
\`Math.random()\`, no \`Date.now()\`, no \`requestAnimationFrame\`, no component
state. Renders are therefore deterministic and safe at any \`--concurrency\`.

## Map data

The world map is **Natural Earth 110m country polygons**, shipped in
\`public/geo/countries-110m.json\` (the \`world-atlas\` build of the Natural Earth
data), projected at load time with \`d3-geo\`.

**Natural Earth is in the public domain.** From the Natural Earth terms of use:
"All versions of Natural Earth raster + vector map data found on this website
are in the public domain. You may use the maps in any manner, including
modifying the content and design, electronic dissemination, and offset
printing." No permission is needed and no attribution is required.

\`public/geo/WORLD-ATLAS-LICENSE.txt\` carries the ISC licence of the world-atlas
packaging of that data.

All other text in the piece — log lines, labels, station codes, coordinates — is
invented. Nothing reproduces real source code, real telemetry, or coordinates
tied to a real facility. There are no logos and no watermark.

## Install and run

\`\`\`bash
npm install
npm run dev        # opens Remotion Studio
\`\`\`

### Render the full 4K composition

\`\`\`bash
npx remotion render ${target.compositionId} out/${target.outputName}.mp4 --codec=h264 --crf=12 --concurrency=8
\`\`\`

### Render a 1080p preview

\`\`\`bash
npx remotion render ${target.compositionId} out/${target.outputName}-preview.mp4 --codec=h264 --crf=18 --scale=0.5 --concurrency=8
\`\`\`

\`--scale\` only changes the size of the captured frame; the dashboard is always
drawn into a 3840 × 2160 backing store, so a preview is a downsampled 4K frame
rather than a smaller drawing.

> \`--concurrency\` must not exceed your CPU core count, and each worker holds a
> full 4K canvas${target.three ? " plus a 3840 × 2160 WebGL context" : ""}. Lower it if a render runs out of
> memory or times out.

## Dependencies

Beyond \`remotion\`, \`react\` and \`react-dom\`:

- \`d3-geo\` — projects the country polygons (once, at load).
- \`topojson-client\` — decodes the TopoJSON into GeoJSON features.
- \`@remotion/google-fonts\` — loads Barlow Condensed (condensed technical sans)
  and Roboto Mono (monospaced, so the numeric readouts do not jitter as values
  reroll), gated with \`delayRender()\` / \`continueRender()\`.
${
  target.three
    ? `- \`@remotion/three\`, \`three\`, \`@react-three/fiber\` — the 3D scene.
- \`@react-three/postprocessing\`, \`postprocessing\` — depth of field and bloom.
`
    : ""
}
## Layout of the source

\`\`\`
src/
  index.ts                    registerRoot
  Root.tsx                    the single <Composition />
  geo-hud/
    variants.ts               THE palette / layout / domain / render-mode table
    constants.ts              3840 x 2160, 30fps, 900 frames
    layout.ts                 panel rectangles for both arrangements
    dashboard.ts              the self-contained renderer (draws a whole frame
                              into any 2D context)
    paint.ts                  canvas helpers and the bloom painter
    finish.ts                 bloom, vignette, scanlines, grain
    rand.ts                   seeded, loop-safe cycles
    vocab.ts                  the invented label / log vocabulary
    fonts.ts                  gated web font loading
    map/geo.ts                Natural Earth loading and one-time projection
    map/markers.ts            fixed marker positions
    panels/*.ts               PanelChrome, WorldMapPanel, ReadoutBlock,
                              BarChart, LineTrace, RingGauge, TargetRing,
                              TextPanel, ProgressStrip, ToggleRow, TitlePlate
${
  target.three
    ? "    GeoHudTilted.tsx          the 3D scene, camera rig and texture pipeline\n"
    : "    GeoHud.tsx                the composition component\n"
}\`\`\`

A few shared modules (\`layout.ts\`, \`vocab.ts\`) still carry the definitions for
both arrangements and both readout domains, because they are one module in the
system rather than per-variant copies; only the one this project registers is
ever reached.

\`variants.ts\` is the only place a colour is defined. Panel chrome, the projected
map and all static text are drawn **once** into an offscreen layer and blitted
each frame; only values, traces, gauges, highlights and the finishing pass are
redrawn.
${
  target.three
    ? "\nSee `CAMERA-NOTES.md` for the plane, the camera path, the texture pipeline,\nthe depth-of-field and bloom settings, and the gotchas.\n"
    : ""
}`;

const copy = (from, to) => {
  fs.mkdirSync(path.dirname(to), { recursive: true });
  fs.copyFileSync(from, to);
};

fs.rmSync(BUILD, { recursive: true, force: true });
fs.mkdirSync(DIST, { recursive: true });

for (const target of TARGETS) {
  const dest = path.join(BUILD, target.name);

  for (const file of SHARED_SOURCES) {
    copy(
      path.join(PROJECT, "src/geo-hud", file),
      path.join(dest, "src/geo-hud", file),
    );
  }

  if (target.three) {
    copy(
      path.join(PROJECT, "src/geo-hud/GeoHudTilted.tsx"),
      path.join(dest, "src/geo-hud/GeoHudTilted.tsx"),
    );
    copy(
      path.join(PROJECT, "CAMERA-NOTES.md"),
      path.join(dest, "CAMERA-NOTES.md"),
    );
  } else {
    copy(
      path.join(PROJECT, "src/geo-hud/GeoHud.tsx"),
      path.join(dest, "src/geo-hud/GeoHud.tsx"),
    );
  }

  write(
    path.join(dest, "src/geo-hud/variants.ts"),
    trimVariants(read(path.join(PROJECT, "src/geo-hud/variants.ts")), target.keepVariants),
  );

  copy(
    path.join(PROJECT, "public/geo/countries-110m.json"),
    path.join(dest, "public/geo/countries-110m.json"),
  );
  copy(
    path.join(PROJECT, "public/geo/WORLD-ATLAS-LICENSE.txt"),
    path.join(dest, "public/geo/WORLD-ATLAS-LICENSE.txt"),
  );

  write(path.join(dest, "src/Root.tsx"), rootTsx(target));
  write(path.join(dest, "src/index.ts"), indexTs);
  write(path.join(dest, "remotion.config.ts"), remotionConfig(target));
  write(path.join(dest, "tsconfig.json"), tsconfig);
  write(path.join(dest, ".gitignore"), gitignore);
  write(path.join(dest, "README.md"), readme(target));
  write(
    path.join(dest, "package.json"),
    JSON.stringify(
      {
        name: target.name,
        version: "1.0.0",
        description: `${target.compositionId} - ${target.title}`,
        license: "UNLICENSED",
        private: true,
        scripts: {
          dev: "remotion studio",
          build: "remotion bundle",
          lint: "tsc",
          render: `remotion render ${target.compositionId} out/${target.outputName}.mp4 --codec=h264 --crf=12 --concurrency=8`,
        },
        dependencies: sorted({
          ...BASE_DEPENDENCIES,
          ...(target.three ? THREE_DEPENDENCIES : {}),
        }),
        devDependencies: sorted({
          ...BASE_DEV_DEPENDENCIES,
          ...(target.three ? { "@types/three": "^0.185.4" } : {}),
        }),
      },
      null,
      2,
    ) + "\n",
  );

  const zip = path.join(DIST, `${target.name}.zip`);
  fs.rmSync(zip, { force: true });
  execFileSync("zip", ["-r", "-q", zip, target.name], { cwd: BUILD });
  const size = (fs.statSync(zip).size / 1024 / 1024).toFixed(2);
  console.log(`${path.relative(ROOT, zip)}  ${size} MB`);
}
