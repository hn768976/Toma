import * as THREE from "three/webgpu";
import { createRng } from "./rng";

/**
 * Grid of 0/1 glyphs drawn to a canvas, used as the "data printed on the
 * cable" layer. Luminance only — the scene tints it from the palette, so one
 * texture serves both colourways.
 *
 * `columns` controls glyph size: the sheath uses a dense grid, the connector
 * sleeve a coarse one so its digits read large, like in the reference.
 */
export const createBinaryTexture = ({
  size = 1024,
  columns = 22,
  seed = 1337,
}: {
  size?: number;
  columns?: number;
  seed?: number;
} = {}): THREE.CanvasTexture => {
  const rng = createRng(seed);
  const canvas = document.createElement("canvas");
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext("2d")!;

  ctx.fillStyle = "#000000";
  ctx.fillRect(0, 0, size, size);

  const cell = size / columns;
  ctx.font = `600 ${Math.round(cell * 0.78)}px "SFMono-Regular", Menlo, Consolas, monospace`;
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";

  for (let row = 0; row < columns; row++) {
    for (let col = 0; col < columns; col++) {
      // Leave gaps so the digits read as sparse data rather than a solid block.
      if (rng() < 0.28) continue;
      const brightness = 0.45 + rng() * 0.55;
      const v = Math.round(brightness * 255);
      ctx.fillStyle = `rgb(${v},${v},${v})`;
      ctx.fillText(
        rng() < 0.5 ? "0" : "1",
        (col + 0.5) * cell,
        (row + 0.5) * cell,
      );
    }
  }

  const texture = new THREE.CanvasTexture(canvas);
  texture.wrapS = THREE.RepeatWrapping;
  texture.wrapT = THREE.RepeatWrapping;
  texture.colorSpace = THREE.NoColorSpace;
  texture.anisotropy = 8;
  return texture;
};

/**
 * Sparse field of soft bright specks. Multiplied into the sheath so the cable
 * glitters the way the reference's does, independently of the digit grid.
 */
export const createSparkleTexture = ({
  size = 512,
  count = 220,
  seed = 8675309,
}: { size?: number; count?: number; seed?: number } = {}): THREE.CanvasTexture => {
  const rng = createRng(seed);
  const canvas = document.createElement("canvas");
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext("2d")!;
  ctx.fillStyle = "#000000";
  ctx.fillRect(0, 0, size, size);

  for (let i = 0; i < count; i++) {
    const x = rng() * size;
    const y = rng() * size;
    const r = 2 + rng() * 7;
    const gradient = ctx.createRadialGradient(x, y, 0, x, y, r);
    const peak = 0.5 + rng() * 0.5;
    gradient.addColorStop(0, `rgba(255,255,255,${peak})`);
    gradient.addColorStop(1, "rgba(255,255,255,0)");
    ctx.fillStyle = gradient;
    ctx.beginPath();
    ctx.arc(x, y, r, 0, Math.PI * 2);
    ctx.fill();
  }

  const texture = new THREE.CanvasTexture(canvas);
  texture.wrapS = THREE.RepeatWrapping;
  texture.wrapT = THREE.RepeatWrapping;
  texture.colorSpace = THREE.NoColorSpace;
  return texture;
};
