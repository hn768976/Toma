import React from "react";
import { pointAtT, trailPoints } from "../lib/paths";
import type { PreparedRoute } from "./Routes";

/**
 * Aircraft, top-down with swept wings. Drawn nose-first along +x so the path
 * tangent can be applied straight as a rotation. Deliberately blunt: at a few
 * pixels tall a detailed outline reads as a smudge.
 */
export const PLANE_PATH =
  "M13,0 L2,1.9 L-5.5,8.4 L-8.2,8.4 L-5,1.5 L-9.6,1.5 L-11.6,3.9 L-13.4,3.9 " +
  "L-12.4,0 L-13.4,-3.9 L-11.6,-3.9 L-9.6,-1.5 L-5,-1.5 L-8.2,-8.4 L-5.5,-8.4 L2,-1.9 Z";

/**
 * Vessel: a long hull with a raked bow and a squared-off stern. Nothing more —
 * a superstructure would only fatten the silhouette at this size.
 */
export const SHIP_PATH =
  "M16,0 L11,2.2 L-9.5,3.1 L-13,2.2 L-13,-2.2 L-9.5,-3.1 L11,-2.2 Z";

export interface MarkerInstance {
  id: string;
  route: PreparedRoute;
  /** Whole trips over the loop — keeps the cycle closed. */
  trips: number;
  phase: number;
  kind: "air" | "sea";
  scale: number;
  /** Small per-marker speed variation, still integral over the loop. */
  wobble: number;
}

interface Props {
  markers: MarkerInstance[];
  progress: number;
  color: string;
  u: number;
}

export const Markers: React.FC<Props> = ({ markers, progress, color, u }) => (
  <g>
    {markers.map((m) => {
      // A sine term varies the rate along the route without breaking the loop:
      // it returns to zero every whole trip.
      const base = m.phase + progress * m.trips;
      const t = (base + (m.wobble * Math.sin(base * Math.PI * 2)) / (Math.PI * 2)) % 1;
      const tt = t < 0 ? t + 1 : t;
      const p = pointAtT(m.route.d, tt);
      const trail = trailPoints(m.route.d, tt, u * 46 * m.scale, 5);
      const s = m.scale * u * 0.62;
      return (
        <g key={m.id}>
          <polyline
            points={trail.map((q) => `${q.x},${q.y}`).join(" ")}
            fill="none"
            stroke={color}
            strokeOpacity={0.20}
            strokeWidth={u * 1.9 * m.scale}
            strokeLinecap="round"
          />
          <polyline
            points={trail
              .slice(Math.max(0, trail.length - 3))
              .map((q) => `${q.x},${q.y}`)
              .join(" ")}
            fill="none"
            stroke={color}
            strokeOpacity={0.42}
            strokeWidth={u * 1.9 * m.scale}
            strokeLinecap="round"
          />
          <g transform={`translate(${p.x} ${p.y}) rotate(${p.angle}) scale(${s})`}>
            <path
              d={m.kind === "air" ? PLANE_PATH : SHIP_PATH}
              fill={color}
              fillOpacity={0.28}
              transform="scale(2.1)"
            />
            <path d={m.kind === "air" ? PLANE_PATH : SHIP_PATH} fill={color} fillOpacity={0.97} />
          </g>
        </g>
      );
    })}
  </g>
);
