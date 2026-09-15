// V03 "Fiber Tractography" - 20s.
//
// Reference: a filament brain with a white-hot core, over a circuit field
// streaking past hard enough to smear. The energy here is the highest of the
// set, so the camera pushes in continuously and the streaks run fast.

import React from "react";
import { useCurrentFrame, useVideoConfig } from "remotion";
import { drift, easeOutQuint, envelope, ramp, remap } from "../anim";
import { Backdrop } from "../layers/Backdrop";
import { Flare } from "../layers/Beams";
import { CameraRig } from "../layers/CameraRig";
import { CircuitField } from "../layers/CircuitField";
import { DataStreams } from "../layers/DataStreams";
import { Filaments } from "../layers/Filaments";
import { Glow } from "../layers/Glow";
import { HeroCircuitry } from "../layers/HeroCircuitry";
import { NeuralCanvas } from "../layers/NeuralCanvas";
import { ParticleField } from "../layers/ParticleField";
import { paletteFor } from "../palette";

export const V03Fibers: React.FC = () => {
  const frame = useCurrentFrame();
  const { width, height, durationInFrames, fps } = useVideoConfig();
  const palette = paletteFor("V03Fibers");

  const t = frame / fps;
  const p = frame / Math.max(1, durationInFrames - 1);
  const fade = envelope(frame);

  const reveal = easeOutQuint(remap(p, 0.04, 0.34));
  const fibresIn = ramp(p, 0.0, 0.2);

  // Continuous push-in: this version never rests.
  const camZ = 5.4 - remap(p, 0, 1) * 1.0;
  const camX = drift(t, 0.12) * 0.16;
  const camY = drift(t, 0.1, 0.8) * 0.1;
  const roll = drift(t, 0.05, 2.2) * 0.012;

  // Core heartbeat, a touch faster than the other versions.
  const beat = 1 + Math.sin(t * 1.15) * 0.12 + Math.sin(t * 2.7) * 0.04;

  return (
    <NeuralCanvas background="#000000" camera={{ fov: 40, position: [0, 0, 5.4] }}>
      {(geometry) => (
        <>
          <CameraRig position={[camX, camY, camZ]} fov={40} roll={roll} />

          <Backdrop
            inner={palette.backgroundLift}
            outer={palette.background}
            aspect={width / height}
            radius={1.05}
            vignette={0.6}
          />

          {/* Board fragments flying past, well behind and out of focus by
              virtue of being small and fast rather than actually blurred. */}
          <CircuitField
            count={170}
            width={11}
            height={5.5}
            pitch={0.2}
            steps={5}
            horizontalBias={0.8}
            diagonalChance={0.3}
            seed={731}
            colour={palette.primary}
            pulseColour={palette.accent}
            base={0.12}
            pulse={1.3}
            speed={0.5}
            pulseLength={0.45}
            opacity={0.85 * fade}
            falloffRadius={13}
            position={[0, 0, -4.2]}
            showPads={false}
          />

          <DataStreams
            count={260}
            span={26}
            height={5.2}
            depth={4.5}
            colour={palette.signal}
            speed={4.2}
            lengthRange={[0.8, 5.5]}
            opacity={0.8 * fade}
            clearBand={0.9}
            seed={732}
            position={[0, 0, -2.6]}
          />

          <ParticleField
            count={700}
            bounds={[8, 4.5, 4]}
            colour={palette.particle}
            size={95}
            opacity={0.6 * fade}
            rise={0.3}
            sway={0.1}
            twinkle={0.75}
            seed={733}
          />

          <Filaments
            count={420}
            segments={20}
            innerRadius={0.2}
            outerRadius={2.9}
            squash={0.82}
            depth={0.45}
            curl={0.2}
            colour={palette.primary}
            tipColour={palette.core}
            brightness={0.78 * beat}
            flowSpeed={0.3}
            opacity={0.62 * fibresIn * fade}
            seed={734}
            position={[0, 0, -0.35]}
          />

          <HeroCircuitry
            geometry={geometry}
            palette={palette}
            glow={1.0 * beat * fade}
            reveal={reveal}
            scanY={-1.5 + ((t % 4.5) / 4.5) * 3.0}
            scanGain={0.6}
            pulse={1.0}
            coreHeat={0.07}
            fill={0.12}
            scale={0.86}
          />

          {/* The hot centre the fibres appear to stream out of. */}
          <Flare
            colour={palette.core}
            size={1.5}
            intensity={0.22 * beat * ramp(p, 0.06, 0.3)}
            streak={1.6}
            opacity={fade}
            position={[0, 0, 0.12]}
          />

          <Glow strength={1.5} threshold={0.22} knee={0.3} spread={0.9} radius={2.25} />
        </>
      )}
    </NeuralCanvas>
  );
};
