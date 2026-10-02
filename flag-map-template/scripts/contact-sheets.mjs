// Renders the two verification contact sheets (720p PNG):
//   out/contact-sheet-flags.png   every flag alone, uncropped
//   out/contact-sheet-shapes.png  frame 300 of all compositions, labelled
// Also prints the per-composition still render time.
//
//   node scripts/contact-sheets.mjs
import fs from 'node:fs';
import path from 'node:path';
import {bundle} from '@remotion/bundler';
import {getCompositions, openBrowser, renderStill, selectComposition} from '@remotion/renderer';

const root = process.cwd();
const sheetDir = path.join(root, 'public/_sheet');
const outDir = path.join(root, 'out');
fs.mkdirSync(sheetDir, {recursive: true});
fs.mkdirSync(outDir, {recursive: true});

const chromiumOptions = {gl: 'angle'};
const pw = '/opt/pw-browsers/chromium_headless_shell-1194/chrome-linux/headless_shell';
const browserExecutable = fs.existsSync(pw) ? pw : null;
const browser = await openBrowser('chrome', {browserExecutable, chromiumOptions});
const common = {puppeteerInstance: browser, chromiumOptions, browserExecutable};

const make = () => bundle({entryPoint: path.join(root, 'src/index.ts'), onProgress: () => undefined});

let serveUrl = await make();
const ids = (await getCompositions(serveUrl, common)).map((c) => c.id).filter((id) => id.startsWith('FlagMap-'));
const failures = [];
for (const id of ids) {
  const t = Date.now();
  try {
    const composition = await selectComposition({serveUrl, id, ...common});
    await renderStill({serveUrl, composition, frame: 300, scale: 1 / 3, imageFormat: 'png', output: path.join(sheetDir, `${id.replace('FlagMap-', '')}.png`), ...common});
    console.log(`${id.padEnd(28)} ${Date.now() - t} ms`);
  } catch (e) {
    failures.push(id);
    console.log(`${id.padEnd(28)} FAILED: ${e.message}`);
  }
}

serveUrl = await make(); // re-bundle so the sheet sees the new frames in public/
for (const [id, file] of [
  ['ContactSheet-Shapes', 'contact-sheet-shapes.png'],
  ['ContactSheet-Flags', 'contact-sheet-flags.png'],
]) {
  const composition = await selectComposition({serveUrl, id, ...common});
  await renderStill({serveUrl, composition, imageFormat: 'png', output: path.join(outDir, file), ...common});
  console.log(`wrote out/${file}`);
}
await browser.close({silent: true});
fs.rmSync(sheetDir, {recursive: true, force: true});
if (failures.length) {
  console.error('Failed:', failures.join(', '));
  process.exit(1);
}
