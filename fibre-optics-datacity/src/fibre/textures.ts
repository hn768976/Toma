// Procedural textures for the fibre-optic look, computed analytically in JS
// (no canvas 2D, no randomness) so they are identical on every machine.
import { BufferImageSource, Rectangle, Texture } from "pixi.js";

export const BOKEH_LEVELS = 8;
export const BOKEH_CELL = 256;
// Radius (in texture px) that a sprite of scale 1 shows as its "disc radius".
export const BOKEH_R = 100;

const smooth = (a: number, b: number, x: number) => {
  const t = Math.min(1, Math.max(0, (x - a) / (b - a)));
  return t * t * (3 - 2 * t);
};

// Radial profile of bokeh level k (0 = near-sharp point, 7 = widest disc).
export const bokehProfile = (k: number, rho: number) => {
  const t = k / (BOKEH_LEVELS - 1);
  // near-sharp: bright small core + short glow
  const gauss =
    Math.exp(-((rho / 0.16) ** 2)) + 0.22 * Math.exp(-((rho / 0.5) ** 2));
  // defocused: flat disc, soft edge that gets crisper as the disc grows,
  // faint rim (lens-like) and a faint outer glow
  const edge = 0.5 - 0.26 * t;
  const disc = 1 - smooth(1 - edge, 1 + edge * 0.35, rho);
  const rim = 0.06 * t * smooth(0.55, 0.92, rho) * disc;
  const outer = 0.06 * Math.exp(-(((rho - 1) / 0.35) ** 2));
  const discShape = disc * (0.88 + rim) + outer;
  const m = smooth(0, 0.28, t);
  return gauss * (1 - m) + discShape * m;
};

export const makeBokehAtlas = () => {
  const W = BOKEH_CELL * BOKEH_LEVELS;
  const H = BOKEH_CELL;
  const data = new Uint8Array(W * H * 4);
  const c = BOKEH_CELL / 2;
  for (let k = 0; k < BOKEH_LEVELS; k++) {
    // normalise each level to peak 1
    let peak = 0;
    for (let r = 0; r <= c; r++) peak = Math.max(peak, bokehProfile(k, r / BOKEH_R));
    for (let y = 0; y < H; y++) {
      for (let x = 0; x < BOKEH_CELL; x++) {
        const rho = Math.hypot(x + 0.5 - c, y + 0.5 - c) / BOKEH_R;
        let v = rho > 1.27 ? 0 : bokehProfile(k, rho) / peak;
        // fade to exactly zero at the cell border
        v *= 1 - smooth(1.15, 1.27, rho);
        const b = Math.round(Math.min(1, v) * 255);
        const o = (y * W + k * BOKEH_CELL + x) * 4;
        // premultiplied white
        data[o] = b;
        data[o + 1] = b;
        data[o + 2] = b;
        data[o + 3] = b;
      }
    }
  }
  const source = new BufferImageSource({
    resource: data,
    width: W,
    height: H,
    format: "rgba8unorm",
    alphaMode: "premultiplied-alpha",
    scaleMode: "linear",
  });
  const levels: Texture[] = [];
  for (let k = 0; k < BOKEH_LEVELS; k++) {
    levels.push(
      new Texture({
        source,
        frame: new Rectangle(k * BOKEH_CELL, 0, BOKEH_CELL, BOKEH_CELL),
      }),
    );
  }
  return { source, levels };
};

// Soft streak for strand segments: gaussian across, soft ends along.
export const STREAK_W = 32;
export const STREAK_H = 128;
export const makeStreakTexture = () => {
  const data = new Uint8Array(STREAK_W * STREAK_H * 4);
  for (let y = 0; y < STREAK_H; y++) {
    const v = (y + 0.5) / STREAK_H;
    const along = smooth(0, 0.12, v) * (1 - smooth(0.88, 1, v));
    for (let x = 0; x < STREAK_W; x++) {
      const u = (x + 0.5) / STREAK_W - 0.5;
      const across = Math.exp(-((u / 0.17) ** 2)) * (1 - smooth(0.38, 0.5, Math.abs(u)));
      const b = Math.round(along * across * 255);
      const o = (y * STREAK_W + x) * 4;
      data[o] = b;
      data[o + 1] = b;
      data[o + 2] = b;
      data[o + 3] = b;
    }
  }
  const source = new BufferImageSource({
    resource: data,
    width: STREAK_W,
    height: STREAK_H,
    format: "rgba8unorm",
    alphaMode: "premultiplied-alpha",
    scaleMode: "linear",
  });
  return new Texture({ source });
};
