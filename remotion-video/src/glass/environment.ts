import * as THREE from "three";

export type SoftLight = {
  /** Horizontal centre, 0..1 across the equirect (0 = -Z, 0.25 = +X). */
  u: number;
  /** Vertical centre, 0 = zenith, 1 = nadir. */
  v: number;
  /** Half-width / half-height in equirect units. */
  w: number;
  h: number;
  color: string;
  /** Multiplier baked into the canvas as brightness. */
  intensity: number;
  /** Gaussian softness in pixels. */
  blur: number;
};

export type EnvSpec = {
  /**
   * Vertical gradient of the "room" itself. `at` runs 0 (zenith) to 1 (nadir).
   * On a near-metal surface this gradient *is* the shading — every bright-to-
   * dark sweep across a card face is this ramp reflected back at the camera.
   */
  stops: { at: number; color: string }[];
  lights: SoftLight[];
};

/**
 * Paints a studio environment into an equirectangular canvas.
 *
 * Reflections are what sell both of these looks — the reference footage is
 * essentially a material study, so the lighting rig matters more than the
 * geometry. Rather than ship an HDR file we paint one: a graded backdrop plus
 * a handful of blurred softbox strips, which is enough for the long specular
 * streaks that run down the rounded edges.
 */
export const createEnvironmentTexture = (spec: EnvSpec): THREE.Texture => {
  const width = 1024;
  const height = 512;
  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext("2d");
  if (!ctx) {
    throw new Error("2D context unavailable for environment map");
  }

  const backdrop = ctx.createLinearGradient(0, 0, 0, height);
  for (const stop of spec.stops) {
    backdrop.addColorStop(Math.min(1, Math.max(0, stop.at)), stop.color);
  }
  ctx.fillStyle = backdrop;
  ctx.fillRect(0, 0, width, height);

  ctx.globalCompositeOperation = "lighter";
  for (const light of spec.lights) {
    ctx.save();
    ctx.filter = `blur(${light.blur}px)`;
    ctx.globalAlpha = Math.min(1, light.intensity);
    ctx.fillStyle = light.color;

    // Draw the strip three times so one that straddles the u=0 seam still
    // wraps correctly instead of getting clipped.
    for (const offset of [-width, 0, width]) {
      const cx = light.u * width + offset;
      const cy = light.v * height;
      const rw = light.w * width;
      const rh = light.h * height;
      ctx.beginPath();
      ctx.ellipse(cx, cy, rw, rh, 0, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.restore();
  }
  ctx.globalCompositeOperation = "source-over";

  const texture = new THREE.CanvasTexture(canvas);
  texture.mapping = THREE.EquirectangularReflectionMapping;
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.needsUpdate = true;
  return texture;
};
