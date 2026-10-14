import { useEffect, useLayoutEffect, useRef, useState } from "react";
import {
  AbsoluteFill,
  cancelRender,
  continueRender,
  delayRender,
  getRemotionEnvironment,
  useCurrentFrame,
  useVideoConfig,
} from "remotion";
import { LightEngine } from "./kit/engine";
import { VARIANTS } from "./variants";

export type LightSceneProps = { variantId: string; loopCheck?: boolean };

export const LightScene: React.FC<LightSceneProps> = ({ variantId }) => {
  const frame = useCurrentFrame();
  const { width, height } = useVideoConfig();
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [engine, setEngine] = useState<LightEngine | null>(null);
  const [initHandle] = useState(() => delayRender(`Init PixiJS for ${variantId}`, { timeoutInMilliseconds: 120000 }));

  useEffect(() => {
    const variant = VARIANTS.find((v) => v.id === variantId);
    if (!variant) {
      cancelRender(new Error(`Unknown variant ${variantId}`));
      return;
    }
    // While rendering, Remotion sets devicePixelRatio = --scale, so the GL canvas is
    // exactly the output size (1280x720 at --scale=1/3, 3840x2160 at 1, 6000x3375 at 1.5625).
    // In the Studio the canvas is capped at half resolution to keep scrubbing fluid.
    const dpr = window.devicePixelRatio || 1;
    const scale = getRemotionEnvironment().isRendering ? dpr : Math.min(dpr, 0.5);
    const physW = Math.round(width * scale);
    const physH = Math.round(height * scale);
    const canvas = canvasRef.current!;
    const e = new LightEngine();
    let alive = true;
    e.init(canvas, physW, physH, variant.make())
      .then(() => {
        if (alive) setEngine(e);
        else e.destroy();
      })
      .catch((err) => cancelRender(err));
    return () => {
      alive = false;
      setEngine(null);
      e.destroy();
    };
  }, [variantId, width, height]);

  useLayoutEffect(() => {
    if (!engine) return;
    engine.render(frame);
  }, [engine, frame]);

  useEffect(() => {
    if (engine) continueRender(initHandle);
  }, [engine, initHandle]);

  return (
    <AbsoluteFill style={{ backgroundColor: "black" }}>
      <canvas ref={canvasRef} style={{ width, height, display: "block" }} />
    </AbsoluteFill>
  );
};
