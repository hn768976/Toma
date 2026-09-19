import { AbsoluteFill, useCurrentFrame, useVideoConfig } from "remotion";
import { SCANLINE_COUNT } from "./constants";
import { glitchAt } from "./glitch";

// Same avalanche hash as the glitch model — see the note there on why a
// counter-seeded PRNG is not good enough for per-frame values.
const rand = (index: number, salt: number) => {
  let h = Math.imul(index ^ 0x9e3779b9, 0x85ebca6b);
  h ^= h >>> 13;
  h = Math.imul(h ^ salt, 0xc2b2ae35);
  h ^= h >>> 16;
  return (h >>> 0) / 4294967296;
};

/**
 * The layer that sells "this is a compromised screen, not a render": CRT
 * scanlines over everything, a drifting bright band, occasional full-width
 * tear bars, and a vignette that ties the composite together.
 *
 * It sits above both the shader and the banner so the two share one set of
 * artefacts — glitching them separately is the usual tell that a piece was
 * assembled from layers.
 */
export const ScreenOverlay: React.FC = () => {
  const frame = useCurrentFrame();
  const { height } = useVideoConfig();
  const g = glitchAt(frame);

  const scanPeriod = height / SCANLINE_COUNT;

  // Full-width tear bars, only during stronger bursts.
  const bars = [];
  if (g.intensity > 0.38) {
    const count = 1 + Math.floor(rand(frame, 1201) * 3);
    for (let i = 0; i < count; i += 1) {
      const top = rand(frame * 17 + i, 3307);
      const h = 0.004 + rand(frame * 17 + i, 4409) * 0.03;
      const shift = (rand(frame * 17 + i, 5507) - 0.5) * 0.035 * g.intensity;
      bars.push({ top, h, shift, bright: rand(frame * 17 + i, 6089) });
    }
  }

  return (
    <AbsoluteFill style={{ pointerEvents: "none" }}>
      {/* Scanlines across the whole frame. */}
      <AbsoluteFill
        style={{
          backgroundImage: `repeating-linear-gradient(180deg, rgba(0,0,0,0.30) 0px, rgba(0,0,0,0.30) ${(scanPeriod * 0.5).toFixed(2)}px, rgba(0,0,0,0) ${(scanPeriod * 0.5).toFixed(2)}px, rgba(0,0,0,0) ${scanPeriod.toFixed(2)}px)`,
          mixBlendMode: "multiply",
          opacity: 0.55,
        }}
      />

      {/* Tear bars: thin horizontal strips of lifted, shifted brightness. */}
      {bars.map((b, i) => (
        <div
          key={i}
          style={{
            position: "absolute",
            left: `${(b.shift * 100).toFixed(2)}%`,
            top: `${(b.top * 100).toFixed(2)}%`,
            width: "100%",
            height: `${(b.h * 100).toFixed(2)}%`,
            backgroundColor:
              b.bright > 0.7 ? "rgba(255,120,130,0.07)" : "rgba(205,15,35,0.14)",
            mixBlendMode: "screen",
          }}
        />
      ))}

      {/*
        Corner falloff over the finished composite. Deliberately weak: the
        shader already vignettes the field, and stacking a strong second one
        here darkened the top of the frame far more than the reference does
        (its row means are flat from the top edge to mid frame). This layer
        exists only to pull the four corners down over the banner as well.
      */}
      <AbsoluteFill
        style={{
          background:
            "radial-gradient(ellipse 86% 104% at 50% 48%, rgba(0,0,0,0) 58%, rgba(0,0,0,0.20) 84%, rgba(0,0,0,0.45) 100%)",
        }}
      />

      {/* A single frame-wide flash on the hardest glitch frames. */}
      {g.hardCut ? (
        <AbsoluteFill
          style={{ backgroundColor: "rgba(255,40,60,0.10)", mixBlendMode: "screen" }}
        />
      ) : null}
    </AbsoluteFill>
  );
};
