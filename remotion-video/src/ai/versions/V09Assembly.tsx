// V09 "Particle Assembly" - 13.97s.
//
// Reference: a scattered ring of particles that converges and condenses into a
// solid circuit brain. Cooler and more monochrome than the rest of the set -
// near-white on slate rather than saturated blue.
//
// The swarm's targets are sampled from the hero mesh itself, so the particles
// resolve into the real board. The hero mesh fades up underneath as the swarm
// lands, and the two cross over: at no point is either alone on screen.

import React from "react";
import { useCurrentFrame, useVideoConfig } from "remotion";
import { drift, easeInOutCubic, envelope, ramp, remap } from "../anim";
import { Backdrop } from "../layers/Backdrop";
import { Flare } from "../layers/Beams";
import { AssemblySwarm } from "../layers/AssemblySwarm";
import { CameraRig } from "../layers/CameraRig";
import { Filaments } from "../layers/Filaments";
import { Glow } from "../layers/Glow";
import { HaloRings } from "../layers/HaloRings";
import { HeroCircuitry } from "../layers/HeroCircuitry";
import { NeuralCanvas } from "../layers/NeuralCanvas";
import { ParticleField } from "../layers/ParticleField";
import { paletteFor } from "../palette";

const HERO_SCALE = 0.82;

export const V09Assembly: React.FC = () => {
  const frame = useCurrentFrame();
  const { width, height, durationInFrames, fps } = useVideoConfig();
  const palette = paletteFor("V09Assembly");

  const t = frame / fps;
  const p = frame / Math.max(1, durationInFrames - 1);
  const fade = envelope(p, 0.04, 0.9);

  // The assembly itself, and the hero fading up to take over from it.
  const assembly = easeInOutCubic(remap(p, 0.08, 0.62));
  const reveal = ramp(p, 0.42, 0.78);
  const swarmFade = 1 - ramp(p, 0.72, 0.97) * 0.55;

  const camZ = 5.6 - easeInOutCubic(remap(p, 0, 0.9)) * 0.85;
  const ringsIn = ramp(p, 0.0, 0.12) * (1 - ramp(p, 0.78, 1) * 0.6);

  return (
    <NeuralCanvas background="#000000" camera={{ fov: 40, position: [0, 0, 5.6] }}>
      {(geometry) => (
        <>
          <CameraRig
            position={[drift(t, 0.07) * 0.16, drift(t, 0.06, 2.0) * 0.1, camZ]}
            fov={40}
          />

          <Backdrop
            inner={palette.backgroundLift}
            outer={palette.background}
            aspect={width / height}
            radius={1.7}
            vignette={0.38}
          />

          <ParticleField
            count={820}
            bounds={[7, 4.2, 4]}
            colour={palette.particle}
            size={100}
            opacity={0.55 * fade}
            rise={0.08}
            sway={0.18}
            twinkle={0.75}
            seed={991}
          />

          {/* Wisps trailing off the assembling shape. */}
          <Filaments
            count={180}
            segments={16}
            innerRadius={0.9}
            outerRadius={3.1}
            squash={0.85}
            depth={0.4}
            curl={0.26}
            colour={palette.primary}
            tipColour={palette.accent}
            brightness={0.45}
            flowSpeed={0.18}
            opacity={0.32 * ramp(p, 0.25, 0.6) * fade}
            seed={992}
            position={[0, 0, -0.5]}
          />

          <HaloRings
            rings={[
              { radius: 1.75, width: 0.005, ticks: 140, tickDuty: 0.35, brightness: 0.35, spin: -0.04 },
              { radius: 2.0, width: 0.004, arcStart: 0.2, arcLength: 0.22, brightness: 0.5, spin: 0.07 },
            ]}
            colour={palette.accent}
            extent={2.3}
            opacity={ringsIn * fade}
          />

          <HeroCircuitry
            geometry={geometry}
            palette={palette}
            glow={0.95 * fade}
            reveal={reveal}
            scanY={-1.5 + ((t % 5) / 5) * 3.0}
            scanGain={0.4}
            pulse={0.6}
            coreHeat={0.07}
            fill={0.14}
            scale={HERO_SCALE}
          />

          {/* Drawn at the hero's scale so the particles land exactly on the
              traces they were sampled from. */}
          <AssemblySwarm
            geometry={geometry}
            count={7000}
            assembly={assembly}
            colour={palette.core}
            flightColour={palette.accent}
            scatterRadius={3.6}
            scatterDepth={2.0}
            size={95}
            opacity={0.62 * swarmFade * fade}
            stagger={0.5}
            seed={993}
            scale={HERO_SCALE}
          />

          <Flare
            colour={palette.core}
            size={1.3}
            intensity={0.16 * ramp(p, 0.45, 0.68) * (1 - ramp(p, 0.75, 1) * 0.7)}
            streak={1.2}
            opacity={fade}
            position={[0, 0, 0.1]}
          />

          <Glow strength={1.1} threshold={0.32} knee={0.3} spread={0.8} radius={2.1} />
        </>
      )}
    </NeuralCanvas>
  );
};
