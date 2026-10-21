import {
  BoxGeometry,
  BufferGeometry,
  CircleGeometry,
  Color,
  CylinderGeometry,
  ExtrudeGeometry,
  Material,
  MeshBasicMaterial,
  MeshPhysicalMaterial,
  MeshStandardMaterial,
  Shape,
  ShapeGeometry,
} from "three";

// Original, generic phone. Units: phone height = 1.6.
export const PHONE = {
  H: 1.6,
  W: (1.6 * 9) / 19.5,
  D: 0.074,
  R: 0.124, // body corner radius
  chamfer: 0.0055,
  bezel: 0.021,
};

export const SCREEN_GREEN = new Color(0x00ff00);

export const roundedRect = (w: number, h: number, r: number) => {
  const s = new Shape();
  const x = -w / 2;
  const y = -h / 2;
  s.moveTo(x + r, y);
  s.lineTo(x + w - r, y);
  s.absarc(x + w - r, y + r, r, -Math.PI / 2, 0, false);
  s.lineTo(x + w, y + h - r);
  s.absarc(x + w - r, y + h - r, r, 0, Math.PI / 2, false);
  s.lineTo(x + r, y + h);
  s.absarc(x + r, y + h - r, r, Math.PI / 2, Math.PI, false);
  s.lineTo(x, y + r);
  s.absarc(x + r, y + r, r, Math.PI, Math.PI * 1.5, false);
  return s;
};

export type PhonePart = {
  geometry: BufferGeometry;
  material: Material;
  position: [number, number, number];
  rotation?: [number, number, number];
  renderOrder?: number;
};

const build = (): PhonePart[] => {
  const { H, W, D, R, chamfer: c, bezel } = PHONE;
  const curve = 28;

  // ---- materials ----
  const frame = new MeshStandardMaterial({ color: "#2A2C30", metalness: 0.9, roughness: 0.3 });
  const frontGlass = new MeshStandardMaterial({ color: "#050506", metalness: 0, roughness: 0.18 });
  // The screen: flat, unlit, never tone-mapped, never fogged. Pure #00FF00.
  const screen = new MeshBasicMaterial({ color: SCREEN_GREEN, toneMapped: false, fog: false });
  const punch = new MeshBasicMaterial({ color: "#000000", toneMapped: false, fog: false });
  const backGlass = new MeshPhysicalMaterial({
    color: "#1E2024",
    metalness: 0,
    roughness: 0.62,
    clearcoat: 0.18,
    clearcoatRoughness: 0.55,
  });
  const stripMat = new MeshStandardMaterial({ color: "#2A2D33", metalness: 0.55, roughness: 0.38 });
  const lensGlass = new MeshStandardMaterial({ color: "#040506", metalness: 0.2, roughness: 0.06 });
  const lensInner = new MeshStandardMaterial({ color: "#0D1220", metalness: 0.1, roughness: 0.04 });
  const flash = new MeshStandardMaterial({ color: "#D6D0BF", metalness: 0, roughness: 0.5 });

  // ---- body: rounded slab with flat sides and a small chamfer ----
  const bodyDepth = D - 2 * c;
  const body = new ExtrudeGeometry(roundedRect(W - 2 * c, H - 2 * c, R - c), {
    depth: bodyDepth,
    bevelEnabled: true,
    bevelThickness: c,
    bevelSize: c,
    bevelSegments: 1, // a single segment = a chamfer, not a round-over
    curveSegments: curve,
  });
  body.translate(0, 0, -bodyDepth / 2);

  const zFront = D / 2;
  const zBack = -D / 2;
  const eps = 0.0007;

  // ---- front: black glass plate, inset green screen, round punch-hole ----
  const plateW = W - 2 * c;
  const plateH = H - 2 * c;
  const plateR = R - c;
  const plate = new ShapeGeometry(roundedRect(plateW, plateH, plateR), curve);
  const screenGeo = new ShapeGeometry(
    roundedRect(plateW - 2 * bezel, plateH - 2 * bezel, plateR - bezel),
    curve,
  );
  const punchR = 0.0175;
  const punchGeo = new CircleGeometry(punchR, 32);
  const punchY = plateH / 2 - bezel - 0.052;

  // ---- back: matte dark glass + vertical camera strip (top-left seen from behind) ----
  const backPlate = new ShapeGeometry(roundedRect(plateW, plateH, plateR), curve);
  const stripW = 0.128;
  const stripH = 0.34;
  const stripDepth = 0.011;
  const strip = new ExtrudeGeometry(roundedRect(stripW, stripH, stripW / 2 - 0.004), {
    depth: stripDepth - 0.004,
    bevelEnabled: true,
    bevelThickness: 0.002,
    bevelSize: 0.002,
    bevelSegments: 2,
    curveSegments: curve,
  });
  // Seen from the back, "left" is +x in the phone's local space.
  const stripX = W / 2 - 0.05 - stripW / 2;
  const stripY = H / 2 - 0.05 - stripH / 2;
  const stripZ = zBack - eps - stripDepth + 0.002;

  const lensRing = new CylinderGeometry(0.041, 0.043, 0.008, 48);
  lensRing.rotateX(Math.PI / 2);
  const lensDisc = new CircleGeometry(0.033, 48);
  const lensCore = new CircleGeometry(0.013, 32);
  const flashDisc = new CircleGeometry(0.012, 24);
  const stripBack = stripZ - 0.002; // outer surface of the strip (faces -z)
  const lensYs = [stripY + 0.095, stripY - 0.0];
  const flashY = stripY - 0.098;

  const faceBack: [number, number, number] = [0, Math.PI, 0];

  const parts: PhonePart[] = [
    { geometry: body, material: frame, position: [0, 0, 0] },
    { geometry: plate, material: frontGlass, position: [0, 0, zFront + eps] },
    { geometry: screenGeo, material: screen, position: [0, 0, zFront + 2 * eps] },
    { geometry: punchGeo, material: punch, position: [0, punchY, zFront + 3 * eps] },
    { geometry: backPlate, material: backGlass, position: [0, 0, zBack - eps], rotation: faceBack },
    { geometry: strip, material: stripMat, position: [stripX, stripY, stripZ] },
  ];
  for (const ly of lensYs) {
    parts.push({ geometry: lensRing, material: frame, position: [stripX, ly, stripBack - 0.003] });
    parts.push({ geometry: lensDisc, material: lensGlass, position: [stripX, ly, stripBack - 0.0072], rotation: faceBack });
    parts.push({ geometry: lensCore, material: lensInner, position: [stripX, ly, stripBack - 0.0075], rotation: faceBack });
  }
  parts.push({ geometry: flashDisc, material: flash, position: [stripX, flashY, stripBack - 0.0004], rotation: faceBack });

  // ---- side buttons: right edge only (+x seen from the front) ----
  const rocker = new BoxGeometry(0.01, 0.2, 0.026);
  const power = new BoxGeometry(0.01, 0.11, 0.026);
  parts.push({ geometry: rocker, material: frame, position: [W / 2 + 0.003, 0.36, 0] });
  parts.push({ geometry: power, material: frame, position: [W / 2 + 0.003, 0.06, 0] });

  return parts;
};

let cached: PhonePart[] | null = null;
export const getPhoneParts = (): PhonePart[] => {
  if (!cached) {
    cached = build();
  }
  return cached;
};

export const ENV_MATERIALS = (): MeshStandardMaterial[] =>
  getPhoneParts()
    .map((p) => p.material)
    .filter((m): m is MeshStandardMaterial => m instanceof MeshStandardMaterial);
