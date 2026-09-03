import React, { useLayoutEffect, useMemo } from "react";
import { HEIGHT, WIDTH, BLUR_FAR, BLUR_MID, BLUR_NEAR } from "./constants";
import { computePositions, makeBuffer, type Ctx } from "./draw";
import { BendingStrand, type Buffers } from "./BendingStrand";
import { TravellingPacket } from "./TravellingPacket";
import type { Scene } from "./scene";

/**
 * Buffer resolution per depth bucket. The near bucket is blurred so heavily
 * that half resolution is invisible, and blurring a 1920x1080 surface instead
 * of a 3840x2160 one is four times cheaper.
 */
const BUCKET_SCALE = [0.5, 1, 0.5] as const;
const BUCKET_BLUR = [BLUR_NEAR, BLUR_MID, BLUR_FAR] as const;
/** Compositing gain per bucket. */
const BUCKET_GAIN = [0.45, 1, 0.9] as const;
/** Halo width per bucket, in buffer px, for the per-buffer glow pass. */
const HALO = [18, 16, 10] as const;

const useBuffers = () =>
  useMemo(() => {
    const canvases = BUCKET_SCALE.map((s) =>
      makeBuffer(Math.round(WIDTH * s), Math.round(HEIGHT * s)),
    );
    const ctxs = canvases.map(
      (c) => c.getContext("2d") as CanvasRenderingContext2D,
    ) as [Ctx, Ctx, Ctx];
    return { canvases, ctxs };
  }, []);

/** Clears the depth buffers and sets each one's device scale. Runs first. */
const BufferClear: React.FC<{ ctxs: [Ctx, Ctx, Ctx] }> = ({ ctxs }) => {
  useLayoutEffect(() => {
    ctxs.forEach((ctx, k) => {
      const s = BUCKET_SCALE[k];
      ctx.setTransform(1, 0, 0, 1, 0, 0);
      ctx.globalAlpha = 1;
      ctx.filter = "none";
      ctx.globalCompositeOperation = "source-over";
      ctx.clearRect(0, 0, WIDTH * s, HEIGHT * s);
      ctx.setTransform(s, 0, 0, s, 0, 0);
      ctx.globalCompositeOperation = "lighter";
    });
  });
  return null;
};

/**
 * Blurs each depth buffer exactly once and composites the three onto the
 * frame. This is where the depth of field lives: the focal band sits in the
 * mid distance, the nearest strands blur heavily and the horizon softens.
 *
 * Each buffer is also added back to itself blurred wide, which produces the
 * soft halo along every curve in three passes rather than ninety-five.
 */
const StrandComposite: React.FC<{
  scene: Scene;
  canvases: HTMLCanvasElement[];
  ctxs: [Ctx, Ctx, Ctx];
}> = ({ scene, canvases, ctxs }) => {
  useLayoutEffect(() => {
    const main = scene.main;

    for (let k = 0; k < 3; k++) {
      const ctx = ctxs[k];
      const c = canvases[k];
      ctx.setTransform(1, 0, 0, 1, 0, 0);
      ctx.globalCompositeOperation = "lighter";
      ctx.filter = `blur(${HALO[k]}px)`;
      ctx.globalAlpha = 0.5;
      ctx.drawImage(c, 0, 0);
      ctx.filter = "none";
      ctx.globalAlpha = 1;
    }

    main.setTransform(1, 0, 0, 1, 0, 0);
    main.globalCompositeOperation = "lighter";
    main.imageSmoothingEnabled = true;
    main.imageSmoothingQuality = "high";
    // Far, then mid, then near. The near bucket is held back: defocused
    // foreground light is spread thin, not concentrated.
    for (const k of [2, 1, 0]) {
      main.globalAlpha = BUCKET_GAIN[k];
      main.filter = `blur(${BUCKET_BLUR[k] * BUCKET_SCALE[k]}px)`;
      main.drawImage(canvases[k], 0, 0, WIDTH, HEIGHT);
    }
    main.globalAlpha = 1;
    main.filter = "none";
    main.globalCompositeOperation = "source-over";
  });
  return null;
};

/** The strand field: every strand and every packet, bucketed by depth. */
export const StrandField: React.FC<{ scene: Scene }> = ({ scene }) => {
  const { canvases, ctxs } = useBuffers();
  const buffers: Buffers = useMemo(() => ({ ctxs }), [ctxs]);

  // Pure per-frame geometry: the memoised base curves plus undulation and
  // camera drift. Nothing is regenerated.
  const positions = scene.strands.map((s) =>
    computePositions(s, scene.p, scene.camX, scene.camY),
  );

  return (
    <>
      <BufferClear ctxs={ctxs} />
      {scene.strands.map((strand, i) => (
        <BendingStrand
          key={strand.key}
          scene={scene}
          strand={strand}
          pos={positions[i]}
          buffers={buffers}
        />
      ))}
      {scene.strands.map((strand, i) =>
        strand.packets.map((packet, j) => (
          <TravellingPacket
            key={`${strand.key}-p${j}`}
            scene={scene}
            strand={strand}
            pos={positions[i]}
            packet={packet}
            buffers={buffers}
          />
        )),
      )}
      <StrandComposite scene={scene} canvases={canvases} ctxs={ctxs} />
    </>
  );
};
