/**
 * Renders the 1080p preview set and measures 4K render cost.
 *
 *   npm run render:previews
 *
 * Previews are the composition rendered at --scale=0.5, so they are exactly what
 * the 4K render will be, at half linear resolution. The 4K timing at the end is
 * measured on this machine by rendering a real 4K segment — not extrapolated
 * from the preview.
 */

import {mkdirSync, writeFileSync} from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {bundle} from '@remotion/bundler';
import {
  getCompositions,
  openBrowser,
  renderMedia,
  renderStill,
  selectComposition,
} from '@remotion/renderer';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
/** Set REMOTION_BROWSER_EXECUTABLE to reuse a Chromium already on the machine
 *  instead of letting Remotion download its own headless shell. */
const BROWSER = process.env.REMOTION_BROWSER_EXECUTABLE ?? null;
const OUT = path.join(ROOT, 'out', 'previews');
const STILL_FRAME = 340;

/** The three preview countries, by composition-id fragment. */
const PREVIEW_COUNTRIES = process.env.PREVIEW_COUNTRIES?.split(',') ?? [
  'Brazil',
  'SouthKorea',
  'Chile',
];
/** Frames used for the 4K timing measurement. */
const BENCH_RANGE: [number, number] = [140, 169];

/** V1-BrazilMapLight -> V1_BrazilMapLight, the delivered filename. */
const deliveryName = (id: string) => id.replace(/^(V[123])-/, '$1_');

const main = async () => {
  mkdirSync(OUT, {recursive: true});
  console.log('Bundling ...');
  const serveUrl = await bundle({
    entryPoint: path.join(ROOT, 'src', 'index.ts'),
    onProgress: () => undefined,
  });

  const all = await getCompositions(serveUrl, {browserExecutable: BROWSER});
  const wanted = all.filter((c) => PREVIEW_COUNTRIES.some((n) => c.id.includes(n)));
  if (!wanted.length) throw new Error('No matching compositions.');
  console.log(`${wanted.length} compositions:\n  ${wanted.map((c) => c.id).join('\n  ')}\n`);

  const browser = await openBrowser('chrome', {
    chromiumOptions: {gl: 'angle'},
    browserExecutable: BROWSER,
  });
  const timings: Record<string, {previewSeconds: number}> = {};

  for (const comp of wanted) {
    const t0 = Date.now();
    process.stdout.write(`${comp.id} ... `);
    await renderMedia({
      composition: comp,
      serveUrl,
      codec: 'h264',
      pixelFormat: 'yuv420p',
      colorSpace: 'bt709',
      crf: 16,
      scale: 0.5,
      outputLocation: path.join(OUT, `${deliveryName(comp.id)}.mp4`),
      puppeteerInstance: browser,
      overwrite: true,
      concurrency: 2,
      timeoutInMilliseconds: 180000,
      onProgress: () => undefined,
    });
    await renderStill({
      composition: comp,
      serveUrl,
      output: path.join(OUT, `${deliveryName(comp.id)}.png`),
      frame: STILL_FRAME,
      scale: 0.5,
      imageFormat: 'png',
      puppeteerInstance: browser,
      overwrite: true,
      timeoutInMilliseconds: 180000,
    });
    const secs = (Date.now() - t0) / 1000;
    timings[comp.id] = {previewSeconds: Number(secs.toFixed(1))};
    console.log(`${secs.toFixed(1)}s`);
  }

  // ── 4K cost, measured ────────────────────────────────────────────────────
  console.log('\nMeasuring 4K per-frame render time ...');
  const bench: Record<string, number> = {};
  for (const id of [wanted[0].id, wanted.find((c) => c.id.startsWith('V3'))?.id]) {
    if (!id) continue;
    const comp = await selectComposition({serveUrl, id, browserExecutable: BROWSER});
    const t0 = Date.now();
    await renderMedia({
      composition: comp,
      serveUrl,
      codec: 'h264',
      pixelFormat: 'yuv420p',
      colorSpace: 'bt709',
      crf: 16,
      scale: 1,
      frameRange: BENCH_RANGE,
      outputLocation: path.join(ROOT, 'out', `bench-${id}.mp4`),
      puppeteerInstance: browser,
      overwrite: true,
      concurrency: 2,
      timeoutInMilliseconds: 300000,
      onProgress: () => undefined,
    });
    const frames = BENCH_RANGE[1] - BENCH_RANGE[0] + 1;
    const perFrame = (Date.now() - t0) / 1000 / frames;
    bench[id] = Number(perFrame.toFixed(2));
    console.log(`  ${id}: ${perFrame.toFixed(2)} s/frame at 3840x2160`);
  }

  await browser.close({silent: true});
  writeFileSync(
    path.join(ROOT, 'out', 'render-report.json'),
    JSON.stringify(
      {
        renderedAt: new Date().toISOString(),
        cpus: (await import('node:os')).cpus().length,
        previews: timings,
        fourKSecondsPerFrame: bench,
        benchFrameRange: BENCH_RANGE,
      },
      null,
      2
    )
  );
  console.log('\nDone.');
};

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
