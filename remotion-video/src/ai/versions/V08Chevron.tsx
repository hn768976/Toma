// V08 "Chevron Bus" - 20s.
//
// Reference: the circuitry centred between nested chevron bus lines that fan
// out symmetrically to both edges of frame, pulses running outward.
//
// Both sides are the *same* generated field drawn twice, the second mirrored by
// a negative X scale. Generating each side independently would give two similar
// but unequal halves, and the reference's whole character is that the symmetry
// is exact.

import React from "react";
import { useCurrentFrame, useVideoConfig } from "remotion";
import { generateChevrons } from "../circuitTraces";
import { drift, easeInOutCubic, easeOutQuint, envelope, ramp, remap } from "../anim";
import { Backdrop } from "../layers/Backdrop";
import { CameraRig } from "../layers/CameraRig";
import { CircuitField } from "../layers/CircuitField";
import { Glow } from "../layers/Glow";
import { HeroCircuitry } from "../layers/HeroCircuitry";
import { NeuralCanvas } from "../layers/NeuralCanvas";
import { ParticleField } from "../layers/ParticleField";
import { paletteFor } from "../palette";

// Built once at module scope: it never changes, and rebuilding it per frame
// would throw away the buffers on every render.
const CHEVRONS = generateChevrons({
  count: 9,
  startX: 1.85,
  gap: 0.62,
  armX: 1.15,
  armY: 1.5,
  tail: 2.6,
  jitter: 0.12,
  seed: 880,
});

const FINE_CHEVRONS = generateChevrons({
  count: 14,
  startX: 2.05,
  gap: 0.41,
  armX: 0.8,
  armY: 1.05,
  tail: 3.2,
  jitter: 0.2,
  seed: 881,
});

export const V08Chevron: React.FC = () => {
  const frame = useCurrentFrame();
  const { width, height, durationInFrames, fps } = useVideoConfig();
  const palette = paletteFor("V08Chevron");

  const t = frame / fps;
  const p = frame / Math.max(1, durationInFrames - 1);
  const fade = envelope(p, 0.05, 0.92);

  const busIn = ramp(p, 0.0, 0.18);
  const reveal = easeOutQuint(remap(p, 0.1, 0.44));
  const camZ = 5.5 - easeInOutCubic(remap(p, 0, 0.85)) * 0.6;

  const bus = (mirror: boolean) => (
    <>
      <CircuitField
        field={CHEVRONS}
        colour={palette.primary}
        pulseColour={palette.accent}
        base={0.22}
        pulse={1.35}
        speed={0.2}
        pulseLength={1.1}
        opacity={0.95 * busIn * fade}
        falloffRadius={0}
        position={[0, 0, -1.4]}
        scale={mirror ? [-1, 1, 1] : [1, 1, 1]}
        padSize={26}
      />
      <CircuitField
        field={FINE_CHEVRONS}
        colour={palette.primary}
        pulseColour={palette.signal}
        base={0.14}
        pulse={1.0}
        speed={0.27}
        pulseLength={0.8}
        opacity={0.6 * busIn * fade}
        falloffRadius={0}
        position={[0, 0, -2.3]}
        scale={mirror ? [-1, 1, 1] : [1, 1, 1]}
        showPads={false}
      />
    </>
  );

  return (
    <NeuralCanvas background="#000000" camera={{ fov: 42, position: [0, 0, 5.5] }}>
      {(geometry) => (
        <>
          <CameraRig
            position={[drift(t, 0.05) * 0.1, drift(t, 0.045, 1.2) * 0.07, camZ]}
            fov={42}
          />

          <Backdrop
            inner={palette.backgroundLift}
            outer={palette.background}
            aspect={width / height}
            radius={1.4}
            vignette={0.5}
          />

          {bus(false)}
          {bus(true)}

          <ParticleField
            count={640}
            bounds={[8, 4.2, 3]}
            colour={palette.particle}
            size={95}
            opacity={0.5 * fade}
            rise={0.1}
            sway={0.13}
            twinkle={0.6}
            seed={882}
          />

          <HeroCircuitry
            geometry={geometry}
            palette={palette}
            glow={1.0 * fade}
            reveal={reveal}
            scanY={-1.5 + ((t % 5.5) / 5.5) * 3.0}
            scanGain={0.45}
            pulse={0.75}
            coreHeat={0.1}
            fill={0.12}
            scale={0.8}
          />

          <Glow strength={1.6} threshold={0.19} knee={0.31} spread={0.95} radius={2.15} />
        </>
      )}
    </NeuralCanvas>
  );
};
