import ClipperLib from "clipper-lib";
import { geoAlbersUsa } from "d3-geo";
import * as THREE from "three";
import { feature } from "topojson-client";
import { mergeGeometries, toCreasedNormals } from "three/examples/jsm/utils/BufferGeometryUtils.js";
import { presimplify, quantile, simplify } from "topojson-simplify";
import type { Topology, GeometryCollection } from "topojson-specification";
// us-atlas (ISC), derived from US Census Bureau cartographic boundary files (public domain).
import statesTopo from "us-atlas/states-10m.json";
import { mulberry32 } from "../lib/random";

// Everything below is computed once per tab at module load: deterministic, no randomness
// except the module-level seeded jitter.

export const MAP_WIDTH = 10; // world units
export const DEPTH = 0.03 * MAP_WIDTH;
export const BEVEL = 0.0006 * MAP_WIDTH;
export const SEAM_INSET = 0.0006 * MAP_WIDTH;
export const SEAM_PLATE_Y = 0.9; // fraction of DEPTH
export const EDGE_LINE_W = 0.0005 * MAP_WIDTH;

const EXCLUDE = new Set(["02", "15", "60", "66", "69", "72", "78"]); // AK, HI, territories

const SCALE = 1e5; // clipper integer scale

type Ring = { X: number; Y: number }[];

export interface StateGeo {
  id: string;
  name: string;
  body: THREE.BufferGeometry;
  cap: THREE.BufferGeometry;
  edge: THREE.BufferGeometry;
  seam: THREE.BufferGeometry | null;
  centroid: THREE.Vector2; // x, z
  dropStart: number; // frame
}

const toRing = (pts: [number, number][]): Ring =>
  pts.map(([x, z]) => ({ X: Math.round(x * SCALE), Y: Math.round(z * SCALE) }));

const offsetPaths = (paths: Ring[], delta: number): Ring[] => {
  const co = new ClipperLib.ClipperOffset(2, 0.25 * SCALE * 0.001);
  co.AddPaths(paths, ClipperLib.JoinType.jtMiter, ClipperLib.EndType.etClosedPolygon);
  const out: Ring[] = [];
  co.Execute(out, delta * SCALE);
  return out;
};

const unionEvenOdd = (paths: Ring[]): Ring[] => {
  const c = new ClipperLib.Clipper();
  c.AddPaths(paths, ClipperLib.PolyType.ptSubject, true);
  const out: Ring[] = [];
  c.Execute(ClipperLib.ClipType.ctUnion, out, ClipperLib.PolyFillType.pftEvenOdd, ClipperLib.PolyFillType.pftEvenOdd);
  return out;
};

const toTree = (paths: Ring[]) => {
  const c = new ClipperLib.Clipper();
  c.AddPaths(paths, ClipperLib.PolyType.ptSubject, true);
  const tree = new ClipperLib.PolyTree();
  c.Execute(ClipperLib.ClipType.ctUnion, tree, ClipperLib.PolyFillType.pftNonZero, ClipperLib.PolyFillType.pftNonZero);
  return tree;
};

// Shapes in (x, -z) so that after rotateX(-90deg) the shape lies on the x/z floor with +y up.
const treeToShapes = (tree: any): THREE.Shape[] => {
  const shapes: THREE.Shape[] = [];
  const v = (p: { X: number; Y: number }) => new THREE.Vector2(p.X / SCALE, -p.Y / SCALE);
  const walk = (node: any) => {
    for (const child of node.Childs()) {
      if (!child.IsHole()) {
        const shape = new THREE.Shape(child.Contour().map(v));
        for (const hole of child.Childs()) {
          shape.holes.push(new THREE.Path(hole.Contour().map(v)));
          walk(hole);
        }
        shapes.push(shape);
      }
    }
  };
  walk(tree);
  return shapes;
};

const cleanRings = (rings: Ring[]): Ring[] =>
  ClipperLib.Clipper.CleanPolygons(rings, 0.0003 * SCALE).filter(
    (r: Ring) => r.length >= 3 && Math.abs(ClipperLib.Clipper.Area(r)) / (SCALE * SCALE) > 0.00008,
  );

const area = (r: Ring) => Math.abs(ClipperLib.Clipper.Area(r)) / (SCALE * SCALE);

const build = () => {
  const topo = statesTopo as unknown as Topology<{ states: GeometryCollection<{ name: string }> }>;
  const pre = presimplify(topo as any);
  const simplified = simplify(pre, quantile(pre, 0.9)) as typeof topo;
  const fc = feature(simplified, simplified.objects.states);
  const projection = geoAlbersUsa();

  const raw: { id: string; name: string; rings: [number, number][][] }[] = [];
  for (const f of fc.features) {
    const id = String(f.id);
    if (EXCLUDE.has(id)) continue;
    const g = f.geometry;
    const polys = g.type === "Polygon" ? [g.coordinates] : g.type === "MultiPolygon" ? g.coordinates : [];
    const rings: [number, number][][] = [];
    for (const poly of polys) {
      for (const ring of poly) {
        const pts: [number, number][] = [];
        for (const c of ring) {
          const p = projection(c as [number, number]);
          if (p) pts.push([p[0], p[1]]);
        }
        if (pts.length > 3) rings.push(pts);
      }
    }
    raw.push({ id, name: f.properties?.name ?? id, rings });
  }

  let minX = Infinity, maxX = -Infinity, minY = Infinity, maxY = -Infinity;
  for (const s of raw) for (const r of s.rings) for (const [x, y] of r) {
    minX = Math.min(minX, x); maxX = Math.max(maxX, x);
    minY = Math.min(minY, y); maxY = Math.max(maxY, y);
  }
  const k = MAP_WIDTH / (maxX - minX);
  const cx = (minX + maxX) / 2;
  const cy = (minY + maxY) / 2;
  const mapDepth = (maxY - minY) * k;

  const cleanById = new Map<string, Ring[]>();
  for (const s of raw) {
    const rings = s.rings.map((r) => toRing(r.map(([x, y]) => [(x - cx) * k, (y - cy) * k])));
    cleanById.set(s.id, unionEvenOdd(ClipperLib.Clipper.CleanPolygons(rings, 0.0004 * SCALE)));
  }
  // The country minus a thin coastal margin: seam plates stay inside it, so seams read as
  // dark lines between states but coastlines get no outline.
  const nationAll: Ring[] = [];
  for (const r of cleanById.values()) nationAll.push(...r);
  const nc = new ClipperLib.Clipper();
  nc.AddPaths(nationAll, ClipperLib.PolyType.ptSubject, true);
  const nation: Ring[] = [];
  nc.Execute(ClipperLib.ClipType.ctUnion, nation, ClipperLib.PolyFillType.pftNonZero, ClipperLib.PolyFillType.pftNonZero);
  const interior = offsetPaths(nation, -0.002 * MAP_WIDTH);

  const states: StateGeo[] = [];
  for (const s of raw) {
    const clean = cleanById.get(s.id)!;
    // Drop specks that would vanish under the inset anyway.
    // Drop island specks (Channel Islands, Keys fragments, Isle Royale) that read as hairlines.
    const inset = cleanRings(offsetPaths(clean, -SEAM_INSET)).filter(
      (r) => !ClipperLib.Clipper.Orientation(r) || area(r) > 0.0025,
    );
    if (inset.length === 0) continue;
    const totalArea = inset.reduce((a: number, r: Ring) => a + (ClipperLib.Clipper.Orientation(r) ? area(r) : -area(r)), 0);
    const small = Math.abs(totalArea) < 0.02;
    const bevel = small ? 0 : BEVEL;

    // Walls: straight extrusion of the inset outline up to the start of the bevel.
    const walls = new THREE.ExtrudeGeometry(treeToShapes(toTree(inset)), {
      depth: DEPTH - bevel,
      bevelEnabled: false,
      curveSegments: 1,
    });
    walls.rotateX(-Math.PI / 2);
    // Smooth the zig-zag of coastline walls; the wall/top crease (90deg) stays sharp.
    const body = toCreasedNormals(walls, (65 * Math.PI) / 180);

    // Top cap and a 45deg chamfer. The chamfer is the ring between the outline and a
    // Clipper inset of it, triangulated in 2D; outline vertices sit at the bevel start,
    // inset vertices at the top. Robust on jagged coastlines, unlike a per-vertex bevel.
    // Inset each island separately; an island too thin to survive the inset keeps a flat cap.
    let capRings: Ring[] = [];
    if (bevel > 0) {
      const tree = toTree(inset);
      const groups: Ring[][] = [];
      const collect = (node: any) => {
        for (const child of node.Childs()) {
          if (!child.IsHole()) {
            groups.push([child.Contour(), ...child.Childs().map((h: any) => h.Contour())]);
            for (const h of child.Childs()) collect(h);
          }
        }
      };
      collect(tree);
      for (const g of groups) {
        const off = cleanRings(offsetPaths(g, -bevel));
        capRings.push(...(off.some((r) => ClipperLib.Clipper.Orientation(r)) ? off : g));
      }
    } else {
      capRings = inset;
    }
    const topGeo = new THREE.ShapeGeometry(treeToShapes(toTree(capRings.length ? capRings : inset)), 1);
    topGeo.rotateX(-Math.PI / 2);
    topGeo.translate(0, DEPTH, 0);
    const parts: THREE.BufferGeometry[] = [topGeo];
    if (bevel > 0 && capRings.length) {
      const capKeys = new Set<string>();
      for (const r of capRings) for (const p of r) capKeys.add(`${p.X},${p.Y}`);
      const ringTree = new ClipperLib.PolyTree();
      const dc = new ClipperLib.Clipper();
      dc.AddPaths(inset, ClipperLib.PolyType.ptSubject, true);
      dc.AddPaths(capRings, ClipperLib.PolyType.ptClip, true);
      dc.Execute(ClipperLib.ClipType.ctDifference, ringTree, ClipperLib.PolyFillType.pftNonZero, ClipperLib.PolyFillType.pftNonZero);
      const chamfer = new THREE.ShapeGeometry(treeToShapes(ringTree), 1);
      chamfer.rotateX(-Math.PI / 2);
      const pos = chamfer.attributes.position as THREE.BufferAttribute;
      for (let i = 0; i < pos.count; i++) {
        const key = `${Math.round(pos.getX(i) * SCALE)},${Math.round(pos.getZ(i) * SCALE)}`;
        pos.setY(i, capKeys.has(key) ? DEPTH : DEPTH - bevel);
      }
      parts.push(chamfer.toNonIndexed());
    }
    const capParts = parts.map((g) => (g.index ? g.toNonIndexed() : g));
    const cap = mergeGeometries(capParts, false)!;
    cap.computeVertexNormals();

    // Faint edge line: a thin ribbon just inside the top cap outline.
    const edgeBase = capRings.length ? capRings : inset;
    const inner = offsetPaths(edgeBase, -EDGE_LINE_W);
    const rc = new ClipperLib.Clipper();
    rc.AddPaths(edgeBase, ClipperLib.PolyType.ptSubject, true);
    rc.AddPaths(inner, ClipperLib.PolyType.ptClip, true);
    const ribbonTree = new ClipperLib.PolyTree();
    rc.Execute(ClipperLib.ClipType.ctDifference, ribbonTree, ClipperLib.PolyFillType.pftNonZero, ClipperLib.PolyFillType.pftNonZero);
    const edge = new THREE.ShapeGeometry(treeToShapes(ribbonTree), 1);
    edge.rotateX(-Math.PI / 2);
    edge.translate(0, DEPTH + 0.0015, 0);

    const pc = new ClipperLib.Clipper();
    pc.AddPaths(clean, ClipperLib.PolyType.ptSubject, true);
    pc.AddPaths(interior, ClipperLib.PolyType.ptClip, true);
    const plateTree = new ClipperLib.PolyTree();
    pc.Execute(ClipperLib.ClipType.ctIntersection, plateTree, ClipperLib.PolyFillType.pftNonZero, ClipperLib.PolyFillType.pftNonZero);
    const plateShapes = treeToShapes(plateTree);
    let seam: THREE.BufferGeometry | null = null;
    if (plateShapes.length) {
      seam = new THREE.ShapeGeometry(plateShapes, 1);
      seam.rotateX(-Math.PI / 2);
      seam.translate(0, DEPTH * SEAM_PLATE_Y, 0);
    }

    // Area-weighted centroid of the outline.
    let ax = 0, az = 0, aa = 0;
    for (const r of inset) {
      const a = area(r) * (ClipperLib.Clipper.Orientation(r) ? 1 : -1);
      let sx = 0, sz = 0;
      for (const p of r) { sx += p.X; sz += p.Y; }
      ax += (sx / r.length / SCALE) * a; az += (sz / r.length / SCALE) * a; aa += a;
    }
    states.push({
      id: s.id,
      name: s.name,
      body,
      cap,
      edge,
      seam,
      centroid: new THREE.Vector2(ax / aa, az / aa),
      dropStart: 0,
    });
  }

  // Drop order: sweep from north-west to south-east with seeded jitter, a few leaders.
  const rng = mulberry32(0x05a1);
  const FIRST = 30; // 1s
  const LAST_START = 195 - 32; // all landed by 6.5s
  for (const st of states) {
    const sx = (st.centroid.x + MAP_WIDTH / 2) / MAP_WIDTH;
    const sz = (st.centroid.y + mapDepth / 2) / mapDepth;
    const sweep = (sx * 0.72 + sz * 0.28 - 0.05) / 0.9;
    const jitter = (rng() - 0.5) * 0.16;
    const lead = rng() < 0.1 ? -0.25 * rng() : 0;
    const t = Math.min(1, Math.max(0, sweep + jitter + lead));
    st.dropStart = Math.round(FIRST + t * (LAST_START - FIRST));
  }
  return { states, mapDepth };
};

export const MAP = build();
