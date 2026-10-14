import { useLayoutEffect, useMemo } from "react";
import * as THREE from "three";
import { mulberry32 } from "../lib/random";
import { HASH, NOISE } from "./glsl";
import type { SharedUniforms } from "./shared";

/* ------------------------------------------------------------------ */
/* Seeded at MODULE LEVEL: every render thread gets identical fields.   */
/* ------------------------------------------------------------------ */

const MAX_STARS = 4000;
const STAR_SEED = (() => {
  const rnd = mulberry32(0x5eed5);
  const a = new Float32Array(MAX_STARS * 7);
  for (let i = 0; i < a.length; i++) a[i] = rnd();
  return a;
})();

const MAX_DUST = 3000;
const DUST_SEED = (() => {
  const rnd = mulberry32(0xd057);
  const a = new Float32Array(MAX_DUST * 6);
  for (let i = 0; i < a.length; i++) a[i] = rnd();
  return a;
})();

/* ------------------------------- Stars ------------------------------ */

const STAR_VERT = /* glsl */ `
uniform float uPxScale;
uniform float uPhase;
uniform float uBrightness;
attribute float aSize;
attribute float aBright;
attribute float aTw;      // twinkle phase
attribute float aTwF;     // whole twinkle cycles per loop
attribute vec3 aTint;
varying float vSigma;
varying vec3 vCol;
varying float vSizePx;
void main() {
  vec4 mv = modelViewMatrix * vec4(position, 1.0);
  gl_Position = projectionMatrix * mv;
  float sigmaD = 0.5 * aSize * uPxScale;
  float sigma = max(sigmaD, 0.55);
  vSigma = sigma;
  float tw = 1.0 + 0.22 * sin(6.2831853 * (aTwF * uPhase + aTw));
  // Same total energy at every resolution: a star clamped to the minimum
  // footprint gets a proportionally lower peak.
  float peak = aBright * uBrightness * tw * (sigmaD * sigmaD) / (sigma * sigma);
  vCol = aTint * peak;
  vSizePx = ceil(sigma * 6.0) + 1.0;
  gl_PointSize = vSizePx;
}
`;

const STAR_FRAG = /* glsl */ `
varying float vSigma;
varying vec3 vCol;
varying float vSizePx;
void main() {
  vec2 d = (gl_PointCoord - 0.5) * vSizePx;
  float g = exp(-dot(d, d) / (2.0 * vSigma * vSigma));
  if (g < 0.003) discard;
  gl_FragColor = vec4(vCol * g, 1.0);
}
`;

const additive = {
  transparent: true,
  depthWrite: false,
  blending: THREE.CustomBlending,
  blendEquation: THREE.AddEquation,
  blendSrc: THREE.OneFactor,
  blendDst: THREE.OneFactor,
} as const;

export const Stars: React.FC<{
  count: number;
  brightness: number;
  /** Unit axis the field is centred on (camera's view direction). */
  axis: THREE.Vector3;
  spreadDeg: number;
  phase: number;
  shared: SharedUniforms;
}> = ({ count, brightness, axis, spreadDeg, phase, shared }) => {
  const geometry = useMemo(() => {
    const n = Math.min(count, MAX_STARS);
    const pos = new Float32Array(n * 3);
    const size = new Float32Array(n);
    const bright = new Float32Array(n);
    const tw = new Float32Array(n);
    const twf = new Float32Array(n);
    const tint = new Float32Array(n * 3);
    const a = axis.clone().normalize();
    const helper = Math.abs(a.y) < 0.9 ? new THREE.Vector3(0, 1, 0) : new THREE.Vector3(1, 0, 0);
    const u = new THREE.Vector3().crossVectors(helper, a).normalize();
    const v = new THREE.Vector3().crossVectors(a, u);
    const cosMax = Math.cos((spreadDeg * Math.PI) / 180);
    const R = 900;
    for (let i = 0; i < n; i++) {
      const s = STAR_SEED.subarray(i * 7, i * 7 + 7);
      const cz = 1 - s[0] * (1 - cosMax);
      const sz = Math.sqrt(1 - cz * cz);
      const ph = 2 * Math.PI * s[1];
      const d = a
        .clone()
        .multiplyScalar(cz)
        .addScaledVector(u, sz * Math.cos(ph))
        .addScaledVector(v, sz * Math.sin(ph));
      pos.set([d.x * R, d.y * R, d.z * R], i * 3);
      size[i] = 0.6 + 1.3 * Math.pow(s[2], 5);
      bright[i] = 0.1 + 0.9 * Math.pow(s[3], 5);
      tw[i] = s[4];
      twf[i] = 1 + Math.floor(s[5] * 3);
      // Colour temperature: mostly white, some blue-white and warm.
      const t = s[6];
      const c =
        t < 0.18 ? [0.75, 0.85, 1.0] : t > 0.88 ? [1.0, 0.85, 0.68] : [1, 0.97, 0.94];
      tint.set(c, i * 3);
    }
    const g = new THREE.BufferGeometry();
    g.setAttribute("position", new THREE.BufferAttribute(pos, 3));
    g.setAttribute("aSize", new THREE.BufferAttribute(size, 1));
    g.setAttribute("aBright", new THREE.BufferAttribute(bright, 1));
    g.setAttribute("aTw", new THREE.BufferAttribute(tw, 1));
    g.setAttribute("aTwF", new THREE.BufferAttribute(twf, 1));
    g.setAttribute("aTint", new THREE.BufferAttribute(tint, 3));
    return g;
  }, [count, axis, spreadDeg]);

  const material = useMemo(
    () =>
      new THREE.ShaderMaterial({
        vertexShader: STAR_VERT,
        fragmentShader: STAR_FRAG,
        uniforms: {
          uPxScale: shared.uPxScale,
          uPhase: { value: 0 },
          uBrightness: { value: 1 },
        },
        ...additive,
      }),
    [shared],
  );
  useLayoutEffect(() => {
    material.uniforms.uPhase.value = phase;
    material.uniforms.uBrightness.value = brightness;
  }, [material, phase, brightness]);

  return (
    <points geometry={geometry} material={material} frustumCulled={false} renderOrder={-5} />
  );
};

/* --------------------------- Orbit dots ----------------------------- */

const DOT_VERT = /* glsl */ `
uniform float uPxScale;
uniform float uSize;
varying float vR;
varying float vBox;
void main() {
  gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
  vR = 0.5 * uSize * uPxScale;
  vBox = ceil(vR * 2.0 + 2.0);
  gl_PointSize = vBox;
}
`;

const DOT_FRAG = /* glsl */ `
uniform vec3 uColor;
uniform float uOpacity;
varying float vR;
varying float vBox;
void main() {
  vec2 d = (gl_PointCoord - 0.5) * vBox;
  float a = clamp(vR + 0.5 - length(d), 0.0, 1.0);
  if (a <= 0.0) discard;
  gl_FragColor = vec4(uColor * uOpacity * a, 1.0);
}
`;

export const OrbitDots: React.FC<{
  radius: number;
  count: number;
  size: number;
  opacity: number;
  shared: SharedUniforms;
}> = ({ radius, count, size, opacity, shared }) => {
  const geometry = useMemo(() => {
    const pos = new Float32Array(count * 3);
    for (let i = 0; i < count; i++) {
      const a = (2 * Math.PI * i) / count;
      pos.set([radius * Math.cos(a), 0, -radius * Math.sin(a)], i * 3);
    }
    const g = new THREE.BufferGeometry();
    g.setAttribute("position", new THREE.BufferAttribute(pos, 3));
    return g;
  }, [radius, count]);
  const material = useMemo(
    () =>
      new THREE.ShaderMaterial({
        vertexShader: DOT_VERT,
        fragmentShader: DOT_FRAG,
        uniforms: {
          uPxScale: shared.uPxScale,
          uSize: { value: size },
          uColor: { value: new THREE.Color("#F0F0F0") },
          uOpacity: { value: opacity },
        },
        ...additive,
      }),
    [shared, size, opacity],
  );
  return <points geometry={geometry} material={material} frustumCulled={false} renderOrder={2} />;
};

/* ------------------------- Nebula + dust ---------------------------- */

const NEBULA_VERT = /* glsl */ `
void main() { gl_Position = vec4(position.xy, 0.0, 1.0); }
`;

const NEBULA_FRAG = /* glsl */ `
${HASH}
${NOISE}
uniform vec2 uResolution;
uniform float uPhase;
uniform vec3 uInner;
uniform vec3 uOuter;
uniform vec2 uCentre;
uniform float uStrength;
void main() {
  vec2 uv = gl_FragCoord.xy / uResolution;
  float aspect = uResolution.x / uResolution.y;
  vec2 p = vec2(uv.x * aspect, uv.y);
  vec2 c = vec2(uCentre.x * aspect, uCentre.y);
  float d = distance(p, c);
  // Slow drift around a closed loop: whole cycles per 600 frames.
  float a = 6.2831853 * uPhase;
  vec3 q = vec3(p * 1.7, 0.0) + vec3(cos(a), sin(a), 0.0) * 0.12;
  float n1 = fbm(q, 6);
  float n2 = fbm(q * 2.6 + vec3(5.2, 1.3, 7.7), 5);
  // Broad glow toward the upper right.
  float glow = exp(-d * d / 0.045) * 0.55 + exp(-d / 0.25) * 0.05;
  glow *= 0.8 + 0.4 * n1;
  // Dusty clouds, strongest lower right, fading toward the left.
  // Wispy dust band across the lower right.
  vec2 cr = vec2(0.78 * aspect, 0.17);
  vec2 dq = (p - cr) / vec2(0.7, 0.24);
  float region = exp(-dot(dq, dq));
  float n3 = fbm(q * 5.5 + vec3(2.1, 8.4, 3.3), 5);
  float n4 = fbm(q * 13.0 + vec3(7.7, 1.9, 5.5), 4);
  float wisps = smoothstep(0.5, 0.85, n1 * 0.5 + n3 * 0.45 + n4 * 0.25);
  float cloud = wisps * region;
  float fil = smoothstep(0.35, 0.75, n2);
  vec3 col = uInner * glow + mix(uOuter, uInner * 0.7, fil) * cloud * 1.5;
  // Faint warm lift toward the right; the left stays clean black.
  col += uOuter * 0.12 * smoothstep(0.35, 1.0, uv.x);
  // Darker lanes cut through the glow.
  col *= 0.7 + 0.3 * smoothstep(0.25, 0.65, n2);
  gl_FragColor = vec4(col * uStrength, 1.0);
}
`;

const DUST_VERT = /* glsl */ `
uniform float uPxScale;
uniform float uPhase;
uniform vec2 uResolution;
attribute vec2 aUv;
attribute float aB;
attribute float aR;
attribute float aPh;
varying float vB;
varying float vSigma;
varying float vBox;
void main() {
  float a = 6.2831853 * (uPhase + aPh);
  vec2 off = vec2(cos(a), sin(a)) * aR * uPxScale / uResolution * 2.0;
  gl_Position = vec4(aUv * 2.0 - 1.0 + off, 0.99999, 1.0);
  float sigmaD = 0.45 * uPxScale;
  vSigma = max(sigmaD, 0.45);
  vB = aB * (sigmaD * sigmaD) / (vSigma * vSigma);
  vBox = ceil(vSigma * 6.0) + 1.0;
  gl_PointSize = vBox;
}
`;

const DUST_FRAG = /* glsl */ `
uniform vec3 uTint;
varying float vB;
varying float vSigma;
varying float vBox;
void main() {
  vec2 d = (gl_PointCoord - 0.5) * vBox;
  float g = exp(-dot(d, d) / (2.0 * vSigma * vSigma));
  gl_FragColor = vec4(uTint * vB * g, 1.0);
}
`;

export const Nebula: React.FC<{
  inner: string;
  outer: string;
  centre: [number, number];
  strength: number;
  dust: number;
  phase: number;
  shared: SharedUniforms;
}> = ({ inner, outer, centre, strength, dust, phase, shared }) => {
  const bg = useMemo(
    () =>
      new THREE.ShaderMaterial({
        vertexShader: NEBULA_VERT,
        fragmentShader: NEBULA_FRAG,
        uniforms: {
          uResolution: shared.uResolution,
          uPhase: { value: 0 },
          uInner: { value: new THREE.Color(inner) },
          uOuter: { value: new THREE.Color(outer) },
          uCentre: { value: new THREE.Vector2(...centre) },
          uStrength: { value: strength },
        },
        depthTest: false,
        depthWrite: false,
      }),
    [shared, inner, outer, centre, strength],
  );

  const dustGeo = useMemo(() => {
    const n = MAX_DUST;
    const uv = new Float32Array(n * 2);
    const b = new Float32Array(n);
    const r = new Float32Array(n);
    const ph = new Float32Array(n);
    for (let i = 0; i < n; i++) {
      const s = DUST_SEED.subarray(i * 6, i * 6 + 6);
      // Bias toward the nebula (right side, lower right).
      const x = 1 - Math.pow(s[0], 1.8) * 0.85;
      const y = Math.pow(s[1], 1.3);
      uv.set([x, y], i * 2);
      b[i] = 0.02 + 0.1 * Math.pow(s[2], 3);
      r[i] = 2 + 6 * s[3];
      ph[i] = s[4];
    }
    const g = new THREE.BufferGeometry();
    g.setAttribute("position", new THREE.BufferAttribute(new Float32Array(n * 3), 3));
    g.setAttribute("aUv", new THREE.BufferAttribute(uv, 2));
    g.setAttribute("aB", new THREE.BufferAttribute(b, 1));
    g.setAttribute("aR", new THREE.BufferAttribute(r, 1));
    g.setAttribute("aPh", new THREE.BufferAttribute(ph, 1));
    return g;
  }, []);

  const dustMat = useMemo(
    () =>
      new THREE.ShaderMaterial({
        vertexShader: DUST_VERT,
        fragmentShader: DUST_FRAG,
        uniforms: {
          uPxScale: shared.uPxScale,
          uResolution: shared.uResolution,
          uPhase: { value: 0 },
          uTint: { value: new THREE.Color(inner).multiplyScalar(dust) },
        },
        ...additive,
        depthTest: true,
      }),
    [shared, inner, dust],
  );

  useLayoutEffect(() => {
    bg.uniforms.uPhase.value = phase;
    dustMat.uniforms.uPhase.value = phase;
  }, [bg, dustMat, phase]);

  return (
    <>
      <mesh material={bg} frustumCulled={false} renderOrder={-10}>
        <planeGeometry args={[2, 2]} />
      </mesh>
      <points geometry={dustGeo} material={dustMat} frustumCulled={false} renderOrder={-4} />
    </>
  );
};
