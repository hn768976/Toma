import { seededRandom } from "../random";

export type OrbPoint = {
  x: number;
  y: number;
  z: number;
  sizeScale: number;
  alphaScale: number;
  bright: boolean;
};

export const POINT_COUNT = 3200;

const GOLDEN_ANGLE = Math.PI * (3 - Math.sqrt(5));

// A Fibonacci-sphere distribution, generated once at module scope.
// Sampling spherical coordinates uniformly at random instead clumps
// points at the poles, which is plainly visible on a rotating orb and
// reads as a mistake. The jitter is small and seeded — enough to break up
// the spiral the lattice would otherwise show, never enough to clump.
const buildPoints = (count: number): OrbPoint[] => {
  const points: OrbPoint[] = [];
  for (let i = 0; i < count; i++) {
    const theta = GOLDEN_ANGLE * i + (seededRandom(i, 3) - 0.5) * 0.06;
    const yEven = 1 - (2 * (i + 0.5)) / count;
    const y = Math.max(-1, Math.min(1, yEven + (seededRandom(i, 5) - 0.5) * 0.012));
    const ringRadius =
      Math.sqrt(Math.max(0, 1 - y * y)) * (0.995 + seededRandom(i, 9) * 0.01);

    points.push({
      x: Math.cos(theta) * ringRadius,
      y,
      z: Math.sin(theta) * ringRadius,
      sizeScale: 0.78 + seededRandom(i, 11) * 0.5,
      alphaScale: 0.72 + seededRandom(i, 17) * 0.42,
      bright: seededRandom(i, 23) < 0.035,
    });
  }
  return points;
};

export const ORB_POINTS: OrbPoint[] = buildPoints(POINT_COUNT);
