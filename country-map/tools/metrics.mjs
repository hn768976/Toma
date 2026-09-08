// Real advance widths, read straight out of the woff2 files the compositions
// render with. Label placement is only as good as its idea of how wide a word
// is, and guessing an average character width is wrong by 30% either way
// depending on the word.
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import * as fontkit from 'fontkit';

const FONTS = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  '../public/fonts',
);

// A face is split across subset files (latin, latin-ext); merge them into one
// codepoint -> advance table so accented city names measure correctly.
function advanceTable(files) {
  const table = new Map();
  for (const file of files) {
    const font = fontkit.openSync(path.join(FONTS, file));
    for (const code of font.characterSet) {
      if (table.has(code)) continue;
      const glyph = font.glyphForCodePoint(code);
      if (glyph) table.set(code, glyph.advanceWidth / font.unitsPerEm);
    }
  }
  return table;
}

const measurer = (files) => {
  const table = advanceTable(files);
  // tracking is in em, matching the letterSpacing the composition applies.
  return (text, size, tracking = 0) => {
    let em = 0;
    for (const ch of text) em += table.get(ch.codePointAt(0)) ?? 0.5;
    return (em + tracking * text.length) * size;
  };
};

export const widthOf = {
  city: measurer(['inter-latin-600-normal.woff2', 'inter-latin-ext-600-normal.woff2']),
  small: measurer(['inter-latin-500-normal.woff2', 'inter-latin-ext-500-normal.woff2']),
  display: measurer([
    'barlow-condensed-latin-700-normal.woff2',
    'barlow-condensed-latin-ext-700-normal.woff2',
  ]),
};
