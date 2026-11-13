import React, { useCallback, useMemo } from "react";
import { BAKE_FRAG } from "./gl/bake";
import type { BakeSpec } from "./gl/renderer";
import { FrameDescription, ShaderCanvas } from "./gl/ShaderCanvas";
import { PALETTES, Variant } from "./scene/palettes";
import { sceneUniforms } from "./scene/timeline";
import { SCENE_FRAG } from "./shaders/scene";

export type SkinHydrationProps = {
  /** "v1" = reference match, "v2" = alternative colour palette */
  variant: Variant;
  /** Scene super-sampling factor (default 1). Use 2 on a fast GPU. */
  supersample?: number;
};

export const SkinHydration: React.FC<SkinHydrationProps> = ({
  variant,
  supersample = 1,
}) => {
  const bakes = useMemo<BakeSpec[]>(
    () => [
      {
        name: "uMacro",
        size: 2048,
        frag: BAKE_FRAG,
        uniforms: { uMode: 0, uCells: 8, uJitter: 1.0, uWarp: 1.0, uSize: 2048 },
      },
      {
        name: "uMicro",
        size: 2048,
        frag: BAKE_FRAG,
        uniforms: { uMode: 1, uCells: 64, uJitter: 1.0, uWarp: 1.0, uSize: 2048 },
      },
    ],
    [],
  );

  const describeFrame = useCallback(
    (frame: number): FrameDescription => {
      const palette = PALETTES[variant];
      return {
        uniforms: { ...palette.uniforms, ...sceneUniforms(frame) },
        post: palette.post,
      };
    },
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
