import { useEffect, useRef, useState } from "react";
import { AbsoluteFill, continueRender, delayRender, useCurrentFrame, useVideoConfig } from "remotion";
import * as THREE from "three";
import { FRAGMENT_SHADER, VERTEX_SHADER } from "./shader";
import { glitchAt } from "./glitch";
import { BACKGROUND_COVER_SCALE, SCANLINE_COUNT } from "./constants";

/**
 * Renders the procedural background with three.js on a single fullscreen quad.
 *
 * The WebGL context, geometry and material are created once and kept in refs;
 * each frame only pushes new uniform values and re-renders. Rebuilding the
 * context per frame would work but costs roughly an order of magnitude more
 * time across 600 frames, which matters at 4K.
 *
 * delayRender() is held until the first draw has actually completed, so
 * Remotion never screenshots an empty canvas.
 */
export const DataFieldCanvas: React.FC<{ columns: number; kickPx: number }> = ({
  columns,
  kickPx,
}) => {
  const frame = useCurrentFrame();
  const { width, height, fps } = useVideoConfig();

  const canvasRef = useRef<HTMLCanvasElement>(null);
  const rendererRef = useRef<THREE.WebGLRenderer | null>(null);
  const materialRef = useRef<THREE.ShaderMaterial | null>(null);
  const sceneRef = useRef<THREE.Scene | null>(null);
  const cameraRef = useRef<THREE.OrthographicCamera | null>(null);

  const [handle] = useState(() => delayRender("Rendering data field"));

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    if (!rendererRef.current) {
      const renderer = new THREE.WebGLRenderer({
        canvas,
        antialias: false,
        alpha: false,
        // The frame is read back by Remotion, so the buffer must survive
        // past the draw call.
        preserveDrawingBuffer: true,
      });
      renderer.setPixelRatio(1);
      renderer.setSize(width, height, false);

      const material = new THREE.ShaderMaterial({
        vertexShader: VERTEX_SHADER,
        fragmentShader: FRAGMENT_SHADER,
        depthTest: false,
        depthWrite: false,
        uniforms: {
          uTime: { value: 0 },
          uRes: { value: new THREE.Vector2(width, height) },
          uAspect: { value: width / height },
          uIntensity: { value: 0 },
          uSplit: { value: 0 },
          uPixel: { value: 1 },
          uTear: { value: 0 },
          uFlicker: { value: 1 },
          uCols: { value: columns },
          uScanlines: { value: SCANLINE_COUNT },
        },
      });

      const scene = new THREE.Scene();
      scene.add(new THREE.Mesh(new THREE.PlaneGeometry(2, 2), material));

      rendererRef.current = renderer;
      materialRef.current = material;
      sceneRef.current = scene;
      cameraRef.current = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1);
    }

    const renderer = rendererRef.current;
    const material = materialRef.current;
    const scene = sceneRef.current;
    const camera = cameraRef.current;
    if (!renderer || !material || !scene || !camera) return;

    const g = glitchAt(frame);
    material.uniforms.uTime.value = frame / fps;
    material.uniforms.uIntensity.value = g.intensity;
    material.uniforms.uSplit.value = g.split;
    material.uniforms.uPixel.value = g.pixel;
    material.uniforms.uTear.value = g.tear;
    material.uniforms.uFlicker.value = g.flicker;
    material.uniforms.uCols.value = columns;

    renderer.render(scene, camera);
    continueRender(handle);
  }, [frame, width, height, fps, columns, handle]);

  // The GL context is intentionally disposed only on unmount, not per frame.
  useEffect(() => {
    return () => {
      rendererRef.current?.dispose();
      rendererRef.current = null;
    };
  }, []);

  // A touch of optical softness. The reference field is not pixel-crisp — it
  // reads as a screen photographed slightly out of focus — and the blur radius
  // is a fraction of the frame height so 4K gets the same *apparent* softness
  // rather than a sharper picture.
  const blurPx = height * 0.0011;

  return (
    <AbsoluteFill style={{ backgroundColor: "#000000", overflow: "hidden" }}>
      <canvas
        ref={canvasRef}
        width={width}
        height={height}
        style={{
          width,
          height,
          display: "block",
          filter: `blur(${blurPx.toFixed(2)}px)`,
          // Oversized so that neither the glitch kick nor the blur can pull
          // the canvas edge into frame. translateX is written before scale so
          // the kick stays in un-scaled frame units.
          transform: `translateX(${kickPx.toFixed(2)}px) scale(${BACKGROUND_COVER_SCALE})`,
        }}
      />
    </AbsoluteFill>
  );
};
