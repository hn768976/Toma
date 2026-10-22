import * as THREE from "three";
import { mergeGeometries } from "three/examples/jsm/utils/BufferGeometryUtils.js";

// All pieces share one unit system: the king is 2.4 units tall and a board
// square is 0.66 units wide.

export type PieceType = "king" | "queen" | "bishop" | "knight" | "rook" | "pawn";

type Profile = [number, number][];

const lathe = (profile: Profile, segments = 96, samples = 220) => {
  // Centripetal Catmull-Rom keeps the turned profile smooth without the
  // overshoot a uniform spline would put into tight rims.
  const curve = new THREE.CatmullRomCurve3(
    profile.map(([r, y]) => new THREE.Vector3(r, y, 0)),
    false,
    "centripetal",
  );
  const pts = curve
    .getPoints(samples)
    .map((p) => new THREE.Vector2(Math.max(0, p.x), p.y));
  return new THREE.LatheGeometry(pts, segments).toNonIndexed();
};

const prep = (g: THREE.BufferGeometry, m?: THREE.Matrix4) => {
  const out = g.index ? g.toNonIndexed() : g;
  if (m) out.applyMatrix4(m);
  // Strip everything but position/normal/uv so geometries can be merged.
  for (const key of Object.keys(out.attributes)) {
    if (key !== "position" && key !== "normal" && key !== "uv") out.deleteAttribute(key);
  }
  return out;
};

// Shared foot used by every piece: a wide base, a rim, and a collar.
const foot = (s: number): Profile => [
  [0, 0],
  [0.5 * s, 0],
  [0.53 * s, 0.02],
  [0.535 * s, 0.07],
  [0.5 * s, 0.11],
  [0.44 * s, 0.135],
  [0.46 * s, 0.17],
  [0.44 * s, 0.21],
  [0.37 * s, 0.25],
];

const kingProfile: Profile = [
  [0, 0],
  [0.46, 0],
  [0.48, 0.025],
  [0.48, 0.07],
  [0.44, 0.09],
  [0.455, 0.12],
  [0.455, 0.15],
  [0.425, 0.175],
  [0.42, 0.2],
  [0.41, 0.27],
  [0.37, 0.34],
  [0.29, 0.42],
  [0.21, 0.52],
  [0.165, 0.65],
  [0.145, 0.85],
  [0.135, 1.05],
  [0.135, 1.22],
  [0.17, 1.28],
  [0.26, 1.33],
  [0.27, 1.37],
  [0.19, 1.4],
  [0.22, 1.44],
  [0.23, 1.48],
  [0.17, 1.52],
  [0.155, 1.58],
  [0.17, 1.66],
  [0.22, 1.8],
  [0.26, 1.92],
  [0.272, 1.96],
  [0.24, 1.99],
  [0.14, 2.01],
  [0.08, 2.05],
  [0.0, 2.07],
];

const queenProfile: Profile = [
  ...foot(0.97),
  [0.3, 0.31],
  [0.25, 0.43],
  [0.2, 0.68],
  [0.17, 0.95],
  [0.165, 1.1],
  [0.28, 1.15],
  [0.29, 1.19],
  [0.2, 1.23],
  [0.24, 1.27],
  [0.185, 1.31],
  [0.2, 1.42],
  [0.27, 1.6],
  [0.31, 1.7],
  [0.28, 1.73],
  [0.2, 1.72],
  [0.12, 1.76],
  [0.1, 1.8],
  [0.0, 1.82],
];

const bishopProfile: Profile = [
  ...foot(0.9),
  [0.27, 0.3],
  [0.22, 0.42],
  [0.17, 0.65],
  [0.15, 0.86],
  [0.25, 0.9],
  [0.26, 0.94],
  [0.17, 0.98],
  [0.2, 1.03],
  [0.24, 1.15],
  [0.25, 1.27],
  [0.22, 1.38],
  [0.15, 1.47],
  [0.08, 1.52],
  [0.09, 1.55],
  [0.1, 1.6],
  [0.07, 1.65],
  [0.0, 1.66],
];

const rookProfile: Profile = [
  ...foot(1.0),
  [0.33, 0.3],
  [0.29, 0.42],
  [0.265, 0.7],
  [0.27, 0.92],
  [0.33, 0.97],
  [0.36, 1.02],
  [0.36, 1.24],
  [0.29, 1.24],
  [0.29, 1.17],
  [0.0, 1.17],
];

const pawnProfile: Profile = [
  ...foot(0.85),
  [0.25, 0.3],
  [0.19, 0.42],
  [0.15, 0.6],
  [0.25, 0.64],
  [0.26, 0.68],
  [0.16, 0.72],
  [0.13, 0.76],
  [0.2, 0.84],
  [0.225, 0.95],
  [0.2, 1.06],
  [0.12, 1.13],
  [0.0, 1.15],
];

const knightBaseProfile: Profile = [
  ...foot(0.95),
  [0.33, 0.3],
  [0.31, 0.38],
  [0.0, 0.4],
];

const kingCross = () => {
  // Ornamental cross with flared, pointed arms.
  const s = new THREE.Shape();
  const w = 0.038;
  const arm = (ang: number, len: number) => {
    const c = Math.cos(ang);
    const n = Math.sin(ang);
    const px = (a: number, b: number) => [a * c - b * n, a * n + b * c] as const;
    return [px(w, -w), px(len * 0.7, -w * 1.9), px(len, 0), px(len * 0.7, w * 1.9), px(w, w)];
  };
  const pts = [
    ...arm(0, 0.17),
    ...arm(Math.PI / 2, 0.25),
    ...arm(Math.PI, 0.17),
    ...arm(-Math.PI / 2, 0.12),
  ];
  s.moveTo(pts[0][0], pts[0][1]);
  for (let i = 1; i < pts.length; i++) s.lineTo(pts[i][0], pts[i][1]);
  s.closePath();
  const g = new THREE.ExtrudeGeometry(s, {
    depth: 0.05,
    bevelEnabled: true,
    bevelThickness: 0.018,
    bevelSize: 0.014,
    bevelSegments: 3,
  });
  g.translate(0, 0, -0.025);
  return g;
};

const knightHead = () => {
  const p: [number, number][] = [
    [-0.27, 0],
    [0.27, 0],
    [0.25, 0.18],
    [0.17, 0.36],
    [0.3, 0.42],
    [0.44, 0.47],
    [0.53, 0.56],
    [0.52, 0.66],
    [0.44, 0.72],
    [0.3, 0.83],
    [0.17, 0.95],
    [0.12, 1.04],
    [0.06, 1.12],
    [0.0, 1.07],
    [-0.08, 1.0],
    [-0.2, 0.9],
    [-0.31, 0.74],
    [-0.36, 0.52],
    [-0.35, 0.28],
  ];
  const s = new THREE.Shape();
  s.moveTo(p[0][0], p[0][1]);
  const curve = new THREE.SplineCurve(p.map(([x, y]) => new THREE.Vector2(x, y)));
  curve.getPoints(120).forEach((v, i) => (i === 0 ? null : s.lineTo(v.x, v.y)));
  s.closePath();
  const g = new THREE.ExtrudeGeometry(s, {
    depth: 0.26,
    bevelEnabled: true,
    bevelThickness: 0.07,
    bevelSize: 0.06,
    bevelSegments: 5,
    curveSegments: 24,
  });
  g.translate(0, 0, -0.13);
  return g;
};

const build = (type: PieceType): THREE.BufferGeometry => {
  const parts: THREE.BufferGeometry[] = [];
  const m = new THREE.Matrix4();
  switch (type) {
    case "king": {
      parts.push(prep(lathe(kingProfile)));
      parts.push(prep(new THREE.SphereGeometry(0.06, 24, 16), m.makeTranslation(0, 2.08, 0)));
      parts.push(prep(kingCross(), new THREE.Matrix4().makeTranslation(0, 2.2, 0)));
      break;
    }
    case "queen": {
      parts.push(prep(lathe(queenProfile)));
      // Coronet points around the crown rim.
      for (let i = 0; i < 10; i++) {
        const a = (i / 10) * Math.PI * 2;
        const mm = new THREE.Matrix4().makeTranslation(Math.cos(a) * 0.28, 1.75, Math.sin(a) * 0.28);
        parts.push(prep(new THREE.SphereGeometry(0.045, 12, 8), mm));
      }
      parts.push(prep(new THREE.SphereGeometry(0.08, 24, 16), m.makeTranslation(0, 1.86, 0)));
      break;
    }
    case "bishop": {
      parts.push(prep(lathe(bishopProfile)));
      // Mitre slit.
      const slit = new THREE.BoxGeometry(0.03, 0.2, 0.52);
      const mm = new THREE.Matrix4()
        .makeTranslation(0.0, 1.3, 0)
        .multiply(new THREE.Matrix4().makeRotationZ(-0.6));
      parts.push(prep(slit, mm));
      break;
    }
    case "rook": {
      parts.push(prep(lathe(rookProfile)));
      for (let i = 0; i < 6; i++) {
        const a = (i / 6) * Math.PI * 2;
        const merlon = new THREE.BoxGeometry(0.13, 0.13, 0.1);
        const mm = new THREE.Matrix4()
          .makeTranslation(Math.cos(a) * 0.31, 1.3, Math.sin(a) * 0.31)
          .multiply(new THREE.Matrix4().makeRotationY(-a));
        parts.push(prep(merlon, mm));
      }
      break;
    }
    case "pawn":
      parts.push(prep(lathe(pawnProfile)));
      break;
    case "knight": {
      parts.push(prep(lathe(knightBaseProfile)));
      parts.push(prep(knightHead(), new THREE.Matrix4().makeTranslation(0, 0.36, 0)));
      break;
    }
  }
  const merged = mergeGeometries(parts, false)!;
  merged.computeBoundingBox();
  merged.computeBoundingSphere();
  return merged;
};

const cache = new Map<PieceType, THREE.BufferGeometry>();
export const pieceGeometry = (type: PieceType) => {
  if (!cache.has(type)) cache.set(type, build(type));
  return cache.get(type)!;
};

export const pieceHeight = (type: PieceType) => {
  const g = pieceGeometry(type);
  return g.boundingBox!.max.y;
};

// Rough centre of mass: pieces are weighted toward their base.
export const pieceCom = (type: PieceType) => new THREE.Vector3(0, pieceHeight(type) * 0.36, 0);

const restCache = new Map<string, { q: THREE.Quaternion; comY: number }>();

/**
 * Finds the resting orientation of a piece lying on its side: searches the
 * tilt (and roll for the knight) that minimises the height of the centre of
 * mass above the lowest vertex. Yaw is applied by the caller.
 */
export const lyingPose = (type: PieceType, roll: number) => {
  const key = `${type}:${roll.toFixed(3)}`;
  const hit = restCache.get(key);
  if (hit) return hit;
  const pos = pieceGeometry(type).attributes.position;
  const com = pieceCom(type);
  const stride = Math.max(1, Math.floor(pos.count / 4000));
  const v = new THREE.Vector3();
  let best = { q: new THREE.Quaternion(), comY: Infinity };
  const rolls = type === "knight" ? [roll, roll + Math.PI] : [roll];
  for (const r of rolls) {
    for (let a = -0.6; a <= 0.6; a += 0.01) {
      const q = new THREE.Quaternion()
        .setFromEuler(new THREE.Euler(0, 0, -Math.PI / 2 + a))
        .multiply(new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 1, 0), r));
      let minY = Infinity;
      for (let i = 0; i < pos.count; i += stride) {
        v.fromBufferAttribute(pos, i).sub(com).applyQuaternion(q);
        if (v.y < minY) minY = v.y;
      }
      const comY = -minY;
      if (comY < best.comY) best = { q, comY };
    }
  }
  restCache.set(key, best);
  return best;
};
