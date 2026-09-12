import React from "react";
import { AbsoluteFill, useVideoConfig } from "remotion";
import { BASE_H, BASE_W, PALETTE } from "./constants";
import { Dashboard } from "./Dashboard";
import { PerspectiveGrid } from "./PerspectiveGrid";
import { NEON_THEME, ThemeContext } from "./theme";

/** Fixed camera, in design units / degrees. Tuned to the neon reference. */
export const CAMERA = {
  perspective: 891,
  rotateX: 48.9,
  rotateY: 38,
  rotateZ: -33.9,
  scale: 1.302,
  /** Screen-space offset of the board's centre, in design units. */
  offsetX: 96.9,
  offsetY: -14.3,
} as const;

const GRID = { width: 4200, height: 2600, spacing: 15, opacity: 0.6 };

/**
 * Version B - neon. The same board, laid on a lit blueprint plane and viewed
 * from an angle, with the strokes blooming the way tube neon does.
 *
 * The board is laid out at `SUPERSAMPLE` times its design size and scaled back
 * down inside the transform, so Chrome rasterises the SVG with enough texels to
 * stay sharp after the 3D projection enlarges the near edge.
 */
const SUPERSAMPLE = 3;

export const SpeedTestNeon: React.FC = () => {
  const { width } = useVideoConfig();
  // CSS filter/perspective lengths are output pixels, so convert from design units.
  const px = width / BASE_W;

  const projection = [
    `rotateX(${CAMERA.rotateX}deg)`,
    `rotateY(${CAMERA.rotateY}deg)`,
    `rotateZ(${CAMERA.rotateZ}deg)`,
    `scale(${CAMERA.scale})`,
  ].join(" ");

  return (
    <AbsoluteFill style={{ backgroundColor: PALETTE.bg, overflow: "hidden" }}>
      <AbsoluteFill
        style={{
          perspective: CAMERA.perspective * px,
          // The vanishing point sits on the board's own anchor, so the camera
          // solve stays a plain "project about this point, then place it".
          perspectiveOrigin: `calc(50% + ${CAMERA.offsetX * px}px) calc(50% + ${CAMERA.offsetY * px}px)`,
        }}
      >
        {/*
          A zero-size anchor at the board's screen position. The offset lives in
          `left`/`top` rather than in the transform, so it stays a plain screen
          shift instead of being divided by the perspective.
        */}
        <div
          style={{
            position: "absolute",
            left: `calc(50% + ${CAMERA.offsetX * px}px)`,
            top: `calc(50% + ${CAMERA.offsetY * px}px)`,
            width: 0,
            height: 0,
            transformStyle: "preserve-3d",
            transform: projection,
          }}
        >
          {/* Blueprint plane, co-planar with the board. */}
          <div
            style={{
              position: "absolute",
              width: GRID.width * px,
              height: GRID.height * px,
              left: (-GRID.width / 2) * px,
              top: (-GRID.height / 2) * px,
            }}
          >
            <PerspectiveGrid {...GRID} />
          </div>

          {/* The board, supersampled then scaled back to design size. */}
          <div
            style={{
              position: "absolute",
              width: BASE_W * px * SUPERSAMPLE,
              height: BASE_H * px * SUPERSAMPLE,
              left: (-BASE_W / 2) * px * SUPERSAMPLE,
              top: (-BASE_H / 2) * px * SUPERSAMPLE,
              transform: `scale(${1 / SUPERSAMPLE})`,
            }}
          >
            <ThemeContext.Provider value={NEON_THEME}>
              <Dashboard glow />
            </ThemeContext.Provider>
          </div>
        </div>
      </AbsoluteFill>

      {/* Corner falloff, so the lit plane does not read as evenly printed. */}
      <AbsoluteFill
        style={{
          background:
            "radial-gradient(105% 105% at 34% 44%, rgba(5,28,41,0) 30%, rgba(1,10,17,0.88) 100%)",
        }}
      />
    </AbsoluteFill>
  );
};
