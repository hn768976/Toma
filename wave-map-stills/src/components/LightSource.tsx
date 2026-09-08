import React from "react";
import {cssA, mix} from "../lib/color";
import {usePass, type PassProps} from "./pass";

/**
 * A broad soft glow, plus a few very faint ray streaks at irregular angles.
 * Deliberately has NO hot core: the light reads through its falloff and through
 * the dots it lifts, never as a bright point sitting on top of the field.
 *
 * Drawn into its own half-resolution layer; <FocusPass> composites it over the
 * dot field. Moving this is a large part of what differentiates the twelve
 * compositions — in c12 it sits off-frame entirely.
 */
export const LightSource: React.FC<PassProps> = (props) => {
  usePass(props, (_ctx, stage) => {
    const {lightLayer, light, pal, rng, width, height, k} = stage;
    const c = lightLayer.ctx;
    const s = lightLayer.scale;
    c.setTransform(1, 0, 0, 1, 0, 0);
    c.clearRect(0, 0, lightLayer.canvas.width, lightLayer.canvas.height);
    c.setTransform(s, 0, 0, s, 0, 0);
    c.globalCompositeOperation = "lighter";

    const warm = mix(pal.lightCore, pal.land, 0.3);

    // A wide, low glow. The stops stay flat across the middle so the centre
    // never resolves into a visible point.
    const halo = c.createRadialGradient(
      light.x,
      light.y,
      0,
      light.x,
      light.y,
      light.r * 2.9,
    );
    halo.addColorStop(0, cssA(mix(pal.lightCore, warm, 0.55), 0.13));
    halo.addColorStop(0.16, cssA(warm, 0.1));
    halo.addColorStop(0.38, cssA(warm, 0.045));
    halo.addColorStop(0.7, cssA(warm, 0.013));
    halo.addColorStop(1, cssA(warm, 0));
    c.fillStyle = halo;
    c.fillRect(0, 0, width, height);

    // Thin ray streaks at irregular angles, very faint. They start out at a
    // distance and fade in, so they never converge into a bright point.
    const rays = 5 + Math.floor(rng("ray", "n") * 5);
    for (let i = 0; i < rays; i++) {
      const a =
        (i / rays) * Math.PI * 2 +
        (rng("ray", i, "a") - 0.5) * (Math.PI / rays) * 1.9;
      const inner = light.r * (0.3 + rng("ray", i, "i") * 0.25);
      const len = inner + (0.22 + rng("ray", i, "l") * 0.45) * width;
      const halfW = (3 + rng("ray", i, "w") * 7) * k;
      const alpha = 0.016 + rng("ray", i, "o") * 0.03;
      c.save();
      c.translate(light.x, light.y);
      c.rotate(a);
      const g = c.createLinearGradient(inner, 0, len, 0);
      g.addColorStop(0, cssA(warm, 0));
      g.addColorStop(0.16, cssA(warm, alpha));
      g.addColorStop(1, cssA(warm, 0));
      c.fillStyle = g;
      c.beginPath();
      c.moveTo(inner, -halfW * 0.35);
      c.lineTo(len, -halfW);
      c.lineTo(len, halfW);
      c.lineTo(inner, halfW * 0.35);
      c.closePath();
      c.fill();
      c.restore();
    }
  });
  return null;
};
