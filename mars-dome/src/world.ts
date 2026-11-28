import * as THREE from "three";
import { BuildingSpec, CONFIG, DURATION_IN_FRAMES, PALETTE as PAL, Variant } from "./config";
import type { World } from "./engine/Stage";
import { mulberry32, range, Rng } from "./engine/rng";
import { LIGHTS, LOOK } from "./look";

const deg = THREE.MathUtils.degToRad;
const col = (hex: string) => new THREE.Color(hex);
const TAU = Math.PI * 2;
/** Compass direction on the ground: 0 = towards the camera (+z), 90 = to the camera's right (+x). */
const dir = (azDeg: number) => new THREE.Vector3(Math.sin(deg(azDeg)), 0, Math.cos(deg(azDeg)));

// --------------------------------------------------------------------------- noise + textures
const makeNoise = (seed: number, size = 128) => {
  const rng = mulberry32(seed);
  const g = new Float32Array(size * size);
  for (let i = 0; i < g.length; i++) g[i] = rng();
  const at = (a: number, b: number) => g[(((b % size) + size) % size) * size + (((a % size) + size) % size)];
  const value = (x: number, y: number) => {
    const xi = Math.floor(x);
    const yi = Math.floor(y);
    const tx = x - xi;
    const ty = y - yi;
    const sx = tx * tx * (3 - 2 * tx);
    const sy = ty * ty * (3 - 2 * ty);
    return (at(xi, yi) * (1 - sx) + at(xi + 1, yi) * sx) * (1 - sy) + (at(xi, yi + 1) * (1 - sx) + at(xi + 1, yi + 1) * sx) * sy;
  };
  const fbm = (x: number, y: number, oct = 4) => {
    let a = 0.5;
    let s = 0;
    let n = 0;
    for (let i = 0; i < oct; i++) {
      s += value(x, y) * a;
      n += a;
      x = x * 2.03 + 17.1;
      y = y * 2.03 + 9.7;
      a *= 0.5;
    }
    return s / n;
  };
  /** Ridged fractal: sharp crests, broad valleys. 0-1. */
  const ridged = (x: number, y: number, oct = 5) => {
    let a = 0.5;
    let s = 0;
    let n = 0;
    for (let i = 0; i < oct; i++) {
      const v = 1 - Math.abs(value(x, y) * 2 - 1);
      s += v * v * a;
      n += a;
      x = x * 2.07 + 31.3;
      y = y * 2.07 + 11.9;
      a *= 0.5;
    }
    return s / n;
  };
  return { value, fbm, ridged };
};

const canvasTexture = (w: number, h: number, draw: (ctx: CanvasRenderingContext2D) => void) => {
  const canvas = document.createElement("canvas");
  canvas.width = w;
  canvas.height = h;
  draw(canvas.getContext("2d") as CanvasRenderingContext2D);
  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.wrapS = THREE.RepeatWrapping;
  tex.wrapT = THREE.RepeatWrapping;
  tex.anisotropy = 8;
  return tex;
};

/** Painted hull panels: seams, slightly different panel tints, grime streaks, fine speckle. Greyscale, multiplies the colour. */
const panelTexture = (seed: number, cols: number, rows: number, seamTone = 0.62) =>
  canvasTexture(512, 512, (ctx) => {
    const rng = mulberry32(seed);
    const n = makeNoise(seed + 1, 64);
    const img = ctx.createImageData(512, 512);
    const tint = new Float32Array(cols * rows);
    for (let i = 0; i < tint.length; i++) tint[i] = range(rng, 0.9, 1);
    for (let y = 0; y < 512; y++) {
      for (let x = 0; x < 512; x++) {
        const u = (x / 512) * cols;
        const v = (y / 512) * rows;
        const fu = u - Math.floor(u);
        const fv = v - Math.floor(v);
        const seam = Math.min(fu, 1 - fu) * (512 / cols) < 2.2 || Math.min(fv, 1 - fv) * (512 / rows) < 2.2 ? seamTone : 1;
        const grime = 0.82 + 0.18 * n.fbm(x / 70, y / 22, 3);
        const streak = 0.94 + 0.06 * n.value(x / 5, y / 90);
        const fine = 0.97 + 0.03 * rng();
        const t = tint[(Math.floor(v) % rows) * cols + (Math.floor(u) % cols)];
        const c = Math.round(255 * Math.min(1, t * seam * grime * streak * fine));
        const i = (y * 512 + x) * 4;
        img.data[i] = c;
        img.data[i + 1] = c;
        img.data[i + 2] = c;
        img.data[i + 3] = 255;
      }
    }
    ctx.putImageData(img, 0, 0);
  });

/** Plaza paving: concentric rings of slabs with seams, per-slab tint, stains. Mapped onto a disc. */
const plazaTexture = () =>
  canvasTexture(1536, 1536, (ctx) => {
    const S = 1536;
    const n = makeNoise(501, 128);
    const img = ctx.createImageData(S, S);
    const base = col(PAL.plaza);
    const seamC = col(PAL.plazaSeam);
    const hash = (a: number, b: number) => {
      let h = (Math.imul(a, 374761393) + Math.imul(b, 668265263)) >>> 0;
      h = Math.imul(h ^ (h >>> 13), 1274126177) >>> 0;
      return ((h ^ (h >>> 16)) >>> 0) / 4294967296;
    };
    const R = CONFIG.dome.baseRadius;
    for (let y = 0; y < S; y++) {
      for (let x = 0; x < S; x++) {
        const px = (x / S - 0.5) * 2 * R;
        const py = (y / S - 0.5) * 2 * R;
        const r = Math.hypot(px, py);
        const a = Math.atan2(py, px);
        const ringW = 1.7;
        const ring = Math.floor(r / ringW);
        const slabs = Math.max(8, Math.round((ring + 0.5) * 3.6));
        const fa = ((a / TAU + 1 + ring * 0.137) % 1) * slabs;
        const slab = Math.floor(fa);
        const dr = Math.min(r / ringW - ring, ring + 1 - r / ringW) * ringW;
        const da = Math.min(fa - slab, slab + 1 - fa) * ((TAU * r) / slabs);
        const seam = Math.min(dr, da) < 0.04 ? 1 : 0;
        const tint = 0.9 + 0.12 * hash(ring, slab);
        const stain = 0.86 + 0.2 * n.fbm(x / 110, y / 110, 4);
        const fine = 0.96 + 0.05 * n.value(x / 2.3, y / 2.3);
        const k = tint * stain * fine;
        const i = (y * S + x) * 4;
        const srgb = (c: number) => Math.round(255 * Math.min(1, c));
        const cr = seam ? seamC.r : base.r * k;
        const cg = seam ? seamC.g : base.g * k;
        const cb = seam ? seamC.b : base.b * k;
        // THREE.Color stores linear values; convert back for the canvas
        img.data[i] = srgb(Math.pow(cr, 1 / 2.2));
        img.data[i + 1] = srgb(Math.pow(cg, 1 / 2.2));
        img.data[i + 2] = srgb(Math.pow(cb, 1 / 2.2));
        img.data[i + 3] = 255;
      }
    }
    ctx.putImageData(img, 0, 0);
  });

/** Soft round blob (white, alpha falls off) for lamp light pools. */
const glowTexture = () =>
  canvasTexture(128, 128, (ctx) => {
    const g = ctx.createRadialGradient(64, 64, 0, 64, 64, 64);
    g.addColorStop(0, "rgba(255,255,255,1)");
    g.addColorStop(0.25, "rgba(255,255,255,0.5)");
    g.addColorStop(0.6, "rgba(255,255,255,0.12)");
    g.addColorStop(1, "rgba(255,255,255,0)");
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, 128, 128);
  });

// --------------------------------------------------------------------------- geometry helpers
/** Cylinder between two points. */
const strut = (a: THREE.Vector3, b: THREE.Vector3, r0: number, r1: number, mat: THREE.Material, seg = 10) => {
  const len = a.distanceTo(b);
  const geo = new THREE.CylinderGeometry(r1, r0, len, seg, 1, false);
  const mesh = new THREE.Mesh(geo, mat);
  mesh.position.copy(a).add(b).multiplyScalar(0.5);
  mesh.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), b.clone().sub(a).normalize());
  return mesh;
};

/** Flat box-section beam swept along a path that lies in a vertical plane through the tower axis. */
const beamAlong = (pts: THREE.Vector3[], width: number, thick: number) => {
  const pos: number[] = [];
  const uvs: number[] = [];
  const ring: THREE.Vector3[][] = [];
  let run = 0;
  const runs: number[] = [];
  for (let i = 0; i < pts.length; i++) {
    const a = pts[Math.max(0, i - 1)];
    const b = pts[Math.min(pts.length - 1, i + 1)];
    const t = b.clone().sub(a).normalize();
    const side = new THREE.Vector3(-pts[i].z, 0, pts[i].x).normalize();
    const up = new THREE.Vector3().crossVectors(side, t).normalize();
    if (up.y < 0) up.negate();
    const c = pts[i];
    ring.push([
      c.clone().addScaledVector(side, -width / 2).addScaledVector(up, thick / 2),
      c.clone().addScaledVector(side, width / 2).addScaledVector(up, thick / 2),
      c.clone().addScaledVector(side, width / 2).addScaledVector(up, -thick / 2),
      c.clone().addScaledVector(side, -width / 2).addScaledVector(up, -thick / 2),
    ]);
    if (i > 0) run += pts[i].distanceTo(pts[i - 1]);
    runs.push(run);
  }
  const quad = (a: THREE.Vector3, b: THREE.Vector3, c: THREE.Vector3, d: THREE.Vector3, u0: number, u1: number) => {
    for (const [p, u, v] of [[a, u0, 0], [b, u0, 1], [c, u1, 1], [a, u0, 0], [c, u1, 1], [d, u1, 0]] as [THREE.Vector3, number, number][]) {
      pos.push(p.x, p.y, p.z);
      uvs.push(u / 6, v);
    }
  };
  for (let i = 0; i < pts.length - 1; i++) {
    for (let k = 0; k < 4; k++) {
      quad(ring[i][k], ring[i][(k + 1) % 4], ring[i + 1][(k + 1) % 4], ring[i + 1][k], runs[i], runs[i + 1]);
    }
  }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute("position", new THREE.Float32BufferAttribute(pos, 3));
  geo.setAttribute("uv", new THREE.Float32BufferAttribute(uvs, 2));
  geo.computeVertexNormals();
  return geo;
};

/** Height of the dome skin at distance r from the tower axis (a spherical cap). */
const domeProfile = () => {
  const { baseRadius: R, hubHeight: H } = CONFIG.dome;
  const rs = (R * R + H * H) / (2 * H);
  const yc = H - rs;
  return (r: number) => Math.sqrt(Math.max(0, rs * rs - r * r)) + yc;
};

const shadowed = <T extends THREE.Object3D>(o: T, cast = true, receive = true) => {
  o.traverse((m) => {
    if ((m as THREE.Mesh).isMesh) {
      m.castShadow = cast;
      m.receiveShadow = receive;
    }
  });
  return o;
};

// --------------------------------------------------------------------------- terrain
const buildTerrain = () => {
  const cfg = CONFIG.terrain;
  const n = makeNoise(cfg.seed, 256);
  const [sx, sz] = cfg.size;
  const segX = cfg.segments;
  const segZ = Math.round((cfg.segments * sz) / sx);
  const geo = new THREE.PlaneGeometry(sx, sz, segX, segZ);
  geo.rotateX(-Math.PI / 2);
  geo.translate(0, 0, -sz / 2 + 130);
  const pos = geo.attributes.position;
  const colors = new Float32Array(pos.count * 3);
  const lit = col(PAL.terrainLit);
  const dark = col(PAL.terrainDark);
  const pale = col(PAL.terrainPale);
  const sand = col(PAL.sand);
  const c = new THREE.Color();
  const smooth = (a: number, b: number, v: number) => {
    const t = Math.max(0, Math.min(1, (v - a) / (b - a)));
    return t * t * (3 - 2 * t);
  };
  const heights = new Float32Array(pos.count);
  const tones = new Float32Array(pos.count * 3); // crest, crag, plateau mask
  for (let i = 0; i < pos.count; i++) {
    const x = pos.getX(i);
    const z = pos.getZ(i);
    const d = Math.hypot(x, z);
    const off = smooth(50, 130, d); // 0 on the plateau under the dome, 1 beyond its edge
    const big = n.ridged(x / 300 + 3.1, z / 300 + 1.7, 5);
    const mid = n.ridged(x / 80 + 9.2, z / 80 + 4.4, 4);
    const small = n.fbm(x / 18, z / 18, 3);
    // jagged outcrops behind the dome, mostly to the camera's right
    const crag = (smooth(-20, 60, x) + 0.4 * smooth(40, -120, x)) * smooth(-40, -95, z) * (1 - smooth(-300, -470, z));
    // a great wall of cliffs across the far side of the valley, nearer on the left
    const wall = smooth(0, 1, (-z - (380 + 0.45 * x)) / 520);
    let h = -24 * off;
    h += off * ((big - 0.42) * (20 + d * 0.06) + (mid - 0.4) * 14 + (small - 0.5) * 3.2);
    h += crag * (n.fbm(x / 70 + 2, z / 70 + 7, 4) * 95 + n.ridged(x / 20 + 5, z / 20 + 3, 4) * 24 - 34);
    h += wall * (250 + (big - 0.5) * 300 + (mid - 0.4) * 160);
    heights[i] = h - 0.6;
    pos.setY(i, heights[i]);
    tones[i * 3] = Math.max(0, Math.min(1, big * 0.9 + mid * 0.6 - 0.4));
    tones[i * 3 + 1] = crag;
    tones[i * 3 + 2] = 1 - off;
  }
  geo.computeVertexNormals();
  // bake the sun's relief into the colours as well: at grazing view angles the shading alone is too gentle
  const sunV = new THREE.Vector3(
    Math.sin(deg(LIGHTS.sun.azimuthDeg)) * Math.cos(deg(LIGHTS.sun.elevationDeg)),
    Math.sin(deg(LIGHTS.sun.elevationDeg)),
    Math.cos(deg(LIGHTS.sun.azimuthDeg)) * Math.cos(deg(LIGHTS.sun.elevationDeg)),
  ).normalize();
  const nrm = geo.attributes.normal;
  for (let i = 0; i < pos.count; i++) {
    const crest = tones[i * 3];
    const crag = tones[i * 3 + 1];
    const facing = nrm.getX(i) * sunV.x + nrm.getY(i) * sunV.y + nrm.getZ(i) * sunV.z;
    const steep = 1 - nrm.getY(i);
    c.copy(dark).lerp(lit, smooth(0.25, 0.8, facing) * 0.75 + crest * 0.35);
    c.lerp(pale, smooth(0.55, 0.95, crest) * 0.6);
    c.lerp(dark, Math.min(1, crag * 0.55 + steep * 0.5));
    c.multiplyScalar(1 - 0.7 * crag);
    // the far wall falls into shade towards the camera's right
    c.multiplyScalar(1 - 0.42 * smooth(0, 1, (-pos.getZ(i) - (380 + 0.45 * pos.getX(i))) / 520) * smooth(-150, 350, pos.getX(i)));
    c.lerp(sand, tones[i * 3 + 2]);
    c.multiplyScalar(0.86 + 0.28 * n.fbm(pos.getX(i) / 14, pos.getZ(i) / 14, 2));
    colors[i * 3] = c.r;
    colors[i * 3 + 1] = c.g;
    colors[i * 3 + 2] = c.b;
  }
  geo.setAttribute("color", new THREE.BufferAttribute(colors, 3));
  // fine erosion pattern on top of the vertex colours (the mesh itself is too coarse for it)
  const dn = makeNoise(cfg.seed + 5, 128);
  const detail = canvasTexture(512, 512, (ctx) => {
    const img = ctx.createImageData(512, 512);
    for (let y = 0; y < 512; y++) {
      for (let x = 0; x < 512; x++) {
        // tileable: sample the noise on a 128-cell torus
        const v = 0.5 + 0.64 * dn.ridged((x / 512) * 8, (y / 512) * 8, 5) + 0.16 * (dn.value(x / 3, y / 3) - 0.5) + 0.12 * dn.ridged((x / 512) * 40, (y / 512) * 40, 2);
        const cc = Math.round(255 * Math.max(0, Math.min(1, v)));
        const i = (y * 512 + x) * 4;
        img.data[i] = cc;
        img.data[i + 1] = cc;
        img.data[i + 2] = cc;
        img.data[i + 3] = 255;
      }
    }
    ctx.putImageData(img, 0, 0);
  });
  const uv = geo.attributes.uv;
  for (let i = 0; i < pos.count; i++) uv.setXY(i, pos.getX(i) / 150, pos.getZ(i) / 150);
  const mesh = new THREE.Mesh(geo, new THREE.MeshStandardMaterial({ vertexColors: true, map: detail, roughness: 1, metalness: 0 }));
  mesh.frustumCulled = false;
  return mesh;
};

// --------------------------------------------------------------------------- buildings
interface Mats {
  hull: THREE.MeshStandardMaterial;
  hullLong: THREE.MeshStandardMaterial;
  dark: THREE.MeshStandardMaterial;
  accent: THREE.MeshStandardMaterial;
  roof: THREE.MeshStandardMaterial;
  glassDark: THREE.MeshStandardMaterial;
}

const buildBuilding = (spec: BuildingSpec, m: Mats, rng: Rng) => {
  const g = new THREE.Group();
  if (spec.kind === "capsules") {
    const r = 1.25;
    const L = spec.length;
    for (let i = 0; i < spec.levels; i++) {
      const cap = new THREE.Mesh(new THREE.CapsuleGeometry(r, L - 2 * r, 8, 24), m.hullLong);
      cap.rotation.z = Math.PI / 2;
      cap.position.y = r + 0.25 + i * r * 1.94;
      g.add(cap);
      for (const bx of [-L * 0.22, L * 0.2]) {
        const band = new THREE.Mesh(new THREE.CylinderGeometry(r + 0.03, r + 0.03, 0.5, 24, 1, true), m.accent);
        band.rotation.z = Math.PI / 2;
        band.position.set(bx, cap.position.y, 0);
        g.add(band);
      }
    }
    // end frame with hatches, facing +x
    const top = spec.levels * r * 1.94 + 0.7;
    const frame = new THREE.Mesh(new THREE.BoxGeometry(0.7, top, r * 2.5), m.hull);
    frame.position.set(L / 2 - 0.5, top / 2, 0);
    g.add(frame);
    for (let i = 0; i < spec.levels; i++) {
      const hatch = new THREE.Mesh(new THREE.TorusGeometry(0.85, 0.13, 8, 24), m.dark);
      hatch.rotation.y = Math.PI / 2;
      hatch.position.set(L / 2 - 0.12, r + 0.25 + i * r * 1.94, 0);
      g.add(hatch);
    }
    const annex = new THREE.Mesh(new THREE.BoxGeometry(2.2, 2.6, 1.6), m.hull);
    annex.position.set(L / 2 - 1.4, 1.3, r * 1.25 + 0.8);
    g.add(annex);
  } else if (spec.kind === "rings") {
    const r = 3.0;
    const h = 2.1;
    const k = 0.38;
    const pts: THREE.Vector2[] = [new THREE.Vector2(0, 0)];
    for (let i = 0; i <= 6; i++) {
      const a = -Math.PI / 2 + (i / 6) * (Math.PI / 2);
      pts.push(new THREE.Vector2(r - k + Math.cos(a) * k, k + Math.sin(a) * k));
    }
    for (let i = 0; i <= 6; i++) {
      const a = (i / 6) * (Math.PI / 2);
      pts.push(new THREE.Vector2(r - k + Math.cos(a) * k, h - k + Math.sin(a) * k));
    }
    pts.push(new THREE.Vector2(0, h));
    const geo = new THREE.LatheGeometry(pts, 40);
    for (let i = 0; i < spec.levels; i++) {
      const ring = new THREE.Mesh(geo, m.hull);
      ring.position.y = 0.15 + i * (h + 0.06);
      ring.rotation.y = rng() * TAU;
      g.add(ring);
      const bandGeo = new THREE.CylinderGeometry(r + 0.015, r + 0.015, 0.3, 40, 1, true, 0.25, 1.1);
      for (let w = 0; w < 4; w++) {
        const win = new THREE.Mesh(bandGeo, m.glassDark);
        win.position.y = ring.position.y + h * 0.56;
        win.rotation.y = (w / 4) * TAU + i * 0.5;
        g.add(win);
      }
    }
    const topY = 0.15 + spec.levels * (h + 0.06) - 0.05;
    const inset = new THREE.Mesh(new THREE.CylinderGeometry(1.9, 1.9, 0.08, 32), m.roof);
    inset.position.y = topY;
    g.add(inset);
    const vent = new THREE.Mesh(new THREE.BoxGeometry(0.6, 0.45, 0.6), m.accent);
    vent.position.set(range(rng, -0.6, 0.6), topY + 0.25, range(rng, -0.6, 0.6));
    g.add(vent);
  } else if (spec.kind === "hall") {
    // low, wide, flat-fronted panelled block with a stepped roof
    const L = spec.length;
    const body = new THREE.Mesh(new THREE.BoxGeometry(L, 4.6, 5.2), m.hullLong);
    body.position.y = 2.3;
    g.add(body);
    const upper = new THREE.Mesh(new THREE.BoxGeometry(L * 0.7, 1.2, 3.6), m.hull);
    upper.position.set(-L * 0.08, 5.2, -0.3);
    g.add(upper);
    for (let i = 0; i < 3; i++) {
      const win = new THREE.Mesh(new THREE.BoxGeometry(L * 0.86, 0.34, 0.1), m.glassDark);
      win.position.set(0, 1.2 + i * 1.35, 2.62);
      g.add(win);
    }
    const porch = new THREE.Mesh(new THREE.BoxGeometry(2.2, 2.4, 1.2), m.dark);
    porch.position.set(L * 0.22, 1.2, 3.1);
    g.add(porch);
  } else if (spec.kind === "block") {
    const L = spec.length;
    const body = new THREE.Mesh(new THREE.BoxGeometry(L, 4.3, 3.3), m.hull);
    body.position.y = 2.15;
    g.add(body);
    const roof = new THREE.Mesh(new THREE.BoxGeometry(L * 0.82, 0.14, 2.7), m.roof);
    roof.position.y = 4.37;
    g.add(roof);
    const door = new THREE.Mesh(new THREE.BoxGeometry(1.1, 2.1, 0.1), m.dark);
    door.position.set(L * 0.15, 1.05, 1.66);
    g.add(door);
    const pod = new THREE.Mesh(new THREE.BoxGeometry(1.1, 1.3, 0.9), m.dark);
    pod.position.set(-L * 0.25, 0.65, 2.0);
    g.add(pod);
  } else {
    const r = 1.75;
    const L = spec.length;
    const hall = new THREE.Mesh(new THREE.CapsuleGeometry(r, L - 2 * r, 8, 24), m.hullLong);
    hall.rotation.z = Math.PI / 2;
    hall.position.y = r * 0.42;
    g.add(hall);
    for (let i = -1; i <= 1; i++) {
      const rib = new THREE.Mesh(new THREE.TorusGeometry(r + 0.02, 0.07, 6, 24), m.dark);
      rib.rotation.y = Math.PI / 2;
      rib.position.set((i * (L - 2 * r)) / 2.6, r * 0.42, 0);
      g.add(rib);
    }
  }
  g.position.set(spec.at[0], 0, spec.at[1]);
  g.rotation.y = deg(spec.headingDeg);
  return shadowed(g);
};

// --------------------------------------------------------------------------- world
export const makeWorld = (variant: Variant): World => {
  const root = new THREE.Group();
  const D = CONFIG.dome;
  const profile = domeProfile();
  const rng = mulberry32(20261127);

  const hullTex = panelTexture(11, 4, 3);
  const hullLongTex = panelTexture(12, 6, 2);
  const towerTex = panelTexture(13, 8, 2, 0.8);
  const wallTex = panelTexture(14, 3, 1);
  wallTex.repeat.set(26, 1);
  const std = (color: string, extra: THREE.MeshStandardMaterialParameters = {}) =>
    new THREE.MeshStandardMaterial({ color: col(color), roughness: 0.78, metalness: 0.05, ...extra });
  const mats: Mats = {
    hull: std(PAL.hull, { map: hullTex }),
    hullLong: std(PAL.hull, { map: hullLongTex }),
    dark: std(PAL.hullDark, { roughness: 0.7 }),
    accent: std(PAL.hullAccent, { roughness: 0.6, side: THREE.DoubleSide }),
    roof: std(PAL.roofInset, { roughness: 0.9 }),
    glassDark: std(PAL.towerGlass, { roughness: 0.25, metalness: 0.3 }),
  };
  const beamMat = std(PAL.beam, { roughness: 0.5, side: THREE.DoubleSide });
  const towerMat = std(PAL.tower, { map: towerTex });
  towerMat.color.multiplyScalar(1.12);

  // --- terrain around the base
  root.add(buildTerrain());

  // --- plaza, perimeter wall, plinth
  const plaza = new THREE.Mesh(new THREE.CircleGeometry(D.baseRadius, 128), new THREE.MeshStandardMaterial({ map: plazaTexture(), roughness: 0.85, metalness: 0 }));
  plaza.rotation.x = -Math.PI / 2;
  plaza.position.y = 0.02;
  plaza.receiveShadow = true;
  root.add(plaza);
  const wallPts = [
    new THREE.Vector2(D.plazaRadius - 0.5, 0),
    new THREE.Vector2(D.plazaRadius - 0.5, 2.3),
    new THREE.Vector2(D.plazaRadius + 0.5, 2.3),
    new THREE.Vector2(D.plazaRadius + 0.5, 0),
  ];
  const wall = new THREE.Mesh(new THREE.LatheGeometry(wallPts, 160), std(PAL.wall, { map: wallTex }));
  root.add(shadowed(wall));
  const innerWall = new THREE.Mesh(
    new THREE.LatheGeometry([new THREE.Vector2(23.6, 0), new THREE.Vector2(23.6, 2.3), new THREE.Vector2(24.5, 2.3), new THREE.Vector2(24.5, 0)], 64, deg(112), deg(136)),
    std(PAL.wall, { map: wallTex }),
  );
  root.add(shadowed(innerWall));
  const skirt = new THREE.Mesh(
    new THREE.LatheGeometry([new THREE.Vector2(D.baseRadius, 0.4), new THREE.Vector2(D.baseRadius + 1.2, 0.4), new THREE.Vector2(D.baseRadius + 4, -1.2)], 128),
    std(PAL.hullDark, { roughness: 0.9 }),
  );
  root.add(shadowed(skirt, false, true));

  // --- planted plots with curbs
  const grassMat = std(PAL.grass, { roughness: 1 });
  const curbMat = std(PAL.curb, { roughness: 0.85 });
  const sector = (r0: number, r1: number, a0: number, a1: number, height: number) => {
    const shape = new THREE.Shape();
    const steps = 28;
    for (let i = 0; i <= steps; i++) {
      const a = deg(a0 + ((a1 - a0) * i) / steps);
      const x = Math.sin(a) * r1;
      const y = -Math.cos(a) * r1;
      if (i === 0) shape.moveTo(x, y);
      else shape.lineTo(x, y);
    }
    for (let i = steps; i >= 0; i--) {
      const a = deg(a0 + ((a1 - a0) * i) / steps);
      shape.lineTo(Math.sin(a) * r0, -Math.cos(a) * r0);
    }
    const geo = new THREE.ExtrudeGeometry(shape, { depth: height, bevelEnabled: false });
    geo.rotateX(-Math.PI / 2);
    return geo;
  };
  for (const p of CONFIG.plots) {
    const pad = (0.45 / ((p.r0 + p.r1) / 2)) * (180 / Math.PI);
    const curb = new THREE.Mesh(sector(p.r0 - 0.45, p.r1 + 0.45, p.a0 - pad, p.a1 + pad, 0.22), curbMat);
    const grass = new THREE.Mesh(sector(p.r0, p.r1, p.a0, p.a1, 0.32), grassMat);
    root.add(shadowed(curb, true, true), shadowed(grass, true, true));
  }

  // --- central tower and hub
  const tower = new THREE.Group();
  const hh0 = D.hubHeight - 4.5;
  const column = new THREE.Mesh(new THREE.CylinderGeometry(2.1, 2.3, hh0 - 0.8, 28), towerMat);
  column.position.y = 0.8 + (hh0 - 0.8) / 2;
  tower.add(column);
  const foot = new THREE.Mesh(new THREE.CylinderGeometry(2.7, 3.5, 1.3, 28), towerMat);
  foot.position.y = 0.65;
  tower.add(foot);
  for (let i = 0; i < 6; i++) {
    const a = (i / 6) * TAU + 0.3;
    const fin = new THREE.Mesh(new THREE.BoxGeometry(0.5, 2.6, 1.5), mats.dark);
    fin.position.set(Math.sin(a) * 2.5, 1.5, Math.cos(a) * 2.5);
    fin.rotation.y = a;
    tower.add(fin);
  }
  const hr = D.hubRadius;
  const hh = D.hubHeight;
  const hubPts = [
    new THREE.Vector2(2.1, hh - 4.6),
    new THREE.Vector2(hr * 0.45, hh - 4.1),
    new THREE.Vector2(hr * 0.74, hh - 3.3),
    new THREE.Vector2(hr * 0.94, hh - 2.3),
    new THREE.Vector2(hr, hh - 1.7),
    new THREE.Vector2(hr, hh - 0.8),
    new THREE.Vector2(hr * 0.93, hh - 0.3),
    new THREE.Vector2(hr * 0.68, hh),
    new THREE.Vector2(0, hh + 0.05),
  ];
  tower.add(new THREE.Mesh(new THREE.LatheGeometry(hubPts, 56), towerMat));
  const band = new THREE.Mesh(new THREE.CylinderGeometry(D.hubRadius + 0.03, D.hubRadius + 0.03, 0.55, 56, 1, true), mats.glassDark);
  band.position.y = D.hubHeight - 1.25;
  tower.add(band);
  const cap = new THREE.Mesh(new THREE.CylinderGeometry(2.6, 3.0, 0.35, 28), mats.dark);
  cap.position.y = D.hubHeight + 0.2;
  tower.add(cap);
  for (let i = 0; i < 8; i++) {
    const a = (i / 8) * TAU;
    const rib = new THREE.Mesh(new THREE.BoxGeometry(0.22, 0.12, 4.2), mats.dark);
    rib.position.set(Math.sin(a) * 5, D.hubHeight + 0.02, Math.cos(a) * 5);
    rib.rotation.y = a;
    tower.add(rib);
  }
  root.add(shadowed(tower));

  // --- arch ribs following the dome skin
  for (const azDeg of D.archAzimuthsDeg) {
    const d = dir(azDeg);
    const pts: THREE.Vector3[] = [];
    for (let i = 0; i <= 24; i++) {
      const r = D.hubRadius - 0.4 + ((D.baseRadius + 0.6 - (D.hubRadius - 0.4)) * i) / 24;
      pts.push(new THREE.Vector3(d.x * r, profile(Math.min(r, D.baseRadius)) + 0.25, d.z * r));
    }
    const arch = new THREE.Mesh(beamAlong(new THREE.CatmullRomCurve3(pts).getPoints(60), 3.2, 0.9), beamMat);
    root.add(shadowed(arch));
    const shoe = new THREE.Mesh(new THREE.BoxGeometry(2.6, 2.2, 2.6), mats.dark);
    shoe.position.set(d.x * (D.baseRadius + 0.4), 0.8, d.z * (D.baseRadius + 0.4));
    shoe.rotation.y = deg(azDeg);
    root.add(shadowed(shoe));
    const joint = new THREE.Mesh(new THREE.BoxGeometry(1.5, 0.5, 1.2), std(PAL.hull, { roughness: 0.6 }));
    joint.position.set(d.x * (D.hubRadius - 0.6), D.hubHeight + 0.2, d.z * (D.hubRadius - 0.6));
    joint.rotation.y = deg(azDeg);
    root.add(joint);
  }

  // --- dome glass: thin reflective skin, brighter at grazing angles
  const glassPts: THREE.Vector2[] = [];
  for (let i = 0; i <= 40; i++) {
    const r = D.hubRadius + ((D.baseRadius - D.hubRadius) * i) / 40;
    glassPts.push(new THREE.Vector2(r, profile(r)));
  }
  const sunDir = new THREE.Vector3(
    Math.sin(deg(LIGHTS.sun.azimuthDeg)) * Math.cos(deg(LIGHTS.sun.elevationDeg)),
    Math.sin(deg(LIGHTS.sun.elevationDeg)),
    Math.cos(deg(LIGHTS.sun.azimuthDeg)) * Math.cos(deg(LIGHTS.sun.elevationDeg)),
  ).normalize();
  // Where the sky's bright patch must sit so that its reflection lands at the chosen point of the base frame.
  const G = LIGHTS.glass;
  const hotspotDir = (() => {
    const camPos = new THREE.Vector3(...CONFIG.camera.position);
    const f = 1 / Math.tan(deg(CONFIG.camera.fovY) / 2);
    const ray = new THREE.Vector3(((G.hotspotAt[0] * 2 - 1) * 16) / 9 / f, -(G.hotspotAt[1] * 2 - 1) / f, -1).normalize();
    ray.applyAxisAngle(new THREE.Vector3(1, 0, 0), -deg(CONFIG.camera.pitchDeg));
    // intersect with the dome sphere
    const rs = (D.baseRadius * D.baseRadius + D.hubHeight * D.hubHeight) / (2 * D.hubHeight);
    const centre = new THREE.Vector3(0, D.hubHeight - rs, 0);
    const oc = camPos.clone().sub(centre);
    const bq = oc.dot(ray);
    const cq = oc.lengthSq() - rs * rs;
    const disc = bq * bq - cq;
    if (disc <= 0) return new THREE.Vector3(0, 1, 0);
    const hit = camPos.clone().addScaledVector(ray, -bq - Math.sqrt(disc));
    const nrm = hit.clone().sub(centre).normalize();
    return ray.clone().reflect(nrm).normalize();
  })();
  const glassMat = new THREE.ShaderMaterial({
    transparent: true,
    depthWrite: false,
    side: THREE.DoubleSide,
    // out = reflection + what is behind * transmittance  (the glass dims, it does not veil)
    blending: THREE.CustomBlending,
    blendEquation: THREE.AddEquation,
    blendSrc: THREE.OneFactor,
    blendDst: THREE.SrcAlphaFactor,
    uniforms: {
      uHorizon: { value: col(PAL.hazeSun) },
      uZenith: { value: col(PAL.skyFill) },
      uSunDir: { value: sunDir },
      uHotDir: { value: hotspotDir },
      uParams: { value: new THREE.Vector4(G.transmit, G.grazing, G.sunGlint, G.hotspot) },
      uVeil: { value: G.veil },
      uHotPower: { value: G.hotspotPower },
    },
    vertexShader: /* glsl */ `
      varying vec3 vWorldNormal;
      varying vec3 vWorldPos;
      void main() {
        vec4 wp = modelMatrix * vec4(position, 1.0);
        vWorldPos = wp.xyz;
        vWorldNormal = normalize(mat3(modelMatrix) * normal);
        gl_Position = projectionMatrix * viewMatrix * wp;
      }`,
    fragmentShader: /* glsl */ `
      varying vec3 vWorldNormal;
      varying vec3 vWorldPos;
      uniform vec3 uHorizon;
      uniform vec3 uZenith;
      uniform vec3 uSunDir;
      uniform vec3 uHotDir;
      uniform vec4 uParams;
      uniform float uHotPower;
      uniform float uVeil;
      void main() {
        vec3 V = normalize(cameraPosition - vWorldPos);
        vec3 N = normalize(vWorldNormal);
        float facing = dot(N, V);
        if (facing < 0.0) N = -N;
        float ndv = clamp(abs(facing), 0.0, 1.0);
        float F = pow(1.0 - ndv, 5.0);
        vec3 R = reflect(-V, N);
        vec3 sky = mix(uHorizon, uZenith, clamp(R.y * 1.4 + 0.25, 0.0, 1.0));
        float glint = pow(max(dot(R, uSunDir), 0.0), 260.0) * uParams.z;
        // a broad bright patch of sky mirrored in the near side of the dome
        float hot = pow(max(dot(R, uHotDir), 0.0), uHotPower) * uParams.w;
        float refl = mix(0.02, uParams.y, F) + hot;
        float transmit = mix(uParams.x, 0.35, F) * (1.0 - 0.5 * hot);
        gl_FragColor = vec4(sky * 1.2 * mix(uVeil, uParams.y, F) + mix(sky, vec3(1.0, 0.86, 0.66), 0.5) * hot + vec3(glint), clamp(transmit, 0.0, 1.0));
      }`,
  });
  const glass = new THREE.Mesh(new THREE.LatheGeometry(glassPts, 128), glassMat);
  glass.renderOrder = 5;
  root.add(glass);

  // --- outer masts, stays and beacons
  const mastMat = std(PAL.mast, { roughness: 0.6, metalness: 0.2 });
  const cableMat = std(PAL.cable, { roughness: 0.5 });
  const beaconMat = new THREE.MeshBasicMaterial({ color: col(PAL.beacon).multiplyScalar(LIGHTS.beaconBrightness) });
  const beaconGeo = new THREE.SphereGeometry(1, 12, 8);
  for (const mast of D.masts) {
    const d = dir(mast.azimuthDeg);
    const base = new THREE.Vector3(d.x * mast.radius, 0, d.z * mast.radius);
    const inward = Math.tan(deg(mast.leanDeg)) * mast.height;
    const top = new THREE.Vector3(d.x * (mast.radius - inward), mast.height, d.z * (mast.radius - inward));
    root.add(shadowed(strut(base, top, 0.75, 0.5, mastMat), true, false));
    const head = new THREE.Mesh(new THREE.TorusGeometry(0.95, 0.3, 8, 20), mastMat);
    head.position.copy(top);
    head.rotation.y = deg(mast.azimuthDeg);
    root.add(head);
    const hubPoint = new THREE.Vector3(d.x * (D.hubRadius - 0.6), D.hubHeight + 0.45, d.z * (D.hubRadius - 0.6));
    root.add(strut(top, hubPoint, 0.05, 0.05, cableMat, 5));
    const side = new THREE.Vector3(-d.z, 0, d.x);
    for (const s of [-1, 1]) {
      const anchor = base.clone().addScaledVector(d, 7).addScaledVector(side, s * 5);
      root.add(strut(top, anchor, 0.035, 0.035, cableMat, 5));
    }
    const beacon = new THREE.Mesh(beaconGeo, beaconMat);
    beacon.scale.setScalar(0.15);
    beacon.position.copy(top).add(new THREE.Vector3(0, 0.75, 0));
    root.add(beacon);
  }

  // --- buildings
  for (const spec of CONFIG.buildings) root.add(buildBuilding(spec, mats, rng));

  // --- trees
  const treeRng = mulberry32(CONFIG.trees.seed);
  const clearOf = (x: number, z: number, margin: number) =>
    CONFIG.buildings.every((b) => Math.hypot(b.at[0] - x, b.at[1] - z) > (b.kind === "capsules" ? 6 : 3.6) + margin) && Math.hypot(x, z) > 5;
  const treeSpots: { x: number; z: number; s: number }[] = [];
  for (const p of CONFIG.plots) {
    let placed = 0;
    for (let tries = 0; tries < 60 && placed < CONFIG.trees.perPlot; tries++) {
      const r = range(treeRng, p.r0 + 1, p.r1 - 1);
      const a = deg(range(treeRng, p.a0 + 3, p.a1 - 3));
      const x = Math.sin(a) * r;
      const z = Math.cos(a) * r;
      if (!clearOf(x, z, 0.4) || treeSpots.some((t) => Math.hypot(t.x - x, t.z - z) < 2.6)) continue;
      treeSpots.push({ x, z, s: range(treeRng, 0.8, 1.25) });
      placed++;
    }
  }
  for (let i = 0; i < CONFIG.trees.extra; i++) {
    const a = treeRng() * TAU;
    const r = range(treeRng, 34, 38);
    treeSpots.push({ x: Math.sin(a) * r, z: Math.cos(a) * r, s: range(treeRng, 0.8, 1.2) });
  }
  const trunkMesh = new THREE.InstancedMesh(new THREE.CylinderGeometry(0.1, 0.16, 1, 6), std(PAL.trunk, { roughness: 1 }), treeSpots.length);
  const blobGeo = new THREE.IcosahedronGeometry(1, 1);
  const blobMesh = new THREE.InstancedMesh(blobGeo, std("#ffffff", { roughness: 1, flatShading: true }), treeSpots.length * 4);
  const dummy = new THREE.Object3D();
  const tint = new THREE.Color();
  treeSpots.forEach((t, i) => {
    const h = CONFIG.trees.height * t.s;
    dummy.position.set(t.x, 0.3 + h * 0.25, t.z);
    dummy.scale.set(1, h * 0.5, 1);
    dummy.rotation.set(0, 0, 0);
    dummy.updateMatrix();
    trunkMesh.setMatrixAt(i, dummy.matrix);
    for (let k = 0; k < 4; k++) {
      const lvl = k / 3;
      const rad = (0.82 - lvl * 0.6) * t.s;
      dummy.position.set(t.x + range(treeRng, -0.3, 0.3), 0.3 + h * (0.45 + lvl * 0.5), t.z + range(treeRng, -0.3, 0.3));
      dummy.scale.set(rad, rad * 1.7, rad);
      dummy.rotation.set(0, treeRng() * 6.283, 0);
      dummy.updateMatrix();
      blobMesh.setMatrixAt(i * 4 + k, dummy.matrix);
      blobMesh.setColorAt(i * 4 + k, tint.set(PAL.foliage).multiplyScalar(range(treeRng, 0.7, 1.2)));
    }
  });
  for (const mI of [trunkMesh, blobMesh]) {
    mI.castShadow = true;
    mI.receiveShadow = true;
    mI.instanceMatrix.needsUpdate = true;
    if (mI.instanceColor) mI.instanceColor.needsUpdate = true;
    root.add(mI);
  }

  // --- path lamps: pole, glowing bulb, pool of light on the paving
  const LAMP_HEIGHT = 1.7;
  const lampRng = mulberry32(CONFIG.lamps.seed);
  const lampSpots: [number, number][] = [];
  for (let i = 0; i < 6; i++) {
    const a = (i / 6) * TAU + 0.5;
    lampSpots.push([Math.sin(a) * 6.6, Math.cos(a) * 6.6]);
  }
  for (const p of CONFIG.plots) {
    for (const [r, a] of [
      [p.r0 - 1, p.a0 - 2],
      [p.r0 - 1, p.a1 + 2],
      [p.r1 + 1, p.a0 - 2],
      [p.r1 + 1, p.a1 + 2],
      [p.r1 + 1, (p.a0 + p.a1) / 2],
    ]) {
      lampSpots.push([Math.sin(deg(a)) * r, Math.cos(deg(a)) * r]);
    }
  }
  while (lampSpots.length < CONFIG.lamps.count) {
    const a = lampRng() * TAU;
    const r = range(lampRng, 27, 37);
    lampSpots.push([Math.sin(a) * r, Math.cos(a) * r]);
  }
  const spots = lampSpots.slice(0, CONFIG.lamps.count);
  const poleMesh = new THREE.InstancedMesh(new THREE.CylinderGeometry(0.03, 0.04, LAMP_HEIGHT, 6), std(PAL.hullDark), spots.length);
  const bulbMesh = new THREE.InstancedMesh(new THREE.SphereGeometry(0.11, 12, 8), new THREE.MeshBasicMaterial({ color: col(PAL.lamp).multiplyScalar(LIGHTS.lampBrightness) }), spots.length);
  const poolMat = new THREE.MeshBasicMaterial({ map: glowTexture(), color: col(PAL.lamp).multiplyScalar(0.1), transparent: true, depthWrite: false, blending: THREE.AdditiveBlending });
  const poolGeo = new THREE.PlaneGeometry(3.4, 3.4);
  poolGeo.rotateX(-Math.PI / 2);
  const poolMesh = new THREE.InstancedMesh(poolGeo, poolMat, spots.length);
  spots.forEach(([x, z], i) => {
    dummy.rotation.set(0, 0, 0);
    dummy.scale.set(1, 1, 1);
    dummy.position.set(x, LAMP_HEIGHT / 2, z);
    dummy.updateMatrix();
    poleMesh.setMatrixAt(i, dummy.matrix);
    dummy.position.set(x, LAMP_HEIGHT + 0.08, z);
    dummy.updateMatrix();
    bulbMesh.setMatrixAt(i, dummy.matrix);
    dummy.position.set(x, 0.36, z);
    dummy.updateMatrix();
    poolMesh.setMatrixAt(i, dummy.matrix);
  });
  poolMesh.renderOrder = 2;
  root.add(poleMesh, bulbMesh, poolMesh);
  // soft halo around every bulb (additive sprites; size is in metres, so it scales with distance)
  const haloGeo = new THREE.BufferGeometry();
  haloGeo.setAttribute("position", new THREE.Float32BufferAttribute(spots.flatMap(([x, z]) => [x, LAMP_HEIGHT + 0.08, z]), 3));
  const halo = new THREE.Points(
    haloGeo,
    new THREE.PointsMaterial({
      map: glowTexture(),
      color: col(PAL.lamp).multiplyScalar(LIGHTS.lampHalo),
      size: 1.7,
      sizeAttenuation: true,
      transparent: true,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
    }),
  );
  halo.frustumCulled = false;
  halo.renderOrder = 3;
  root.add(halo);

  // --- base camera frame (Version 1 rest position) and what it looks at
  const camCfg = CONFIG.camera;
  const basePos = new THREE.Vector3(...camCfg.position);
  const pitch = deg(camCfg.pitchDeg);
  const target = new THREE.Vector3(basePos.x, basePos.y - Math.tan(pitch) * basePos.z, 0);
  const baseDist = basePos.distanceTo(target);

  // --- a slim pole just in front of the lens (Version 1 only: a locked-off prop of that camera position)
  if (variant === "v1") {
    const frame = new THREE.Object3D();
    frame.position.copy(basePos);
    frame.rotation.set(-pitch, 0, 0);
    frame.updateMatrixWorld(true);
    const fp = CONFIG.foregroundPole;
    const a = new THREE.Vector3(...fp.top).applyMatrix4(frame.matrixWorld);
    const b = new THREE.Vector3(...fp.bottom).applyMatrix4(frame.matrixWorld);
    const ext = b.clone().add(b.clone().sub(a).multiplyScalar(0.8));
    const poleMat = std(PAL.mast, { roughness: 0.6, metalness: 0.2 });
    poleMat.color.multiplyScalar(0.85);
    root.add(strut(ext, a, fp.radius, fp.radius * 0.9, poleMat, 12));
    const head = new THREE.Mesh(new THREE.TorusGeometry(0.2, 0.07, 8, 20, Math.PI * 1.4), poleMat);
    head.position.copy(a);
    head.lookAt(basePos);
    root.add(head);
    for (const t of [0.04, 0.24]) {
      const beacon = new THREE.Mesh(beaconGeo, beaconMat);
      beacon.scale.setScalar(0.05);
      beacon.position.copy(a).lerp(b, t).add(new THREE.Vector3(-0.22, 0, 0.1));
      root.add(beacon);
    }
  }

  // --- lights
  const sun = new THREE.DirectionalLight(col(PAL.sun), LIGHTS.sun.intensity);
  sun.position.copy(sunDir).multiplyScalar(160);
  sun.target.position.set(0, 0, 0);
  sun.castShadow = true;
  sun.shadow.mapSize.set(LIGHTS.sun.shadowMapSize, LIGHTS.sun.shadowMapSize);
  sun.shadow.radius = LIGHTS.sun.shadowRadius;
  sun.shadow.bias = -0.0005;
  sun.shadow.normalBias = 0.06;
  const sc = sun.shadow.camera;
  sc.left = -52;
  sc.right = 52;
  sc.top = 52;
  sc.bottom = -52;
  sc.near = 40;
  sc.far = 300;
  sc.updateProjectionMatrix();
  root.add(sun, sun.target);
  root.add(new THREE.HemisphereLight(col(PAL.skyFill), col(PAL.groundFill), LIGHTS.hemisphere.intensity));

  let envTex: THREE.Texture | null = null;
  const harm = (rows: number[][], t: number) => rows.reduce((s, [c, sn], k) => s + c * Math.cos(TAU * (k + 1) * t) + sn * Math.sin(TAU * (k + 1) * t), 0);
  const zero = (rows: number[][]) => harm(rows, 0);
  const pos = new THREE.Vector3();
  const tgt = new THREE.Vector3();
  const yAxis = new THREE.Vector3(0, 1, 0);

  return {
    root,
    setup: (renderer, scene) => {
      if (!envTex) {
        // dusty sky dome for image-based light: bright warm horizon, paler zenith, dark warm ground
        const env = new THREE.Scene();
        const geo = new THREE.SphereGeometry(50, 32, 16);
        const colors = new Float32Array(geo.attributes.position.count * 3);
        const horizon = col(PAL.hazeSun).multiplyScalar(1.5);
        const zenith = col(PAL.skyFill).multiplyScalar(1.1);
        const ground = col(PAL.groundFill).multiplyScalar(0.7);
        const c = new THREE.Color();
        for (let i = 0; i < geo.attributes.position.count; i++) {
          const y = geo.attributes.position.getY(i) / 50;
          if (y >= 0) c.copy(horizon).lerp(zenith, Math.min(1, y * 1.6));
          else c.copy(horizon).lerp(ground, Math.min(1, -y * 5));
          colors.set([c.r, c.g, c.b], i * 3);
        }
        geo.setAttribute("color", new THREE.BufferAttribute(colors, 3));
        env.add(new THREE.Mesh(geo, new THREE.MeshBasicMaterial({ vertexColors: true, side: THREE.BackSide })));
        const pmrem = new THREE.PMREMGenerator(renderer);
        envTex = pmrem.fromScene(env, 0.02, 1, 200).texture;
        pmrem.dispose();
      }
      scene.environment = envTex;
      scene.environmentIntensity = LIGHTS.environment.intensity;
      scene.background = col(PAL.haze);
    },
    update: (frame, camera, look) => {
      const f = ((frame % DURATION_IN_FRAMES) + DURATION_IN_FRAMES) % DURATION_IN_FRAMES;
      const t = f / DURATION_IN_FRAMES;
      camera.fov = camCfg.fovY;
      camera.near = 2;
      camera.far = 6000;
      camera.rotation.order = "YXZ";
      if (variant === "v1") {
        // hand-held style drift: harmonics of the loop, offset so frame 0 sits exactly on the base frame
        const s = CONFIG.sway;
        camera.position.set(basePos.x + harm(s.x, t) - zero(s.x), basePos.y + harm(s.y, t) - zero(s.y), basePos.z);
        camera.rotation.set(-pitch + deg(harm(s.pitchDeg, t) - zero(s.pitchDeg)), deg(harm(s.yawDeg, t) - zero(s.yawDeg)), 0);
        look.dof.focus = LOOK.dof.focus;
      } else {
        // orbital sweep with a push-in: whole cycles only
        const o = CONFIG.orbit;
        const az = deg(o.centreDeg) - deg(o.sweepDeg) * Math.cos(TAU * t);
        const ease = Math.sin(Math.PI * t) ** 2;
        pos.copy(basePos).applyAxisAngle(yAxis, az);
        tgt.copy(target).applyAxisAngle(yAxis, az);
        const toTarget = tgt.clone().sub(pos).normalize();
        pos.addScaledVector(toTarget, o.pushIn * ease);
        pos.y += o.rise * ease;
        camera.position.copy(pos);
        camera.lookAt(tgt);
        look.dof.focus = LOOK.dof.focus * (pos.distanceTo(tgt) / baseDist);
      }
    },
  };
};
