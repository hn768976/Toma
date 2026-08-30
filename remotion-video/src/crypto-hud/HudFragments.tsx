import { useLayoutEffect, useMemo } from "react";
import { beginWorld, context2d, makeCanvas, type Buffers } from "./buffers";
import { withAlpha } from "./color";
import {
  CANVAS_H,
  CANVAS_W,
  DURATION,
  RING_OUTER,
  SYMBOL_CX,
  SYMBOL_CY,
} from "./layout";
import { rndInt, rndRange, rndSign } from "./rng";
import type { VariantConfig } from "./variants";

const FRAGMENT_COUNT = 9;
const FRAGMENT_HALF = 190;

type Fragment = {
  sprite: HTMLCanvasElement;
  x: number;
  y: number;
  alpha: number;
  /** Whole turns across the loop, so each fragment closes with the piece. */
  turns: number;
};

type Props = {
  buffers: Buffers;
  cfg: VariantConfig;
  frame: number;
  drift: { x: number; y: number };
};

const makeFragmentSprite = (cfg: VariantConfig, seed: string) => {
  const canvas = makeCanvas(FRAGMENT_HALF * 2, FRAGMENT_HALF * 2);
  const ctx = context2d(canvas);
  ctx.translate(FRAGMENT_HALF, FRAGMENT_HALF);

  const rings = rndInt(`${seed}-rings`, 2, 4);
  for (let i = 0; i < rings; i++) {
    const r = rndRange(`${seed}-r-${i}`, 30, FRAGMENT_HALF - 30);
    ctx.strokeStyle = withAlpha(cfg.palette.bokehPrimary, rndRange(`${seed}-a-${i}`, 0.35, 0.8));
    ctx.lineWidth = rndRange(`${seed}-w-${i}`, 3, 9);
    ctx.beginPath();
    ctx.arc(0, 0, r, 0, Math.PI * 2);
    ctx.stroke();

    const ticks = rndInt(`${seed}-t-${i}`, 6, 20);
    for (let j = 0; j < ticks; j++) {
      const a = (j / ticks) * Math.PI * 2;
      ctx.beginPath();
      ctx.moveTo(Math.cos(a) * (r - 12), Math.sin(a) * (r - 12));
      ctx.lineTo(Math.cos(a) * (r + 12), Math.sin(a) * (r + 12));
      ctx.stroke();
    }
  }

  for (let i = 0; i < 5; i++) {
    const a = rndRange(`${seed}-d-${i}`, 0, Math.PI * 2);
    const r = rndRange(`${seed}-dr-${i}`, 40, FRAGMENT_HALF - 20);
    ctx.strokeStyle = withAlpha(cfg.palette.ringDim, 0.7);
    ctx.lineWidth = 7;
    ctx.beginPath();
    ctx.arc(0, 0, r, a, a + rndRange(`${seed}-ds-${i}`, 0.06, 0.24));
    ctx.stroke();
  }

  return canvas;
};

/**
 * Small distant HUD clusters, well clear of the symbol and dropped into the
 * far buffer so the depth-of-field pass reduces them to soft suggestions.
 */
export const HudFragments: React.FC<Props> = ({ buffers, cfg, frame, drift }) => {
  const fragments = useMemo<Fragment[]>(() => {
    const out: Fragment[] = [];
    for (let i = 0; i < FRAGMENT_COUNT; i++) {
      // Keep them well outside the ring field.
      let x = 0;
      let y = 0;
      for (let attempt = 0; attempt < 12; attempt++) {
        x = rndRange(`${cfg.seed}-frag-x-${i}-${attempt}`, 60, CANVAS_W - 60);
        y = rndRange(`${cfg.seed}-frag-y-${i}-${attempt}`, 60, CANVAS_H - 60);
        if (Math.hypot(x - SYMBOL_CX, y - SYMBOL_CY) > RING_OUTER * 1.75) {
          break;
        }
      }
      out.push({
        sprite: makeFragmentSprite(cfg, `${cfg.seed}-frag-${i}`),
        x,
        y,
        alpha: rndRange(`${cfg.seed}-frag-al-${i}`, 0.12, 0.3),
        turns: rndSign(`${cfg.seed}-frag-s-${i}`) * rndInt(`${cfg.seed}-frag-t-${i}`, 1, 3),
      });
    }
    return out;
  }, [cfg]);

  useLayoutEffect(() => {
    const t = frame / DURATION;
    const ctx = beginWorld(buffers.far, drift);
    for (const f of fragments) {
      ctx.save();
      ctx.translate(f.x, f.y);
      ctx.rotate(f.turns * 2 * Math.PI * t);
      ctx.globalAlpha = f.alpha;
      ctx.drawImage(f.sprite, -FRAGMENT_HALF, -FRAGMENT_HALF);
      ctx.restore();
    }
  });

  return null;
};
