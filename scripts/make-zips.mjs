/**
 * Builds one self-contained, independently runnable Remotion project per
 * variant and zips it.
 *
 * The three projects share the whole engine; only the DATA differs, which is
 * the point of the architecture. Stripping is therefore mechanical: the region
 * markers around each variant's block in src/variants.ts and around each
 * <Composition> in src/Root.tsx are removed for the two variants that are not
 * being packaged.
 */
import {cpSync, mkdirSync, readFileSync, rmSync, writeFileSync} from 'node:fs';
import {execFileSync} from 'node:child_process';
import {dirname, join, resolve} from 'node:path';
import {fileURLToPath} from 'node:url';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const DIST = join(ROOT, 'dist');

const VARIANTS = [
  {
    key: 'car',
    slug: 'scan-hud-car',
    comp: 'ScanHudCar',
    title: 'Car',
    subject:
      'a generic crossover in three-quarter front view, nose to the left',
    palette: 'cyan on near-black teal',
    motion:
      'A vertical band sweeps front-to-rear across the car every 120 frames — five passes across the loop — brightening particles as it passes and leaving a short decaying trail. Each pass also flashes and re-rolls three of the panel readouts.',
  },
  {
    key: 'jet',
    slug: 'scan-hud-jet',
    comp: 'ScanHudJet',
    title: 'Jet',
    subject:
      'a generic delta-wing fighter seen from slightly above, nose to the left',
    palette: 'blue on near-black navy',
    motion:
      'A band sweeps nose-to-tail every 75 frames — eight passes across the loop — and the two afterburner nozzles pulse ±25% on their own 40-frame sine, independently of the sweep.',
  },
  {
    key: 'brain',
    slug: 'scan-hud-brain',
    comp: 'ScanHudBrain',
    title: 'Brain',
    subject: 'a human brain in side view, facing left',
    palette: 'green on near-black green',
    motion:
      'No sweep. Bright pulses originate at random points and travel ALONG the sulci, branching into two or three continuing fronts wherever folds meet and fading as they spread. Three to five pulses are alive at any moment, each lasting 40-70 frames, and the EEG trace spikes in sync with them.',
  },
];

/** Remove a `#region <tag>` ... `#endregion <tag>` block, comment fence and all. */
const stripRegion = (src, tag) => {
  const at = src.indexOf(`#region ${tag}`);
  if (at < 0) return src;
  const open = src.lastIndexOf('/*', at);
  const start = src.lastIndexOf('\n', open) + 1;
  const close = src.indexOf(`#endregion ${tag}`, at);
  if (close < 0) throw new Error(`unterminated region ${tag}`);
  const stop = src.indexOf('\n', close) + 1;
  return src.slice(0, start) + src.slice(stop);
};

const readme = (v) => `# Scan HUD — ${v.title}

A 4K "HUD scan" animation built with [Remotion](https://remotion.dev): a full
screen heads-up display with ${v.subject} rendered as a field of ~5000
particles in the central viewport.

## The composition

| | |
| --- | --- |
| Composition id | \`${v.comp}\` |
| Resolution | **3840 × 2160 (4K)** |
| Duration | 600 frames |
| Frame rate | 30 fps — 20.0 seconds |
| Loop | seamless: frame 600 is pixel-identical to frame 0 |
| Palette | ${v.palette} |

## Fonts

Roboto Mono and Barlow Condensed are loaded through \`@remotion/google-fonts\`
and **fetched from \`fonts.gstatic.com\` on the first run**, gated with
\`delayRender()\` / \`continueRender()\` so no frame is captured before they land.
Identical copies of both faces are vendored in \`public/fonts\` and registered
under the same family names automatically if that host cannot be reached, so a
render never blocks on the network.

## Install

\`\`\`sh
npm install
\`\`\`

## Preview

\`\`\`sh
npx remotion studio
\`\`\`

## Render

Full 4K:

\`\`\`sh
npx remotion render ${v.comp} out/${v.slug}.mp4 --codec=h264 --crf=12 --concurrency=8
\`\`\`

1080p preview (half scale):

\`\`\`sh
npx remotion render ${v.comp} out/${v.slug}-preview.mp4 --codec=h264 --crf=18 --scale=0.5
\`\`\`

Lower \`--concurrency\` if the machine has fewer than 8 cores.

## How it works

**Everything is a pure function of \`useCurrentFrame()\`.** No \`Date.now()\`, no
\`requestAnimationFrame\`, no CSS animation, no component state driving motion.
Every random value comes from Remotion's \`random()\` with a stable string seed,
and every cadence — twinkle periods, panel re-rolls, radar rotations, the sweep
— divides 600 exactly, which is what makes the loop close.

**\`src/variants.ts\` is the only place** that holds a palette, a silhouette path,
a density rule, an animation mode or a panel label. Nothing downstream knows
what the subject is.

**The particle field** (\`src/lib/silhouette.ts\`) is built once per render:

1. the silhouette is filled into an offscreen canvas;
2. its outer edges and its interior crease lines are stroked into a second one;
3. a chamfer distance transform turns that into a distance field — for every
   pixel, how far to the nearest edge or crease;
4. the cells of a coarse 8px grid are then accepted with a probability that
   falls off exponentially with that distance, so particles crowd the edges and
   creases and thin out across flat interior areas. Nothing is placed by hand.

A brightness gradient across the subject supplies the sense of volume, and each
particle twinkles on its own seeded sine whose period divides 600.

**The motion.** ${v.motion}

**Performance.** The particle set is sampled once. The HUD frame and every
panel's chrome are rasterised once into offscreen canvases and blitted; only
values, the sweep and particle brightness are redrawn per frame.

## Layout

\`\`\`
src/
  index.ts                    registerRoot
  Root.tsx                    the ${v.comp} composition
  ScanHud.tsx                 layout, timeline, ambient drift
  variants.ts                 palette, paths, density, motion, labels
  components/
    HudFrame.tsx              brackets, dividers, viewport window
    SidePanel.tsx             a region of the HUD
    ReadoutBlock.tsx          the twelve panel kinds
    SubjectParticles.tsx      the particle field
    ScanSweep.tsx             the sweep band and its maths
    Overlay.tsx               vignette, scanlines, grain
  lib/
    layout.ts                 4K geometry
    silhouette.ts             mask, distance field, sampling
    propagate.ts              pulse graph and wavefronts
    chrome.ts                 panel shell drawing
    color.ts  fonts.ts  rand.ts
public/fonts/                 vendored webfont fallbacks
\`\`\`
`;

rmSync(DIST, {recursive: true, force: true});
mkdirSync(DIST, {recursive: true});

for (const v of VARIANTS) {
  const dir = join(DIST, v.slug);
  mkdirSync(dir, {recursive: true});

  cpSync(join(ROOT, 'src'), join(dir, 'src'), {recursive: true});
  cpSync(join(ROOT, 'public'), join(dir, 'public'), {recursive: true});
  for (const f of ['tsconfig.json', 'remotion.config.ts', '.gitignore']) {
    cpSync(join(ROOT, f), join(dir, f));
  }

  const others = VARIANTS.filter((o) => o.key !== v.key);

  let variants = readFileSync(join(dir, 'src/variants.ts'), 'utf8');
  for (const o of others) {
    variants = stripRegion(variants, `variant:${o.key}`);
    variants = stripRegion(variants, `register:${o.key}`);
  }
  variants = variants.replace(
    /export type VariantKey = .*;/,
    `export type VariantKey = '${v.key}';`,
  );
  writeFileSync(join(dir, 'src/variants.ts'), variants);

  let root = readFileSync(join(dir, 'src/Root.tsx'), 'utf8');
  for (const o of others) root = stripRegion(root, `register:${o.key}`);
  writeFileSync(join(dir, 'src/Root.tsx'), root);

  const pkg = JSON.parse(readFileSync(join(ROOT, 'package.json'), 'utf8'));
  pkg.name = v.slug;
  pkg.description = `4K HUD scan animation (${v.title}) built with Remotion.`;
  pkg.scripts = {
    start: 'remotion studio',
    render: `remotion render ${v.comp} out/${v.slug}.mp4 --codec=h264 --crf=12 --concurrency=8`,
    preview: `remotion render ${v.comp} out/${v.slug}-preview.mp4 --codec=h264 --crf=18 --scale=0.5`,
    upgrade: 'remotion upgrade',
  };
  writeFileSync(join(dir, 'package.json'), JSON.stringify(pkg, null, 2) + '\n');

  writeFileSync(join(dir, 'README.md'), readme(v));

  const zip = join(DIST, `${v.slug}.zip`);
  rmSync(zip, {force: true});
  execFileSync('zip', ['-rq', zip, v.slug], {cwd: DIST});
  console.log(`built ${v.slug}.zip`);
}
