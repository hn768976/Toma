#!/usr/bin/env node
/**
 * build-variant-zip.mjs — package ONE version as a self-contained,
 * runnable Remotion project.
 *
 *   node scripts/build-variant-zip.mjs mint
 *
 * Produces `wire-city-<variant>.zip` in the repo root containing src/,
 * package.json, tsconfig.json, remotion.config.ts, public/, CAMERA-NOTES.md
 * and a generated README.md. node_modules/, out/, .git/ and this script are
 * excluded.
 *
 * The packaged project differs from this repo in exactly two files:
 *   - src/wire-city/variants.ts  — VARIANTS trimmed to the single variant
 *   - src/Root.tsx               — only that variant's <Composition>
 *
 * Everything else, camera-paths.ts included, ships verbatim. That is
 * deliberate: generateCity() clears a corridor using the sampled ground
 * tracks of ALL THREE camera paths, so removing the unused path functions
 * would change how many buildings are culled and the packaged project would
 * render a subtly different city from the delivered preview.
 */

import {execFileSync} from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

const VARIANT_META = {
	mint: {
		compositionId: 'WireCityMint',
		title: 'Wire City — "mint"',
		tagline:
			'Glowing aqua-cyan wireframes on deep navy, with lit window detail on ' +
			'every building. The camera orbits the city at tower height, covering ' +
			'about a third of a full orbit while drifting slowly inward, with a ' +
			'slight handheld wobble on top.',
		palette: [
			['background', '#030B14', 'near-black navy'],
			['ground dot', '#10405E', ''],
			['ground bright', '#2A87B0', 'nearer dots'],
			['building line', '#4FE3FF', 'the wireframe edges'],
			['building glow', '#BFF6FF', 'the brightest towers'],
			['window lit', '#CFEEFF', 'always-lit window detail'],
			['haze', '#0A3350', 'the horizon glow'],
		],
		cameraPath: 'orbit',
		buildingMode: 'wireframe',
		bloom: 'Bloom, intensity 1.55, luminanceThreshold 0.24',
		windows: 'always lit from frame 0 — surface detail, not an event',
	},
	emerald: {
		compositionId: 'WireCityEmerald',
		title: 'Wire City — "emerald"',
		tagline:
			'Electric-blue wireframes on midnight indigo, with bright cyan-white ' +
			'windows switching on progressively across the shot while the camera ' +
			'descends from high above the city to street level.',
		palette: [
			['background', '#010714', 'near-black indigo'],
			['ground dot', '#113055', ''],
			['ground bright', '#2A6FA8', ''],
			['building line', '#2FA8FF', 'the wireframe edges'],
			['building glow', '#8FD4FF', 'the brightest towers'],
			['window lit', '#DCF6FF', 'the lit window points'],
			['haze', '#06284A', ''],
		],
		cameraPath: 'descend',
		buildingMode: 'windows',
		bloom: 'Bloom, intensity 1.05, luminanceThreshold 0.28',
		windows: 'switch on progressively across frames 60-380',
	},
	blueprint: {
		compositionId: 'WireCityBlueprint',
		title: 'Wire City — "blueprint"',
		tagline:
			'Dark architectural linework on a pale ground, with dimension ' +
			'annotations, circling at street level.',
		palette: [
			['background', '#EDF4F0', 'pale grey-green'],
			['ground dot', '#B8CFC4', ''],
			['ground bright', '#8FB0A4', ''],
			['building line', '#1F4A3A', 'dark green lines'],
			['annotation', '#2E7A5F', 'dimension lines and ticks'],
			['haze', '#D4E4DC', 'the horizon falls toward pale, not dark'],
		],
		cameraPath: 'levelOrbit',
		buildingMode: 'blueprint',
		bloom: 'none — the Bloom pass is not mounted for this variant',
		windows: 'none',
	},
};

const variant = process.argv[2];
if (!VARIANT_META[variant]) {
	console.error(
		`usage: node scripts/build-variant-zip.mjs <${Object.keys(VARIANT_META).join('|')}>`,
	);
	process.exit(1);
}
const meta = VARIANT_META[variant];

/* ── staging directory ──────────────────────────────────────────────── */

const stageRoot = fs.mkdtempSync(path.join(ROOT, '.zip-stage-'));
const projectName = `wire-city-${variant}`;
const stage = path.join(stageRoot, projectName);

const EXCLUDE = new Set([
	'node_modules',
	'out',
	'.git',
	'.gitignore',
	'scripts',
	'package-lock.json',
	'README.md',
]);

const copyInto = (src, dest) => {
	fs.mkdirSync(dest, {recursive: true});
	for (const entry of fs.readdirSync(src, {withFileTypes: true})) {
		if (
			EXCLUDE.has(entry.name) ||
			entry.name.startsWith('.zip-stage-') ||
			entry.name.endsWith('.zip')
		) {
			continue;
		}
		const from = path.join(src, entry.name);
		const to = path.join(dest, entry.name);
		if (entry.isDirectory()) copyInto(from, to);
		else fs.copyFileSync(from, to);
	}
};

copyInto(ROOT, stage);
fs.mkdirSync(path.join(stage, 'public'), {recursive: true});
fs.writeFileSync(
	path.join(stage, 'public', '.gitkeep'),
	'# Remotion serves this directory at /. Nothing in this project loads an\n' +
		'# asset from it, but Remotion expects it to exist.\n',
);
fs.writeFileSync(
	path.join(stage, '.gitignore'),
	'node_modules/\nout/\n.env\n*.log\n',
);

/* ── trim variants.ts to the single variant ─────────────────────────── */

const variantsPath = path.join(stage, 'src', 'wire-city', 'variants.ts');
let variants = fs.readFileSync(variantsPath, 'utf8');

const others = Object.keys(VARIANT_META).filter((v) => v !== variant);
for (const other of others) {
	// Each entry is delimited by its banner comment and runs to the line
	// `\t},` at the same indent. Anchoring on the banner keeps this robust.
	const re = new RegExp(
		`\\n\\t/\\* [^\\n]*─ (?:v\\d — )?${other} [^\\n]*\\*/\\n\\t${other}: \\{[\\s\\S]*?\\n\\t\\},`,
		'',
	);
	if (!re.test(variants)) {
		throw new Error(`could not locate the "${other}" entry in variants.ts`);
	}
	variants = variants.replace(re, '');
}
variants = variants.replace(
	/export type VariantName = [^;]+;/,
	`export type VariantName = '${variant}';`,
);
variants = variants.replace(
	'export const VARIANTS: Record<VariantName, VariantConfig> = {',
	`/*\n * This project is the single-version "${variant}" package. The full build\n * keys this object by 'mint' | 'emerald' | 'blueprint'; adding a version back\n * means adding an entry here plus a <Composition> in Root.tsx, and nothing\n * else — no scene, camera or post-processing code changes.\n */\nexport const VARIANTS: Record<VariantName, VariantConfig> = {`,
);
// Tidy the blank lines the removals left behind.
variants = variants.replace(/\n{3,}(\t?\};)/g, '\n$1');
fs.writeFileSync(variantsPath, variants);

/* ── trim Root.tsx to the single composition ────────────────────────── */

const rootPath = path.join(stage, 'src', 'Root.tsx');
let root = fs.readFileSync(rootPath, 'utf8');
const compRe = /\t\t\t<Composition\n[\s\S]*?\n\t\t\t\/>/g;
const comps = root.match(compRe) ?? [];
const keep = comps.filter((c) => c.includes(`id="${meta.compositionId}"`));
if (keep.length !== 1) {
	throw new Error(
		`expected exactly one <Composition> with id="${meta.compositionId}", found ${keep.length}`,
	);
}
root = root.replace(/\t\t<>\n[\s\S]*?\n\t\t<\/>/, `\t\t<>\n${keep[0]}\n\t\t</>`);
fs.writeFileSync(rootPath, root);

/* ── package.json identity ──────────────────────────────────────────── */

const pkgPath = path.join(stage, 'package.json');
const pkg = JSON.parse(fs.readFileSync(pkgPath, 'utf8'));
pkg.name = projectName;
pkg.description = `4K (3840x2160) wireframe city animation in Remotion + @remotion/three - "${variant}" version`;
pkg.scripts = {
	dev: 'remotion studio',
	render: `remotion render ${meta.compositionId} out/${projectName}.mp4 --codec=h264 --crf=18`,
	preview: `remotion render ${meta.compositionId} out/${projectName}-preview.mp4 --codec=h264 --crf=18 --scale=0.5`,
	typecheck: 'tsc --noEmit',
};
fs.writeFileSync(pkgPath, JSON.stringify(pkg, null, 2) + '\n');

/* ── README ─────────────────────────────────────────────────────────── */

const paletteTable = meta.palette
	.map(([name, hex, note]) => `| ${name} | \`${hex}\` | ${note} |`)
	.join('\n');

fs.writeFileSync(
	path.join(stage, 'README.md'),
	`# ${meta.title}

${meta.tagline}

## The composition

| | |
|---|---|
| **Composition id** | \`${meta.compositionId}\` |
| **Resolution** | **4K — 3840 × 2160** |
| **Duration** | 450 frames |
| **Frame rate** | 30 fps |
| **Length** | 15.0 s |
| **Camera path mode** | \`${meta.cameraPath}\` |
| **Building render mode** | \`${meta.buildingMode}\` |
| **Post-processing** | ${meta.bloom} |
| **Lit windows** | ${meta.windows} |

One-shot: the camera travels and does not reset, so the first and last frames
differ by design. There is no audio, no text and no logo.

## Install

\`\`\`bash
npm install
\`\`\`

### The extra 3D dependencies

Beyond \`remotion\` / \`@remotion/cli\` / \`react\`, this project needs:

\`\`\`bash
npm i @remotion/three three @react-three/fiber
npm i @react-three/postprocessing postprocessing
\`\`\`

| Package | Why |
|---|---|
| \`@remotion/three\` | \`<ThreeCanvas>\` — disables react-three-fiber's internal render loop so frames advance on Remotion's clock instead of wall-clock time |
| \`three\` | the renderer, plus \`examples/jsm/lines/*\` for \`Line2\` / \`LineSegments2\` / \`LineMaterial\` |
| \`@react-three/fiber\` | React reconciler for three.js |
| \`@react-three/postprocessing\`, \`postprocessing\` | \`<EffectComposer>\`, \`<Bloom>\`, and the base \`Effect\` class the custom vignette extends |

## Render at 4K

\`\`\`bash
npx remotion render ${meta.compositionId} out/${projectName}.mp4 \\
  --codec=h264 --crf=18 --concurrency=8
\`\`\`

No \`--scale\` flag: the composition is natively 3840 × 2160.

For a fast 1080p check, halve it:

\`\`\`bash
npx remotion render ${meta.compositionId} out/${projectName}-preview.mp4 \\
  --codec=h264 --crf=18 --scale=0.5 --concurrency=8
\`\`\`

> \`--concurrency\` cannot exceed your core count — Remotion errors rather than
> clamping. Lower it if you see *"Maximum for --concurrency is N"*.

Open the studio with \`npx remotion studio\`.

## Palette

Every colour in the project comes from the single exported \`VARIANTS\` object
in \`src/wire-city/variants.ts\`. No colour hex literal exists anywhere else in
\`src/\`.

| role | hex | |
|---|---|---|
${paletteTable}

## Layout

\`\`\`
src/
  index.ts                     registerRoot
  Root.tsx                     the <Composition>
  wire-city/
    variants.ts                THE config — palette, camera mode, render mode, post
    camera-paths.ts            every camera move, as pure functions of the frame
    city-layout.ts             seeded generation of the city + its edge buffers
    WireCity.tsx               the composition: <ThreeCanvas> + scene + grain
    CameraRig.tsx              creates, installs and drives the camera
    Buildings.tsx              merged wireframe (1 draw call) + occlusion fills
    Ground.tsx                 the two dot lattices
    Haze.tsx                   horizon glow
    Post.tsx                   EffectComposer: bloom + vignette
    vignette-effect.ts         custom postprocessing Effect
    CanvasWarmup.tsx           holds delayRender() until the composer can draw
    Grain.tsx                  the only 2D layer
    three-helpers.ts           colour + drawing-buffer helpers
\`\`\`

\`camera-paths.ts\` ships with all three named path modes even though this
package uses only \`${meta.cameraPath}\`. That is deliberate:
\`generateCity()\` clears a corridor along the sampled ground tracks of every
path so the camera is never inside a building, which means dropping the unused
paths would change how many buildings get culled and this project would render
a subtly different city.

## Determinism

Every animated value derives from \`useCurrentFrame()\`. There is no
\`useFrame(delta)\` and no \`THREE.Clock\` anywhere — both are wall-clock based
and would produce different output on every render. All randomness is seeded
through Remotion's \`random()\`.

To check:

\`\`\`bash
npx remotion still ${meta.compositionId} out/a.png --frame=200 --scale=0.25
npx remotion still ${meta.compositionId} out/b.png --frame=200 --scale=0.25
sha256sum out/a.png out/b.png   # identical
\`\`\`

## Notes

\`CAMERA-NOTES.md\` in this directory records the camera positions, the lens,
each path function, the bloom settings, the material choices, and the
Remotion-specific gotchas hit while building this — several of which present
as a completely black frame.

## No GPU?

\`\`\`ts
// remotion.config.ts
Config.setChromiumOpenGlRenderer('swangle');   // ANGLE over SwiftShader
\`\`\`

Chromium ≥ 141 additionally refuses the software WebGL fallback unless it is
launched with \`--enable-unsafe-swiftshader\`. Remotion does not add that flag
for \`swangle\`, so wrap the browser binary in a shell script that appends it
and pass \`--browser-executable=/path/to/wrapper\`. On a machine with a real
GPU, use \`Config.setChromiumOpenGlRenderer('angle')\` instead — it is roughly
an order of magnitude faster for this scene.
`,
);

/* ── zip ────────────────────────────────────────────────────────────── */

const zipPath = path.join(ROOT, `${projectName}.zip`);
fs.rmSync(zipPath, {force: true});
execFileSync('zip', ['-qr', zipPath, projectName], {cwd: stageRoot});
fs.rmSync(stageRoot, {recursive: true, force: true});

const {size} = fs.statSync(zipPath);
console.log(`${path.basename(zipPath)}  (${(size / 1024).toFixed(0)} KB)`);
