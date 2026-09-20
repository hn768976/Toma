import { decodePng, px } from './png.mjs';
const lum=(img,x,y)=>{const c=px(img,x,y);return 0.2126*c[0]+0.7152*c[1]+0.0722*c[2];};
const B=(img,x,y)=>{let s=0,n=0;for(let j=-1;j<=1;j++)for(let i=-1;i<=1;i++){s+=lum(img,Math.max(1,Math.min(img.w-2,x+i)),Math.max(1,Math.min(img.h-2,y+j)));n++;}return s/n;};

function vEdge(img,yT,yB,xA,xB){let best=null;for(let x=xA;x<xB;x++){let s=0;for(let y=yT;y<yB;y+=2)s+=Math.abs(B(img,x+1,y)-B(img,x-1,y));if(!best||s>best.s)best={x,s};}return best.x;}
function hEdge(img,xA,xB,yA,yB){let best=null;for(let y=yA;y<yB;y++){let s=0;for(let x=xA;x<xB;x+=2)s+=Math.abs(B(img,x,y+1)-B(img,x,y-1));if(!best||s>best.s)best={y,s};}return best.y;}
function wallSpread(img,x0,x1,y0,y1,S){
  const COLS=24,ROWS=8, cw=(x1-x0)/COLS, ch=(y1-y0)/ROWS, vals=[];
  for(let r=0;r<ROWS;r++)for(let c=0;c<COLS;c++)
    vals.push(avg(img,Math.round(x0+c*cw),Math.round(y0+r*ch),Math.round(cw),Math.round(ch)));
  void S;
  return Math.max(...vals)-Math.min(...vals);
}
function avg(img,x0,y0,w,h){let s=0,n=0;for(let y=y0;y<y0+h;y+=2)for(let x=x0;x<x0+w;x+=2){s+=lum(img,x,y);n++;}return s/n;}

export function metrics(file,cfg){
  const img=decodePng(file); const W=img.w,H=img.h,S=W/768; // normalise to 768-wide reference
  const L=vEdge(img,cfg.yT*S,cfg.yB*S,cfg.lA*S,cfg.lB*S);
  const R=vEdge(img,cfg.yT*S,cfg.yB*S,cfg.rA*S,cfg.rB*S);
  const top=hEdge(img,(384-45)*S,(384+45)*S,cfg.tA*S,cfg.tB*S);
  const bot=hEdge(img,(384-45)*S,(384+45)*S,cfg.bA*S,cfg.bB*S);
  const horizon=hEdge(img,10,90*S,cfg.hA*S,cfg.hB*S);
  return {
    file:file.split('/').pop(),
    podiumW:((R-L)/W*100).toFixed(1)+'%',
    podiumCx:(((L+R)/2)/W*100).toFixed(1)+'%',
    topY:(top/H*100).toFixed(1)+'%',
    botY:(bot/H*100).toFixed(1)+'%',
    horizonY:(horizon/H*100).toFixed(1)+'%',
    wallTop:avg(img,20*S,15*S,300*S,60*S).toFixed(1),
    wallMid:avg(img,20*S,150*S,300*S,60*S).toFixed(1),
    wallLow:avg(img,20*S,255*S,300*S,40*S).toFixed(1),
    floor:avg(img,40*S,398*S,300*S,25*S).toFixed(1),
    podTop:avg(img,(384-50)*S,(top+6)*S/S*1,100*S,8*S).toFixed(1),
    // Gobo signal: spread of a coarsely box-averaged wall grid, so h264 noise
    // and fine detail drop out and only the light modulation survives.
    wallRange:wallSpread(img,20*S,748*S,12*S,240*S,S).toFixed(1),
    // Direct probes on the prop's two visible faces - more robust than
    // sampling just under a detected edge.
    podLeft:avg(img,cfg.pl[0]*S,cfg.pl[1]*S,26*S,(cfg.ph||14)*S).toFixed(1),
    podRight:avg(img,cfg.pr[0]*S,cfg.pr[1]*S,26*S,(cfg.ph||14)*S).toFixed(1),
  };
}
const CFG={
  A:{yT:352,yB:368,lA:150,lB:300,rA:460,rB:640,tA:348,tB:368,bA:368,bB:385,hA:280,hB:330,pl:[250,363],pr:[470,363],ph:9},
  B:{yT:310,yB:380,lA:170,lB:300,rA:450,rB:620,tA:280,tB:310,bA:380,bB:410,hA:255,hB:320,pl:[250,340],pr:[460,340]},
  C:{yT:310,yB:380,lA:200,lB:320,rA:450,rB:580,tA:296,tB:316,bA:378,bB:405,hA:255,hB:320,pl:[290,340],pr:[440,340]},
};
if(process.argv[1].endsWith('metrics.mjs')){
  for(const [k,f] of [['A','frames/A_04.png'],['B','frames/B_06.png'],['C','frames/C_07.png']])
    console.log(k, JSON.stringify(metrics(f,CFG[k]),null,0));
}
export { CFG };
