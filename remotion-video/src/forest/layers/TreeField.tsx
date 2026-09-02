import React, { useMemo } from "react";
import { useCurrentFrame } from "remotion";
import { LayerCanvas } from "../useLayerCanvas";
import { BANDS, buildBand, buildRidge, ridgeAt } from "../placement";
import type { BandName } from "../placement";
import type { TreeSprites } from "../useTreeSprites";
import { cameraDrift, DRIFT } from "../drift";
import { treeTintAt } from "../variants";
import type { Palette } from "../variants";

/**
 * One depth band of trees.
 *
 * The band is assembled sharp into its OWN offscreen buffer and then blurred
 * exactly ONCE, on the way out of that buffer. Blurring per tree would mean 40
 * separate blur passes per frame in the far band alone, which is unusable at
 * 4K; blurring the assembled band is a single pass and looks the same, because
 * every tree in a band shares a depth. Four bands, four buffers, four blurs.
 *
 * Trees are STATIC. The only thing that changes between frames is the band's
 * drift offset — near bands travel further than far ones, and that difference
 * is the entire parallax.
 */
export const TreeField: React.FC<{
  band: BandName;
  sprites: TreeSprites;
  palette: Palette;
  seedPrefix: string;
  width: number;
  height: number;
}> = ({ band, sprites, palette, seedPrefix, width, height }) => {
  const frame = useCurrentFrame();
  const cfg = BANDS[band];

  const res = cfg.resolution;
  const bufferW = Math.round(width * res);
  const bufferH = Math.round(height * res);

  // Placement is generated once for the whole render, not once per frame.
  const trees = useMemo(
    () => buildBand(band, width, height, seedPrefix),
    [band, width, height, seedPrefix],
  );
  const ridge = useMemo(
    () => buildRidge(`${seedPrefix}-ridge-${band}`),
    [seedPrefix, band],
  );

  // The band's single offscreen buffer, allocated once and reused every frame.
  const buffer = useMemo(() => {
    const canvas = document.createElement("canvas");
    canvas.width = bufferW;
    canvas.height = bufferH;
    return canvas;
  }, [bufferW, bufferH]);

  const drift = cameraDrift(frame, DRIFT[band]);

  const draw = (ctx: CanvasRenderingContext2D) => {
    const bctx = buffer.getContext("2d");
    if (!bctx) return;

    bctx.save();
    bctx.clearRect(0, 0, bufferW, bufferH);
    bctx.scale(res, res);
    bctx.translate(drift.x, drift.y);

    const aspect = sprites.width / sprites.height;
    for (const tree of trees) {
      const w = (tree.height * aspect) / tree.squash;
      bctx.save();
      bctx.globalAlpha = tree.opacity;
      bctx.translate(tree.x, tree.y);
      bctx.rotate(tree.rotate);
      // A horizontal shear about the trunk base: the tree leans, its base
      // stays planted. Shear + flip + a wide scale range is what stops one
      // source silhouette from reading as a repeated stamp.
      bctx.transform(1, 0, Math.tan(tree.shear), 1, 0, 0);
      if (tree.flip) bctx.scale(-1, 1);
      bctx.drawImage(sprites.steps[tree.tint], -w / 2, -tree.height, w, tree.height);
      bctx.restore();
    }

    // The ground the trunks emerge from. Without it every instance ends on the
    // flat bottom edge of the source SVG; with it, each band gets its own
    // receding ground line, tinted to that band's depth.
    if (cfg.ridgeYFrac !== null) {
      const ridgeY = height * cfg.ridgeYFrac;
      const wobble = height * cfg.ridgeWobble;
      bctx.beginPath();
      bctx.moveTo(-width * 0.2, height * 1.3);
      const steps = 96;
      for (let i = 0; i <= steps; i++) {
        const u = i / steps;
        bctx.lineTo(
          -width * 0.2 + u * width * 1.4,
          ridgeY + ridgeAt(ridge, u) * wobble,
        );
      }
      bctx.lineTo(width * 1.2, height * 1.3);
      bctx.closePath();
      bctx.fillStyle = treeTintAt(palette, cfg.ridgeTint);
      bctx.fill();
    }
    bctx.restore();

    // The one and only blur for this band. Radius scales with the buffer's
    // resolution so a half-res band still reads as an 18px blur at 4K.
    if (cfg.blur > 0) ctx.filter = `blur(${cfg.blur * res}px)`;
    ctx.drawImage(buffer, 0, 0);
    ctx.filter = "none";
  };

  return <LayerCanvas width={bufferW} height={bufferH} draw={draw} />;
};
