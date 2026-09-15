import {
  CanvasTexture,
  EquirectangularReflectionMapping,
  LinearFilter,
  PMREMGenerator,
  SRGBColorSpace,
  type Texture,
  type WebGPURenderer,
} from "three/webgpu";
import type { Variant } from "./variants";

const ENV_WIDTH = 2048;
const ENV_HEIGHT = 1024;

// The look here is almost entirely reflection: near-black glass with hot
// streaks racing along every bar. Rather than light the stack with lamps,
// we paint a tiny studio as an equirectangular image and let the glass
// mirror it.
//
// The studio is built as ONE smooth vertical gradient rather than a stack
// of discrete strips, and that matters more than it sounds. A rounded
// rectangle has four straight sides, and a straight side of a bar is a
// flat, perfectly smooth mirror. Any hard edge in the studio gets stamped
// onto those sides as a crisp grey rectangle that reads as a rendering
// artefact. A gradient with no hard edges anywhere can only ever produce
// smooth streaks.
//
// Stops run top (t=0) to bottom (t=1) of the sphere:
//   a tight rim light high up, the main key just above the horizon, and a
//   second dimmer rail below it that gives each bar its double highlight.
type Stop = { t: number; color: string };

const gradientStops = (variant: Variant): Stop[] => [
  { t: 0.0, color: "#000000" },
  { t: 0.03, color: variant.fillColor },
  { t: 0.055, color: "#ffffff" }, // tight rim light, high up
  { t: 0.085, color: variant.fillColor },
  { t: 0.15, color: "#010203" },
  { t: 0.30, color: "#050a0d" },
  { t: 0.325, color: variant.highlightColor },
  { t: 0.35, color: "#ffffff" }, // key: the main streak down every bar
  { t: 0.375, color: variant.highlightColor },
  { t: 0.41, color: "#050a0d" },
  { t: 0.56, color: "#020406" },
  { t: 0.625, color: variant.innerGlowColor },
  { t: 0.65, color: "#ffffff" }, // second rail: the double highlight
  { t: 0.675, color: variant.innerGlowColor },
  { t: 0.72, color: "#020406" },
  { t: 1.0, color: "#000000" },
];

const createEnvCanvas = (variant: Variant): HTMLCanvasElement => {
  const canvas = document.createElement("canvas");
  canvas.width = ENV_WIDTH;
  canvas.height = ENV_HEIGHT;
  const ctx = canvas.getContext("2d")!;

  const grad = ctx.createLinearGradient(0, 0, 0, ENV_HEIGHT);
  for (const stop of gradientStops(variant)) {
    grad.addColorStop(stop.t, stop.color);
  }
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, ENV_WIDTH, ENV_HEIGHT);

  // Very soft, very large longitudinal blooms. These break the perfect
  // rotational symmetry so highlights vary along the stack instead of
  // repeating identically on every bar. Kept enormous and low-contrast so
  // they never introduce an edge.
  ctx.globalCompositeOperation = "lighter";
  const blooms: { x: number; y: number; r: number; color: string; a: number }[] = [
    { x: 0.2, y: 0.36, r: 0.42, color: variant.innerGlowColor, a: 0.16 },
    { x: 0.72, y: 0.42, r: 0.36, color: variant.highlightColor, a: 0.13 },
    { x: 0.46, y: 0.63, r: 0.3, color: variant.highlightColor, a: 0.1 },
  ];
  for (const b of blooms) {
    const radius = b.r * ENV_WIDTH;
    const radial = ctx.createRadialGradient(
      b.x * ENV_WIDTH, b.y * ENV_HEIGHT, 0,
      b.x * ENV_WIDTH, b.y * ENV_HEIGHT, radius,
    );
    radial.addColorStop(0, b.color);
    radial.addColorStop(1, "rgba(0,0,0,0)");
    ctx.globalAlpha = b.a;
    ctx.fillStyle = radial;
    ctx.fillRect(0, 0, ENV_WIDTH, ENV_HEIGHT);
  }
  ctx.globalAlpha = 1;
  ctx.globalCompositeOperation = "source-over";

  // Mirroring the studio, not just the geometry, is what makes the second
  // version a true reflection: otherwise the highlights would fall on the
  // wrong side and it would read as a different shot.
  if (variant.mirror === -1) {
    const flipped = document.createElement("canvas");
    flipped.width = ENV_WIDTH;
    flipped.height = ENV_HEIGHT;
    const fctx = flipped.getContext("2d")!;
    fctx.translate(ENV_WIDTH, 0);
    fctx.scale(-1, 1);
    fctx.drawImage(canvas, 0, 0);
    return flipped;
  }
  return canvas;
};

// Builds a prefiltered (PMREM) environment from the painted studio so the
// material can use it for both sharp reflections and rough ambient.
export const createEnvironment = (
  renderer: WebGPURenderer,
  variant: Variant,
): { texture: Texture; dispose: () => void } => {
  const source = new CanvasTexture(createEnvCanvas(variant));
  source.mapping = EquirectangularReflectionMapping;
  source.colorSpace = SRGBColorSpace;
  source.minFilter = LinearFilter;
  source.magFilter = LinearFilter;
  source.generateMipmaps = false;
  source.needsUpdate = true;

  const pmrem = new PMREMGenerator(renderer);
  const target = pmrem.fromEquirectangular(source);
  pmrem.dispose();
  source.dispose();

  return { texture: target.texture, dispose: () => target.dispose() };
};
