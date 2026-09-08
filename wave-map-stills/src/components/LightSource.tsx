import React from "react";
import {cssA, mix} from "../lib/color";
import {usePass, type PassProps} from "./pass";

/**
 * A small intense core inside a wide halo, plus a few very faint ray streaks at
 * irregular angles. Drawn into its own half-resolution layer; <FocusPass>
 * composites it over the dot field. Moving this is a large part of what
 * differentiates the twelve compositions — in c12 it sits off-frame entirely
 * and only its falloff is visible.
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

    // Wide halo.
    const halo = c.createRadialGradient(
      light.x,
      light.y,
      0,
      light.x,
      light.y,
      light.r * 2.6,
    );
    halo.addColorStop(0, cssA(pal.lightCore, 0.34));
    halo.addColorStop(0.07, cssA(warm, 0.15));
    halo.addColorStop(0.26, cssA(warm, 0.055));
    halo.addColorStop(0.62, cssA(warm, 0.016));
    halo.addColorStop(1, cssA(warm, 0));
    c.fillStyle = halo;
    c.fillRect(0, 0, width, height);

    // Small intense core.
    const coreR = light.r * 0.17;
    const core = c.createRadialGradient(
      light.x,
      light.y,
      0,
      light.x,
      light.y,
      coreR,
    );
    core.addColorStop(0, cssA(pal.lightCore, 0.92));
    core.addColorStop(0.22, cssA(pal.lightCore, 0.3));
    core.addColorStop(1, cssA(pal.lightCore, 0));
    c.fillStyle = core;
    c.fillRect(light.x - coreR, light.y - coreR, coreR * 2, coreR * 2);

    // Thin ray streaks at irregular angles, very faint.
    const rays = 5 + Math.floor(rng("ray", "n") * 5);
    for (let i = 0; i < rays; i++) {
      const a =
        (i / rays) * Math.PI * 2 + (rng("ray", i, "a") - 0.5) * (Math.PI / rays) * 1.9;
      const len = (0.22 + rng("ray", i, "l") * 0.45) * width;
      const halfW = (2 + rng("ray", i, "w") * 6) * k;
      const alpha = 0.016 + rng("ray", i, "o") * 0.03;
      c.save();
      c.translate(light.x, light.y);
      c.rotate(a);
      const g = c.createLinearGradient(0, 0, len, 0);
      g.addColorStop(0, cssA(pal.lightCore, alpha));
      g.addColorStop(0.12, cssA(warm, alpha * 0.7));
      g.addColorStop(1, cssA(warm, 0));
      c.fillStyle = g;
      c.beginPath();
      c.moveTo(0, -halfW);
      c.lineTo(len, -halfW * 0.25);
      c.lineTo(len, halfW * 0.25);
      c.lineTo(0, halfW);
      c.closePath();
      c.fill();
      c.restore();
    }
  });
  return null;
};
