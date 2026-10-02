import ClipperLib from 'clipper-lib';
import { Shape, ShapePath, Path, Vector2 } from 'three';
import { SVGLoader } from 'three/examples/jsm/loaders/SVGLoader.js';
import type opentype from 'opentype.js';

// Converts stroked/filled SVG icons and font glyphs into clean, non-overlapping
// filled polygons (via Clipper), then into THREE.Shapes ready for extrusion.
//
// SVG authoring rules (see public/icons/README.md):
//  - stroke → offset polyline (round caps/joins as authored)
//  - fill   → filled polygon
//  - <g data-outline="1">  members' fills are merged; only the merged outline
//                          is stroked (for clouds made of circles + a rect)
//  - <g data-knockout="4"> before the group is added, everything drawn so far
//                          is cut away around it with a 4-unit gap

type IntPoint = { X: number; Y: number };
type IntPath = IntPoint[];

const SCALE = 1000; // Clipper works in integers; 1 SVG unit = 1000
const ARC_TOL = 25; // 0.025 SVG units — smooth round joins
const CURVE_DIVS = 32;

const toInt = (pts: Vector2[]): IntPath =>
  pts.map((p) => ({ X: Math.round(p.x * SCALE), Y: Math.round(p.y * SCALE) }));

const union = (a: IntPath[], b: IntPath[] = []): IntPath[] => {
  const c = new ClipperLib.Clipper();
  c.AddPaths(a, ClipperLib.PolyType.ptSubject, true);
  if (b.length) c.AddPaths(b, ClipperLib.PolyType.ptClip, true);
  const out = new ClipperLib.Paths();
  c.Execute(
    ClipperLib.ClipType.ctUnion,
    out,
    ClipperLib.PolyFillType.pftNonZero,
    ClipperLib.PolyFillType.pftNonZero,
  );
  return out;
};

const difference = (a: IntPath[], b: IntPath[]): IntPath[] => {
  if (!a.length || !b.length) return a;
  const c = new ClipperLib.Clipper();
  c.AddPaths(a, ClipperLib.PolyType.ptSubject, true);
  c.AddPaths(b, ClipperLib.PolyType.ptClip, true);
  const out = new ClipperLib.Paths();
  c.Execute(
    ClipperLib.ClipType.ctDifference,
    out,
    ClipperLib.PolyFillType.pftNonZero,
    ClipperLib.PolyFillType.pftNonZero,
  );
  return out;
};

const offset = (paths: IntPath[], delta: number, join: number, end: number): IntPath[] => {
  const co = new ClipperLib.ClipperOffset(2, ARC_TOL);
  co.AddPaths(paths, join, end);
  const out = new ClipperLib.Paths();
  co.Execute(out, delta * SCALE);
  return out;
};

const fillPolys = (paths: IntPath[], evenOdd: boolean): IntPath[] => {
  const c = new ClipperLib.Clipper();
  c.AddPaths(paths, ClipperLib.PolyType.ptSubject, true);
  const out = new ClipperLib.Paths();
  const ft = evenOdd ? ClipperLib.PolyFillType.pftEvenOdd : ClipperLib.PolyFillType.pftNonZero;
  c.Execute(ClipperLib.ClipType.ctUnion, out, ft, ft);
  return out;
};

type Sub = { pts: Vector2[]; closed: boolean };

const subPathsOf = (sp: ShapePath): Sub[] =>
  sp.subPaths
    .map((p: Path) => {
      const pts = p.getPoints(CURVE_DIVS);
      if (pts.length < 2) return null;
      const first = pts[0];
      const last = pts[pts.length - 1];
      const closed = Boolean(p.autoClose) || first.distanceTo(last) < 1e-3;
      if (closed && first.distanceTo(last) < 1e-3) pts.pop();
      return { pts, closed };
    })
    .filter((s): s is Sub => s !== null && s.pts.length >= 2);

const joinOf = (j: string | undefined) =>
  j === 'miter' ? ClipperLib.JoinType.jtMiter : j === 'bevel' ? ClipperLib.JoinType.jtSquare : ClipperLib.JoinType.jtRound;
const capOf = (c: string | undefined) =>
  c === 'butt' ? ClipperLib.EndType.etOpenButt : c === 'square' ? ClipperLib.EndType.etOpenSquare : ClipperLib.EndType.etOpenRound;

type Style = {
  fill?: string;
  fillRule?: string;
  stroke?: string;
  strokeWidth?: number;
  strokeLineJoin?: string;
  strokeLineCap?: string;
};

const hasPaint = (p?: string) => Boolean(p) && p !== 'none' && p !== 'transparent';

/** Geometry an element adds, and the region it occupies (for knockouts). */
const elementGeometry = (sp: ShapePath) => {
  const style = sp.userData?.style as Style;
  const subs = subPathsOf(sp);
  let add: IntPath[] = [];
  let region: IntPath[] = [];
  if (hasPaint(style.fill)) {
    const closed = subs.filter((s) => s.closed || s.pts.length > 2).map((s) => toInt(s.pts));
    const f = fillPolys(closed, style.fillRule === 'evenodd');
    add = union(add, f);
    region = union(region, f);
  }
  const sw = style.strokeWidth ?? 0;
  if (hasPaint(style.stroke) && sw > 0) {
    const join = joinOf(style.strokeLineJoin);
    const closed = subs.filter((s) => s.closed).map((s) => toInt(s.pts));
    const open = subs.filter((s) => !s.closed).map((s) => toInt(s.pts));
    const bands = union(
      offset(closed, sw / 2, join, ClipperLib.EndType.etClosedLine),
      offset(open, sw / 2, join, capOf(style.strokeLineCap)),
    );
    add = union(add, bands);
    region = union(region, union(bands, fillPolys(closed, false)));
  }
  return { add, region, style };
};

type Unit = { paths: ShapePath[]; outline: boolean; knockout: number };

const groupUnits = (paths: ShapePath[]): Unit[] => {
  const units: Unit[] = [];
  let current: { node: Element | null; unit: Unit } | null = null;
  for (const sp of paths) {
    const node = sp.userData?.node as Element | undefined;
    const outlineG = node?.closest?.('[data-outline]') ?? null;
    const knockG = node?.closest?.('[data-knockout]') ?? null;
    const groupNode = outlineG ?? knockG;
    if (groupNode && current && current.node === groupNode) {
      current.unit.paths.push(sp);
      continue;
    }
    const unit: Unit = {
      paths: [sp],
      outline: Boolean(outlineG),
      knockout: knockG ? parseFloat(knockG.getAttribute('data-knockout') ?? '0') : 0,
    };
    units.push(unit);
    current = { node: groupNode, unit };
  }
  return units;
};

/** Parse an SVG string into merged filled polygons (SVG units, y down). */
export const svgToPolygons = (svgText: string): IntPath[] => {
  const data = new SVGLoader().parse(svgText);
  let acc: IntPath[] = [];
  for (const unit of groupUnits(data.paths)) {
    let add: IntPath[] = [];
    let region: IntPath[] = [];
    if (unit.outline) {
      // merge the members' fills, then stroke the merged outline only
      let merged: IntPath[] = [];
      let sw = 0;
      let join = ClipperLib.JoinType.jtRound;
      for (const sp of unit.paths) {
        const style = sp.userData?.style as Style;
        sw = sw || (style.strokeWidth ?? 0);
        join = joinOf(style.strokeLineJoin);
        const closed = subPathsOf(sp).filter((s) => s.closed || s.pts.length > 2).map((s) => toInt(s.pts));
        merged = union(merged, fillPolys(closed, false));
      }
      add = offset(merged, sw / 2, join, ClipperLib.EndType.etClosedLine);
      region = union(add, merged);
    } else {
      for (const sp of unit.paths) {
        const g = elementGeometry(sp);
        add = union(add, g.add);
        region = union(region, g.region);
      }
    }
    if (unit.knockout > 0) {
      const cut = offset(region, unit.knockout, ClipperLib.JoinType.jtRound, ClipperLib.EndType.etClosedPolygon);
      acc = difference(acc, cut);
    }
    acc = union(acc, add);
  }
  return acc;
};

/** Flatten an opentype.js path into polygons (font units scaled, y down). */
export const glyphPathToPolygons = (path: opentype.Path): IntPath[] => {
  const contours: Vector2[][] = [];
  let cur: Vector2[] = [];
  let x = 0;
  let y = 0;
  const N = 10;
  for (const c of path.commands) {
    if (c.type === 'M') {
      if (cur.length > 2) contours.push(cur);
      cur = [new Vector2(c.x, c.y)];
      x = c.x; y = c.y;
    } else if (c.type === 'L') {
      cur.push(new Vector2(c.x, c.y));
      x = c.x; y = c.y;
    } else if (c.type === 'Q') {
      for (let i = 1; i <= N; i++) {
        const t = i / N; const u = 1 - t;
        cur.push(new Vector2(u * u * x + 2 * u * t * c.x1 + t * t * c.x, u * u * y + 2 * u * t * c.y1 + t * t * c.y));
      }
      x = c.x; y = c.y;
    } else if (c.type === 'C') {
      for (let i = 1; i <= N; i++) {
        const t = i / N; const u = 1 - t;
        cur.push(new Vector2(
          u * u * u * x + 3 * u * u * t * c.x1 + 3 * u * t * t * c.x2 + t * t * t * c.x,
          u * u * u * y + 3 * u * u * t * c.y1 + 3 * u * t * t * c.y2 + t * t * t * c.y,
        ));
      }
      x = c.x; y = c.y;
    } else if (c.type === 'Z') {
      if (cur.length > 2) contours.push(cur);
      cur = [];
    }
  }
  if (cur.length > 2) contours.push(cur);
  return fillPolys(contours.map(toInt), false);
};

export type Bounds = { minX: number; minY: number; maxX: number; maxY: number };

export const polygonBounds = (polys: IntPath[]): Bounds => {
  let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
  for (const p of polys) for (const q of p) {
    minX = Math.min(minX, q.X); maxX = Math.max(maxX, q.X);
    minY = Math.min(minY, q.Y); maxY = Math.max(maxY, q.Y);
  }
  return { minX: minX / SCALE, minY: minY / SCALE, maxX: maxX / SCALE, maxY: maxY / SCALE };
};

/**
 * Polygons (y down) → THREE.Shapes (y up), mapped with x' = (x - ox) * s,
 * y' = (oy - y) * s. Holes are resolved through a Clipper PolyTree.
 */
export const polygonsToShapes = (polys: IntPath[], ox: number, oy: number, s: number): Shape[] => {
  const c = new ClipperLib.Clipper();
  c.AddPaths(polys, ClipperLib.PolyType.ptSubject, true);
  const tree = new ClipperLib.PolyTree();
  c.Execute(ClipperLib.ClipType.ctUnion, tree, ClipperLib.PolyFillType.pftNonZero, ClipperLib.PolyFillType.pftNonZero);
  const map = (contour: IntPath) =>
    contour.map((p) => new Vector2((p.X / SCALE - ox) * s, (oy - p.Y / SCALE) * s));
  const shapes: Shape[] = [];
  const visit = (node: { Childs: () => unknown[] }) => {
    for (const child of node.Childs() as { IsHole: () => boolean; Contour: () => IntPath; Childs: () => unknown[] }[]) {
      if (child.IsHole()) continue;
      const shape = new Shape(map(child.Contour()));
      for (const hole of child.Childs() as { Contour: () => IntPath; Childs: () => unknown[] }[]) {
        shape.holes.push(new Path(map(hole.Contour())));
        visit(hole); // islands inside holes
      }
      shapes.push(shape);
    }
  };
  visit(tree);
  return shapes;
};

/** Outer contours as point lists in the same mapped space (for glint placement). */
export const polygonsToOutlines = (polys: IntPath[], ox: number, oy: number, s: number): Vector2[][] =>
  polys.map((contour) => contour.map((p) => new Vector2((p.X / SCALE - ox) * s, (oy - p.Y / SCALE) * s)));
