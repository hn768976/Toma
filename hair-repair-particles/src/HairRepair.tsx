import React, { useLayoutEffect, useRef } from "react";
import { AbsoluteFill, useCurrentFrame, useVideoConfig } from "remotion";
import * as THREE from "three";
import { PALETTES, Variant } from "./palettes";
import { buildHairScene, HairScene } from "./scene";

type Handle = { renderer: THREE.WebGLRenderer; hair: HairScene };

export const HairRepair: React.FC<{ variant: Variant }> = ({ variant }) => {
  const frame = useCurrentFrame();
  const { fps, width, height } = useVideoConfig();
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const handle = useRef<Handle | null>(null);
  const t = frame / fps;

  // Create the WebGL scene once per palette.
  useLayoutEffect(() => {
    const renderer = new THREE.WebGLRenderer({
      canvas: canvasRef.current!,
      antialias: true,
      alpha: false,
      preserveDrawingBuffer: true,
    });
    // Honour Remotion's --scale flag (devicePixelRatio) so the 4K composition
    // can be rendered directly at 1080p with --scale=0.5.
    renderer.setPixelRatio(window.devicePixelRatio);
    renderer.setSize(width, height, false);
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    renderer.toneMapping = THREE.NoToneMapping;
    handle.current = { renderer, hair: buildHairScene(PALETTES[variant]) };
    return () => {
      handle.current?.hair.dispose();
      renderer.dispose();
      handle.current = null;
    };
  }, [width, height, variant]);

  // Draw synchronously for every frame so screenshots are always in sync.
  useLayoutEffect(() => {
    const h = handle.current;
    if (!h) return;
    h.hair.render(h.renderer, t);
  }, [t, variant, width, height]);

  return (
    <AbsoluteFill style={{ backgroundColor: "#000" }}>
      <canvas
        ref={canvasRef}
        style={{ position: "absolute", inset: 0, width, height }}
      />
    </AbsoluteFill>
  );
};
