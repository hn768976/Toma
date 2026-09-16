import { BufferAttribute, BufferGeometry } from 'three/webgpu';

export type TileGeometryOptions = {
  /** Footprint of the tile, centre to centre of its outer walls. */
  size: number;
  /** Height of the tile's rim above the wave surface. */
  height: number;
  /** How far the skirt hangs below the surface. */
  depth: number;
  /** 45-degree bevel around the top edge. */
  chamfer: number;
  /** How far the centre of the top bulges above the rim. */
  domeRise: number;
  /** Subdivision of the domed top face, per axis. */
  topSegments: number;
};

/**
 * A single tile: a square plate whose top is a shallow pillow dome, with a
 * chamfered rim and a skirt hanging below the surface.
 *
 * The dome is the whole point. A flat top gives every tile in a neighbourhood
 * the same normal, so the field reads as one sheet of foil; a domed top sweeps
 * the reflected ray across the environment within each tile, which is what puts
 * the individual bar of highlight on every tile in the reference clip.
 *
 * The dome is `rise * (1 - u^2) * (1 - v^2)` over the top face's local
 * coordinates, so it falls to exactly zero at the rim and meets the chamfer
 * cleanly. Top normals are the analytic gradient of that surface; the chamfer
 * and skirt keep hard flat normals. Built non-indexed.
 */
export const createTileGeometry = ({
  size,
  height,
  depth,
  chamfer,
  domeRise,
  topSegments,
}: TileGeometryOptions): BufferGeometry => {
  const outer = size / 2;
  const inner = outer - chamfer;
  const rimY = height;
  const chamferY = height - chamfer;
  const bottomY = -depth;

  const positions: number[] = [];
  const normals: number[] = [];

  type Vertex = [number, number, number];

  const pushTriangle = (a: Vertex, b: Vertex, c: Vertex, faceNormals?: [Vertex, Vertex, Vertex]) => {
    let normalsForFace = faceNormals;

    if (normalsForFace === undefined) {
      const ux = b[0] - a[0];
      const uy = b[1] - a[1];
      const uz = b[2] - a[2];
      const vx = c[0] - a[0];
      const vy = c[1] - a[1];
      const vz = c[2] - a[2];
      let nx = uy * vz - uz * vy;
      let ny = uz * vx - ux * vz;
      let nz = ux * vy - uy * vx;
      const length = Math.hypot(nx, ny, nz) || 1;
      nx /= length;
      ny /= length;
      nz /= length;
      normalsForFace = [
        [nx, ny, nz],
        [nx, ny, nz],
        [nx, ny, nz],
      ];
    }

    const vertices: Vertex[] = [a, b, c];
    for (let i = 0; i < 3; i++) {
      positions.push(vertices[i][0], vertices[i][1], vertices[i][2]);
      normals.push(normalsForFace[i][0], normalsForFace[i][1], normalsForFace[i][2]);
    }
  };

  const pushQuad = (a: Vertex, b: Vertex, c: Vertex, d: Vertex) => {
    pushTriangle(a, b, c);
    pushTriangle(a, c, d);
  };

  // ------------------------------------------------------------------
  // Domed top face
  // ------------------------------------------------------------------
  const domeHeight = (u: number, v: number) => rimY + domeRise * (1 - u * u) * (1 - v * v);

  const domeNormal = (u: number, v: number): Vertex => {
    // Gradient of the dome, in local units: du/dx = 1/inner.
    const dfdx = (domeRise * -2 * u * (1 - v * v)) / inner;
    const dfdz = (domeRise * (1 - u * u) * -2 * v) / inner;
    const nx = -dfdx;
    const nz = -dfdz;
    const length = Math.hypot(nx, 1, nz) || 1;
    return [nx / length, 1 / length, nz / length];
  };

  const topVertex = (u: number, v: number): Vertex => [u * inner, domeHeight(u, v), v * inner];

  for (let i = 0; i < topSegments; i++) {
    for (let j = 0; j < topSegments; j++) {
      const u0 = (i / topSegments) * 2 - 1;
      const u1 = ((i + 1) / topSegments) * 2 - 1;
      const v0 = (j / topSegments) * 2 - 1;
      const v1 = ((j + 1) / topSegments) * 2 - 1;

      const a = topVertex(u0, v0);
      const b = topVertex(u0, v1);
      const c = topVertex(u1, v1);
      const d = topVertex(u1, v0);

      const na = domeNormal(u0, v0);
      const nb = domeNormal(u0, v1);
      const nc = domeNormal(u1, v1);
      const nd = domeNormal(u1, v0);

      pushTriangle(a, b, c, [na, nb, nc]);
      pushTriangle(a, c, d, [na, nc, nd]);
    }
  }

  // ------------------------------------------------------------------
  // Chamfered rim and vertical skirt
  //
  // Corner order is counter-clockwise seen from above (+Y).
  // ------------------------------------------------------------------
  const ring = (radius: number, y: number): Vertex[] => [
    [-radius, y, -radius],
    [-radius, y, radius],
    [radius, y, radius],
    [radius, y, -radius],
  ];

  const rim = ring(inner, rimY);
  const chamferRing = ring(outer, chamferY);
  const bottom = ring(outer, bottomY);

  for (let i = 0; i < 4; i++) {
    const j = (i + 1) % 4;
    pushQuad(rim[i], chamferRing[i], chamferRing[j], rim[j]);
    pushQuad(chamferRing[i], bottom[i], bottom[j], chamferRing[j]);
  }

  const geometry = new BufferGeometry();
  geometry.setAttribute('position', new BufferAttribute(new Float32Array(positions), 3));
  geometry.setAttribute('normal', new BufferAttribute(new Float32Array(normals), 3));
  return geometry;
};
