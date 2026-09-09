import React from "react";
import { AbsoluteFill, Easing, interpolate, useCurrentFrame, useVideoConfig } from "remotion";
import { BORDER_DRAW_END, DURATION_IN_FRAMES, GLOW_PERIOD } from "./constants";
import { Furniture } from "./Furniture";
import { offsetPolygon, toPath } from "./geometry";
import { buildLayout } from "./layout";
import { PALETTES, type PaletteName } from "./palette";

export type HudFrameProps = { palette: PaletteName };

export const HudFrame: React.FC<HudFrameProps> = ({ palette: paletteName }) => {
  const frame = useCurrentFrame();
  const { width, height } = useVideoConfig();
  const palette = PALETTES[paletteName];

  // Everything is a fraction of the composition size, so a 1080p preview and a
  // 4K render differ only in resolution.
  const hair = width * 0.0009;
  const stroke = width * 0.00115;
  const uid = `hud-${paletteName}`;

  const { frame: geo, elements } = buildLayout(width, height);
  const borderPath = toPath(geo.points);
  // The faint second line just inside the border is what gives the edge depth.
  const innerPath = toPath(offsetPolygon(geo.points, width * 0.006));

  const draw = interpolate(frame, [0, BORDER_DRAW_END], [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
    easing: Easing.inOut(Easing.cubic),
  });
  const drawInner = interpolate(frame, [10, BORDER_DRAW_END + 8], [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
    easing: Easing.inOut(Easing.cubic),
  });
  // The field comes up with the line rather than being there before it.
  const fieldIn = interpolate(frame, [0, 45], [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });

  // 600 / 120 = 5 whole breathing cycles, so the glow matches at the loop point.
  const breathe = 0.8 + 0.2 * Math.sin((2 * Math.PI * frame) / GLOW_PERIOD);

  const content = (
    <>
      <path
        d={innerPath}
        fill="none"
        stroke={palette.line}
        strokeWidth={hair * 0.8}
        strokeOpacity={0.42}
        pathLength={1}
        strokeDasharray={`${drawInner} 1`}
      />
      <path
        d={borderPath}
        fill="none"
        stroke={palette.line}
        strokeWidth={stroke}
        strokeLinejoin="miter"
        pathLength={1}
        strokeDasharray={`${draw} 1`}
      />
      <path
        d={borderPath}
        fill="none"
        stroke={palette.bright}
        strokeWidth={stroke * 0.42}
        strokeLinejoin="miter"
        pathLength={1}
        strokeDasharray={`${draw} 1`}
      />
      <Furniture elements={elements} ctx={{ frame, palette, hair, uid }} />
    </>
  );

  return (
    <AbsoluteFill style={{ backgroundColor: palette.surround }}>
      <svg
        viewBox={`0 0 ${width} ${height}`}
        width="100%"
        height="100%"
        style={{ display: "block" }}
      >
        <defs>
          <radialGradient id={`${uid}-interior`} cx="50%" cy="52%" r="70%">
            <stop offset="0" stopColor={palette.interior?.inner ?? "#000"} />
            <stop offset="1" stopColor={palette.interior?.outer ?? "#000"} />
          </radialGradient>
          <radialGradient id={`${uid}-vignette`} cx="50%" cy="50%" r="72%">
            <stop offset="0.55" stopColor="#000000" stopOpacity="0" />
            <stop offset="1" stopColor="#000000" stopOpacity="0.32" />
          </radialGradient>
          <filter
            id={`${uid}-bloom`}
            x="-20%"
            y="-20%"
            width="140%"
            height="140%"
            colorInterpolationFilters="sRGB"
          >
            <feGaussianBlur stdDeviation={width * 0.0012} result="tight" />
            <feGaussianBlur in="SourceGraphic" stdDeviation={width * 0.004} result="mid" />
            <feGaussianBlur in="SourceGraphic" stdDeviation={width * 0.013} result="wide" />
            <feMerge>
              <feMergeNode in="wide" />
              <feMergeNode in="mid" />
              <feMergeNode in="tight" />
              <feMergeNode in="tight" />
            </feMerge>
          </filter>
          <filter
            id={`${uid}-halo`}
            x="-30%"
            y="-30%"
            width="160%"
            height="160%"
            colorInterpolationFilters="sRGB"
          >
            <feGaussianBlur stdDeviation={width * 0.03} />
          </filter>
          <g id={`${uid}-content`}>{content}</g>
        </defs>

        {/* The surround is painted inside the SVG so the screen-blended bloom
            has a backdrop to blend against. */}
        <rect x="0" y="0" width={width} height={height} fill={palette.surround} />
        {palette.interior ? (
          <path d={borderPath} fill={`url(#${uid}-interior)`} opacity={fieldIn} />
        ) : null}

        {/* Bloom passes screen-blend under the crisp pass, so the line cores
            stay sharp while the halo bleeds outside the border. */}
        <use
          href={`#${uid}-content`}
          filter={`url(#${uid}-halo)`}
          opacity={breathe * 0.55}
          style={{ mixBlendMode: "screen" }}
        />
        <use
          href={`#${uid}-content`}
          filter={`url(#${uid}-bloom)`}
          opacity={breathe}
          style={{ mixBlendMode: "screen" }}
        />
        <use
          href={`#${uid}-content`}
          filter={`url(#${uid}-bloom)`}
          opacity={breathe * 0.6}
          style={{ mixBlendMode: "screen" }}
        />
        <use href={`#${uid}-content`} />

        {palette.vignette ? (
          <rect x="0" y="0" width={width} height={height} fill={`url(#${uid}-vignette)`} />
        ) : null}
      </svg>

      {/* Grain. On the overlay versions this is an overlay blend, which leaves
          0,0,0 exactly 0,0,0 so the untouched area vanishes under a screen
          blend; on the blue version it is a normal-blend dither against
          banding in the dark field. */}
      <AbsoluteFill style={{ mixBlendMode: palette.grain.blend, opacity: palette.grain.opacity }}>
        <svg width="100%" height="100%" viewBox={`0 0 ${width} ${height}`} style={{ display: "block" }}>
          <filter id={`${uid}-grain`} x="0" y="0" width="100%" height="100%">
            <feTurbulence
              type="fractalNoise"
              baseFrequency={0.5}
              numOctaves={1}
              seed={frame % DURATION_IN_FRAMES}
              stitchTiles="noStitch"
              result="noise"
            />
            <feColorMatrix type="saturate" values="0" />
            <feComponentTransfer>
              <feFuncR type="linear" slope="3" intercept="-1" />
              <feFuncG type="linear" slope="3" intercept="-1" />
              <feFuncB type="linear" slope="3" intercept="-1" />
              <feFuncA type="linear" slope="0" intercept="1" />
            </feComponentTransfer>
          </filter>
          <rect x="0" y="0" width={width} height={height} filter={`url(#${uid}-grain)`} />
        </svg>
      </AbsoluteFill>
    </AbsoluteFill>
  );
};
