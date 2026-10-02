import { useThree } from "@react-three/fiber";
import React, { useEffect, useLayoutEffect, useMemo } from "react";
import { continueRender, delayRender } from "remotion";
import * as THREE from "three";
import { fontsReady } from "../../lib/fonts";
import { GLStage, useFrameRender } from "../../lib/gl/GLStage";
import { GLSL_FINISH, PostPipeline } from "../../lib/gl/post";
import { GLSL_HASH } from "../../lib/gl/glsl";
import { loopPhase, mod } from "../../lib/loop";
import { hexToRgb, smoothstep } from "../../lib/math";
import { hash01 } from "../../lib/random";
import { drawBadgeFace } from "./faceTexture";
import { faceGeometry, neonCurve } from "./shape";
import type { NeonBadgeVersion } from "./versions";

export const NEON_BADGE_LOOP = 600;

/** Glitch windows [start, length] inside one loop (all end before frame 600). */
export const GLITCHES: Array<[number, number]> = [
  [95, 20],
  [240, 16],
  [372, 24],
  [515, 18],
];

export const glitchAmount = (frame: number) => {
  const f = mod(frame, NEON_BADGE_LOOP);
  let g = 0;
  for (const [s, len] of GLITCHES) {
    const env = smoothstep(s, s + 3, f) * (1 - smoothstep(s + len - 2, s + len, f));
    g = Math.max(g, env);
  }
  return g * (0.72 + 0.28 * hash01(f, 911));
};

const TUBE_VERT = /* glsl */ `
varying vec3 vNormal;
varying vec3 vView;
void main() {
  vec4 wp = modelMatrix * vec4(position, 1.0);
  vNormal = normalize(mat3(modelMatrix) * normal);
  vView = normalize(cameraPosition - wp.xyz);
  gl_Position = projectionMatrix * viewMatrix * wp;
}
`;
const TUBE_FRAG = /* glsl */ `
uniform vec3 uNeon;
uniform float uBright;
varying vec3 vNormal;
varying vec3 vView;
void main() {
  float f = max(dot(normalize(vNormal), vView), 0.0);
  vec3 c = uNeon * (0.95 + 0.9 * f) + vec3(1.0) * pow(f, 4.0) * 0.9;
  gl_FragColor = vec4(c * uBright, 1.0);
}
`;

const FACE_VERT = /* glsl */ `
varying vec2 vUv;
void main() {
  vUv = uv;
  gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
}
`;
const FACE_FRAG = /* glsl */ `
uniform sampler2D tFace;
uniform float uBright;
varying vec2 vUv;
void main() {
  vec4 t = texture2D(tFace, vec2(vUv.x, vUv.y));
  // White text and icon glow (pushed above the bloom threshold); glass and red strip stay put.
  float white = smoothstep(0.72, 0.98, min(t.r, min(t.g, t.b)));
  vec3 c = t.rgb * (1.0 + 0.45 * white) * uBright;
  gl_FragColor = vec4(c * t.a, t.a);
}
`;

const HOLO_FRAG = /* glsl */ `
${GLSL_HASH}
uniform float uScroll;   // 0..3, one full pattern repeat per loop
uniform float uGlitch;
uniform vec3 uTint;
uniform vec3 uStripTint;
varying vec2 vUv;
void main() {
  float cols = 160.0;
  float cx = vUv.x * cols;
  float ci = floor(cx);
  float fx = fract(cx);
  float line = exp(-pow((fx - 0.5) / 0.1, 2.0));
  // Pattern is 3 badge-heights tall and wraps exactly, so scrolling by 3 = one repeat.
  float yy = fract((vUv.y + uScroll) / 3.0);
  float slots = 9.0;
  float sy = yy * slots;
  float si = floor(sy);
  float fy = fract(sy);
  uvec3 key = uvec3(uint(ci), uint(si), 17u);
  float present = step(0.58, hash01(key));
  float len = 0.35 + 0.6 * hash01(key + uvec3(0u, 0u, 1u));
  float start = hash01(key + uvec3(0u, 0u, 2u)) * (1.0 - len);
  float t = (fy - start) / len;
  float body = step(0.0, t) * step(t, 1.0) * pow(1.0 - clamp(t, 0.0, 1.0), 1.4); // head low, tail fades up
  float k = present * line * body * (0.4 + 0.6 * hash01(key + uvec3(0u, 0u, 3u)));
  float inStrip = smoothstep(0.17, 0.2, vUv.y) * (1.0 - smoothstep(0.36, 0.39, vUv.y));
  vec3 col = mix(uTint, uStripTint, inStrip * 0.8 + uGlitch * 0.2);
  float amt = 0.22 + 1.9 * uGlitch;
  gl_FragColor = vec4(col * k * amt, 0.0);
}
`;

const COMPOSITE = /* glsl */ `
uniform sampler2D tScene;
uniform sampler2D tBloom;
uniform vec2 uRes;
uniform float uBloom;
uniform float uGlitch;
uniform vec2 uBgShift;
uniform vec3 uBgDeep;
uniform vec3 uBlink;
uniform uint uFrame;
in vec2 vUv;
out vec4 outColor;
${GLSL_FINISH}
vec4 layer(vec2 uv) {
  return texture(tScene, uv) + vec4(texture(tBloom, uv).rgb * uBloom, 0.0);
}
float speck(vec2 p, vec2 c, float r) {
  vec2 d = (p - c) / r;
  return exp(-dot(d, d)) + 0.18 * exp(-dot(d, d) * 0.04);
}
void main() {
  vec2 uv = vUv;
  float g = uGlitch;
  float split = 0.004 * g;
  vec4 base = layer(uv);
  base.r = layer(uv + vec2(split, 0.0)).r;
  base.b = layer(uv - vec2(split, 0.0)).b;
  if (g > 0.001) {
    // Downward smear: each pixel gathers what sits above it.
    vec4 sm = vec4(0.0);
    float ws = 0.0;
    for (int i = 0; i < 24; i++) {
      float t = float(i) / 23.0;
      float w = 1.0 - 0.75 * t;
      sm += layer(uv + vec2(0.0, t * 0.17 * g)) * w;
      ws += w;
    }
    sm /= ws;
    // Vertically stretched copy blended on top.
    vec4 st = layer(vec2(uv.x + 0.006 * g, 0.78 + (uv.y - 0.78) * 0.78));
    base = mix(base, sm, 0.7 * g) + st * 0.32 * g;
    base.rgb *= 1.0 - 0.32 * g;
  }

  float aspect = uRes.x / uRes.y;
  vec2 p = (uv - 0.5) * vec2(aspect, 1.0) + uBgShift;
  vec3 nearBlack = vec3(0.008, 0.014, 0.04);
  float glow = exp(-dot(p * vec2(0.55, 0.9), p * vec2(0.55, 0.9)) * 2.2);
  vec3 bg = mix(nearBlack, uBgDeep, 0.85 * glow);
  vec2 hz = p - vec2(-0.35, 0.18);
  bg += vec3(0.05, 0.12, 0.32) * exp(-dot(hz, hz) * 3.0) * 0.6;
  // Tiny far-away blinking specks (red / green).
  bg += vec3(1.0, 0.18, 0.15) * uBlink.x * speck(p, vec2(-0.86, 0.08), 0.0022);
  bg += vec3(0.2, 1.0, 0.35) * uBlink.y * speck(p, vec2(-0.93, -0.06), 0.002);
  bg += vec3(0.2, 1.0, 0.35) * uBlink.z * speck(p, vec2(0.83, 0.34), 0.0018);

  vec3 c = bg * (1.0 - clamp(base.a, 0.0, 1.0)) + base.rgb;
  outColor = vec4(finish(c, gl_FragCoord.xy, uFrame, 0.049), 1.0);
}
`;

const Renderer: React.FC<{ version: NeonBadgeVersion }> = ({ version }) => {
  const { advance } = useThree();
  const gl = useThree((s) => s.gl);

  const world = useMemo(() => {
    const scene = new THREE.Scene();
    const badge = new THREE.Group();
    badge.rotation.z = 0.1;
    scene.add(badge);
    const camera = new THREE.PerspectiveCamera(38, 16 / 9, 0.1, 60);

    const tubeMat = new THREE.ShaderMaterial({
      vertexShader: TUBE_VERT,
      fragmentShader: TUBE_FRAG,
      uniforms: { uNeon: { value: new THREE.Vector3(...hexToRgb(version.neon)) }, uBright: { value: 1 } },
    });
    const tube = new THREE.Mesh(new THREE.TubeGeometry(neonCurve(), 720, 0.075, 20, true), tubeMat);
    badge.add(tube);

    const canvas = document.createElement("canvas");
    const faceTex = new THREE.CanvasTexture(canvas);
    faceTex.generateMipmaps = true;
    faceTex.minFilter = THREE.LinearMipmapLinearFilter;
    faceTex.magFilter = THREE.LinearFilter;
    faceTex.colorSpace = THREE.NoColorSpace;
    const faceMat = new THREE.ShaderMaterial({
      vertexShader: FACE_VERT,
      fragmentShader: FACE_FRAG,
      uniforms: { tFace: { value: faceTex }, uBright: { value: 1 } },
      transparent: true,
      depthWrite: true,
      side: THREE.DoubleSide,
      blending: THREE.CustomBlending,
      blendSrc: THREE.OneFactor,
      blendDst: THREE.OneMinusSrcAlphaFactor,
      blendSrcAlpha: THREE.OneFactor,
      blendDstAlpha: THREE.OneMinusSrcAlphaFactor,
    });
    const face = new THREE.Mesh(faceGeometry(0), faceMat);
    face.position.z = -0.01;
    face.renderOrder = 1;
    badge.add(face);

    const holoMat = new THREE.ShaderMaterial({
      vertexShader: FACE_VERT,
      fragmentShader: HOLO_FRAG,
      uniforms: {
        uScroll: { value: 0 },
        uGlitch: { value: 0 },
        uTint: { value: new THREE.Vector3(0.75, 0.92, 1.0) },
        uStripTint: { value: new THREE.Vector3(...hexToRgb(version.stripColor)) },
      },
      transparent: true,
      depthWrite: false,
      side: THREE.DoubleSide,
      blending: THREE.CustomBlending,
      blendSrc: THREE.OneFactor,
      blendDst: THREE.OneFactor,
      blendSrcAlpha: THREE.ZeroFactor,
      blendDstAlpha: THREE.OneFactor,
    });
    const holo = new THREE.Mesh(faceGeometry(0.03), holoMat);
    holo.position.z = 0.02;
    holo.renderOrder = 2;
    badge.add(holo);

    const post = new PostPipeline(COMPOSITE, {
      uBloom: { value: 0.75 },
      uGlitch: { value: 0 },
      uBgShift: { value: new THREE.Vector2() },
      uBgDeep: { value: new THREE.Vector3(...hexToRgb(version.background)) },
      uBlink: { value: new THREE.Vector3() },
      uFrame: { value: 0 },
    });
    return { scene, badge, camera, tubeMat, faceMat, holoMat, faceTex, canvas, post };
  }, [version]);

  // Draw the face (fonts must be loaded first), then re-render the current frame.
  useLayoutEffect(() => {
    const handle = delayRender(`Badge face texture ${version.id}`);
    let cancelled = false;
    fontsReady.then(() => {
      if (cancelled) return;
      drawBadgeFace(world.canvas, version);
      world.faceTex.anisotropy = gl.capabilities.getMaxAnisotropy();
      world.faceTex.needsUpdate = true;
      advance(performance.now());
      continueRender(handle);
    });
    return () => {
      cancelled = true;
      continueRender(handle);
    };
  }, [world, version, advance, gl]);

  useEffect(() => () => world.post.dispose(), [world]);

  useFrameRender((frame, renderer) => {
    const w = world;
    const size = renderer.getDrawingBufferSize(new THREE.Vector2());
    const L = NEON_BADGE_LOOP;
    const t1 = loopPhase(frame, 1, L);
    const t2 = loopPhase(frame, 2, L);
    const t3 = loopPhase(frame, 3, L);

    // Camera on a closed path: yaw about +-30 deg, tilt 16-24 deg, two close push-ins per loop.
    const yaw = 0.5 * Math.sin(t1) + 0.05 * Math.sin(t3 + 0.4);
    const tilt = 0.35 + 0.07 * Math.sin(t2 + 0.8);
    const push = Math.pow(0.5 + 0.5 * Math.cos(t2 + 0.6), 3);
    const dist = 5.7 - 2.5 * push;
    const roll = -0.16 + 0.07 * Math.sin(t1 + 1.0);
    const tx = 0.3 * Math.sin(t1 + 2.0) + 0.25 * push * Math.sin(t3);
    const ty = 0.12 * Math.sin(t2) - 0.2 * push;
    w.camera.position.set(
      tx + dist * Math.sin(yaw) * Math.cos(tilt),
      ty + dist * Math.sin(tilt),
      dist * Math.cos(yaw) * Math.cos(tilt),
    );
    w.camera.up.set(0, 1, 0);
    w.camera.lookAt(tx, ty, 0);
    w.camera.rotateZ(roll);
    w.camera.aspect = size.x / size.y;
    w.camera.updateProjectionMatrix();

    const g = glitchAmount(frame);
    const f = mod(frame, L);
    w.holoMat.uniforms.uScroll.value = (3 * f) / L;
    w.holoMat.uniforms.uGlitch.value = g;
    w.tubeMat.uniforms.uBright.value = 1 - 0.25 * g;
    w.faceMat.uniforms.uBright.value = 1 - 0.2 * g;

    const cu = w.post.composite.uniforms;
    cu.uGlitch.value = g;
    cu.uFrame.value = f;
    cu.uBgShift.value.set(-0.35 * yaw, 0.25 * (tilt - 0.35));
    const blink = (k: number, ph: number) => smoothstep(0.55, 0.75, 0.5 + 0.5 * Math.sin(loopPhase(frame, k, L) + ph));
    cu.uBlink.value.set(blink(10, 0), blink(14, 1.7), blink(8, 4.1));

    w.post.render(renderer, w.scene, w.camera, {
      near: 0.1,
      far: 60,
      focus: w.camera.position.distanceTo(new THREE.Vector3(tx, ty, 0)),
      cocScale: 170 + 110 * push,
      maxCoc: 18,
      bloomThreshold: 1.1,
      bloomKnee: 0.5,
    });
  });
  return null;
};


export const NeonBadge: React.FC<{ version: NeonBadgeVersion }> = ({ version }) => (
  <GLStage>
    <Renderer version={version} />
  </GLStage>
);
