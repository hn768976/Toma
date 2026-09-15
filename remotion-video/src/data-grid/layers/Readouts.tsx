import { READOUTS, readoutText } from "../field";
import { loopSin } from "../loop";
import { type Camera, hazeAt, project } from "../projection";
import type { Theme } from "../theme";

// Arial and Liberation Sans share metrics, so the readouts set
// identically on macOS, Windows and Linux render farms.
export const READOUT_FONT =
  '"Liberation Sans", Arial, Helvetica, "DejaVu Sans", sans-serif';

const TIER_ALPHA = [0.62, 0.85, 1];

/** The floating numeric values. */
export const Readouts: React.FC<{
  theme: Theme;
  camera: Camera;
  frame: number;
  s: number;
}> = ({ theme, camera, frame, s }) => {
  const colors = [theme.textDim, theme.textMid, theme.textHot];

  return (
    <>
      {READOUTS.map((readout, i) => {
        const p = project(readout.wx, readout.wy, readout.wz, camera);
        if (!p.onScreen || p.fade <= 0.01) return null;

        const pulse = 1 + 0.12 * loopSin(frame, 2, readout.phase);
        // Below ~7px the digits are unreadable mush that only muddies
        // the field, so distant readouts drop out rather than shrink on.
        const fontSize = readout.size * p.scale;
        if (fontSize < 7) return null;

        const opacity =
          p.fade * TIER_ALPHA[readout.tier] * hazeAt(p.depth) * pulse;
        if (opacity <= 0.02) return null;

        const glowRadius = readout.tier === 2 ? 0.85 : 0.4;

        return (
          <div
            key={i}
            style={{
              position: "absolute",
              left: p.x * s,
              top: p.y * s,
              transform: "translate(-50%, -50%)",
              fontFamily: READOUT_FONT,
              fontSize: fontSize * s,
              fontWeight: readout.tier === 0 ? 400 : 700,
              letterSpacing: fontSize * s * 0.02,
              lineHeight: 1,
              whiteSpace: "nowrap",
              color: colors[readout.tier],
              opacity: Math.min(1, opacity),
              textShadow: `0 0 ${fontSize * s * glowRadius}px ${theme.glow}`,
            }}
          >
            {readoutText(readout, frame)}
          </div>
        );
      })}
    </>
  );
};
