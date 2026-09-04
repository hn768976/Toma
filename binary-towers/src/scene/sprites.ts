import * as THREE from "three";
import { FONT_SIZE, MONO_FAMILY } from "../constants";
import { Palette } from "./palette";

const cache = new Map<string, THREE.CanvasTexture>();

const makeTexture = (key: string, build: () => HTMLCanvasElement) => {
  const hit = cache.get(key);
  if (hit) return hit;
  const t = new THREE.CanvasTexture(build());
  t.colorSpace = THREE.SRGBColorSpace;
  t.minFilter = THREE.LinearMipmapLinearFilter;
  t.magFilter = THREE.LinearFilter;
  t.needsUpdate = true;
  cache.set(key, t);
  return t;
};

/** Soft elliptical glow used for the band where a tower meets the floor. */
export const contactGlowTexture = (p: Palette) =>
  makeTexture(`contact-${p.id}`, () => {
    const S = 512;
    const c = document.createElement("canvas");
    c.width = S;
    c.height = S;
    const ctx = c.getContext("2d")!;
    const g = ctx.createRadialGradient(S / 2, S / 2, 0, S / 2, S / 2, S / 2);
    g.addColorStop(0, p.contactGlow);
    g.addColorStop(0.22, p.contactGlow);
    g.addColorStop(0.55, "rgba(0,0,0,0)");
    g.addColorStop(1, "rgba(0,0,0,0)");
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, S, S);
    return c;
  });

/**
 * 2x2 atlas of debris marks, drawn white so vertex colour tints them:
 *   (0,0) crisp streak   (1,0) soft streak
 *   (0,1) glyph "0"      (1,1) glyph "1"
 */
export const DEBRIS_TILES = {
  streak: 0,
  streakSoft: 1,
  zero: 2,
  one: 3,
} as const;

export const debrisAtlasTexture = () =>
  makeTexture("debris", () => {
    const T = 256;
    const c = document.createElement("canvas");
    c.width = T * 2;
    c.height = T * 2;
    const ctx = c.getContext("2d")!;

    const streak = (ox: number, oy: number, feather: number) => {
      const g = ctx.createLinearGradient(ox, oy + T / 2 - feather, ox, oy + T / 2 + feather);
      g.addColorStop(0, "rgba(255,255,255,0)");
      g.addColorStop(0.5, "rgba(255,255,255,1)");
      g.addColorStop(1, "rgba(255,255,255,0)");
      ctx.fillStyle = g;
      ctx.fillRect(ox, oy, T, T);
      // Fade the ends so a stretched quad reads as a line segment, not a bar.
      const e = ctx.createLinearGradient(ox, 0, ox + T, 0);
      e.addColorStop(0, "rgba(0,0,0,1)");
      e.addColorStop(0.16, "rgba(0,0,0,0)");
      e.addColorStop(0.84, "rgba(0,0,0,0)");
      e.addColorStop(1, "rgba(0,0,0,1)");
      ctx.globalCompositeOperation = "destination-out";
      ctx.fillStyle = e;
      ctx.fillRect(ox, oy, T, T);
      ctx.globalCompositeOperation = "source-over";
    };

    streak(0, 0, 7);
    streak(T, 0, 34);

    ctx.fillStyle = "#ffffff";
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.font = `700 ${FONT_SIZE * 3}px "${MONO_FAMILY}", monospace`;
    ctx.fillText("0", T / 2, T + T / 2);
    ctx.fillText("1", T + T / 2, T + T / 2);
    return c;
  });

/** UV rect (u0, v0, u1, v1) of one atlas tile. flipY on the texture is why v is inverted. */
export const tileUv = (tile: number): [number, number, number, number] => {
  const col = tile % 2;
  const row = Math.floor(tile / 2);
  const u0 = col * 0.5;
  const v1 = 1 - row * 0.5;
  return [u0, v1 - 0.5, u0 + 0.5, v1];
};

export const disposeSprites = () => {
  cache.forEach((t) => t.dispose());
  cache.clear();
};
