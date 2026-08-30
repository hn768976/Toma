/**
 * Builds one self-contained Remotion project per variant and zips it.
 *
 * Each project carries only its own composition and only its own palette and
 * motion settings — the three-key VARIANTS object is not shipped. The shared
 * engine (dot generation, motion maths, the dot grid itself) is copied as-is,
 * because it is generic over the motion mode by design; what varies per zip is
 * the config, the composition, and which layer components are mounted.
 *
 *   node tools/package.mjs
 */

import {execFileSync} from 'node:child_process';
import {
  cpSync,
  existsSync,
  mkdirSync,
  readFileSync,
  readdirSync,
  rmSync,
  writeFileSync,
} from 'node:fs';
import {dirname, join, relative, resolve} from 'node:path';
import {fileURLToPath} from 'node:url';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const dist = join(root, 'dist');

const VARIANTS = [
  {
    name: 'navy',
    compositionId: 'DotMapNavy',
    title: 'Dotted world map — navy, ambient shimmer',
    outputName: 'dotmap-navy',
    summary:
      'A deep-navy dotted world map at rest: every dot breathes on its own ' +
      'seeded sine, a scattering of dots flashes brighter, and the whole map ' +
      'drifts on a slow closed path. Nothing sweeps and nothing propagates.',
    layers: [],
  },
  {
    name: 'green',
    compositionId: 'DotMapGreen',
    title: 'Dotted world map — green, scanning sweep',
    outputName: 'dotmap-green',
    summary:
      'A green dotted world map under a scan: a thin bright line travels top ' +
      'to bottom three times over the loop, dots brighten sharply as it ' +
      'crosses them and decay behind it, and a small readout counts each ' +
      'pass from 00% to 99%.',
    layers: [{component: 'SweepLine', props: 'config={VARIANT}'}],
  },
  {
    name: 'amber',
    compositionId: 'DotMapAmber',
    title: 'Dotted world map — amber, regional hotspots',
    outputName: 'dotmap-amber',
    summary:
      'An amber dotted world map with eight regions activating in turn: each ' +
      'lights from its centre outward, two or three overlap at any moment, ' +
      'and arcs bow between the regions that are lit together.',
    layers: [
      {component: 'HotspotLayer', props: 'field={field} config={VARIANT}'},
    ],
  },
];

/** Every source file that is identical in all three projects. */
const SHARED_SOURCES = [
  'src/constants.ts',
  'src/index.ts',
  'src/components/BackgroundWash.tsx',
  'src/components/DotGrid.tsx',
  'src/components/GrainVignette.tsx',
  'src/lib/canvas.ts',
  'src/lib/color.ts',
  'src/lib/dots.ts',
  'src/lib/motion.ts',
  'src/lib/regions.ts',
  'src/lib/useDotField.ts',
];

/** Points a copied file at the single-variant config module. */
const retarget = (source) =>
  source
    .replaceAll("from '../variants'", "from '../variant'")
    .replaceAll("from './variants'", "from './variant'");

/** Lifts one variant's object literal out of the shared VARIANTS record. */
const extractVariantLiteral = (source, name) => {
  const marker = `  ${name}: {`;
  const start = source.indexOf(marker);
  if (start === -1) {
    throw new Error(`Could not find the ${name} variant in src/variants.ts`);
  }
  let depth = 0;
  let i = source.indexOf('{', start);
  const open = i;
  for (; i < source.length; i++) {
    if (source[i] === '{') {
      depth++;
    } else if (source[i] === '}') {
      depth--;
      if (depth === 0) {
        break;
      }
    }
  }
  return source
    .slice(open, i + 1)
    .split('\n')
    .map((line, index) => (index === 0 ? line : line.replace(/^ {2}/, '')))
    .join('\n');
};

/**
 * Drops a top-level `const` whose value is never read. A variant that does not
 * sweep ships no sweep placeholder, and so on; `noUnusedLocals` would reject
 * the generated file otherwise.
 */
const dropUnusedConst = (source, name) => {
  const references = source.match(new RegExp(`\\b${name}\\b`, 'g')) ?? [];
  if (references.length !== 1) {
    return source;
  }
  return source
    .split('\n\n')
    .filter(
      (block) => !new RegExp(`(^|\\*/\\n)const ${name}\\b`).test(block),
    )
    .join('\n\n');
};

const buildVariantModule = (source, variant) => {
  const head = source.slice(0, source.indexOf('export const VARIANTS'));
  const header = head
    .replace(
      /^\/\*\*[\s\S]*?\*\/\n/,
      `/**\n * Every colour and every motion parameter for the ${variant.name} map.\n *\n * There are no colour literals or tuned constants anywhere else in the\n * render path, so this file is the only place to change how it looks.\n */\n`,
    )
    .replace(
      /export type VariantName =[^;]*;/,
      `export type VariantName = '${variant.name}';`,
    );
  const module = `${header}/** The ${variant.name} map. */\nexport const VARIANT: VariantConfig = ${extractVariantLiteral(
    source,
    variant.name,
  )};\n`;
  return ['INERT_SWEEP', 'INERT_HOTSPOT', 'REGIONS'].reduce(
    dropUnusedConst,
    module,
  );
};

const buildDotMap = (variant) => {
  const layerImports = variant.layers
    .map(
      (layer) =>
        `import {${layer.component}} from './components/${layer.component}';`,
    )
    .join('\n');
  const layerElements = variant.layers
    .map((layer) => `          <${layer.component} ${layer.props} />\n`)
    .join('');
  return `import React from 'react';
import {AbsoluteFill, useVideoConfig} from 'remotion';
import {BackgroundWash} from './components/BackgroundWash';
import {DotGrid} from './components/DotGrid';
import {GrainVignette} from './components/GrainVignette';
${layerImports}${layerImports ? '\n' : ''}import {useDotField} from './lib/useDotField';
import {VARIANT} from './variant';

export const DotMap: React.FC = () => {
  const {width, height} = useVideoConfig();
  const field = useDotField(width, height);

  return (
    <AbsoluteFill style={{backgroundColor: VARIANT.palette.deep}}>
      {field ? (
        <>
          <BackgroundWash field={field} config={VARIANT} />
          <DotGrid field={field} config={VARIANT} />
${layerElements}          <GrainVignette config={VARIANT} />
        </>
      ) : null}
    </AbsoluteFill>
  );
};
`;
};

const buildRoot = (variant) => `import React from 'react';
import {Composition} from 'remotion';
import {FPS, HEIGHT, LOOP_FRAMES, WIDTH} from './constants';
import {DotMap} from './DotMap';

export const RemotionRoot: React.FC = () => {
  return (
    <Composition
      id="${variant.compositionId}"
      component={DotMap}
      durationInFrames={LOOP_FRAMES}
      fps={FPS}
      width={WIDTH}
      height={HEIGHT}
    />
  );
};
`;

const buildPackageJson = (variant, base) =>
  `${JSON.stringify(
    {
      name: `dot-map-${variant.name}`,
      version: '1.0.0',
      description: variant.title,
      license: 'UNLICENSED',
      private: true,
      dependencies: base.dependencies,
      devDependencies: Object.fromEntries(
        Object.entries(base.devDependencies).filter(
          ([dep]) => dep !== 'world-atlas',
        ),
      ),
      scripts: {
        dev: 'remotion studio',
        build: 'remotion bundle',
        lint: 'tsc',
      },
    },
    null,
    2,
  )}\n`;

const buildReadme = (variant) => `# ${variant.title}

${variant.summary}

## The composition

| | |
| --- | --- |
| Composition id | \`${variant.compositionId}\` |
| Resolution | 3840 × 2160 (4K UHD) |
| Duration | 600 frames |
| Frame rate | 30 fps |
| Length | 20.0 seconds |

**It loops.** Frame 600 is pixel-identical to frame 0, and every oscillation,
sweep pass and hotspot cycle divides evenly into 600 — so the clip can be
played end to end on repeat with no seam. The loop period is the
\`LOOP_FRAMES\` constant in \`src/constants.ts\`.

Every value in the animation is a pure function of \`useCurrentFrame()\`, and
every random value comes from Remotion's seeded \`random()\`. There is no
\`Date.now()\`, no \`requestAnimationFrame\`, no CSS animation and no component
state, so the render is deterministic: the same frame always produces the same
pixels. There is no audio and no text apart from the scan readout in the green
version.

## Running it

\`\`\`bash
npm install
npx remotion studio
\`\`\`

## Rendering at 4K

\`\`\`bash
npx remotion render ${variant.compositionId} out/${variant.outputName}.mp4 --codec=h264 --crf=12 --concurrency=8
\`\`\`

\`--concurrency\` cannot exceed the number of CPU cores on the machine; lower it
if the render refuses to start. For a quick 1080p check, add \`--scale=0.5\`.

## The map data

\`public/countries-110m.json\` is the Natural Earth 1:110m Admin 0 countries
dataset, in TopoJSON form as published in
[world-atlas](https://github.com/topojson/world-atlas).

**Natural Earth is in the public domain — no attribution is required and no
permission is needed to use it for any purpose**, commercial work included.
See [naturalearthdata.com/about/terms-of-use](https://www.naturalearthdata.com/about/terms-of-use/).

At load time the country polygons are merged into a single land geometry with
their internal borders dissolved, and Antarctica is dropped — it adds a heavy
band along the bottom of the frame and unbalances the composition.

The land is projected with d3-geo's equirectangular projection, fitted edge to
edge across the frame, and rasterised once to an offscreen mask. A 13px grid of
screen positions is then tested against that mask, and the positions that land
on land become the dots. Dots with fewer than 6 land neighbours are treated as
coastal and drawn brighter; that edge emphasis is what makes the continents
legible at a glance.

## How it is put together

\`\`\`
src/
  Root.tsx                     registers ${variant.compositionId}
  DotMap.tsx                   stacks the canvas layers
  variant.ts                   the palette and every motion parameter
  constants.ts                 loop length, frame rate, frame size
  components/
    BackgroundWash.tsx         base gradient, radial wash, full-frame grid
    DotGrid.tsx                the land dots and their per-frame modulation
${variant.layers
  .map(
    (layer) =>
      `    ${layer.component}.tsx${' '.repeat(
        Math.max(1, 27 - layer.component.length - 4),
      )}${
        layer.component === 'SweepLine'
          ? 'the scan line, its glow and the readout'
          : 'the arcs between simultaneously lit regions'
      }\n`,
  )
  .join('')}    GrainVignette.tsx          vignette and film grain
  lib/
    dots.ts                    builds the dot set from the map data
    motion.ts                  every per-frame value, all loop-closed
    regions.ts                 which dots belong to which region
    canvas.ts                  batched square drawing
    color.ts                   hex parsing and mixing
    useDotField.ts             loads the map and builds the field once
public/
  countries-110m.json          Natural Earth 110m, public domain
\`\`\`

Each layer owns a canvas with a 3840 × 2160 backing store and draws to it once
per React render. The static dot field is baked to an offscreen canvas a single
time and blitted every frame; only the brightness modulation is drawn on top,
batched into one \`Path2D\` per colour and alpha step. Redrawing tens of
thousands of squares individually at 4K would be far slower.
`;

/* ── build ───────────────────────────────────────────────────────────────── */

const variantsSource = readFileSync(join(root, 'src/variants.ts'), 'utf8');
const basePackage = JSON.parse(readFileSync(join(root, 'package.json'), 'utf8'));

rmSync(dist, {recursive: true, force: true});
mkdirSync(dist, {recursive: true});

for (const variant of VARIANTS) {
  const project = join(dist, `dot-map-${variant.name}`);

  for (const file of SHARED_SOURCES) {
    const target = join(project, file);
    mkdirSync(dirname(target), {recursive: true});
    writeFileSync(target, retarget(readFileSync(join(root, file), 'utf8')));
  }
  for (const layer of variant.layers) {
    const file = `src/components/${layer.component}.tsx`;
    writeFileSync(
      join(project, file),
      retarget(readFileSync(join(root, file), 'utf8')),
    );
  }

  writeFileSync(
    join(project, 'src/variant.ts'),
    buildVariantModule(variantsSource, variant),
  );
  writeFileSync(join(project, 'src/DotMap.tsx'), buildDotMap(variant));
  writeFileSync(join(project, 'src/Root.tsx'), buildRoot(variant));
  writeFileSync(
    join(project, 'package.json'),
    buildPackageJson(variant, basePackage),
  );
  writeFileSync(join(project, 'README.md'), buildReadme(variant));

  cpSync(join(root, 'tsconfig.json'), join(project, 'tsconfig.json'));
  cpSync(join(root, 'remotion.config.ts'), join(project, 'remotion.config.ts'));
  writeFileSync(join(project, '.gitignore'), 'node_modules\nout\n');
  mkdirSync(join(project, 'public'), {recursive: true});
  cpSync(
    join(root, 'public/countries-110m.json'),
    join(project, 'public/countries-110m.json'),
  );

  console.log(`built ${relative(root, project)}`);
}

/* Type-check each project against the shared install before zipping. */
for (const variant of VARIANTS) {
  const project = join(dist, `dot-map-${variant.name}`);
  const modules = join(project, 'node_modules');
  if (!existsSync(modules)) {
    execFileSync('ln', ['-s', join(root, 'node_modules'), modules]);
  }
  execFileSync(join(root, 'node_modules/.bin/tsc'), ['-p', project], {
    stdio: 'inherit',
  });
  rmSync(modules, {force: true});
  console.log(`type-checked dot-map-${variant.name}`);
}

/* Zip. node_modules, out/ and .git are never created, so nothing to exclude. */
for (const variant of VARIANTS) {
  const name = `dot-map-${variant.name}`;
  const archive = join(dist, `${name}.zip`);
  rmSync(archive, {force: true});
  execFileSync(
    'zip',
    ['-r', '-q', archive, name, '-x', '*/node_modules/*', '*/out/*', '*/.git/*'],
    {cwd: dist},
  );
  const files = readdirSync(join(dist, name));
  console.log(`packaged ${name}.zip (${files.length} top-level entries)`);
}
