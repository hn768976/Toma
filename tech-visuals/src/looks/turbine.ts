import * as THREE from "three";
import { RoundedBoxGeometry } from "three/examples/jsm/geometries/RoundedBoxGeometry.js";

/**
 * Generic three-blade horizontal-axis wind turbine, built entirely in code (no brands, no assets).
 * Units: hub height = 1. Rotor axis = +z (blades face +z, the wind comes from +z).
 */
export type Turbine = {
  group: THREE.Group;
  rotor: THREE.Group; // rotate about z
  nacelle: THREE.Group; // yaw-able head (nacelle + rotor)
  markers: THREE.Group; // glowing sensor markers (hidden by default)
  internals: THREE.Group; // drivetrain inside the nacelle (for the see-through close-up; hidden by default)
};

const TOWER_H = 1.0;
const BLADE_L = 0.54;

const towerGeometry = () => {
  const pts: THREE.Vector2[] = [];
  const n = 24;
  for (let i = 0; i <= n; i++) {
    const t = i / n;
    pts.push(new THREE.Vector2(0.034 - 0.016 * t, t * (TOWER_H - 0.02)));
  }
  pts.push(new THREE.Vector2(0.0, TOWER_H - 0.02));
  pts.unshift(new THREE.Vector2(0, 0));
  const g = new THREE.LatheGeometry(pts, 40);
  g.computeVertexNormals();
  return g;
};

const nacelleGeometry = () => {
  // long, boxy housing with rounded edges (bus-like proportions relative to the rotor)
  const g = new RoundedBoxGeometry(0.088, 0.094, 0.27, 4, 0.02);
  // slight taper toward the rotor end
  const p = g.attributes.position as THREE.BufferAttribute;
  for (let i = 0; i < p.count; i++) {
    const z = p.getZ(i);
    const k = 1 - 0.12 * Math.max(0, z / 0.135);
    p.setX(i, p.getX(i) * k);
    p.setY(i, p.getY(i) * (0.94 + 0.06 * k) + 0.004 * (1 - k));
  }
  g.computeVertexNormals();
  return g;
};

const spinnerGeometry = () => {
  const pts: THREE.Vector2[] = [];
  const n = 18;
  const L = 0.07;
  const r = 0.037;
  for (let i = 0; i <= n; i++) {
    const t = i / n;
    pts.push(new THREE.Vector2(Math.max(r * Math.sqrt(1 - t * t), 0.0001), t * L));
  }
  const g = new THREE.LatheGeometry(pts, 40);
  g.rotateX(Math.PI / 2);
  g.computeVertexNormals();
  return g;
};

/** Airfoil-ish closed section in (chord u, thickness v), u ∈ [-0.25, 0.75] of chord. */
const airfoil = (chord: number, thick: number, round: number, out: THREE.Vector2[], n: number) => {
  out.length = 0;
  for (let i = 0; i < n; i++) {
    const a = (i / n) * Math.PI * 2;
    // NACA-like: rounded leading edge at u=-0.25c, thin trailing edge at +0.75c
    const c = Math.cos(a);
    const s = Math.sin(a);
    const x = (c * 0.5 + 0.25) * chord; // -0.25c .. 0.75c
    const tShape = Math.pow(Math.max(0, 1 - (x / chord + 0.25)), 0.6) * Math.pow(Math.max(0, x / chord + 0.25), 0.35) * 1.9;
    const yAir = s * thick * chord * 0.5 * tShape;
    // blend toward a circle at the root
    const xr = c * chord * 0.5;
    const yr = s * chord * 0.5;
    out.push(new THREE.Vector2(x * (1 - round) + xr * round, yAir * (1 - round) + yr * round));
  }
};

const bladeGeometry = () => {
  // 8 lofted cross-sections with taper and twist; root is round (bolted to the hub)
  const SECTIONS: { r: number; chord: number; thick: number; twist: number; round: number; sweep: number }[] = [
    { r: 0.0, chord: 0.026, thick: 1.0, twist: 0, round: 1, sweep: 0 },
    { r: 0.04, chord: 0.03, thick: 0.9, twist: 4, round: 0.75, sweep: 0 },
    { r: 0.1, chord: 0.042, thick: 0.4, twist: 16, round: 0.1, sweep: 0.004 },
    { r: 0.18, chord: 0.038, thick: 0.3, twist: 12, round: 0, sweep: 0.004 },
    { r: 0.28, chord: 0.03, thick: 0.24, twist: 8, round: 0, sweep: 0.003 },
    { r: 0.38, chord: 0.022, thick: 0.2, twist: 5, round: 0, sweep: 0.002 },
    { r: 0.48, chord: 0.015, thick: 0.16, twist: 3, round: 0, sweep: 0.0 },
    { r: BLADE_L, chord: 0.008, thick: 0.14, twist: 2, round: 0, sweep: -0.002 },
  ];
  const N = 24; // points per section
  // densify radially with Catmull-Rom on the parameters for a smooth loft
  const params = SECTIONS.map((s) => new THREE.Vector4(s.chord, s.thick, s.twist, s.round));
  const radii = SECTIONS.map((s) => s.r);
  const sweeps = SECTIONS.map((s) => s.sweep);
  const steps = 48;
  const pos: number[] = [];
  const idx: number[] = [];
  const sec: THREE.Vector2[] = [];
  const lerpIdx = (u: number) => {
    const f = u * (SECTIONS.length - 1);
    const i = Math.min(SECTIONS.length - 2, Math.floor(f));
    const t = f - i;
    const p0 = params[Math.max(0, i - 1)];
    const p1 = params[i];
    const p2 = params[i + 1];
    const p3 = params[Math.min(SECTIONS.length - 1, i + 2)];
    const cr = (a: number, b: number, c: number, d: number) =>
      0.5 * (2 * b + (-a + c) * t + (2 * a - 5 * b + 4 * c - d) * t * t + (-a + 3 * b - 3 * c + d) * t * t * t);
    const p = new THREE.Vector4(cr(p0.x, p1.x, p2.x, p3.x), cr(p0.y, p1.y, p2.y, p3.y), cr(p0.z, p1.z, p2.z, p3.z), THREE.MathUtils.clamp(cr(p0.w, p1.w, p2.w, p3.w), 0, 1));
    const r = radii[i] + (radii[i + 1] - radii[i]) * t;
    const sw = sweeps[i] + (sweeps[i + 1] - sweeps[i]) * t;
    return { p, r, sw };
  };
  for (let k = 0; k <= steps; k++) {
    const { p, r, sw } = lerpIdx(k / steps);
    airfoil(Math.max(p.x, 0.004), Math.max(p.y, 0.08), p.w, sec, N);
    const tw = THREE.MathUtils.degToRad(p.z);
    const c = Math.cos(tw);
    const s = Math.sin(tw);
    for (const v of sec) {
      // blade axis = +y (radial). chord lies in the rotor plane (x), thickness along z (axial), twisted about y
      const x = v.x * c - v.y * s + sw;
      const z = v.x * s + v.y * c;
      pos.push(x, r, z);
    }
  }
  for (let k = 0; k < steps; k++)
    for (let i = 0; i < N; i++) {
      const a = k * N + i;
      const b = k * N + ((i + 1) % N);
      const c2 = (k + 1) * N + i;
      const d = (k + 1) * N + ((i + 1) % N);
      idx.push(a, c2, b, b, c2, d);
    }
  // tip cap
  const tipC = pos.length / 3;
  const last = steps * N;
  let cx = 0;
  let cz = 0;
  for (let i = 0; i < N; i++) {
    cx += pos[(last + i) * 3];
    cz += pos[(last + i) * 3 + 2];
  }
  pos.push(cx / N, BLADE_L + 0.002, cz / N);
  for (let i = 0; i < N; i++) idx.push(last + i, tipC, last + ((i + 1) % N));
  const g = new THREE.BufferGeometry();
  g.setAttribute("position", new THREE.Float32BufferAttribute(pos, 3));
  g.setIndex(idx);
  g.computeVertexNormals();
  return g;
};

export const buildTurbine = (mat: THREE.Material): Turbine => {
  const group = new THREE.Group();
  const tower = new THREE.Mesh(towerGeometry(), mat);
  group.add(tower);
  // small foundation ring
  // foundation plinth + entrance door
  const base = new THREE.Mesh(new THREE.CylinderGeometry(0.085, 0.095, 0.03, 48), mat);
  base.position.y = 0.015;
  group.add(base);
  const door = new THREE.Mesh(
    new THREE.BoxGeometry(0.016, 0.034, 0.006),
    new THREE.MeshStandardMaterial({ color: 0x8a9096, roughness: 0.6 }),
  );
  door.position.set(0, 0.05, 0.039);
  group.add(door);

  const nacelle = new THREE.Group();
  nacelle.position.y = TOWER_H + 0.04;
  const body = new THREE.Mesh(nacelleGeometry(), mat);
  body.position.z = -0.045;
  nacelle.add(body);
  // yaw bearing collar
  const collar = new THREE.Mesh(new THREE.CylinderGeometry(0.026, 0.028, 0.02, 32), mat);
  collar.position.y = -0.05;
  nacelle.add(collar);

  const rotor = new THREE.Group();
  rotor.position.z = 0.108;
  const spinner = new THREE.Mesh(spinnerGeometry(), mat);
  spinner.position.z = -0.012;
  rotor.add(spinner);
  const blade = bladeGeometry();
  for (let i = 0; i < 3; i++) {
    const b = new THREE.Mesh(blade, mat);
    b.rotation.z = (i / 3) * Math.PI * 2;
    b.position.z = 0.012;
    // slight cone angle (blades lean upwind)
    const holder = new THREE.Group();
    holder.rotation.z = (i / 3) * Math.PI * 2;
    b.rotation.z = 0;
    b.rotation.x = THREE.MathUtils.degToRad(-3);
    holder.add(b);
    rotor.add(holder);
  }
  nacelle.add(rotor);

  const markers = new THREE.Group();
  const mk = new THREE.MeshBasicMaterial({ color: new THREE.Color("#8FF4FF").multiplyScalar(2.5) });
  const spots: [number, number, number][] = [
    [0.0, 0.048, -0.1],
    [0.038, 0.024, -0.04],
    [-0.038, 0.024, -0.14],
    [0.0, 0.048, -0.02],
    [0.04, -0.008, -0.17],
  ];
  for (const [x, y, z] of spots) {
    const s = new THREE.Mesh(new THREE.SphereGeometry(0.0042, 12, 8), mk);
    s.position.set(x, y, z);
    markers.add(s);
  }
  markers.visible = false;
  nacelle.add(markers);

  // simple drivetrain: main shaft, bearing, gearbox, generator (only shown in the x-ray view)
  const internals = new THREE.Group();
  const im = new THREE.MeshStandardMaterial({ color: 0x7fdcff, emissive: new THREE.Color("#2A9AD8"), roughness: 0.5 });
  const shaft = new THREE.Mesh(new THREE.CylinderGeometry(0.008, 0.008, 0.1, 16).rotateX(Math.PI / 2), im);
  shaft.position.set(0, 0.004, 0.03);
  const bearing = new THREE.Mesh(new THREE.CylinderGeometry(0.018, 0.018, 0.02, 20).rotateX(Math.PI / 2), im);
  bearing.position.set(0, 0.004, 0.04);
  const gearbox = new THREE.Mesh(new RoundedBoxGeometry(0.05, 0.05, 0.06, 2, 0.008), im);
  gearbox.position.set(0, 0.0, -0.03);
  const gen = new THREE.Mesh(new THREE.CylinderGeometry(0.022, 0.022, 0.06, 20).rotateX(Math.PI / 2), im);
  gen.position.set(0, 0.002, -0.11);
  internals.add(shaft, bearing, gearbox, gen);
  internals.visible = false;
  nacelle.add(internals);
  group.add(nacelle);
  return { group, rotor, nacelle, markers, internals };
};
