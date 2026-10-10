import * as THREE from "three";
import { mergeGeometries } from "three/examples/jsm/utils/BufferGeometryUtils.js";

// Generic padlock built in code (no brand marks, no text).
// Units: body is 1.0 wide; the padlock stands on y = 0, front faces +z.
export const BODY_W = 1.0;
export const BODY_H = 1.04;
export const BODY_D = 0.42;
const CORNER = 0.15;
const BEVEL = 0.045;
const SHACKLE_R = 0.3; // centre-line radius of the shackle arc
const SHACKLE_TUBE = 0.062;
const SHACKLE_LEG = 0.27; // straight leg height above the body top

const roundedRect = (w: number, h: number, r: number) => {
  const s = new THREE.Shape();
  const x = -w / 2;
  const y = 0;
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

// Keyhole: round hole over a narrow tapered slot (as a closed path).
const keyholePath = (cx: number, cy: number, scale: number) => {
  const p = new THREE.Path();
  const r = 0.085 * scale;
  const slotTop = 0.045 * scale;
  const slotBottom = 0.07 * scale;
  const slotLen = 0.19 * scale;
  const a = Math.asin(slotTop / r);
  // start at the right side where the slot meets the circle, go around the
  // top of the circle, then down the slot
  p.moveTo(cx + slotTop, cy - Math.cos(a) * r);
  p.absarc(cx, cy, r, -Math.PI / 2 + a, Math.PI * 1.5 - a, false);
  p.lineTo(cx - slotBottom, cy - Math.cos(a) * r - slotLen);
  p.lineTo(cx + slotBottom, cy - Math.cos(a) * r - slotLen);
  p.closePath();
  return p;
};

export const KEYHOLE_Y = BODY_H * 0.55;

export const buildPadlockGeometry = (detail = 1) => {
  const curveSeg = Math.round(6 * detail);
  const bodyShape = roundedRect(BODY_W - 2 * BEVEL, BODY_H - 2 * BEVEL, CORNER - BEVEL * 0.5);
  // main body: bevelled rounded box
  const bodyDepth = BODY_D - 2 * BEVEL - 0.05;
  const body = new THREE.ExtrudeGeometry(bodyShape, {
    depth: bodyDepth,
    bevelEnabled: true,
    bevelThickness: BEVEL,
    bevelSize: BEVEL,
    bevelSegments: Math.max(2, Math.round(3 * detail)),
    curveSegments: curveSeg,
  });
  body.translate(0, BEVEL, -bodyDepth / 2 - 0.025);
  const bodyFront = bodyDepth / 2 - 0.025 + BEVEL;

  // front face plate with the keyhole cut through it: the recess shows the
  // dark insert behind
  const plateShape = roundedRect(BODY_W - 2 * BEVEL - 0.02, BODY_H - 2 * BEVEL - 0.02, CORNER - BEVEL);
  plateShape.holes.push(keyholePath(0, KEYHOLE_Y - BEVEL - 0.01, 1));
  const plateDepth = 0.035;
  const plate = new THREE.ExtrudeGeometry(plateShape, {
    depth: plateDepth,
    bevelEnabled: true,
    bevelThickness: 0.012,
    bevelSize: 0.012,
    bevelSegments: 2,
    curveSegments: curveSeg + 2,
  });
  const frontZ = bodyFront - 0.01;
  plate.translate(0, BEVEL + 0.01, frontZ);

  // shackle: two straight legs into the body + half torus on top
  const legBottom = BODY_H - 0.1;
  const legTop = BODY_H + SHACKLE_LEG;
  // exact path: straight leg, true half circle, straight leg
  const curve = new THREE.CurvePath<THREE.Vector3>();
  curve.add(new THREE.LineCurve3(new THREE.Vector3(-SHACKLE_R, legBottom, 0), new THREE.Vector3(-SHACKLE_R, legTop, 0)));
  class Arc extends THREE.Curve<THREE.Vector3> {
    constructor() {
      super();
    }
    getPoint(t: number, target = new THREE.Vector3()) {
      const a = Math.PI * (1 - t);
      return target.set(Math.cos(a) * SHACKLE_R, legTop + Math.sin(a) * SHACKLE_R, 0);
    }
  }
  curve.add(new Arc());
  curve.add(new THREE.LineCurve3(new THREE.Vector3(SHACKLE_R, legTop, 0), new THREE.Vector3(SHACKLE_R, legBottom, 0)));
  // arc-length sampling keeps the tube even along the bend
  const shackle = new THREE.TubeGeometry(curve, Math.round(96 * detail), SHACKLE_TUBE, Math.round(16 * detail), false);

  // escutcheon: thin raised rim around the round part of the keyhole
  const rim = new THREE.TorusGeometry(0.105, 0.014, Math.round(8 * detail), Math.round(32 * detail));

  const toNonIndexedish = (g: THREE.BufferGeometry) => {
    const n = g.index ? g.toNonIndexed() : g;
    n.deleteAttribute("uv");
    if (!n.getAttribute("normal")) n.computeVertexNormals();
    return n;
  };
    const plateFront = frontZ + plateDepth + 0.012;
  rim.translate(0, KEYHOLE_Y, plateFront);
  const lock = mergeGeometries([body, plate, shackle, rim].map(toNonIndexedish), false)!;
  lock.computeBoundingSphere();

  // dark keyhole insert (sits in the recess)
  const insertShape = new THREE.Shape(keyholePath(0, KEYHOLE_Y, 1.0).getPoints(24));
  const insert = new THREE.ShapeGeometry(insertShape, 12);
  insert.translate(0, 0, bodyFront + 0.002);

  return { lock, insert, height: legTop + SHACKLE_R + SHACKLE_TUBE };
};
