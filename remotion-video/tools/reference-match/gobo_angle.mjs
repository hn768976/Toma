// Solve the in-plane rotation that makes the projected bands land at the
// slope measured off the reference, and the period that gives its spacing.
const norm = (v) => { const n = Math.hypot(...v); return v.map((x) => x / n); };
const cross = (a, b) => [a[1]*b[2]-a[2]*b[1], a[2]*b[0]-a[0]*b[2], a[0]*b[1]-a[1]*b[0]];

const L = norm([0.46, -0.5, -0.73]);
const helper = Math.abs(L[1]) > 0.9 ? [1,0,0] : [0,1,0];
const gU = norm(cross(helper, L));
const gV = norm(cross(L, gU));

// Bands are lines of constant px = u*cos(a) - v*sin(a) on the wall (z fixed).
// px = A*x + B*y + const, and the band direction has slope dx/dy = -B/A.
const coeffs = (a) => [
  Math.cos(a)*gU[0] - Math.sin(a)*gV[0],
  Math.cos(a)*gU[1] - Math.sin(a)*gV[1],
];
const TARGET_SLOPE = -2.0;   // measured: down 1, right 2  (~27 deg from horizontal)
let best = null;
for (let deg = 0; deg < 180; deg += 0.01) {
  const [A, B] = coeffs((deg * Math.PI) / 180);
  if (Math.abs(A) < 1e-6) continue;
  const err = Math.abs(-B / A - TARGET_SLOPE);
  if (!best || err < best.err) best = { deg, err, A, B };
}
const { deg, A, B } = best;

// Reference band spacing: ~256px horizontally. Convert to world at the wall.
const FOV_V = 16.92, ASPECT = 16 / 9, WALL_DIST = 14.35;
const halfWidthWorld = WALL_DIST * Math.tan((FOV_V/2) * Math.PI/180) * ASPECT;
const worldPerPx = (2 * halfWidthWorld) / 768;
const spacingWorld = 256 * worldPerPx;
const period = spacingWorld * Math.abs(A);

console.log('gU', gU.map(v=>v.toFixed(4)).join(', '));
console.log('gV', gV.map(v=>v.toFixed(4)).join(', '));
console.log('\nangleDeg   ', deg.toFixed(2));
console.log('slope dx/dy', (-B/A).toFixed(3), ' (target', TARGET_SLOPE + ')');
console.log('band tilt  ', (Math.atan(1/Math.abs(B/A)) * 180/Math.PI).toFixed(1), 'deg from horizontal');
console.log('world/px   ', worldPerPx.toFixed(4));
console.log('period     ', period.toFixed(3));
console.log('perp spacing', (period / Math.hypot(A,B) / worldPerPx).toFixed(0), 'px  (reference ~115px)');
