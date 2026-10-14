import React, { useCallback } from "react";
import * as THREE from "three";
import { RoundedBoxGeometry } from "three/examples/jsm/geometries/RoundedBoxGeometry.js";
import { RoomEnvironment } from "three/examples/jsm/environments/RoomEnvironment.js";
import { ThreeStage, WorldFactory } from "../../lib/ThreeStage";
import { PostPipeline } from "../../lib/post";
import { mulberry32 } from "../../lib/random";
import { loopTheta } from "../../lib/loop";

export interface HeartPodiumProps {
  backdrop: string;
  podium: string;
  /** optional metallic rim on the podium steps */
  podiumRim: string | null;
  heart: string;
  heartMetal: boolean;
  box: string;
  ribbon: string;
  ribbonMetal: boolean;
}

// ---------- layout (module level, seeded) ----------
const BASE_R = 1.62, BASE_H = 0.42;
const TOP_R = 1.18, TOP_H = 0.28;

interface BoxSpec { x: number; z: number; w: number; h: number; d: number; rot: number; y: number }
const boxes: BoxSpec[] = (() => {
  const rnd = mulberry32(0x91f7b003);
  const j = () => (rnd() - 0.5) * 0.06;
  // left group (5) and right group (3), sizes like the reference
  const L: BoxSpec[] = [
    { x: -2.62, z: 0.25, w: 0.62, h: 0.34, d: 0.5, rot: 0.15, y: 0 },
    { x: -2.15, z: -0.25, w: 0.52, h: 0.5, d: 0.5, rot: -0.2, y: 0 },
    { x: -3.0, z: 0.5, w: 0.42, h: 0.26, d: 0.38, rot: -0.35, y: 0 },
    { x: -2.05, z: 0.55, w: 0.42, h: 0.18, d: 0.36, rot: 0.25, y: 0 },
    { x: -1.72, z: 0.8, w: 0.3, h: 0.16, d: 0.28, rot: -0.1, y: 0 },
  ];
  const R: BoxSpec[] = [
    { x: 2.6, z: -0.3, w: 0.5, h: 0.52, d: 0.5, rot: 0.3, y: 0 },
    { x: 2.12, z: 0.5, w: 0.3, h: 0.3, d: 0.3, rot: -0.25, y: 0 },
  ];
  const S = 1.2;
  return [...L, ...R].map((b) => ({ ...b, w: b.w * S, h: b.h * S, d: b.d * S, y: b.y * S, x: b.x * 1.08 + j(), z: b.z + j(), rot: b.rot + j() }));
})();

interface HeartSpec { x: number; y: number; z: number; s: number; tilt: number; cyc: number; ph: number; turnCyc: number; turnPh: number; yaw0: number }
const hearts: HeartSpec[] = [
  { x: -1.65, y: 1.8, z: 0.35, s: 0.66, tilt: 0.35, cyc: 1, ph: 0.0, turnCyc: 1, turnPh: 0.1, yaw0: 0.25 },
  { x: 1.0, y: 3.5, z: -0.4, s: 0.46, tilt: -0.3, cyc: 2, ph: 0.35, turnCyc: 1, turnPh: 0.6, yaw0: -0.3 },
  { x: 1.95, y: 1.15, z: 0.2, s: 0.5, tilt: -0.4, cyc: 1, ph: 0.6, turnCyc: 1, turnPh: 0.3, yaw0: -1.05 },
];

// Puffy heart: a sphere whose silhouette is remapped (in polar coordinates) to
// the classic heart curve, so it stays smooth and rounded like a pillow.
const heartGeometry = () => {
  // polar radius of the heart outline, sampled from the parametric curve
  const SAMPLES = 2048;
  const ang: number[] = [];
  const rad: number[] = [];
  const cy = 0.1;
  for (let i = 0; i < SAMPLES; i++) {
    const t = (i / SAMPLES) * Math.PI * 2;
    const x = (16 * Math.pow(Math.sin(t), 3)) / 17;
    const y = (13 * Math.cos(t) - 5 * Math.cos(2 * t) - 2 * Math.cos(3 * t) - Math.cos(4 * t)) / 17 + cy;
    ang.push(Math.atan2(y, x));
    rad.push(Math.hypot(x, y));
  }
  const BINS = 720;
  const table = new Float32Array(BINS).fill(0);
  for (let i = 0; i < SAMPLES; i++) {
    const k = Math.floor(((ang[i] + Math.PI) / (Math.PI * 2)) * BINS) % BINS;
    table[k] = Math.max(table[k], rad[i]);
  }
  // fill empty bins / smooth lightly
  for (let pass = 0; pass < 2; pass++) {
    for (let k = 0; k < BINS; k++) {
      if (table[k] === 0) table[k] = Math.max(table[(k + BINS - 1) % BINS], table[(k + 1) % BINS]);
    }
  }
  const sm = new Float32Array(BINS);
  for (let k = 0; k < BINS; k++) {
    let acc = 0;
    for (let o = -28; o <= 28; o++) acc += table[(k + o + BINS) % BINS];
    sm[k] = acc / 57;
  }
  const rOf = (phi: number) => {
    const f = ((phi + Math.PI) / (Math.PI * 2)) * BINS;
    const k0 = Math.floor(f) % BINS, k1 = (k0 + 1) % BINS;
    const u = f - Math.floor(f);
    return sm[k0] * (1 - u) + sm[k1] * u;
  };
  const g = new THREE.SphereGeometry(1, 160, 120);
  const p = g.attributes.position as THREE.BufferAttribute;
  // sphere's pole axis is y; rotate so the "puff" axis is z
  for (let i = 0; i < p.count; i++) {
    const sx = p.getX(i), sy = p.getZ(i), sz = p.getY(i);
    const phi = Math.atan2(sy, sx);
    const R = rOf(phi);
    // puff: flatter faces, rounded rim
    const z = 0.42 * Math.sign(sz) * Math.pow(Math.abs(sz), 0.9);
    p.setXYZ(i, R * sx, R * sy - cy, z);
  }
  g.computeVertexNormals();
  return g;
};

// seamless studio cove: floor → quarter circle → wall, extruded along x
const coveGeometry = (width: number) => {
  const prof: [number, number][] = []; // (z, y)
  const floorFront = 8, coveZ = -3.2, R = 3.0;
  const steps = 48;
  prof.push([floorFront, 0]);
  for (let i = 0; i <= steps; i++) {
    const a = (i / steps) * (Math.PI / 2);
    prof.push([coveZ - Math.sin(a) * R, R - Math.cos(a) * R]);
  }
  prof.push([coveZ - R, 14]);
  const xs = 40;
  const pos: number[] = [];
  const idx: number[] = [];
  for (let i = 0; i < prof.length; i++) {
    for (let k = 0; k <= xs; k++) {
      pos.push((k / xs - 0.5) * width, prof[i][1], prof[i][0]);
    }
  }
  for (let i = 0; i < prof.length - 1; i++) {
    for (let k = 0; k < xs; k++) {
      const a = i * (xs + 1) + k, b = a + 1, c = a + xs + 1, d = c + 1;
      idx.push(a, b, c, b, d, c);
    }
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute("position", new THREE.Float32BufferAttribute(pos, 3));
  g.setIndex(idx);
  g.computeVertexNormals();
  return g;
};

const createWorld = (props: HeartPodiumProps): WorldFactory => (renderer, w, h) => {
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFShadowMap;
  const scene = new THREE.Scene();
  const backdrop = new THREE.Color(props.backdrop);
  scene.background = backdrop.clone();
  const pm = new THREE.PMREMGenerator(renderer);
  const envRT = pm.fromScene(new RoomEnvironment(), 0.04);
  pm.dispose();
  scene.environment = envRT.texture;
  scene.environmentIntensity = 0.55;

  const camera = new THREE.PerspectiveCamera(30, w / h, 0.1, 60);

  const cove = new THREE.Mesh(coveGeometry(60), new THREE.MeshStandardMaterial({ color: backdrop, roughness: 0.95, envMapIntensity: 0.6 }));
  cove.receiveShadow = true;
  scene.add(cove);

  // ---- podium ----
  const podiumMat = new THREE.MeshPhysicalMaterial({ color: new THREE.Color(props.podium), roughness: 0.4, sheen: 0.15, sheenRoughness: 0.5, sheenColor: new THREE.Color(props.podium).lerp(new THREE.Color(1, 1, 1), 0.3) });
  const base = new THREE.Mesh(new THREE.CylinderGeometry(BASE_R, BASE_R, BASE_H, 128), podiumMat);
  base.position.y = BASE_H / 2;
  const top = new THREE.Mesh(new THREE.CylinderGeometry(TOP_R, TOP_R, TOP_H, 128), podiumMat);
  top.position.y = BASE_H + TOP_H / 2;
  for (const m of [base, top]) {
    m.castShadow = true;
    m.receiveShadow = true;
    scene.add(m);
  }
  if (props.podiumRim) {
    const rimMat = new THREE.MeshStandardMaterial({ color: new THREE.Color(props.podiumRim), metalness: 1, roughness: 0.25 });
    for (const [r, y] of [[BASE_R, BASE_H], [TOP_R, BASE_H + TOP_H]] as const) {
      const rim = new THREE.Mesh(new THREE.TorusGeometry(r, 0.022, 16, 160), rimMat);
      rim.rotation.x = Math.PI / 2;
      rim.position.y = y - 0.012;
      rim.castShadow = true;
      scene.add(rim);
    }
  }

  // ---- gift boxes ----
  const boxMat = new THREE.MeshPhysicalMaterial({ color: new THREE.Color(props.box), roughness: 0.5, sheen: 0.2 });
  const ribbonMat = props.ribbonMetal
    ? new THREE.MeshStandardMaterial({ color: new THREE.Color(props.ribbon), metalness: 1, roughness: 0.3 })
    : new THREE.MeshPhysicalMaterial({ color: new THREE.Color(props.ribbon), metalness: 0.6, roughness: 0.34, sheen: 1, sheenRoughness: 0.3, sheenColor: new THREE.Color(1, 1, 1) });
  for (const b of boxes) {
    const g = new THREE.Group();
    const box = new THREE.Mesh(new RoundedBoxGeometry(b.w, b.h, b.d, 3, 0.015), boxMat);
    box.position.y = b.h / 2;
    g.add(box);
    const rw = Math.min(b.w, b.d) * 0.2;
    const s1 = new THREE.Mesh(new THREE.BoxGeometry(b.w + 0.012, b.h + 0.012, rw), ribbonMat);
    s1.position.y = b.h / 2;
    const s2 = new THREE.Mesh(new THREE.BoxGeometry(rw, b.h + 0.012, b.d + 0.012), ribbonMat);
    s2.position.y = b.h / 2;
    g.add(s1, s2);
    // bow: torus loops flattened into ribbon loops (two big, two small) + knot
    const bs = Math.max(b.w, b.d) * 0.8;
    // rosette: eight loops around the knot, alternating large and small
    const loops: [number, number, number][] = Array.from({ length: 8 }, (_, k) => [1, (k * Math.PI) / 4 + 0.2, k % 2 ? 0.7 : 0.95] as [number, number, number]);
    for (const [sx, yaw, sz] of loops) {
      const loop = new THREE.Mesh(new THREE.TorusGeometry(bs * 0.3 * sz, bs * 0.075, 10, 36), ribbonMat);
      loop.scale.set(1.15, 0.8, 0.32);
      const g2 = new THREE.Group();
      loop.position.set(sx * bs * 0.28 * sz, 0, 0);
      loop.rotation.z = sx * 0.35;
      g2.add(loop);
      g2.rotation.y = yaw;
      g2.position.y = b.h + bs * 0.17 * sz;
      g.add(g2);
    }
    const knot = new THREE.Mesh(new THREE.SphereGeometry(bs * 0.13, 16, 12), ribbonMat);
    knot.position.y = b.h + bs * 0.06;
    g.add(knot);
    g.traverse((o) => {
      o.castShadow = true;
      o.receiveShadow = true;
    });
    g.position.set(b.x, b.y, b.z);
    g.rotation.y = b.rot;
    scene.add(g);
  }

  // ---- hearts ----
  const hg = heartGeometry();
  const heartMat = props.heartMetal
    ? new THREE.MeshPhysicalMaterial({ color: new THREE.Color(props.heart), metalness: 1, roughness: 0.22, clearcoat: 1, clearcoatRoughness: 0.1 })
    : new THREE.MeshPhysicalMaterial({ color: new THREE.Color(props.heart), roughness: 0.42, clearcoat: 0.6, clearcoatRoughness: 0.35, sheen: 0.5, sheenRoughness: 0.5, sheenColor: new THREE.Color(1, 0.75, 0.8) });
  const heartMeshes = hearts.map((hs) => {
    const m = new THREE.Mesh(hg, heartMat);
    m.scale.setScalar(hs.s);
    scene.add(m);
    return m;
  });

  // ---- light ----
  // large soft key from the upper left; a spot so the backdrop falls off naturally
  const key = new THREE.SpotLight(0xfff6f0, 320, 0, Math.PI / 5, 1.0, 2);
  key.position.set(-7, 9.5, 7.5);
  key.target.position.set(0.5, 0.8, -0.5);
  key.castShadow = true;
  key.shadow.mapSize.set(2048, 2048);
  key.shadow.radius = 4;
  key.shadow.bias = -0.0004;
  key.shadow.normalBias = 0.02;
  key.shadow.camera.near = 4;
  key.shadow.camera.far = 30;
  scene.add(key, key.target);
  const hemi = new THREE.HemisphereLight(0xfff4f4, backdrop.clone().multiplyScalar(0.5), 0.55);
  scene.add(hemi);

  const post = new PostPipeline(w, h, {
    samples: 4,
    ssao: { radius: 0.35, intensity: 1.4, strength: 0.75, bias: 0.01 },
    final: { exposure: 0.64, tone: "neutral", grain: 0.015, vignette: 0.14, saturation: 0.8 },
  });

  const camTarget = new THREE.Vector3(0, 1.68, 0);
  return {
    update: (frame) => {
      const th = loopTheta(frame);
      // eye level with the podium top, slow closed dolly ±3%
      const dist = 9.4 * (1 + 0.03 * Math.sin(th));
      camera.position.set(0, 0.95, dist);
      camera.lookAt(camTarget);
      camera.updateMatrixWorld();
      hearts.forEach((hs, i) => {
        const m = heartMeshes[i];
        const bob = 0.12 * Math.sin(th * hs.cyc + hs.ph * Math.PI * 2);
        m.position.set(hs.x, hs.y + bob, hs.z);
        const yaw = hs.yaw0 + (25 * Math.PI) / 180 * Math.sin(th * hs.turnCyc + hs.turnPh * Math.PI * 2);
        m.rotation.set(0.08 * Math.sin(th * hs.cyc + 1.0), yaw, hs.tilt);
      });
    },
    render: (r, lf) => post.render(r, scene, camera, lf),
    dispose: () => {
      post.dispose();
      envRT.dispose();
    },
  };
};

export const HeartPodium: React.FC<HeartPodiumProps> = (props) => {
  // eslint-disable-next-line react-hooks/exhaustive-deps
  const factory = useCallback(createWorld(props), [JSON.stringify(props)]);
  return <ThreeStage factory={factory} />;
};
