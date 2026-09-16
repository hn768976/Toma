// V07 "HUD Reticle" - 25s.
//
// Reference: the circuitry locked inside a targeting reticle of counter-
// rotating rings and tick scales, over a dense blue PCB. The longest and most
// deliberate version - rings acquire, lock, then hold while the board works
// underneath.

import React from "react";
import { useCurrentFrame, useVideoConfig } from "remotion";
import { drift, easeInOutCubic, easeOutQuint, envelope, ramp, remap } from "../anim";
import { Backdrop } from "../layers/Backdrop";
import { CameraRig } from "../layers/CameraRig";
import { CircuitField } from "../layers/CircuitField";
import { Glow } from "../layers/Glow";
import { HaloRings } from "../layers/HaloRings";
import { HeroCircuitry } from "../layers/HeroCircuitry";
import { NeuralCanvas } from "../layers/NeuralCanvas";
import { ParticleField } from "../layers/ParticleField";
import { paletteFor } from "../palette";

export const V07Hud: React.FC = () => {
  const frame = useCurrentFrame();
  const { width, height, durationInFrames, fps } = useVideoConfig();
  const palette = paletteFor("V07Hud");

  const t = frame / fps;
  const p = frame / Math.max(1, durationInFrames - 1);
  const fade = envelope(frame);

  // Acquire: the reticle closes in from oversize, then locks.
  const acquire = easeOutQuint(remap(p, 0.02, 0.26));
  const reticleScale = 1.85 - acquire * 0.85;
  const lock = ramp(p, 0.24, 0.32);

  const reveal = easeOutQuint(remap(p, 0.16, 0.5));
  const camZ = 5.3 - easeInOutCubic(remap(p, 0, 0.9)) * 0.7;

  // Spin slows as the reticle locks on, rather than stopping dead.
  const spinScale = 1 - lock * 0.72;

  return (
    <NeuralCanvas background="#000000" camera={{ fov: 39, position: [0, 0, 5.3] }}>
      {(geometry) => (
        <>
          <CameraRig
            position={[drift(t, 0.06) * 0.14, drift(t, 0.05, 2.4) * 0.1, camZ]}
            fov={39}
          />

          <Backdrop
            inner={palette.backgroundLift}
            outer={palette.background}
            aspect={width / height}
            radius={2.4}
          />

          {/* Dense board filling the frame, the busiest of the set. */}
          {/* The board is the background, not a texture behind it: the
              reference runs dense, thick copper into all four corners, so this
              is authored to cover the frame at full strength rather than to sit
              in a pool behind the hero. */}
          <CircuitField
            count={620}
            width={5.8}
            height={3.4}
            pitch={0.2}
            steps={10}
            horizontalBias={0.56}
            diagonalChance={0.06}
            seed={771}
            colour={palette.primary}
            pulseColour={palette.accent}
            base={0.26}
            pulse={0.8}
            speed={0.14}
            pulseLength={0.8}
            traceWidth={0.019}
            softness={0.5}
            opacity={0.9 * fade}
            falloffRadius={0}
            clearRadius={1.55}
            position={[0, 0, -2.6]}
            padSize={34}
          />

          <ParticleField
            count={700}
            bounds={[7.5, 4.2, 3]}
            colour={palette.particle}
            size={95}
            opacity={0.5 * fade}
            rise={0.09}
            sway={0.12}
            twinkle={0.65}
            seed={772}
          />

          <HeroCircuitry
            geometry={geometry}
            palette={palette}
            glow={1.18 * fade}
            reveal={reveal}
            scanY={-1.5 + ((t % 6.5) / 6.5) * 3.0}
            scanGain={0.5}
            pulse={0.7}
            coreHeat={0.08}
            fill={0.12}
            scale={0.8}
          />

          {/* The reticle: fine inner scale, heavy lock ring, broken outer arcs.
              Amber is the palette's one warm accent and is used only here. */}
          <HaloRings
            rings={[
              { radius: 0.95, width: 0.004, ticks: 96, tickDuty: 0.3, brightness: 0.4, spin: -0.07 * spinScale },
              { radius: 1.2, width: 0.016, brightness: 0.95, spin: 0.03 * spinScale },
              { radius: 1.2, width: 0.026, arcStart: 0.0, arcLength: 0.06, brightness: 0.95, spin: -0.16 * spinScale },
              { radius: 1.2, width: 0.026, arcStart: 0.5, arcLength: 0.06, brightness: 0.95, spin: -0.16 * spinScale },
              { radius: 1.42, width: 0.007, arcStart: 0.12, arcLength: 0.26, brightness: 0.85, spin: 0.1 * spinScale },
              { radius: 1.42, width: 0.007, arcStart: 0.62, arcLength: 0.26, brightness: 0.85, spin: 0.1 * spinScale },
              { radius: 1.62, width: 0.024, ticks: 160, tickDuty: 0.45, brightness: 0.4, spin: -0.02 * spinScale },
              { radius: 1.86, width: 0.005, arcStart: 0.3, arcLength: 0.14, brightness: 0.7, spin: 0.06 * spinScale },
            ]}
            colour={palette.accent}
            extent={2.1}
            opacity={acquire * fade}
            scale={reticleScale}
          />

          <Glow strength={1.55} threshold={0.2} knee={0.3} spread={0.9} radius={2.05} />
        </>
      )}
    </NeuralCanvas>
  );
};
