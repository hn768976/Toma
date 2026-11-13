import * as THREE from "three";
import { HALF, interfaces, layerById, LAYERS, LayerId } from "./layers";
import { slabGeometry } from "./slab";
import {
  mottledTexture,
  muscleTexture,
  shadowTexture,
  squamousTexture,
} from "./textures";
import { makeRng, taperedTube } from "./util";

export type SkinScene = {
  scene: THREE.Scene;
  /** e: 0 = stacked, 1 = exploded */
  setExplode: (e: number) => void;
  dispose: () => void;
};

/** Point on the block perimeter (slightly outside the faces). u in [0,1). */
const perimeter = (u: number, inset: number) => {
  const h = HALF + inset;
  const s = (((u % 1) + 1) % 1) * 4;
  const k = s % 1;
  const a = -h + k * 2 * h;
  switch (Math.floor(s)) {
    case 0:
      return [a, h]; // front (+z), left to right
    case 1:
      return [h, -a]; // right (+x), front to back
    case 2:
      return [-a, -h]; // back
    default:
      return [-h, a]; // left
  }
};

export const buildSkinScene = (): SkinScene => {
  const scene = new THREE.Scene();
  const disposables: { dispose: () => void }[] = [];
  const track = <T extends { dispose: () => void }>(o: T) => {
    disposables.push(o);
    return o;
  };

  // ---------- lights ----------
  scene.add(new THREE.HemisphereLight(0xffffff, 0xf3e3da, 1.5));
  const key = new THREE.DirectionalLight(0xffffff, 2.1);
  key.position.set(-3, 9, 7);
  scene.add(key);
  const fill = new THREE.DirectionalLight(0xfff1e6, 0.95);
  fill.position.set(9, 3, 2);
  scene.add(fill);

  // ---------- layer slabs ----------
  const mottA = track(mottledTexture(5, 1));
  const mottB = track(mottledTexture(9, 0.6));
  const musTex = track(muscleTexture());
  const sqTex = track(squamousTexture());
  sqTex.repeat.set(1.6, 1.6);
  musTex.repeat.set(1, 2.2);

  const mats: Record<LayerId, THREE.MeshStandardMaterial> = {
    muscle: new THREE.MeshStandardMaterial({
      color: 0xffffff,
      map: musTex,
      roughness: 0.42,
    }),
    hypodermis: new THREE.MeshStandardMaterial({
      color: 0xecc85a,
      roughness: 0.6,
    }),
    dermis: new THREE.MeshStandardMaterial({
      color: 0xffb685,
      map: mottA,
      roughness: 0.5,
    }),
    basal: new THREE.MeshStandardMaterial({
      color: 0xc03a58,
      map: mottB,
      roughness: 0.45,
    }),
    squamous: new THREE.MeshStandardMaterial({
      color: 0xffffff,
      map: sqTex,
      bumpMap: sqTex,
      bumpScale: 1.2,
      roughness: 0.55,
    }),
    corneum: new THREE.MeshStandardMaterial({
      color: 0xf0bd98,
      map: mottB,
      roughness: 0.6,
      transparent: true,
      opacity: 0.93,
    }),
  };

  const groups = {} as Record<LayerId, THREE.Group>;
  const hairs: { mesh: THREE.Mesh; tipY: number; rootY: number }[] = [];
  for (const layer of LAYERS) {
    const g = new THREE.Group();
    const geo = track(
      slabGeometry(interfaces[layer.index], interfaces[layer.index + 1]),
    );
    const mesh = new THREE.Mesh(geo, track(mats[layer.id]));
    if (layer.id === "corneum") mesh.renderOrder = 5;
    g.add(mesh);
    groups[layer.id] = g;
    scene.add(g);
  }

  // ---------- adipose globules ----------
  {
    const rnd = makeRng(77);
    const count = 6200;
    const geo = track(new THREE.IcosahedronGeometry(1, 1));
    const mat = track(
      new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.38 }),
    );
    const inst = new THREE.InstancedMesh(geo, mat, count);
    const m = new THREE.Matrix4();
    const q = new THREE.Quaternion();
    const col = new THREE.Color();
    const bot = interfaces[1];
    const top = interfaces[2];
    for (let i = 0; i < count; i++) {
      let x: number, y: number, z: number;
      const r = 0.032 + rnd() * 0.034;
      const pick = rnd();
      if (pick < 0.42) {
        x = (rnd() * 2 - 1) * HALF;
        z = (rnd() * 2 - 1) * HALF;
        y = top(x, z) - r * 0.3;
      } else if (pick < 0.55) {
        x = (rnd() * 2 - 1) * HALF;
        z = (rnd() * 2 - 1) * HALF;
        y = bot(x, z) + r * 0.3;
      } else {
        [x, z] = perimeter(rnd(), -0.03);
        const k = rnd();
        y = bot(x, z) + (top(x, z) - bot(x, z)) * k;
      }
      m.compose(
        new THREE.Vector3(x, y, z),
        q,
        new THREE.Vector3(r, r * (0.8 + rnd() * 0.3), r),
      );
      inst.setMatrixAt(i, m);
      col.setHSL(0.13 + rnd() * 0.02, 0.88, 0.58 + rnd() * 0.12);
      inst.setColorAt(i, col);
    }
    inst.instanceMatrix.needsUpdate = true;
    groups.hypodermis.add(inst);
  }

  // ---------- blood vessels (attached to the dermis) ----------
  {
    const rnd = makeRng(301);
    const addLoop = (
      color: number,
      radius: number,
      yBase: number,
      amp: number,
      inset: number,
      freq: number,
    ) => {
      const pts: THREE.Vector3[] = [];
      const n = 56;
      const p1 = rnd() * 6.28;
      const p2 = rnd() * 6.28;
      const p3 = rnd() * 6.28;
      for (let i = 0; i < n; i++) {
        const u = i / n;
        const [x, z] = perimeter(u, inset);
        const a = u * Math.PI * 2;
        const y =
          yBase +
          amp *
            (0.6 * Math.sin(a * freq + p1) +
              0.3 * Math.sin(a * (freq * 2 + 1) + p2) +
              0.25 * Math.sin(a * (freq * 3 + 2) + p3));
        pts.push(new THREE.Vector3(x, y, z));
      }
      const curve = new THREE.CatmullRomCurve3(pts, true, "catmullrom", 0.5);
      const geo = track(new THREE.TubeGeometry(curve, 520, radius, 10, true));
      const mat = track(
        new THREE.MeshStandardMaterial({ color, roughness: 0.28 }),
      );
      groups.dermis.add(new THREE.Mesh(geo, mat));
    };
    const blue = 0x2456e0;
    const red = 0xe3202c;
    addLoop(blue, 0.027, 0.1, 0.22, 0.035, 5);
    addLoop(blue, 0.027, -0.18, 0.27, 0.04, 7);
    addLoop(blue, 0.025, -0.46, 0.16, 0.03, 6);
    addLoop(red, 0.019, 0.14, 0.22, 0.05, 6);
    addLoop(red, 0.019, -0.12, 0.27, 0.055, 8);
    addLoop(red, 0.018, -0.36, 0.22, 0.045, 5);
  }

  // ---------- hairs + follicles (attached to the dermis) ----------
  {
    const rnd = makeRng(4242);
    const hairMat = track(
      new THREE.MeshStandardMaterial({ color: 0x15100e, roughness: 0.3 }),
    );
    const bulbMat = track(
      new THREE.MeshStandardMaterial({ color: 0x8a5a2c, roughness: 0.7 }),
    );
    const bulbGeo = track(new THREE.IcosahedronGeometry(1, 1));
    // [x, z]: several sit on the two visible cut faces
    const roots: [number, number][] = [
      [-1.35, 2.0],
      [-0.25, 2.0],
      [0.9, 2.0],
      [1.55, 2.0],
      [2.0, 1.1],
      [2.0, -0.2],
      [2.0, -1.3],
      [-1.5, 0.9],
      [-0.9, -0.5],
      [-0.2, 0.7],
      [0.5, -1.2],
      [1.2, 0.4],
      [1.4, -1.0],
      [-0.7, 1.4],
    ];
    for (const [rx, rz] of roots) {
      // hairs on a cut face sit just proud of it so the shaft reads in section
      const x = rx === HALF ? rx + 0.035 : rx;
      const z = rz === HALF ? rz + 0.035 : rz;
      const lean = 0.1 + rnd() * 0.24;
      const leanZ = rz === HALF ? 0 : -0.1 - rnd() * 0.25;
      const len = 2.27 + rnd() * 0.45;
      const y0 = -0.42 + rnd() * 0.12;
      const curve = new THREE.CatmullRomCurve3([
        new THREE.Vector3(x - lean * 0.12, y0, z),
        new THREE.Vector3(x, y0 + len * 0.3, z + leanZ * 0.1),
        new THREE.Vector3(x + lean * 0.4, y0 + len * 0.68, z + leanZ * 0.5),
        new THREE.Vector3(x + lean * 1.0, y0 + len, z + leanZ),
      ]);
      const geo = track(
        taperedTube(curve, 40, 8, (u) => 0.037 * (1 - 0.75 * u * u) + 0.002),
      );
      const hairMesh = new THREE.Mesh(geo, hairMat);
      // tips stay fixed while the roots follow the dermis downwards
      hairs.push({ mesh: hairMesh, tipY: y0 + len, rootY: y0 });
      scene.add(hairMesh);
      // knobbly follicle bulb / sweat gland at the root
      const onFace = rx === HALF || rz === HALF;
      if (onFace || rnd() > 0.5) {
        const n = 9;
        for (let i = 0; i < n; i++) {
          const b = new THREE.Mesh(bulbGeo, bulbMat);
          const r = 0.04 + rnd() * 0.035;
          b.scale.setScalar(r);
          b.position.set(
            x - lean * 0.12 + (rnd() - 0.5) * 0.14 + (rx === HALF ? 0.02 : 0),
            y0 - 0.02 + (rnd() - 0.5) * 0.16,
            z + (rnd() - 0.5) * 0.14 + (rz === HALF ? 0.02 : 0),
          );
          groups.dermis.add(b);
        }
      }
    }
  }

  // ---------- contact shadow ----------
  {
    const tex = track(shadowTexture());
    const mat = track(
      new THREE.MeshBasicMaterial({
        map: tex,
        transparent: true,
        depthWrite: false,
      }),
    );
    const geo = track(new THREE.PlaneGeometry(8.5, 8.5));
    const plane = new THREE.Mesh(geo, mat);
    plane.rotation.x = -Math.PI / 2;
    plane.position.set(0.5, -2.45, -0.3);
    plane.renderOrder = -1;
    scene.add(plane);
  }

  return {
    scene,
    setExplode: (e) => {
      for (const layer of LAYERS) {
        groups[layer.id].position.y = layer.offset * e;
      }
      const drop = layerById("dermis").offset * e;
      for (const h of hairs) {
        const s = (h.tipY - (h.rootY + drop)) / (h.tipY - h.rootY);
        h.mesh.scale.y = s;
        h.mesh.position.y = h.tipY * (1 - s);
      }
    },
    dispose: () => disposables.forEach((d) => d.dispose()),
  };
};
