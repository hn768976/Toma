// Procedural surface generators, each matched to published imagery of the
// body. Every generator is deterministic (fixed seeds) and samples noise on
// the unit sphere, so the maps have no seam and no pole pinching.
import { makeFbm, makeSimplex3, forEachPixel, smoothstep, lerp, clamp01, hex } from "./noise.mjs";

const DEG = Math.PI / 180;
const mix3 = (a, b, t) => [lerp(a[0], b[0], t), lerp(a[1], b[1], t), lerp(a[2], b[2], t)];

function alloc(W, H) {
  return { chs: [0, 1, 2].map(() => new Float32Array(W * H)), height: new Float32Array(W * H) };
}

// Piecewise-linear colour ramp over latitude (degrees, planetographic-ish).
function latRamp(stops) {
  return (latDeg) => {
    if (latDeg <= stops[0][0]) return stops[0][1];
    for (let i = 1; i < stops.length; i++) {
      if (latDeg <= stops[i][0]) {
        const t = (latDeg - stops[i - 1][0]) / (stops[i][0] - stops[i - 1][0]);
        const s = t * t * (3 - 2 * t);
        return mix3(stops[i - 1][1], stops[i][1], s);
      }
    }
    return stops[stops.length - 1][1];
  };
}

// Angular distance-based soft ellipse on the sphere (lat/lon in radians).
function ellipse(lat, lon, lat0, lon0, aLonDeg, bLatDeg) {
  let dl = lon - lon0;
  dl = Math.atan2(Math.sin(dl), Math.cos(dl));
  const u = (dl * Math.cos(lat0)) / (aLonDeg * DEG);
  const v = (lat - lat0) / (bLatDeg * DEG);
  return Math.sqrt(u * u + v * v);
}

// ---------------------------------------------------------------- Venus
// Visible-light cloud tops: soft, low-contrast flowing bands, cream to tan.
export function venus(W, H) {
  const out = alloc(W, H);
  const streak = makeFbm(101, 6);
  const warp = makeFbm(102, 4);
  const big = makeFbm(103, 3);
  const cream = hex("#E8D8A8"), tan = hex("#C8A870");
  forEachPixel(W, H, (i, x, y, z, lat, lon) => {
    const w = warp(x * 1.6, y * 1.6, z * 1.6);
    const latW = lat + 0.10 * w;
    // Faint planetary-scale "Y"/chevron: bands bend toward the equator.
    const chevron = Math.cos(lon + 0.8) * 0.35 * (1 - Math.abs(Math.sin(latW)));
    const bands = 0.5 + 0.5 * Math.sin(latW * 7 + chevron * 2 + 0.6 * big(x, y, z));
    const st = streak(x * 2.2, y * 9, z * 2.2);
    let t = 0.55 + 0.28 * (bands - 0.5) + 0.20 * st + 0.12 * big(x * 0.7, y * 0.7, z * 0.7);
    // Brighter polar hoods.
    t += 0.18 * smoothstep(55, 80, Math.abs(lat / DEG));
    t = clamp01(t);
    const c = mix3(tan, cream, t);
    out.chs[0][i] = c[0]; out.chs[1][i] = c[1]; out.chs[2][i] = c[2];
    out.height[i] = st * 0.5 + bands * 0.3;
  });
  return out;
}

// ---------------------------------------------------------------- Saturn
// Soft pale-gold bands from a latitude profile (Cassini true-colour views),
// fine low-contrast banding, wavy band edges and the north polar hexagon.
export function saturn(W, H) {
  const out = alloc(W, H);
  const profile = latRamp([
    [-90, hex("#8F8A7C")],
    [-78, hex("#A39A82")],
    [-62, hex("#B9AA88")],
    [-48, hex("#CDB98F")],
    [-36, hex("#D9C59A")],
    [-28, hex("#CDB283")],
    [-20, hex("#DCC79C")],
    [-12, hex("#D2B686")],
    [-6, hex("#EADCB5")],
    [0, hex("#EFE3BE")],
    [6, hex("#EBDDB6")],
    [12, hex("#D6BA88")],
    [20, hex("#E0CBA0")],
    [28, hex("#CFB385")],
    [36, hex("#DCC79C")],
    [46, hex("#CBB78F")],
    [58, hex("#BDB091")],
    [70, hex("#A9A790")],
    [80, hex("#8E9592")],
    [90, hex("#7E8890")],
  ]);
  const edge = makeFbm(201, 5);
  const fine = makeFbm(202, 4);
  const mott = makeFbm(203, 5);
  const fineBands = makeSimplex3(204);
  forEachPixel(W, H, (i, x, y, z, lat, lon) => {
    // Wavy band boundaries: latitude warped by noise stretched along longitude.
    const latW = lat + 0.010 * edge(x * 3, y * 14, z * 3) + 0.0015 * fine(x * 10, y * 40, z * 10);
    const ld = latW / DEG;
    let c = profile(ld);
    // Many faint thin bands.
    const fb = 0.5 * Math.sin(latW * 160 + 2 * fineBands(0, ld * 0.05, 0)) + 0.5 * Math.sin(latW * 63 + 1.3);
    const polarFade = 1 - smoothstep(45, 65, Math.abs(ld));
    let l = 1 + 0.006 * fb * polarFade + 0.015 * mott(x * 6, y * 20, z * 6);
    // North polar hexagon (~78 N): a darker blue-grey interior bounded by
    // a hexagonal jet, plus a small dark polar vortex.
    if (ld > 60) {
      const colat = (90 - ld) / 12; // 1 at the hexagon radius (~78 N)
      const ang = lon + 0.3;
      const sector = ((ang % (Math.PI / 3)) + Math.PI / 3) % (Math.PI / 3) - Math.PI / 6;
      const hexR = Math.cos(Math.PI / 6) / Math.cos(sector); // 1 at edge midpoints
      const r = colat / hexR;
      const inside = 1 - smoothstep(0.85, 1.12, r);
      c = mix3(c, hex("#A29F92"), 0.28 * inside);
      const rim = Math.exp(-((r - 1) * (r - 1)) / 0.006);
      l *= 1 - 0.05 * rim;
      const vortex = 1 - smoothstep(0.08, 0.22, colat);
      c = mix3(c, hex("#6E716E"), 0.45 * vortex);
    }
    // A few faint storm spots at mid-latitudes.
    const sp = Math.min(ellipse(lat, lon, 42 * DEG, 1.2, 2.5, 1.3), ellipse(lat, lon, -38 * DEG, -2.1, 1.8, 1.0));
    l *= 1 + 0.08 * (1 - smoothstep(0.6, 1.0, sp));
    out.chs[0][i] = c[0] * l; out.chs[1][i] = c[1] * l; out.chs[2][i] = c[2] * l;
    out.height[i] = fb * 0.3 * polarFade;
  });
  return out;
}

// ---------------------------------------------------------------- Uranus
// Near-uniform pale cyan, very faint bands, a brighter north polar cap.
export function uranus(W, H) {
  const out = alloc(W, H);
  const base = hex("#AEE4E8");
  const cap = hex("#D3F1F0");
  const warp = makeFbm(301, 4);
  const streak = makeFbm(302, 5);
  forEachPixel(W, H, (i, x, y, z, lat, lon) => {
    const latW = lat + 0.02 * warp(x * 2, y * 6, z * 2);
    const ld = latW / DEG;
    let l = 1 + 0.010 * Math.sin(latW * 22) + 0.006 * Math.sin(latW * 57 + 0.7) + 0.008 * streak(x * 3, y * 18, z * 3);
    let c = mix3(base, cap, 0.75 * smoothstep(38, 62, ld));
    // a faint darker collar just equatorward of the cap
    l *= 1 - 0.03 * Math.exp(-((ld - 35) * (ld - 35)) / 30);
    // two faint bright cloud features (seen in Keck/Hubble images)
    const cl = Math.min(ellipse(lat, lon, 28 * DEG, 0.6, 2.0, 0.9), ellipse(lat, lon, -22 * DEG, -2.4, 1.6, 0.8));
    l *= 1 + 0.05 * (1 - smoothstep(0.4, 1.0, cl));
    out.chs[0][i] = c[0] * l; out.chs[1][i] = c[1] * l; out.chs[2][i] = c[2] * l;
    out.height[i] = 0;
  });
  return out;
}

// ---------------------------------------------------------------- Neptune
// Deep blue with faint bands, the Great Dark Spot with bright companion
// clouds, the small dark spot and "Scooter", and bright cirrus streaks.
export function neptune(W, H) {
  const out = alloc(W, H);
  const profile = latRamp([
    [-90, hex("#30489E")],
    [-74, hex("#2C43A8")],
    [-62, hex("#2F4AB8")],
    [-50, hex("#3A58D2")],
    [-30, hex("#3D5CD8")],
    [0, hex("#4262DC")],
    [30, hex("#3C5BD6")],
    [60, hex("#3654C8")],
    [90, hex("#3550BC")],
  ]);
  const warp = makeFbm(401, 4);
  const streakN = makeFbm(402, 5);
  const fineN = makeFbm(403, 4);
  const white = [0.93, 0.96, 1.0];
  forEachPixel(W, H, (i, x, y, z, lat, lon) => {
    const latW = lat + 0.015 * warp(x * 2.5, y * 9, z * 2.5);
    const ld = latW / DEG;
    let c = profile(ld);
    let l = 1 + 0.03 * Math.sin(latW * 18 + 0.4) + 0.025 * fineN(x * 4, y * 16, z * 4);
    // Great Dark Spot (~20 S) and its bright southern companion clouds.
    const gds = ellipse(lat, lon, -20 * DEG, 0.4, 14, 6);
    const gdsM = 1 - smoothstep(0.75, 1.1, gds);
    c = mix3(c, hex("#1B2A7A"), 0.75 * gdsM);
    // Small dark spot (D2, ~55 S) with a bright core.
    const d2 = ellipse(lat, lon, -54 * DEG, 2.0, 5, 2.6);
    c = mix3(c, hex("#1E2E86"), 0.7 * (1 - smoothstep(0.7, 1.05, d2)));
    let w = 0.85 * (1 - smoothstep(0.0, 0.35, d2));
    // Companion clouds: bright arc hugging the GDS's southern edge.
    const comp = ellipse(lat, lon, -26.5 * DEG, 0.25, 12, 1.4);
    w = Math.max(w, 0.95 * (1 - smoothstep(0.35, 1.0, comp)) * (0.6 + 0.4 * streakN(x * 8, y * 40, z * 8)));
    // "Scooter" (~42 S).
    const sc = ellipse(lat, lon, -42 * DEG, -1.4, 4.5, 1.6);
    w = Math.max(w, 0.85 * (1 - smoothstep(0.3, 1.0, sc)));
    // Bright, elongated cirrus streaks in latitude bands.
    const bandMask =
      smoothstep(18, 25, ld) * (1 - smoothstep(38, 46, ld)) +
      smoothstep(-46, -38, ld) * (1 - smoothstep(-30, -24, ld)) * 0.8 +
      smoothstep(-72, -68, ld) * (1 - smoothstep(-64, -60, ld)) * 0.5;
    // Irregular cirrus: the streak noise is sampled through a warp and
    // gated by a low-frequency cluster mask, so streaks vary in length,
    // width and brightness instead of repeating.
    const wx = 0.35 * warp(x * 4, y * 4, z * 4);
    const s = streakN(x * 1.2 + wx, y * 26 + 2 * wx, z * 1.2 - wx);
    const cluster = smoothstep(-0.1, 0.5, fineN(x * 1.5 + 3.1, y * 3, z * 1.5));
    const fine = 0.75 + 0.25 * fineN(x * 9, y * 60, z * 9);
    w = Math.max(w, bandMask * cluster * fine * smoothstep(0.32, 0.78, s));
    c = mix3(c, white, clamp01(w));
    out.chs[0][i] = c[0] * l; out.chs[1][i] = c[1] * l; out.chs[2][i] = c[2] * l;
    out.height[i] = w * 0.8;
  });
  return out;
}

// ---------------------------------------------------------------- Jupiter
// Large-scale structure (belts, zones, Great Red Spot, ovals, festoons) from
// the NASA global map, colour-graded toward Cassini/Juno true colour; fine
// turbulence synthesised by domain-warping that map with zonally-stretched
// noise; the poorly imaged polar caps are rebuilt from the map's own
// latitude profile with mottled, cyclone-like texture.
export function jupiter(W, H, base /* {chs, W, H} sRGB 0..1 */) {
  const out = alloc(W, H);
  const bw = base.W, bh = base.H;
  // Colour grade the source: luminance-driven palette, keep 35% of its hue.
  const gradeLum = (L) => {
    const stops = [
      [0.0, [0.33, 0.25, 0.20]],
      [0.30, [0.58, 0.46, 0.36]],
      [0.46, [0.78, 0.68, 0.56]],
      [0.60, [0.90, 0.85, 0.76]],
      [1.0, [0.98, 0.97, 0.93]],
    ];
    for (let k = 1; k < stops.length; k++)
      if (L <= stops[k][0]) return mix3(stops[k - 1][1], stops[k][1], (L - stops[k - 1][0]) / (stops[k][0] - stops[k - 1][0]));
    return stops[stops.length - 1][1];
  };
  const src = [0, 1, 2].map(() => new Float32Array(bw * bh));
  for (let i = 0; i < bw * bh; i++) {
    const r = base.chs[0][i], g = base.chs[1][i], b = base.chs[2][i];
    const L = 0.3 * r + 0.55 * g + 0.15 * b;
    const p = gradeLum(Math.pow(L, 1.1));
    const m = (r + g + b) / 3 + 1e-4;
    const hue = [r / m, g / m, b / m];
    // Hue from the source, but pulled strongly toward the neutral palette.
    for (let c = 0; c < 3; c++) src[c][i] = p[c] * lerp(1, Math.min(1.6, hue[c]), 0.18);
  }
  // Latitude profile (row means) for the polar rebuild.
  const prof = [0, 1, 2].map(() => new Float32Array(bh));
  for (let y = 0; y < bh; y++)
    for (let c = 0; c < 3; c++) {
      let s = 0;
      for (let x = 0; x < bw; x++) s += src[c][y * bw + x];
      prof[c][y] = s / bw;
    }
  const sample = (c, latR, lonR) => {
    const fx = ((lonR + Math.PI) / (2 * Math.PI)) * bw - 0.5;
    const fy = ((Math.PI / 2 - latR) / Math.PI) * bh - 0.5;
    const x0 = Math.floor(fx), y0 = Math.floor(fy), tx = fx - x0, ty = fy - y0;
    // Catmull-Rom bicubic for a less blurry upscale.
    const cub = (p0, p1, p2, p3, t) => p1 + 0.5 * t * (p2 - p0 + t * (2 * p0 - 5 * p1 + 4 * p2 - p3 + t * (3 * (p1 - p2) + p3 - p0)));
    const row = (yy) => {
      yy = Math.max(0, Math.min(bh - 1, yy));
      const g = (xx) => src[c][yy * bw + (((xx % bw) + bw) % bw)];
      return cub(g(x0 - 1), g(x0), g(x0 + 1), g(x0 + 2), tx);
    };
    return cub(row(y0 - 1), row(y0), row(y0 + 1), row(y0 + 2), ty);
  };
  const profAt = (c, latR) => {
    const fy = Math.max(0, Math.min(bh - 1, ((Math.PI / 2 - latR) / Math.PI) * bh - 0.5));
    const y0 = Math.floor(fy), t = fy - y0;
    return lerp(prof[c][y0], prof[c][Math.min(bh - 1, y0 + 1)], t);
  };
  // Great Red Spot centre in the NASA source map, measured by inspection
  // (the oval at 31 S, 109 W; the source's latitudes run a little south of
  // modern planetocentric values).
  const grs = { lat: -31 * DEG, lon: -109 * DEG };
  out.grs = { latDeg: grs.lat / DEG, lonDeg: grs.lon / DEG };
  const wA = makeFbm(501, 5), wB = makeFbm(502, 5), wC = makeFbm(503, 4), wD = makeFbm(504, 4);
  const turb = makeFbm(505, 6), mottle = makeFbm(506, 6), cyc = makeSimplex3(507);
  forEachPixel(W, H, (i, x, y, z, lat, lon) => {
    const ld = lat / DEG;
    // Calm the warp inside the Great Red Spot so its oval stays clean.
    const eg = ellipse(lat, lon, grs.lat, grs.lon, 12, 6.5);
    const calm = smoothstep(0.7, 1.4, eg);
    // Zonal domain warp: small in latitude (band edges ripple and curl),
    // larger in longitude (features shear along the jets).
    const dLat = (0.55 * wA(x * 5, y * 16, z * 5) + 0.22 * wB(x * 16, y * 48, z * 16) + 0.07 * wD(x * 40, y * 110, z * 40)) * DEG * calm;
    const dLon = (2.2 * wC(x * 3, y * 10, z * 3) + 0.5 * wD(x * 14, y * 30, z * 14)) * DEG * calm;
    let c = [0, 1, 2].map((k) => sample(k, lat + dLat, lon + dLon / Math.max(0.2, Math.cos(lat))));
    // Fine streaky turbulence (multiplicative), stronger in belts.
    const t = turb(x * 22, y * 70, z * 22);
    let l = 1 + 0.07 * t;
    // GRS colour: a salmon-red oval inside a pale "Red Spot Hollow".
    if (eg < 1.8) {
      const core = 1 - smoothstep(0.55, 0.95, eg);
      const hollow = Math.exp(-((eg - 1.15) * (eg - 1.15)) / 0.03);
      c = mix3(c, [0.80, 0.46, 0.33], 0.75 * core);
      c = mix3(c, [0.93, 0.89, 0.80], 0.55 * hollow);
    }
    // GRS internal swirl.
    if (eg < 1.3) {
      const ang = Math.atan2(lat - grs.lat, (lon - grs.lon) * Math.cos(grs.lat) * 0.55);
      const sw = Math.sin(eg * 18 + ang * 2) * (1 - smoothstep(0.6, 1.2, eg));
      l *= 1 + 0.05 * sw;
    }
    // Polar rebuild beyond ~50 degrees.
    const polar = smoothstep(46, 58, Math.abs(ld));
    if (polar > 0) {
      const m = mottle(x * 7, y * 7, z * 7);
      const cy = cyc(x * 20, y * 20, z * 20);
      const pc = [0, 1, 2].map((k) => profAt(k, Math.sign(lat) * Math.min(Math.abs(lat), 52 * DEG)));
      const toward = smoothstep(55, 88, Math.abs(ld));
      const grey = mix3(pc, [0.52, 0.50, 0.47], 0.55 * toward);
      const pl = 1 + 0.14 * m + 0.08 * cy * cy * Math.sign(cy) - 0.12 * toward;
      const pcol = grey.map((v) => v * pl);
      c = mix3(c, pcol, polar);
    }
    out.chs[0][i] = c[0] * l; out.chs[1][i] = c[1] * l; out.chs[2][i] = c[2] * l;
    out.height[i] = (0.3 * c[0] + 0.55 * c[1] + 0.15 * c[2]) * l;
  });
  return out;
}

// ---------------------------------------------------------------- Pluto
// Colourise the New Horizons panchromatic mosaic with a ramp matched to the
// enhanced/true-colour MVIC views (dark red-brown Cthulhu, tan uplands,
// pale cream Sputnik Planitia), and fill the never-imaged south (polar
// night in 2015) with mottled terrain that continues the imaged statistics.
export function plutoColorize(gray /* 0..1 filled */, cover, W, H, lowDetail /* 0..1, 1 = blurry source */) {
  const out = alloc(W, H);
  const ramp = [
    [0.0, [0.17, 0.11, 0.08]],
    [0.2, [0.37, 0.26, 0.19]],
    [0.4, [0.60, 0.50, 0.41]],
    [0.6, [0.78, 0.71, 0.62]],
    [0.8, [0.90, 0.86, 0.79]],
    [1.0, [0.97, 0.95, 0.92]],
  ];
  const rampAt = (v) => {
    if (v <= 0) return ramp[0][1];
    for (let k = 1; k < ramp.length; k++)
      if (v <= ramp[k][0]) return mix3(ramp[k - 1][1], ramp[k][1], (v - ramp[k - 1][0]) / (ramp[k][0] - ramp[k - 1][0]));
    return ramp[ramp.length - 1][1];
  };
  const m1 = makeFbm(601, 6), m2 = makeFbm(602, 5);
  forEachPixel(W, H, (i, x, y, z) => {
    let v = gray[i];
    // Where the source is only low-resolution (far side), add fine detail
    // at the imaged areas' contrast so the resolution edge does not show.
    if (lowDetail && lowDetail[i] > 0) {
      v += lowDetail[i] * (0.05 * m2(x * 60, y * 60, z * 60) + 0.035 * m1(x * 150, y * 150, z * 150));
    }
    const fillW = 1 - cover[i];
    if (fillW > 0) {
      const n = 0.12 * m1(x * 6, y * 6, z * 6) + 0.06 * m2(x * 22, y * 22, z * 22);
      v = lerp(v, v + n, fillW);
    }
    const c = rampAt(clamp01(v));
    out.chs[0][i] = c[0]; out.chs[1][i] = c[1]; out.chs[2][i] = c[2];
    out.height[i] = v;
  });
  return out;
}

// Small procedural relief added where a DEM has no data.
export function reliefNoise(seed) {
  const f = makeFbm(seed, 6);
  return (x, y, z, scale) => f(x * scale, y * scale, z * scale);
}

// ---------------------------------------------------------------- Rings
// Saturn's main rings from published radii (km); returns RGBA rows covering
// [inner, outer] planet radii.
export function saturnRings(N) {
  const R = 60268;
  const inner = 66900 / R, outer = 141000 / R;
  const n1 = makeSimplex3(701), n2 = makeSimplex3(702);
  const rgba = [0, 1, 2, 3].map(() => new Float32Array(N));
  const gap = (km, c, w) => 1 - Math.exp(-((km - c) * (km - c)) / (2 * (w / 2.4) * (w / 2.4)));
  for (let k = 0; k < N; k++) {
    const r = inner + ((k + 0.5) / N) * (outer - inner);
    const km = r * R;
    const ringlet = 0.5 + 0.5 * n1(km / 900, 0.3, 0.7) * 0.6 + 0.5 * n2(km / 160, 1.7, 0.2) * 0.4;
    let a = 0, col = [0.6, 0.55, 0.5];
    if (km < 74658) { a = 0.025 * smoothstep(66900, 69000, km); col = [0.5, 0.47, 0.44]; }
    else if (km < 92000) {
      // C ring: faint, grey-brown, with plateaus.
      a = 0.10 + 0.07 * ringlet + 0.05 * smoothstep(84000, 91000, km);
      a *= gap(km, 77870, 150) * gap(km, 87491, 270) * gap(km, 88700, 60) * gap(km, 90200, 62);
      col = [0.58, 0.53, 0.47];
    } else if (km < 117580) {
      // B ring: dense, bright cream-tan, opaque in the middle.
      const t = (km - 92000) / (117580 - 92000);
      a = 0.62 + 0.32 * smoothstep(0.0, 0.25, t) - 0.08 * smoothstep(0.85, 1.0, t);
      a = Math.min(0.97, a * (0.88 + 0.24 * ringlet));
      col = mix3([0.80, 0.73, 0.60], [0.88, 0.81, 0.68], smoothstep(0.1, 0.6, t));
    } else if (km < 122170) {
      // Cassini Division: sparse, with the Huygens gap at its inner edge.
      a = 0.07 + 0.05 * ringlet;
      a *= gap(km, 117680, 285) * gap(km, 119900, 40) * gap(km, 120600, 50);
      col = [0.52, 0.49, 0.46];
    } else if (km < 136775) {
      // A ring, with the Encke and Keeler gaps.
      const t = (km - 122170) / (136775 - 122170);
      a = 0.58 - 0.10 * t + 0.08 * (ringlet - 0.5);
      a *= gap(km, 133584, 325) * gap(km, 136506, 42);
      col = [0.76, 0.71, 0.63];
    } else {
      // F ring: a thin bright strand.
      a = 0.35 * Math.exp(-((km - 140180) * (km - 140180)) / (2 * 130 * 130));
      col = [0.75, 0.72, 0.68];
    }
    // Radial brightness structure (ringlets / plateaus), strongest in B.
    const bright = 0.86 + 0.28 * ringlet + 0.06 * n2(km / 2500, 4.1, 2.2);
    rgba[0][k] = col[0] * bright; rgba[1][k] = col[1] * bright; rgba[2][k] = col[2] * bright; rgba[3][k] = clamp01(a);
  }
  return { rgba, inner, outer };
}

// Uranus's narrow rings (radii and widths in km, widths widened slightly so
// each ring resolves at 4K), dark grey.
export function uranusRings(N) {
  const R = 25559;
  const rings = [
    [41837, 18, 0.30], [42234, 20, 0.30], [42571, 20, 0.30], [44718, 30, 0.40], [45661, 30, 0.40],
    [47176, 16, 0.25], [47627, 20, 0.35], [48300, 24, 0.40], [50024, 14, 0.20], [51149, 70, 0.65],
  ];
  const inner = 41000 / R, outer = 51800 / R;
  const rgba = [0, 1, 2, 3].map(() => new Float32Array(N));
  for (let k = 0; k < N; k++) {
    const km = (inner + ((k + 0.5) / N) * (outer - inner)) * R;
    let a = 0;
    for (const [c, w, op] of rings) a = Math.max(a, op * Math.exp(-((km - c) * (km - c)) / (2 * (w / 2) * (w / 2))));
    rgba[0][k] = 0.42; rgba[1][k] = 0.43; rgba[2][k] = 0.45; rgba[3][k] = a;
  }
  return { rgba, inner, outer };
}
