// Least-squares fit of the cool rig's light to the six measured probes.
// Unknowns: ambient A, key K, key direction (kx,ky,kz), fill F.
const srgbToLinear = (s) => { const v = s / 255; return v <= 0.04045 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4); };
const linearToSrgb = (l) => { const v = l <= 0.0031308 ? l * 12.92 : 1.055 * Math.pow(l, 1 / 2.4) - 0.055; return v * 255; };
const ALBEDO = 0.85, WRAP = 0.55, FWRAP = 0.6;
const FILLDIR = (() => { const v = [0, 0.2, 1], n = Math.hypot(...v); return v.map((x) => x / n); })();
const wrap = (d, w) => Math.max(0, Math.min(1, (d + w) / (1 + w)));
const dot = (a, b) => a[0]*b[0] + a[1]*b[1] + a[2]*b[2];

// normal, ambient-falloff factor g, measured sRGB target
const S = Math.SQRT1_2;
const PROBES = [
  { name: 'floor',    n: [0, 1, 0],     g: 0.998, target: 214.8 },
  { name: 'wall',     n: [0, 0, 1],     g: 0.974, target: 205.7 },
  { name: 'slabR',    n: [ S, 0, S],    g: 0.982, target: 223.1 },
  { name: 'slabL',    n: [-S, 0, S],    g: 0.982, target: 180.6 },
  // Cylinder probe points, normals read off their screen offset from the axis.
  { name: 'cylL',     n: [-0.757, 0, 0.653], g: 0.982, target: 182.7 },
  { name: 'cylR',     n: [ 0.457, 0, 0.889], g: 0.982, target: 216.8 },
];

const predict = (p, [A, K, kx, ky, kz, F]) => {
  const n = Math.hypot(kx, ky, kz) || 1;
  const k = [kx / n, ky / n, kz / n];
  const irr = A * p.g + K * wrap(dot(p.n, k), WRAP) + F * wrap(dot(p.n, FILLDIR), FWRAP);
  return linearToSrgb(ALBEDO * irr);
};
const cost = (x) => {
  if (x[0] < 0 || x[1] < 0 || x[5] < 0) return 1e9;
  return PROBES.reduce((s, p) => s + (predict(p, x) - p.target) ** 2, 0);
};

// Coordinate descent with shrinking steps - tiny problem, no need for anything clever.
let x = [0.518, 0.38, 0.8, 0.56, 0.21, 0.02];
let step = [0.05, 0.05, 0.1, 0.1, 0.1, 0.01];
for (let iter = 0; iter < 4000; iter++) {
  for (let i = 0; i < x.length; i++) {
    const base = cost(x);
    for (const d of [step[i], -step[i]]) {
      const trial = x.slice(); trial[i] += d;
      if (cost(trial) < base) { x = trial; break; }
    }
  }
  if (iter % 200 === 199) step = step.map((s) => s * 0.75);
}
const n = Math.hypot(x[2], x[3], x[4]);
console.log('ambient      ', x[0].toFixed(4));
console.log('key          ', x[1].toFixed(4));
console.log('keyDir       ', [x[2]/n, x[3]/n, x[4]/n].map((v) => v.toFixed(4)).join(', '));
console.log('fill         ', x[5].toFixed(4));
console.log('\nprobe       target   predicted   delta');
for (const p of PROBES) {
  const v = predict(p, x);
  console.log(p.name.padEnd(10) + p.target.toFixed(1).padStart(7) + v.toFixed(1).padStart(12) + (v - p.target >= 0 ? '   +' : '   ') + (v - p.target).toFixed(1));
}
console.log('\nRMS error: ' + Math.sqrt(cost(x) / PROBES.length).toFixed(2) + ' sRGB levels');
void srgbToLinear;
