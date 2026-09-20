import fs from 'node:fs';
import zlib from 'node:zlib';
import { decodePng, px } from './png.mjs';

function crc32(buf){let c,t=[];for(let n=0;n<256;n++){c=n;for(let k=0;k<8;k++)c=c&1?0xedb88320^(c>>>1):c>>>1;t[n]=c>>>0;}
  let crc=0xffffffff;for(let i=0;i<buf.length;i++)crc=t[(crc^buf[i])&0xff]^(crc>>>8);return (crc^0xffffffff)>>>0;}
function chunk(type,data){const len=Buffer.alloc(4);len.writeUInt32BE(data.length);const td=Buffer.concat([Buffer.from(type,'ascii'),data]);const crc=Buffer.alloc(4);crc.writeUInt32BE(crc32(td));return Buffer.concat([len,td,crc]);}

export function writePng(path,w,h,rgb){
  const stride=w*3, raw=Buffer.alloc(h*(stride+1));
  for(let y=0;y<h;y++){raw[y*(stride+1)]=0;rgb.copy(raw,y*(stride+1)+1,y*stride,(y+1)*stride);}
  const ihdr=Buffer.alloc(13);ihdr.writeUInt32BE(w,0);ihdr.writeUInt32BE(h,4);ihdr[8]=8;ihdr[9]=2;
  fs.writeFileSync(path,Buffer.concat([Buffer.from([137,80,78,71,13,10,26,10]),chunk('IHDR',ihdr),chunk('IDAT',zlib.deflateSync(raw,{level:9})),chunk('IEND',Buffer.alloc(0))]));
}

// crop + integer upscale, optional per-crop contrast stretch to reveal faint shading
export function cropScale(src,dst,x0,y0,w,h,scale,stretch=false){
  const img=decodePng(src);
  let lo=0,hi=255;
  if(stretch){let mn=255,mx=0;for(let y=y0;y<y0+h;y++)for(let x=x0;x<x0+w;x++){const c=px(img,x,y);const L=(c[0]+c[1]+c[2])/3;mn=Math.min(mn,L);mx=Math.max(mx,L);}lo=mn;hi=mx;}
  const W=w*scale,H=h*scale,out=Buffer.alloc(W*H*3);
  for(let y=0;y<H;y++)for(let x=0;x<W;x++){
    const c=px(img,x0+Math.floor(x/scale),y0+Math.floor(y/scale));
    const i=(y*W+x)*3;
    for(let k=0;k<3;k++) out[i+k]=stretch?Math.max(0,Math.min(255,Math.round((c[k]-lo)/(hi-lo+1e-6)*255))):c[k];
  }
  writePng(dst,W,H,out);
  console.log(`${dst}  ${W}x${H}${stretch?`  (stretched ${lo.toFixed(0)}..${hi.toFixed(0)})`:''}`);
}
if(process.argv[1].endsWith('pngw.mjs')){
  cropScale('frames/B_06.png','crop_B.png',200,280,360,120,3,true);
  cropScale('frames/C_07.png','crop_C.png',240,285,300,110,3,true);
  cropScale('frames/A_04.png','crop_A.png',190,340,380,50,3,true);
}
