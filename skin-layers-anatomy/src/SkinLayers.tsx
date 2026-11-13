import React, { useLayoutEffect, useRef } from "react";
import { AbsoluteFill, useCurrentFrame, useVideoConfig } from "remotion";
import * as THREE from "three";
import { Labels } from "./Labels";
import { loadFonts } from "./load-fonts";
import { buildSkinScene, SkinScene } from "./scene/buildScene";
import { explodeAmount, getCamera, Variant } from "./timeline";

loadFonts();

type Handle = { renderer: THREE.WebGLRenderer; skin: SkinScene };

export const SkinLayers: React.FC<{ variant: Variant }> = ({ variant }) => {
  const frame = useCurrentFrame();
  const { fps, width, height } = useVideoConfig();
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const handle = useRef<Handle | null>(null);
  const t = frame / fps;

  // Create the WebGL scene once.
  useLayoutEffect(() => {
    const renderer = new THREE.WebGLRenderer({
      canvas: canvasRef.current!,
      antialias: true,
      alpha: true,
      preserveDrawingBuffer: true,
    });
    // Honour Remotion's --scale flag (devicePixelRatio) so the 4K composition
    // can be rendered directly at 1080p with --scale=0.5.
    renderer.setPixelRatio(window.devicePixelRatio);
    renderer.setSize(width, height, false);
    renderer.setClearColor(0x000000, 0);
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    renderer.toneMapping = THREE.NoToneMapping;
    handle.current = { renderer, skin: buildSkinScene() };
    return () => {
      handle.current?.skin.dispose();
      renderer.dispose();
      handle.current = null;
    };
  }, [width, height]);

  // Draw synchronously for every frame so screenshots are always in sync.
  useLayoutEffect(() => {
    const h = handle.current;
    if (!h) return;
    h.skin.setExplode(explodeAmount(t));
    h.renderer.render(h.skin.scene, getCamera(t, variant));
  }, [t, variant, width, height]);

  return (
    <AbsoluteFill
      style={{
        background:
          "radial-gradient(60% 55% at 6% 92%, #dfe5f1 0%, rgba(223,229,241,0) 70%)," +
          "radial-gradient(55% 45% at 88% 100%, #f7e6df 0%, rgba(247,230,223,0) 70%)," +
          "radial-gradient(45% 30% at 45% 100%, #f1eef0 0%, rgba(241,238,240,0) 75%)," +
          "#ffffff",
      }}
    >
      <canvas
        ref={canvasRef}
        style={{ position: "absolute", inset: 0, width, height }}
      />
      <Labels t={t} variant={variant} />
    </AbsoluteFill>
  );
};
