import { AbsoluteFill, useCurrentFrame, useVideoConfig } from "remotion";
import { ThreeCanvas } from "@remotion/three";
import { useMemo } from "react";
import { PillField } from "../scene/PillField";
import { GradientBackdrop } from "../scene/Backdrop";
import { LightRig } from "../scene/Rig";
import { Post } from "../scene/Post";
import type { FallingRow } from "../data/looks";

/**
 * Look 3: pills falling through frame at several depths under heavy depth of
 * field. The camera is fixed; the field moves.
 */
export const FallingPillsComp: React.FC<{ row: FallingRow }> = ({ row }) => {
  const frame = useCurrentFrame();
  const { width, height } = useVideoConfig();
  const aspect = width / height;

  const fieldConfig = useMemo(
    () => ({
      ...row.field,
      camera: { z: row.camera.z, fovDeg: row.camera.fovDeg, aspect },
    }),
    [row.field, row.camera.z, row.camera.fovDeg, aspect],
  );

  // The backdrop plane is sized to fill the frustum at its own depth.
  const backdropHeight =
    2 * (row.camera.z - row.backdrop.z) * Math.tan((row.camera.fovDeg * Math.PI) / 360) * 1.02;

  return (
    <AbsoluteFill style={{ backgroundColor: "#000000" }}>
      <ThreeCanvas
        width={width}
        height={height}
        dpr={1}
        flat
        gl={{ antialias: true, alpha: false, powerPreference: "high-performance" }}
        camera={{
          fov: row.camera.fovDeg,
          position: [0, 0, row.camera.z],
          near: row.camera.near,
          far: row.camera.far,
        }}
        style={{ backgroundColor: "#000000" }}
      >
        <LightRig rig={row.rig} />
        <GradientBackdrop
          {...row.backdrop}
          width={backdropHeight * aspect}
          height={backdropHeight}
        />
        <PillField
          config={fieldConfig}
          colourway={row.colourway}
          loopFrames={row.loopFrames}
          roughness={row.material.roughness}
          clearcoat={row.material.clearcoat}
        />
        <Post dof={row.dof} grain={row.grain} frameIndex={frame % row.loopFrames} />
      </ThreeCanvas>
    </AbsoluteFill>
  );
};
