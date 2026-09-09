import React from "react";
import { type Network, pointAt, slice, toPath } from "./network";
import type { Theme } from "./theme";

const TAIL_STEPS = 6;

type Head = { x: number; y: number; r: number };

/**
 * Pulses travel along the stored routes. `t` is the normalised loop position,
 * and every pulse advances a whole number of traversals across it, so the loop
 * closes exactly.
 */
export const Pulses: React.FC<{
  net: Network;
  theme: Theme;
  t: number;
  filterId: string;
  onHeads?: (h: Head[]) => void;
}> = ({ net, theme, t, filterId }) => {
  const heads: Head[] = [];
  // One path per tail step, so the whole field is drawn in six stroke states
  // rather than one per pulse.
  const lanes: { d: string[]; w: number }[] = Array.from({ length: TAIL_STEPS }, () => ({
    d: [],
    w: 0,
  }));

  for (const p of net.pulses) {
    const route = net.routes[p.route];
    const raw = (t * p.turns + p.phase) % 1;
    const u = p.inward ? 1 - raw : raw;
    const s = u * route.len;

    for (let i = 0; i < TAIL_STEPS; i++) {
      const a = s - p.tail * (1 - i / TAIL_STEPS);
      const b = s - p.tail * (1 - (i + 1) / TAIL_STEPS);
      const pts = slice(route, Math.min(a, b), Math.max(a, b));
      if (pts.length < 2) continue;
      lanes[i].d.push(toPath(pts));
      lanes[i].w = Math.max(lanes[i].w, p.w);
    }

    const head = pointAt(route, s);
    heads.push({ x: head.x, y: head.y, r: p.head });
  }

  return (
    <g>
      {/* Bloom under the crisp pulse heads only — the traces themselves must
          stay readable as lines. */}
      <g filter={`url(#${filterId})`} opacity={0.85}>
        {heads.map((h, i) => (
          <circle key={i} cx={h.x} cy={h.y} r={h.r * 2.6} fill={theme.pulse} opacity={0.5} />
        ))}
      </g>

      {lanes.map((lane, i) => {
        const k = (i + 1) / TAIL_STEPS;
        return (
          <path
            key={i}
            d={lane.d.join(" ")}
            stroke={theme.pulse}
            strokeWidth={lane.w * (0.62 + 0.5 * k)}
            strokeLinecap="round"
            strokeLinejoin="round"
            fill="none"
            opacity={0.1 + 0.78 * k * k}
          />
        );
      })}

      {heads.map((h, i) => (
        <circle key={i} cx={h.x} cy={h.y} r={h.r} fill={theme.pulseCore} opacity={0.95} />
      ))}
    </g>
  );
};
