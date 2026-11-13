import {
  type Camera,
  type CameraPose,
  type Proj,
  type V3,
  clamp,
  makeCamera,
  project,
  smoothstep,
} from "../engine/math";
import {
  PALETTE,
  type ColorName,
  bokehSprite,
  glowSprite,
  iconSprite,
} from "../engine/sprites";
import type { CameraPath } from "./cameraPaths";
import { timeline } from "./timeline";
import { CORE, SPHERE_R, type Segment, type SphereParticle, type World } from "./world";

/** Shutter: 180 degrees at 30 fps -> motion is integrated over 1/60 s. */
const SHUTTER = 1 / 60;
/** Lens aperture (world units) for the depth-of-field approximation. */
const APERTURE = 0.5;

const P: Proj = { x: 0, y: 0, z: 0 };
const Q: Proj = { x: 0, y: 0, z: 0 };

const fog = (z: number) => clamp((560 - z) / 260) * clamp((z - 0.25) / 1.5);

const spherePos = (s: SphereParticle, t: number, burstStart: number): V3 => {
  // slow spin of the sphere + radial burst
  const ang = t * 0.22;
  const c = Math.cos(ang);
  const sn = Math.sin(ang);
  const x0 = s.p[0] * c - s.p[2] * sn;
  const z0 = s.p[0] * sn + s.p[2] * c;
  const y0 = s.p[1];
  const u = Math.max(0, t - burstStart);
  // fast initial kick that decelerates (exp. ease-out), keeps drifting a bit
  const e = 1 - Math.exp(-u * 0.9);
  const k = 1 + s.burst * e + u * 0.25;
  return [
    x0 * k + s.drift[0] * e * 4,
    y0 * k + s.drift[1] * e * 4,
    z0 * k + s.drift[2] * e * 4,
  ];
};

type Ctx = CanvasRenderingContext2D;

let bloomA: HTMLCanvasElement | null = null;
let bloomB: HTMLCanvasElement | null = null;
/**
 * Cheap bloom: downsample the frame to 1/8 size, blur it, and add it back on
 * top. Gives the soft glowing haze of the reference without a WebGL pipeline.
 */
const applyBloom = (ctx: Ctx, width: number, height: number, strength: number) => {
  const w = Math.max(2, Math.round(width / 8));
  const h = Math.max(2, Math.round(height / 8));
  if (!bloomA || bloomA.width !== w) {
    bloomA = document.createElement("canvas");
    bloomB = document.createElement("canvas");
    bloomA.width = bloomB!.width = w;
    bloomA.height = bloomB!.height = h;
  }
  const a = bloomA.getContext("2d")!;
  const b = bloomB!.getContext("2d")!;
  a.globalCompositeOperation = "copy";
  a.filter = "none";
  a.drawImage(ctx.canvas, 0, 0, w, h);
  b.globalCompositeOperation = "copy";
  b.filter = `blur(${Math.max(1, h / 90)}px)`;
  b.drawImage(bloomA, 0, 0);
  b.filter = "none";
  ctx.save();
  ctx.globalCompositeOperation = "lighter";
  ctx.globalAlpha = strength;
  ctx.imageSmoothingEnabled = true;
  ctx.imageSmoothingQuality = "high";
  ctx.drawImage(bloomB!, 0, 0, width, height);
  ctx.restore();
};

export const renderFrame = (
  ctx: Ctx,
  world: World,
  path: CameraPath,
  t: number,
  width: number,
  height: number,
) => {
  const tl = timeline(t);
  const k = height / 2160; // resolution independence (authoring scale is 4K)
  const poseNow: CameraPose = path(t);
  const posePrev: CameraPose = path(t - SHUTTER);
  const cam = makeCamera(poseNow, width, height);
  const prev = makeCamera(posePrev, width, height);
  let activePrev = prev;
  // Opening: rack focus follows the sphere (distance to its front surface),
  // then hands over to the timeline's network focus distance.
  const sphereFocus = Math.max(3, Math.hypot(poseNow.pos[0], poseNow.pos[1], poseNow.pos[2]) - SPHERE_R * 0.4);
  const focus = sphereFocus + (tl.focus - sphereFocus) * smoothstep(1.2, 2.4, t);

  // ------------------------------------------------------------ background
  ctx.globalCompositeOperation = "source-over";
  ctx.globalAlpha = 1;
  if (tl.black) {
    ctx.fillStyle = "#01030a";
    ctx.fillRect(0, 0, width, height);
    return;
  }
  const bg = ctx.createLinearGradient(0, 0, width * 0.35, height);
  bg.addColorStop(0, "#031534");
  bg.addColorStop(0.55, "#020b22");
  bg.addColorStop(1, "#00040f");
  ctx.fillStyle = bg;
  ctx.fillRect(0, 0, width, height);

  ctx.globalCompositeOperation = "lighter";

  const coreVisible = project(cam, CORE, P);
  const coreX = coreVisible ? P.x : width / 2;
  const coreY = coreVisible ? P.y : height / 2;
  const coreZ = coreVisible ? P.z : 1e6;

  // volumetric haze around the core + diagonal light shafts
  {
    const r = height * 0.9;
    const g = ctx.createRadialGradient(coreX, coreY, 0, coreX, coreY, r);
    const a = 0.36 * tl.haze;
    g.addColorStop(0, `rgba(40,110,230,${a})`);
    g.addColorStop(0.4, `rgba(20,70,190,${a * 0.5})`);
    g.addColorStop(1, "rgba(0,0,0,0)");
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, width, height);
    const shaft = 0.05 * tl.haze * (0.35 + 1.4 * tl.lattice);
    if (shaft > 0.002) {
      for (const base of [0.6, Math.PI - 0.6, Math.PI + 0.6, -0.6]) {
        const ang = base + poseNow.roll * 0.0;
        const L = height * 1.6;
        const w = 0.06;
        const gx = ctx.createLinearGradient(coreX, coreY, coreX + Math.cos(ang) * L, coreY + Math.sin(ang) * L);
        gx.addColorStop(0, `rgba(60,140,255,${shaft})`);
        gx.addColorStop(0.5, `rgba(40,110,255,${shaft * 0.8})`);
        gx.addColorStop(1, "rgba(0,0,0,0)");
        ctx.fillStyle = gx;
        ctx.beginPath();
        ctx.moveTo(coreX, coreY);
        ctx.lineTo(coreX + Math.cos(ang - w) * L, coreY + Math.sin(ang - w) * L);
        ctx.lineTo(coreX + Math.cos(ang + w) * L, coreY + Math.sin(ang + w) * L);
        ctx.closePath();
        ctx.fill();
      }
    }
  }

  // ------------------------------------------------------------ line work
  const drawSegments = (segs: Segment[], master: number, minW = 1) => {
    if (master <= 0.003) return;
    ctx.lineCap = "round";
    for (const s of segs) {
      if (!project(cam, s.a, P) || !project(cam, s.b, Q)) continue;
      const zA = (P.z + Q.z) / 2;
      const a = master * s.alpha * fog(zA);
      if (a < 0.01) continue;
      // cheap reject: both endpoints off the same side of the screen
      if ((P.x < 0 && Q.x < 0) || (P.x > width && Q.x > width) || (P.y < 0 && Q.y < 0) || (P.y > height && Q.y > height)) continue;
      const w = Math.max(minW * k, (s.width * cam.f) / zA);
      ctx.globalAlpha = Math.min(1, a * Math.min(1, (w / k) * 0.8));
      ctx.strokeStyle = PALETTE[s.color];
      ctx.lineWidth = Math.min(w, 6 * k);
      ctx.beginPath();
      ctx.moveTo(P.x, P.y);
      ctx.lineTo(Q.x, Q.y);
      ctx.stroke();
    }
  };
  drawSegments(world.links, tl.links * 0.55, 1.4);
  drawSegments(world.beams, tl.beams, 2);
  drawSegments(world.lattice, tl.lattice * 1.2, 2.2);

  // circuits
  if (tl.circuits > 0.003) {
    ctx.lineJoin = "miter";
    for (const c of world.circuits) {
      let ok = true;
      const pts: Array<[number, number]> = [];
      let z = 0;
      for (const p of c.pts) {
        if (!project(cam, p, P)) {
          ok = false;
          break;
        }
        pts.push([P.x, P.y]);
        z = P.z;
      }
      if (!ok) continue;
      const a = tl.circuits * c.alpha * fog(z) * clamp((z - 25) / 30);
      if (a < 0.01) continue;
      const w = Math.max(1.6 * k, (0.07 * cam.f) / z);
      ctx.globalAlpha = Math.min(1, a);
      ctx.strokeStyle = PALETTE[c.color];
      ctx.lineWidth = Math.min(w, 8 * k);
      ctx.beginPath();
      ctx.moveTo(pts[0][0], pts[0][1]);
      for (let i = 1; i < pts.length; i++) ctx.lineTo(pts[i][0], pts[i][1]);
      ctx.stroke();
      ctx.fillStyle = PALETTE.white;
      const d = w * 2.4;
      ctx.fillRect(pts[pts.length - 1][0] - d / 2, pts[pts.length - 1][1] - d / 2, d, d);
    }
  }

  // ------------------------------------------------------------ particles
  const drawPoint = (
    pos: V3,
    prevPos: V3,
    size: number,
    color: ColorName,
    alpha: number,
    square: boolean,
    glow: number,
    streakGain = 1,
    dofScale = 1,
  ) => {
    if (alpha < 0.01 || !project(cam, pos, P)) return;
    const z = P.z;
    const a0 = alpha * fog(z);
    if (a0 < 0.01) return;
    const s = Math.max(1.5 * k, (size * cam.f) / z);
    if (P.x < -s * 8 || P.x > width + s * 8 || P.y < -s * 8 || P.y > height + s * 8) {
      // may still streak into frame
      if (!project(activePrev, prevPos, Q)) return;
      if ((P.x < 0 && Q.x < 0) || (P.x > width && Q.x > width) || (P.y < 0 && Q.y < 0) || (P.y > height && Q.y > height)) return;
    }
    const coc = dofScale * APERTURE * cam.f * Math.abs(1 / z - 1 / focus);
    const hasPrev = project(activePrev, prevPos, Q);
    const dx = hasPrev ? P.x - Q.x : 0;
    const dy = hasPrev ? P.y - Q.y : 0;
    const motion = Math.hypot(dx, dy);
    const css = PALETTE[color];
    if (motion > s * 1.3 && motion < width) {
      // motion-blurred streak
      const w = Math.min(Math.max(s, Math.min(coc, s * 3)), 30 * k);
      ctx.globalAlpha = Math.min(1, a0 * clamp((w * 2.2 * streakGain) / motion, 0.25, 1));
      ctx.strokeStyle = css;
      ctx.lineWidth = w;
      ctx.lineCap = "round";
      ctx.beginPath();
      ctx.moveTo(Q.x, Q.y);
      ctx.lineTo(P.x, P.y);
      ctx.stroke();
      return;
    }
    if (coc > s * 1.6) {
      // out of focus bokeh disc (energy conserving-ish)
      const r = Math.min(coc * 0.5 + s * 0.5, height * 0.25);
      ctx.globalAlpha = Math.min(1, a0 * clamp(((s * s) / (r * r)) * 7, 0.03, 1));
      ctx.drawImage(bokehSprite(color), P.x - r, P.y - r, r * 2, r * 2);
      return;
    }
    ctx.globalAlpha = Math.min(1, a0);
    ctx.fillStyle = css;
    if (square) ctx.fillRect(P.x - s / 2, P.y - s / 2, s, s);
    else {
      ctx.beginPath();
      ctx.arc(P.x, P.y, s / 2, 0, Math.PI * 2);
      ctx.fill();
    }
    if (glow > 0) {
      const g = s * 4;
      ctx.globalAlpha = Math.min(1, a0 * glow);
      ctx.drawImage(glowSprite(color), P.x - g, P.y - g, g * 2, g * 2);
    }
  };

  // network field
  if (tl.field > 0.003) {
    for (const f of world.field) {
      const tw = 0.75 + 0.25 * Math.sin(t * 2.4 + f.twinkle);
      drawPoint(f.p, f.p, f.size, f.color, tl.field * tw * 1.1, f.square, 0.8);
    }
  }
  for (const n of world.latticeNodes)
    drawPoint(n.p, n.p, n.size, n.color, tl.lattice * (0.6 + 0.4 * Math.sin(t * 3 + n.twinkle)), true, 0.6);

  // opening sphere + burst
  if (tl.sphereAlpha > 0.003) {
    // stylised long-exposure streaks during the burst (like the reference)
    const gain = 1 + 3.5 * tl.streak;
    const sh = SHUTTER * gain;
    const prevBurst = makeCamera(path(t - sh), width, height);
    const savedPrev = prev;
    activePrev = prevBurst;
    for (const s of world.sphere) {
      const p = spherePos(s, t, tl.burstStart);
      const pp = spherePos(s, t - sh, tl.burstStart);
      const tw = 0.7 + 0.3 * Math.sin(t * 5 + s.twinkle);
      drawPoint(p, pp, s.size, s.color, tl.sphereAlpha * tw * (0.3 + 0.48 * tl.streak) * (s.inner ? 0.55 : 1), s.square, 0.1 + 0.1 * tl.streak, gain, 0.3);
    }
    activePrev = savedPrev;
  }

  // icons
  if (tl.icons > 0.003) {
    for (const ic of world.icons) {
      if (!project(cam, ic.p, P)) continue;
      const a = tl.icons * fog(P.z);
      if (a < 0.01) continue;
      const s = (ic.size * cam.f) / P.z;
      if (P.x < -s || P.x > width + s || P.y < -s || P.y > height + s) continue;
      if (s < 9 * k) {
        // far away: reads as a tiny coloured pixel block
        const q = Math.max(2 * k, s * 0.75);
        ctx.globalAlpha = Math.min(1, a * 0.85);
        ctx.fillStyle = PALETTE[ic.color];
        ctx.fillRect(P.x - q / 2, P.y - q / 2, q, q);
        continue;
      }
      const coc = APERTURE * cam.f * Math.abs(1 / P.z - 1 / focus);
      const blur = coc < s * 0.25 ? 0 : coc < s * 0.8 ? 1 : 2;
      const d = s * 1.28;
      ctx.globalAlpha = Math.min(1, a * (blur === 2 ? 0.7 : 0.95));
      ctx.drawImage(iconSprite(ic.name, ic.color, ic.tile, blur), P.x - d / 2, P.y - d / 2, d, d);
    }
  }

  // ring of dots around the core
  if (tl.ring > 0.003) {
    for (const r of world.ring) drawPoint(r.p, r.p, r.size, r.color, tl.ring * (0.7 + 0.3 * Math.sin(t * 6 + r.twinkle)), true, 0.7);
  }

  // ------------------------------------------------------------ core
  if (coreVisible) {
    const R = clamp((7 * cam.f) / coreZ, 40 * k, height * 1.5);
    ctx.globalAlpha = Math.min(1, 0.9 * tl.core);
    ctx.drawImage(glowSprite("cyan"), coreX - R * 2, coreY - R * 2, R * 4, R * 4);
    ctx.drawImage(glowSprite("white"), coreX - R * 0.6, coreY - R * 0.6, R * 1.2, R * 1.2);
    // 4-point star flare
    const fl = R * 3.2;
    ctx.globalAlpha = 0.5 * tl.core;
    for (const [w, h] of [
      [fl, 2.4 * k],
      [2.4 * k, fl * 0.6],
    ]) {
      const g = ctx.createRadialGradient(coreX, coreY, 0, coreX, coreY, Math.max(w, h));
      g.addColorStop(0, "rgba(220,240,255,0.9)");
      g.addColorStop(1, "rgba(80,160,255,0)");
      ctx.fillStyle = g;
      ctx.fillRect(coreX - w, coreY - h, w * 2, h * 2);
    }
    // the chip: 3x3 grid of bright cells
    if (tl.chip > 0.01) {
      const cell = (1.0 * cam.f) / coreZ;
      const gap = cell * 0.35;
      ctx.globalAlpha = tl.chip;
      ctx.fillStyle = "#eaf8ff";
      for (let i = -1; i <= 1; i++)
        for (let j = -1; j <= 1; j++) {
          const x = coreX + i * (cell + gap);
          const y = coreY + j * (cell + gap);
          ctx.fillRect(x - cell / 2, y - cell / 2, cell, cell);
        }
      ctx.globalAlpha = tl.chip * 0.5;
      const g2 = cell * 6;
      ctx.drawImage(glowSprite("ice"), coreX - g2, coreY - g2, g2 * 2, g2 * 2);
    }
  }

  // ------------------------------------------------------------ rays
  if (tl.rays > 0.003) {
    const base = height * 0.42 * (0.35 + 0.65 * tl.rays) * (1 + 9 * Math.pow(tl.raysZoom, 2.2));
    ctx.lineCap = "butt";
    for (const r of world.rays) {
      const appear = clamp((tl.rays - r.delay) / (1 - r.delay + 1e-3));
      if (appear <= 0) continue;
      const r0 = r.r0 * base;
      const r1 = r0 + r.len * base * appear;
      const c = Math.cos(r.angle + poseNow.roll * 0.0);
      const s = Math.sin(r.angle);
      const g = ctx.createLinearGradient(coreX + c * r0, coreY + s * r0, coreX + c * r1, coreY + s * r1);
      const col = PALETTE[r.color];
      g.addColorStop(0, col);
      g.addColorStop(1, "rgba(0,0,0,0)");
      ctx.strokeStyle = g;
      ctx.globalAlpha = r.alpha * appear * (0.5 + 0.5 * tl.rays);
      ctx.lineWidth = r.width * k * (1 + 5 * tl.raysZoom);
      ctx.beginPath();
      ctx.moveTo(coreX + c * r0, coreY + s * r0);
      ctx.lineTo(coreX + c * r1, coreY + s * r1);
      ctx.stroke();
    }
  }

  // ------------------------------------------------------------ bloom
  applyBloom(ctx, width, height, 0.55 + 0.25 * tl.rays);

  // ------------------------------------------------------------ flash + fan
  if (tl.flashUp > 0.001) {
    const f = tl.flashUp;
    ctx.globalCompositeOperation = "source-over";
    ctx.globalAlpha = 1;
    const g = ctx.createRadialGradient(coreX, coreY, 0, coreX, coreY, height * 1.2);
    g.addColorStop(0, `rgba(255,255,255,${f})`);
    g.addColorStop(0.25, `rgba(190,235,245,${f * 0.92})`);
    g.addColorStop(1, `rgba(40,150,175,${f * 0.85})`);
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, width, height);
  }
  if (tl.fan > 0) {
    ctx.globalCompositeOperation = "source-over";
    ctx.globalAlpha = 1;
    const a = tl.fan;
    ctx.fillStyle = "#01030a";
    ctx.fillRect(0, 0, width, height);
    ctx.fillStyle = `rgba(70,100,130,${a * 0.55})`;
    ctx.fillRect(0, 0, width, height);
    const spin = (t - 12.92) * 2.4;
    const R = Math.hypot(width, height);
    const n = 9;
    // three passes of decreasing width fake soft (motion-blurred) wedge edges
    for (const [frac, op] of [[0.75, 0.22], [0.62, 0.26], [0.5, 0.3], [0.4, 0.34], [0.3, 0.38]] as const) {
      for (let i = 0; i < n; i++) {
        const mid = spin + (i / n) * Math.PI * 2;
        const half = ((Math.PI * 2) / n) * frac * 0.5;
        const g = ctx.createRadialGradient(width / 2, height / 2, 0, width / 2, height / 2, R * 0.6);
        g.addColorStop(0, `rgba(225,238,250,${a * op})`);
        g.addColorStop(0.35, `rgba(160,190,212,${a * op * 0.85})`);
        g.addColorStop(1, `rgba(50,80,110,${a * op * 0.4})`);
        ctx.fillStyle = g;
        ctx.beginPath();
        ctx.moveTo(width / 2, height / 2);
        ctx.arc(width / 2, height / 2, R, mid - half, mid + half);
        ctx.closePath();
        ctx.fill();
      }
    }
    ctx.globalCompositeOperation = "lighter";
    const cg = ctx.createRadialGradient(width / 2, height / 2, 0, width / 2, height / 2, height * 0.5);
    cg.addColorStop(0, `rgba(255,255,255,${a * a})`);
    cg.addColorStop(1, "rgba(255,255,255,0)");
    ctx.fillStyle = cg;
    ctx.fillRect(0, 0, width, height);
  }
  ctx.globalCompositeOperation = "source-over";
  ctx.globalAlpha = 1;
};

export type { Camera };
