import * as THREE from "three";
import { PostFX } from "../../lib/post";
import { ribbonVertex } from "../../lib/glsl";
import { mulberry32 } from "../../lib/random";
import type { LookFactory } from "../../lib/Stage";
import type { TrailsRow } from "../../versions";
import { richer } from "../../lib/color";

export const TRAILS_FRAMES = 600;

// ---- layout (seeded at module level) ---------------------------------------
const N_TRAILS = 300;
const SEGS = 220;
// Trails are concentric arcs around C, so they run parallel and sweep in a
// wide curve; the camera sits low on the band looking along it.
const C = new THREE.Vector3(18, 0, -2);
const R_IN = 11;
const R_OUT = 32;
const PHI0 = 2.6;
const PHI1 = 5.55;
const N_LANES = 14;

type Trail = {
  r: number;
  y: number;
  wobA: number;
  wobF: number;
  wobP: number;
  width: number;
  mix: number;
  base: number;
  // two dash layers, each: cells along the trail, integer cells travelled per loop
  m1: number; n1: number; l1: number; p1: number; b1: number;
  m2: number; n2: number; l2: number; p2: number; b2: number;
  accent: number;
};

const rng = mulberry32(0x7a11);
const TRAILS: Trail[] = Array.from({ length: N_TRAILS }, () => {
  // denser towards the middle of the band
  const t = rng();
  // trails are grouped into lanes with dark gaps between them
  const lane = Math.floor(t * N_LANES);
  const r = R_IN + ((lane + 0.5) / N_LANES) * (R_OUT - R_IN) + (rng() - 0.5) * 0.7 * ((R_OUT - R_IN) / N_LANES);
  const m1 = 3 + Math.floor(rng() * 6);
  const m2 = 3 + Math.floor(rng() * 5);
  // ~1 in 7 trails is a bold 'hero' strand: thicker, brighter, white-cyan core
  const hero = rng() < 0.15;
  const accent = rng() < 0.2 ? 1 : 0;
  return {
    r,
    y: -0.05 + Math.pow(rng(), 1.6) * 0.75,
    wobA: 0.04 + rng() * 0.12,
    wobF: 1 + Math.floor(rng() * 3),
    wobP: rng() * Math.PI * 2,
    width: hero ? 0.022 + rng() * 0.03 : 0.006 + Math.pow(rng(), 4) * 0.02,
    mix: Math.pow(rng(), 1.8),
    base: hero ? 0.45 + 0.35 * rng() : 0.02 + Math.pow(rng(), 3) * 0.25,
    m1,
    n1: m1 * (1 + Math.floor(rng() * 3)) + Math.floor(rng() * 3), // whole cells per loop
    l1: 0.03 + rng() * 0.1,
    p1: rng(),
    b1: (hero ? 1.8 : 0.6) + Math.pow(rng(), 2) * 3,
    m2,
    n2: 2 + Math.floor(rng() * 9),
    l2: 0.05 + rng() * 0.12,
    p2: rng(),
    b2: rng() < 0.3 || accent ? 1.5 + rng() * 4 : 0,
    accent,
  };
});

function trailPoint(tr: Trail, u: number, out: THREE.Vector3) {
  // outer lanes spiral away into the distance; inner lanes keep curling round
  // and come back towards the camera on the right (horseshoe)
  const outer = THREE.MathUtils.smoothstep(tr.r, R_IN + 3, R_IN + 8);
  const phi = PHI0 + (THREE.MathUtils.lerp(6.35, PHI1, outer) - PHI0) * u;
  const r = tr.r + 0.6 * Math.sin(u * 3.1 + tr.wobP * 0.3) + 16 * outer * u * u * u;
  out.set(C.x + r * Math.cos(phi), tr.y + tr.wobA * Math.sin(u * Math.PI * 2 * tr.wobF + tr.wobP), C.z + r * Math.sin(phi));
  return out;
}

function buildGeometry(): THREE.BufferGeometry {
  const nv = N_TRAILS * (SEGS + 1) * 2;
  const pos = new Float32Array(nv * 3);
  const tan = new Float32Array(nv * 3);
  const side = new Float32Array(nv);
  const u = new Float32Array(nv);
  const p0 = new Float32Array(nv * 4); // width, mix, base, accent
  const pA = new Float32Array(nv * 4); // m1 n1 l1 p1
  const pB = new Float32Array(nv * 4); // m2 n2 l2 p2
  const pC = new Float32Array(nv * 2); // b1 b2
  const idx: number[] = [];
  const a = new THREE.Vector3(), b = new THREE.Vector3(), c = new THREE.Vector3();
  let v = 0;
  TRAILS.forEach((tr) => {
    const start = v;
    for (let i = 0; i <= SEGS; i++) {
      const uu = i / SEGS;
      trailPoint(tr, uu, a);
      trailPoint(tr, Math.max(0, uu - 1e-3), b);
      trailPoint(tr, Math.min(1, uu + 1e-3), c);
      c.sub(b).normalize();
      for (let s = 0; s < 2; s++) {
        pos.set([a.x, a.y, a.z], v * 3);
        tan.set([c.x, c.y, c.z], v * 3);
        side[v] = s === 0 ? -1 : 1;
        u[v] = uu;
        p0.set([tr.width, tr.mix, tr.base, tr.accent], v * 4);
        pA.set([tr.m1, tr.n1, tr.l1, tr.p1], v * 4);
        pB.set([tr.m2, tr.n2, tr.l2, tr.p2], v * 4);
        pC.set([tr.b1, tr.b2], v * 2);
        v++;
      }
      if (i < SEGS) {
        const k = start + i * 2;
        idx.push(k, k + 1, k + 2, k + 1, k + 3, k + 2);
      }
    }
  });
  const g = new THREE.BufferGeometry();
  g.setAttribute("position", new THREE.BufferAttribute(pos, 3));
  g.setAttribute("aTangent", new THREE.BufferAttribute(tan, 3));
  g.setAttribute("aSide", new THREE.BufferAttribute(side, 1));
  g.setAttribute("aU", new THREE.BufferAttribute(u, 1));
  g.setAttribute("aP0", new THREE.BufferAttribute(p0, 4));
  g.setAttribute("aPA", new THREE.BufferAttribute(pA, 4));
  g.setAttribute("aPB", new THREE.BufferAttribute(pB, 4));
  g.setAttribute("aPC", new THREE.BufferAttribute(pC, 2));
  g.setIndex(idx);
  g.boundingSphere = new THREE.Sphere(C.clone(), 80);
  return g;
}

const vert = /* glsl */ `
${ribbonVertex}
attribute vec3 aTangent; attribute float aSide; attribute float aU;
attribute vec4 aP0; attribute vec4 aPA; attribute vec4 aPB; attribute vec2 aPC;
varying float vU; varying float vAcross; varying vec4 vP0; varying vec4 vPA; varying vec4 vPB; varying vec2 vPC;
varying float vDist;
void main() {
  vec3 wp = ribbonExpand(position, aTangent, aSide, aP0.x);
  vU = aU; vAcross = aSide; vP0 = aP0; vPA = aPA; vPB = aPB; vPC = aPC;
  vec4 mv = viewMatrix * vec4(wp, 1.0);
  vDist = -mv.z;
  gl_Position = projectionMatrix * mv;
}
`;

const frag = /* glsl */ `
uniform float uT;          // frame / 600, in [0,1)
uniform vec3 uFrom; uniform vec3 uTo; uniform vec3 uAccent; uniform vec3 uHead;
varying float vU; varying float vAcross; varying vec4 vP0; varying vec4 vPA; varying vec4 vPB; varying vec2 vPC;
varying float vWidthFade; varying float vDist;

// One dash per cell; head at the leading edge, tail fading behind it.
float dash(float u, vec4 p) {
  float x = u * p.x - uT * p.y + p.w;   // p.y whole cells per loop -> seamless
  float f = fract(x);
  float s = (f - (1.0 - p.z)) / p.z;    // 0 at tail, 1 at head
  if (s < 0.0) return 0.0;
  float head = smoothstep(1.0, 0.97, s);
  return pow(s, 2.2) * head;
}
void main() {
  float across = 1.0 - abs(vAcross);
  float core = smoothstep(0.0, 0.85, across);
  vec3 base = mix(uFrom, uTo, vP0.y);
  float ends = smoothstep(0.0, 0.03, vU) * (1.0 - smoothstep(0.75, 1.0, vU));
  float d1 = dash(vU, vPA) * vPC.x;
  float d2 = dash(vU, vPB) * vPC.y;
  vec3 col = base * (0.2 + vP0.z * 1.4);
  // hero strands get a whitened core
  col = mix(col, uHead * vP0.z * 1.2, step(0.42, vP0.z) * pow(core, 8.0) * 0.25);
  vec3 dashCol = mix(base, uHead, 0.1);
  if (vP0.w > 0.5) { col += uAccent * d2 * 1.4; d2 = 0.0; }
  col += dashCol * d1 + mix(base, uHead, 0.25) * d2 * d2;
  // distance haze: far trails dimmer
  col *= mix(1.0, 0.45, smoothstep(10.0, 45.0, vDist));
  gl_FragColor = vec4(col * core * ends * vWidthFade, 1.0);
}
`;

export const createLightTrails: LookFactory<TrailsRow> = async ({ gl, width, height, props }) => {
  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(48, width / height, 0.1, 200);
  const geo = buildGeometry();
  const uniforms = {
    uT: { value: 0 },
    uFrom: { value: richer(props.from, 0.7) },
    uTo: { value: richer(props.to, 0.55) },
    uAccent: { value: richer(props.accent, 0.4) },
    uHead: { value: new THREE.Color(props.head) },
    uViewH: { value: height },
    uMinPx: { value: 1.1 / 720 },
  };
  const mat = new THREE.ShaderMaterial({
    vertexShader: vert,
    fragmentShader: frag,
    uniforms,
    transparent: true,
    blending: THREE.AdditiveBlending,
    depthWrite: false,
    depthTest: false,
    side: THREE.DoubleSide,
  });
  const mesh = new THREE.Mesh(geo, mat);
  mesh.frustumCulled = false;
  scene.add(mesh);
  // Depth-only copy so depth of field sees the nearest trail at each pixel.
  const depthMat = new THREE.ShaderMaterial({
    vertexShader: vert,
    fragmentShader: "void main(){ gl_FragColor = vec4(0.0); }",
    uniforms,
    colorWrite: false,
    depthWrite: true,
    depthTest: true,
    side: THREE.DoubleSide,
  });
  const depthMesh = new THREE.Mesh(geo, depthMat);
  depthMesh.frustumCulled = false;
  depthMesh.renderOrder = 10;
  scene.add(depthMesh);

  const post = new PostFX(gl, width, height, {
    exposure: 0.95,
    bloomStrength: 1.5,
    bloomThreshold: 0.12,
    bloomKnee: 0.25,
    // long tail on the low mips = wide blue haze around the bright band
    bloomWeights: [0.6, 0.8, 1.0, 1.0, 0.9, 0.8],
    dof: { focus: 14, nearK: 0.3, farK: 0.0, maxBlur: 0.005 },
    grain: 0,
    protectBlack: true,
    vignette: 0,
    clearColor: 0x000000,
  });

  return {
    render(frame) {
      const t = (((frame % TRAILS_FRAMES) + TRAILS_FRAMES) % TRAILS_FRAMES) / TRAILS_FRAMES;
      uniforms.uT.value = t;
      const a = Math.PI * 2 * t;
      // closed drift: whole sine periods over the loop
      camera.position.set(0.3 * Math.sin(a), 2.2 + 0.08 * Math.sin(2 * a), 1.5 + 0.3 * Math.cos(a));
      camera.lookAt(10 + 0.4 * Math.cos(a), 0.9, -20);
      camera.rotateZ(-0.13);
      camera.updateMatrixWorld();
      post.render(scene, camera, frame);
    },
  };
};
