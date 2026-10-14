import {
  AdditiveBlending,
  BufferAttribute,
  BufferGeometry,
  CatmullRomCurve3,
  CircleGeometry,
  Color,
  CylinderGeometry,
  DirectionalLight,
  DoubleSide,
  Mesh,
  MeshPhysicalMaterial,
  MeshStandardMaterial,
  PerspectiveCamera,
  PlaneGeometry,
  Points,
  Scene,
  ShaderMaterial,
  TorusGeometry,
  Vector3,
  WebGLRenderer,
} from "three";
import { lin, linColor } from "../lib/color";
import { PostPipeline } from "../lib/post";
import { mulberry32, TAU } from "../lib/random";
import { envDome, envFromScene, panel } from "../lib/three-helpers";
import type { Look } from "../lib/ThreeLook";

export interface GoldPodiumParams {
  stage: string;
  stageDeep: string;
  metal: string;
  ray: string;
}

const LOOP = 600;

/* ------------------------------------------------------------------ */
/* Ribbons: swept strips along splines whose control points move in    */
/* whole cycles of the loop.                                           */
/* ------------------------------------------------------------------ */

interface RibbonDef {
  pts: [number, number, number][];
  /** per-point motion amplitude */
  amp: number;
  width: number;
  twist: number; // radians of roll variation along the ribbon
  roll: number; // base roll
  phase: number;
  hlSpeed: number; // highlight passes per loop (integer)
}

const RIBBONS: RibbonDef[] = [
  // two big swoops: in high from the left, dip to the podium's upper left, cross behind its top, rise off right
  {
    pts: [[-7.5, 3.6, -1.6], [-4.6, 3.0, -1.5], [-2.9, 1.85, -1.3], [-1.8, 0.9, -1.2], [-0.2, 0.86, -1.6], [2.0, 1.3, -1.9], [4.6, 1.45, -1.8], [7.5, 1.7, -1.7]],
    amp: 0.1, width: 0.17, twist: 0.35, roll: 0.1, phase: 0, hlSpeed: 1,
  },
  {
    pts: [[-7.5, 1.6, -0.8], [-4.7, 1.3, -0.8], [-3.0, 0.9, -0.7], [-2.0, 0.62, -0.6], [0.4, 1.05, -1.2], [2.6, 1.6, -1.5], [4.7, 1.2, -1.4], [7.5, 1.55, -1.5]],
    amp: 0.09, width: 0.15, twist: 0.4, roll: -0.1, phase: 2.1, hlSpeed: 1,
  },
  // front band, low, rising gently to the right in front of the podium
  {
    pts: [[-6.0, -0.2, 2.3], [-2.2, 0.12, 2.2], [0, 0.26, 2.15], [2.2, 0.42, 2.1], [5.0, 0.7, 1.6], [7.5, 0.9, 1.0]],
    amp: 0.06, width: 0.1, twist: 0.3, roll: 0.15, phase: 4.0, hlSpeed: 1,
  },
  // rising on the left
  {
    pts: [[8.5, 1.9, -2.6], [5.0, 1.15, -2.6], [2.5, 0.75, -2.4], [0.6, 0.62, -2.2], [-1.2, 0.8, -1.8], [-2.6, 1.55, -1.2], [-3.6, 2.3, -0.6], [-4.4, 2.6, -0.2], [-6.5, 2.9, 0.2]],
    amp: 0.1, width: 0.2, twist: 0.3, roll: -0.15, phase: 1.3, hlSpeed: 1,
  },
];

const SAMPLES = 360;
const ACROSS = 6;

const ribbonGeometry = () => {
  const g = new BufferGeometry();
  const n = (SAMPLES + 1) * (ACROSS + 1);
  g.setAttribute("position", new BufferAttribute(new Float32Array(n * 3), 3));
  g.setAttribute("normal", new BufferAttribute(new Float32Array(n * 3), 3));
  const uv = new Float32Array(n * 2);
  for (let i = 0; i <= SAMPLES; i++)
    for (let j = 0; j <= ACROSS; j++) {
      const k = i * (ACROSS + 1) + j;
      uv[k * 2] = i / SAMPLES;
      uv[k * 2 + 1] = j / ACROSS;
    }
  g.setAttribute("uv", new BufferAttribute(uv, 2));
  const idx: number[] = [];
  for (let i = 0; i < SAMPLES; i++)
    for (let j = 0; j < ACROSS; j++) {
      const a = i * (ACROSS + 1) + j;
      const b = a + ACROSS + 1;
      idx.push(a, b, a + 1, a + 1, b, b + 1);
    }
  g.setIndex(idx);
  return g;
};

const up = new Vector3(0, 1, 0);
const tv = new Vector3();
const wv = new Vector3();
const nv = new Vector3();
const pv = new Vector3();

const updateRibbon = (g: BufferGeometry, def: RibbonDef, t: number) => {
  const pts = def.pts.map(
    ([x, y, z], i) =>
      new Vector3(
        x + def.amp * 0.6 * Math.sin(TAU * t + def.phase + i * 1.3),
        y + def.amp * Math.sin(TAU * t + def.phase + i * 0.9),
        z + def.amp * 0.5 * Math.cos(TAU * t + def.phase + i * 1.7),
      ),
  );
  const curve = new CatmullRomCurve3(pts, false, "centripetal");
  const pos = g.getAttribute("position") as BufferAttribute;
  const nor = g.getAttribute("normal") as BufferAttribute;
  for (let i = 0; i <= SAMPLES; i++) {
    const s = i / SAMPLES;
    curve.getPointAt(s, pv);
    curve.getTangentAt(s, tv);
    // width direction: "up" rolled about the tangent; roll flows along s
    const roll = def.roll + def.twist * Math.sin(TAU * (s * 1.5 - t) + def.phase);
    wv.copy(up).addScaledVector(tv, -up.dot(tv)).normalize();
    nv.crossVectors(tv, wv).normalize();
    // rotate w about t by roll
    const c = Math.cos(roll);
    const sn = Math.sin(roll);
    const w2 = wv.clone().multiplyScalar(c).addScaledVector(nv, sn);
    const n2 = nv.clone().multiplyScalar(c).addScaledVector(wv, -sn);
    // taper the very ends so they never show a cut edge on screen
    const taper = Math.min(1, s / 0.04, (1 - s) / 0.04);
    for (let j = 0; j <= ACROSS; j++) {
      const a = j / ACROSS - 0.5;
      const k = i * (ACROSS + 1) + j;
      // slight cross curvature
      const bend = 0;
      pos.setXYZ(
        k,
        pv.x + w2.x * a * def.width * taper + n2.x * bend,
        pv.y + w2.y * a * def.width * taper + n2.y * bend,
        pv.z + w2.z * a * def.width * taper + n2.z * bend,
      );
      // normal including cross-curvature tilt
      const tilt = 0;
      nor.setXYZ(k, n2.x + w2.x * tilt, n2.y + w2.y * tilt, n2.z + w2.z * tilt);
    }
  }
  pos.needsUpdate = true;
  nor.needsUpdate = true;
  g.computeBoundingSphere();
};

const ribbonMaterial = (metal: string) => {
  const m = new MeshPhysicalMaterial({
    color: new Color(...lin(metal)),
    metalness: 1,
    roughness: 0.26,
    side: DoubleSide,
    envMapIntensity: 1.1,
    fog: false,
  });
  const uniforms = { uHl: { value: 0 } };
  m.onBeforeCompile = (shader) => {
    shader.uniforms.uHl = uniforms.uHl;
    shader.fragmentShader = shader.fragmentShader
      .replace("#include <common>", "#include <common>\nuniform float uHl;\nvarying vec2 vUv;")
      .replace(
        "#include <color_fragment>",
        "#include <color_fragment>\nif (!gl_FrontFacing) diffuseColor.rgb *= vec3(0.62, 0.52, 0.42);",
      )
      .replace(
        "#include <emissivemap_fragment>",
        `#include <emissivemap_fragment>
        float dh = abs(fract(vUv.x - uHl + 0.5) - 0.5);
        totalEmissiveRadiance += vec3(1.0, 0.92, 0.75) * (3.0 * exp(-dh * dh / 0.0003) + 0.25 * exp(-dh * dh / 0.004)) * (0.6 + 0.4 * (1.0 - abs(vUv.y - 0.5) * 2.0));`,
      );
    shader.vertexShader = shader.vertexShader
      .replace("#include <common>", "#include <common>\nvarying vec2 vUv;")
      .replace("#include <begin_vertex>", "#include <begin_vertex>\nvUv = uv;");
  };
  // make sure vUv is not double-declared by three's uv chunk
  m.defines = { ...(m.defines ?? {}) };
  return { m, uniforms };
};

/* ------------------------------------------------------------------ */
/* Backdrop, rays, sparkles                                            */
/* ------------------------------------------------------------------ */

/** Cyclorama profile: floor (z 14 → −4), quarter arc r=3, wall to y=17 at z=−7. */
const cycGeometry = () => {
  const prof: [number, number, number][] = []; // y, z, s
  let sAcc = 0;
  const push = (y: number, z: number) => {
    if (prof.length) {
      const [py, pz] = prof[prof.length - 1];
      sAcc += Math.hypot(y - py, z - pz);
    }
    prof.push([y, z, sAcc]);
  };
  for (let i = 0; i <= 18; i++) push(0, 14 - i);
  for (let i = 1; i <= 24; i++) {
    const a = (i / 24) * (Math.PI / 2);
    push(3 - 3 * Math.cos(a), -4 - 3 * Math.sin(a));
  }
  for (let i = 1; i <= 28; i++) push(3 + (i / 28) * 14, -7);
  const sJoin = 18 + (3 * Math.PI) / 2;
  const NX = 2;
  const pos: number[] = [];
  const uv: number[] = [];
  const idx: number[] = [];
  prof.forEach(([y, z, sv]) => {
    for (let j = 0; j <= NX; j++) {
      const x = -25 + (50 * j) / NX;
      pos.push(x, y, z);
      uv.push((x + 17) / 34, (sv - sJoin) / 13);
    }
  });
  for (let i = 0; i < prof.length - 1; i++)
    for (let j = 0; j < NX; j++) {
      const a = i * (NX + 1) + j;
      const b = a + NX + 1;
      idx.push(a, a + 1, b, a + 1, b + 1, b);
    }
  const g = new BufferGeometry();
  g.setAttribute("position", new BufferAttribute(new Float32Array(pos), 3));
  g.setAttribute("uv", new BufferAttribute(new Float32Array(uv), 2));
  g.setIndex(idx);
  return g;
};

const backdropMaterial = (stage: string, deep: string, ray: string) =>
  new ShaderMaterial({
    depthWrite: false,
    fog: false,
    uniforms: {
      uStage: { value: new Color(...lin(stage)) },
      uDeep: { value: new Color(...lin(deep)) },
      uRay: { value: new Color(...lin(ray)) },
      uPhase: { value: 0 },
      uFog: { value: new Color(...lin(deep)).multiplyScalar(0.95) },
    },
    vertexShader: /* glsl */ `
      varying vec2 vUv; varying vec3 vWorld;
      void main() { vUv = uv; vWorld = (modelMatrix * vec4(position, 1.0)).xyz; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }`,
    fragmentShader: /* glsl */ `
      uniform vec3 uStage; uniform vec3 uDeep; uniform vec3 uRay; uniform float uPhase; uniform vec3 uFog;
      varying vec2 vUv; varying vec3 vWorld;
      float n1(float x) { return sin(x) * 0.5 + sin(x * 2.17 + 1.3) * 0.3 + sin(x * 4.31 + 2.1) * 0.2; }
      void main() {
        vec2 p = vec2(vUv.x, max(vUv.y, 0.0));
        // fabric folds: soft vertical undulation, slightly diagonal
        float folds = n1(p.x * 18.0 + p.y * 3.0 + 0.4 * sin(uPhase));
        float fold2 = n1(p.x * 41.0 - p.y * 5.0 + 1.7);
        // overall light: brighter upper-middle-left, dark edges
        vec2 c = p - vec2(0.42, 0.62);
        float lightAmt = exp(-dot(c * vec2(0.9, 1.2), c * vec2(0.9, 1.2)) / 0.16);
        vec3 col = mix(uDeep * 0.22, uStage * 1.5, lightAmt);
        col *= 1.0 + 0.10 * folds + 0.05 * fold2;
        // darker top-left corner and right edge
        col *= 1.0 - 0.85 * smoothstep(0.34, 0.0, p.x) * smoothstep(0.3, 1.0, p.y);
        col *= 1.0 - 0.6 * smoothstep(0.72, 1.0, p.x) * smoothstep(0.3, 0.9, p.y);
        col *= 1.0 - 0.35 * smoothstep(0.85, 1.0, p.y);
        // diagonal light rays falling from upper left (lit cloth)
        float r = 0.0;
        for (int i = 0; i < 6; i++) {
          float fi = float(i);
          float off = -0.34 + fi * 0.17 + 0.012 * sin(uPhase + fi * 1.9);
          float w = 0.06 + 0.07 * fract(fi * 0.618 + 0.2);
          float d = (p.x - 0.55 * (1.0 - p.y)) - off;   // lines x = off + 0.55(1-y)
          float a = exp(-d * d / (w * w)) * (0.55 + 0.45 * fract(fi * 0.381 + 0.5));
          a *= smoothstep(0.05, 0.65, p.y);   // fades toward the floor
          r += a;
        }
        col += uRay * r * 0.17 * (0.25 + lightAmt);
        // floor: satin red, lit around the podium, soft contact shadow
        float rr = length(vWorld.xz * vec2(1.0, 1.0));
        float lit = exp(-(vWorld.x * vWorld.x) / 40.0 - (vWorld.z + 1.0) * (vWorld.z + 1.0) / 30.0);
        vec3 floorCol = uStage * (0.5 + 0.4 * lit) * (1.0 + 0.04 * folds);
        floorCol *= mix(0.55, 1.0, smoothstep(1.75, 2.9, rr));
        float tj = smoothstep(-0.2, 0.02, vUv.y);
        col = mix(floorCol, col, tj);
        gl_FragColor = vec4(col, 1.0);
      }`,
  });

const rayMaterial = (ray: string) =>
  new ShaderMaterial({
    transparent: true,
    depthWrite: false,
    blending: AdditiveBlending,
    fog: false,
    side: DoubleSide,
    uniforms: { uRay: { value: new Color(...lin(ray)) }, uAmt: { value: 1 } },
    vertexShader: /* glsl */ `
      varying vec2 vUv;
      void main() { vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }`,
    fragmentShader: /* glsl */ `
      uniform vec3 uRay; uniform float uAmt; varying vec2 vUv;
      void main() {
        float x = vUv.x * 2.0 - 1.0;
        float across = exp(-x * x * 5.0) * (1.0 - smoothstep(0.7, 1.0, abs(x)));
        float along = smoothstep(0.0, 0.35, vUv.y) * (1.0 - smoothstep(0.85, 1.0, vUv.y));
        gl_FragColor = vec4(uRay * across * along * uAmt, 1.0);
      }`,
  });

const SPARKS = 200;
const sparkleGeometry = () => {
  const rng = mulberry32(0x5a4c);
  const g = new BufferGeometry();
  const base = new Float32Array(SPARKS * 3);
  const seed = new Float32Array(SPARKS * 4);
  for (let i = 0; i < SPARKS; i++) {
    base[i * 3] = (rng() * 2 - 1) * 6.5;
    base[i * 3 + 1] = -0.3 + rng() * 3.4;
    base[i * 3 + 2] = -3.5 + rng() * 6.5;
    seed[i * 4] = rng() * TAU; // phase
    seed[i * 4 + 1] = 1 + Math.floor(rng() * 3); // twinkle cycles per loop (integer)
    seed[i * 4 + 2] = 0.08 + 1.4 * Math.pow(rng(), 4); // brightness: mostly dim, a few bright
    seed[i * 4 + 3] = rng(); // size
  }
  g.setAttribute("position", new BufferAttribute(base, 3));
  g.setAttribute("aSeed", new BufferAttribute(seed, 4));
  return g;
};

const sparkleMaterial = (color: string) =>
  new ShaderMaterial({
    transparent: true,
    depthWrite: false,
    blending: AdditiveBlending,
    fog: false,
    uniforms: {
      uPhase: { value: 0 },
      uColor: { value: new Color(...lin(color)) },
      uPx: { value: 1 },
      uFocus: { value: 6.5 },
    },
    vertexShader: /* glsl */ `
      attribute vec4 aSeed;
      uniform float uPhase; uniform float uPx; uniform float uFocus;
      varying float vBright; varying float vSoft;
      void main() {
        vec3 p = position;
        // drift: closed orbits, whole cycles per loop
        p.x += 0.25 * sin(uPhase + aSeed.x);
        p.y += 0.35 * sin(uPhase * 2.0 + aSeed.x * 1.7) * 0.5 + 0.18 * cos(uPhase + aSeed.x * 0.7);
        p.z += 0.2 * cos(uPhase + aSeed.x * 1.3);
        vec4 mv = modelViewMatrix * vec4(p, 1.0);
        float depth = -mv.z;
        float coc = abs(depth - uFocus) / depth;            // defocus → bigger, softer
        float tw = 0.5 + 0.5 * sin(uPhase * aSeed.y + aSeed.x * 3.0);
        tw = tw * tw * tw;
        float size = (2.0 + 4.0 * aSeed.w) * (1.0 + 2.5 * step(0.55, aSeed.z)) + 7.0 * coc;
        gl_PointSize = size * uPx;
        vSoft = clamp(coc * 6.0, 0.0, 1.0);
        vBright = aSeed.z * (0.15 + 1.6 * tw) * (2.0 + 4.0 * aSeed.w) * (2.0 + 4.0 * aSeed.w) / (size * size) * 4.0;
        gl_Position = projectionMatrix * mv;
      }`,
    fragmentShader: /* glsl */ `
      uniform vec3 uColor; varying float vBright; varying float vSoft;
      void main() {
        vec2 q = gl_PointCoord * 2.0 - 1.0;
        float r2 = dot(q, q);
        if (r2 > 1.0) discard;
        float sharp = exp(-r2 * 7.0);
        float disc = smoothstep(1.0, 0.6, sqrt(r2)) * 0.6;
        float halo = exp(-r2 * 2.2) * 0.35;
        float a = mix(sharp, disc, vSoft) + halo * (1.0 - vSoft);
        gl_FragColor = vec4(uColor * a * vBright, 1.0);
      }`,
  });

/* ------------------------------------------------------------------ */

export const createGoldPodium = (p: GoldPodiumParams) => (renderer: WebGLRenderer): Look => {
  const scene = new Scene();
  scene.background = new Color(...lin(p.stageDeep));
  const camera = new PerspectiveCamera(30, 16 / 9, 0.1, 100);
  const post = new PostPipeline({
    tonemap: "soft",
    exposure: 1.0,
    bloomStrength: 1.1,
    bloomThreshold: 0.7,
    bloomKnee: 0.4,
    bloomRadius: 1.0,
    vignette: 0.35,
    vignetteStart: 0.35,
    grain: 0.015,
    grainPeriod: LOOP,
    blueNoise: true,
    saturation: 1.0,
  });

  // environment: stage-coloured dome, warm softboxes
  const envScene = new Scene();
  envScene.add(
    envDome(
      `col = mix(uDeep * 0.35, uStage * 0.55, smoothstep(-0.4, 0.6, d.y));
       col = mix(col, uStage * 0.35, smoothstep(0.0, -0.6, d.y));
       // warm haze band around the horizon keeps the gold champagne, not copper
       col += vec3(1.0, 0.78, 0.5) * 0.45 * exp(-d.y * d.y / 0.05);`,
      { uStage: { value: linColor(p.stage) }, uDeep: { value: linColor(p.stageDeep) } },
    ),
  );
  const warm = new Color("#FFF2E0");
  const k1 = panel(22, 14, warm, 10);
  k1.position.set(-14, 18, 10);
  k1.lookAt(0, 0, 0);
  const k2 = panel(40, 5, warm, 5);
  k2.position.set(6, 8, 20);
  k2.lookAt(0, 0, 0);
  const k3 = panel(6, 20, warm, 2.5);
  k3.position.set(18, 4, -4);
  k3.lookAt(0, 0, 0);
  // big warm fill behind the camera: flat gold strips facing us reflect champagne, not stage red
  const k4 = panel(60, 24, warm, 1.5);
  k4.position.set(0, 6, 26);
  k4.lookAt(0, 0, 0);
  envScene.add(k1, k2, k3, k4);
  const env = envFromScene(renderer, envScene);
  scene.environment = env;

  const key = new DirectionalLight(new Color("#FFE2C0"), 2.2);
  key.position.set(-4, 7, 3);
  scene.add(key);
  const fill = new DirectionalLight(new Color(...lin(p.stage)), 0.8);
  fill.position.set(5, 2, 4);
  scene.add(fill);

  // cyclorama: floor curving up into the backdrop (no horizon seam)
  const bdMat = backdropMaterial(p.stage, p.stageDeep, p.ray);
  const backdrop = new Mesh(cycGeometry(), bdMat);
  scene.add(backdrop);


  // podium
  const gold = new MeshPhysicalMaterial({
    color: new Color(...lin(p.metal)),
    metalness: 1,
    roughness: 0.2,
    envMapIntensity: 1.2,
    fog: false,
  });
  const podR = 1.85;
  const podH = 0.3;
  const body = new Mesh(new CylinderGeometry(podR, podR, podH, 160, 1, true), gold);
  body.position.y = podH / 2;
  scene.add(body);
  const top = new Mesh(
    new CircleGeometry(podR, 160),
    new MeshPhysicalMaterial({
      color: new Color(...lin(p.stage)).multiplyScalar(0.22),
      roughness: 0.32,
      metalness: 0.1,
      sheen: 0.5,
      sheenColor: new Color(...lin(p.stage)),
      sheenRoughness: 0.45,
      clearcoat: 0.15,
      clearcoatRoughness: 0.35,
      envMapIntensity: 0.45,
      fog: false,
    }),
  );
  top.rotation.x = -Math.PI / 2;
  top.position.y = podH + 0.001;
  scene.add(top);
  const rim = new Mesh(new TorusGeometry(podR, 0.03, 16, 200), gold);
  rim.rotation.x = Math.PI / 2;
  rim.position.y = podH;
  scene.add(rim);
  const baseRing = new Mesh(new TorusGeometry(podR + 0.05, 0.022, 16, 200), gold);
  baseRing.rotation.x = Math.PI / 2;
  baseRing.position.y = 0.035;
  scene.add(baseRing);

  // ribbons
  const ribbons = RIBBONS.map((def) => {
    const g = ribbonGeometry();
    const { m, uniforms } = ribbonMaterial(p.metal);
    const mesh = new Mesh(g, m);
    mesh.frustumCulled = false;
    scene.add(mesh);
    return { def, g, uniforms };
  });

  // rays (additive planes, in front of the backdrop)
  const rays: Mesh[] = [];
  const rayRng = mulberry32(0x4a75);
  for (let i = 0; i < 6; i++) {
    const m = new Mesh(new PlaneGeometry(1, 1), rayMaterial(p.ray));
    m.userData = {
      x: -5.5 + i * 1.6 + rayRng() * 0.6,
      w: 0.8 + rayRng() * 1.2,
      amt: 0.05 + rayRng() * 0.06,
      ph: rayRng() * TAU,
    };
    rays.push(m);
    scene.add(m);
  }

  // sparkles
  const spMat = sparkleMaterial("#FFC873");
  const sparkles = new Points(sparkleGeometry(), spMat);
  sparkles.frustumCulled = false;
  scene.add(sparkles);

  const camTarget = new Vector3(0, 1.25, 0);

  const update = (frame: number, h: number) => {
    const f = ((frame % LOOP) + LOOP) % LOOP;
    const t = f / LOOP;
    const ph = TAU * t;
    ribbons.forEach(({ def, g, uniforms }) => {
      updateRibbon(g, def, t);
      uniforms.uHl.value = (t * def.hlSpeed + def.phase / TAU) % 1;
    });
    rays.forEach((m) => {
      const u = m.userData as { x: number; w: number; amt: number; ph: number };
      m.position.set(u.x + 0.25 * Math.sin(ph + u.ph), 3.6, -6.5);
      m.rotation.set(0, 0, 0.62 + 0.03 * Math.sin(ph + u.ph * 1.3));
      m.scale.set(u.w, 16, 1);
      (m.material as ShaderMaterial).uniforms.uAmt.value = u.amt * (0.8 + 0.2 * Math.sin(ph + u.ph));
    });
    bdMat.uniforms.uPhase.value = ph;
    spMat.uniforms.uPhase.value = ph;
    spMat.uniforms.uPx.value = h / 720;
    // slow closed dolly, ±3 %
    const dist = 7.2 * (1 + 0.03 * Math.sin(ph));
    camera.position.set(0.12 * Math.sin(ph), 0.98, dist);
    camera.lookAt(camTarget);
    spMat.uniforms.uFocus.value = dist;
  };

  return {
    render(gl, frame, w, h) {
      camera.aspect = w / h;
      camera.updateProjectionMatrix();
      update(frame, h);
      post.renderScene(gl, scene, camera, w, h);
      post.finish(gl, frame);
    },
    dispose() {
      post.dispose();
      env.dispose();
    },
  };
};
