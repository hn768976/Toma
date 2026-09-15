import { BLOCKS, DASHES } from "../field";
import { loopSin } from "../loop";
import { type Camera, hazeAt, project } from "../projection";
import type { Theme } from "../theme";

/**
 * Short horizontal bars, and tight "barcode" runs of them — the tiny
 * data segments scattered through the reference field.
 */
export const Dashes: React.FC<{
  theme: Theme;
  camera: Camera;
  frame: number;
  s: number;
}> = ({ theme, camera, frame, s }) => (
  <>
    {DASHES.map((dash, i) => {
      const p = project(dash.bx, dash.by, dash.seed, camera);
      if (!p.onScreen || p.fade <= 0.01) return null;

      const blink =
        dash.blink === 0
          ? 1
          : 1 - dash.blink * (0.5 + 0.5 * loopSin(frame, 5, dash.phase));
      const opacity = p.fade * hazeAt(p.e) * (dash.hot ? 0.95 : 0.6) * blink;
      if (opacity <= 0.02) return null;

      const width = dash.length * p.zoom * s;
      const height = dash.thickness * p.zoom * s;

      return (
        <div
          key={i}
          style={{
            position: "absolute",
            left: p.x * s,
            top: p.y * s,
            width,
            height,
            marginLeft: -width / 2,
            marginTop: -height / 2,
            background: dash.hot ? theme.dashHot : theme.dash,
            opacity: Math.min(1, opacity),
            boxShadow: dash.hot ? `0 0 ${height * 3}px ${theme.glow}` : undefined,
          }}
        />
      );
    })}

    {BLOCKS.map((block, i) => {
      const p = project(block.bx, block.by, block.seed, camera);
      if (!p.onScreen || p.fade <= 0.01) return null;

      const flicker = 0.7 + 0.3 * loopSin(frame, 4, block.phase);
      const opacity = p.fade * hazeAt(p.e) * 0.9 * flicker;
      if (opacity <= 0.02) return null;

      const height = block.thickness * p.zoom * s;

      return (
        <div
          key={`b${i}`}
          style={{
            position: "absolute",
            left: p.x * s,
            top: p.y * s,
            opacity: Math.min(1, opacity),
          }}
        >
          {block.bars.map((bar, j) => (
            <div
              key={j}
              style={{
                position: "absolute",
                left: bar.dx * p.zoom * s,
                top: bar.dy * p.zoom * s,
                width: bar.length * p.zoom * s,
                height,
                background: theme.dashHot,
                boxShadow: `0 0 ${height * 2.5}px ${theme.glow}`,
              }}
            />
          ))}
        </div>
      );
    })}
  </>
);
