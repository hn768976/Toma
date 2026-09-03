/**
 * <ScanReveal> — a bright travelling line that progressively reveals a masked
 * bitmap, with a decaying trail.
 *
 * Subject-agnostic: it is handed a mask and a direction, and knows nothing about
 * fingerprints. Two modes, both driven from config:
 *
 *   reveals: true   the bitmap exists only where the line has already been, and
 *                   emerges through a soft gradient at the reveal edge
 *   reveals: false  the bitmap is already present; the line only brightens it
 *
 * The trail is measured in *position*, not time: it spans from where the line is
 * now back to where it was `trailFrames` ago. When the travel pauses, the trail
 * closes up and the glow decays on its own.
 */
import React, { useEffect, useMemo, useRef } from "react";
import { PRINT_HEIGHT, PRINT_WIDTH, PRINT_X, PRINT_Y } from "../layout";
import { tintMask, type PrintMask as Mask } from "../lib/mask";
import { bloomPass } from "../lib/post";
import { withAlpha } from "../lib/draw";
import { scanState } from "../lib/scan";
import type { Palette, ScanConfig } from "../variants";

const makeCanvas = (w: number, h: number) => {
  const c = document.createElement("canvas");
  c.width = w;
  c.height = h;
  return c;
};

const W = PRINT_WIDTH;
const H = PRINT_HEIGHT;

export const ScanReveal: React.FC<{
  mask: Mask;
  palette: Palette;
  scan: ScanConfig;
  frame: number;
  /** Multiplies the resting/revealed ridge brightness (the hold pulse). */
  pulse: number;
  /** Whole-frame flash from the outcome stamp, 0..1. */
  flash: number;
}> = ({ mask, palette, scan, frame, pulse, flash }) => {
  const ref = useRef<HTMLCanvasElement>(null);

  const base = useMemo(() => tintMask(mask, palette.ridge), [mask, palette.ridge]);
  const bright = useMemo(() => tintMask(mask, palette.ridgeBright), [mask, palette.ridgeBright]);
  const scene = useMemo(() => makeCanvas(W, H), []);
  const scratch = useMemo(() => makeCanvas(W, H), []);

  useEffect(() => {
    const out = ref.current?.getContext("2d");
    if (!out) return;
    const sc = scene.getContext("2d")!;
    const sk = scratch.getContext("2d")!;
    const state = scanState(scan, frame);

    /**
     * Blit `src` through a vertical alpha profile.
     *
     * The stops span the FULL canvas height and both endpoints are always
     * pinned, because a canvas gradient clamps to its nearest stop outside the
     * stop range — a band defined only over its own extent would leak as a
     * flat fill across everything beyond it.
     */
    const maskedDraw = (
      src: HTMLCanvasElement,
      stops: { y: number; a: number }[],
      alpha: number,
    ) => {
      if (alpha <= 0.002) return;
      sk.setTransform(1, 0, 0, 1, 0, 0);
      sk.globalCompositeOperation = "source-over";
      sk.clearRect(0, 0, W, H);
      sk.drawImage(src, 0, 0);
      sk.globalCompositeOperation = "destination-in";
      const g = sk.createLinearGradient(0, 0, 0, H);
      let last = -1;
      for (const st of [...stops].sort((p, q) => p.y - q.y)) {
        const off = Math.min(1, Math.max(0, st.y / H));
        // Canvas requires non-decreasing offsets.
        const at = Math.max(off, last);
        g.addColorStop(at, `rgba(255,255,255,${st.a})`);
        last = at;
      }
      sk.fillStyle = g;
      sk.fillRect(0, 0, W, H);
      sk.globalCompositeOperation = "source-over";
      sc.globalAlpha = Math.min(1, alpha);
      sc.drawImage(scratch, 0, 0);
      sc.globalAlpha = 1;
    };

    sc.clearRect(0, 0, W, H);
    out.clearRect(0, 0, W, H);

    // ---- 1. the revealed print (acquire only; in verify <PrintMask> holds it)
    if (scan.reveals) {
      const soft = scan.edgeSoftness;
      // Mapping through (H + soft) keeps the print's own bottom edge crisp once
      // the sweep completes, instead of fading it out.
      const edge = state.revealed * (H + soft);
      maskedDraw(
        base,
        [
          { y: 0, a: 1 },
          { y: edge - soft, a: 1 },
          { y: edge, a: 0 },
          { y: H, a: 0 },
        ],
        pulse,
      );
    }

    // ---- 2. the trail: ridges the line has just crossed flare brighter, then
    //         decay back over the distance travelled in the last trailFrames.
    if (state.gain > 0) {
      const peak = state.y * H;
      const back = state.yTrail * H;
      // A short lead so ridges brighten as the line arrives, not just after it.
      const front = scan.direction === "down" ? peak + 58 : peak - 58;
      maskedDraw(
        bright,
        [
          { y: 0, a: 0 },
          { y: Math.min(back, front), a: 0 },
          { y: peak, a: 1 },
          { y: Math.max(back, front), a: 0 },
          { y: H, a: 0 },
        ],
        0.66 * state.gain,
      );
    }

    // ---- 3. the line itself: soft glow above and below, thin bright core
    if (state.active && state.gain > 0) {
      const y = state.y * H;
      // Kept deliberately restrained: the bloom below does the work, and a
      // heavier glow here turns the line into a solid slab that hides the
      // ridge structure it is supposed to be crossing.
      const glowH = 92;
      const g = sc.createLinearGradient(0, y - glowH, 0, y + glowH);
      g.addColorStop(0, withAlpha(palette.scanGlow, 0));
      g.addColorStop(0.42, withAlpha(palette.scanGlow, 0.16 * state.gain));
      g.addColorStop(0.5, withAlpha(palette.scanGlow, 0.46 * state.gain));
      g.addColorStop(0.58, withAlpha(palette.scanGlow, 0.16 * state.gain));
      g.addColorStop(1, withAlpha(palette.scanGlow, 0));
      sc.fillStyle = g;
      sc.fillRect(0, y - glowH, W, glowH * 2);

      // A thin bright core, with a narrow soft shoulder either side of it.
      sc.fillStyle = withAlpha(palette.scanCore, 0.22 * state.gain);
      sc.fillRect(0, y - 9, W, 18);
      sc.fillStyle = withAlpha(palette.scanCore, state.gain);
      sc.fillRect(0, y - 2, W, 4);
    }

    // ---- 4. generous bloom on the line and the revealed ridges
    out.drawImage(scene, 0, 0);
    bloomPass(out, scene, [
      { radius: 64, alpha: 0.42 },
      { radius: 22, alpha: 0.38 },
      { radius: 8, alpha: 0.3 },
    ]);

    if (flash > 0.001) {
      out.globalCompositeOperation = "lighter";
      out.globalAlpha = flash * 0.5;
      out.drawImage(scene, 0, 0);
      out.globalAlpha = 1;
      out.globalCompositeOperation = "source-over";
    }
  });

  return (
    <canvas
      ref={ref}
      width={W}
      height={H}
      style={{
        position: "absolute",
        left: PRINT_X,
        top: PRINT_Y,
        width: W,
        height: H,
        mixBlendMode: "screen",
      }}
    />
  );
};
