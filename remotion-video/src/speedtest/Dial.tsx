import React from "react";
import {
  ARC_START,
  ARC_SWEEP,
  DialSpec,
  FONT_DISPLAY,
  FONT_MICRO,
  MicroLabel,
} from "./constants";
import { arcPath, needlePath, polar } from "./geometry";
import { useTheme } from "./theme";

export type DialProps = {
  spec: DialSpec;
  /** 0 = Min, 1 = Max. */
  value: number;
  /** 0..1 build-in: fades the dial up while drawing the arc on. */
  reveal: number;
};

/** One speedometer: arc, tick ring, hub, needle and its three labels. */
export const Dial: React.FC<DialProps> = ({ spec, value, reveal }) => {
  const theme = useTheme();
  const {
    cx,
    cy,
    radius,
    arcWidth,
    tickRadius,
    tickCount,
    tickInset,
    tickDot,
    caption,
    unit,
    ends,
  } = spec;

  const midRadius = radius - arcWidth / 2;
  const arcLength = (Math.PI / 180) * ARC_SWEEP * midRadius;
  const needleAngle = ARC_START + ARC_SWEEP * value;

  const ticks = Array.from({ length: tickCount }, (_, i) => {
    const t = i / (tickCount - 1);
    return ARC_START + tickInset + (ARC_SWEEP - tickInset * 2) * t;
  });

  const [minX, minY] = polar(cx, cy, ends.radius, ends.angle);
  const [maxX, maxY] = polar(cx, cy, ends.radius, 180 - ends.angle);

  const micro = (
    key: string,
    x: number,
    y: number,
    size: number,
    label: MicroLabel,
  ) => (
    <text
      key={key}
      x={x}
      y={y}
      fill={theme.micro}
      fontFamily={FONT_MICRO}
      fontWeight={600}
      fontSize={size}
      textAnchor="middle"
      dominantBaseline="middle"
      textLength={label.width}
      lengthAdjust="spacingAndGlyphs"
    >
      {label.text}
    </text>
  );

  return (
    <g opacity={reveal}>
      {/* The thick outer arc, drawn on during the build-in. */}
      <path
        d={arcPath(cx, cy, midRadius, ARC_START, ARC_SWEEP)}
        fill="none"
        stroke={theme.accent}
        strokeWidth={arcWidth}
        strokeLinecap="round"
        strokeDasharray={arcLength}
        strokeDashoffset={arcLength * (1 - reveal)}
      />

      {ticks.map((deg, i) => {
        const [tx, ty] = polar(cx, cy, tickRadius, deg);
        return <circle key={i} cx={tx} cy={ty} r={tickDot} fill={theme.tick} />;
      })}

      {spec.innerRing > 0 ? (
        <circle
          cx={cx}
          cy={cy}
          r={spec.innerRing}
          fill="none"
          stroke={theme.tick}
          strokeWidth={0.5}
          opacity={0.55}
        />
      ) : null}

      {/* Needle: a disc at the hub with a tapered blade sweeping out of it. */}
      <g transform={`translate(${cx} ${cy}) rotate(${needleAngle})`}>
        <path
          d={needlePath(spec.needleBase, spec.needleLength, spec.needleTip)}
          fill={theme.accent}
        />
        <circle cx={0} cy={0} r={spec.hubRadius} fill={theme.accent} />
      </g>

      {micro("min", minX, minY, ends.size, ends.min)}
      {micro("max", maxX, maxY, ends.size, ends.max)}
      {micro("unit", cx, cy + unit.dy, unit.size, unit)}

      {/*
        textLength pins the caption to its measured width, so the letter
        spacing stays on design no matter how the font rounds at a given size.
      */}
      <text
        x={cx}
        y={caption.y}
        fill={theme.accent}
        fontFamily={FONT_DISPLAY}
        fontWeight={600}
        fontSize={caption.size}
        textAnchor="middle"
        textLength={caption.width}
        lengthAdjust="spacing"
      >
        {caption.text}
      </text>
    </g>
  );
};
