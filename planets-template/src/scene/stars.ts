// Procedural star field, generated once at module load from a fixed seed
// (mulberry32), so every render thread builds the identical field.
import * as THREE from "three";

export function mulberry32(seed: number) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const STAR_COUNT = 6000;
const RADIUS = 800;
// Stars fill a cone around the view direction (-Z from the camera), which
// covers every framing and the camera drift with margin.
const CONE_DEG = 24;

const rand = mulberry32(0x5eed5a7);
const positions = new Float32Array(STAR_COUNT * 3);
const sizes = new Float32Array(STAR_COUNT);
const brights = new Float32Array(STAR_COUNT);
const tints = new Float32Array(STAR_COUNT * 3);
{
  const cosMax = Math.cos((CONE_DEG * Math.PI) / 180);
  for (let i = 0; i < STAR_COUNT; i++) {
    const cz = 1 - rand() * (1 - cosMax);
    const phi = rand() * Math.PI * 2;
    const sz = Math.sqrt(1 - cz * cz);
    positions[i * 3] = RADIUS * sz * Math.cos(phi);
    positions[i * 3 + 1] = RADIUS * sz * Math.sin(phi);
    positions[i * 3 + 2] = -RADIUS * cz;
    // Magnitude-like distribution: most stars very faint, a few brighter.
    const m = rand();
    brights[i] = 0.10 + 0.70 * Math.pow(m, 8) + 0.22 * Math.pow(m, 2);
    sizes[i] = 0.9 + 0.65 * Math.pow(rand(), 3) + 0.6 * Math.pow(m, 12);
    const k = rand();
    let tint = [1, 1, 1];
    if (k < 0.06) tint = [0.78, 0.86, 1.0]; // blue-white
    else if (k < 0.11) tint = [1.0, 0.86, 0.68]; // warm
    tints.set(tint, i * 3);
  }
}

export function makeStarGeometry() {
  const g = new THREE.BufferGeometry();
  g.setAttribute("position", new THREE.BufferAttribute(positions, 3));
  g.setAttribute("aSize", new THREE.BufferAttribute(sizes, 1));
  g.setAttribute("aBright", new THREE.BufferAttribute(brights, 1));
  g.setAttribute("aTint", new THREE.BufferAttribute(tints, 3));
  return g;
}
