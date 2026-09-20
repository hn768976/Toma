import { decodePng, px } from './png.mjs';
import { writePng } from './pngw.mjs';
function stack(a, b, out) {
  const A = decodePng(a), B = decodePng(b);
  const w = Math.min(A.w, B.w), h = A.h + B.h + 4;
  const buf = Buffer.alloc(w * h * 3, 40);
  const blit = (img, yOff) => {
    for (let y = 0; y < img.h; y++) for (let x = 0; x < w; x++) {
      const c = px(img, x, y), i = ((y + yOff) * w + x) * 3;
      buf[i] = c[0]; buf[i+1] = c[1]; buf[i+2] = c[2];
    }
  };
  blit(A, 0); blit(B, A.h + 4);
  writePng(out, w, h, buf);
  console.log(out);
}
stack('frames/A_04.png', 'out/disc.png', 'cmp_A.png');
stack('frames/B_06.png', 'out/slab.png', 'cmp_B.png');
stack('frames/C_07.png', 'out/cyl.png',  'cmp_C.png');
