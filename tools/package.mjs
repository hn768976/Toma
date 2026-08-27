/**
 * Builds one self-contained, single-version Remotion project per variant and
 * zips it.
 *
 *   node tools/package.mjs
 *
 * Source files carry prune markers so each project really does contain only its
 * own version rather than three versions with two switched off:
 *
 *   // @only:NAME        on its own line, paired with a later "// @end",
 *                        keeps the enclosed block only for NAME
 *   ... code  // @only:NAME
 *                        keeps that single line only for NAME
 *
 * NAME is a background mode or a subject animation mode, or a comma-separated
 * list of them. Markers are stripped from the emitted files either way.
 */
import {execFileSync} from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const BUILD = path.join(ROOT, 'build');
const DIST = path.join(ROOT, 'dist');

const VARIANTS = [
  {
    name: 'front',
    composition: 'ParticleFigureFront',
    background: 'circuit',
    subject: 'shimmer',
    title: 'Particle Figure — Front',
    blurb:
      'A featureless head and shoulders seen front-on, cyan on deep blue, over a ' +
      'drifting field of violet circuit-trace fragments.',
  },
  {
    name: 'profile',
    composition: 'ParticleFigureProfile',
    background: 'text',
    subject: 'stream',
    title: 'Particle Figure — Profile',
    blurb:
      'The same head and shoulders in full left profile, indigo, with ribbons of ' +
      'particles streaming out of the back of the skull over drifting rows of ' +
      'illegible characters.',
  },
  {
    name: 'hands',
    composition: 'ParticleFigureHands',
    background: 'dots',
    subject: 'sphere',
    title: 'Particle Figure — Hands',
    blurb:
      'Two open hands cupped palms-up around a rotating particle sphere, green on ' +
      'near-black, over a sparse drifting dot grid.',
  },
];

const ONLY_BLOCK = /^\s*\/\/ @only:([a-z,]+)\s*$/;
const ONLY_INLINE = /\s*\/\/ @only:([a-z,]+)\s*$/;
const END_BLOCK = /^\s*\/\/ @end\s*$/;

/** Applies the prune markers, keeping only the named modes. */
const prune = (source, keep) => {
  const out = [];
  const stack = [];
  for (const line of source.split('\n')) {
    const block = line.match(ONLY_BLOCK);
    if (block) {
      stack.push(block[1].split(',').some((m) => keep.has(m)));
      continue;
    }
    if (END_BLOCK.test(line)) {
      if (stack.length === 0) throw new Error('unbalanced // @end');
      stack.pop();
      continue;
    }
    if (stack.some((k) => !k)) continue;
    const inline = line.match(ONLY_INLINE);
    if (inline) {
      if (!inline[1].split(',').some((m) => keep.has(m))) continue;
      out.push(line.replace(ONLY_INLINE, ''));
      continue;
    }
    out.push(line);
  }
  if (stack.length !== 0) throw new Error('unbalanced // @only');
  return out.join('\n');
};

/** Pulls one entry out of the VARIANTS object literal by brace matching. */
const extractEntry = (source, name) => {
  const start = source.indexOf(`\n  ${name}: {`);
  if (start < 0) throw new Error(`variant ${name} not found`);
  let depth = 0;
  let i = source.indexOf('{', start);
  for (; i < source.length; i++) {
    if (source[i] === '{') depth++;
    else if (source[i] === '}') {
      depth--;
      if (depth === 0) break;
    }
  }
  return source.slice(start + 1, i + 1) + ',';
};

const singleVariantSource = (source, v) => {
  const head = source.slice(0, source.indexOf('export type VariantName'));
  return (
    head +
    `export type VariantName = '${v.name}';\n\n` +
    '/**\n' +
    ' * The single source of truth for every colour and every shape in the piece.\n' +
    ' * Nothing outside this file may contain a hex literal or a path string.\n' +
    ' */\n' +
    'export const VARIANTS: Record<VariantName, VariantSpec> = {\n' +
    extractEntry(source, v.name) +
    '\n};\n'
  )
    .replace(
      /export type BackgroundMode = [^;]+;/,
      `export type BackgroundMode = '${v.background}';`,
    )
    .replace(
      /export type SubjectMode = [^;]+;/,
      `export type SubjectMode = '${v.subject}';`,
    );
};

const rootSource = (v) => `import React from 'react';
import {Composition} from 'remotion';
import {ParticleFigure} from './ParticleFigure';

export const RemotionRoot: React.FC = () => {
  return (
    <Composition
      id="${v.composition}"
      component={ParticleFigure}
      durationInFrames={480}
      fps={30}
      width={3840}
      height={2160}
      defaultProps={{variant: '${v.name}' as const}}
    />
  );
};
`;

const readme = (v) => `# ${v.title}

${v.blurb}

A single Remotion composition rendered entirely into one 2D \`<canvas>\`. No 3D,
no WebGL, no \`requestAnimationFrame\`: every value on screen is a pure function
of \`useCurrentFrame()\`.

| | |
| --- | --- |
| Composition id | \`${v.composition}\` |
| Resolution | **4K — 3840 × 2160** |
| Duration | **480 frames** (16.0 s) |
| Frame rate | **30 fps** |
| Loop | seamless — frame 0 and frame 480 are pixel-identical |
| Audio | none |

## Install

\`\`\`bash
npm install
\`\`\`

## Render at 4K

\`\`\`bash
npx remotion render ${v.composition} out/${v.name}-4k.mp4 --codec=h264 --crf=18
\`\`\`

The canvas backing store is always 3840 × 2160, so \`--scale=0.5\` gives a true
1080p downsample of the same 4K image rather than a smaller render:

\`\`\`bash
npx remotion render ${v.composition} out/${v.name}-1080p.mp4 --codec=h264 --crf=18 --scale=0.5
\`\`\`

\`--concurrency=N\` may be added; Remotion caps N at the machine's core count.

## Preview

\`\`\`bash
npm run dev
\`\`\`

## How it is put together

- \`src/variants.ts\` — the only file containing a hex literal or a path string:
  palette, silhouette, background mode and subject animation mode.
- \`src/lib/mask.ts\` — rasterises the silhouette to a mask and derives an
  edge-distance field, a crease field, and per-row/per-column span bounds.
- \`src/lib/grid.ts\` — the distorted grid. Vertical lines are spaced evenly in a
  surface *angle*, and \`sin\` of that angle is where they land on screen, so
  spacing compresses toward the silhouette boundary exactly the way a cylinder's
  surface does. This is what makes a flat mask read as a body with volume.
- \`src/lib/particles.ts\` — samples ~7000 particles **once** against the mask,
  weighted toward the boundary so the interior stays sparse and dark, then snaps
  them onto that same grid.
- \`src/components/\` — \`BackgroundLayer\`, \`GridOverlay\` and
  \`SubjectParticles\` each paint into one shared canvas from a layout effect;
  React flushes those in tree order, which fixes the compositing order.

## Timeline

| Frames | |
| --- | --- |
| 0 – 30 | background only |
| 30 – 120 | the figure assembles out of a wide scatter |
| 120 – 420 | idle: it never rotates or translates, it breathes (±0.8% scale, 4 s period) |
| 420 – 480 | it dissolves back to the scatter it came from |

The last phase is what makes the loop seamless. A loop whose first frame is
"empty background only" can only return to that state if the figure leaves, so
the dissolve mirrors the assembly and frame 480 lands exactly on frame 0.
`;

const copyTree = (from, to, transform) => {
  fs.mkdirSync(to, {recursive: true});
  for (const entry of fs.readdirSync(from, {withFileTypes: true})) {
    const src = path.join(from, entry.name);
    const dst = path.join(to, entry.name);
    if (entry.isDirectory()) copyTree(src, dst, transform);
    else {
      const text = fs.readFileSync(src, 'utf8');
      fs.writeFileSync(dst, transform(path.relative(ROOT, src), text));
    }
  }
};

fs.rmSync(BUILD, {recursive: true, force: true});
fs.mkdirSync(DIST, {recursive: true});

const variantsSource = fs.readFileSync(path.join(ROOT, 'src/variants.ts'), 'utf8');
const pkg = JSON.parse(fs.readFileSync(path.join(ROOT, 'package.json'), 'utf8'));

for (const v of VARIANTS) {
  const dest = path.join(BUILD, `particle-figure-${v.name}`);
  const keep = new Set([v.background, v.subject]);

  copyTree(path.join(ROOT, 'src'), path.join(dest, 'src'), (rel, text) =>
    rel.endsWith('.ts') || rel.endsWith('.tsx') ? prune(text, keep) : text,
  );
  copyTree(path.join(ROOT, 'public'), path.join(dest, 'public'), (_, t) => t);

  for (const file of ['tsconfig.json', 'remotion.config.ts']) {
    fs.copyFileSync(path.join(ROOT, file), path.join(dest, file));
  }

  if (v.subject !== 'stream') fs.rmSync(path.join(dest, 'src/lib/streams.ts'), {force: true});
  if (v.subject !== 'sphere') fs.rmSync(path.join(dest, 'src/lib/sphere.ts'), {force: true});

  fs.writeFileSync(
    path.join(dest, 'src/variants.ts'),
    singleVariantSource(variantsSource, v),
  );
  fs.writeFileSync(path.join(dest, 'src/Root.tsx'), rootSource(v));
  fs.writeFileSync(path.join(dest, 'README.md'), readme(v));
  fs.writeFileSync(
    path.join(dest, 'package.json'),
    JSON.stringify(
      {
        name: `particle-figure-${v.name}`,
        version: '1.0.0',
        private: true,
        description: `${v.title} — 4K Remotion composition.`,
        scripts: {
          dev: 'remotion studio',
          render: `remotion render ${v.composition} out/${v.name}-4k.mp4 --codec=h264 --crf=18`,
          'render:1080p': `remotion render ${v.composition} out/${v.name}-1080p.mp4 --codec=h264 --crf=18 --scale=0.5`,
          typecheck: 'tsc --noEmit',
        },
        dependencies: pkg.dependencies,
        devDependencies: pkg.devDependencies,
      },
      null,
      2,
    ) + '\n',
  );

  const zip = path.join(DIST, `particle-figure-${v.name}.zip`);
  fs.rmSync(zip, {force: true});
  execFileSync(
    'zip',
    ['-r', '-q', zip, `particle-figure-${v.name}`, '-x', '*/node_modules/*', '*/out/*', '*/.git/*'],
    {cwd: BUILD},
  );
  console.log(`packaged ${path.relative(ROOT, zip)}`);
}
