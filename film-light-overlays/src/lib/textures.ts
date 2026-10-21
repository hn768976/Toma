import { CanvasTexture, ClampToEdgeWrapping, LinearFilter, RepeatWrapping, Texture } from "three";
import { mulberry32, range } from "./random";

// Canvas 2D detail textures (sprockets, scratches, gate edge). Drawn once with
// seeded randomness; built lazily because they need a DOM canvas.

const cache = new Map<string, Texture>();

const make = (key: string, w: number, h: number, draw: (ctx: CanvasRenderingContext2D) => void, repeat = true) => {
  const hit = cache.get(key);
  if (hit) return hit;
  const canvas = document.createElement("canvas");
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext("2d")!;
  draw(ctx);
  const tex = new CanvasTexture(canvas);
  tex.minFilter = LinearFilter;
  tex.magFilter = LinearFilter;
  tex.generateMipmaps = false;
  tex.wrapS = repeat ? RepeatWrapping : ClampToEdgeWrapping;
  tex.wrapT = repeat ? RepeatWrapping : ClampToEdgeWrapping;
  tex.needsUpdate = true;
  cache.set(key, tex);
  return tex;
};

const roundRect = (ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number) => {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
};

/**
 * Scratch profiles: 16 variants side by side (4 px columns), each a vertical
 * run of segments with different brightness and gaps. Red = intensity.
 */
export const getScratchTexture = () =>
  make("scratch", 64, 2048, (ctx) => {
    const rng = mulberry32(0x5c7a);
    ctx.fillStyle = "#000";
    ctx.fillRect(0, 0, 64, 2048);
    for (let v = 0; v < 16; v++) {
      let y = 0;
      while (y < 2048) {
        const len = Math.floor(range(rng, 10, 260));
        const on = rng() < 0.78;
        if (on) {
          const a = range(rng, 0.35, 1);
          const g = ctx.createLinearGradient(0, y, 0, y + len);
          g.addColorStop(0, `rgba(255,255,255,0)`);
          g.addColorStop(0.15, `rgba(255,255,255,${a})`);
          g.addColorStop(0.85, `rgba(255,255,255,${a * range(rng, 0.5, 1)})`);
          g.addColorStop(1, `rgba(255,255,255,0)`);
          ctx.fillStyle = g;
          ctx.fillRect(v * 4, y, 4, len);
        }
        y += len;
      }
    }
  });

/**
 * Sprocket-hole mask for the film-burn strip edges: one tile holds 6 holes
 * (12 per frame height). White = hole. Tile is 1 x 0.5 of
 * frame height in film units; edges are slightly irregular.
 */
export const getSprocketTexture = () =>
  make("sprocket", 128, 512, (ctx) => {
    const rng = mulberry32(0x5b0c);
    ctx.fillStyle = "#000";
    ctx.fillRect(0, 0, 128, 512);
    for (let i = 0; i < 6; i++) {
      const cy = i * (512 / 6) + 256 / 6;
      for (let pass = 0; pass < 3; pass++) {
        ctx.fillStyle = `rgba(255,255,255,${pass === 0 ? 1 : 0.5})`;
        const j = pass === 0 ? 0 : 1.2;
        roundRect(ctx, 22 + range(rng, -j, j), cy - 16 + range(rng, -j, j), 84 + range(rng, -j, j), 34 + range(rng, -j, j), 5);
        ctx.fill();
      }
    }
  });

/**
 * Left edge of the 16 mm gate (covers uv.x 0..0.125, full height):
 * orange-brown outline of the sprocket holes, light bleeding round the
 * perforation edge. Holes are centred on the top and bottom frame lines.
 */
export const GATE_EDGE_U = 0.125;
export const getGateEdgeTexture = (colour: string) =>
  make(
    "gate-" + colour,
    480,
    2160,
    (ctx) => {
      const rng = mulberry32(0x6a7e);
      ctx.fillStyle = "#000";
      ctx.fillRect(0, 0, 480, 2160);
      // Hole: x from off-canvas to 0.848 of the strip, half height 0.155 of the frame.
      const right = 0.848 * 480;
      const half = 0.155 * 2160;
      const r = 46;
      const drawHole = (cy: number) => {
        for (let pass = 0; pass < 7; pass++) {
          ctx.save();
          ctx.strokeStyle = colour;
          ctx.globalAlpha = pass === 0 ? 0.95 : range(rng, 0.08, 0.3);
          ctx.lineWidth = pass === 0 ? 4.5 : range(rng, 1.5, 7);
          ctx.shadowColor = colour;
          ctx.shadowBlur = pass === 0 ? 6 : 0;
          const jx = range(rng, -2.5, 2.5);
          const jy = range(rng, -2.5, 2.5);
          roundRect(ctx, -200, cy - half + jy, right + 200 + jx, 2 * half, r);
          ctx.stroke();
          ctx.restore();
        }
        // Hot spots: light leaking brighter at points along the edge.
        for (let k = 0; k < 0; k++) {
          const onSide = rng() < 0.5;
          const x = onSide ? right + range(rng, -3, 3) : range(rng, 0, right - r);
          const y = onSide ? cy + range(rng, -half + r, half - r) : cy + (rng() < 0.5 ? -half : half) + range(rng, -3, 3);
          const g = ctx.createRadialGradient(x, y, 0, x, y, range(rng, 18, 40));
          g.addColorStop(0, `rgba(240,140,60,${range(rng, 0.25, 0.5)})`);
          g.addColorStop(1, "rgba(255,140,60,0)");
          ctx.fillStyle = g;
          ctx.fillRect(x - 40, y - 40, 80, 80);
        }
        // Brightness breaks along the outline (dirt on the perforation edge).
        ctx.save();
        ctx.globalCompositeOperation = "destination-out";
        for (let k = 0; k < 60; k++) {
          ctx.fillStyle = `rgba(0,0,0,${range(rng, 0.2, 0.75)})`;
          const y = cy + range(rng, -half - 10, half + 10);
          ctx.fillRect(right - 14, y, 28, range(rng, 3, 22));
          ctx.fillRect(range(rng, 0, right), cy + (rng() < 0.5 ? -half : half) - 8, range(rng, 4, 26), 16);
        }
        ctx.restore();
      };
      drawHole(0);
      drawHole(2160);
    },
    false,
  );
