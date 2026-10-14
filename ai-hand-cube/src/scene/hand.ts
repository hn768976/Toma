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
import { loft, Section, sectionPoint, tube } from "./geom";

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
  /** wrist bend (radians, negative = forearm drops) */
  setWrist: (angle: number) => void;
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
    h: lerp(0.28, 0.2, t),
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
    v.y += 0.12 * gauss((v.x + 0.27) / 0.2, (v.z + 0.02) / 0.32);
    v.y += 0.06 * gauss((v.x - 0.3) / 0.14, (v.z + 0.26) / 0.24);
  } else {
    // transverse arch: the back of the hand is domed
    v.y -= 0.05 * Math.max(0, 1 - xn * xn);
  }
  // thenar swells out to the side where the thumb attaches
  if (v.x < 0) v.x -= 0.1 * gauss(0, (v.z - 0.02) / 0.3) * smooth(0.3, 1.0, -xn);
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
  { x: -0.33, splay: -9 * DEG, lengths: [0.47, 0.3, 0.25], width: 0.2, relaxed: [16 * DEG, 22 * DEG, 16 * DEG] },
  // middle - longest
  { x: -0.11, splay: -2.5 * DEG, lengths: [0.53, 0.34, 0.27], width: 0.212, relaxed: [17 * DEG, 23 * DEG, 17 * DEG] },
  // ring
  { x: 0.11, splay: 4.5 * DEG, lengths: [0.5, 0.32, 0.26], width: 0.202, relaxed: [18 * DEG, 24 * DEG, 18 * DEG] },
  // little - ~80% of middle
  { x: 0.32, splay: 13 * DEG, lengths: [0.4, 0.26, 0.21], width: 0.178, relaxed: [20 * DEG, 25 * DEG, 18 * DEG] },
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
    b.scale.setScalar(h * 0.44);
    b.position.z = zJoint;
    parent.add(b);
    // flush graphite pin caps either side (the hinge axis), no exposed straps
    [-1, 1].forEach((side) => {
      const cap = new THREE.Mesh(plateGeo, mats.joint);
      cap.scale.set(0.012, h * 0.2, h * 0.2);
      cap.position.set(side * (w / 2) * 0.97, 0, zJoint);
      parent.add(cap);
    });
    void back;
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
        const neck = lerp(0.92, 1, smooth(0, 0.22, t));
        // knuckle bulge at the near end, gentle taper toward the far end
        const bulge = 1 + 0.07 * Math.exp(-Math.pow((t - 0.12) / 0.14, 2)) - 0.03 * t;
        return { w: lerp(w0, w1, t) * neck * bulge, h: lerp(h0, h1, t) * bulge };
      },
    });
    const m = new THREE.Mesh(g, mats.shell);
    parent.add(m);
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
      const gap = thick * tp0 * 0.08;
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
  thenarDir.position.set(-0.3, 0.04, 0.0);
  thenarDir.rotation.set(-26 * DEG, -66 * DEG, -6 * DEG, "YXZ");
  palm.add(thenarDir);
  const thenarLen = 0.34;
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
        section: (t) => ({ w: lerp(0.34, 0.25, t), h: lerp(0.28, 0.22, t) }),
      }),
      mats.shell,
    ),
  );
  // real part break where the thenar housing meets the palm: graphite gasket
  const gasket: THREE.Vector3[] = [];
  for (let i = 0; i < 40; i++) {
    const p = sectionPoint({ w: 0.31, h: 0.255 }, (i / 40) * Math.PI * 2, 2.6, 2.4, 1.01);
    gasket.push(new THREE.Vector3(p.x, p.y, 0.16));
  }
  thenarDir.add(tube(gasket, 0.003, mats.seam, true, 96));
  const thumbBase = new THREE.Group();
  thumbBase.position.z = thenarLen + 0.02;
  thumbBase.rotation.set(-20 * DEG, 14 * DEG, -20 * DEG, "YXZ");
  thenarDir.add(thumbBase);
  // thumb: shorter than the fingers but the chunkiest digit
  const thumbJoints = buildChain(thumbBase, [0.35, 0.27], 0.235, 0.215);
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

  // pistons: from mounts on the forearm sides to mounts on the palm heel.
  // The forearm mount rides on the wrist group; sleeve and rod are re-aimed
  // whenever the wrist bend changes, so they always connect both mounts.
  const mountGeo = loft({ length: 0.12, rows: 8, cols: 24, nTop: 5, nBottom: 5, capStart: 0.02, capEnd: 0.02, section: () => ({ w: 0.08, h: 0.09 }) });
  const unitCyl = new THREE.CylinderGeometry(1, 1, 1, 24);
  const pistons = [-1, 1].map((side) => {
    const aLocal = new THREE.Vector3(side * 0.33, 0.06, -0.75); // in wrist space
    const b = new THREE.Vector3(side * 0.44, 0.0, -0.4); // in palm space
    const mount = (parent: THREE.Object3D, p: THREE.Vector3) => {
      const m = new THREE.Mesh(mountGeo, mats.joint);
      m.position.copy(p).add(new THREE.Vector3(-side * 0.03, 0, -0.06));
      parent.add(m);
      const pin = new THREE.Mesh(pinGeo, mats.metal);
      pin.scale.set(0.11, 0.022, 0.022);
      pin.position.copy(p);
      parent.add(pin);
    };
    mount(wrist, aLocal);
    mount(palm, b);
    const sleeve = new THREE.Mesh(unitCyl, mats.joint);
    const rodM = new THREE.Mesh(unitCyl, mats.metal);
    palm.add(sleeve, rodM);
    return { aLocal, b, sleeve, rodM };
  });
  const aim = (m: THREE.Mesh, a: THREE.Vector3, b: THREE.Vector3, r: number) => {
    m.position.copy(a).add(b).multiplyScalar(0.5);
    m.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), b.clone().sub(a).normalize());
    m.scale.set(r, a.distanceTo(b), r);
  };
  const placePistons = () => {
    wrist.updateMatrix();
    pistons.forEach(({ aLocal, b, sleeve, rodM }) => {
      const a = aLocal.clone().applyMatrix4(wrist.matrix);
      const mid = a.clone().lerp(b, 0.55);
      aim(sleeve, a, mid, 0.034);
      aim(rodM, mid.clone().lerp(a, 0.1), b, 0.017);
    });
  };
  placePistons();

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

  const setWrist = (angle: number) => {
    wrist.rotation.x = angle;
    placePistons();
  };
  return { root, setPose, setWrist };
};
