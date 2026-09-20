import React, { useCallback, useMemo } from "react";
import * as THREE from "three";
import { GpuCanvas } from "./GpuCanvas";
import { createSceneRenderer, type SceneRenderer } from "./three-renderer";
import type { GpuBackend } from "./gpu";

// Depth of field, done as a composite rather than a post-process shader.
//
// A scene is split into depth bands via three.js layers. Each band is
// rendered on its own, blurred by the amount that band needs, and added
// into one 2D canvas. Because every material in these scenes is additive,
// summing the bands is mathematically the same as drawing them together,
// so the split costs nothing in correctness — and unlike a bokeh pass it
// needs no GLSL, which is what keeps the WebGPU path viable (three's
// WebGPU renderer cannot compile raw GLSL).

export type DepthBand = {
  /** three.js layer index holding this band's objects. */
  readonly layer: number;
  /** Blur radius in output pixels. Mutable: V2 breathes its focus. */
  blurPx: number;
  opacity: number;
};

export type StageContext = {
  /** Composition size. */
  readonly width: number;
  readonly height: number;
  /** Oversized GL buffer the bands are blurred from. */
  readonly renderWidth: number;
  readonly renderHeight: number;
  readonly scale: number;
  readonly backend: GpuBackend;
  /**
   * A camera framed for `width` x `height` but rendering the larger
   * buffer, so a blurred band has real pixels to pull in from beyond the
   * frame edge instead of transparent black.
   */
  readonly makeCamera: (
    fovDeg: number,
    near: number,
    far: number,
  ) => THREE.PerspectiveCamera;
};

export type Stage = {
  readonly scene: THREE.Scene;
  readonly camera: THREE.Camera;
  readonly bands: DepthBand[];
  /** Pure function of the frame: positions, opacities, band assignment. */
  readonly update: (frame: number) => void;
  readonly dispose: () => void;
};

type State = {
  renderer: SceneRenderer;
  stage: Stage;
  glCanvas: HTMLCanvasElement;
  ctx: CanvasRenderingContext2D;
  margin: number;
  width: number;
  height: number;
};

type Props = {
  readonly width: number;
  readonly height: number;
  readonly scale: number;
  readonly label: string;
  readonly createStage: (ctx: StageContext) => Promise<Stage>;
  readonly style?: React.CSSProperties;
};

/** Extra GL pixels on each side, so band blur never eats the frame edge. */
const MARGIN_AT_1X = 56;

export const ThreeStage: React.FC<Props> = ({
  width,
  height,
  scale,
  label,
  createStage,
  style,
}) => {
  const margin = useMemo(() => Math.round(MARGIN_AT_1X * scale), [scale]);

  const create = useCallback(
    async (canvas: HTMLCanvasElement, w: number, h: number): Promise<State> => {
      const renderWidth = w + margin * 2;
      const renderHeight = h + margin * 2;

      const glCanvas = document.createElement("canvas");
      glCanvas.width = renderWidth;
      glCanvas.height = renderHeight;
      const renderer = await createSceneRenderer(
        glCanvas,
        renderWidth,
        renderHeight,
      );

      const makeCamera = (fovDeg: number, near: number, far: number) => {
        // Widen the vertical FOV by exactly the overscan so the inner
        // w x h crop frames the same world as an unmargined camera would.
        const overscan = renderHeight / h;
        const fov = THREE.MathUtils.radToDeg(
          2 *
            Math.atan(
              Math.tan(THREE.MathUtils.degToRad(fovDeg) / 2) * overscan,
            ),
        );
        return new THREE.PerspectiveCamera(
          fov,
          renderWidth / renderHeight,
          near,
          far,
        );
      };

      const stage = await createStage({
        width: w,
        height: h,
        renderWidth,
        renderHeight,
        scale,
        backend: renderer.backend,
        makeCamera,
      });

      const ctx = canvas.getContext("2d");
      if (!ctx) {
        throw new Error(`${label}: no 2D context for the band compositor`);
      }
      return { renderer, stage, glCanvas, ctx, margin, width: w, height: h };
    },
    [createStage, label, margin, scale],
  );

  const draw = useCallback(async (state: State, frame: number) => {
    const { ctx, stage, renderer, glCanvas, margin: m } = state;
    stage.update(frame);

    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.globalCompositeOperation = "source-over";
    ctx.globalAlpha = 1;
    ctx.filter = "none";
    ctx.clearRect(0, 0, state.width, state.height);

    const camera = stage.camera;
    for (const band of stage.bands) {
      if (band.opacity <= 0.001) {
        continue;
      }
      camera.layers.set(band.layer);
      await renderer.render(stage.scene, camera);

      ctx.save();
      ctx.filter = band.blurPx > 0.05 ? `blur(${band.blurPx.toFixed(2)}px)` : "none";
      ctx.globalAlpha = band.opacity;
      // Additive: band order does not matter, and overlapping glows build
      // up the way they would in a single pass.
      ctx.globalCompositeOperation = "lighter";
      ctx.drawImage(glCanvas, -m, -m);
      ctx.restore();
    }
  }, []);

  const dispose = useCallback((state: State) => {
    state.stage.dispose();
    state.renderer.dispose();
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
