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

// Must mirror the faces and weights CountryMap.tsx renders with; see src/fonts.ts.
const inter500 = measurer([
  'inter-latin-500-normal.woff2',
  'inter-latin-ext-500-normal.woff2',
]);
const interItalic = measurer([
  'inter-latin-400-italic.woff2',
  'inter-latin-ext-400-italic.woff2',
]);
const interBold = measurer([
  'inter-latin-700-normal.woff2',
  'inter-latin-ext-700-normal.woff2',
]);
const interTightBold = measurer([
  'inter-tight-latin-700-normal.woff2',
  'inter-tight-latin-ext-700-normal.woff2',
]);

// Country names past this length are set in Inter Tight. Keep in step with
// TIGHT_THRESHOLD in src/fonts.ts.
export const TIGHT_THRESHOLD = 10;

export const widthOf = {
  city: inter500,
  small: inter500,
  italic: interItalic,
  // Picks the face the composition will actually use for this name.
  display: (text, size, tracking = 0) =>
    (text.length > TIGHT_THRESHOLD ? interTightBold : interBold)(text, size, tracking),
};
