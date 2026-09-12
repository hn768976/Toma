import React from "react";
import { PLANE_HEIGHT, PLANE_WIDTH } from "../constants";
import { DepthLayer } from "../Stage";
import type { Camera } from "../optics";

// The physical surface of the display, laid over the UI on the same plane.
//
// The pixel grid is the load-bearing part. A real monitor shot at this
// angle beats against the sensor and produces fine moiré that drifts as
// the camera breathes; reproducing the grid in plane space and letting
// the perspective compress it gives that for free. It is tiled so each
// piece can be defocused by its own depth — a uniformly sharp grid over a
// heavily blurred panel would immediately flatten the shot.
const TILES_X = 9;
const TILES_Y = 6;

export const ScreenSurface: React.FC<{ camera: Camera }> = ({ camera }) => {
  const tw = PLANE_WIDTH / TILES_X;
  const th = PLANE_HEIGHT / TILES_Y;

  return (
    <>
      {Array.from({ length: TILES_X * TILES_Y }, (_, i) => {
        const cx = i % TILES_X;
        const cy = Math.floor(i / TILES_X);
        return (
          <DepthLayer
            key={i}
            camera={camera}
            x={cx * tw}
            y={cy * th}
            width={tw}
            height={th}
            zIndex={40}
          >
            <div
              style={{
                position: "absolute",
                inset: 0,
                backgroundImage:
                  "repeating-linear-gradient(90deg, rgba(0,0,0,0.46) 0 1px, rgba(0,0,0,0) 1px 3px)," +
                  "repeating-linear-gradient(0deg, rgba(0,0,0,0.3) 0 1px, rgba(0,0,0,0) 1px 3px)",
                opacity: 0.42,
              }}
            />
          </DepthLayer>
        );
      })}

      {/* Glass sheen: a broad off-axis reflection sliding across the
          panel. Focused far behind the pixels, so it stays soft. */}
      <div
        style={{
          position: "absolute",
          inset: 0,
          zIndex: 41,
          background:
            "linear-gradient(112deg, rgba(150,195,235,0) 18%, rgba(150,195,235,0.075) 34%," +
            "rgba(190,220,245,0.11) 42%, rgba(150,195,235,0.04) 52%, rgba(150,195,235,0) 66%)",
          filter: "blur(22px)",
          mixBlendMode: "screen",
          pointerEvents: "none",
        }}
      />
      {/* Anti-glare coating haze, strongest where the sheen lands. */}
      <div
        style={{
          position: "absolute",
          inset: 0,
          zIndex: 42,
          background:
            "radial-gradient(120% 90% at 18% 8%, rgba(120,165,205,0.12), rgba(120,165,205,0) 55%)",
          mixBlendMode: "screen",
          pointerEvents: "none",
        }}
      />
    </>
  );
};
