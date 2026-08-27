/**
 * Builds three self-contained single-variant Remotion projects and zips them:
 *   neuron-blue.zip / neuron-green.zip / neuron-indigo.zip
 *
 * Each standalone project registers only its own composition, with that
 * variant's data inlined into src/variants.ts instead of a shared
 * three-key object. Excludes node_modules/, out/ and .git/.
 *
 * Usage: node scripts/make-standalone.js
 */
const fs = require('fs');
const path = require('path');
const {execSync} = require('child_process');

const ROOT = path.join(__dirname, '..');
const STAGE = path.join(ROOT, 'build', 'standalone');

// Transpile variants.ts so we can read the VARIANTS object at build time
execSync(
  'npx tsc src/variants.ts --outDir build/tmp-variants --module commonjs --target ES2020 --skipLibCheck',
  {cwd: ROOT, stdio: 'inherit'}
);
const {VARIANTS} = require(path.join(ROOT, 'build', 'tmp-variants', 'variants.js'));

const VERSIONS = [
  {key: 'blue', compId: 'NeuronBlue', zip: 'neuron-blue', outName: 'neuron-blue'},
  {key: 'green', compId: 'NeuronGreen', zip: 'neuron-green', outName: 'neuron-green'},
  {key: 'indigo', compId: 'NeuronIndigo', zip: 'neuron-indigo', outName: 'neuron-indigo'},
];

const read = (p) => fs.readFileSync(path.join(ROOT, p), 'utf8');
const writeTo = (dir, rel, content) => {
  const p = path.join(dir, rel);
  fs.mkdirSync(path.dirname(p), {recursive: true});
  fs.writeFileSync(p, content);
};

/** Serialize a JS value as a readable TS object literal */
const toLiteral = (v, indent = 2) => {
  const pad = ' '.repeat(indent);
  const padOut = ' '.repeat(indent - 2);
  if (v === null) return 'null';
  if (Array.isArray(v)) {
    if (v.length === 0) return '[]';
    return `[\n${v.map((x) => pad + toLiteral(x, indent + 2)).join(',\n')},\n${padOut}]`;
  }
  if (typeof v === 'object') {
    const entries = Object.entries(v).map(
      ([k, val]) => `${pad}${k}: ${toLiteral(val, indent + 2)}`
    );
    return `{\n${entries.join(',\n')},\n${padOut}}`;
  }
  if (typeof v === 'string') return `'${v}'`;
  return String(v);
};

const variantsSrc = read('src/variants.ts');
const typesPart = variantsSrc.slice(0, variantsSrc.indexOf('export const VARIANTS'));

for (const ver of VERSIONS) {
  const dir = path.join(STAGE, ver.zip);
  fs.rmSync(dir, {recursive: true, force: true});
  fs.mkdirSync(dir, {recursive: true});

  // Shared files, copied verbatim
  for (const rel of [
    'tsconfig.json',
    'remotion.config.ts',
    'src/index.ts',
    'src/color.ts',
    'src/motion.ts',
    'src/geometry.ts',
    'src/components/BackgroundWash.tsx',
    'src/components/FilamentBundle.tsx',
    'src/components/SynapseLayer.tsx',
    'src/components/NeuronNode.tsx',
    'src/components/ParticleField.tsx',
    'src/components/FinishLayer.tsx',
  ]) {
    writeTo(dir, rel, read(rel));
  }
  writeTo(dir, 'public/.gitkeep', '');

  // package.json with a per-variant name
  const pkg = JSON.parse(read('package.json'));
  pkg.name = ver.zip;
  pkg.description = `4K neuron network animation (Remotion) - ${ver.key} variant`;
  writeTo(dir, 'package.json', JSON.stringify(pkg, null, 2) + '\n');

  // variants.ts: same types, but only this variant's data, inlined
  const cfg = VARIANTS[ver.key];
  writeTo(
    dir,
    'src/variants.ts',
    `${typesPart}export const VARIANT_KEY: VariantKey = '${ver.key}';\n\n` +
      `export const VARIANT: VariantConfig = ${toLiteral(cfg)};\n`
  );

  // NeuronField without the variant prop
  writeTo(
    dir,
    'src/NeuronField.tsx',
    `import React, {useMemo} from 'react';
import {AbsoluteFill, useCurrentFrame, useVideoConfig} from 'remotion';
import {VARIANT, VARIANT_KEY} from './variants';
import {buildScene} from './geometry';
import {energyProfile} from './motion';
import {BackgroundWash} from './components/BackgroundWash';
import {FilamentBundle} from './components/FilamentBundle';
import {SynapseLayer} from './components/SynapseLayer';
import {NeuronNode} from './components/NeuronNode';
import {ParticleField} from './components/ParticleField';
import {FinishLayer} from './components/FinishLayer';

export const NeuronField: React.FC = () => {
  const frame = useCurrentFrame();
  const {width, height} = useVideoConfig();
  const cfg = VARIANT;

  // The entire seeded scene is generated once; every frame only applies
  // motion offsets to it.
  const scene = useMemo(() => buildScene(VARIANT_KEY, cfg, width, height), [cfg, width, height]);

  const energy =
    cfg.motionMode === 'retract' && cfg.retract ? energyProfile(frame, cfg.retract) : 0;

  return (
    <AbsoluteFill style={{backgroundColor: cfg.palette.bgDeep}}>
      <BackgroundWash cfg={cfg} width={width} height={height} />
      <FilamentBundle scene={scene} cfg={cfg} frame={frame} width={width} height={height} />
      <SynapseLayer scene={scene} cfg={cfg} frame={frame} width={width} height={height} />
      {scene.nodes.map((node, i) => (
        <NeuronNode key={i} node={node} cfg={cfg} frame={frame} energy={energy} />
      ))}
      <ParticleField scene={scene} cfg={cfg} frame={frame} width={width} height={height} />
      <FinishLayer frame={frame} width={width} height={height} />
    </AbsoluteFill>
  );
};
`
  );

  // Root.tsx registering only this composition
  writeTo(
    dir,
    'src/Root.tsx',
    `import React from 'react';
import {Composition} from 'remotion';
import {NeuronField} from './NeuronField';

export const RemotionRoot: React.FC = () => {
  return (
    <Composition
      id="${ver.compId}"
      component={NeuronField}
      durationInFrames={375}
      fps={30}
      width={3840}
      height={2160}
    />
  );
};
`
  );

  writeTo(
    dir,
    'README.md',
    `# ${ver.compId}

A 4K "neuron network" animation built with Remotion (${ver.key} variant).

- Composition id: \`${ver.compId}\`
- Resolution: 4K UHD - 3840x2160
- Duration: 375 frames @ 30 fps (12.5 s), seamless loop
- 2D canvas rendering, fully deterministic (seeded), no audio

## Setup

\`\`\`
npm install
\`\`\`

## Preview

\`\`\`
npm start
\`\`\`

## Render (4K)

\`\`\`
npx remotion render ${ver.compId} out/${ver.outName}.mp4 --codec=h264 --crf=12 --concurrency=8
\`\`\`
`
  );

  // Zip it (contents at zip root)
  const zipPath = path.join(ROOT, `${ver.zip}.zip`);
  fs.rmSync(zipPath, {force: true});
  execSync(`cd ${JSON.stringify(dir)} && zip -qr ${JSON.stringify(zipPath)} .`, {stdio: 'inherit'});
  console.log(`wrote ${zipPath}`);
}

fs.rmSync(path.join(ROOT, 'build', 'tmp-variants'), {recursive: true, force: true});
console.log('done');
