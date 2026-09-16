// V04 "Pedestal Rays" - 15s.
//
// Reference: the circuitry hovers over a raked circuit floor with a bright base
// ring beneath it, lit by shafts falling from above. Softer and cooler than the
// rest of the set - this one is lit, not self-luminous, so the hero glow is
// held back and the shafts do the work.

import React from "react";
import { useCurrentFrame, useVideoConfig } from "remotion";
import { drift, easeInOutCubic, easeOutQuint, envelope, ramp, remap } from "../anim";
import { Backdrop } from "../layers/Backdrop";
import { Flare, LightShafts } from "../layers/Beams";
import { CameraRig } from "../layers/CameraRig";
import { CircuitField } from "../layers/CircuitField";
import { Glow } from "../layers/Glow";
import { GridFloor } from "../layers/GridFloor";
import { HaloRings } from "../layers/HaloRings";
import { HeroCircuitry } from "../layers/HeroCircuitry";
import { NeuralCanvas } from "../layers/NeuralCanvas";
import { ParticleField } from "../layers/ParticleField";
import { paletteFor } from "../palette";

const FLOOR_Y = -1.7;

export const V04Pedestal: React.FC = () => {
  const frame = useCurrentFrame();
  const { width, height, durationInFrames, fps } = useVideoConfig();
  const palette = paletteFor("V04Pedestal");

  const t = frame / fps;
  const p = frame / Math.max(1, durationInFrames - 1);
  const fade = envelope(frame);

  // Only 15s, so the reveal has to be quicker than the 25s versions.
  const reveal = easeOutQuint(remap(p, 0.05, 0.4));
  const baseIn = ramp(p, 0.0, 0.14);

  const camY = 0.55 - easeInOutCubic(remap(p, 0, 0.9)) * 0.35 + drift(t, 0.09) * 0.05;
  const camZ = 5.5 - easeInOutCubic(remap(p, 0, 0.9)) * 0.75;
  const hover = Math.sin(t * 0.62) * 0.07;

  return (
    <NeuralCanvas background="#000000" camera={{ fov: 40, position: [0, 0.5, 5.5] }}>
      {(geometry) => (
        <>
          <CameraRig position={[drift(t, 0.07, 1.1) * 0.18, camY, camZ]} lookAt={[0, 0.1, 0]} fov={40} />

          <Backdrop
            inner={palette.backgroundLift}
            outer={palette.background}
            aspect={width / height}
            focus={[0, 0.15]}
            radius={2.4}
          />

          {/* Circuitry laid into the floor plane, seen in perspective. */}
          <CircuitField
            count={420}
            width={8}
            height={8}
            pitch={0.26}
            steps={8}
            horizontalBias={0.5}
            seed={941}
            colour={palette.primary}
            pulseColour={palette.accent}
            base={0.22}
            pulse={0.9}
            speed={0.16}
            pulseLength={0.8}
            traceWidth={0.035}
            softness={0.5}
            opacity={0.9 * fade}
            falloffRadius={0}
            position={[0, FLOOR_Y + 0.01, 0]}
            rotation={[-Math.PI / 2, 0, 0]}
            padSize={30}
          />

          <GridFloor
            colour={palette.primary}
            ringColour={palette.accent}
            size={60}
            pitch={1.1}
            lineWidth={0.9}
            scroll={0.14}
            fadeDistance={18}
            brightness={0.38 * fade}
            rings={0.3 * baseIn}
            ringPeriod={5}
            opacity={fade}
            position={[0, FLOOR_Y, 0]}
          />

          {/* Base ring directly under the hero, lying flat on the floor. */}
          <HaloRings
            rings={[
              { radius: 0.72, width: 0.02, brightness: 1.1, spin: 0.05 },
              { radius: 0.92, width: 0.008, ticks: 72, tickDuty: 0.4, brightness: 0.55, spin: -0.04 },
              { radius: 1.15, width: 0.006, arcStart: 0.2, arcLength: 0.3, brightness: 0.7, spin: 0.09 },
            ]}
            colour={palette.accent}
            extent={1.4}
            opacity={baseIn * fade}
            position={[0, FLOOR_Y + 0.02, 0]}
            rotation={[-Math.PI / 2, 0, 0]}
          />

          <Flare
            colour={palette.core}
            size={0.65}
            intensity={0.3 * baseIn}
            streak={0.8}
            opacity={fade}
            position={[0, FLOOR_Y + 0.05, 0.02]}
          />

          <LightShafts
            colour={palette.accent}
            width={13}
            height={7.5}
            count={6}
            slant={0.22}
            intensity={0.8 * ramp(p, 0.02, 0.3)}
            opacity={fade}
            position={[0, 1.9, -2.4]}
          />

          <ParticleField
            count={1100}
            bounds={[6, 3.8, 3.2]}
            colour={palette.particle}
            size={120}
            opacity={0.9 * fade}
            rise={-0.14}
            sway={0.14}
            twinkle={0.6}
            seed={942}
            position={[0, 0.2, 0]}
          />

          <HeroCircuitry
            geometry={geometry}
            palette={palette}
            glow={1.2 * fade}
            reveal={reveal}
            scanY={-1.5 + ((t % 5) / 5) * 3.0}
            scanGain={0.4}
            pulse={0.55}
            coreHeat={0.07}
            fill={0.16}
            scale={0.74}
            position={[0, 0.35 + hover, 0]}
          />

          <Glow strength={1.35} threshold={0.26} knee={0.3} spread={0.85} radius={2.05} />
        </>
      )}
    </NeuralCanvas>
  );
};
