import { useEffect, useRef, useState } from "react";
import {
  AbsoluteFill,
  continueRender,
  delayRender,
  useCurrentFrame,
  useVideoConfig,
} from "remotion";
import * as THREE from "three";
import { easeInOutSine, lerp, smoothstep } from "../lib/random";
import {
  createQuestionFieldScene,
  GLOW,
  QUESTION_LIGHT_Y,
  QuestionFieldScene,
} from "./scene";

export type QuestionFieldVariant = "reference" | "orbit";

type CameraKey = {
  azimuth: number;
  distance: number;
  height: number;
  targetY: number;
};

// V1 follows the reference: starts close on the question mark, then slowly
// pulls back, rises and drifts around it so the field opens up.
// V2 is a low-angle hero orbit that sweeps ~115 degrees around the question mark.
const CAMERA: Record<QuestionFieldVariant, [CameraKey, CameraKey]> = {
  reference: [
    { azimuth: -0.28, distance: 9.2, height: 3.8, targetY: 0.8 },
    { azimuth: 0.3, distance: 10.2, height: 4.7, targetY: 0.72 },
  ],
  orbit: [
    { azimuth: -1.2, distance: 6.6, height: 0.7, targetY: 1.0 },
    { azimuth: 0.9, distance: 5.6, height: 1.0, targetY: 0.9 },
  ],
};

const cameraAt = (variant: QuestionFieldVariant, t: number) => {
  const [a, b] = CAMERA[variant];
  const e = easeInOutSine(t);
  return {
    azimuth: lerp(a.azimuth, b.azimuth, variant === "orbit" ? t * 0.35 + e * 0.65 : e),
    distance: lerp(a.distance, b.distance, e),
    height: lerp(a.height, b.height, e),
    targetY: lerp(a.targetY, b.targetY, e),
  };
};

// Glow intensity, as in the reference: the "?" starts as plain cyan, ignites
// over ~0.4 s, then breathes with a ~1.6 s pulse (first peak at ~1.07 s).
const glowAt = (seconds: number) => {
  const ignite = lerp(0.35, 1, smoothstep(0, 0.4, seconds));
  const pulse = 0.9 + 0.17 * Math.cos(((seconds - 1.07) / 1.6) * Math.PI * 2);
  return ignite * lerp(1, pulse, smoothstep(0.2, 0.7, seconds));
};

export const QuestionField: React.FC<{ variant: QuestionFieldVariant }> = ({
  variant,
}) => {
  const frame = useCurrentFrame();
  const { width, height, fps, durationInFrames } = useVideoConfig();
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const sceneRef = useRef<QuestionFieldScene | null>(null);
  const [ready, setReady] = useState(false);
  const [initHandle] = useState(() => delayRender("Building Three.js scene"));

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    // The low orbit (V2) sweeps through the field, so keep its sight line
    // clear; V1 looks down from above and needs no extra clearing.
    const path: [number, number][] =
      variant === "orbit"
        ? Array.from({ length: 96 }, (_, i) => {
            const c = cameraAt(variant, i / 95);
            return [Math.sin(c.azimuth) * c.distance, Math.cos(c.azimuth) * c.distance];
          })
        : [];
    sceneRef.current = createQuestionFieldScene(canvas, width, height, path);
    setReady(true);
    continueRender(initHandle);
    return () => {
      sceneRef.current?.dispose();
      sceneRef.current = null;
    };
  }, [width, height, initHandle, variant]);

  useEffect(() => {
    const s = sceneRef.current;
    if (!ready || !s) return;
    const handle = delayRender(`Rendering frame ${frame}`);
    const t = frame / (durationInFrames - 1);
    const seconds = frame / fps;
    const cam = cameraAt(variant, t);

    s.camera.position.set(
      Math.sin(cam.azimuth) * cam.distance,
      cam.height,
      Math.cos(cam.azimuth) * cam.distance,
    );
    // V1 frames the "?" slightly left of centre, as in the reference.
    s.camera.lookAt(variant === "reference" ? 0.22 : 0, cam.targetY, 0);
    s.camera.updateMatrixWorld();

    const g = glowAt(seconds);
    s.glowMaterial.color.copy(GLOW).multiplyScalar(0.5 + 0.9 * g);
    s.haloMaterial.opacity = 0.2 + 0.8 * g;
    s.poolMaterial.opacity = 0.15 + 0.85 * g;
    s.light.intensity = 9 * g;

    // Keep the question mark in focus wherever the camera goes.
    const focus = s.camera.position.distanceTo(
      new THREE.Vector3(0, QUESTION_LIGHT_Y, 0),
    );
    const uniforms = s.bokeh.uniforms as Record<string, { value: number }>;
    uniforms.focus.value = focus;
    s.grain.uniforms.uSeed.value = (frame % 97) * 1.37;

    s.composer.render();
    continueRender(handle);
  }, [frame, ready, variant, fps, durationInFrames]);

  return (
    <AbsoluteFill style={{ backgroundColor: "#040a17" }}>
      <canvas
        ref={canvasRef}
        width={width}
        height={height}
        style={{ width: "100%", height: "100%" }}
      />
    </AbsoluteFill>
  );
};
