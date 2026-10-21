// The robot: an original toy-like design built from primitives, rigged as a
// simple hierarchy, posed every frame by walk.ts.
import * as THREE from "three";
import { RoundedBoxGeometry } from "three/examples/jsm/geometries/RoundedBoxGeometry.js";
import palette from "../../data/robot.json";
import { LIGHT_DIR, outlineMaterial, toonMaterial, withSmoothNormals } from "./toon";

export type Rig = {
  root: THREE.Group;
  pelvis: THREE.Group;
  torso: THREE.Group;
  head: THREE.Group;
  antenna: THREE.Group;
  hip: [THREE.Group, THREE.Group];
  knee: [THREE.Group, THREE.Group];
  ankle: [THREE.Group, THREE.Group];
  shoulder: [THREE.Group, THREE.Group];
  elbow: [THREE.Group, THREE.Group];
  wrist: [THREE.Group, THREE.Group];
};

// Dimensions (world units; the robot is ~2.9 tall).
export const DIM = {
  hipX: 0.27,
  thigh: 0.36,
  shin: 0.36,
  ankleH: 0.2, // ankle centre above the sole
  heelZ: -0.17, // heel relative to ankle
  toeZ: 0.33, // toe relative to ankle
  shoulderX: 0.53,
  shoulderY: 0.62, // above pelvis
  upperArm: 0.25,
  forearm: 0.22,
  pelvisY: 0.76,
};

const mats = (() => {
  const L = LIGHT_DIR;
  return {
    body: toonMaterial(palette.body, L),
    panel: toonMaterial(palette.panel, L),
    accent: toonMaterial(palette.accent, L),
    lens: toonMaterial(palette.lens, L, { shadeMul: 0.8 }),
    light: toonMaterial(palette.light, L, { highlight: false, shadeMul: 0.9 }),
    white: toonMaterial("#FFFFFF", L, { highlight: false, shadeMul: 1 }),
    outline: outlineMaterial(palette.outline),
    dark: toonMaterial(palette.outline, L, { highlight: false, shadeMul: 1 }),
  };
})();

type MatKey = keyof typeof mats;

// A part: toon mesh plus an inverted-hull outline from the same geometry.
const part = (g: THREE.BufferGeometry, m: MatKey, outline = true) => {
  const grp = new THREE.Group();
  const mesh = new THREE.Mesh(g, mats[m]);
  grp.add(mesh);
  if (outline) {
    withSmoothNormals(g);
    const o = new THREE.Mesh(g, mats.outline);
    grp.add(o);
  }
  return grp;
};

const at = <T extends THREE.Object3D>(o: T, x: number, y: number, z: number) => {
  o.position.set(x, y, z);
  return o;
};

const cyl = (r: number, h: number, seg = 28) => new THREE.CylinderGeometry(r, r, h, seg, 1);
const ball = (r: number) => new THREE.SphereGeometry(r, 28, 18);
const rbox = (w: number, h: number, d: number, r: number) => new RoundedBoxGeometry(w, h, d, 4, r);

// Barrel torso: a lathe with bulging sides.
const barrel = () => {
  const pts: THREE.Vector2[] = [];
  const h = 0.78;
  for (let i = 0; i <= 16; i++) {
    const t = i / 16;
    const y = -h / 2 + t * h;
    const bulge = Math.sin(Math.PI * t);
    let r = 0.4 + 0.07 * bulge;
    // round the rims
    if (t < 0.06) r -= (0.06 - t) * 1.2;
    if (t > 0.94) r -= (t - 0.94) * 1.2;
    pts.push(new THREE.Vector2(r, y));
  }
  pts.unshift(new THREE.Vector2(0, -h / 2));
  pts.push(new THREE.Vector2(0, h / 2));
  const g = new THREE.LatheGeometry(pts, 40);
  g.computeVertexNormals();
  return g;
};

// Mitten claw: a thick open ring (C shape) with a stubby thumb.
const claw = () => {
  const g = new THREE.TorusGeometry(0.085, 0.04, 14, 28, Math.PI * 1.45);
  g.rotateZ(Math.PI * 0.78);
  return g;
};

const eye = (side: number) => {
  const g = new THREE.Group();
  const rim = part(cyl(0.105, 0.05).rotateX(Math.PI / 2), "accent");
  const lens = part(cyl(0.078, 0.06).rotateX(Math.PI / 2), "lens");
  const hi = part(ball(0.026), "white", false);
  at(lens, 0, 0, 0.012);
  at(hi, -0.025, 0.028, 0.045);
  g.add(rim, lens, hi);
  g.position.set(side * 0.17, 0.06, 0.315);
  return g;
};

const grille = () => {
  const g = new THREE.Group();
  g.add(part(rbox(0.26, 0.1, 0.04, 0.018), "panel"));
  for (let i = -2; i <= 2; i++) {
    const slot = part(rbox(0.018, 0.064, 0.02, 0.008), "dark", false);
    at(slot, i * 0.045, 0, 0.018);
    g.add(slot);
  }
  g.position.set(0, -0.15, 0.31);
  return g;
};

const chestPanel = () => {
  const g = new THREE.Group();
  g.add(part(rbox(0.46, 0.36, 0.06, 0.04), "panel"));
  const colors: MatKey[] = ["light", "accent", "light"];
  colors.forEach((c, i) => {
    const l = part(cyl(0.035, 0.03).rotateX(Math.PI / 2), c);
    at(l, -0.12 + i * 0.12, 0.08, 0.035);
    g.add(l);
  });
  for (let i = 0; i < 3; i++) {
    const v = part(rbox(0.3, 0.028, 0.02, 0.01), "dark", false);
    at(v, 0, -0.04 - i * 0.05, 0.03);
    g.add(v);
  }
  g.position.set(0, 0.03, 0.46);
  return g;
};

const leg = (side: number) => {
  const hip = new THREE.Group();
  hip.add(part(ball(0.1), "accent"));
  const thigh = part(cyl(0.075, DIM.thigh), "body");
  at(thigh, 0, -DIM.thigh / 2, 0);
  hip.add(thigh);
  const knee = at(new THREE.Group(), 0, -DIM.thigh, 0);
  knee.add(part(ball(0.095), "accent"));
  const shin = part(cyl(0.07, DIM.shin), "body");
  at(shin, 0, -DIM.shin / 2, 0);
  knee.add(shin);
  hip.add(knee);
  const ankle = at(new THREE.Group(), 0, -DIM.shin, 0);
  ankle.add(part(ball(0.08), "accent"));
  const footLen = DIM.toeZ - DIM.heelZ;
  const shoe = part(rbox(0.32, 0.15, footLen, 0.06), "panel");
  at(shoe, 0, -DIM.ankleH + 0.1, (DIM.toeZ + DIM.heelZ) / 2);
  const sole = part(rbox(0.33, 0.06, footLen + 0.01, 0.025), "accent");
  at(sole, 0, -DIM.ankleH + 0.03, (DIM.toeZ + DIM.heelZ) / 2);
  const cap = part(rbox(0.26, 0.06, 0.16, 0.03), "body");
  at(cap, 0, -DIM.ankleH + 0.19, DIM.toeZ - 0.12);
  ankle.add(shoe, sole, cap);
  knee.add(ankle);
  hip.position.x = side * DIM.hipX;
  return { hip, knee, ankle };
};

const arm = (side: number) => {
  const shoulder = new THREE.Group();
  shoulder.add(part(ball(0.11), "accent"));
  const upper = part(cyl(0.065, DIM.upperArm), "body");
  at(upper, 0, -DIM.upperArm / 2, 0);
  shoulder.add(upper);
  const elbow = at(new THREE.Group(), 0, -DIM.upperArm, 0);
  elbow.add(part(ball(0.085), "accent"));
  const fore = part(cyl(0.06, DIM.forearm), "body");
  at(fore, 0, -DIM.forearm / 2, 0);
  elbow.add(fore);
  shoulder.add(elbow);
  const wrist = at(new THREE.Group(), 0, -DIM.forearm, 0);
  wrist.add(part(cyl(0.07, 0.06), "panel"));
  const c = part(claw(), "panel");
  c.rotation.y = side * Math.PI / 2;
  at(c, 0, -0.1, 0);
  wrist.add(c);
  elbow.add(wrist);
  shoulder.position.set(side * DIM.shoulderX, DIM.shoulderY, 0);
  return { shoulder, elbow, wrist };
};

export const buildRobot = (): Rig => {
  const root = new THREE.Group();
  const pelvis = new THREE.Group();
  root.add(pelvis);

  const hips = part(rbox(0.5, 0.16, 0.36, 0.06), "panel");
  at(hips, 0, 0.04, 0);
  pelvis.add(hips);

  const torso = new THREE.Group();
  torso.position.y = 0.14;
  pelvis.add(torso);
  const body = part(barrel(), "body");
  at(body, 0, 0.4, 0);
  torso.add(body);
  for (const y of [0.04, 0.76]) {
    const band = part(new THREE.TorusGeometry(0.385, 0.03, 10, 40).rotateX(Math.PI / 2), "accent");
    at(band, 0, y, 0);
    torso.add(band);
  }
  const chest = chestPanel();
  chest.position.y += 0.4;
  torso.add(chest);

  const neck = part(cyl(0.09, 0.12), "accent");
  at(neck, 0, 0.84, 0);
  torso.add(neck);

  const head = new THREE.Group();
  head.position.y = 0.9;
  torso.add(head);
  const skull = part(rbox(0.82, 0.62, 0.62, 0.12), "body");
  at(skull, 0, 0.31, 0);
  head.add(skull);
  const face = new THREE.Group();
  face.position.y = 0.31;
  face.add(eye(-1), eye(1), grille());
  for (const s of [-1, 1]) {
    const ear = part(cyl(0.12, 0.06).rotateZ(Math.PI / 2), "panel");
    at(ear, s * 0.42, 0, 0);
    const bolt = part(cyl(0.05, 0.04).rotateZ(Math.PI / 2), "accent");
    at(bolt, s * 0.46, 0, 0);
    face.add(ear, bolt);
  }
  const brow = part(rbox(0.5, 0.06, 0.04, 0.02), "panel");
  at(brow, 0, 0.2, 0.31);
  face.add(brow);
  head.add(face);
  const antenna = new THREE.Group();
  antenna.position.y = 0.62;
  const base = part(cyl(0.07, 0.04), "panel");
  at(base, 0, 0.02, 0);
  const rod = part(cyl(0.022, 0.2), "dark", false);
  at(rod, 0, 0.12, 0);
  const tip = part(ball(0.065), "accent");
  at(tip, 0, 0.25, 0);
  antenna.add(base, rod, tip);
  head.add(antenna);

  const L = leg(1);
  const R = leg(-1);
  root.add(L.hip, R.hip);
  const AL = arm(1);
  const AR = arm(-1);
  torso.add(AL.shoulder, AR.shoulder);

  return {
    root,
    pelvis,
    torso,
    head,
    antenna,
    hip: [L.hip, R.hip],
    knee: [L.knee, R.knee],
    ankle: [L.ankle, R.ankle],
    shoulder: [AL.shoulder, AR.shoulder],
    elbow: [AL.elbow, AR.elbow],
    wrist: [AL.wrist, AR.wrist],
  };
};
