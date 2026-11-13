import * as THREE from "three";
import { mergeGeometries } from "three/examples/jsm/utils/BufferGeometryUtils.js";
import { RoundedBoxGeometry } from "three/examples/jsm/geometries/RoundedBoxGeometry.js";
import type { Palette, RGB } from "./palette";

export const TILE_SIZE = 1.5;
export const TILE_TOP = 0.36;

const roundedRect = (w: number, r: number) => {
  const h = w / 2;
  const s = new THREE.Shape();
  s.moveTo(-h + r, -h);
  s.lineTo(h - r, -h);
  s.absarc(h - r, -h + r, r, -Math.PI / 2, 0, false);
  s.lineTo(h, h - r);
  s.absarc(h - r, h - r, r, 0, Math.PI / 2, false);
  s.lineTo(-h + r, h);
  s.absarc(-h + r, h - r, r, Math.PI / 2, Math.PI, false);
  s.lineTo(-h, -h + r);
  s.absarc(-h + r, -h + r, r, Math.PI, Math.PI * 1.5, false);
  return s;
};

const plate = (w: number, r: number, y0: number, y1: number, layer: number) => {
  const bevel = 0.025;
  const g = new THREE.ExtrudeGeometry(roundedRect(w - bevel * 2, r), {
    depth: y1 - y0 - bevel * 2,
    bevelEnabled: true,
    bevelSize: bevel,
    bevelThickness: bevel,
    bevelSegments: 1,
    curveSegments: 5,
  });
  g.rotateX(-Math.PI / 2);
  g.translate(0, y0 + bevel, 0);
  const n = g.attributes.position.count;
  g.setAttribute(
    "aLayer",
    new THREE.BufferAttribute(new Float32Array(n).fill(layer), 1),
  );
  g.deleteAttribute("uv");
  return g;
};

/** Detailed tile: a glassy base plate with a slightly smaller key cap on top. */
export const buildTileGeometry = () => {
  const g = mergeGeometries([
    plate(TILE_SIZE + 0.14, 0.3, 0.02, 0.13, 0),
    plate(TILE_SIZE, 0.27, 0.17, TILE_TOP, 1),
  ]);
  return g;
};

/** Cheap tile for the far field (only ever a few pixels wide). */
export const buildFarTileGeometry = () => {
  const g = new THREE.BoxGeometry(TILE_SIZE, TILE_TOP - 0.02, TILE_SIZE);
  g.translate(0, (TILE_TOP + 0.02) / 2, 0);
  const n = g.attributes.position.count;
  g.setAttribute(
    "aLayer",
    new THREE.BufferAttribute(new Float32Array(n).fill(1), 1),
  );
  g.deleteAttribute("uv");
  return g;
};

const paint = (
  geo: THREE.BufferGeometry,
  color: RGB,
  emissive = 0,
): THREE.BufferGeometry => {
  const g = geo.index ? geo.toNonIndexed() : geo;
  const n = g.attributes.position.count;
  const c = new Float32Array(n * 3);
  for (let i = 0; i < n; i++) {
    c[i * 3] = color[0];
    c[i * 3 + 1] = color[1];
    c[i * 3 + 2] = color[2];
  }
  g.setAttribute("color", new THREE.BufferAttribute(c, 3));
  g.setAttribute(
    "aEm",
    new THREE.BufferAttribute(new Float32Array(n).fill(emissive), 1),
  );
  g.deleteAttribute("uv");
  return g;
};

/**
 * The little helper bot: a boxy body with a screen face, two raised pincer
 * arms, four stubby legs and a pair of antennae. Built from primitives and
 * merged into one vertex-coloured mesh so thousands can be instanced.
 */
export const buildRobotGeometry = (p: Palette) => {
  const parts: THREE.BufferGeometry[] = [];
  const add = (
    g: THREE.BufferGeometry,
    color: RGB,
    pos: [number, number, number],
    rot: [number, number, number] = [0, 0, 0],
    em = 0,
  ) => {
    const m = new THREE.Matrix4().compose(
      new THREE.Vector3(...pos),
      new THREE.Quaternion().setFromEuler(new THREE.Euler(...rot)),
      new THREE.Vector3(1, 1, 1),
    );
    g.applyMatrix4(m);
    parts.push(paint(g, color, em));
  };
  const light: RGB = [
    Math.min(1, p.robotBody[0] * 1.08 + 0.05),
    Math.min(1, p.robotBody[1] * 1.08 + 0.08),
    Math.min(1, p.robotBody[2] * 1.08 + 0.08),
  ];

  // body + face
  add(new RoundedBoxGeometry(0.78, 0.64, 0.66, 2, 0.13), p.robotBody, [0, 0.6, 0]);
  add(new RoundedBoxGeometry(0.58, 0.42, 0.08, 2, 0.04), p.robotFace, [0, 0.62, 0.31], [0, 0, 0], 0.35);
  add(new RoundedBoxGeometry(0.07, 0.17, 0.03, 1, 0.012), p.robotEye, [-0.12, 0.63, 0.355]);
  add(new RoundedBoxGeometry(0.07, 0.17, 0.03, 1, 0.012), p.robotEye, [0.12, 0.63, 0.355]);
  // antennae
  for (const s of [-1, 1]) {
    add(new THREE.CylinderGeometry(0.018, 0.018, 0.2, 5), p.robotDark, [s * 0.16, 1.0, 0], [0, 0, -s * 0.25]);
    add(new THREE.SphereGeometry(0.045, 6, 5), light, [s * 0.185, 1.11, 0]);
  }
  // arms with pincers
  for (const s of [-1, 1]) {
    add(new THREE.CylinderGeometry(0.05, 0.05, 0.3, 6), p.robotDark, [s * 0.5, 0.66, 0.02], [0, 0, -s * 0.9]);
    add(new THREE.SphereGeometry(0.13, 8, 6), p.robotBody, [s * 0.66, 0.8, 0.04]);
    add(new RoundedBoxGeometry(0.1, 0.26, 0.12, 1, 0.04), light, [s * 0.74, 0.97, 0.04], [0, 0, -s * 0.5]);
    add(new RoundedBoxGeometry(0.09, 0.22, 0.11, 1, 0.04), light, [s * 0.6, 0.98, 0.04], [0, 0, s * 0.3]);
  }
  // legs
  for (const sx of [-1, 1]) {
    for (const sz of [-1, 1]) {
      add(new THREE.CylinderGeometry(0.05, 0.04, 0.3, 5), p.robotDark, [sx * 0.3, 0.17, sz * 0.2], [sz * 0.25, 0, -sx * 0.45]);
      add(new THREE.SphereGeometry(0.06, 6, 4), p.robotBody, [sx * 0.37, 0.04, sz * 0.24]);
    }
  }
  return mergeGeometries(parts);
};

export const buildFarRobotGeometry = (p: Palette) => {
  const g = new THREE.BoxGeometry(0.9, 0.7, 0.8);
  g.translate(0, 0.6, 0);
  return paint(g, p.farRobot, 0.6);
};

/** Extruded tick mark, centred on its own vertical axis so it can spin. */
export const buildCheckGeometry = () => {
  const s = new THREE.Shape();
  const pts: [number, number][] = [
    [-0.34, 0.02],
    [-0.22, 0.14],
    [-0.08, 0.0],
    [0.24, 0.36],
    [0.36, 0.24],
    [-0.08, -0.26],
  ];
  s.moveTo(pts[0][0], pts[0][1]);
  for (let i = 1; i < pts.length; i++) s.lineTo(pts[i][0], pts[i][1]);
  s.closePath();
  const g = new THREE.ExtrudeGeometry(s, { depth: 0.09, bevelEnabled: false });
  g.translate(0, 0, -0.045);
  return g;
};

/** White line icons drawn into a 4x2 atlas (original, simple glyphs). */
export const buildIconAtlas = () => {
  const cell = 256;
  const c = document.createElement("canvas");
  c.width = cell * 4;
  c.height = cell * 2;
  const g = c.getContext("2d")!;
  g.strokeStyle = "#fff";
  g.fillStyle = "#fff";
  g.lineWidth = 15;
  g.lineCap = "round";
  g.lineJoin = "round";
  const at = (i: number, draw: () => void) => {
    g.save();
    g.translate((i % 4) * cell + cell / 2, Math.floor(i / 4) * cell + cell / 2);
    draw();
    g.restore();
  };
  // 0 list
  at(0, () => {
    for (const y of [-52, 0, 52]) {
      g.beginPath();
      g.arc(-70, y, 9, 0, 7);
      g.fill();
      g.beginPath();
      g.moveTo(-36, y);
      g.lineTo(76, y);
      g.stroke();
    }
  });
  // 1 cloud
  at(1, () => {
    g.beginPath();
    g.moveTo(-58, 42);
    g.bezierCurveTo(-104, 42, -104, -18, -56, -20);
    g.bezierCurveTo(-48, -72, 28, -76, 42, -26);
    g.bezierCurveTo(100, -30, 102, 42, 56, 42);
    g.closePath();
    g.stroke();
  });
  // 2 bar chart
  at(2, () => {
    g.beginPath();
    g.moveTo(-78, 62);
    g.lineTo(78, 62);
    g.stroke();
    [-48, 0, 48].forEach((x, k) => {
      g.beginPath();
      g.moveTo(x, 34);
      g.lineTo(x, [0, -58, -22][k]);
      g.stroke();
    });
  });
  // 3 shield
  at(3, () => {
    g.beginPath();
    g.moveTo(0, -74);
    g.lineTo(62, -50);
    g.bezierCurveTo(62, 16, 40, 54, 0, 76);
    g.bezierCurveTo(-40, 54, -62, 16, -62, -50);
    g.closePath();
    g.stroke();
  });
  // 4 cart
  at(4, () => {
    g.beginPath();
    g.moveTo(-84, -56);
    g.lineTo(-56, -56);
    g.lineTo(-34, 22);
    g.lineTo(52, 22);
    g.lineTo(70, -30);
    g.lineTo(-48, -30);
    g.stroke();
    for (const x of [-22, 44]) {
      g.beginPath();
      g.arc(x, 58, 11, 0, 7);
      g.fill();
    }
  });
  // 5 flask
  at(5, () => {
    g.beginPath();
    g.moveTo(-22, -72);
    g.lineTo(-22, -18);
    g.lineTo(-66, 60);
    g.lineTo(66, 60);
    g.lineTo(22, -18);
    g.lineTo(22, -72);
    g.moveTo(-36, -72);
    g.lineTo(36, -72);
    g.moveTo(-42, 22);
    g.lineTo(42, 22);
    g.stroke();
  });
  // 6 team
  at(6, () => {
    const person = (x: number, y: number, k: number) => {
      g.beginPath();
      g.arc(x, y - 30 * k, 17 * k, 0, 7);
      g.fill();
      g.beginPath();
      g.arc(x, y + 40 * k, 36 * k, Math.PI, 0);
      g.closePath();
      g.fill();
    };
    person(-58, 30, 0.8);
    person(58, 30, 0.8);
    person(0, -6, 1.05);
  });
  // 7 upload
  at(7, () => {
    g.beginPath();
    g.moveTo(0, 30);
    g.lineTo(0, -66);
    g.moveTo(-40, -28);
    g.lineTo(0, -68);
    g.lineTo(40, -28);
    g.moveTo(-72, 26);
    g.lineTo(-72, 66);
    g.lineTo(72, 66);
    g.lineTo(72, 26);
    g.stroke();
  });
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.NoColorSpace;
  tex.anisotropy = 8;
  tex.generateMipmaps = true;
  tex.minFilter = THREE.LinearMipmapLinearFilter;
  return tex;
};
