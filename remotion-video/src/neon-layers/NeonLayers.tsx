import React, { useCallback, useMemo } from "react";
import { WebGPUCanvas, type SceneHandle } from "./WebGPUCanvas";
import { defaultLayout, type Layout } from "./layout";
import { themes, type ThemeId, type Theme } from "./themes";

export type NeonLayersProps = {
  width: number;
  height: number;
  theme: ThemeId;
  /** Multisampling for the render target; 0 turns it off. */
  samples?: number;
  /** Partial overrides, handy for dialling the look in from the CLI. */
  layoutOverrides?: Partial<Layout>;
  themeOverrides?: Partial<Theme>;
};

export const NeonLayers: React.FC<NeonLayersProps> = ({
  width,
  height,
  theme,
  samples = 4,
  layoutOverrides,
  themeOverrides,
}) => {
  const layout = useMemo<Layout>(
    () => ({ ...defaultLayout, ...layoutOverrides }),
    [layoutOverrides],
  );
  const resolvedTheme = useMemo<Theme>(
    () => ({ ...themes[theme], ...themeOverrides }),
    [theme, themeOverrides],
  );

  const init = useCallback(
    async (canvas: HTMLCanvasElement): Promise<SceneHandle<unknown>> => {
      const { createGpuSurface } = await import("./gpu-surface");
      const { createNeonLayersScene } = await import("./scene");
      const { createRenderPipeline } = await import("./post");

      const surface = await createGpuSurface(canvas, width, height, {
        samples,
      });
      const built = createNeonLayersScene(
        resolvedTheme,
        width / height,
        layout,
      );

      const pipeline = createRenderPipeline(
        surface.renderer,
        built.scene,
        built.camera,
        resolvedTheme,
        width,
        height,
        samples,
      );

      return {
        scene: built.scene,
        draw: async (frame) => {
          built.setFrame(frame);
          await surface.present((output) => pipeline.render(output));
        },
        dispose: () => {
          pipeline.dispose();
          built.dispose();
          surface.dispose();
        },
      };
    },
    [width, height, samples, layout, resolvedTheme],
  );

  return <WebGPUCanvas width={width} height={height} init={init} />;
};
