// Geometry builders, called once per composition (memoised by the scene).
import * as THREE from 'three';
import {RoundedBoxGeometry} from 'three/examples/jsm/geometries/RoundedBoxGeometry.js';
import {LOOK} from './layout';

/** Rounded-rectangle slab with a thin bevelled rim; front cap UVs span the face (0..1). */
export const cardGeometry = (w: number, h: number) => {
  const r = h * 0.03;
  const s = new THREE.Shape();
  s.moveTo(-w / 2 + r, 0);
  s.lineTo(w / 2 - r, 0);
  s.absarc(w / 2 - r, r, r, -Math.PI / 2, 0, false);
  s.lineTo(w / 2, h - r);
  s.absarc(w / 2 - r, h - r, r, 0, Math.PI / 2, false);
  s.lineTo(-w / 2 + r, h);
  s.absarc(-w / 2 + r, h - r, r, Math.PI / 2, Math.PI, false);
  s.lineTo(-w / 2, r);
  s.absarc(-w / 2 + r, r, r, Math.PI, Math.PI * 1.5, false);
  const depth = w * 0.03;
  const bevel = h * 0.007;
  const uv = {
    generateTopUV: (_g: THREE.ExtrudeGeometry, v: number[], a: number, b: number, c: number) =>
      [a, b, c].map((i) => new THREE.Vector2((v[i * 3] + w / 2) / w, v[i * 3 + 1] / h)),
    generateSideWallUV: () => [new THREE.Vector2(), new THREE.Vector2(), new THREE.Vector2(), new THREE.Vector2()],
  };
  const geo = new THREE.ExtrudeGeometry(s, {
    depth,
    steps: 1,
    curveSegments: 10,
    bevelEnabled: true,
    bevelThickness: bevel * 0.8,
    bevelSize: bevel,
    bevelSegments: 4,
    UVGenerator: uv as unknown as THREE.UVGenerator,
  });
  // stand on the floor (the bevel reaches `bevel` below the face), back face at z = 0
  geo.translate(0, bevel, bevel * 0.8);
  return {geo, depth: depth + bevel * 1.6};
};

/** One bar at full height h (scaled in y by the animation), base at y = 0. */
export const barGeometry = (h: number) => {
  const geo = new RoundedBoxGeometry(LOOK.barWidth, h, LOOK.barDepth, 4, 0.07);
  geo.translate(0, h / 2, 0);
  return geo;
};

/** Mitred offset of a polyline: left and right edges at half-width t. */
const offsetPolyline = (pts: THREE.Vector2[], t: number) => {
  const left: THREE.Vector2[] = [];
  const right: THREE.Vector2[] = [];
  for (let i = 0; i < pts.length; i++) {
    const dIn = i > 0 ? pts[i].clone().sub(pts[i - 1]).normalize() : pts[1].clone().sub(pts[0]).normalize();
    const dOut = i < pts.length - 1 ? pts[i + 1].clone().sub(pts[i]).normalize() : dIn;
    const nIn = new THREE.Vector2(-dIn.y, dIn.x);
    const nOut = new THREE.Vector2(-dOut.y, dOut.x);
    const m = nIn.clone().add(nOut).normalize();
    const len = t / Math.max(0.35, m.dot(nOut)); // mitre length, clamped for very sharp turns
    left.push(pts[i].clone().addScaledVector(m, len));
    right.push(pts[i].clone().addScaledVector(m, -len));
  }
  return {left, right};
};

/** Colour faces facing up lighter (the arrow's lighter top edge). */
const topEdgeColors = (geo: THREE.BufferGeometry, base: string, top: string) => {
  const g = geo.index ? geo.toNonIndexed() : geo;
  g.computeVertexNormals();
  const n = g.getAttribute('normal');
  const cBase = new THREE.Color(base);
  const cTop = new THREE.Color(top);
  const col = new Float32Array(n.count * 3);
  const c = new THREE.Color();
  for (let i = 0; i < n.count; i++) {
    c.copy(cBase).lerp(cTop, THREE.MathUtils.smoothstep(n.getY(i), 0.25, 0.85));
    col.set([c.r, c.g, c.b], i * 3);
  }
  g.setAttribute('color', new THREE.BufferAttribute(col, 3));
  return g;
};

/**
 * The arrow: a thick zigzag ribbon (square-ish cross-section, mitred corners)
 * through the path, and a separate arrowhead (for the pop) at its end.
 */
export const arrowGeometry = (path: THREE.Vector2[], color: string, topColor: string) => {
  const t = LOOK.arrowThickness / 2;
  const last = path[path.length - 1];
  // head direction: the last segment, limited to ±45° so the head stays bold and in frame
  const raw = last.clone().sub(path[path.length - 2]);
  const ang = THREE.MathUtils.clamp(Math.atan2(raw.y, raw.x), -Math.PI / 4, Math.PI / 4);
  const dir = new THREE.Vector2(Math.cos(ang), Math.sin(ang));
  // shorten the body slightly so it tucks under the head
  const body = path.map((p) => p.clone());
  body[body.length - 1] = last.clone().addScaledVector(dir, 0.05);
  const {left, right} = offsetPolyline(body, t);
  const shape = new THREE.Shape([...left, ...right.reverse()]);
  const extrude = {depth: LOOK.arrowDepth, steps: 1, curveSegments: 1, bevelEnabled: true, bevelThickness: 0.035, bevelSize: 0.03, bevelSegments: 2};
  const bodyGeo = new THREE.ExtrudeGeometry(shape, extrude);
  bodyGeo.translate(0, 0, -LOOK.arrowDepth / 2);

  const hw = LOOK.arrowHeadWidth / 2;
  const hl = LOOK.arrowHeadLength;
  const head = new THREE.Shape([new THREE.Vector2(-0.06, -hw), new THREE.Vector2(hl, 0), new THREE.Vector2(-0.06, hw)]);
  const headGeo = new THREE.ExtrudeGeometry(head, extrude);
  headGeo.translate(0, 0, -LOOK.arrowDepth / 2);

  return {
    body: topEdgeColors(bodyGeo, color, topColor),
    head: topEdgeColors(headGeo, color, topColor),
    headPos: last.clone(),
    headAngle: Math.atan2(dir.y, dir.x),
    tipX: last.x + dir.x * hl,
    startX: path[0].x - t,
  };
};

/** Soft radial falloff (white); tinted and stretched by the glow mesh under the arrow. */
export const glowTexture = () => {
  const c = document.createElement('canvas');
  c.width = 128;
  c.height = 128;
  const ctx = c.getContext('2d')!;
  const g = ctx.createRadialGradient(64, 64, 0, 64, 64, 64);
  g.addColorStop(0, 'rgba(255,255,255,1)');
  g.addColorStop(0.45, 'rgba(255,255,255,0.4)');
  g.addColorStop(1, 'rgba(255,255,255,0)');
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, 128, 128);
  return new THREE.CanvasTexture(c);
};
