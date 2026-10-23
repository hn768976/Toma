import * as THREE from "three";

const canvasTexture = (
  w: number,
  h: number,
  draw: (ctx: CanvasRenderingContext2D) => void,
) => {
  const c = document.createElement("canvas");
  c.width = w;
  c.height = h;
  const ctx = c.getContext("2d");
  if (!ctx) throw new Error("2D canvas unavailable");
  draw(ctx);
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = 8;
  return tex;
};

// Drive tray face: fine horizontal vent slots.
export const makeVentTexture = () =>
  canvasTexture(512, 128, (ctx) => {
    ctx.fillStyle = "#3a404a";
    ctx.fillRect(0, 0, 512, 128);
    ctx.fillStyle = "#0b0d11";
    for (let x = 20; x < 470; x += 9) {
      for (let y = 22; y < 106; y += 21) {
        ctx.fillRect(x, y, 5, 15);
      }
    }
    // Bevel highlight along the top edge.
    ctx.fillStyle = "rgba(255,255,255,0.18)";
    ctx.fillRect(0, 0, 512, 6);
    ctx.fillStyle = "rgba(0,0,0,0.5)";
    ctx.fillRect(0, 120, 512, 8);
  });

// Vertical 2.5" drive tray: dark body with a vent column.
export const makeSlimTrayTexture = () =>
  canvasTexture(64, 256, (ctx) => {
    ctx.fillStyle = "#30353e";
    ctx.fillRect(0, 0, 64, 256);
    ctx.fillStyle = "#0a0c10";
    for (let y = 14; y < 240; y += 10) ctx.fillRect(14, y, 36, 5);
    ctx.fillStyle = "rgba(255,255,255,0.15)";
    ctx.fillRect(0, 0, 4, 256);
  });

// 1U bezel: honeycomb-like perforation.
export const makeGrilleTexture = () =>
  canvasTexture(512, 64, (ctx) => {
    ctx.fillStyle = "#23272e";
    ctx.fillRect(0, 0, 512, 64);
    ctx.fillStyle = "#07080b";
    for (let y = 8; y < 60; y += 8) {
      for (let x = 6 + ((y / 8) % 2) * 4; x < 508; x += 8) {
        ctx.beginPath();
        ctx.arc(x, y, 2.6, 0, Math.PI * 2);
        ctx.fill();
      }
    }
  });

// Perforated cabinet door.
export const makeDoorTexture = () => {
  const tex = canvasTexture(256, 256, (ctx) => {
    ctx.fillStyle = "#2c313a";
    ctx.fillRect(0, 0, 256, 256);
    ctx.fillStyle = "#050608";
    for (let y = 4; y < 256; y += 8) {
      for (let x = 4 + ((y / 8) % 2) * 4; x < 256; x += 8) {
        ctx.fillRect(x - 2.2, y - 2.2, 4.4, 4.4);
      }
    }
  });
  tex.wrapS = THREE.RepeatWrapping;
  tex.wrapT = THREE.RepeatWrapping;
  tex.repeat.set(6, 26);
  return tex;
};
