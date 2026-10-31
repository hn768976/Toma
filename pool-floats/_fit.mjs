import * as THREE from 'three';
const R=1, r=0.44, fy=0.92, fov=32, x0r=-0.085;
const pts=[];
for(let i=0;i<72;i++)for(let j=0;j<24;j++){const a=i/72*Math.PI*2,b=j/24*Math.PI*2;pts.push(new THREE.Vector3(x0r+(R+r*Math.cos(b))*Math.cos(a), 0.3+fy*r*Math.sin(b),(R+r*Math.cos(b))*Math.sin(a)));}
const c=new THREE.PerspectiveCamera(fov,768/432,0.1,100);
function bbox([el,tx,tz,d]){
  const e=el*Math.PI/180; c.position.set(tx,-0.45+d*Math.sin(e),tz+d*Math.cos(e)); c.lookAt(tx,-0.45,tz); c.updateMatrixWorld(); c.updateProjectionMatrix();
  let a=1e9,b=-1e9,y0=1e9,y1=-1e9; const q=new THREE.Vector3();
  for(const p of pts){q.copy(p).project(c); const x=(q.x+1)/2*768,y=(1-q.y)/2*432; a=Math.min(a,x);b=Math.max(b,x);y0=Math.min(y0,y);y1=Math.max(y1,y);}
  return [a,b,y0,y1];
}
const T=[357,640,88,305];
const err=p=>bbox(p).reduce((s,v,i)=>s+(v-T[i])**2,0);
let best=[45.8,-1.246,-0.108,8.267], be=err(best), step=[2,0.2,0.2,0.5];
for(let it=0;it<400;it++){let imp=false;for(let k=0;k<4;k++)for(const sg of[-1,1]){const p=best.slice();p[k]+=sg*step[k];const e=err(p);if(e<be){be=e;best=p;imp=true;}} if(!imp)step=step.map(s=>s/2);}
console.log(be.toFixed(2), best.map(v=>v.toFixed(3)), bbox(best).map(v=>v.toFixed(0)));
