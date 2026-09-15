import {
  BAND_LOG,
  BASE_HEIGHT,
  BASE_WIDTH,
  CENTER_X,
  CENTER_Y,
  CURVE,
} from "../constants";
import { GRID } from "../field";
import { type Camera, bandFade, bandPhase, hazeAt } from "../projection";
import type { Theme } from "../theme";

/**
 * The perspective grid. Lines ride the same zoom band as everything
 * else, so they drift outward from centre and recycle. Verticals stay
 * straight; horizontals are quadratic Beziers bowed by CURVE — the same
 * curve `bowY` applies to every element, so dots and readouts land
 * exactly on the lines.
 */
export const GridPlanes: React.FC<{
  theme: Theme;
  camera: Camera;
  s: number;
}> = ({ theme, camera, s }) => {
  const w = BASE_WIDTH * s;
  const h = BASE_HEIGHT * s;
  const cx = CENTER_X * s;
  const cy = CENTER_Y * s;

  const live = (seed: number) => {
    const e = bandPhase(seed, camera);
    return { zoom: Math.exp(e * BAND_LOG), fade: bandFade(e), e };
  };

  return (
    <svg
      width={w}
      height={h}
      viewBox={`0 0 ${w} ${h}`}
      style={{ position: "absolute", inset: 0 }}
    >
      {GRID.vertical.map((line, i) => {
        const { zoom, fade, e } = live(line.seed);
        if (fade <= 0.001) return null;
        const x = cx + (line.offset - camera.driftX) * zoom * s;
        if (x < -40 * s || x > w + 40 * s) return null;
        return (
          <line
            key={`v${i}`}
            x1={x}
            y1={0}
            x2={x}
            y2={h}
            stroke={line.hot ? theme.lineHot : theme.line}
            strokeWidth={(line.hot ? 1.5 : 1) * s}
            opacity={fade * line.alpha * hazeAt(e)}
          />
        );
      })}

      {GRID.horizontal.map((line, i) => {
        const { zoom, fade, e } = live(line.seed);
        if (fade <= 0.001) return null;
        const y = cy + (line.offset - camera.driftY) * zoom * s;
        if (y < -40 * s || y > h + 40 * s) return null;
        const ctrlY = y - CURVE * (y - cy);
        return (
          <path
            key={`h${i}`}
            d={`M 0 ${y} Q ${w / 2} ${ctrlY} ${w} ${y}`}
            fill="none"
            stroke={line.hot ? theme.lineHot : theme.line}
            strokeWidth={(line.hot ? 1.4 : 1) * s}
            opacity={fade * line.alpha * hazeAt(e) * 0.9}
          />
        );
      })}
    </svg>
  );
};
