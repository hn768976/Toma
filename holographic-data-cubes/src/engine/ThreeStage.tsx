import { useLayoutEffect, useRef } from "react";
import { AbsoluteFill, useCurrentFrame, useVideoConfig } from "remotion";
import * as THREE from "three";

export type SceneController = {
  /** Draw the given frame. Must be a pure function of `frame`. */
  render: (frame: number, fps: number) => void;
  dispose: () => void;
};

export type SceneContext<P> = {
  renderer: THREE.WebGLRenderer;
  /** Composition size in CSS pixels (3840x2160 for the 4K masters). */
  width: number;
  height: number;
  /** Drawing-buffer size in device pixels (width * pixelRatio). */
  pixelWidth: number;
  pixelHeight: number;
  durationInFrames: number;
  fps: number;
  props: P;
};

export type SceneFactory<P> = (ctx: SceneContext<P>) => SceneController;

/**
 * Hosts a raw Three.js WebGL2 renderer inside a Remotion composition.
 * Every frame is rendered synchronously in a layout effect, so the canvas
 * always holds exactly the frame Remotion is about to screenshot.
 *
 * The drawing buffer follows `window.devicePixelRatio`, which Remotion sets
 * to the `--scale` flag: the 3840x2160 composition renders natively at 4K
 * with `--scale=1` and at 1920x1080 with `--scale=0.5`.
 */
export function ThreeStage<P>({
  factory,
  sceneProps,
  background,
}: {
  factory: SceneFactory<P>;
  sceneProps: P;
  background: string;
}) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const controller = useRef<SceneController | null>(null);
  const frame = useCurrentFrame();
  const { width, height, fps, durationInFrames } = useVideoConfig();

  useLayoutEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) {
      return;
    }
    const renderer = new THREE.WebGLRenderer({
      canvas,
      antialias: false,
      alpha: false,
      depth: false,
      stencil: false,
      preserveDrawingBuffer: true,
      powerPreference: "high-performance",
    });
    // Never exceed the composition's native resolution (keeps Studio on a
    // Retina display from allocating an 8K buffer).
    const pixelRatio = Math.min(window.devicePixelRatio || 1, 1);
    renderer.setPixelRatio(pixelRatio);
    renderer.setSize(width, height, false);
    renderer.outputColorSpace = THREE.LinearSRGBColorSpace;
    renderer.toneMapping = THREE.NoToneMapping;
    const ctrl = factory({
      renderer,
      width,
      height,
      pixelWidth: Math.round(width * pixelRatio),
      pixelHeight: Math.round(height * pixelRatio),
      durationInFrames,
      fps,
      props: sceneProps,
    });
    controller.current = ctrl;
    return () => {
      controller.current = null;
      ctrl.dispose();
      renderer.dispose();
    };
    // The scene is rebuilt only if the composition itself changes.
  }, [width, height, durationInFrames, fps, factory, sceneProps]);

  useLayoutEffect(() => {
    controller.current?.render(frame, fps);
  }, [frame, fps, width, height, factory, sceneProps]);

  return (
    <AbsoluteFill style={{ backgroundColor: background }}>
      <canvas
        ref={canvasRef}
        width={width}
        height={height}
        style={{ width, height, display: "block" }}
      />
    </AbsoluteFill>
  );
}
