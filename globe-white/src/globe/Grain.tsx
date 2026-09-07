import { AbsoluteFill } from "remotion";

/**
 * A trace of grain so the flat white does not read as sterile.
 *
 * The seed cycles every 30 frames, which divides the 600-frame loop exactly, so
 * the grain loops with everything else. Multiply blending keeps it one-sided:
 * nothing can brighten pure white, so the grain only ever darkens.
 */
export const Grain: React.FC<{ opacity: number; frame: number }> = ({
  opacity,
  frame,
}) => {
  if (opacity <= 0) return null;
  const seed = frame % 30;
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="320" height="320"><filter id="g" x="0" y="0" width="100%" height="100%"><feTurbulence type="fractalNoise" baseFrequency="0.8" numOctaves="2" seed="${seed}" stitchTiles="stitch"/><feColorMatrix type="saturate" values="0"/></filter><rect width="320" height="320" filter="url(#g)"/></svg>`;

  return (
    <AbsoluteFill
      style={{
        backgroundImage: `url("data:image/svg+xml;utf8,${encodeURIComponent(svg)}")`,
        backgroundRepeat: "repeat",
        backgroundSize: "320px 320px",
        mixBlendMode: "multiply",
        opacity,
        pointerEvents: "none",
      }}
    />
  );
};
