import { ThreeCanvas } from "@remotion/three";
import React, { useLayoutEffect, useMemo } from "react";
import {
  AdditiveBlending,
  Color,
  InstancedBufferAttribute,
  InstancedBufferGeometry,
  Mesh,
  PlaneGeometry,
  ShaderMaterial,
} from "three";
import { useCurrentFrame, useVideoConfig } from "remotion";
import { ATLAS_COLS, ATLAS_ROWS, getAtlases } from "./atlas";
import { CAM_DIST, CAM_FOV, COLORS, VIEW_H } from "./config";
import { PARTICLES } from "./particles";
import type { WordData } from "./sampling";

// Every particle position is a closed-form function of uFrame, evaluated in
// the vertex shader. Nothing is simulated or carried between frames.
const vertexShader = /* glsl */ `
uniform float uFrame;
uniform float uCamDist;
attribute vec3 aStart;
attribute vec3 aCtrl1;
attribute vec3 aCtrl2;
attribute vec3 aTarget;
attribute vec4 aTime;
attribute vec4 aLook;
attribute vec4 aSpark;
varying vec2 vUv;
varying float vAlpha;
varying float vBlur;
varying float vGlyph;
varying float vOrange;

vec3 bez(vec3 a, vec3 b, vec3 c, vec3 d, float t) {
  float s = 1.0 - t;
  return s*s*s*a + 3.0*s*s*t*b + 3.0*s*t*t*c + t*t*t*d;
}
vec2 rot(vec2 p, float a) {
  float c = cos(a), s = sin(a);
  return vec2(c*p.x - s*p.y, s*p.x + c*p.y);
}
float h11(float n) { return fract(sin(n * 127.1) * 43758.5453); }

vec3 posAt(float t) {
  float spawn = aTime.x, arrive = aTime.y;
  float u = clamp((t - spawn) / (arrive - spawn), 0.0, 1.0);
  float e = 1.0 - pow(1.0 - u, 2.2);
  vec3 p = bez(aStart, aCtrl1, aCtrl2, aTarget, e);
  p.xy = rot(p.xy, aSpark.w * pow(1.0 - e, 1.5));
  // Shimmer once landed.
  float settled = smoothstep(arrive, arrive + 6.0, t);
  float sd = aLook.w * 60.0;
  p += vec3(sin(t * 0.31 + sd), cos(t * 0.27 + sd * 1.3), 0.0) * 0.004 * ${VIEW_H.toFixed(4)} * settled;
  // Sparks: flung outward on a fixed decelerating path.
  if (aTime.w > 0.0 && t > aTime.w) {
    float s = t - aTime.w;
    p += aSpark.xyz * (1.0 - exp(-s / 9.0));
  }
  return p;
}

void main() {
  float t = uFrame;
  vec3 p = posAt(t);
  vec3 pp = posAt(t - 1.0);
  vec4 mv = viewMatrix * vec4(p, 1.0);
  vec4 mvp = viewMatrix * vec4(pp, 1.0);

  float depth = -mv.z;
  // Closer than the word plane -> bigger and defocused.
  float nearK = clamp((uCamDist - depth) / (uCamDist * 0.6), 0.0, 1.0);
  float blur = smoothstep(0.1, 0.9, nearK);
  float landed = smoothstep(aTime.y, aTime.y + 4.0, t);
  // Slightly smaller once landed so counters (a, o, e) stay open.
  float size = aLook.y * (1.0 + 1.6 * blur) * mix(1.0, 0.8, landed);

  // Motion streak: stretch along view-space velocity.
  vec2 vel = mv.xy - mvp.xy;
  float vlen = length(vel);
  float streak = vlen * 1.6;
  float k = smoothstep(0.4, 1.4, streak / size);
  vec2 dir = vlen > 1e-5 ? vel / vlen : vec2(1.0, 0.0);
  dir *= dir.x >= 0.0 ? 1.0 : -1.0;
  vec2 ax = normalize(mix(vec2(1.0, 0.0), dir, k) + vec2(1e-5, 0.0));
  vec2 ay = vec2(-ax.y, ax.x);
  float lx = size + streak * k;
  vec2 corner = position.xy;
  mv.xy += ax * corner.x * lx + ay * corner.y * size;

  float a = smoothstep(aTime.x, aTime.x + 10.0, t);
  a *= 1.0 - 0.75 * smoothstep(150.0, 300.0, depth);
  a *= 1.0 - 0.55 * blur;
  a *= mix(1.0, sqrt(size / lx), k);
  if (aTime.w > 0.0) {
    a *= t > aTime.w ? exp(-(t - aTime.w) / 9.0) * 1.6 : 1.0;
  } else {
    a *= 1.0 - smoothstep(aTime.z, aTime.z + 12.0, t);
  }
  // Twinkle once landed.
  float settled = landed;
  a *= (1.0 - 0.25 * settled) * (1.0 - settled * 0.45 * h11(floor(t / 2.0) + aLook.w * 997.0));
  if (t < aTime.x) a = 0.0;

  // Glyphs flicker between symbols once landed ("live data").
  float g = aLook.x;
  if (settled > 0.5) g = floor(h11(floor(t / 3.0) * 1.7 + aLook.w * 311.0) * 10.0);

  vUv = vec2(corner.x + 0.5, 0.5 - corner.y);
  vAlpha = a;
  vBlur = blur;
  vGlyph = g;
  vOrange = aLook.z;
  gl_Position = a <= 0.0 ? vec4(2.0, 2.0, 2.0, 1.0) : projectionMatrix * mv;
}
`;

const fragmentShader = /* glsl */ `
uniform sampler2D uSharp;
uniform sampler2D uSoft;
uniform vec3 uCool;
uniform vec3 uWarm;
uniform float uFrame;
varying vec2 vUv;
varying float vAlpha;
varying float vBlur;
varying float vGlyph;
varying float vOrange;

float hash12(vec2 p) {
  vec3 p3 = fract(vec3(p.xyx) * 0.1031);
  p3 += dot(p3, p3.yzx + 33.33);
  return fract((p3.x + p3.y) * p3.z);
}

void main() {
  vec2 cell = vec2(mod(vGlyph, ${ATLAS_COLS}.0), floor(vGlyph / ${ATLAS_COLS}.0));
  vec2 uv = (cell + vUv) / vec2(${ATLAS_COLS}.0, ${ATLAS_ROWS}.0);
  float m = mix(texture2D(uSharp, uv).a, texture2D(uSoft, uv).a * 1.4, vBlur);
  float cov = m * vAlpha;
  vec3 col = mix(uCool, uWarm, vOrange) * cov;
  // +-1/255 dither, scaled by coverage so quads leave no visible footprint.
  float n = hash12(gl_FragCoord.xy + vec2(uFrame * 7.13, uFrame * 3.71)) - 0.5;
  col += n * (2.0 / 255.0) * clamp(cov * 6.0, 0.0, 1.0);
  gl_FragColor = vec4(max(col, 0.0), 1.0);
  #include <tonemapping_fragment>
  #include <colorspace_fragment>
}
`;

const ParticleMesh: React.FC<{ data: WordData }> = ({ data }) => {
  const frame = useCurrentFrame();

  const mesh = useMemo(() => {
    const quad = new PlaneGeometry(1, 1);
    const geo = new InstancedBufferGeometry();
    geo.index = quad.index;
    geo.setAttribute("position", quad.getAttribute("position"));
    const n = data.targets.length / 2;
    geo.instanceCount = n;
    const target = new Float32Array(n * 3);
    const ctrl2 = new Float32Array(n * 3);
    for (let i = 0; i < n; i++) {
      // N units (y down) -> world units (y up), word plane z = 0.
      target[i * 3] = data.targets[i * 2] * VIEW_H;
      target[i * 3 + 1] = -data.targets[i * 2 + 1] * VIEW_H;
      target[i * 3 + 2] = 0;
      ctrl2[i * 3] = target[i * 3] + PARTICLES.ctrl2Off[i * 3];
      ctrl2[i * 3 + 1] = target[i * 3 + 1] + PARTICLES.ctrl2Off[i * 3 + 1];
      ctrl2[i * 3 + 2] = PARTICLES.ctrl2Off[i * 3 + 2];
    }
    geo.setAttribute("aStart", new InstancedBufferAttribute(PARTICLES.start, 3));
    geo.setAttribute("aCtrl1", new InstancedBufferAttribute(PARTICLES.ctrl1, 3));
    geo.setAttribute("aCtrl2", new InstancedBufferAttribute(ctrl2, 3));
    geo.setAttribute("aTarget", new InstancedBufferAttribute(target, 3));
    geo.setAttribute("aTime", new InstancedBufferAttribute(PARTICLES.time, 4));
    geo.setAttribute("aLook", new InstancedBufferAttribute(PARTICLES.look, 4));
    geo.setAttribute("aSpark", new InstancedBufferAttribute(PARTICLES.spark, 4));

    const { sharp, soft } = getAtlases();
    const mat = new ShaderMaterial({
      vertexShader,
      fragmentShader,
      uniforms: {
        uFrame: { value: 0 },
        uCamDist: { value: CAM_DIST },
        uSharp: { value: sharp },
        uSoft: { value: soft },
        uCool: { value: new Color("#cfe8ff").multiplyScalar(1.15) },
        uWarm: { value: new Color(COLORS.orange).multiplyScalar(1.8) },
      },
      transparent: true,
      depthTest: false,
      depthWrite: false,
      blending: AdditiveBlending,
    });
    const m = new Mesh(geo, mat);
    m.frustumCulled = false;
    return m;
  }, [data]);

  // Runs before R3F's frame advance (which happens in a passive effect).
  useLayoutEffect(() => {
    (mesh.material as ShaderMaterial).uniforms.uFrame.value = frame;
  }, [frame, mesh]);

  return <primitive object={mesh} />;
};

export const ParticleLayer: React.FC<{ data: WordData }> = ({ data }) => {
  const { width, height } = useVideoConfig();
  const dpr = typeof window === "undefined" ? 1 : window.devicePixelRatio;
  return (
    <ThreeCanvas
      width={width}
      height={height}
      dpr={dpr}
      gl={{ antialias: true, alpha: false, preserveDrawingBuffer: true }}
      camera={{ fov: CAM_FOV, position: [0, 0, CAM_DIST], near: 0.5, far: 1000 }}
      style={{ position: "absolute", inset: 0, mixBlendMode: "screen" }}
      onCreated={({ gl }) => gl.setClearColor("#000000", 1)}
    >
      <ParticleMesh data={data} />
    </ThreeCanvas>
  );
};
