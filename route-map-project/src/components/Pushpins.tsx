import React from "react";
import type { MapGeometry } from "../lib/geo";
import { project, toPlane } from "../lib/geo";
import { PIN_COLORS } from "../lib/palettes";
import { hashSeed } from "../lib/prng";
import type { PinDef } from "../lib/types";

export interface PlacedPin {
  def: PinDef;
  /** Position on the map plane, before drift. */
  px: number;
  py: number;
  phase: number;
  height: number;
}

export const placePins = (pins: PinDef[], g: MapGeometry, u: number): PlacedPin[] =>
  pins.map((def) => {
    const [px, py] = toPlane(def.lon, def.lat, g);
    return {
      def,
      px,
      py,
      phase: (hashSeed(`${def.lon},${def.lat},${def.color}`) % 1000) / 1000,
      height: u * 50,
    };
  });

interface ShadowProps {
  pins: PlacedPin[];
  progress: number;
}

/**
 * Pin shadows live on the map plane, so they rake away with it — that contrast
 * with the upright pin body is what sells the pin as stuck into a surface.
 */
export const PinShadows: React.FC<ShadowProps> = ({ pins, progress }) => (
  <g>
    <defs>
      <radialGradient id="pinShadow">
        <stop offset="0%" stopColor="#000" stopOpacity="0.62" />
        <stop offset="55%" stopColor="#000" stopOpacity="0.28" />
        <stop offset="100%" stopColor="#000" stopOpacity="0" />
      </radialGradient>
    </defs>
    {pins.map((p, i) => {
      const bob = Math.sin(progress * Math.PI * 2 * 2 + p.phase * Math.PI * 2);
      const h = p.height * (1 + bob * 0.02);
      return (
        <ellipse
          key={i}
          cx={p.px + h * 0.42}
          cy={p.py + h * 0.16}
          rx={h * 0.4}
          ry={h * 0.17}
          fill="url(#pinShadow)"
        />
      );
    })}
  </g>
);

interface PulseProps {
  pins: PlacedPin[];
  progress: number;
  color: string;
  u: number;
}

/** Soft rings on the map plane under the one or two pins that pulse. */
export const PinPulses: React.FC<PulseProps> = ({ pins, progress, color, u }) => (
  <g fill="none">
    {pins
      .filter((p) => p.def.pulse)
      .flatMap((p, i) =>
        [0, 0.5].map((off) => {
          const t = (progress * 2 + p.phase + off) % 1;
          const r = u * 12 + t * u * 90;
          return (
            <circle
              key={`${i}-${off}`}
              cx={p.px}
              cy={p.py}
              r={r}
              stroke={color}
              strokeOpacity={0.4 * (1 - t) * (1 - t)}
              strokeWidth={u * 1.6}
            />
          );
        }),
      )}
  </g>
);

interface BodyProps {
  pins: PlacedPin[];
  g: MapGeometry;
  progress: number;
  drift: { x: number; y: number };
}

/**
 * Pin bodies, upright in screen space. We run the plane's own transform in JS
 * for the anchor point and take the perspective term as the pin's scale, so a
 * far pin is smaller without ever leaning with the map.
 */
export const PinBodies: React.FC<BodyProps> = ({ pins, g, progress, drift }) => (
  <g>
    {pins.map((p, i) => {
      const s = project(p.px + drift.x, p.py + drift.y, g.tilt);
      const bob = Math.sin(progress * Math.PI * 2 * 2 + p.phase * Math.PI * 2);
      const H = p.height * s.scale * (1 + bob * 0.02);
      const lift = bob * H * 0.02;
      const c = PIN_COLORS[p.def.color];
      const r = H * 0.27;
      const hx = -H * 0.15;
      const hy = -(H - r * 0.9);
      const sw = H * 0.062;
      const gid = `pinGrad-${p.def.color}`;
      return (
        <g key={i} transform={`translate(${s.x} ${s.y + lift})`}>
          <path
            d={`M0,0 L${hx * 0.5 - sw},${-H * 0.5} L${hx - sw * 1.5},${hy + r * 0.55}
                L${hx + sw * 1.5},${hy + r * 0.55} L${hx * 0.5 + sw},${-H * 0.5} Z`}
            fill={c.rim}
            fillOpacity={0.95}
          />
          <ellipse cx={hx} cy={hy + r * 0.62} rx={r * 0.52} ry={r * 0.2} fill={c.rim} fillOpacity={0.9} />
          <circle cx={hx} cy={hy} r={r} fill={`url(#${gid})`} />
          <circle cx={hx} cy={hy} r={r} fill="none" stroke={c.rim} strokeOpacity={0.5} strokeWidth={H * 0.014} />
          <ellipse
            cx={hx - r * 0.33}
            cy={hy - r * 0.38}
            rx={r * 0.3}
            ry={r * 0.2}
            fill="#ffffff"
            fillOpacity={0.55}
            transform={`rotate(-30 ${hx - r * 0.33} ${hy - r * 0.38})`}
          />
        </g>
      );
    })}
  </g>
);

/** Gradient defs for every pin colour, emitted once. */
export const PinGradients: React.FC = () => (
  <defs>
    {Object.entries(PIN_COLORS).map(([name, c]) => (
      <radialGradient key={name} id={`pinGrad-${name}`} cx="34%" cy="30%" r="78%">
        <stop offset="0%" stopColor={c.top} />
        <stop offset="58%" stopColor={c.body} />
        <stop offset="100%" stopColor={c.rim} />
      </radialGradient>
    ))}
  </defs>
);
