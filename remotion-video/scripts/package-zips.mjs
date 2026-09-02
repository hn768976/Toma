/**
 * Assembles the two standalone deliverables:
 *
 *   dist-zips/clippings-fire.zip
 *   dist-zips/clippings-finance.zip
 *
 * Each zip is a complete, self-contained Remotion project — src/ (including
 * the vendored src/lib), package.json, tsconfig.json, remotion.config.ts,
 * public/ and a README — with node_modules/, out/ and .git/ excluded.
 *
 * Both compositions are registered in both zips. The two variants share one
 * VARIANTS object by design, so stripping one out would leave a dangling key;
 * what differs between the zips is the README, which names that zip's
 * composition, palette and render command.
 *
 *   node scripts/package-zips.mjs
 */
import { cp, mkdir, readFile, rm, writeFile } from "node:fs/promises";
import { execFile } from "node:child_process";
import path from "node:path";
import { promisify } from "node:util";
import { fileURLToPath } from "node:url";

const run = promisify(execFile);
const here = path.dirname(fileURLToPath(import.meta.url));
const root = path.join(here, "..");
const stage = path.join(root, "dist-zips");

const VARIANTS = [
  {
    slug: "clippings-fire",
    compositionId: "ClippingsFire",
    title: 'Newspaper Clippings — "fire"',
    subject: "wildfire and climate",
    wall: "a deep burnt-red wall (#7A1E0A / #A83214 / #4A1206)",
    stocks: "cream, newsprint grey and a yellowed aged stock",
    drift: "rightward and slightly down",
    extras:
      "This variant carries no chart or halftone panels — those belong to the\nfinance variant.",
  },
  {
    slug: "clippings-finance",
    compositionId: "ClippingsFinance",
    title: 'Newspaper Clippings — "finance"',
    subject: "market crisis and finance",
    wall: "a dark slate wall (#2A2C30 / #3A3D42 / #1A1C20)",
    stocks: "cream, cool grey and a salmon-tinted financial stock",
    drift: "leftward and slightly up",
    extras:
      "Three clippings carry a small printed line chart — a descending trace on a\nfaint grid, set in the same ink as the text, with no accent colour. Two more\ncarry a coarse halftone-dot panel standing in for a printed photograph.",
  },
];

const README = (v) => `# ${v.title}

A 4K, seamlessly looping wall of torn newspaper clippings, built in Remotion.

## The composition

| | |
|---|---|
| Composition id | \`${v.compositionId}\` |
| Resolution | **3840 × 2160 (4K UHD)** |
| Duration | 420 frames |
| Frame rate | 30 fps |
| Length | 14.0 seconds |
| Loops | Yes — frame 420 is pixel-identical to frame 0 |

The loop is exact, not crossfaded. The clippings are laid out on a repeating
lattice and the layer translates by exactly one lattice vector over the 420
frames, so the last frame hands over to the first with no seam. The wall behind
them runs on its own half-length lattice, which drifts it at half the speed for
a hint of parallax while still closing on the same frame.

## All text is fictional

**Every headline, every line of body text and every byline in this piece is
invented.** No real newspaper, masthead, publication, journalist or article is
reproduced or referenced. The body copy is generated filler built from neutral
syllables — it has the rhythm and colour of set prose at the size it is seen,
but it says nothing and is not anybody's writing. Bylines are generic desk
names ("Staff Correspondent", "Markets Desk").

## Rendering

Install once:

\`\`\`bash
npm install
\`\`\`

Render at full 4K:

\`\`\`bash
npx remotion render ${v.compositionId} out/${v.slug}.mp4 --codec=h264 --crf=12 --concurrency=8
\`\`\`

A faster 1080p preview:

\`\`\`bash
npx remotion render ${v.compositionId} out/${v.slug}-preview.mp4 --codec=h264 --crf=18 --scale=0.5
\`\`\`

\`--concurrency\` must not exceed your CPU core count; lower it if Remotion
objects.

Open the studio with \`npm run dev\`.

## What is in this variant

${v.subject.charAt(0).toUpperCase() + v.subject.slice(1)} headlines on ${v.wall},
with clippings on ${v.stocks}. The whole wall drifts ${v.drift}.

${v.extras}

Both compositions — \`ClippingsFire\` and \`ClippingsFinance\` — are registered
in this project. They share a single \`VARIANTS\` object that holds every
palette, headline set and drift direction, so both are present here and this
README describes \`${v.compositionId}\`.

## Fonts

Headlines are set in Playfair Display 900, body text in PT Serif. The font
files are vendored into \`public/fonts\` and loaded through \`FontFace\` behind
\`delayRender()\`/\`continueRender()\`, so a render never waits on the network and
is reproducible offline. Their identity and source URLs come from
\`@remotion/google-fonts\`; \`node scripts/fetch-fonts.mjs\` re-mirrors them if the
upstream version moves.

## Layout of the source

\`\`\`
src/
  Root.tsx                 composition registration
  clippings/
    variants.ts            THE palette / headline / drift table — the only
                           file in the project containing a hex literal or a
                           headline string
    constants.ts           geometry, lattice vectors, loop length
    layout.ts              where the fourteen clippings sit in one lattice block
    Clipping.ts            bakes one clipping into an offscreen canvas
    WallTexture.ts         the brushed, panelled wall
    Chart.ts               the printed line chart
    text.ts                byline treatment
    fonts.ts               font loading, gated with delayRender()
    Clippings.tsx          the composition: tiling, drift, per-frame blit
  lib/                     vendored from a shared library (remotion-lib);
                           deterministic, palette-agnostic canvas building
                           blocks — torn edges, noise fields, paper texture,
                           justified filler columns, halftone, grain, vignette
\`\`\`

Each clipping is drawn **once** into its own offscreen canvas — tear path,
paper texture, headline and body text and all — and then blitted with a
transform every frame. Regenerating tear paths and re-laying-out justified text
per frame at 4K would make the render unusable; this one optimisation is what
makes it practical.

All motion is a pure function of \`useCurrentFrame()\`. There is no
\`requestAnimationFrame\`, no \`Date.now()\`, no CSS animation and no component
state driving anything, so frames can be rendered out of order across workers
and still agree. All randomness runs through Remotion's \`random()\` with stable
string seeds.
`;

const PACKAGE_JSON = (v) =>
  JSON.stringify(
    {
      name: v.slug,
      version: "1.0.0",
      description: `${v.title} — 4K looping Remotion composition`,
      license: "UNLICENSED",
      private: true,
      scripts: {
        dev: "remotion studio",
        render: `remotion render ${v.compositionId} out/${v.slug}.mp4 --codec=h264 --crf=12 --concurrency=8`,
        preview: `remotion render ${v.compositionId} out/${v.slug}-preview.mp4 --codec=h264 --crf=18 --scale=0.5`,
        "fetch-fonts": "node scripts/fetch-fonts.mjs",
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

const ROOT_TSX = `import { Composition } from "remotion";
import { Clippings } from "./clippings/Clippings";
import {
  DURATION_IN_FRAMES,
  FPS,
  HEIGHT,
  WIDTH,
} from "./clippings/constants";

export const RemotionRoot: React.FC = () => {
  return (
    <>
      <Composition
        id="ClippingsFire"
        component={Clippings}
        durationInFrames={DURATION_IN_FRAMES}
        fps={FPS}
        width={WIDTH}
        height={HEIGHT}
        defaultProps={{ variant: "fire" as const }}
      />
      <Composition
        id="ClippingsFinance"
        component={Clippings}
        durationInFrames={DURATION_IN_FRAMES}
        fps={FPS}
        width={WIDTH}
        height={HEIGHT}
        defaultProps={{ variant: "finance" as const }}
      />
    </>
  );
};
`;

const GITIGNORE = "node_modules\nout\ndist\n.DS_Store\n.env\n";

await rm(stage, { recursive: true, force: true });
await mkdir(stage, { recursive: true });

for (const v of VARIANTS) {
  const dir = path.join(stage, v.slug);
  await mkdir(path.join(dir, "src"), { recursive: true });
  await mkdir(path.join(dir, "scripts"), { recursive: true });
  await mkdir(path.join(dir, "public", "fonts"), { recursive: true });

  // Source: only the clippings work and the vendored library.
  await cp(path.join(root, "src", "clippings"), path.join(dir, "src", "clippings"), {
    recursive: true,
  });
  await cp(path.join(root, "src", "lib"), path.join(dir, "src", "lib"), { recursive: true });
  await writeFile(path.join(dir, "src", "Root.tsx"), ROOT_TSX);
  await cp(path.join(root, "src", "index.ts"), path.join(dir, "src", "index.ts"));

  // Only the fonts this piece uses.
  for (const f of [
    "PlayfairDisplay-variable.woff2",
    "PTSerif-400.woff2",
    "PTSerif-700.woff2",
    "manifest.json",
  ]) {
    await cp(path.join(root, "public", "fonts", f), path.join(dir, "public", "fonts", f));
  }

  await cp(path.join(root, "scripts", "fetch-fonts.mjs"), path.join(dir, "scripts", "fetch-fonts.mjs"));
  await cp(path.join(root, "tsconfig.json"), path.join(dir, "tsconfig.json"));

  // remotion.config.ts without the Tailwind plugin, which this piece does not use.
  const cfg = await readFile(path.join(root, "remotion.config.ts"), "utf8");
  await writeFile(
    path.join(dir, "remotion.config.ts"),
    cfg
      .replace(`import { enableTailwind } from '@remotion/tailwind-v4';\n`, "")
      .replace(`Config.overrideBundlerConfig(enableTailwind);\n`, ""),
  );

  await writeFile(path.join(dir, "package.json"), PACKAGE_JSON(v));
  await writeFile(path.join(dir, "README.md"), README(v));
  await writeFile(path.join(dir, ".gitignore"), GITIGNORE);

  await run("zip", ["-q", "-r", `${v.slug}.zip`, v.slug], { cwd: stage });
  console.log(`built ${v.slug}.zip`);
}

console.log("\nZips are in dist-zips/");
