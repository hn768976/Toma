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

/** Sweat glands [x, z] on the cut faces, and their height in the dermis. */
export const GLANDS: [number, number][] = [
  [-0.35, HALF],
  [1.0, HALF],
  [1.6, HALF],
  [HALF, 0.5],
];
export const GLAND_Y = -0.3;

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
  scene.add(new THREE.HemisphereLight(0xffffff, 0xf6e6dc, 1.7));
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
      color: 0xeec04a,
      roughness: 0.6,
    }),
    dermis: new THREE.MeshStandardMaterial({
      color: 0xffb070,
      map: mottA,
      roughness: 0.5,
    }),
    basal: new THREE.MeshStandardMaterial({
      color: 0xe07088,
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
  const stretchers: { mesh: THREE.Mesh; tipY: number; rootY: number }[] = [];
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
      col.setHSL(0.128 + rnd() * 0.02, 0.92, 0.55 + rnd() * 0.12);
      inst.setColorAt(i, col);
    }
    inst.instanceMatrix.needsUpdate = true;
    groups.hypodermis.add(inst);
  }

  // ---------- blood vessels: a lattice on the dermis faces ----------
  {
    const rnd = makeRng(301);
    const addTube = (
      pts: THREE.Vector3[],
      closed: boolean,
      color: number,
      radius: number,
      segs: number,
    ) => {
      const curve = new THREE.CatmullRomCurve3(pts, closed, "catmullrom", 0.5);
      const geo = track(new THREE.TubeGeometry(curve, segs, radius, 10, closed));
      const mat = track(
        new THREE.MeshStandardMaterial({ color, roughness: 0.28 }),
      );
      groups.dermis.add(new THREE.Mesh(geo, mat));
    };
    const network = (
      color: number,
      radius: number,
      inset: number,
      yTop: number,
      yBot: number,
      links: number,
      shift: number,
    ) => {
      const rail = (yBase: number, amp: number) => {
        const pts: THREE.Vector3[] = [];
        const n = 64;
        const p1 = rnd() * 6.28;
        const p2 = rnd() * 6.28;
        const yAt = (u: number) => {
          const a = u * Math.PI * 2;
          return (
            yBase +
            amp * (0.65 * Math.sin(a * 9 + p1) + 0.35 * Math.sin(a * 17 + p2))
          );
        };
        for (let i = 0; i < n; i++) {
          const [x, z] = perimeter(i / n, inset);
          pts.push(new THREE.Vector3(x, yAt(i / n), z));
        }
        addTube(pts, true, color, radius, 560);
        return yAt;
      };
      const top = rail(yTop, 0.07);
      const bot = rail(yBot, 0.08);
      // wiggly vertical links between the two rails
      for (let k = 0; k < links; k++) {
        const u0 = (k + shift + (rnd() - 0.5) * 0.5) / links;
        const pts: THREE.Vector3[] = [];
        const steps = 5;
        let u = u0;
        for (let i = 0; i <= steps; i++) {
          const f = i / steps;
          if (i > 0 && i < steps) u += (rnd() - 0.5) * 0.016;
          const [x, z] = perimeter(u, inset);
          const y = top(u0) + (bot(u0) - top(u0)) * f;
          pts.push(new THREE.Vector3(x, y, z));
        }
        addTube(pts, false, color, radius * 0.9, 40);
      }
    };
    network(0x2456e0, 0.029, 0.03, 0.2, -0.42, 15, 0);
    network(0xe3202c, 0.02, 0.045, 0.12, -0.33, 15, 0.5);
  }

  // ---------- hairs, sweat glands and ducts ----------
  {
    const rnd = makeRng(4242);
    const hairMat = track(
      new THREE.MeshStandardMaterial({ color: 0x15100e, roughness: 0.3 }),
    );
    const glandMat = track(
      new THREE.MeshStandardMaterial({ color: 0x8a5a2c, roughness: 0.7 }),
    );
    const glandGeo = track(new THREE.IcosahedronGeometry(1, 1));
    // [x, z]: four loose clusters; a few sit on the two visible cut faces
    const roots: [number, number][] = [
      [-1.25, 2.0],
      [0.45, 2.0],
      [2.0, -1.2],
      [-1.55, 0.7],
      [-1.2, -0.6],
      [-0.5, 0.9],
      [-0.25, -0.9],
      [0.05, 0.1],
      [0.75, -1.3],
      [1.0, 0.5],
      [1.25, -0.4],
      [1.45, 1.2],
      [1.7, -1.6],
    ];
    for (const [rx, rz] of roots) {
      // hairs on a cut face sit just proud of it so the shaft reads in section
      const x = rx === HALF ? rx + 0.04 : rx;
      const z = rz === HALF ? rz + 0.04 : rz;
      const lean = 0.12 + rnd() * 0.2;
      const leanZ = rz === HALF ? 0 : -0.1 - rnd() * 0.2;
      const len = 2.3 + rnd() * 0.35;
      const y0 = -0.28 + rnd() * 0.12;
      const curve = new THREE.CatmullRomCurve3([
        new THREE.Vector3(x - lean * 0.1, y0, z),
        new THREE.Vector3(x, y0 + len * 0.3, z + leanZ * 0.1),
        new THREE.Vector3(x + lean * 0.4, y0 + len * 0.68, z + leanZ * 0.5),
        new THREE.Vector3(x + lean * 1.0, y0 + len, z + leanZ),
      ]);
      // thick rounded root, long fine taper
      const geo = track(
        taperedTube(
          curve,
          48,
          10,
          (u) => 0.036 * (1 - 0.82 * Math.pow(u, 1.6)) + 0.003,
        ),
      );
      const mesh = new THREE.Mesh(geo, hairMat);
      // tips stay fixed while the roots follow the dermis downwards
      stretchers.push({ mesh, tipY: y0 + len, rootY: y0 });
      scene.add(mesh);
      const bulb = new THREE.Mesh(glandGeo, hairMat);
      bulb.scale.set(0.05, 0.065, 0.05);
      bulb.position.set(x - lean * 0.1, y0, z);
      groups.dermis.add(bulb);
    }

    // coiled sweat glands low in the dermis, each with a duct to the surface
    for (const [gx, gz] of GLANDS) {
      const x = gx === HALF ? gx + 0.03 : gx;
      const z = gz === HALF ? gz + 0.03 : gz;
      for (let i = 0; i < 16; i++) {
        const b = new THREE.Mesh(glandGeo, glandMat);
        b.scale.setScalar(0.035 + rnd() * 0.03);
        b.position.set(
          x + (rnd() - 0.5) * 0.2 * (gx === HALF ? 0.2 : 1),
          GLAND_Y + (rnd() - 0.5) * 0.2,
          z + (rnd() - 0.5) * 0.2 * (gz === HALF ? 0.2 : 1),
        );
        groups.dermis.add(b);
      }
      const pts: THREE.Vector3[] = [];
      const tipY = 0.8;
      for (let i = 0; i <= 8; i++) {
        const f = i / 8;
        const wig = 0.035 * Math.sin(f * 14 + gx * 3) * (1 - f);
        pts.push(
          new THREE.Vector3(
            x + (gz === HALF ? wig : 0),
            GLAND_Y + (tipY - GLAND_Y) * f,
            z + (gx === HALF ? wig : 0),
          ),
        );
      }
      const duct = new THREE.Mesh(
        track(
          new THREE.TubeGeometry(new THREE.CatmullRomCurve3(pts), 60, 0.014, 6),
        ),
        glandMat,
      );
      stretchers.push({ mesh: duct, tipY, rootY: GLAND_Y });
      scene.add(duct);
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
    const geo = track(new THREE.PlaneGeometry(9.5, 9.5));
    const plane = new THREE.Mesh(geo, mat);
    plane.rotation.x = -Math.PI / 2;
    plane.position.set(-0.1, -2.3, -0.2);
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
      for (const h of stretchers) {
        const s = (h.tipY - (h.rootY + drop)) / (h.tipY - h.rootY);
        h.mesh.scale.y = s;
        h.mesh.position.y = h.tipY * (1 - s);
      }
    },
    dispose: () => disposables.forEach((d) => d.dispose()),
  };
};
