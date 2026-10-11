// Renders the verification / delivery contact sheets (720p PNG) into out/:
//   contact-sheet-flags.png            every flag alone, uncropped, card ratio, named
//   contact-sheet-flags-numbered.png   same, numbers only (for an independent flag check)
//   contact-sheet-growth.png           frame 300 of all 25 Growth compositions
//   contact-sheet-decline.png          frame 300 of all 25 Decline compositions
// Each composition's frame 300 is rendered twice from a cold page; the two
// PNGs must be byte-identical (determinism check). Temp frames are deleted.
//
//   node scripts/contact-sheets.mjs
import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import {bundle} from '@remotion/bundler';
import {getCompositions, openBrowser, renderStill, selectComposition} from '@remotion/renderer';

const root = process.cwd();
const sheetDir = path.join(root, 'public/_sheet');
const twiceDir = path.join(root, 'out/_twice');
const outDir = path.join(root, 'out');
fs.mkdirSync(sheetDir, {recursive: true});
fs.mkdirSync(twiceDir, {recursive: true});

const chromiumOptions = {gl: 'angle'};
const pw = '/opt/pw-browsers/chromium_headless_shell-1194/chrome-linux/headless_shell';
const browserExecutable = fs.existsSync(pw) ? pw : null;
const md5 = (f) => crypto.createHash('md5').update(fs.readFileSync(f)).digest('hex');
const make = () => bundle({entryPoint: path.join(root, 'src/index.ts'), onProgress: () => undefined});

let serveUrl = await make();
let browser = await openBrowser('chrome', {browserExecutable, chromiumOptions});
const ids = (await getCompositions(serveUrl, {puppeteerInstance: browser, chromiumOptions})).map((c) => c.id).filter((id) => id.startsWith('FlagChart-'));
const failures = [];
const mismatches = [];
for (const pass of [1, 2]) {
  // a fresh browser per pass, so pass 2 is a cold start for every composition
  if (pass === 2) {
    await browser.close({silent: true});
    browser = await openBrowser('chrome', {browserExecutable, chromiumOptions});
  }
  for (const id of ids) {
    const name = id.replace('FlagChart-', '');
    const out = pass === 1 ? path.join(sheetDir, `${name}.png`) : path.join(twiceDir, `${name}.png`);
    const t = Date.now();
    try {
      const composition = await selectComposition({serveUrl, id, puppeteerInstance: browser, chromiumOptions});
      await renderStill({serveUrl, composition, frame: 300, scale: 1 / 3, imageFormat: 'png', output: out, puppeteerInstance: browser, chromiumOptions});
      if (pass === 2 && md5(out) !== md5(path.join(sheetDir, `${name}.png`))) mismatches.push(id);
      console.log(`pass ${pass} ${id.padEnd(34)} ${Date.now() - t} ms`);
    } catch (e) {
      failures.push(id);
      console.log(`pass ${pass} ${id.padEnd(34)} FAILED: ${e.message}`);
    }
  }
}
console.log(`frame-300 cold-start twice: ${ids.length - mismatches.length}/${ids.length} identical${mismatches.length ? ' — MISMATCH: ' + mismatches.join(', ') : ''}`);

serveUrl = await make(); // re-bundle so the sheets see the frames in public/
for (const [id, file] of [
  ['ContactSheet-Growth', 'contact-sheet-growth.png'],
  ['ContactSheet-Decline', 'contact-sheet-decline.png'],
  ['ContactSheet-Flags', 'contact-sheet-flags.png'],
  ['ContactSheet-Flags-Numbered', 'contact-sheet-flags-numbered.png'],
]) {
  const composition = await selectComposition({serveUrl, id, puppeteerInstance: browser, chromiumOptions});
  await renderStill({serveUrl, composition, imageFormat: 'png', output: path.join(outDir, file), puppeteerInstance: browser, chromiumOptions});
  console.log(`wrote out/${file}`);
}
await browser.close({silent: true});
if (process.env.KEEP_FRAMES) fs.cpSync(sheetDir, process.env.KEEP_FRAMES, {recursive: true});
fs.rmSync(sheetDir, {recursive: true, force: true});
fs.rmSync(twiceDir, {recursive: true, force: true});
if (failures.length || mismatches.length) process.exit(1);
