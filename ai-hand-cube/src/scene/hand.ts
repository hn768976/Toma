// Procedural robot hand built as a joint hierarchy:
// hand root -> palm -> finger bases -> proximal -> middle -> distal.
// Local frame: palm normal = +Y, fingers point +Z, thumb on -X (right hand
// seen palm-up with fingers toward the viewer). Palm width = 1 unit.
import * as THREE from "three";
import { RoundedBoxGeometry } from "three/examples/jsm/geometries/RoundedBoxGeometry.js";

const DEG = Math.PI / 180;

export type HandMaterials = {
  shell: THREE.Material;
  joint: THREE.Material;
  seam: THREE.Material;
};

export type HandRig = {
  root: THREE.Group;
  /** curl offsets in radians [thumb, index, middle, ring, little] */
  setPose: (extraCurl: readonly number[]) => void;
};

// Palm outline in the XZ plane: a little longer than wide, convex knuckle
// edge, rounded heel. Built in XY with shape y = -Z so that after
// rotateX(-90deg) the outline lands on +Z.
const palmShape = (inset: number) => {
  const hwFront = 0.47 - inset; // half width at the knuckles
  const hwBack = 0.39 - inset; // half width at the heel
  const zf = 0.5 - inset;
  const zb = -0.6 + inset;
  const r = Math.max(0.05, 0.17 - inset);
  const s = new THREE.Shape();
  const m = (x: number, z: number) => s.moveTo(x, -z);
  const l = (x: number, z: number) => s.lineTo(x, -z);
  const q = (cx: number, cz: number, x: number, z: number) =>
    s.quadraticCurveTo(cx, -cz, x, -z);
  m(-hwBack + r, zb);
  l(hwBack - r, zb);
  q(hwBack + 0.02, zb, hwBack + 0.03, zb + r);
  l(hwFront, zf - r);
  q(hwFront, zf, hwFront - r, zf);
  // knuckle edge bulges slightly forward in the middle
  q(0, zf + 0.06, -hwFront + r, zf);
  q(-hwFront, zf, -hwFront, zf - r);
  l(-hwBack - 0.03, zb + r);
  q(-hwBack - 0.02, zb, -hwBack + r, zb);
  return s;
};

// Rounded rectangle ring in the XY plane (for seam bands around segments).
const ringShape = (w: number, h: number, r: number, t: number) => {
  const rr = (s: THREE.Path, hw: number, hh: number, rad: number) => {
    s.moveTo(-hw + rad, -hh);
    s.lineTo(hw - rad, -hh);
    s.quadraticCurveTo(hw, -hh, hw, -hh + rad);
    s.lineTo(hw, hh - rad);
    s.quadraticCurveTo(hw, hh, hw - rad, hh);
    s.lineTo(-hw + rad, hh);
    s.quadraticCurveTo(-hw, hh, -hw, hh - rad);
    s.lineTo(-hw, -hh + rad);
    s.quadraticCurveTo(-hw, -hh, -hw + rad, -hh);
  };
  const outer = new THREE.Shape();
  rr(outer, w / 2 + t, h / 2 + t, r + t);
  const hole = new THREE.Path();
  rr(hole, w / 2 - t, h / 2 - t, Math.max(0.005, r - t));
  outer.holes.push(hole);
  return outer;
};

// Extrude a shape upward (+Y) between y0 and y1 (bevel included).
const slab = (
  shape: THREE.Shape,
  y0: number,
  y1: number,
  bevel: number,
  mat: THREE.Material,
) => {
  const depth = Math.max(0.001, y1 - y0 - 2 * bevel);
  const g = new THREE.ExtrudeGeometry(shape, {
    depth,
    bevelEnabled: bevel > 0,
    bevelThickness: bevel,
    bevelSize: bevel * 0.9,
    bevelSegments: 10,
    curveSegments: 64,
  });
  // shape lives in XY with extrusion +Z; map to XZ with extrusion +Y.
  g.rotateX(-Math.PI / 2);
  g.translate(0, y0 + bevel, 0);
  g.computeVertexNormals();
  const m = new THREE.Mesh(g, mat);
  return m;
};

const capsuleBox = (
  w: number,
  h: number,
  l: number,
  mat: THREE.Material,
  radius = Math.min(w, h) * 0.46,
) => {
  const g = new RoundedBoxGeometry(w, h, l, 8, radius);
  return new THREE.Mesh(g, mat);
};

const sphereGeo = new THREE.SphereGeometry(1, 48, 32);
const ball = (r: number, mat: THREE.Material) => {
  const m = new THREE.Mesh(sphereGeo, mat);
  m.scale.setScalar(r);
  return m;
};

type FingerDef = {
  x: number;
  z: number;
  y: number;
  splay: number; // radians about Y
  lengths: [number, number, number];
  width: number;
  relaxed: [number, number, number]; // relaxed curl per joint (radians)
};

const FINGERS: FingerDef[] = [
  // index (thumb side, -X)
  { x: -0.33, z: 0.47, y: -0.015, splay: -11 * DEG, lengths: [0.47, 0.3, 0.24], width: 0.18, relaxed: [12 * DEG, 15 * DEG, 10 * DEG] },
  // middle - longest
  { x: -0.11, z: 0.52, y: 0.01, splay: -3 * DEG, lengths: [0.53, 0.34, 0.27], width: 0.185, relaxed: [14 * DEG, 17 * DEG, 11 * DEG] },
  // ring
  { x: 0.11, z: 0.5, y: 0.0, splay: 5 * DEG, lengths: [0.5, 0.32, 0.26], width: 0.178, relaxed: [16 * DEG, 19 * DEG, 12 * DEG] },
  // little - ~80% of middle
  { x: 0.32, z: 0.42, y: -0.035, splay: 15 * DEG, lengths: [0.4, 0.26, 0.21], width: 0.16, relaxed: [19 * DEG, 21 * DEG, 13 * DEG] },
];

export const buildHand = (mats: HandMaterials): HandRig => {
  const root = new THREE.Group();
  root.name = "hand";
  const palm = new THREE.Group();
  root.add(palm);

  // --- Palm: one molded shell with a recessed centre -----------------------
  // outer shell (ring) - single solid part, generously rounded edges
  const shellShape = palmShape(0);
  shellShape.holes.push(palmShape(0.115) as unknown as THREE.Path);
  palm.add(slab(shellShape, -0.08, 0.13, 0.07, mats.shell));
  // underside closes the ring (same shell material, no visible gap)
  palm.add(slab(palmShape(0.05), -0.08, 0.04, 0.05, mats.shell));
  // seam floor visible as a thin dark line around the recessed pad
  palm.add(slab(palmShape(0.1), 0.0, 0.085, 0.0, mats.seam));
  // recessed centre pad (sits lower than the rim -> slight palm hollow)
  palm.add(slab(palmShape(0.13), 0.0, 0.1, 0.02, mats.shell));
  // knuckle line: rounded metacarpal heads along the front edge, following
  // the arch of the finger bases
  FINGERS.forEach((fd) => {
    const cap = capsuleBox(fd.width * 1.18, 0.19, 0.2, mats.shell, 0.09);
    cap.position.set(fd.x, 0.025 + fd.y, fd.z - 0.04);
    cap.rotation.y = fd.splay;
    palm.add(cap);
  });

  // --- Fingers ----------------------------------------------------------
  type Chain = { joints: THREE.Group[]; relaxed: number[] };
  const chains: Chain[] = [];

  const buildChain = (
    parent: THREE.Object3D,
    lengths: number[],
    width: number,
    thickness: number,
    jointR: number,
  ) => {
    const joints: THREE.Group[] = [];
    let attach: THREE.Object3D = parent;
    lengths.forEach((len, i) => {
      const j = new THREE.Group();
      if (i > 0) j.position.z = lengths[i - 1];
      attach.add(j);
      joints.push(j);
      // ball joint, slightly darker, partly hidden by the segment ends
      const b = ball(jointR * (1 - i * 0.06), mats.joint);
      j.add(b);
      const taper = 1 - i * 0.1;
      const segLen = len - jointR * 0.35;
      const seg = capsuleBox(width * taper, thickness * taper, segLen, mats.shell);
      seg.position.z = len / 2;
      j.add(seg);
      // thin seam line around each segment (dark ring slightly larger than
      // the segment cross-section, inset near the joint end)
      const seamG = new THREE.ExtrudeGeometry(
        ringShape(width * taper, thickness * taper, Math.min(width, thickness) * taper * 0.45, 0.004),
        { depth: 0.014, bevelEnabled: false, curveSegments: 10 },
      );
      const seamRing = new THREE.Mesh(seamG, mats.seam);
      seamRing.position.z = jointR * 0.5 + 0.035;
      j.add(seamRing);
      attach = j;
    });
    return joints;
  };

  FINGERS.forEach((fd) => {
    const base = new THREE.Group();
    base.position.set(fd.x, 0.06 + fd.y, fd.z);
    base.rotation.y = fd.splay;
    palm.add(base);
    const joints = buildChain(base, fd.lengths, fd.width, 0.165, 0.074);
    chains.push({ joints, relaxed: fd.relaxed });
  });

  // --- Thumb: base joint on the side of the palm + 2 segments --------------
  // thenar mass: a large rounded housing at the heel on the thumb side that
  // carries the thumb's base joint (reads as the thumb web)
  const thenar = capsuleBox(0.3, 0.2, 0.6, mats.shell, 0.095);
  thenar.position.set(-0.4, -0.005, -0.1);
  thenar.rotation.set(0, -24 * DEG, 0);
  palm.add(thenar);
  const thumbBase = new THREE.Group();
  thumbBase.position.set(-0.5, 0.06, 0.1);
  // out to the side (-X), forward (+Z) and a little up (+Y); rolled so the
  // pad faces the fingers (opposition)
  thumbBase.rotation.set(-12 * DEG, -50 * DEG, -30 * DEG, "YXZ");
  palm.add(thumbBase);
  const baseBall = ball(0.115, mats.joint);
  thumbBase.add(baseBall);
  const thumbJoints = buildChain(thumbBase, [0.42, 0.33], 0.2, 0.18, 0.085);
  thumbJoints[0].position.z = 0.02;
  chains.unshift({ joints: thumbJoints, relaxed: [8 * DEG, 14 * DEG] });

  // --- Wrist: hinge joint inside a cuff, then a tapered forearm -------------
  const wrist = new THREE.Group();
  wrist.position.set(0, -0.01, -0.58);
  wrist.rotation.x = -14 * DEG; // forearm heads back and down out of frame
  palm.add(wrist);
  // transverse hinge, its ends visible as graphite discs on the cuff sides
  const hinge = new THREE.Mesh(new THREE.CylinderGeometry(0.11, 0.11, 0.6, 48), mats.joint);
  hinge.rotation.z = Math.PI / 2;
  hinge.position.z = -0.08;
  wrist.add(hinge);
  // cuff overlapping the palm heel so there is no gap
  const cuff = capsuleBox(0.6, 0.26, 0.42, mats.shell, 0.12);
  cuff.position.z = -0.2;
  wrist.add(cuff);
  const cuffSeam = new THREE.Mesh(
    new THREE.ExtrudeGeometry(ringShape(0.6, 0.26, 0.12, 0.004), { depth: 0.012, bevelEnabled: false, curveSegments: 16 }),
    mats.seam,
  );
  cuffSeam.position.z = -0.13;
  wrist.add(cuffSeam);
  // forearm: flattened oval cross-section, widening toward the elbow
  const foreLen = 2.6;
  const fore = new THREE.Mesh(new THREE.CylinderGeometry(0.27, 0.36, foreLen, 64, 1), mats.shell);
  fore.rotation.x = -Math.PI / 2; // narrow end toward the wrist
  fore.scale.set(1, 1, 0.68); // flatten (local Z = world Y after rotation)
  fore.position.z = -0.38 - foreLen / 2;
  wrist.add(fore);
  [-0.7, -1.25].forEach((z) => {
    const r = 0.27 + (-z - 0.38) * (0.09 / foreLen);
    const seamF = new THREE.Mesh(new THREE.TorusGeometry(r + 0.003, 0.007, 8, 64), mats.seam);
    seamF.scale.set(1, 0.68, 1);
    seamF.position.z = z;
    wrist.add(seamF);
  });

  const setPose = (extra: readonly number[]) => {
    chains.forEach((c, ci) => {
      c.joints.forEach((j, ji) => {
        // curl upward toward the palm normal = negative rotation about X
        const amount = c.relaxed[ji] + (extra[ci] ?? 0) * (ji === 0 ? 0.8 : 1.1);
        j.rotation.x = -amount;
      });
    });
  };
  setPose([0, 0, 0, 0, 0]);

  return { root, setPose };
};
