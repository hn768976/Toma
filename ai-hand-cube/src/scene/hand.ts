// Procedural robot hand built as a joint hierarchy:
// hand root -> palm -> finger bases -> proximal -> middle -> distal.
// Local frame: palm normal = +Y, fingers point +Z, thumb on -X (a right hand
// seen palm-up with the fingers toward the viewer). Palm width ~1 unit.
//
// Shapes are sculpted lofts (squircle sections, tapered, domed) rather than
// primitives. Every joint is a clevis hinge: link plates on the parent
// segment, a polished pin through them and a darker ball partly hidden
// between the segments.
import * as THREE from "three";
import { loft, rod, Section, sectionPoint, tube } from "./geom";

const DEG = Math.PI / 180;

export type HandMaterials = {
  shell: THREE.Material; // satin white-silver panels
  joint: THREE.Material; // graphite joints
  seam: THREE.Material; // dark seam lines
  metal: THREE.Material; // polished pins, rods, pistons
  pad: THREE.Material; // rubber fingertip pads
};

export type HandRig = {
  root: THREE.Group;
  /** extra curl in radians [thumb, index, middle, ring, little] */
  setPose: (extraCurl: readonly number[]) => void;
};

const smooth = (a: number, b: number, x: number) => {
  const t = Math.min(1, Math.max(0, (x - a) / (b - a)));
  return t * t * (3 - 2 * t);
};
const lerp = (a: number, b: number, t: number) => a + (b - a) * t;
const gauss = (dx: number, dz: number) => Math.exp(-(dx * dx + dz * dz));

// ---------------------------------------------------------------------------
// Palm: one sculpted shell. Cupped centre, thenar (thumb) and hypothenar
// pads, curved knuckle line, thicker at the heel.
const PALM = {
  zStart: -0.56,
  length: 1.06,
  nTop: 4.2,
  nBottom: 3,
  section: (t: number): Section => ({
    w: lerp(0.8, 0.98, smooth(0, 0.75, t)),
    h: lerp(0.34, 0.24, t),
    oy: -0.01,
  }),
};

const palmDeform = (v: THREE.Vector3) => {
  const t = (v.z - PALM.zStart) / PALM.length;
  const sec = PALM.section(Math.min(1, Math.max(0, t)));
  const xn = v.x / (sec.w / 2);
  if (v.y > (sec.oy ?? 0)) {
    // cupped centre (slightly recessed)
    v.y -= 0.06 * Math.max(0, 1 - xn * xn) * Math.sin(Math.PI * Math.min(1, Math.max(0, (t - 0.12) / 0.8)));
    // thenar pad (thumb side heel) and hypothenar pad (little finger side)
    v.y += 0.13 * gauss((v.x + 0.25) / 0.2, (v.z + 0.12) / 0.3);
    v.y += 0.06 * gauss((v.x - 0.3) / 0.14, (v.z + 0.26) / 0.24);
  } else {
    // transverse arch: the back of the hand is domed
    v.y -= 0.05 * Math.max(0, 1 - xn * xn);
  }
  // thenar swells out to the side where the thumb attaches
  if (v.x < 0) v.x -= 0.09 * gauss(0, (v.z + 0.1) / 0.3) * smooth(0.3, 1.0, -xn);
  // knuckle row: a rounded metacarpal head behind each finger, top and back
  const kx = [-0.33, -0.11, 0.11, 0.32];
  let k = 0;
  kx.forEach((x) => (k += gauss((v.x - x) / 0.085, 0)));
  k = Math.min(1, k) * smooth(0.72, 0.95, t);
  v.y += (v.y > (sec.oy ?? 0) ? 0.03 : -0.035) * k;
  // knuckle arch: the middle of the front edge comes forward
  v.z += 0.05 * Math.max(0, 1 - xn * xn) * smooth(0.7, 1, t);
};

/** point on the deformed palm surface (top = palm side, bottom = back) */
const palmSurface = (x: number, z: number, top: boolean, lift = 0) => {
  const t = (z - PALM.zStart) / PALM.length;
  const sec = PALM.section(t);
  const n = top ? PALM.nTop : PALM.nBottom;
  const a = Math.min(0.999, Math.abs((2 * x) / sec.w));
  const yy = (sec.h / 2) * Math.pow(1 - Math.pow(a, n), 1 / n);
  const v = new THREE.Vector3(x, (sec.oy ?? 0) + (top ? yy + lift : -yy - lift), z);
  palmDeform(v);
  return v;
};

type FingerDef = {
  x: number;
  splay: number; // radians about Y
  lengths: [number, number, number];
  width: number;
  relaxed: [number, number, number];
};

const FINGERS: FingerDef[] = [
  // index (thumb side, -X)
  { x: -0.33, splay: -9 * DEG, lengths: [0.506, 0.319, 0.264], width: 0.17, relaxed: [12 * DEG, 15 * DEG, 10 * DEG] },
  // middle - longest
  { x: -0.11, splay: -2.5 * DEG, lengths: [0.572, 0.363, 0.286], width: 0.19, relaxed: [14 * DEG, 17 * DEG, 11 * DEG] },
  // ring
  { x: 0.11, splay: 4.5 * DEG, lengths: [0.539, 0.341, 0.275], width: 0.176, relaxed: [16 * DEG, 19 * DEG, 12 * DEG] },
  // little - ~80% of middle
  { x: 0.32, splay: 13 * DEG, lengths: [0.429, 0.275, 0.231], width: 0.148, relaxed: [19 * DEG, 21 * DEG, 13 * DEG] },
];

const knuckleZ = (x: number) => 0.47 + 0.05 * Math.max(0, 1 - (x / 0.49) ** 2);

export const buildHand = (mats: HandMaterials): HandRig => {
  const root = new THREE.Group();
  root.name = "hand";
  const palm = new THREE.Group();
  root.add(palm);

  // --- Palm shell -------------------------------------------------------------
  palm.add(
    new THREE.Mesh(
      loft({ ...PALM, rows: 96, cols: 128, capStart: 0.08, capEnd: 0.11, deform: palmDeform }),
      mats.shell,
    ),
  );
  // back of the hand: four polished tendon rods in shallow channels
  FINGERS.forEach((fd) => {
    const pts: THREE.Vector3[] = [];
    for (let i = 0; i <= 12; i++) {
      const t = i / 12;
      const x = lerp(fd.x * 0.45, fd.x, t);
      const z = lerp(-0.42, knuckleZ(fd.x) - 0.05, t);
      pts.push(palmSurface(x, z, false, -0.006));
    }
    palm.add(tube(pts, 0.016, mats.metal, false, 48));
  });

  // --- Joint builders ----------------------------------------------------------
  const pinGeo = new THREE.CylinderGeometry(1, 1, 1, 32);
  pinGeo.rotateZ(Math.PI / 2); // axis along X
  const ballGeo = new THREE.SphereGeometry(1, 40, 24);
  const plateGeo = new THREE.CylinderGeometry(1, 1, 1, 40);
  plateGeo.rotateZ(Math.PI / 2);

  /** clevis hinge parts attached to `parent` at local position (0,0,zJoint) */
  const clevis = (parent: THREE.Object3D, zJoint: number, w: number, h: number, back: number) => {
    // darker ball, mostly hidden between the segments
    const b = new THREE.Mesh(ballGeo, mats.joint);
    b.scale.setScalar(h * 0.47);
    b.position.z = zJoint;
    parent.add(b);
    // link plates either side: a round boss around the pin + a strap back
    // into the parent segment
    [-1, 1].forEach((side) => {
      const x = side * (w / 2 - 0.003);
      const boss = new THREE.Mesh(plateGeo, mats.joint);
      boss.scale.set(0.02, h * 0.34, h * 0.34);
      boss.position.set(x, 0, zJoint);
      parent.add(boss);
      const strap = new THREE.Mesh(
        loft({
          length: back,
          rows: 8,
          cols: 24,
          nTop: 6,
          nBottom: 6,
          section: (t) => ({ w: 0.02, h: h * lerp(0.5, 0.62, t) }),
        }),
        mats.joint,
      );
      strap.position.set(x, 0, zJoint - back);
      parent.add(strap);
    });
    // polished pin through both plates
    const pin = new THREE.Mesh(pinGeo, mats.metal);
    pin.scale.set(w + 0.06, h * 0.17, h * 0.17);
    pin.position.z = zJoint;
    parent.add(pin);
  };

  /** sculpted segment along +Z from z = a to z = b */
  const segment = (
    parent: THREE.Object3D,
    a: number,
    b: number,
    w0: number,
    h0: number,
    w1: number,
    h1: number,
    tip: boolean,
  ) => {
    const len = b - a;
    const g = loft({
      zStart: a,
      length: len,
      rows: 40,
      cols: 48,
      nTop: 3.2, // flatter on the palm side (pad)
      nBottom: 2.5,
      capStart: Math.min(0.05, len * 0.2),
      capEnd: tip ? Math.min(0.12, len * 0.45) : Math.min(0.05, len * 0.2),
      section: (t) => {
        // narrow neck where it sits inside the parent's clevis, slight waist
        const neck = lerp(0.82, 1, smooth(0, 0.22, t));
        const waist = 1 - 0.045 * Math.sin(Math.PI * t);
        return { w: lerp(w0, w1, t) * neck * waist, h: lerp(h0, h1, t) * waist };
      },
    });
    const m = new THREE.Mesh(g, mats.shell);
    parent.add(m);
    if (tip) {
      // soft graphite fingertip pad, sculpted into the palm side of the tip
      const pad = new THREE.Mesh(
        loft({
          zStart: a + len * 0.52,
          length: len * 0.4,
          rows: 16,
          cols: 32,
          nTop: 2.4,
          nBottom: 2.4,
          capStart: len * 0.12,
          capEnd: len * 0.12,
          section: () => ({ w: w1 * 0.66, h: 0.05, oy: h1 * 0.36 }),
        }),
        mats.pad,
      );
      parent.add(pad);
      // polished nail plate on the back of the tip
      const nail = new THREE.Mesh(
        loft({
          zStart: a + len * 0.45,
          length: len * 0.42,
          rows: 12,
          cols: 32,
          nTop: 4,
          nBottom: 4,
          capStart: 0.02,
          capEnd: len * 0.12,
          section: () => ({ w: w1 * 0.62, h: 0.04, oy: -h1 * 0.38 }),
        }),
        mats.metal,
      );
      parent.add(nail);
    }
  };

  type Chain = { joints: THREE.Group[]; relaxed: number[] };
  const chains: Chain[] = [];

  /** finger chain: joints[i] rotates; each segment carries the clevis for the next joint */
  const buildChain = (base: THREE.Object3D, lengths: number[], width: number, thick: number) => {
    const joints: THREE.Group[] = [];
    let attach: THREE.Object3D = base;
    // base clevis belongs to the palm/base (does not rotate)
    clevis(base, 0, width * 1.02, thick * 1.05, 0.12);
    lengths.forEach((len, i) => {
      const j = new THREE.Group();
      if (i > 0) j.position.z = lengths[i - 1];
      attach.add(j);
      joints.push(j);
      const tp0 = 1 - i * 0.09;
      const tp1 = 1 - (i + 1) * 0.09;
      const last = i === lengths.length - 1;
      const gap = thick * tp0 * 0.2;
      segment(j, gap, last ? len : len - gap * 0.35, width * tp0, thick * tp0, width * tp1, thick * tp1 * (last ? 0.9 : 1), last);
      if (!last) clevis(j, len, width * tp1, thick * tp1, 0.13);
      attach = j;
    });
    return joints;
  };

  // --- Fingers -----------------------------------------------------------------
  FINGERS.forEach((fd) => {
    const base = new THREE.Group();
    base.position.set(fd.x, 0.0, knuckleZ(fd.x));
    base.rotation.y = fd.splay;
    palm.add(base);
    const joints = buildChain(base, fd.lengths, fd.width, fd.width * 0.9);
    chains.push({ joints, relaxed: fd.relaxed });
  });

  // --- Thumb: a thenar housing grows out of the palm side and carries the
  // base joint; then 2 segments. The thumb lies roughly in the palm plane,
  // angled ~40deg away from the index finger, pad turned toward the fingers.
  const thenarDir = new THREE.Group();
  thenarDir.position.set(-0.26, 0.04, -0.06);
  thenarDir.rotation.set(-12 * DEG, -52 * DEG, -8 * DEG, "YXZ");
  palm.add(thenarDir);
  const thenarLen = 0.42;
  thenarDir.add(
    new THREE.Mesh(
      loft({
        length: thenarLen,
        rows: 32,
        cols: 48,
        nTop: 2.6,
        nBottom: 2.4,
        capStart: 0.1,
        capEnd: 0.06,
        section: (t) => ({ w: lerp(0.36, 0.25, t), h: lerp(0.3, 0.22, t) }),
      }),
      mats.shell,
    ),
  );
  // real part break where the thenar housing meets the palm: graphite gasket
  const gasket: THREE.Vector3[] = [];
  for (let i = 0; i < 40; i++) {
    const p = sectionPoint({ w: 0.33, h: 0.28 }, (i / 40) * Math.PI * 2, 2.6, 2.4, 1.01);
    gasket.push(new THREE.Vector3(p.x, p.y, 0.16));
  }
  thenarDir.add(tube(gasket, 0.009, mats.joint, true, 96));
  const thumbBase = new THREE.Group();
  thumbBase.position.z = thenarLen + 0.02;
  thumbBase.rotation.set(-22 * DEG, -14 * DEG, -24 * DEG, "YXZ");
  thenarDir.add(thumbBase);
  const thumbJoints = buildChain(thumbBase, [0.47, 0.37], 0.215, 0.19);
  chains.unshift({ joints: thumbJoints, relaxed: [8 * DEG, 12 * DEG] });
  // web between the thumb housing and the index knuckle: a low sculpted
  // shell so the thumb visibly belongs to the palm
  palm.updateMatrixWorld(true);
  const webA = new THREE.Vector3(0, 0, thenarLen * 0.75).applyMatrix4(thenarDir.matrix);
  const webB = new THREE.Vector3(FINGERS[0].x + 0.02, 0.0, knuckleZ(FINGERS[0].x) - 0.1);
  const web = new THREE.Group();
  web.position.copy(webA);
  web.lookAt(webB);
  palm.add(web);
  web.add(
    new THREE.Mesh(
      loft({
        length: webA.distanceTo(webB),
        rows: 24,
        cols: 40,
        nTop: 2.4,
        nBottom: 2.4,
        capStart: 0.06,
        capEnd: 0.08,
        section: (t) => ({ w: lerp(0.2, 0.14, t), h: lerp(0.2, 0.13, t), oy: 0.01 }),
      }),
      mats.shell,
    ),
  );

  // --- Wrist: cuff with a hinge, sculpted forearm, pistons -------------------
  const cuff = new THREE.Mesh(
    loft({
      zStart: -0.88,
      length: 0.42,
      rows: 32,
      cols: 64,
      nTop: 3,
      nBottom: 3,
      capStart: 0,
      capEnd: 0.06,
      section: (t) => ({ w: lerp(0.6, 0.72, Math.sin(Math.PI * t)), h: lerp(0.36, 0.38, t), oy: -0.02 }),
    }),
    mats.shell,
  );
  palm.add(cuff);
  // hinge pin through the cuff, caps visible on both sides
  const wristPin = new THREE.Mesh(pinGeo, mats.metal);
  wristPin.scale.set(0.8, 0.07, 0.07);
  wristPin.position.set(0, -0.02, -0.68);
  palm.add(wristPin);
  [-1, 1].forEach((side) => {
    const boss = new THREE.Mesh(plateGeo, mats.joint);
    boss.scale.set(0.05, 0.13, 0.13);
    boss.position.set(side * 0.36, -0.02, -0.68);
    palm.add(boss);
  });
  const cuffSeam: THREE.Vector3[] = [];
  for (let i = 0; i < 48; i++) {
    const p = sectionPoint({ w: 0.6, h: 0.36, oy: -0.02 }, (i / 48) * Math.PI * 2, 3, 3, 1.006);
    cuffSeam.push(new THREE.Vector3(p.x, p.y, -0.88));
  }
  palm.add(tube(cuffSeam, 0.008, mats.joint, true, 96));

  const wrist = new THREE.Group();
  wrist.position.set(0, -0.02, -0.88);
  wrist.rotation.x = -14 * DEG; // forearm heads back and down out of frame
  palm.add(wrist);
  // rotary wrist ring with bolt heads between cuff and forearm
  const ringG = loft({
    zStart: -0.06,
    length: 0.1,
    rows: 10,
    cols: 64,
    nTop: 2.8,
    nBottom: 2.8,
    section: () => ({ w: 0.64, h: 0.42 }),
  });
  wrist.add(new THREE.Mesh(ringG, mats.joint));
  const boltG = new THREE.CylinderGeometry(0.018, 0.018, 0.02, 6);
  boltG.rotateX(Math.PI / 2);
  for (let i = 0; i < 10; i++) {
    const th = (i / 10) * Math.PI * 2 + 0.3;
    const p = sectionPoint({ w: 0.64, h: 0.42 }, th, 2.8, 2.8, 1.0);
    const bolt = new THREE.Mesh(boltG, mats.metal);
    bolt.position.set(p.x * 1.01, p.y * 1.01, -0.01);
    bolt.lookAt(p.x * 3, p.y * 3, -0.01);
    wrist.add(bolt);
  }
  const foreLen = 7;
  const fore = new THREE.Mesh(
    loft({
      zStart: -foreLen + 0.16,
      length: foreLen,
      rows: 64,
      cols: 64,
      nTop: 2.6,
      nBottom: 2.4,
      section: (t) => {
        // t = 0 at the elbow end, 1 at the wrist
        // t = 1 at the wrist; widens and flattens toward the elbow
        const d = (1 - t) * foreLen; // distance from the wrist
        const bulge = smooth(0, 2.2, d) - 0.25 * smooth(3.0, 6.0, d);
        return { w: 0.56 + 0.26 * bulge, h: 0.38 + 0.16 * bulge };
      },
    }),
    mats.shell,
  );
  wrist.add(fore);
  // forearm panel seams: two rings and a line along the top
  [-0.35, -1.35].forEach((z) => {
    const t = (z + foreLen) / foreLen;
    const dd = (1 - t) * foreLen;
    const bulge = smooth(0, 2.2, dd) - 0.25 * smooth(3.0, 6.0, dd);
    const sec = { w: 0.56 + 0.26 * bulge, h: 0.38 + 0.16 * bulge };
    const pts: THREE.Vector3[] = [];
    for (let i = 0; i < 48; i++) {
      const p = sectionPoint(sec, (i / 48) * Math.PI * 2, 2.6, 2.4, 1.004);
      pts.push(new THREE.Vector3(p.x, p.y, z));
    }
    wrist.add(tube(pts, 0.006, mats.seam, true, 128));
  });

  // pistons: from mounts on the forearm sides to mounts on the palm heel
  palm.updateMatrixWorld(true);
  const wristToPalm = (v: THREE.Vector3) => {
    wrist.updateMatrix();
    return v.clone().applyMatrix4(wrist.matrix);
  };
  const mountGeo = loft({ length: 0.12, rows: 8, cols: 24, nTop: 5, nBottom: 5, capStart: 0.02, capEnd: 0.02, section: () => ({ w: 0.08, h: 0.09 }) });
  [-1, 1].forEach((side) => {
    const a = wristToPalm(new THREE.Vector3(side * 0.33, 0.06, -0.75));
    const b = new THREE.Vector3(side * 0.44, 0.0, -0.4);
    const mid = a.clone().lerp(b, 0.55);
    palm.add(rod(a, mid, 0.034, mats.joint)); // sleeve
    palm.add(rod(mid.clone().lerp(a, 0.1), b, 0.017, mats.metal)); // rod
    // clevis brackets bolted to the forearm and the palm heel, each with a pin
    [a, b].forEach((p) => {
      const m = new THREE.Mesh(mountGeo, mats.joint);
      m.position.copy(p).add(new THREE.Vector3(-side * 0.03, 0, -0.06));
      palm.add(m);
      const pin = new THREE.Mesh(pinGeo, mats.metal);
      pin.scale.set(0.11, 0.022, 0.022);
      pin.position.copy(p);
      palm.add(pin);
    });
  });

  // shadows for contact shading between parts
  root.traverse((o) => {
    if ((o as THREE.Mesh).isMesh) {
      o.castShadow = true;
      o.receiveShadow = true;
    }
  });

  const setPose = (extra: readonly number[]) => {
    chains.forEach((c, ci) => {
      c.joints.forEach((j, ji) => {
        // curl toward the palm normal = negative rotation about X
        const amount = c.relaxed[ji] + (extra[ci] ?? 0) * (ji === 0 ? 0.8 : 1.1);
        j.rotation.x = -amount;
      });
    });
  };
  setPose([0, 0, 0, 0, 0]);

  return { root, setPose };
};
