import * as THREE from "three";
import { ATLAS_COLS, ATLAS_ROWS } from "../icons/atlas";
import { FLARE_FRAMES, LOOP } from "./layout";

/**
 * Cube material: satin plastic (roughness 0.4) lit by the RoomEnvironment PMREM.
 * The per-instance colour (field gradient) also feeds a faint self-glow so the
 * field reads as a coloured surface even where the environment is dark.
 */
export function makeCubeMaterial(envMap: THREE.Texture) {
  const m = new THREE.MeshStandardMaterial({
    color: 0xffffff,
    roughness: 0.4,
    metalness: 0.0,
    envMap,
    envMapIntensity: 0.3,
  });
  const uniforms = { uSelfGlow: { value: 0.16 } };
  m.onBeforeCompile = (shader) => {
    Object.assign(shader.uniforms, uniforms);
    shader.fragmentShader = shader.fragmentShader
      .replace("#include <common>", "#include <common>\nuniform float uSelfGlow;")
      .replace(
        "#include <emissivemap_fragment>",
        `#include <emissivemap_fragment>
        totalEmissiveRadiance += vColor.rgb * uSelfGlow * (0.35 + 0.65 * clamp(normal.y * 0.5 + 0.5, 0.0, 1.0));`,
      );
  };
  return { material: m, uniforms };
}

/** Emissive icon quads on the cubes' top faces (additive, instanced). */
export function makeIconMaterial(atlas: THREE.Texture, iconColor: THREE.Color, accentColor: THREE.Color) {
  const uniforms = {
    uAtlas: { value: atlas },
    uFrame: { value: 0 },
    uIcon: { value: iconColor },
    uAccent: { value: accentColor },
    uIconGain: { value: 1.15 },
    uAccentGain: { value: 2.4 },
    uHalo: { value: 0.9 },
  };
  const material = new THREE.ShaderMaterial({
    uniforms,
    transparent: true,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
    vertexShader: /* glsl */ `
      uniform float uFrame;
      attribute float aSlot;
      attribute float aAccent;
      attribute float aFlare;
      attribute float aShimmer;
      varying vec2 vUv;
      varying float vAccent;
      varying float vBoost;
      void main() {
        vec2 off = vec2(mod(aSlot, ${ATLAS_COLS}.0) / ${ATLAS_COLS}.0,
                        1.0 - (floor(aSlot / ${ATLAS_COLS}.0) + 1.0) / ${ATLAS_ROWS}.0);
        vUv = off + uv * vec2(1.0 / ${ATLAS_COLS}.0, 1.0 / ${ATLAS_ROWS}.0);
        // twinkle: +60% for ${FLARE_FRAMES} frames, scheduled modulo the loop
        float d = mod(uFrame - aFlare + ${LOOP}.0, ${LOOP}.0);
        float flare = (aFlare >= 0.0 && d < ${FLARE_FRAMES}.0)
          ? ((d < 0.5 || d > ${FLARE_FRAMES}.0 - 1.5) ? 0.5 : 1.0) : 0.0;
        vBoost = aShimmer * (1.0 + 0.6 * flare);
        vAccent = aAccent;
        gl_Position = projectionMatrix * viewMatrix * modelMatrix * instanceMatrix * vec4(position, 1.0);
      }
    `,
    fragmentShader: /* glsl */ `
      uniform sampler2D uAtlas;
      uniform vec3 uIcon;
      uniform vec3 uAccent;
      uniform float uIconGain;
      uniform float uAccentGain;
      uniform float uHalo;
      varying vec2 vUv;
      varying float vAccent;
      varying float vBoost;
      void main() {
        vec2 t = texture2D(uAtlas, vUv).rg;
        vec3 base = uIcon * t.r * uIconGain;
        vec3 acc = uAccent * (t.r * uAccentGain + t.g * uHalo);
        gl_FragColor = vec4(mix(base, acc, vAccent) * vBoost, 1.0);
      }
    `,
  });
  return { material, uniforms };
}

/** The plate: a darker satin slab with a soft fresnel rim highlight. */
export function makePlateMaterial(envMap: THREE.Texture, color: THREE.Color, rim: THREE.Color) {
  const m = new THREE.MeshStandardMaterial({
    color,
    roughness: 0.38,
    metalness: 0.1,
    envMap,
    envMapIntensity: 0.35,
  });
  const uniforms = { uRim: { value: rim } };
  m.onBeforeCompile = (shader) => {
    Object.assign(shader.uniforms, uniforms);
    shader.fragmentShader = shader.fragmentShader
      .replace("#include <common>", "#include <common>\nuniform vec3 uRim;")
      .replace(
        "#include <emissivemap_fragment>",
        `#include <emissivemap_fragment>
        float fres = pow(1.0 - clamp(dot(normal, normalize(vViewPosition)), 0.0, 1.0), 3.0);
        totalEmissiveRadiance += uRim * fres;`,
      );
  };
  return { material: m, uniforms };
}

/**
 * Letter front faces: glossy, glowing, a soft gradient from the palette's
 * letter colour (bottom of the glyphs) to white (top).
 */
export function makeLetterFaceMaterial(envMap: THREE.Texture, face: THREE.Color, capHeight: number) {
  const m = new THREE.MeshStandardMaterial({
    color: 0xffffff,
    roughness: 0.18,
    metalness: 0.0,
    envMap,
    envMapIntensity: 0.9,
  });
  const uniforms = {
    uFace: { value: face },
    uCap: { value: capHeight },
    uGlow: { value: 0.55 },
  };
  m.onBeforeCompile = (shader) => {
    Object.assign(shader.uniforms, uniforms);
    shader.vertexShader = shader.vertexShader
      .replace("#include <common>", "#include <common>\nvarying vec3 vLocal;")
      .replace("#include <begin_vertex>", "#include <begin_vertex>\nvLocal = position;");
    shader.fragmentShader = shader.fragmentShader
      .replace(
        "#include <common>",
        "#include <common>\nvarying vec3 vLocal;\nuniform vec3 uFace;\nuniform float uCap;\nuniform float uGlow;",
      )
      .replace(
        "#include <color_fragment>",
        `#include <color_fragment>
        float gy = clamp(-vLocal.z / uCap + 0.5, 0.0, 1.0);
        vec3 faceCol = mix(uFace, vec3(1.0), smoothstep(0.15, 1.0, gy) * 0.5);
        diffuseColor.rgb = faceCol;`,
      )
      .replace(
        "#include <emissivemap_fragment>",
        "#include <emissivemap_fragment>\ntotalEmissiveRadiance += faceCol * uGlow;",
      );
  };
  return { material: m, uniforms };
}

/**
 * Letter sides and bevels: an iridescent thin-film look. Hue follows the view
 * angle and the (view-space) normal, cycling gold → pink → violet → cyan, so
 * it shifts as the camera drifts.
 */
export function makeIridescentMaterial(envMap: THREE.Texture) {
  const m = new THREE.MeshStandardMaterial({
    color: 0xffffff,
    roughness: 0.18,
    metalness: 0.9,
    envMap,
    envMapIntensity: 1.2,
  });
  const uniforms = { uPhase: { value: 0 }, uIriGlow: { value: 1.5 } };
  m.onBeforeCompile = (shader) => {
    Object.assign(shader.uniforms, uniforms);
    shader.fragmentShader = shader.fragmentShader
      .replace(
        "#include <common>",
        `#include <common>
        uniform float uPhase;
        uniform float uIriGlow;
        vec3 thinFilm(float t) {
          // cyclic ramp: gold → pink → violet → cyan → gold
          vec3 c0 = vec3(1.00, 0.72, 0.22);
          vec3 c1 = vec3(1.00, 0.36, 0.66);
          vec3 c2 = vec3(0.58, 0.32, 1.00);
          vec3 c3 = vec3(0.30, 0.90, 1.00);
          t = fract(t) * 4.0;
          vec3 a = t < 1.0 ? c0 : t < 2.0 ? c1 : t < 3.0 ? c2 : c3;
          vec3 b = t < 1.0 ? c1 : t < 2.0 ? c2 : t < 3.0 ? c3 : c0;
          return mix(a, b, smoothstep(0.0, 1.0, fract(t)));
        }`,
      )
      .replace(
        "#include <lights_physical_fragment>",
        `float ndv = clamp(dot(normal, normalize(vViewPosition)), 0.0, 1.0);
        vec3 iri = thinFilm(1.35 * (1.0 - ndv) + 0.22 * normal.x + 0.12 * normal.y + uPhase);
        diffuseColor.rgb = iri;
        totalEmissiveRadiance += iri * uIriGlow * (0.35 + 0.65 * pow(1.0 - ndv, 1.5));
        #include <lights_physical_fragment>`,
      );
  };
  return { material: m, uniforms };
}
