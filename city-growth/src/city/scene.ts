/**
 * Builds the three.js scene from the layout data and updates it for a given
 * time. Nothing in here keeps its own clock: `update(t)` sets every uniform
 * and the camera from the time it is given.
 */
import * as THREE from "three";
import { CAMERA_FOV, CAMERAS, CameraKey, CONFIG } from "../config";
import { LOOK } from "../look";
import { boxes, coast, highways, KIND, roads, valueAt } from "./layout";

const lin = (hex: string) => new THREE.Color(hex); // sRGB hex -> linear working space
const glslVec3 = (c: THREE.Color) => `vec3(${c.r.toFixed(5)}, ${c.g.toFixed(5)}, ${c.b.toFixed(5)})`;
const f = (n: number) => n.toFixed(5);

const C = CONFIG.colors;
const rgb = (c: readonly [number, number, number]) => new THREE.Color().setRGB(c[0], c[1], c[2], THREE.LinearSRGBColorSpace);

// ------------------------------------------------------------ GLSL pieces
const GROW_PARS = /* glsl */ `
attribute float aBirth;
attribute float aYB;
uniform float uTime;
float growAt(float birth) {
  float x = clamp((uTime - birth) / ${f(CONFIG.riseTime)}, 0.0, 1.0);
  return 1.0 - pow(1.0 - x, 3.0);
}
`;
// Scales the whole building (all of its stacked boxes) up from the ground.
const GROW_VERTEX = /* glsl */ `
float grow = growAt(aBirth);
transformed.y = transformed.y * grow + (grow - 1.0) * aYB;
if (grow <= 0.0) transformed = vec3(0.0);
`;
const LINE_FN = /* glsl */ `
// anti-aliased repeating line: x in cells, w = line width as a cell fraction.
// Fades to its mean coverage when a cell gets smaller than ~2 px (no moire).
float gridLine(float x, float w) {
  float fw = fwidth(x);
  float d = abs(fract(x - 0.5) - 0.5);
  float l = 1.0 - smoothstep(w * 0.5 - fw, w * 0.5 + fw, d);
  return mix(l, w, smoothstep(0.25, 0.6, fw));
}
`;

// --------------------------------------------------------------- buildings
const makeBuildingMaterials = (uTime: { value: number }) => {
  const mat = new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.82, metalness: 0.0 });
  mat.onBeforeCompile = (shader) => {
    shader.uniforms.uTime = uTime;
    shader.vertexShader = shader.vertexShader
      .replace(
        "#include <common>",
        `#include <common>
${GROW_PARS}
attribute float aKind;
attribute vec3 aColor;
attribute vec3 aDim;
attribute float aSeed;
varying float vKind;
varying vec3 vCol;
varying vec3 vLocal;
varying vec3 vDim;
varying vec3 vObjN;
varying float vSeed;
varying float vAge;
varying float vH;`,
      )
      .replace(
        "#include <begin_vertex>",
        `#include <begin_vertex>
vLocal = position; vDim = aDim; vKind = aKind; vCol = aColor; vObjN = normal; vSeed = aSeed; vAge = uTime - aBirth; vH = (position.y + aYB) * aDim.y;
${GROW_VERTEX}`,
      );
    shader.fragmentShader = shader.fragmentShader
      .replace(
        "#include <common>",
        `#include <common>
varying float vKind;
varying vec3 vCol;
varying vec3 vLocal;
varying vec3 vDim;
varying vec3 vObjN;
varying float vSeed;
varying float vAge;
varying float vH;
${LINE_FN}
float bHash(vec2 p) { return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
float bNoise(vec2 p) {
  vec2 i = floor(p); vec2 fr = fract(p); vec2 u = fr * fr * (3.0 - 2.0 * fr);
  return mix(mix(bHash(i), bHash(i + vec2(1.0, 0.0)), u.x), mix(bHash(i + vec2(0.0, 1.0)), bHash(i + vec2(1.0, 1.0)), u.x), u.y);
}`,
      )
      .replace(
        "#include <color_fragment>",
        `#include <color_fragment>
vec3 bEmis = vec3(0.0);
float bRough = 0.82;
{
  vec3 an = abs(vObjN);
  bool top = an.y > 0.5;
  float hW = vLocal.y * vDim.y;
  float uW = an.x > 0.5 ? vLocal.z * vDim.z : vLocal.x * vDim.x;
  float faceW = an.x > 0.5 ? vDim.z : vDim.x;
  float edgeD = min(vDim.x * (0.5 - abs(vLocal.x)), vDim.z * (0.5 - abs(vLocal.z)));
  vec3 col = vCol;
  if (vKind < 0.5) {
    // concrete: window bands on the sides, parapet + panels on the roof
    if (!top) {
      float bands = gridLine(hW / ${f(CONFIG.floorHeight)}, 0.42);
      float mull = gridLine(uW / 0.31 + vSeed, 0.16);
      col *= 1.0 - ${f(LOOK.windowLineStrength)} * (bands * 0.9 + mull * 0.45);
    } else {
      float rv = fract(vSeed * 7.31);
      col = ${glslVec3(lin(C.roof))} * mix(0.42 + 0.58 * rv * rv, 0.92 + 0.08 * rv, step(0.28, vCol.g));
      float parapet = smoothstep(0.05, 0.08, edgeD) * (1.0 - smoothstep(0.11, 0.14, edgeD));
      float panel = max(gridLine(vLocal.x * vDim.x / 0.34 + vSeed * 3.0, 0.1), gridLine(vLocal.z * vDim.z / 0.34 + vSeed * 5.0, 0.1));
      panel *= smoothstep(0.1, 0.16, edgeD);
      col *= 1.0 - ${f(LOOK.roofDetailStrength)} * (parapet + 0.55 * panel);
    }
  } else if (vKind < 1.5) {
    // glass: blue gradient, pale mullions, bright edges, a little self-glow
    if (!top) {
      // glass: dark teal body, tall reflected-sky streaks, pale mullions, bright edges and cap
      float grad = pow(vLocal.y, 0.85);
      float faceId = an.x > 0.5 ? 3.7 : 0.0;
      float n1 = bNoise(vec2(uW * 1.6 + vSeed * 37.0 + faceId, hW * 0.3 + vSeed * 11.0));
      float n2 = bNoise(vec2(uW * 0.7 + vSeed * 5.0 + faceId * 2.0, hW * 0.9 + vSeed * 3.0));
      float streak = smoothstep(0.5, 0.78, n1) * (0.55 + 0.45 * grad);
      float sheen = smoothstep(0.55, 0.9, bNoise(vec2(uW * 0.5 + hW * 0.22 + vSeed * 20.0 + faceId, vSeed * 9.0)));
      float refl = clamp(streak + 0.6 * sheen, 0.0, 1.0) * ${f(LOOK.glassStreakAmount)};
      vec3 g = mix(${glslVec3(lin(C.glassLow))}, ${glslVec3(lin(C.glassHigh))}, grad) * (0.6 + 0.6 * n2);
      float mull = max(gridLine(hW / ${f(CONFIG.floorHeight)}, 0.14), gridLine(uW / 0.22 + vSeed, 0.12) * 0.8);
      float edge = smoothstep(0.5 * faceW - 0.07, 0.5 * faceW - 0.015, abs(uW));
      edge = max(edge, smoothstep(vDim.y - 0.22, vDim.y - 0.04, hW) * 0.9);
      float pale = clamp(mull * 0.2 + edge * 0.5, 0.0, 1.0);
      g = mix(g, ${glslVec3(lin(C.glassEdge))}, pale);
      col = g;
      bEmis = mix(${glslVec3(rgb(LOOK.glassEmissiveLow))}, ${glslVec3(rgb(LOOK.glassEmissiveHigh))}, grad) * (0.6 + 0.7 * n2) * (1.0 + 1.6 * pale) * ${f(LOOK.glassGlow)};
      bEmis += ${glslVec3(rgb(LOOK.glassStreak))} * refl * (1.0 - 0.5 * pale);
      bRough = 0.32;
    } else {
      col = mix(${glslVec3(lin(C.glassHigh))}, vec3(0.8), 0.8);
      float parapet = smoothstep(0.05, 0.08, edgeD) * (1.0 - smoothstep(0.11, 0.14, edgeD));
      col *= 1.0 - 0.2 * parapet;
    }
  } else if (vKind < 2.5) {
    // pad (sidewalk slab)
    // a fresh pad is as white as the tiles, then weathers to pavement grey
    col = mix(${glslVec3(lin(C.tile))}, col, smoothstep(0.8, 2.6, vAge));
    float kerb = 1.0 - smoothstep(0.03, 0.07, edgeD);
    col *= 1.0 - 0.1 * kerb * float(top);
  } else if (vKind > 4.5) {
    // park: pale green with a dotted pattern
    vec2 q = vLocal.xz * vDim.xz / 0.3;
    vec2 cq = fract(q) - 0.5;
    float fwq = fwidth(q.x);
    float dotm = (1.0 - smoothstep(0.22 - fwq, 0.22 + fwq, length(cq))) * (1.0 - smoothstep(0.2, 0.5, fwq));
    float kerb = 1.0 - smoothstep(0.06, 0.1, edgeD);
    col = mix(col * (1.0 - 0.16 * dotm), ${glslVec3(lin(C.pad))}, kerb);
  }
  // contact shading: walls get darker towards the ground (cheap ambient occlusion)
  if (!top && (vKind < 1.5 || (vKind > 3.5 && vKind < 4.5))) {
    float ao = mix(1.0 - ${f(LOOK.contactShade)}, 1.0, smoothstep(0.0, 1.1, vH));
    col *= ao;
    bEmis *= mix(ao, 1.0, 0.5);
  }
  diffuseColor.rgb = col;
}`,
      )
      .replace(
        "#include <roughnessmap_fragment>",
        `#include <roughnessmap_fragment>
roughnessFactor = bRough;`,
      )
      .replace(
        "#include <emissivemap_fragment>",
        `#include <emissivemap_fragment>
totalEmissiveRadiance += bEmis;`,
      );
  };
  mat.customProgramCacheKey = () => "city-building";

  const depth = new THREE.MeshDepthMaterial();
  depth.onBeforeCompile = (shader) => {
    shader.uniforms.uTime = uTime;
    shader.vertexShader = shader.vertexShader
      .replace("#include <common>", `#include <common>\n${GROW_PARS}`)
      .replace("#include <begin_vertex>", `#include <begin_vertex>\n${GROW_VERTEX}`);
  };
  depth.customProgramCacheKey = () => "city-building-depth";
  return { mat, depth };
};

const makeGhostMaterial = (uTime: { value: number }) =>
  new THREE.ShaderMaterial({
    transparent: true,
    depthWrite: false,
    side: THREE.DoubleSide,
    uniforms: { uTime },
    vertexShader: /* glsl */ `
attribute float aBirth;
attribute float aTotal;
attribute vec3 aDim;
attribute float aSeed;
uniform float uTime;
varying vec3 vLocal;
varying vec3 vDim;
varying vec3 vObjN;
varying float vPhase;
varying float vY;
varying float vTotal;
varying float vSeed;
void main() {
  vLocal = position; vDim = aDim; vObjN = normal; vTotal = aTotal; vSeed = aSeed;
  vec3 p = position;
  p.xz *= 1.03;
  vec4 wp = modelMatrix * instanceMatrix * vec4(p, 1.0);
  vY = wp.y;
  vPhase = (uTime - (aBirth - ${f(CONFIG.ghostLead)})) / ${f(CONFIG.ghostLead + CONFIG.riseTime * 0.9)};
  gl_Position = projectionMatrix * viewMatrix * wp;
  if (vPhase <= 0.0 || vPhase >= 1.0) gl_Position = vec4(2.0, 2.0, 2.0, 1.0);
}`,
    fragmentShader: /* glsl */ `
varying vec3 vLocal;
varying vec3 vDim;
varying vec3 vObjN;
varying float vPhase;
varying float vY;
varying float vTotal;
varying float vSeed;
${LINE_FN}
void main() {
  vec3 an = abs(vObjN);
  if (an.y > 0.5) discard;
  // the construction lines shoot up first, then fade as the solid arrives
  float wipe = clamp(vPhase / 0.4, 0.0, 1.0);
  float topY = vTotal * (1.0 - pow(1.0 - wipe, 2.0));
  if (vY > topY) discard;
  float hW = vLocal.y * vDim.y;
  float uW = an.x > 0.5 ? vLocal.z * vDim.z : vLocal.x * vDim.x;
  float vert = gridLine(uW / 0.06 + vSeed, 0.6);
  float dash = 0.3 + 0.7 * step(0.45, fract(vY * 9.0 + vSeed * 7.0));
  float horiz = gridLine(hW / ${f(CONFIG.floorHeight * 2.0)}, 0.14);
  float a = max(vert * dash, horiz * 0.7);
  float tip = 1.0;
  float fade = 1.0 - smoothstep(0.5, 1.0, vPhase);
  gl_FragColor = vec4(${glslVec3(rgb(LOOK.ghostColor))}, a * tip * fade);
}`,
  });

// -------------------------------------------------------------------- land
const makeLandMaterial = (uTileFront: { value: number }, uBuildFront: { value: number }) => {
  const mat = new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.95, metalness: 0 });
  mat.onBeforeCompile = (shader) => {
    shader.uniforms.uTileFront = uTileFront;
    shader.uniforms.uBuildFront = uBuildFront;
    shader.vertexShader = shader.vertexShader
      .replace("#include <common>", "#include <common>\nvarying vec3 vWPos;")
      .replace("#include <begin_vertex>", "#include <begin_vertex>\nvWPos = (modelMatrix * vec4(transformed, 1.0)).xyz;");
    shader.fragmentShader = shader.fragmentShader
      .replace(
        "#include <common>",
        `#include <common>
uniform float uTileFront;
uniform float uBuildFront;
varying vec3 vWPos;
const vec2 SUN_XZ = vec2(${f(Math.cos((LOOK.sunAzimuth * Math.PI) / 180))}, ${f(Math.sin((LOOK.sunAzimuth * Math.PI) / 180))});
vec2 hash2(vec2 p) {
  p = vec2(dot(p, vec2(127.1, 311.7)), dot(p, vec2(269.5, 183.3)));
  return fract(sin(p) * 43758.5453);
}
float vnoise(vec2 p) {
  vec2 i = floor(p); vec2 fr = fract(p);
  vec2 u = fr * fr * (3.0 - 2.0 * fr);
  float a = hash2(i).x, b = hash2(i + vec2(1.0, 0.0)).x, c = hash2(i + vec2(0.0, 1.0)).x, d = hash2(i + vec2(1.0, 1.0)).x;
  return mix(mix(a, b, u.x), mix(c, d, u.x), u.y);
}`,
      )
      .replace(
        "#include <color_fragment>",
        `#include <color_fragment>
{
  vec3 land = ${glslVec3(lin(C.land))};
  vec3 col = land;
  if (vWPos.y > -0.02) {
    // Voronoi "pebble" tiles: each cell switches on when the front reaches
    // its centre, grows from a pebble into a tile and finally closes up.
    vec2 p = vWPos.xz / ${f(LOOK.tileSize)};
    vec2 ip = floor(p); vec2 fp = fract(p);
    float f1 = 9.0, f2 = 9.0; vec2 cid = vec2(0.0); vec2 rNear = vec2(0.0);
    for (int j = -1; j <= 1; j++) for (int i = -1; i <= 1; i++) {
      vec2 g = vec2(float(i), float(j));
      vec2 o = hash2(ip + g);
      vec2 r = g + o - fp;
      float d = dot(r, r);
      if (d < f1) { f2 = f1; f1 = d; cid = ip + g + o; rNear = r; } else if (d < f2) { f2 = d; }
    }
    float edge = sqrt(f2) - sqrt(f1);          // 0 on cell borders
    vec2 cw = cid * ${f(LOOK.tileSize)};         // cell centre, world units
    float arrive = length(cw) + ${f(LOOK.tilePatch)} * (vnoise(cw * 0.085) - 0.5) + 2.2 * (hash2(cid).x - 0.5);
    float rev = clamp((uTileFront - arrive) / ${f(LOOK.tileBand)}, 0.0, 1.0);
    float thresh = mix(0.42, ${f(LOOK.tileJoint)}, pow(rev, 0.55));
    float fw = fwidth(edge) + 0.002;
    float m = smoothstep(thresh, thresh + fw * 1.5, edge) * step(0.001, rev);
    // thin grey outline on young tiles
    float outline = (1.0 - smoothstep(0.0, fw * 2.0 + 0.025, abs(edge - thresh))) * step(0.001, rev) * (1.0 - 0.6 * rev);
    float mature = smoothstep(4.0, 13.0, uBuildFront - length(cw));
    vec3 tile = mix(${glslVec3(lin(C.tile))}, ${glslVec3(lin(C.tileMature))}, mature) * (0.97 + 0.06 * hash2(cid + 3.1).y);
    col = mix(land, tile, m);
    col = mix(col, ${glslVec3(lin(C.tileEdge))}, outline * 0.5);
    // tiles are slightly raised: a highlight on the edge facing the sun, a small shadow behind
    float side = dot(normalize(rNear + vec2(1e-5)), SUN_XZ);
    float rimIn = m * (1.0 - smoothstep(0.0, 0.1, edge - thresh));
    float rimOut = (1.0 - m) * (1.0 - smoothstep(0.0, 0.07, thresh - edge)) * step(0.001, rev);
    col *= 1.0 + ${f(LOOK.tileBevel)} * (-side) * rimIn - ${f(LOOK.tileBevel * 1.6)} * max(side, 0.0) * rimOut;
  } else {
    col = land * 0.55;
  }
  diffuseColor.rgb = col;
}`,
      );
  };
  mat.customProgramCacheKey = () => "city-land";
  return mat;
};

const discardAfter = (mat: THREE.Material, attr: string, uniform: string, u: { value: number }, key: string) => {
  mat.onBeforeCompile = (shader) => {
    shader.uniforms[uniform] = u;
    shader.vertexShader = shader.vertexShader
      .replace("#include <common>", `#include <common>\nattribute float ${attr};\nvarying float vReveal;`)
      .replace("#include <begin_vertex>", `#include <begin_vertex>\nvReveal = ${attr};`);
    shader.fragmentShader = shader.fragmentShader
      .replace("#include <common>", `#include <common>\nuniform float ${uniform};\nvarying float vReveal;`)
      .replace(
        "#include <clipping_planes_fragment>",
        `#include <clipping_planes_fragment>\nif (vReveal > ${uniform}) discard;`,
      );
  };
  mat.customProgramCacheKey = () => key;
  return mat;
};

// ------------------------------------------------------------------ camera
const smoothKeys = (keys: ReadonlyArray<CameraKey>, t: number, pick: (k: CameraKey) => number) => {
  // monotone cubic Hermite through the keys (no overshoot, flat at both ends)
  const n = keys.length;
  if (t <= keys[0].t) return pick(keys[0]);
  if (t >= keys[n - 1].t) return pick(keys[n - 1]);
  let i = 0;
  while (i < n - 2 && t > keys[i + 1].t) i++;
  const slope = (a: number) => (pick(keys[a + 1]) - pick(keys[a])) / (keys[a + 1].t - keys[a].t);
  const tangent = (a: number) => {
    if (a === 0 || a === n - 1) return 0;
    const s0 = slope(a - 1);
    const s1 = slope(a);
    if (s0 * s1 <= 0) return 0;
    const h0 = keys[a].t - keys[a - 1].t;
    const h1 = keys[a + 1].t - keys[a].t;
    return (3 * (h0 + h1)) / ((2 * h1 + h0) / s0 + (h1 + 2 * h0) / s1);
  };
  const h = keys[i + 1].t - keys[i].t;
  const u = (t - keys[i].t) / h;
  const p0 = pick(keys[i]);
  const p1 = pick(keys[i + 1]);
  const m0 = tangent(i) * h;
  const m1 = tangent(i + 1) * h;
  const u2 = u * u;
  const u3 = u2 * u;
  return (2 * u3 - 3 * u2 + 1) * p0 + (u3 - 2 * u2 + u) * m0 + (-2 * u3 + 3 * u2) * p1 + (u3 - u2) * m1;
};

// ------------------------------------------------------------------- scene
export type City = {
  scene: THREE.Scene;
  camera: THREE.PerspectiveCamera;
  prepare: (gl: THREE.WebGLRenderer) => void;
  update: (t: number, variant: "v1" | "v2", aspect: number) => void;
};

export const createCity = (): City => {
  const scene = new THREE.Scene();
  const uTime = { value: 0 };
  const uRoadFront = { value: 0 };
  const uTileFront = { value: 0 };
  const uBuildFront = { value: 0 };

  scene.fog = new THREE.FogExp2(rgb(LOOK.fogColor), LOOK.fogDensity);

  // ---- sky dome (only ever seen near the horizon) and water
  const sky = new THREE.Mesh(
    new THREE.SphereGeometry(2500, 32, 16),
    new THREE.ShaderMaterial({
      side: THREE.BackSide,
      depthWrite: false,
      fog: false,
      uniforms: {},
      vertexShader: `varying vec3 vDir; void main(){ vDir = normalize(position); gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }`,
      fragmentShader: `varying vec3 vDir; void main(){ float h = clamp(vDir.y, 0.0, 1.0); vec3 c = mix(${glslVec3(rgb(LOOK.envHorizon))}, ${glslVec3(rgb(LOOK.envZenith))}, pow(h, 0.55)); gl_FragColor = vec4(c * ${f(LOOK.skyBrightness)}, 1.0); }`,
    }),
  );
  sky.renderOrder = -10;
  sky.frustumCulled = false;
  scene.add(sky);

  const water = new THREE.Mesh(
    new THREE.PlaneGeometry(6000, 6000).rotateX(-Math.PI / 2),
    new THREE.ShaderMaterial({
      fog: false,
      uniforms: {},
      vertexShader: `varying vec3 vW; void main(){ vec4 w = modelMatrix * vec4(position, 1.0); vW = w.xyz; gl_Position = projectionMatrix * viewMatrix * w; }`,
      fragmentShader: `varying vec3 vW; void main(){
        float d = length(vW.xz);
        vec3 c = mix(${glslVec3(rgb(LOOK.waterColor))}, ${glslVec3(rgb(LOOK.waterFarColor))}, smoothstep(30.0, 120.0, d));
        float haze = 1.0 - exp(-pow(distance(cameraPosition, vW) * ${f(LOOK.waterHaze)}, 2.0));
        c = mix(c, ${glslVec3(rgb(LOOK.envHorizon))} * ${f(LOOK.skyBrightness)}, haze);
        gl_FragColor = vec4(c, 1.0); }`,
    }),
  );
  water.position.y = -0.5;
  scene.add(water);

  // ---- land
  const shape = new THREE.Shape();
  coast.forEach(([x, z], i) => (i === 0 ? shape.moveTo(x, z) : shape.lineTo(x, z)));
  shape.closePath();
  const landGeo = new THREE.ExtrudeGeometry(shape, { depth: 0.5, bevelEnabled: false, curveSegments: 1 });
  landGeo.rotateX(Math.PI / 2); // shape (x, y) -> world (x, z); extruded downwards
  const land = new THREE.Mesh(landGeo, makeLandMaterial(uTileFront, uBuildFront));
  land.receiveShadow = true;
  scene.add(land);

  // ---- streets
  {
    const n = roads.length;
    const pos = new Float32Array(n * 18);
    const nor = new Float32Array(n * 18);
    const aD = new Float32Array(n * 6);
    roads.forEach((r, k) => {
      let dx = r.bx - r.ax;
      let dz = r.bz - r.az;
      const len = Math.hypot(dx, dz);
      dx /= len;
      dz /= len;
      const hx = (-dz * r.w) / 2;
      const hz = (dx * r.w) / 2;
      const e = r.w * 0.5; // extend into the junction
      const ax = r.ax - dx * e;
      const az = r.az - dz * e;
      const bx = r.bx + dx * e;
      const bz = r.bz + dz * e;
      const y = 0.03;
      const v = [
        [ax + hx, az + hz, r.da - e],
        [ax - hx, az - hz, r.da - e],
        [bx + hx, bz + hz, r.db + (r.db >= r.da ? e : -e)],
        [bx - hx, bz - hz, r.db + (r.db >= r.da ? e : -e)],
      ];
      // a road drawn "backwards" (b reached first) still wipes along its length
      if (r.db < r.da) {
        v[0][2] = r.da + e;
        v[1][2] = r.da + e;
      }
      const order = [0, 2, 1, 1, 2, 3];
      order.forEach((vi, q) => {
        pos.set([v[vi][0], y, v[vi][1]], k * 18 + q * 3);
        nor.set([0, 1, 0], k * 18 + q * 3);
        aD[k * 6 + q] = v[vi][2];
      });
    });
    const geo = new THREE.BufferGeometry();
    geo.setAttribute("position", new THREE.BufferAttribute(pos, 3));
    geo.setAttribute("normal", new THREE.BufferAttribute(nor, 3));
    geo.setAttribute("aD", new THREE.BufferAttribute(aD, 1));
    // a street is pale when it is drawn and darkens once the front has moved on
    const mat = new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.9, side: THREE.DoubleSide });
    mat.onBeforeCompile = (shader) => {
      shader.uniforms.uRoadFront = uRoadFront;
      shader.vertexShader = shader.vertexShader
        .replace("#include <common>", "#include <common>\nattribute float aD;\nvarying float vReveal;")
        .replace("#include <begin_vertex>", "#include <begin_vertex>\nvReveal = aD;");
      shader.fragmentShader = shader.fragmentShader
        .replace("#include <common>", "#include <common>\nuniform float uRoadFront;\nvarying float vReveal;")
        .replace("#include <clipping_planes_fragment>", "#include <clipping_planes_fragment>\nif (vReveal > uRoadFront) discard;")
        .replace(
          "#include <color_fragment>",
          `#include <color_fragment>
diffuseColor.rgb = mix(${glslVec3(lin(C.roadNew))}, ${glslVec3(lin(C.roadOld))}, smoothstep(${f(CONFIG.roadAgeStart)}, ${f(CONFIG.roadAgeEnd)}, uRoadFront - vReveal));`,
        );
    };
    mat.customProgramCacheKey = () => "city-road";
    const mesh = new THREE.Mesh(geo, mat);
    mesh.receiveShadow = true;
    mesh.frustumCulled = false;
    scene.add(mesh);
  }

  // ---- elevated roads
  {
    const pos: number[] = [];
    const col: number[] = [];
    const aT: number[] = [];
    const top = lin(C.deck);
    const side = lin(C.deckSide);
    const w = CONFIG.deckWidth / 2;
    const th = 0.22; // deck thickness
    const bh = 0.13; // barrier height
    const bw = 0.09;
    // cross-section, counter-clockwise, as (offset across, offset up, isTop)
    const prof: Array<[number, number, number]> = [
      [-w, -th, 0],
      [w, -th, 0],
      [w, bh, 0],
      [w - bw, bh, 0],
      [w - bw, 0, 1],
      [-w + bw, 0, 1],
      [-w + bw, bh, 0],
      [-w, bh, 0],
    ];
    for (const h of highways) {
      const P = h.points;
      const frame = (i: number) => {
        const a = P[Math.max(0, i - 1)];
        const b = P[Math.min(P.length - 1, i + 1)];
        let dx = b.x - a.x;
        let dz = b.z - a.z;
        const l = Math.hypot(dx, dz);
        dx /= l;
        dz /= l;
        return { nx: -dz, nz: dx };
      };
      for (let i = 0; i < P.length - 1; i++) {
        const f0 = frame(i);
        const f1 = frame(i + 1);
        const t0 = h.start + P[i].s / h.speed;
        const t1 = h.start + P[i + 1].s / h.speed;
        for (let k = 0; k < prof.length; k++) {
          const a = prof[k];
          const b = prof[(k + 1) % prof.length];
          const v = (p: (typeof P)[number], fr: { nx: number; nz: number }, q: [number, number, number]) => [
            p.x + fr.nx * q[0],
            p.y + q[1],
            p.z + fr.nz * q[0],
          ];
          const A0 = v(P[i], f0, a);
          const B0 = v(P[i], f0, b);
          const A1 = v(P[i + 1], f1, a);
          const B1 = v(P[i + 1], f1, b);
          const c = a[2] === 1 && b[2] === 1 ? top : side;
          for (const [q, tt] of [
            [A0, t0],
            [A1, t1],
            [B0, t0],
            [B0, t0],
            [A1, t1],
            [B1, t1],
          ] as Array<[number[], number]>) {
            pos.push(q[0], q[1], q[2]);
            col.push(c.r, c.g, c.b);
            aT.push(tt);
          }
        }
      }
    }
    const geo = new THREE.BufferGeometry();
    geo.setAttribute("position", new THREE.Float32BufferAttribute(pos, 3));
    geo.setAttribute("color", new THREE.Float32BufferAttribute(col, 3));
    geo.setAttribute("aT", new THREE.Float32BufferAttribute(aT, 1));
    geo.computeVertexNormals();
    const mat = discardAfter(
      new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.85, side: THREE.DoubleSide }),
      "aT",
      "uTime",
      uTime,
      "city-deck",
    );
    const mesh = new THREE.Mesh(geo, mat);
    mesh.castShadow = true;
    mesh.receiveShadow = true;
    mesh.frustumCulled = false;
    mesh.customDepthMaterial = discardAfter(new THREE.MeshDepthMaterial({ side: THREE.DoubleSide }), "aT", "uTime", uTime, "city-deck-depth");
    scene.add(mesh);
  }

  // ---- buildings, pads, roof details, pillars: one instanced mesh
  {
    const unit = new THREE.BoxGeometry(1, 1, 1).translate(0, 0.5, 0);
    const build = (list: typeof boxes, withLook: boolean) => {
      const geo = unit.clone();
      const n = list.length;
      const aBirth = new Float32Array(n);
      const aYB = new Float32Array(n);
      const aKind = new Float32Array(n);
      const aSeed = new Float32Array(n);
      const aTotal = new Float32Array(n);
      const aDim = new Float32Array(n * 3);
      const aColor = new Float32Array(n * 3);
      const matrices = new Float32Array(n * 16);
      const m = new THREE.Matrix4();
      const q = new THREE.Quaternion();
      const up = new THREE.Vector3(0, 1, 0);
      const palette = [...C.wallsLow, ...C.wallsTower].map(lin);
      list.forEach((b, i) => {
        q.setFromAxisAngle(up, b.rot);
        m.compose(new THREE.Vector3(b.x, b.y0, b.z), q, new THREE.Vector3(b.sx, b.sy, b.sz));
        m.toArray(matrices, i * 16);
        aBirth[i] = b.birth;
        aYB[i] = b.y0 / b.sy;
        aKind[i] = b.kind;
        aSeed[i] = b.seed;
        aTotal[i] = b.total;
        aDim.set([b.sx, b.sy, b.sz], i * 3);
        let c = palette[b.color];
        if (b.kind === KIND.pad) c = lin(C.pad);
        if (b.kind === KIND.park) c = lin(C.park);
        if (b.kind === KIND.pillar) c = lin(C.deckSide);
        if (b.kind === KIND.detail) c = lin(C.roof);
        aColor.set([c.r, c.g, c.b], i * 3);
      });
      geo.setAttribute("aBirth", new THREE.InstancedBufferAttribute(aBirth, 1));
      geo.setAttribute("aDim", new THREE.InstancedBufferAttribute(aDim, 3));
      geo.setAttribute("aSeed", new THREE.InstancedBufferAttribute(aSeed, 1));
      if (withLook) {
        geo.setAttribute("aYB", new THREE.InstancedBufferAttribute(aYB, 1));
        geo.setAttribute("aKind", new THREE.InstancedBufferAttribute(aKind, 1));
        geo.setAttribute("aColor", new THREE.InstancedBufferAttribute(aColor, 3));
      } else {
        geo.setAttribute("aTotal", new THREE.InstancedBufferAttribute(aTotal, 1));
      }
      return { geo, matrices, n };
    };

    const solid = build(boxes, true);
    const { mat, depth } = makeBuildingMaterials(uTime);
    const mesh = new THREE.InstancedMesh(solid.geo, mat, solid.n);
    mesh.instanceMatrix.array.set(solid.matrices);
    mesh.instanceMatrix.needsUpdate = true;
    mesh.castShadow = true;
    mesh.receiveShadow = true;
    mesh.frustumCulled = false;
    mesh.customDepthMaterial = depth;
    scene.add(mesh);

    const ghosts = build(
      boxes.filter((b) => b.ghost),
      false,
    );
    const gmesh = new THREE.InstancedMesh(ghosts.geo, makeGhostMaterial(uTime), ghosts.n);
    gmesh.instanceMatrix.array.set(ghosts.matrices);
    gmesh.instanceMatrix.needsUpdate = true;
    gmesh.frustumCulled = false;
    gmesh.renderOrder = 5;
    scene.add(gmesh);
  }

  // ---- light: a warm sun with soft shadows + a blue sky fill
  const sun = new THREE.DirectionalLight(lin(LOOK.sunColor), LOOK.sunIntensity);
  {
    const az = (LOOK.sunAzimuth * Math.PI) / 180;
    const el = (LOOK.sunElevation * Math.PI) / 180;
    sun.position.set(Math.cos(az) * Math.cos(el), Math.sin(el), Math.sin(az) * Math.cos(el)).multiplyScalar(220);
    sun.target.position.set(0, 0, 0);
    sun.castShadow = true;
    sun.shadow.mapSize.set(LOOK.shadowMapSize, LOOK.shadowMapSize);
    const cam = sun.shadow.camera;
    cam.left = -52;
    cam.right = 52;
    cam.top = 52;
    cam.bottom = -52;
    cam.near = 60;
    cam.far = 400;
    cam.updateProjectionMatrix();
    sun.shadow.bias = LOOK.shadowBias;
    sun.shadow.normalBias = LOOK.shadowNormalBias;
    sun.shadow.radius = LOOK.shadowRadius;
    sun.shadow.intensity = LOOK.shadowStrength;
    scene.add(sun, sun.target);
  }
  scene.add(new THREE.HemisphereLight(lin(LOOK.skyColor), lin(LOOK.groundColor), LOOK.hemiIntensity));

  const camera = new THREE.PerspectiveCamera(CAMERA_FOV, 16 / 9, 0.4, 6000);

  let envReady = false;
  const prepare = (gl: THREE.WebGLRenderer) => {
    if (envReady) return;
    envReady = true;
    // procedural gradient sky -> PMREM environment for soft reflections
    const envScene = new THREE.Scene();
    envScene.add(
      new THREE.Mesh(
        new THREE.SphereGeometry(10, 32, 16),
        new THREE.ShaderMaterial({
          side: THREE.BackSide,
          vertexShader: `varying vec3 vDir; void main(){ vDir = normalize(position); gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }`,
          fragmentShader: `varying vec3 vDir; void main(){ float h = vDir.y; vec3 c = h > 0.0 ? mix(${glslVec3(rgb(LOOK.envHorizon))}, ${glslVec3(rgb(LOOK.envZenith))}, pow(h, 0.6)) : mix(${glslVec3(rgb(LOOK.envHorizon))}, ${glslVec3(lin(LOOK.groundColor))}, pow(-h, 0.5)); gl_FragColor = vec4(c, 1.0); }`,
        }),
      ),
    );
    const pmrem = new THREE.PMREMGenerator(gl);
    scene.environment = pmrem.fromScene(envScene, 0, 0.1, 100).texture;
    scene.environmentIntensity = LOOK.envIntensity;
    pmrem.dispose();
  };

  const update = (t: number, variant: "v1" | "v2", aspect: number) => {
    uTime.value = t;
    uRoadFront.value = valueAt(CONFIG.roadFront, t);
    uTileFront.value = valueAt(CONFIG.tileFront, t);
    uBuildFront.value = valueAt(CONFIG.buildFront, t);
    const keys = CAMERAS[variant];
    const az = (smoothKeys(keys, t, (k) => k.az) * Math.PI) / 180;
    const el = (smoothKeys(keys, t, (k) => k.el) * Math.PI) / 180;
    const dist = smoothKeys(keys, t, (k) => k.dist);
    const tx = smoothKeys(keys, t, (k) => k.tx);
    const ty = smoothKeys(keys, t, (k) => k.ty);
    const tz = smoothKeys(keys, t, (k) => k.tz);
    camera.position.set(
      tx + Math.cos(az) * Math.cos(el) * dist,
      ty + Math.sin(el) * dist,
      tz + Math.sin(az) * Math.cos(el) * dist,
    );
    camera.up.set(0, 1, 0);
    camera.lookAt(tx, ty, tz);
    if (camera.aspect !== aspect) {
      camera.aspect = aspect;
      camera.updateProjectionMatrix();
    }
    camera.updateMatrixWorld(true);
  };

  return { scene, camera, prepare, update };
};
