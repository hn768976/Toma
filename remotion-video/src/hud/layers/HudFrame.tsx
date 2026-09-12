import React, { useMemo } from "react";
import { useCurrentFrame } from "remotion";
import { BASE_HEIGHT, BASE_WIDTH, LOOP } from "../constants";
import type { HudTheme } from "../theme";

// The chamfered border that wraps the whole frame: the outer edge sits
// high across the middle of the top and dips at both corners via a 45deg
// step, mirrored along the bottom. A short bright dash is driven around
// the same path once per loop as a scan runner -- animating
// strokeDashoffset against a normalised pathLength means the lap timing
// is exact without having to measure the geometry.
export const HudFrame: React.FC<{
  theme: HudTheme;
  /** distance from the frame edge to the raised run */
  outer?: number;
  /** distance from the frame edge to the dropped corner run */
  inner?: number;
  /** how far the dropped run extends from each corner */
  shoulder?: number;
  /** length of the 45deg step */
  step?: number;
  /** set false to drop the vertical side rails */
  rails?: boolean;
}> = ({
  theme,
  outer = 26,
  inner = 66,
  shoulder = 250,
  step = 40,
  rails = true,
}) => {
  const frame = useCurrentFrame();
  const W = BASE_WIDTH;
  const H = BASE_HEIGHT;

  const { border, railPath } = useMemo(() => {
    const pts: [number, number][] = [
      [outer, inner],
      [shoulder, inner],
      [shoulder + step, outer],
      [W - shoulder - step, outer],
      [W - shoulder, inner],
      [W - outer, inner],
      [W - outer, H - inner],
      [W - shoulder, H - inner],
      [W - shoulder - step, H - outer],
      [shoulder + step, H - outer],
      [shoulder, H - inner],
      [outer, H - inner],
    ];
    const d = `M${pts.map(([x, y]) => `${x} ${y}`).join("L")}Z`;
    // Side rails are drawn separately so they can sit at a lower opacity
    // than the top/bottom runs, as in the reference.
    const r = `M${outer} ${inner}V${H - inner}M${W - outer} ${inner}V${H - inner}`;
    return { border: d, railPath: r };
  }, [W, H, outer, inner, shoulder, step]);

  const corners = useMemo(() => {
    const L = 54;
    const m = outer + 16;
    return [
      `M${m} ${m + L}V${m}H${m + L}`,
      `M${W - m - L} ${m}H${W - m}V${m + L}`,
      `M${m} ${H - m - L}V${H - m}H${m + L}`,
      `M${W - m - L} ${H - m}H${W - m}V${H - m - L}`,
    ].join("");
  }, [W, H, outer]);

  const lap = (frame / LOOP) * 1000;

  return (
    <g>
      <path d={border} fill="none" stroke={theme.lineSoft} strokeWidth={2.4} />
      {rails ? null : (
        <path d={railPath} stroke={theme.bgBase} strokeWidth={4} fill="none" />
      )}
      <path d={corners} fill="none" stroke={theme.line} strokeWidth={3} opacity={0.8} />
      <path
        d={border}
        fill="none"
        stroke={theme.accent}
        strokeWidth={3.4}
        pathLength={1000}
        strokeDasharray="26 974"
        strokeDashoffset={-lap}
        strokeLinecap="round"
        opacity={0.9}
      />
      <path
        d={border}
        fill="none"
        stroke={theme.accent}
        strokeWidth={3.4}
        pathLength={1000}
        strokeDasharray="26 974"
        strokeDashoffset={-(lap + 500)}
        strokeLinecap="round"
        opacity={0.5}
      />
    </g>
  );
};
