import React, { useMemo } from "react";
import { Container } from "pixi.js";
import { GlowBatch } from "../../lib/pixi/GlowBatch";
import { PixiScene, PixiStage } from "../../lib/pixi/PixiStage";
import { StripBatch } from "../../lib/pixi/StripBatch";
import { Projector } from "../../lib/pixi/projector";
import { makeNoise3 } from "../../lib/noise";
import { gauss, hash2, mulberry32, range } from "../../lib/random";
import { FibreStrandsVersion } from "../../versions";

// Look 5 — Fibre Strands (20 s loop, pure black). ~200 glowing fibres follow
// a writhing ribbon spine; heads run along 40 of them. Spine noise is sampled
// on a circle in time (cos 2πt, sin 2πt), heads advance whole laps per loop.

export const FS_DURATION = 600;
const NSTR = 200;
const NPTS = 120;
const NHEADS = 40;
const FOV = 50;
const TAU = Math.PI * 2;

const hexRgb = (h: string): [number, number, number] => {
  const n = parseInt(h.slice(1), 16);
  return [((n >> 16) & 255) / 255, ((n >> 8) & 255) / 255, (n & 255) / 255];
};
// sRGB → linear-ish so additive mixing looks right in the HDR target
const lin = (c: number) => Math.pow(c, 2.2);

const buildScene = (v: FibreStrandsVersion): PixiScene => {
  const r = mulberry32(0xf1b3e5);
  const nz = makeNoise3(0x5eed5);
  const deep = hexRgb(v.strandDeep).map(lin);
  const light = hexRgb(v.strandLight).map(lin);
  const head = hexRgb(v.head).map(lin);

  type Strand = { rad: number; ang: number; mix: number; br: number; wig: number; ph: number; u0: number; u1: number; near: number; w: number; g: number };
  const strands: Strand[] = [];
  for (let i = 0; i < NSTR; i++) {
    strands.push({
      rad: Math.sqrt(r()) * (0.6 + 0.4 * r()),
      ang: r() * TAU,
      mix: Math.pow(r(), 3),
      br: r() < 0.22 ? range(r, 1.0, 1.8) : range(r, 0.05, 0.18),
      wig: range(r, 0.1, 0.9),
      ph: r() * 100,
      u0: r() * 0.12,
      u1: 1 - r() * 0.15,
      near: 0,
      w: range(r, 0.012, 0.028),
      g: Math.floor(r() * 10),
    });
  }
  // a few thick strands close to the camera (defocused)
  for (let i = 0; i < 3; i++)
    strands.push({ rad: 0, ang: 0, mix: 0.3 + 0.5 * r(), br: range(r, 0.5, 0.9), wig: 0.2, ph: r() * 100, u0: 0, u1: 0.75, near: 1 + i, w: range(r, 0.05, 0.09), g: i });
  const bright = strands.map((x, i) => [x.br, i] as const).filter(([b]) => b > 0.8).map(([, i]) => i);
  const heads = Array.from({ length: NHEADS }, () => ({ s: bright[Math.floor(r() * bright.length)], ph: r(), laps: 1 + Math.floor(r() * 3), len: range(r, 0.1, 0.22), br: range(r, 0.7, 1.3) }));
  void gauss;

  const world = new Container();
  const strip = new StripBatch((NSTR + 8) * NPTS + NHEADS * 24);
  world.addChild(strip.mesh);
  const glows = new GlowBatch(NHEADS * 2 + 4);
  world.addChild(glows.mesh);
  const cam = new Projector();
  const spine = new Float32Array(NPTS * 3);
  const frN = new Float32Array(NPTS * 3);
  const frB = new Float32Array(NPTS * 3);
  const xs = new Float32Array(NPTS),
    ys = new Float32Array(NPTS),
    ws = new Float32Array(NPTS),
    cs = new Float32Array(NPTS * 4),
    sf = new Float32Array(NPTS),
    zs = new Float32Array(NPTS);
  const hx = new Float32Array(24),
    hy = new Float32Array(24),
    hw = new Float32Array(24),
    hc = new Float32Array(96),
    hs = new Float32Array(24);
  const back = hexRgb(v.backLight).map(lin);

  const strandPoint = (s: Strand, i: number, u: number, out: number[], ct: number, st: number) => {
    const k = Math.min(NPTS - 1, Math.max(0, u * (NPTS - 1)));
    const j = Math.min(NPTS - 2, Math.floor(k));
    const t = k - j;
    const P = [0, 1, 2].map((a) => spine[j * 3 + a] * (1 - t) + spine[(j + 1) * 3 + a] * t);
    const N = [0, 1, 2].map((a) => frN[j * 3 + a]);
    const B = [0, 1, 2].map((a) => frB[j * 3 + a]);
    // bundle radius fans out toward the far end; twisting offset
    const pinch = Math.min(1, Math.abs(u - 0.33) * 2.6);
    const rho = (0.6 + 1.2 * (1 - u) * 0 + 5.5 * Math.max(0, u - 0.33)) * (0.2 + 0.8 * pinch) + 1.2 * Math.max(0, 0.33 - u);
    const tw = s.ang + 2.2 * u + 0.8 * nz(u * 1.5 + 7, ct * 0.6 + i * 0.013, st * 0.6);
    let a = Math.cos(tw) * s.rad * rho,
      b = Math.sin(tw) * s.rad * rho;
    a += s.wig * Math.sin(u * 9 + s.ph + ct * 1.3) * (0.4 + u);
    b += s.wig * Math.cos(u * 7 + s.ph * 1.7 + st * 1.3) * (0.4 + u);
    // sub-bundles peel away from each other toward the far end
    const gA = 9 * pinch * (0.4 + u);
    a += gA * nz(u * 1.5 + s.g * 17.3, ct * 0.8, st * 0.8 + s.g);
    b += gA * nz(u * 1.5 + s.g * 17.3 + 50, ct * 0.8 + s.g, st * 0.8);
    // some sub-bundles throw big open loops up above the knot
    if (s.g % 3 === 0) b += (6 + 3 * nz(s.g * 3.1, ct * 0.4, st * 0.4)) * Math.sin(Math.PI * Math.min(1, Math.max(0, (u - 0.33) / 0.5)));
    // each fibre also strays on its own
    const iA = 2.6 * Math.pow(u, 1.2) * pinch;
    a += iA * nz(u * 2.4 + s.ph, ct * 0.5 + s.ph * 0.1, st * 0.5);
    b += iA * nz(u * 2.4 + s.ph + 90, ct * 0.5, st * 0.5 + s.ph * 0.1);
    if (s.near) {
      // near strands: pulled toward the camera and off to a side
      a += (s.near % 2 ? -1 : 1) * (1.2 + s.near * 0.6);
      out[0] = P[0] + N[0] * a + B[0] * b;
      out[1] = P[1] + N[1] * a + B[1] * b;
      out[2] = P[2] + N[2] * a + B[2] * b + 3 + s.near * 0.8;
      return;
    }
    out[0] = P[0] + N[0] * a + B[0] * b;
    out[1] = P[1] + N[1] * a + B[1] * b;
    out[2] = P[2] + N[2] * a + B[2] * b;
  };

  return {
    world,
    update: (frame, { width, height, px }) => {
      const f = ((frame % FS_DURATION) + FS_DURATION) % FS_DURATION;
      const t = f / FS_DURATION;
      const ct = Math.cos(TAU * t) * 1.3,
        st = Math.sin(TAU * t) * 1.3;
      // camera: slow drift on a closed path
      cam.set([Math.sin(TAU * t) * 1.2, Math.cos(TAU * t) * 0.6, 22], Math.sin(TAU * t + 1) * 0.05, Math.cos(TAU * t * 2) * 0.03, 0.08 * Math.sin(TAU * t), FOV, width, height);
      const focal = cam.focal;
      const zf = 22;
      // ---- spine: diagonal sweep lower-left → upper-right, writhing
      for (let i = 0; i < NPTS; i++) {
        const u = i / (NPTS - 1);
        // rises from the lower left to a crest, then fans down to the right toward the camera
        // rises from the lower left into a knot left of centre, then spreads right and down toward the camera
        const bx = -11 + 30 * u,
          by = -15 + 13.5 * Math.sin(Math.PI * Math.min(1, u / 0.72)),
          bz = -3 + 11 * u * u;
        const A = 2.5 + 2 * u;
        spine[i * 3] = bx + A * nz(u * 2.2, ct, st);
        spine[i * 3 + 1] = by + A * 1.8 * nz(u * 2.2 + 31.7, ct, st);
        spine[i * 3 + 2] = bz + A * 1.4 * nz(u * 2.2 + 63.1, ct, st);
      }
      // frames (N, B) from tangent and a fixed up
      for (let i = 0; i < NPTS; i++) {
        const i0 = Math.max(0, i - 1),
          i1 = Math.min(NPTS - 1, i + 1);
        let tx = spine[i1 * 3] - spine[i0 * 3],
          ty = spine[i1 * 3 + 1] - spine[i0 * 3 + 1],
          tz = spine[i1 * 3 + 2] - spine[i0 * 3 + 2];
        const tl = Math.hypot(tx, ty, tz) || 1;
        tx /= tl;
        ty /= tl;
        tz /= tl;
        // N = normalize(T × Z), B = N × T
        let nx = ty * 1 - tz * 0,
          ny = tz * 0 - tx * 1,
          nzv = 0;
        const nl = Math.hypot(nx, ny, nzv) || 1;
        nx /= nl;
        ny /= nl;
        nzv /= nl;
        frN[i * 3] = nx;
        frN[i * 3 + 1] = ny;
        frN[i * 3 + 2] = nzv;
        frB[i * 3] = ny * tz - nzv * ty;
        frB[i * 3 + 1] = nzv * tx - nx * tz;
        frB[i * 3 + 2] = nx * ty - ny * tx;
      }

      strip.begin();
      glows.begin();
      const pt = [0, 0, 0];
      strands.forEach((s, si) => {
        let n = 0;
        for (let i = 0; i < NPTS; i++) {
          const u = s.u0 + (s.u1 - s.u0) * (i / (NPTS - 1));
          strandPoint(s, si, u, pt, ct, st);
          if (!cam.project(pt[0], pt[1], pt[2], 2.5)) {
            // split the strip where it passes behind the near plane
            if (n >= 2) strip.strip(n, xs, ys, ws, cs, sf);
            n = 0;
            continue;
          }
          const z = cam.z;
          const core = Math.max(1.0 * px, (s.w * focal) / z);
          const coc = 0.12 * focal * Math.abs(1 / z - 1 / zf) * (s.near ? 0.8 : 1);
          const w = core + coc;
          const e = core / w;
          // brightness along the strand: fade at the ends, brighter toward the light end
          const uu = i / (NPTS - 1);
          const endFade = Math.min(1, uu / 0.12) * Math.min(1, (1 - uu) / 0.2);
          const grain = 0.45 + 0.55 * hash2(si * 977 + i, Math.floor(f / 2));
          const bright = s.br * endFade * (0.45 + 0.55 * Math.sin(Math.PI * Math.min(1, u * 1.1))) * (s.near ? 0.45 : 1) * (s.near ? 1 : grain);
          const m = Math.min(1, s.mix * 0.35);
          const k = 0.32 * bright * (0.35 + 0.65 * e);
          xs[n] = cam.x;
          ys[n] = cam.y;
          zs[n] = z;
          ws[n] = w;
          cs[n * 4] = (deep[0] + (light[0] - deep[0]) * m) * k;
          cs[n * 4 + 1] = (deep[1] + (light[1] - deep[1]) * m) * k;
          cs[n * 4 + 2] = (deep[2] + (light[2] - deep[2]) * m) * k;
          cs[n * 4 + 3] = k;
          sf[n] = Math.min(1, coc / (core + 1e-3) * 0.35);
          n++;
        }
        strip.strip(n, xs, ys, ws, cs, sf);
      });

      // ---- heads with short tails (whole laps per loop)
      heads.forEach((h, hi) => {
        const s = strands[h.s];
        const u = (h.ph + h.laps * t) % 1;
        const vis = Math.sin(Math.PI * u); // fade in/out at the strand ends → seamless wrap
        let n = 0;
        for (let k = 0; k < 24; k++) {
          const uu = u - h.len * (k / 23);
          if (uu < 0) break;
          strandPoint(s, h.s, s.u0 + (s.u1 - s.u0) * uu, pt, ct, st);
          if (!cam.project(pt[0], pt[1], pt[2], 0.5)) break;
          const z = cam.z;
          const tail = 1 - k / 23;
          const w = Math.max(2.5 * px, (s.w * 4.5 * focal) / z) * (0.5 + 0.5 * tail);
          const kk = 1.6 * h.br * vis * tail * tail;
          hx[n] = cam.x;
          hy[n] = cam.y;
          hw[n] = w;
          hc[n * 4] = head[0] * kk;
          hc[n * 4 + 1] = head[1] * kk;
          hc[n * 4 + 2] = head[2] * kk;
          hc[n * 4 + 3] = kk;
          hs[n] = 0;
          n++;
        }
        strip.strip(n, hx, hy, hw, hc, hs);
        if (n > 0) {
          const size = Math.max(9 * px, (0.3 * focal) / Math.max(1, cam.z));
          glows.add(hx[0], hy[0], size * 4.5, head[0], head[1], head[2], vis * h.br * 1.6, 1);
          glows.add(hx[0], hy[0], size * 6, deep[0], deep[1], deep[2], vis * h.br * 0.35, 0);
        }
        void hi;
      });

      // ---- soft coloured light behind the bundle, "sometimes"
      for (let i = 0; i < 2; i++) {
        const a = Math.max(0, Math.sin(TAU * (t * (i + 1) + i * 0.37))) ** 6 * 0.08;
        strandPoint(strands[0], 0, 0.35 + 0.4 * i, pt, ct, st);
        if (cam.project(pt[0], pt[1], pt[2] - 4, 0.5)) glows.add(cam.x, cam.y, height * 0.3, back[0], back[1], back[2], a, 0);
      }
      glows.end();
      strip.end();
    },
  };
};

export const FibreStrands: React.FC<{ version: FibreStrandsVersion }> = ({ version }) => {
  const post = useMemo(
    () => ({ bloomA: 0.5, bloomB: 0.22, exposure: 1.0, grain: 0, dither: true, blackSafe: true, bg: [0, 0, 0] as [number, number, number], grainPeriod: FS_DURATION }),
    [],
  );
  const build = useMemo(() => () => buildScene(version), [version]);
  return <PixiStage build={build} post={post} />;
};
