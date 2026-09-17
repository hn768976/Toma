// Rasterises the public-domain Wikimedia flag SVGs to high-resolution PNG
// textures ONCE, at build time. Also verifies every source SVG against the
// official proportion recorded in src/data/countries.json and fails loudly on
// a mismatch.
import {chromium} from 'playwright-core';
import {readFileSync, writeFileSync, mkdirSync, existsSync} from 'node:fs';
import {fileURLToPath} from 'node:url';
import {dirname, join} from 'node:path';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const data = JSON.parse(readFileSync(join(root, 'src/data/countries.json'), 'utf8'));
const TIERS = data.textureTiers; // {'4k': 4096, '8k': 8192}
const SVG_DIR = join(root, 'node_modules/svg-country-flags/svg');
const OUT_DIR = join(root, 'public/flags');

const EXECUTABLE =
  process.env.CHROME_EXECUTABLE ?? '/opt/pw-browsers/chromium-1194/chrome-linux/chrome';

const parseViewBox = (svg) => {
  const m = svg.match(/viewBox\s*=\s*"([^"]+)"/);
  if (!m) throw new Error('no viewBox');
  const [x, y, w, h] = m[1].trim().split(/[\s,]+/).map(Number);
  return {x, y, w, h};
};

mkdirSync(OUT_DIR, {recursive: true});

const browser = await chromium.launch({executablePath: EXECUTABLE});
const report = [];
let failures = 0;

for (const c of data.countries) {
  const src = join(SVG_DIR, `${c.code}.svg`);
  if (!existsSync(src)) throw new Error(`missing source SVG for ${c.code}`);
  let svg = readFileSync(src, 'utf8');

  // Apply a per-country viewBox correction where the source rendering does not
  // match the official proportion.
  if (c.svgViewBox) {
    svg = svg.replace(/viewBox\s*=\s*"[^"]+"/, `viewBox="${c.svgViewBox}"`);
  }

  const vb = parseViewBox(svg);
  const svgAspect = vb.w / vb.h;
  const officialAspect = c.ratio[1] / c.ratio[0];
  const drift = Math.abs(svgAspect - officialAspect) / officialAspect;

  if (drift > 0.002) {
    failures++;
    report.push(
      `FAIL ${c.code} ${c.name}: source aspect ${svgAspect.toFixed(4)} vs official ` +
        `${c.ratio[0]}:${c.ratio[1]} (${officialAspect.toFixed(4)}), drift ${(drift * 100).toFixed(2)}%`,
    );
    continue;
  }

  // Two tiers: the pole shot uses 4k, the close-up 8k. At 4K output the
  // close-up fills the frame with cloth, so the emblem is sampled near 1:1 and
  // a 4k texture is not enough for it to stay crisp through the folds.
  const sizes = [];
  for (const [tier, longEdge] of Object.entries(TIERS)) {
    const [w, h] =
      officialAspect >= 1
        ? [longEdge, Math.round(longEdge / officialAspect)]
        : [Math.round(longEdge * officialAspect), longEdge];

    // Force exact pixel dimensions. Aspect is already verified to within 0.2%,
    // so "none" fills the bitmap exactly without visible distortion.
    const sized = svg.replace(
      /<svg\b/,
      `<svg width="${w}" height="${h}" preserveAspectRatio="none"`,
    );

    const page = await browser.newPage({viewport: {width: w, height: h}, deviceScaleFactor: 1});
    await page.setContent(
      `<!doctype html><html><body style="margin:0;padding:0;background:#fff;overflow:hidden">${sized}</body></html>`,
      {waitUntil: 'load'},
    );
    const buf = await page.screenshot({type: 'png', clip: {x: 0, y: 0, width: w, height: h}});
    const name = tier === '4k' ? `${c.code}.png` : `${c.code}@${tier}.png`;
    writeFileSync(join(OUT_DIR, name), buf);
    await page.close();
    sizes.push(`${w}x${h} ${(buf.length / 1024).toFixed(0)}KiB`);
  }

  report.push(
    `ok   ${c.code} ${c.name.padEnd(22)} ${c.ratio[0]}:${c.ratio[1]}`.padEnd(38) +
      sizes.join('  |  ') +
      (c.svgViewBox ? '  [viewBox corrected]' : ''),
  );
}

// --- grain tile -----------------------------------------------------------
// One seamless tile of white noise, generated with a seeded PRNG so it is
// byte-identical on every build. The Grade layer offsets it per frame, which
// decorrelates consecutive frames without any per-frame noise cost.
{
  const page = await browser.newPage({viewport: {width: 64, height: 64}});
  const dataUrl = await page.evaluate((size) => {
    const cv = document.createElement('canvas');
    cv.width = size;
    cv.height = size;
    const ctx = cv.getContext('2d');
    const img = ctx.createImageData(size, size);
    let seed = 20260917;
    const rnd = () => {
      seed = (seed * 1664525 + 1013904223) >>> 0;
      return seed / 4294967296;
    };
    for (let i = 0; i < size * size; i++) {
      // Two uniforms averaged: a cheap approximation of gaussian grain,
      // centred on mid grey so the overlay blend is neutral on average. The
      // amplitude lands at roughly 1.5% luminance modulation once the overlay
      // blend is applied — enough to dither the sky gradient, not enough to
      // read as noise.
      const n = (rnd() + rnd()) * 0.5;
      const v = Math.round(128 + (n - 0.5) * 255 * 0.035);
      img.data[i * 4] = v;
      img.data[i * 4 + 1] = v;
      img.data[i * 4 + 2] = v;
      img.data[i * 4 + 3] = 255;
    }
    ctx.putImageData(img, 0, 0);
    return cv.toDataURL('image/png');
  }, 1024);
  writeFileSync(join(root, 'public/grain.png'), Buffer.from(dataUrl.split(',')[1], 'base64'));
  await page.close();
  report.push('ok   grain tile 1024x1024');
}

await browser.close();
console.log(report.join('\n'));
if (failures > 0) {
  console.error(`\n${failures} flag(s) failed proportion verification.`);
  process.exit(1);
}
console.log(
  `\n${data.countries.length} countries x ${Object.keys(TIERS).length} tiers written to public/flags ` +
    `(${Object.entries(TIERS).map(([k, v]) => `${k}=${v}px`).join(', ')} long edge).`,
);
