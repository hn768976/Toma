import * as THREE from "three";
import { canvasTexture, makeCanvas } from "./painter";
import { mulberry32 } from "./random";

// Circuit-board textures shared by the chip looks (built once, seeded).

export const buildBoardFloor = (board: string) => {
  const S = 2048;
  const { cv, ctx } = makeCanvas(S, S);
  const base = new THREE.Color(board);
  ctx.fillStyle = `#${base.clone().multiplyScalar(0.35).getHexString()}`;
  ctx.fillRect(0, 0, S, S);
  const rng = mulberry32(0xf100);
  const bright = `#${base.clone().multiplyScalar(5.5).getHexString()}`;
  const mid = `#${base.clone().multiplyScalar(2.4).getHexString()}`;
  // traces
  ctx.lineCap = "square";
  for (let i = 0; i < 260; i++) {
    let x = rng() * S;
    let y = rng() * S;
    ctx.strokeStyle = rng() < 0.25 ? bright : mid;
    ctx.lineWidth = 3 + rng() * 6;
    ctx.beginPath();
    ctx.moveTo(x, y);
    for (let k = 0; k < 3; k++) {
      if (rng() < 0.6) y += (rng() - 0.5) * 500;
      else x += (rng() - 0.5) * 300;
      ctx.lineTo(x, y);
    }
    ctx.stroke();
  }
  // rows of bright pin blocks (like the reference's foreground connectors)
  for (let r = 0; r < 420; r++) {
    const y = rng() * S;
    const x0 = rng() * S;
    const n = 6 + Math.floor(rng() * 24);
    ctx.fillStyle = rng() < 0.5 ? bright : `#${base.clone().multiplyScalar(7).lerp(new THREE.Color("#ffffff"), 0.15).getHexString()}`;
    for (let k = 0; k < n; k++) ctx.fillRect(x0 + k * 14, y, 7, 12 + rng() * 8);
  }
  // components
  for (let i = 0; i < 60; i++) {
    const w = 40 + rng() * 200;
    const h = 30 + rng() * 120;
    const x = rng() * S;
    const y = rng() * S;
    ctx.fillStyle = "#050a14";
    ctx.fillRect(x, y, w, h);
    ctx.strokeStyle = mid;
    ctx.lineWidth = 3;
    ctx.strokeRect(x, y, w, h);
  }
  // keep the area under the chip calm
  const g = ctx.createRadialGradient(S / 2, S * 0.5, 0, S / 2, S * 0.5, S * 0.12);
  g.addColorStop(0, "rgba(0,0,0,0.85)");
  g.addColorStop(1, "rgba(0,0,0,0)");
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, S, S);
  const tex = canvasTexture(cv, 8);
  tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
  return tex;
};

export const buildBoardBackdrop = (board: string, accents: string[], blurPx: number) => {
  const W = 2048;
  const H = 1152;
  const { cv: raw, ctx } = makeCanvas(W, H);
  const base = new THREE.Color(board);
  const g = ctx.createLinearGradient(0, 0, 0, H);
  g.addColorStop(0, `#${base.clone().multiplyScalar(0.18).getHexString()}`);
  g.addColorStop(0.6, `#${base.clone().multiplyScalar(0.45).getHexString()}`);
  g.addColorStop(1, `#${base.clone().multiplyScalar(0.3).getHexString()}`);
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, W, H);
  const rng = mulberry32(0xbacd);
  // tall components / heat-sink fins / cables
  for (let i = 0; i < 70; i++) {
    const w = 20 + rng() * 140;
    const h = 60 + rng() * 500;
    const x = rng() * W;
    const y = rng() * H * 0.9;
    const r = rng();
    const c = r < 0.35 ? new THREE.Color("#010306") : base.clone().multiplyScalar(0.6 + rng() * 2.6);
    ctx.fillStyle = `#${c.getHexString()}`;
    ctx.globalAlpha = 0.6 + 0.4 * rng();
    ctx.fillRect(x, y, w, h);
  }
  // a few accent shapes in the bokeh colours
  for (let i = 0; i < 18; i++) {
    const c = new THREE.Color(accents[Math.floor(rng() * accents.length)]).multiplyScalar(0.35);
    ctx.fillStyle = `#${c.getHexString()}`;
    ctx.globalAlpha = 0.7;
    ctx.fillRect(rng() * W, rng() * H * 0.6, 60 + rng() * 260, 18 + rng() * 40);
  }
  // a few tall soft light strips
  for (let i = 0; i < 7; i++) {
    const c = base.clone().multiplyScalar(4 + rng() * 3);
    ctx.fillStyle = `#${c.getHexString()}`;
    ctx.globalAlpha = 0.35;
    ctx.fillRect(W * (0.3 + rng() * 0.45), 0, 14 + rng() * 30, H * (0.3 + rng() * 0.3));
  }
  ctx.globalAlpha = 1;
  const { cv, ctx: bctx } = makeCanvas(W, H);
  bctx.filter = `blur(${blurPx}px)`;
  bctx.drawImage(raw, 0, 0);
  bctx.filter = "none";
  return canvasTexture(cv, 4);
};

