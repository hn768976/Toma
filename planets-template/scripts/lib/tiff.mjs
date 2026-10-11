// Minimal reader for the uncompressed, strip-organised GeoTIFFs that USGS
// Astrogeology publishes (one row per strip, chunky RGB or single band,
// 8-bit unsigned or 16-bit signed). Rows are read straight from disk so a
// multi-GB mosaic never has to fit in memory, and are box-filtered down to
// the target equirectangular size as they stream past.
import fs from "node:fs";
import { fromFile } from "geotiff";

export async function openTiff(path) {
  const tiff = await fromFile(path);
  const image = await tiff.getImage(0);
  const fd = image.fileDirectory;
  if (fd.Compression !== 1) throw new Error(`${path}: compressed TIFFs are not supported`);
  if (!tiff.littleEndian && image.fileDirectory.BitsPerSample[0] > 8)
    throw new Error(`${path}: big-endian 16-bit TIFFs are not supported`);
  if (image.isTiled) throw new Error(`${path}: tiled TIFFs are not supported`);
  const width = image.getWidth();
  const height = image.getHeight();
  const spp = image.getSamplesPerPixel();
  const bps = fd.BitsPerSample[0];
  const signed = fd.SampleFormat ? fd.SampleFormat[0] === 2 : false;
  const bytesPerSample = bps / 8;
  const rowBytes = width * spp * bytesPerSample;
  const rps = fd.RowsPerStrip ?? height;
  const offsets = Array.from(fd.StripOffsets);
  const nodata = fd.GDAL_NODATA !== undefined ? Number(String(fd.GDAL_NODATA).trim()) : null;
  // Longitude of the left edge, from the geo-referencing: the raster always
  // spans 360 degrees, so the tie point's x over the full width gives it.
  let lonLeft = -180;
  if (fd.ModelTiepoint && fd.ModelPixelScale) {
    const x0 = fd.ModelTiepoint[3];
    const span = fd.ModelPixelScale[0] * width;
    // Projected x is measured from the central meridian, not from 0 E.
    const clon = Number(image.getGeoKeys().ProjCenterLongGeoKey ?? 0);
    lonLeft = clon + (x0 / span) * 360;
  }
  const planar = fd.PlanarConfiguration ?? 1;
  const fdNum = fs.openSync(path, "r");
  const buf = Buffer.from(new ArrayBuffer(rowBytes)); // own, aligned ArrayBuffer
  const bandBytes = width * bytesPerSample;
  const tmp = Buffer.from(new ArrayBuffer(bandBytes));
  const stripsPerBand = Math.ceil(height / rps);
  const readRow = (y) => {
    const strip = Math.floor(y / rps);
    const inStrip = y - strip * rps;
    if (planar === 1 || spp === 1) {
      fs.readSync(fdNum, buf, 0, rowBytes, offsets[strip] + inStrip * rowBytes);
      return buf;
    }
    // Band-sequential (planar) storage: gather each band's row and
    // interleave it so callers always see chunky pixels.
    for (let b = 0; b < spp; b++) {
      fs.readSync(fdNum, tmp, 0, bandBytes, offsets[b * stripsPerBand + strip] + inStrip * bandBytes);
      if (bytesPerSample === 1) for (let x = 0; x < width; x++) buf[x * spp + b] = tmp[x];
      else for (let x = 0; x < width; x++) { buf[(x * spp + b) * 2] = tmp[x * 2]; buf[(x * spp + b) * 2 + 1] = tmp[x * 2 + 1]; }
    }
    return buf;
  };
  const sample = (b, i) =>
    bps === 8 ? b[i] : signed ? b.readInt16LE(i * 2) : b.readUInt16LE(i * 2);
  return {
    path, width, height, spp, bps, signed, nodata, lonLeft, readRow, sample,
    close: () => fs.closeSync(fdNum),
  };
}

// Box-filter (area-weighted) resample of a whole TIFF to W x H, ignoring
// nodata. Returns planar Float32 channels plus a coverage weight in [0,1].
// The output is shifted so that its left edge is longitude -180.
export async function resampleTiff(path, W, H, { log = () => {} } = {}) {
  const t = await openTiff(path);
  const { width: w, height: h, spp } = t;
  if (w < W || h < H) {
    t.close();
    return upsampleTiff(path, W, H);
  }
  const sx = w / W;
  const sy = h / H;
  // Horizontal footprint table: each source column touches <= 2 dest columns.
  const colA = new Int32Array(w), colB = new Int32Array(w), wA = new Float32Array(w);
  for (let x = 0; x < w; x++) {
    const x0 = x / sx, x1 = (x + 1) / sx;
    const a = Math.floor(x0), b = Math.min(Math.floor(x1 - 1e-9), W - 1);
    colA[x] = a; colB[x] = b;
    wA[x] = a === b ? 1 : (a + 1 - x0) / (x1 - x0);
  }
  const out = Array.from({ length: spp }, () => new Float32Array(W * H));
  const wsum = new Float32Array(W * H);
  const rowAcc = Array.from({ length: spp }, () => new Float64Array(W));
  const rowW = new Float64Array(W);
  for (let y = 0; y < h; y++) {
    const row = t.readRow(y);
    rowW.fill(0);
    for (const r of rowAcc) r.fill(0);
    const view = t.bps === 8
      ? new Uint8Array(row.buffer, row.byteOffset, w * spp)
      : t.signed ? new Int16Array(row.buffer, row.byteOffset, w * spp) : new Uint16Array(row.buffer, row.byteOffset, w * spp);
    const nd = t.nodata;
    for (let x = 0; x < w; x++) {
      const a = colA[x], b = colB[x], fa = wA[x];
      if (spp === 1) {
        const v = view[x];
        if (nd !== null && (v === nd || (t.signed && v <= -32000))) continue;
        rowAcc[0][a] += v * fa;
        if (b !== a) rowAcc[0][b] += v * (1 - fa);
      } else {
        const i = x * spp;
        const r = view[i], g = view[i + 1], bl = view[i + 2];
        if (nd !== null && r === 0 && g === 0 && bl === 0) continue;
        rowAcc[0][a] += r * fa; rowAcc[1][a] += g * fa; rowAcc[2][a] += bl * fa;
        if (b !== a) { const f = 1 - fa; rowAcc[0][b] += r * f; rowAcc[1][b] += g * f; rowAcc[2][b] += bl * f; }
      }
      rowW[a] += fa;
      if (b !== a) rowW[b] += 1 - fa;
    }
    const y0 = y / sy, y1 = (y + 1) / sy;
    const a = Math.floor(y0), b = Math.min(Math.floor(y1 - 1e-9), H - 1);
    const fa = a === b ? 1 : (a + 1 - y0) / (y1 - y0);
    const add = (dy, f) => {
      const base = dy * W;
      for (let x = 0; x < W; x++) {
        if (rowW[x] === 0) continue;
        wsum[base + x] += rowW[x] * f;
        for (let c = 0; c < spp; c++) out[c][base + x] += rowAcc[c][x] * f;
      }
    };
    add(a, fa);
    if (b !== a) add(b, 1 - fa);
    if (y % 2000 === 0) log(`  ${path.split("/").pop()}: row ${y}/${h}`);
  }
  t.close();
  const full = sx * sy;
  const cover = new Float32Array(W * H);
  for (let i = 0; i < W * H; i++) {
    const ws = wsum[i];
    cover[i] = Math.min(1, ws / full);
    for (let c = 0; c < spp; c++) out[c][i] = ws > 0 ? out[c][i] / ws : 0;
  }
  const shift = lonShift(t.lonLeft, W);
  return { channels: out.map((ch) => rollX(ch, W, H, shift)), cover: rollX(cover, W, H, shift), lonLeft: t.lonLeft, srcSize: [w, h] };
}

// Bicubic upsample for sources smaller than the target (Ceres colour).
async function upsampleTiff(path, W, H) {
  const t = await openTiff(path);
  const { width: w, height: h, spp } = t;
  const src = Array.from({ length: spp }, () => new Float32Array(w * h));
  const valid = new Float32Array(w * h);
  for (let y = 0; y < h; y++) {
    const row = t.readRow(y);
    for (let x = 0; x < w; x++) {
      let ok = true;
      for (let c = 0; c < spp; c++) {
        const v = t.sample(row, x * spp + c);
        src[c][y * w + x] = v;
        if (t.nodata !== null && v === t.nodata) ok = false;
      }
      valid[y * w + x] = ok ? 1 : 0;
    }
  }
  t.close();
  const out = src.map((ch) => bicubicResize(ch, w, h, W, H));
  const cover = bicubicResize(valid, w, h, W, H).map((v) => (v > 0.999 ? 1 : Math.max(0, v)));
  const shift = lonShift(t.lonLeft, W);
  return { channels: out.map((ch) => rollX(ch, W, H, shift)), cover: rollX(cover, W, H, shift), lonLeft: t.lonLeft, srcSize: [w, h] };
}

export function bicubicResize(src, w, h, W, H) {
  const out = new Float32Array(W * H);
  const cub = (p0, p1, p2, p3, t) =>
    p1 + 0.5 * t * (p2 - p0 + t * (2 * p0 - 5 * p1 + 4 * p2 - p3 + t * (3 * (p1 - p2) + p3 - p0)));
  const at = (x, y) => {
    x = ((x % w) + w) % w; // wrap in longitude
    y = Math.max(0, Math.min(h - 1, y));
    return src[y * w + x];
  };
  for (let Y = 0; Y < H; Y++) {
    const fy = ((Y + 0.5) * h) / H - 0.5;
    const y = Math.floor(fy), ty = fy - y;
    for (let X = 0; X < W; X++) {
      const fx = ((X + 0.5) * w) / W - 0.5;
      const x = Math.floor(fx), tx = fx - x;
      const r = [];
      for (let j = -1; j <= 2; j++)
        r.push(cub(at(x - 1, y + j), at(x, y + j), at(x + 1, y + j), at(x + 2, y + j), tx));
      out[Y * W + X] = cub(r[0], r[1], r[2], r[3], ty);
    }
  }
  return out;
}

function lonShift(lonLeft, W) {
  // Columns to roll right so that the left edge becomes -180.
  let d = (((lonLeft + 180) % 360) + 360) % 360;
  if (d > 180) d -= 360;
  return Math.round((d / 360) * W);
}

export function rollX(ch, W, H, shift) {
  if (!shift) return ch;
  const out = new Float32Array(W * H);
  for (let y = 0; y < H; y++) {
    const b = y * W;
    for (let x = 0; x < W; x++) out[b + ((((x + shift) % W) + W) % W)] = ch[b + x];
  }
  return out;
}
