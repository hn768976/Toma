/**
 * Server-rack front atlas, drawn once with Canvas 2D from a seeded stream.
 * Four rack variants side by side. Two textures share the layout:
 *  - base: the dark server faces (vents, handles, bezels)
 *  - mask: R = LED / display intensity, G = LED id (0-255) for blink
 *          patterns, B = colour class (0 green, 0.5 blue, 1 white)
 */
import * as THREE from "three";
import { makeRng } from "../lib/random";

export const VARIANTS = 4;
const VW = 512; // px per variant
const VH = 1472; // px for the full front height (2.3 m)

export const makeRackTextures = () => {
  const base = document.createElement("canvas");
  const mask = document.createElement("canvas");
  base.width = mask.width = VW * VARIANTS;
  base.height = mask.height = VH;
  const b = base.getContext("2d")!;
  const m = mask.getContext("2d")!;
  b.fillStyle = "#06080c";
  b.fillRect(0, 0, base.width, base.height);
  m.fillStyle = "rgb(0,0,0)";
  m.fillRect(0, 0, mask.width, mask.height);
  const rng = makeRng(0x5e7e7);
  let ledId = 1;
  const led = (x: number, y: number, w: number, h: number, cls: number, intensity = 255, steady = false) => {
    const id = steady ? 0 : ledId++ % 255 || 1;
    m.fillStyle = `rgb(${intensity},${id},${Math.round(cls * 255)})`;
    m.fillRect(x, y, w, h);
    // LED housing on the base layer
    b.fillStyle = "#1b2027";
    b.fillRect(x - 1, y - 1, w + 2, h + 2);
  };

  for (let v = 0; v < VARIANTS; v++) {
    const x0 = v * VW;
    const ix = x0 + 26; // inner margin (rails)
    const iw = VW - 52;
    // rails
    b.fillStyle = "#0d1015";
    b.fillRect(x0 + 8, 0, 18, VH);
    b.fillRect(x0 + VW - 26, 0, 18, VH);
    let y = 40;
    while (y < VH - 60) {
      const u = rng.pick([1, 1, 2, 2, 2, 3, 4]);
      const h = u * 28;
      if (y + h > VH - 40) break;
      const blank = rng.chance(0.12);
      if (blank) {
        b.fillStyle = "#040507";
        b.fillRect(ix, y, iw, h - 3);
        y += h;
        continue;
      }
      // unit face
      const shade = 18 + rng.int(0, 12);
      b.fillStyle = `rgb(${shade},${shade + 3},${shade + 7})`;
      b.fillRect(ix, y, iw, h - 3);
      // vents
      b.fillStyle = "rgba(0,0,0,0.55)";
      const ventW = iw * rng.range(0.35, 0.6);
      for (let vy = y + 6; vy < y + h - 8; vy += 6) b.fillRect(ix + 20, vy, ventW, 3);
      // handles
      b.fillStyle = "#3a414c";
      b.fillRect(ix + 4, y + 4, 8, h - 11);
      b.fillRect(ix + iw - 12, y + 4, 8, h - 11);
      // drive bays on 2U+ units: rows of lighter caddies with dark slots
      if (u >= 2 && rng.chance(0.6)) {
        const bays = rng.int(6, 12);
        const bw = (iw * 0.48) / bays;
        for (let k = 0; k < bays; k++) {
          b.fillStyle = "#2a313b";
          b.fillRect(ix + 18 + k * bw, y + 5, bw - 3, h - 13);
          b.fillStyle = "#11151a";
          b.fillRect(ix + 18 + k * bw + 2, y + h - 16, bw - 7, 4);
        }
      }
      // occasional big square LED grid (status matrix)
      if (u >= 2 && rng.chance(0.14)) {
        const gx = ix + iw * 0.5;
        const cls2 = rng.chance(0.5) ? 0.5 : 1;
        for (let r = 0; r < Math.min(3, u); r++)
          for (let c = 0; c < 6; c++) led(gx + c * 24, y + 6 + r * 18, 15, 11, cls2);
        y += h;
        continue;
      }
      // LED cluster: a tidy row or two of small LEDs on the right part of the face
      const hasCluster = rng.chance(0.65);
      const cols = hasCluster ? rng.int(2, 6) : 0;
      const rows = Math.max(1, Math.min(u, rng.int(1, 2)));
      const cls = rng.chance(0.72) ? 0 : rng.chance(0.75) ? 0.5 : 1;
      const lx = ix + iw * rng.range(0.52, 0.66);
      for (let r = 0; r < rows; r++)
        for (let c = 0; c < cols; c++) {
          led(lx + c * 16, y + 8 + r * 12, 9, 6, cls);
        }
      // status LEDs near the handle
      led(ix + 22, y + 8, 6, 6, rng.chance(0.5) ? 0 : 0.5);
      // occasional blue display strip
      if (rng.chance(0.18) && u >= 2) led(ix + iw * 0.2, y + h - 18, iw * 0.22, 7, 0.5, 200, true);
      y += h;
    }
  }
  const toTex = (c: HTMLCanvasElement, srgb: boolean) => {
    const t = new THREE.CanvasTexture(c);
    t.colorSpace = srgb ? THREE.SRGBColorSpace : THREE.NoColorSpace;
    t.anisotropy = 16;
    t.minFilter = THREE.LinearMipmapLinearFilter;
    t.generateMipmaps = true;
    t.needsUpdate = true;
    return t;
  };
  return { base: toTex(base, true), mask: toTex(mask, false) };
};
