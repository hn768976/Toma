import React, { useMemo } from "react";
import { arcPath } from "../geometry/gear";
import type { SweepDef, WaveDef } from "../layout";
import type { Theme } from "../theme";

/** Long, very thin white streak. Reads as light, not as structure. */
export const Sweep: React.FC<{
  def: SweepDef;
  offset: number;
  w: number;
  h: number;
  u: number;
  theme: Theme;
}> = ({ def, offset, w, h, u, theme }) => (
  <path
    d={arcPath(def.cx * w, def.cy * h, def.r * u, def.from, def.to)}
    transform={`translate(${offset} 0)`}
    fill="none"
    stroke={theme.sweepStroke}
    strokeOpacity={def.opacity}
    strokeWidth={def.strokeWidth * u}
    strokeLinecap="round"
  />
);

/** The thin dark wave crossing the full frame width. */
export const Wave: React.FC<{
  def: WaveDef;
  offset: number;
  w: number;
  h: number;
  u: number;
  theme: Theme;
}> = ({ def, offset, w, h, u, theme }) => {
  const d = useMemo(() => {
    const steps = 160;
    const from = -0.1 * w;
    const to = 1.1 * w;
    let path = "";
    for (let i = 0; i <= steps; i++) {
      const x = from + ((to - from) * i) / steps;
      const y =
        def.baseY * h +
        Math.sin((x / w) * def.cycles * Math.PI * 2 + Math.PI * 0.15) * def.amp * h;
      path += `${i === 0 ? "M" : "L"} ${x.toFixed(2)} ${y.toFixed(2)} `;
    }
    return path.trim();
  }, [def.amp, def.baseY, def.cycles, h, w]);

  return (
    <path
      d={d}
      transform={`translate(${offset} 0)`}
      fill="none"
      stroke={theme.waveStroke}
      strokeOpacity={theme.waveOpacity}
      strokeWidth={def.strokeWidth * u}
    />
  );
};
