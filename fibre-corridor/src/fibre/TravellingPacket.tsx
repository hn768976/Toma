import React, { useLayoutEffect } from "react";
import { mixHex, parseHex, rgba } from "./color";
import { bucketWeights, radialBlob, type Ctx } from "./draw";
import { clamp, type Packet, type Strand } from "./geometry";
import type { Buffers } from "./BendingStrand";
import type { Scene } from "./scene";

/** Trail sample spacing, in curve parameter. */
const TRAIL_STEP = 0.015;
const TRAIL_TAPS = 3;
const MOTION_BLUR_COPIES = 5;

const smooth = (t: number) => t * t * (3 - 2 * t);

/**
 * A point of light travelling ALONG a strand. Its position is the strand's
 * own curve evaluated at parameter t — never a free path — so it can never
 * drift off the fibre it belongs to.
 *
 * The comet trail is sampled at t, t-0.015, t-0.03 and t-0.045 and drawn
 * through the curve's own points between those parameters, so the trail bends
 * with the strand instead of cutting the corner.
 */
export const TravellingPacket: React.FC<{
  scene: Scene;
  strand: Strand;
  pos: Float64Array;
  packet: Packet;
  buffers: Buffers;
}> = ({ scene, strand, pos, packet, buffers }) => {
  useLayoutEffect(() => {
    const { variant, frame } = scene;
    const cfg = variant.packets;
    const n = strand.samples.length;
    const last = n - 1;

    const paramAt = (f: number) => {
      const raw = f / packet.cycle + packet.phase;
      const prog = ((raw % 1) + 1) % 1;
      const forward = cfg.direction > 0 ? prog : 1 - prog;
      // Accelerating packets cover the last stretch toward the camera fast.
      return cfg.accelerate
        ? cfg.direction > 0
          ? Math.pow(forward, 1 / 0.6)
          : Math.pow(forward, 0.6)
        : forward;
    };

    const u = paramAt(frame);

    // Sample index lookup: the curve is precomputed, so this is not a bezier
    // evaluation per packet per frame.
    const at = (uu: number) => {
      const fi = clamp(uu, 0, 1) * last;
      const i0 = Math.floor(fi);
      const i1 = Math.min(last, i0 + 1);
      const t = fi - i0;
      return {
        x: pos[i0 * 2] + (pos[i1 * 2] - pos[i0 * 2]) * t,
        y: pos[i0 * 2 + 1] + (pos[i1 * 2 + 1] - pos[i0 * 2 + 1]) * t,
        d: strand.samples[i0].d + (strand.samples[i1].d - strand.samples[i0].d) * t,
        i0,
        i1,
      };
    };

    const head = at(u);

    // Fade at both ends of the curve so the wrap at the loop point is unseen.
    const edge =
      smooth(clamp(u / 0.05, 0, 1)) * smooth(clamp((1 - u) / 0.05, 0, 1));
    if (edge <= 0.004) return;

    // Packets brighten through the bend: the turn is where the eye goes.
    let boost = 1;
    if (cfg.bendGlow && strand.bendU[0] >= 0) {
      const mid = (strand.bendU[0] + strand.bendU[1]) / 2;
      const halfW = ((strand.bendU[1] - strand.bendU[0]) / 2) * 1.4;
      boost = 1 + 1.35 * Math.exp(-Math.pow((u - mid) / halfW, 2));
    }

    const hue = parseHex(variant.palette.packetHue);
    const hot = parseHex(variant.palette.packetWhite);
    const trailCol = mixHex(
      variant.palette.packetHue,
      variant.palette.strandBody,
      0.25,
    );

    const scale =
      cfg.baseRadius * packet.size * (0.45 + 0.9 * head.d) * (packet.hot ? 2.2 : 1);
    const alpha = clamp(edge * boost * (packet.hot ? 1 : 0.82), 0, 1.6);

    const w = bucketWeights(head.d);
    // The trail runs behind the packet: the curve parameter falls behind the
    // direction of travel.
    const trailSign = cfg.direction > 0 ? -1 : 1;

    for (let k = 0; k < 3; k++) {
      if (w[k] < 0.004) continue;
      const ctx: Ctx = buffers.ctxs[k];
      const wk = w[k];

      // --- comet trail, following the curve ---
      ctx.lineCap = "round";
      ctx.lineJoin = "round";
      for (let tap = 0; tap < TRAIL_TAPS; tap++) {
        const uA = u + trailSign * TRAIL_STEP * tap;
        const uB = u + trailSign * TRAIL_STEP * (tap + 1);
        const lo = Math.min(uA, uB);
        const hi = Math.max(uA, uB);
        if (hi < 0 || lo > 1) continue;
        const pA = at(uA);
        const pB = at(uB);
        ctx.beginPath();
        ctx.moveTo(pA.x, pA.y);
        // Walk the strand's own samples between the two taps.
        const iLo = Math.min(pA.i1, pB.i1);
        const iHi = Math.max(pA.i0, pB.i0);
        for (let i = iLo; i <= iHi; i++) ctx.lineTo(pos[i * 2], pos[i * 2 + 1]);
        ctx.lineTo(pB.x, pB.y);
        const fade = 1 - tap / TRAIL_TAPS;
        ctx.strokeStyle = rgba(
          trailCol,
          alpha * wk * 0.5 * fade * fade,
        );
        ctx.lineWidth = scale * (0.85 - 0.18 * tap);
        ctx.stroke();
      }

      // --- motion smear on the fastest packets ---
      if (cfg.motionBlur && head.d > 0.42) {
        const prev = at(paramAt(frame - 1));
        const dx = head.x - prev.x;
        const dy = head.y - prev.y;
        if (Math.hypot(dx, dy) > scale * 0.9) {
          for (let m = 1; m <= MOTION_BLUR_COPIES; m++) {
            const t = m / (MOTION_BLUR_COPIES + 1);
            radialBlob(
              ctx,
              head.x - dx * t,
              head.y - dy * t,
              scale * (1 - 0.25 * t),
              hue,
              hue,
              alpha * wk * 0.3 * (1 - t),
              0.4,
            );
          }
        }
      }

      // --- the packet itself ---
      radialBlob(ctx, head.x, head.y, scale * 3.6, hue, hue, alpha * wk * 0.16, 0.3);
      radialBlob(ctx, head.x, head.y, scale * 1.5, hot, hue, alpha * wk * 0.55, 0.35);
      radialBlob(ctx, head.x, head.y, scale * 0.6, hot, hot, alpha * wk * 0.95, 0.5);
    }
  });

  return null;
};
