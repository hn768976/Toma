// Per-frame render time (warm tab, map already drawn) for each composition.
//   node scripts/measure-frames.mjs [--scale=0.3333333333333333] [--ids=Mexico] [--n=12] [--start=300]
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { bundle } from '@remotion/bundler';
import { renderFrames, selectComposition } from '@remotion/renderer';

const arg = (k, d) => process.argv.find((a) => a.startsWith(`--${k}=`))?.split('=')[1] ?? d;
const scale = Number(arg('scale', 1 / 3));
const n = Number(arg('n', 12));
const start = Number(arg('start', 300));
const rows = JSON.parse(fs.readFileSync('src/countries.json', 'utf8'));
const ids = arg('ids', rows.map((r) => r.id).join(',')).split(',');
const pw = '/opt/pw-browsers/chromium_headless_shell-1194/chrome-linux/headless_shell';
const browserExecutable = fs.existsSync(pw) ? pw : null;
const out = arg('out', 'out/frame-timings.json');

const serveUrl = await bundle({ entryPoint: path.resolve('src/index.ts') });
const result = fs.existsSync(out) ? JSON.parse(fs.readFileSync(out, 'utf8')) : {};
for (const id of ids) {
	const composition = await selectComposition({ serveUrl, id: `CountryMap-${id}`, browserExecutable, chromiumOptions: { gl: 'angle' } });
	const stamps = [];
	const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'frames-'));
	const t0 = Date.now();
	await renderFrames({
		serveUrl,
		composition,
		inputProps: {},
		outputDir: dir,
		imageFormat: 'png',
		scale,
		concurrency: 1,
		frameRange: [start, start + n - 1],
		browserExecutable,
		chromiumOptions: { gl: 'angle' },
		timeoutInMilliseconds: 600000,
		onStart: () => undefined,
		onFrameUpdate: () => stamps.push(Date.now()),
	});
	fs.rmSync(dir, { recursive: true, force: true });
	const deltas = stamps.slice(1).map((t, i) => t - stamps[i]);
	const perFrame = deltas.reduce((a, b) => a + b, 0) / deltas.length;
	result[`${id}@${scale.toFixed(4)}`] = { perFrameMs: Math.round(perFrame), firstFrameMs: stamps[0] - t0, frames: n };
	console.log(`${id} scale ${scale.toFixed(3)}: ${perFrame.toFixed(0)} ms/frame (first frame incl. map draw ${stamps[0] - t0} ms)`);
	fs.writeFileSync(out, JSON.stringify(result, null, 2));
}
