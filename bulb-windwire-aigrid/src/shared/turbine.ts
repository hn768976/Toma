import { BoxGeometry, BufferGeometry, ConeGeometry, CylinderGeometry, EdgesGeometry, Matrix4, Vector3 } from "three";
import { SegList } from "../engine/lines";

// The shared three-blade turbine: tapered tower, nacelle, spinner and three
// lofted, twisted blades. Built once as line segments in two parts:
//   tower — in turbine space (origin at the tower foot, rotor facing +Z),
//   rotor — in hub space (origin at the hub, spinning about local +Z).
// Units: hub height 10, rotor radius 6.

export const TURBINE = {
  hubHeight: 10,
  rotorRadius: 6,
  /** Hub position in turbine space. */
  hub: new Vector3(0, 10, 0.75),
};

const edgesToSegs = (geom: BufferGeometry, m: Matrix4, out: SegList, intensity = 1, thresholdDeg = 20) => {
  const e = new EdgesGeometry(geom, thresholdDeg);
  e.applyMatrix4(m);
  const p = e.attributes.position.array as Float32Array;
  for (let i = 0; i < p.length; i += 6) out.add([p[i], p[i + 1], p[i + 2]], [p[i + 3], p[i + 4], p[i + 5]], intensity);
  e.dispose();
  geom.dispose();
};

const ring = (out: SegList, center: Vector3, radius: number, axis: "y" | "z", n: number, intensity = 1) => {
  for (let i = 0; i < n; i++) {
    const a0 = (i / n) * Math.PI * 2,
      a1 = ((i + 1) / n) * Math.PI * 2;
    const p = (a: number) =>
      axis === "y"
        ? [center.x + Math.cos(a) * radius, center.y, center.z + Math.sin(a) * radius]
        : [center.x + Math.cos(a) * radius, center.y + Math.sin(a) * radius, center.z];
    out.add(p(a0), p(a1), intensity);
  }
};

/** Chord (fraction of rotor radius units) along span r in [0,1]. */
const chordAt = (s: number) => {
  if (s < 0.12) return 0.32 + (s / 0.12) * 0.42;
  return 0.74 * (1 - (s - 0.12) / 0.88) + 0.1 * ((s - 0.12) / 0.88);
};

export type TurbineDetail = "full" | "light";

export const buildTurbine = (detail: TurbineDetail = "full") => {
  const tower = new SegList();
  const rotor = new SegList();
  const H = TURBINE.hubHeight;
  const sides = detail === "full" ? 8 : 6;

  // Tower: tapered cylinder, edges + a few profile rings.
  const towerH = H - 0.35;
  edgesToSegs(new CylinderGeometry(0.22, 0.42, towerH, sides, 1, true), new Matrix4().makeTranslation(0, towerH / 2, 0), tower, 1, 1);
  for (const f of detail === "full" ? [0.18, 0.4, 0.62, 0.84] : [0.33, 0.66]) {
    const r = 0.42 + (0.22 - 0.42) * f;
    ring(tower, new Vector3(0, towerH * f, 0), r, "y", sides, 0.55);
  }
  // Foundation pad.
  ring(tower, new Vector3(0, 0.02, 0), 1.25, "y", 32, 1.6);
  ring(tower, new Vector3(0, 0.02, 0), 0.75, "y", 24, 0.9);

  // Nacelle: a box with a tapered tail, sitting on the tower top.
  const nac = new BoxGeometry(0.75, 0.72, 2.3);
  edgesToSegs(nac, new Matrix4().makeTranslation(0, H, -0.55), tower, 1);
  edgesToSegs(new CylinderGeometry(0.36, 0.36, 0.3, 10, 1, true), new Matrix4().makeTranslation(0, H - 0.5, 0), tower, 0.8, 1);

  // Rotor (hub space). Spinner cone pointing +Z and the bright hub ring.
  const spin = new ConeGeometry(0.4, 0.75, 10, 1, true);
  edgesToSegs(spin, new Matrix4().makeRotationX(Math.PI / 2).premultiply(new Matrix4().makeTranslation(0, 0, 0.35)), rotor, 1.1, 1);
  ring(rotor, new Vector3(0, 0, -0.02), 0.44, "z", 28, 2.4);
  ring(rotor, new Vector3(0, 0, 0.1), 0.3, "z", 20, 1.4);

  // Blades: lofted cross-sections with twist; leading/trailing edges, a
  // mid-chord line on each face, and profile outlines at a few stations.
  const R = TURBINE.rotorRadius;
  const stations = detail === "full" ? 14 : 9;
  const prof = detail === "full" ? 10 : 6;
  for (let b = 0; b < 3; b++) {
    const rot = new Matrix4().makeRotationZ((b / 3) * Math.PI * 2);
    const sec: Vector3[][] = [];
    for (let k = 0; k <= stations; k++) {
      const s = k / stations;
      const r = 0.42 + s * (R - 0.42);
      const c = chordAt(s) * (1 - 0.15 * s);
      const t = c * (0.22 - 0.14 * s);
      const twist = (18 - 16 * s) * (Math.PI / 180);
      const pts: Vector3[] = [];
      for (let j = 0; j < prof; j++) {
        const a = (j / prof) * Math.PI * 2;
        // Asymmetric ellipse ~ airfoil: blunt leading edge (+x), sharp trailing edge.
        const x = Math.cos(a) * c * 0.5 + c * 0.15;
        const y = Math.sin(a) * t * 0.5 * (Math.cos(a) > 0 ? 1 : 1 - 0.7 * Math.abs(Math.cos(a)));
        const px = x * Math.cos(twist);
        const pz = x * Math.sin(twist) + y;
        pts.push(new Vector3(px, r, pz).applyMatrix4(rot));
      }
      sec.push(pts);
    }
    const lead = 0,
      trail = Math.floor(prof / 2),
      top = Math.floor(prof / 4),
      bot = Math.floor((3 * prof) / 4);
    for (let k = 0; k < stations; k++) {
      rotor.add(sec[k][lead].toArray(), sec[k + 1][lead].toArray(), 1.1);
      rotor.add(sec[k][trail].toArray(), sec[k + 1][trail].toArray(), 1.1);
      rotor.add(sec[k][top].toArray(), sec[k + 1][top].toArray(), 0.45);
      rotor.add(sec[k][bot].toArray(), sec[k + 1][bot].toArray(), 0.45);
    }
    // Tip closure.
    rotor.add(sec[stations][lead].toArray(), sec[stations][trail].toArray(), 0.9);
    // Profile outlines at root and a few spans.
    const outlineAt = detail === "full" ? [0, 2, 5, 9] : [0, 3];
    for (const k of outlineAt) {
      const pts = sec[k];
      for (let j = 0; j < prof; j++) rotor.add(pts[j].toArray(), pts[(j + 1) % prof].toArray(), 0.6);
    }
  }
  return { tower, rotor };
};
