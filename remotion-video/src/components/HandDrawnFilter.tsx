import React from "react";

// A shared SVG filter that gives strokes a subtle hand-drawn wobble.
// Mount once at the root of the composition, then apply
// `style={{ filter: "url(#hand-drawn)" }}` to any element to sketch-ify it.
export const HAND_DRAWN_FILTER_ID = "hand-drawn";

export const HandDrawnFilter: React.FC = () => {
  return (
    <svg width={0} height={0} style={{ position: "absolute" }}>
      <defs>
        <filter
          id={HAND_DRAWN_FILTER_ID}
          x="-20%"
          y="-20%"
          width="140%"
          height="140%"
        >
          <feTurbulence
            type="fractalNoise"
            baseFrequency="0.012 0.018"
            numOctaves={2}
            seed={7}
            result="noise"
          />
          <feDisplacementMap
            in="SourceGraphic"
            in2="noise"
            scale={6}
            xChannelSelector="R"
            yChannelSelector="G"
          />
        </filter>
      </defs>
    </svg>
  );
};
