import {
  CubicBezierCurve3,
  CurvePath,
  LineCurve3,
  QuadraticBezierCurve3,
  Vector3,
} from "three";
import { IconKind } from "./theme";

// The workflow graph is laid out on the ground plane in "graph space":
//   u = along the flow (left → right), v = lateral (positive = further away).
// World space: x = u, z = -v, y = up.
// The layout is periodic: one period is PERIOD units long, and the camera
// travels exactly one period over the composition, so the video loops.

export const PERIOD = 24;

export type Shape = "tile" | "small" | "wide" | "circle";

export type NodeDef = {
  id: string;
  icon: IconKind;
  shape: Shape;
  u: number;
  v: number;
};

export type EdgeDef = {
  from: string;
  to: string;
  // The source lives in the previous period (wraps around the loop seam).
  fromPrev?: boolean;
  dotted?: boolean;
  // Absolute u of the vertical leg for solid edges (optional).
  midU?: number;
  // Horizontal offset of the exit point under the source (dotted edges).
  exitOffset?: number;
};

export const SIZE: Record<Shape, { w: number; h: number }> = {
  tile: { w: 1.6, h: 1.6 },
  small: { w: 0.62, h: 0.62 },
  wide: { w: 3.5, h: 1.6 },
  circle: { w: 1.6, h: 1.6 },
};

export const NODES: NodeDef[] = [
  { id: "router", icon: "router", shape: "tile", u: 1.0, v: 0.8 },
  { id: "globe", icon: "globe", shape: "tile", u: 4.4, v: 3.6 },
  { id: "power", icon: "power", shape: "tile", u: 4.6, v: 0.8 },
  { id: "cloud", icon: "cloud", shape: "tile", u: 5.0, v: -2.2 },
  { id: "sign", icon: "sign", shape: "tile", u: 7.6, v: 0.8 },
  { id: "refresh", icon: "refresh", shape: "tile", u: 10.6, v: 4.0 },
  { id: "agent", icon: "agent", shape: "wide", u: 12.4, v: 1.6 },
  { id: "plus", icon: "plus", shape: "small", u: 13.2, v: 4.0 },
  { id: "sparkle", icon: "sparkle", shape: "circle", u: 11.4, v: -1.6 },
  { id: "db", icon: "db", shape: "circle", u: 14.2, v: -0.9 },
  { id: "globeGreen", icon: "globeGreen", shape: "tile", u: 16.6, v: 4.6 },
  { id: "braces1", icon: "braces", shape: "tile", u: 17.4, v: 1.6 },
  { id: "globeCyan", icon: "globeCyan", shape: "tile", u: 17.2, v: -1.2 },
  { id: "pencil", icon: "pencil", shape: "tile", u: 19.4, v: 5.2 },
  { id: "form", icon: "form", shape: "tile", u: 20.4, v: 2.4 },
  { id: "braces2", icon: "braces", shape: "tile", u: 20.6, v: -0.8 },
];

export const EDGES: EdgeDef[] = [
  { from: "form", to: "router", fromPrev: true, midU: 22.6 - PERIOD },
  { from: "braces2", to: "router", fromPrev: true, midU: 22.9 - PERIOD },
  { from: "pencil", to: "router", fromPrev: true, midU: 22.3 - PERIOD },
  { from: "router", to: "globe", midU: 2.6 },
  { from: "router", to: "power" },
  { from: "router", to: "cloud", midU: 3.0 },
  { from: "power", to: "sign" },
  { from: "sign", to: "refresh", midU: 9.0 },
  { from: "sign", to: "agent", midU: 9.7 },
  { from: "refresh", to: "plus" },
  { from: "agent", to: "sparkle", dotted: true, exitOffset: -1.0 },
  { from: "agent", to: "db", dotted: true, exitOffset: 0.4 },
  { from: "agent", to: "globeGreen", midU: 14.8 },
  { from: "agent", to: "braces1" },
  { from: "agent", to: "globeCyan", midU: 15.4 },
  { from: "globeGreen", to: "pencil", midU: 18.2 },
  { from: "braces1", to: "form", midU: 18.8 },
  { from: "globeCyan", to: "braces2", midU: 18.9 },
];

// Timing (seconds) of a node's build-up, relative to the moment the build
// front reaches it.
export const T = {
  ghostIn: 0.35,
  descendEnd: 0.95,
  wireStart: 0.7,
  activate: 0.32,
};

export const WIRE_Y = 0.035;
export const ARROW_LEN = 0.2;

const byId = new Map(NODES.map((n) => [n.id, n]));

export type Laid = {
  key: number; // u at which the build front "births" this node
  wireDur: number; // seconds the incoming wire(s) take to draw
};

const p3 = (u: number, v: number) => new Vector3(u, WIRE_Y, -v);

export const roundedPath = (pts: Vector3[], radius: number) => {
  const path = new CurvePath<Vector3>();
  let cursor = pts[0].clone();
  for (let i = 1; i < pts.length - 1; i++) {
    const prev = pts[i - 1];
    const corner = pts[i];
    const next = pts[i + 1];
    const dIn = corner.clone().sub(prev);
    const dOut = next.clone().sub(corner);
    const r = Math.min(radius, dIn.length() / 2, dOut.length() / 2);
    const a = corner.clone().sub(dIn.normalize().multiplyScalar(r));
    const b = corner.clone().add(dOut.normalize().multiplyScalar(r));
    if (a.distanceTo(cursor) > 1e-4) path.add(new LineCurve3(cursor, a));
    path.add(new QuadraticBezierCurve3(a, corner.clone(), b));
    cursor = b;
  }
  path.add(new LineCurve3(cursor, pts[pts.length - 1].clone()));
  return path;
};

export const edgePoints = (e: EdgeDef): Vector3[] => {
  const a = byId.get(e.from)!;
  const b = byId.get(e.to)!;
  const au = a.u - (e.fromPrev ? PERIOD : 0);
  const sa = SIZE[a.shape];
  const sb = SIZE[b.shape];
  if (e.dotted) {
    const s = { u: au + (e.exitOffset ?? 0), v: a.v - sa.h / 2 };
    const t = { u: b.u, v: b.v + sb.h / 2 + ARROW_LEN };
    const mv = (s.v + t.v) / 2;
    return [p3(s.u, s.v), p3(s.u, mv), p3(t.u, mv), p3(t.u, t.v)];
  }
  const s = { u: au + sa.w / 2, v: a.v };
  const t = { u: b.u - sb.w / 2 - ARROW_LEN, v: b.v };
  if (Math.abs(t.v - s.v) < 0.05) {
    return [p3(s.u, s.v), p3(t.u, s.v)];
  }
  const m = e.midU ?? (s.u + t.u) / 2;
  return [p3(s.u, s.v), p3(m, s.v), p3(m, t.v), p3(t.u, t.v)];
};

export const edgePath = (e: EdgeDef) => {
  const pts = edgePoints(e);
  if (e.dotted) {
    // loose S-curve from the agent down to its tool, like the reference
    const a = pts[0];
    const b = pts[pts.length - 1];
    const dz = b.z - a.z;
    const path = new CurvePath<Vector3>();
    path.add(
      new CubicBezierCurve3(
        a,
        new Vector3(a.x + (b.x - a.x) * 0.1, WIRE_Y, a.z + dz * 0.75),
        new Vector3(b.x - (b.x - a.x) * 0.1, WIRE_Y, b.z - dz * 0.75),
        b,
      ),
    );
    return path;
  }
  return roundedPath(pts, 0.7);
};

// Compute when each node is born: a node is built only after all of its
// parents are, so the graph grows along its edges like the reference.
export const layoutTiming = (speed: number): Map<string, Laid> => {
  const res = new Map<string, Laid>();
  for (const n of NODES) {
    res.set(n.id, { key: n.u - SIZE[n.shape].w / 2, wireDur: 0.5 });
  }
  for (let pass = 0; pass < 6; pass++) {
    for (const n of NODES) {
      const incoming = EDGES.filter((e) => e.to === n.id);
      let key = n.u - SIZE[n.shape].w / 2;
      let len = 0;
      for (const e of incoming) {
        const parent = res.get(e.from)!;
        const pk = parent.key - (e.fromPrev ? PERIOD : 0);
        // parent must be activated before the wire leaves it
        const parentReady =
          pk + (T.wireStart + parent.wireDur + T.activate * 0.6) * speed;
        key = Math.max(key, parentReady - T.wireStart * speed);
        len = Math.max(len, edgePath(e).getLength());
      }
      const wireDur = Math.min(1.1, Math.max(0.45, len / 5.5));
      res.set(n.id, { key, wireDur });
    }
  }
  return res;
};

export const nodeById = (id: string) => byId.get(id)!;
