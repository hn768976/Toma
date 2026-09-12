import React, { useMemo } from "react";
import * as THREE from "three";
import { buildCurveTexture, type FilamentData } from "./filaments";
import {
  NODE_ACCENT_RATIO,
  NODE_COUNT,
  NODE_MAX_SIZE_PX,
  NODE_MIN_SIZE_PX,
} from "./constants";
import { mulberry32 } from "./random";
import { WOBBLE_GLSL } from "./shared-glsl";
import type { Palette } from "./palettes";

const vertexShader = /* glsl */ `
${WOBBLE_GLSL}

attribute float aCurve;
attribute float aOffset;
attribute float aSpeed;
attribute float aSize;
attribute float aAccent;
attribute float aPhase;

uniform sampler2D uCurves;
uniform vec2 uCurveSize;   // (samples per filament, filament count)
uniform float uPixelScale;
uniform float uRefDistance;
uniform float uSizeScale;

varying float vAccent;
varying float vAlpha;

// Reads a position anywhere along a baked filament curve. Nearest
// sampling plus a manual lerp: linear filtering of float textures needs an
// extension that isn't guaranteed on every GPU.
vec3 sampleCurve(float row, float t) {
  float x = clamp(t, 0.0, 1.0) * (uCurveSize.x - 1.0);
  float i0 = floor(x);
  float i1 = min(i0 + 1.0, uCurveSize.x - 1.0);
  float frac = x - i0;
  float v = (row + 0.5) / uCurveSize.y;
  vec3 p0 = texture2D(uCurves, vec2((i0 + 0.5) / uCurveSize.x, v)).xyz;
  vec3 p1 = texture2D(uCurves, vec2((i1 + 0.5) / uCurveSize.x, v)).xyz;
  return mix(p0, p1, frac);
}

void main() {
  float t = fract(aOffset + uTime * aSpeed);

  // Born just outside the core, spent before the filament tip.
  float fade = smoothstep(0.0, 0.07, t) * (1.0 - smoothstep(0.55, 0.98, t));

  vec3 p = sampleCurve(aCurve, t) + filamentWobble(aCurve, t);

  vec4 mv = modelViewMatrix * vec4(p, 1.0);
  gl_Position = projectionMatrix * mv;

  float twinkle = 0.70 + 0.30 * sin(uTime * 2.3 + aPhase);
  vAlpha = fade * twinkle;
  vAccent = aAccent;

  // Perspective-correct: dots grow as the camera pushes in on them.
  float size = aSize * uPixelScale * uSizeScale * (uRefDistance / max(-mv.z, 0.25));
  gl_PointSize = clamp(size, 1.0, 128.0);
}
`;

const fragmentShader = /* glsl */ `
precision highp float;

uniform vec3 uColorNode;
uniform vec3 uColorAccent;
uniform float uIntensity;

varying float vAccent;
varying float vAlpha;

void main() {
  vec2 offset = gl_PointCoord - 0.5;
  float d = length(offset) * 2.0;
  if (d > 1.0) discard;

  float core = exp(-d * d * 8.5);
  float glow = exp(-d * d * 1.9) * 0.38;
  float alpha = (core + glow) * vAlpha * uIntensity;

  vec3 color = mix(uColorNode, uColorAccent, vAccent);
  // Hot centre: bright dots blow out to white like the reference.
  color = mix(color, vec3(1.0), pow(core, 2.4) * 0.7);

  gl_FragColor = vec4(color * alpha, 1.0);
}
`;

type Props = {
  data: FilamentData;
  palette: Palette;
  pixelScale: number;
  time: number;
  wobble: number;
  intensity: number;
  sizeScale: number;
  refDistance: number;
};

export const TravellingNodes: React.FC<Props> = ({
  data,
  palette,
  pixelScale,
  time,
  wobble,
  intensity,
  sizeScale,
  refDistance,
}) => {
  const curveTexture = useMemo(() => buildCurveTexture(data), [data]);

  const geometry = useMemo(() => {
    const curve = new Float32Array(NODE_COUNT);
    const offset = new Float32Array(NODE_COUNT);
    const speed = new Float32Array(NODE_COUNT);
    const size = new Float32Array(NODE_COUNT);
    const accent = new Float32Array(NODE_COUNT);
    const phase = new Float32Array(NODE_COUNT);
    // Positions are computed in the shader; this attribute only exists so
    // three.js can size the draw call.
    const position = new Float32Array(NODE_COUNT * 3);

    for (let i = 0; i < NODE_COUNT; i++) {
      const rand = mulberry32(i * 2749 + 911);
      curve[i] = Math.floor(rand() * data.count);
      offset[i] = rand();
      // Mostly slow drift with a few quick sparks.
      speed[i] = (0.014 + Math.pow(rand(), 2.2) * 0.075) * (rand() < 0.5 ? 1 : -1);
      size[i] = NODE_MIN_SIZE_PX + Math.pow(rand(), 2.6) * (NODE_MAX_SIZE_PX - NODE_MIN_SIZE_PX);
      accent[i] = rand() < NODE_ACCENT_RATIO ? 1 : 0;
      phase[i] = rand() * Math.PI * 2;
    }

    const g = new THREE.BufferGeometry();
    g.setAttribute("position", new THREE.BufferAttribute(position, 3));
    g.setAttribute("aCurve", new THREE.BufferAttribute(curve, 1));
    g.setAttribute("aOffset", new THREE.BufferAttribute(offset, 1));
    g.setAttribute("aSpeed", new THREE.BufferAttribute(speed, 1));
    g.setAttribute("aSize", new THREE.BufferAttribute(size, 1));
    g.setAttribute("aAccent", new THREE.BufferAttribute(accent, 1));
    g.setAttribute("aPhase", new THREE.BufferAttribute(phase, 1));
    g.boundingSphere = new THREE.Sphere(new THREE.Vector3(), 40);
    return g;
  }, [data]);

  const material = useMemo(
    () =>
      new THREE.ShaderMaterial({
        vertexShader,
        fragmentShader,
        uniforms: {
          uCurves: { value: curveTexture },
          uCurveSize: {
            value: new THREE.Vector2(data.samplesPerFilament, data.count),
          },
          uPixelScale: { value: pixelScale },
          uRefDistance: { value: refDistance },
          uSizeScale: { value: sizeScale },
          uColorNode: { value: new THREE.Color() },
          uColorAccent: { value: new THREE.Color() },
          uIntensity: { value: intensity },
          uTime: { value: 0 },
          uWobble: { value: wobble },
        },
        transparent: true,
        blending: THREE.AdditiveBlending,
        depthWrite: false,
        depthTest: false,
      }),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [curveTexture],
  );

  const u = material.uniforms;
  u.uPixelScale.value = pixelScale;
  u.uRefDistance.value = refDistance;
  u.uSizeScale.value = sizeScale;
  u.uColorNode.value.setRGB(...palette.node);
  u.uColorAccent.value.setRGB(...palette.accent);
  u.uIntensity.value = intensity;
  u.uTime.value = time;
  u.uWobble.value = wobble;

  return <points geometry={geometry} material={material} frustumCulled={false} renderOrder={3} />;
};
