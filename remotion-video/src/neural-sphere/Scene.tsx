import React, { useMemo } from "react";
import { useThree } from "@react-three/fiber";
import {
  CAMERA_END_Z,
  CAMERA_START_Z,
  CORE_RADIUS,
  FILAMENT_WIDTH_PX,
  ROTATION_Y_RATE,
  ROTATION_Z_RATE,
} from "./constants";
import { buildFilaments } from "./filaments";
import { FilamentLines } from "./FilamentLines";
import { TravellingNodes } from "./TravellingNodes";
import { Starfield } from "./Starfield";
import { Core } from "./Core";
import type { Palette } from "./palettes";

type Props = {
  palette: Palette;
  /** Seconds since the start of the clip. */
  time: number;
  /** 0..1 progress through the clip, driving the camera push-in. */
  progress: number;
  width: number;
  height: number;
  pixelScale: number;
  seed: number;
  glow: number;
  wobble: number;
  nodeSizeScale: number;
};

export const Scene: React.FC<Props> = ({
  palette,
  time,
  progress,
  width,
  height,
  pixelScale,
  seed,
  glow,
  wobble,
  nodeSizeScale,
}) => {
  const data = useMemo(() => buildFilaments(seed), [seed]);
  const camera = useThree((state) => state.camera);

  // Slow push-in on an ease so the move has no visible start or stop,
  // plus a touch of lateral drift to keep it from feeling like a
  // mechanical dolly. Driven by Remotion's frame, not a clock.
  const eased = progress * progress * (3 - 2 * progress);
  const z = CAMERA_START_Z + (CAMERA_END_Z - CAMERA_START_Z) * eased;
  camera.position.set(
    Math.sin(time * 0.07) * 0.34,
    Math.cos(time * 0.055) * 0.26,
    z,
  );
  camera.lookAt(0, 0, 0);
  camera.updateMatrixWorld();

  // Node sizes are authored for a camera ~9 units out; this keeps them
  // from ballooning as the camera closes in.
  const refDistance = CAMERA_START_Z;

  return (
    <>
      {/* Dust shell: rotates on its own axis for parallax against the core. */}
      <group rotation={[time * 0.004, time * 0.013, 0]}>
        <Starfield
          palette={palette}
          pixelScale={pixelScale}
          time={time}
          intensity={0.85 * glow}
          refDistance={refDistance}
        />
      </group>

      {/* Filaments and the dots riding them share one transform, so the
          dots never slide off the lines. */}
      <group
        rotation={[
          Math.sin(time * 0.045) * 0.16,
          time * ROTATION_Y_RATE,
          time * ROTATION_Z_RATE,
        ]}
      >
        <FilamentLines
          data={data}
          palette={palette}
          width={width}
          height={height}
          pixelScale={pixelScale}
          widthPx={FILAMENT_WIDTH_PX}
          time={time}
          wobble={wobble}
          intensity={0.82 * glow}
        />
        <TravellingNodes
          data={data}
          palette={palette}
          pixelScale={pixelScale}
          time={time}
          wobble={wobble}
          intensity={1.15 * glow}
          sizeScale={nodeSizeScale}
          refDistance={refDistance}
        />
      </group>

      <Core palette={palette} time={time} radius={CORE_RADIUS} intensity={glow} />
    </>
  );
};
