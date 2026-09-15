import { AbsoluteFill } from "remotion";
import { loopSin } from "../loop";
import type { Theme } from "../theme";

/** Faint wide vertical bands, as in the reference's brighter columns. */
const SHAFTS = [0.17, 0.38, 0.55, 0.78, 0.91];

export const Atmosphere: React.FC<{
  theme: Theme;
  frame: number;
  s: number;
}> = ({ theme, frame, s }) => {
  const breathe = 0.85 + 0.15 * loopSin(frame, 2);

  return (
    <>
      <AbsoluteFill
        style={{
          background: `radial-gradient(ellipse 75% 65% at 50% 50%, ${theme.bgInner} 0%, ${theme.bgMid} 55%, ${theme.bgOuter} 100%)`,
        }}
      />
      {SHAFTS.map((u, i) => (
        <div
          key={u}
          style={{
            position: "absolute",
            top: 0,
            bottom: 0,
            left: `${u * 100}%`,
            width: (90 + i * 26) * s,
            marginLeft: -((90 + i * 26) * s) / 2,
            background: `linear-gradient(to bottom, transparent 0%, ${theme.shaft} 45%, transparent 100%)`,
            opacity: 0.6 + 0.4 * loopSin(frame, i + 1, i * 1.7),
          }}
        />
      ))}
      <AbsoluteFill
        style={{
          background: `radial-gradient(ellipse 42% 38% at 50% 50%, ${theme.bloom} 0%, transparent 70%)`,
          opacity: breathe,
        }}
      />
    </>
  );
};

/** Vignette + a touch of bloom, drawn on top of the whole field. */
export const Vignette: React.FC<{ theme: Theme; s: number }> = ({
  theme,
  s,
}) => (
  <>
    <AbsoluteFill
      style={{
        background: `radial-gradient(ellipse 72% 66% at 50% 50%, transparent 40%, ${theme.bgOuter} 100%)`,
        opacity: 0.5,
      }}
    />
    <AbsoluteFill
      style={{
        boxShadow: `inset 0 0 ${170 * s}px ${45 * s}px ${theme.bgOuter}`,
      }}
    />
    <AbsoluteFill
      style={{
        background: `radial-gradient(ellipse 34% 30% at 50% 50%, ${theme.bloom} 0%, transparent 74%)`,
        opacity: 0.22,
        mixBlendMode: "screen",
      }}
    />
  </>
);
