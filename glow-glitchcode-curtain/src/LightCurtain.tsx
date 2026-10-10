import React, { useMemo } from "react";
import { ThreeCanvas } from "@remotion/three";
import { useCurrentFrame, useRemotionEnvironment } from "remotion";
import { Color, Vector3, Vector4 } from "three";
import { CurtainVersion } from "./colourways";
import { HEIGHT, LOOP, WIDTH } from "./constants";
import { RIBBON_SET } from "./curtainParams";
import { RIBBONS, fragmentShader, vertexShader } from "./curtainShader";

/**
 * Look 3: Light Curtain. A full-screen fragment shader on a three.js plane
 * (WebGL2). Flat 2D look: no camera, no perspective. Every uniform is a
 * function of the frame: no useFrame clock, no Date.now(), no state.
 */

const toVec4Array = (src: Float32Array): Vector4[] =>
  Array.from({ length: RIBBONS }, (_, i) =>
    new Vector4(src[i * 4], src[i * 4 + 1], src[i * 4 + 2], src[i * 4 + 3]),
  );

// Hex is sRGB; the shader sums in linear light.
const srgb = (hex: string): Vector3 => {
  const c = new Color().setStyle(hex, "srgb-linear"); // keep raw sRGB numbers
  return new Vector3(c.r, c.g, c.b);
};
const linear = (hex: string): Vector3 => {
  const c = srgb(hex);
  return new Vector3(Math.pow(c.x, 2.2), Math.pow(c.y, 2.2), Math.pow(c.z, 2.2));
};

export const LightCurtain: React.FC<{ version: CurtainVersion }> = ({ version }) => {
  const frame = useCurrentFrame();
  const { isRendering } = useRemotionEnvironment();
  const dpr = isRendering ? window.devicePixelRatio : Math.min(window.devicePixelRatio, 0.5);
  const f = ((frame % LOOP) + LOOP) % LOOP;

  const uniforms = useMemo(
    () => ({
      uPhase: { value: 0 },
      uFrame: { value: 0 },
      uAspect: { value: WIDTH / HEIGHT },
      uA: { value: toVec4Array(RIBBON_SET.a) },
      uB: { value: toVec4Array(RIBBON_SET.b) },
      uC: { value: toVec4Array(RIBBON_SET.c) },
      uD: { value: toVec4Array(RIBBON_SET.d) },
      uRamp: { value: version.ramp.map(linear) },
      uBg0: { value: srgb(version.bg[0]) },
      uBg1: { value: srgb(version.bg[1]) },
      uGlow: { value: linear(version.glow) },
      uExposure: { value: 2.3 },
      uGrain: { value: 0.015 },
    }),
    [version],
  );
  // Pure function of the frame, set before the canvas is drawn.
  uniforms.uPhase.value = f / LOOP;
  uniforms.uFrame.value = f;

  return (
    <ThreeCanvas
      width={WIDTH}
      height={HEIGHT}
      dpr={dpr}
      linear
      flat
      gl={{ antialias: false, preserveDrawingBuffer: true }}
    >
      <mesh frustumCulled={false}>
        <planeGeometry args={[2, 2]} />
        <shaderMaterial
          vertexShader={vertexShader}
          fragmentShader={fragmentShader}
          uniforms={uniforms}
          depthTest={false}
          depthWrite={false}
        />
      </mesh>
    </ThreeCanvas>
  );
};
