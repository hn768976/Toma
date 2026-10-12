import * as THREE from "three";
import { RoundedBoxGeometry } from "three/examples/jsm/geometries/RoundedBoxGeometry.js";
import {
  latheRing,
  mergeSimple,
  ProfileSegment,
  raisedPlate,
  roundedRectCap,
  roundedRectOutline,
  sweepProfile,
} from "./geometry";

/**
 * A generic slab phone, built entirely in code.
 * 1 scene unit = 100 mm. The phone is centred on the origin, screen facing +z.
 */
export const PHONE = {
  W: 0.715, // 71.5 mm
  H: 1.5, // 150 mm
  D: 0.078, // 7.8 mm
  R: 0.09, // 9 mm corner radius
  chamfer: 0.006, // 0.6 mm
  lip: 0.011, // metal lip seen from the front
  bezel: 0.016, // 1.6 mm black bezel
  punchR: 0.015, // 3 mm punch hole
  punchFromTop: 0.05, // 5 mm from the top edge
} as const;

export type PartRole = "body" | "screen";

export type PhonePart = {
  name: string;
  geometry: THREE.BufferGeometry;
  material: THREE.Material;
  /** "screen" parts are chroma green: masked out and composited after post. */
  role: PartRole;
};

export type PhoneOptions = {
  /** satin-aluminium frame colour (sRGB hex) */
  frameColor: string;
};

export const DEFAULT_FRAME_COLOR = "#3A3E46";

export const buildPhoneParts = ({ frameColor }: PhoneOptions): PhonePart[] => {
  const { W, H, D, R, chamfer: c, lip, bezel } = PHONE;
  const h = D / 2;
  const outline = roundedRectOutline(W, H, R, 32);
  const parts: PhonePart[] = [];

  const frameCol = new THREE.Color(frameColor);

  // ---------- materials ----------
  // A metal's base colour is its reflectance. Used as-is, a dark swatch like
  // graphite reflects ~4 % of the studio and renders near-black; keep its hue
  // and saturation but give it real aluminium reflectance, so the frame reads as
  // the swatch colour under the studio and its edges glint.
  const metalCol = (lightness: number) => {
    const hsl = { h: 0, s: 0, l: 0 };
    frameCol.getHSL(hsl);
    return new THREE.Color().setHSL(hsl.h, hsl.s, Math.max(hsl.l, lightness));
  };
  const satin = new THREE.MeshPhysicalMaterial({
    color: metalCol(0.42),
    metalness: 1,
    roughness: 0.3,
  });
  const polished = new THREE.MeshPhysicalMaterial({
    color: metalCol(0.68),
    metalness: 1,
    roughness: 0.14,
  });
  const frontGlass = new THREE.MeshPhysicalMaterial({
    color: new THREE.Color("#030304"),
    metalness: 0,
    roughness: 0.12,
    clearcoat: 1,
    clearcoatRoughness: 0.04,
    polygonOffset: true,
    polygonOffsetFactor: 1,
    polygonOffsetUnits: 1,
  });
  // The screen is drawn black in the beauty pass and replaced by #00FF00
  // through the mask after all post-processing.
  const screen = new THREE.MeshBasicMaterial({ color: 0x000000 });
  const punch = new THREE.MeshPhysicalMaterial({
    color: new THREE.Color("#000000"),
    roughness: 0.2,
    clearcoat: 1,
    clearcoatRoughness: 0.05,
  });
  const backGlass = new THREE.MeshPhysicalMaterial({
    color: frameCol.clone().offsetHSL(0, 0, 0.02),
    metalness: 0.1,
    roughness: 0.4,
    clearcoat: 0.6,
    clearcoatRoughness: 0.32,
  });
  const stripMat = new THREE.MeshPhysicalMaterial({
    color: frameCol.clone().offsetHSL(0, 0, -0.03),
    metalness: 0.2,
    roughness: 0.2,
    clearcoat: 1,
    clearcoatRoughness: 0.08,
  });
  const punchRimMat = new THREE.MeshStandardMaterial({
    color: new THREE.Color("#1b1c20"),
    metalness: 0.5,
    roughness: 0.35,
  });
  const bandMat = new THREE.MeshStandardMaterial({
    color: new THREE.Color("#1d1f24"),
    roughness: 0.6,
    side: THREE.DoubleSide,
  });
  const lensRing = new THREE.MeshPhysicalMaterial({
    color: metalCol(0.45),
    metalness: 1,
    roughness: 0.22,
    side: THREE.DoubleSide,
  });
  const lensGlass = new THREE.MeshPhysicalMaterial({
    color: new THREE.Color("#05070b"),
    roughness: 0.08,
    clearcoat: 1,
    clearcoatRoughness: 0.02,
  });
  const lensCoating = new THREE.MeshPhysicalMaterial({
    color: new THREE.Color("#262b3a"),
    metalness: 0.9,
    roughness: 0.2,
    clearcoat: 1,
    clearcoatRoughness: 0.05,
  });
  const lensPupil = new THREE.MeshPhysicalMaterial({
    color: new THREE.Color("#0a0c18"),
    metalness: 0.3,
    roughness: 0.05,
    clearcoat: 1,
    clearcoatRoughness: 0.02,
    iridescence: 0.6,
  });
  const flash = new THREE.MeshPhysicalMaterial({
    color: new THREE.Color("#d9d4c4"),
    roughness: 0.45,
    clearcoat: 0.5,
  });
  const port = new THREE.MeshStandardMaterial({
    color: new THREE.Color("#060607"),
    roughness: 0.7,
    side: THREE.DoubleSide,
  });

  // ---------- frame: flat sides, chamfered edges, thin lips ----------
  const side: ProfileSegment[] = [
    { a: [0, -h + c], b: [0, h - c], na: [1, 0], nb: [1, 0] },
  ];
  const chamfers: ProfileSegment[] = [
    { a: [-c, -h], b: [0, -h + c], na: [1, -1], nb: [1, -1] },
    { a: [0, h - c], b: [-c, h], na: [1, 1], nb: [1, 1] },
  ];
  const lips: ProfileSegment[] = [
    { a: [-lip - 0.004, -h], b: [-c, -h], na: [0, -1], nb: [0, -1] },
    { a: [-c, h], b: [-lip - 0.001, h], na: [0, 1], nb: [0, 1] },
  ];
  parts.push({ name: "frameSide", geometry: sweepProfile(outline, side), material: satin, role: "body" });
  parts.push({ name: "frameChamfer", geometry: sweepProfile(outline, chamfers), material: polished, role: "body" });
  parts.push({ name: "frameLip", geometry: sweepProfile(outline, lips), material: satin, role: "body" });

  // ---------- front: black glass, screen, punch hole ----------
  const gW = W - 2 * lip;
  const gH = H - 2 * lip;
  const gR = R - lip;
  const glass = roundedRectCap(gW, gH, gR);
  glass.translate(0, 0, h - 0.0004);
  parts.push({ name: "frontGlass", geometry: glass, material: frontGlass, role: "body" });

  const sW = gW - 2 * bezel;
  const sH = gH - 2 * bezel;
  const sR = gR - bezel;
  const scr = roundedRectCap(sW, sH, sR);
  scr.translate(0, 0, h - 0.0001);
  parts.push({ name: "screen", geometry: scr, material: screen, role: "screen" });

  const ph = new THREE.CircleGeometry(PHONE.punchR, 48);
  ph.translate(0, H / 2 - PHONE.punchFromTop, h + 0.0003);
  parts.push({ name: "punchHole", geometry: ph, material: punch, role: "body" });
  const phRim = new THREE.RingGeometry(PHONE.punchR, PHONE.punchR + 0.0022, 48);
  phRim.translate(0, H / 2 - PHONE.punchFromTop, h + 0.0003);
  parts.push({ name: "punchRim", geometry: phRim, material: punchRimMat, role: "body" });
  const phLens = new THREE.CircleGeometry(0.0055, 24);
  phLens.translate(0, H / 2 - PHONE.punchFromTop, h + 0.0004);
  parts.push({ name: "punchLens", geometry: phLens, material: lensPupil, role: "body" });

  // ---------- back: frosted glass + two-lens vertical camera strip ----------
  // Built in "back space" (+z points out of the back), then turned around.
  const toBack = new THREE.Matrix4()
    .makeTranslation(0, 0, -h)
    .multiply(new THREE.Matrix4().makeRotationY(Math.PI));
  const back = (g: THREE.BufferGeometry) => g.applyMatrix4(toBack);

  const bg = roundedRectCap(W - 2 * (lip + 0.004) + 0.002, H - 2 * (lip + 0.004) + 0.002, R - lip - 0.003);
  bg.translate(0, 0, 0.0004);
  parts.push({ name: "backGlass", geometry: back(bg), material: backGlass, role: "body" });

  // A raised rounded-rectangle strip (not a pill) holding, top to bottom:
  // lens, lens, flash. Seen from behind, top-left = (-x, +y) in back space.
  const stripW = 0.15;
  const stripH = 0.43;
  const stripTop = 0.02;
  const sx = -(W / 2 - 0.11);
  const sy = H / 2 - 0.085 - stripH / 2;
  const plate = raisedPlate(stripW, stripH, 0.042, stripTop, 0.005);
  plate.translate(sx, sy, 0.0004);
  parts.push({ name: "cameraStrip", geometry: back(plate), material: stripMat, role: "body" });

  const lensTop = stripTop + 0.0004;
  const lensYs = [sy + 0.125, sy + 0.0];
  const rings: THREE.BufferGeometry[] = [];
  const glasses: THREE.BufferGeometry[] = [];
  const coatings: THREE.BufferGeometry[] = [];
  const pupils: THREE.BufferGeometry[] = [];
  for (const ly of lensYs) {
    const ring = latheRing([
      [0.04, lensTop + 0.0005],
      [0.0415, lensTop + 0.007],
      [0.047, lensTop + 0.0082],
      [0.0525, lensTop + 0.0068],
      [0.054, lensTop],
    ]);
    ring.translate(sx, ly, 0);
    rings.push(ring);
    const lg = new THREE.CircleGeometry(0.0405, 48);
    lg.translate(sx, ly, lensTop + 0.0035);
    glasses.push(lg);
    // inner optics: a coated ring and a glossy pupil, seen through the cover glass
    const co = new THREE.RingGeometry(0.019, 0.031, 48);
    co.translate(sx, ly, lensTop + 0.0038);
    coatings.push(co);
    const pu = new THREE.CircleGeometry(0.0125, 32);
    pu.translate(sx, ly, lensTop + 0.004);
    pupils.push(pu);
  }
  parts.push({ name: "lensRings", geometry: back(mergeSimple(rings)), material: lensRing, role: "body" });
  parts.push({ name: "lensGlass", geometry: back(mergeSimple(glasses)), material: lensGlass, role: "body" });
  parts.push({ name: "lensCoating", geometry: back(mergeSimple(coatings)), material: lensCoating, role: "body" });
  parts.push({ name: "lensPupil", geometry: back(mergeSimple(pupils)), material: lensPupil, role: "body" });

  // flash, inside the strip below the lenses, with a thin metal surround
  const fy = sy - 0.13;
  const flRing = latheRing([
    [0.0165, lensTop],
    [0.0175, lensTop + 0.002],
    [0.0215, lensTop + 0.002],
    [0.0225, lensTop],
  ], 40);
  flRing.translate(sx, fy, 0);
  parts.push({ name: "flashRing", geometry: back(flRing), material: lensRing, role: "body" });
  const fl = new THREE.CircleGeometry(0.017, 40);
  fl.translate(sx, fy, lensTop + 0.0012);
  parts.push({ name: "flash", geometry: back(fl), material: flash, role: "body" });

  // ---------- buttons: power right, two volume left ----------
  const btn = (x: number, y: number, len: number) => {
    const g = new RoundedBoxGeometry(0.016, len, 0.032, 4, 0.0055);
    g.translate(x, y, 0);
    return g;
  };
  parts.push({
    name: "buttons",
    geometry: mergeSimple([
      btn(W / 2 - 0.001, 0.27, 0.17), // power, right
      btn(-W / 2 + 0.001, 0.42, 0.12), // volume up, left
      btn(-W / 2 + 0.001, 0.26, 0.12), // volume down, left
    ]),
    material: satin,
    role: "body",
  });

  // ---------- antenna bands: thin plastic breaks across the frame ----------
  const bands: THREE.BufferGeometry[] = [];
  const bandDepth = D - 2 * c - 0.002;
  for (const sxn of [-1, 1]) {
    for (const by of [H / 2 - 0.14, -H / 2 + 0.14]) {
      const g = new THREE.PlaneGeometry(bandDepth, 0.005);
      g.rotateY((sxn * Math.PI) / 2);
      g.translate(sxn * (W / 2 + 0.0003), by, 0);
      bands.push(g);
    }
  }
  for (const syn of [-1, 1]) {
    for (const bx of [-W / 2 + 0.13, W / 2 - 0.13]) {
      const g = new THREE.PlaneGeometry(0.005, bandDepth);
      g.rotateX((-syn * Math.PI) / 2);
      g.translate(bx, syn * (H / 2 + 0.0003), 0);
      bands.push(g);
    }
  }
  // top edge microphone hole
  const mic = new THREE.CircleGeometry(0.004, 16);
  mic.rotateX(-Math.PI / 2);
  mic.translate(0.12, H / 2 + 0.0003, 0);
  bands.push(mic);
  parts.push({
    name: "antennaBands",
    geometry: mergeSimple(bands.map((g) => (g.deleteAttribute("uv"), g))),
    material: bandMat,
    role: "body",
  });

  // ---------- earpiece slit in the top bezel ----------
  const ear = roundedRectCap(0.085, 0.0035, 0.00175, 6);
  ear.translate(0, gH / 2 - 0.0075, h + 0.0001);
  parts.push({ name: "earpiece", geometry: ear, material: port, role: "body" });

  // ---------- bottom edge: port and speaker holes ----------
  const bottom: THREE.BufferGeometry[] = [];
  const portG = roundedRectCap(0.09, 0.03, 0.015, 8);
  bottom.push(portG);
  for (const side of [-1, 1]) {
    for (let i = 0; i < 5; i++) {
      const hole = new THREE.CircleGeometry(0.0055, 16);
      hole.translate(side * (0.1 + i * 0.022), 0, 0);
      bottom.push(hole);
    }
  }
  const bottomG = mergeSimple(bottom.map((g) => (g.deleteAttribute("uv"), g)));
  // lay the decal onto the bottom flat side (normal -y)
  bottomG.applyMatrix4(
    new THREE.Matrix4()
      .makeTranslation(0, -H / 2 - 0.0003, 0)
      .multiply(new THREE.Matrix4().makeRotationX(Math.PI / 2)),
  );
  parts.push({ name: "bottomPorts", geometry: bottomG, material: port, role: "body" });

  return parts;
};

/** A single phone as a THREE.Group of meshes (one per part). */
export const buildPhoneGroup = (parts: PhonePart[]): THREE.Group => {
  const g = new THREE.Group();
  for (const p of parts) {
    const m = new THREE.Mesh(p.geometry, p.material);
    m.name = p.name;
    m.userData.role = p.role;
    g.add(m);
  }
  return g;
};

/** The phone's 8 bounding-box corners in phone-local space. */
export const phoneCorners = (): THREE.Vector3[] => {
  const { W, H, D } = PHONE;
  const out: THREE.Vector3[] = [];
  for (const x of [-W / 2, W / 2])
    for (const y of [-H / 2, H / 2])
      for (const z of [-D / 2, D / 2]) out.push(new THREE.Vector3(x, y, z));
  return out;
};
