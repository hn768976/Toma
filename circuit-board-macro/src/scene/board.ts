import * as THREE from "three";
import { rng } from "../engine/post";
import { Builder } from "./builder";
import type { MatKey, Palette } from "./palette";

type V2 = [number, number];

/** Camera azimuth: the board is axis aligned, the camera looks at it at an angle. */
export const AZ = (39 * Math.PI) / 180;
const R: V2 = [Math.cos(AZ), -Math.sin(AZ)]; // screen-right on the board plane
const F: V2 = [-Math.sin(AZ), -Math.cos(AZ)]; // away from the camera
/** (r, s) = (screen-right, depth away from camera) -> world (x, z). */
export const W = (r: number, s: number): V2 => [
  r * R[0] + s * F[0],
  r * R[1] + s * F[1],
];

const PLATE_TOP = 0.62;

function chip(b: Builder) {
  // --- body, lid -------------------------------------------------------
  b.rbox("chipBody", 3.74, 0.36, 3.74, 0, 0.06, 0, 0.04, 0.05);
  b.rbox("chipBody", 3.9, 0.08, 3.9, 0, 0.42, 0, 0.03, 0.14);
  b.rbox("plate", 4.0, 0.12, 4.0, 0, 0.5, 0, 0.028, 0.2);
  const y = PLATE_TOP + 0.002;

  // --- gull-wing pins ----------------------------------------------------
  const s = new THREE.Shape();
  const t = 0.05;
  s.moveTo(0, 0.25);
  s.lineTo(0.14, 0.25);
  s.lineTo(0.26, 0.05);
  s.lineTo(0.42, 0.05);
  s.lineTo(0.42, 0.05 - t);
  s.lineTo(0.23, 0.05 - t);
  s.lineTo(0.11, 0.25 - t);
  s.lineTo(0, 0.25 - t);
  const N = 36;
  const pitch = 3.4 / (N - 1);
  for (let side = 0; side < 4; side++) {
    for (let i = 0; i < N; i++) {
      const g = new THREE.ExtrudeGeometry(s, {
        depth: 0.052,
        bevelEnabled: false,
      });
      g.translate(1.86, 0, -1.7 + i * pitch - 0.026);
      g.rotateY((side * Math.PI) / 2);
      b.add("pin", g);
      // upper tier of contacts just under the lid
      const tooth = new THREE.BoxGeometry(0.09, 0.08, 0.05);
      tooth.translate(1.9, 0.37, -1.7 + i * pitch);
      tooth.rotateY((side * Math.PI) / 2);
      b.add("pin", tooth);
    }
  }

  // --- corner screws -----------------------------------------------------
  for (const sx of [-1, 1])
    for (const sz of [-1, 1]) {
      const x = sx * 1.66,
        z = sz * 1.66;
      b.ring("plateDetail", 0.15, 0.2, x, y, z);
      b.cyl("plateDetail", 0.1, 0.03, x, PLATE_TOP, z, 20, 0.085);
      b.disc("plateDark", 0.045, x, PLATE_TOP + 0.032, z, 12);
    }

  // --- die in the centre ---------------------------------------------------
  const dx = 0.12,
    dz = 0.1;
  b.rbox("plateDetail", 0.92, 0.012, 0.8, dx, PLATE_TOP, dz, 0.004, 0.05);
  b.rbox("plate", 0.84, 0.016, 0.72, dx, PLATE_TOP, dz, 0.004, 0.04);
  b.rbox("die", 0.56, 0.07, 0.46, dx, PLATE_TOP + 0.01, dz, 0.02, 0.02);
  b.rbox(
    "dieTop",
    0.24,
    0.02,
    0.2,
    dx - 0.06,
    PLATE_TOP + 0.075,
    dz - 0.03,
    0.006,
    0.01,
  );

  // --- engraved traces (thin raised lines with chamfered corners) ---------
  const tr = (pts: V2[], w = 0.028) =>
    b.ribbon("plateDetail", pts, w, y + 0.003, 0.004);
  const pad = (x: number, z: number, r = 0.075) => {
    b.disc("plateDetail", r, x, y + 0.004, z, 20);
    b.ring("plateDetail", r + 0.035, r + 0.055, x, y + 0.004, z, 24);
  };
  // rings around the die
  for (let k = 0; k < 3; k++) {
    const a = 0.72 + k * 0.17;
    const c = 0.22;
    tr([
      [dx - a, dz + a - c - 0.5],
      [dx - a, dz - a + c],
      [dx - a + c, dz - a],
      [dx + a - c, dz - a],
      [dx + a, dz - a + c],
      [dx + a, dz + a - c],
      [dx + a - c, dz + a],
      [dx - a + c + 0.5 + k * 0.1, dz + a],
    ]);
  }
  // long runs to pads
  tr([
    [-1.75, -0.9],
    [-1.0, -0.9],
    [-0.75, -0.65],
    [-0.75, 0.2],
  ]);
  pad(-1.75, -0.9);
  tr([
    [-1.75, -0.72],
    [-1.08, -0.72],
    [-0.93, -0.57],
    [-0.93, 0.35],
  ]);
  tr([
    [-1.5, 1.15],
    [-0.6, 1.15],
    [-0.35, 1.4],
    [0.9, 1.4],
  ]);
  pad(-1.5, 1.15);
  pad(0.9, 1.4, 0.06);
  tr([
    [-1.2, 1.38],
    [-0.7, 1.38],
    [-0.5, 1.58],
    [0.6, 1.58],
  ]);
  tr([
    [1.2, -1.75],
    [1.2, -1.3],
    [1.45, -1.05],
    [1.75, -1.05],
  ]);
  pad(1.2, -1.75, 0.06);
  tr([
    [0.2, -1.8],
    [0.2, -1.45],
    [0.5, -1.15],
    [0.95, -1.15],
    [1.15, -0.95],
    [1.15, -0.3],
  ]);
  tr([
    [0.02, -1.8],
    [0.02, -1.4],
    [-0.3, -1.08],
  ]);
  tr([
    [1.8, 0.5],
    [1.45, 0.5],
    [1.25, 0.7],
    [1.25, 1.2],
  ]);
  pad(1.25, 1.2, 0.06);
  tr([
    [1.8, 0.68],
    [1.52, 0.68],
    [1.42, 0.78],
    [1.42, 1.0],
  ]);
  tr([
    [-0.4, -1.5],
    [-0.9, -1.5],
    [-1.1, -1.3],
  ]);
  pad(-0.4, -1.5, 0.07);
  pad(-1.1, -1.3, 0.055);
  pad(-1.3, 0.25, 0.085);
  pad(0.55, 0.95, 0.085);
  pad(-0.2, -0.85, 0.06);

  // --- dot (via) grids -------------------------------------------------------
  const dots = (
    cx: number,
    cz: number,
    nx: number,
    nz: number,
    p = 0.13,
    mat: MatKey = "plateDark",
  ) => {
    for (let i = 0; i < nx; i++)
      for (let j = 0; j < nz; j++)
        b.disc(
          mat,
          0.036,
          cx + (i - (nx - 1) / 2) * p,
          y + 0.002,
          cz + (j - (nz - 1) / 2) * p,
          10,
        );
  };
  dots(-1.25, -0.25, 3, 8);
  dots(-1.2, 0.72, 5, 2);
  dots(1.5, -0.2, 3, 7);
  dots(0.9, -1.55, 2, 3);
  dots(-0.55, -1.2, 4, 2, 0.1, "plateDetail");
  dots(0.25, 1.15, 6, 2);
  dots(1.6, 1.3, 2, 4, 0.1, "plateDetail");
  dots(-1.65, 0.3, 1, 6);
  dots(-0.1, 0.95, 3, 1, 0.12, "plateDetail");
  dots(0.75, -0.75, 1, 4, 0.12, "plateDetail");
}

/** Boxy connector / relay block with slotted faces. */
function connector(
  b: Builder,
  x: number,
  z: number,
  ry = 0,
  w = 2.0,
  h = 1.3,
  d = 1.7,
) {
  b.pushAt(x, 0, z, ry);
  b.rbox("block", w, h, d, 0, 0.1, 0, 0.05, 0.04);
  b.rbox("blockLid", w + 0.12, 0.17, d + 0.12, 0, h + 0.06, 0, 0.055, 0.1);
  for (const sx of [-1, 1])
    for (const sz of [-1, 1])
      b.cyl(
        "metal",
        0.035,
        0.012,
        sx * (w / 2 - 0.12),
        h + 0.23,
        sz * (d / 2 - 0.12),
        10,
      );
  for (let face = 0; face < 4; face++) {
    const fw = face % 2 === 0 ? w : d;
    const fd = face % 2 === 0 ? d : w;
    b.push(new THREE.Matrix4().makeRotationY((face * Math.PI) / 2));
    const zf = fd / 2;
    // face plate with corner rivets
    b.rbox("block", fw - 0.14, h - 0.2, 0.04, 0, 0.2, zf + 0.012, 0.012, 0.03);
    for (const sx of [-1, 1])
      for (const sy of [0, 1]) {
        const g = new THREE.CylinderGeometry(0.028, 0.028, 0.02, 10);
        g.rotateX(Math.PI / 2);
        g.translate(sx * (fw / 2 - 0.17), 0.33 + sy * (h - 0.46), zf + 0.035);
        b.add("metal", g);
      }
    const n = Math.max(2, Math.round(fw / 0.48));
    const step = (fw - 0.3) / n;
    for (let i = 0; i < n; i++) {
      const px = (i - (n - 1) / 2) * step;
      b.rbox(
        "blockFrame",
        step * 0.74,
        0.44,
        0.05,
        px,
        0.3,
        zf + 0.04,
        0.012,
        0.02,
      );
      b.rbox(
        "blockSlot",
        step * 0.5,
        0.31,
        0.05,
        px,
        0.365,
        zf + 0.052,
        0.008,
        0.015,
      );
      b.rbox(
        "blockFrame",
        step * 0.62,
        0.2,
        0.22,
        px,
        0.0,
        zf + 0.12,
        0.02,
        0.02,
      );
    }
    b.pop();
  }
  b.pop();
}

function capacitor(b: Builder, x: number, z: number, r = 0.5, h = 2.3) {
  b.cyl("cap", r, h, x, 0, z, 40);
  b.cyl("capTop", r * 0.93, 0.035, x, h, z, 40, r * 0.86);
  b.cyl("cap", r * 1.06, 0.1, x, 0, z, 40);
}

function resistors(b: Builder, x: number, z: number, ry: number, n = 3) {
  b.pushAt(x, 0, z, ry);
  for (let i = 0; i < n; i++) {
    const pz = (i - (n - 1) / 2) * 0.27;
    b.hcyl("smd", 0.095, 0.4, 0, 0.11, pz);
    b.hcyl("metal", 0.1, 0.07, -0.2, 0.11, pz);
    b.hcyl("metal", 0.1, 0.07, 0.2, 0.11, pz);
    b.hcyl("metal", 0.02, 0.9, 0, 0.09, pz, false, 8);
  }
  b.pop();
}

function smdGroup(
  b: Builder,
  x: number,
  z: number,
  ry: number,
  n = 2,
  w = 0.36,
  h = 0.4,
  d = 0.5,
) {
  b.pushAt(x, 0, z, ry);
  for (let i = 0; i < n; i++) {
    const px = (i - (n - 1) / 2) * (w + 0.12);
    b.rbox("smd", w, h, d, px, 0.02, 0, 0.02, 0.02);
    b.rbox("metal", w + 0.02, h * 0.55, 0.1, px, 0.0, d / 2 - 0.03, 0.01);
    b.rbox("metal", w + 0.02, h * 0.55, 0.1, px, 0.0, -d / 2 + 0.03, 0.01);
    b.rbox("blockLid", w * 0.7, 0.02, d * 0.5, px, h + 0.02, 0, 0.005);
  }
  b.pop();
}

/** Flat IC package with pins on two (or four) sides. */
function flatIC(
  b: Builder,
  x: number,
  z: number,
  ry: number,
  w = 1.3,
  d = 0.9,
  quad = false,
) {
  b.pushAt(x, 0, z, ry);
  b.rbox("smd", w, 0.16, d, 0, 0.05, 0, 0.02, 0.03);
  b.disc("blockFrame", 0.04, -w / 2 + 0.13, 0.215, d / 2 - 0.13, 10);
  const row = (len: number, off: number, rot: number) => {
    const n = Math.round(len / 0.13);
    for (let i = 0; i < n; i++) {
      const p = (i - (n - 1) / 2) * 0.13;
      const m = new THREE.Matrix4().makeRotationY(rot);
      const g = new THREE.BoxGeometry(0.06, 0.045, 0.26);
      g.translate(p, 0.03, off + 0.06);
      const g2 = new THREE.BoxGeometry(0.06, 0.12, 0.05);
      g2.translate(p, 0.09, off - 0.02);
      b.add("pin", g, m);
      b.add("pin", g2, m);
    }
  };
  row(w - 0.2, d / 2, 0);
  row(w - 0.2, d / 2, Math.PI);
  if (quad) {
    row(d - 0.2, w / 2, Math.PI / 2);
    row(d - 0.2, w / 2, -Math.PI / 2);
  }
  b.pop();
}

/** Row of ribbed inductors lying on the board. */
function inductors(b: Builder, x: number, z: number, ry: number, n = 4) {
  b.pushAt(x, 0, z, ry);
  for (let i = 0; i < n; i++) {
    const pz = (i - (n - 1) / 2) * 0.3;
    b.hcyl("smd", 0.12, 0.72, 0, 0.13, pz);
    for (let k = 0; k < 5; k++)
      b.hcyl("blockLid", 0.132, 0.045, -0.26 + k * 0.13, 0.13, pz);
    b.rbox("metal", 0.1, 0.1, 0.2, 0.42, 0, pz, 0.01);
    b.rbox("metal", 0.1, 0.1, 0.2, -0.42, 0, pz, 0.01);
  }
  b.pop();
}

function sot(b: Builder, x: number, z: number, ry: number) {
  b.pushAt(x, 0, z, ry);
  b.rbox("smd", 0.5, 0.26, 0.32, 0, 0.04, 0, 0.03, 0.02);
  for (const p of [-0.16, 0, 0.16])
    b.rbox("pin", 0.07, 0.05, 0.6, p, 0, 0, 0.01);
  b.pop();
}

function traces(b: Builder) {
  const y = 0.008;
  // fan-out from the QFP pins: 4 groups of 9 pins per side
  for (let side = 0; side < 4; side++) {
    b.push(new THREE.Matrix4().makeRotationY((side * Math.PI) / 2));
    const pitch = 3.4 / 35;
    for (let gI = 0; gI < 4; gI++) {
      const zc = -1.7 + (gI * 9 + 4) * pitch;
      const dir = gI < 2 ? -1 : 1;
      const outer = gI === 0 || gI === 3;
      const l1 = outer ? 0.35 : 1.25;
      const l2 = outer ? 1.5 + side * 0.25 : 1.05 + side * 0.2;
      const x0 = 2.15;
      const pts: V2[] = [
        [x0, zc],
        [x0 + l1, zc],
        [x0 + l1 + l2, zc + dir * l2],
        [x0 + l1 + l2 + 30, zc + dir * l2],
      ];
      // local X/Z of ribbon is (x, z)
      b.bundle("trace", pts, 9, pitch, 0.042, y);
    }
    b.pop();
  }
  // free bundles elsewhere on the board
  const rand = rng(7103);
  for (let i = 0; i < 46; i++) {
    const x = (rand() - 0.5) * 60;
    const z = (rand() - 0.5) * 60;
    const horizontal = rand() < 0.5;
    const n = 2 + Math.floor(rand() * 6);
    const l1 = 1.5 + rand() * 6;
    const l2 = 0.4 + rand() * 1.8;
    const l3 = 2 + rand() * 9;
    const sgn = rand() < 0.5 ? -1 : 1;
    const dir = rand() < 0.5 ? -1 : 1;
    const w = 0.04 + rand() * 0.04;
    const pitch = w * (1.9 + rand() * 0.6);
    if (Math.hypot(x, z) < 6.5) continue;
    const p: V2[] = [
      [0, 0],
      [l1 * dir, 0],
      [(l1 + l2) * dir, l2 * sgn],
      [(l1 + l2 + l3) * dir, l2 * sgn],
    ];
    const pts = p.map(
      ([a, c]): V2 => (horizontal ? [x + a, z + c] : [x + c, z + a]),
    );
    b.bundle("trace", pts, n, pitch, w, y);
    for (let k = 0; k < n; k++) {
      const o = (k - (n - 1) / 2) * pitch;
      const e: V2 = horizontal ? [x, z + o] : [x + o, z];
      b.disc("pad", w * 1.1, e[0], y + 0.002, e[1], 12);
    }
  }
  // scattered vias
  for (let i = 0; i < 260; i++) {
    const x = (rand() - 0.5) * 50;
    const z = (rand() - 0.5) * 50;
    if (Math.abs(x) < 2.6 && Math.abs(z) < 2.6) continue;
    b.ring("pad", 0.03, 0.065, x, y + 0.003, z, 14);
  }
}

export function buildBoard(palette: Palette): THREE.Group {
  const b = new Builder();

  // board
  const plane = new THREE.PlaneGeometry(400, 400);
  plane.rotateX(-Math.PI / 2);
  b.add("board", plane);
  traces(b);
  chip(b);

  const at = (r: number, s: number) => W(r, s);
  let p: V2;

  // --- connector blocks behind / beside the chip ---------------------------
  const blocks: [number, number, number][] = [
    [-5.0, 2.6, 0], // left of the chip
    [0.9, 6.3, 0], // behind
    [3.9, 3.9, 1], // behind right
    [7.3, 1.7, 0], // far right
    [-3.2, 10.5, 1],
    [5.4, 10.2, 0],
    [-9.5, 6.5, 1],
    [11.5, 5.5, 1],
    [-0.5, 14.5, 0],
    [9.8, 12.5, 0],
    [-7.5, 15.0, 0],
    [-12.5, 0.5, 0],
    [14.5, 10.0, 0],
  ];
  for (const [r, s, q] of blocks) {
    p = at(r, s);
    connector(b, p[0], p[1], (q * Math.PI) / 2);
  }

  // --- foreground, heavily out of focus -------------------------------------
  p = at(-1.4, -3.8);
  capacitor(b, p[0], p[1], 0.28, 1.3);
  p = at(-3.2, -3.9);
  connector(b, p[0], p[1], 0, 1.5, 0.85, 1.3);
  p = at(3.0, -3.9);
  connector(b, p[0], p[1], Math.PI / 2, 1.5, 0.85, 1.3);
  // far capacitors (dark posts in the back)
  for (const [r, s] of [
    [-5.6, 8.4],
    [-1.8, 9.0],
    [2.7, 13.0],
    [8.0, 8.3],
    [-11, 11],
  ] as V2[]) {
    p = at(r, s);
    capacitor(b, p[0], p[1], 0.42, 2.0);
  }

  // --- small parts --------------------------------------------------------------
  p = at(-3.55, 0.35);
  resistors(b, p[0], p[1], Math.PI / 2 - 0.0, 3);
  p = at(-3.2, 4.3);
  smdGroup(b, p[0], p[1], 0, 3);
  p = at(-1.6, 5.9);
  smdGroup(b, p[0], p[1], 0, 2, 0.45, 0.42, 0.55);
  p = at(-3.4, 7.2);
  flatIC(b, p[0], p[1], 0, 1.5, 0.9);
  p = at(-6.4, -0.6);
  flatIC(b, p[0], p[1], Math.PI / 2, 1.1, 0.8);
  p = at(4.45, 0.75);
  inductors(b, p[0], p[1], Math.PI / 2, 4);
  p = at(5.9, -0.7);
  flatIC(b, p[0], p[1], 0, 1.25, 1.0, true);
  p = at(3.1, 2.3);
  resistors(b, p[0], p[1], 0, 2);
  p = at(2.4, -1.8);
  sot(b, p[0], p[1], 0);
  p = at(-0.9, -3.0);
  sot(b, p[0], p[1], Math.PI / 2);
  p = at(-0.1, -3.6);
  sot(b, p[0], p[1], 0);
  p = at(0.9, -4.3);
  flatIC(b, p[0], p[1], 0, 1.0, 0.8);
  p = at(1.6, -2.9);
  smdGroup(b, p[0], p[1], Math.PI / 2, 2, 0.3, 0.25, 0.45);
  p = at(-2.6, -2.2);
  smdGroup(b, p[0], p[1], 0, 2, 0.3, 0.25, 0.45);
  p = at(7.2, -2.8);
  smdGroup(b, p[0], p[1], 0, 3);
  p = at(-8.0, 2.5);
  inductors(b, p[0], p[1], 0, 3);
  p = at(6.5, 5.5);
  smdGroup(b, p[0], p[1], 0, 3);
  p = at(1.5, 9.5);
  flatIC(b, p[0], p[1], 0, 1.6, 1.0);

  return b.build(palette);
}
