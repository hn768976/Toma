import { useLayoutEffect } from "react";
import { tintRgba } from "../lib/color";
import { flareTemperature } from "../lib/canvas";
import type { Scene } from "../scene";
import type { Palette } from "../palettes";

/**
 * The flare is what makes the frame read as a photograph of a screen rather
 * than as a rendered graphic, so it gets the full set: a bright core inside a
 * wide halo, an anamorphic streak, a chromatic split at the streak's ends,
 * and secondary ghosts spaced along the line from the core through the centre.
 *
 * It paints into its own buffer; <FocusPass> lays it over the developed image.
 */
export const LensFlare: React.FC<{ scene: Scene; palette: Palette }> = ({
  scene,
  palette,
}) => {
  useLayoutEffect(() => {
    const { ctx } = scene.flare;
    const { width: W, height: H, comp } = scene;
    const f = comp.flare;
    const mul = flareTemperature(f.warmth);
    const colour = (a: number) => tintRgba(palette, "flareCore", mul, a);
    const x = f.x * W;
    const y = f.y * H;

    ctx.save();
    ctx.globalCompositeOperation = "lighter";

    // Halo — wide, low, and the thing that actually lifts the corner.
    const haloR = f.core * W * f.halo;
    const halo = ctx.createRadialGradient(x, y, 0, x, y, haloR);
    halo.addColorStop(0, colour(0.3 * f.intensity));
    halo.addColorStop(0.08, colour(0.155 * f.intensity));
    halo.addColorStop(0.22, colour(0.07 * f.intensity));
    halo.addColorStop(0.45, colour(0.028 * f.intensity));
    halo.addColorStop(0.72, colour(0.008 * f.intensity));
    halo.addColorStop(1, colour(0));
    ctx.fillStyle = halo;
    ctx.fillRect(x - haloR, y - haloR, haloR * 2, haloR * 2);

    // Anamorphic streak — a flat horizontal ellipse several times wider than
    // it is tall, kept at low alpha so it bleeds rather than draws.
    const streakR = (f.streak * W) / 2;
    ctx.save();
    ctx.translate(x, y);
    ctx.scale(1, f.streakRatio);
    const streak = ctx.createRadialGradient(0, 0, 0, 0, 0, streakR);
    streak.addColorStop(0, colour(f.streakAlpha * f.intensity));
    streak.addColorStop(0.22, colour(f.streakAlpha * 0.55 * f.intensity));
    streak.addColorStop(0.6, colour(f.streakAlpha * 0.18 * f.intensity));
    streak.addColorStop(1, colour(0));
    ctx.fillStyle = streak;
    ctx.fillRect(-streakR, -streakR, streakR * 2, streakR * 2);
    ctx.restore();

    // Chromatic fringe: one channel pushed left, another right.
    const fringeR = f.fringe * W;
    const ends: [number, [number, number, number]][] = [
      [-1, [1.35, 0.5, 0.35]],
      [1, [0.35, 0.6, 1.45]],
    ];
    for (const [dir, cast] of ends) {
      const fx = x + dir * streakR * 0.86;
      ctx.save();
      ctx.translate(fx, y);
      ctx.scale(1, f.streakRatio * 3.2);
      const g = ctx.createRadialGradient(0, 0, 0, 0, 0, fringeR);
      g.addColorStop(0, tintRgba(palette, "flareCore", cast, 0.3 * f.intensity));
      g.addColorStop(1, tintRgba(palette, "flareCore", cast, 0));
      ctx.fillStyle = g;
      ctx.fillRect(-fringeR, -fringeR, fringeR * 2, fringeR * 2);
      ctx.restore();
    }

    // Secondary elements along the line through the core and frame centre.
    const dx = W / 2 - x;
    const dy = H / 2 - y;
    for (let i = 0; i < f.ghosts; i++) {
      const t = 0.42 + i * 0.46;
      const gx = x + dx * t;
      const gy = y + dy * t;
      const gr = f.core * W * (0.6 + ((i * 37) % 11) / 12);
      const g = ctx.createRadialGradient(gx, gy, 0, gx, gy, gr);
      g.addColorStop(0, colour(0.05 * f.intensity));
      g.addColorStop(0.6, colour(0.03 * f.intensity));
      g.addColorStop(1, colour(0));
      ctx.fillStyle = g;
      ctx.beginPath();
      ctx.arc(gx, gy, gr, 0, Math.PI * 2);
      ctx.fill();
    }

    // Core last, so it sits on top of its own halo.
    const coreR = f.core * W;
    const core = ctx.createRadialGradient(x, y, 0, x, y, coreR);
    core.addColorStop(0, colour(Math.min(1, 0.9 * f.intensity)));
    core.addColorStop(0.1, colour(0.55 * f.intensity));
    core.addColorStop(0.26, colour(0.24 * f.intensity));
    core.addColorStop(0.5, colour(0.08 * f.intensity));
    core.addColorStop(0.76, colour(0.022 * f.intensity));
    core.addColorStop(1, colour(0));
    ctx.fillStyle = core;
    ctx.fillRect(x - coreR, y - coreR, coreR * 2, coreR * 2);

    ctx.restore();
  }, [scene, palette]);

  return null;
};
