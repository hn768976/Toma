import * as THREE from "three";

/**
 * Material presets. The supplied GLBs ship with no materials at all, so every
 * look in this project is authored here and attached to the untouched
 * geometry at render time.
 */

export type FrostedOptions = {
  color: string;
  opacity?: number;
  roughness?: number;
  envIntensity?: number;
  clearcoat?: number;
  emissive?: string;
  emissiveIntensity?: number;
};

/**
 * Frosted / satin glass. Deliberately avoids `transmission`, which forces
 * three to render a second pass into a transmission target — far too costly
 * under software rasterisation. A rough, clearcoated, env-lit translucent
 * surface reads the same at these scales.
 */
export const frostedGlass = (o: FrostedOptions) => {
  const m = new THREE.MeshPhysicalMaterial({
    color: new THREE.Color(o.color),
    transparent: (o.opacity ?? 0.62) < 1,
    opacity: o.opacity ?? 0.62,
    roughness: o.roughness ?? 0.32,
    metalness: 0,
    clearcoat: o.clearcoat ?? 1,
    clearcoatRoughness: 0.18,
    envMapIntensity: o.envIntensity ?? 1.6,
    side: THREE.FrontSide,
    depthWrite: (o.opacity ?? 0.62) > 0.9,
  });
  if (o.emissive) {
    m.emissive = new THREE.Color(o.emissive);
    m.emissiveIntensity = o.emissiveIntensity ?? 0.4;
  }
  return m;
};

export const glossyGlass = (o: FrostedOptions) =>
  frostedGlass({ roughness: 0.06, clearcoat: 1, envIntensity: 2.4, ...o });

export type CeramicOptions = {
  color: string;
  roughness?: number;
  envIntensity?: number;
  sheen?: string;
};

/** Matte, softly-lit plastic — the ref 09 / ref 10 studio look. */
export const matteCeramic = (o: CeramicOptions) => {
  const m = new THREE.MeshPhysicalMaterial({
    color: new THREE.Color(o.color),
    roughness: o.roughness ?? 0.62,
    metalness: 0.04,
    clearcoat: 0.35,
    clearcoatRoughness: 0.5,
    envMapIntensity: o.envIntensity ?? 1.1,
  });
  if (o.sheen) {
    m.sheen = 1;
    m.sheenColor = new THREE.Color(o.sheen);
    m.sheenRoughness = 0.6;
  }
  return m;
};

export type MetalOptions = {
  color: string;
  roughness?: number;
  metalness?: number;
  envIntensity?: number;
};

export const brushedMetal = (o: MetalOptions) =>
  new THREE.MeshPhysicalMaterial({
    color: new THREE.Color(o.color),
    roughness: o.roughness ?? 0.28,
    metalness: o.metalness ?? 0.9,
    envMapIntensity: o.envIntensity ?? 1.8,
  });

/* ------------------------------------------------------------------ *
 * Fresnel glow shell
 * ------------------------------------------------------------------ */

const FRESNEL_VERT = /* glsl */ `
  varying vec3 vNormalW;
  varying vec3 vViewDir;
  varying float vAxis;
  uniform float uAxisMin;
  uniform float uAxisSpan;

  void main() {
    vec4 world = modelMatrix * vec4(position, 1.0);
    vNormalW = normalize(mat3(modelMatrix) * normal);
    vViewDir = normalize(cameraPosition - world.xyz);
    vAxis = clamp((position.x - uAxisMin) / uAxisSpan, 0.0, 1.0);
    gl_Position = projectionMatrix * viewMatrix * world;
  }
`;

const FRESNEL_FRAG = /* glsl */ `
  varying vec3 vNormalW;
  varying vec3 vViewDir;
  varying float vAxis;

  uniform vec3 uColorA;
  uniform vec3 uColorB;
  uniform vec3 uCoreColor;
  uniform float uPower;
  uniform float uIntensity;
  uniform float uCore;
  uniform float uOpacity;

  void main() {
    float f = pow(1.0 - clamp(dot(normalize(vNormalW), normalize(vViewDir)), 0.0, 1.0), uPower);
    vec3 tint = mix(uColorA, uColorB, vAxis);
    vec3 col = tint * f * uIntensity + uCoreColor * uCore;
    float a = clamp(f * uIntensity + uCore, 0.0, 1.0) * uOpacity;
    gl_FragColor = vec4(col, a);
  }
`;

export type FresnelOptions = {
  colorA: string;
  colorB?: string;
  coreColor?: string;
  power?: number;
  intensity?: number;
  core?: number;
  opacity?: number;
  additive?: boolean;
  side?: THREE.Side;
  /** Model-space X range used for the A→B gradient. */
  axisMin?: number;
  axisSpan?: number;
};

/**
 * View-dependent rim glow. This is what gives refs 02, 08, 12 and 13 their
 * "lit from inside" edge without needing a bloom pass on the GPU.
 */
export const fresnelGlow = (o: FresnelOptions) =>
  new THREE.ShaderMaterial({
    vertexShader: FRESNEL_VERT,
    fragmentShader: FRESNEL_FRAG,
    transparent: true,
    depthWrite: false,
    side: o.side ?? THREE.DoubleSide,
    blending: o.additive === false ? THREE.NormalBlending : THREE.AdditiveBlending,
    uniforms: {
      uColorA: { value: new THREE.Color(o.colorA) },
      uColorB: { value: new THREE.Color(o.colorB ?? o.colorA) },
      uCoreColor: { value: new THREE.Color(o.coreColor ?? "#000000") },
      uPower: { value: o.power ?? 2.2 },
      uIntensity: { value: o.intensity ?? 1.2 },
      uCore: { value: o.core ?? 0 },
      uOpacity: { value: o.opacity ?? 1 },
      uAxisMin: { value: o.axisMin ?? -1 },
      uAxisSpan: { value: o.axisSpan ?? 2 },
    },
  });

/* ------------------------------------------------------------------ *
 * Iridescent / holographic
 * ------------------------------------------------------------------ */

export type IridescentOptions = {
  base: string;
  shiftA: string;
  shiftB: string;
  roughness?: number;
  envIntensity?: number;
  opacity?: number;
};

/**
 * The purple/magenta sheen of ref 03. Built by injecting a view-angle hue
 * shift into the standard physical shader, so it still receives scene lighting
 * and reflections rather than looking like a flat gradient.
 */
export const iridescent = (o: IridescentOptions) => {
  const m = new THREE.MeshPhysicalMaterial({
    color: new THREE.Color(o.base),
    roughness: o.roughness ?? 0.22,
    metalness: 0.35,
    clearcoat: 1,
    clearcoatRoughness: 0.2,
    envMapIntensity: o.envIntensity ?? 1.8,
    transparent: (o.opacity ?? 1) < 1,
    opacity: o.opacity ?? 1,
  });

  m.onBeforeCompile = (shader) => {
    shader.uniforms.uShiftA = { value: new THREE.Color(o.shiftA) };
    shader.uniforms.uShiftB = { value: new THREE.Color(o.shiftB) };
    shader.fragmentShader = shader.fragmentShader
      .replace(
        "#include <common>",
        `#include <common>
         uniform vec3 uShiftA;
         uniform vec3 uShiftB;`,
      )
      .replace(
        "#include <dithering_fragment>",
        `#include <dithering_fragment>
         float fres = pow(1.0 - clamp(dot(normalize(vNormal), normalize(vViewPosition)), 0.0, 1.0), 1.6);
         vec3 sheen = mix(uShiftA, uShiftB, fres);
         gl_FragColor.rgb += sheen * fres * 0.85;`,
      );
  };
  // Force a recompile key so two differently-tinted instances don't share a
  // cached program.
  m.customProgramCacheKey = () => `iridescent-${o.shiftA}-${o.shiftB}`;
  return m;
};

/* ------------------------------------------------------------------ *
 * Scanline / HUD hologram
 * ------------------------------------------------------------------ */

const HOLO_VERT = /* glsl */ `
  varying vec3 vNormalW;
  varying vec3 vViewDir;
  varying vec3 vPos;

  void main() {
    vec4 world = modelMatrix * vec4(position, 1.0);
    vNormalW = normalize(mat3(modelMatrix) * normal);
    vViewDir = normalize(cameraPosition - world.xyz);
    vPos = position;
    gl_Position = projectionMatrix * viewMatrix * world;
  }
`;

const HOLO_FRAG = /* glsl */ `
  varying vec3 vNormalW;
  varying vec3 vViewDir;
  varying vec3 vPos;

  uniform vec3 uColor;
  uniform vec3 uHot;
  uniform float uTime;
  uniform float uScanFreq;
  uniform float uScanSpeed;
  uniform float uIntensity;
  uniform float uOpacity;

  void main() {
    float f = pow(1.0 - clamp(dot(normalize(vNormalW), normalize(vViewDir)), 0.0, 1.0), 1.7);
    // Travelling scanlines along the helix axis read as a data readout.
    float scan = 0.5 + 0.5 * sin(vPos.x * uScanFreq - uTime * uScanSpeed);
    scan = pow(scan, 3.0);
    vec3 col = uColor * (f * 1.3 + 0.12) + uHot * scan * 0.9;
    float a = clamp(f * uIntensity + scan * 0.45 + 0.05, 0.0, 1.0) * uOpacity;
    gl_FragColor = vec4(col * uIntensity, a);
  }
`;

export type HologramOptions = {
  color: string;
  hot?: string;
  scanFreq?: number;
  scanSpeed?: number;
  intensity?: number;
  opacity?: number;
};

export const hologram = (o: HologramOptions) =>
  new THREE.ShaderMaterial({
    vertexShader: HOLO_VERT,
    fragmentShader: HOLO_FRAG,
    transparent: true,
    depthWrite: false,
    side: THREE.DoubleSide,
    blending: THREE.AdditiveBlending,
    uniforms: {
      uColor: { value: new THREE.Color(o.color) },
      uHot: { value: new THREE.Color(o.hot ?? "#ffffff") },
      uTime: { value: 0 },
      uScanFreq: { value: o.scanFreq ?? 26 },
      uScanSpeed: { value: o.scanSpeed ?? 2.2 },
      uIntensity: { value: o.intensity ?? 1 },
      uOpacity: { value: o.opacity ?? 1 },
    },
  });

/* ------------------------------------------------------------------ *
 * Travelling band glow
 * ------------------------------------------------------------------ */

const BAND_VERT = /* glsl */ `
  varying vec3 vNormalW;
  varying vec3 vViewDir;
  varying float vX;

  void main() {
    vec4 world = modelMatrix * vec4(position, 1.0);
    vNormalW = normalize(mat3(modelMatrix) * normal);
    vViewDir = normalize(cameraPosition - world.xyz);
    vX = position.x;
    gl_Position = projectionMatrix * viewMatrix * world;
  }
`;

const BAND_FRAG = /* glsl */ `
  varying vec3 vNormalW;
  varying vec3 vViewDir;
  varying float vX;

  uniform vec3 uColor;
  uniform float uTime;
  uniform float uSpeed;
  uniform float uWidth;
  uniform float uRepeat;
  uniform float uIntensity;
  uniform float uFresnel;

  void main() {
    // A soft pulse sliding along the model's long axis.
    float phase = fract(vX / uRepeat - uTime * uSpeed);
    float band = exp(-pow((phase - 0.5) / uWidth, 2.0));
    float f = pow(1.0 - clamp(dot(normalize(vNormalW), normalize(vViewDir)), 0.0, 1.0), 2.0);
    float a = band * (0.35 + f * uFresnel) * uIntensity;
    gl_FragColor = vec4(uColor * a, a);
  }
`;

export type BandGlowOptions = {
  color: string;
  /** Model-space length of one band repeat. */
  repeat?: number;
  /** Gaussian half-width of the band, in repeats. */
  width?: number;
  speed?: number;
  intensity?: number;
  fresnel?: number;
};

/**
 * An emissive pulse that travels along the helix axis — the red base-pair
 * accents in ref 06 and the energy running through ref 11.
 */
export const bandGlow = (o: BandGlowOptions) =>
  new THREE.ShaderMaterial({
    vertexShader: BAND_VERT,
    fragmentShader: BAND_FRAG,
    transparent: true,
    depthWrite: false,
    side: THREE.DoubleSide,
    blending: THREE.AdditiveBlending,
    uniforms: {
      uColor: { value: new THREE.Color(o.color) },
      uTime: { value: 0 },
      uSpeed: { value: o.speed ?? 0.18 },
      uWidth: { value: o.width ?? 0.18 },
      uRepeat: { value: o.repeat ?? 0.55 },
      uIntensity: { value: o.intensity ?? 1 },
      uFresnel: { value: o.fresnel ?? 1.2 },
    },
  });
