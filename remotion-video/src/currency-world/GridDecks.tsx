import React from "react";
import type { Palette } from "./palette";

const DECK_SPAN = 17000; // both across and into the scene
const DECK_Z_CENTER = -4200;

/**
 * A faint grid above and below the field, lying flat.
 *
 * These carry the perspective read: their lines genuinely run along the
 * view axis, so they converge on the vanishing point and give the eye a
 * horizon to measure the camera's travel against. Kept dim on purpose —
 * they should be felt, not counted.
 */
export const GridDecks: React.FC<{ palette: Palette }> = ({ palette }) => {
  const decks = [
    { y: 1750, tilt: 90 },
    { y: -1750, tilt: -90 },
  ];

  return (
    <>
      {decks.map((deck, i) => (
        <div
          key={i}
          style={{
            position: "absolute",
            left: 0,
            top: 0,
            width: DECK_SPAN,
            height: DECK_SPAN,
            marginLeft: -DECK_SPAN / 2,
            marginTop: -DECK_SPAN / 2,
            transform: `translate3d(0px, ${deck.y}px, ${DECK_Z_CENTER}px) rotateX(${deck.tilt}deg)`,
            transformStyle: "preserve-3d",
            opacity: 0.2,
            backgroundImage: [
              `repeating-linear-gradient(90deg, ${palette.hud} 0 2px, rgba(0,0,0,0) 2px 520px)`,
              `repeating-linear-gradient(0deg, ${palette.hud} 0 2px, rgba(0,0,0,0) 2px 520px)`,
            ].join(","),
            // Fade the deck out at both the far edge and where it would
            // otherwise sweep past the lens.
            WebkitMaskImage:
              "linear-gradient(to bottom, rgba(0,0,0,0) 0%, rgba(0,0,0,1) 34%, rgba(0,0,0,1) 72%, rgba(0,0,0,0) 96%)",
            maskImage:
              "linear-gradient(to bottom, rgba(0,0,0,0) 0%, rgba(0,0,0,1) 34%, rgba(0,0,0,1) 72%, rgba(0,0,0,0) 96%)",
          }}
        />
      ))}
    </>
  );
};
