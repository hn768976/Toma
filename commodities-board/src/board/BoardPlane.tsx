import React from "react";
import {
  HEIGHT,
  PERSPECTIVE,
  PLANE_HEIGHT,
  PLANE_WIDTH,
  ROTATE_X,
  ROTATE_Z,
  ROW_HEIGHT,
  WIDTH,
} from "../constants";
import type { Theme } from "../theme";
import { BoardList } from "./BoardList";
import { BAND_OVERLAP, BANDS, localBlurFor } from "./DepthOfField";

/**
 * The board: one CSS 3D plane, real DOM text, no engine and nothing
 * rasterised - the row text is the product, so it stays vector-crisp all the
 * way to 4K.
 *
 * Each depth slice is its own masked, blurred copy of just the rows that fall
 * inside it. The mask ramps in over BAND_OVERLAP while the slice above is still
 * fully opaque, so neighbouring slices cross-fade instead of showing a seam,
 * and no slice ever blurs a hard-clipped edge.
 */
export const BoardPlane: React.FC<{
  frame: number;
  scroll: number;
  theme: Theme;
  frameWidth: number;
}> = ({ frame, scroll, theme, frameWidth }) => (
  <div
    style={{
      position: "absolute",
      width: WIDTH,
      height: HEIGHT,
      perspective: PERSPECTIVE,
      perspectiveOrigin: "50% 50%",
    }}
  >
    <div
      style={{
        position: "absolute",
        left: (WIDTH - PLANE_WIDTH) / 2,
        top: (HEIGHT - PLANE_HEIGHT) / 2,
        width: PLANE_WIDTH,
        height: PLANE_HEIGHT,
        transformStyle: "preserve-3d",
        transform: `rotateZ(${ROTATE_Z}deg) rotateX(${ROTATE_X}deg)`,
      }}
    >
      {BANDS.map((band, i) => {
        const blur = localBlurFor(band, frameWidth);
        // Reach past the slice by the blur's own radius plus a row, so the
        // rows feeding the blur at an edge are always present.
        const margin = blur * 3 + ROW_HEIGHT;
        const elementHeight = band.height + BAND_OVERLAP;
        const rampStop = (BAND_OVERLAP / elementHeight) * 100;
        const mask =
          i === 0
            ? undefined
            : `linear-gradient(to bottom, rgba(0,0,0,0) 0%, rgba(0,0,0,1) ${rampStop.toFixed(3)}%, rgba(0,0,0,1) 100%)`;

        return (
          <div
            key={i}
            style={{
              position: "absolute",
              left: 0,
              top: band.top,
              width: PLANE_WIDTH,
              height: elementHeight,
              maskImage: mask,
              WebkitMaskImage: mask,
            }}
          >
            <div
              style={{
                position: "absolute",
                left: 0,
                top: -margin,
                width: PLANE_WIDTH,
                height: elementHeight + margin * 2,
                filter: blur > 0 ? `blur(${blur.toFixed(2)}px)` : undefined,
              }}
            >
              <BoardList
                scroll={scroll}
                windowTop={band.top - margin}
                windowBottom={band.top + elementHeight + margin}
                frame={frame}
                theme={theme}
              />
            </div>
          </div>
        );
      })}
    </div>
  </div>
);
