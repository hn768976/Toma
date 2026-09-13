import React from "react";
import { AbsoluteFill, useCurrentFrame, useVideoConfig } from "remotion";
import { z } from "zod";
import "./load-fonts";
import { AiChipHologram, CHIP_VIEW } from "./AiChipHologram";
import { CircuitBoard } from "./CircuitBoard";
import { CloudHologram, CLOUD_HEIGHT, CLOUD_WIDTH } from "./CloudHologram";
import { BACKGROUND_COLOR, BASE_HEIGHT, BASE_WIDTH, BOARD_HEIGHT, BOARD_WIDTH } from "./constants";
import { FloatingLabels } from "./FloatingLabels";
import { mulberry32 } from "./random";

export const circuitHologramSchema = z.object({
  variant: z.enum(["cloud", "ai-chip"]),
  // 1 = 1080p (1920x1080), 2 = 4K (3840x2160). Must match the width and
  // height the Composition is registered with in Root.tsx.
  resolutionScale: z.number().positive(),
  seed: z.number().int(),
});

export type CircuitHologramProps = z.infer<typeof circuitHologramSchema>;

export const circuitHologramDefaults: CircuitHologramProps = {
  variant: "cloud",
  resolutionScale: 1,
  seed: 4,
};

// Screen position of the hologram (fraction of the frame), matching the
// off-centre framing of the reference.
const HOLO_X = 0.585;
const HOLO_Y = 0.55;

// Soft, slowly drifting bokeh discs in front of the board.
const Bokeh: React.FC<{ frame: number }> = ({ frame }) => {
  const rng = mulberry32(99);
  const discs = Array.from({ length: 14 }, (_, i) => ({
    x: rng() * BASE_WIDTH,
    y: rng() * BASE_HEIGHT,
    r: 6 + rng() * 26,
    speed: 0.15 + rng() * 0.35,
    phase: rng() * 6.28,
    color: i % 3 === 0 ? "#ff8a3d" : i % 3 === 1 ? "#4fe3ff" : "#7fb4ff",
  }));
  return (
    <AbsoluteFill style={{ filter: "blur(6px)", mixBlendMode: "screen" }}>
      {discs.map((d, i) => {
        const x = d.x + Math.sin(frame * 0.01 * d.speed + d.phase) * 60 - frame * d.speed * 0.4;
        const y = d.y + Math.cos(frame * 0.013 * d.speed + d.phase) * 40;
        const wrapped = ((x % (BASE_WIDTH + 200)) + BASE_WIDTH + 200) % (BASE_WIDTH + 200) - 100;
        const opacity = 0.25 + 0.2 * Math.sin(frame * 0.05 + d.phase);
        return (
          <div
            key={i}
            style={{
              position: "absolute",
              left: wrapped - d.r,
              top: y - d.r,
              width: d.r * 2,
              height: d.r * 2,
              borderRadius: "50%",
              background: d.color,
              opacity,
            }}
          />
        );
      })}
    </AbsoluteFill>
  );
};

export const CircuitHologram: React.FC<CircuitHologramProps> = ({ variant, resolutionScale, seed }) => {
  const frame = useCurrentFrame();
  const { durationInFrames } = useVideoConfig();

  // Slow camera drift: a gentle push-in with a lateral sway, plus a
  // little extra parallax on the hologram so it reads as floating above
  // the board.
  const t = frame / durationInFrames;
  const camScale = 1.04 + 0.05 * Math.sin(t * Math.PI * 2 - Math.PI / 2) * 0.5 + 0.025 * t;
  const camX = Math.sin(t * Math.PI * 2) * 22;
  const camY = Math.cos(t * Math.PI * 2 * 0.5) * 12;
  const boardTilt = 60 + Math.sin(t * Math.PI * 2) * 1.2;
  const boardSpin = 19 + Math.cos(t * Math.PI * 2) * 1.5;
  const holoBob = Math.sin(frame * 0.045) * 8;

  const holoWidth = variant === "cloud" ? CLOUD_WIDTH : CHIP_VIEW;
  const holoHeight = variant === "cloud" ? CLOUD_HEIGHT : CHIP_VIEW;
  const holoScale = variant === "cloud" ? 1.05 : 0.86;

  return (
    <AbsoluteFill style={{ backgroundColor: BACKGROUND_COLOR, overflow: "hidden" }}>
      {/* Everything is authored at 1920x1080 and scaled uniformly. */}
      <div
        style={{
          position: "absolute",
          width: BASE_WIDTH,
          height: BASE_HEIGHT,
          transform: `scale(${resolutionScale})`,
          transformOrigin: "top left",
          overflow: "hidden",
        }}
      >
        {/* Ambient light: blue bloom top-right, deep shadow bottom-left. */}
        <AbsoluteFill
          style={{
            background:
              "radial-gradient(ellipse 60% 50% at 84% 6%, rgba(38,96,230,0.5) 0%, rgba(20,50,140,0.18) 40%, rgba(2,5,15,0) 75%), radial-gradient(ellipse 55% 50% at 60% 55%, rgba(14,44,130,0.4) 0%, rgba(2,5,15,0) 70%), linear-gradient(135deg, #01030a 0%, #030a22 55%, #01040d 100%)",
          }}
        />

        <div
          style={{
            position: "absolute",
            inset: 0,
            perspective: 1500,
            perspectiveOrigin: "50% 40%",
            transform: `translate(${camX}px, ${camY}px) scale(${camScale})`,
            transformOrigin: `${HOLO_X * 100}% ${HOLO_Y * 100}%`,
          }}
        >
          {/* Tilted circuit board. */}
          <div
            style={{
              position: "absolute",
              left: BASE_WIDTH * HOLO_X - BOARD_WIDTH / 2,
              top: BASE_HEIGHT * HOLO_Y - BOARD_HEIGHT / 2,
              width: BOARD_WIDTH,
              height: BOARD_HEIGHT,
              transform: `rotateX(${boardTilt}deg) rotateZ(${boardSpin}deg)`,
              transformOrigin: "50% 50%",
            }}
          >
            <CircuitBoard seed={seed} />
          </div>

          {/* Hologram floating just above the board, tilted less so it stays readable. */}
          <div
            style={{
              position: "absolute",
              left: BASE_WIDTH * HOLO_X - holoWidth / 2,
              top: BASE_HEIGHT * HOLO_Y - holoHeight / 2 + holoBob,
              width: holoWidth,
              height: holoHeight,
              transform: `translateX(${camX * 0.4}px) rotateX(${boardTilt * 0.42}deg) rotateZ(${boardSpin * 0.35}deg) scale(${holoScale})`,
              transformOrigin: "50% 50%",
            }}
          >
            {variant === "cloud" ? <CloudHologram frame={frame} /> : <AiChipHologram frame={frame} />}
          </div>
        </div>

        {/* Shallow depth of field: blur the periphery of the tilted board. */}
        <AbsoluteFill
          style={{
            backdropFilter: "blur(5px)",
            WebkitBackdropFilter: "blur(5px)",
            maskImage: `radial-gradient(ellipse 48% 46% at ${HOLO_X * 100}% ${HOLO_Y * 100}%, rgba(0,0,0,0) 45%, rgba(0,0,0,1) 100%)`,
            WebkitMaskImage: `radial-gradient(ellipse 48% 46% at ${HOLO_X * 100}% ${HOLO_Y * 100}%, rgba(0,0,0,0) 45%, rgba(0,0,0,1) 100%)`,
          }}
        />

        <Bokeh frame={frame} />
        <FloatingLabels frame={frame} seed={seed + 100} durationInFrames={durationInFrames} />

        {/* Vignette and a faint blue haze over the hologram. */}
        <AbsoluteFill
          style={{
            background: `radial-gradient(ellipse 30% 32% at ${HOLO_X * 100}% ${HOLO_Y * 100}%, rgba(60,190,255,0.16) 0%, rgba(0,0,0,0) 100%), radial-gradient(ellipse 75% 70% at 50% 50%, rgba(0,0,0,0) 45%, rgba(0,1,6,0.9) 100%)`,
            pointerEvents: "none",
          }}
        />
      </div>
    </AbsoluteFill>
  );
};
