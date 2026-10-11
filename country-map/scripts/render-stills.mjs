// Renders one still per composition with the Node API (one bundle, many stills)
// and records timings, including the one-time map-drawing time logged by the page.
//   node scripts/render-stills.mjs [--frame=300] [--scale=0.3333333333333333] [--out=out/stills] [--ids=Mexico,USA]
import fs from 'node:fs';
import path from 'node:path';
import { bundle } from '@remotion/bundler';
import { renderStill, selectComposition } from '@remotion/renderer';

const arg = (k, d) => process.argv.find((a) => a.startsWith(`--${k}=`))?.split('=')[1] ?? d;
const frame = Number(arg('frame', 300));
const scale = Number(arg('scale', 1 / 3));
const outDir = arg('out', 'out/stills');
const suffix = arg('suffix', '');
const rows = JSON.parse(fs.readFileSync('src/countries.json', 'utf8'));
const ids = arg('ids', rows.map((r) => r.id).join(',')).split(',');
const pw = '/opt/pw-browsers/chromium_headless_shell-1194/chrome-linux/headless_shell';
const browserExecutable = fs.existsSync(pw) ? pw : null;

fs.mkdirSync(outDir, { recursive: true });
const serveUrl = await bundle({ entryPoint: path.resolve('src/index.ts') });
const timings = {};
for (const id of ids) {
	const compId = `CountryMap-${id}`;
	const inputProps = {};
	const composition = await selectComposition({ serveUrl, id: compId, inputProps, browserExecutable, chromiumOptions: { gl: 'angle' } });
	let mapLog = '';
	const t0 = Date.now();
	await renderStill({
		serveUrl,
		composition,
		frame,
		scale,
		output: path.join(outDir, `CountryMap_${id}${suffix}.png`),
		browserExecutable,
		chromiumOptions: { gl: 'angle' },
		timeoutInMilliseconds: 600000,
		overwrite: true,
		onBrowserLog: (l) => {
			if (l.text.includes('[map]')) mapLog = l.text;
		},
	});
	const ms = Date.now() - t0;
	const m = mapLog.match(/draw (\d+) ms/);
	timings[id] = { totalMs: ms, mapDrawMs: m ? Number(m[1]) : null, log: mapLog };
	console.log(`${id}: ${ms} ms total | ${mapLog}`);
}
fs.writeFileSync(path.join(outDir, `timings${suffix}.json`), JSON.stringify(timings, null, 2));
