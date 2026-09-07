/** Layout of the 6x6 review sheet. Shared with scripts/contact-sheet.ts so the
 *  thumbnails are generated at exactly the size they are displayed. */
export const SHEET = {
  columns: 6,
  rows: 6,
  tileWidth: 620,
  tileHeight: 349,
  gap: 18,
  margin: 28,
  labelHeight: 30,
  background: "#0B0B0E",
  label: "#8A8F98",
} as const;

export const SHEET_WIDTH =
  SHEET.margin * 2 + SHEET.columns * SHEET.tileWidth + (SHEET.columns - 1) * SHEET.gap;

export const SHEET_HEIGHT =
  SHEET.margin * 2 +
  SHEET.rows * (SHEET.tileHeight + SHEET.labelHeight) +
  (SHEET.rows - 1) * SHEET.gap;

/** Where the script writes the thumbnails, relative to public/. */
export const TILE_DIR = "contact-tiles";

export type ContactSheetProps = {
  tiles: { file: string; label: string }[];
};

export const contactSheetDefaultProps: ContactSheetProps = { tiles: [] };
