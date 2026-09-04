import React, {
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import {
  AbsoluteFill,
  cancelRender,
  continueRender,
  delayRender,
  useCurrentFrame,
  useVideoConfig,
} from "remotion";
import { z } from "zod";
import {
  DEFAULT_SEED,
  FAR_BLUR,
  FAR_COLOR,
  GROUND_COLOR,
  MID_COLOR,
  MOON_BREATH_PERIOD,
  MOON_CENTER,
  MOON_COLOR,
  MOON_OPACITY,
  MOON_RADIUS,
  NEAR_COLOR,
  RIM_COLOR,
  RIM_OFFSET,
  STAR_COUNT,
  VIGNETTE_COLOR,
} from "./constants";
import { drawGrain } from "./grain";
import { drawSky, makeBandGeometry } from "./sky";
import { drawStar, generateStars, twinkleMultiplier, type Star } from "./stars";
import {
  buildTreeline,
  horizonAt,
  loadKeyedTrees,
  swayAngle,
  tintedTree,
  type KeyedTrees,
  type Placement,
} from "./trees";

export const starryTreelineSchema = z.object({
  /** "night" is the reference match; "moonrise" adds the V2 glow. */
  variant: z.enum(["night", "moonrise"]),
  seed: z.number().int(),
  starCount: z.number().int().positive(),
});

export type StarryTreelineProps = z.infer<typeof starryTreelineSchema>;

export const starryTreelineDefaults: StarryTreelineProps = {
  variant: "night",
  seed: DEFAULT_SEED,
  starCount: STAR_COUNT,
};

export const starryTreelineMoonriseDefaults: StarryTreelineProps = {
  ...starryTreelineDefaults,
  variant: "moonrise",
};

const createCanvas = (width: number, height: number) => {
  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  return canvas;
};

const drawTree = (
  ctx: CanvasRenderingContext2D,
  image: CanvasImageSource,
  aspect: number,
  placement: Placement,
  width: number,
  height: number,
  angleDegrees: number,
  offsetX = 0,
  offsetY = 0,
) => {
  const drawHeight = placement.height * height;
  const drawWidth = drawHeight * aspect;
  ctx.save();
  ctx.translate(
    placement.cx * width + offsetX,
    placement.baseY * height + offsetY,
  );
  ctx.rotate((angleDegrees * Math.PI) / 180);
  if (placement.flip) ctx.scale(-1, 1);
  ctx.drawImage(image, -drawWidth / 2, -drawHeight, drawWidth, drawHeight);
  ctx.restore();
};

/**
 * Starry night over a conifer treeline. A locked 2D shot: static sky, static
 * treeline, no parallax and no camera. The only motion is star twinkle, a
 * fraction of a degree of sway in the near tier, and — in the moonrise
 * variant — a very slow breath in the glow behind the trees.
 */
export const StarryTreeline: React.FC<StarryTreelineProps> = ({
  variant,
  seed,
  starCount,
}) => {
  const frame = useCurrentFrame();
  const { width, height, durationInFrames } = useVideoConfig();
  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  const [trees, setTrees] = useState<KeyedTrees | null>(null);
  const [handle] = useState(() =>
    delayRender("Keying tree silhouettes to alpha"),
  );

  useEffect(() => {
    let cancelled = false;
    loadKeyedTrees()
      .then((loaded) => {
        if (cancelled) return;
        setTrees(loaded);
        continueRender(handle);
      })
      .catch((err) => cancelRender(err));
    return () => {
      cancelled = true;
    };
  }, [handle]);

  const band = useMemo(() => makeBandGeometry(width, height), [width, height]);

  const stars = useMemo(
    () => generateStars(width, height, band, starCount, seed),
    [width, height, band, starCount, seed],
  );

  // Everything static — sky gradient, mottling, Milky Way and every star that
  // does not twinkle — is rasterised exactly once and blitted per frame.
  const skyLayer = useMemo(() => {
    const canvas = createCanvas(width, height);
    const ctx = canvas.getContext("2d");
    if (!ctx) return canvas;
    drawSky(ctx, width, height, seed);
    for (const star of stars) {
      if (star.twinklePeriod) continue;
      drawStar(ctx, star, 1);
    }
    return canvas;
  }, [width, height, seed, stars]);

  const twinklers = useMemo<Star[]>(
    () => stars.filter((star) => star.twinklePeriod > 0),
    [stars],
  );

  const layout = useMemo(() => buildTreeline(seed), [seed]);

  // The mid and far tiers never move, so they are baked into one layer too.
  const backTierLayer = useMemo(() => {
    if (!trees) return null;
    const canvas = createCanvas(width, height);
    const ctx = canvas.getContext("2d");
    if (!ctx) return canvas;

    // Ground under the far tier, which is what actually draws the uneven
    // horizon line. Blurred along with the far trees — a crisp polygon edge
    // here reads as a hard line, especially where the V2 glow backlights it.
    ctx.filter = `blur(${FAR_BLUR * height}px)`;
    ctx.fillStyle = GROUND_COLOR;
    ctx.beginPath();
    // Overshoot the frame on every side so the blur never eats the edges and
    // lets sky leak back in along the bottom or the sides.
    const pad = FAR_BLUR * height * 4;
    ctx.moveTo(-pad, height + pad);
    const steps = 96;
    for (let i = 0; i <= steps; i++) {
      const u = -0.05 + (i / steps) * 1.1;
      ctx.lineTo(u * width, horizonAt(u) * height);
    }
    ctx.lineTo(width + pad, height + pad);
    ctx.closePath();
    ctx.fill();

    for (const placement of layout.far) {
      const tree = trees[placement.asset];
      drawTree(
        ctx,
        tintedTree(placement.asset, tree, FAR_COLOR),
        tree.width / tree.height,
        placement,
        width,
        height,
        placement.rotation,
      );
    }
    ctx.filter = "none";

    for (const placement of layout.mid) {
      const tree = trees[placement.asset];
      drawTree(
        ctx,
        tintedTree(placement.asset, tree, MID_COLOR),
        tree.width / tree.height,
        placement,
        width,
        height,
        placement.rotation,
      );
    }

    return canvas;
  }, [trees, layout, width, height]);

  useLayoutEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    ctx.clearRect(0, 0, width, height);
    ctx.drawImage(skyLayer, 0, 0);

    for (const star of twinklers) {
      drawStar(ctx, star, twinkleMultiplier(star, frame));
    }

    if (variant === "moonrise") {
      // Drawn over the stars, so the sky washes out rather than the stars
      // simply dimming.
      const breath =
        1 + 0.03 * Math.sin((frame / MOON_BREATH_PERIOD) * Math.PI * 2);
      const cx = MOON_CENTER.x * width;
      const cy = MOON_CENTER.y * height;
      const radius = MOON_RADIUS * height * breath;
      const glow = ctx.createRadialGradient(
        cx,
        cy,
        radius * 0.04,
        cx,
        cy,
        radius,
      );
      const [r, g, b] = MOON_COLOR;
      glow.addColorStop(0, `rgba(${r},${g},${b},${MOON_OPACITY})`);
      glow.addColorStop(0.35, `rgba(${r},${g},${b},${MOON_OPACITY * 0.42})`);
      glow.addColorStop(0.72, `rgba(${r},${g},${b},${MOON_OPACITY * 0.1})`);
      glow.addColorStop(1, `rgba(${r},${g},${b},0)`);
      ctx.fillStyle = glow;
      ctx.fillRect(0, 0, width, height);
    }

    if (backTierLayer) ctx.drawImage(backTierLayer, 0, 0);

    if (trees) {
      const rimOffset = RIM_OFFSET * height;
      for (const placement of layout.near) {
        const tree = trees[placement.asset];
        const aspect = tree.width / tree.height;
        const angle = placement.rotation + swayAngle(placement, frame);

        if (variant === "moonrise") {
          // A faint rim along the upper edges facing the glow. Kept extremely
          // subtle — heavy rim light would break the pure-silhouette read.
          drawTree(
            ctx,
            tintedTree(placement.asset, tree, RIM_COLOR),
            aspect,
            placement,
            width,
            height,
            angle,
            rimOffset,
            -rimOffset,
          );
        }

        drawTree(
          ctx,
          tintedTree(placement.asset, tree, NEAR_COLOR),
          aspect,
          placement,
          width,
          height,
          angle,
        );
      }
    }

    drawGrain(ctx, width, height, frame, seed);

    const vignette = ctx.createRadialGradient(
      width / 2,
      height * 0.46,
      Math.min(width, height) * 0.24,
      width / 2,
      height * 0.46,
      Math.max(width, height) * 0.78,
    );
    vignette.addColorStop(0, "rgba(0,0,0,0)");
    vignette.addColorStop(1, VIGNETTE_COLOR);
    ctx.fillStyle = vignette;
    ctx.fillRect(0, 0, width, height);
  }, [
    frame,
    durationInFrames,
    width,
    height,
    seed,
    variant,
    skyLayer,
    twinklers,
    backTierLayer,
    trees,
    layout,
  ]);

  return (
    <AbsoluteFill style={{ backgroundColor: "#04102a" }}>
      <canvas
        ref={canvasRef}
        width={width}
        height={height}
        style={{ width: "100%", height: "100%", display: "block" }}
      />
    </AbsoluteFill>
  );
};
