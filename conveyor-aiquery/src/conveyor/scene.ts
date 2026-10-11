import * as THREE from "three";
import { mulberry32, range, type Rng } from "../lib/random";
import { makeDecalAtlas, makeKraft, makeRollerTex, makeTape } from "./textures";
import { FACE, makeParcel, randomKind, type ParcelGeo, type ParcelKind } from "./parcels";

// ---------------------------------------------------------------- layout --
// Everything along the belt (x) repeats with period L. Boxes travel exactly
// L in LOOP frames, so frame LOOP == frame 0.
export const L = 6.0;
export const LOOP = 600;
export const SPEED = L / LOOP; // metres per frame
export const BELT_Y = 0.8; // top of rollers
export const BELT_W = 0.6;
export const PITCH = 0.075; // 80 rollers per period
// L must be a whole number of roller circumferences: 38 turns per loop.
export const ROLLER_TURNS = 38;
export const ROLLER_R = L / (2 * Math.PI * ROLLER_TURNS); // 0.02513 m
export const LINE2_Z = -3.0;
export const RACK_Z = -5.2;

export const COL = {
  steel: new THREE.Color("#3A3C40"),
  rail: new THREE.Color("#3a3d42"),
  upright: new THREE.Color("#2A3A6A"),
  beam: new THREE.Color("#B8502A"),
  haze: new THREE.Color("#B8A890"),
  key: new THREE.Color("#FFE8C8"),
};

export interface PlacedParcel {
  geo: ParcelGeo;
  x0: number; // position in [0, L) at frame 0
  z: number;
  rotY: number;
  footX: number;
}

// Sequential placement along one period with random gaps; the pattern wraps.
export const layoutLine = (seed: number, opts: { gapMin: number; gapMax: number; kinds?: (rng: Rng) => ParcelKind; zJitter: number; force?: Record<number, ParcelKind>; lowpoly?: boolean }): PlacedParcel[] => {
  const rng = mulberry32(seed);
  const out: PlacedParcel[] = [];
  let x = range(rng, 0, 0.2);
  for (let guard = 0; guard < 60; guard++) {
    const drawn = (opts.kinds ?? randomKind)(rng);
    const kind = opts.force?.[guard] ?? drawn;
    const pseed = Math.floor(rng() * 1e9);
    const quarter = Math.floor(rng() * 4);
    // local face that ends up facing +z (the side-view camera) after the turn
    const front = [FACE.pz, FACE.nx, FACE.nz, FACE.px][quarter];
    const geo = makeParcel(kind, pseed, { front, lowpoly: opts.lowpoly && kind !== "mailer" });
    const yaw = (rng() - 0.5) * ((4 * Math.PI) / 180); // +-2 deg
    const footX = quarter % 2 === 0 ? geo.size[0] : geo.size[2];
    const footZ = quarter % 2 === 0 ? geo.size[2] : geo.size[0];
    if (x + footX + opts.gapMin > L) break;
    const zr = Math.max(0, (BELT_W - 0.04 - footZ) / 2);
    out.push({ geo, x0: x + footX / 2, z: (rng() * 2 - 1) * Math.min(zr, opts.zJitter), rotY: (quarter * Math.PI) / 2 + yaw, footX });
    x += footX + range(rng, opts.gapMin, opts.gapMax);
  }
  return out;
};

// ------------------------------------------------------------- materials --
export interface Mats {
  kraft: THREE.MeshStandardMaterial;
  tape: THREE.MeshStandardMaterial;
  paper: THREE.MeshStandardMaterial;
  ink: THREE.MeshStandardMaterial;
  roller: THREE.MeshStandardMaterial;
  rail: THREE.MeshStandardMaterial;
  nut: THREE.MeshStandardMaterial;
  frame: THREE.MeshStandardMaterial;
  upright: THREE.MeshStandardMaterial;
  beam: THREE.MeshStandardMaterial;
}

export const makeMaterials = (): Mats => {
  const kr = makeKraft(1701);
  const tp = makeTape(1702);
  const atlas = makeDecalAtlas(1703);
  const rollerTex = makeRollerTex(1704);
  return {
    kraft: new THREE.MeshStandardMaterial({ map: kr.color, roughnessMap: kr.rough, normalMap: kr.normal, normalScale: new THREE.Vector2(0.25, 0.25), roughness: 1, metalness: 0, vertexColors: true }),
    tape: new THREE.MeshPhysicalMaterial({ map: tp.color, normalMap: tp.normal, normalScale: new THREE.Vector2(0.8, 0.8), roughness: 0.38, metalness: 0, clearcoat: 0.7, clearcoatRoughness: 0.18 }),
    paper: new THREE.MeshStandardMaterial({ map: atlas, roughness: 0.42, metalness: 0, transparent: true, depthWrite: false, polygonOffset: true, polygonOffsetFactor: -2, polygonOffsetUnits: -2 }),
    ink: new THREE.MeshStandardMaterial({ map: atlas, roughness: 0.85, metalness: 0, transparent: true, opacity: 0.85, depthWrite: false, polygonOffset: true, polygonOffsetFactor: -1, polygonOffsetUnits: -1 }),
    roller: new THREE.MeshStandardMaterial({ map: rollerTex, color: COL.steel.clone().multiplyScalar(1.6), metalness: 0.85, roughness: 0.35, vertexColors: true, envMapIntensity: 3.0 }),
    rail: new THREE.MeshStandardMaterial({ color: COL.rail, metalness: 0.55, roughness: 0.38 }),
    nut: new THREE.MeshStandardMaterial({ color: new THREE.Color("#8a8d92"), metalness: 0.9, roughness: 0.28 }),
    frame: new THREE.MeshStandardMaterial({ color: new THREE.Color("#2c2d30"), metalness: 0.4, roughness: 0.6 }),
    upright: new THREE.MeshStandardMaterial({ color: COL.upright, metalness: 0.3, roughness: 0.55 }),
    beam: new THREE.MeshStandardMaterial({ color: COL.beam.clone().lerp(new THREE.Color(0.35,0.3,0.27), 0.25), metalness: 0.25, roughness: 0.55 }),
  };
};

// --------------------------------------------------------- parcel meshes --
export const parcelGroup = (geo: ParcelGeo, m: Mats) => {
  const g = new THREE.Group();
  const add = (bg: THREE.BufferGeometry | null, mat: THREE.Material, shadow: boolean) => {
    if (!bg) return;
    const mesh = new THREE.Mesh(bg, mat);
    mesh.castShadow = shadow;
    mesh.receiveShadow = true;
    g.add(mesh);
  };
  add(geo.body, m.kraft, true);
  add(geo.tape, m.tape, false);
  add(geo.paper, m.paper, false);
  add(geo.ink, m.ink, false);
  return g;
};

// ------------------------------------------------------- conveyor build --
const rollerGeometry = () => {
  const r = ROLLER_R, w = BELT_W - 0.02, c = 0.0025;
  const pts = [
    new THREE.Vector2(0.006, -w / 2 - 0.012),
    new THREE.Vector2(0.006, -w / 2),
    new THREE.Vector2(r - c, -w / 2),
    new THREE.Vector2(r, -w / 2 + c),
    new THREE.Vector2(r, w / 2 - c),
    new THREE.Vector2(r - c, w / 2),
    new THREE.Vector2(0.006, w / 2),
    new THREE.Vector2(0.006, w / 2 + 0.012),
  ];
  const g = new THREE.LatheGeometry(pts, 28);
  // brighter bevelled ends (machined edge catches the light)
  const pos = g.getAttribute("position");
  const col: number[] = [];
  for (let i = 0; i < pos.count; i++) {
    const y = Math.abs(pos.getY(i));
    const t = y > w / 2 - c - 0.001 ? 1.7 : 1.0;
    col.push(t, t, t);
  }
  g.setAttribute("color", new THREE.Float32BufferAttribute(col, 3));
  g.rotateX(Math.PI / 2); // lathe axis y -> z (across the belt)
  return g;
};

const cChannel = (height: number, flange: number, t: number) => {
  // profile in (z, y): web at z=0, flanges toward +z
  const s = new THREE.Shape();
  s.moveTo(0, 0);
  s.lineTo(flange, 0);
  s.lineTo(flange, t);
  s.lineTo(t, t);
  s.lineTo(t, height - t);
  s.lineTo(flange, height - t);
  s.lineTo(flange, height);
  s.lineTo(0, height);
  s.closePath();
  return s;
};

export interface ConveyorLine {
  group: THREE.Group;
  rollers: THREE.InstancedMesh;
  rollerXs: number[];
}

export const buildConveyor = (m: Mats, zc: number, x0: number, x1: number, legs = true): ConveyorLine => {
  const group = new THREE.Group();
  const n0 = Math.floor(x0 / PITCH), n1 = Math.ceil(x1 / PITCH);
  const rollerXs: number[] = [];
  for (let i = n0; i <= n1; i++) rollerXs.push(i * PITCH);
  const rollers = new THREE.InstancedMesh(rollerGeometry(), m.roller, rollerXs.length);
  rollers.castShadow = true;
  rollers.receiveShadow = true;
  rollers.frustumCulled = false;
  group.add(rollers);
  // rails: C-channels, web outside, flanges pointing in
  const H = 0.13, top = BELT_Y + 0.006;
  const prof = cChannel(H, 0.035, 0.004);
  const len = x1 - x0;
  for (const side of [1, -1]) {
    const g = new THREE.ExtrudeGeometry(prof, { depth: len, bevelEnabled: false, steps: 1 });
    // extrude along +z -> rotate so it runs along +x; shape x -> world z
    g.rotateY(Math.PI / 2);
    // after rotateY(90): shape x -> -z, extrusion z -> +x
    const mesh = new THREE.Mesh(g, m.rail);
    mesh.position.set(x0, top - H, zc + side * (BELT_W / 2 + 0.012));
    mesh.scale.z = side; // flanges point inward on both sides
    mesh.castShadow = true;
    mesh.receiveShadow = true;
    group.add(mesh);
  }
  // axle nuts on the outer web faces, one per roller
  const nutGeo = new THREE.CylinderGeometry(0.0085, 0.0085, 0.008, 6);
  nutGeo.rotateX(Math.PI / 2);
  const washer = new THREE.CylinderGeometry(0.012, 0.012, 0.002, 16);
  washer.rotateX(Math.PI / 2);
  const nuts = new THREE.InstancedMesh(nutGeo, m.nut, rollerXs.length * 2);
  const washers = new THREE.InstancedMesh(washer, m.nut, rollerXs.length * 2);
  const M = new THREE.Matrix4();
  rollerXs.forEach((x, i) => {
    for (let s = 0; s < 2; s++) {
      const z = zc + (s ? 1 : -1) * (BELT_W / 2 + 0.012 + 0.004);
      M.makeRotationZ((((n0 + i) % 80 + 80) % 80) * 0.37 % (Math.PI / 3)).setPosition(x, BELT_Y - ROLLER_R, z + (s ? 0.004 : -0.004));
      nuts.setMatrixAt(i * 2 + s, M);
      M.makeTranslation(x, BELT_Y - ROLLER_R, z + (s ? 0.001 : -0.001));
      washers.setMatrixAt(i * 2 + s, M);
    }
  });
  for (const im of [nuts, washers]) {
    im.castShadow = false;
    im.receiveShadow = true;
    im.frustumCulled = false;
    group.add(im);
  }
  if (legs) {
    const legGeo = new THREE.BoxGeometry(0.045, BELT_Y - 0.13, 0.045);
    const cross = new THREE.BoxGeometry(0.035, 0.035, BELT_W + 0.03);
    for (let x = Math.ceil(x0 / 1.5) * 1.5; x <= x1; x += 1.5) {
      for (const s of [-1, 1]) {
        const leg = new THREE.Mesh(legGeo, m.frame);
        leg.position.set(x, (BELT_Y - 0.13) / 2, zc + s * (BELT_W / 2 + 0.03));
        leg.receiveShadow = true;
        group.add(leg);
      }
      for (const y of [0.18, BELT_Y - 0.16]) {
        const c = new THREE.Mesh(cross, m.frame);
        c.position.set(x, y, zc);
        c.receiveShadow = true;
        group.add(c);
      }
    }
    // dark drip tray under the rollers hides the void between legs
    const tray = new THREE.Mesh(new THREE.BoxGeometry(len, 0.01, BELT_W), m.frame);
    tray.position.set((x0 + x1) / 2, BELT_Y - 0.12, zc);
    tray.receiveShadow = true;
    group.add(tray);
  }
  return { group, rollers, rollerXs };
};

const _m = new THREE.Matrix4();
export const spinRollers = (line: ConveyorLine, zc: number, travel: number) => {
  const ang = travel / ROLLER_R;
  line.rollerXs.forEach((x, i) => {
    _m.makeRotationZ(ang).setPosition(x, BELT_Y - ROLLER_R, zc);
    line.rollers.setMatrixAt(i, _m);
  });
  line.rollers.instanceMatrix.needsUpdate = true;
};

// ----------------------------------------------------------------- racks --
export const buildRacks = (m: Mats, zFront: number, x0: number, x1: number, seed: number) => {
  const group = new THREE.Group();
  const depth = 1.0, bay = L / 2;
  const levels = [0.1, 1.25, 2.4, 3.55];
  const upGeo = new THREE.BoxGeometry(0.08, 5.6, 0.07);
  const beamGeo = new THREE.BoxGeometry(bay - 0.08, 0.09, 0.05);
  const braceGeo = new THREE.BoxGeometry(0.03, 1.2, 0.03);
  for (let x = Math.floor(x0 / bay) * bay; x <= x1 + bay; x += bay) {
    for (const z of [zFront, zFront - depth]) {
      const u = new THREE.Mesh(upGeo, m.upright);
      u.position.set(x, 2.8, z);
      u.receiveShadow = true;
      group.add(u);
    }
    // cross-bracing between front and back uprights
    for (let k = 0; k < 4; k++) {
      const b = new THREE.Mesh(braceGeo, m.upright);
      b.position.set(x, 0.7 + k * 1.3, zFront - depth / 2);
      b.rotation.x = (k % 2 ? 1 : -1) * 0.9;
      group.add(b);
    }
    for (const y of levels) {
      for (const z of [zFront, zFront - depth]) {
        const bm = new THREE.Mesh(beamGeo, m.beam);
        bm.position.set(x + bay / 2, y + 0.055, z);
        bm.receiveShadow = true;
        group.add(bm);
      }
    }
  }
  // stock: instanced parcels (a handful of prototypes, varied scale/tint)
  const protos = Array.from({ length: 14 }, (_, i) => makeParcel(i % 4 === 0 ? "tall" : i % 4 === 3 ? "flat" : "medium", 9000 + i * 13, { lowpoly: true }));
  const placements: Array<{ p: number; m: THREE.Matrix4; tint: number }> = [];
  const levelH = levels[1] - levels[0] - 0.12;
  for (let x = Math.floor(x0 / bay) * bay; x <= x1 + bay; x += bay) {
    // contents depend only on the bay's index within the period, so the rack
    // repeats exactly every L (2 bays)
    const bi = ((Math.round(x / bay) % 2) + 2) % 2;
    const rng = mulberry32(seed * 31 + bi);
    for (const y of levels) {
      for (const row of [0, 1]) {
        let cx = x + 0.07 + rng() * 0.1;
        while (cx < x + bay - 0.15) {
          const p = Math.floor(rng() * protos.length);
          const s = range(rng, 1.0, 1.5);
          const size = protos[p].size;
          const w = size[0] * s;
          if (cx + w > x + bay - 0.05) break;
          if (rng() < 0.05) { cx += w * 0.6; continue; } // occasional gap
          const zz = zFront - (row ? range(rng, 0.62, 0.72) : range(rng, 0.22, 0.32));
          const rot = rng() < 0.5 ? 0 : Math.PI;
          // stack until the level is (nearly) full
          let yy = y + 0.1;
          let k = 0;
          while (yy + size[1] * s < y + 0.1 + levelH && k < 3) {
            const jitter = (rng() - 0.5) * 0.04;
            const mm = new THREE.Matrix4().compose(new THREE.Vector3(cx + w / 2 + jitter, yy + (size[1] * s) / 2, zz), new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 1, 0), rot + jitter), new THREE.Vector3(s, s, s));
            placements.push({ p, m: mm, tint: range(rng, 0.72, 1.08) });
            yy += size[1] * s + 0.002;
            k++;
            if (rng() < 0.3) break;
          }
          cx += w + range(rng, 0.015, 0.07);
        }
      }
    }
  }
  protos.forEach((proto, pi) => {
    const mine = placements.filter((q) => q.p === pi);
    if (!mine.length) return;
    const parts: Array<[THREE.BufferGeometry | null, THREE.Material]> = [
      [proto.body, m.kraft],
      [proto.tape, m.tape],
      [proto.paper, m.paper],
      [proto.ink, m.ink],
    ];
    for (const [g, mat] of parts) {
      if (!g) continue;
      const im = new THREE.InstancedMesh(g, mat, mine.length);
      mine.forEach((q, i) => {
        im.setMatrixAt(i, q.m);
        im.setColorAt(i, new THREE.Color(q.tint, q.tint, q.tint));
      });
      im.frustumCulled = false;
      im.receiveShadow = true;
      group.add(im);
    }
  });
  return group;
};

// -------------------------------------------------------- room + lights --
export const buildRoom = (x0: number, x1: number) => {
  const group = new THREE.Group();
  const conc = new THREE.MeshStandardMaterial({ color: new THREE.Color("#6d655c"), roughness: 0.85 });
  const floor = new THREE.Mesh(new THREE.PlaneGeometry(x1 - x0 + 40, 40), conc);
  floor.rotation.x = -Math.PI / 2;
  floor.position.set((x0 + x1) / 2, 0, -8);
  floor.receiveShadow = true;
  group.add(floor);
  const wallMat = new THREE.MeshStandardMaterial({ color: new THREE.Color("#5c554e"), roughness: 0.9 });
  const wall = new THREE.Mesh(new THREE.PlaneGeometry(x1 - x0 + 40, 14), wallMat);
  wall.position.set((x0 + x1) / 2, 7, -10.5);
  group.add(wall);
  const ceil = new THREE.Mesh(new THREE.PlaneGeometry(x1 - x0 + 40, 30), wallMat);
  ceil.rotation.x = Math.PI / 2;
  ceil.position.set((x0 + x1) / 2, 8.5, -6);
  group.add(ceil);
  // warm light fixtures above and on the back wall -> bokeh through the blur
  const lamp = new THREE.MeshBasicMaterial({ color: new THREE.Color(1.0, 0.82, 0.55).multiplyScalar(14) });
  const lampGeo = new THREE.BoxGeometry(0.9, 0.08, 0.25);
  for (let x = Math.floor(x0 / 3) * 3; x <= x1; x += 3) {
    for (const z of [-2.0, -8.0]) {
      const l = new THREE.Mesh(lampGeo, lamp);
      l.position.set(x + 1.5, 7.2, z);
      group.add(l);
    }
    const wl = new THREE.Mesh(new THREE.BoxGeometry(0.35, 0.22, 0.05), lamp);
    wl.position.set(x + 0.7, 5.6, -10.4);
    group.add(wl);
  }
  // small bright fixtures beyond the racks (aisle lamps, indicator lights);
  // the pattern repeats every L so the tracking shots loop
  const bulb = new THREE.MeshBasicMaterial({ color: new THREE.Color(1.0, 0.8, 0.52).multiplyScalar(3.2) });
  const bulbGeo = new THREE.SphereGeometry(0.075, 12, 10);
  const spots: Array<[number, number, number]> = [[0.15, 1.15, -7.6], [0.9, 2.2, -9.2], [1.7, 1.6, -8.4], [2.45, 0.9, -7.3], [3.1, 2.45, -9.6], [3.8, 1.75, -9.0], [4.4, 1.0, -8.1], [5.0, 2.15, -7.8], [5.7, 1.4, -8.8]];
  for (let x = Math.floor(x0 / L) * L; x <= x1; x += L) {
    for (const [dx, y, z] of spots) {
      const b = new THREE.Mesh(bulbGeo, bulb);
      b.position.set(x + dx, y, z);
      group.add(b);
    }
  }
  return group;
};

// A dim warm warehouse for reflections / ambient (built once, PMREM).
export const makeEnvironment = (gl: THREE.WebGLRenderer) => {
  const s = new THREE.Scene();
  const room = new THREE.Mesh(new THREE.BoxGeometry(30, 10, 30), new THREE.MeshBasicMaterial({ color: new THREE.Color(0.11, 0.095, 0.075), side: THREE.BackSide }));
  room.position.y = 4;
  s.add(room);
  const floor = new THREE.Mesh(new THREE.PlaneGeometry(30, 30), new THREE.MeshBasicMaterial({ color: new THREE.Color(0.06, 0.05, 0.04) }));
  floor.rotation.x = -Math.PI / 2;
  floor.position.y = -0.9;
  s.add(floor);
  const strip = new THREE.MeshBasicMaterial({ color: new THREE.Color(1.0, 0.85, 0.62).multiplyScalar(6) });
  for (let i = -2; i <= 2; i++) {
    const m = new THREE.Mesh(new THREE.BoxGeometry(12, 0.1, 0.5), strip);
    m.position.set(0, 8.8, i * 3.5);
    s.add(m);
  }
  // a broad soft panel to one side (bounce from the aisle)
  const bounce = new THREE.Mesh(new THREE.PlaneGeometry(8, 4), new THREE.MeshBasicMaterial({ color: new THREE.Color(0.55, 0.47, 0.36) }));
  bounce.position.set(-10, 3, 4);
  bounce.lookAt(0, 2, 0);
  s.add(bounce);
  const pm = new THREE.PMREMGenerator(gl);
  const rt = pm.fromScene(s, 0.02);
  pm.dispose();
  return rt.texture;
};

export const faceIndex = FACE;
