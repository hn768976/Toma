import React, { useEffect, useLayoutEffect, useRef, useState } from "react";
import {
  AbsoluteFill,
  cancelRender,
  useCurrentFrame,
  useVideoConfig,
} from "remotion";
import { CameraState, Grade, MonitorRenderer } from "./renderer";
import { drawScreen, SCREEN_H, SCREEN_W } from "./drawScreen";
import { loadMonitorFonts } from "./fonts";

export type MonitorSceneProps = {
  camera: (t: number, duration: number) => CameraState;
  grade: Grade;
};

export const MonitorScene: React.FC<MonitorSceneProps> = ({
  camera,
  grade,
}) => {
  const frame = useCurrentFrame();
  const { fps, width, height, durationInFrames } = useVideoConfig();
  const glCanvas = useRef<HTMLCanvasElement>(null);
  const renderer = useRef<MonitorRenderer | null>(null);
  const screen = useRef<HTMLCanvasElement | null>(null);
  const [fontsReady, setFontsReady] = useState(false);

  useEffect(() => {
    loadMonitorFonts()
      .then(() => setFontsReady(true))
      .catch((err) => cancelRender(err));
  }, []);

  useLayoutEffect(() => {
    if (!fontsReady || !glCanvas.current) return;
    try {
      if (!renderer.current)
        renderer.current = new MonitorRenderer(glCanvas.current);
      if (!screen.current) {
        screen.current = document.createElement("canvas");
        screen.current.width = SCREEN_W;
        screen.current.height = SCREEN_H;
      }
      const t = frame / fps;
      const g = screen.current.getContext("2d")!;
      drawScreen(g, t);
      renderer.current.render(
        screen.current,
        camera(t, durationInFrames / fps),
        grade,
        t,
      );
    } catch (err) {
      cancelRender(err);
    }
  }, [frame, fps, fontsReady, camera, grade, durationInFrames]);

  return (
    <AbsoluteFill style={{ backgroundColor: "#071214" }}>
      <canvas
        ref={glCanvas}
        width={width}
        height={height}
        style={{ width: "100%", height: "100%" }}
      />
    </AbsoluteFill>
  );
};
