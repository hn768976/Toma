import React from "react";
import { AbsoluteFill, useCurrentFrame, useVideoConfig } from "remotion";
import { lf, wave } from "./loop";
import { MONO, SANS } from "./fonts";

/**
 * Resolution independence
 * -----------------------
 * Every look is drawn inside ONE <svg> whose viewBox is a fixed 1920 x 1080
 * "design grid", stretched to the composition size from useVideoConfig().
 * So every coordinate, font size, stroke and border width is a fraction of
 * the frame: a 1-unit hairline is 1 px at 1920x1080, 2 px at 3840x2160 and
 * 3.125 px at 6000x3375. Nothing is specified in device pixels.
 */
export const W = 1920;
export const H = 1080;

/** Device pixels per design unit (exposed for anything that needs it). */
export const useUnit = () => {
  const { width } = useVideoConfig();
  return width / W;
};

type StageProps = {
  bg: string;
  children: React.ReactNode;
  /** Camera drift amplitude in design units (closed Lissajous path). 0 = fixed. */
  drift?: number;
  /** Grain amplitude as std-dev of the result (0.015 = 1.5 %). 0 = none. */
  grain?: number;
  /** Rendered under the camera transform, before children (backgrounds). */
  backdrop?: React.ReactNode;
};

/**
 * Glow: three stacked Gaussian blurs with radii 1 : 4 : 12, each fainter
 * than the last, merged under the sharp source. `k` scales the radii,
 * `a` the halo strength.
 */
const GlowFilter: React.FC<{ id: string; k: number; a: number }> = ({ id, k, a }) => (
  <filter
    id={id}
    filterUnits="userSpaceOnUse"
    x={-200}
    y={-200}
    width={W + 400}
    height={H + 400}
    colorInterpolationFilters="sRGB"
  >
    <feGaussianBlur in="SourceGraphic" stdDeviation={1 * k} result="b1" />
    <feGaussianBlur in="SourceGraphic" stdDeviation={4 * k} result="b2" />
    <feGaussianBlur in="SourceGraphic" stdDeviation={12 * k} result="b3" />
    <feColorMatrix in="b1" type="matrix" values={`1 0 0 0 0 0 1 0 0 0 0 0 1 0 0 0 0 0 ${0.55 * a} 0`} result="g1" />
    <feColorMatrix in="b2" type="matrix" values={`1 0 0 0 0 0 1 0 0 0 0 0 1 0 0 0 0 0 ${0.35 * a} 0`} result="g2" />
    <feColorMatrix in="b3" type="matrix" values={`1 0 0 0 0 0 1 0 0 0 0 0 1 0 0 0 0 0 ${0.2 * a} 0`} result="g3" />
    <feMerge>
      <feMergeNode in="g3" />
      <feMergeNode in="g2" />
      <feMergeNode in="g1" />
      <feMergeNode in="SourceGraphic" />
    </feMerge>
  </filter>
);

export const GLOW_SOFT = "url(#glow-soft)";
export const GLOW = "url(#glow)";
export const GLOW_STRONG = "url(#glow-strong)";

export const Stage: React.FC<StageProps> = ({ bg, children, drift = 0, grain = 0, backdrop }) => {
  const frame = useCurrentFrame();
  const { width, height } = useVideoConfig();

  // Closed camera path: x completes 1 cycle, y completes 2 cycles per loop.
  // The background is a flat fill outside the camera group, so no
  // overscale is needed; layouts keep a margin larger than `drift`.
  const dx = drift * wave(frame, 1);
  const dy = drift * 0.6 * wave(frame, 2, 0.25);
  const cam = drift > 0 ? `translate(${dx.toFixed(3)} ${dy.toFixed(3)})` : undefined;

  // Grain: feTurbulence with a fixed seed per loop frame. seed = frame % 600,
  // so frame 600 reuses frame 0's noise exactly. Drawn as a separate
  // overlay rect on top of the scene: white where noise > 0.5 and black
  // where noise < 0.5, alpha proportional to |noise - 0.5|. (Routing the
  // whole scene through an arithmetic-composite filter was ~40 % slower.)
  const seed = lf(frame);

  return (
    <AbsoluteFill style={{ backgroundColor: bg }}>
      {/* key={frame}: remount every frame so Chrome repaints the whole SVG
          from scratch. Without it, partial-repaint invalidation can leave a
          1-2 level anti-aliasing residue from the previously rendered frame
          in the same tab, so a frame would depend on render order. */}
      <svg
        key={frame}
        width={width}
        height={height}
        viewBox={`0 0 ${W} ${H}`}
        style={{ display: "block", textRendering: "geometricPrecision", fontFamily: SANS }}
      >
        <defs>
          <GlowFilter id="glow-soft" k={0.6} a={0.6} />
          <GlowFilter id="glow" k={1} a={1} />
          <GlowFilter id="glow-strong" k={1.4} a={1.5} />
          {grain > 0 ? (
            <filter
              id="grain"
              filterUnits="userSpaceOnUse"
              x={0}
              y={0}
              width={W}
              height={H}
              colorInterpolationFilters="sRGB"
            >
              <feTurbulence type="fractalNoise" baseFrequency={0.9} numOctaves={1} seed={seed} result="n" />
              {/* white where noise > 0.5, black where < 0.5, alpha proportional */}
              <feColorMatrix in="n" type="matrix" values={`0 0 0 0 1 0 0 0 0 1 0 0 0 0 1 ${2 * grain * GRAIN_GAIN} 0 0 0 ${-grain * GRAIN_GAIN}`} result="w" />
              <feColorMatrix in="n" type="matrix" values={`0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 ${-2 * grain * GRAIN_GAIN} 0 0 0 ${grain * GRAIN_GAIN}`} result="b" />
              <feMerge>
                <feMergeNode in="b" />
                <feMergeNode in="w" />
              </feMerge>
            </filter>
          ) : null}
        </defs>
        <rect x={0} y={0} width={W} height={H} fill={bg} />
        <g transform={cam}>
          {backdrop}
          {children}
        </g>
        {grain > 0 ? <rect x={0} y={0} width={W} height={H} fill="#808080" filter="url(#grain)" /> : null}
      </svg>
    </AbsoluteFill>
  );
};

// fractalNoise values cluster around 0.5 with a small spread; this gain
// stretches them so `grain` is the measured std-dev of the result
// (grain = 0.015 measures ~3.7 code values, ~1.5 %; see README).
export const GRAIN_GAIN = 8;

/** Common text style: tabular figures everywhere so changing digits never jitter. */
export const textStyle = (mono: boolean): React.CSSProperties => ({
  fontFamily: mono ? MONO : SANS,
  fontVariantNumeric: "tabular-nums",
  // tnum on; ligatures off so code like "->" and "!=" stays literal
  fontVariantLigatures: "none",
  fontFeatureSettings: '"tnum" 1, "liga" 0, "calt" 0',
});
