// V01 "Halo Ring" - 25s.
//
// Reference: a tilted halo of light that settles head-on while the circuitry
// resolves inside it, over a drifting data grid streaked with light.
//
// The beat structure: rings arrive first and tilt level, the hero wipes in from
// its centre under a scan sweep, then the whole thing breathes while periodic
// scans keep re-reading the board.

import React from "react";
import { useCurrentFrame, useVideoConfig } from "remotion";
import { drift, easeInOutCubic, easeOutQuint, envelope, ramp, remap } from "../anim";
import { Backdrop } from "../layers/Backdrop";
import { CameraRig } from "../layers/CameraRig";
import { CircuitField } from "../layers/CircuitField";
import { DataStreams } from "../layers/DataStreams";
import { Glow } from "../layers/Glow";
import { HaloRings } from "../layers/HaloRings";
import { HeroCircuitry } from "../layers/HeroCircuitry";
import { NeuralCanvas } from "../layers/NeuralCanvas";
import { ParticleField } from "../layers/ParticleField";
import { paletteFor } from "../palette";

export const V01Halo: React.FC = () => {
  const frame = useCurrentFrame();
  const { width, height, durationInFrames, fps } = useVideoConfig();
  const palette = paletteFor("V01Halo");

  const t = frame / fps;
  const p = frame / Math.max(1, durationInFrames - 1);
  const fade = envelope(frame);

  // Camera: a long, slow push in that never quite stops moving.
  const dolly = 5.6 - easeInOutCubic(remap(p, 0, 0.75)) * 1.15;
  const camX = drift(t, 0.09) * 0.22;
  const camY = drift(t, 0.07, 1.4) * 0.14;

  // Rings tilt from a raked angle to almost level as they settle.
  const tilt = (1 - easeOutQuint(remap(p, 0.02, 0.42))) * 0.55 + 0.06;
  const ringsIn = ramp(p, 0.0, 0.07);

  // Hero wipes in from the centre outward, chased by a scan sweep.
  const reveal = easeOutQuint(remap(p, 0.1, 0.46));
  // Periodic re-scan every ~7s, plus the initial reveal sweep.
  const scanCycle = (t % 7) / 7;
  const scanY = -1.6 + scanCycle * 3.2;
  const scanGain = 0.55 * ramp(p, 0.12, 0.2);

  const breathe = 1 + Math.sin(t * 0.55) * 0.07;

  return (
    <NeuralCanvas background="#000000" camera={{ fov: 38, position: [0, 0, dolly] }}>
      {(geometry) => (
        <>
          <CameraRig position={[camX, camY, dolly]} fov={38} />

          <Backdrop
            inner={palette.backgroundLift}
            outer={palette.background}
            aspect={width / height}
            radius={1.25}
            vignette={0.5}
          />

          {/* Board detail well behind the hero, dim and slow. */}
          <CircuitField
            count={150}
            width={8}
            height={4.2}
            pitch={0.26}
            steps={8}
            horizontalBias={0.62}
            seed={101}
            colour={palette.primary}
            pulseColour={palette.accent}
            base={0.2}
            pulse={1.0}
            speed={0.1}
            pulseLength={0.7}
            opacity={0.95 * fade}
            falloffRadius={9}
            position={[0, 0, -3.4]}
            padSize={26}
          />

          <DataStreams
            count={190}
            span={20}
            height={4.6}
            depth={3.2}
            colour={palette.signal}
            speed={1.35}
            lengthRange={[0.35, 2.6]}
            opacity={0.85 * fade}
            clearBand={1.4}
            seed={202}
            position={[0, 0, -2.2]}
          />

          <ParticleField
            count={950}
            bounds={[7.5, 4.4, 4]}
            colour={palette.particle}
            size={120}
            opacity={0.85 * fade}
            rise={0.1}
            sway={0.16}
            twinkle={0.65}
            seed={303}
          />

          <HaloRings
            rings={[
              { radius: 1.42, width: 0.006, ticks: 64, tickDuty: 0.3, brightness: 0.4, spin: -0.05 },
              { radius: 1.58, width: 0.014, brightness: 0.85, spin: 0.04 },
              { radius: 1.74, width: 0.007, arcStart: 0.1, arcLength: 0.34, brightness: 1.1, spin: -0.11 },
              { radius: 1.93, width: 0.022, ticks: 128, tickDuty: 0.42, brightness: 0.45, spin: 0.03 },
              { radius: 2.16, width: 0.008, arcStart: 0.55, arcLength: 0.17, brightness: 0.9, spin: 0.08 },
            ]}
            colour={palette.accent}
            extent={2.4}
            opacity={ringsIn * fade}
            rotation={[tilt, 0, 0]}
          />

          <HeroCircuitry
            geometry={geometry}
            palette={palette}
            glow={breathe * fade}
            reveal={reveal}
            scanY={scanY}
            scanGain={scanGain}
            pulse={0.6}
            coreHeat={0.05}
            fill={0.1}
            scale={0.78}
          />

          <Glow strength={1.5} threshold={0.2} knee={0.3} spread={0.9} radius={2.0} />
        </>
      )}
    </NeuralCanvas>
  );
};
