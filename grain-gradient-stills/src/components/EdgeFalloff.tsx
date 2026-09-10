import { useLayoutEffect } from "react";
import type { EdgeConfig } from "../compositions";
import { STAGE_ORDER, usePipeline, type FieldState } from "../pipeline";

/**
 * How many decay lengths fit inside `inset`; at 2.5 the darkening is 92% spent
 * by the time it reaches that depth.
 */
const DECAY = 2.5;

/**
 * `t` is the normalised distance in from the edge, 0 at the edge itself.
 * Returns a multiplier: 1 - strength at the edge, approaching 1 inside.
 *
 * The decay is exponential rather than a ramp over a fixed inset. Any falloff
 * that finishes at a definite depth has an iso-contour there, and because the
 * frame edges are straight that contour is a straight line — laid across a
 * bright region it reads as a hard-edged shadow with a visible boundary, which
 * is precisely the artefact this pass is supposed to avoid. An exponential
 * never lands, so there is no contour to see anywhere in the frame.
 */
const edgeTerm = (t: number, edge: EdgeConfig): number => {
  if (edge.inset <= 0 || edge.strength <= 0) return 1;
  return 1 - edge.strength * Math.exp((-t / edge.inset) * DECAY * edge.power);
};

/**
 * Darkens towards the frame edges, but never as a symmetric vignette: each of
 * the four edges carries its own inset and strength so the falloff follows the
 * composition's light direction. Corners come out darker for free because the
 * four terms multiply, and a composition can name individual corners when it
 * wants only some of them to close down — g07 darkens its two off-diagonal
 * corners while leaving the edges open.
 *
 * This is also where the background joins the light, because the two do not
 * fall off together. Attenuating both to zero crushes the corners to a flat
 * 0,0,0 — and a black with no value left underneath it cannot carry grain, so
 * the very regions the grain pass is supposed to bite hardest in come out dead
 * instead. `backgroundDrop` sets how much of the background goes with the
 * light: 1 for a corner that must read as pure black, less for one that should
 * stay a grainy near-black.
 */
export const applyEdgeFalloff = (state: FieldState): void => {
  const { width, height, rgb, composition, palette } = state;
  const { left, right, top, bottom } = composition.edges;
  const corners = composition.corners ?? [];
  const drop = composition.backgroundDrop;

  const bg = palette.background;
  const bgR = bg.r * composition.background;
  const bgG = bg.g * composition.background;
  const bgB = bg.b * composition.background;

  // Corner reach is expressed against the diagonal so it stays circular on
  // screen rather than stretching with the 16:9 frame.
  const aspect = width / height;

  const columnTerms = new Float32Array(width);
  for (let x = 0; x < width; x++) {
    const u = (x + 0.5) / width;
    columnTerms[x] = edgeTerm(u, left) * edgeTerm(1 - u, right);
  }

  for (let y = 0; y < height; y++) {
    const v = (y + 0.5) / height;
    const rowTerm = edgeTerm(v, top) * edgeTerm(1 - v, bottom);
    for (let x = 0; x < width; x++) {
      let factor = rowTerm * columnTerms[x];

      if (corners.length > 0) {
        const u = (x + 0.5) / width;
        for (const corner of corners) {
          const dx = (u - corner.x) * aspect;
          const dy = v - corner.y;
          const d = Math.sqrt(dx * dx + dy * dy) / (corner.radius * aspect);
          factor *= 1 - corner.strength * Math.exp(-d * DECAY);
        }
      }

      const bgFactor = 1 - drop * (1 - factor);
      const o = (y * width + x) * 3;
      rgb[o] = bgR * bgFactor + rgb[o] * factor;
      rgb[o + 1] = bgG * bgFactor + rgb[o + 1] * factor;
      rgb[o + 2] = bgB * bgFactor + rgb[o + 2] * factor;
    }
  }
};

export const EdgeFalloff: React.FC = () => {
  const { register } = usePipeline();
  useLayoutEffect(() => {
    register({ order: STAGE_ORDER.edgeFalloff, run: applyEdgeFalloff });
  }, [register]);
  return null;
};
