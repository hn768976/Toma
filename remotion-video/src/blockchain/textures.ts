// Canvas-generated textures. Everything the scene draws is procedural
// -- no image assets -- so the project stays self-contained and
// renders identically at 1080p and 4K.

import * as THREE from "three/webgpu";
import { makeRandom } from "./rng";

const canvas2d = (size: number, height = size) => {
  const canvas = document.createElement("canvas");
  canvas.width = size;
  canvas.height = height;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("2D canvas context unavailable");
  return { canvas, ctx };
};

const finish = (canvas: HTMLCanvasElement, anisotropy = 8) => {
  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.anisotropy = anisotropy;
  texture.wrapS = THREE.RepeatWrapping;
  texture.wrapT = THREE.RepeatWrapping;
  texture.needsUpdate = true;
  return texture;
};

// A cube face: a dense grid of 0/1 glyphs with a bright inner frame.
// Digit brightness varies per cell so the face shimmers under bloom
// instead of reading as a flat screen of text.
export const makeBinaryFaceTexture = (seed: number, size = 512) => {
  const random = makeRandom(seed);
  const { canvas, ctx } = canvas2d(size);

  ctx.clearRect(0, 0, size, size);

  // Faint fill so the cube reads as a solid volume, not a wireframe.
  const wash = ctx.createLinearGradient(0, 0, size, size);
  wash.addColorStop(0, "rgba(20, 84, 156, 0.22)");
  wash.addColorStop(0.55, "rgba(10, 48, 104, 0.11)");
  wash.addColorStop(1, "rgba(18, 76, 142, 0.18)");
  ctx.fillStyle = wash;
  ctx.fillRect(0, 0, size, size);

  const cols = 20;
  const cell = size / cols;
  ctx.font = `600 ${Math.round(cell * 0.82)}px "Courier New", monospace`;
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";

  for (let y = 0; y < cols; y++) {
    for (let x = 0; x < cols; x++) {
      const roll = random();
      // Leave a few cells empty; a perfectly full grid looks printed.
      if (roll < 0.07) continue;
      const bright = random();
      const digit = random() < 0.5 ? "0" : "1";
      if (bright > 0.975) {
        ctx.fillStyle = "rgba(255, 92, 92, 0.85)"; // rare red glyph
      } else if (bright > 0.9) {
        ctx.fillStyle = "rgba(226, 246, 255, 0.98)";
      } else if (bright > 0.52) {
        ctx.fillStyle = "rgba(126, 206, 255, 0.86)";
      } else {
        ctx.fillStyle = "rgba(70, 150, 224, 0.62)";
      }
      ctx.fillText(digit, (x + 0.5) * cell, (y + 0.5) * cell);
    }
  }

  // Inner frame: catches the light along each face edge.
  ctx.strokeStyle = "rgba(120, 196, 245, 0.34)";
  ctx.lineWidth = Math.max(2, size / 220);
  ctx.strokeRect(cell * 0.4, cell * 0.4, size - cell * 0.8, size - cell * 0.8);

  return finish(canvas);
};

// Horizontal binary strip drawn between consecutive cubes -- the
// "link" in the chain. Mostly cool white with the odd red digit.
export const makeLinkTexture = (seed: number, width = 512, height = 64) => {
  const random = makeRandom(seed);
  const { canvas, ctx } = canvas2d(width, height);
  ctx.clearRect(0, 0, width, height);

  const glyphs = 22;
  const cell = width / glyphs;
  ctx.font = `700 ${Math.round(height * 0.72)}px "Courier New", monospace`;
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";

  for (let i = 0; i < glyphs; i++) {
    if (random() < 0.08) continue;
    const roll = random();
    ctx.fillStyle =
      roll > 0.86
        ? "rgba(255, 74, 74, 0.9)"
        : roll > 0.4
          ? "rgba(224, 244, 255, 0.85)"
          : "rgba(110, 190, 245, 0.7)";
    ctx.fillText(random() < 0.5 ? "0" : "1", (i + 0.5) * cell, height * 0.5);
  }

  return finish(canvas);
};

// Soft round glow used for every point-ish particle in the field.
export const makeGlowTexture = (size = 64) => {
  const { canvas, ctx } = canvas2d(size);
  const gradient = ctx.createRadialGradient(
    size / 2,
    size / 2,
    0,
    size / 2,
    size / 2,
    size / 2,
  );
  gradient.addColorStop(0, "rgba(255, 255, 255, 1)");
  gradient.addColorStop(0.25, "rgba(255, 255, 255, 0.72)");
  gradient.addColorStop(0.55, "rgba(255, 255, 255, 0.18)");
  gradient.addColorStop(1, "rgba(255, 255, 255, 0)");
  ctx.fillStyle = gradient;
  ctx.fillRect(0, 0, size, size);
  return finish(canvas, 1);
};

// Atlas of the small floating readouts ("568.70", "10110") that drift
// through the reference's data field. One texture, sampled per-sprite
// through UV offsets, so the whole field costs a single draw call.
export const NUMBER_ATLAS_ROWS = 16;

export const makeNumberAtlasTexture = (seed: number, cellW = 256, cellH = 64) => {
  const random = makeRandom(seed);
  const { canvas, ctx } = canvas2d(cellW, cellH * NUMBER_ATLAS_ROWS);
  ctx.clearRect(0, 0, cellW, cellH * NUMBER_ATLAS_ROWS);
  ctx.font = `600 ${Math.round(cellH * 0.66)}px "Courier New", monospace`;
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";

  for (let row = 0; row < NUMBER_ATLAS_ROWS; row++) {
    const kind = random();
    let label: string;
    if (kind < 0.45) {
      // Decimal readout, e.g. "568.70"
      label = `${Math.floor(100 + random() * 900)}.${String(
        Math.floor(random() * 100),
      ).padStart(2, "0")}`;
    } else if (kind < 0.8) {
      // Short binary run
      const len = 5 + Math.floor(random() * 6);
      label = Array.from({ length: len }, () => (random() < 0.5 ? "0" : "1")).join("");
    } else {
      label = `0x${Math.floor(random() * 0xffff)
        .toString(16)
        .toUpperCase()
        .padStart(4, "0")}`;
    }
    const roll = random();
    ctx.fillStyle =
      roll > 0.84 ? "rgba(224, 72, 72, 0.7)" : "rgba(104, 168, 224, 0.62)";
    ctx.fillText(label, cellW / 2, (row + 0.5) * cellH);
  }

  return finish(canvas);
};
