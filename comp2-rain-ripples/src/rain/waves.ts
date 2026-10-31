// CPU-side generation of the 18 background wave trains (uploaded as
// uniforms so the fragment shader does not re-derive them per pixel).

const mulberry32 = (seed: number) => {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
};

export const WAVE_COUNT = 18;

export const buildWaves = (seed: number) => {
  const rnd = mulberry32(seed * 7919 + 17);
  const a = new Float32Array(WAVE_COUNT * 4); // dir.x, dir.y, k, omega
  const b = new Float32Array(WAVE_COUNT * 2); // amplitude, phase
  for (let i = 0; i < WAVE_COUNT; i++) {
    const r1 = rnd();
    const r2 = rnd();
    const r3 = rnd();
    // Band A (12 trains): short chop 0.0125…0.0375 frame widths travelling
    // mostly along world-y, so the glints stretch across the frame.
    // Band B (6 trains): longer swell 0.04…0.09, any direction, softer.
    const bandA = i < 12;
    const lambda = bandA
      ? 0.0125 * Math.pow(3.0, i / 11) * (0.85 + 0.3 * r1)
      : 0.04 * Math.pow(2.2, (i - 12) / 5) * (0.85 + 0.3 * r1);
    const ang = bandA ? Math.PI / 2 + (r2 - 0.5) * 2.5 : r2 * Math.PI * 2;
    const weight = bandA ? 1 : 0.45;
    const k = (Math.PI * 2) / lambda;
    // deep-water-like dispersion, capped < ~0.8 rad/frame at 30 fps
    // so wave crests never strobe (temporal aliasing).
    const omega = 0.75 * Math.sqrt(k);
    a.set([Math.cos(ang), Math.sin(ang), k, omega], i * 4);
    b.set([weight * lambda, r3 * Math.PI * 2], i * 2);
  }
  return { a, b };
};
