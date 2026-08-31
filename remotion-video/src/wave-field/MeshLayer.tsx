import {
  ALONG_X,
  ALONG_Y,
  BAND_LENGTH,
  DOWN_X,
  DOWN_Y,
  HEIGHT,
  STRAND_STEP_PX,
  TAU,
  WIDTH,
} from "./constants";
import { withAlpha } from "./color";
import type { MeshCurve } from "./field";
import type { VariantConfig } from "./variants";

export interface MeshLayerProps {
  ctx: CanvasRenderingContext2D;
  cfg: VariantConfig;
  mesh: MeshCurve[];
  /** Loop position in [0, 1). */
  t: number;
}

const MESH_STEP_PX = STRAND_STEP_PX * 1.5;

export const drawMeshLayer = (
  ctx: CanvasRenderingContext2D,
  cfg: VariantConfig,
  mesh: MeshCurve[],
  t: number,
) => {
  if (mesh.length === 0) return;

  ctx.globalCompositeOperation = "source-over";
  ctx.globalAlpha = 1;
  ctx.lineCap = "round";
  ctx.lineJoin = "round";
  ctx.lineWidth = cfg.meshMode === "dense" ? 2 : 2.6;

  const steps = Math.ceil(BAND_LENGTH / MESH_STEP_PX);

  for (const curve of mesh) {
    ctx.strokeStyle = withAlpha(cfg.palette.meshLine, curve.alpha);
    ctx.beginPath();
    for (let i = 0; i <= steps; i++) {
      const s = -BAND_LENGTH / 2 + (i / steps) * BAND_LENGTH;
      let h = 0;
      for (const k of curve.harmonics) {
        h +=
          k.amp *
          Math.sin(TAU * ((k.spatial * s) / BAND_LENGTH - k.temporal * t + k.phase));
      }
      const x = WIDTH / 2 + s * ALONG_X + curve.offset * DOWN_X;
      const y = HEIGHT / 2 + s * ALONG_Y + curve.offset * DOWN_Y - h;
      if (i === 0) ctx.moveTo(x, y);
      else ctx.lineTo(x, y);
    }
    ctx.stroke();
  }
};

/**
 * Faint curves running roughly parallel to the bands but swinging much wider,
 * so they read as a separate, deeper surface underneath rather than as the
 * bands' own structure. Never bloomed.
 */
export const MeshLayer: React.FC<MeshLayerProps> = ({ ctx, cfg, mesh, t }) => {
  drawMeshLayer(ctx, cfg, mesh, t);
  return null;
};
