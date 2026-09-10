import React from "react";
import { AbsoluteFill, useVideoConfig } from "remotion";
import {
  HEIGHT,
  SHEET_COLUMNS,
  SHEET_GUTTER,
  SHEET_LABEL_HEIGHT,
  SHEET_PADDING,
  SHEET_ROWS,
  SHEET_TILE_HEIGHT,
  SHEET_TILE_WIDTH,
  WIDTH,
} from "./constants";
import { BATCH_PAIRS, COMPOSITIONS, type CompositionName } from "./compositions";
import { PALETTES, type PaletteName } from "./palettes";
import { css, darken, lighten, parseHex } from "./color";
import { drawStill } from "./render/still";
import { CanvasStage, useStageLayer } from "./components/CanvasStage";

/** Tiles are generated at twice their final size and downsampled. */
const SUPERSAMPLE = 2;
const HEADER = 78;

export const contactSheetSize = () => ({
  width:
    SHEET_PADDING * 2 +
    SHEET_TILE_WIDTH * SHEET_COLUMNS +
    SHEET_GUTTER * (SHEET_COLUMNS - 1),
  height:
    SHEET_PADDING * 2 +
    HEADER +
    (SHEET_TILE_HEIGHT + SHEET_LABEL_HEIGHT) * SHEET_ROWS +
    SHEET_GUTTER * (SHEET_ROWS - 1),
});

/** The sixteen stills, in the batch order, so each pair lands side by side. */
const TILES: { composition: CompositionName; palette: PaletteName }[] =
  BATCH_PAIRS.flatMap((pair) =>
    pair.palettes.map((palette) => ({
      composition: pair.composition,
      palette,
    })),
  );

const SheetTiles: React.FC<{
  width: number;
  height: number;
  background: string;
  labelColour: string;
  titleColour: string;
}> = ({ width, height, background, labelColour, titleColour }) => {
  useStageLayer("contact-sheet", 0, (ctx) => {
    const tileW = SHEET_TILE_WIDTH * SUPERSAMPLE;
    const tileH = SHEET_TILE_HEIGHT * SUPERSAMPLE;

    // One reusable offscreen canvas for all sixteen tiles.
    const scratch = document.createElement("canvas");
    scratch.width = tileW;
    scratch.height = tileH;
    const scratchCtx = scratch.getContext("2d", { willReadFrequently: true });
    if (!scratchCtx) throw new Error("2d context unavailable for the tiles");

    ctx.fillStyle = background;
    ctx.fillRect(0, 0, width, height);

    ctx.textBaseline = "middle";
    ctx.fillStyle = titleColour;
    ctx.font = "600 34px system-ui, sans-serif";
    ctx.fillText(
      `Washi paper motifs — eight compositions, two palettes each — ${WIDTH}x${HEIGHT}`,
      SHEET_PADDING,
      SHEET_PADDING + HEADER / 2,
    );

    ctx.imageSmoothingEnabled = true;
    ctx.imageSmoothingQuality = "high";

    TILES.forEach((tile, index) => {
      const col = index % SHEET_COLUMNS;
      const row = Math.floor(index / SHEET_COLUMNS);
      const x = SHEET_PADDING + col * (SHEET_TILE_WIDTH + SHEET_GUTTER);
      const y =
        SHEET_PADDING +
        HEADER +
        row * (SHEET_TILE_HEIGHT + SHEET_LABEL_HEIGHT + SHEET_GUTTER);

      scratchCtx.setTransform(1, 0, 0, 1, 0, 0);
      scratchCtx.clearRect(0, 0, tileW, tileH);
      drawStill(scratchCtx, {
        composition: COMPOSITIONS[tile.composition],
        palette: PALETTES[tile.palette],
        width: tileW,
        height: tileH,
      });

      ctx.drawImage(scratch, x, y, SHEET_TILE_WIDTH, SHEET_TILE_HEIGHT);

      ctx.fillStyle = labelColour;
      ctx.font = "500 21px system-ui, sans-serif";
      ctx.fillText(
        `${tile.composition}  ${COMPOSITIONS[tile.composition].label} · ${tile.palette}`,
        x + 2,
        y + SHEET_TILE_HEIGHT + SHEET_LABEL_HEIGHT / 2 + 2,
      );
    });
  });

  return null;
};

/**
 * All sixteen stills tiled at reduced scale, each composition's two palettes
 * side by side.
 *
 * Tiles are generated from the same tables and the same draw code as the
 * full-size stills, at the same 3:2 ratio — a true miniature rather than a
 * rescaled screenshot, so the sheet is a fair proof of the set.
 */
export const ContactSheet: React.FC = () => {
  const { width, height } = useVideoConfig();
  const base = darken(parseHex(PALETTES.goldWhite.paper), 0.9);

  return (
    <AbsoluteFill style={{ backgroundColor: css(base) }}>
      <CanvasStage width={width} height={height} background={css(base)}>
        <SheetTiles
          width={width}
          height={height}
          background={css(base)}
          labelColour={css(lighten(base, 0.55))}
          titleColour={css(lighten(base, 0.82))}
        />
      </CanvasStage>
    </AbsoluteFill>
  );
};

export const CONTACT_SHEET_ASPECT = WIDTH / HEIGHT;
