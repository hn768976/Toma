// AgX forward + inverse, mirroring src/lib/tonemap.ts, for the CLI tools.
const M = (m, v) => [
  m[0][0] * v[0] + m[0][1] * v[1] + m[0][2] * v[2],
  m[1][0] * v[0] + m[1][1] * v[1] + m[1][2] * v[2],
  m[2][0] * v[0] + m[2][1] * v[1] + m[2][2] * v[2],
];
const SRGB_TO_REC2020 = [[0.6274, 0.3293, 0.0433], [0.0691, 0.9195, 0.088], [0.0164, 0.0113, 0.8956]];
const REC2020_TO_SRGB = [[1.6605, -0.5876, -0.0728], [-0.1246, 1.1329, -0.1006], [-0.0182, -0.0083, 1.1187]];
const INSET = [[0.856627153315983, 0.0951212405381588, 0.0482516061458583], [0.137318972929847, 0.761241990602591, 0.101439036467562], [0.11189821299995, 0.0767994186031903, 0.811302368396859]];
const OUTSET = [[1.1271005818144368, -0.11060664309660323, -0.016493938717834573], [-0.1413297634984383, 1.157823702216272, -0.016493938717834257], [-0.14132976349843826, -0.11060664309660294, 1.2519364065950405]];
const MIN_EV = -12.47393, MAX_EV = 4.026069;
const approx = (x) => { const x2 = x * x, x4 = x2 * x2; return 15.5 * x4 * x2 - 40.14 * x4 * x + 31.96 * x4 - 6.868 * x2 * x + 0.4298 * x2 + 0.1191 * x - 0.00232; };
const cl = (v) => Math.min(1, Math.max(0, v));

export const agx = (rgb) => {
  let c = M(INSET, M(SRGB_TO_REC2020, rgb));
  c = c.map((v) => approx(cl((Math.log2(Math.max(v, 1e-10)) - MIN_EV) / (MAX_EV - MIN_EV))));
  return M(REC2020_TO_SRGB, M(OUTSET, c).map((v) => Math.pow(Math.max(0, v), 2.2))).map(cl);
};

const solve3 = (m, b) => {
  const a = m.map((r, i) => [...r, b[i]]);
  for (let c = 0; c < 3; c++) {
    let p = c;
    for (let r = c + 1; r < 3; r++) if (Math.abs(a[r][c]) > Math.abs(a[p][c])) p = r;
    if (Math.abs(a[p][c]) < 1e-14) return null;
    [a[c], a[p]] = [a[p], a[c]];
    for (let r = 0; r < 3; r++) {
      if (r === c) continue;
      const f = a[r][c] / a[c][c];
      for (let k = c; k < 4; k++) a[r][k] -= f * a[c][k];
    }
  }
  return [a[0][3] / a[0][0], a[1][3] / a[1][1], a[2][3] / a[2][2]];
};

const srgbToLinear = (c) => (c <= 0.04045 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4));

export const preToneMapSolve = (hexStr) => {
  const n = parseInt(hexStr.replace("#", ""), 16);
  const target = [(n >> 16) & 255, (n >> 8) & 255, n & 255].map((v) => srgbToLinear(v / 255));
  if (target.every((c) => c <= 0)) return { linear: { r: 0, g: 0, b: 0 }, error: 0 };
  let u = target.map((c) => Math.log(Math.max(c, 1e-5)));
  const res = (v) => { const g = agx(v.map(Math.exp)); return [g[0] - target[0], g[1] - target[1], g[2] - target[2]]; };
  let best = [...u], bestErr = Infinity;
  for (let it = 0; it < 300; it++) {
    const r = res(u);
    const e = Math.max(...r.map(Math.abs));
    if (e < bestErr) { bestErr = e; best = [...u]; }
    if (e < 1e-9) break;
    const h = 1e-5, J = [[0, 0, 0], [0, 0, 0], [0, 0, 0]];
    for (let c = 0; c < 3; c++) { const up = [...u]; up[c] += h; const ru = res(up); for (let q = 0; q < 3; q++) J[q][c] = (ru[q] - r[q]) / h; }
    const st = solve3(J, r);
    if (!st) break;
    let d = 1, moved = false;
    for (let t = 0; t < 30; t++) {
      const nx = u.map((x, i) => x - st[i] * d);
      if (Math.max(...res(nx).map(Math.abs)) < e) { u = nx; moved = true; break; }
      d *= 0.5;
    }
    if (!moved) break;
  }
  const l = best.map(Math.exp);
  return { linear: { r: l[0], g: l[1], b: l[2] }, error: bestErr };
};
