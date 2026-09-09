import React from "react";
import { AbsoluteFill, useCurrentFrame, useVideoConfig } from "remotion";
import { DURATION_IN_FRAMES } from "../constants";
import { makeRandom, range } from "../lib/random";

const TAU = Math.PI * 2;

type Bokeh = {
  /** 0..1 across the frame width. */
  x: number;
  /** 0..1 down one wrap length (= one frame height). */
  y: number;
  /** Diameter as a fraction of frame height. */
  size: number;
  /** 0 = a soft blob, 1 = an almost in-focus disc with a bright rim. */
  focus: number;
  opacity: number;
  /** Sideways sway amplitude, fraction of frame height. */
  sway: number;
  phase: number;
  hue: number;
};

const BOKEH: Bokeh[] = (() => {
  const rng = makeRandom("neon-bokeh");
  return Array.from({ length: 90 }, () => {
    // Most of the field is well out of focus, with a handful of near-sharp
    // specks — that is what reads as depth rather than as a dot pattern.
    const focus = Math.pow(rng(), 1.9);
    return {
      x: rng(),
      y: rng(),
      size: range(rng, 0.004, 0.075) * (1.25 - focus),
      focus,
      opacity: range(rng, 0.14, 0.55) * (0.45 + focus * 0.9),
      sway: range(rng, 0.01, 0.05),
      phase: rng() * TAU,
      hue: range(rng, 200, 222),
    };
  });
})();

type Ghost = {
  /** Angle and radius place the tile on an annulus, clear of the card. */
  angle: number;
  radius: number;
  /** Edge length as a fraction of frame height. */
  size: number;
  blur: number;
  opacity: number;
  drift: number;
  phase: number;
  tilt: number;
};

const GHOSTS: Ghost[] = (() => {
  const rng = makeRandom("neon-ghost-tiles");
  return Array.from({ length: 11 }, (_, i) => ({
    angle: (i / 11) * TAU + range(rng, -0.3, 0.3),
    radius: range(rng, 0.34, 0.78),
    size: range(rng, 0.3, 0.72),
    blur: range(rng, 0.009, 0.026),
    opacity: range(rng, 0.07, 0.19),
    drift: range(rng, 0.01, 0.045),
    phase: rng() * TAU,
    tilt: range(rng, -7, 7),
  }));
})();

export const NeonBackground: React.FC = () => {
  const frame = useCurrentFrame();
  const { width, height } = useVideoConfig();
  // t goes 0 -> 1 across the loop. Every motion below is either a full
  // integer number of wraps or a sine of TAU * t, so frame 300 == frame 0.
  const t = frame / DURATION_IN_FRAMES;

  return (
    <AbsoluteFill
      style={{
        // Deep navy, darkest into the corners.
        background: `radial-gradient(ellipse 62% 68% at 50% 48%, #0d1b38 0%, #08122a 42%, #060c1e 70%, #03060f 100%)`,
      }}
    >
      {/* Ghost tiles: out-of-focus periodic-table squares well behind the
          card. They give the frame context without stating anything. */}
      {GHOSTS.map((g, i) => {
        const a = g.angle + Math.sin(TAU * t + g.phase) * 0.05;
        const r = g.radius + Math.sin(TAU * t + g.phase * 1.7) * g.drift;
        const s = g.size * height;
        return (
          <div
            key={i}
            style={{
              position: "absolute",
              left: width / 2 + Math.cos(a) * r * height - s / 2,
              top: height / 2 + Math.sin(a) * r * height - s / 2,
              width: s,
              height: s,
              borderRadius: s * 0.08,
              border: `${s * 0.022}px solid rgba(138,190,255,0.75)`,
              boxShadow: `inset 0 0 ${s * 0.12}px rgba(90,150,230,0.35)`,
              opacity: g.opacity,
              filter: `blur(${g.blur * height}px)`,
              transform: `rotate(${g.tilt + Math.sin(TAU * t + g.phase) * 1.5}deg)`,
            }}
          />
        );
      })}

      {/* Bokeh. Positions repeat every frame-height, and the field scrolls by
          exactly one frame-height over the loop, so the wrap is invisible and
          the last frame lands back on the first. Two copies of each particle
          are drawn, one wrap apart, to cover the seam. */}
      {BOKEH.map((b, i) => {
        const d = b.size * height;
        const x = b.x * width + Math.sin(TAU * t + b.phase) * b.sway * height;
        const scrolled = (b.y - t) % 1;
        const baseY = (scrolled < 0 ? scrolled + 1 : scrolled) * height;
        // A bokeh disc is bright to its edge and then stops; a defocused one
        // falls off from the middle. focus interpolates between the two.
        const core = 8 + b.focus * 78;
        const rim = b.focus * 0.5;
        const colour = (a: number) => `hsla(${b.hue}, 92%, 78%, ${a})`;
        return [0, 1].map((k) => (
          <div
            key={`${i}-${k}`}
            style={{
              position: "absolute",
              left: x - d / 2,
              top: baseY + k * height - height / 2 - d / 2,
              width: d,
              height: d,
              borderRadius: "50%",
              background: `radial-gradient(circle, ${colour(b.opacity)} 0%, ${colour(b.opacity * (0.85 + rim))} ${core}%, ${colour(0)} 100%)`,
            }}
          />
        ));
      })}

      {/* Soft blue glow sitting behind where the card will be. */}
      <AbsoluteFill
        style={{
          background: `radial-gradient(circle ${height * 0.42}px at 50% 50%, rgba(58,168,255,${0.2 + Math.sin(TAU * t) * 0.03}) 0%, rgba(45,130,215,0.08) 45%, rgba(30,90,180,0) 72%)`,
        }}
      />
    </AbsoluteFill>
  );
};
