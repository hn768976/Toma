import * as THREE from "three";

export const linColor = (hex: string) => new THREE.Color(hex); // three converts sRGB hex → linear working space

export const instanced = (base: THREE.BufferGeometry, count: number, attrs: Record<string, { size: number; data: Float32Array }>) => {
  const g = new THREE.InstancedBufferGeometry();
  g.index = base.index;
  for (const k of Object.keys(base.attributes)) g.setAttribute(k, base.attributes[k]);
  for (const [k, v] of Object.entries(attrs)) g.setAttribute(k, new THREE.InstancedBufferAttribute(v.data, v.size));
  g.instanceCount = count;
  return g;
};

export const quadGeo = () => {
  const g = new THREE.BufferGeometry();
  g.setAttribute("position", new THREE.BufferAttribute(new Float32Array([0, 0, 0, 1, 0, 0, 1, 1, 0, 0, 1, 0]), 3));
  g.setAttribute("uv", new THREE.BufferAttribute(new Float32Array([0, 0, 1, 0, 1, 1, 0, 1]), 2));
  g.setIndex([0, 1, 2, 0, 2, 3]);
  return g;
};

// strip of `seg` segments: uv.x 0..1 along, uv.y -1..1 across
export const stripGeo = (seg: number) => {
  const pos: number[] = [];
  const uv: number[] = [];
  const idx: number[] = [];
  for (let i = 0; i <= seg; i++) {
    const t = i / seg;
    pos.push(t, -1, 0, t, 1, 0);
    uv.push(t, -1, t, 1);
    if (i < seg) {
      const a = i * 2;
      idx.push(a, a + 1, a + 2, a + 1, a + 3, a + 2);
    }
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute("position", new THREE.BufferAttribute(new Float32Array(pos), 3));
  g.setAttribute("uv", new THREE.BufferAttribute(new Float32Array(uv), 2));
  g.setIndex(idx);
  return g;
};

export const smoothstep = (a: number, b: number, x: number) => {
  const t = Math.min(1, Math.max(0, (x - a) / (b - a)));
  return t * t * (3 - 2 * t);
};
export const clamp01 = (x: number) => Math.min(1, Math.max(0, x));
export const lerp = (a: number, b: number, t: number) => a + (b - a) * t;
