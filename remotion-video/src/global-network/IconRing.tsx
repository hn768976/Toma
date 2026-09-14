import React from "react";
import { interpolate, Easing } from "remotion";
import {
  CENTER_X,
  CENTER_Y,
  GLOBE_RADIUS,
  ICON_ORBIT_PERIOD,
  type Palette,
} from "./constants";
import { ICONS, type IconPlacement } from "./scene-data";
import { IconGlyph } from "./icons";

// Glyphs are authored in a 0..24 box; this maps that box onto the
// placement's size in viewBox units, centred on the icon's position.
const GLYPH_BOX = 24;

const POP_FRAMES = 13;

const Icon: React.FC<{
  placement: IconPlacement;
  palette: Palette;
  frame: number;
  orbit: number;
}> = ({ placement, palette, frame, orbit }) => {
  const age = frame - placement.appearFrame;
  if (age < 0) {
    return null;
  }

  const pop = interpolate(age, [0, POP_FRAMES], [0, 1], {
    extrapolateRight: "clamp",
    easing: Easing.out(Easing.back(1.7)),
  });
  const fade = interpolate(age, [0, POP_FRAMES * 0.7], [0, 1], {
    extrapolateRight: "clamp",
  });
  // A slow individual shimmer so the ring never sits perfectly still.
  const shimmer =
    0.82 + 0.18 * Math.sin((frame / 88 + placement.phase) * Math.PI * 2);

  const angle = placement.angle + orbit;
  // Each icon also eases in and out along its own radius slightly, which
  // breaks up the "everything pinned to one circle" look.
  const radius =
    placement.radius +
    9 * Math.sin((frame / 131 + placement.phase) * Math.PI * 2);

  const cos = Math.cos(angle);
  const sin = Math.sin(angle);
  const x = CENTER_X + cos * radius;
  const y = CENTER_Y + sin * radius;

  const lineFromR = GLOBE_RADIUS * placement.lineStart;
  const lineToR = radius - placement.size * 0.62;

  const color = palette.icons[placement.colorIndex % palette.icons.length];
  const glyphScale = placement.size / GLYPH_BOX;
  const scale = glyphScale * pop;
  // Stroke widths are pre-divided by the glyph scale so every icon ends
  // up with the same on-screen line weight regardless of its box size.
  const hairline = 1.6 / glyphScale;
  const bleed = 3.8 / glyphScale;

  return (
    <g opacity={fade * shimmer}>
      {/* Leader line back to the globe rim. */}
      <line
        x1={CENTER_X + cos * lineFromR}
        y1={CENTER_Y + sin * lineFromR}
        x2={CENTER_X + cos * lineToR}
        y2={CENTER_Y + sin * lineToR}
        stroke={color}
        strokeWidth={1.1}
        opacity={0.46 * pop}
      />
      {/* Glyphs stay upright as the ring turns — rotating them with the
          orbit would put half the icons on their heads. */}
      <g
        transform={`translate(${x} ${y}) scale(${scale}) translate(${-GLYPH_BOX / 2} ${-GLYPH_BOX / 2})`}
        fill="none"
        strokeLinecap="round"
        strokeLinejoin="round"
      >
        {/* Neon bleed pass, then the crisp glyph over it. Cheaper than a
            real blur filter on 26 separate groups. */}
        <g stroke={color} strokeWidth={bleed} opacity={0.28}>
          <IconGlyph name={placement.name} />
        </g>
        <g stroke={color} strokeWidth={hairline}>
          <IconGlyph name={placement.name} />
        </g>
      </g>
    </g>
  );
};

export const IconRing: React.FC<{ palette: Palette; frame: number }> = ({
  palette,
  frame,
}) => {
  const orbit = (frame / ICON_ORBIT_PERIOD) * Math.PI * 2;
  return (
    <g>
      {ICONS.map((placement, i) => (
        <Icon
          key={i}
          placement={placement}
          palette={palette}
          frame={frame}
          orbit={orbit}
        />
      ))}
    </g>
  );
};
