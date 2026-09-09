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
      height: u * 60,
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
        <g key={i}>
          <ellipse
            cx={p.px + h * 0.3}
            cy={p.py + h * 0.1}
            rx={h * 0.34}
            ry={h * 0.135}
            fill="url(#pinShadow)"
          />
          {/* hard little contact patch right where the point enters the map */}
          <ellipse cx={p.px} cy={p.py} rx={h * 0.05} ry={h * 0.022} fill="#000" fillOpacity={0.5} />
        </g>
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

      // Head sits on an axis that leans slightly left of vertical; the shaft is
      // a tapered cone along that same axis, so the pin reads as one object
      // pushed into the map rather than a ball balanced on a wire.
      const r = H * 0.215;
      const hx = -H * 0.055;
      const hy = -(H - r * 1.02);
      const len = Math.hypot(hx, hy);
      const ux = hx / len;
      const uy = hy / len;
      const nx = -uy;
      const ny = ux;
      const topT = 0.80;
      const tx = hx * topT;
      const ty = hy * topT;
      const half = H * 0.125;
      const shaft = `M0,0 L${tx + nx * half},${ty + ny * half} L${tx - nx * half},${ty - ny * half} Z`;
      // a narrower wedge on the lit side gives the cone its roundness
      const lit = `M0,0 L${tx + nx * half * 0.92},${ty + ny * half * 0.92} L${tx + nx * half * 0.18},${ty + ny * half * 0.18} Z`;
      const collarT = 0.7;
      const angle = (Math.atan2(uy, ux) * 180) / Math.PI;

      return (
        <g key={i} transform={`translate(${s.x} ${s.y + lift})`}>
          <path d={shaft} fill={c.rim} />
          <path d={lit} fill={c.body} fillOpacity={0.85} />
          <path
            d={shaft}
            fill="none"
            stroke="#000"
            strokeOpacity={0.28}
            strokeWidth={H * 0.012}
          />
          {/* collar where the shaft meets the head */}
          <ellipse
            cx={hx * collarT}
            cy={hy * collarT}
            rx={H * 0.115}
            ry={H * 0.042}
            fill={c.rim}
            transform={`rotate(${angle + 90} ${hx * collarT} ${hy * collarT})`}
          />
          <ellipse cx={hx} cy={hy} rx={r} ry={r * 0.96} fill={`url(#pinGrad-${p.def.color})`} />
          {/* shaded crescent on the away side, then the specular */}
          <circle
            cx={hx + r * 0.3}
            cy={hy + r * 0.32}
            r={r * 0.82}
            fill={c.rim}
            fillOpacity={0.3}
          />
          <ellipse
            cx={hx}
            cy={hy}
            rx={r}
            ry={r * 0.96}
            fill="none"
            stroke="#000"
            strokeOpacity={0.34}
            strokeWidth={H * 0.014}
          />
          <ellipse
            cx={hx - r * 0.36}
            cy={hy - r * 0.4}
            rx={r * 0.24}
            ry={r * 0.14}
            fill="#ffffff"
            fillOpacity={0.6}
            transform={`rotate(-32 ${hx - r * 0.36} ${hy - r * 0.4})`}
          />
          <ellipse
            cx={hx + r * 0.26}
            cy={hy + r * 0.44}
            rx={r * 0.24}
            ry={r * 0.12}
            fill="#ffffff"
            fillOpacity={0.14}
            transform={`rotate(-20 ${hx + r * 0.26} ${hy + r * 0.44})`}
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
