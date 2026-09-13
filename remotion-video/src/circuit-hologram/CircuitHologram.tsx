import React, { useMemo } from "react";
import { AbsoluteFill, useCurrentFrame, useVideoConfig } from "remotion";
import { z } from "zod";
import "./load-fonts";
import { AiChipHologram, CHIP_PAD, CHIP_SIZE, CHIP_VIEW } from "./AiChipHologram";
import { CircuitBoard } from "./CircuitBoard";
import { CloudHologram, CLOUD_HEIGHT, CLOUD_WIDTH } from "./CloudHologram";
import {
  BACKGROUND_COLOR,
  BASE_HEIGHT,
  BASE_WIDTH,
  BOARD_CENTER_X,
  BOARD_CENTER_Y,
  BOARD_HEIGHT,
  BOARD_WIDTH,
} from "./constants";
import { FloatingLabels } from "./FloatingLabels";
import { buildCloudOutline, buildRoundedRectOutline, transformPoints } from "./geometry";
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
const HOLO_Y = 0.56;

// Camera: the board is a flat plane tilted away from the viewer and
// turned so its "horizontal" traces run down-right and its "vertical"
// traces run down-left, exactly like the reference's two-point
// perspective. The hologram lies ON that plane so it shares the
// perspective (its flat bottom edge runs parallel to the traces).
const BOARD_TILT = 52; // degrees, rotateX
const BOARD_TURN = 22; // degrees, rotateZ
const PERSPECTIVE = 1050;

// Hologram size on the board, in board units (the SVGs are authored
// at CLOUD_WIDTH x CLOUD_HEIGHT / CHIP_VIEW x CHIP_VIEW and scaled).
const CLOUD_SCALE = 1.3;
const CHIP_SCALE = 1.1;

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

  // Hologram geometry: local outline (SVG units), its placement on the
  // board, and the same outline in board units (the "hub" every trace
  // is routed to).
  const holo = useMemo(() => {
    if (variant === "cloud") {
      const local = buildCloudOutline();
      const scale = CLOUD_SCALE;
      const left = BOARD_CENTER_X - (CLOUD_WIDTH / 2) * scale;
      const top = BOARD_CENTER_Y - (CLOUD_HEIGHT / 2) * scale;
      return { local, scale, left, top, width: CLOUD_WIDTH, height: CLOUD_HEIGHT, hub: transformPoints(local, left, top, scale) };
    }
    const local = buildRoundedRectOutline(CHIP_PAD, CHIP_PAD, CHIP_SIZE, CHIP_SIZE, 26);
    const scale = CHIP_SCALE;
    const left = BOARD_CENTER_X - (CHIP_VIEW / 2) * scale;
    const top = BOARD_CENTER_Y - (CHIP_VIEW / 2) * scale;
    // Route traces to the outer edge of the pins, not the package.
    const pinOutline = buildRoundedRectOutline(CHIP_PAD - 44, CHIP_PAD - 44, CHIP_SIZE + 88, CHIP_SIZE + 88, 30);
    return { local, scale, left, top, width: CHIP_VIEW, height: CHIP_VIEW, hub: transformPoints(pinOutline, left, top, scale) };
  }, [variant]);

  // Slow camera drift: a gentle push-in with a lateral sway and a tiny
  // change of viewing angle so the perspective feels alive.
  const t = frame / durationInFrames;
  const camScale = 1.0 + 0.04 * (1 - Math.cos(t * Math.PI * 2)) * 0.5 + 0.03 * t;
  const camX = Math.sin(t * Math.PI * 2) * 18;
  const camY = Math.cos(t * Math.PI * 2 * 0.5) * 10;
  const boardTilt = BOARD_TILT + Math.sin(t * Math.PI * 2) * 1.0;
  const boardTurn = BOARD_TURN + Math.cos(t * Math.PI * 2) * 1.2;

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
            perspective: PERSPECTIVE,
            perspectiveOrigin: `${HOLO_X * 100}% ${HOLO_Y * 100}%`,
            transform: `translate(${camX}px, ${camY}px) scale(${camScale})`,
            transformOrigin: `${HOLO_X * 100}% ${HOLO_Y * 100}%`,
          }}
        >
          {/* Tilted circuit board with the hologram lying on it. */}
          <div
            style={{
              position: "absolute",
              left: BASE_WIDTH * HOLO_X - BOARD_WIDTH / 2,
              top: BASE_HEIGHT * HOLO_Y - BOARD_HEIGHT / 2,
              width: BOARD_WIDTH,
              height: BOARD_HEIGHT,
              transform: `rotateX(${boardTilt}deg) rotateZ(${boardTurn}deg)`,
              transformOrigin: "50% 50%",
            }}
          >
            <CircuitBoard seed={seed} hub={holo.hub} />
            <div
              style={{
                position: "absolute",
                left: holo.left,
                top: holo.top,
                width: holo.width * holo.scale,
                height: holo.height * holo.scale,
              }}
            >
              <div style={{ transform: `scale(${holo.scale})`, transformOrigin: "top left" }}>
                {variant === "cloud" ? (
                  <CloudHologram frame={frame} points={holo.local} />
                ) : (
                  <AiChipHologram frame={frame} points={holo.local} />
                )}
              </div>
            </div>
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
