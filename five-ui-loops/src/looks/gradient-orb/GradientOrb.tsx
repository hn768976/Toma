// Look 5 — Gradient Orb. 2D, 20 s loop. One full-screen fragment shader.
import React, { useMemo } from "react";
import * as THREE from "three";
import { ThreeCanvas } from "@remotion/three";
import { AbsoluteFill, useCurrentFrame, useVideoConfig } from "remotion";
import { GradientOrbVersion } from "../../versions";
import { hexToLinear } from "../../lib/color";
import { GLSL_HASH } from "../../lib/glsl";

export const ORB_LOOP = 600;

const vertexShader = /* glsl */ `
void main() { gl_Position = vec4(position.xy, 0.0, 1.0); }
`;

const fragmentShader = /* glsl */ `
precision highp float;
precision highp int;
uniform vec2 uRes;      // drawing-buffer size in device pixels
uniform float uPhase;   // loop phase 0..1 (frame % 600 / 600)
uniform uint uFrame;    // frame % 600 — drives grain
uniform vec3 uA;        // linear RGB
uniform vec3 uB;
uniform vec3 uBg;
out vec4 outColor;
${GLSL_HASH}
const float TAU = 6.283185307179586;

vec3 grad(float t) {
  return mix(uA, uB, t);
}

void main() {
  vec2 px = gl_FragCoord.xy;
  float H = uRes.y;
  float W = uRes.x;
  vec2 c = 0.5 * uRes;
  vec2 p = px - c;
  float r = length(p);
  float R = 0.225 * H;            // diameter = 45% of frame height
  float soft = 0.015 * W;         // edge blur ~1.5% of width

  // Gradient axis turns once per loop; colour reach breathes (2 whole cycles).
  float ang = TAU * uPhase + 0.7;
  vec2 dir = vec2(cos(ang), sin(ang));
  float reach = 0.16 * sin(TAU * 2.0 * uPhase);
  float tilt = 0.06 * sin(TAU * uPhase + 1.3);
  float t = dot(p, dir) / R;                          // -1..1 across the orb
  float s = clamp(0.5 + 0.58 * t + reach, 0.0, 1.0);
  s = s * s * (3.0 - 2.0 * s);
  vec3 orb = grad(clamp(s + tilt * dot(p, vec2(-dir.y, dir.x)) / R, 0.0, 1.0));

  // Background: flat pale colour with a very subtle vignette.
  vec2 q = p / vec2(W, H);
  float vig = 1.0 - 0.07 * smoothstep(0.25, 0.85, length(q * vec2(1.0, 1.25)));
  vec3 col = uBg * vig;

  // Coloured halo bleeding onto the background (nearest side's colour).
  float outside = max(r - R * 0.92, 0.0);
  float halo = exp(-pow(outside / (0.085 * H), 1.35));
  vec3 haloCol = grad(clamp(0.5 + 0.58 * clamp(t, -1.0, 1.0) + reach, 0.0, 1.0));
  // the darker colour carries further, as a real coloured glow would
  float haloW = 0.42 * halo * (0.75 + 0.25 * s);
  col = mix(col, haloCol, haloW);

  // Orb body, soft edge.
  float m = 1.0 - smoothstep(R - soft, R + soft, r);
  col = mix(col, orb, m);

  vec3 srgb = toSRGB(col);
  // ~4% fine monochrome grain + ±1/255 dither, fixed function of pixel and frame.
  uvec3 key = uvec3(uint(px.x), uint(px.y), uFrame);
  srgb += 0.04 * 0.5 * tri(key);
  srgb += (hash3u(key + uvec3(31u, 17u, 613u)) - 0.5) * (2.0 / 255.0);
  outColor = vec4(clamp(srgb, 0.0, 1.0), 1.0);
}
`;

const Quad: React.FC<{ v: GradientOrbVersion; res: [number, number] }> = ({ v, res }) => {
  const frame = useCurrentFrame();
  const loopFrame = frame % ORB_LOOP;
  const material = useMemo(
    () =>
      new THREE.ShaderMaterial({
        glslVersion: THREE.GLSL3,
        vertexShader,
        fragmentShader,
        depthTest: false,
        depthWrite: false,
        uniforms: {
          uRes: { value: new THREE.Vector2() },
          uPhase: { value: 0 },
          uFrame: { value: 0 },
          uA: { value: new THREE.Vector3(...hexToLinear(v.colorA)) },
          uB: { value: new THREE.Vector3(...hexToLinear(v.colorB)) },
          uBg: { value: new THREE.Vector3(...hexToLinear(v.background)) },
        },
      }),
    [v],
  );
  // Uniforms are set during render, before Remotion's renderer advances R3F.
  material.uniforms.uRes.value.set(res[0], res[1]);
  material.uniforms.uPhase.value = loopFrame / ORB_LOOP;
  material.uniforms.uFrame.value = loopFrame;
  return (
    <mesh frustumCulled={false} material={material}>
      <planeGeometry args={[2, 2]} />
    </mesh>
  );
};

export const GradientOrb: React.FC<{ version: GradientOrbVersion }> = ({ version }) => {
  const { width, height } = useVideoConfig();
  const dpr = typeof window === "undefined" ? 1 : window.devicePixelRatio || 1;
  return (
    <AbsoluteFill style={{ backgroundColor: version.background }}>
      <ThreeCanvas
        width={width}
        height={height}
        dpr={dpr}
        flat
        linear
        gl={{ antialias: false, alpha: false, preserveDrawingBuffer: true, powerPreference: "high-performance" }}
      >
        <Quad v={version} res={[Math.round(width * dpr), Math.round(height * dpr)]} />
      </ThreeCanvas>
    </AbsoluteFill>
  );
};
