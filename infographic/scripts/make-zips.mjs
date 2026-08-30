/**
 * Builds three self-contained, independently runnable Remotion projects — one
 * per variant — and zips each.
 *
 * Each zip carries only its own composition: Root.tsx registers one
 * <Composition>, and theme.ts holds one variant inlined rather than a shared
 * three-key object. The #region markers in Root.tsx, theme.ts and layout.ts
 * mark what belongs to which variant; everything else is copied verbatim, so
 * the three projects and the master stay one codebase.
 *
 * Usage: node scripts/make-zips.mjs
 */
import { execFileSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const dist = path.join(root, "dist-zips");
// Unpacked projects live under .build/; only the zips are kept alongside.
const build = path.join(dist, ".build");

const VARIANTS = {
  blue: {
    compId: "InfographicBlue",
    outName: "infographic-blue",
    layout: "dense",
    title: 'v1 "blue" — corporate, light, dense',
    blurb:
      "A dense corporate infographic sheet on a plane receding to the upper-right: " +
      "six donuts in a 3x2 grid, packed columns of bar, line, pie, text and " +
      "value-row panels, and a year counter climbing 1965 to 2028.",
  },
  warm: {
    compId: "InfographicWarm",
    outName: "infographic-warm",
    layout: "sparse",
    title: 'v2 "warm" — editorial, sparse, rearranged',
    blurb:
      "An editorial infographic sheet on a plane receding to the upper-left: nine " +
      "large panels with wide gutters, a single row of three donuts, one line " +
      "chart spanning the sheet, and a year counter climbing 1900 to 2000.",
  },
  dark: {
    compId: "InfographicDark",
    outName: "infographic-dark",
    layout: "dense",
    title: 'v3 "dark" — inverted, cyan on charcoal',
    blurb:
      "The dense layout inverted onto a charcoal ground: cyan and teal charts with " +
      "a faint emissive glow, ghosted donut remainders, scanlines and a centre " +
      "screen glow, and a year counter climbing 2000 to 2050.",
  },
};

/**
 * Keeps only the named regions of a family, dropping the others along with all
 * region markers. `// #region fam:name` ... `// #endregion`, in line or JSX
 * comment form.
 */
const stripRegions = (src, family, keep) => {
  const lines = src.split("\n");
  const out = [];
  let depth = 0;
  let dropping = false;
  for (const line of lines) {
    const open = line.match(
      new RegExp(`#region\\s+${family}:([A-Za-z0-9_-]+)`),
    );
    if (open) {
      depth++;
      if (depth === 1 && open[1] !== keep) {
        dropping = true;
      }
      continue;
    }
    if (depth > 0 && /#endregion/.test(line)) {
      depth--;
      if (depth === 0) {
        dropping = false;
      }
      continue;
    }
    if (!dropping) {
      out.push(line);
    }
  }
  return out.join("\n");
};

const COPY = [
  "src",
  "public",
  "package.json",
  "tsconfig.json",
  "remotion.config.ts",
  ".gitignore",
];

const copyInto = (from, to) => {
  fs.cpSync(from, to, { recursive: true });
};

const readme = (key, v) => `# Infographic Sheet — ${v.title}

${v.blurb}

## What this is

| | |
| --- | --- |
| Composition id | \`${v.compId}\` |
| Resolution | **4K, 3840 x 2160** |
| Duration | 450 frames |
| Frame rate | 30 fps (15.0 seconds) |
| Loops | **No.** Frames 0 and 450 differ by design — values climb once and hold. |

Frames 0-20 sit at zero: empty donuts, flat bars, undrawn lines. Frames 20-420
climb together off one shared timeline, so every chart on the sheet advances as
the year counter does — the sheet is one dataset moving through time, not a
collection of independent animations. Frames 420-450 hold at the final state.

## Install and run

\`\`\`
npm install
npm run dev          # Remotion Studio
\`\`\`

## Render at 4K

\`\`\`
npx remotion render ${v.compId} out/${v.outName}.mp4 --codec=h264 --crf=14 --concurrency=8
\`\`\`

Lower \`--concurrency\` if the machine has fewer cores than that; Remotion
refuses a value above the core count. For a fast 1080p check, add
\`--scale=0.5\`.

## How it is put together

- \`src/theme.ts\` — the single \`VARIANTS\` object: palette, layout mode,
  counter range, chart mix, tilt, depth and finish settings. No colour literal
  lives anywhere else.
- \`src/layout.ts\` — the panel layout as **data**: one entry per panel giving a
  chart type, a position and size in sheet coordinates, and a stable seed. The
  renderer walks the array, so a different arrangement is a different array and
  needs no new drawing code. This project ships the \`${v.layout}\` layout.
- \`src/plane.ts\` — the single affine transform for the whole sheet, and the
  depth bucketing.
- \`src/components/\` — \`SheetPlane\` plus \`DonutChart\`, \`BarChart\`,
  \`LineChart\`, \`PieChart\`, \`TextBlock\`, \`ValueRow\` and \`YearCounter\`.

Everything is drawn to one \`<canvas>\` at a 3840x2160 backing store. Depth of
field uses three offscreen buffers — near, mid and far — each blurred once on
its way to the main canvas, never per panel.

## Determinism

Every value is a pure function of the frame number: motion comes from
\`useCurrentFrame()\` with \`interpolate()\` and \`spring()\`, and all chart data
from Remotion's \`random()\` with stable string seeds. There is no
\`Date.now()\`, no \`requestAnimationFrame\`, no CSS animation and no component
state, so repeated renders are byte-identical.

The typeface (Inter, latin subset) is bundled in \`public/fonts/\` and loaded
behind \`delayRender()\`/\`continueRender()\`, so a render never captures a frame
with a fallback face and never needs the network. Canvas 2D has no
\`font-feature-settings\`, so tabular figures are produced in code — every digit
is laid out on a fixed advance, which is what stops the climbing percentages
jittering.

## Content

All copy is invented filler. There is no real text, no logos, no watermark and
no audio.
`;

fs.rmSync(dist, { recursive: true, force: true });
fs.mkdirSync(build, { recursive: true });

for (const [key, v] of Object.entries(VARIANTS)) {
  const proj = path.join(build, v.outName);
  fs.mkdirSync(proj, { recursive: true });

  for (const entry of COPY) {
    const from = path.join(root, entry);
    if (fs.existsSync(from)) {
      copyInto(from, path.join(proj, entry));
    }
  }

  // One composition, one variant, one layout.
  const rootTsx = path.join(proj, "src/Root.tsx");
  fs.writeFileSync(
    rootTsx,
    stripRegions(fs.readFileSync(rootTsx, "utf8"), "comp", key),
  );

  const theme = path.join(proj, "src/theme.ts");
  fs.writeFileSync(
    theme,
    stripRegions(fs.readFileSync(theme, "utf8"), "variant", key),
  );

  const layout = path.join(proj, "src/layout.ts");
  let layoutSrc = stripRegions(
    fs.readFileSync(layout, "utf8"),
    "layout",
    v.layout,
  );
  layoutSrc = stripRegions(layoutSrc, "layoutref", v.layout);
  fs.writeFileSync(layout, layoutSrc);

  const pkg = JSON.parse(fs.readFileSync(path.join(proj, "package.json")));
  pkg.name = v.outName;
  pkg.description = `4K infographic sheet animation — ${v.title}`;
  fs.writeFileSync(
    path.join(proj, "package.json"),
    JSON.stringify(pkg, null, 2) + "\n",
  );

  fs.writeFileSync(path.join(proj, "README.md"), readme(key, v));

  // node_modules/, out/ and .git/ are never copied in, so nothing to exclude.
  execFileSync("zip", ["-q", "-r", path.join(dist, `${v.outName}.zip`), v.outName], {
    cwd: build,
  });
  console.log(`built ${v.outName}.zip`);
}
