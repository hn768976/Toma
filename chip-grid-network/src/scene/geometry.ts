import * as THREE from "three";
import { mergeGeometries } from "three/examples/jsm/utils/BufferGeometryUtils.js";
import { SVGLoader } from "three/examples/jsm/loaders/SVGLoader.js";
import { DIM } from "../lib/grid";

// ---------------------------------------------------------------------------
// Hard-surface parts, all built in code. Plans are chamfered squares
// (octagons). Geometry is y-up with the node centre at the origin.
// ---------------------------------------------------------------------------

/** Octagon outline (chamfered square), counter-clockwise, in the XY plane. */
const octagonPoints = (half: number, chamfer: number): THREE.Vector2[] => {
  const h = half;
  const c = chamfer;
  return [
    new THREE.Vector2(h - c, -h),
    new THREE.Vector2(h, -h + c),
    new THREE.Vector2(h, h - c),
    new THREE.Vector2(h - c, h),
    new THREE.Vector2(-h + c, h),
    new THREE.Vector2(-h, h - c),
    new THREE.Vector2(-h, -h + c),
    new THREE.Vector2(-h + c, -h),
  ];
};

const ni = (g: THREE.BufferGeometry) => (g.index ? g.toNonIndexed() : g);

const octagonShape = (half: number, chamfer: number) => new THREE.Shape(octagonPoints(half, chamfer));

/** Extrudes an octagon upward from y0 to y0 + height, with a small bevel. */
const octagonSlab = (half: number, chamfer: number, y0: number, height: number, bevel: number) => {
  const shape = octagonShape(half - bevel, Math.max(0.001, chamfer - bevel * 0.4));
  const g = new THREE.ExtrudeGeometry(shape, {
    depth: Math.max(0.001, height - bevel * 2),
    bevelEnabled: bevel > 0,
    bevelThickness: bevel,
    bevelSize: bevel,
    bevelSegments: 2,
    curveSegments: 1,
  });
  // Extrusion runs along +z; turn it so it runs along +y.
  g.rotateX(-Math.PI / 2);
  g.translate(0, y0 + bevel, 0);
  g.computeVertexNormals();
  return g;
};

/** Open octagonal prism (sides only). uv.x = perimeter fraction, uv.y = height fraction. */
const octagonWalls = (half: number, chamfer: number, y0: number, y1: number) => {
  const pts = octagonPoints(half, chamfer);
  const lens = pts.map((p, k) => p.distanceTo(pts[(k + 1) % pts.length]));
  const total = lens.reduce((a, b) => a + b, 0);
  const pos: number[] = [];
  const nor: number[] = [];
  const uv: number[] = [];
  const idx: number[] = [];
  let acc = 0;
  pts.forEach((p, k) => {
    const q = pts[(k + 1) % pts.length];
    // shape (x, y) -> world (x, -y)  (same convention as rotateX(-PI/2))
    const ax = p.x;
    const az = -p.y;
    const bx = q.x;
    const bz = -q.y;
    const ex = bx - ax;
    const ez = bz - az;
    const len = Math.hypot(ex, ez);
    // outward normal for a CCW outline after the y -> -z flip
    const nx = -ez / len;
    const nz = ex / len;
    const u0 = acc / total;
    const u1 = (acc + lens[k]) / total;
    acc += lens[k];
    const base = pos.length / 3;
    pos.push(ax, y0, az, bx, y0, bz, bx, y1, bz, ax, y1, az);
    for (let r = 0; r < 4; r++) nor.push(nx, 0, nz);
    uv.push(u0, 0, u1, 0, u1, 1, u0, 1);
    idx.push(base, base + 1, base + 2, base, base + 2, base + 3);
  });
  const g = new THREE.BufferGeometry();
  g.setAttribute("position", new THREE.Float32BufferAttribute(pos, 3));
  g.setAttribute("normal", new THREE.Float32BufferAttribute(nor, 3));
  g.setAttribute("uv", new THREE.Float32BufferAttribute(uv, 2));
  g.setIndex(idx);
  // make sure triangles face outward
  const a = new THREE.Vector3();
  const b = new THREE.Vector3();
  const c = new THREE.Vector3();
  a.fromBufferAttribute(g.attributes.position as THREE.BufferAttribute, idx[0]);
  b.fromBufferAttribute(g.attributes.position as THREE.BufferAttribute, idx[1]);
  c.fromBufferAttribute(g.attributes.position as THREE.BufferAttribute, idx[2]);
  const n = new THREE.Vector3().subVectors(b, a).cross(new THREE.Vector3().subVectors(c, a));
  if (n.x * nor[0] + n.z * nor[2] < 0) {
    for (let k = 0; k < idx.length; k += 3) {
      const t = idx[k + 1];
      idx[k + 1] = idx[k + 2];
      idx[k + 2] = t;
    }
    g.setIndex(idx);
  }
  return g;
};

/** Thin octagonal ring band (for the glowing foot line). */
const octagonRing = (outerHalf: number, innerHalf: number, chamfer: number, y0: number, height: number) => {
  const shape = octagonShape(outerHalf, chamfer);
  shape.holes.push(new THREE.Path(octagonPoints(innerHalf, chamfer * (innerHalf / outerHalf)).reverse()));
  const g = new THREE.ExtrudeGeometry(shape, { depth: height, bevelEnabled: false, curveSegments: 1 });
  g.rotateX(-Math.PI / 2);
  g.translate(0, y0, 0);
  g.computeVertexNormals();
  return g;
};

export type NodeGeometries = ReturnType<typeof buildNodeGeometries>;

export const buildNodeGeometries = () => {
  const plinth = octagonSlab(DIM.plinthHalf, DIM.plinthChamfer, 0, DIM.plinthHeight, 0.025);
  // a second, smaller step on the plinth for a machined look
  const plinthStep = octagonSlab(DIM.wallHalf + 0.06, DIM.wallChamfer + 0.03, DIM.plinthHeight - 0.01, 0.05, 0.012);
  const plinthAll = mergeGeometries([ni(plinth), ni(plinthStep)]);

  const glowLine = octagonRing(DIM.plinthHalf + 0.035, DIM.plinthHalf - 0.01, DIM.plinthChamfer + 0.015, 0.0, 0.035);
  const walls = octagonWalls(DIM.wallHalf, DIM.wallChamfer, DIM.wallBottom, DIM.wallTop);
  const innerLines = octagonWalls(DIM.wallHalf - 0.07, DIM.wallChamfer - 0.03, DIM.wallBottom + 0.06, DIM.wallTop - 0.05);
  // dark machined corner posts between the glass panes
  const posts: THREE.BufferGeometry[] = [];
  octagonPoints(DIM.wallHalf + 0.005, DIM.wallChamfer).forEach((p) => {
    const g = new THREE.BoxGeometry(0.05, DIM.wallTop - DIM.wallBottom, 0.05);
    g.rotateY(Math.atan2(p.y, p.x) + Math.PI / 4);
    g.translate(p.x, (DIM.wallTop + DIM.wallBottom) / 2, -p.y);
    posts.push(ni(g));
  });
  const cornerPosts = mergeGeometries(posts);

  const topFrame = octagonSlab(DIM.topHalf, DIM.topChamfer, DIM.wallTop, DIM.topThickness, 0.03);
  // A thin lip below the top plate.
  const topLip = octagonSlab(DIM.wallHalf + 0.03, DIM.wallChamfer + 0.01, DIM.wallTop - 0.05, 0.06, 0.01);
  const topAll = mergeGeometries([ni(topFrame), ni(topLip)]);

  const topY = DIM.wallTop + DIM.topThickness;
  // Inset square (PCB or frosted). UVs: top face maps 0..1.
  const inset = new THREE.BoxGeometry(DIM.insetHalf * 2, DIM.insetThickness, DIM.insetHalf * 2);
  inset.translate(0, topY + DIM.insetThickness / 2 - 0.004, 0);
  const die = new THREE.BoxGeometry(DIM.dieHalf * 2, DIM.dieThickness, DIM.dieHalf * 2);
  die.translate(0, topY + DIM.insetThickness + DIM.dieThickness / 2 - 0.006, 0);

  return { plinth: plinthAll, glowLine, walls, innerLines, cornerPosts, top: topAll, inset, die };
};

/**
 * Cable socket, built facing +z with its back at z = 0, centred at y = 0:
 * a dark bracket plate with three collars where the tubes enter.
 */
export const buildSocketGeometry = () => {
  const parts: THREE.BufferGeometry[] = [];
  const plate = new THREE.BoxGeometry(0.68, 0.32, DIM.socketDepth);
  plate.translate(0, 0, DIM.socketDepth / 2);
  parts.push(ni(plate));
  // chamfer strips top and bottom (gives the bracket a stepped profile)
  const strip = new THREE.BoxGeometry(0.58, 0.05, DIM.socketDepth + 0.025);
  const s1 = strip.clone();
  s1.translate(0, 0.165, (DIM.socketDepth + 0.025) / 2);
  const s2 = strip.clone();
  s2.translate(0, -0.165, (DIM.socketDepth + 0.025) / 2);
  parts.push(ni(s1), ni(s2));
  for (const ox of [-DIM.tubeSpacing, 0, DIM.tubeSpacing]) {
    const collar = new THREE.CylinderGeometry(0.102, 0.102, DIM.collarLength, 12, 1, true);
    collar.rotateX(Math.PI / 2);
    collar.translate(ox, 0, DIM.socketDepth + DIM.collarLength / 2);
    parts.push(ni(collar));
    const lip = new THREE.RingGeometry(DIM.tubeRadius + 0.004, 0.102, 12, 1);
    lip.translate(ox, 0, DIM.socketDepth + DIM.collarLength);
    parts.push(ni(lip));
  }
  // drop the uv sets so the merge doesn't trip on mismatched attributes
  for (const p of parts) {
    for (const name of Object.keys(p.attributes)) {
      if (name !== "position" && name !== "normal") p.deleteAttribute(name);
    }
  }
  return mergeGeometries(parts);
};

/** Unit-length tube along +y from y = -0.5 to 0.5 (scaled per instance). */
export const buildTubeGeometry = (radius: number, radial: number) =>
  new THREE.CylinderGeometry(radius, radius, 1, radial, 1, true);

// ---------------------------------------------------------------------------
// Shield mark: drawn as SVG here, parsed with SVGLoader into flat shapes.
// aPart = 1 for the outline + check, 0 for the translucent inner fill.
// Result is ~1 unit tall, centred, in the XY plane, y up.
// ---------------------------------------------------------------------------
const SHIELD_SVG = `
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 120">
  <path id="outline" fill-rule="evenodd" d="
    M50 4 L91 17 L91 55 C91 84 73 103 50 116 C27 103 9 84 9 55 L9 17 Z
    M50 14.5 L81 24.5 L81 55 C81 78 67 94 50 104.5 C33 94 19 78 19 55 L19 24.5 Z"/>
  <path id="fill" d="M50 14.5 L81 24.5 L81 55 C81 78 67 94 50 104.5 C33 94 19 78 19 55 L19 24.5 Z"/>
  <path id="check" d="M29 59 L37 51 L45 59.5 L65 38 L73 46 L45 75 Z"/>
</svg>`;

export const buildShieldGeometry = () => {
  const data = new SVGLoader().parse(SHIELD_SVG);
  const parts: THREE.BufferGeometry[] = [];
  for (const path of data.paths) {
    const id = (path.userData?.node as Element | undefined)?.getAttribute("id");
    const shapes = SVGLoader.createShapes(path);
    for (const shape of shapes) {
      const g = new THREE.ShapeGeometry(shape, 12);
      const count = g.attributes.position.count;
      const part = new Float32Array(count).fill(id === "fill" ? 0 : 1);
      g.setAttribute("aPart", new THREE.BufferAttribute(part, 1));
      g.deleteAttribute("uv");
      g.deleteAttribute("normal");
      parts.push(ni(g));
    }
  }
  const g = mergeGeometries(parts);
  // SVG y points down: flip, centre, scale to ~1 unit tall.
  g.scale(1 / 112, -1 / 112, 1);
  g.translate(-50 / 112, 60 / 112, 0);
  // fill sits a hair behind the outline
  const pos = g.attributes.position as THREE.BufferAttribute;
  const part = g.attributes.aPart as THREE.BufferAttribute;
  for (let k = 0; k < pos.count; k++) {
    pos.setZ(k, part.getX(k) > 0.5 ? 0.001 : 0);
  }
  // planar uv 0..1 for the glint
  const uv = new Float32Array(pos.count * 2);
  for (let k = 0; k < pos.count; k++) {
    uv[k * 2] = pos.getX(k) + 0.5;
    uv[k * 2 + 1] = pos.getY(k) + 0.5;
  }
  g.setAttribute("uv", new THREE.BufferAttribute(uv, 2));
  return g;
};
