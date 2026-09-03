/**
 * Offscreen surfaces for a three-band depth-of-field composite.
 *
 * The soft bands live at a reduced resolution because they are about to be
 * blurred by tens of pixels in output space — the detail would be thrown away
 * anyway. The sharp band is full resolution. Allocating these once matters:
 * a 4K canvas per frame dominates render time on its own.
 *
 * @module dofBuffers
 */
import { useMemo } from "react";

export type DofBand = "far" | "mid" | "near";
export const DOF_BANDS: DofBand[] = ["far", "mid", "near"];

export type DofBuffers = {
  canvas: Record<DofBand, HTMLCanvasElement>;
  /** Resolution factor each band's surface is allocated at. */
  scale: Record<DofBand, number>;
  /** Output-space blur radius applied to each band on composite. */
  blur: Record<DofBand, number>;
};

export const makeCanvas = (w: number, h: number) => {
  const c = document.createElement("canvas");
  c.width = Math.round(w);
  c.height = Math.round(h);
  return c;
};

export type DofBuffersConfig = {
  width: number;
  height: number;
  /** Output-space blur radii. The mid band should normally be 0. */
  blur?: Partial<Record<DofBand, number>>;
  /** Resolution factor for the blurred bands. 0.5 is ample. */
  softScale?: number;
};

export const useDofBuffers = ({
  width,
  height,
  blur,
  softScale = 0.5,
}: DofBuffersConfig): DofBuffers =>
  useMemo(() => {
    const b = { far: 20, mid: 0, near: 11, ...blur };
    const scale = { far: softScale, mid: 1, near: softScale };
    return {
      canvas: {
        far: makeCanvas(width * scale.far, height * scale.far),
        mid: makeCanvas(width, height),
        near: makeCanvas(width * scale.near, height * scale.near),
      },
      scale,
      blur: b,
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [width, height, softScale, blur?.far, blur?.mid, blur?.near]);
