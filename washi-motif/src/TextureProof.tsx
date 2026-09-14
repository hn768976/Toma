import React from "react";
import { AbsoluteFill, useVideoConfig } from "remotion";
import { HEIGHT, WIDTH } from "./constants";
import { SURFACES, type SurfaceName } from "./surfaces";
import { PALETTES } from "./palettes";
import { css, darken, lighten, parseHex } from "./color";
import { drawSurface } from "./render/surface";
import { CanvasStage, useStageLayer } from "./components/CanvasStage";

const CROP_W = 680;
const CROP_H = 453;
const GAP = 10;
const LABEL = 26;
const COLUMNS = 3;

export type TextureProofProps = {
  /** Which surfaces to crop, in grid order. */
  surfaces: SurfaceName[];
};

export const textureProofSize = (count: number) => {
  const rows = Math.ceil(count / COLUMNS);
  return {
    width: GAP + COLUMNS * (CROP_W + GAP),
    height: GAP + rows * (CROP_H + LABEL + GAP),
  };
};

const Crops: React.FC<TextureProofProps & { width: number; height: number }> = ({
  surfaces,
  width,
  height,
}) => {
  useStageLayer("texture-proof", 0, (ctx) => {
    const base = darken(parseHex(PALETTES.goldWhite.paper), 0.9);
    ctx.fillStyle = css(base);
    ctx.fillRect(0, 0, width, height);

    const full = document.createElement("canvas");
    full.width = WIDTH;
    full.height = HEIGHT;
    const fullCtx = full.getContext("2d", { willReadFrequently: true });
    if (!fullCtx) throw new Error("2d context unavailable for the proof");

    ctx.textBaseline = "middle";
    ctx.font = "500 18px system-ui, sans-serif";

    surfaces.forEach((name, index) => {
      const spec = SURFACES[name];
      if (!spec) return;
      const col = index % COLUMNS;
      const row = Math.floor(index / COLUMNS);
      const x = GAP + col * (CROP_W + GAP);
      const y = GAP + row * (CROP_H + LABEL + GAP);

      fullCtx.setTransform(1, 0, 0, 1, 0, 0);
      fullCtx.clearRect(0, 0, WIDTH, HEIGHT);
      drawSurface(fullCtx, {
        surface: spec,
        palette: PALETTES[spec.palette],
        width: WIDTH,
        height: HEIGHT,
      });

      /* A 1:1 crop from off-centre, so motifs and plain ground both show. */
      ctx.drawImage(
        full,
        WIDTH * 0.3,
        HEIGHT * 0.32,
        CROP_W,
        CROP_H,
        x,
        y,
        CROP_W,
        CROP_H,
      );

      ctx.fillStyle = css(lighten(base, 0.6));
      ctx.fillText(`${name}  ${spec.label}`, x + 2, y + CROP_H + LABEL / 2);
    });
  });

  return null;
};

/**
 * A grid of 1:1 crops, for judging texture at actual pixels.
 *
 * A contact-sheet tile is a few hundred pixels wide and cannot show a fibre,
 * so tuning texture from one is guesswork. This is the instrument for it.
 */
export const TextureProof: React.FC<TextureProofProps> = ({ surfaces }) => {
  const { width, height } = useVideoConfig();
  const base = darken(parseHex(PALETTES.goldWhite.paper), 0.9);

  return (
    <AbsoluteFill style={{ backgroundColor: css(base) }}>
      <CanvasStage width={width} height={height} background={css(base)}>
        <Crops surfaces={surfaces} width={width} height={height} />
      </CanvasStage>
    </AbsoluteFill>
  );
};

export const textureProofDefaultProps: TextureProofProps = {
  surfaces: ["s02", "s05", "s06", "s11", "s12", "s14", "s15", "s16", "s07"],
};
