import * as THREE from "three";
import { DIM, GRID_CENTER, GRID_N, SPACING, TUBE_START } from "../lib/grid";
import {
  getBrushedTextures,
  getFrostTexture,
  getInnerLinesTexture,
  getPcbTexture,
} from "./textures";

// ---------------------------------------------------------------------------
// Shared uniforms. One object per scene; every material references the same
// uniform instances, so setting uFrame once per frame updates everything.
// The spread is a shader parameter: per-instance switch times are compared
// against uFrame on the GPU.
// ---------------------------------------------------------------------------
export type SharedUniforms = {
  uFrame: { value: number };
  uColOld: { value: THREE.Color };
  uColNew: { value: THREE.Color };
  /** 1 in comp 1: node tops darken and carry a shield once switched. */
  uShieldTop: { value: number };
  /** Gentle breathing of the light level, a function of frame. */
  uPulse: { value: number };
  /** Minimum cable travel time in frames (MIN_GAP x stepFrames). */
  uMinFill: { value: number };
};

export const SAFE = new THREE.Color("#8EC8FF");
export const COMPROMISED = new THREE.Color("#FF3B4E");

export const createSharedUniforms = (): SharedUniforms => ({
  uFrame: { value: 0 },
  uColOld: { value: new THREE.Color() },
  uColNew: { value: new THREE.Color() },
  uShieldTop: { value: 0 },
  uPulse: { value: 1 },
  uMinFill: { value: 10 },
});

/** Fog uniforms (cloned) + the shared uniforms (by reference) + extras. */
const uniformsFor = (u: SharedUniforms, extra: Record<string, THREE.IUniform> = {}) => ({
  ...(THREE.UniformsUtils.merge([THREE.UniformsLib.fog]) as Record<string, THREE.IUniform>),
  ...extra,
  uFrame: u.uFrame,
  uColOld: u.uColOld,
  uColNew: u.uColNew,
  uPulse: u.uPulse,
  uMinFill: u.uMinFill,
});

const COMMON_GLSL = /* glsl */ `
uniform float uFrame;
uniform vec3 uColOld;
uniform vec3 uColNew;
uniform float uPulse;
float switched(float t) { return uFrame >= t ? 1.0 : 0.0; }
// 6-frame flash when a node changes colour
float flashAmt(float t) {
  float d = uFrame - t;
  return (d >= 0.0 && d < 6.0) ? pow(1.0 - d / 6.0, 2.0) : 0.0;
}
vec3 nodeColour(float t) { return mix(uColOld, uColNew, switched(t)); }

uniform float uMinFill;
// Cable colour state at position s (0 = earlier node, 1 = later node) for a
// link whose ends switch at t0 <= t1. Front A leaves the earlier node at t0
// and reaches the later node exactly at t1. If t1 - t0 is shorter than the
// minimum travel time, front A travels at that minimum and a second front
// leaves the later node at t1; they meet in between.
// Returns (amount of new colour, front-head intensity).
vec2 cableState(float t0, float t1, float s, float edge, float headW) {
  float dA = max(t1 - t0, uMinFill);
  float fA = clamp((uFrame - t0) / dA, 0.0, 1.0);
  float fB = clamp((uFrame - t1) / uMinFill, 0.0, 1.0);
  float pB = 1.0 - fB;
  if (fA >= pB) return vec2(1.0, 0.0);
  float mA = fA <= 0.0 ? 0.0 : 1.0 - smoothstep(fA - edge, fA + edge, s);
  float mB = fB <= 0.0 ? 0.0 : smoothstep(pB - edge, pB + edge, s);
  float head = (fA > 0.0 ? exp(-pow((s - fA) / headW, 2.0)) : 0.0)
             + (fB > 0.0 ? exp(-pow((s - pB) / headW, 2.0)) : 0.0);
  return vec2(max(mA, mB), head);
}
`;

// ---------------------------------------------------------------------------
// Fake glass: physical material, no transmission. Low base opacity, alpha
// rises with Fresnel, and the specular/env reflection is NOT multiplied by
// alpha (premultiplied output), so rims and reflections stay bright.
// ---------------------------------------------------------------------------
export const createGlassMaterial = (opacity: number, rimStrength: number) => {
  const m = new THREE.MeshPhysicalMaterial({
    color: new THREE.Color("#c9d6e4"),
    metalness: 0,
    roughness: 0.06,
    ior: 1.5,
    specularIntensity: 1,
    envMapIntensity: 1.6,
    clearcoat: 0.6,
    clearcoatRoughness: 0.05,
    transparent: true,
    depthWrite: false,
    side: THREE.DoubleSide,
  });
  m.blending = THREE.CustomBlending;
  m.blendSrc = THREE.OneFactor;
  m.blendDst = THREE.OneMinusSrcAlphaFactor;
  m.blendSrcAlpha = THREE.OneFactor;
  m.blendDstAlpha = THREE.OneMinusSrcAlphaFactor;
  m.onBeforeCompile = (shader) => {
    shader.uniforms.uGlassOpacity = { value: opacity };
    shader.uniforms.uRim = { value: rimStrength };
    shader.fragmentShader = shader.fragmentShader
      .replace("void main() {", "uniform float uGlassOpacity;\nuniform float uRim;\nvoid main() {")
      .replace(
        "#include <opaque_fragment>",
        /* glsl */ `
        float ndv = clamp(abs(dot(normal, geometryViewDir)), 0.0, 1.0);
        float fres = pow(1.0 - ndv, 3.0);
        float a = clamp(uGlassOpacity + fres * 0.5, 0.0, 1.0);
        vec3 rim = vec3(0.85, 0.92, 1.0) * fres * uRim;
        gl_FragColor = vec4(totalDiffuse * a + (outgoingLight - totalDiffuse) * (1.0 + fres) + rim, a);
        `,
      );
  };
  m.customProgramCacheKey = () => `glass-${opacity}-${rimStrength}`;
  return m;
};

// ---------------------------------------------------------------------------
// Instanced node-state shaders (unlit, HDR emissive).
// aNode = (tSwitch, seed, whiteTop, 0)
// ---------------------------------------------------------------------------
const fogVertex = /* glsl */ `
#include <fog_pars_vertex>
`;

export const createGlowLineMaterial = (u: SharedUniforms) =>
  new THREE.ShaderMaterial({
    uniforms: uniformsFor(u),
    vertexShader: /* glsl */ `
      ${COMMON_GLSL}
      attribute vec4 aNode;
      varying float vT;
      varying float vH;
      ${fogVertex}
      void main() {
        vT = aNode.x;
        vH = position.y;
        vec4 mvPosition = modelViewMatrix * instanceMatrix * vec4(position, 1.0);
        gl_Position = projectionMatrix * mvPosition;
        #include <fog_vertex>
      }`,
    fragmentShader: /* glsl */ `
      ${COMMON_GLSL}
      varying float vT;
      varying float vH;
      #include <fog_pars_fragment>
      void main() {
        vec3 c = nodeColour(vT);
        float f = flashAmt(vT);
        vec3 col = c * (3.2 * uPulse + 4.0 * f) + vec3(1.0) * f * 1.2;
        gl_FragColor = vec4(col, 1.0);
        #include <fog_fragment>
      }`,
    fog: true,
  });

export const createInnerLinesMaterial = (u: SharedUniforms) => {
  const m = new THREE.ShaderMaterial({
    uniforms: uniformsFor(u, { uLines: { value: getInnerLinesTexture() } }),
    vertexShader: /* glsl */ `
      ${COMMON_GLSL}
      attribute vec4 aNode;
      varying float vT;
      varying vec2 vUv;
      varying float vSeed;
      ${fogVertex}
      void main() {
        vT = aNode.x;
        vSeed = aNode.y;
        vUv = uv;
        vec4 mvPosition = modelViewMatrix * instanceMatrix * vec4(position, 1.0);
        gl_Position = projectionMatrix * mvPosition;
        #include <fog_vertex>
      }`,
    fragmentShader: /* glsl */ `
      ${COMMON_GLSL}
      uniform sampler2D uLines;
      varying float vT;
      varying vec2 vUv;
      varying float vSeed;
      #include <fog_pars_fragment>
      void main() {
        float mask = texture2D(uLines, vec2(vUv.x * 2.0 + vSeed, vUv.y)).r;
        vec3 c = nodeColour(vT);
        float f = flashAmt(vT);
        // brighter toward the floor, like light rising from the plinth
        float grad = mix(1.25, 0.55, vUv.y);
        vec3 col = c * mask * grad * (1.9 * uPulse + 3.2 * f) + c * 0.05 * grad;
        gl_FragColor = vec4(col, 1.0);
        #include <fog_fragment>
      }`,
    fog: true,
    transparent: true,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
    side: THREE.DoubleSide,
  });
  return m;
};

// ---------------------------------------------------------------------------
// Cable cores. aLink = (tStart, tEnd, reverse, seed). The colour front
// travels from the earlier node to the later one:
//   fill = clamp((frame - tStart) / (tEnd - tStart), 0, 1)
// ---------------------------------------------------------------------------
export const createCoreMaterial = (u: SharedUniforms) =>
  new THREE.ShaderMaterial({
    uniforms: uniformsFor(u),
    vertexShader: /* glsl */ `
      ${COMMON_GLSL}
      attribute vec4 aLink;
      varying float vU;
      varying vec4 vLink;
      varying vec3 vN;
      varying vec3 vV;
      ${fogVertex}
      void main() {
        vU = position.y + 0.5;
        vLink = aLink;
        vec4 world = modelMatrix * instanceMatrix * vec4(position, 1.0);
        vec4 mvPosition = viewMatrix * world;
        vN = normalize((viewMatrix * modelMatrix * instanceMatrix * vec4(normal, 0.0)).xyz);
        vV = normalize(-mvPosition.xyz);
        gl_Position = projectionMatrix * mvPosition;
        #include <fog_vertex>
      }`,
    fragmentShader: /* glsl */ `
      ${COMMON_GLSL}
      varying float vU;
      varying vec4 vLink;
      varying vec3 vN;
      varying vec3 vV;
      #include <fog_pars_fragment>
      void main() {
        float s = vLink.z > 0.5 ? 1.0 - vU : vU;      // 0 at the earlier node
        vec2 st = cableState(vLink.x, vLink.y, s, 0.02, 0.05);
        vec3 c = mix(uColOld, uColNew, st.x);
        // bright head on the moving front(s)
        float head = st.y;
        // brighter where the tube enters the sockets
        float ends = 1.0 + 1.1 * (exp(-vU * 16.0) + exp(-(1.0 - vU) * 16.0));
        // faint pulses running along the core
        float dir = vLink.w > 0.5 ? 1.0 : -1.0;
        float ph = fract(vU * 0.9 * dir - uFrame * 0.016 + vLink.w * 7.31);
        float dash = smoothstep(0.0, 0.03, ph) * (1.0 - smoothstep(0.05, 0.16, ph));
        // hot white centre line, coloured toward the silhouette
        float ndv = clamp(abs(dot(vN, vV)), 0.0, 1.0);
        vec3 hot = mix(c, vec3(1.0), 0.15 * ndv);
        vec3 col = hot * (1.7 * uPulse * ends + 1.5 * dash) + mix(c, vec3(1.0), 0.4) * head * 8.0;
        gl_FragColor = vec4(col, 1.0);
        #include <fog_fragment>
      }`,
    fog: true,
  });

// ---------------------------------------------------------------------------
// Floor light spill. A single additive plane just above the floor; for each
// fragment it looks up the nearest links and node in a data texture of
// switch times and adds a soft glow in the local colour. This fakes the
// cable light falling on the floor, and it follows the spread front exactly.
// ---------------------------------------------------------------------------
export const createSpillMaterial = (u: SharedUniforms, times: THREE.DataTexture) =>
  new THREE.ShaderMaterial({
    uniforms: uniformsFor(u, { uTimes: { value: times }, uStrength: { value: 0.15 } }),
    vertexShader: /* glsl */ `
      varying vec3 vWorld;
      ${fogVertex}
      void main() {
        vec4 world = modelMatrix * vec4(position, 1.0);
        vWorld = world.xyz;
        vec4 mvPosition = viewMatrix * world;
        gl_Position = projectionMatrix * mvPosition;
        #include <fog_vertex>
      }`,
    fragmentShader: /* glsl */ `
      ${COMMON_GLSL}
      precision highp sampler2D;
      uniform sampler2D uTimes;
      uniform float uStrength;
      varying vec3 vWorld;
      #include <fog_pars_fragment>
      const float N = ${GRID_N.toFixed(1)};
      const float S = ${SPACING.toFixed(1)};
      const float C = ${GRID_CENTER.toFixed(1)};
      const float C0 = ${(TUBE_START / SPACING).toFixed(4)};
      float tAt(float i, float j) { return texelFetch(uTimes, ivec2(int(i), int(j)), 0).r; }

      // colour + front intensity along a link at parameter s (0 = node a centre)
      vec3 linkLight(float ta, float tb, float s, out float frontGlow) {
        float t0 = min(ta, tb);
        float t1 = max(ta, tb);
        float sf = ta <= tb ? s : 1.0 - s;
        float u = clamp((sf - C0) / (1.0 - 2.0 * C0), 0.0, 1.0);
        vec2 st = cableState(t0, t1, u, 0.03, 0.09);
        frontGlow = st.y;
        return mix(uColOld, uColNew, st.x);
      }

      void main() {
        float gx = vWorld.x / S + C;
        float gz = vWorld.z / S + C;
        vec3 acc = vec3(0.0);
        // links along x
        {
          float j = floor(gz + 0.5);
          float i0 = floor(gx);
          if (j >= 0.0 && j < N && i0 >= 0.0 && i0 < N - 1.0) {
            float d = abs(gz - j) * S;
            float s = gx - i0;
            float fg;
            vec3 c = linkLight(tAt(i0, j), tAt(i0 + 1.0, j), s, fg);
            float w = exp(-d * d / 0.10) * 0.55 + exp(-d / 0.55) * 0.22;
            acc += c * w * (1.0 + 2.5 * fg);
          }
        }
        // links along z
        {
          float i = floor(gx + 0.5);
          float j0 = floor(gz);
          if (i >= 0.0 && i < N && j0 >= 0.0 && j0 < N - 1.0) {
            float d = abs(gx - i) * S;
            float s = gz - j0;
            float fg;
            vec3 c = linkLight(tAt(i, j0), tAt(i, j0 + 1.0), s, fg);
            float w = exp(-d * d / 0.10) * 0.55 + exp(-d / 0.55) * 0.22;
            acc += c * w * (1.0 + 2.5 * fg);
          }
        }
        // node glow around the plinth foot line
        {
          float i = floor(gx + 0.5);
          float j = floor(gz + 0.5);
          if (i >= 0.0 && i < N && j >= 0.0 && j < N) {
            vec2 p = abs(vec2(gx - i, gz - j)) * S;
            // octagon "radius": equals plinthHalf on the plinth outline
            float r = max(max(p.x, p.y), (p.x + p.y - ${(2 * DIM.plinthHalf - DIM.plinthChamfer).toFixed(4)}) * 0.7071 + ${DIM.plinthHalf.toFixed(4)})
              - ${DIM.plinthHalf.toFixed(4)};
            float t = tAt(i, j);
            vec3 c = nodeColour(t);
            float f = flashAmt(t);
            float w = (r > 0.0 ? exp(-r / 0.22) * 0.9 + exp(-r / 0.9) * 0.18 : 0.25);
            acc += c * w * (1.0 + 3.0 * f);
          }
        }
        vec3 col = acc * uStrength * uPulse;
        gl_FragColor = vec4(col, 1.0);
        #include <fog_fragment>
      }`,
    fog: true,
    transparent: true,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
    polygonOffset: true,
    polygonOffsetFactor: -2,
    polygonOffsetUnits: -2,
  });

// ---------------------------------------------------------------------------
// Shield marks. Mode 0: flat on the top plate (comp 1). Mode 1: floating,
// camera-facing billboard with a gentle bob (comp 4).
// ---------------------------------------------------------------------------
export const createShieldMaterial = (u: SharedUniforms, mode: 0 | 1) =>
  new THREE.ShaderMaterial({
    uniforms: uniformsFor(u, {
      uUpXZ: { value: new THREE.Vector2(0, -1) },
      uSize: { value: mode === 0 ? 0.95 : 0.72 },
    }),
    defines: { SHIELD_MODE: mode },
    vertexShader: /* glsl */ `
      ${COMMON_GLSL}
      attribute vec4 aNode;
      attribute float aPart;
      uniform vec2 uUpXZ;
      uniform float uSize;
      varying vec2 vUv;
      varying float vPart;
      varying float vAppear;
      varying float vAge;
      ${fogVertex}
      void main() {
        float age = uFrame - aNode.x;
        vAge = age;
        float a = clamp(age / 10.0, 0.0, 1.0);
        float e = 1.0 - pow(1.0 - a, 3.0);
        vAppear = e;
        float sc = mix(0.9, 1.0, e) * uSize;
        vec3 centre = (modelMatrix * instanceMatrix * vec4(0.0, 0.0, 0.0, 1.0)).xyz;
        vec3 world;
        #if SHIELD_MODE == 0
          vec3 up = vec3(uUpXZ.x, 0.0, uUpXZ.y);
          vec3 right = vec3(-uUpXZ.y, 0.0, uUpXZ.x);
          world = centre + (right * position.x + up * position.y) * sc + vec3(0.0, position.z, 0.0);
        #else
          // gentle bob after it has popped up, phase from the node seed
          float bob = age > 0.0 ? sin(age * 0.085 + aNode.y * 6.2831) * 0.07 * smoothstep(0.0, 20.0, age) : 0.0;
          centre.y += bob - (1.0 - e) * 0.18;
          vec3 right = vec3(viewMatrix[0][0], viewMatrix[1][0], viewMatrix[2][0]);
          vec3 up = vec3(viewMatrix[0][1], viewMatrix[1][1], viewMatrix[2][1]);
          vec3 fwd = vec3(viewMatrix[0][2], viewMatrix[1][2], viewMatrix[2][2]);
          world = centre + (right * position.x + up * position.y) * sc + fwd * position.z;
        #endif
        vUv = uv;
        vPart = aPart;
        vec4 mvPosition = viewMatrix * vec4(world, 1.0);
        gl_Position = projectionMatrix * mvPosition;
        #include <fog_vertex>
      }`,
    fragmentShader: /* glsl */ `
      ${COMMON_GLSL}
      varying vec2 vUv;
      varying float vPart;
      varying float vAppear;
      varying float vAge;
      #include <fog_pars_fragment>
      void main() {
        if (vAge < 0.0) discard;
        // one soft glint sweeping across as it appears
        float sweep = -0.4 + clamp(vAge / 16.0, 0.0, 1.0) * 2.8;
        float glint = exp(-pow(((vUv.x + vUv.y) - sweep) / 0.16, 2.0)) * (vAge < 18.0 ? 1.0 : 0.0);
        vec3 white = vec3(1.0, 1.0, 1.0);
        #if SHIELD_MODE == 0
          vec3 base = vPart > 0.5 ? white * 2.2 : uColNew * 0.35;
          float alpha = vPart > 0.5 ? 1.0 : 0.55;
        #else
          vec3 base = vPart > 0.5 ? white * 1.7 : vec3(0.75, 0.86, 1.0) * 0.7;
          float alpha = vPart > 0.5 ? 1.0 : 0.38;
        #endif
        vec3 col = base * uPulse + white * glint * 6.0;
        gl_FragColor = vec4(col * vAppear, alpha * vAppear);
        #include <fog_fragment>
      }`,
    fog: true,
    transparent: true,
    depthWrite: false,
    blending: THREE.CustomBlending,
    blendSrc: THREE.OneFactor,
    blendDst: THREE.OneMinusSrcAlphaFactor,
    side: THREE.DoubleSide,
  });

// ---------------------------------------------------------------------------
// Standard (lit) materials.
// ---------------------------------------------------------------------------
export const createPlinthMaterial = () =>
  new THREE.MeshStandardMaterial({ color: "#2b3038", metalness: 0.85, roughness: 0.36, envMapIntensity: 1.0 });

export const createPostMaterial = () =>
  new THREE.MeshStandardMaterial({ color: "#1c2027", metalness: 0.8, roughness: 0.32 });

export const createSocketMaterial = () =>
  new THREE.MeshStandardMaterial({ color: "#20252c", metalness: 0.8, roughness: 0.34, side: THREE.DoubleSide });

export const createTopFrameMaterial = () => {
  const { map, rough } = getBrushedTextures();
  const m = new THREE.MeshStandardMaterial({
    color: "#dfe4ea",
    map,
    roughnessMap: rough,
    metalness: 0.62,
    roughness: 1.0,
    envMapIntensity: 1.4,
  });
  return m;
};

export const createDieMaterial = () =>
  new THREE.MeshStandardMaterial({ color: "#0c0e11", metalness: 0.6, roughness: 0.22 });

/**
 * PCB / frosted inset. In shield mode (comp 1) the inset darkens once the
 * node turns safe, making room for the shield mark drawn on top of it.
 */
const withShieldDarken = (m: THREE.MeshStandardMaterial, u: SharedUniforms, emissiveToo: boolean) => {
  m.onBeforeCompile = (shader) => {
    shader.uniforms.uFrame = u.uFrame;
    shader.uniforms.uShieldTop = u.uShieldTop;
    shader.vertexShader = shader.vertexShader
      .replace(
        "void main() {",
        "attribute vec4 aNode;\nuniform float uFrame;\nuniform float uShieldTop;\nvarying float vDark;\nvoid main() {\n  vDark = uShieldTop * smoothstep(aNode.x, aNode.x + 10.0, uFrame);",
      );
    shader.fragmentShader = shader.fragmentShader
      .replace("void main() {", "varying float vDark;\nvoid main() {")
      .replace(
        "#include <map_fragment>",
        "#include <map_fragment>\n  diffuseColor.rgb *= mix(1.0, 0.32, vDark);",
      );
    if (emissiveToo) {
      shader.fragmentShader = shader.fragmentShader.replace(
        "#include <emissivemap_fragment>",
        "#include <emissivemap_fragment>\n  totalEmissiveRadiance *= mix(1.0, 0.18, vDark);",
      );
    }
  };
  m.customProgramCacheKey = () => `shield-darken-${emissiveToo}`;
  return m;
};

export const createPcbMaterial = (u: SharedUniforms) =>
  withShieldDarken(
    new THREE.MeshStandardMaterial({ map: getPcbTexture(), metalness: 0.25, roughness: 0.42, envMapIntensity: 0.9 }),
    u,
    false,
  );

export const createFrostMaterial = (u: SharedUniforms) =>
  withShieldDarken(
    new THREE.MeshStandardMaterial({
      color: "#eef4ff",
      map: getFrostTexture(),
      emissive: new THREE.Color("#dfeaff"),
      emissiveMap: getFrostTexture(),
      emissiveIntensity: 0.55,
      metalness: 0,
      roughness: 0.55,
    }),
    u,
    true,
  );
