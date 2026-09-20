/**
 * Plinth geometry, generated from parameters.
 *
 * Every plinth in the set comes out of these two builders, which is what
 * makes look 3's two variants a data row rather than a second model: the
 * single fluted cylinder and the pair of classical columns differ only in
 * radius, height, flute count and flute depth.
 */
import * as THREE from "three";

const cache = new Map<string, THREE.BufferGeometry>();
const memo = (key: string, make: () => THREE.BufferGeometry) => {
  const hit = cache.get(key);
  if (hit) return hit;
  const g = make();
  cache.set(key, g);
  return g;
};

export type DiscOptions = {
  radius: number;
  height: number;
  /** Rounded edge at the top and bottom rim. A real scale cue — keep it small but present. */
  bevel: number;
  radialSegments?: number;
  bevelSegments?: number;
};

/**
 * A disc plinth with a bevelled rim. The top face gets planar UVs so a wood
 * grain or a decal reads across it rather than spiralling round it.
 */
export const discGeometry = (o: DiscOptions) =>
  memo(`disc:${JSON.stringify(o)}`, () => {
    const seg = o.radialSegments ?? 160;
    const bseg = o.bevelSegments ?? 6;
    const { radius: R, height: H, bevel: b } = o;
    const pts: THREE.Vector2[] = [];

    pts.push(new THREE.Vector2(0, 0));
    pts.push(new THREE.Vector2(R - b, 0));
    for (let i = 0; i <= bseg; i++) {
      const a = (i / bseg) * (Math.PI / 2);
      pts.push(new THREE.Vector2(R - b + Math.sin(a) * b, b - Math.cos(a) * b));
    }
    for (let i = 0; i <= bseg; i++) {
      const a = (i / bseg) * (Math.PI / 2);
      pts.push(
        new THREE.Vector2(R - b + Math.cos(a) * b, H - b + Math.sin(a) * b),
      );
    }
    pts.push(new THREE.Vector2(0, H));

    const g = new THREE.LatheGeometry(pts, seg);
    g.computeVertexNormals();

    // Planar UVs on the flat top face.
    const pos = g.attributes.position as THREE.BufferAttribute;
    const nor = g.attributes.normal as THREE.BufferAttribute;
    const uv = g.attributes.uv as THREE.BufferAttribute;
    for (let i = 0; i < pos.count; i++) {
      if (nor.getY(i) > 0.95 && pos.getY(i) > H - b * 0.5) {
        uv.setXY(
          i,
          pos.getX(i) / (2 * R) + 0.5,
          pos.getZ(i) / (2 * R) + 0.5,
        );
      }
    }
    uv.needsUpdate = true;
    return g;
  });

export type FlutedOptions = {
  radius: number;
  height: number;
  /** Number of vertical grooves around the circumference. */
  flutes: number;
  /** Groove depth, in world units. */
  fluteDepth: number;
  /**
   * Groove cross-section. 1 is a soft sine scallop; higher values pinch the
   * groove and widen the flat land between grooves.
   */
  fluteSharpness?: number;
  /** Radius multiplier at the top — below 1 gives a column a classical taper. */
  taper?: number;
  radialSegments?: number;
  heightSegments?: number;
};

/**
 * A fluted shaft: a cylinder whose radius is a function of the angle around
 * it. Normals are averaged across the grooves, so each flute picks up a lit
 * side and a shaded side from a single directional key.
 */
export const flutedGeometry = (o: FlutedOptions) =>
  memo(`fluted:${JSON.stringify(o)}`, () => {
    const seg = o.radialSegments ?? 512;
    const rows = o.heightSegments ?? 24;
    const sharp = o.fluteSharpness ?? 1;
    const taper = o.taper ?? 1;

    const positions: number[] = [];
    const uvs: number[] = [];
    const indices: number[] = [];

    const radiusAt = (theta: number, v: number) => {
      const wave = Math.pow(0.5 + 0.5 * Math.cos(o.flutes * theta), sharp);
      const scale = 1 + (taper - 1) * v;
      return o.radius * scale - o.fluteDepth * wave;
    };

    for (let j = 0; j <= rows; j++) {
      const v = j / rows;
      const y = v * o.height;
      for (let i = 0; i <= seg; i++) {
        const u = i / seg;
        const theta = u * Math.PI * 2;
        const r = radiusAt(theta, v);
        positions.push(Math.cos(theta) * r, y, Math.sin(theta) * r);
        uvs.push(u, v);
      }
    }
    const stride = seg + 1;
    for (let j = 0; j < rows; j++) {
      for (let i = 0; i < seg; i++) {
        const a = j * stride + i;
        const b = a + 1;
        const c = a + stride;
        const d = c + 1;
        indices.push(a, c, b, b, c, d);
      }
    }

    // Bottom cap, so the shaft reads as solid where it meets the floor.
    const centerIndex = positions.length / 3;
    positions.push(0, 0, 0);
    uvs.push(0.5, 0.5);
    for (let i = 0; i < seg; i++) {
      indices.push(centerIndex, i + 1, i);
    }

    const g = new THREE.BufferGeometry();
    g.setAttribute("position", new THREE.Float32BufferAttribute(positions, 3));
    g.setAttribute("uv", new THREE.Float32BufferAttribute(uvs, 2));
    g.setIndex(indices);
    g.computeVertexNormals();
    return g;
  });
