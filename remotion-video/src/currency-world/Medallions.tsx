import React, { useMemo } from "react";
import { CURRENCY_GLYPHS, MEDALLION_COUNT, SPREAD_X, SPREAD_Y, Z_SPAN } from "./constants";
import { defocusAt, depthAt, depthFade, place } from "./depth";
import { DISPLAY_FONT } from "./fonts";
import type { Palette } from "./palette";
import { between, pick, rngFor } from "./random";

type Medallion = {
  x: number;
  y: number;
  z0: number;
  size: number;
  glyph: string;
  /** Second, dashed ring — roughly a third of them carry one. */
  dashed: boolean;
  spin: number;
  phase: number;
  weight: number;
};

const buildMedallions = (): Medallion[] =>
  Array.from({ length: MEDALLION_COUNT }, (_, i) => {
    const rand = rngFor(i, 401);
    return {
      x: between(rand, -SPREAD_X, SPREAD_X),
      y: between(rand, -SPREAD_Y, SPREAD_Y),
      z0: rand() * Z_SPAN,
      size: between(rand, 190, 430),
      glyph: pick(rand, CURRENCY_GLYPHS),
      dashed: rand() < 0.34,
      spin: between(rand, -14, 14),
      phase: rand() * Math.PI * 2,
      weight: between(rand, 0.55, 1),
    };
  });

/**
 * The currency tokens: a ringed glyph, billboarded to the lens. Size is
 * assigned in world units, so a token's apparent size comes entirely
 * from its depth — nothing is faked with a 2D scale.
 */
export const Medallions: React.FC<{
  palette: Palette;
  camZ: number;
  seconds: number;
}> = ({ palette, camZ, seconds }) => {
  const medallions = useMemo(buildMedallions, []);

  return (
    <>
      {medallions.map((m, i) => {
        const z = depthAt(m.z0, camZ);
        const fade = depthFade(z);
        if (fade <= 0.004) return null;
        const blur = defocusAt(z);
        // Slow individual breathe, so the field never looks frozen
        // between the camera's own movement.
        const pulse = 0.82 + 0.18 * Math.sin(seconds * 0.9 + m.phase);

        return (
          <div
            key={i}
            style={{
              position: "absolute",
              left: 0,
              top: 0,
              width: m.size,
              height: m.size,
              marginLeft: -m.size / 2,
              marginTop: -m.size / 2,
              transform: `${place(m.x, m.y, z)} rotateZ(${m.spin.toFixed(2)}deg)`,
              opacity: fade * m.weight * pulse,
              filter: blur > 0 ? `blur(${blur.toFixed(2)}px)` : undefined,
              background: `radial-gradient(circle at 50% 50%, ${palette.ringGlow} 0%, rgba(0,0,0,0) 58%)`,
              borderRadius: "50%",
            }}
          >
            <svg viewBox="0 0 100 100" width="100%" height="100%">
              <circle
                cx="50"
                cy="50"
                r="45"
                fill="none"
                stroke={palette.ring}
                strokeWidth="1.6"
              />
              {m.dashed ? (
                <circle
                  cx="50"
                  cy="50"
                  r="39"
                  fill="none"
                  stroke={palette.ring}
                  strokeWidth="0.9"
                  strokeDasharray="3 4"
                  opacity="0.6"
                />
              ) : null}
              <text
                x="50"
                y="51"
                textAnchor="middle"
                dominantBaseline="central"
                fill={palette.glyph}
                fontFamily={`"${DISPLAY_FONT}", sans-serif`}
                fontSize="52"
              >
                {m.glyph}
              </text>
            </svg>
          </div>
        );
      })}
    </>
  );
};
