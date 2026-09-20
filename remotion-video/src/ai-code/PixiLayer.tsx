import React, { useCallback } from "react";
import { Application, Container } from "pixi.js";
import { GpuCanvas } from "./GpuCanvas";
import { detectGpuBackend, pixiPreference, type GpuBackend } from "./gpu";

// PixiJS v8 handles the 2D optical pass that sits on top of the three.js
// stage: lens veil, anamorphic flares, light rays, flicker bars, grain.
// Pixi takes the same backend decision three does, so a frame is never
// half WebGPU and half WebGL.

export type PixiScene = {
  readonly stage: Container;
  /** Pure function of the frame, like every other animator here. */
  readonly update: (frame: number) => void;
  readonly dispose?: () => void;
};

export type PixiContext = {
  readonly app: Application;
  readonly width: number;
  readonly height: number;
  readonly scale: number;
  readonly backend: GpuBackend;
};

type State = {
  app: Application;
  scene: PixiScene;
};

type Props = {
  readonly width: number;
  readonly height: number;
  readonly scale: number;
  readonly label: string;
  readonly createScene: (ctx: PixiContext) => Promise<PixiScene>;
  readonly style?: React.CSSProperties;
};

export const PixiLayer: React.FC<Props> = ({
  width,
  height,
  scale,
  label,
  createScene,
  style,
}) => {
  const create = useCallback(
    async (canvas: HTMLCanvasElement, w: number, h: number): Promise<State> => {
      const backend = await detectGpuBackend();
      const app = new Application();
      await app.init({
        canvas,
        width: w,
        height: h,
        backgroundAlpha: 0,
        antialias: true,
        // Remotion drives time; a running ticker would make frames depend
        // on wall-clock elapsed time instead of the frame number.
        autoStart: false,
        autoDensity: false,
        resolution: 1,
        preference: pixiPreference(backend),
      });
      app.ticker.stop();
      const scene = await createScene({ app, width: w, height: h, scale, backend });
      app.stage.addChild(scene.stage);
      return { app, scene };
    },
    [createScene, scale],
  );

  const draw = useCallback((state: State, frame: number) => {
    state.scene.update(frame);
    state.app.renderer.render(state.app.stage);
  }, []);

  const dispose = useCallback((state: State) => {
    state.scene.dispose?.();
    state.app.destroy(false, { children: true, texture: true });
  }, []);

  return (
    <GpuCanvas<State>
      label={label}
      width={width}
      height={height}
      create={create}
      draw={draw}
      dispose={dispose}
      style={style}
    />
  );
};
