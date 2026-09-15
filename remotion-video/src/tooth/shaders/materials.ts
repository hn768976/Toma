import { useLayoutEffect, useMemo } from "react";
import * as THREE from "three";

/**
 * Hand-written materials for the effects the standard three.js materials do not
 * cover: the glowing wireframe, the x-ray volume, the honeycomb shield, the
 * digital lattice, the soap bubble and the ground rings.
 *
 * Two rules hold across all of them:
 *
 *  - Line and dot widths are expressed in *design pixels* and multiplied by
 *    `uPx` (1 at 1080p, 2 at 4K), because screen-space derivatives are measured
 *    in real pixels and would otherwise make the 4K render look thinner.
 *  - Colours are authored as sRGB hex and arrive in the shader already in
 *    linear working space, so every shader ends with the tone-mapping and
 *    colour-space chunks and sits correctly next to the PBR materials.
 */

const VARYINGS = /* glsl */ `
varying vec3 vNormalW;
varying vec3 vPosW;
varying vec3 vPosO;
varying vec3 vNormalO;
`;

const VERTEX_BODY = /* glsl */ `
  vPosO = position;
  vNormalO = normal;
  vec4 worldPosition = modelMatrix * vec4(transformed, 1.0);
  vPosW = worldPosition.xyz;
  vNormalW = normalize(mat3(modelMatrix) * normal);
  gl_Position = projectionMatrix * viewMatrix * worldPosition;
`;

const basicVertex = (extra = "", transform = "vec3 transformed = position;") =>
  /* glsl */ `
${VARYINGS}
${extra}
void main() {
  ${transform}
${VERTEX_BODY}
}
`;

const TAIL = /* glsl */ `
  #include <tonemapping_fragment>
  #include <colorspace_fragment>
`;

const FRESNEL = /* glsl */ `
float fresnel(vec3 normalW, vec3 posW, float power) {
  vec3 viewDir = normalize(cameraPosition - posW);
  return pow(clamp(1.0 - abs(dot(normalize(normalW), viewDir)), 0.0, 1.0), power);
}
`;

type Uniforms = Record<string, THREE.IUniform>;

const applyUniforms = (material: THREE.ShaderMaterial, values: object) => {
  for (const [key, value] of Object.entries(values)) {
    // Scenes on a light CSS backdrop need their white geometry to stay white;
    // ACES would otherwise roll pure white down to a grey the DOM never gets.
    if (key === "toneMapped") {
      material.toneMapped = value as boolean;
      continue;
    }
    const uniform = material.uniforms[key];
    if (!uniform || value === undefined) {
      continue;
    }
    if (uniform.value instanceof THREE.Color) {
      uniform.value.set(value as THREE.ColorRepresentation);
    } else if (uniform.value instanceof THREE.Vector3 && Array.isArray(value)) {
      uniform.value.fromArray(value as number[]);
    } else if (uniform.value instanceof THREE.Vector2 && Array.isArray(value)) {
      uniform.value.fromArray(value as number[]);
    } else if (uniform.value instanceof THREE.Vector4 && Array.isArray(value)) {
      uniform.value.fromArray(value as number[]);
    } else {
      uniform.value = value;
    }
  }
};

/**
 * Creates the material once and pushes `values` into its uniforms on every
 * render. Uniform updates happen in a layout effect so they are in place before
 * <ThreeCanvas/> advances the renderer for this frame.
 */
const useMaterial = <V extends object>(
  build: () => THREE.ShaderMaterial,
  values: V,
): THREE.ShaderMaterial => {
  const material = useMemo(build, []); // eslint-disable-line react-hooks/exhaustive-deps
  useLayoutEffect(() => {
    applyUniforms(material, values);
  });
  useLayoutEffect(() => () => material.dispose(), [material]);
  return material;
};

const colorUniform = (hex: string) => ({ value: new THREE.Color(hex) });

/* -------------------------------------------------------------------------- */
/* Glowing low-poly wireframe (versions 01, 02, 07)                            */
/* -------------------------------------------------------------------------- */

export type WireValues = {
  readonly uFill: string;
  readonly uLine: string;
  readonly uGlow: string;
  readonly uFillAlpha: number;
  readonly uLineWidth: number;
  readonly uGlowStrength: number;
  readonly uFresnelPow: number;
  readonly uOpacity: number;
  readonly uPx: number;
  readonly uScanY: number;
  readonly uScanWidth: number;
  readonly uScanStrength: number;
  readonly uScanColor: string;
};

const wireUniforms = (): Uniforms => ({
  uFill: colorUniform("#1a5fc4"),
  uLine: colorUniform("#7fe3ff"),
  uGlow: colorUniform("#3aa8ff"),
  uScanColor: colorUniform("#ff3d8b"),
  uFillAlpha: { value: 0.28 },
  uLineWidth: { value: 1.1 },
  uGlowStrength: { value: 1.2 },
  uFresnelPow: { value: 2.2 },
  uOpacity: { value: 1 },
  uPx: { value: 1 },
  uScanY: { value: -99 },
  uScanWidth: { value: 0.04 },
  uScanStrength: { value: 0 },
});

/**
 * Draws triangle edges from barycentric coordinates rather than GL lines, which
 * WebGL cannot widen. Requires geometry carrying an `aBary` attribute.
 */
export const useWireMaterial = (values: WireValues) =>
  useMaterial(
    () =>
      new THREE.ShaderMaterial({
        uniforms: wireUniforms(),
        vertexShader: basicVertex(
          "attribute vec3 aBary;\nvarying vec3 vBary;",
          "vec3 transformed = position;\n  vBary = aBary;",
        ),
        fragmentShader: /* glsl */ `
${VARYINGS}
varying vec3 vBary;
uniform vec3 uFill, uLine, uGlow, uScanColor;
uniform float uFillAlpha, uLineWidth, uGlowStrength, uFresnelPow, uOpacity, uPx;
uniform float uScanY, uScanWidth, uScanStrength;
${FRESNEL}
void main() {
  float fres = fresnel(vNormalW, vPosW, uFresnelPow);

  vec3 width = fwidth(vBary);
  vec3 edges = smoothstep(vec3(0.0), width * uLineWidth * uPx, vBary);
  float edge = 1.0 - min(min(edges.x, edges.y), edges.z);

  vec3 colour = uFill * uFillAlpha;
  colour += uGlow * fres * uGlowStrength;
  colour = mix(colour, uLine, edge);

  if (uScanStrength > 0.0) {
    float band = 1.0 - smoothstep(0.0, uScanWidth, abs(vPosW.y - uScanY));
    colour += uScanColor * band * band * uScanStrength;
  }

  gl_FragColor = vec4(colour, uOpacity);
${TAIL}
}
`,
        transparent: true,
        blending: THREE.AdditiveBlending,
        depthWrite: false,
        side: THREE.DoubleSide,
      }),
    values,
  );

/* -------------------------------------------------------------------------- */
/* X-ray volume (version 05)                                                    */
/* -------------------------------------------------------------------------- */

export type XRayValues = {
  readonly uCore: string;
  readonly uEdge: string;
  readonly uIntensity: number;
  readonly uFresnelPow: number;
  readonly uBase: number;
  readonly uFadeStart: number;
  readonly uFadeEnd: number;
  readonly uOpacity: number;
};

/**
 * Additive and double-sided, so overlapping shells accumulate the way density
 * does in a real radiograph: thick parts read bright, thin roots read faint.
 */
export const useXRayMaterial = (values: XRayValues) =>
  useMaterial(
    () =>
      new THREE.ShaderMaterial({
        uniforms: {
          uCore: colorUniform("#1550c8"),
          uEdge: colorUniform("#9fe6ff"),
          uIntensity: { value: 1 },
          uFresnelPow: { value: 1.8 },
          uBase: { value: 0.18 },
          uFadeStart: { value: -1.2 },
          uFadeEnd: { value: -0.35 },
          uOpacity: { value: 1 },
        },
        vertexShader: basicVertex(),
        fragmentShader: /* glsl */ `
${VARYINGS}
uniform vec3 uCore, uEdge;
uniform float uIntensity, uFresnelPow, uBase, uFadeStart, uFadeEnd, uOpacity;
${FRESNEL}
void main() {
  float fres = fresnel(vNormalW, vPosW, uFresnelPow);
  vec3 colour = mix(uCore, uEdge, fres) * (uBase + fres) * uIntensity;
  float fade = smoothstep(uFadeStart, uFadeEnd, vPosO.y);
  gl_FragColor = vec4(colour * fade, uOpacity);
${TAIL}
}
`,
        transparent: true,
        blending: THREE.AdditiveBlending,
        depthWrite: false,
        side: THREE.DoubleSide,
      }),
    values,
  );

/* -------------------------------------------------------------------------- */
/* Outer halo shell - a cheap stand-in for a bloom pass                         */
/* -------------------------------------------------------------------------- */

export type GlowShellValues = {
  readonly uColor: string;
  readonly uStrength: number;
  readonly uPower: number;
};

/**
 * An inflated back-faced copy of the mesh whose rim lights up. Costs one extra
 * draw call instead of the several full-screen passes a real bloom would need,
 * which matters a lot when the renderer is software WebGL.
 */
export const useGlowShellMaterial = (values: GlowShellValues) =>
  useMaterial(
    () =>
      new THREE.ShaderMaterial({
        uniforms: {
          uColor: colorUniform("#4fb4ff"),
          uStrength: { value: 1 },
          uPower: { value: 3 },
        },
        vertexShader: basicVertex(),
        fragmentShader: /* glsl */ `
${VARYINGS}
uniform vec3 uColor;
uniform float uStrength, uPower;
${FRESNEL}
void main() {
  float rim = fresnel(vNormalW, vPosW, uPower);
  gl_FragColor = vec4(uColor * rim * uStrength, 1.0);
${TAIL}
}
`,
        transparent: true,
        blending: THREE.AdditiveBlending,
        depthWrite: false,
        side: THREE.BackSide,
      }),
    values,
  );

/* -------------------------------------------------------------------------- */
/* Honeycomb shield (version 03)                                                */
/* -------------------------------------------------------------------------- */

export type HexValues = {
  readonly toneMapped?: boolean;
  readonly uColor: string;
  readonly uRimColor: string;
  readonly uScale: number;
  readonly uThickness: number;
  readonly uFill: number;
  readonly uOpacity: number;
  readonly uReveal: number;
  readonly uRevealAxis: number;
  readonly uTriplanar: number;
  readonly uPx: number;
};

const HEX = /* glsl */ `
float hexDistance(vec2 p) {
  p = abs(p);
  return max(dot(p, normalize(vec2(1.0, 1.7320508))), p.x);
}
// Returns .x = distance to the nearest cell edge, .yz = cell id.
vec3 hexCell(vec2 uv) {
  vec2 r = vec2(1.0, 1.7320508);
  vec2 h = r * 0.5;
  vec2 a = mod(uv, r) - h;
  vec2 b = mod(uv - h, r) - h;
  vec2 gv = dot(a, a) < dot(b, b) ? a : b;
  return vec3(0.5 - hexDistance(gv), uv - gv);
}
`;

/**
 * A translucent honeycomb, projected triplanar-ly so it can wrap either a
 * sphere or the tooth shell itself without UV seams.
 */
export const useHexMaterial = (values: HexValues) =>
  useMaterial(
    () =>
      new THREE.ShaderMaterial({
        uniforms: {
          uColor: colorUniform("#eaf6ff"),
          uRimColor: colorUniform("#ffffff"),
          uScale: { value: 9 },
          uThickness: { value: 0.09 },
          uFill: { value: 0.1 },
          uOpacity: { value: 1 },
          uReveal: { value: 1 },
          uRevealAxis: { value: 0 },
          uTriplanar: { value: 1 },
          uPx: { value: 1 },
        },
        vertexShader: basicVertex(),
        fragmentShader: /* glsl */ `
${VARYINGS}
uniform vec3 uColor, uRimColor;
uniform float uScale, uThickness, uFill, uOpacity, uReveal, uRevealAxis, uTriplanar, uPx;
${FRESNEL}
${HEX}
float hexEdge(vec2 uv) {
  vec3 cell = hexCell(uv * uScale);
  float aa = fwidth(cell.x) * 1.5;
  return 1.0 - smoothstep(uThickness - aa, uThickness + aa, cell.x);
}
void main() {
  vec3 n = abs(normalize(vNormalO));
  vec3 blend = pow(n, vec3(4.0));
  blend /= max(blend.x + blend.y + blend.z, 1e-4);

  float edge =
      hexEdge(vPosO.yz) * blend.x +
      hexEdge(vPosO.xz) * blend.y +
      hexEdge(vPosO.xy) * blend.z;
  edge = mix(hexEdge(vPosO.xy), edge, uTriplanar);

  float rim = fresnel(vNormalW, vPosW, 2.0);
  // Vertical wipe, so the shield can grow over the tooth from the roots up.
  float wipe = 1.0 - smoothstep(uRevealAxis, uRevealAxis + 0.55, vPosO.y);

  float alpha = (edge + uFill + rim * 0.35) * uOpacity * uReveal * wipe;
  vec3 colour = mix(uColor, uRimColor, rim);
  gl_FragColor = vec4(colour, clamp(alpha, 0.0, 1.0));
${TAIL}
}
`,
        transparent: true,
        depthWrite: false,
        side: THREE.DoubleSide,
      }),
    values,
  );

/* -------------------------------------------------------------------------- */
/* Digital lattice (version 11)                                                 */
/* -------------------------------------------------------------------------- */

export type LatticeValues = {
  readonly toneMapped?: boolean;
  readonly uColor: string;
  readonly uRings: number;
  readonly uSegments: number;
  readonly uThickness: number;
  readonly uOpacity: number;
  readonly uPx: number;
  readonly uScanY: number;
  readonly uScanWidth: number;
  readonly uScanColor: string;
  readonly uScanStrength: number;
};

/**
 * Latitude / longitude lines in object space. Using spherical coordinates
 * rather than the model's UVs keeps the grid continuous over the whole tooth -
 * the baked UV atlas has seams that would read as glitches.
 */
export const useLatticeMaterial = (values: LatticeValues) =>
  useMaterial(
    () =>
      new THREE.ShaderMaterial({
        uniforms: {
          uColor: colorUniform("#4aa8ff"),
          uScanColor: colorUniform("#bfe9ff"),
          uRings: { value: 26 },
          uSegments: { value: 40 },
          uThickness: { value: 1.1 },
          uOpacity: { value: 0.85 },
          uPx: { value: 1 },
          uScanY: { value: -99 },
          uScanWidth: { value: 0.12 },
          uScanStrength: { value: 0 },
        },
        vertexShader: basicVertex(),
        fragmentShader: /* glsl */ `
${VARYINGS}
uniform vec3 uColor, uScanColor;
uniform float uRings, uSegments, uThickness, uOpacity, uPx;
uniform float uScanY, uScanWidth, uScanStrength;
${FRESNEL}
// Anti-aliased line every 1.0 of coord, width design-pixels thick.
float gridLine(float coord, float width) {
  float d = abs(fract(coord) - 0.5);
  float aa = fwidth(coord);
  return 1.0 - smoothstep(0.0, aa * width, d - aa * width * 0.5);
}
void main() {
  float longitude = atan(vPosO.z, vPosO.x) / 6.2831853;
  float latitude = vPosO.y * 0.5;

  float lines = max(
    gridLine(longitude * uSegments, uThickness * uPx),
    gridLine(latitude * uRings, uThickness * uPx)
  );

  float rim = fresnel(vNormalW, vPosW, 2.5);
  vec3 colour = uColor;
  float alpha = lines * uOpacity + rim * 0.22 * uOpacity;

  if (uScanStrength > 0.0) {
    float band = 1.0 - smoothstep(0.0, uScanWidth, abs(vPosW.y - uScanY));
    colour = mix(colour, uScanColor, band);
    alpha += band * band * uScanStrength;
  }

  gl_FragColor = vec4(colour, clamp(alpha, 0.0, 1.0));
${TAIL}
}
`,
        transparent: true,
        depthWrite: false,
      }),
    values,
  );

/* -------------------------------------------------------------------------- */
/* Soap bubble (version 09)                                                     */
/* -------------------------------------------------------------------------- */

export type BubbleValues = {
  readonly toneMapped?: boolean;
  readonly uTime: number;
  readonly uWobble: number;
  readonly uRim: number;
  readonly uFilm: number;
  readonly uTint: string;
  readonly uOpacity: number;
};

/**
 * Thin-film interference approximated by sampling a cosine palette with the
 * view angle - enough to give the soapy rainbow sheen without a real spectral
 * model, and it costs nothing on the software renderer.
 */
export const useBubbleMaterial = (values: BubbleValues) =>
  useMaterial(
    () =>
      new THREE.ShaderMaterial({
        uniforms: {
          uTime: { value: 0 },
          uWobble: { value: 0.02 },
          uRim: { value: 1.4 },
          uFilm: { value: 0.35 },
          uTint: colorUniform("#dff2ff"),
          uOpacity: { value: 1 },
        },
        vertexShader: /* glsl */ `
${VARYINGS}
uniform float uTime, uWobble;
void main() {
  float ripple =
    sin(position.y * 3.1 + uTime * 6.2831853) *
    cos(position.x * 2.7 - uTime * 6.2831853) +
    sin(position.z * 3.7 + uTime * 12.566371) * 0.5;
  vec3 transformed = position * (1.0 + ripple * uWobble);
${VERTEX_BODY}
}
`,
        fragmentShader: /* glsl */ `
${VARYINGS}
uniform vec3 uTint;
uniform float uRim, uFilm, uOpacity;
${FRESNEL}
void main() {
  float f = fresnel(vNormalW, vPosW, 2.0);
  float film = fresnel(vNormalW, vPosW, 1.0);
  vec3 iridescence = 0.5 + 0.5 * cos(6.2831853 * (film * 3.4 + vec3(0.0, 0.33, 0.67)));
  vec3 colour = uTint * f * uRim + iridescence * uFilm * smoothstep(0.1, 0.9, film);
  float alpha = clamp(f * 1.45 + 0.018, 0.0, 1.0) * uOpacity;
  gl_FragColor = vec4(colour, alpha);
${TAIL}
}
`,
        transparent: true,
        depthWrite: false,
        side: THREE.DoubleSide,
      }),
    values,
  );

/* -------------------------------------------------------------------------- */
/* Ground ripple rings (version 03)                                             */
/* -------------------------------------------------------------------------- */

export type RingsValues = {
  readonly toneMapped?: boolean;
  readonly uColor: string;
  readonly uTime: number;
  readonly uCount: number;
  readonly uSpeed: number;
  readonly uOpacity: number;
  readonly uInner: number;
  readonly uOuter: number;
};

/** Concentric rings travelling outwards on a disc, faded at both extremes. */
export const useRingsMaterial = (values: RingsValues) =>
  useMaterial(
    () =>
      new THREE.ShaderMaterial({
        uniforms: {
          uColor: colorUniform("#ffffff"),
          uTime: { value: 0 },
          uCount: { value: 9 },
          uSpeed: { value: 1 },
          uOpacity: { value: 0.5 },
          uInner: { value: 0.06 },
          uOuter: { value: 0.5 },
        },
        vertexShader: basicVertex(),
        fragmentShader: /* glsl */ `
${VARYINGS}
uniform vec3 uColor;
uniform float uTime, uCount, uSpeed, uOpacity, uInner, uOuter;
void main() {
  float r = length(vPosO.xy);
  float phase = r * uCount - uTime * uSpeed;
  float ring = pow(max(sin(phase * 6.2831853) * 0.5 + 0.5, 0.0), 14.0);
  float window = smoothstep(uInner, uInner * 2.4, r) * (1.0 - smoothstep(uOuter * 0.55, uOuter, r));
  gl_FragColor = vec4(uColor, ring * window * uOpacity);
${TAIL}
}
`,
        transparent: true,
        depthWrite: false,
        blending: THREE.AdditiveBlending,
        side: THREE.DoubleSide,
      }),
    values,
  );

/* -------------------------------------------------------------------------- */
/* Soft round point sprites                                                     */
/* -------------------------------------------------------------------------- */

export type PointsValues = {
  readonly toneMapped?: boolean;
  readonly uColor: string;
  readonly uSize: number;
  readonly uOpacity: number;
  readonly uPx: number;
  readonly uFade: number;
};

/**
 * Round, softly-falling-off dots with perspective attenuation. `uSize` is in
 * design pixels at one world-unit from the camera, so the sprites keep their
 * proportion of the frame at any output resolution.
 */
export const usePointsMaterial = (
  values: PointsValues,
  additive = true,
) =>
  useMaterial(
    () =>
      new THREE.ShaderMaterial({
        uniforms: {
          uColor: colorUniform("#bfe9ff"),
          uSize: { value: 28 },
          uOpacity: { value: 1 },
          uPx: { value: 1 },
          uFade: { value: 0 },
        },
        vertexShader: /* glsl */ `
uniform float uSize, uPx;
varying float vDepth;
void main() {
  vec4 mv = modelViewMatrix * vec4(position, 1.0);
  vDepth = -mv.z;
  gl_PointSize = max(uSize * uPx / max(vDepth, 0.05), 1.0);
  gl_Position = projectionMatrix * mv;
}
`,
        fragmentShader: /* glsl */ `
uniform vec3 uColor;
uniform float uOpacity, uFade;
varying float vDepth;
void main() {
  float d = length(gl_PointCoord - 0.5);
  float a = 1.0 - smoothstep(0.18, 0.5, d);
  if (a <= 0.001) discard;
  float depthFade = uFade > 0.0 ? 1.0 - smoothstep(uFade * 0.4, uFade, vDepth) : 1.0;
  gl_FragColor = vec4(uColor, a * uOpacity * depthFade);
${TAIL}
}
`,
        transparent: true,
        depthWrite: false,
        blending: additive ? THREE.AdditiveBlending : THREE.NormalBlending,
      }),
    values,
  );

/* -------------------------------------------------------------------------- */
/* Radial disc - contact shadows and halo sprites                               */
/* -------------------------------------------------------------------------- */

export type RadialValues = {
  readonly toneMapped?: boolean;
  readonly uColor: string;
  readonly uOpacity: number;
  readonly uPower: number;
  readonly uAspect: number;
};

/**
 * A plane that fades radially to nothing. Used both as the soft contact shadow
 * under the studio versions (normal blending, black) and as the bloom-ish halo
 * behind the glowing ones (additive).
 */
export const useRadialMaterial = (values: RadialValues, additive = false) =>
  useMaterial(
    () =>
      new THREE.ShaderMaterial({
        uniforms: {
          uColor: colorUniform("#000000"),
          uOpacity: { value: 0.35 },
          uPower: { value: 2 },
          uAspect: { value: 1 },
        },
        vertexShader: basicVertex(),
        fragmentShader: /* glsl */ `
${VARYINGS}
uniform vec3 uColor;
uniform float uOpacity, uPower, uAspect;
void main() {
  vec2 p = vPosO.xy * vec2(1.0, uAspect);
  float d = clamp(length(p) * 2.0, 0.0, 1.0);
  float a = pow(1.0 - d, uPower) * uOpacity;
  if (a <= 0.001) discard;
  gl_FragColor = vec4(uColor, a);
${TAIL}
}
`,
        transparent: true,
        depthWrite: false,
        blending: additive ? THREE.AdditiveBlending : THREE.NormalBlending,
      }),
    values,
  );

/* -------------------------------------------------------------------------- */
/* Screen-space gradient backdrop                                               */
/* -------------------------------------------------------------------------- */

export type BackdropValues = {
  readonly uC0: string;
  readonly uC1: string;
  readonly uC2: string;
  readonly uC3: string;
  readonly uStops: THREE.Vector4 | number[];
  readonly uCenter: [number, number];
  readonly uRadius: [number, number];
  readonly uLinear: number;
  readonly uAngle: number;
  /** Vignette strength, 0 = none. */
  readonly uVig: number;
  readonly uVigColor: string;
  readonly uVigCenter: [number, number];
  readonly uVigRadius: [number, number];
  /** Where the vignette starts and finishes easing, in uVigRadius units. */
  readonly uVigRange: [number, number];
  /** Falloff shape. >1 keeps the onset flatter and pushes the weight outward. */
  readonly uVigPower: number;
};

/**
 * A four-stop gradient drawn as a full-screen quad *inside* the WebGL scene.
 *
 * It has to live in the scene rather than in CSS behind a transparent canvas:
 * with a transparent drawing buffer there is nothing for additive glows to add
 * to, and semi-transparent pixels get their alpha applied twice during page
 * compositing, so halos and ripples come out darker than the background instead
 * of brighter. An opaque canvas makes every blend mode behave.
 *
 * The quad bypasses the camera matrices entirely and a little ordered dither is
 * added, because 8-bit H.264 bands badly across gradients this smooth.
 */
export const useBackdropMaterial = (values: BackdropValues) =>
  useMaterial(
    () =>
      new THREE.ShaderMaterial({
        uniforms: {
          uC0: colorUniform("#ffffff"),
          uC1: colorUniform("#cccccc"),
          uC2: colorUniform("#888888"),
          uC3: colorUniform("#000000"),
          uStops: { value: new THREE.Vector4(0, 0.35, 0.7, 1) },
          uCenter: { value: new THREE.Vector2(0.5, 0.5) },
          uRadius: { value: new THREE.Vector2(0.8, 0.8) },
          uLinear: { value: 0 },
          uAngle: { value: 0 },
          uVig: { value: 0 },
          uVigColor: colorUniform("#000000"),
          uVigCenter: { value: new THREE.Vector2(0.5, 0.5) },
          uVigRadius: { value: new THREE.Vector2(0.75, 0.65) },
          uVigRange: { value: new THREE.Vector2(0.45, 1.25) },
          uVigPower: { value: 2.2 },
        },
        vertexShader: /* glsl */ `
varying vec2 vUv;
void main() {
  vUv = position.xy * 0.5 + 0.5;
  gl_Position = vec4(position.xy, 0.9999, 1.0);
}
`,
        fragmentShader: /* glsl */ `
varying vec2 vUv;
uniform vec3 uC0, uC1, uC2, uC3;
uniform vec4 uStops;
uniform vec2 uCenter, uRadius;
uniform float uLinear, uAngle;
uniform float uVig;
uniform vec3 uVigColor;
uniform vec2 uVigCenter, uVigRadius, uVigRange;
uniform float uVigPower;

vec3 ramp(float x) {
  vec3 c = mix(uC0, uC1, smoothstep(uStops.x, uStops.y, x));
  c = mix(c, uC2, smoothstep(uStops.y, uStops.z, x));
  c = mix(c, uC3, smoothstep(uStops.z, uStops.w, x));
  return c;
}

float hash(vec2 p) {
  return fract(sin(dot(p, vec2(12.9898, 78.233))) * 43758.5453);
}

void main() {
  vec2 d = (vUv - uCenter) / uRadius;
  float radial = length(d);

  vec2 axis = vec2(cos(uAngle), sin(uAngle));
  float linear = clamp(dot(vUv - uCenter, axis) / max(uRadius.y, 1e-4) * 0.5 + 0.5, 0.0, 1.0);

  float x = clamp(mix(radial, linear, uLinear), 0.0, 1.0);
  vec3 colour = ramp(x);

  // Vignette, eased rather than ramped linearly as a CSS gradient would.
  // A linear ramp changes slope abruptly where it starts and the eye reads that
  // as a ring (Mach band) across an otherwise smooth gradient. smoothstep gives
  // a zero-derivative onset; the exponent then keeps the first part of the
  // curve nearly flat so the corners can still go properly dark without the
  // mid-field picking up any visible shading.
  if (uVig > 0.0) {
    float vd = length((vUv - uVigCenter) / uVigRadius);
    float v = pow(smoothstep(uVigRange.x, uVigRange.y, vd), uVigPower);
    colour = mix(colour, uVigColor, v * uVig);
  }

  // Dither last, so it covers the vignette's own gradient as well as the ramp's.
  colour += (hash(gl_FragCoord.xy) + hash(gl_FragCoord.yx * 1.7) - 1.0) * 1.4 / 255.0;

  gl_FragColor = vec4(colour, 1.0);
${TAIL}
}
`,
        depthTest: false,
        depthWrite: false,
        toneMapped: false,
      }),
    values,
  );

/* -------------------------------------------------------------------------- */
/* Floor reflection                                                             */
/* -------------------------------------------------------------------------- */

export type MirrorValues = {
  readonly toneMapped?: boolean;
  readonly uColor: string;
  readonly uShade: string;
  readonly uFadeLow: number;
  readonly uFadeHigh: number;
  readonly uOpacity: number;
};

/**
 * The upside-down copy of the subject that stands in for a floor reflection.
 *
 * Deliberately not a PBR material: a real reflection would need a second render
 * pass, and the references show these reflections soft, dim and fading out with
 * distance anyway - which is exactly what a hemisphere term plus a vertical
 * alpha ramp gives, for one extra draw call.
 */
export const useMirrorMaterial = (values: MirrorValues) =>
  useMaterial(
    () =>
      new THREE.ShaderMaterial({
        uniforms: {
          uColor: colorUniform("#ffffff"),
          uShade: colorUniform("#5b86b0"),
          uFadeLow: { value: -3 },
          uFadeHigh: { value: -1.4 },
          uOpacity: { value: 0.35 },
        },
        vertexShader: basicVertex(),
        fragmentShader: /* glsl */ `
${VARYINGS}
uniform vec3 uColor, uShade;
uniform float uFadeLow, uFadeHigh, uOpacity;
void main() {
  float lambert = dot(normalize(vNormalW), normalize(vec3(0.3, 1.0, 0.5))) * 0.5 + 0.5;
  vec3 colour = mix(uShade, uColor, lambert * lambert);
  float fade = smoothstep(uFadeLow, uFadeHigh, vPosW.y);
  gl_FragColor = vec4(colour, fade * uOpacity);
${TAIL}
}
`,
        transparent: true,
        depthWrite: false,
        side: THREE.DoubleSide,
      }),
    values,
  );
