#!/usr/bin/env node
/**
 * Produces two self-contained, independently runnable Remotion projects — one
 * per version — and zips each. Nothing is hand-maintained in triplicate: the
 * layer code is copied verbatim, and only variants.ts, Root.tsx, package.json
 * and README.md are rewritten so each project carries exactly one variant.
 */
import {execFileSync} from 'node:child_process';
import {cpSync, existsSync, mkdirSync, readFileSync, rmSync, writeFileSync} from 'node:fs';
import {dirname, join} from 'node:path';
import {fileURLToPath} from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const build = join(root, '.zipbuild');
const dist = join(root, 'deliverables');

const TARGETS = [
  {
    variant: 'denied',
    slug: 'access-denied',
    compId: 'AccessDenied',
    title: 'Access Denied — 4K terminal alert',
    loops: true,
  },
  {
    variant: 'granted',
    slug: 'access-granted',
    compId: 'AccessGranted',
    title: 'Access Granted — 4K terminal alert',
    loops: false,
  },
];

const region = (src, name) => {
  const open = `// >>>REGION:${name}\n`;
  const close = `// <<<REGION:${name}\n`;
  const a = src.indexOf(open);
  const b = src.indexOf(close);
  if (a < 0 || b < 0) throw new Error(`region ${name} not found`);
  return src.slice(a + open.length, b);
};

const singleVariantSource = (src, variant) => {
  const header = src.slice(0, src.indexOf('// >>>REGION:types'));
  const body = [
    header.trimEnd(),
    '',
    region(src, 'types').trim(),
    '',
    `export type VariantName = '${variant}';`,
    '',
    region(src, variant).trim(),
    '',
    '// This project ships one version. The variant data is inlined here rather',
    '// than selected out of a shared two-key object.',
    `export const VARIANT: VariantConfig = ${variant};`,
    '',
    'export const getVariant = (_name: VariantName): VariantConfig => VARIANT;',
    '',
  ].join('\n');
  return body.includes('random(')
    ? body
    : body.replace("import {random} from 'remotion';\n", '');
};

const rootSource = (target) => `import {Composition} from 'remotion';
import {TerminalAlert} from './TerminalAlert';
import {DURATION, FPS, HEIGHT, WIDTH} from './lib/constants';

export const RemotionRoot: React.FC = () => {
  return (
    <Composition
      id="${target.compId}"
      component={TerminalAlert}
      durationInFrames={DURATION}
      fps={FPS}
      width={WIDTH}
      height={HEIGHT}
      defaultProps={{variant: '${target.variant}' as const}}
    />
  );
};
`;

const readme = (target) => `# ${target.title}

A 4K "access ${target.variant}" terminal alert, built in Remotion as a 2D canvas
composition. No 3D, no Three.js, no audio, no real logos or real text — every
line on screen is invented for this piece.

## The composition

| | |
| --- | --- |
| Composition id | \`${target.compId}\` |
| Resolution | 3840 × 2160 (4K UHD) |
| Duration | 300 frames |
| Frame rate | 30 fps (10.0 s) |
| Loops | ${target.loops ? '**Yes** — frame 0 and frame 300 are pixel-identical, so it can be cut as a seamless loop.' : '**No** — this is a one-shot resolution. Frames 0 and 300 differ by design: the piece opens unstable and ends stable, with a closing confirmation pulse.'} |

## Render

Install once, then render at full 4K:

\`\`\`bash
npm install
npx remotion render ${target.compId} out/${target.slug}.mp4 --codec=h264 --crf=12 --concurrency=8
\`\`\`

A faster 1080p preview (same framing, half the pixels):

\`\`\`bash
npx remotion render ${target.compId} out/${target.slug}-preview.mp4 --codec=h264 --crf=18 --scale=0.5
\`\`\`

\`--concurrency\` must not exceed the number of CPU cores available.

Open the studio to scrub frame by frame:

\`\`\`bash
npm run dev
\`\`\`

## How it is put together

Five layers composite into a single 3840 × 2160 canvas, in this order:

1. **\`TextLayer\`** — a dense monospace page (three columns, sixty rows) laid
   out once into an offscreen buffer and blitted with a translation each frame.
   The block is exactly one frame tall and scrolls by \`(frame / 300) × blockHeight\`,
   so it tiles against itself. Runs of lines are periodically replaced by garbled
   character runs.
2. **\`ColourWash\`** — the frame is recoloured to the dominant hue with its
   luminance preserved, then flooded, so the page survives only as darker and
   lighter striations. Carries CRT banding, an upper-third lift and vertical streaks.
3. **\`Banner\`** — a hard-edged black bar with heavy italic caps, wide tracking,
   a persistent chromatic fringe and a slight bloom.
4. **\`TearPass\`** — horizontal slices of the composited frame displaced
   sideways, some with their colour channels pulled apart, some dropped to a flat
   block, some replaced by a duplicate of the text layer from a different offset.
5. **\`ScanlinePass\`** — scanlines, vignette and grain.

Everything the layers do is driven by a **single instability curve** in
\`src/variants.ts\`: a function of frame returning 0–1 that scales tear frequency,
slice displacement, chromatic offset, wash opacity and banner jitter together.
${
  target.loops
    ? 'Here it holds high (0.65–1.0) on an irregular oscillation whose period divides\nevenly into 300 — the system is already failing when the clip opens and still\nfailing when it ends.'
    : 'Here it starts at 1.0, thins out from frame 45, reaches zero by frame 252, and\nholds stable while a single soft brightness pulse crosses the frame over the\nclosing 25 frames.'
}

## Determinism

Every frame is a pure function of \`useCurrentFrame()\`. There is no
\`Date.now()\`, no \`requestAnimationFrame\`, no CSS animation and no state that
survives a frame; all randomness comes from Remotion's seeded \`random()\`.
Frames can be rendered in any order, on any machine, and come out identical.

Fonts are vendored into \`public/fonts/\` and loaded through
\`@remotion/google-fonts\`, gated with \`delayRender()\`/\`continueRender()\`, so a
render never touches the network.
`;

const pkgSource = (target) => {
  const pkg = JSON.parse(readFileSync(join(root, 'package.json'), 'utf8'));
  return `${JSON.stringify(
    {
      ...pkg,
      name: target.slug,
      description: target.title,
      scripts: {dev: 'remotion studio', lint: 'tsc --noEmit'},
    },
    null,
    2,
  )}\n`;
};

rmSync(build, {recursive: true, force: true});
mkdirSync(build, {recursive: true});
mkdirSync(dist, {recursive: true});

const variantsSrc = readFileSync(join(root, 'src/variants.ts'), 'utf8');

for (const target of TARGETS) {
  const proj = join(build, target.slug);
  mkdirSync(proj, {recursive: true});

  cpSync(join(root, 'src'), join(proj, 'src'), {recursive: true});
  cpSync(join(root, 'public'), join(proj, 'public'), {recursive: true});
  for (const file of ['remotion.config.ts', '.gitignore']) {
    cpSync(join(root, file), join(proj, file));
  }
  // The shipped project has no scripts/ directory of its own.
  writeFileSync(
    join(proj, 'tsconfig.json'),
    readFileSync(join(root, 'tsconfig.json'), 'utf8').replace('"src", "scripts", ', '"src", '),
  );

  writeFileSync(join(proj, 'src/variants.ts'), singleVariantSource(variantsSrc, target.variant));
  writeFileSync(join(proj, 'src/Root.tsx'), rootSource(target));
  writeFileSync(join(proj, 'package.json'), pkgSource(target));
  writeFileSync(join(proj, 'README.md'), readme(target));

  const zip = join(dist, `${target.slug}.zip`);
  if (existsSync(zip)) rmSync(zip);
  execFileSync(
    'zip',
    ['-q', '-r', zip, target.slug, '-x', '*/node_modules/*', '*/out/*', '*/.git/*'],
    {cwd: build, stdio: 'inherit'},
  );
  console.log(`built ${zip}`);
}
