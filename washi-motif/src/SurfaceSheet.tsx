import React from "react";
import { AbsoluteFill, useVideoConfig } from "remotion";
import {
  HEIGHT,
  SHEET_GUTTER,
  SHEET_LABEL_HEIGHT,
  SHEET_PADDING,
  WIDTH,
} from "./constants";
import { SURFACES, SURFACE_NAMES } from "./surfaces";
import { PALETTES } from "./palettes";
import { css, darken, lighten, parseHex } from "./color";
import { drawSurface } from "./render/surface";
import { CanvasStage, useStageLayer } from "./components/CanvasStage";

const COLUMNS = 5;
const ROWS = 4;
const TILE_WIDTH = 720;
const TILE_HEIGHT = 480;
const SUPERSAMPLE = 2;
const HEADER = 78;

export const surfaceSheetSize = () => ({
  width: SHEET_PADDING * 2 + TILE_WIDTH * COLUMNS + SHEET_GUTTER * (COLUMNS - 1),
  height:
    SHEET_PADDING * 2 +
    HEADER +
    (TILE_HEIGHT + SHEET_LABEL_HEIGHT) * ROWS +
    SHEET_GUTTER * (ROWS - 1),
});

const SheetTiles: React.FC<{
  width: number;
  height: number;
  background: string;
  labelColour: string;
  titleColour: string;
}> = ({ width, height, background, labelColour, titleColour }) => {
  useStageLayer("surface-sheet", 0, (ctx) => {
    const tileW = TILE_WIDTH * SUPERSAMPLE;
    const tileH = TILE_HEIGHT * SUPERSAMPLE;
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
      `Washi surfaces — ${SURFACE_NAMES.length} full-bleed textures — ${WIDTH}x${HEIGHT}`,
      SHEET_PADDING,
      SHEET_PADDING + HEADER / 2,
    );

    ctx.imageSmoothingEnabled = true;
    ctx.imageSmoothingQuality = "high";

    SURFACE_NAMES.forEach((name, index) => {
      const spec = SURFACES[name];
      const col = index % COLUMNS;
      const row = Math.floor(index / COLUMNS);
      const x = SHEET_PADDING + col * (TILE_WIDTH + SHEET_GUTTER);
      const y =
        SHEET_PADDING +
        HEADER +
        row * (TILE_HEIGHT + SHEET_LABEL_HEIGHT + SHEET_GUTTER);

      scratchCtx.setTransform(1, 0, 0, 1, 0, 0);
      scratchCtx.clearRect(0, 0, tileW, tileH);
      drawSurface(scratchCtx, {
        surface: spec,
        palette: PALETTES[spec.palette],
        width: tileW,
        height: tileH,
      });

      ctx.drawImage(scratch, x, y, TILE_WIDTH, TILE_HEIGHT);

      ctx.fillStyle = labelColour;
      ctx.font = "500 20px system-ui, sans-serif";
      ctx.fillText(
        `${name}  ${spec.label} · ${spec.palette}`,
        x + 2,
        y + TILE_HEIGHT + SHEET_LABEL_HEIGHT / 2 + 2,
      );
    });
  });

  return null;
};

/**
 * All the surfaces tiled at reduced scale, in table order. Tiles come from the
 * same draw code as the full-size stills, at the same 3:2 ratio.
 */
export const SurfaceSheet: React.FC = () => {
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

export const SURFACE_SHEET_REFERENCE = HEIGHT;
