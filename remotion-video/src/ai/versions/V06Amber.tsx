// V06 "Amber Core" - 10s.
//
// The warm outlier of the set, matching its reference: molten amber circuitry
// against a dark teal board with cyan data running horizontally through it. The
// complementary split is the whole point, so the background stays teal even
// where it would be easier to let the hero's glow bleed into it - hence the low
// glow spread and the clear band kept through the middle of the streams.
//
// At 10s this is the shortest version, so there is no slow build: the board is
// already live at frame 0 and the hero arrives almost immediately.

import React from "react";
import { useCurrentFrame, useVideoConfig } from "remotion";
import { drift, easeOutQuint, envelope, remap } from "../anim";
import { Backdrop } from "../layers/Backdrop";
import { CameraRig } from "../layers/CameraRig";
import { CircuitField } from "../layers/CircuitField";
import { DataStreams } from "../layers/DataStreams";
import { Glow } from "../layers/Glow";
import { HeroCircuitry } from "../layers/HeroCircuitry";
import { NeuralCanvas } from "../layers/NeuralCanvas";
import { ParticleField } from "../layers/ParticleField";
import { paletteFor } from "../palette";

export const V06Amber: React.FC = () => {
  const frame = useCurrentFrame();
  const { width, height, durationInFrames, fps } = useVideoConfig();
  const palette = paletteFor("V06Amber");

  const t = frame / fps;
  const p = frame / Math.max(1, durationInFrames - 1);
  const fade = envelope(p, 0.04, 0.88);

  const reveal = easeOutQuint(remap(p, 0.02, 0.3));
  const camZ = 5.0 - remap(p, 0, 1) * 0.55;
  const ember = 1 + Math.sin(t * 1.6) * 0.1 + Math.sin(t * 3.9) * 0.05;

  return (
    <NeuralCanvas background="#000000" camera={{ fov: 40, position: [0, 0, 5.0] }}>
      {(geometry) => (
        <>
          <CameraRig
            position={[drift(t, 0.14) * 0.12, drift(t, 0.11, 1.5) * 0.08, camZ]}
            fov={40}
          />

          <Backdrop
            inner={palette.backgroundLift}
            outer={palette.background}
            aspect={width / height}
            radius={0.85}
            vignette={0.66}
          />

          {/* Teal board, deliberately cool against the amber hero. */}
          <CircuitField
            count={150}
            width={9}
            height={5}
            pitch={0.24}
            steps={7}
            horizontalBias={0.7}
            seed={661}
            colour={palette.particle}
            pulseColour={palette.signal}
            base={0.2}
            pulse={1.2}
            speed={0.24}
            pulseLength={0.65}
            opacity={0.45 * fade}
            falloffRadius={8}
            position={[0, 0, -2.8]}
            padSize={30}
          />

          {/* Cyan data crossing the frame both ways, kept out of the centre. */}
          <DataStreams
            count={130}
            span={22}
            height={4.6}
            depth={2.4}
            colour={palette.signal}
            speed={2.6}
            lengthRange={[0.6, 3.4]}
            opacity={0.42 * fade}
            clearBand={1.25}
            seed={662}
            position={[0, 0, -1.6]}
          />
          <DataStreams
            count={70}
            span={22}
            height={4.2}
            depth={2}
            colour={palette.particle}
            speed={-1.9}
            lengthRange={[0.5, 2.6]}
            opacity={0.28 * fade}
            clearBand={1.5}
            seed={663}
            position={[0, 0, -2.1]}
          />

          <ParticleField
            count={620}
            bounds={[7, 4, 3]}
            colour={palette.particle}
            size={95}
            opacity={0.4 * fade}
            rise={0.12}
            sway={0.12}
            twinkle={0.7}
            seed={664}
          />

          <HeroCircuitry
            geometry={geometry}
            palette={palette}
            glow={1.0 * ember * fade}
            reveal={reveal}
            scanY={-1.5 + ((t % 3.5) / 3.5) * 3.0}
            scanGain={0.2}
            pulse={0.5}
            coreHeat={0.08}
            fill={0.07}
            scale={0.84}
          />

          {/* Tighter spread than the blue versions: amber bleeding into teal
              would muddy the complementary contrast this version rests on. */}
          <Glow strength={1.5} threshold={0.36} knee={0.28} spread={0.55} radius={1.85} />
        </>
      )}
    </NeuralCanvas>
  );
};
