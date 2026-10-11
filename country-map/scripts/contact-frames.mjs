// Five evenly spaced frames per composition (0, 112, 224, 336, 448) rendered in
// one warm tab, then a one-row contact sheet per composition.
//   node scripts/contact-frames.mjs [--ids=Mexico,USA] [--frames=0,112,224,336,448] [--out=out/contact]
import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { bundle } from '@remotion/bundler';
import { renderFrames, selectComposition } from '@remotion/renderer';

const arg = (k, d) => process.argv.find((a) => a.startsWith(`--${k}=`))?.split('=')[1] ?? d;
const rows = JSON.parse(fs.readFileSync('src/countries.json', 'utf8'));
const ids = arg('ids', rows.map((r) => r.id).join(',')).split(',');
const frames = arg('frames', '0,112,224,336,448').split(',').map(Number);
const outDir = arg('out', 'out/contact');
const scale = Number(arg('scale', 1 / 3));
const pw = '/opt/pw-browsers/chromium_headless_shell-1194/chrome-linux/headless_shell';
const browserExecutable = fs.existsSync(pw) ? pw : null;

const serveUrl = await bundle({ entryPoint: path.resolve('src/index.ts') });
for (const id of ids) {
	const composition = await selectComposition({ serveUrl, id: `CountryMap-${id}`, browserExecutable, chromiumOptions: { gl: 'angle' } });
	const dir = path.join(outDir, id);
	fs.mkdirSync(dir, { recursive: true });
	const step = frames.length > 1 ? frames[1] - frames[0] : 1;
	await renderFrames({
		serveUrl,
		composition,
		inputProps: {},
		outputDir: dir,
		imageFormat: 'png',
		scale,
		concurrency: 1,
		frameRange: [frames[0], frames[frames.length - 1]],
		everyNthFrame: step,
		browserExecutable,
		chromiumOptions: { gl: 'angle' },
		timeoutInMilliseconds: 600000,
		onStart: () => undefined,
		onFrameUpdate: () => undefined,
	});
	const files = fs.readdirSync(dir).filter((f) => f.endsWith('.png') && f.startsWith('element')).sort().map((f) => path.join(dir, f));
	if (arg('sheet', 'yes') === 'yes') execFileSync('python3', ['scripts/contact-sheet.py', 'row', path.join(outDir, `contact_${id}.png`), ...files]);
	console.log(`${id}: ${files.length} frames -> ${path.join(outDir, `contact_${id}.png`)}`);
}
