import { THREE, GLSL_HASH, col } from "./three-setup";

// Instanced round dots with a per-dot depth-of-field model.
// A dot of radius `size` at view depth d gets a blur radius
// aperture * |d - focus| (world units, thin-lens approximation), drawn as a
// soft disc whose total energy is conserved. Additive blending, no depth
// write, so no sorting is needed.

export type DotInstances = {
  offsets: Float32Array; // xyz per dot
  sizes: Float32Array; // radius per dot (world units)
  bright: Float32Array; // 0..1 per dot
  mix?: Float32Array; // 0 = colour A, 1 = colour B
  on?: Float32Array; // frame at which the dot turns on (default: always on)
  flick?: Float32Array; // flicker amount 0..1
};

const VERT = /* glsl */ `
precision highp float;
precision highp int;
in vec3 aOffset;
in float aSize;
in float aBright;
in float aMix;
in float aOn;
in float aFlick;
uniform float uFrame;
uniform float uFocus;
uniform float uAperture;
uniform float uMaxBlur;
uniform float uPxPerUnit;
uniform float uSphereDim;
uniform float uNearFade;
uniform float uFarStart;
uniform float uFarEnd;
uniform float uOnRamp;
uniform float uFlickStep;
uniform float uFlickCycle;
uniform float uSoftMin;
out vec2 vCorner;
out float vAlpha;
out float vSoft;
out float vMix;
${GLSL_HASH}
void main() {
  vec4 wp = modelMatrix * vec4(aOffset, 1.0);
  vec4 vp = viewMatrix * wp;
  float d = max(-vp.z, 0.001);
  float blur = min(uAperture * abs(d - uFocus), uMaxBlur);
  float r = sqrt(aSize * aSize + blur * blur);
  float a = aBright * (aSize * aSize) / (r * r);
  float rpx = r * uPxPerUnit / d;
  const float minPx = 1.1;
  if (rpx < minPx) { a *= (rpx * rpx) / (minPx * minPx); r *= minPx / rpx; rpx = minPx; }
  float soft = clamp(max(blur / r + 1.4 / rpx, uSoftMin), 0.02, 1.0);

  if (uSphereDim > 0.0) {
    vec3 n = normalize((modelMatrix * vec4(aOffset, 0.0)).xyz);
    vec3 toCam = normalize(cameraPosition - wp.xyz);
    a *= mix(uSphereDim, 1.0, smoothstep(-0.08, 0.25, dot(n, toCam)));
  }
  a *= smoothstep(uNearFade * 0.4, uNearFade, d) * (1.0 - smoothstep(uFarStart, uFarEnd, d));

  // turn-on and flicker, both pure functions of the frame
  a *= smoothstep(aOn, aOn + uOnRamp, uFrame);
  if (aFlick > 0.0) {
    float s = uFrame / uFlickStep;
    float i0 = floor(s);
    float k0 = mod(i0, uFlickCycle);
    float k1 = mod(i0 + 1.0, uFlickCycle);
    uint id = uint(gl_InstanceID);
    float h0 = rnd3(uvec3(id, uint(k0), 17u));
    float h1 = rnd3(uvec3(id, uint(k1), 17u));
    float f = s - i0;
    float h = mix(h0, h1, f * f * (3.0 - 2.0 * f));
    a *= mix(1.0, 0.25 + 1.1 * h * h, aFlick);
  }

  vp.xy += position.xy * r;
  gl_Position = projectionMatrix * vp;
  vCorner = position.xy;
  vAlpha = a;
  vSoft = soft;
  vMix = aMix;
}
`;

const FRAG = /* glsl */ `
precision highp float;
uniform vec3 uColorA;
uniform vec3 uColorB;
uniform float uIntensity;
in vec2 vCorner;
in float vAlpha;
in float vSoft;
in float vMix;
out vec4 outColor;
void main() {
  float dist = length(vCorner);
  if (dist > 1.0) discard;
  float m = 1.0 - smoothstep(1.0 - vSoft, 1.0, dist);
  // slightly brighter rim on big bokeh discs
  m *= mix(1.0, 0.75 + 0.35 * smoothstep(0.2, 0.95, dist), clamp(vSoft * 1.5 - 0.3, 0.0, 1.0));
  vec3 c = mix(uColorA, uColorB, vMix) * vAlpha * m * uIntensity;
  outColor = vec4(c, 1.0);
}
`;

export type DotMaterialOptions = {
  colorA: string;
  colorB?: string;
  focus: number;
  aperture: number;
  maxBlur?: number;
  sphereDim?: number;
  nearFade?: number;
  farStart?: number;
  farEnd?: number;
  intensity?: number;
  onRamp?: number;
  flickStep?: number;
  flickCycle?: number;
  /** 1 = fully soft (glow) */
  softMin?: number;
};

export const makeDotMaterial = (o: DotMaterialOptions) =>
  new THREE.ShaderMaterial({
    glslVersion: THREE.GLSL3,
    vertexShader: VERT,
    fragmentShader: FRAG,
    transparent: true,
    depthTest: false,
    depthWrite: false,
    blending: THREE.CustomBlending,
    blendEquation: THREE.AddEquation,
    blendSrc: THREE.OneFactor,
    blendDst: THREE.OneFactor,
    uniforms: {
      uFrame: { value: 0 },
      uFocus: { value: o.focus },
      uAperture: { value: o.aperture },
      uMaxBlur: { value: o.maxBlur ?? 1e6 },
      uPxPerUnit: { value: 1000 },
      uSphereDim: { value: o.sphereDim ?? 0 },
      uNearFade: { value: o.nearFade ?? 0.5 },
      uFarStart: { value: o.farStart ?? 1e5 },
      uFarEnd: { value: o.farEnd ?? 2e5 },
      uOnRamp: { value: o.onRamp ?? 1 },
      uFlickStep: { value: o.flickStep ?? 6 },
      uFlickCycle: { value: o.flickCycle ?? 100000 },
      uColorA: { value: col(o.colorA) },
      uColorB: { value: col(o.colorB ?? o.colorA) },
      uIntensity: { value: o.intensity ?? 1 },
      uSoftMin: { value: o.softMin ?? 0 },
    },
  });

export const makeDotGeometry = (inst: DotInstances) => {
  const n = inst.sizes.length;
  const geo = new THREE.InstancedBufferGeometry();
  const quad = new THREE.PlaneGeometry(2, 2);
  geo.index = quad.index;
  geo.setAttribute("position", quad.getAttribute("position"));
  const fill = (v: number) => new Float32Array(n).fill(v);
  geo.setAttribute("aOffset", new THREE.InstancedBufferAttribute(inst.offsets, 3));
  geo.setAttribute("aSize", new THREE.InstancedBufferAttribute(inst.sizes, 1));
  geo.setAttribute("aBright", new THREE.InstancedBufferAttribute(inst.bright, 1));
  geo.setAttribute("aMix", new THREE.InstancedBufferAttribute(inst.mix ?? fill(0), 1));
  geo.setAttribute("aOn", new THREE.InstancedBufferAttribute(inst.on ?? fill(-1e6), 1));
  geo.setAttribute("aFlick", new THREE.InstancedBufferAttribute(inst.flick ?? fill(0), 1));
  geo.instanceCount = n;
  return geo;
};

/** Focal length in drawing-buffer pixels at distance 1, for a perspective camera. */
export const pxPerUnit = (fovDeg: number, bufferHeight: number) =>
  bufferHeight / 2 / Math.tan((fovDeg * Math.PI) / 360);
