import React from "react";
import { PALETTE } from "./constants";

// ---------------------------------------------------------------------------
// Shared gradients and glow filters.
//
// Glow is built from a STACK of three feGaussianBlurs at roughly 1 : 4 : 12
// with falling opacity, merged under an untouched SourceGraphic. A single
// blur gives a flat halo; the stack gives a hot centre with a wide soft
// falloff that reads as light.
//
// The stack is deliberately NOT applied to everything. Only the core disc
// gets the wide, blown-out version — the traces get a tight one so they stay
// crisp lines with light spreading off them, and the panel furniture gets
// almost nothing. Letting the whole network glow is what turns a piece like
// this into a blue smear.
//
// These live in one hidden <svg> because SVG filter references resolve
// document-wide, so every layer can point at the same definitions.
// ---------------------------------------------------------------------------

const alphaMatrix = (k: number) =>
  `1 0 0 0 0  0 1 0 0 0  0 0 1 0 0  0 0 0 ${k} 0`;

const GlowStack: React.FC<{
  id: string;
  radii: [number, number, number];
  alphas: [number, number, number];
  /**
   * Percent the filter surface extends past the element bbox on each side.
   * Keep this just above 3x the largest stdDeviation, measured against the
   * bbox of whatever the filter is applied to. Oversizing it is the single
   * most expensive mistake available here: the cost is the SQUARE of this
   * number, and none of the extra area contains anything.
   */
  region?: number;
}> = ({ id, radii, alphas, region = 40 }) => (
  <filter
    id={id}
    x={`${-region}%`}
    y={`${-region}%`}
    width={`${region * 2 + 100}%`}
    height={`${region * 2 + 100}%`}
    colorInterpolationFilters="sRGB"
  >
    <feGaussianBlur in="SourceGraphic" stdDeviation={radii[0]} result="b0" />
    <feGaussianBlur in="SourceGraphic" stdDeviation={radii[1]} result="b1" />
    <feGaussianBlur in="SourceGraphic" stdDeviation={radii[2]} result="b2" />
    <feColorMatrix in="b0" type="matrix" values={alphaMatrix(alphas[0])} result="g0" />
    <feColorMatrix in="b1" type="matrix" values={alphaMatrix(alphas[1])} result="g1" />
    <feColorMatrix in="b2" type="matrix" values={alphaMatrix(alphas[2])} result="g2" />
    <feMerge>
      <feMergeNode in="g2" />
      <feMergeNode in="g1" />
      <feMergeNode in="g0" />
      <feMergeNode in="SourceGraphic" />
    </feMerge>
  </filter>
);

export const Defs: React.FC = () => (
  <svg
    width={0}
    height={0}
    style={{ position: "absolute", width: 0, height: 0, overflow: "hidden" }}
    aria-hidden
  >
    <defs>
      {/* The core: wide and hot. The only genuinely blown-out thing in frame. */}
      <GlowStack id="glowCore" radii={[9, 40, 155]} alphas={[1, 0.88, 0.8]} region={72} />
      {/* Traces: a tight stack so the line itself stays a crisp 1px-at-1080p run. */}
      <GlowStack id="glowTrace" radii={[2.5, 9, 26]} alphas={[0.6, 0.26, 0.12]} region={15} />
      {/* Icons and gauges: barely more than a lift off the background. */}
      <GlowStack id="glowSoft" radii={[2, 7, 20]} alphas={[0.42, 0.18, 0.07]} region={20} />

      <radialGradient id="coreFillGrad" cx="42%" cy="34%" r="80%">
        <stop offset="0%" stopColor="#FFFFFF" />
        <stop offset="20%" stopColor={PALETTE.coreHot} />
        <stop offset="46%" stopColor="#62E3FB" />
        <stop offset="76%" stopColor={PALETTE.coreFill} />
        <stop offset="100%" stopColor="#0894C6" />
      </radialGradient>

      {/*
        A dedicated bloom sitting just outside the disc. The glow stack alone
        spreads the disc's own light, but the disc is a small part of the
        filtered group's area, so the halo came out weak. This gives the stack
        something bright to spread and is what makes the core read as a light
        source rather than a flat ball.
      */}
      <radialGradient id="coreBloomGrad" cx="50%" cy="50%" r="50%">
        <stop offset="0%" stopColor="#CFF7FF" stopOpacity={0.62} />
        <stop offset="58%" stopColor="#8AE9FF" stopOpacity={0.42} />
        <stop offset="82%" stopColor="#3EC8F2" stopOpacity={0.14} />
        <stop offset="100%" stopColor="#1C9AD0" stopOpacity={0} />
      </radialGradient>

      {/*
        The luminous platform the disc sits on. In the reference the core does
        not read as a lone bright circle — the disc plus its platform form one
        continuous glowing mass roughly 1.7x the disc radius, and that is most
        of why the core holds the frame. A thin bright ring alone does not do
        it, so this is a filled falloff rather than a stroke.
      */}
      <radialGradient id="coreMassGrad" cx="50%" cy="50%" r="50%">
        <stop offset="0%" stopColor="#46D8F8" stopOpacity={0.85} />
        <stop offset="52%" stopColor="#2BAEE0" stopOpacity={0.5} />
        <stop offset="76%" stopColor="#1583B8" stopOpacity={0.22} />
        <stop offset="100%" stopColor="#0B4E77" stopOpacity={0} />
      </radialGradient>

      <radialGradient id="corePlatformGrad" cx="50%" cy="50%" r="50%">
        <stop offset="58%" stopColor="#0B3E63" stopOpacity={0} />
        <stop offset="80%" stopColor="#2FA6D4" stopOpacity={0.5} />
        <stop offset="100%" stopColor="#0A3555" stopOpacity={0} />
      </radialGradient>

      <linearGradient id="panelGrad" x1="0" y1="0" x2="0" y2="1">
        <stop offset="0%" stopColor="#0D4B7A" stopOpacity={0.5} />
        <stop offset="100%" stopColor="#061F3A" stopOpacity={0.14} />
      </linearGradient>

      {/*
        Bokeh is blurred PER DISC rather than by blurring the whole layer.
        A CSS blur on a full-frame layer costs frame-area work every frame;
        thirty small filter surfaces cost a fraction of it and look the same.
      */}
      <filter
        id="bokehFront"
        x="-110%"
        y="-110%"
        width="320%"
        height="320%"
        colorInterpolationFilters="sRGB"
      >
        <feGaussianBlur stdDeviation={50} />
      </filter>
      <filter
        id="bokehBack"
        x="-160%"
        y="-160%"
        width="420%"
        height="420%"
        colorInterpolationFilters="sRGB"
      >
        <feGaussianBlur stdDeviation={19} />
      </filter>

      <radialGradient id="bokehGrad">
        <stop offset="0%" stopColor="#FFFFFF" stopOpacity={0.95} />
        <stop offset="58%" stopColor="#FFFFFF" stopOpacity={0.5} />
        <stop offset="100%" stopColor="#FFFFFF" stopOpacity={0} />
      </radialGradient>
    </defs>
  </svg>
);
