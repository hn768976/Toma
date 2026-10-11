import * as THREE from "three";

/** Generic three-blade wind turbine, built from code (no external model). */

const BLADE_SECTIONS = 8;
const AIRFOIL_PTS = 14;

/** symmetric NACA-style thickness (x in 0..1 of chord) */
const naca = (x: number, t: number) =>
  5 * t * (0.2969 * Math.sqrt(x) - 0.126 * x - 0.3516 * x * x + 0.2843 * x ** 3 - 0.1036 * x ** 4);

/** blade along +y from the hub, lofted through BLADE_SECTIONS airfoil sections with twist and taper */
export const bladeGeometry = (length: number) => {
  const r0 = 0.05 * length;
  const sections: THREE.Vector3[][] = [];
  for (let s = 0; s < BLADE_SECTIONS; s++) {
    const u = s / (BLADE_SECTIONS - 1);
    const r = r0 + (length - r0) * u;
    // chord: round root, widest at ~20 %, tapering to the tip
    const chord = length * (u < 0.2 ? 0.05 + 0.25 * (u / 0.2) * 0.42 : 0.155 - 0.12 * ((u - 0.2) / 0.8) ** 0.9) * 0.68;
    const thick = u < 0.12 ? 0.9 - u * 4 : 0.16 - 0.06 * u; // root is nearly circular
    const twist = THREE.MathUtils.degToRad(16 * (1 - u) ** 1.5);
    const ring: THREE.Vector3[] = [];
    for (let i = 0; i < AIRFOIL_PTS; i++) {
      // walk upper surface LE->TE then lower TE->LE
      const k = i / AIRFOIL_PTS;
      const up = k < 0.5;
      const x = up ? 1 - Math.cos(Math.PI * (k * 2)) : 1 - Math.cos(Math.PI * (2 - k * 2));
      const xc = x / 2;
      const y = naca(Math.max(xc, 1e-4), thick) * (up ? 1 : -1);
      // chord along x, thickness along z; pitch axis at 30 % chord
      const cx = (xc - 0.3) * chord, cz = y * chord;
      const tx = cx * Math.cos(twist) - cz * Math.sin(twist);
      const tz = cx * Math.sin(twist) + cz * Math.cos(twist);
      ring.push(new THREE.Vector3(tx, r, tz));
    }
    sections.push(ring);
  }
  const pos: number[] = [];
  const idx: number[] = [];
  sections.forEach((ring) => ring.forEach((p) => pos.push(p.x, p.y, p.z)));
  for (let s = 0; s < BLADE_SECTIONS - 1; s++) {
    for (let i = 0; i < AIRFOIL_PTS; i++) {
      const a = s * AIRFOIL_PTS + i, b = s * AIRFOIL_PTS + ((i + 1) % AIRFOIL_PTS);
      const c = a + AIRFOIL_PTS, d = b + AIRFOIL_PTS;
      idx.push(a, c, b, b, c, d);
    }
  }
  // tip cap
  const tip = pos.length / 3;
  pos.push(0, length + 0.01 * length, 0);
  const last = (BLADE_SECTIONS - 1) * AIRFOIL_PTS;
  for (let i = 0; i < AIRFOIL_PTS; i++) idx.push(last + i, tip, last + ((i + 1) % AIRFOIL_PTS));
  const g = new THREE.BufferGeometry();
  g.setAttribute("position", new THREE.Float32BufferAttribute(pos, 3));
  g.setIndex(idx);
  g.computeVertexNormals();
  return g;
};

export interface Turbine {
  group: THREE.Group;
  rotor: THREE.Group;
}

export const buildTurbine = (height: number, material: THREE.Material): Turbine => {
  const group = new THREE.Group();
  // tapered tubular tower
  const towerProfile = [
    new THREE.Vector2(0.0, 0),
    new THREE.Vector2(0.022 * height, 0),
    new THREE.Vector2(0.012 * height, height),
    new THREE.Vector2(0.0, height),
  ];
  const tower = new THREE.Mesh(new THREE.LatheGeometry(towerProfile, 20), material);
  group.add(tower);

  const head = new THREE.Group();
  head.position.y = height;
  group.add(head);
  // rounded nacelle along z (rotor points to +z)
  const nr = 0.026 * height;
  const nacelle = new THREE.Mesh(new THREE.CapsuleGeometry(nr, 0.075 * height, 6, 16), material);
  nacelle.rotation.x = Math.PI / 2;
  nacelle.position.set(0, nr * 0.6, -0.01 * height);
  head.add(nacelle);

  const rotor = new THREE.Group();
  rotor.position.set(0, nr * 0.6, 0.065 * height);
  head.add(rotor);
  // spinner: ogive lathe pointing +z
  const sp: THREE.Vector2[] = [];
  for (let i = 0; i <= 10; i++) {
    const u = i / 10;
    sp.push(new THREE.Vector2(nr * 1.05 * Math.sqrt(1 - u * u * 0.98), u * nr * 1.9));
  }
  sp.push(new THREE.Vector2(0, nr * 1.9));
  sp.unshift(new THREE.Vector2(0, 0));
  const spinner = new THREE.Mesh(new THREE.LatheGeometry(sp, 18), material);
  spinner.rotation.x = Math.PI / 2;
  rotor.add(spinner);
  const blade = bladeGeometry(0.5 * height);
  for (let k = 0; k < 3; k++) {
    const b = new THREE.Mesh(blade, material);
    b.rotation.z = (k * Math.PI * 2) / 3;
    b.position.z = nr * 0.5;
    rotor.add(b);
  }
  return { group, rotor };
};
