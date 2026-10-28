// Signed distance (board units) to the classic cloud-icon silhouette:
// two large top lobes, two smaller side lobes and a flat base.
// Negative inside, positive outside.

type Circle = [cx: number, cy: number, r: number];

// Flat base: a horizontal capsule from BASE_X0 to BASE_X1 at BASE_Y.
const BASE_X0 = -2.15;
const BASE_X1 = 2.45;
const BASE_Y = -0.75;
const BASE_R = 0.8;
const LOBES: Circle[] = [
  [-2.1, -0.25, 0.95], // left side lobe
  [-0.6, 0.6, 1.58], // left top lobe (largest)
  [1.35, 0.4, 1.2], // right top lobe
  [2.6, -0.32, 0.88], // right side lobe
];
const BLEND = 0.18;

const smin = (a: number, b: number, k: number) => {
  const h = Math.max(k - Math.abs(a - b), 0) / k;
  return Math.min(a, b) - (h * h * k) / 4;
};

export const CLOUD_BOUNDS = { minX: -3.2, maxX: 3.6, minY: -1.65, maxY: 2.1 };

export const cloudSdf = (x: number, y: number) => {
  const px = Math.min(Math.max(x, BASE_X0), BASE_X1);
  let d = Math.hypot(x - px, y - BASE_Y) - BASE_R;
  for (const [cx, cy, r] of LOBES) {
    d = smin(d, Math.hypot(x - cx, y - cy) - r, BLEND);
  }
  return d;
};

const f = (n: number) => n.toFixed(3);

// GLSL twin of cloudSdf, used to tuck circuit traces behind the icon.
export const CLOUD_SDF_GLSL = /* glsl */ `
float cSmin(float a, float b, float k) {
  float h = max(k - abs(a - b), 0.0) / k;
  return min(a, b) - h * h * k / 4.0;
}
float cloudSdf(vec2 p) {
  float d = length(p - vec2(clamp(p.x, ${f(BASE_X0)}, ${f(BASE_X1)}), ${f(BASE_Y)})) - ${f(BASE_R)};
  ${LOBES.map(
    ([cx, cy, r]) =>
      `d = cSmin(d, length(p - vec2(${f(cx)}, ${f(cy)})) - ${f(r)}, ${f(BLEND)});`,
  ).join("\n  ")}
  return d;
}
`;
