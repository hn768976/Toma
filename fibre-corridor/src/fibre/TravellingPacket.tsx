import React, { useLayoutEffect } from "react";
import {
  bucketWeights,
  clamp,
  drawTravellingPacket,
  mixHex,
  parseHex,
  samplePolyline,
} from "../lib";
import { DOF_FEATHER } from "./constants";
import type { Packet, Strand } from "./geometry";
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
 * drift off the fibre it belongs to. The comet trail follows the curve's own
 * points, so it bends with the strand rather than cutting the corner.
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

    // Depth and fade are read off the strand's own samples: the curve is
    // precomputed, so this is a lookup rather than a bezier evaluation per
    // packet per frame.
    const attrAt = (uu: number) => {
      const fi = clamp(uu, 0, 1) * last;
      const i0 = Math.floor(fi);
      const i1 = Math.min(last, i0 + 1);
      const t = fi - i0;
      const s0 = strand.samples[i0];
      const s1 = strand.samples[i1];
      return {
        d: s0.d + (s1.d - s0.d) * t,
        fade: s0.fade + (s1.fade - s0.fade) * t,
      };
    };

    const head = attrAt(u);

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

    const radius =
      cfg.baseRadius * packet.size * (0.45 + 0.9 * head.d) * (packet.hot ? 2.2 : 1);
    // A packet is only as visible as the stretch of fibre it is on: where
    // the strand has faded into the distance, so has its light.
    const alpha = clamp(
      edge * boost * head.fade * (packet.hot ? 1 : 0.82),
      0,
      1.6,
    );

    // The trail runs behind the packet: the curve parameter falls behind the
    // direction of travel.
    const trailSign = cfg.direction > 0 ? -1 : 1;

    let smear: { dx: number; dy: number; copies: number } | undefined;
    if (cfg.motionBlur && head.d > 0.42) {
      const now = samplePolyline(pos, n, u);
      const prev = samplePolyline(pos, n, paramAt(frame - 1));
      smear = {
        dx: now.x - prev.x,
        dy: now.y - prev.y,
        copies: MOTION_BLUR_COPIES,
      };
    }

    const w = bucketWeights(head.d, variant.dofNear, variant.dofFar, DOF_FEATHER);
    for (let k = 0; k < w.length; k++) {
      if (w[k] < 0.004) continue;
      drawTravellingPacket(buffers.ctxs[k], {
        positions: pos,
        count: n,
        u,
        trailSign,
        trailStep: TRAIL_STEP,
        trailTaps: TRAIL_TAPS,
        radius,
        alpha: alpha * w[k],
        inner: hot,
        outer: hue,
        trail: trailCol,
        smear,
      });
    }
  });

  return null;
};
