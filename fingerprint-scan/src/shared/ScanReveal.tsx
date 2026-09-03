/**
 * <ScanReveal> — a bright travelling line that progressively reveals a masked
 * bitmap, with a decaying trail.
 *
 * Subject-agnostic and palette-agnostic: it is handed two pre-tinted copies of
 * a bitmap (a resting colour and a flare colour, see `tintMask`), a direction
 * and a position, and knows nothing about what the bitmap depicts.
 *
 * Two modes:
 *   reveals: true    the bitmap exists only where the line has already been,
 *                    emerging through a soft gradient at the reveal edge
 *   reveals: false   the bitmap is already present; the line only brightens it
 *
 * The trail is measured in POSITION, not time: the caller supplies both the
 * line's current position and where it was N frames ago. When the travel
 * pauses, the two converge, the trail closes up and the glow decays on its
 * own — which is what stops a paused sweep from looking frozen.
 *
 * Everything is a pure function of the props; there is no internal state, no
 * rAF and no CSS animation, so it is safe for deterministic Remotion renders.
 */
import React, { useEffect, useMemo, useRef } from "react";
import { bloomPass } from "./post";
import { withAlpha } from "./draw";

export type ScanGeometry = {
  /** Line position as a fraction from the bitmap's TOP edge, 0..1. */
  y: number;
  /** Where the line was `trailFrames` ago, same units. */
  yTrail: number;
  /** Brightness multiplier for this pass; 0 means no line this frame. */
  gain: number;
  /** Whether to draw the line itself. */
  active: boolean;
  /** Reveal mode only: how far the bitmap has been uncovered, 0..1. */
  revealed: number;
};

export type ScanRevealProps = {
  /** The bitmap in its resting colour. */
  base: HTMLCanvasElement;
  /** The same bitmap in its flare colour, used behind the line. */
  bright: HTMLCanvasElement;
  width: number;
  height: number;
  reveals: boolean;
  direction: "down" | "up";
  geometry: ScanGeometry;
  /** The line's own colours. */
  colors: { core: string; glow: string };
  /** Soft gradient at the reveal edge, in px. Larger = marks emerge more gently. */
  edgeSoftness?: number;
  /** Leading flare ahead of the line, in px, so marks brighten on arrival. */
  lead?: number;
  /** Half-height of the line's soft glow, in px. */
  glowHeight?: number;
  /** Peak alpha of the trail flare. */
  flareAlpha?: number;
  /** Multiplies the resting/revealed brightness — e.g. a hold pulse. */
  pulse?: number;
  /** Extra additive pass over everything, 0..1. */
  flash?: number;
  bloom?: { radius: number; alpha: number }[];
  style?: React.CSSProperties;
};

const makeCanvas = (w: number, h: number) => {
  const c = document.createElement("canvas");
  c.width = w;
  c.height = h;
  return c;
};

export const ScanReveal: React.FC<ScanRevealProps> = ({
  base,
  bright,
  width: W,
  height: H,
  reveals,
  direction,
  geometry,
  colors,
  edgeSoftness = 108,
  lead = 58,
  glowHeight = 92,
  flareAlpha = 0.66,
  pulse = 1,
  flash = 0,
  bloom = [
    { radius: 64, alpha: 0.42 },
    { radius: 22, alpha: 0.38 },
    { radius: 8, alpha: 0.3 },
  ],
  style,
}) => {
  const ref = useRef<HTMLCanvasElement>(null);
  const scene = useMemo(() => makeCanvas(W, H), [W, H]);
  const scratch = useMemo(() => makeCanvas(W, H), [W, H]);

  useEffect(() => {
    const out = ref.current?.getContext("2d");
    if (!out) return;
    const sc = scene.getContext("2d")!;
    const sk = scratch.getContext("2d")!;

    /**
     * Blit `src` through a vertical alpha profile.
     *
     * The stops span the FULL canvas height and both endpoints are always
     * pinned, because a canvas gradient clamps to its nearest stop outside the
     * stop range — a band defined only over its own extent would leak as a flat
     * fill across everything beyond it.
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
        const at = Math.max(off, last); // canvas requires non-decreasing offsets
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

    // ---- 1. the revealed bitmap
    if (reveals) {
      // Mapping through (H + softness) keeps the bitmap's own trailing edge
      // crisp once the sweep completes, instead of fading it out.
      const edge = geometry.revealed * (H + edgeSoftness);
      maskedDraw(
        base,
        [
          { y: 0, a: 1 },
          { y: edge - edgeSoftness, a: 1 },
          { y: edge, a: 0 },
          { y: H, a: 0 },
        ],
        pulse,
      );
    }

    // ---- 2. the trail: marks the line has just crossed flare brighter, then
    //         decay back over the distance travelled since `yTrail`.
    if (geometry.gain > 0) {
      const peak = geometry.y * H;
      const back = geometry.yTrail * H;
      const front = direction === "down" ? peak + lead : peak - lead;
      maskedDraw(
        bright,
        [
          { y: 0, a: 0 },
          { y: Math.min(back, front), a: 0 },
          { y: peak, a: 1 },
          { y: Math.max(back, front), a: 0 },
          { y: H, a: 0 },
        ],
        flareAlpha * geometry.gain,
      );
    }

    // ---- 3. the line: a thin bright core with a soft glow above and below.
    //         Kept restrained on purpose — the bloom does the work, and a
    //         heavier glow here turns the line into a slab that hides the
    //         structure it is supposed to be crossing.
    if (geometry.active && geometry.gain > 0) {
      const y = geometry.y * H;
      const g = sc.createLinearGradient(0, y - glowHeight, 0, y + glowHeight);
      g.addColorStop(0, withAlpha(colors.glow, 0));
      g.addColorStop(0.42, withAlpha(colors.glow, 0.16 * geometry.gain));
      g.addColorStop(0.5, withAlpha(colors.glow, 0.46 * geometry.gain));
      g.addColorStop(0.58, withAlpha(colors.glow, 0.16 * geometry.gain));
      g.addColorStop(1, withAlpha(colors.glow, 0));
      sc.fillStyle = g;
      sc.fillRect(0, y - glowHeight, W, glowHeight * 2);

      sc.fillStyle = withAlpha(colors.core, 0.22 * geometry.gain);
      sc.fillRect(0, y - 9, W, 18);
      sc.fillStyle = withAlpha(colors.core, geometry.gain);
      sc.fillRect(0, y - 2, W, 4);
    }

    // ---- 4. bloom
    out.drawImage(scene, 0, 0);
    bloomPass(out, scene, bloom);

    if (flash > 0.001) {
      out.globalCompositeOperation = "lighter";
      out.globalAlpha = flash * 0.5;
      out.drawImage(scene, 0, 0);
      out.globalAlpha = 1;
      out.globalCompositeOperation = "source-over";
    }
  });

  return <canvas ref={ref} width={W} height={H} style={style} />;
};
