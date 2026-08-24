/**
 * Inlines src/engine/cyber-alert.js into a single self-contained HTML file.
 * The engine is the one source of truth for the animation; this script only
 * wraps it in a page and a requestAnimationFrame driver.
 */
import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const out = resolve(root, 'dist/cyber-alert.html');

const engine = (await readFile(resolve(root, 'src/engine/cyber-alert.js'), 'utf8'))
  .replace(/^export (const|function|class|let|var)\b/gm, '$1');

const driver = `
/* ------------------------------------------------------------------ *
 * page driver
 * ------------------------------------------------------------------ */

const canvas = document.getElementById('stage');
const ctx = canvas.getContext('2d', { alpha: false, desynchronized: true });

// Backing store is locked to 3840x2160 — that is the deliverable resolution
// and already exceeds any display, so devicePixelRatio is used to snap the
// CSS box to whole device pixels rather than to grow the buffer.
canvas.width = WIDTH;
canvas.height = HEIGHT;

function fit() {
  const dpr = window.devicePixelRatio || 1;
  const vw = window.innerWidth;
  const vh = window.innerHeight;
  let w = Math.min(vw, (vh * WIDTH) / HEIGHT);
  let h = (w * HEIGHT) / WIDTH;
  w = Math.round(w * dpr) / dpr;
  h = Math.round(h * dpr) / dpr;
  canvas.style.width = w + 'px';
  canvas.style.height = h + 'px';
}
window.addEventListener('resize', fit, { passive: true });
fit();

async function boot() {
  if (document.fonts && document.fonts.ready) {
    try { await document.fonts.ready; } catch (e) { /* non-fatal */ }
  }
  const scene = createScene(WIDTH, HEIGHT);

  // Locked 60fps, time-based: the frame index is derived from elapsed wall
  // clock, so the loop keeps real time on displays faster or slower than
  // 60Hz and repeats exactly every 10.0s.
  let origin = null;
  let painted = -1;

  function tick(now) {
    if (origin === null) origin = now;
    const frame = Math.floor(((now - origin) / 1000) * FPS) % TOTAL_FRAMES;
    if (frame !== painted) {
      drawFrame(ctx, scene, frame);
      painted = frame;
    }
    requestAnimationFrame(tick);
  }

  drawFrame(ctx, scene, 0);
  requestAnimationFrame(tick);
}

boot();
`;

const html = `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1,viewport-fit=cover">
<title>cyber-alert</title>
<style>
  html, body {
    margin: 0;
    padding: 0;
    width: 100%;
    height: 100%;
    background: #000;
    overflow: hidden;
    cursor: none;
  }
  body {
    display: flex;
    align-items: center;
    justify-content: center;
  }
  #stage {
    display: block;
    image-rendering: auto;
  }
</style>
</head>
<body>
<canvas id="stage"></canvas>
<script type="module">
${engine}
${driver}
</script>
</body>
</html>
`;

await mkdir(dirname(out), { recursive: true });
await writeFile(out, html, 'utf8');
console.log(`wrote ${out} (${(Buffer.byteLength(html) / 1024).toFixed(1)} kB)`);
