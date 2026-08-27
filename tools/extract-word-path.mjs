/**
 * Authoring aid for the "AI" silhouette. Converts the word to outlines in
 * Roboto Black (weight 900) and prints the literal to paste into
 * src/variants.ts, so VARIANTS stays the only place a path string lives and
 * nothing has to load a font at render time.
 *
 * Needs two packages that the project itself does not depend on:
 *
 *   npm i --no-save opentype.js @expo-google-fonts/roboto
 *   node tools/extract-word-path.mjs
 *
 * Roboto is Apache-2.0; only the two glyph outlines end up in the repo.
 */
import fs from 'node:fs';
import {createRequire} from 'node:module';
import opentype from 'opentype.js';

const require = createRequire(import.meta.url);
const TTF = require.resolve(
  '@expo-google-fonts/roboto/900Black/Roboto_900Black.ttf',
);

const WORD = 'AI';
/** Design space, matching src/lib/space.ts. */
const FRAME_W = 1920;
const FRAME_H = 1080;
/** Cap height in design units — 65% of frame height. */
const CAP_HEIGHT = 700;
/** Extra tracking in font units, so the particle fields of A and I stay apart. */
const TRACKING = 60;

const font = opentype.parse(fs.readFileSync(TTF).buffer.slice(0));
const scale = CAP_HEIGHT / font.tables.os2.sCapHeight;
const fontSize = scale * font.unitsPerEm;

// getPath() routes through the shaping engine, which this build of opentype.js
// cannot run on Roboto's GSUB table. Two Latin capitals need no shaping, so the
// glyphs are laid out directly from their advance widths instead.
const commands = [];
let box = null;
let pen = 0;
for (const ch of WORD) {
  const glyph = font.charToGlyph(ch);
  const path = glyph.getPath(pen * scale, 0, fontSize);
  const b = path.getBoundingBox();
  box = box
    ? {
        x1: Math.min(box.x1, b.x1),
        y1: Math.min(box.y1, b.y1),
        x2: Math.max(box.x2, b.x2),
        y2: Math.max(box.y2, b.y2),
      }
    : b;
  commands.push(...path.commands);
  pen += glyph.advanceWidth + TRACKING;
}

const dx = FRAME_W / 2 - (box.x1 + box.x2) / 2;
const dy = FRAME_H / 2 - (box.y1 + box.y2) / 2;
const n = (v) => String(Math.round(v * 10) / 10);

const parts = [];
for (const c of commands) {
  if (c.type === 'M') parts.push(`M ${n(c.x + dx)} ${n(c.y + dy)}`);
  else if (c.type === 'L') parts.push(`L ${n(c.x + dx)} ${n(c.y + dy)}`);
  else if (c.type === 'Q')
    parts.push(
      `Q ${n(c.x1 + dx)} ${n(c.y1 + dy)} ${n(c.x + dx)} ${n(c.y + dy)}`,
    );
  else if (c.type === 'C')
    parts.push(
      `C ${n(c.x1 + dx)} ${n(c.y1 + dy)} ${n(c.x2 + dx)} ${n(c.y2 + dy)} ` +
        `${n(c.x + dx)} ${n(c.y + dy)}`,
    );
  else if (c.type === 'Z') parts.push('Z');
}

const d = parts.join(' ');
console.error(
  `${WORD} in Roboto Black at cap height ${CAP_HEIGHT}: ` +
    `${(box.x2 - box.x1).toFixed(0)} x ${(box.y2 - box.y1).toFixed(0)} design units, ` +
    `centred at ${FRAME_W / 2},${FRAME_H / 2}`,
);

// Wrapped into ~78-column chunks on segment boundaries, to paste as an array.
let line = '';
const lines = [];
for (const part of parts) {
  if (line.length + part.length + 1 > 74) {
    lines.push(line);
    line = '';
  }
  line = line ? `${line} ${part}` : part;
}
if (line) lines.push(line);
for (const l of lines) console.log(`        '${l}',`);
console.error(`(${d.length} chars, ${lines.length} lines)`);
