import * as THREE from "three";

export type Panel = {
  u: number; // centre longitude 0..1
  v: number; // centre latitude 0..1 (0 = top)
  w: number;
  h: number;
  color: string;
  alpha: number;
};

/**
 * Procedural studio environment: a few soft light panels on black, drawn once
 * into a canvas equirect (fixed geometry, no randomness) and pre-filtered with
 * PMREM. The same inputs always give the same texture.
 */
export const buildEnvironment = (gl: THREE.WebGLRenderer, panels: Panel[]) => {
  const W = 1024;
  const H = 512;
  const canvas = document.createElement("canvas");
  canvas.width = W;
  canvas.height = H;
  const ctx = canvas.getContext("2d")!;
  ctx.fillStyle = "#000";
  ctx.fillRect(0, 0, W, H);
  for (const p of panels) {
    const cx = p.u * W;
    const cy = p.v * H;
    const pw = p.w * W;
    const ph = p.h * H;
    // Soft-edged panel: a vertical gradient strip, feathered with a canvas blur.
    ctx.save();
    ctx.filter = `blur(${Math.round(Math.min(pw, ph) * 0.18)}px)`;
    const g = ctx.createLinearGradient(cx, cy - ph / 2, cx, cy + ph / 2);
    g.addColorStop(0, "rgba(0,0,0,0)");
    g.addColorStop(0.25, p.color);
    g.addColorStop(0.75, p.color);
    g.addColorStop(1, "rgba(0,0,0,0)");
    ctx.globalAlpha = p.alpha;
    ctx.fillStyle = g;
    ctx.fillRect(cx - pw / 2, cy - ph / 2, pw, ph);
    ctx.restore();
  }
  const tex = new THREE.CanvasTexture(canvas);
  tex.mapping = THREE.EquirectangularReflectionMapping;
  tex.colorSpace = THREE.SRGBColorSpace;
  const pmrem = new THREE.PMREMGenerator(gl);
  const rt = pmrem.fromEquirectangular(tex);
  pmrem.dispose();
  tex.dispose();
  return rt;
};
