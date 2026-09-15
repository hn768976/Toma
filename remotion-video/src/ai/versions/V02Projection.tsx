// V02 "Floor Projection" - 25s.
//
// Reference: the circuitry hangs in a cone of light thrown up from a single hot
// emitter on a reflective wire floor, deep saturated blue throughout.
//
// The read depends on the emitter being the brightest thing in frame and the
// hero being clearly *above* it, so the camera sits low and looks slightly up.

import React from "react";
import { useCurrentFrame, useVideoConfig } from "remotion";
import { drift, easeInOutCubic, easeOutQuint, envelope, ramp, remap } from "../anim";
import { Backdrop } from "../layers/Backdrop";
import { Flare, LightCone } from "../layers/Beams";
import { CameraRig } from "../layers/CameraRig";
import { Glow } from "../layers/Glow";
import { GridFloor } from "../layers/GridFloor";
import { HeroCircuitry } from "../layers/HeroCircuitry";
import { NeuralCanvas } from "../layers/NeuralCanvas";
import { ParticleField } from "../layers/ParticleField";
import { paletteFor } from "../palette";

const FLOOR_Y = -1.95;
const HERO_Y = 0.55;

export const V02Projection: React.FC = () => {
  const frame = useCurrentFrame();
  const { width, height, durationInFrames, fps } = useVideoConfig();
  const palette = paletteFor("V02Projection");

  const t = frame / fps;
  const p = frame / Math.max(1, durationInFrames - 1);
  const fade = envelope(p, 0.06, 0.93);

  // The emitter fires first, the beam climbs, then the hero resolves in it.
  const ignite = ramp(p, 0.01, 0.09);
  const beam = ramp(p, 0.04, 0.24);
  const reveal = easeOutQuint(remap(p, 0.14, 0.52));

  // Slow rise and push-in; the camera never settles completely.
  const camY = 0.15 + easeInOutCubic(remap(p, 0, 0.8)) * 0.5 + drift(t, 0.06) * 0.06;
  const camZ = 5.9 - easeInOutCubic(remap(p, 0, 0.85)) * 1.1;
  const camX = drift(t, 0.05, 2.1) * 0.3;

  const flicker = 0.9 + Math.sin(t * 3.1) * 0.05 + Math.sin(t * 7.7) * 0.03;
  const hover = Math.sin(t * 0.5) * 0.06;

  return (
    <NeuralCanvas background="#000000" camera={{ fov: 42, position: [0, 0.3, 5.9] }}>
      {(geometry) => (
        <>
          <CameraRig position={[camX, camY, camZ]} lookAt={[0, HERO_Y * 0.45, 0]} fov={42} />

          <Backdrop
            inner={palette.backgroundLift}
            outer={palette.background}
            aspect={width / height}
            focus={[0, -0.35]}
            radius={1.4}
            vignette={0.55}
          />

          <GridFloor
            colour={palette.primary}
            ringColour={palette.accent}
            size={70}
            pitch={0.85}
            lineWidth={1.0}
            scroll={0.22}
            fadeDistance={20}
            brightness={0.8 * fade}
            rings={0.55 * ignite}
            ringPeriod={5.5}
            opacity={fade}
            position={[0, FLOOR_Y, 0]}
          />

          {/* Beam apex sits on the floor: the cone is flipped so its point is
              at the emitter and its mouth opens around the hero. */}
          <LightCone
            colour={palette.accent}
            radius={1.35}
            height={3.1}
            intensity={0.17 * beam * flicker}
            falloff={4.0}
            opacity={fade}
            position={[0, FLOOR_Y + 1.55, 0]}
            rotation={[Math.PI, 0, 0]}
          />

          <Flare
            colour={palette.core}
            size={0.95}
            intensity={0.6 * ignite * flicker}
            streak={1.1}
            opacity={fade}
            position={[0, FLOOR_Y + 0.02, 0.05]}
          />

          <ParticleField
            count={900}
            bounds={[6.5, 4, 3.5]}
            colour={palette.particle}
            size={110}
            opacity={0.7 * fade}
            rise={0.16}
            sway={0.2}
            twinkle={0.7}
            seed={512}
            position={[0, -0.4, 0]}
          />

          <HeroCircuitry
            geometry={geometry}
            palette={palette}
            glow={1.05 * fade}
            reveal={reveal}
            scanY={-1.6 + ((t % 6) / 6) * 3.2}
            scanGain={0.45}
            pulse={0.85}
            coreHeat={0.08}
            fill={0.12}
            scale={0.82}
            position={[0, HERO_Y + hover, 0]}
          />

          <Glow strength={1.35} threshold={0.26} knee={0.3} spread={0.85} radius={2.1} />
        </>
      )}
    </NeuralCanvas>
  );
};
