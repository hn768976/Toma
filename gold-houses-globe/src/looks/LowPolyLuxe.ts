import * as THREE from "three";
import Delaunator from "delaunator";
import { createNoise4D } from "simplex-noise";
import { mulberry32, TAU } from "../lib/random";
import { glowPointsMaterial, hdrColor, makeEnv } from "../lib/three-util";
import type { Look } from "../lib/look";

export type LowPolyParams = {
  edge: string; // colour of the metal rails
  face: string; // base colour of the glossy faces
  sparkle: string;
  envTint: string; // tint of the faces' reflections (warm / cool)
};

// ---- module-level, seeded scene layout --------------------------------
const rng = mulberry32(0x10f1);
const noise = createNoise4D(mulberry32(0x5eed));
const noise2 = createNoise4D(mulberry32(0xbeef));

// irregular low-poly triangulation: seeded dart throwing with a varying
// minimum distance gives mixed facet sizes and no rows
const SPACING = 2.0;
const X0 = -13, X1 = 13, Y0 = -8.5, Y1 = 8.5;
const base: number[] = [];
for (let tries = 0; tries < 60000 && base.length < 2 * 900; tries++) {
  const x = X0 + rng() * (X1 - X0), y = Y0 + rng() * (Y1 - Y0);
  const minD = SPACING * (0.55 + 0.5 * rng());
  let ok = true;
  for (let j = 0; j < base.length; j += 2) {
    const dx = base[j] - x, dy = base[j + 1] - y;
    if (dx * dx + dy * dy < minD * minD) { ok = false; break; }
  }
  if (ok) base.push(x, y);
}
const NV = base.length / 2;
const tri = new Delaunator(base).triangles;
const NT = tri.length / 3;
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

// sparkles: strung along the rails like fairy lights, a few drifting free
const N_EDGE_SPARK = 3000;
const N_VERT_SPARK = 900; // clustered at the vertices
const N_FREE_SPARK = 220;
type Spark = { e: number; u: number; ua: number; k: number; ph: number; tk: number; tph: number; size: number; bright: number;
  x: number; y: number; z: number; ax: number; ay: number; kx: number; ky: number; px: number; py: number };
const sparks: Spark[] = [];
for (let i = 0; i < N_EDGE_SPARK + N_FREE_SPARK + N_VERT_SPARK; i++) {
  const hot = rng() < 0.06;
  sparks.push({
    e: Math.floor(rng() * edges.length),
    u: rng(), ua: 0.03 + rng() * 0.12, k: 1 + Math.floor(rng() * 2), ph: rng() * TAU,
    tk: 2 + Math.floor(rng() * 14), tph: rng() * TAU,
    size: hot ? 10 + rng() * 4 : 5 + rng() * 3,
    bright: hot ? 22 + rng() * 10 : 8 + rng() * 8,
    x: X0 + rng() * (X1 - X0), y: Y0 + rng() * (Y1 - Y0), z: 0.2 + rng() * 0.9,
    ax: 0.05 + rng() * 0.2, ay: 0.05 + rng() * 0.2,
    kx: 1 + Math.floor(rng() * 2), ky: 1 + Math.floor(rng() * 2),
    px: rng() * TAU, py: rng() * TAU,
  });
}

// rail cross-section (fractions of SPACING): gap between neighbouring frames,
// rail width, ridge height
const GAP = 0.011, RAIL = 0.018, RIDGE = 0.015;
const HUB_R = 0.045;
// convex bulge toward the camera: the surface curves away at the frame edges
const BULGE = 0.022;
const surfZ = (x: number, y: number) => 2.2 - BULGE * (x * x + y * y * 1.3);

export const LowPolyLuxe: Look<LowPolyParams> = {
  assets: ["hdri"],
  create: ({ gl, height, assets, params, period }) => {
    const scene = new THREE.Scene();
    scene.background = new THREE.Color(0, 0, 0);
    const env = makeEnv(gl, assets.hdri!);
    scene.environment = env.texture;
    scene.environmentRotation.set(-0.35, 0.9, 0);

    const camera = new THREE.PerspectiveCamera(50, 16 / 9, 0.3, 80);

    // ---- glossy black faces (non-indexed, flat shaded) ----
    const faceGeo = new THREE.BufferGeometry();
    const facePos = new Float32Array(tri.length * 3);
    faceGeo.setAttribute("position", new THREE.BufferAttribute(facePos, 3));
    const faceMat = new THREE.MeshStandardMaterial({
      color: new THREE.Color(params.face),
      metalness: 0.8,
      roughness: 0.14,
      flatShading: true,
      side: THREE.DoubleSide,
      envMapIntensity: 0.9,
    });
    faceMat.onBeforeCompile = (s) => {
      s.uniforms.envTint = { value: new THREE.Color(params.envTint) };
      s.fragmentShader = s.fragmentShader
        .replace("#include <common>", "#include <common>\nuniform vec3 envTint;")
        .replace("#include <opaque_fragment>", "outgoingLight *= envTint;\n  // soft-clamp reflections: grey sheens, never blown-out panels\n  outgoingLight = outgoingLight / (1.0 + 2.2 * max(outgoingLight.r, max(outgoingLight.g, outgoingLight.b)));\n#include <opaque_fragment>");
    };
    const faces = new THREE.Mesh(faceGeo, faceMat);
    faces.frustumCulled = false;
    scene.add(faces);

    // ---- bevelled metal rails: every triangle gets its own inset frame, so
    // neighbouring panels show two parallel rails with a dark gap between ----
    const railVerts = NT * 3 * 2 * 6; // 3 edges x 2 bevel quads x 6 verts
    const railPos = new Float32Array(railVerts * 3);
    const railGeo = new THREE.BufferGeometry();
    railGeo.setAttribute("position", new THREE.BufferAttribute(railPos, 3));
    const gold = new THREE.Color(params.edge);
    const railMat = new THREE.MeshStandardMaterial({
      color: gold.clone().lerp(new THREE.Color(0.5, 0.3, 0.15), 0.3),
      metalness: 1,
      roughness: 0.62,
      flatShading: true,
      side: THREE.DoubleSide,
      envMapIntensity: 0.4,
      emissive: gold.clone().multiplyScalar(0.06),
    });
    const rails = new THREE.Mesh(railGeo, railMat);
    rails.frustumCulled = false;
    scene.add(rails);
    const fill = new THREE.DirectionalLight(new THREE.Color(params.envTint), 0.6);
    fill.position.set(-4, 6, 8);
    scene.add(fill);

    // ---- vertex hubs ----
    const hubGeo = new THREE.IcosahedronGeometry(HUB_R * SPACING, 1);
    const hubs = new THREE.InstancedMesh(hubGeo, railMat, NV);
    hubs.frustumCulled = false;
    hubs.visible = false; // the reference has no hub nodes

    // ---- sparkles ----
    const NS = sparks.length;
    const sPos = new Float32Array(NS * 3);
    const sSize = new Float32Array(NS);
    const sCol = new Float32Array(NS * 3);
    const sGeo = new THREE.BufferGeometry();
    sGeo.setAttribute("position", new THREE.BufferAttribute(sPos, 3));
    sGeo.setAttribute("size", new THREE.BufferAttribute(sSize, 1));
    sGeo.setAttribute("pcolor", new THREE.BufferAttribute(sCol, 3));
    const sp = new THREE.Points(sGeo, glowPointsMaterial(height, { sharp: 0.3 }));
    sp.frustumCulled = false;
    scene.add(sp);
    const sparkCol = hdrColor(params.sparkle, 1);

    const vx = new Float32Array(NV * 3);
    const vn = new Float32Array(NV * 3); // approximate vertex normals
    const A = new THREE.Vector3(), B = new THREE.Vector3(), C = new THREE.Vector3(), N = new THREE.Vector3();
    const U = new THREE.Vector3(), W = new THREE.Vector3(), M = new THREE.Vector3();
    const m4 = new THREE.Matrix4(), q = new THREE.Quaternion(), one = new THREE.Vector3(1, 1, 1);
    const ins = [new THREE.Vector3(), new THREE.Vector3(), new THREE.Vector3()];
    const mid = [new THREE.Vector3(), new THREE.Vector3(), new THREE.Vector3()];
    const inn = [new THREE.Vector3(), new THREE.Vector3(), new THREE.Vector3()];

    // inset of corner P (neighbours Q, R) by distance d inside the triangle plane
    const inset = (out: THREE.Vector3, P: THREE.Vector3, Q: THREE.Vector3, R: THREE.Vector3, d: number) => {
      U.subVectors(Q, P);
      const lq = U.length();
      U.divideScalar(lq);
      W.subVectors(R, P);
      const lr = W.length();
      W.divideScalar(lr);
      M.addVectors(U, W).normalize();
      const sinHalf = Math.max(0.15, new THREE.Vector3().crossVectors(U, M).length());
      out.copy(P).addScaledVector(M, Math.min(d / sinHalf, 0.42 * Math.min(lq, lr)));
    };

    const update = (frame: number) => {
      const t = (frame % period) / period; // 0..1, loops
      const c = Math.cos(TAU * t), s = Math.sin(TAU * t);

      // camera on a closed path, close to the bulge
      camera.position.set(0.35 * Math.sin(TAU * t), 0.2 * Math.sin(TAU * 2 * t + 0.6), 8.6 + 0.2 * Math.cos(TAU * t));
      camera.lookAt(0.2 * Math.sin(TAU * t + 1.2), 0.1 * Math.cos(TAU * t), 0);

      // vertex displacement: noise sampled around a circle in time
      const R1 = 0.55, R2 = 0.3;
      for (let i = 0; i < NV; i++) {
        const x = base[i * 2], y = base[i * 2 + 1];
        vx[i * 3] = x;
        vx[i * 3 + 1] = y;
        vx[i * 3 + 2] =
          surfZ(x, y) + 0.7 * noise(x * 0.55, y * 0.55, R1 * c, R1 * s) + 0.6 * noise2(x * 0.15 + 3.1, y * 0.15, R2 * c, R2 * s);
      }
      for (let i = 0; i < tri.length; i++) {
        facePos[i * 3] = vx[tri[i] * 3];
        facePos[i * 3 + 1] = vx[tri[i] * 3 + 1];
        facePos[i * 3 + 2] = vx[tri[i] * 3 + 2];
      }
      faceGeo.attributes.position.needsUpdate = true;
      faceGeo.computeVertexNormals();

      vn.fill(0);
      let o = 0;
      const push = (v: THREE.Vector3) => { railPos[o++] = v.x; railPos[o++] = v.y; railPos[o++] = v.z; };
      for (let f = 0; f < NT; f++) {
        const ia = tri[f * 3], ib = tri[f * 3 + 1], ic = tri[f * 3 + 2];
        A.fromArray(vx, ia * 3); B.fromArray(vx, ib * 3); C.fromArray(vx, ic * 3);
        N.subVectors(B, A).cross(W.subVectors(C, A)).normalize();
        if (N.z < 0) N.negate();
        for (const i of [ia, ib, ic]) { vn[i * 3] += N.x; vn[i * 3 + 1] += N.y; vn[i * 3 + 2] += N.z; }
        const P = [A, B, C];
        for (let k = 0; k < 3; k++) {
          const p = P[k], q1 = P[(k + 1) % 3], q2 = P[(k + 2) % 3];
          inset(ins[k], p, q1, q2, GAP * SPACING);
          inset(mid[k], p, q1, q2, (GAP + RAIL * 0.5) * SPACING);
          mid[k].addScaledVector(N, RIDGE * SPACING);
          inset(inn[k], p, q1, q2, (GAP + RAIL) * SPACING);
          ins[k].addScaledVector(N, 0.004);
          inn[k].addScaledVector(N, 0.004);
        }
        for (let k = 0; k < 3; k++) {
          const k2 = (k + 1) % 3;
          // outer bevel quad
          push(ins[k]); push(ins[k2]); push(mid[k2]);
          push(ins[k]); push(mid[k2]); push(mid[k]);
          // inner bevel quad
          push(mid[k]); push(mid[k2]); push(inn[k2]);
          push(mid[k]); push(inn[k2]); push(inn[k]);
        }
      }
      railGeo.attributes.position.needsUpdate = true;
      railGeo.computeVertexNormals();

      for (let i = 0; i < NV; i++) {
        N.fromArray(vn, i * 3).normalize();
        A.fromArray(vx, i * 3).addScaledVector(N, RIDGE * SPACING * 0.4);
        m4.compose(A, q.identity(), one);
        hubs.setMatrixAt(i, m4);
      }
      hubs.instanceMatrix.needsUpdate = true;

      for (let i = 0; i < NS; i++) {
        const p = sparks[i];
        if (i < N_EDGE_SPARK || i >= N_EDGE_SPARK + N_FREE_SPARK) {
          const [a, b] = edges[p.e];
          const near = i >= N_EDGE_SPARK + N_FREE_SPARK;
          const u0 = near ? (p.u < 0.5 ? 0.02 + p.u * 0.12 : 0.98 - (1 - p.u) * 0.12) : p.u;
          const u = Math.min(0.99, Math.max(0.01, u0 + (near ? 0.02 : p.ua) * Math.sin(TAU * p.k * t + p.ph)));
          A.fromArray(vx, a * 3);
          B.fromArray(vx, b * 3);
          A.lerp(B, u);
          N.fromArray(vn, a * 3).add(C.fromArray(vn, b * 3)).normalize();
          A.addScaledVector(N, RIDGE * SPACING * 1.2);
          sPos[i * 3] = A.x; sPos[i * 3 + 1] = A.y; sPos[i * 3 + 2] = A.z;
        } else {
          const x = p.x + p.ax * Math.sin(TAU * p.kx * t + p.px), y = p.y + p.ay * Math.sin(TAU * p.ky * t + p.py);
          sPos[i * 3] = x; sPos[i * 3 + 1] = y; sPos[i * 3 + 2] = surfZ(x, y) + p.z;
        }
        const tw = Math.pow(0.5 + 0.5 * Math.sin(TAU * p.tk * t + p.tph), 3);
        const br = p.bright * (0.2 + 0.8 * tw);
        sSize[i] = p.size;
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
        bloom: { strength: 1.3, threshold: 0.6, knee: 0.5, radius: 0.5 },
        // focus on the crown of the bulge; the receding edges go soft
        dof: { focus: 6.4, range: 2.2, nearRange: 3, maxBlur: 0.012, maxNearBlur: 0.006 },
        grain: 0.02,
        grainPeriod: period,
        grade: { vignette: 0.55 },
      },
      dispose: () => {
        env.dispose();
        [faceGeo, railGeo, sGeo, hubGeo].forEach((g) => g.dispose());
      },
    };
  },
};
