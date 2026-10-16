import { useFrame, useThree } from "@react-three/fiber";
import { ThreeCanvas } from "@remotion/three";
import React, { useEffect, useMemo, useRef } from "react";
import { AbsoluteFill, getRemotionEnvironment, useCurrentFrame, useVideoConfig } from "remotion";
import * as THREE from "three";
import { useFontsReady } from "./fonts";

// All colours in this project are written as display (sRGB) values and pass
// straight through: no colour management, no tone mapping.
THREE.ColorManagement.enabled = false;

export interface StageCtx {
  gl: THREE.WebGLRenderer;
  /** physical drawing-buffer size */
  width: number;
  height: number;
  /** physical pixels per 720p pixel */
  u: number;
}

export interface StageApp {
  render(frame: number): void;
  dispose(): void;
}

export type StageFactory = (ctx: StageCtx) => StageApp;

const Driver: React.FC<{ factory: StageFactory; width: number; height: number }> = ({
  factory,
  width,
  height,
}) => {
  const frame = useCurrentFrame();
  const frameRef = useRef(frame);
  frameRef.current = frame;
  const gl = useThree((s) => s.gl);
  const app = useMemo(
    () => factory({ gl, width, height, u: height / 720 }),
    [gl, factory, width, height],
  );
  useEffect(() => () => app.dispose(), [app]);
  // Priority 1 takes over rendering from R3F. The callback ignores R3F's
  // clock entirely: the frame number comes from useCurrentFrame().
  useFrame(() => {
    app.render(frameRef.current);
  }, 1);
  return null;
};

/**
 * Renders a three.js app at the physical output resolution (composition size
 * x Remotion --scale), so a 720p preview is drawn at 720p and a 4K render at 4K.
 */
export const ThreeStage: React.FC<{ factory: StageFactory; background: string }> = ({
  factory,
  background,
}) => {
  const { width, height } = useVideoConfig();
  const fontsReady = useFontsReady();
  const { isRendering } = getRemotionEnvironment();
  const devicePx = typeof window === "undefined" ? 1 : window.devicePixelRatio || 1;
  // In the Studio cap the buffer at 1080p for interactivity.
  const scale = isRendering ? devicePx : Math.min(devicePx, 1920 / width);
  const physW = Math.round(width * scale);
  const physH = Math.round(height * scale);
  // R3F floors width*dpr; nudge so it lands exactly on the target.
  const dpr = (physW + 0.25) / width;

  return (
    <AbsoluteFill style={{ backgroundColor: background }}>
      {fontsReady ? (
        <ThreeCanvas
          width={width}
          height={height}
          dpr={dpr}
          linear
          flat
          gl={{
            antialias: false,
            alpha: false,
            depth: true,
            stencil: false,
            preserveDrawingBuffer: true,
            powerPreference: "high-performance",
          }}
        >
          <Driver factory={factory} width={physW} height={physH} />
        </ThreeCanvas>
      ) : null}
    </AbsoluteFill>
  );
};
