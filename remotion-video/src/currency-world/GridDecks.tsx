import React from "react";
import type { Palette } from "./palette";

// A deck is built from individual rails rather than one big gridded
// plane. A plane large enough to reach the horizon is a layer of
// hundreds of megapixels, and Chromium rasterises it whole once a mask
// and a 3D transform are involved — enough to exhaust memory with
// several render workers running at once. Thirty-odd thin bars draw the
// identical picture for a rounding error of the memory.

const DECK_Y = 1750;
const RAIL_LENGTH = 13000; // how far each rail runs into the scene
const RAIL_Z_CENTER = -4500;
const RAIL_SPACING = 900;
const RAIL_COUNT = 11;
const CROSS_WIDTH = 11000;
const CROSS_DEPTHS = [-1000, -2200, -3600, -5200, -7000, -9200];

export const GridDecks: React.FC<{ palette: Palette }> = ({ palette }) => {
  const fadeBoth = `linear-gradient(90deg, rgba(0,0,0,0) 0%, ${palette.hud} 24%, ${palette.hud} 68%, rgba(0,0,0,0) 100%)`;

  return (
    <>
      {[DECK_Y, -DECK_Y].map((y) =>
        [
          // Rails running along the view axis. rotateY(90deg) turns each
          // bar's long side into depth, so they converge on the
          // vanishing point and give the eye a horizon to read the
          // camera's travel against.
          ...Array.from({ length: RAIL_COUNT }, (_, i) => {
            const x = (i - (RAIL_COUNT - 1) / 2) * RAIL_SPACING;
            return {
              key: `rail-${y}-${i}`,
              width: RAIL_LENGTH,
              height: 3,
              transform: `translate3d(${x}px, ${y}px, ${RAIL_Z_CENTER}px) rotateY(90deg)`,
            };
          }),
          // Cross ties, marking off distance along those rails.
          ...CROSS_DEPTHS.map((z, i) => ({
            key: `tie-${y}-${i}`,
            width: CROSS_WIDTH,
            height: 2,
            transform: `translate3d(0px, ${y}px, ${z}px)`,
          })),
        ].map((bar) => (
          <div
            key={bar.key}
            style={{
              position: "absolute",
              left: 0,
              top: 0,
              width: bar.width,
              height: bar.height,
              marginLeft: -bar.width / 2,
              marginTop: -bar.height / 2,
              transform: bar.transform,
              transformStyle: "preserve-3d",
              opacity: 0.22,
              backgroundImage: fadeBoth,
            }}
          />
        )),
      )}
    </>
  );
};
