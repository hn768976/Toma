#!/usr/bin/env node
/**
 * Render driver.
 *
 * Uses Remotion's programmatic API rather than the CLI so the Chromium
 * options that WebGPU depends on are passed explicitly and verifiably:
 *
 *   gl: 'angle-egl'              an OpenGL backend that still yields a real
 *                                WebGPU adapter on GPU-less machines
 *   enableMultiProcessOnLinux    without it Remotion adds --single-process,
 *                                which removes Chrome's GPU process and with
 *                                it WebGPU
 *
 * Usage:
 *   node scripts/render.mjs 1080            all three versions at 1920x1080
 *   node scripts/render.mjs 4k              all three versions at 3840x2160
 *   node scripts/render.mjs 1080 v1 v3      only those versions
 *   node scripts/render.mjs still v3 110    one PNG, for look development
 */
import { bundle } from '@remotion/bundler';
import { getCompositions, renderMedia, renderStill } from '@remotion/renderer';
import path from 'node:path';
import fs from 'node:fs';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const entry = path.join(root, 'src', 'index.ts');
const outDir = path.join(root, 'out');

const chromiumOptions = {
  /**
   * 'swangle' expands to --use-gl=angle --use-angle=swiftshader, which is
   * the combination that actually brings up a GPU process here. 'angle-egl'
   * looks like the obvious choice for WebGPU but needs a system libEGL.so.1;
   * without one ANGLE fails to initialise and the GPU process exits, taking
   * WebGPU with it. Override with REMOTION_GL on a machine with a real GPU.
   */
  gl: process.env.REMOTION_GL ?? 'swangle',
  // Otherwise Remotion adds --single-process, which has no GPU process.
  enableMultiProcessOnLinux: true,
  headless: true,
};

/**
 * Must be a full Chrome, not chrome-headless-shell: Remotion launches the
 * shell with --headless=old, and old headless has no GPU process, so
 * navigator.gpu.requestAdapter() resolves to null there. 'chrome-for-testing'
 * switches Remotion to --headless=new, which keeps the GPU process alive.
 */
const chromeMode = 'chrome-for-testing';
const browserExecutable = process.env.REMOTION_BROWSER_EXECUTABLE ?? null;
const concurrency = Number(process.env.REMOTION_CONCURRENCY ?? 2);
const timeoutInMilliseconds = 600000;

const [mode = '1080', ...rest] = process.argv.slice(2);

const log = (...a) => console.log('[render]', ...a);

const makeBundle = async () => {
  log('bundling...');
  const url = await bundle({
    entryPoint: entry,
    onProgress: (p) => {
      if (p % 25 === 0) log(`bundle ${p}%`);
    },
  });
  log('bundle ready');
  return url;
};

const run = async () => {
  fs.mkdirSync(outDir, { recursive: true });
  const serveUrl = await makeBundle();
  const comps = await getCompositions(serveUrl, { browserExecutable, chromiumOptions, chromeMode });

  if (mode === 'still') {
    const version = (rest[0] ?? 'v3').toUpperCase();
    const frame = Number(rest[1] ?? 0);
    // Extra args become diagnostic props, e.g. `nopost` or `tex=1024`.
    const flags = rest.slice(2);
    const inputProps = { themeId: version.toLowerCase() };
    if (flags.includes('nopost')) inputProps.disablePost = true;
    if (flags.includes('webgl')) inputProps.forceWebGL = true;
    const tex = flags.find((f) => f.startsWith('tex='));
    if (tex) inputProps.textureSize = Number(tex.slice(4));
    const id = `${version}-1080p`;
    const composition = comps.find((c) => c.id === id);
    if (!composition) throw new Error(`No composition ${id}. Have: ${comps.map((c) => c.id).join(', ')}`);
    const output = path.join(outDir, `still-${version.toLowerCase()}-f${frame}.png`);
    log(`still ${id} frame ${frame} -> ${output}`);
    const started = Date.now();
    await renderStill({
      // getCompositions() already resolved defaultProps onto the composition,
      // so diagnostics have to be merged in here rather than via inputProps.
      composition: { ...composition, props: { ...composition.props, ...inputProps } },
      serveUrl,
      output,
      frame,
      browserExecutable,
      chromiumOptions,
      chromeMode,
      timeoutInMilliseconds,
      imageFormat: 'png',
      overwrite: true,
    });
    log(`done in ${((Date.now() - started) / 1000).toFixed(1)}s`);
    return;
  }

  const suffix = mode === '4k' ? '4K' : '1080p';
  const wanted = rest.length ? rest.map((v) => v.toUpperCase()) : ['V1', 'V2', 'V3'];

  for (const version of wanted) {
    const id = `${version}-${suffix}`;
    const composition = comps.find((c) => c.id === id);
    if (!composition) throw new Error(`No composition ${id}. Have: ${comps.map((c) => c.id).join(', ')}`);

    const output = path.join(outDir, `chip-activation-${version.toLowerCase()}-${suffix}.mp4`);
    log(`rendering ${id} (${composition.width}x${composition.height}, ${composition.durationInFrames} frames)`);

    const started = Date.now();
    let lastPct = -1;
    await renderMedia({
      composition,
      serveUrl,
      codec: 'h264',
      outputLocation: output,
      browserExecutable,
      chromiumOptions,
      chromeMode,
      concurrency,
      timeoutInMilliseconds,
      imageFormat: 'jpeg',
      jpegQuality: 100,
      crf: mode === '4k' ? 18 : 16,
      pixelFormat: 'yuv420p',
      colorSpace: 'bt709',
      x264Preset: 'slow',
      overwrite: true,
      onProgress: ({ renderedFrames, encodedFrames }) => {
        const pct = Math.floor((renderedFrames / composition.durationInFrames) * 100);
        if (pct !== lastPct && pct % 5 === 0) {
          lastPct = pct;
          const elapsed = (Date.now() - started) / 1000;
          const rate = renderedFrames / Math.max(elapsed, 0.001);
          const eta = (composition.durationInFrames - renderedFrames) / Math.max(rate, 0.001);
          log(
            `${id} ${pct}% (${renderedFrames}/${composition.durationInFrames} rendered, ` +
              `${encodedFrames} encoded, ${rate.toFixed(2)} fps, eta ${(eta / 60).toFixed(1)}min)`,
          );
        }
      },
    });
    const secs = (Date.now() - started) / 1000;
    log(`${id} done in ${(secs / 60).toFixed(1)}min -> ${output}`);
  }
};

run().catch((err) => {
  console.error(err);
  process.exit(1);
});
