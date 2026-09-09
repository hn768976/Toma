import React from "react";
import { AbsoluteFill, useCurrentFrame, useVideoConfig } from "remotion";
import { grade, hexToRgb, makeRamp, toCss } from "./color";
import { makePill } from "./pill";
import type { Theme } from "./theme";

/* ------------------------------------------------------------------ *
 * Motion constants. Every one of these divides evenly into the 600
 * frame composition, so the clip loops without a seam.
 * ------------------------------------------------------------------ */

/** Laps the travelling highlight makes over the full 600 frames. */
const LAPS = 3;
/** Frames per cycle of the border's overall "breathing". 600 / 150 = 4. */
const BREATH_PERIOD = 150;
const BREATH_DEPTH = 0.07;

/** Border segments. 720 puts the chord error on the caps below 0.02px at 4K. */
const CORE_SEGMENTS = 720;
/** The glow is blurred anyway, so it can be sampled far more coarsely. */
const GLOW_SEGMENTS = 120;

/** Fraction of the border's brightness that survives away from the highlight. */
const FLOOR = 0.14;
/** At the highlight's peak the border reads as *lit*, not merely coloured.
 *  The reference gets there by driving the hue's brightest channel to full
 *  rather than by blowing the core out to white, so GAIN scales the colour up
 *  (grading clamps it) and HOT adds only a trace of white on top. */
const GAIN = 0.14;
const HOT = 0.1;
/** Falloff exponent of the highlight envelope. 2.4 puts the half-bright band
 *  at roughly a quarter of the perimeter, with shoulders soft enough that the
 *  lit run never reads as a moving dot. */
const FALLOFF = 2.4;

/** Geometry, as fractions of the frame — so a 1080p preview and a 4K render
 *  are the same picture. */
const PILL_W = 0.52;
const PILL_H = 0.16;

export type GradientButtonProps = {
  theme: Theme;
  /** Namespaces the SVG filter/gradient ids so several versions can coexist. */
  uid: string;
};

/**
 * Soft, periodic brightness envelope for the travelling highlight.
 * `d` is signed distance along the perimeter in turns; the result peaks at 1
 * when the highlight sits exactly on the sample and decays smoothly both ways.
 */
const envelope = (d: number): number => {
  const w = ((d % 1) + 1) % 1;
  return (0.5 + 0.5 * Math.cos(2 * Math.PI * w)) ** FALLOFF;
};

export const GradientButton: React.FC<GradientButtonProps> = ({
  theme,
  uid,
}) => {
  const frame = useCurrentFrame();
  const { width, height, durationInFrames } = useVideoConfig();

  /** "3px at 4K" and friends, expressed so they hold at any render scale. */
  const px = (v: number) => (v * height) / 2160;

  const cx = width / 2;
  const cy = height / 2;
  const pillW = width * PILL_W;
  const pillH = height * PILL_H;
  const pill = makePill(cx, cy, pillW, pillH);

  const cycle = frame / durationInFrames;
  const head = cycle * LAPS; // highlight position, in turns
  const breath =
    1 + BREATH_DEPTH * Math.sin((2 * Math.PI * frame) / BREATH_PERIOD);

  const ramp = makeRamp(theme.stops);
  const dim = hexToRgb(theme.dim);

  /** Colour + intensity of the border at perimeter position `t`. */
  const sample = (t: number) => {
    const e = envelope(t - head);
    const level =
      Math.min(1, (FLOOR + (1 - FLOOR) * e) * breath) * (1 + GAIN * e ** 3);
    const base = ramp(t);
    const hot = HOT * e ** 4;
    const core = base.map((c) => c + (1 - c) * hot) as typeof base;
    return {
      e,
      stroke: grade(core, 0.35 + 0.65 * e, level, dim),
      lit: toCss(base),
    };
  };

  const buildSegments = (count: number, glow: boolean) => {
    const out: React.ReactElement[] = [];
    for (let i = 0; i < count; i += 1) {
      const t0 = i / count;
      const t1 = (i + 1) / count;
      const a = pill.pointAt(t0);
      const b = pill.pointAt(t1);
      const s = sample((t0 + t1) / 2);
      // The glow only exists where light is falling; elsewhere it would just
      // fog the black field.
      const opacity = glow ? s.e * breath * theme.glowStrength : 1;
      if (glow && opacity < 0.004) {
        continue;
      }
      out.push(
        <line
          key={i}
          x1={a.x}
          y1={a.y}
          x2={b.x}
          y2={b.y}
          stroke={glow ? s.lit : s.stroke}
          strokeOpacity={opacity}
          strokeLinecap="round"
        />,
      );
    }
    return out;
  };

  const core = buildSegments(CORE_SEGMENTS, false);
  const glow = buildSegments(GLOW_SEGMENTS, true);

  const id = (name: string) => `${uid}-${name}`;
  const pillRect = {
    x: cx - pillW / 2,
    y: cy - pillH / 2,
    width: pillW,
    height: pillH,
    rx: pill.r,
    ry: pill.r,
  };

  return (
    <AbsoluteFill style={{ backgroundColor: theme.background }}>
      <svg
        width={width}
        height={height}
        viewBox={`0 0 ${width} ${height}`}
        shapeRendering="geometricPrecision"
        style={{ display: "block", isolation: "isolate" }}
      >
        <defs>
          <linearGradient id={id("body")} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0" stopColor={theme.bodyTop} />
            <stop offset="1" stopColor={theme.bodyBottom} />
          </linearGradient>

          {/* Two glow passes: one tight enough to read as a lit edge, one
              wider and much fainter for falloff. Neither reaches far from the
              shape — a wide bloom would make this look like neon signage
              rather than a UI element. */}
          <filter
            id={id("glowCore")}
            x="-25%"
            y="-90%"
            width="150%"
            height="280%"
            colorInterpolationFilters="sRGB"
          >
            <feGaussianBlur stdDeviation={px(3.5)} />
          </filter>
          <filter
            id={id("glowTight")}
            x="-25%"
            y="-90%"
            width="150%"
            height="280%"
            colorInterpolationFilters="sRGB"
          >
            <feGaussianBlur stdDeviation={px(10)} />
          </filter>
          <filter
            id={id("glowWide")}
            x="-25%"
            y="-90%"
            width="150%"
            height="280%"
            colorInterpolationFilters="sRGB"
          >
            <feGaussianBlur stdDeviation={px(30)} />
          </filter>

          <filter
            id={id("innerShadow")}
            x="-20%"
            y="-40%"
            width="140%"
            height="180%"
            colorInterpolationFilters="sRGB"
          >
            <feGaussianBlur stdDeviation={px(13) * theme.innerShadowScale} />
          </filter>

          <clipPath id={id("clip")}>
            <rect {...pillRect} />
          </clipPath>

          {/* Tiled, stitched turbulence. A 512px tile keeps the filter cheap
              at 4K; `seed` advances per frame so the grain animates. */}
          <filter
            id={id("noise")}
            x="0"
            y="0"
            width="512"
            height="512"
            filterUnits="userSpaceOnUse"
            colorInterpolationFilters="sRGB"
          >
            <feTurbulence
              type="fractalNoise"
              baseFrequency="0.75"
              numOctaves={2}
              seed={frame % durationInFrames}
              stitchTiles="stitch"
            />
            <feColorMatrix type="saturate" values="0" />
          </filter>
          <pattern
            id={id("grain")}
            width="512"
            height="512"
            patternUnits="userSpaceOnUse"
          >
            <rect width="512" height="512" filter={`url(#${id("noise")})`} />
          </pattern>
        </defs>

        {/* --- outer glow, in the border's local colour --- */}
        <g style={{ mixBlendMode: theme.glowBlend }}>
          <g
            filter={`url(#${id("glowWide")})`}
            strokeWidth={px(20)}
            opacity={0.4}
          >
            {glow}
          </g>
          <g
            filter={`url(#${id("glowTight")})`}
            strokeWidth={px(10)}
            opacity={0.85}
          >
            {glow}
          </g>
          <g
            filter={`url(#${id("glowCore")})`}
            strokeWidth={px(5)}
            opacity={1}
          >
            {glow}
          </g>
        </g>

        {/* --- pill body: opaque, so the glow only ever reads outside --- */}
        <rect {...pillRect} fill={`url(#${id("body")})`} />

        {/* --- inner shadow, which is all the depth this shape needs --- */}
        <g clipPath={`url(#${id("clip")})`}>
          <rect
            {...pillRect}
            fill="none"
            stroke={theme.innerShadow}
            strokeWidth={px(26) * theme.innerShadowScale}
            opacity={theme.innerShadowOpacity}
            filter={`url(#${id("innerShadow")})`}
          />
        </g>

        {/* --- always-on hairline, then the graded border on top --- */}
        <rect
          {...pillRect}
          fill="none"
          stroke={theme.rim}
          strokeWidth={px(3)}
        />
        <g strokeWidth={px(3)}>{core}</g>

        {/* --- grain, last, over everything --- */}
        <rect
          width={width}
          height={height}
          fill={`url(#${id("grain")})`}
          opacity={theme.grain.opacity}
          style={{ mixBlendMode: theme.grain.blend }}
        />
      </svg>
    </AbsoluteFill>
  );
};
