import React, { useLayoutEffect } from "react";
import { AbsoluteFill, useCurrentFrame, useVideoConfig } from "remotion";
import { ThreeCanvas } from "@remotion/three";
import { useThree } from "@react-three/fiber";
import { z } from "zod";
import { DURATION_IN_FRAMES, GRID_YAW, PANEL_HEIGHT } from "./constants";
import { paletteSchema, V1_CYAN, type Palette } from "./palette";
import { cameraAt } from "./scene/camera";
import { Panels } from "./scene/Panels";
import { Shafts } from "./scene/Shafts";
import { Backdrop } from "./scene/Backdrop";
import { Grain } from "./scene/Grain";

export const rackCurtainsSchema = z.object({
  palette: paletteSchema,
  seed: z.number().int(),
});

export type RackCurtainsProps = z.infer<typeof rackCurtainsSchema>;

export const rackCurtainsDefaults: RackCurtainsProps = {
  palette: V1_CYAN,
  seed: 20260904,
};

// Camera is driven straight off the frame - no useFrame clock and no delta
// accumulation, since Remotion renders frames out of order across threads.
const CameraRig: React.FC<{ frame: number }> = ({ frame }) => {
  const camera = useThree((s) => s.camera);
  const { position, target } = cameraAt(frame);

  useLayoutEffect(() => {
    camera.position.set(position[0], position[1], position[2]);
    camera.lookAt(target[0], target[1], target[2]);
    camera.updateProjectionMatrix();
    camera.updateMatrixWorld();
  });

  return null;
};

const Scene: React.FC<{ palette: Palette; seed: number; frame: number }> = ({
  palette,
  seed,
  frame,
}) => {
  const time = (frame % DURATION_IN_FRAMES) / DURATION_IN_FRAMES;
  const { position } = cameraAt(frame);

  // Shafts billboard toward the camera. Working in the yawed grid's local
  // space keeps them sitting in the aisles.
  const faceYaw = Math.atan2(position[0], position[2]) - GRID_YAW;

  return (
    <>
      <CameraRig frame={frame} />
      <Backdrop palette={palette} />
      <group rotation={[0, GRID_YAW, 0]}>
        <Panels palette={palette} time={time} seed={seed} gain={1.35} />

        {/* Barely-there reflection of the nearest panels in the dark floor. */}
        <group scale={[1, -1, 1]} position={[0, -0.02, 0]}>
          <Panels
            palette={palette}
            time={time}
            seed={seed}
            gain={0.11}
            blurBias={1.6}
          />
        </group>

        <Shafts palette={palette} time={time} seed={seed + 991} faceYaw={faceYaw} />
      </group>
    </>
  );
};

export const RackCurtains: React.FC<RackCurtainsProps> = ({ palette, seed }) => {
  const frame = useCurrentFrame();
  const { width, height } = useVideoConfig();

  return (
    <AbsoluteFill style={{ backgroundColor: palette.bgDeep }}>
      <ThreeCanvas
        width={width}
        height={height}
        camera={{ fov: 38, near: 0.5, far: 220, position: [0, PANEL_HEIGHT, 18] }}
        gl={{ antialias: true, alpha: false }}
        dpr={1}
      >
        <Scene palette={palette} seed={seed} frame={frame} />
      </ThreeCanvas>

      {/* Bloom. Rather than a second render pass, this blurs what has already
          been drawn behind it and screens it back on top; the contrast step runs
          first to crush the dark blue to black, so the glow
          gathers on the hot dots and the shafts instead of lifting the whole
          frame. The blur radius is in composition pixels, so it scales with
          the render automatically. */}
      <AbsoluteFill
        style={{
          backdropFilter: "blur(30px) contrast(2.8) brightness(1.5)",
          WebkitBackdropFilter: "blur(30px) contrast(2.8) brightness(1.5)",
          mixBlendMode: "screen",
          opacity: 0.34,
          pointerEvents: "none",
        }}
      />

      {/* Atmospheric lift - the haze this space sits in. */}
      <AbsoluteFill
        style={{
          background: `radial-gradient(ellipse 70% 55% at 50% 38%, ${palette.bgLit}4e 0%, transparent 70%)`,
          mixBlendMode: "screen",
          pointerEvents: "none",
        }}
      />

      {/* Vignette. */}
      <AbsoluteFill
        style={{
          background:
            "radial-gradient(ellipse 78% 78% at 50% 50%, transparent 46%, rgba(0,0,0,0.5) 100%)",
          pointerEvents: "none",
        }}
      />

      <Grain frame={frame} opacity={0.02} />
    </AbsoluteFill>
  );
};
