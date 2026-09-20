#!/usr/bin/env node
/**
 * Look-development harness.
 *
 * Bundles the scene, opens it in Chrome with the same WebGPU flags the real
 * render uses, draws one or more frames, and writes PNGs. Far faster to
 * iterate against than a full Remotion render, and it isolates three.js
 * problems from Remotion ones.
 *
 *   node scripts/preview.mjs v3 3.7
 *   node scripts/preview.mjs v1 0.5,1.3,2.0,5.0 --width=960
 *   node scripts/preview.mjs v2 2.9 --nopost --webgl
 */
import { build } from 'esbuild';
import { chromium } from 'playwright-core';
import path from 'node:path';
import fs from 'node:fs';
import http from 'node:http';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const outDir = path.join(root, 'out', 'preview');
const tmp = path.join(root, 'out', '.preview-build');

const argv = process.argv.slice(2);
const flags = new Set(argv.filter((a) => a.startsWith('--')));
const positional = argv.filter((a) => !a.startsWith('--'));
const getFlag = (name, fallback) => {
  const hit = argv.find((a) => a.startsWith(`--${name}=`));
  return hit ? hit.slice(name.length + 3) : fallback;
};

const version = (positional[0] ?? 'v3').toLowerCase();
const times = (positional[1] ?? '3.0').split(',').map(Number);
const width = Number(getFlag('width', 960));
const height = Math.round((width * 9) / 16);
const textureSize = Number(getFlag('tex', width >= 1920 ? 2048 : 1024));
const post = !flags.has('--nopost');
const forceWebGL = flags.has('--webgl');
const postStopAfter = getFlag('post', undefined) === undefined ? undefined : Number(getFlag('post'));

const CHROME = process.env.CHROME_BIN ?? '/home/user/.local/chrome/chrome-linux64/chrome';

// The flag set proven to yield a real WebGPU adapter on a GPU-less Linux box.
const CHROME_ARGS = [
  '--no-sandbox',
  '--disable-dev-shm-usage',
  '--enable-unsafe-webgpu',
  '--enable-unsafe-swiftshader',
  '--ignore-gpu-blocklist',
  '--use-gl=angle',
  '--use-angle=swiftshader',
  '--force-gpu-mem-available-mb=4096',
];

const log = (...a) => console.log('[preview]', ...a);

const run = async () => {
  fs.mkdirSync(outDir, { recursive: true });
  fs.mkdirSync(tmp, { recursive: true });

  log('bundling scene...');
  await build({
    entryPoints: [path.join(root, 'scripts', 'preview', 'entry.ts')],
    bundle: true,
    format: 'iife',
    target: 'chrome120',
    outfile: path.join(tmp, 'preview.js'),
    logLevel: 'error',
  });
  fs.writeFileSync(
    path.join(tmp, 'index.html'),
    '<!doctype html><meta charset="utf-8"><style>html,body{margin:0;background:#111}canvas{display:block}</style><script src="preview.js"></script>',
  );

  const server = http.createServer((req, res) => {
    const file = req.url === '/' ? 'index.html' : req.url.slice(1).split('?')[0];
    const full = path.join(tmp, file);
    if (!full.startsWith(tmp) || !fs.existsSync(full)) {
      res.writeHead(404).end();
      return;
    }
    res.writeHead(200, {
      'content-type': file.endsWith('.js') ? 'text/javascript' : 'text/html',
    });
    res.end(fs.readFileSync(full));
  });
  await new Promise((r) => server.listen(0, r));
  const port = server.address().port;

  const browser = await chromium.launch({
    executablePath: CHROME,
    args: CHROME_ARGS,
    headless: true,
    chromiumSandbox: false,
  });

  try {
    // One page, one renderer, one scene — then every requested time is drawn
    // through it. That mirrors how Remotion reuses a tab across frames, so
    // the per-frame timings printed here are the ones that matter.
    const page = await browser.newPage({ viewport: { width, height } });
    page.on('console', (m) => log('  page:', m.text()));
    page.on('pageerror', (e) => log('  PAGE ERROR:', e.message));
    await page.goto(`http://localhost:${port}/`);

    const setupStart = Date.now();
    const backend = await page.evaluate(
      (o) => window.setup(o),
      { version, width, height, textureSize, post, forceWebGL, postStopAfter },
    );
    log(`setup ${((Date.now() - setupStart) / 1000).toFixed(1)}s  backend=${backend}`);

    const canvas = await page.$('canvas');
    for (const seconds of times) {
      const ms = await page.evaluate((t) => window.shoot(t), seconds);
      const out = path.join(outDir, `${version}-t${seconds.toFixed(2)}.png`);
      await canvas.screenshot({ path: out });
      log(`${version} t=${seconds}s  frame ${(ms / 1000).toFixed(2)}s  -> ${out}`);
    }
    await page.close();
  } finally {
    await browser.close();
    server.close();
  }
};

run().catch((e) => {
  console.error(e);
  process.exit(1);
});
