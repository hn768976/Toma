import { useEffect, useLayoutEffect, useRef, useState } from "react";
import {
  AbsoluteFill,
  cancelRender,
  continueRender,
  delayRender,
  useCurrentFrame,
  useVideoConfig,
} from "remotion";
import * as THREE from "three";
import { loadFonts } from "./fonts";

export type SceneController = {
  render: (frame: number) => void;
  dispose: () => void;
};

export type SceneFactory = (args: {
  renderer: THREE.WebGLRenderer;
  width: number;
  height: number;
  fps: number;
  durationInFrames: number;
}) => SceneController;

/**
 * Imperative Three.js host for Remotion.
 * - The WebGL drawing buffer is exactly the composition size (3840x2160 for
 *   the 4K compositions); Remotion's --scale only resamples the screenshot.
 * - Each frame is drawn synchronously in a layout effect with
 *   preserveDrawingBuffer, so the screenshot always contains the exact frame.
 */
export const GLCanvas: React.FC<{ factory: SceneFactory }> = ({ factory }) => {
  const frame = useCurrentFrame();
  const { width, height, fps, durationInFrames } = useVideoConfig();
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const controller = useRef<SceneController | null>(null);
  const [ready, setReady] = useState(false);
  const [handle] = useState(() =>
    delayRender("Loading fonts and initialising WebGL", { timeoutInMilliseconds: 120000 }),
  );
  const released = useRef(false);

  useEffect(() => {
    loadFonts()
      .then(() => setReady(true))
      .catch((err) => cancelRender(err));
  }, []);

  useLayoutEffect(() => {
    if (!ready || !canvasRef.current) return;
    const canvas = canvasRef.current;
    const onLost = () => cancelRender(new Error("WebGL context lost"));
    canvas.addEventListener("webglcontextlost", onLost);
    const renderer = new THREE.WebGLRenderer({
      canvas,
      antialias: false,
      alpha: false,
      preserveDrawingBuffer: true,
      powerPreference: "high-performance",
    });
    renderer.setPixelRatio(1);
    renderer.setSize(width, height, false);
    renderer.autoClear = true;
    controller.current = factory({ renderer, width, height, fps, durationInFrames });
    return () => {
      canvas.removeEventListener("webglcontextlost", onLost);
      controller.current?.dispose();
      controller.current = null;
      renderer.dispose();
    };
  }, [ready, width, height, fps, durationInFrames, factory]);

  useLayoutEffect(() => {
    if (!ready || !controller.current) return;
    try {
      controller.current.render(frame);
    } catch (err) {
      cancelRender(err);
    }
    if (!released.current) {
      released.current = true;
      continueRender(handle);
    }
  }, [frame, ready, factory, handle]);

  return (
    <AbsoluteFill style={{ backgroundColor: "#000" }}>
      <canvas
        ref={canvasRef}
        width={width}
        height={height}
        style={{ width: "100%", height: "100%", display: "block" }}
      />
    </AbsoluteFill>
  );
};
