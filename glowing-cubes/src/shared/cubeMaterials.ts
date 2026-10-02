import {
  Color,
  DoubleSide,
  FrontSide,
  MeshPhysicalMaterial,
  type WebGLProgramParametersWithUniforms,
} from "three";
import type { CubeType } from "../rng";

// Fake glass — NO real transmission anywhere.
//
// All four cube kinds are MeshPhysicalMaterial (so they pick up the studio
// environment map and the lights) with a small shader patch that adds:
//   • per-instance tint (aTint) and glow strength (aGlow)
//   • a Fresnel term (bright where the surface turns away from the camera)
//   • an "edge" term computed from the cube's object-space position, which
//     lights up the rounded edges
// Frosted and clear glass are plain alpha-blended surfaces whose alpha is
// raised by the Fresnel/edge terms, so they read as glass without the
// per-object scene re-render that `transmission` costs.

type Params = {
  /** emissive core strength (HDR) */
  emis: number;
  /** how much of the tint shows in the core (0 = white core) */
  tintMix: number;
  fresPow: number;
  fres: number;
  edge: number;
  fresAlpha: number;
  edgeAlpha: number;
};

const TYPE_ID: Record<CubeType, number> = { glow: 0, frosted: 1, glass: 2, dark: 3 };

export const PARAMS: Record<CubeType, Params> = {
  glow: { emis: 1.7, tintMix: 0.62, fresPow: 1.4, fres: 2.2, edge: 2.4, fresAlpha: 0, edgeAlpha: 0 },
  frosted: { emis: 0.22, tintMix: 1, fresPow: 2.0, fres: 0.45, edge: 0.55, fresAlpha: 0.3, edgeAlpha: 0.3 },
  glass: { emis: 0.0, tintMix: 1, fresPow: 3.0, fres: 1.2, edge: 1.1, fresAlpha: 0.45, edgeAlpha: 0.5 },
  dark: { emis: 0.0, tintMix: 1, fresPow: 3.5, fres: 0.25, edge: 0.35, fresAlpha: 0, edgeAlpha: 0 },
};

export const createCubeMaterial = (type: CubeType, baseColor: Color): MeshPhysicalMaterial => {
  const p = PARAMS[type];
  let m: MeshPhysicalMaterial;
  switch (type) {
    case "glow":
      m = new MeshPhysicalMaterial({
        color: baseColor,
        roughness: 0.35,
        metalness: 0,
        envMapIntensity: 0.4,
      });
      break;
    case "frosted":
      m = new MeshPhysicalMaterial({
        color: baseColor,
        roughness: 0.55,
        metalness: 0,
        transparent: true,
        opacity: 0.32,
        // instances are sorted back-to-front each frame, so writing depth is
        // safe here and gives depth of field correct depth for these cubes
        depthWrite: true,
        envMapIntensity: 0.3,
        side: FrontSide,
      });
      break;
    case "glass":
      m = new MeshPhysicalMaterial({
        color: baseColor,
        roughness: 0.04,
        metalness: 0,
        transparent: true,
        opacity: 0.07,
        depthWrite: true,
        envMapIntensity: 2.2,
        clearcoat: 1,
        clearcoatRoughness: 0.05,
        // transparent + DoubleSide → three draws back faces, then front faces
        side: DoubleSide,
      });
      break;
    case "dark":
    default:
      m = new MeshPhysicalMaterial({
        color: baseColor,
        roughness: 0.14,
        metalness: 0.15,
        clearcoat: 1,
        clearcoatRoughness: 0.06,
        envMapIntensity: 0.6,
      });
      break;
  }

  m.onBeforeCompile = (shader: WebGLProgramParametersWithUniforms) => {
    shader.uniforms.uEmis = { value: p.emis };
    shader.uniforms.uTintMix = { value: p.tintMix };
    shader.uniforms.uFresPow = { value: p.fresPow };
    shader.uniforms.uFres = { value: p.fres };
    shader.uniforms.uEdge = { value: p.edge };
    shader.uniforms.uFresAlpha = { value: p.fresAlpha };
    shader.uniforms.uEdgeAlpha = { value: p.edgeAlpha };

    shader.vertexShader = shader.vertexShader
      .replace(
        "#include <common>",
        `#include <common>
attribute vec3 aTint;
attribute float aGlow;
varying vec3 vTint;
varying float vGlow;
varying vec3 vLocal;`,
      )
      .replace(
        "#include <begin_vertex>",
        `#include <begin_vertex>
vTint = aTint;
vGlow = aGlow;
vLocal = position;`,
      );

    shader.fragmentShader = shader.fragmentShader
      .replace(
        "#include <common>",
        `#include <common>
#define GC_TYPE ${TYPE_ID[type]}
varying vec3 vTint;
varying float vGlow;
varying vec3 vLocal;
uniform float uEmis;
uniform float uTintMix;
uniform float uFresPow;
uniform float uFres;
uniform float uEdge;
uniform float uFresAlpha;
uniform float uEdgeAlpha;`,
      )
      .replace(
        "#include <emissivemap_fragment>",
        `#include <emissivemap_fragment>
vec3 gcV = normalize(vViewPosition);
float gcNV = clamp(abs(dot(normal, gcV)), 0.0, 1.0);
float gcFres = pow(1.0 - gcNV, uFresPow);
vec3 gcA = abs(vLocal) * 2.0;
float gcMid = gcA.x + gcA.y + gcA.z - max(gcA.x, max(gcA.y, gcA.z)) - min(gcA.x, min(gcA.y, gcA.z));
float gcEdge = smoothstep(0.80, 0.97, gcMid);
#if GC_TYPE == 0
  // glowing: near-white core, tinted toward the silhouette and edges
  vec3 gcCore = mix(vec3(1.0), vTint, clamp(uTintMix + gcFres * 0.9 + gcEdge * 0.5, 0.0, 1.0));
  totalEmissiveRadiance += gcCore * uEmis * vGlow + vTint * (gcEdge * uEdge + gcFres * uFres) * vGlow;
#elif GC_TYPE == 1
  // frosted: faint inner light + soft Fresnel rim
  totalEmissiveRadiance += vTint * (uEmis * vGlow + gcFres * uFres + gcEdge * uEdge);
#elif GC_TYPE == 2
  // clear glass: bright edges and Fresnel rim
  totalEmissiveRadiance += vTint * (gcFres * uFres + gcEdge * uEdge) * vGlow;
#else
  // dark: very faint tinted rim so silhouettes separate from the floor
  totalEmissiveRadiance += vTint * (gcFres * uFres + gcEdge * uEdge);
#endif`,
      )
      .replace(
        "#include <opaque_fragment>",
        `diffuseColor.a = clamp(diffuseColor.a + gcFres * uFresAlpha + gcEdge * uEdgeAlpha, 0.0, 1.0);
#include <opaque_fragment>`,
      );
  };
  m.customProgramCacheKey = () => `glowing-cube-${type}`;
  return m;
};
