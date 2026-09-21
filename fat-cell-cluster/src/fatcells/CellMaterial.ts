/**
 * The cell surface.
 *
 * These cells are dense and waxy, not glass, so there is no transmission
 * anywhere in this project — it is the most expensive material in the library
 * and it would be modelling the wrong thing. The warm interior glow is
 * subsurface scattering, faked from four cheap parts:
 *
 *   wrapped diffuse   light carried past the terminator, which is most of the
 *                     soft fleshy falloff on its own
 *   fresnel rim       in the cell's own hue, so edges read as lit from within
 *   back translucency a little light bleeding through from behind
 *   sheen             a broad warm grazing-angle term for the waxy finish
 *
 * Ambient occlusion is baked into the mesh at build time and used twice: once
 * to darken the crevices and once to tint them toward the deep amber the
 * references show in the gaps between cells.
 *
 * Deflation and surface mottling both happen here in the vertex shader. The
 * marching-cubes mesh is never rebuilt.
 */

import * as THREE from "three";
import { DITHER, ROTATE_AXIS, SIMPLEX3D } from "./glsl";

export type CellMaterialConfig = {
  /** Lit cell colour. */
  color: THREE.ColorRepresentation;
  /** Colour the crevices fall toward — the deep amber between packed cells. */
  deepColor: THREE.ColorRepresentation;
  /** Hue of the fresnel rim; normally a warmer, more saturated cell colour. */
  rimColor: THREE.ColorRepresentation;
  rimStrength?: number;
  /** Warm-tinted grazing-angle term for the waxy surface quality. */
  sheenColor?: THREE.ColorRepresentation;
  sheenStrength?: number;
  roughness?: number;
  /** Strength of the broad specular highlight on each cell. */
  specular?: number;
  /** How far light wraps past the terminator. 0.5 in every look here. */
  wrap?: number;
  /** Surface mottling, as a fraction of mean cell radius. */
  mottleAmp?: number;
  mottleFreq?: number;
  /** Strength of the baked occlusion, and the curve applied to it. */
  aoStrength?: number;
  aoGamma?: number;
  /** Mean cell radius, so amplitudes can be given as fractions of it. */
  cellRadius: number;
  deflating?: boolean;
  /** Semi-transparent variant, for the membrane over the packed tissue. */
  transparent?: boolean;
  opacity?: number;
  /** Extra clearcoat-like sharp highlight, used lightly on the membrane. */
  gloss?: number;
};

export type Lighting = {
  keyDirection: [number, number, number];
  keyColor: THREE.ColorRepresentation;
  keyIntensity: number;
  fillDirection: [number, number, number];
  fillColor: THREE.ColorRepresentation;
  fillIntensity: number;
  rimDirection: [number, number, number];
  rimLightColor: THREE.ColorRepresentation;
  rimLightIntensity: number;
  ambientColor: THREE.ColorRepresentation;
  ambientIntensity: number;
};

const norm = (v: [number, number, number]) => {
  const l = Math.hypot(v[0], v[1], v[2]) || 1;
  return new THREE.Vector3(v[0] / l, v[1] / l, v[2] / l);
};

const vertexShader = (deflating: boolean) => /* glsl */ `
attribute float ao;

uniform float uMottleAmp;
uniform float uMottleFreq;
${deflating ? `
// The shrinking look draws each cell as its own mesh, so these are plain
// scalars: the cell's shrink is the object's scale and the folds are local to
// it. Nothing needs a per-cell uniform array.
uniform float uCrumple;
uniform float uFoldFreq;
uniform float uFoldAngle;
uniform vec3  uFoldAxis;
` : ""}

varying vec3 vNormal;
varying vec3 vViewPos;
varying float vAo;
varying float vSeed;

${SIMPLEX3D}
${ROTATE_AXIS}

vec3 displace(vec3 p, vec3 n){
  vec3 q = p;
${deflating ? `
  // Folds grow as the cell empties, and the field turns as it collapses so
  // they travel over the surface rather than simply deepening in place.
  vec3 fp = rotateAxis(q * uFoldFreq, uFoldAxis, uFoldAngle);
  // Biased inward: a cell emptying of fat dents and folds in on itself. A
  // symmetric displacement pushes as much surface outward as in and the cell
  // ends up spiked rather than collapsed.
  q += n * uCrumple * (snoise(fp) * 0.62 - 0.42);
` : ""}
  // Faint mottling, on every look. Low amplitude keeps the cells smooth and
  // waxy; the dark look runs it higher and is visibly bumpier.
  q += n * uMottleAmp * snoise(p * uMottleFreq);
  return q;
}

void main(){
  vAo = ao;
  vSeed = float(gl_VertexID % 977);

  vec3 p = displace(position, normal);

  // Rebuild the normal from the displaced surface: step along two tangents and
  // take the cross product of what the displacement did to them.
  vec3 ref = abs(normal.z) < 0.9 ? vec3(0.0, 0.0, 1.0) : vec3(1.0, 0.0, 0.0);
  vec3 t1 = normalize(cross(normal, ref));
  vec3 t2 = cross(normal, t1);
  float eps = 0.02;
  vec3 p1 = displace(position + t1 * eps, normal);
  vec3 p2 = displace(position + t2 * eps, normal);
  vec3 n = normalize(cross(p1 - p, p2 - p));
  if (dot(n, normal) < 0.0) n = -n;

  vNormal = normalize(normalMatrix * n);
  vec4 mv = modelViewMatrix * vec4(p, 1.0);
  vViewPos = mv.xyz;
  gl_Position = projectionMatrix * mv;
}
`;

const fragmentShader = (transparent: boolean) => /* glsl */ `
uniform vec3 uColor;
uniform vec3 uDeepColor;
uniform vec3 uRimColor;
uniform float uRimStrength;
uniform vec3 uSheenColor;
uniform float uSheenStrength;
uniform float uRoughness;
uniform float uWrap;
uniform float uAoStrength;
uniform float uAoGamma;
uniform float uSpecular;
uniform float uGloss;
uniform float uOpacity;

uniform vec3 uKeyDir;
uniform vec3 uKeyColor;
uniform vec3 uFillDir;
uniform vec3 uFillColor;
uniform vec3 uRimDir;
uniform vec3 uRimLightColor;
uniform vec3 uAmbient;

varying vec3 vNormal;
varying vec3 vViewPos;
varying float vAo;
varying float vSeed;

${DITHER}

// Light carried past the terminator. Without this the cells read as plastic:
// it is the single term that does most of the subsurface look.
float wrapped(vec3 n, vec3 l, float w){
  return max(0.0, (dot(n, l) + w) / (1.0 + w));
}

void main(){
  vec3 N = normalize(vNormal);
  vec3 V = normalize(-vViewPos);
  if (!gl_FrontFacing) N = -N;

  float ao = pow(clamp(vAo, 0.0, 1.0), uAoGamma);
  ao = mix(1.0, ao, uAoStrength);

  // Crevices do not just go darker, they go warmer and deeper in hue — that
  // colour shift is most of what reads as amber between packed cells.
  vec3 base = mix(uDeepColor, uColor, ao);
  // The occlusion also holds light back, not just hue, which is what keeps a
  // contact reading as a gap rather than as a painted-on dark patch.
  float shade = mix(1.0, ao, 0.55);

  vec3 L1 = normalize(uKeyDir);
  vec3 L2 = normalize(uFillDir);
  vec3 L3 = normalize(uRimDir);

  vec3 diffuse =
      uKeyColor  * wrapped(N, L1, uWrap)
    + uFillColor * wrapped(N, L2, uWrap);

  // A little light coming through the cell from the far side.
  float back = pow(max(0.0, dot(V, -L1)), 2.0) * max(0.0, 0.35 + 0.65 * dot(N, -L1));
  diffuse += uKeyColor * back * 0.18;

  vec3 color = base * (diffuse * shade + uAmbient * ao * ao);

  // Rim light, used on the dark look to lift the cluster off the field.
  float rimLit = pow(max(0.0, dot(N, L3)), 1.6) * pow(1.0 - max(0.0, dot(N, V)), 1.5);
  color += uRimLightColor * rimLit;

  // Fresnel rim in the cell's own hue: the edges glow as though lit inside.
  float fres = pow(1.0 - max(0.0, dot(N, V)), 2.2);
  color += uRimColor * fres * uRimStrength * (0.35 + 0.65 * ao);

  // Waxy sheen — broad, warm, strongest at grazing angles.
  float sheen = pow(1.0 - max(0.0, dot(N, V)), 2.5);
  color += uSheenColor * sheen * uSheenStrength * wrapped(N, L1, uWrap) * ao;

  // Broad specular. Roughness sits around 0.45, metalness is zero throughout.
  // A waxy surface still carries a soft highlight per cell; without it the
  // cells read as clay rather than as something with a little fat in it.
  // Deliberately a wide lobe. A physically tight highlight puts a hard white
  // dot on every cell and the cluster reads as polished plastic; what these
  // surfaces want is a soft brightening across the whole lit side.
  vec3 H = normalize(L1 + V);
  float gloss = mix(4.0, 22.0, clamp(1.0 - uRoughness, 0.0, 1.0));
  float spec = pow(max(0.0, dot(N, H)), gloss);
  color += uKeyColor * spec * uSpecular * ao;
  if (uGloss > 0.0) {
    float tight = pow(max(0.0, dot(N, H)), 220.0);
    color += uKeyColor * tight * uGloss;
  }

  // Per-cell tonal variation, so neighbours are not identical.
  color *= 1.0 + 0.035 * (fract(sin(vSeed * 12.9898) * 43758.5453) - 0.5);

  color = dither(color, gl_FragCoord.xy);

  gl_FragColor = vec4(color, ${transparent ? "uOpacity" : "1.0"});
  #include <tonemapping_fragment>
  #include <colorspace_fragment>
}
`;

export const createCellMaterial = (
  cfg: CellMaterialConfig,
  light: Lighting,
): THREE.ShaderMaterial => {
  const deflating = cfg.deflating ?? false;
  const c = (v: THREE.ColorRepresentation) => new THREE.Color(v);
  const scaled = (v: THREE.ColorRepresentation, k: number) => c(v).multiplyScalar(k);

  const uniforms: Record<string, THREE.IUniform> = {
    uColor: { value: c(cfg.color) },
    uDeepColor: { value: c(cfg.deepColor) },
    uRimColor: { value: c(cfg.rimColor) },
    uRimStrength: { value: cfg.rimStrength ?? 0.28 },
    uSheenColor: { value: c(cfg.sheenColor ?? cfg.rimColor) },
    uSheenStrength: { value: cfg.sheenStrength ?? 0.22 },
    uRoughness: { value: cfg.roughness ?? 0.45 },
    uWrap: { value: cfg.wrap ?? 0.5 },
    uAoStrength: { value: cfg.aoStrength ?? 1 },
    uAoGamma: { value: cfg.aoGamma ?? 1 },
    uSpecular: { value: cfg.specular ?? 0.26 },
    uGloss: { value: cfg.gloss ?? 0 },
    uOpacity: { value: cfg.opacity ?? 1 },
    uMottleAmp: { value: (cfg.mottleAmp ?? 0.015) * cfg.cellRadius },
    uMottleFreq: { value: (cfg.mottleFreq ?? 2.6) / cfg.cellRadius },
    uKeyDir: { value: norm(light.keyDirection) },
    uKeyColor: { value: scaled(light.keyColor, light.keyIntensity) },
    uFillDir: { value: norm(light.fillDirection) },
    uFillColor: { value: scaled(light.fillColor, light.fillIntensity) },
    uRimDir: { value: norm(light.rimDirection) },
    uRimLightColor: { value: scaled(light.rimLightColor, light.rimLightIntensity) },
    uAmbient: { value: scaled(light.ambientColor, light.ambientIntensity) },
  };

  if (deflating) {
    uniforms.uCrumple = { value: 0 };
    uniforms.uFoldFreq = { value: 1.5 / cfg.cellRadius };
    uniforms.uFoldAngle = { value: 0 };
    uniforms.uFoldAxis = { value: new THREE.Vector3(0, 1, 0) };
  }

  const material = new THREE.ShaderMaterial({
    uniforms,
    vertexShader: vertexShader(deflating),
    fragmentShader: fragmentShader(cfg.transparent ?? false),
    transparent: cfg.transparent ?? false,
    depthWrite: !(cfg.transparent ?? false),
    side: THREE.FrontSide,
  });
  return material;
};
