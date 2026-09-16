import { BufferAttribute, BufferGeometry } from "three/webgpu";

/**
 * Parameters of the spiral-fluted sphere.
 *
 * The surface is a radial displacement over a sphere:
 *
 *   radius(a, p) = sphereRadius + amplitude(a) * lobe(psi)
 *   psi          = p + twist * (a / PI)^twistPower
 *   amplitude(a) = ribAmplitude * sin(a)^ribGrowth
 *
 * `a` is the polar angle from the pole the flutes converge at and `p` the
 * azimuth. `lobe` is |cos(ribs * psi / 2)| raised to a power below 1, which
 * gives fat rounded tubes separated by thin creases. Amplitude vanishes at both
 * poles and peaks at the equator, so the tubes taper to nothing exactly where
 * they converge — the detail that reads as the bright core in the reference.
 *
 * Crucially the displacement is invariant under `psi -> psi + 2*PI/ribs`, so
 * spinning the finished mesh about its pole by exactly one rib period
 * reproduces the opening frame. That is what makes the loop seamless without
 * re-displacing any geometry per frame.
 */
export type SurfaceParams = {
  /** Number of tubes around the full turn. Sets the loop rotation (2PI/ribs). */
  ribs: number;
  sphereRadius: number;
  /** Tube height at the equator. */
  ribAmplitude: number;
  /** How quickly tubes fatten away from the poles. */
  ribGrowth: number;
  /** Cross-section fatness. Below 1 = fat tubes with sharp creases. */
  ribSharpness: number;
  /** Total spiral wind, in radians, from pole to pole. */
  twist: number;
  /** Shapes where along the sphere the wind happens. */
  twistPower: number;
  /** Asymmetric lean baked into each tube. Must stay rib-periodic. */
  lean: number;
  /** Grid density. */
  polarSegments: number;
  angularSegments: number;
};

export const DEFAULT_SURFACE: SurfaceParams = {
  ribs: 16,
  sphereRadius: 5,
  ribAmplitude: 0.52,
  ribGrowth: 1.15,
  ribSharpness: 0.58,
  twist: 1.7,
  twistPower: 0.9,
  lean: 0.16,
  polarSegments: 320,
  angularSegments: 1600,
};

const radiusAt = (alpha: number, phi: number, p: SurfaceParams): number => {
  const t = alpha / Math.PI;
  const psi = phi + p.twist * Math.pow(t, p.twistPower);

  // |cos(n*psi/2)| has period 2PI/n, so this yields exactly `ribs` lobes.
  const lobe = Math.pow(Math.abs(Math.cos(p.ribs * psi * 0.5)), p.ribSharpness);
  // Rib-periodic, so it leans every tube the same way without breaking the loop.
  const lean = 1 + p.lean * Math.sin(p.ribs * psi);

  const amplitude =
    p.ribAmplitude * Math.pow(Math.max(0, Math.sin(alpha)), p.ribGrowth);
  return p.sphereRadius + amplitude * lobe * lean;
};

const positionAt = (
  alpha: number,
  phi: number,
  p: SurfaceParams,
  out: { x: number; y: number; z: number },
) => {
  const r = radiusAt(alpha, phi, p);
  const sa = Math.sin(alpha);
  out.x = r * sa * Math.cos(phi);
  out.y = r * Math.cos(alpha);
  out.z = r * sa * Math.sin(phi);
};

/**
 * Builds the fluted sphere as an indexed geometry with smooth normals taken
 * from central differences of the surface. Differencing beats
 * `computeVertexNormals()` here: the creases between tubes are near-cusps, and
 * face-averaged normals visibly facet them at 4K.
 */
export const buildSpiralSurface = (p: SurfaceParams): BufferGeometry => {
  const rings = p.polarSegments + 1;
  const spokes = p.angularSegments;
  const count = rings * spokes;

  const positions = new Float32Array(count * 3);
  const normals = new Float32Array(count * 3);
  const uvs = new Float32Array(count * 2);

  const dPhi = (Math.PI * 2) / spokes;
  const dAlpha = Math.PI / p.polarSegments;
  // Differencing steps, matched to the grid so creases stay smooth.
  const hA = dAlpha;
  const hP = dPhi;

  const a1 = { x: 0, y: 0, z: 0 };
  const a2 = { x: 0, y: 0, z: 0 };
  const p1 = { x: 0, y: 0, z: 0 };
  const p2 = { x: 0, y: 0, z: 0 };
  const here = { x: 0, y: 0, z: 0 };

  for (let i = 0; i < rings; i++) {
    const alpha = i * dAlpha;
    // The rings at alpha 0 and PI collapse to a point, where the tangent frame
    // is undefined and differencing produces a visible speck. Those two rings
    // get the exact pole normal instead.
    const atPole = i === 0 || i === p.polarSegments;

    for (let j = 0; j < spokes; j++) {
      const phi = j * dPhi;
      positionAt(alpha, phi, p, here);

      const idx = i * spokes + j;
      positions[idx * 3] = here.x;
      positions[idx * 3 + 1] = here.y;
      positions[idx * 3 + 2] = here.z;

      if (atPole) {
        const sign = i === 0 ? 1 : -1;
        normals[idx * 3] = 0;
        normals[idx * 3 + 1] = sign;
        normals[idx * 3 + 2] = 0;
        uvs[idx * 2] = j / spokes;
        uvs[idx * 2 + 1] = i / p.polarSegments;
        continue;
      }

      positionAt(alpha + hA, phi, p, a2);
      positionAt(alpha - hA, phi, p, a1);
      positionAt(alpha, phi + hP, p, p2);
      positionAt(alpha, phi - hP, p, p1);

      const daX = a2.x - a1.x;
      const daY = a2.y - a1.y;
      const daZ = a2.z - a1.z;
      const dpX = p2.x - p1.x;
      const dpY = p2.y - p1.y;
      const dpZ = p2.z - p1.z;

      // n = dPhi x dAlpha, which points outwards on a sphere.
      let nx = dpY * daZ - dpZ * daY;
      let ny = dpZ * daX - dpX * daZ;
      let nz = dpX * daY - dpY * daX;
      const len = Math.hypot(nx, ny, nz) || 1;
      nx /= len;
      ny /= len;
      nz /= len;
      // Guard the degenerate rings next to the poles.
      const outward = nx * here.x + ny * here.y + nz * here.z < 0 ? -1 : 1;

      normals[idx * 3] = nx * outward;
      normals[idx * 3 + 1] = ny * outward;
      normals[idx * 3 + 2] = nz * outward;

      uvs[idx * 2] = j / spokes;
      uvs[idx * 2 + 1] = i / p.polarSegments;
    }
  }

  // Two triangles per quad, wound so the outward face is the front face. The
  // azimuth axis wraps, so there is no seam.
  const indices = new Uint32Array(p.polarSegments * spokes * 6);
  let k = 0;
  for (let i = 0; i < p.polarSegments; i++) {
    for (let j = 0; j < spokes; j++) {
      const jn = (j + 1) % spokes;
      const a = i * spokes + j;
      const b = i * spokes + jn;
      const c = (i + 1) * spokes + j;
      const d = (i + 1) * spokes + jn;
      indices[k++] = a;
      indices[k++] = b;
      indices[k++] = c;
      indices[k++] = b;
      indices[k++] = d;
      indices[k++] = c;
    }
  }

  const geometry = new BufferGeometry();
  geometry.setAttribute("position", new BufferAttribute(positions, 3));
  geometry.setAttribute("normal", new BufferAttribute(normals, 3));
  geometry.setAttribute("uv", new BufferAttribute(uvs, 2));
  geometry.setIndex(new BufferAttribute(indices, 1));
  geometry.computeBoundingSphere();
  return geometry;
};
