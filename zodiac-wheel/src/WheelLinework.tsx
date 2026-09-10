import React from "react";
import { SIGN_NAMES, WHEEL, type Palette } from "./config";
import { GLYPHS } from "./glyphs";
import { UNIT, arcPath, evenDashes, polar, polarPoint, spokePath } from "./wheel-geometry";

const r = (k: number) => k * UNIT;

/** Stroke weights in normalised disc units. */
const W = {
  hair: 1.7,
  thin: 2.6,
  med: 3.6,
  heavy: 5.2,
};

export type LabelMode = "curved" | "upright";

type Props = {
  palette: Palette;
  /** Current wheel rotation, needed to keep upright labels upright. */
  rotationDeg: number;
  labelMode: LabelMode;
  /** Prefix for the arc path ids so two compositions never collide. */
  idPrefix: string;
  /** 'glow' draws the same geometry fatter and monochrome for the bloom pass. */
  variant: "glow" | "crisp";
};

const NAME_ARC_HALF = 13.2;
const NAME_BASELINE = r(WHEEL.rNameIn) + 42;
const NAME_SIZE = 52;

export const WheelLinework: React.FC<Props> = ({
  palette,
  rotationDeg,
  labelMode,
  idPrefix,
  variant,
}) => {
  const glow = variant === "glow";
  const k = glow ? 2.1 : 1; // stroke multiplier for the bloom pass
  const line = glow ? palette.wheelGlow : palette.wheelLine;
  const bright = glow ? palette.wheelGlow : palette.wheelBright;
  const faint = glow ? palette.wheelGlow : palette.constellation;

  const sectors = React.useMemo(() => [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11], []);

  // Straight chords between sector boundaries -- the star-polygon pattern
  // every chart wheel carries across its interior.
  const aspects = React.useMemo(() => {
    const out: string[] = [];
    for (let i = 0; i < 12; i++) {
      for (const step of [4, 5]) {
        const j = (i + step) % 12;
        if (step === 4 && i >= 4) continue; // trines: only the two triangles
        out.push(
          `M ${polarPoint(i * 30, r(WHEEL.rAspect))} L ${polarPoint(j * 30, r(WHEEL.rAspect))}`,
        );
      }
    }
    return out;
  }, []);

  return (
    <g fill="none" strokeLinecap="butt">
      {/* --- Far field: faint ellipses and radials continuing past the wheel --- */}
      <g stroke={faint} opacity={glow ? 0.25 : 0.3}>
        {WHEEL.rHalo.map((h) => (
          <circle key={h} cx={0} cy={0} r={r(h)} strokeWidth={W.hair * k} />
        ))}
        {sectors.map((i) => (
          <path
            key={i}
            d={spokePath(i * 30 + 15, r(WHEEL.rOuterDots) * 1.02, r(WHEEL.rRadialOut))}
            strokeWidth={W.hair * k}
          />
        ))}
      </g>

      {/* --- Outer dotted ring --- */}
      <circle
        cx={0}
        cy={0}
        r={r(WHEEL.rOuterDots)}
        stroke={bright}
        strokeWidth={5.6 * (glow ? 1.6 : 1)}
        strokeLinecap="round"
        strokeDasharray={evenDashes(r(WHEEL.rOuterDots), 288, 0.01)}
        opacity={0.95}
      />
      <circle
        cx={0}
        cy={0}
        r={r(WHEEL.rOuterCircle)}
        stroke={line}
        strokeWidth={W.med * k}
      />

      {/* --- Degree ticks: one dashed circle per band, drawn as radial marks --- */}
      {(() => {
        const outer = r(WHEEL.rTickOut);
        const inner = r(WHEEL.rTickIn);
        const band = outer - inner;
        const minorLen = band * 0.44;
        const minorMid = outer - minorLen / 2;
        const majorMid = inner + band / 2;
        return (
          <g stroke={line}>
            <circle
              cx={0}
              cy={0}
              r={minorMid}
              strokeWidth={minorLen}
              strokeDasharray={evenDashes(minorMid, 360, W.hair * k)}
              opacity={0.7}
            />
            <circle
              cx={0}
              cy={0}
              r={majorMid}
              strokeWidth={band}
              strokeDasharray={evenDashes(majorMid, 36, W.thin * k)}
              opacity={0.92}
            />
          </g>
        );
      })()}
      <circle cx={0} cy={0} r={r(WHEEL.rTickIn)} stroke={line} strokeWidth={W.thin * k} opacity={0.8} />

      {/* --- Name ring --- */}
      <circle cx={0} cy={0} r={r(WHEEL.rNameOut)} stroke={line} strokeWidth={W.thin * k} opacity={0.85} />
      <circle cx={0} cy={0} r={r(WHEEL.rNameIn)} stroke={line} strokeWidth={W.thin * k} opacity={0.85} />
      <g stroke={line} opacity={0.8}>
        {sectors.map((i) => (
          <path
            key={i}
            d={spokePath(i * 30, r(WHEEL.rNameIn), r(WHEEL.rNameOut))}
            strokeWidth={W.thin * k}
          />
        ))}
      </g>

      <defs>
        {sectors.map((i) => (
          <path
            key={i}
            id={`${idPrefix}-name-${i}`}
            d={arcPath(i * 30 + 15 - NAME_ARC_HALF, i * 30 + 15 + NAME_ARC_HALF, NAME_BASELINE)}
          />
        ))}
      </defs>
      <g
        fill={bright}
        stroke="none"
        fontFamily='"DejaVu Sans", "Trebuchet MS", "Helvetica Neue", Arial, sans-serif'
        fontSize={NAME_SIZE}
        letterSpacing={4}
        opacity={glow ? 0.55 : 0.98}
      >
        {SIGN_NAMES.map((name, i) =>
          labelMode === "curved" ? (
            <text key={name}>
              <textPath
                href={`#${idPrefix}-name-${i}`}
                startOffset="50%"
                textAnchor="middle"
              >
                {name}
              </textPath>
            </text>
          ) : (
            <g
              key={name}
              transform={`rotate(${i * 30 + 15}) translate(0 ${-(r(WHEEL.rNameIn) + (r(WHEEL.rNameOut) - r(WHEEL.rNameIn)) / 2)}) rotate(${-(i * 30 + 15 + rotationDeg)})`}
            >
              <text textAnchor="middle" dominantBaseline="central">
                {name}
              </text>
            </g>
          ),
        )}
      </g>

      {/* --- Glyph ring --- */}
      <circle cx={0} cy={0} r={r(WHEEL.rGlyphOut)} stroke={line} strokeWidth={W.med * k} opacity={0.9} />
      <circle cx={0} cy={0} r={r(WHEEL.rGlyphIn)} stroke={line} strokeWidth={W.med * k} opacity={0.9} />
      <g stroke={line} opacity={0.75}>
        {sectors.map((i) => (
          <path
            key={i}
            d={spokePath(i * 30, r(WHEEL.rGlyphIn), r(WHEEL.rGlyphOut))}
            strokeWidth={W.thin * k}
          />
        ))}
      </g>
      {(() => {
        const size = 108;
        const mid = (r(WHEEL.rGlyphIn) + r(WHEEL.rGlyphOut)) / 2;
        return (
          <g stroke={bright} strokeLinecap="round" strokeLinejoin="round">
            {GLYPHS.map((glyph, i) => {
              const angle = i * 30 + 15;
              // Placed by rotation, then counter-rotated so the glyph reads
              // upright on screen while still lying in the squashed disc.
              const counter = labelMode === "upright" ? -(angle + rotationDeg) : 0;
              return (
                <g
                  key={glyph.name}
                  transform={`rotate(${angle}) translate(0 ${-mid}) rotate(${counter}) scale(${size / 100}) translate(-50 -50)`}
                  strokeWidth={(glyph.weight ?? 6.4) * (glow ? 1.9 : 1) * (100 / size) * (glow ? 1 : 1)}
                >
                  {glyph.d.map((d, j) => (
                    <path key={j} d={d} />
                  ))}
                </g>
              );
            })}
          </g>
        );
      })()}

      {/* --- Inner rings and sparse markers --- */}
      <circle
        cx={0}
        cy={0}
        r={r(WHEEL.rMarkers)}
        stroke={line}
        strokeWidth={14}
        strokeLinecap="round"
        strokeDasharray={evenDashes(r(WHEEL.rMarkers), 72, 0.01)}
        opacity={0.55}
      />
      <circle cx={0} cy={0} r={r(WHEEL.rAspect)} stroke={line} strokeWidth={W.med * k} opacity={0.9} />
      <circle cx={0} cy={0} r={r(WHEEL.rInnerA)} stroke={line} strokeWidth={W.thin * k} opacity={0.7} />
      <circle cx={0} cy={0} r={r(WHEEL.rInnerB)} stroke={line} strokeWidth={W.thin * k} opacity={0.6} />

      {/* --- Aspect chords --- */}
      <g stroke={line} opacity={glow ? 0.5 : 0.62}>
        {aspects.map((d, i) => (
          <path key={i} d={d} strokeWidth={W.hair * k} />
        ))}
      </g>

      {/* --- Major spokes, centre out through the whole disc --- */}
      <g stroke={line} opacity={0.8}>
        {sectors.map((i) => (
          <path
            key={i}
            d={spokePath(i * 30, r(WHEEL.rInnerB), r(WHEEL.rOuterCircle))}
            strokeWidth={W.thin * k}
          />
        ))}
      </g>

      {/* --- Brightest accent: a partial arc that catches the bloom --- */}
      <g stroke={bright} opacity={0.85} strokeLinecap="round">
        <path d={arcPath(28, 132, r(WHEEL.rOuterCircle))} strokeWidth={W.heavy * k} />
        <path d={arcPath(212, 300, r(WHEEL.rTickIn))} strokeWidth={W.med * k} opacity={0.6} />
      </g>
    </g>
  );
};

/** Exported for the scene so the glow pass can reuse the same normalisation. */
export const wheelUnit = UNIT;
export const wheelPolar = polar;
