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

export const WAVE_COUNT = 24;

export const buildWaves = (seed: number) => {
  const rnd = mulberry32(seed * 7919 + 17);
  const a = new Float32Array(WAVE_COUNT * 4); // dir.x, dir.y, k, omega
  const b = new Float32Array(WAVE_COUNT * 2); // amplitude, phase
  for (let i = 0; i < WAVE_COUNT; i++) {
    const r1 = rnd();
    const r2 = rnd();
    const r3 = rnd();
    // Three bands:
    //  0– 7 broad swell      0.035…0.10 W   strongest
    //  8–15 medium chop      0.014…0.030 W  softened
    // 16–23 fine capillaries 0.0065…0.013 W → sharp, fast glitter
    const band = Math.floor(i / 8);
    const j = (i % 8) / 7;
    const lambda =
      (band === 0
        ? 0.035 * Math.pow(0.1 / 0.035, j)
        : band === 1
          ? 0.014 * Math.pow(0.03 / 0.014, j)
          : 0.0065 * Math.pow(0.013 / 0.0065, j)) *
      (0.9 + 0.2 * r1);
    const weight = band === 0 ? 1.0 : band === 1 ? 0.9 : 0.1;
    // swell: isotropic golden-angle fan; chop & capillaries: symmetric fan
    // around world-y (crests run across frame → horizontally elongated
    // glints, as in the reference) with no net diagonal bias.
    const ang =
      band === 0
        ? i * 2.39996 + (r2 - 0.5) * 0.3
        : Math.PI / 2 + (((i * 5) % 8) / 7 - 0.5) * 2.2 + (r2 - 0.5) * 0.15;
    const k = (Math.PI * 2) / lambda;
    // dispersion; fine waves move fastest (glitter decorrelates quickly)
    // but stay < 1.4 rad/frame at 30 fps so crests never strobe.
    const omega = Math.min(1.1 * Math.sqrt(k), 42);
    a.set([Math.cos(ang), Math.sin(ang), k, omega], i * 4);
    b.set([weight * lambda, r3 * Math.PI * 2], i * 2);
  }
  return { a, b };
};
