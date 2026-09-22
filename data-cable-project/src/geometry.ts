import {
  BufferGeometry,
  CatmullRomCurve3,
  Curve,
  Float32BufferAttribute,
  Vector3,
} from "three";

/** A gently bowed band sweeping across frame, receding as it goes. */
export type BandSpec = {
  /** Screen-plane direction of the band, degrees. 0 = horizontal. */
  angleDeg: number;
  /** Half-length; must be long enough that both ends leave the frame. */
  length: number;
  /** Centre of the band. */
  center: [number, number, number];
  /** Parabolic bow perpendicular to the band, in the screen plane. */
  bow: number;
  /** Parabolic bow in depth -- this is what makes an arc recede. */
  zBow: number;
  /** Extra depth added linearly from one end to the other. */
  zTilt: number;
};

export const makeBandCurve = (spec: BandSpec): CatmullRomCurve3 => {
  const rad = (spec.angleDeg * Math.PI) / 180;
  const dir = new Vector3(Math.cos(rad), Math.sin(rad), 0);
  const perp = new Vector3(-Math.sin(rad), Math.cos(rad), 0);
  const [cx, cy, cz] = spec.center;

  const points: Vector3[] = [];
  const SEGS = 24;
  for (let i = 0; i <= SEGS; i++) {
    const t = (i / SEGS) * 2 - 1; // -1 .. 1
    const falloff = 1 - t * t;
    const p = new Vector3(cx, cy, cz)
      .addScaledVector(dir, t * spec.length)
      .addScaledVector(perp, spec.bow * falloff);
    p.z += spec.zBow * falloff + spec.zTilt * t;
    points.push(p);
  }
  return new CatmullRomCurve3(points, false, "centripetal", 0.5);
};

/** A near-straight cable with a slight sag, for the rack and bundle looks. */
export type CableSpec = {
  /** Start and end in world space. */
  from: [number, number, number];
  to: [number, number, number];
  /** Downward sag at mid-span. */
  sag: number;
};

export const makeCableCurve = (spec: CableSpec): CatmullRomCurve3 => {
  const a = new Vector3(...spec.from);
  const b = new Vector3(...spec.to);
  const points: Vector3[] = [];
  const SEGS = 12;
  for (let i = 0; i <= SEGS; i++) {
    const t = i / SEGS;
    const p = a.clone().lerp(b, t);
    p.y -= spec.sag * Math.sin(Math.PI * t);
    points.push(p);
  }
  return new CatmullRomCurve3(points, false, "centripetal", 0.5);
};

/**
 * Sweep a shallow-arc cross-section along a curve to make a flat ribbon.
 *
 * The arc matters: a truly flat strip reads as a decal stuck in space. A few
 * degrees of curvature across the width gives the fresnel term something to
 * work with, so shading varies from one edge to the other.
 *
 * u runs along the length, v across the width -- the same convention as
 * TubeGeometry, so one material serves both looks.
 */
export const buildRibbonGeometry = (
  curve: Curve<Vector3>,
  width: number,
  arcDeg: number,
  segsU: number,
  segsV: number,
  facing: Vector3 = new Vector3(0, 0, 1),
): BufferGeometry => {
  const arc = (arcDeg * Math.PI) / 180;
  // Radius that makes the chord across the arc equal the requested width.
  const radius = width / 2 / Math.sin(arc / 2);
  const depthOffset = radius * Math.cos(arc / 2);

  // Frenet frames twist as the curve bends through depth, which turns a band
  // edge-on to the camera and leaves a bright sliver instead of a ribbon.
  // Framing against a fixed facing direction keeps every band presented to the
  // viewer, exactly as the references show them.
  const positions: number[] = [];
  const normals: number[] = [];
  const uvs: number[] = [];

  for (let i = 0; i <= segsU; i++) {
    const t = i / segsU;
    const point = curve.getPointAt(t);
    const tangent = curve.getTangentAt(t).normalize();
    const B = new Vector3().crossVectors(facing, tangent).normalize();
    const N = new Vector3().crossVectors(tangent, B).normalize();

    for (let j = 0; j <= segsV; j++) {
      const v = j / segsV;
      const angle = (v - 0.5) * arc;
      const sin = Math.sin(angle);
      const cos = Math.cos(angle);

      positions.push(
        point.x + B.x * radius * sin + N.x * (radius * cos - depthOffset),
        point.y + B.y * radius * sin + N.y * (radius * cos - depthOffset),
        point.z + B.z * radius * sin + N.z * (radius * cos - depthOffset),
      );
      normals.push(
        B.x * sin + N.x * cos,
        B.y * sin + N.y * cos,
        B.z * sin + N.z * cos,
      );
      uvs.push(t, v);
    }
  }

  const indices: number[] = [];
  for (let i = 0; i < segsU; i++) {
    for (let j = 0; j < segsV; j++) {
      const a = i * (segsV + 1) + j;
      const b = a + segsV + 1;
      indices.push(a, b, a + 1, b, b + 1, a + 1);
    }
  }

  const geometry = new BufferGeometry();
  geometry.setAttribute("position", new Float32BufferAttribute(positions, 3));
  geometry.setAttribute("normal", new Float32BufferAttribute(normals, 3));
  geometry.setAttribute("uv", new Float32BufferAttribute(uvs, 2));
  geometry.setIndex(indices);
  return geometry;
};
