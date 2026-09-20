// Evaluate the gobo mask over the visible backdrop using exactly the shader's
// math, so contrast / poolStrength / poolMean can be set from real statistics
// instead of guessed.
const norm = (v) => { const n = Math.hypot(...v); return v.map(x => x/n); };
const cross = (a,b) => [a[1]*b[2]-a[2]*b[1], a[2]*b[0]-a[0]*b[2], a[0]*b[1]-a[1]*b[0]];
const dot = (a,b) => a[0]*b[0]+a[1]*b[1]+a[2]*b[2];
const smoothstep = (e0,e1,x) => { const t=Math.max(0,Math.min(1,(x-e0)/(e1-e0))); return t*t*(3-2*t); };
const TAU = Math.PI*2;

const G = {
  contrast: Number(process.argv[2] ?? 0.19),
  poolStrength: Number(process.argv[3] ?? 0.23),
  poolCentre: [Number(process.argv[4] ?? -3.39), Number(process.argv[5] ?? 0.51)],
  poolRadius: Number(process.argv[6] ?? 3.4),
  period: 1.074, angleDeg: 78.94, lightDir: [0.46,-0.5,-0.73], breathe: 0.16,
};
const L = norm(G.lightDir);
const gU = norm(cross(Math.abs(L[1])>0.9?[1,0,0]:[0,1,0], L));
const gV = norm(cross(L, gU));
const a = G.angleDeg*Math.PI/180, ca = Math.cos(a), sa = Math.sin(a);

// Camera / set, matching the cool variant.
const CAM=[0,1.44,12], AIM_Y=1.2625, FOV=16.92, ASPECT=16/9;
const axis = Math.atan((CAM[1]-AIM_Y)/12);           // radians, downward
const halfV = FOV/2*Math.PI/180;
const WALL_Z = -2.05-0.3, WALL_DIST = CAM[2]-WALL_Z;

const maskAt = (P, phase) => {
  const u = dot(P,gU), v = dot(P,gV);
  const px = u*ca - v*sa, py = u*sa + v*ca;
  const q = px/G.period, qy = py/G.period;
  const t = phase*TAU;
  const w1 = Math.sin(t)*G.breathe, w2 = Math.sin(t+1.95)*G.breathe*0.8, w3 = Math.sin(t+4.1)*G.breathe*0.6;
  const band = (Math.sin((q+w1)*TAU)*0.74
    + Math.sin((q*2+qy*0.12+w2)*TAU)*0.18
    + Math.sin((q*3-qy*0.2+w3)*TAU)*0.08)*0.5 + 0.5;
  const d = Math.hypot(px-G.poolCentre[0]+w1*0.9, (py-G.poolCentre[1])*0.65+w2*0.7);
  const pool = smoothstep(G.poolRadius, 0, d);
  return { band, pool };
};

// Sample the wall across the frame region the wallRange metric looks at.
let bandSum=0, poolSum=0, n=0, mn=9, mx=-9;
const samples=[];
for (let py_px=12; py_px<=240; py_px+=6) for (let px_px=20; px_px<=748; px_px+=8) {
  const fx = (px_px-384)/384, fs = py_px/432;
  const belowAxis = (fs-0.5)*2*halfV;
  const belowHoriz = belowAxis + axis;
  const wy = CAM[1] - WALL_DIST*Math.tan(belowHoriz);
  const wx = fx * WALL_DIST*Math.tan(halfV)*ASPECT;
  const { band, pool } = maskAt([wx,wy,WALL_Z], 7/16.8);
  bandSum+=band; poolSum+=pool; n++;
  samples.push({band,pool});
}
const bandMean=bandSum/n, poolMean=poolSum/n;
for (const s of samples) {
  const m = 1 + G.contrast*2*(s.band-0.5) + G.poolStrength*(s.pool-poolMean);
  mn=Math.min(mn,m); mx=Math.max(mx,m);
}
console.log('band mean   ', bandMean.toFixed(4), '(assumed 0.5)');
console.log('pool mean   ', poolMean.toFixed(4));
console.log('mask range  ', mn.toFixed(4), '..', mx.toFixed(4), ' spread', (mx-mn).toFixed(4));
// A mask spread of s multiplies wall luminance ~205 by (1 +/- s/2).
console.log('=> approx sRGB spread on the wall:', ((mx-mn)*0.72*0.85/1.75*255).toFixed(1), 'levels  (reference ~40-45)');
console.log('\nuse poolMean =', poolMean.toFixed(4));
