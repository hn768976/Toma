import React, { useLayoutEffect, useMemo, useRef } from "react";
import { AbsoluteFill, useCurrentFrame, useVideoConfig } from "remotion";
import { z } from "zod";
import {
  ALPHA_GAIN,
  ALPHA_GAMMA,
  BLOOM_DOWNSCALE,
  BLOOM_OPACITY,
  BOKEH_ALPHA_FALLOFF,
  LIGHT_GAIN,
  LIGHT_RADIUS,
  LIGHT_X,
  LIGHT_Y,
  MASTER_GAIN,
  SHIMMER_CYCLES,
  SHIMMER_DEPTH,
  X_WAVE_TERMS,
  Y_WAVE_TERMS,
  Z_WAVE_TERMS,
} from "./constants";
import { computeWaveGeometry } from "./geometry";
import { generateWaveParticles } from "./particles";
import {
  ALPHA_STEPS,
  INTENSITY_STEPS,
  buildColorTable,
  getPalette,
} from "./palette";

export const particleWaveSchema = z.object({
  // "blue" reproduces the reference grade; "mono" is the same animation
  // rendered in neutral black & white.
  palette: z.enum(["blue", "mono"]),
  // 1 = 1080p (1920x1080), 2 = 4K (3840x2160). Must match the width/height
  // the Composition is registered with in Root.tsx.
  resolutionScale: z.number().positive(),
});

export type ParticleWaveProps = z.infer<typeof particleWaveSchema>;

export const particleWaveDefaults: ParticleWaveProps = {
  palette: "blue",
  resolutionScale: 1,
};

// Wave terms are normalised so the summed displacement lands in [-1, 1]
// regardless of how many terms a stack has.
const normalise = (terms: typeof Z_WAVE_TERMS) => {
  const total = terms.reduce((sum, t) => sum + Math.abs(t.amp), 0) || 1;
  return terms.map((t) => ({ ...t, amp: t.amp / total }));
};

const Z_TERMS = normalise(Z_WAVE_TERMS);
const X_TERMS = normalise(X_WAVE_TERMS);
const Y_TERMS = normalise(Y_WAVE_TERMS);

const createCanvas = (width: number, height: number) => {
  if (typeof document === "undefined") return null;
  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  return canvas;
};

/**
 * Abstract digital particle wave: a lattice of tens of thousands of dots on a
 * gently bowed surface, displaced by a stack of travelling sine waves and shot
 * through a pinhole camera. Perspective does most of the work — depth
 * displacement alone produces the swelling strands, the compressed curling
 * frame edges and the defocused foreground.
 *
 * Drawn on canvas rather than SVG/DOM: 34k animated nodes per frame is well
 * past what the compositor can push at 4K. Bloom is a blurred, downscaled copy
 * of the same particle pass screened back over the sharp one.
 *
 * The loop is seamless by construction: every time-varying quantity is a
 * function of theta = 2*PI*frame/durationInFrames with a whole-number
 * multiplier, so the frame after the last is bit-identical to frame 0.
 */
export const ParticleWave: React.FC<ParticleWaveProps> = ({
  palette,
  resolutionScale,
}) => {
  const frame = useCurrentFrame();
  const { durationInFrames } = useVideoConfig();

  const geometry = useMemo(
    () => computeWaveGeometry(resolutionScale),
    [resolutionScale],
  );
  const {
    width,
    height,
    centerX,
    centerY,
    focal,
    planeDistance,
    curveX,
    curveY,
    xExtent,
    yExtent,
    zAmplitude,
    xAmplitude,
    yAmplitude,
    focusZ,
    bokehPerUnit,
    fogDistance,
    baseDotRadius,
    blurPx,
  } = geometry;

  const particles = useMemo(() => generateWaveParticles(), []);
  const colorTable = useMemo(() => buildColorTable(palette), [palette]);
  const { background, backdropGradient, vignette } = getPalette(palette);

  const bloomWidth = Math.max(1, Math.round(width / BLOOM_DOWNSCALE));
  const bloomHeight = Math.max(1, Math.round(height / BLOOM_DOWNSCALE));

  const sharpRef = useRef<HTMLCanvasElement>(null);
  const bloomRef = useRef<HTMLCanvasElement>(null);
  const offscreen = useMemo(() => createCanvas(width, height), [width, height]);

  useLayoutEffect(() => {
    if (!offscreen) return;
    const ctx = offscreen.getContext("2d");
    const sharpCtx = sharpRef.current?.getContext("2d");
    const bloomCtx = bloomRef.current?.getContext("2d");
    if (!ctx || !sharpCtx || !bloomCtx) return;

    const theta = (Math.PI * 2 * frame) / durationInFrames;

    // Key light, in pixels, for the screen-space brightness falloff below.
    const lightX = LIGHT_X * width;
    const lightY = LIGHT_Y * height;
    const lightSigma = LIGHT_RADIUS * width;
    const invLightDenom = 1 / (2 * lightSigma * lightSigma);

    const shimmerAngle = SHIMMER_CYCLES * theta;

    ctx.clearRect(0, 0, width, height);
    // Additive: overlapping dots pile into the bright strands the reference
    // shows wherever the wave compresses a column.
    ctx.globalCompositeOperation = "lighter";
    ctx.globalAlpha = 1;

    for (let i = 0; i < particles.length; i++) {
      const p = particles[i];
      const { pu, pv } = p;

      // --- Wave displacement, in normalised [-1, 1] units ------------------
      let wz = 0;
      for (let t = 0; t < Z_TERMS.length; t++) {
        const term = Z_TERMS[t];
        wz += term.amp * Math.sin(term.ku * pu + term.kv * pv + term.n * theta);
      }
      let wx = 0;
      for (let t = 0; t < X_TERMS.length; t++) {
        const term = X_TERMS[t];
        wx += term.amp * Math.sin(term.ku * pu + term.kv * pv + term.n * theta);
      }
      let wy = 0;
      for (let t = 0; t < Y_TERMS.length; t++) {
        const term = Y_TERMS[t];
        wy += term.amp * Math.sin(term.ku * pu + term.kv * pv + term.n * theta);
      }

      // --- World position ---------------------------------------------------
      // The surface bows away from the camera towards its edges (curveX/curveY),
      // then the depth wave pushes each point forward or back on top of that.
      const wx3 = p.u * xExtent + wx * xAmplitude;
      const wy3 = p.v * yExtent + wy * yAmplitude;
      const z =
        planeDistance +
        curveX * p.u * p.u +
        curveY * p.v * p.v +
        wz * zAmplitude;

      if (z <= 1) continue; // behind / on the camera plane

      const invZ = 1 / z;
      const projScale = focal * invZ;
      const sx = centerX + wx3 * projScale;
      const sy = centerY + wy3 * projScale;

      // --- Depth of field ---------------------------------------------------
      // Defocus inflates the dot and drains its alpha to conserve energy, so a
      // blurred particle reads as a soft smear, not a fat bright blob.
      const defocus = Math.abs(z - focusZ) * bokehPerUnit;
      const radius = baseDotRadius * projScale + defocus;
      if (radius <= 0) continue;
      const bokehAlpha = 1 / Math.pow(1 + defocus, BOKEH_ALPHA_FALLOFF);

      // Cull generously: a dot can be wide when badly defocused.
      if (
        sx < -radius ||
        sx > width + radius ||
        sy < -radius ||
        sy > height + radius
      ) {
        continue;
      }

      // --- Brightness -------------------------------------------------------
      const fog = Math.exp(-Math.max(0, z - planeDistance) / fogDistance);
      const shimmer =
        1 - SHIMMER_DEPTH + SHIMMER_DEPTH * Math.sin(shimmerAngle + p.shimmerPhase);

      const dx = sx - lightX;
      const dy = sy - lightY;
      const light = 1 + LIGHT_GAIN * Math.exp(-(dx * dx + dy * dy) * invLightDenom);

      // projScale carries the "closer is brighter" cue; the 1.15 exponent
      // deepens it so the receding edges fall away hard.
      const energy =
        Math.pow(projScale, 1.15) * fog * shimmer * light * p.variation;
      if (energy <= 0.02) continue;

      let intensity = MASTER_GAIN * energy;
      if (intensity > 1) intensity = 1;

      let alpha = Math.pow(energy, ALPHA_GAMMA) * ALPHA_GAIN * bokehAlpha;
      if (alpha > 1) alpha = 1;
      if (alpha <= 0.01) continue;

      const ii = (intensity * (INTENSITY_STEPS - 1)) | 0;
      let ji = (alpha * ALPHA_STEPS) | 0;
      if (ji >= ALPHA_STEPS) ji = ALPHA_STEPS - 1;

      ctx.fillStyle = colorTable[ii * ALPHA_STEPS + ji];

      // Sub-pixel dots are the common case; a rect is visually identical at
      // that size and much cheaper than building an arc path.
      if (radius < 1.1) {
        const d = radius * 2;
        ctx.fillRect(sx - radius, sy - radius, d, d);
      } else {
        ctx.beginPath();
        ctx.arc(sx, sy, radius, 0, Math.PI * 2);
        ctx.fill();
      }
    }

    ctx.globalCompositeOperation = "source-over";

    sharpCtx.clearRect(0, 0, width, height);
    sharpCtx.drawImage(offscreen, 0, 0);

    bloomCtx.clearRect(0, 0, bloomWidth, bloomHeight);
    bloomCtx.drawImage(offscreen, 0, 0, bloomWidth, bloomHeight);
  }, [
    frame,
    durationInFrames,
    offscreen,
    particles,
    colorTable,
    width,
    height,
    centerX,
    centerY,
    focal,
    planeDistance,
    curveX,
    curveY,
    xExtent,
    yExtent,
    zAmplitude,
    xAmplitude,
    yAmplitude,
    focusZ,
    bokehPerUnit,
    fogDistance,
    baseDotRadius,
    bloomWidth,
    bloomHeight,
  ]);

  return (
    <AbsoluteFill style={{ backgroundColor: background }}>
      <AbsoluteFill style={{ background: backdropGradient }} />
      <canvas
        ref={bloomRef}
        width={bloomWidth}
        height={bloomHeight}
        style={{
          position: "absolute",
          inset: 0,
          width: "100%",
          height: "100%",
          filter: `blur(${blurPx}px)`,
          opacity: BLOOM_OPACITY,
          mixBlendMode: "screen",
        }}
      />
      <canvas
        ref={sharpRef}
        width={width}
        height={height}
        style={{
          position: "absolute",
          inset: 0,
          width: "100%",
          height: "100%",
          mixBlendMode: "screen",
        }}
      />
      <AbsoluteFill style={{ background: vignette }} />
    </AbsoluteFill>
  );
};
