// V05 "Circuit Flythrough" - 15s.
//
// Reference: a rush through glowing PCB traces that decelerates into a clean
// reveal of the board. The whole version is one continuous camera move; the
// sense of speed comes from stacked trace planes passing the lens, and the
// deceleration is carried by an ease-out so the arrival feels earned.

import React from "react";
import { useCurrentFrame, useVideoConfig } from "remotion";
import { drift, easeOutQuint, envelope, remap } from "../anim";
import { Backdrop } from "../layers/Backdrop";
import { CameraRig } from "../layers/CameraRig";
import { CircuitField } from "../layers/CircuitField";
import { Glow } from "../layers/Glow";
import { HeroCircuitry } from "../layers/HeroCircuitry";
import { NeuralCanvas } from "../layers/NeuralCanvas";
import { ParticleField } from "../layers/ParticleField";
import { paletteFor } from "../palette";

// Trace planes the camera flies through, nearest last.
const PLANES = [10.5, 8.2, 6.1, 4.0, 1.9, -0.2, -2.4, -4.8];

export const V05Flythrough: React.FC = () => {
  const frame = useCurrentFrame();
  const { width, height, durationInFrames, fps } = useVideoConfig();
  const palette = paletteFor("V05Flythrough");

  const t = frame / fps;
  const p = frame / Math.max(1, durationInFrames - 1);
  const fade = envelope(p, 0.03, 0.93);

  // Ease-out: most of the distance is covered early, so the move reads as a
  // rush that brakes rather than a constant glide.
  const camZ = 15.5 - easeOutQuint(remap(p, 0, 0.88)) * 10.9;
  const camX = drift(t, 0.5) * 0.3 * (1 - remap(p, 0.3, 0.9));
  const camY = drift(t, 0.42, 1.9) * 0.22 * (1 - remap(p, 0.3, 0.9));
  const roll = drift(t, 0.3, 0.6) * 0.05 * (1 - remap(p, 0.2, 0.85));

  // The hero only resolves once the camera has nearly stopped.
  const reveal = easeOutQuint(remap(p, 0.58, 0.93));

  return (
    <NeuralCanvas background="#000000" camera={{ fov: 62, position: [0, 0, 15.5] }}>
      {(geometry) => (
        <>
          <CameraRig position={[camX, camY, camZ]} lookAt={[camX * 0.3, camY * 0.3, camZ - 6]} fov={62} roll={roll} />

          <Backdrop
            inner={palette.backgroundLift}
            outer={palette.background}
            aspect={width / height}
            radius={1.3}
            vignette={0.55}
          />

          {PLANES.map((z, i) => (
            <CircuitField
              key={z}
              count={70}
              width={7.5}
              height={5}
              pitch={0.28}
              steps={8}
              horizontalBias={i % 2 === 0 ? 0.6 : 0.4}
              diagonalChance={0.25}
              seed={1200 + i * 37}
              colour={palette.primary}
              pulseColour={palette.accent}
              base={0.18}
              pulse={1.25}
              speed={0.28 + i * 0.015}
              pulseLength={0.6}
              opacity={0.9 * fade}
              falloffRadius={9}
              position={[0, 0, z]}
              padSize={34}
            />
          ))}

          <ParticleField
            count={900}
            bounds={[7, 4.5, 11]}
            colour={palette.particle}
            size={115}
            opacity={0.6 * fade}
            rise={0.05}
            sway={0.08}
            twinkle={0.7}
            seed={1299}
            position={[0, 0, 3]}
          />

          <HeroCircuitry
            geometry={geometry}
            palette={palette}
            glow={1.05 * fade}
            reveal={reveal}
            scanY={-1.6 + remap(p, 0.58, 0.95) * 3.2}
            scanGain={0.7}
            pulse={0.8}
            coreHeat={0.1}
            fill={0.13}
            scale={0.9}
          />

          <Glow strength={1.7} threshold={0.18} knee={0.32} spread={1.05} radius={2.3} />
        </>
      )}
    </NeuralCanvas>
  );
};
