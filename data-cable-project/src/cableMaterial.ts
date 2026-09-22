import { Color, DoubleSide, ShaderMaterial, Texture, Vector2, Vector3 } from "three";

/**
 * The cable / ribbon surface.
 *
 * These are emitters, not glass: the digits are the light source, sitting on a
 * dim base body, with a fresnel rim for the bright silhouette edges. No
 * transmission anywhere -- it would cost a great deal and buy nothing here.
 */

const vertexShader = /* glsl */ `
  varying vec2 vUv;
  varying vec3 vWorldNormal;
  varying vec3 vViewDir;
  varying vec3 vWorldPos;

  void main() {
    vUv = uv;
    vec4 worldPos = modelMatrix * vec4(position, 1.0);
    vWorldPos = worldPos.xyz;
    vWorldNormal = normalize(mat3(modelMatrix) * normal);
    vViewDir = normalize(cameraPosition - worldPos.xyz);
    gl_Position = projectionMatrix * viewMatrix * worldPos;
  }
`;

const fragmentShader = /* glsl */ `
  uniform sampler2D uDigits;
  uniform vec2 uRepeat;
  uniform float uScroll;

  uniform vec3 uBaseColor;
  uniform vec3 uGlowColor;
  uniform vec3 uRimColor;

  uniform float uBaseIntensity;
  uniform float uDigitIntensity;
  uniform float uRimIntensity;
  uniform float uRimPower;

  uniform float uMaskPeriods;
  uniform float uMaskScroll;
  uniform float uMaskDepth;
  uniform float uMaskSoftness;
  uniform float uMaskBias;
  uniform vec3 uShadeDir;
  uniform float uShadeAmount;
  uniform float uFadeStart;
  uniform float uFadeEnd;

  varying vec2 vUv;
  varying vec3 vWorldNormal;
  varying vec3 vViewDir;
  varying vec3 vWorldPos;

  void main() {
    vec2 tuv = vec2(vUv.x * uRepeat.x + uScroll, vUv.y * uRepeat.y);
    float digit = texture2D(uDigits, tuv).r;

    // Glow mask travelling along the cable's length. This is what gives the
    // rack its unlit black stretches between glowing sections.
    float wave = sin(6.28318530718 * (vUv.x * uMaskPeriods + uMaskScroll)) + uMaskBias;
    float lit = smoothstep(-uMaskSoftness, uMaskSoftness, wave);
    lit = mix(1.0, lit, uMaskDepth);

    vec3 N = normalize(vWorldNormal);
    float fres = pow(1.0 - abs(dot(N, normalize(vViewDir))), uRimPower);

    // Shading across the cross-section. Without this a ribbon reads as a decal
    // stuck in space rather than as a curved band, and a cable loses the
    // brighter-on-top falloff the references have.
    float shade = mix(1.0, 0.42 + 1.15 * dot(N, normalize(uShadeDir)), uShadeAmount);

    vec3 col = uBaseColor * uBaseIntensity * mix(0.1, 1.0, lit) * shade;
    col += uGlowColor * digit * uDigitIntensity * lit * shade;
    col += uRimColor * fres * uRimIntensity * mix(0.16, 1.0, lit);

    // A mirrored copy recedes to a horizon line, which reads as a glitch
    // rather than as a floor. Fading it out with distance keeps the soft,
    // broken reflection the references show and drops the streak.
    if (uFadeEnd > 0.0) {
      col *= 1.0 - smoothstep(uFadeStart, uFadeEnd, distance(cameraPosition, vWorldPos));
    }

    gl_FragColor = vec4(col, 1.0);
  }
`;

export type CableMaterialConfig = {
  baseColor: string;
  glowColor: string;
  rimColor: string;
  baseIntensity: number;
  digitIntensity: number;
  rimIntensity: number;
  rimPower: number;
  repeatU: number;
  /** Must be an integer on closed cylinders, or the texture seams round the back. */
  repeatV: number;
  maskPeriods: number;
  maskDepth: number;
  maskSoftness: number;
  maskBias: number;
  shadeAmount: number;
  /** 0 disables the distance fade (everything except reflections). */
  fadeStart: number;
  fadeEnd: number;
  doubleSided: boolean;
};

const linear = (hex: string) => new Color(hex).convertSRGBToLinear();

export const createCableMaterial = (
  digits: Texture,
  cfg: CableMaterialConfig,
): ShaderMaterial =>
  new ShaderMaterial({
    vertexShader,
    fragmentShader,
    side: cfg.doubleSided ? DoubleSide : undefined,
    uniforms: {
      uDigits: { value: digits },
      uRepeat: { value: new Vector2(cfg.repeatU, cfg.repeatV) },
      uScroll: { value: 0 },
      uBaseColor: { value: linear(cfg.baseColor) },
      uGlowColor: { value: linear(cfg.glowColor) },
      uRimColor: { value: linear(cfg.rimColor) },
      uBaseIntensity: { value: cfg.baseIntensity },
      uDigitIntensity: { value: cfg.digitIntensity },
      uRimIntensity: { value: cfg.rimIntensity },
      uRimPower: { value: cfg.rimPower },
      uMaskPeriods: { value: cfg.maskPeriods },
      uMaskScroll: { value: 0 },
      uMaskDepth: { value: cfg.maskDepth },
      uMaskSoftness: { value: cfg.maskSoftness },
      uMaskBias: { value: cfg.maskBias },
      uShadeDir: { value: new Vector3(-0.32, 0.88, 0.35).normalize() },
      uShadeAmount: { value: cfg.shadeAmount },
      uFadeStart: { value: cfg.fadeStart },
      uFadeEnd: { value: cfg.fadeEnd },
    },
  });
