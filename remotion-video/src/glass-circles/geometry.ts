import { LatheGeometry, TorusGeometry, Vector2 } from "three/webgpu";

/**
 * A disc of glass with a fully rounded rim -- a lens blank.
 *
 * The profile is lathed around Y and then rotated so the disc faces the camera
 * down -Z. Outer radius is `radius`; the rounded rim occupies the outermost
 * `halfThickness`, which is exactly where {@link makeRimGeometry} sits.
 */
export const makeLensGeometry = (
  radius: number,
  halfThickness: number,
  radialSegments: number,
  rimSegments = 12,
): LatheGeometry => {
  const h = halfThickness;
  const inner = Math.max(radius - h, radius * 0.01);
  const points: Vector2[] = [];

  // Top face, centre outwards.
  points.push(new Vector2(0, h));
  points.push(new Vector2(inner, h));
  // Rounded rim, top to bottom, through the outermost point.
  for (let i = 1; i < rimSegments; i++) {
    const a = (i / rimSegments) * Math.PI;
    points.push(new Vector2(inner + h * Math.sin(a), h * Math.cos(a)));
  }
  // Bottom face, outwards back to centre.
  points.push(new Vector2(inner, -h));
  points.push(new Vector2(0, -h));

  const geometry = new LatheGeometry(points, radialSegments);
  // Lathe builds around Y; stand the disc up so it faces the camera.
  geometry.rotateX(Math.PI / 2);
  return geometry;
};

/**
 * The rim highlight shell: a torus laid exactly over the lens's rounded edge,
 * drawn additively so every circle's edge stays visible through the others --
 * which is what both references do where the circles overlap.
 */
export const makeRimGeometry = (
  radius: number,
  halfThickness: number,
  tubularSegments: number,
  radialSegments = 20,
): TorusGeometry =>
  new TorusGeometry(
    Math.max(radius - halfThickness, halfThickness),
    halfThickness,
    radialSegments,
    tubularSegments,
  );
