import { useEffect, useLayoutEffect, useRef, useState } from "react";
import {
  AbsoluteFill,
  continueRender,
  delayRender,
  useCurrentFrame,
  useVideoConfig,
} from "remotion";

// A scene object owns its WebGL state and draws one deterministic frame.
export type GlScene = {
  renderFrame: (frame: number) => void;
  dispose: () => void;
};

export type SceneFactory = (
  canvas: HTMLCanvasElement,
  width: number,
  height: number,
) => Promise<GlScene>;

// Mounts a full-composition canvas and redraws it synchronously for every
// frame Remotion asks for. Rendering is pure in `frame`, so frames can be
// rendered out of order and in parallel tabs.
export const GlCanvas: React.FC<{ create: SceneFactory }> = ({ create }) => {
  const frame = useCurrentFrame();
  const { width, height } = useVideoConfig();
  // The composition is laid out at its full size (4K). The WebGL backing
  // store follows the output pixel density, so `--scale=0.5` renders the 4K
  // composition natively at 1920x1080 instead of drawing 4K and discarding
  // three quarters of the pixels.
  const dpr = typeof window === "undefined" ? 1 : window.devicePixelRatio || 1;
  const pxW = Math.round(width * dpr);
  const pxH = Math.round(height * dpr);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [scene, setScene] = useState<GlScene | null>(null);
  const setupDone = useRef(false);
  const [setupHandle] = useState(() =>
    delayRender("Setting up WebGL scene", { timeoutInMilliseconds: 600000 }),
  );

  useEffect(() => {
    let disposed = false;
    let created: GlScene | null = null;
    create(canvasRef.current!, pxW, pxH)
      .then((s) => {
        if (disposed) {
          s.dispose();
          return;
        }
        created = s;
        setScene(s);
      })
      .catch((err) => {
        console.error(err);
        throw err;
      });
    return () => {
      disposed = true;
      created?.dispose();
    };
  }, [create, pxW, pxH]);

  // Draw on the next task (not inside setFrame) so heavy frames never hit
  // the page-evaluation timeout; Remotion waits on the delayRender handle.
  useLayoutEffect(() => {
    if (!scene) return;
    const handle = delayRender(`Drawing frame ${frame}`, {
      timeoutInMilliseconds: 600000,
    });
    const id = setTimeout(() => {
      scene.renderFrame(frame);
      continueRender(handle);
      if (!setupDone.current) {
        setupDone.current = true;
        continueRender(setupHandle);
      }
    }, 0);
    return () => {
      clearTimeout(id);
      continueRender(handle);
    };
  }, [scene, frame, setupHandle]);

  return (
    <AbsoluteFill>
      <canvas
        ref={canvasRef}
        width={pxW}
        height={pxH}
        style={{ width, height, display: "block" }}
      />
    </AbsoluteFill>
  );
};
