import React from 'react';
import {AbsoluteFill, useCurrentFrame, useVideoConfig} from 'remotion';
import {pathBounds, type Bounds} from './path-bounds';
import {motionAt, twinkleAt} from './motion';
import {SIGN_BY_NAME, type Sign} from './zodiac-data';

/**
 * An overlay plate, not a finished shot: gold on pure black, meant to be
 * screen-blended over the buyer's own footage. Nothing outside the artwork is
 * ever lifted off 0,0,0 - there is no vignette, and the grain is multiplied
 * into the glyph rather than laid over the frame, so the surround stays exactly
 * black through the encode.
 */

export type ZodiacSymbolProps = {
  /** Which of the twelve. Looked up in the single data file. */
  sign: string;
  /**
   * Alternate palette. Shadow -> midtone -> specular, in that order. The
   * default is the gold in the brief.
   */
  metal?: [string, string, string];
  /** Edge colour, drawn just under the metal so it does not bleed into black. */
  edgeColor?: string;
  /** Star and hairline colour for the constellation behind the glyph. */
  constellationColor?: string;
  /** Set false to render the glyph alone. */
  showConstellation?: boolean;
};

/** The gold in the brief: deep bronze -> gold -> near-white specular. */
const GOLD: [string, string, string] = ['#8a5a10', '#e0a828', '#fff0c0'];

/**
 * Glyph height as a fraction of frame height, before the per-sign correction.
 * Height, not the longer side: the wide signs are supposed to spread sideways.
 */
const GLYPH_FRACTION = 0.45;

/**
 * Constellation box, as fractions of frame height. Slightly larger than the
 * glyph, and width-capped so the sprawling constellations stay contained.
 */
const CONSTELLATION_HEIGHT_FRACTION = 0.58;
const CONSTELLATION_MAX_WIDTH_FRACTION = 0.85;

/** Metal stroke weight as a fraction of frame height. */
const STROKE_FRACTION = 0.019;

/** The specular band runs on this diagonal. */
const HIGHLIGHT_ANGLE_DEG = 35;

/** How much of the yaw the constellation takes, for a little parallax. */
const CONSTELLATION_YAW_RATIO = 0.55;

const clamp = (v: number, lo: number, hi: number) =>
  Math.min(hi, Math.max(lo, v));

/**
 * Fit the glyph's own ink into a viewBox of the right aspect, so every sign is
 * framed from what it actually draws rather than from wherever it happens to
 * sit on the authoring grid.
 *
 * The stroke sticks out past the geometry, and its width in grid units depends
 * on the scale, which depends on the padding, which depends on the stroke - one
 * pass of substitution settles it to well under a pixel at these magnitudes.
 */
const frameGlyph = (sign: Sign, glyphHeightPx: number, strokePx: number) => {
  const box = pathBounds(sign.paths);

  const firstPass = glyphHeightPx / box.height;
  const pad = (strokePx / firstPass) * 0.62;

  const vbWidth = box.width + pad * 2;
  const vbHeight = box.height + pad * 2;
  const unitsToPx = glyphHeightPx / vbHeight;

  const cx = box.x + box.width / 2 + (sign.opticalOffset?.x ?? 0);
  const cy = box.y + box.height / 2 + (sign.opticalOffset?.y ?? 0);

  return {
    viewBox: `${cx - vbWidth / 2} ${cy - vbHeight / 2} ${vbWidth} ${vbHeight}`,
    widthPx: vbWidth * unitsToPx,
    heightPx: glyphHeightPx,
    /** Longest side of the viewBox, in grid units - the filter scale reference. */
    span: Math.max(vbWidth, vbHeight),
    cx,
    cy,
    strokeUnits: strokePx / unitsToPx,
  };
};

/** Star radius and base brightness from apparent magnitude. */
const starRadius = (mag: number, height: number) =>
  clamp(0.0050 - 0.0007 * mag, 0.0016, 0.0046) * height;

const starOpacity = (mag: number) => clamp(1.05 - 0.11 * mag, 0.42, 0.95);

const starBounds = (sign: Sign): Bounds => {
  const {stars} = sign.constellation;
  const xs = stars.map((s) => s.x);
  const ys = stars.map((s) => s.y);
  const x = Math.min(...xs);
  const y = Math.min(...ys);
  return {x, y, width: Math.max(...xs) - x, height: Math.max(...ys) - y};
};

const Constellation: React.FC<{sign: Sign; color: string}> = ({sign, color}) => {
  const frame = useCurrentFrame();
  const {durationInFrames, height} = useVideoConfig();
  const {stars, lines} = sign.constellation;

  // Every constellation is a different shape on the sky, so it is fitted and
  // centred on its own star bounds rather than on the grid it is stored in.
  const box = starBounds(sign);
  const scale = Math.min(
    (CONSTELLATION_HEIGHT_FRACTION * height) / box.height,
    (CONSTELLATION_MAX_WIDTH_FRACTION * height) / box.width,
  );
  const widthPx = box.width * scale;
  const heightPx = box.height * scale;
  const at = (s: {x: number; y: number}) => ({
    x: (s.x - box.x) * scale,
    y: (s.y - box.y) * scale,
  });

  const haloId = `star-halo-${sign.name}`;

  return (
    <svg
      width={widthPx}
      height={heightPx}
      viewBox={`0 0 ${widthPx} ${heightPx}`}
      style={{overflow: 'visible', display: 'block'}}
    >
      <defs>
        <filter
          id={haloId}
          x="-60%"
          y="-60%"
          width="220%"
          height="220%"
          colorInterpolationFilters="sRGB"
        >
          <feGaussianBlur stdDeviation={height * 0.0026} />
        </filter>
      </defs>

      <g stroke={color} strokeWidth={height * 0.0013} opacity={0.3}>
        {lines.map(([a, b], i) => {
          const p = at(stars[a]);
          const q = at(stars[b]);
          return <line key={i} x1={p.x} y1={p.y} x2={q.x} y2={q.y} />;
        })}
      </g>

      {/* Halo first, then the hard point on top. */}
      <g fill={color} filter={`url(#${haloId})`} opacity={0.5}>
        {stars.map((s, i) => {
          const p = at(s);
          return (
            <circle
              key={i}
              cx={p.x}
              cy={p.y}
              r={starRadius(s.mag, height) * 1.9}
              opacity={
                starOpacity(s.mag) * twinkleAt(frame, durationInFrames, i)
              }
            />
          );
        })}
      </g>
      <g fill={color}>
        {stars.map((s, i) => {
          const p = at(s);
          return (
            <circle
              key={i}
              cx={p.x}
              cy={p.y}
              r={starRadius(s.mag, height)}
              opacity={
                starOpacity(s.mag) * twinkleAt(frame, durationInFrames, i)
              }
            />
          );
        })}
      </g>
    </svg>
  );
};

export const ZodiacSymbol: React.FC<ZodiacSymbolProps> = ({
  sign: signName,
  metal = GOLD,
  edgeColor = '#2e1c05',
  constellationColor = '#f3e0ab',
  showConstellation = true,
}) => {
  const frame = useCurrentFrame();
  const {durationInFrames, height} = useVideoConfig();

  const sign = SIGN_BY_NAME[signName];
  if (!sign) {
    throw new Error(
      `ZodiacSymbol: unknown sign "${signName}". Known signs: ${Object.keys(
        SIGN_BY_NAME,
      ).join(', ')}.`,
    );
  }

  const {yaw, breath, highlight} = motionAt(frame, durationInFrames);

  const glyphHeight = GLYPH_FRACTION * height * sign.opticalScale;
  const strokePx = STROKE_FRACTION * height;
  const fit = frameGlyph(sign, glyphHeight, strokePx);

  // The specular band travels along a diagonal across the glyph.
  const a = (HIGHLIGHT_ANGLE_DEG * Math.PI) / 180;
  const reach = fit.span * 0.62;
  const gradient = {
    x1: fit.cx - reach * Math.cos(a),
    y1: fit.cy + reach * Math.sin(a),
    x2: fit.cx + reach * Math.cos(a),
    y2: fit.cy - reach * Math.sin(a),
  };

  const [shadow, mid, specular] = metal;
  // A warm step between bronze and gold, so the falloff off the specular does
  // not read as a hard band across the wider strokes.
  const warm = '#a86a14';
  // A tight specular band travelling across a bronze field, rather than one
  // long ramp end to end. The field is what makes it read as metal: a gradual
  // ramp over the whole shape reads as flat printed colour.
  const band: [number, string][] = [
    [highlight - 0.42, shadow],
    [highlight - 0.26, warm],
    [highlight - 0.11, mid],
    [highlight, specular],
    [highlight + 0.11, mid],
    [highlight + 0.26, warm],
    [highlight + 0.42, shadow],
  ];
  const stops: [number, string][] = [
    [0, shadow],
    // Clamping is monotonic, so the band's own order survives it.
    ...band.map(
      ([offset, color]) =>
        [clamp(offset, 0.0001, 0.9999), color] as [number, string],
    ),
    [1, shadow],
  ];

  const gradientId = `metal-${sign.name}`;
  const finishId = `finish-${sign.name}`;

  const strokeProps = {
    fill: 'none' as const,
    strokeLinecap: 'round' as const,
    strokeLinejoin: 'round' as const,
  };

  return (
    <AbsoluteFill
      style={{
        backgroundColor: '#000000',
        alignItems: 'center',
        justifyContent: 'center',
        perspective: height * 2.2,
      }}
    >
      {showConstellation ? (
        <div
          style={{
            position: 'absolute',
            // Sits behind the glyph and takes only part of the yaw, so the two
            // planes separate as the plate turns.
            transform: `translateZ(${-height * 0.06}px) rotateY(${
              yaw * CONSTELLATION_YAW_RATIO
            }deg) scale(${breath})`,
          }}
        >
          <Constellation sign={sign} color={constellationColor} />
        </div>
      ) : null}

      <div
        style={{
          position: 'absolute',
          transform: `rotateY(${yaw}deg) scale(${breath})`,
        }}
      >
        <svg
          width={fit.widthPx}
          height={fit.heightPx}
          viewBox={fit.viewBox}
          style={{overflow: 'visible', display: 'block'}}
          shapeRendering="geometricPrecision"
        >
          <defs>
            <linearGradient
              id={gradientId}
              gradientUnits="userSpaceOnUse"
              x1={gradient.x1}
              y1={gradient.y1}
              x2={gradient.x2}
              y2={gradient.y2}
            >
              {stops.map(([offset, color], i) => (
                <stop key={i} offset={offset} stopColor={color} />
              ))}
            </linearGradient>

            <filter
              id={finishId}
              x="-18%"
              y="-18%"
              width="136%"
              height="136%"
              colorInterpolationFilters="sRGB"
            >
              {/* Bloom, restrained: isolate only the near-white specular, blur
                  it, and add a fraction of it back. Anything below the
                  threshold contributes nothing, so the black stays black. */}
              <feComponentTransfer in="SourceGraphic" result="bright">
                <feFuncR type="linear" slope="5" intercept="-4.1" />
                <feFuncG type="linear" slope="5" intercept="-4.1" />
                <feFuncB type="linear" slope="5" intercept="-4.1" />
              </feComponentTransfer>
              <feGaussianBlur
                in="bright"
                stdDeviation={fit.span * 0.014}
                result="glow"
              />
              <feComposite
                in="glow"
                in2="SourceGraphic"
                operator="arithmetic"
                k1="0"
                k2="0.55"
                k3="1"
                result="bloomed"
              />

              {/* Grain, multiplied into the artwork rather than laid over the
                  frame: +-0.5% where there is metal, exactly nothing where
                  there is not. The seed is the frame, so a re-render is
                  identical. */}
              <feTurbulence
                type="fractalNoise"
                baseFrequency="4"
                numOctaves="1"
                seed={frame}
                result="noise"
              />
              <feComposite
                in="noise"
                in2="bloomed"
                operator="arithmetic"
                k1="0.01"
                k2="0"
                k3="0.995"
                k4="0"
              />
            </filter>
          </defs>

          <g filter={`url(#${finishId})`}>
            {/* Darker edge, drawn a touch wider underneath. */}
            <g
              {...strokeProps}
              stroke={edgeColor}
              strokeWidth={fit.strokeUnits * 1.2}
            >
              {sign.paths.map((d, i) => (
                <path key={i} d={d} />
              ))}
            </g>
            <g
              {...strokeProps}
              stroke={`url(#${gradientId})`}
              strokeWidth={fit.strokeUnits}
            >
              {sign.paths.map((d, i) => (
                <path key={i} d={d} />
              ))}
            </g>
          </g>
        </svg>
      </div>
    </AbsoluteFill>
  );
};
