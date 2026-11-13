import React, { useEffect, useRef, useState } from "react";
import {
  AbsoluteFill,
  cancelRender,
  continueRender,
  delayRender,
  useCurrentFrame,
  useVideoConfig,
} from "remotion";
import * as THREE from "three";

export type StageController = {
  render: (frame: number) => void;
  dispose: () => void;
};

export type StageFactory = (args: {
  renderer: THREE.WebGLRenderer;
  /** Backing-store size in device pixels. */
  pixelWidth: number;
  pixelHeight: number;
  fps: number;
  durationInFrames: number;
}) => Promise<StageController>;

/**
 * Hosts an imperative Three.js / WebGL 2 renderer inside a Remotion
 * composition. The canvas backing store follows window.devicePixelRatio, so
 * `--scale=0.5` on a 3840x2160 composition renders natively at 1920x1080
 * while the composition itself stays 4K.
 */
export const ThreeStage: React.FC<{ factory: StageFactory; profile?: boolean }> = ({
  factory,
  profile,
}) => {
  if (profile) (globalThis as { __PROFILE__?: boolean }).__PROFILE__ = true;
  const frame = useCurrentFrame();
  const { width, height, fps, durationInFrames } = useVideoConfig();
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [ctrl, setCtrl] = useState<StageController | null>(null);
  const [initHandle] = useState(() =>
    delayRender("Initialising WebGL stage", { timeoutInMilliseconds: 180000 }),
  );

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    let disposed = false;
    let controller: StageController | null = null;
    const dpr = typeof window !== "undefined" ? window.devicePixelRatio || 1 : 1;
    const pixelWidth = Math.round(width * dpr);
    const pixelHeight = Math.round(height * dpr);
    const renderer = new THREE.WebGLRenderer({
      canvas,
      antialias: false,
      alpha: false,
      preserveDrawingBuffer: true,
      powerPreference: "high-performance",
    });
    renderer.setPixelRatio(1);
    renderer.setSize(pixelWidth, pixelHeight, false);
    renderer.outputColorSpace = THREE.LinearSRGBColorSpace;
    renderer.toneMapping = THREE.NoToneMapping;
    renderer.autoClear = false;

    factory({ renderer, pixelWidth, pixelHeight, fps, durationInFrames })
      .then((c) => {
        if (disposed) {
          c.dispose();
          return;
        }
        controller = c;
        setCtrl(c);
        continueRender(initHandle);
      })
      .catch((err) => cancelRender(err));

    return () => {
      disposed = true;
      controller?.dispose();
      renderer.dispose();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (!ctrl) return;
    const t0 = performance.now();
    ctrl.render(frame);
    if ((globalThis as { __PROFILE__?: boolean }).__PROFILE__) {
      console.log(`[profile] frame ${frame} total=${(performance.now() - t0).toFixed(0)}ms`);
    }
  }, [ctrl, frame]);

  return (
    <AbsoluteFill style={{ backgroundColor: "black" }}>
      <canvas ref={canvasRef} style={{ width, height, display: "block" }} />
    </AbsoluteFill>
  );
};
