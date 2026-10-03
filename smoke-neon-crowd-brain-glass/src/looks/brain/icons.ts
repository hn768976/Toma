import * as THREE from "three";
import { mergeGeometries } from "three/examples/jsm/utils/BufferGeometryUtils.js";

/** Small self-designed extruded icons, ~0.8 units tall, standing on y=0, facing +z. */

const ext = (shape: THREE.Shape, depth: number, bevel = 0.025) => {
  const g = new THREE.ExtrudeGeometry(shape, {
    depth,
    bevelEnabled: true,
    bevelSize: bevel,
    bevelThickness: bevel,
    bevelSegments: 3,
    curveSegments: 16,
  });
  g.translate(0, 0, -depth / 2);
  return g;
};
const roundRect = (w: number, h: number, r: number, x = -w / 2, y = 0) => {
  const s = new THREE.Shape();
  s.moveTo(x + r, y);
  s.lineTo(x + w - r, y);
  s.quadraticCurveTo(x + w, y, x + w, y + r);
  s.lineTo(x + w, y + h - r);
  s.quadraticCurveTo(x + w, y + h, x + w - r, y + h);
  s.lineTo(x + r, y + h);
  s.quadraticCurveTo(x, y + h, x, y + h - r);
  s.lineTo(x, y + r);
  s.quadraticCurveTo(x, y, x + r, y);
  return s;
};
const clean = (gs: THREE.BufferGeometry[]) => {
  const ng = gs.map((g) => {
    const n = g.index ? g.toNonIndexed() : g;
    n.deleteAttribute("uv");
    return n;
  });
  const m = mergeGeometries(ng)!;
  m.computeVertexNormals();
  return m;
};

export const documentIcon = () => {
  const s = new THREE.Shape();
  const w = 0.56, h = 0.72, f = 0.16;
  s.moveTo(-w / 2, 0);
  s.lineTo(w / 2, 0);
  s.lineTo(w / 2, h - f);
  s.lineTo(w / 2 - f, h);
  s.lineTo(-w / 2, h);
  s.closePath();
  const page = ext(s, 0.08);
  const lines = [0.48, 0.36, 0.24, 0.12].map((y, i) => {
    const b = new THREE.BoxGeometry(i === 0 ? 0.26 : 0.36, 0.035, 0.03);
    b.translate(i === 0 ? -0.05 : 0, y + 0.02, 0.07);
    return b;
  });
  return clean([page, ...lines]);
};

export const barChartIcon = () =>
  clean(
    [0.78, 0.55, 0.38].map((h, i) => {
      const g = ext(roundRect(0.18, h, 0.03), 0.2, 0.02);
      g.translate(-0.24 + i * 0.24, 0, 0);
      return g;
    }),
  );

export const flagIcon = () => {
  const pole = new THREE.CylinderGeometry(0.025, 0.025, 0.95, 12);
  pole.translate(-0.28, 0.475, 0);
  const s = new THREE.Shape();
  s.moveTo(-0.27, 0.88);
  s.bezierCurveTo(-0.1, 0.96, 0.08, 0.8, 0.3, 0.88);
  s.lineTo(0.22, 0.72);
  s.lineTo(0.3, 0.56);
  s.bezierCurveTo(0.08, 0.48, -0.1, 0.64, -0.27, 0.56);
  s.closePath();
  return clean([pole, ext(s, 0.04, 0.015)]);
};

export const gaugeIcon = () => {
  const disc = new THREE.CylinderGeometry(0.36, 0.38, 0.12, 40);
  disc.translate(0, 0.06, 0);
  const dome = new THREE.SphereGeometry(0.34, 40, 12, 0, Math.PI * 2, 0, Math.PI / 2);
  dome.scale(1, 0.32, 1);
  dome.translate(0, 0.12, 0);
  // zig-zag trend line on top
  const pts = [
    [-0.2, 0.05],
    [-0.07, 0.05],
    [0.02, -0.06],
    [0.2, 0.08],
  ];
  const segs: THREE.BufferGeometry[] = [];
  for (let i = 0; i < pts.length - 1; i++) {
    const a = new THREE.Vector3(pts[i][0], 0.235, -pts[i][1]);
    const b = new THREE.Vector3(pts[i + 1][0], 0.235, -pts[i + 1][1]);
    const len = a.distanceTo(b);
    const box = new THREE.BoxGeometry(len + 0.03, 0.025, 0.03);
    box.rotateY(-Math.atan2(b.z - a.z, b.x - a.x));
    box.translate((a.x + b.x) / 2, a.y, (a.z + b.z) / 2);
    segs.push(box);
  }
  return clean([disc, dome, ...segs]);
};

export const chatIcon = () => {
  const s = roundRect(0.7, 0.46, 0.12, -0.35, 0.18);
  const tail = new THREE.Shape();
  tail.moveTo(-0.2, 0.2);
  tail.lineTo(-0.26, 0.02);
  tail.lineTo(-0.02, 0.2);
  tail.closePath();
  const dots = [-0.18, 0, 0.18].map((x) => {
    const c = new THREE.CylinderGeometry(0.045, 0.045, 0.04, 16);
    c.rotateX(Math.PI / 2);
    c.translate(x, 0.41, 0.07);
    return c;
  });
  return clean([ext(s, 0.1), ext(tail, 0.1), ...dots]);
};

export const gearIcon = () => {
  const s = new THREE.Shape();
  const teeth = 8, ro = 0.36, ri = 0.28;
  for (let i = 0; i < teeth * 4; i++) {
    const a = (i / (teeth * 4)) * Math.PI * 2;
    const r = i % 4 < 2 ? ro : ri;
    const x = Math.cos(a) * r, y = Math.sin(a) * r + 0.4;
    if (i === 0) s.moveTo(x, y);
    else s.lineTo(x, y);
  }
  s.closePath();
  const hole = new THREE.Path();
  hole.absarc(0, 0.4, 0.12, 0, Math.PI * 2, true);
  s.holes.push(hole);
  return clean([ext(s, 0.12, 0.02)]);
};
