import { useEffect, useLayoutEffect, useRef, useState } from "react";
import * as THREE from "three";
import {
  AbsoluteFill,
  cancelRender,
  continueRender,
  delayRender,
  staticFile,
  useCurrentFrame,
  useVideoConfig,
} from "remotion";
import { Assets, EarthEngine, LightPoint, Look } from "./engine/EarthEngine";
import { KEYS_V1, KEYS_V2 } from "./engine/camera";

export type EarthNetworkProps = { variant: "reference" | "orbital" };

export const LOOKS: Record<EarthNetworkProps["variant"], Look> = {
  // V1: tilted drift over a gently curved surface, as in the reference
  reference: {
    keys: KEYS_V1,
    flat: true,
    curvature: 0.12,
    fov: 20,
    post: { haze: 0.45, hazeColor: [0.42, 0.62, 0.74], bottomDark: 0.26, saturation: 0.92 },
    viewRadius: () => 0.75,
  },
  // V2: true globe, rising orbital pull-back
  orbital: {
    keys: KEYS_V2,
    flat: false,
    curvature: 0.5,
    fov: 28,
    post: { blurTop: 0.2, blurBottom: 0.1, focusHalf: 0.24, vignette: 0.42 },
    viewRadius: (dist) => Math.min(1.05, 0.32 + dist * 0.2),
  },
};

const loadAssets = async (): Promise<Assets> => {
  const loader = new THREE.TextureLoader();
  const [day, night, clouds, land, lights] = await Promise.all([
    loader.loadAsync(staticFile("textures/day_4k.jpg")),
    loader.loadAsync(staticFile("textures/night_4k.jpg")),
    loader.loadAsync(staticFile("textures/clouds_4k.jpg")),
    loader.loadAsync(staticFile("textures/land_8k.png")),
    fetch(staticFile("data/lights.json")).then((r) => r.json() as Promise<LightPoint[]>),
  ]);
  return { day, night, clouds, land, lights };
};

/**
 * Three.js (WebGL 2) Earth rendered off-DOM at the full composition size and
 * blitted into a 2D canvas. Every frame is a pure function of time.
 */
export const EarthNetwork: React.FC<EarthNetworkProps> = ({ variant }) => {
  const frame = useCurrentFrame();
  const { width, height, fps, durationInFrames } = useVideoConfig();
  const canvasRef = useRef<HTMLCanvasElement>(null);
  // Remotion's --scale sets devicePixelRatio; only the final resample targets it.
  const [outScale] = useState(() => Math.min(1, Math.max(0.25, window.devicePixelRatio || 1)));
  const outW = Math.round(width * outScale);
  const outH = Math.round(height * outScale);
  const [engine, setEngine] = useState<EarthEngine | null>(null);
  const [handle] = useState(() => delayRender("Loading Earth textures", { timeoutInMilliseconds: 180000 }));
  const released = useRef(false);

  useEffect(() => {
    let disposed = false;
    let e: EarthEngine | null = null;
    loadAssets()
      .then((assets) => {
        if (disposed) return;
        e = new EarthEngine(assets, {
          width,
          height,
          outputWidth: outW,
          outputHeight: outH,
          duration: durationInFrames / fps,
          look: LOOKS[variant],
        });
        setEngine(e);
      })
      .catch((err) => cancelRender(err));
    return () => {
      disposed = true;
      e?.dispose();
    };
  }, [width, height, outW, outH, variant, fps, durationInFrames]);

  useLayoutEffect(() => {
    if (!engine) return;
    engine.render(frame / fps);
    engine.blit(canvasRef.current!.getContext("2d", { willReadFrequently: true })!);
    if (!released.current) {
      released.current = true;
      continueRender(handle);
    }
  }, [engine, frame, fps, handle]);

  return (
    <AbsoluteFill style={{ backgroundColor: "#02060c" }}>
      <canvas ref={canvasRef} width={outW} height={outH} style={{ width, height }} />
    </AbsoluteFill>
  );
};
