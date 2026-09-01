/**
 * Builds cells-red.zip and cells-blue.zip.
 *
 *   npm run package
 *
 * Each zip is the whole project — src/, package.json, tsconfig.json,
 * remotion.config.ts, public/, scripts/ — plus a README.md for that version.
 * node_modules/, out/ and .git/ are excluded.
 */
import { execFileSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const stageRoot = path.join(root, ".package");

const INCLUDE = [
  "src",
  "scripts",
  "public",
  "package.json",
  "package-lock.json",
  "tsconfig.json",
  "remotion.config.ts",
  ".gitignore",
];

const VERSIONS = [
  {
    zip: "cells-red.zip",
    id: "CellsRed",
    out: "cells-red",
    title: 'Defocused Cells — v1 "red"',
    blurb:
      "Dark cells on near-white. A handful of large soft masses on an almost\nempty field: roughly 60% of the frame stays background.",
    detail: [
      "- ~30 cells, 180-620px diameter at 4K.",
      "- Blur ceiling 90px, applied per depth bucket; nothing in frame has a readable edge.",
      "- Drift is mostly leftward with vertical variation.",
      "- No bloom, no vignette.",
    ],
  },
  {
    zip: "cells-blue.zip",
    id: "CellsBlue",
    out: "cells-blue",
    title: 'Defocused Cells — v2 "blue"',
    blurb:
      "The inversion: bright cells on near-black. Many more, much smaller cells,\ncompositing additively so overlaps pool brighter, with a bloom pass and a\nvignette.",
    detail: [
      "- ~70 cells, 90-380px diameter at 4K.",
      "- Blur ceiling 70px — v1's 90px would dissolve cells this small into a wash.",
      "- Cells composite with 'lighter' and carry a soft bloom, so they read as emissive.",
      "- ~20% vignette.",
      "- Drift is mostly upward with horizontal variation, ~40% further per loop than v1.",
    ],
  },
];

const readme = (version) => `# ${version.title}

${version.blurb}

## The composition

| | |
| --- | --- |
| Composition id | \`${version.id}\` |
| Resolution | 3840 x 2160 (4K UHD) |
| Duration | 450 frames |
| Frame rate | 30 fps |
| Length | 15.0 s |
| Loops | Yes — frame 450 is pixel-identical to frame 0 |

Both versions ship in this project and share one component, \`<CellField>\`;
they differ only by the entry in \`VARIANTS\` (\`src/cells/variants.ts\`), which
holds every palette, count, size range, blur ceiling and drift setting in the
piece. The other composition here is \`${
  version.id === "CellsRed" ? "CellsBlue" : "CellsRed"
}\`.

${version.detail.join("\n")}

## Render at 4K

\`\`\`bash
npm install
npx remotion render ${version.id} out/${version.out}.mp4 --codec=h264 --crf=12 --concurrency=8
\`\`\`

CRF 12 is deliberate. The frame is almost entirely large smooth blurred
gradients, and those band severely at default compression settings. Lower the
number further if you still see stepping in the soft falloffs; raise it only if
you are rendering a rough preview.

\`--concurrency\` must not exceed the machine's CPU core count — lower it if
Remotion rejects the value.

## Preview at 1080p

\`\`\`bash
npx remotion render ${version.id} out/${version.out}-preview.mp4 --codec=h264 --crf=18 --scale=0.5
\`\`\`

## Other commands

\`\`\`bash
npm run dev           # Remotion Studio
npm run lint          # typecheck
npm run verify-loop   # asserts every drift path, morph and rotation closes at frame 450
\`\`\`

## How it is put together

- \`src/cells/variants.ts\` — the single \`VARIANTS\` object. Every hex literal in
  the project lives here.
- \`src/cells/geometry.ts\` — seeded cell generation, closed drift paths, and the
  bezier blob builder. Blobs are 5-8 points around a centre with each radius
  varied +/-25%, smoothed through cubic beziers, so they read as cells rather
  than bubbles.
- \`src/cells/CellField.tsx\` — the composition. Wraps the frame number to
  \`frame % 450\`, so frame 450 feeds the exact same input as frame 0.
- \`src/cells/CellLayer.tsx\` — buckets cells into three offscreen buffers by
  depth and blurs each buffer once. The layer is computed at half resolution
  and upscaled with \`imageSmoothingQuality: 'high'\`.
- \`src/cells/BackgroundWash.tsx\`, \`GrainPass.tsx\`, \`VignettePass.tsx\` — the
  background field, ~3% grain, and (v2 only) the vignette.

Every layer draws to a canvas once per React render as a pure function of
\`useCurrentFrame()\`. No \`Date.now()\`, no \`requestAnimationFrame\`, no CSS
animation, no state, and all randomness through Remotion's \`random()\` with
stable string seeds — so any frame can be rendered in isolation and repeated
renders are identical.
`;

fs.rmSync(stageRoot, { recursive: true, force: true });

for (const version of VERSIONS) {
  const stage = path.join(stageRoot, path.basename(version.zip, ".zip"));
  fs.mkdirSync(stage, { recursive: true });
  for (const entry of INCLUDE) {
    const from = path.join(root, entry);
    if (!fs.existsSync(from)) {
      continue;
    }
    fs.cpSync(from, path.join(stage, entry), { recursive: true });
  }
  fs.writeFileSync(path.join(stage, "README.md"), readme(version));

  const zipPath = path.join(root, version.zip);
  fs.rmSync(zipPath, { force: true });
  execFileSync("zip", ["-r", "-q", "-X", zipPath, "."], { cwd: stage });
  const size = (fs.statSync(zipPath).size / 1024).toFixed(0);
  console.log(`${version.zip}  (${size} KB)`);
}

fs.rmSync(stageRoot, { recursive: true, force: true });
