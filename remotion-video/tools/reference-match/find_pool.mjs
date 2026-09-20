import { decodePng, px as pixel } from './png.mjs';
const norm = (v) => { const n = Math.hypot(...v); return v.map(x=>x/n); };
const cross = (a,b)=>[a[1]*b[2]-a[2]*b[1], a[2]*b[0]-a[0]*b[2], a[0]*b[1]-a[1]*b[0]];
const dot = (a,b)=>a[0]*b[0]+a[1]*b[1]+a[2]*b[2];

// Brightness-weighted centroid of the top decile of the reference backdrop.
const img = decodePng('frames/C_07.png');
const L=(x,y)=>{const c=pixel(img,x,y);return (c[0]+c[1]+c[2])/3;};
const box=(x,y)=>{let s=0,n=0;for(let j=0;j<8;j++)for(let i=0;i<8;i++){s+=L(x+i,y+j);n++;}return s/n;};
const cells=[];
for(let y=12;y<240;y+=8) for(let x=16;x<752;x+=8) cells.push({x:x+4,y:y+4,v:box(x,y)});
cells.sort((a,b)=>b.v-a.v);
const top=cells.slice(0, Math.round(cells.length*0.10));
let sx=0,sy=0,sw=0;
const lo=top[top.length-1].v;
for(const c of top){const w=c.v-lo+1e-6; sx+=c.x*w; sy+=c.y*w; sw+=w;}
const cx=sx/sw, cy=sy/sw;
console.log(`brightest-decile centroid: x=${cx.toFixed(1)}px  y=${cy.toFixed(1)}px  (${(cx/768*100).toFixed(1)}%, ${(cy/432*100).toFixed(1)}%)`);
console.log(`wall luminance range: ${cells[cells.length-1].v.toFixed(1)} .. ${cells[0].v.toFixed(1)}`);

// Map that screen point to the wall, then into the gobo plane.
const CAM=[0,1.44,12], AIM_Y=1.2625, FOV=16.92, ASPECT=16/9;
const axis=Math.atan((CAM[1]-AIM_Y)/12), halfV=FOV/2*Math.PI/180;
const WALL_Z=-2.35, D=CAM[2]-WALL_Z;
const fx=(cx-384)/384, fs=cy/432;
const wy = CAM[1] - D*Math.tan((fs-0.5)*2*halfV + axis);
const wx = fx * D*Math.tan(halfV)*ASPECT;
console.log(`world point on backdrop: (${wx.toFixed(3)}, ${wy.toFixed(3)}, ${WALL_Z})`);

const Lv=norm([0.46,-0.5,-0.73]);
const gU=norm(cross(Math.abs(Lv[1])>0.9?[1,0,0]:[0,1,0], Lv));
const gV=norm(cross(Lv,gU));
const a=78.94*Math.PI/180, ca=Math.cos(a), sa=Math.sin(a);
const P=[wx,wy,WALL_Z];
const u=dot(P,gU), v=dot(P,gV);
console.log(`\npoolCentre: [${(u*ca-v*sa).toFixed(3)}, ${(u*sa+v*ca).toFixed(3)}]`);
