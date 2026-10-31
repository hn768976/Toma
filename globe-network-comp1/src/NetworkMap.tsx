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
import { Assets, NetworkMapEngine } from "./engine/NetworkMapEngine";
import { PALETTES, PaletteName } from "./engine/palettes";
import type { LightPoint } from "./engine/arcs";

export type NetworkMapProps = { palette: PaletteName };

const loadAssets = async (): Promise<Assets> => {
  const loader = new THREE.TextureLoader();
  const [land, relief, lights] = await Promise.all([
    loader.loadAsync(staticFile("textures/land_8k.png")),
    loader.loadAsync(staticFile("textures/relief_4k.png")),
    fetch(staticFile("data/lights.json")).then((r) => r.json() as Promise<LightPoint[]>),
  ]);
  return { land, relief, lights };
};

/**
 * Three.js (WebGL 2) globe rendered into a single canvas. The scene is a pure
 * function of time, so any frame can be rendered in any order (Remotion renders
 * frames in parallel across tabs).
 */
export const NetworkMap: React.FC<NetworkMapProps> = ({ palette }) => {
  const frame = useCurrentFrame();
  const { width, height, fps, durationInFrames } = useVideoConfig();
  const canvasRef = useRef<HTMLCanvasElement>(null);
  // Remotion's --scale sets devicePixelRatio. The scene is always rendered at the
  // full composition size (4K) and only the final resample targets the output
  // size, so a 1080p export is a supersampled 4K frame.
  const [outScale] = useState(() => Math.min(1, Math.max(0.25, window.devicePixelRatio || 1)));
  const outW = Math.round(width * outScale);
  const outH = Math.round(height * outScale);
  const [engine, setEngine] = useState<NetworkMapEngine | null>(null);
  const [handle] = useState(() => delayRender("Loading globe textures", { timeoutInMilliseconds: 180000 }));
  const released = useRef(false);

  useEffect(() => {
    let disposed = false;
    let e: NetworkMapEngine | null = null;
    loadAssets()
      .then((assets) => {
        if (disposed) return;
        e = new NetworkMapEngine(assets, {
          width,
          height,
          outputWidth: outW,
          outputHeight: outH,
          palette: PALETTES[palette],
          duration: durationInFrames / fps,
        });
        setEngine(e);
      })
      .catch((err) => cancelRender(err));
    return () => {
      disposed = true;
      e?.dispose();
    };
  }, [width, height, outW, outH, palette, fps, durationInFrames]);

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
    <AbsoluteFill style={{ backgroundColor: PALETTES[palette].background }}>
      <canvas ref={canvasRef} width={outW} height={outH} style={{ width, height }} />
    </AbsoluteFill>
  );
};
