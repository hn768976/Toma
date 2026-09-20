// Least-squares fit of the warm (disc) rig. Same idea as solve.mjs, but the
// backdrop's vertical falloff and the lateral gradient are unknowns too, so
// each probe carries its own precomputed ambient-attenuation factors.
const linearToSrgb = (l) => (l <= 0.0031308 ? l * 12.92 : 1.055 * Math.pow(l, 1/2.4) - 0.055) * 255;
const ALBEDO = 0.85, WRAP = 0.6, FWRAP = 0.6;
const FILLDIR = (() => { const v=[0,0.2,1], n=Math.hypot(...v); return v.map(x=>x/n); })();
const wrap = (d,w) => Math.max(0, Math.min(1, (d+w)/(1+w)));
const dot = (a,b) => a[0]*b[0]+a[1]*b[1]+a[2]*b[2];

// wallF: (y/H)^p shape factor;  latS: smoothstep value for the lateral term;
// depthF: back-of-set factor;  bounce: floor bounce added on the prop only.
const PROBES = [
  { name:'floor',   n:[0,1,0],             wallF:0,      latS:0.2826, depthF:0.1392, bounce:0,     target:207.5 },
  { name:'wallLow', n:[0,0,1],             wallF:0.4761, latS:0.1276, depthF:0.4916, bounce:0,     target:170.8 },
  { name:'wallMid', n:[0,0,1],             wallF:0.7170, latS:0.1276, depthF:0.4916, bounce:0,     target:165.3 },
  { name:'wallTop', n:[0,0,1],             wallF:0.9756, latS:0.1276, depthF:0.4916, bounce:0,     target:155.9 },
  { name:'podLeft', n:[-0.729,0,0.685],    wallF:0.1126, latS:0.2958, depthF:0.3841, bounce:0.080, target:179.7 },
  { name:'podRight',n:[ 0.514,0,0.858],    wallF:0.1126, latS:0.6686, depthF:0.3841, bounce:0.080, target:198.0 },
  // Same height, opposite ends of the backdrop: these are the only probes that
  // can pin the lateral gradient (a flat wall has no directional shading).
  { name:'wallTopL',n:[0,0,1],             wallF:1.0000, latS:0.0170, depthF:0.4916, bounce:0,     target:150.0 },
  { name:'wallTopR',n:[0,0,1],             wallF:1.0000, latS:0.9781, depthF:0.4916, bounce:0,     target:163.7 },
];

const predict = (p, [A,K,kx,ky,kz,F,wf,lat,ff]) => {
  const n = Math.hypot(kx,ky,kz) || 1;
  const k = [kx/n, ky/n, kz/n];
  const g = 1 - wf*p.wallF - lat*(0.5 - p.latS) - ff*p.depthF;
  const irr = A*g + K*wrap(dot(p.n,k),WRAP) + F*wrap(dot(p.n,FILLDIR),FWRAP) + p.bounce;
  return linearToSrgb(ALBEDO*irr);
};
const cost = (x) => {
  const [A,K,,,,F,wf,lat,ff] = x;
  if (A<0||K<0||F<0||wf<0||wf>0.95||lat<0||lat>0.6||ff<0||ff>0.3) return 1e9;
  return PROBES.reduce((s,p)=>s+(predict(p,x)-p.target)**2, 0);
};

let x = [0.315, 0.456, 0.35, 0.9, 0.26, 0.02, 0.52, 0.25, 0.04];
let step = [0.05,0.05,0.1,0.1,0.1,0.01,0.05,0.05,0.01];
for (let iter=0; iter<6000; iter++) {
  for (let i=0;i<x.length;i++) {
    const base = cost(x);
    for (const d of [step[i],-step[i]]) {
      const t = x.slice(); t[i]+=d;
      if (cost(t) < base) { x = t; break; }
    }
  }
  if (iter%200===199) step = step.map(s=>s*0.78);
}
const n = Math.hypot(x[2],x[3],x[4]);
console.log('ambient      ', x[0].toFixed(4));
console.log('key          ', x[1].toFixed(4));
console.log('keyDir       ', [x[2]/n,x[3]/n,x[4]/n].map(v=>v.toFixed(4)).join(', '));
console.log('fill         ', x[5].toFixed(4));
console.log('wallFalloff  ', x[6].toFixed(4));
console.log('lateral      ', x[7].toFixed(4));
console.log('floorFalloff ', x[8].toFixed(4));
console.log('\nprobe       target   predicted   delta');
for (const p of PROBES) {
  const v = predict(p,x);
  console.log(p.name.padEnd(10)+p.target.toFixed(1).padStart(7)+v.toFixed(1).padStart(12)+(v-p.target>=0?'   +':'   ')+(v-p.target).toFixed(1));
}
console.log('\nRMS error: '+Math.sqrt(cost(x)/PROBES.length).toFixed(2)+' sRGB levels');
