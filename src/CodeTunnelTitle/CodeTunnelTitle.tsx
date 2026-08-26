import React, {useEffect, useLayoutEffect, useMemo, useRef, useState} from 'react';
import {
  AbsoluteFill,
  continueRender,
  delayRender,
  useCurrentFrame,
  useVideoConfig,
} from 'remotion';
import {loadFont as loadMono} from '@remotion/google-fonts/JetBrainsMono';
import {loadFont as loadSans} from '@remotion/google-fonts/Montserrat';
import {BASE_FONT_PX, PAD, PreparedBlock, SUPERSAMPLE, prepareBlocks} from './blocks';
import {activeGlitch, buildGlitchEvents} from './glitch';
import {GRAIN_TILE, buildGrainTiles} from './grain';
import {PALETTE, depthColor} from './palette';
import {prepareTitle} from './title';
import {pick, rint, rnd, rrange} from './rand';

const mono = loadMono('normal', {weights: ['400'], subsets: ['latin']});
const sans = loadSans('normal', {weights: ['800'], subsets: ['latin']});

// ── Tunnel geometry ────────────────────────────────────────────────────────
//
// z is the depth of an element. z = 1.0 sits at the vanishing point and z =
// 0.05 is the moment it sweeps past the camera; z therefore *decreases* over
// time as the camera flies forward, and everything is projected outward from
// the vanishing point with
//
//     screenX = vpX + (elementX - vpX) / z
//     screenY = vpY + (elementY - vpY) / z
//     size    = baseSize / z
//
// so as z falls toward zero elements rush outward and grow. That single
// division is the whole perspective effect. When z reaches 0.05 the element is
// recycled back to z = 1.0 with a freshly seeded position.
const Z_FAR = 1.0;
const Z_NEAR = 0.05;
const Z_SPAN = Z_FAR - Z_NEAR;

/** Half-width of the square corridor, in vanishing-plane units. */
const CORRIDOR = 330;

const ELEMENT_COUNT = 30;
const BLOCK_POOL = 50;
const GUIDE_LINES = 20;

/** Frames a lap takes at the opening speed, and how much faster it ends up. */
const BASE_LAP_FRAMES = 268;
const ACCEL = 2.4;

const TITLE_CAP_FRACTION = 0.09;
const TITLE_TRACKING_EM = 0.15;
/** The title creeps from 1.00 to this across the piece. */
const TITLE_SCALE_END = 1.06;

const clamp = (v: number, lo: number, hi: number) =>
  v < lo ? lo : v > hi ? hi : v;

const smoothstep = (edge0: number, edge1: number, x: number) => {
  const t = clamp((x - edge0) / (edge1 - edge0), 0, 1);
  return t * t * (3 - 2 * t);
};

/**
 * Distance travelled, in laps, by frame f. The rate carries an ease-in curve
 * (quadratic in normalised time) rather than a linear ramp, so the opening
 * third stays readable and the last third is visibly quicker.
 */
const rateAt = (f: number, duration: number) =>
  (1 / BASE_LAP_FRAMES) * (1 + ACCEL * (f / duration) ** 2);

const travelAt = (f: number, duration: number) =>
  (1 / BASE_LAP_FRAMES) * (f + (ACCEL * f ** 3) / (3 * duration * duration));

type Wall = 0 | 1 | 2 | 3;

type Placement = {
  dx: number;
  dy: number;
  anchorX: number;
  anchorY: number;
  block: number;
  alpha: number;
};

/**
 * Elements live on the four walls of a square tube, which is what keeps the
 * centre corridor clear enough for the title to stay legible. The anchor makes
 * each block grow *away* from the corridor rather than across it.
 */
const placeElement = (seed: string): Placement => {
  const wall = rint(`${seed}-wall`, 0, 3) as Wall;
  const along = rrange(`${seed}-along`, -1.55, 1.55) * CORRIDOR;
  const perp = CORRIDOR * rrange(`${seed}-perp`, 0.8, 1.24);
  const block = rint(`${seed}-block`, 0, BLOCK_POOL - 1);
  const alpha = rrange(`${seed}-alpha`, 0.5, 1);

  switch (wall) {
    case 0: // left wall
      return {dx: -perp, dy: along, anchorX: 1, anchorY: 0.5, block, alpha};
    case 1: // right wall
      return {dx: perp, dy: along, anchorX: 0, anchorY: 0.5, block, alpha};
    case 2: // ceiling
      return {dx: along, dy: -perp, anchorX: 0.5, anchorY: 1, block, alpha};
    default: // floor
      return {dx: along, dy: perp, anchorX: 0.5, anchorY: 0, block, alpha};
  }
};

/**
 * Blits a source canvas into the destination rect, but only the part that
 * actually lands on screen. Near blocks fly a long way past the frame edge, so
 * without this the compositor blends millions of pixels nobody ever sees.
 */
const blitClipped = (
  ctx: CanvasRenderingContext2D,
  src: CanvasImageSource,
  sw: number,
  sh: number,
  dx: number,
  dy: number,
  dw: number,
  dh: number,
  canvasW: number,
  canvasH: number
) => {
  const x0 = Math.max(dx, 0);
  const y0 = Math.max(dy, 0);
  const x1 = Math.min(dx + dw, canvasW);
  const y1 = Math.min(dy + dh, canvasH);
  if (x1 <= x0 || y1 <= y0) {
    return;
  }
  const kx = sw / dw;
  const ky = sh / dh;
  ctx.drawImage(
    src,
    (x0 - dx) * kx,
    (y0 - dy) * ky,
    (x1 - x0) * kx,
    (y1 - y0) * ky,
    x0,
    y0,
    x1 - x0,
    y1 - y0
  );
};

export type CodeTunnelTitleProps = {
  title: string;
};

export const CodeTunnelTitle: React.FC<CodeTunnelTitleProps> = ({title}) => {
  const frame = useCurrentFrame();
  const {width, height, durationInFrames} = useVideoConfig();
  const canvasRef = useRef<HTMLCanvasElement>(null);

  // The only piece of component state in the piece, and it is not animation
  // state: it exists purely so the first draw happens after the webfonts have
  // landed. Every visual value below is a pure function of `frame`.
  const [fontsReady, setFontsReady] = useState(false);
  const [handle] = useState(() => delayRender('Loading tunnel fonts'));

  useEffect(() => {
    let cancelled = false;
    Promise.all([mono.waitUntilDone(), sans.waitUntilDone()])
      .then(() => document.fonts.ready)
      .then(() => {
        if (cancelled) {
          return;
        }
        setFontsReady(true);
        continueRender(handle);
      })
      .catch(() => continueRender(handle));
    return () => {
      cancelled = true;
    };
  }, [handle]);

  const blocks = useMemo<PreparedBlock[] | null>(
    () => (fontsReady ? prepareBlocks(BLOCK_POOL, mono.fontFamily) : null),
    [fontsReady]
  );

  /** Shared scratch canvas: the tint + depth-blur pass happens here, at source
   * resolution, so its cost never scales with how large a near block gets. */
  const scratch = useMemo(() => {
    if (!blocks) {
      return null;
    }
    const canvas = document.createElement('canvas');
    canvas.width = Math.max(...blocks.map((b) => b.w));
    canvas.height = Math.max(...blocks.map((b) => b.h));
    return {canvas, ctx: canvas.getContext('2d')!};
  }, [blocks]);

  /** Full-width strip used to lift horizontal slices during a glitch. */
  const sliceStrip = useMemo(() => {
    const canvas = document.createElement('canvas');
    canvas.width = width;
    canvas.height = 96;
    return {canvas, ctx: canvas.getContext('2d')!};
  }, [width]);

  const titleLayers = useMemo(
    () =>
      fontsReady
        ? prepareTitle(
            title,
            sans.fontFamily,
            height * TITLE_CAP_FRACTION * TITLE_SCALE_END,
            TITLE_TRACKING_EM
          )
        : null,
    [fontsReady, title, height]
  );

  const grainTiles = useMemo(() => buildGrainTiles(), []);
  const glitchEvents = useMemo(
    () => buildGlitchEvents(durationInFrames),
    [durationInFrames]
  );

  useLayoutEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas || !blocks || !scratch || !titleLayers) {
      return;
    }
    const ctx = canvas.getContext('2d');
    if (!ctx) {
      return;
    }

    const vpX = width / 2;
    const vpY = height * 0.53;
    const cx = width / 2;
    const cy = height / 2;

    const glitch = activeGlitch(glitchEvents, frame);

    // Overall brightness falls away across the last ~120 frames; the title is
    // deliberately exempt.
    const worldDim = 1 - 0.55 * smoothstep(durationInFrames - 120, durationInFrames, frame);
    // ...and the corridor thins out at the same time.
    const survivors = 1 - 0.4 * smoothstep(durationInFrames - 130, durationInFrames, frame);

    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.globalCompositeOperation = 'source-over';
    ctx.globalAlpha = 1;
    ctx.filter = 'none';
    ctx.fillStyle = PALETTE.background;
    ctx.fillRect(0, 0, width, height);

    // ── 1. Tunnel guide lines ────────────────────────────────────────────
    const reach = Math.hypot(width, height);
    ctx.lineWidth = 2;
    for (let i = 0; i < GUIDE_LINES; i++) {
      // Unevenly spaced on purpose: a perfectly regular fan reads as a graphic,
      // not as a corridor.
      const angle =
        (i / GUIDE_LINES) * Math.PI * 2 + rrange(`guide-jitter-${i}`, -0.11, 0.11) * Math.PI;
      const x2 = vpX + Math.cos(angle) * reach;
      const y2 = vpY + Math.sin(angle) * reach;
      const strength = rrange(`guide-strength-${i}`, 0.35, 1) * worldDim;

      const gradient = ctx.createLinearGradient(vpX, vpY, x2, y2);
      gradient.addColorStop(0, 'rgba(26, 44, 68, 0)');
      gradient.addColorStop(0.08, `rgba(26, 44, 68, ${(0.25 * strength).toFixed(3)})`);
      gradient.addColorStop(1, `rgba(26, 44, 68, ${strength.toFixed(3)})`);

      ctx.strokeStyle = gradient;
      ctx.beginPath();
      ctx.moveTo(vpX, vpY);
      ctx.lineTo(x2, y2);
      ctx.stroke();
    }

    // ── 2. Code blocks, back to front ────────────────────────────────────
    const travel = travelAt(frame, durationInFrames);
    const rate = rateAt(frame, durationInFrames);
    /** How much z falls in a single frame -- the length of the motion trail. */
    const dzPerFrame = Z_SPAN * rate;

    type Drawn = {
      z: number;
      life: number;
      p: Placement;
      blk: PreparedBlock;
      alpha: number;
    };

    const drawn: Drawn[] = [];

    for (let i = 0; i < ELEMENT_COUNT; i++) {
      const phase = rnd(`phase-${i}`);
      const s = phase + travel;
      const lap = Math.floor(s);
      const life = s - lap; // 0 at the vanishing point, 1 as it passes camera
      const z = Z_FAR - life * Z_SPAN;

      // Freshly seeded on every lap, so a recycled element never lands back in
      // the same place, and the staggered phases keep the field from
      // refreshing all at once.
      const p = placeElement(`el-${i}-${lap}`);

      const fadeIn = smoothstep(0, 0.2, life);
      const fadeOut = 1 - smoothstep(0.76, 0.95, life);
      // The corridor thins by retiring the higher-indexed elements first.
      const retire = 1 - smoothstep(survivors - 0.12, survivors, i / ELEMENT_COUNT);

      const alpha = p.alpha * fadeIn * fadeOut * retire * worldDim;
      if (alpha <= 0.004) {
        continue;
      }

      drawn.push({z, life, p, blk: blocks[p.block], alpha});
    }

    // Back to front: the largest z is furthest away and goes down first.
    drawn.sort((a, b) => b.z - a.z);

    const sctx = scratch.ctx;

    for (const d of drawn) {
      const {z, life, p, blk} = d;
      const scale = 1 / z;
      const sx = vpX + p.dx / z;
      const sy = vpY + p.dy / z;

      // Depth blur: a sharp mid band, softening slightly toward the vanishing
      // point and hard toward the camera (~40px at 4K).
      const nearness = clamp((0.6 - z) / (0.6 - Z_NEAR), 0, 1);
      const farness = clamp((z - 0.6) / (Z_FAR - 0.6), 0, 1);
      const blurDest = 40 * nearness ** 2.2 + 3 * farness ** 1.5;
      // Blurring in *source* space and then scaling costs the same for a near
      // block as for a far one, and looks the same.
      const blurSrc = clamp((blurDest / scale) * SUPERSAMPLE, 0, 26);

      const destW = (blk.w / SUPERSAMPLE) * scale;
      const destH = (blk.h / SUPERSAMPLE) * scale;
      const textW = (blk.textW / SUPERSAMPLE) * scale;
      const textH = (blk.textH / SUPERSAMPLE) * scale;
      const padScaled = (PAD / SUPERSAMPLE) * scale;
      const originX = sx - p.anchorX * textW - padScaled;
      const originY = sy - p.anchorY * textH - padScaled;

      // Cheap reject: near blocks spend most of their last moments off-frame.
      if (
        originX > width + 8 ||
        originY > height + 8 ||
        originX + destW < -8 ||
        originY + destH < -8
      ) {
        continue;
      }

      const [r, g, b] = depthColor(life);

      sctx.setTransform(1, 0, 0, 1, 0, 0);
      sctx.globalCompositeOperation = 'source-over';
      sctx.globalAlpha = 1;
      sctx.filter = 'none';
      sctx.clearRect(0, 0, blk.w, blk.h);
      sctx.filter = blurSrc > 0.1 ? `blur(${blurSrc.toFixed(2)}px)` : 'none';
      sctx.drawImage(blk.canvas, 0, 0);
      sctx.filter = 'none';
      sctx.globalCompositeOperation = 'source-in';
      sctx.fillStyle = `rgb(${r}, ${g}, ${b})`;
      sctx.fillRect(0, 0, blk.w, blk.h);
      sctx.globalCompositeOperation = 'source-over';

      ctx.globalCompositeOperation = 'source-over';

      // ── Radial motion blur ──────────────────────────────────────────────
      // Anything nearer than z = 0.6 is moving fast enough to strobe at 30fps,
      // so it is smeared along its outward motion vector -- away from the
      // vanishing point, never horizontally. Getting that direction right is
      // what makes the acceleration read as speed instead of judder.
      const samples = z < 0.6 ? (z < 0.3 ? 4 : 3) : 1;

      if (samples === 1) {
        ctx.globalAlpha = d.alpha;
        blitClipped(
          ctx,
          scratch.canvas,
          blk.w,
          blk.h,
          originX,
          originY,
          destW,
          destH,
          width,
          height
        );
      } else {
        let weightSum = 0;
        for (let k = 0; k < samples; k++) {
          weightSum += samples - k;
        }
        // Stacking part-alpha copies loses roughly a fifth of the block's
        // brightness to alpha compositing; give it back so a smeared near block
        // stays as bright as an unsmeared one.
        const compensate = 1.28;
        for (let k = 0; k < samples; k++) {
          // k = 0 is this frame; higher k steps back along one frame of travel.
          const zk = z + (dzPerFrame * k) / (samples - 1);
          const scaleK = 1 / zk;
          const sxk = vpX + p.dx / zk;
          const syk = vpY + p.dy / zk;
          const dW = (blk.w / SUPERSAMPLE) * scaleK;
          const dH = (blk.h / SUPERSAMPLE) * scaleK;
          const oX = sxk - p.anchorX * ((blk.textW / SUPERSAMPLE) * scaleK) - (PAD / SUPERSAMPLE) * scaleK;
          const oY = syk - p.anchorY * ((blk.textH / SUPERSAMPLE) * scaleK) - (PAD / SUPERSAMPLE) * scaleK;

          ctx.globalAlpha = clamp((d.alpha * compensate * (samples - k)) / weightSum, 0, 1);
          blitClipped(ctx, scratch.canvas, blk.w, blk.h, oX, oY, dW, dH, width, height);
        }
      }

      // Bloom on the brightest near code only.
      if (z < 0.26) {
        const bloom = 0.22 * smoothstep(0.26, 0.1, z) * d.alpha;
        if (bloom > 0.01) {
          ctx.globalCompositeOperation = 'lighter';
          ctx.globalAlpha = bloom;
          const grow = 0.03;
          blitClipped(
            ctx,
            scratch.canvas,
            blk.w,
            blk.h,
            originX - destW * grow * 0.5,
            originY - destH * grow * 0.5,
            destW * (1 + grow),
            destH * (1 + grow),
            width,
            height
          );
          ctx.globalCompositeOperation = 'source-over';
        }
      }
    }

    ctx.globalAlpha = 1;
    ctx.filter = 'none';
    ctx.globalCompositeOperation = 'source-over';

    // ── 3. Title ─────────────────────────────────────────────────────────
    // Locked in screen space while the world rushes past it. The only motion is
    // a 1.00 -> 1.06 creep across the whole piece, which reads as the title
    // creeping toward the viewer without ever visibly moving.
    const titleScale =
      1 + (TITLE_SCALE_END - 1) * smoothstep(0, 1, frame / Math.max(1, durationInFrames - 1));

    const tl = titleLayers;
    // The layers are baked at the *end* scale, so this only ever shrinks them.
    const k = titleScale / TITLE_SCALE_END;
    const lw = tl.width * k;
    const lh = tl.height * k;
    // Centre the cap box of the type on the frame centre.
    const lx = cx - (tl.left + tl.textWidth / 2) * k;
    const ly = cy - (tl.baseline - tl.capHeight / 2) * k;

    const blitTitle = (
      src: HTMLCanvasElement,
      alpha: number,
      dx = 0,
      dy = 0
    ) => {
      ctx.globalAlpha = alpha;
      blitClipped(ctx, src, tl.width, tl.height, lx + dx, ly + dy, lw, lh, width, height);
    };

    ctx.globalCompositeOperation = 'lighter';

    // A soft white glow behind the type -- wide, low-alpha, squashed into an
    // ellipse so the halo hugs the line of type rather than ballooning up into
    // the corridor -- so the title separates from the busy code behind it.
    const glowR = tl.textWidth * k * 0.78;
    const glow = ctx.createRadialGradient(0, 0, 0, 0, 0, glowR);
    glow.addColorStop(0, 'rgba(255, 255, 255, 0.17)');
    glow.addColorStop(0.42, 'rgba(210, 230, 255, 0.07)');
    glow.addColorStop(1, 'rgba(255, 255, 255, 0)');
    ctx.save();
    ctx.translate(cx, cy);
    ctx.scale(1, 0.46);
    ctx.globalAlpha = 1;
    ctx.fillStyle = glow;
    ctx.fillRect(-glowR, -glowR, glowR * 2, glowR * 2);
    ctx.restore();

    blitTitle(tl.glowWide, 0.44);
    blitTitle(tl.glowNear, 0.46);

    // Chromatic aberration -- always on, not just during glitch events. Three
    // passes composited with 'lighter': red one way, cyan the other, white on
    // top. This is what makes the title read as a rendered overlay rather than
    // as flat type.
    const offset = glitch
      ? 20 * rrange(`glitch-amp-${glitch.start}-${frame}`, 0.85, 1.2)
      : 7 * rrange(`fringe-${frame}`, 0.9, 1.1);
    const angle = glitch
      ? rrange(`glitch-dir-${glitch.start}-${frame}`, -Math.PI, Math.PI)
      : rrange(`fringe-dir-${frame}`, -0.28, 0.28);
    const ox = Math.cos(angle) * offset;
    const oy = Math.sin(angle) * offset * 0.55;

    blitTitle(tl.red, 1, ox, oy);
    blitTitle(tl.cyan, 1, -ox, -oy);
    blitTitle(tl.core, 1);
    // Bloom on the title.
    blitTitle(tl.bloom, 0.34);

    ctx.globalCompositeOperation = 'source-over';
    ctx.globalAlpha = 1;
    // ── 4. Glitch slices ─────────────────────────────────────────────────
    if (glitch) {
      const sliceCount = rint(`slices-${glitch.start}-${frame}`, 3, 7);
      const strip = sliceStrip.ctx;
      for (let i = 0; i < sliceCount; i++) {
        const seed = `slice-${glitch.start}-${frame}-${i}`;
        const h = Math.round(rrange(`${seed}-h`, 8, 62));
        const y = Math.round(rrange(`${seed}-y`, 0, height - h));
        const dir = pick(`${seed}-dir`, [-1, 1]);
        const shift = Math.round(rrange(`${seed}-shift`, 20, 90)) * dir;

        strip.setTransform(1, 0, 0, 1, 0, 0);
        strip.globalCompositeOperation = 'source-over';
        strip.globalAlpha = 1;
        strip.clearRect(0, 0, width, h);
        strip.drawImage(canvas, 0, y, width, h, 0, 0, width, h);

        ctx.clearRect(0, y, width, h);
        ctx.fillStyle = PALETTE.background;
        ctx.fillRect(0, y, width, h);
        ctx.drawImage(sliceStrip.canvas, 0, 0, width, h, shift, y, width, h);
      }
    }

    // ── 5. Vignette ──────────────────────────────────────────────────────
    const vignette = ctx.createRadialGradient(
      cx,
      cy,
      Math.min(width, height) * 0.18,
      cx,
      cy,
      Math.hypot(width, height) / 2
    );
    vignette.addColorStop(0, 'rgba(0, 0, 0, 0)');
    vignette.addColorStop(0.48, 'rgba(0, 0, 0, 0.03)');
    vignette.addColorStop(0.78, 'rgba(0, 0, 0, 0.18)');
    vignette.addColorStop(1, 'rgba(0, 0, 0, 0.52)');
    ctx.fillStyle = vignette;
    ctx.fillRect(0, 0, width, height);

    // ── 6. Grain ─────────────────────────────────────────────────────────
    const tile = grainTiles[frame % grainTiles.length];
    const gx = -Math.floor(rrange(`grain-x-${frame}`, 0, GRAIN_TILE));
    const gy = -Math.floor(rrange(`grain-y-${frame}`, 0, GRAIN_TILE));
    ctx.globalCompositeOperation = 'lighter';
    ctx.globalAlpha = 0.04;
    for (let x = gx; x < width; x += GRAIN_TILE) {
      for (let y = gy; y < height; y += GRAIN_TILE) {
        ctx.drawImage(tile, x, y);
      }
    }
    ctx.globalAlpha = 1;
    ctx.globalCompositeOperation = 'source-over';
  }, [
    frame,
    width,
    height,
    durationInFrames,
    blocks,
    scratch,
    sliceStrip,
    grainTiles,
    titleLayers,
    glitchEvents,
    title,
  ]);

  return (
    <AbsoluteFill style={{backgroundColor: PALETTE.background}}>
      <canvas
        ref={canvasRef}
        width={width}
        height={height}
        style={{width: '100%', height: '100%', display: 'block'}}
      />
    </AbsoluteFill>
  );
};

export default CodeTunnelTitle;
