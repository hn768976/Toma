/**
 * Builds the three standalone distribution zips.
 *
 * Each zip carries the whole project — src/, package.json, tsconfig.json,
 * remotion.config.ts, public/ (including the vendored fonts) and a README for
 * that one composition — and excludes node_modules/, out/ and .git/.
 *
 * All three variants live in one project by design (the shared framework is
 * the point), so every zip contains all three compositions; what differs is
 * the README, which documents the composition that zip is named for.
 *
 *   node scripts/package.mjs
 */
import { execFile } from "node:child_process";
import { mkdir, rm, cp, writeFile } from "node:fs/promises";
import { promisify } from "node:util";
import path from "node:path";

const run = promisify(execFile);
const root = path.resolve(import.meta.dirname, "..");
const stage = path.join(root, ".package");
const distDir = path.join(root, "dist");

const TARGETS = [
  {
    zip: "hub-ai.zip",
    compId: "HubAI",
    outName: "hub-ai",
    title: 'v1 — "ai": chip centre, radiating icon nodes',
    summary:
      "A chip at the centre of a radiating, cross-linked network of 14 tech line icons. Cyan is its signature hue.",
  },
  {
    zip: "hub-download.zip",
    compId: "HubDownload",
    outName: "hub-download",
    title: 'v2 — "download": segmented progress dial, no satellites',
    summary:
      "A 24-block segmented dial fills in amber three times across the loop. No satellites and no connectors: the freed space is filled with dense side chrome, large numeric readouts and a full-width bottom data strip. The amber is the only warm element in an otherwise entirely blue frame.",
  },
  {
    zip: "hub-medical.zip",
    compId: "HubMedical",
    outName: "hub-medical",
    title: 'v3 — "medical": icons strung along curved arcs',
    summary:
      "18 health line icons sit as beads along four large intersecting arcs that sweep across the frame, with the hub where two of them cross. No straight hub-to-node connectors and no accent hue at all — white line work on dark blue.",
  },
];

/**
 * Only the node-hub work ships. The repository this is built from also holds
 * unrelated compositions; carrying those into a hub zip would make it look
 * like part of the deliverable.
 */
const INCLUDE = [
  "src/node-hub",
  "src/lib",
  "src/index.ts",
  "src/index.css",
  "scripts/fetch-fonts.mjs",
  "package.json",
  "package-lock.json",
  "tsconfig.json",
  "remotion.config.ts",
  "eslint.config.mjs",
  ".prettierrc",
  ".gitignore",
];

/** The two faces the hub uses, plus the manifest fetch-fonts.mjs writes. */
const FONT_FILES = [
  "barlow-condensed-400.woff2",
  "barlow-condensed-500.woff2",
  "barlow-condensed-600.woff2",
  "share-tech-mono-400.woff2",
  "manifest.json",
];

/** A Root that registers the three hub compositions and nothing else. */
const ROOT_TSX = `import "./index.css";
import { Composition } from "remotion";
import { NodeHub } from "./node-hub/NodeHub";
import {
  FPS,
  FRAME_H,
  FRAME_W,
  LOOP_FRAMES,
} from "./node-hub/constants";

const VARIANTS = [
  { id: "HubAI", variant: "ai" },
  { id: "HubDownload", variant: "download" },
  { id: "HubMedical", variant: "medical" },
] as const;

export const RemotionRoot: React.FC = () => (
  <>
    {VARIANTS.map(({ id, variant }) => (
      <Composition
        key={id}
        id={id}
        component={NodeHub}
        durationInFrames={LOOP_FRAMES}
        fps={FPS}
        width={FRAME_W}
        height={FRAME_H}
        defaultProps={{ variant }}
      />
    ))}
  </>
);
`;

const readme = ({ compId, outName, title, summary }) => `# Node Network Hub — ${title}

${summary}

## This composition

| | |
| --- | --- |
| Composition id | \`${compId}\` |
| Resolution | **4K — 3840 x 2160** |
| Duration | 450 frames = **15.0 s** |
| Frame rate | 30 fps |
| Loops | **Yes** — frame 0 and frame 450 are pixel-identical |

The loop is exact, not approximate: every rotation completes a whole number of
symmetry periods across the 450 frames, and every pulse, value reroll and
travelling dot has a period that divides 450. \`assertDividesLoop\` in
\`src/node-hub/constants.ts\` fails the build if a period is added that would
break that.

## Render at 4K

\`\`\`
npm install
npx remotion render ${compId} out/${outName}.mp4 --codec=h264 --crf=12 --concurrency=8
\`\`\`

Lower \`--concurrency\` if the machine has fewer cores than that (Remotion
rejects a value above the available core count). For a fast 1080p check, add
\`--scale=0.5\`.

## Preview in the studio

\`\`\`
npm run dev
\`\`\`

## What is in here

All three variants ship in this one project — the shared framework is the
point of the build, so they are not forked copies. The other two compositions
are \`${TARGETS.filter((t) => t.compId !== compId)
  .map((t) => `\\\`${t.compId}\\\``)
  .join(" and ")}\`.

\`\`\`
src/node-hub/
  variants.ts        the three variants: palette, centre element, layout mode,
                     icon set, label, panel density. The only place a colour,
                     an icon name or a label string appears.
  constants.ts       frame size, timing and the loop contract
  layout.ts          the layout MODE branch: "radiating" vs "arcs"
  geometry.ts        pure 2D maths (polylines, arcs, frame-edge reach)
  panels.ts          side-chrome placement from a density name
  icons/             two interchangeable line-icon sets + drawing primitives
  passes.ts          offscreen canvases, bloom, vignette, grain
  seed.ts            seeded randomness (Remotion random(), stable string seeds)
  fonts.ts           the two vendored faces, gated with delayRender()
  lexicon.ts         fictional filler vocabulary for the panels
  components/        NodeHub, StarField, CentreHub, SatelliteLayout, IconNode,
                     ConnectorLines, SidePanel, LabelPlate, FinishPass, Layer

src/lib/             vendored from a shared library: seeded randomness, 2D
                     geometry, canvas passes, HUD ring builders, the satellite
                     layout mode branch and <IconNode>. Palette-agnostic and
                     project-agnostic; see src/lib/CATALOG.md.
\`\`\`

Everything is drawn to \`<canvas>\` in 2D — no 3D and no Three.js. Motion comes
only from \`useCurrentFrame()\`: no \`Date.now()\`, no \`requestAnimationFrame\`, no
CSS animation and no component state, so every frame is a pure function of its
number and renders are deterministic even though Remotion renders frames out of
order across workers.

## Fonts

The two Google faces used (Barlow Condensed and Share Tech Mono) are vendored
into \`public/fonts/\` so a render needs no network access. To refresh them from
\`@remotion/google-fonts\` metadata:

\`\`\`
node scripts/fetch-fonts.mjs
\`\`\`

## Content

All panel labels and values are invented — no real code, no real product
names, no logos, no watermark, and no audio.
`;

await rm(stage, { recursive: true, force: true });
await rm(distDir, { recursive: true, force: true });
await mkdir(distDir, { recursive: true });

for (const target of TARGETS) {
  const dir = path.join(stage, target.outName);
  await mkdir(dir, { recursive: true });

  for (const entry of INCLUDE) {
    const dest = path.join(dir, entry);
    await mkdir(path.dirname(dest), { recursive: true });
    await cp(path.join(root, entry), dest, { recursive: true });
  }

  await mkdir(path.join(dir, "public/fonts"), { recursive: true });
  for (const file of FONT_FILES) {
    await cp(
      path.join(root, "public/fonts", file),
      path.join(dir, "public/fonts", file),
    );
  }

  await writeFile(path.join(dir, "src/Root.tsx"), ROOT_TSX);
  await writeFile(path.join(dir, "README.md"), readme(target));

  const zipPath = path.join(distDir, target.zip);
  await run("zip", ["-rq", zipPath, target.outName], { cwd: stage });
  console.log(`${target.zip}`);
}

await rm(stage, { recursive: true, force: true });
console.log(`\nwrote ${TARGETS.length} zips to dist/`);
