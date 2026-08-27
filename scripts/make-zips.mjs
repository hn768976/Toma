/**
 * Packages each variant as a self-contained, independently runnable Remotion
 * project. Every zip carries only its own variant: the shared three-key
 * VARIANTS object is replaced by a single inlined VARIANT config, and Root.tsx
 * registers that one composition.
 *
 *   node scripts/make-zips.mjs
 */
import {execFileSync} from 'node:child_process';
import {cpSync, mkdirSync, readFileSync, readdirSync, rmSync, writeFileSync} from 'node:fs';
import {dirname, join, resolve} from 'node:path';
import {fileURLToPath} from 'node:url';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const stage = join(root, '.zip-stage');

const VARIANTS = [
	{
		name: 'blue',
		composition: 'LightningBlue',
		title: 'Blue — distant strike, single descending bolt',
		summary:
			'A distant strike in clean air. One descending channel per event with a ' +
			'handful of forks low down, three strike events across the loop.',
	},
	{
		name: 'violet',
		composition: 'LightningViolet',
		title: 'Violet — hazy air, multiple simultaneous bolts',
		summary:
			'Haze and dust scattering the short wavelengths. Two or three channels ' +
			'strike at once, heavily branched, across five strike events.',
	},
	{
		name: 'white',
		composition: 'LightningWhite',
		title: 'White — very close strike, upward, single clean channel',
		summary:
			'A very close strike travelling upward out of frame. One sparse, intense ' +
			'channel, a whole-frame overexposure flash and a long afterglow.',
	},
];

/** Pulls one variant's object literal out of the shared VARIANTS map. */
const extractVariantLiteral = (source, name) => {
	const marker = `\n\t${name}: {`;
	const start = source.indexOf(marker);
	if (start === -1) {
		throw new Error(`No variant named ${name} in src/variants.ts`);
	}
	const open = source.indexOf('{', start);
	let depth = 0;
	for (let i = open; i < source.length; i++) {
		if (source[i] === '{') depth++;
		if (source[i] === '}') {
			depth--;
			if (depth === 0) {
				return source.slice(open, i + 1);
			}
		}
	}
	throw new Error(`Unbalanced braces around variant ${name}`);
};

/** Any doc comment sitting immediately above the variant key. */
const extractVariantComment = (source, name) => {
	const marker = `\n\t${name}: {`;
	const start = source.indexOf(marker);
	const before = source.slice(0, start);
	const commentStart = before.lastIndexOf('\t/**');
	const commentEnd = before.lastIndexOf('*/');
	if (commentStart === -1 || commentEnd < commentStart) {
		return '';
	}
	return before
		.slice(commentStart, commentEnd + 2)
		.split('\n')
		.map((line) => line.replace(/^\t/, ''))
		.join('\n');
};

const buildVariantModule = (source, name) => {
	// Everything above the VARIANTS map: the types and the shared TIMING block.
	const head = source.slice(0, source.indexOf('export const VARIANTS'));
	const withOneName = head
		.replace(
			"export type VariantName = 'blue' | 'violet' | 'white';",
			`export type VariantName = '${name}';`,
		)
		.replace(
			' * The ONE place where palettes, bolt parameters, strike schedules, flash\n' +
				' * profiles and ambient settings live. No colour literal and no timing number\n' +
				' * appears anywhere else in the project — every other module reads from here.',
			' * The ONE place where the palette, bolt parameters, strike schedule, flash\n' +
				' * profile and ambient settings live. No colour literal and no timing number\n' +
				' * appears anywhere else in the project — every other module reads from here.',
		);

	const comment = extractVariantComment(source, name);
	const literal = extractVariantLiteral(source, name)
		.split('\n')
		.map((line, index) => (index === 0 ? line : line.replace(/^\t\t/, '\t')))
		.join('\n');

	return `${withOneName}export const VARIANT_NAME: VariantName = '${name}';

${comment}
export const VARIANT: VariantConfig = ${literal};
`;
};

const buildRoot = (variant) => `import React from 'react';
import {Composition} from 'remotion';
import {Lightning} from './Lightning';
import {VARIANT, VARIANT_NAME} from './variant';

export const RemotionRoot: React.FC = () => {
	const {durationInFrames, fps, width, height} = VARIANT.timing;

	return (
		<Composition
			id="${variant.composition}"
			component={Lightning}
			durationInFrames={durationInFrames}
			fps={fps}
			width={width}
			height={height}
			defaultProps={{variant: VARIANT_NAME}}
		/>
	);
};
`;

const buildPackageJson = (variant, base) =>
	`${JSON.stringify(
		{
			name: `lightning-${variant.name}`,
			version: base.version,
			private: true,
			description: `4K lightning strike animation in Remotion — ${variant.title}`,
			scripts: {
				start: 'remotion studio',
				render: `remotion render ${variant.composition} out/lightning-${variant.name}.mp4 --codec=h264 --crf=12 --concurrency=8`,
				preview: `remotion render ${variant.composition} out/lightning-${variant.name}-preview.mp4 --codec=h264 --crf=18 --scale=0.5`,
				upgrade: 'remotion upgrade',
			},
			dependencies: base.dependencies,
			devDependencies: base.devDependencies,
		},
		null,
		2,
	)}\n`;

const buildReadme = (variant, cfg) => {
	const {durationInFrames, fps, width, height} = cfg.timing;
	const seconds = (durationInFrames / fps).toFixed(1);
	return `# Lightning — ${variant.title}

${variant.summary}

## Composition

| | |
| --- | --- |
| Composition id | \`${variant.composition}\` |
| Resolution | **${width} × ${height} (4K UHD)** |
| Duration | ${durationInFrames} frames @ ${fps} fps = ${seconds}s |
| Loop | Seamless — frame 0 and frame ${durationInFrames} are pixel-identical |

## Render at 4K

\`\`\`bash
npm install
npx remotion render ${variant.composition} out/lightning-${variant.name}.mp4 --codec=h264 --crf=12 --concurrency=8
\`\`\`

For a quick 1080p check, halve the scale:

\`\`\`bash
npx remotion render ${variant.composition} out/lightning-${variant.name}-preview.mp4 --codec=h264 --crf=18 --scale=0.5
\`\`\`

Open the studio with \`npm start\`.

## How it works

\`src/variant.ts\` is the single source of every colour and every timing number
for this variant — palette, bolt generation parameters, strike schedule, flash
profile, ambient settings and the finishing pass. Nothing else in the project
contains a hex literal or a frame count.

The scene draws to one \`<canvas>\` whose backing store is the full ${width} × ${height},
in passes that composite in tree order:

| Pass | What it draws |
| --- | --- |
| \`<BackdropPass>\` | near-black background with its faint vertical gradient |
| \`<AmbientGlow>\` | drifting haze, plus the broad wash around a lit channel |
| \`<BoltRenderer>\` → \`<BoltPath>\` | the bolts lit on this frame, four passes each |
| \`<FrameFlash>\` | whole-frame overexposure wash${cfg.frameFlash ? '' : ' (unused in this variant)'} |
| \`<GrainPass>\` | vignette, then fine seeded grain |

Each bolt is generated by recursive midpoint displacement: a segment's midpoint
is pushed perpendicular to it by a seeded amount, the halves recurse with the
amplitude halved, and branches spawn from midpoints and recurse the same way one
level shallower, dimmer and thinner at every generation. It is then stroked in
four passes composited additively — a very wide low-alpha atmospheric glow, an
outer glow, the mid channel, and a thin near-white core.

\`strikeDirection\` in \`src/variant.ts\` is signed: every generated point is mapped
through it, so ${
		cfg.bolt.strikeDirection > 0
			? 'flipping it to -1 would send the bolt upward'
			: 'this variant travels upward on -1'
	} — path shape, branch angles and stroke taper all
follow the sign.

Every frame is a pure function of \`useCurrentFrame()\`, and all randomness comes
from Remotion's \`random()\` with stable string seeds, so renders are
deterministic and reproducible.
`;
};

const bundleSource = readFileSync(join(root, 'src', 'variants.ts'), 'utf8');
const basePackage = JSON.parse(readFileSync(join(root, 'package.json'), 'utf8'));

// Read the configs back so the README can quote real numbers.
const configs = JSON.parse(
	execFileSync(process.execPath, [join(root, 'scripts', 'dump-variants.mjs')], {
		encoding: 'utf8',
	}),
);

rmSync(stage, {recursive: true, force: true});

for (const variant of VARIANTS) {
	const dir = join(stage, `lightning-${variant.name}`);
	mkdirSync(join(dir, 'src'), {recursive: true});
	mkdirSync(join(dir, 'public'), {recursive: true});

	// src/, minus the shared variants module.
	cpSync(join(root, 'src'), join(dir, 'src'), {recursive: true});
	rmSync(join(dir, 'src', 'variants.ts'));
	writeFileSync(join(dir, 'src', 'variant.ts'), buildVariantModule(bundleSource, variant.name));
	writeFileSync(join(dir, 'src', 'Root.tsx'), buildRoot(variant));

	// Repoint every import at the single-variant module.
	const rewrite = (dirPath) => {
		for (const entry of readdirSync(dirPath, {withFileTypes: true})) {
			const path = join(dirPath, entry.name);
			if (entry.isDirectory()) {
				rewrite(path);
				continue;
			}
			if (!/\.tsx?$/.test(entry.name)) {
				continue;
			}
			let text = readFileSync(path, 'utf8');
			text = text
				.replace(/from '(\.{1,2}(?:\/\.\.)*)\/variants'/g, "from '$1/variant'")
				.replace(/\{VARIANTS, type VariantName\}/g, '{VARIANT, type VariantName}')
				.replace(/const cfg = VARIANTS\[variant\];/g, 'const cfg = VARIANT;');
			writeFileSync(path, text);
		}
	};
	rewrite(join(dir, 'src'));

	writeFileSync(join(dir, 'public', '.gitkeep'), '');
	writeFileSync(join(dir, 'package.json'), buildPackageJson(variant, basePackage));
	cpSync(join(root, 'tsconfig.json'), join(dir, 'tsconfig.json'));
	cpSync(join(root, 'remotion.config.ts'), join(dir, 'remotion.config.ts'));
	writeFileSync(join(dir, 'README.md'), buildReadme(variant, configs[variant.name]));

	const zip = join(root, 'dist', `lightning-${variant.name}.zip`);
	mkdirSync(join(root, 'dist'), {recursive: true});
	rmSync(zip, {force: true});
	execFileSync(
		'zip',
		['-r', '-q', zip, `lightning-${variant.name}`, '-x', '*/node_modules/*', '*/out/*', '*/.git/*'],
		{cwd: stage},
	);
	console.log(`packaged ${zip}`);
}

rmSync(stage, {recursive: true, force: true});
