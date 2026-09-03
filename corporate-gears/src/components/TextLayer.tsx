import React from "react";
import { LABELS, CENTRE_SIZE } from "../layout";
import type { Theme } from "../theme";
import { SoftShadow } from "./defs";

const FONT = "'Work Sans', 'Helvetica Neue', Arial, sans-serif";

/**
 * Static type. No fades, no tracking animation — a background is only usable
 * under a client's own titles if its own words hold rock steady.
 */
export const TextLayer: React.FC<{
  centreWord: string;
  labels?: string[];
  w: number;
  h: number;
  u: number;
  theme: Theme;
}> = ({ centreWord, labels, w, h, u, theme }) => {
  const centreSize = CENTRE_SIZE * u;
  const centreTracking = centreSize * 0.07;
  const labelTracking = 0.16;

  return (
    <>
      <defs>
        <SoftShadow
          id="textShadow"
          dx={u * 0.004}
          dy={u * 0.006}
          blur={u * 0.006}
          color={theme.shadow}
          opacity={0.3}
        />
      </defs>
      <g fill={theme.text} filter="url(#textShadow)" fontFamily={FONT} fontWeight={700}>
        <text
          x={w / 2}
          y={h / 2}
          textAnchor="middle"
          dominantBaseline="central"
          fontSize={centreSize}
          letterSpacing={centreTracking}
          // SVG letter-spacing also trails the last glyph; shift back by half
          // so the word stays optically dead centre.
          transform={`translate(${-centreTracking / 2} 0)`}
        >
          {centreWord}
        </text>
        {LABELS.map((label, i) => {
          const size = centreSize * label.scale;
          const tracking = size * labelTracking;
          return (
            <text
              key={label.text}
              x={label.x * w}
              y={label.y * h}
              textAnchor="middle"
              dominantBaseline="central"
              fontSize={size}
              letterSpacing={tracking}
              transform={`translate(${-tracking / 2} 0)`}
            >
              {labels?.[i] ?? label.text}
            </text>
          );
        })}
      </g>
    </>
  );
};
