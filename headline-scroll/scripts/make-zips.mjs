/**
 * Builds the two standalone deliverable zips.
 *
 * Each zip contains the whole project with a Root.tsx registering only that
 * variant's composition, its own README, and the shared library already
 * vendored into src/vendor — so each unzips and renders on its own.
 * node_modules/, out/ and .git/ are excluded.
 */
import { cpSync, mkdirSync, rmSync, writeFileSync, readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { execFileSync } from "node:child_process";

const here = dirname(fileURLToPath(import.meta.url));
const project = join(here, "..");
const stage = join(project, ".zipstage");

const VARIANTS = [
  {
    slug: "headlines-light",
    id: "HeadlinesLight",
    variant: "light",
    keyword: "intelligence",
    axis: "vertical — cards travel upward, as though scrolling a feed",
    cards: 7,
    look: "clean white web pages on a pale grey ground",
  },
  {
    slug: "headlines-paper",
    id: "HeadlinesPaper",
    variant: "paper",
    keyword: "AI",
    axis: "horizontal — cards travel leftward, as though flipping through a printed archive",
    cards: 5,
    look: "warm newsprint: mottled cream sheets, soft drop shadows and a slight ±1.5° tilt, on warm tan",
  },
];

const rootFor = (v) => `import React from "react";
import { Composition } from "remotion";
import { HeadlineScroll } from "./HeadlineScroll";

export const RemotionRoot: React.FC = () => {
  return (
    <>
      <Composition
        id="${v.id}"
        component={HeadlineScroll}
        durationInFrames={348}
        fps={30}
        width={3840}
        height={2160}
        defaultProps={{ variant: "${v.variant}" as const }}
      />
    </>
  );
};
`;

const readmeFor = (v) => `# ${v.id}

A 4K "AI headline scroll": a block of article-page fragments scrolling past at
constant speed, with one recurring keyword held in sharp focus while the rest
of each headline drops into graded blur.

## The composition

| | |
|---|---|
| Composition id | \`${v.id}\` |
| Resolution | **3840 × 2160 (4K UHD)** |
| Duration | 348 frames |
| Frame rate | 30 fps |
| Length | 11.6 seconds |
| Loops | **Yes — seamlessly.** Frame 348 is pixel-identical to frame 0 |
| Keyword held in focus | **"${v.keyword}"** |
| Scroll axis | ${v.axis} |
| Cards per tiled block | ${v.cards} |
| Audio | None |

Look: ${v.look}.

## All content is fictional

**Every headline, wordmark, site mark, section label, byline, date and word of
body text in this piece is invented for it.**

- The headlines were written for this animation. They are generic, plausible
  sentences about artificial intelligence and are not quotations of, or
  references to, any real article.
- The site marks are plain geometric squares. The wordmarks are generic common
  nouns ("DAILY", "BULLETIN", "REVIEW"). They are not anyone's logo or masthead
  and are not designed to resemble one.
- Bylines are role descriptions only — "By Staff Writer", "By Technology Desk",
  "By Contributing Reporter". No real person is named.
- Dates carry no year, so they tie to no real event.
- Body text is deterministic nonsense assembled from syllable fragments. It is
  not prose, and at the sizes and blur used it functions purely as texture.

**No real publication, masthead, logo, journalist, article or visual identity
is depicted, reproduced or imitated.**

## Running it

\`\`\`bash
npm install
npm run dev          # Remotion Studio
\`\`\`

### Render at full 4K

\`\`\`bash
npx remotion render ${v.id} out/${v.slug}.mp4 --codec=h264 --crf=12 --concurrency=8
\`\`\`

\`--concurrency\` must not exceed your CPU core count; lower it if Remotion
objects. A 1080p preview is much faster and usually enough to review the motion:

\`\`\`bash
npx remotion render ${v.id} out/${v.slug}-preview.mp4 --codec=h264 --crf=18 --scale=0.5
\`\`\`

\`--scale=0.5\` only changes the output size. The canvas backing store is always
3840 × 2160, so a scaled render is a true 4K frame downsampled, not a cheaper one.

## How it is built

Everything is painted into a single \`<canvas>\` at 3840 × 2160 through a ref,
once per React render. There is no \`requestAnimationFrame\`, no CSS animation,
no \`Date.now()\` and no animated state: every frame is a pure function of
\`useCurrentFrame()\`, and all randomness goes through Remotion's \`random()\` with
stable string seeds. Renders are therefore deterministic and reproducible.

Cards are laid out and painted **once**, each to its own offscreen canvas, with
the keyword focus blur, the tilt, the drop shadow and the directional motion
blur all baked in at build time. Re-laying-out headlines and body text every
frame at 4K would not render in usable time; the per-frame cost here is a
handful of \`drawImage\` calls plus grain and vignette.

The block of cards tiles: it is drawn twice, offset by one block length, and
translated by \`(frame / 348) × blockLength\`. That is what closes the loop
exactly.

### Source layout

\`\`\`
src/
  Root.tsx              composition registration
  HeadlineScroll.tsx    the piece: canvas, per-frame blit, tiling
  scene.ts              builds and places one block of cards
  variants.ts           palette, headlines, keyword, density, axis — the ONLY
                        place a hex value or a headline string is written down
  fonts.ts              serif + heavy sans via @remotion/google-fonts,
                        gated with delayRender()/continueRender()
  components/
    FocusPass.tsx       grain + vignette over the finished frame
  vendor/               shared library, vendored so this project is standalone
    ArticleCard.ts      a generic article-page block
    KeywordHighlight.ts per-word emphasis within a text run
    SiteChrome.ts       mark + wordmark, or breadcrumb
    BodyBlock.ts        illegible filler paragraphs
    motion-blur-compose.ts, paper-surface.ts,
    grain-pass.ts, vignette-pass.ts,
    seeded-random.ts, color.ts, canvas2d.ts, filler-text.ts
\`\`\`

\`src/vendor\` is a copy of a shared component library. Edit the library and
re-run \`node scripts/sync-lib.mjs\`, rather than editing files in \`vendor\`
directly; \`node scripts/sync-lib.mjs --check\` reports drift.
`;

rmSync(stage, { recursive: true, force: true });

for (const v of VARIANTS) {
  const dir = join(stage, v.slug);
  mkdirSync(dir, { recursive: true });
  for (const entry of ["src", "public", "scripts", "package.json", "tsconfig.json", "remotion.config.ts", ".gitignore"]) {
    cpSync(join(project, entry), join(dir, entry), { recursive: true });
  }
  writeFileSync(join(dir, "src", "Root.tsx"), rootFor(v));
  writeFileSync(join(dir, "README.md"), readmeFor(v));
  const pkg = JSON.parse(readFileSync(join(project, "package.json"), "utf8"));
  pkg.name = v.slug;
  pkg.description = `4K AI headline scroll — ${v.variant} variant. All content fictional.`;
  writeFileSync(join(dir, "package.json"), `${JSON.stringify(pkg, null, 2)}\n`);

  const zip = join(project, "dist", `${v.slug}.zip`);
  mkdirSync(join(project, "dist"), { recursive: true });
  rmSync(zip, { force: true });
  execFileSync("zip", ["-rq", zip, v.slug, "-x", "*/node_modules/*", "*/out/*", "*/.git/*"], { cwd: stage });
  console.log(`built dist/${v.slug}.zip`);
}
rmSync(stage, { recursive: true, force: true });
