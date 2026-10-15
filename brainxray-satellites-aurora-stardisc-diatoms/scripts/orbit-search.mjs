import * as THREE from 'three';
const EYE = new THREE.Vector3(-0.95, 0.58, 1.6), TGT = new THREE.Vector3(-0.98, 0.06, 0);
const cam = new THREE.PerspectiveCamera(40, 16/9, 0.01, 100);
cam.position.copy(EYE); cam.lookAt(TGT); cam.rotateZ(-0.42); cam.updateMatrixWorld(); cam.updateProjectionMatrix();
function basis(th, ph) { const n = new THREE.Vector3(Math.sin(th)*Math.cos(ph), Math.cos(th), Math.sin(th)*Math.sin(ph));
  const t = Math.abs(n.y) < 0.9 ? new THREE.Vector3(0,1,0) : new THREE.Vector3(1,0,0);
  const e1 = new THREE.Vector3().crossVectors(n, t).normalize(); const e2 = new THREE.Vector3().crossVectors(n, e1).normalize(); return [e1,e2]; }
function count(shells, per=12) {
  let tot=0, front=0, close=0;
  for (let f=0; f<600; f+=20) { const ph=f/600;
    for (const sh of shells) { const [e1,e2]=basis(sh.th, sh.ph);
      for (let k=0;k<per;k++) {
      const a = (k/per)*Math.PI*2 + Math.PI*2*(sh.r<1.6?2:1)*ph;
      const P = e1.clone().multiplyScalar(Math.cos(a)*sh.r).addScaledVector(e2, Math.sin(a)*sh.r);
      if (P.distanceTo(EYE) < 0.5) { close++; continue; }
      const q = P.clone().project(cam);
      if (Math.abs(q.x)>0.98 || Math.abs(q.y)>0.98 || q.z>1) continue;
      const dir = P.clone().sub(EYE); const L = dir.length(); dir.normalize();
      const b = EYE.dot(dir), c = EYE.lengthSq()-1, disc = b*b-c;
      let hit=false; if (disc>0) { const t = -b - Math.sqrt(disc); if (t>0 && t<L) hit=true; }
      if (hit) continue;
      tot++;
      if (disc>0) front++;
    }}}
  return {vis: tot/30, front: front/30, close: close/30};
}
let best=null, bs=-1; let seed=7; const rnd=()=>{seed=(seed*16807)%2147483647; return seed/2147483647;};
for (let it=0; it<6000; it++) {
  const sh=[0,1,2,3,4].map(i=>({r:1.08+rnd()*0.75, th:rnd()*Math.PI, ph:rnd()*Math.PI*2}));
  const c=count(sh); const score = c.vis + 0.6*Math.min(c.front, 14) - 4*c.close;
  if (score>bs){bs=score;best={sh,c};}
}
// local refine
for (let it=0; it<3000; it++) {
  const sh=best.sh.map(x=>({r:Math.min(1.85,Math.max(1.06,x.r+(rnd()-0.5)*0.08)), th:x.th+(rnd()-0.5)*0.1, ph:x.ph+(rnd()-0.5)*0.1}));
  const c=count(sh); const score = c.vis + 0.6*Math.min(c.front, 14) - 4*c.close;
  if (score>bs){bs=score;best={sh,c};}
}
console.log(JSON.stringify(best));
