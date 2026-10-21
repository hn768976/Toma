// The steampunk machine: an original arrangement of pipes, gears, gauges and
// pistons around a 16:10 green screen. buildMachine() makes the scene graph
// once; update(frame) poses every moving part from the frame number alone.
//
// Loop: 300 frames. The top gear train advances 24 teeth per loop and the
// bottom train 36 teeth, so every gear turns a whole number of teeth; every
// other motion has a period that divides 300.
import * as THREE from "three";
import { linearKey } from "../lib/pipeline";
import { TAU, loopSin, mulberry32 } from "../lib/random";
import { MAT } from "./materials";
import {
  DIAL_SWEEP,
  GearSpec,
  coilGeometry,
  dialTexture,
  flange,
  gearGeometry,
  mesh,
  meshAngle,
  pipeGeometry,
  pitchRadius,
} from "./parts";

export const LOOP = 300;
const V = (x: number, y: number, z = 0) => new THREE.Vector3(x, y, z);

const roundedRect = (w: number, h: number, r: number, path: THREE.Path | THREE.Shape) => {
  const x = -w / 2;
  const y = -h / 2;
  path.moveTo(x + r, y);
  path.lineTo(x + w - r, y);
  path.quadraticCurveTo(x + w, y, x + w, y + r);
  path.lineTo(x + w, y + h - r);
  path.quadraticCurveTo(x + w, y + h, x + w - r, y + h);
  path.lineTo(x + r, y + h);
  path.quadraticCurveTo(x, y + h, x, y + h - r);
  path.lineTo(x, y + r);
  path.quadraticCurveTo(x, y, x + r, y);
  return path;
};

type Gear = { obj: THREE.Group; spec: GearSpec };

export const buildMachine = () => {
  const root = new THREE.Group();
  const m = {
    copper: MAT.copper(),
    copperDark: MAT.copperDark(),
    steel: MAT.steel(),
    steelDark: MAT.steelDark(),
    brass: MAT.brass(),
    rusty: MAT.rustyIron(),
    black: MAT.blackIron(),
    rubber: MAT.rubber(),
    red: MAT.red(),
    glass: MAT.glass(),
  };

  // --- screen and bezel ----------------------------------------------------
  const SW = 1.6;
  const SH = 1.0;
  const screenShape = roundedRect(SW, SH, 0.07, new THREE.Shape()) as THREE.Shape;
  const screenMat = new THREE.MeshBasicMaterial({ color: linearKey(0, 1, 0), toneMapped: false });
  const screen = new THREE.Mesh(new THREE.ShapeGeometry(screenShape, 12), screenMat);
  screen.position.z = 0.035;
  root.add(screen);

  const bezelShape = roundedRect(1.84, 1.22, 0.13, new THREE.Shape()) as THREE.Shape;
  bezelShape.holes.push(roundedRect(SW + 0.004, SH + 0.004, 0.07, new THREE.Path()) as THREE.Path);
  const bezelGeo = new THREE.ExtrudeGeometry(bezelShape, {
    depth: 0.12,
    bevelEnabled: true,
    bevelThickness: 0.035,
    bevelSize: 0.03,
    bevelSegments: 4,
    curveSegments: 14,
  });
  bezelGeo.translate(0, 0, -0.05);
  root.add(mesh(bezelGeo, m.black));
  // back box behind the screen (gives the frame depth)
  const back = mesh(new THREE.BoxGeometry(1.86, 1.2, 0.34), m.steelDark);
  back.position.z = -0.24;
  root.add(back);

  // rivets around the bezel
  const rivetGeo = new THREE.SphereGeometry(0.019, 12, 8, 0, TAU, 0, Math.PI / 2).rotateX(Math.PI / 2);
  const addRivet = (x: number, y: number, z = 0.108) => {
    const r = mesh(rivetGeo, m.steelDark);
    r.position.set(x, y, z);
    root.add(r);
  };
  for (let i = 0; i <= 12; i++) {
    const x = -0.82 + (i / 12) * 1.64;
    addRivet(x, 0.555);
    addRivet(x, -0.555);
  }
  for (let i = 1; i < 8; i++) {
    const y = -0.6 + (i / 8) * 1.2;
    addRivet(-0.86, y);
    addRivet(0.86, y);
  }

  // corner brackets
  const bracketGeo = new THREE.BoxGeometry(0.3, 0.09, 0.05);
  for (const [sx, sy] of [[-1, 1], [1, 1], [-1, -1], [1, -1]]) {
    const b = mesh(bracketGeo, m.steelDark);
    b.position.set(sx * 0.9, sy * 0.58, 0.1);
    b.rotation.z = sx * sy * (Math.PI / 4);
    root.add(b);
    for (const k of [-1, 1]) {
      const bolt = mesh(new THREE.CylinderGeometry(0.022, 0.022, 0.035, 6).rotateX(Math.PI / 2), m.steel);
      const d = 0.09 * k;
      bolt.position.set(sx * 0.9 + d * Math.cos(sx * sy * (Math.PI / 4)), sy * 0.58 + d * Math.sin(sx * sy * (Math.PI / 4)), 0.14);
      root.add(bolt);
    }
  }

  // --- pipes ---------------------------------------------------------------
  const pipe = (pts: THREE.Vector3[], r: number, mat: THREE.Material, flanges: "both" | "start" | "end" | "none" = "both") => {
    root.add(mesh(pipeGeometry(pts, r), mat));
    const ends: [THREE.Vector3, THREE.Vector3][] = [];
    if (flanges === "both" || flanges === "start") ends.push([pts[0], pts[1].clone().sub(pts[0])]);
    if (flanges === "both" || flanges === "end") ends.push([pts[pts.length - 1], pts[pts.length - 2].clone().sub(pts[pts.length - 1])]);
    for (const [p, d] of ends) {
      const at = p.clone().add(d.clone().setLength(r * 0.5));
      root.add(flange(at, d, r, m.steelDark, m.steel));
    }
  };

  // steel pipe: left spring cap -> over to the left -> down past the valve -> into the bezel
  pipe([V(-0.9, 1.22, -0.05), V(-1.22, 1.22, -0.05), V(-1.22, 0.3, -0.05), V(-1.0, 0.3, -0.05)], 0.08, m.steel);
  // copper: bezel lower left -> down the left side -> along the bottom -> up into the piston manifold
  pipe([V(-1.0, -0.34, -0.02), V(-1.36, -0.34, -0.02), V(-1.36, -1.22, -0.08), V(0.5, -1.22, -0.08), V(0.5, -0.82, -0.08)], 0.095, m.copper);
  // copper: second left loop, smaller, behind
  pipe([V(-1.0, 0.0, -0.14), V(-1.12, 0.0, -0.14), V(-1.12, -0.9, -0.14), V(-1.2, -0.9, -0.14)], 0.045, m.copperDark, "start");
  // copper U-loop on the right
  pipe([V(1.0, 0.24, -0.02), V(1.42, 0.24, -0.02), V(1.42, -0.62, -0.02), V(1.12, -0.62, -0.02), V(1.12, -0.78, -0.02)], 0.1, m.steel);
  // steel elbow right of the spring tube
  pipe([V(0.82, 1.22, -0.05), V(1.02, 1.22, -0.05), V(1.02, 0.72, -0.05)], 0.07, m.steelDark, "start");
  // thin copper tube bundle down the right side
  for (let i = 0; i < 5; i++) {
    const o = i * 0.05;
    pipe(
      [V(1.02 + 0.06 + o, 0.86, 0.04 - o * 0.2), V(1.22 + o, 0.86, 0.04 - o * 0.2), V(1.22 + o, 0.42 - o, 0.04 - o * 0.2), V(1.0, 0.42 - o, 0.04 - o * 0.2)],
      0.024,
      i === 1 ? m.rusty : m.copperDark,
      "none",
    );
  }
  // fitting block where the thin tubes and the right steel pipe end
  const block = mesh(new THREE.BoxGeometry(0.2, 0.22, 0.14), m.brass);
  block.position.set(1.06, 0.76, 0.0);
  root.add(block);
  const block2 = mesh(new THREE.BoxGeometry(0.22, 0.16, 0.18), m.steelDark);
  block2.position.set(1.12, -0.86, -0.02);
  root.add(block2);

  // --- spring tube across the top ------------------------------------------
  const springY = 1.22;
  const spring = new THREE.Group();
  spring.position.set(-0.66, springY, -0.05);
  const coil = mesh(coilGeometry(0.1, 0.03, 13, 1.2), m.copper);
  const coilHolder = new THREE.Group();
  coilHolder.add(coil);
  spring.add(coilHolder);
  const rod = mesh(new THREE.CylinderGeometry(0.04, 0.04, 1.24, 16).rotateZ(Math.PI / 2), m.steel);
  rod.position.x = 0.6;
  spring.add(rod);
  root.add(spring);
  for (const x of [-0.75, 0.62]) {
    const cap = mesh(new THREE.CylinderGeometry(0.12, 0.12, 0.2, 24).rotateZ(Math.PI / 2), m.black);
    cap.position.set(x, springY, -0.05);
    root.add(cap);
    for (const dx of [-0.11, 0.11]) {
      const ring = mesh(new THREE.TorusGeometry(0.12, 0.018, 8, 24).rotateY(Math.PI / 2), m.steelDark);
      ring.position.set(x + dx, springY, -0.05);
      root.add(ring);
    }
  }
  // coupling to the right steel elbow
  const coup = mesh(new THREE.CylinderGeometry(0.07, 0.07, 0.12, 16).rotateZ(Math.PI / 2), m.brass);
  coup.position.set(0.78, springY, -0.05);
  root.add(coup);

  // --- gears ---------------------------------------------------------------
  const gear = (spec: GearSpec, mat: THREE.Material, x: number, y: number, z: number): Gear => {
    const obj = new THREE.Group();
    obj.add(mesh(gearGeometry(spec), mat));
    const hub = mesh(new THREE.CylinderGeometry(pitchRadius(spec) * 0.2, pitchRadius(spec) * 0.2, spec.thickness * 1.8, 20).rotateX(Math.PI / 2), m.black);
    obj.add(hub);
    const nut = mesh(new THREE.CylinderGeometry(pitchRadius(spec) * 0.08, pitchRadius(spec) * 0.08, spec.thickness * 2.6, 6).rotateX(Math.PI / 2), m.steel);
    obj.add(nut);
    obj.position.set(x, y, z);
    root.add(obj);
    return { obj, spec };
  };
  // top train (behind the bezel top edge): steel 24, brass 16, brass 12
  const top1: GearSpec = { teeth: 24, module: 0.028, thickness: 0.05, spokes: 5 };
  const top2: GearSpec = { teeth: 16, module: 0.028, thickness: 0.05, spokes: 4 };
  const top3: GearSpec = { teeth: 12, module: 0.028, thickness: 0.05 };
  const T1 = gear(top1, m.steel, -0.38, 0.73, -0.12);
  const d12 = 0; // gear 2 sits straight right of gear 1
  const c12 = (top1.module * (top1.teeth + top2.teeth)) / 2;
  const T2 = gear(top2, m.brass, -0.38 + c12, 0.73, -0.12);
  const d23 = (20 * Math.PI) / 180;
  const c23 = (top2.module * (top2.teeth + top3.teeth)) / 2;
  const T3 = gear(top3, m.brass, T2.obj.position.x + c23 * Math.cos(d23), 0.73 + c23 * Math.sin(d23), -0.12);

  // bottom train (rusty): 18 drives 12, 9 and 12
  const b1: GearSpec = { teeth: 18, module: 0.024, thickness: 0.045, spokes: 4 };
  const b2: GearSpec = { teeth: 12, module: 0.024, thickness: 0.045 };
  const b3: GearSpec = { teeth: 9, module: 0.024, thickness: 0.045 };
  const b4: GearSpec = { teeth: 12, module: 0.024, thickness: 0.045 };
  const B1 = gear(b1, m.rusty, -0.92, -0.9, 0.11); // in front of the pipe runs
  const place = (from: Gear, spec: GearSpec, dir: number, mat: THREE.Material) => {
    const c = (spec.module * (from.spec.teeth + spec.teeth)) / 2;
    return gear(spec, mat, from.obj.position.x + c * Math.cos(dir), from.obj.position.y + c * Math.sin(dir), from.obj.position.z);
  };
  const dB2 = 0;
  const dB3 = (215 * Math.PI) / 180;
  const dB4 = (-70 * Math.PI) / 180;
  const B2 = place(B1, b2, dB2, m.rusty);
  const B3 = place(B1, b3, dB3, m.rusty);
  const B4 = place(B1, b4, dB4, m.rusty);

  // pulley on B1 and the spoked wheel it belts (hub radius 2x pulley -> half speed)
  const pulleyR = 0.055;
  const pulley = mesh(new THREE.CylinderGeometry(pulleyR, pulleyR, 0.05, 24).rotateX(Math.PI / 2), m.steelDark);
  pulley.position.z = 0.07;
  B1.obj.add(pulley);
  const wheel = new THREE.Group();
  wheel.position.set(0.8, -0.98, B1.obj.position.z + 0.07);
  const rimR = 0.25;
  wheel.add(mesh(new THREE.TorusGeometry(rimR, 0.035, 12, 48), m.steelDark));
  wheel.add(mesh(new THREE.TorusGeometry(rimR - 0.04, 0.018, 8, 48), m.rusty));
  for (let i = 0; i < 8; i++) {
    const s = mesh(new THREE.BoxGeometry(0.028, rimR - 0.04, 0.03), m.rusty);
    const a = (i / 8) * TAU;
    s.position.set(Math.cos(a) * (rimR * 0.5 + 0.03), Math.sin(a) * (rimR * 0.5 + 0.03), 0);
    s.rotation.z = a - Math.PI / 2;
    wheel.add(s);
  }
  const hubR = pulleyR * 2;
  wheel.add(mesh(new THREE.CylinderGeometry(hubR, hubR, 0.07, 24).rotateX(Math.PI / 2), m.black));
  const wheelNut = mesh(new THREE.CylinderGeometry(0.03, 0.03, 0.11, 6).rotateX(Math.PI / 2), m.red);
  wheel.add(wheelNut);
  root.add(wheel);
  // the belt: open belt around pulley (on B1) and wheel hub, drawn as a closed tube
  {
    const c1 = new THREE.Vector2(B1.obj.position.x, B1.obj.position.y);
    const c2 = new THREE.Vector2(wheel.position.x, wheel.position.y);
    const d = c2.clone().sub(c1);
    const L = d.length();
    const base = Math.atan2(d.y, d.x);
    const phi = Math.acos((hubR - pulleyR) / L);
    const pts: THREE.Vector3[] = [];
    const z = B1.obj.position.z + 0.07;
    const arc = (c: THREE.Vector2, r: number, a0: number, a1: number) => {
      for (let i = 0; i <= 24; i++) {
        const a = a0 + ((a1 - a0) * i) / 24;
        pts.push(new THREE.Vector3(c.x + r * Math.cos(a), c.y + r * Math.sin(a), z));
      }
    };
    arc(c2, hubR, base - phi, base + phi);
    arc(c1, pulleyR, base + phi, base + TAU - phi);
    const curve = new THREE.CatmullRomCurve3(pts, true, "centripetal");
    root.add(mesh(new THREE.TubeGeometry(curve, 240, 0.012, 8, true), m.rubber));
  }

  // --- pistons hanging under the screen --------------------------------------
  const manifold = mesh(new THREE.BoxGeometry(0.9, 0.09, 0.16), m.steelDark);
  manifold.position.set(0.04, -0.73, -0.02);
  root.add(manifold);
  const pistonRods: THREE.Object3D[] = [];
  [-0.22, 0.04, 0.3].forEach((x) => {
    const housing = mesh(new THREE.CylinderGeometry(0.065, 0.065, 0.16, 20), m.black);
    housing.position.set(x, -0.84, 0.02);
    root.add(housing);
    for (const y of [-0.77, -0.91]) {
      const band = mesh(new THREE.TorusGeometry(0.066, 0.012, 8, 20).rotateX(Math.PI / 2), m.brass);
      band.position.set(x, y, 0.02);
      root.add(band);
    }
    const r = new THREE.Group();
    const shaft = mesh(new THREE.CylinderGeometry(0.022, 0.022, 0.14, 12), m.steel);
    shaft.position.y = -0.07;
    const foot = mesh(new THREE.CylinderGeometry(0.045, 0.045, 0.035, 16), m.steelDark);
    foot.position.y = -0.14;
    r.add(shaft, foot);
    r.position.set(x, -0.9, 0.02);
    root.add(r);
    pistonRods.push(r);
  });

  // --- gauges ------------------------------------------------------------
  const needles: THREE.Object3D[] = [];
  const gauge = (x: number, y: number, stalkFrom: THREE.Vector3, max: number) => {
    const g = new THREE.Group();
    g.position.set(x, y, 0.04);
    const body = mesh(new THREE.CylinderGeometry(0.13, 0.13, 0.07, 32).rotateX(Math.PI / 2), m.brass);
    g.add(body);
    const bez = mesh(new THREE.TorusGeometry(0.12, 0.016, 10, 32), m.brass);
    bez.position.z = 0.037;
    g.add(bez);
    const face = mesh(new THREE.CircleGeometry(0.112, 40), MAT.dialFace(dialTexture(max)));
    face.position.z = 0.036;
    g.add(face);
    const needle = new THREE.Group();
    const n = mesh(new THREE.BoxGeometry(0.008, 0.095, 0.004), m.red);
    n.position.y = 0.035;
    const tail = mesh(new THREE.BoxGeometry(0.012, 0.03, 0.004), m.red);
    tail.position.y = -0.012;
    const pin = mesh(new THREE.CylinderGeometry(0.012, 0.012, 0.01, 12).rotateX(Math.PI / 2), m.black);
    needle.add(n, tail, pin);
    needle.position.z = 0.042;
    g.add(needle);
    needles.push(needle);
    const glass = new THREE.Mesh(new THREE.CircleGeometry(0.114, 40), m.glass);
    glass.position.z = 0.05;
    g.add(glass);
    root.add(g);
    // stalk from the pipe to the back of the gauge
    const to = new THREE.Vector3(x, y, 0.0);
    const len = stalkFrom.distanceTo(to);
    const rodS = mesh(new THREE.CylinderGeometry(0.026, 0.026, len, 12), m.steel);
    rodS.position.copy(stalkFrom.clone().lerp(to, 0.5));
    rodS.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), to.clone().sub(stalkFrom).normalize());
    root.add(rodS);
    const nutp = mesh(new THREE.CylinderGeometry(0.04, 0.04, 0.06, 6), m.brass);
    nutp.position.copy(stalkFrom.clone().lerp(to, 0.15));
    nutp.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), to.clone().sub(stalkFrom).normalize());
    root.add(nutp);
  };
  gauge(-1.66, 0.12, V(-1.36, -0.12, -0.02), 10);
  gauge(1.78, -0.16, V(1.42, -0.16, -0.02), 20);

  // --- valve hand-wheel (upper left, on the steel pipe) ----------------------
  const valve = new THREE.Group();
  valve.position.set(-1.22, 0.78, -0.05);
  valve.add(mesh(new THREE.SphereGeometry(0.1, 20, 14), m.brass));
  const stem = mesh(new THREE.CylinderGeometry(0.025, 0.025, 0.24, 12).rotateZ(Math.PI / 2), m.steel);
  stem.position.x = -0.13;
  valve.add(stem);
  const bonnet = mesh(new THREE.CylinderGeometry(0.05, 0.06, 0.08, 6).rotateZ(Math.PI / 2), m.brass);
  bonnet.position.x = -0.1;
  valve.add(bonnet);
  const hw = new THREE.Group();
  hw.position.x = -0.25;
  hw.rotation.y = -0.75; // axis turned toward the camera so the wheel reads
  const hwSpin = new THREE.Group();
  hwSpin.add(mesh(new THREE.TorusGeometry(0.13, 0.02, 10, 36).rotateY(Math.PI / 2), m.steelDark));
  for (let i = 0; i < 5; i++) {
    const a = (i / 5) * TAU;
    const sp = mesh(new THREE.CylinderGeometry(0.011, 0.011, 0.13, 8), m.steelDark);
    sp.position.set(0, Math.cos(a) * 0.065, Math.sin(a) * 0.065);
    sp.rotation.x = a;
    hwSpin.add(sp);
  }
  hwSpin.add(mesh(new THREE.CylinderGeometry(0.03, 0.03, 0.05, 12).rotateZ(Math.PI / 2), m.black));
  hw.add(hwSpin);
  valve.add(hw);
  root.add(valve);

  // a few small hex bolts on the pipes (seeded)
  const rnd = mulberry32(4242);
  for (let i = 0; i < 10; i++) {
    const b = mesh(new THREE.CylinderGeometry(0.018, 0.018, 0.03, 6).rotateX(Math.PI / 2), m.steel);
    b.position.set(-0.8 + rnd() * 1.6, rnd() < 0.5 ? 0.66 : -0.66, 0.11);
    b.rotation.z = rnd() * TAU;
    root.add(b);
  }

  // centre the machine at the origin of the view
  root.position.y = 0.02;

  // --- motion --------------------------------------------------------------
  const update = (frame: number) => {
    const f = ((frame % LOOP) + LOOP) % LOOP;
    const u = f / LOOP;
    // top train: 24 teeth per loop
    const a1 = -TAU * (24 / top1.teeth) * u;
    const a2 = meshAngle(a1, top1.teeth, top2.teeth, d12);
    const a3 = meshAngle(a2, top2.teeth, top3.teeth, d23);
    T1.obj.rotation.z = a1;
    T2.obj.rotation.z = a2;
    T3.obj.rotation.z = a3;
    // bottom train: 36 teeth per loop
    const b1a = TAU * (36 / b1.teeth) * u;
    B1.obj.rotation.z = b1a;
    B2.obj.rotation.z = meshAngle(b1a, b1.teeth, b2.teeth, dB2);
    B3.obj.rotation.z = meshAngle(b1a, b1.teeth, b3.teeth, dB3);
    B4.obj.rotation.z = meshAngle(b1a, b1.teeth, b4.teeth, dB4);
    // belt: wheel hub is twice the pulley radius -> half the angle, same direction
    wheel.rotation.z = b1a * (pulleyR / hubR);
    // pistons pump in turn (period 50 frames, a third apart)
    pistonRods.forEach((r, i) => {
      r.position.y = -0.9 - 0.045 * (0.5 + 0.5 * Math.sin((TAU * f) / 50 - (i * TAU) / 3));
    });
    // gauge needles: slow drift + twitch (periods 300, 150, 60, 20, 12, 10)
    needles.forEach((n, i) => {
      const base = i === 0 ? 0.25 : -0.1;
      const drift = 0.35 * loopSin(f, 300, i * 2.1) + 0.12 * loopSin(f, 150, 1 + i);
      const twitch = 0.04 * loopSin(f, 20, i) + 0.025 * loopSin(f, 12, 2 + i) + 0.018 * loopSin(f, 10, 0.5 * i);
      const kick = 0.09 * Math.pow(Math.max(0, loopSin(f, 60, i * 1.7)), 12);
      n.rotation.z = -(base + drift + twitch + kick) * (DIAL_SWEEP / 4.7);
    });
    // spring tube pulses: radial breathing, period 60
    const pulse = 1 + 0.06 * (0.5 + 0.5 * loopSin(f, 60));
    coilHolder.scale.set(1, pulse, pulse);
    // valve wheel rocks back and forth a little
    hwSpin.rotation.x = 0.35 * loopSin(f, 300, 0.4);
  };

  return { root, update };
};

// Studio environment for reflections: a dark room with a big softbox upper
// left, a strip light on the right and a warm low bounce. Built from
// geometry, so it is identical on every render.
const studio = () => {
  const scene = new THREE.Scene();
  const room = new THREE.Mesh(
    new THREE.SphereGeometry(20, 32, 16),
    new THREE.MeshBasicMaterial({ color: new THREE.Color(0.035, 0.034, 0.033), side: THREE.BackSide }),
  );
  scene.add(room);
  const panel = (w: number, h: number, c: [number, number, number], pos: [number, number, number]) => {
    const p = new THREE.Mesh(new THREE.PlaneGeometry(w, h), new THREE.MeshBasicMaterial({ color: new THREE.Color(...c), side: THREE.DoubleSide }));
    p.position.set(...pos);
    p.lookAt(0, 0, 0);
    scene.add(p);
  };
  panel(12, 8, [5, 4.9, 4.7], [-9, 9, 10]);
  panel(3, 14, [2.4, 2.4, 2.5], [14, 1, 3]);
  panel(16, 3, [0.5, 0.36, 0.25], [0, -12, 6]);
  panel(6, 6, [1.2, 1.15, 1.1], [4, 10, -12]);
  return scene;
};

export const setupEnvironment = (gl: THREE.WebGLRenderer, scene: THREE.Scene) => {
  const pmrem = new THREE.PMREMGenerator(gl);
  const env = pmrem.fromScene(studio(), 0.02).texture;
  scene.environment = env;
  scene.environmentIntensity = 1.0;
  pmrem.dispose();
};
