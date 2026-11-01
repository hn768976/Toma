import { useEffect, useLayoutEffect, useRef, useState } from "react";
import {
  AbsoluteFill,
  cancelRender,
  continueRender,
  delayRender,
  useCurrentFrame,
  useVideoConfig,
} from "remotion";
import { BloomScene, type Look } from "./scene";
import { stateAt } from "./timeline";
import { poseAt, type CameraMode } from "./cameras";

export type TubeBloomProps = {
  look: Look;
  camera: CameraMode;
};

export const TubeBloom: React.FC<TubeBloomProps> = ({ look, camera }) => {
  const frame = useCurrentFrame();
  const { width, height } = useVideoConfig();
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const sceneRef = useRef<BloomScene | null>(null);
  const [handle] = useState(() => delayRender("Initialising Three.js"));

  // Render at device resolution: the 3840x2160 composition rendered with
  // `--scale=0.5` draws a native 1920x1080 frame (no 4K render + downscale).
  const dpr = typeof window === "undefined" ? 1 : window.devicePixelRatio || 1;
  const bw = Math.round(width * dpr);
  const bh = Math.round(height * dpr);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    try {
      sceneRef.current = new BloomScene(canvas, bw, bh, look);
      const s = stateAt(frame);
      sceneRef.current.render(s, poseAt(camera, frame, s), frame);
      continueRender(handle);
    } catch (e) {
      cancelRender(e);
    }
    return () => {
      sceneRef.current?.dispose();
      sceneRef.current = null;
    };
    // created once per mount
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useLayoutEffect(() => {
    const sc = sceneRef.current;
    if (!sc) return;
    const s = stateAt(frame);
    sc.render(s, poseAt(camera, frame, s), frame);
  }, [frame, camera]);

  return (
    <AbsoluteFill style={{ backgroundColor: `rgb(${look.bg.map((c) => Math.round(c * 255)).join(",")})` }}>
      <canvas ref={canvasRef} width={bw} height={bh} style={{ width, height, display: "block" }} />
    </AbsoluteFill>
  );
};
