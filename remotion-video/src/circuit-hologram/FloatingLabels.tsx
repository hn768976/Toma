import React, { useMemo } from "react";
import { interpolate } from "remotion";
import { BASE_HEIGHT, BASE_WIDTH, LABEL_COLOR } from "./constants";
import { MONO_FONT } from "./load-fonts";
import { mulberry32, pickFrom, rangeFrom } from "./random";

// The small telemetry read-outs ("07352", "618.8"...) that fade in and
// out around the scene in the reference. Each label has a fixed set of
// appearances over the 30 s, so nothing depends on render order.
type Appearance = { start: number; duration: number; x: number; y: number; text: string; size: number };

const TEXTS = ["07352", "618.8", "0x3F1A", "8842", "22.07", "1 0 1 1", "4F 9C", "0.9982", "73 1 2", "C0DE", "56.1 GB", "AI-NODE 07"];

export const FloatingLabels: React.FC<{ frame: number; seed: number; durationInFrames: number }> = ({ frame, seed, durationInFrames }) => {
  const appearances = useMemo(() => {
    const rng = mulberry32(seed);
    const list: Appearance[] = [];
    let t = 20;
    while (t < durationInFrames - 60) {
      const duration = rangeFrom(rng, 70, 130);
      // Keep labels away from the centre so they never sit on the hologram.
      const x = rangeFrom(rng, 80, BASE_WIDTH - 260);
      let y = rangeFrom(rng, 60, BASE_HEIGHT - 80);
      if (Math.abs(x - BASE_WIDTH * 0.58) < 320 && Math.abs(y - BASE_HEIGHT * 0.52) < 240) {
        y = y < BASE_HEIGHT * 0.52 ? BASE_HEIGHT * 0.2 : BASE_HEIGHT * 0.86;
      }
      list.push({ start: t, duration, x, y, text: pickFrom(rng, TEXTS), size: rangeFrom(rng, 18, 30) });
      // Overlap a second label occasionally.
      if (rng() < 0.5) {
        list.push({
          start: t + rangeFrom(rng, 10, 50),
          duration: rangeFrom(rng, 60, 110),
          x: rangeFrom(rng, 80, BASE_WIDTH - 260),
          y: rng() < 0.5 ? rangeFrom(rng, 50, 200) : rangeFrom(rng, BASE_HEIGHT - 240, BASE_HEIGHT - 60),
          text: pickFrom(rng, TEXTS),
          size: rangeFrom(rng, 16, 24),
        });
      }
      t += rangeFrom(rng, 55, 110);
    }
    return list;
  }, [seed, durationInFrames]);

  return (
    <div style={{ position: "absolute", inset: 0, fontFamily: `'${MONO_FONT}', monospace`, letterSpacing: 2 }}>
      {appearances.map((a, i) => {
        const local = frame - a.start;
        if (local < 0 || local > a.duration) return null;
        const opacity = interpolate(local, [0, 12, a.duration - 18, a.duration], [0, 1, 1, 0], {
          extrapolateLeft: "clamp",
          extrapolateRight: "clamp",
        });
        const rise = local * 0.18;
        // Glitchy in-between: the odd frame drops out, like a flaky read-out.
        const glitch = ((local * 7 + i * 13) % 29) === 0 ? 0.3 : 1;
        return (
          <div
            key={i}
            style={{
              position: "absolute",
              left: a.x,
              top: a.y - rise,
              color: LABEL_COLOR,
              fontSize: a.size,
              opacity: opacity * glitch,
              textShadow: `0 0 8px ${LABEL_COLOR}, 0 0 18px rgba(40,140,255,0.6)`,
              whiteSpace: "nowrap",
            }}
          >
            {a.text}
            <span style={{ display: "block", height: 1, background: LABEL_COLOR, opacity: 0.6, width: local < 20 ? `${Math.min(100, local * 5)}%` : "100%" }} />
          </div>
        );
      })}
    </div>
  );
};
