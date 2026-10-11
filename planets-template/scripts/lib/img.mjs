// Planar Float32 image operations on equirectangular maps (wrapping in x).
import sharp from "sharp";

// Running box blur along x with wrap-around, radius r (pixels, integer).
export function boxBlurX(src, W, H, r) {
  if (r < 1) return src.slice();
  const out = new Float32Array(W * H);
  const n = 2 * r + 1;
  for (let y = 0; y < H; y++) {
    const b = y * W;
    let s = 0;
    for (let k = -r; k <= r; k++) s += src[b + (((k % W) + W) % W)];
    for (let x = 0; x < W; x++) {
      out[b + x] = s / n;
      s += src[b + ((x + r + 1) % W)] - src[b + (((x - r) % W) + W) % W];
    }
  }
  return out;
}

// Running box blur along y with clamped edges.
export function boxBlurY(src, W, H, r) {
  if (r < 1) return src.slice();
  const out = new Float32Array(W * H);
  const n = 2 * r + 1;
  const at = (x, y) => src[Math.max(0, Math.min(H - 1, y)) * W + x];
  for (let x = 0; x < W; x++) {
    let s = 0;
    for (let k = -r; k <= r; k++) s += at(x, k);
    for (let y = 0; y < H; y++) {
      out[y * W + x] = s / n;
      s += at(x, y + r + 1) - at(x, y - r);
    }
  }
  return out;
}

// Approximate Gaussian (3 box passes) with standard deviation sigma pixels.
export function gaussian(src, W, H, sigma) {
  const r = Math.max(1, Math.round(Math.sqrt((12 * sigma * sigma) / 3 + 1) / 2));
  let a = src;
  for (let i = 0; i < 3; i++) a = boxBlurY(boxBlurX(a, W, H, r), W, H, r);
  return a;
}

// Fill pixels whose coverage is < 1 with a smooth push-pull interpolation of
// the covered pixels (a coverage-weighted mip pyramid, then upsampled back).
export function pushPullFill(ch, cover, W, H) {
  const levels = [];
  let cw = W, chh = H;
  let v = new Float32Array(W * H), w = new Float32Array(W * H);
  for (let i = 0; i < W * H; i++) { w[i] = cover[i]; v[i] = ch[i] * cover[i]; }
  levels.push({ v, w, W: cw, H: chh });
  while (cw > 4 && chh > 2) {
    const nw = cw >> 1, nh = chh >> 1;
    const nv = new Float32Array(nw * nh), nwgt = new Float32Array(nw * nh);
    for (let y = 0; y < nh; y++)
      for (let x = 0; x < nw; x++) {
        let sv = 0, sw = 0;
        for (let dy = 0; dy < 2; dy++)
          for (let dx = 0; dx < 2; dx++) {
            const i = (y * 2 + dy) * cw + x * 2 + dx;
            sv += v[i]; sw += w[i];
          }
        nv[y * nw + x] = sv / 4; nwgt[y * nw + x] = sw / 4;
      }
    v = nv; w = nwgt; cw = nw; chh = nh;
    levels.push({ v, w, W: cw, H: chh });
  }
  // Pull: from coarsest to finest, fill missing weight from the coarser level.
  let up = null;
  for (let l = levels.length - 1; l >= 0; l--) {
    const L = levels[l];
    const val = new Float32Array(L.W * L.H);
    for (let y = 0; y < L.H; y++)
      for (let x = 0; x < L.W; x++) {
        const i = y * L.W + x;
        const ww = Math.min(1, L.w[i]);
        const own = L.w[i] > 1e-6 ? L.v[i] / L.w[i] : 0;
        let coarse = own;
        if (up) {
          // bilinear sample of the coarser level (wrap x, clamp y)
          const fx = (x + 0.5) / 2 - 0.5, fy = (y + 0.5) / 2 - 0.5;
          const x0 = Math.floor(fx), y0 = Math.floor(fy), tx = fx - x0, ty = fy - y0;
          const g = (xx, yy) => up.val[Math.max(0, Math.min(up.H - 1, yy)) * up.W + (((xx % up.W) + up.W) % up.W)];
          coarse = (g(x0, y0) * (1 - tx) + g(x0 + 1, y0) * tx) * (1 - ty) + (g(x0, y0 + 1) * (1 - tx) + g(x0 + 1, y0 + 1) * tx) * ty;
        }
        val[i] = up ? own * ww + coarse * (1 - ww) : own;
      }
    up = { val, W: L.W, H: L.H };
  }
  const out = new Float32Array(W * H);
  for (let i = 0; i < W * H; i++) out[i] = cover[i] >= 1 ? ch[i] : up.val[i];
  return out;
}

// Pole fix: near the poles, apply a latitude-adaptive horizontal blur whose
// radius grows like 1/cos(lat), so every row is filtered over the same
// ground distance. At the pole row itself this becomes the row mean, which
// removes pinching and the streaks of stretched pole pixels.
export function fixPoles(ch, W, H, bandDeg = 8, groundPx = 1.5) {
  const out = ch.slice();
  const band = Math.round((bandDeg / 180) * H);
  const prefix = new Float64Array(W + 1);
  const doRow = (y) => {
    const lat = Math.PI / 2 - ((y + 0.5) / H) * Math.PI;
    const r = Math.min(Math.floor(W / 2) - 1, Math.round(groundPx / Math.max(Math.cos(lat), 1e-4)));
    const b = y * W;
    prefix[0] = 0;
    for (let x = 0; x < W; x++) prefix[x + 1] = prefix[x] + ch[b + x];
    const total = prefix[W];
    const sumRange = (a, c) => {
      // sum of ch[a..c] inclusive with wrap
      let s = 0;
      if (a < 0) { s += prefix[W] - prefix[W + a]; a = 0; }
      if (c >= W) { s += prefix[c - W + 1]; c = W - 1; }
      return s + prefix[c + 1] - prefix[a];
    };
    for (let x = 0; x < W; x++) {
      const v = r * 2 + 1 >= W ? total / W : sumRange(x - r, x + r) / (2 * r + 1);
      out[b + x] = v;
    }
  };
  for (let y = 0; y < band; y++) { doRow(y); doRow(H - 1 - y); }
  // Cross-fade the band into the untouched map.
  for (let y = 0; y < band; y++) {
    const t = Math.min(1, (band - y) / (band * 0.6)); // 1 near pole -> 0 at band edge
    const f = t * t * (3 - 2 * t);
    for (const yy of [y, H - 1 - y]) {
      const b = yy * W;
      for (let x = 0; x < W; x++) out[b + x] = ch[b + x] * (1 - f) + out[b + x] * f;
    }
  }
  return out;
}

// Make the map continuous across the +-180 seam by spreading any jump
// between the first and last columns over the n columns either side.
export function blendSeam(ch, W, H, n = 24) {
  const out = ch.slice();
  for (let y = 0; y < H; y++) {
    const b = y * W;
    const d = ch[b] - ch[b + W - 1];
    for (let x = 0; x < n; x++) {
      const f = 0.5 * (1 - x / n);
      out[b + x] -= d * f;
      out[b + W - 1 - x] += d * f;
    }
  }
  return out;
}

// Tangent-space normal map (x = east, y = north, z = up) from a height map
// in metres. mPerPxEq: metres per pixel along the equator; mPerPxNS: metres
// per pixel north-south. exaggeration scales slopes.
export function normalsFromHeight(h, W, H, mPerPxEq, mPerPxNS, exaggeration, poleFadeDeg = 10) {
  const nx = new Float32Array(W * H), ny = new Float32Array(W * H), nz = new Float32Array(W * H);
  for (let y = 0; y < H; y++) {
    const lat = Math.PI / 2 - ((y + 0.5) / H) * Math.PI;
    const cl = Math.max(Math.cos(lat), 0.02);
    const poleDist = (90 - Math.abs((lat * 180) / Math.PI)) / poleFadeDeg;
    const fade = Math.min(1, poleDist);
    const ym = Math.max(0, y - 1), yp = Math.min(H - 1, y + 1);
    for (let x = 0; x < W; x++) {
      const xm = (x - 1 + W) % W, xp = (x + 1) % W;
      const dhdx = (h[y * W + xp] - h[y * W + xm]) / (2 * mPerPxEq * cl);
      const dhdy = (h[ym * W + x] - h[yp * W + x]) / ((yp - ym) * mPerPxNS); // north is up (smaller y)
      const sx = -dhdx * exaggeration * fade, sy = -dhdy * exaggeration * fade;
      const l = Math.hypot(sx, sy, 1);
      const i = y * W + x;
      nx[i] = sx / l; ny[i] = sy / l; nz[i] = 1 / l;
    }
  }
  return [nx, ny, nz];
}

// Luminance high-pass "height" for bodies without an elevation model.
export function highPassHeight(lum, W, H, sigma) {
  const low = gaussian(lum, W, H, sigma);
  const out = new Float32Array(W * H);
  for (let i = 0; i < W * H; i++) out[i] = lum[i] - low[i];
  return out;
}

export function percentile(arr, p, mask) {
  const step = Math.max(1, Math.floor(arr.length / 2_000_000));
  const v = [];
  for (let i = 0; i < arr.length; i += step) if (!mask || mask[i] >= 1) v.push(arr[i]);
  v.sort((a, b) => a - b);
  return v[Math.min(v.length - 1, Math.floor(p * v.length))];
}

// Encode three planar channels in [0,1] to WebP.
export async function writeWebp(chs, W, H, path, { lossless = false, quality = 92 } = {}) {
  const buf = Buffer.alloc(W * H * 3);
  for (let i = 0; i < W * H; i++)
    for (let c = 0; c < 3; c++) {
      const v = chs[c][i];
      buf[i * 3 + c] = v <= 0 ? 0 : v >= 1 ? 255 : Math.round(v * 255);
    }
  await sharp(buf, { raw: { width: W, height: H, channels: 3 }, limitInputPixels: false })
    .webp(lossless ? { lossless: true, effort: 4 } : { quality, smartSubsample: true, effort: 5 })
    .toFile(path);
}

export async function writePng(chs, W, H, path) {
  const n = chs.length;
  const buf = Buffer.alloc(W * H * n);
  for (let i = 0; i < W * H; i++)
    for (let c = 0; c < n; c++) buf[i * n + c] = Math.max(0, Math.min(255, Math.round(chs[c][i] * 255)));
  await sharp(buf, { raw: { width: W, height: H, channels: n }, limitInputPixels: false }).png({ compressionLevel: 9 }).toFile(path);
}

// Read an image file into planar [0,1] float channels (RGB).
export async function readImage(path) {
  const { data, info } = await sharp(path, { limitInputPixels: false }).removeAlpha().toColourspace("srgb").raw().toBuffer({ resolveWithObject: true });
  const n = info.width * info.height;
  const chs = [0, 1, 2].map(() => new Float32Array(n));
  for (let i = 0; i < n; i++) for (let c = 0; c < 3; c++) chs[c][i] = data[i * info.channels + c] / 255;
  return { chs, W: info.width, H: info.height };
}
