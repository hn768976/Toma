import React from "react";
import { AbsoluteFill, Img, staticFile } from "remotion";
import { SHEET, TILE_DIR, type ContactSheetProps } from "./layout";

/**
 * All 36 stills tiled for review at a glance: one palette per row, columns
 * running sparse -> medium -> dense with both focus bands side by side.
 *
 * The tiles are true downscales of the rendered 4K PNGs, produced by
 * scripts/contact-sheet.ts — not re-renders at a smaller size, which would
 * not represent the delivered images.
 */
export const ContactSheet: React.FC<ContactSheetProps> = ({ tiles }) => {
  return (
    <AbsoluteFill
      style={{
        backgroundColor: SHEET.background,
        padding: SHEET.margin,
        display: "grid",
        gridTemplateColumns: `repeat(${SHEET.columns}, ${SHEET.tileWidth}px)`,
        gridAutoRows: `${SHEET.tileHeight + SHEET.labelHeight}px`,
        gap: SHEET.gap,
        alignContent: "start",
      }}
    >
      {tiles.map((tile) => (
        <div key={tile.file}>
          <Img
            src={staticFile(`${TILE_DIR}/${tile.file}`)}
            style={{
              width: SHEET.tileWidth,
              height: SHEET.tileHeight,
              display: "block",
              borderRadius: 3,
            }}
          />
          <div
            style={{
              height: SHEET.labelHeight,
              lineHeight: `${SHEET.labelHeight}px`,
              fontFamily: "ui-monospace, SFMono-Regular, Menlo, Consolas, monospace",
              fontSize: 19,
              letterSpacing: 0.2,
              color: SHEET.label,
            }}
          >
            {tile.label}
          </div>
        </div>
      ))}
    </AbsoluteFill>
  );
};
