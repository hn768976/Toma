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
import { createStage, type LookBuilder, type Stage, type StageOptions } from "./stage";

/**
 * Hosts one Pixi WebGL2 renderer. No ticker: the stage is rendered exactly once
 * per Remotion frame, synchronously, from useCurrentFrame() alone.
 */
export const PixiLook = <P,>({
  build,
  params,
  options,
}: {
  build: LookBuilder<P>;
  params: P;
  options: StageOptions;
}) => {
  const frame = useCurrentFrame();
  const { width, height, fps } = useVideoConfig();
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const stageRef = useRef<Stage | null>(null);
  const frameRef = useRef(frame);
  frameRef.current = frame;
  // Init gate only (not a visual): holds the first frame until sprites are baked.
  const [handle] = useState(() =>
    delayRender("Initialising PixiJS stage", { timeoutInMilliseconds: 180000 }),
  );
  const key = JSON.stringify(params) + JSON.stringify(options);

  useEffect(() => {
    let cancelled = false;
    const env = getRemotionEnvironment();
    const dpr = window.devicePixelRatio || 1;
    // When rendering, device pixels per layout unit == --scale. In the Studio,
    // draw at most 1920x1080 so scrubbing stays interactive.
    const resolution = env.isRendering ? dpr : Math.min(dpr, 0.5);
    const canvas = canvasRef.current!;
    createStage(canvas, { width, height, resolution, fps }, build, params, options)
      .then((stage) => {
        if (cancelled) {
          stage.destroy();
          return;
        }
        stageRef.current = stage;
        stage.render(frameRef.current);
        continueRender(handle);
      })
      .catch((err) => cancelRender(err));
    return () => {
      cancelled = true;
      stageRef.current?.destroy();
      stageRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key, width, height, fps]);

  useLayoutEffect(() => {
    stageRef.current?.render(frame);
  }, [frame]);

  return (
    <AbsoluteFill style={{ backgroundColor: "black" }}>
      <canvas ref={canvasRef} style={{ width, height, display: "block" }} />
    </AbsoluteFill>
  );
};
