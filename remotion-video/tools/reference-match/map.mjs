import { decodePng, px } from './png.mjs';
const lum = (img,x,y)=>{const c=px(img,x,y);return 0.2126*c[0]+0.7152*c[1]+0.0722*c[2];};

// box-average a cell so JPEG/h264 noise drops out
function cell(img,x0,y0,w,h){let s=0,n=0;for(let y=y0;y<y0+h;y++)for(let x=x0;x<x0+w;x++){s+=lum(img,x,y);n++;}return s/n;}

const ramp = ' .:-=+*#%@';
function show(file,label,y0,y1){
  const img=decodePng(file);
  const COLS=32, ROWS=10;
  const cw=Math.floor(img.w/COLS), ch=Math.floor((y1-y0)/ROWS);
  const grid=[];
  for(let r=0;r<ROWS;r++){const row=[];for(let c=0;c<COLS;c++)row.push(cell(img,c*cw,y0+r*ch,cw,ch));grid.push(row);}
  const flat=grid.flat(); const mn=Math.min(...flat),mx=Math.max(...flat);
  console.log(`\n--- ${label}  (wall rows ${y0}-${y1}) lum ${mn.toFixed(0)}..${mx.toFixed(0)} ---`);
  for(const row of grid) console.log(row.map(v=>ramp[Math.min(9,Math.floor((v-mn)/(mx-mn+1e-6)*10))]).join(''));
  return grid;
}
show('frames/C_07.png','REFERENCE C t=7s',10,250);
show('out/cyl.png','RENDER cyl',10,250);
