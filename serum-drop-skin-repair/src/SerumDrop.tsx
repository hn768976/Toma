import React, { useCallback, useMemo } from "react";
import { BAKE_FRAG } from "./gl/bake";
import type { BakeSpec } from "./gl/renderer";
import { FrameDescription, ShaderCanvas } from "./gl/ShaderCanvas";
import { PALETTE } from "./scene/palettes";
import { sceneUniforms, Variant } from "./scene/timeline";
import { SCENE_FRAG } from "./shaders/scene";

export type SerumDropProps = {
  /** "v1" = reference match, "v2" = alternative camera (orbiting crane shot) */
  variant: Variant;
  /** Scene super-sampling factor (default 1). Use 2 on a fast GPU. */
  supersample?: number;
};

export const SerumDrop: React.FC<SerumDropProps> = ({
  variant,
  supersample = 1,
}) => {
  const bakes = useMemo<BakeSpec[]>(
    () => [
      {
        name: "uMacro",
        size: 2048,
        frag: BAKE_FRAG,
        uniforms: { uMode: 0, uCells: 12, uJitter: 0.9, uWarp: 0.8, uSize: 2048 },
      },
      {
        name: "uMicro",
        size: 2048,
        frag: BAKE_FRAG,
        uniforms: { uMode: 1, uCells: 56, uJitter: 1.0, uWarp: 1.0, uSize: 2048 },
      },
    ],
    [],
  );

  const describeFrame = useCallback(
    (frame: number): FrameDescription => ({
      uniforms: { ...PALETTE.uniforms, ...sceneUniforms(frame, variant) },
      post: PALETTE.post,
    }),
    [variant],
  );

  return (
    <ShaderCanvas
      sceneFrag={SCENE_FRAG}
      bakes={bakes}
      supersample={supersample}
      describeFrame={describeFrame}
    />
  );
};
