import * as THREE from "three";
import Delaunator from "delaunator";
import { createNoise4D } from "simplex-noise";
import { mulberry32, TAU } from "../lib/random";
import { glowPointsMaterial, hdrColor, makeEnv, pxScale } from "../lib/three-util";
import type { Look } from "../lib/look";

export type LowPolyParams = {
  edge: string; // edge glow colour
  face: string; // base colour of the metal faces
  sparkle: string;
  envTint: string; // tint of the faces' reflections (warm / cool)
};

// ---- module-level, seeded scene layout --------------------------------
const rng = mulberry32(0x10f1);
const noise = createNoise4D(mulberry32(0x5eed));
const noise2 = createNoise4D(mulberry32(0xbeef));

const SPACING = 1.35;
const X0 = -12, X1 = 12, Y0 = -7, Y1 = 9;
const base: number[] = [];
for (let y = Y0; y <= Y1 + 1e-6; y += SPACING * 0.87) {
  const row = Math.round((y - Y0) / (SPACING * 0.87));
  for (let x = X0 + (row % 2) * SPACING * 0.5; x <= X1 + 1e-6; x += SPACING) {
    base.push(x + (rng() - 0.5) * SPACING * 0.62, y + (rng() - 0.5) * SPACING * 0.55);
  }
}
const NV = base.length / 2;
const tri = new Delaunator(base).triangles;
// unique edges
const edgeSet = new Set<number>();
const edges: [number, number][] = [];
for (let i = 0; i < tri.length; i += 3) {
  for (let k = 0; k < 3; k++) {
    const a = tri[i + k], b = tri[i + ((k + 1) % 3)];
    const key = Math.min(a, b) * 100000 + Math.max(a, b);
    if (!edgeSet.has(key)) {
      edgeSet.add(key);
      edges.push([Math.min(a, b), Math.max(a, b)]);
    }
  }
}

// sparkles
const N_EDGE_SPARK = 2400;
const N_FREE_SPARK = 900;
type Spark = { e: number; u: number; ua: number; k: number; ph: number; tk: number; tph: number; size: number; bright: number;
  x: number; y: number; z: number; ax: number; ay: number; az: number; kx: number; ky: number; kz: number; px: number; py: number; pz: number };
const sparks: Spark[] = [];
for (let i = 0; i < N_EDGE_SPARK + N_FREE_SPARK; i++) {
  const big = rng() < 0.08;
  sparks.push({
    e: Math.floor(rng() * edges.length),
    u: rng(), ua: 0.05 + rng() * 0.25, k: 1 + Math.floor(rng() * 3), ph: rng() * TAU,
    tk: 2 + Math.floor(rng() * 14), tph: rng() * TAU,
    size: big ? 12 + rng() * 10 : 5 + rng() * 5,
    bright: big ? 10 + rng() * 10 : 5 + rng() * 8,
    x: X0 + rng() * (X1 - X0), y: Y0 + rng() * (Y1 - Y0), z: 0.15 + Math.pow(rng(), 1.6) * 2.4,
    ax: 0.1 + rng() * 0.4, ay: 0.1 + rng() * 0.4, az: rng() * 0.2,
    kx: 1 + Math.floor(rng() * 2), ky: 1 + Math.floor(rng() * 2), kz: 1 + Math.floor(rng() * 3),
    px: rng() * TAU, py: rng() * TAU, pz: rng() * TAU,
  });
}

const EDGE_W = 0.06;

export const LowPolyLuxe: Look<LowPolyParams> = {
  assets: ["hdri"],
  create: ({ gl, height, assets, params, period }) => {
    const scene = new THREE.Scene();
    scene.background = new THREE.Color(0, 0, 0);
    const env = makeEnv(gl, assets.hdri!);
    scene.environment = env.texture;
    scene.environmentRotation.set(-0.55, 0.25, 0);

    const camera = new THREE.PerspectiveCamera(44, 16 / 9, 0.3, 80);

    // ---- faces (non-indexed, flat shaded) ----
    const faceGeo = new THREE.BufferGeometry();
    const facePos = new Float32Array(tri.length * 3);
    faceGeo.setAttribute("position", new THREE.BufferAttribute(facePos, 3));
    const faceMat = new THREE.MeshStandardMaterial({
      color: new THREE.Color(params.face),
      metalness: 0.9,
      roughness: 0.3,
      flatShading: true,
      side: THREE.DoubleSide,
      envMapIntensity: 0.5,
    });
    // tint reflections warm/cool without touching the base colour's darkness
    faceMat.onBeforeCompile = (s) => {
      s.uniforms.envTint = { value: new THREE.Color(params.envTint) };
      s.fragmentShader = s.fragmentShader
        .replace("#include <common>", "#include <common>\nuniform vec3 envTint;")
        .replace("#include <opaque_fragment>", "outgoingLight *= envTint;\n#include <opaque_fragment>");
    };
    const faces = new THREE.Mesh(faceGeo, faceMat);
    faces.frustumCulled = false;
    scene.add(faces);
    const key = new THREE.DirectionalLight(new THREE.Color(params.envTint), 0.12);
    key.position.set(-3, 5, 6);
    scene.add(key);

    // ---- edges: camera-facing ribbons, slightly in front ----
    const NE = edges.length;
    const ePos = new Float32Array(NE * 4 * 3);
    const eUv = new Float32Array(NE * 4 * 2);
    const eLen = new Float32Array(NE * 4);
    const eBr = new Float32Array(NE * 4);
    const eIdx: number[] = [];
    for (let i = 0; i < NE; i++) {
      eUv.set([0, -1, 0, 1, 1, -1, 1, 1], i * 8);
      eIdx.push(i * 4, i * 4 + 2, i * 4 + 1, i * 4 + 1, i * 4 + 2, i * 4 + 3);
    }
    const edgeGeo = new THREE.BufferGeometry();
    edgeGeo.setAttribute("position", new THREE.BufferAttribute(ePos, 3));
    edgeGeo.setAttribute("uv", new THREE.BufferAttribute(eUv, 2));
    edgeGeo.setAttribute("len", new THREE.BufferAttribute(eLen, 1));
    edgeGeo.setAttribute("bright", new THREE.BufferAttribute(eBr, 1));
    edgeGeo.setIndex(eIdx);
    const edgeCol = hdrColor(params.edge, 1);
    const edgeMat = new THREE.ShaderMaterial({
      uniforms: { col: { value: edgeCol }, ext: { value: EDGE_W * 0.5 } },
      vertexShader: /* glsl */ `
        attribute float len; attribute float bright;
        varying vec2 vUv; varying float vLen; varying float vBr;
        void main() { vUv = uv; vLen = len; vBr = bright;
          gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }`,
      fragmentShader: /* glsl */ `
        uniform vec3 col; uniform float ext;
        varying vec2 vUv; varying float vLen; varying float vBr;
        void main() {
          float v = abs(vUv.y);
          // bevelled metal bar: bright ridge, darker flanks, soft outer edge
          float ridge = exp(-v * v * 6.0);
          float flank = 0.55 + 0.45 * (1.0 - v);
          float a = 1.0 - smoothstep(0.75, 1.0, v);
          float d = min(vUv.x, 1.0 - vUv.x) * vLen - ext; // distance to the vertex
          float node = exp(-max(d, 0.0) * max(d, 0.0) / 0.012);
          float k = vBr * (0.4 * flank + 1.0 * ridge) * (1.0 + 1.4 * node);
          gl_FragColor = vec4(col * k * a, 1.0);
          if (a < 0.02) discard;
        }`,
      side: THREE.DoubleSide,
    });
    const edgeMesh = new THREE.Mesh(edgeGeo, edgeMat);
    edgeMesh.frustumCulled = false;
    scene.add(edgeMesh);

    // ---- vertex glows ----
    const vgPos = new Float32Array(NV * 3);
    const vgSize = new Float32Array(NV);
    const vgCol = new Float32Array(NV * 3);
    const vgGeo = new THREE.BufferGeometry();
    vgGeo.setAttribute("position", new THREE.BufferAttribute(vgPos, 3));
    vgGeo.setAttribute("size", new THREE.BufferAttribute(vgSize, 1));
    vgGeo.setAttribute("pcolor", new THREE.BufferAttribute(vgCol, 3));
    const vg = new THREE.Points(vgGeo, glowPointsMaterial(height));
    vg.frustumCulled = false;
    scene.add(vg);

    // ---- sparkles ----
    const NS = sparks.length;
    const sPos = new Float32Array(NS * 3);
    const sSize = new Float32Array(NS);
    const sCol = new Float32Array(NS * 3);
    const sGeo = new THREE.BufferGeometry();
    sGeo.setAttribute("position", new THREE.BufferAttribute(sPos, 3));
    sGeo.setAttribute("size", new THREE.BufferAttribute(sSize, 1));
    sGeo.setAttribute("pcolor", new THREE.BufferAttribute(sCol, 3));
    const sp = new THREE.Points(sGeo, glowPointsMaterial(height, { sharp: 0.15 }));
    sp.frustumCulled = false;
    scene.add(sp);
    const sparkCol = hdrColor(params.sparkle, 1);

    const vx = new Float32Array(NV * 3);
    const camPos = new THREE.Vector3();
    const A = new THREE.Vector3(), B = new THREE.Vector3(), D = new THREE.Vector3(), S = new THREE.Vector3(), V = new THREE.Vector3();
    void pxScale;

    const update = (frame: number) => {
      const t = (frame % period) / period; // 0..1, loops
      const c = Math.cos(TAU * t), s = Math.sin(TAU * t);

      // camera on a closed path
      camera.position.set(0.45 * Math.sin(TAU * t), -2.6 + 0.25 * Math.sin(TAU * 2 * t + 0.6), 7.6 + 0.25 * Math.cos(TAU * t));
      camera.lookAt(0.25 * Math.sin(TAU * t + 1.2), 0.9, 0);
      camera.rotateZ(0.06 + 0.02 * Math.sin(TAU * t));
      camera.updateMatrixWorld();
      camPos.copy(camera.position);

      // vertex displacement: noise sampled around a circle in time
      const R1 = 0.55, R2 = 0.3;
      for (let i = 0; i < NV; i++) {
        const x = base[i * 2], y = base[i * 2 + 1];
        const z =
          0.85 * noise(x * 0.62, y * 0.62, R1 * c, R1 * s) +
          1.1 * noise2(x * 0.12 + 3.1, y * 0.12, R2 * c, R2 * s);
        vx[i * 3] = x;
        vx[i * 3 + 1] = y;
        vx[i * 3 + 2] = z;
      }
      for (let i = 0; i < tri.length; i++) {
        facePos[i * 3] = vx[tri[i] * 3];
        facePos[i * 3 + 1] = vx[tri[i] * 3 + 1];
        facePos[i * 3 + 2] = vx[tri[i] * 3 + 2];
      }
      faceGeo.attributes.position.needsUpdate = true;
      faceGeo.computeVertexNormals();

      for (let i = 0; i < NE; i++) {
        const [a, b] = edges[i];
        A.fromArray(vx, a * 3);
        B.fromArray(vx, b * 3);
        D.subVectors(B, A);
        const len = D.length();
        D.divideScalar(len);
        V.addVectors(A, B).multiplyScalar(0.5).sub(camPos).normalize();
        S.crossVectors(D, V).normalize().multiplyScalar(EDGE_W * 0.5);
        // nudge toward camera so edges sit in front of the faces
        const push = 0.035;
        const ex = D.clone().multiplyScalar(EDGE_W * 0.5);
        const o = i * 12;
        ePos[o] = A.x - ex.x - S.x + V.x * -push; ePos[o + 1] = A.y - ex.y - S.y + V.y * -push; ePos[o + 2] = A.z - ex.z - S.z + V.z * -push;
        ePos[o + 3] = A.x - ex.x + S.x + V.x * -push; ePos[o + 4] = A.y - ex.y + S.y + V.y * -push; ePos[o + 5] = A.z - ex.z + S.z + V.z * -push;
        ePos[o + 6] = B.x + ex.x - S.x + V.x * -push; ePos[o + 7] = B.y + ex.y - S.y + V.y * -push; ePos[o + 8] = B.z + ex.z - S.z + V.z * -push;
        ePos[o + 9] = B.x + ex.x + S.x + V.x * -push; ePos[o + 10] = B.y + ex.y + S.y + V.y * -push; ePos[o + 11] = B.z + ex.z + S.z + V.z * -push;
        const L = len + EDGE_W;
        const mx = (base[a * 2] + base[b * 2]) * 0.5, my = (base[a * 2 + 1] + base[b * 2 + 1]) * 0.5;
        const br = 0.75 + 0.55 * noise(mx * 0.35 + 9.0, my * 0.35, 0.8 * c, 0.8 * s);
        for (let k = 0; k < 4; k++) { eLen[i * 4 + k] = L; eBr[i * 4 + k] = br; }
      }
      edgeGeo.attributes.position.needsUpdate = true;
      edgeGeo.attributes.len.needsUpdate = true;
      edgeGeo.attributes.bright.needsUpdate = true;

      for (let i = 0; i < NV; i++) {
        V.fromArray(vx, i * 3).sub(camPos).normalize();
        vgPos[i * 3] = vx[i * 3] - V.x * 0.04;
        vgPos[i * 3 + 1] = vx[i * 3 + 1] - V.y * 0.04;
        vgPos[i * 3 + 2] = vx[i * 3 + 2] - V.z * 0.04;
        const tw = 0.6 + 0.4 * noise(base[i * 2] * 0.5, base[i * 2 + 1] * 0.5, c, s);
        vgSize[i] = 13;
        vgCol[i * 3] = edgeCol.r * 0.7 * tw; vgCol[i * 3 + 1] = edgeCol.g * 0.7 * tw; vgCol[i * 3 + 2] = edgeCol.b * 0.7 * tw;
      }
      vgGeo.attributes.position.needsUpdate = true;
      vgGeo.attributes.size.needsUpdate = true;
      vgGeo.attributes.pcolor.needsUpdate = true;

      for (let i = 0; i < NS; i++) {
        const p = sparks[i];
        if (i < N_EDGE_SPARK) {
          const [a, b] = edges[p.e];
          const u = Math.min(1, Math.max(0, p.u + p.ua * Math.sin(TAU * p.k * t + p.ph)));
          A.fromArray(vx, a * 3);
          B.fromArray(vx, b * 3);
          A.lerp(B, u);
          V.copy(A).sub(camPos).normalize();
          sPos[i * 3] = A.x - V.x * 0.08; sPos[i * 3 + 1] = A.y - V.y * 0.08; sPos[i * 3 + 2] = A.z - V.z * 0.08;
        } else {
          sPos[i * 3] = p.x + p.ax * Math.sin(TAU * p.kx * t + p.px);
          sPos[i * 3 + 1] = p.y + p.ay * Math.sin(TAU * p.ky * t + p.py);
          sPos[i * 3 + 2] = p.z + p.az * Math.sin(TAU * p.kz * t + p.pz);
        }
        const tw = Math.pow(0.5 + 0.5 * Math.sin(TAU * p.tk * t + p.tph), 3);
        const br = p.bright * (0.15 + 0.85 * tw);
        sSize[i] = p.size * (0.7 + 0.3 * tw);
        sCol[i * 3] = sparkCol.r * br; sCol[i * 3 + 1] = sparkCol.g * br; sCol[i * 3 + 2] = sparkCol.b * br;
      }
      sGeo.attributes.position.needsUpdate = true;
      sGeo.attributes.size.needsUpdate = true;
      sGeo.attributes.pcolor.needsUpdate = true;
    };

    return {
      scene,
      camera,
      update,
      post: {
        exposure: 1.0,
        tonemap: "aces",
        bloom: { strength: 1.4, threshold: 0.6, knee: 0.5, radius: 0.5 },
        dof: { focus: 8.2, range: 6, nearRange: 4, maxBlur: 0.004, maxNearBlur: 0.007 },
        grain: 0.02,
        grainPeriod: period,
        grade: { vignette: 0.35 },
      },
      dispose: () => {
        env.dispose();
        [faceGeo, edgeGeo, vgGeo, sGeo].forEach((g) => g.dispose());
      },
    };
  },
};
