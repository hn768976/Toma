import React from "react";
import { type Network, toPath } from "./network";
import type { Theme } from "./theme";

const circle = (x: number, y: number, r: number) =>
  `M${(x + r).toFixed(1)} ${y.toFixed(1)}a${r.toFixed(1)} ${r.toFixed(1)} 0 1 0 ${(-2 * r).toFixed(1)} 0a${r.toFixed(1)} ${r.toFixed(1)} 0 1 0 ${(2 * r).toFixed(1)} 0`;

/**
 * The static board: unlit traces, pads, vias, component outlines, label
 * fragments and the fine dust field. Traces are batched into one path per
 * colour/weight bucket rather than one element per segment.
 */
export const Board: React.FC<{
  net: Network;
  theme: Theme;
  breathe: number;
  dustPhase: number;
}> = ({ net, theme, breathe, dustPhase }) => {
  const paths = React.useMemo(() => {
    const map = new Map<string, { tone: 0 | 1 | 2; w: number; d: string[] }>();
    for (const r of net.routes) {
      const key = `${r.tone}:${r.w}`;
      let b = map.get(key);
      if (!b) {
        b = { tone: r.tone, w: r.w, d: [] };
        map.set(key, b);
      }
      b.d.push(toPath(r.pts));
    }
    return {
      buckets: [...map.values()],
      pads: net.pads.map((p) => circle(p.x, p.y, p.r)).join(" "),
      vias: net.vias.map((v) => circle(v.x, v.y, v.r)).join(" "),
      comps: net.comps
        .map((c) => `M${c.x.toFixed(1)} ${c.y.toFixed(1)}h${c.w.toFixed(1)}v${c.h.toFixed(1)}h${(-c.w).toFixed(1)}Z`)
        .join(" "),
      labels: net.labels
        .map((l) => {
          let x = l.x;
          return l.marks
            .map((m) => {
              const seg = `M${x.toFixed(1)} ${l.y.toFixed(1)}h${m.toFixed(1)}`;
              x += m + 6;
              return seg;
            })
            .join(" ");
        })
        .join(" "),
    };
  }, [net]);

  // Unlit traces sit low; pulses are what light them.
  const dim = [0.3, 0.44, 0.6];

  return (
    <g>
      <path
        d={paths.labels}
        stroke={theme.label}
        strokeWidth={4.5}
        strokeLinecap="butt"
        fill="none"
        opacity={0.16 * breathe}
      />

      <g opacity={0.55 * breathe}>
        {net.dust.map((d, i) => {
          // Twinkle on a cycle that divides evenly into the loop.
          const tw = 0.5 + 0.5 * Math.sin((dustPhase + d.phase) * Math.PI * 2);
          return (
            <rect
              key={i}
              x={d.x}
              y={d.y}
              width={d.w}
              height={d.h}
              fill={theme.dust}
              opacity={0.1 + 0.45 * tw}
            />
          );
        })}
      </g>

      {paths.buckets.map((b) => (
        <path
          key={`${b.tone}-${b.w}`}
          d={b.d.join(" ")}
          stroke={theme.trace[b.tone]}
          strokeWidth={b.w}
          strokeLinecap="square"
          strokeLinejoin="miter"
          fill="none"
          opacity={dim[b.tone] * breathe}
        />
      ))}

      <path d={paths.comps} stroke={theme.pad} strokeWidth={2.4} fill="none" opacity={0.42 * breathe} />
      <path d={paths.vias} stroke={theme.pad} strokeWidth={2.2} fill="none" opacity={0.5 * breathe} />
      <path d={paths.pads} stroke={theme.pad} strokeWidth={3} fill="none" opacity={0.62 * breathe} />
    </g>
  );
};
