import { CLOUD } from "./config";

/**
 * Draws the cloud silhouette as a solid fill, in composition coordinates.
 *
 * Three overlapping lobes of different radii sit at three different heights
 * along a horizontal baseline; a slab joins them into one mass, and everything
 * below the baseline is cut away to give the flat bottom edge the classic
 * glyph needs. Used only as a mask — nothing renders this shape directly.
 */
export const drawCloudSilhouette = (ctx: CanvasRenderingContext2D) => {
  const { centerX, baselineY, lobes, skirtHeight } = CLOUD;

  const minX = centerX + Math.min(...lobes.map((l) => l.dx - l.r));
  const maxX = centerX + Math.max(...lobes.map((l) => l.dx + l.r));

  // Coverage, not colour: this shape is only ever rasterised as a sampling
  // mask, so the fill just needs to be fully opaque. Nothing here is a palette
  // value — those all live in THEME.
  ctx.save();
  ctx.fillStyle = "white";

  ctx.beginPath();
  for (const lobe of lobes) {
    ctx.moveTo(centerX + lobe.dx + lobe.r, baselineY + lobe.dy);
    ctx.arc(centerX + lobe.dx, baselineY + lobe.dy, lobe.r, 0, Math.PI * 2);
  }
  // The joining slab is inset from the outermost lobe edges so the silhouette
  // keeps its rounded shoulders rather than squaring off at the corners.
  const inset = CLOUD.skirtInset;
  ctx.rect(
    minX + inset,
    baselineY - skirtHeight,
    maxX - minX - inset * 2,
    skirtHeight,
  );
  ctx.fill();

  // Flat bottom: erase everything below the baseline.
  ctx.globalCompositeOperation = "destination-out";
  ctx.fillRect(0, baselineY, ctx.canvas.width * 8, ctx.canvas.height * 8);
  ctx.restore();
};
