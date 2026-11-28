import { noise3D } from "@remotion/noise";
import * as THREE from "three";
import { toCreasedNormals } from "three/examples/jsm/utils/BufferGeometryUtils.js";
import { CONFIG, DURATION_IN_FRAMES, FPS, P, PALETTES, Palette, ParcelSpec, Variant } from "./config";
import type { World } from "./engine/Stage";
import { mulberry32, range, Rng } from "./engine/rng";
import { LIGHTS } from "./look";

const deg = THREE.MathUtils.degToRad;
const col = (hex: string) => new THREE.Color(hex);

/** Pitches travelled per frame. A whole number of pitches per loop -> frame N equals frame 0. */
const PITCHES_PER_FRAME = CONFIG.travel.pitchesPerLoop / DURATION_IN_FRAMES;
const PERIOD = CONFIG.lightZone.period;
const BELT_YAW = deg(CONFIG.camera.beltYawDeg);

/** Camera ground frame (x right of the lens axis, distance along it, in pitches) -> world x, z in metres. */
const camToWorld = (x: number, dist: number): [number, number] => {
  const along = x * Math.sin(BELT_YAW) + dist * Math.cos(BELT_YAW);
  const across = x * Math.cos(BELT_YAW) - dist * Math.sin(BELT_YAW);
  return [across * P, -along * P];
};

// --------------------------------------------------------------------------- textures
/** Seeded greyscale canvas texture. `fn` returns 0-1 for each pixel. */
const noiseTexture = (w: number, h: number, seed: number, fn: (x: number, y: number, rng: Rng) => number) => {
  const canvas = document.createElement("canvas");
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext("2d") as CanvasRenderingContext2D;
  const img = ctx.createImageData(w, h);
  const rng = mulberry32(seed);
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const v = Math.max(0, Math.min(255, Math.round(fn(x, y, rng) * 255)));
      const i = (y * w + x) * 4;
      img.data[i] = v;
      img.data[i + 1] = v;
      img.data[i + 2] = v;
      img.data[i + 3] = 255;
    }
  }
  ctx.putImageData(img, 0, 0);
  const tex = new THREE.CanvasTexture(canvas);
  tex.wrapS = THREE.RepeatWrapping;
  tex.wrapT = THREE.RepeatWrapping;
  tex.anisotropy = 8;
  return tex;
};

/** Tileable value noise table for the procedural textures. */
const valueNoise = (size: number, seed: number) => {
  const rng = mulberry32(seed);
  const g = new Float32Array(size * size);
  for (let i = 0; i < g.length; i++) g[i] = rng();
  return (x: number, y: number) => {
    const xi = Math.floor(x);
    const yi = Math.floor(y);
    const tx = x - xi;
    const ty = y - yi;
    const sx = tx * tx * (3 - 2 * tx);
    const sy = ty * ty * (3 - 2 * ty);
    const at = (a: number, b: number) => g[(((b % size) + size) % size) * size + (((a % size) + size) % size)];
    return (
      (at(xi, yi) * (1 - sx) + at(xi + 1, yi) * sx) * (1 - sy) + (at(xi, yi + 1) * (1 - sx) + at(xi + 1, yi + 1) * sx) * sy
    );
  };
};

/** Kraft board: large blotches, medium fibre streaks, fine speckle. */
const cardboardTexture = () => {
  const n = valueNoise(64, 11);
  return noiseTexture(512, 512, 12, (x, y, rng) => {
    const large = n(x / 96, y / 96);
    const fibre = n(x / 40, y / 3);
    const flute = 0.5 + 0.5 * Math.sin((y / 512) * Math.PI * 2 * 48);
    const fine = rng();
    return 0.74 + large * 0.12 + fibre * 0.07 + flute * 0.02 + fine * 0.05;
  });
};

/** Roller wear: rings around the circumference (uv.y runs along the roller axis). */
const rollerTexture = () => {
  const n = valueNoise(64, 21);
  return noiseTexture(64, 1024, 22, (x, y, rng) => {
    const rings = n(x / 32, y / 2.5);
    const bands = n(x / 16, y / 40);
    return 0.66 + rings * 0.14 + bands * 0.14 + rng() * 0.04;
  });
};

/** A small original mark: three chasing arrows on a circle. */
const markTexture = (ink: string) => {
  const s = 256;
  const canvas = document.createElement("canvas");
  canvas.width = s;
  canvas.height = s;
  const ctx = canvas.getContext("2d") as CanvasRenderingContext2D;
  ctx.clearRect(0, 0, s, s);
  ctx.strokeStyle = ink;
  ctx.fillStyle = ink;
  ctx.lineWidth = 26;
  ctx.lineCap = "butt";
  const c = s / 2;
  const r = 78;
  for (let i = 0; i < 3; i++) {
    const a0 = (i / 3) * Math.PI * 2 - Math.PI / 2;
    const a1 = a0 + (Math.PI * 2) / 3 - 0.62;
    ctx.beginPath();
    ctx.arc(c, c, r, a0, a1);
    ctx.stroke();
    // arrow head
    const hx = c + Math.cos(a1) * r;
    const hy = c + Math.sin(a1) * r;
    const t = a1 + Math.PI / 2;
    ctx.beginPath();
    ctx.moveTo(hx + Math.cos(t) * 40, hy + Math.sin(t) * 40);
    ctx.lineTo(hx + Math.cos(a1) * 30, hy + Math.sin(a1) * 30);
    ctx.lineTo(hx - Math.cos(a1) * 30, hy - Math.sin(a1) * 30);
    ctx.closePath();
    ctx.fill();
  }
  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = 8;
  return tex;
};

// --------------------------------------------------------------------------- parcels
/** Raise the top of a centred geometry towards its far (-z) end: a lid that sits slightly proud at the back. */
const raiseBack = <T extends THREE.BufferGeometry>(geo: T, h: number, d: number, rise: number): T => {
  if (rise === 0) return geo;
  const pos = geo.attributes.position;
  for (let i = 0; i < pos.count; i++) {
    const y = pos.getY(i);
    const up = Math.max(0, Math.min(1, y / h + 0.5));
    const back = Math.max(0, Math.min(1, 0.5 - pos.getZ(i) / d));
    pos.setY(i, y + rise * up * back);
  }
  pos.needsUpdate = true;
  geo.computeVertexNormals();
  return geo;
};

/**
 * Box with softly rounded edges: a rounded rectangle extruded with a bevel.
 * UVs are in metres, so textures use `repeat` to set their real-world size.
 */
const roundedBox = (w: number, h: number, d: number, r: number) => {
  const eps = 1e-5;
  const rr = Math.min(r, w / 2 - eps, h / 2 - eps, d / 2 - eps);
  const shape = new THREE.Shape();
  const x0 = -w / 2;
  const y0 = -h / 2;
  shape.absarc(x0 + rr, y0 + rr, rr, -Math.PI, -Math.PI / 2, false);
  shape.absarc(x0 + w - rr, y0 + rr, rr, -Math.PI / 2, 0, false);
  shape.absarc(x0 + w - rr, y0 + h - rr, rr, 0, Math.PI / 2, false);
  shape.absarc(x0 + rr, y0 + h - rr, rr, Math.PI / 2, Math.PI, false);
  const geo = new THREE.ExtrudeGeometry(shape, {
    depth: d - rr * 2,
    bevelEnabled: true,
    bevelSegments: 3,
    steps: 1,
    bevelSize: rr - eps,
    bevelOffset: -rr + eps,
    bevelThickness: rr,
    curveSegments: 4,
  });
  geo.center();
  return toCreasedNormals(geo, 0.6);
};

interface Parcel {
  group: THREE.Group;
  baseY: number;
  seed: number;
}

const buildParcel = (spec: ParcelSpec, index: number, pal: Palette, tex: { card: THREE.Texture }): Parcel => {
  const [w, h, d] = spec.size.map((v) => v * P);
  const group = new THREE.Group();
  const cardMap = tex.card.clone();
  cardMap.repeat.set(1 / (7 * P), 1 / (7 * P));
  cardMap.offset.set(index * 0.37, index * 0.61);
  cardMap.needsUpdate = true;
  const card = new THREE.MeshStandardMaterial({
    color: col(pal.cardboard),
    map: cardMap,
    bumpMap: cardMap,
    bumpScale: 0.04,
    roughness: 0.82,
    metalness: 0,
    shadowSide: THREE.FrontSide,
  });
  const edge = new THREE.MeshStandardMaterial({ color: col(pal.cardboardEdge), roughness: 0.7, metalness: 0, map: cardMap, shadowSide: THREE.FrontSide });
  const add = (mesh: THREE.Mesh, cast = true) => {
    mesh.castShadow = cast;
    mesh.receiveShadow = true;
    group.add(mesh);
    return mesh;
  };
  const lift = 0.012 * P;
  const rise = (spec.topRise ?? 0) * P;
  const body = add(new THREE.Mesh(raiseBack(roundedBox(w, h, d, 0.05 * P), h, d, rise), card));
  body.position.y = h / 2 + lift;

  // straps: thin dark bands wrapped around the carton
  const strapMat = new THREE.MeshStandardMaterial({ color: col(pal.strap), roughness: 0.45, metalness: 0, shadowSide: THREE.FrontSide });
  const sw = 0.11 * P;
  const e = 0.012 * P;
  for (const s of spec.straps) {
    const geo =
      spec.strapAxis === "depth" ? new THREE.BoxGeometry(w + 2 * e, h + 2 * e, sw) : new THREE.BoxGeometry(sw, h + 2 * e, d + 2 * e);
    const strap = add(new THREE.Mesh(geo, strapMat));
    // straps follow the raised lid
    if (spec.strapAxis === "depth") strap.scale.y = 1 + (rise * s) / h;
    if (spec.strapAxis === "depth") strap.position.set(0, h / 2 + lift + (rise * s) / 2, d / 2 - s * d);
    else strap.position.set(-w / 2 + s * w, h / 2 + lift, 0);
  }

  if (spec.rim) {
    // tray rim around the face turned to the camera: a ledge below, a post at the right end, a thin lip on top
    const ledge = add(new THREE.Mesh(roundedBox(w + 0.12 * P, 0.11 * P, 0.16 * P, 0.025 * P), edge));
    ledge.position.set(0.03 * P, 0.055 * P + lift, d / 2 + 0.03 * P);
    const post = add(new THREE.Mesh(roundedBox(0.11 * P, h + 0.07 * P, 0.2 * P, 0.025 * P), edge));
    post.position.set(w / 2 + 0.03 * P, h / 2 + lift + 0.01 * P, d / 2 + 0.01 * P);
    const lip = add(new THREE.Mesh(roundedBox(w + 0.12 * P, 0.05 * P, 0.12 * P, 0.015 * P), edge));
    lip.position.set(0.03 * P, h + lift, d / 2 + 0.01 * P);
  }

  if (spec.mark) {
    const mark = new THREE.Mesh(
      new THREE.PlaneGeometry(0.42 * P, 0.42 * P),
      new THREE.MeshStandardMaterial({ map: markTexture(pal.mark), transparent: true, roughness: 0.9, polygonOffset: true, polygonOffsetFactor: -2 }),
    );
    mark.rotation.y = -Math.PI / 2;
    mark.position.set(-w / 2 - 0.004 * P, h * 0.45 + lift, d / 2 - 0.15 * d);
    mark.receiveShadow = true;
    group.add(mark);
  }

  if (spec.label) {
    const label = new THREE.Mesh(
      new THREE.PlaneGeometry(w * 0.27, h * 0.72),
      new THREE.MeshStandardMaterial({ color: col(pal.label), roughness: 0.55 }),
    );
    label.position.set(-w / 2 + w * 0.185, h * 0.52 + lift, d / 2 + 0.006 * P);
    label.receiveShadow = true;
    group.add(label);
  }

  if (spec.flaps) {
    // loose top flaps with a taped, slightly glossy surface - they catch the overhead light first
    const flapMat = new THREE.MeshStandardMaterial({ color: col(pal.cardboardEdge), roughness: 0.3, metalness: 0 });
    const rng = mulberry32(900 + index);
    for (const [fx, tilt] of [
      [0.06, 0.16],
      [0.34, -0.14],
    ] as const) {
      const flap = add(new THREE.Mesh(new THREE.BoxGeometry(w * 0.2, 0.05 * P, d * range(rng, 0.5, 0.62)), flapMat));
      flap.position.set(fx * w, h + lift + 0.12 * P, range(rng, -0.05, 0.1) * d);
      flap.rotation.z = tilt;
      flap.rotation.x = range(rng, -0.12, 0.12);
    }
  }

  // place: `corner` is the near-left bottom corner of the body, in the camera's ground frame
  const yaw = deg(spec.yawDeg) + BELT_YAW;
  const [wx, wz] = camToWorld(spec.corner[0], spec.corner[1]);
  const lx = -w / 2;
  const lz = d / 2;
  const cx = wx - (lx * Math.cos(yaw) + lz * Math.sin(yaw));
  const cz = wz - (-lx * Math.sin(yaw) + lz * Math.cos(yaw));
  group.position.set(cx, 0, cz);
  group.rotation.y = yaw;
  return { group, baseY: 0, seed: 100 + index * 17 };
};

// --------------------------------------------------------------------------- backdrop
/**
 * Out-of-focus warehouse seen past the parcels. One 64-pitch period is built
 * `copies` times along the direction of travel so it can scroll and loop.
 * Unlit materials: at this distance everything is a blur of colour.
 */
const buildBackdrop = (pal: Palette) => {
  const group = new THREE.Group();
  const cfg = CONFIG.backdrop;
  const rc = CONFIG.rollers;
  const copies = 16;
  const first = -1; // one period behind the camera
  const dim = LIGHTS.backdrop.brightness;
  const basic = (c: THREE.ColorRepresentation) => new THREE.MeshBasicMaterial({ color: new THREE.Color(c).multiplyScalar(dim) });
  const dummy = new THREE.Object3D();
  const box = new THREE.BoxGeometry(1, 1, 1);
  const floorY = cfg.floorY;
  const all: THREE.InstancedMesh[] = [];

  // uprights: conveyor legs, rack posts in two rows on each side
  const rows = [
    { x: rc.left - 0.7, phase: 3, w: 0.9, y0: floorY, y1: -0.6 },
    { x: rc.right + 0.7, phase: 19, w: 0.9, y0: floorY, y1: -0.6 },
    { x: -18.6, phase: 9, w: 1.5, y0: floorY, y1: 60 },
    { x: 15.2, phase: 21, w: 1.5, y0: floorY, y1: 60 },
    { x: -35, phase: 25, w: 1.7, y0: floorY, y1: 60 },
    { x: 32, phase: 5, w: 1.7, y0: floorY, y1: 60 },
  ];
  const perPeriod = PERIOD / cfg.postSpacing;
  const posts = new THREE.InstancedMesh(box, basic(pal.rackPost), copies * perPeriod * rows.length);
  let n = 0;
  for (let k = 0; k < copies; k++) {
    for (let j = 0; j < perPeriod; j++) {
      for (const r of rows) {
        dummy.position.set(r.x * P, ((r.y0 + r.y1) / 2) * P, -((k + first) * PERIOD + j * cfg.postSpacing + r.phase) * P);
        dummy.scale.set(r.w * P, (r.y1 - r.y0) * P, r.w * P);
        dummy.updateMatrix();
        posts.setMatrixAt(n++, dummy.matrix);
      }
    }
  }
  all.push(posts);

  // shelf beams running along the aisle
  const beamDefs = [
    { x: -19.3, y: 4.4 },
    { x: -19.3, y: 10.6 },
    { x: -19.3, y: 17 },
    { x: -19.3, y: -8.5 },
    { x: 15.9, y: 4.4 },
    { x: 15.9, y: 10.6 },
    { x: 15.9, y: 17 },
    { x: 15.9, y: -8.5 },
  ];
  const beams = new THREE.InstancedMesh(box, basic(pal.rackBeam), beamDefs.length);
  n = 0;
  for (const b of beamDefs) {
    dummy.position.set(b.x * P, b.y * P, -((first + copies / 2) * PERIOD) * P);
    dummy.scale.set(0.8 * P, 1.1 * P, copies * PERIOD * P);
    dummy.updateMatrix();
    beams.setMatrixAt(n++, dummy.matrix);
  }
  all.push(beams);

  // goods on the floor and on the first shelf (the same seeded layout in every period)
  const rng = mulberry32(cfg.seed);
  const layout: { x: number; z: number; len: number; y: number; h: number; depth: number; c: THREE.Color }[] = [];
  for (const side of [-1, 1]) {
    for (let i = 0; i < cfg.goodsPerSide; i++) {
      const level = Math.floor(rng() * 4); // floor, and three shelf levels
      const depth = range(rng, 5, 11);
      const c = col(pal.rackGoods[Math.floor(rng() * pal.rackGoods.length)]);
      c.multiplyScalar(range(rng, 0.7, 1.35));
      layout.push({
        x: side < 0 ? -20.2 - depth / 2 - range(rng, 0, 3) : 16.8 + depth / 2 + range(rng, 0, 3),
        z: rng() * PERIOD,
        len: range(rng, 4, 12),
        y: [floorY, 5, 11.2, 17.6][level],
        h: level === 0 ? range(rng, 6, 16) : range(rng, 3, 5.2),
        depth,
        c,
      });
    }
  }
  const goods = new THREE.InstancedMesh(box, new THREE.MeshBasicMaterial({ color: new THREE.Color().setScalar(dim) }), layout.length * copies);
  n = 0;
  for (let k = 0; k < copies; k++) {
    for (const g of layout) {
      dummy.position.set(g.x * P, (g.y + g.h / 2) * P, -((k + first) * PERIOD + g.z) * P);
      dummy.scale.set(g.depth * P, g.h * P, g.len * P);
      dummy.updateMatrix();
      goods.setMatrixAt(n, dummy.matrix);
      goods.setColorAt(n, g.c);
      n++;
    }
  }
  all.push(goods);

  // small lamps beside the conveyor -> bokeh discs. HDR colours so the blurred disc stays bright.
  const lampRng = mulberry32(cfg.seed + 1);
  const lamps: { x: number; y: number; z: number; r: number; c: THREE.Color }[] = [];
  for (let i = 0; i < cfg.bokehPerPeriod; i++) {
    const b = pal.bokeh[Math.floor(lampRng() * pal.bokeh.length)];
    const left = i % 3 !== 2;
    lamps.push({
      x: left ? rc.left - range(lampRng, 1.8, 5) : rc.right + range(lampRng, 2, 5.5),
      y: range(lampRng, 2.4, 6.5),
      z: ((i + lampRng() * 0.6) / cfg.bokehPerPeriod) * PERIOD,
      r: range(lampRng, 0.2, 0.32),
      c: col(b.color).multiplyScalar(b.intensity * range(lampRng, 0.7, 1.15)),
    });
  }
  const lampMesh = new THREE.InstancedMesh(new THREE.SphereGeometry(1, 12, 8), new THREE.MeshBasicMaterial({ color: 0xffffff }), lamps.length * copies);
  n = 0;
  for (let k = 0; k < copies; k++) {
    for (const l of lamps) {
      dummy.position.set(l.x * P, l.y * P, -((k + first) * PERIOD + l.z) * P);
      dummy.scale.setScalar(l.r * P);
      dummy.updateMatrix();
      lampMesh.setMatrixAt(n, dummy.matrix);
      lampMesh.setColorAt(n, l.c);
      n++;
    }
  }
  all.push(lampMesh);

  const floor = new THREE.Mesh(new THREE.PlaneGeometry(260 * P, copies * PERIOD * P), basic(pal.floor));
  floor.rotation.x = -Math.PI / 2;
  floor.position.set(0, floorY * P, -((first + copies / 2) * PERIOD) * P);
  group.add(floor);

  for (const m of all) {
    m.frustumCulled = false;
    m.instanceMatrix.needsUpdate = true;
    if (m.instanceColor) m.instanceColor.needsUpdate = true;
    group.add(m);
  }
  return group;
};

/** Procedural warehouse used only for image-based lighting and reflections. */
const buildEnvironment = (renderer: THREE.WebGLRenderer, pal: Palette) => {
  const env = new THREE.Scene();
  const E = LIGHTS.environment;
  const basic = (c: THREE.Color) => new THREE.MeshBasicMaterial({ color: c, side: THREE.DoubleSide });
  const walls = new THREE.Mesh(new THREE.BoxGeometry(24, 9, 60), basic(col(pal.envWalls).multiplyScalar(E.wallBrightness)));
  walls.position.y = 3.5;
  env.add(walls);
  const ceiling = new THREE.Mesh(new THREE.PlaneGeometry(24, 60), basic(col(pal.envCeiling).multiplyScalar(E.ceilingBrightness)));
  ceiling.rotation.x = Math.PI / 2;
  ceiling.position.y = 7.95;
  env.add(ceiling);
  const panelMat = basic(col(pal.envCeiling).multiplyScalar(E.panelBrightness));
  for (let i = -5; i <= 5; i++) {
    for (const x of [-5, 0, 5]) {
      const panel = new THREE.Mesh(new THREE.PlaneGeometry(1.5, 2.4), panelMat);
      panel.rotation.x = Math.PI / 2;
      panel.position.set(x, 7.9, i * 5.2);
      env.add(panel);
    }
  }
  const floor = new THREE.Mesh(new THREE.PlaneGeometry(24, 60), basic(col(pal.floor)));
  floor.rotation.x = -Math.PI / 2;
  floor.position.y = -0.95;
  env.add(floor);
  // a bright band low on the far wall: what the roller tops mirror at grazing angles
  const glow = new THREE.Mesh(new THREE.PlaneGeometry(24, E.farGlowHeight), basic(col(pal.envCeiling).multiplyScalar(E.farGlowBrightness)));
  glow.position.set(0, -0.95 + E.farGlowHeight / 2 + 0.6, -29.5);
  env.add(glow);
  const pmrem = new THREE.PMREMGenerator(renderer);
  const tex = pmrem.fromScene(env, 0.03, 0.1, 100).texture;
  pmrem.dispose();
  return tex;
};

/** 1 x 64 strip: lit / dark bands of the travelling light for the far, flat part of the belt. */
const zoneBandTexture = () => {
  const n = PERIOD;
  const data = new Uint8Array(n * 4);
  for (let i = 0; i < n; i++) {
    const edge = Math.min(i + 0.5, CONFIG.lightZone.length - (i + 0.5));
    const lit = Math.max(0, Math.min(1, edge / 1.5 + 0.5));
    const v = Math.round((0.2 + 0.8 * lit) * 255);
    data.set([v, v, v, 255], i * 4);
  }
  const tex = new THREE.DataTexture(data, 1, n, THREE.RGBAFormat);
  tex.wrapS = THREE.RepeatWrapping;
  tex.wrapT = THREE.RepeatWrapping;
  tex.minFilter = THREE.LinearFilter;
  tex.magFilter = THREE.LinearFilter;
  tex.needsUpdate = true;
  return tex;
};

// --------------------------------------------------------------------------- world
export const makeWorld = (variant: Variant): World => {
  const pal = PALETTES[variant];
  const root = new THREE.Group();
  const cardTex = cardboardTexture();
  const rollTex = rollerTexture();
  const rc = CONFIG.rollers;
  const zone = CONFIG.lightZone;
  const beltWidth = (rc.right - rc.left) * P;
  const beltCentre = ((rc.right + rc.left) / 2) * P;

  // --- rollers
  const rollerGeo = new THREE.CylinderGeometry(rc.radius * P, rc.radius * P, beltWidth, 32, 1, false);
  rollerGeo.rotateZ(Math.PI / 2);
  rollTex.repeat.set(2, 1);
  const rollerMat = new THREE.MeshPhysicalMaterial({
    color: col(pal.roller),
    map: rollTex,
    roughnessMap: rollTex,
    roughness: LIGHTS.rollers.roughness,
    metalness: 0,
    specularIntensity: LIGHTS.rollers.specular,
  });
  // Two additions to the standard shading, both pure functions of geometry (no clock):
  //  - a soft highlight on the crest of every roller, as mirrored from the bright far end of the hall
  //  - the key light's glare is weighted across the frame, strongest on the side the light leans from
  const R = LIGHTS.rollers;
  const crestColor = col(pal.keyLight).multiplyScalar(R.crestBrightness);
  rollerMat.onBeforeCompile = (shader) => {
    shader.uniforms.uCrestColor = { value: crestColor };
    shader.uniforms.uCrest = { value: new THREE.Vector4(R.crestStart, R.crestEnd, R.streakScale / P, R.baseLift) };
    shader.uniforms.uGlare = { value: new THREE.Vector4(R.glareLeft, R.glareRight, R.glareFrom, R.glareTo) };
    shader.uniforms.uCrestSide = { value: new THREE.Vector3(R.crestLeft, R.crestFrom, R.crestTo) };
    shader.fragmentShader = shader.fragmentShader
      .replace(
        "#include <common>",
        `#include <common>
        uniform vec3 uCrestColor;
        uniform vec4 uCrest;
        uniform vec4 uGlare;
        uniform vec3 uCrestSide;
        float rollerHash(float n) {
          uint u = uint(int(n) + 1000000);
          u ^= u >> 16; u *= 0x7feb352dU; u ^= u >> 15; u *= 0x846ca68bU; u ^= u >> 16;
          return float(u >> 8) / 16777216.0;
        }
        float rollerNoise(float x) {
          float i = floor(x);
          float f = x - i;
          f = f * f * (3.0 - 2.0 * f);
          return mix(rollerHash(i), rollerHash(i + 1.0), f);
        }`,
      )
      .replace(
        "#include <lights_fragment_end>",
        `#include <lights_fragment_end>
        {
          vec3 wn = inverseTransformDirection(normal, viewMatrix);
          float crest = smoothstep(uCrest.x, uCrest.y, wn.y);
          float side = -vViewPosition.x / max(vViewPosition.z, 1e-3);
          float lateral = mix(uGlare.x, uGlare.y, smoothstep(uGlare.z, uGlare.w, side));
          reflectedLight.directSpecular *= lateral;
          reflectedLight.directDiffuse *= mix(1.0, lateral, 0.5);
          // worn streaks: the highlight breaks up along each roller, differently on every roller
          float seed = floor(vColor.r * 4096.0);
          float xs = -vViewPosition.x * uCrest.z;
          float streak = rollerNoise(xs + seed * 13.0) * 0.65 + rollerNoise(xs * 3.1 + seed * 29.0) * 0.35;
          streak = smoothstep(0.3, 0.72, streak);
          float crestSide = mix(uCrestSide.x, 1.0, smoothstep(uCrestSide.y, uCrestSide.z, side));
          totalEmissiveRadiance += uCrestColor * crest * crest * (0.25 + 0.75 * streak) * crestSide;
          totalEmissiveRadiance += diffuseColor.rgb * uCrest.w;
        }`,
      );
  };
  rollerMat.customProgramCacheKey = () => "roller-v2";
  const rollers = new THREE.InstancedMesh(rollerGeo, rollerMat, rc.count);
  rollers.receiveShadow = true;
  rollers.frustumCulled = false;
  root.add(rollers);
  // each roller keeps its own tint as it travels; the tint table repeats once per loop
  const tintRng = mulberry32(31337);
  const tints: THREE.Color[] = [];
  for (let i = 0; i < CONFIG.travel.pitchesPerLoop; i++) tints.push(new THREE.Color().setScalar(range(tintRng, 0.84, 1.06)));

  const gap = new THREE.Mesh(new THREE.PlaneGeometry(beltWidth, 200 * P), new THREE.MeshBasicMaterial({ color: col(pal.rollerGap) }));
  gap.rotation.x = -Math.PI / 2;
  gap.position.set(beltCentre, -rc.radius * P * 1.1, -100 * P);
  root.add(gap);

  // beyond the last real roller the belt continues as a flat strip with the same light bands
  const farStart = rc.firstAt + rc.count - 1.5;
  const farLen = 900;
  const bandTex = zoneBandTexture();
  bandTex.repeat.set(1, farLen / PERIOD);
  const farMat = new THREE.MeshBasicMaterial({ color: col(pal.roller).multiplyScalar(LIGHTS.farBelt.brightness), map: bandTex });
  const farBelt = new THREE.Mesh(new THREE.PlaneGeometry(beltWidth, farLen * P), farMat);
  farBelt.rotation.x = -Math.PI / 2;
  farBelt.position.set(beltCentre, -0.02 * P, -(farStart + farLen / 2) * P);
  root.add(farBelt);

  // --- side rails
  const railMat = new THREE.MeshStandardMaterial({ color: col(pal.rail), roughness: 0.45, metalness: 0.4 });
  for (const x of [rc.left - 0.65, rc.right + 0.65]) {
    const rail = new THREE.Mesh(new THREE.BoxGeometry(1.3 * P, 1.9 * P, 1100 * P), railMat);
    rail.position.set(x * P, -0.6 * P, -520 * P);
    rail.receiveShadow = true;
    root.add(rail);
  }

  // --- parcels
  const parcels = CONFIG.parcels.map((spec, i) => buildParcel(spec, i, pal, { card: cardTex }));
  for (const p of parcels) root.add(p.group);

  // --- backdrop
  const backdrop = buildBackdrop(pal);
  root.add(backdrop);

  // --- lights
  const hemi = new THREE.HemisphereLight(col(pal.skyFill), col(pal.groundFill), LIGHTS.hemisphere.intensity);
  root.add(hemi);

  const el = deg(LIGHTS.key.elevationDeg);
  // direction the light travels: down, towards the camera (+z), leaning sideways
  const lightDir = new THREE.Vector3(LIGHTS.key.sideways, -Math.sin(el), Math.cos(el)).normalize();
  const key = new THREE.DirectionalLight(col(pal.keyLight), LIGHTS.key.intensity);
  const goboHeight = 14 * P;
  const keyTarget = new THREE.Vector3(0, 0, -80 * P);
  key.position.copy(keyTarget).addScaledVector(lightDir, -260 * P);
  key.target.position.copy(keyTarget);
  key.castShadow = true;
  key.shadow.mapSize.set(LIGHTS.key.shadowMapSize, LIGHTS.key.shadowMapSize);
  key.shadow.radius = LIGHTS.key.shadowRadius;
  key.shadow.bias = -0.0006;
  key.shadow.normalBias = 0.012 * P;
  {
    // fit the orthographic shadow camera to the part of the scene that needs shadows
    key.updateMatrixWorld(true);
    key.target.updateMatrixWorld(true);
    const view = new THREE.Matrix4().lookAt(key.position, keyTarget, new THREE.Vector3(0, 1, 0)).invert();
    view.multiply(new THREE.Matrix4().makeTranslation(-key.position.x, -key.position.y, -key.position.z));
    const lo = new THREE.Vector3(rc.left - 2, -1, -165).multiplyScalar(P);
    const hi = new THREE.Vector3(rc.right + 2, 15, -6).multiplyScalar(P);
    const b = new THREE.Box3();
    for (const x of [lo.x, hi.x]) for (const y of [lo.y, hi.y]) for (const z of [lo.z, hi.z]) b.expandByPoint(new THREE.Vector3(x, y, z).applyMatrix4(view));
    const sc = key.shadow.camera;
    sc.left = b.min.x;
    sc.right = b.max.x;
    sc.bottom = b.min.y;
    sc.top = b.max.y;
    sc.near = Math.max(0.01, -b.max.z - 20 * P);
    sc.far = -b.min.z + 20 * P;
    sc.updateProjectionMatrix();
  }
  root.add(key, key.target);

  const bounce = new THREE.DirectionalLight(col(pal.bounce), 0);
  bounce.position.set(0.3, -0.2, 1); // from the camera side, slightly below
  root.add(bounce);

  // --- gobo: invisible slabs high above the belt cast the dark gaps between lit zones
  const darkLen = zone.period - zone.length;
  const slabMat = new THREE.MeshBasicMaterial({ colorWrite: false, depthWrite: false });
  const slabs: THREE.Mesh[] = [];
  const slabKs = [-1, 0, 1, 2, 3];
  for (let i = 0; i < slabKs.length; i++) {
    const slab = new THREE.Mesh(new THREE.BoxGeometry(60 * P, 0.2 * P, darkLen * P), slabMat);
    slab.castShadow = true;
    slab.frustumCulled = false;
    slabs.push(slab);
    root.add(slab);
  }

  const dummy = new THREE.Object3D();
  const tint = new THREE.Color();
  let envTex: THREE.Texture | null = null;

  return {
    root,
    setup: (renderer, scene) => {
      if (!envTex) envTex = buildEnvironment(renderer, pal);
      scene.environment = envTex;
      scene.environmentIntensity = LIGHTS.environment.intensity;
      scene.background = col(pal.backdrop);
    },
    update: (frame, camera) => {
      const f = ((frame % DURATION_IN_FRAMES) + DURATION_IN_FRAMES) % DURATION_IN_FRAMES;
      const travel = f * PITCHES_PER_FRAME; // pitches travelled so far, 0..64
      const whole = Math.floor(travel);
      const frac = travel - whole;

      // camera: locked to the parcels
      camera.fov = CONFIG.camera.fovY;
      camera.near = 0.1;
      camera.far = 80;
      camera.position.set(0, CONFIG.camera.height * P, 0);
      camera.rotation.order = "YXZ";
      camera.rotation.set(-deg(CONFIG.camera.pitchDeg), BELT_YAW, 0);

      // rollers stream towards the lens
      for (let i = 0; i < rc.count; i++) {
        dummy.position.set(beltCentre, -rc.radius * P, -(rc.firstAt + i - frac) * P);
        dummy.rotation.set(0, 0, 0);
        dummy.scale.set(1, 1, 1);
        dummy.updateMatrix();
        rollers.setMatrixAt(i, dummy.matrix);
        const id = (((i + whole) % tints.length) + tints.length) % tints.length;
        rollers.setColorAt(i, tint.copy(tints[id]));
      }
      rollers.instanceMatrix.needsUpdate = true;
      if (rollers.instanceColor) rollers.instanceColor.needsUpdate = true;

      // warehouse slides past
      backdrop.position.z = travel * P;

      // lit zone k covers distances [lead, lead + length]; the dark gap sits in front of it
      let lit = 0;
      const probeNear = 24;
      const probeFar = 37;
      const t = goboHeight / -lightDir.y;
      for (let i = 0; i < slabKs.length; i++) {
        const lead = zone.leadAtFrame0 + zone.period * slabKs[i] - travel;
        const groundZ = -(lead - darkLen / 2) * P;
        slabs[i].position.set(-lightDir.x * t, goboHeight, groundZ - lightDir.z * t);
        const a = Math.max(lead, probeNear);
        const b = Math.min(lead + zone.length, probeFar);
        lit += Math.max(0, b - a);
      }
      bounce.intensity = LIGHTS.bounce.intensity * Math.min(1, lit / (probeFar - probeNear));
      // far strip: v = (distance - lead) / period
      bandTex.offset.y = (farStart - zone.leadAtFrame0 + travel) / PERIOD;

      // parcels vibrate on the rollers (noise sampled on a circle -> loops)
      const vib = CONFIG.vibration;
      const circ = (DURATION_IN_FRAMES / FPS) * vib.hz;
      const radius = circ / (Math.PI * 2);
      const ang = (f / DURATION_IN_FRAMES) * Math.PI * 2;
      const nx = Math.cos(ang) * radius;
      const ny = Math.sin(ang) * radius;
      for (const p of parcels) {
        p.group.position.y = p.baseY + noise3D(p.seed, nx, ny, 0) * vib.amplitude * P;
        p.group.rotation.x = noise3D(p.seed + 1, nx, ny, 5) * deg(vib.tiltDeg);
        p.group.rotation.z = noise3D(p.seed + 2, nx, ny, 9) * deg(vib.tiltDeg);
      }
    },
  };
};
