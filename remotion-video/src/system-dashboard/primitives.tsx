import React from "react";
import { FINE, FONT_MONO, FONT_SANS, HAIRLINE } from "./constants";
import { rand, randRange, stream } from "./random";
import { useTheme } from "./theme";

/** Absolutely positioned module box, in design units. */
export const Mod: React.FC<{
  x: number;
  y: number;
  w: number;
  h: number;
  opacity?: number;
  children?: React.ReactNode;
}> = ({ x, y, w, h, opacity = 1, children }) => (
  <div style={{ position: "absolute", left: x, top: y, width: w, height: h, opacity }}>
    {children}
  </div>
);

/**
 * Directional reveal. Used for every build-in so structure wipes on and
 * modules populate without any element needing its own mask.
 */
export const Reveal: React.FC<{
  p: number;
  from?: "left" | "right" | "top" | "bottom";
  children?: React.ReactNode;
}> = ({ p, from = "left", children }) => {
  const hide = Math.max(0, (1 - p) * 100);
  const inset =
    from === "left"
      ? `0 ${hide}% 0 0`
      : from === "right"
        ? `0 0 0 ${hide}%`
        : from === "top"
          ? `0 0 ${hide}% 0`
          : `${hide}% 0 0 0`;
  return (
    <div style={{ position: "absolute", inset: 0, clipPath: `inset(${inset})` }}>{children}</div>
  );
};

/** SVG layer filling its parent module box, in the module's own units. */
export const Svg: React.FC<{
  w: number;
  h: number;
  style?: React.CSSProperties;
  children?: React.ReactNode;
}> = ({ w, h, style, children }) => (
  <svg
    width={w}
    height={h}
    viewBox={`0 0 ${w} ${h}`}
    style={{ position: "absolute", left: 0, top: 0, overflow: "visible", ...style }}
  >
    {children}
  </svg>
);

export type TxtProps = {
  x: number;
  y: number;
  size: number;
  children: React.ReactNode;
  color?: string;
  mono?: boolean;
  weight?: number;
  ls?: number;
  opacity?: number;
  width?: number;
  align?: "left" | "center" | "right";
  glow?: boolean;
  lh?: number;
};

/** DOM text. Kept out of SVG so the small type stays crisp. */
export const Txt: React.FC<TxtProps> = ({
  x,
  y,
  size,
  children,
  color,
  mono,
  weight = 400,
  ls = 0,
  opacity = 1,
  width,
  align = "left",
  glow,
  lh = 1.05,
}) => {
  const theme = useTheme();
  return (
    <div
      style={{
        position: "absolute",
        left: x,
        top: y,
        width,
        textAlign: align,
        fontFamily: mono ? FONT_MONO : FONT_SANS,
        fontSize: size,
        fontWeight: weight,
        letterSpacing: ls,
        lineHeight: lh,
        color: color ?? theme.primary,
        opacity,
        whiteSpace: "pre",
        textShadow: glow ? `0 0 ${size * 0.32}px ${theme.glow}` : undefined,
      }}
    >
      {children}
    </div>
  );
};

/** Row of tick marks of alternating length - the connective tissue of the HUD. */
export const TickRow: React.FC<{
  w: number;
  y?: number;
  step?: number;
  len?: number;
  major?: number;
  majorLen?: number;
  color?: string;
  opacity?: number;
  up?: boolean;
}> = ({ w, y = 0, step = 12, len = 8, major = 5, majorLen = 18, color, opacity = 1, up = false }) => {
  const theme = useTheme();
  const n = Math.floor(w / step);
  const d: string[] = [];
  for (let i = 0; i <= n; i++) {
    const l = i % major === 0 ? majorLen : len;
    const x = i * step;
    d.push(up ? `M${x} ${y}V${y - l}` : `M${x} ${y}V${y + l}`);
  }
  return (
    <path d={d.join("")} stroke={color ?? theme.structure} strokeWidth={FINE} opacity={opacity} />
  );
};

/** Four corner brackets around a box. */
export const Corners: React.FC<{
  w: number;
  h: number;
  len?: number;
  color?: string;
  sw?: number;
  opacity?: number;
}> = ({ w, h, len = 22, color, sw = HAIRLINE, opacity = 1 }) => {
  const theme = useTheme();
  return (
    <path
      d={[
        `M0 ${len}V0H${len}`,
        `M${w - len} 0H${w}V${len}`,
        `M${w} ${h - len}V${h}H${w - len}`,
        `M${len} ${h}H0V${h - len}`,
      ].join("")}
      fill="none"
      stroke={color ?? theme.primary}
      strokeWidth={sw}
      opacity={opacity}
    />
  );
};

/** Small plus sign, used as filler in empty channels. */
export const Cross: React.FC<{ x: number; y: number; r?: number; color?: string; opacity?: number }> =
  ({ x, y, r = 8, color, opacity = 1 }) => {
    const theme = useTheme();
    return (
      <path
        d={`M${x - r} ${y}H${x + r}M${x} ${y - r}V${y + r}`}
        stroke={color ?? theme.structure}
        strokeWidth={FINE}
        opacity={opacity}
      />
    );
  };

/** Fine graph-paper grid. */
export const GridPaper: React.FC<{
  w: number;
  h: number;
  step?: number;
  color?: string;
  opacity?: number;
}> = ({ w, h, step = 24, color, opacity = 0.55 }) => {
  const theme = useTheme();
  const d: string[] = [];
  for (let x = 0; x <= w; x += step) d.push(`M${x} 0V${h}`);
  for (let y = 0; y <= h; y += step) d.push(`M0 ${y}H${w}`);
  return <path d={d.join("")} stroke={color ?? theme.structure} strokeWidth={FINE} opacity={opacity} />;
};

/** Horizontal hatch fill, used inside meter bars. */
export const Hatch: React.FC<{
  x: number;
  y: number;
  w: number;
  h: number;
  step?: number;
  color?: string;
  opacity?: number;
}> = ({ x, y, w, h, step = 5, color, opacity = 1 }) => {
  const theme = useTheme();
  const d: string[] = [];
  for (let i = 0; i <= h / step; i++) d.push(`M${x} ${y + i * step}H${x + w}`);
  return <path d={d.join("")} stroke={color ?? theme.bar} strokeWidth={FINE} opacity={opacity} />;
};

/** Barcode-like glyph. Deterministic bar widths from the seed. */
export const Barcode: React.FC<{
  x: number;
  y: number;
  w: number;
  h: number;
  seed: number;
  color?: string;
  opacity?: number;
}> = ({ x, y, w, h, seed, color, opacity = 1 }) => {
  const theme = useTheme();
  const bars: React.ReactNode[] = [];
  let cx = 0;
  let i = 0;
  while (cx < w) {
    const bw = randRange(seed + i, 1.5, 5);
    if (rand(seed * 3 + i) > 0.42) {
      bars.push(<rect key={i} x={x + cx} y={y} width={Math.min(bw, w - cx)} height={h} />);
    }
    cx += bw + randRange(seed * 5 + i, 1.5, 4);
    i++;
  }
  return (
    <g fill={color ?? theme.primary} opacity={opacity}>
      {bars}
    </g>
  );
};

/** Scatter of isolated dots, for filling dead space without adding structure. */
export const Dots: React.FC<{
  w: number;
  h: number;
  count: number;
  seed: number;
  r?: number;
  color?: string;
  opacity?: number;
}> = ({ w, h, count, seed, r = 2.5, color, opacity = 0.7 }) => {
  const theme = useTheme();
  const xs = stream(seed, count, 0, w);
  const ys = stream(seed + 1, count, 0, h);
  return (
    <g fill={color ?? theme.structure} opacity={opacity}>
      {xs.map((x, i) => (
        <circle key={i} cx={x} cy={ys[i]} r={r} />
      ))}
    </g>
  );
};

export const MONO = FONT_MONO;
export const SANS = FONT_SANS;
