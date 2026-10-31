// Looks 3-4 · Crayon Eyes: two large crayon-drawn eyes on black. The waxy
// grain of the whites, irises, pupils and catchlights is painted with
// p5.brush (crayon brush), once per boil variant, into offscreen canvases;
// each frame only composites those textures with Canvas 2D.
import { colorize, makeCanvas, resampleTo, type DrawFn } from "../lib/CanvasHost";
import { buildActing } from "../lib/acting";
import { paintMask } from "../lib/brush";
import { lidPolygon, lids, makeJitter, type AlmondJitter, type AlmondSpec } from "../lib/eye";
import { clamp, mod, polyPath, smoothstep, type Pt } from "../lib/math";
import { makeRng, seedFor } from "../lib/rng";

export type CrayonCfg = {
  id: string;
  iris: string; // main iris colour
  irisRim: string; // darker rim
  irisCore: string; // a lighter touch around the pupil
};

// ---- data ------------------------------------------------------------------
export const CRAYON = {
  pairWidth: 0.78, // both eyes together, fraction of frame width
  gap: 0.085, // between the eyes, fraction of frame width
  eyeY: 0.44, // fraction of frame height
  aspect: 0.37,
  irisDiameter: 1.04, // fraction of eye height
  pupil: 0.31, // fraction of iris radius
  white: "#FCFBF8",
  glowPx: 11, // glow blur radius at 4K
  glowAlpha: 0.95,
  boilHold: 3,
  boilVariants: 4,
};

const W = 3840;
const H = 2160;
const LOOP = 300;

type EyeTex = {
  whites: HTMLCanvasElement;
  iris: HTMLCanvasElement;
  catch: HTMLCanvasElement;
  lidLine: HTMLCanvasElement;
  ragged: Pt[]; // per-vertex edge noise for the lid cut
};

export const makeCrayonEyes = (cfg: CrayonCfg): DrawFn => {
  const ew = (W * (CRAYON.pairWidth - CRAYON.gap)) / 2;
  const eh = ew * CRAYON.aspect;
  const spec: AlmondSpec = {
    w: ew,
    h: eh,
    upperPow: 0.7,
    lowerPow: 1.05,
    upperSkew: -0.15,
    lowerSkew: 0.1,
    closeAt: 0.68,
    upperFrac: 0.6,
  };
  const pad = 70;
  const texW = ew + pad * 2;
  const texH = eh + pad * 2;
  const R = (eh * CRAYON.irisDiameter) / 2;
  const centers: Pt[] = [
    [W / 2 - (W * CRAYON.gap) / 2 - ew / 2, H * CRAYON.eyeY],
    [W / 2 + (W * CRAYON.gap) / 2 + ew / 2, H * CRAYON.eyeY],
  ];

  const jit: AlmondJitter[][] = [0, 1].map((e) =>
    Array.from({ length: CRAYON.boilVariants }, (_, v) =>
      makeJitter(makeRng(cfg.id, "eye", e, v), ew * 0.009),
    ),
  );

  const cache = new Map<string, EyeTex>();
  const getTex = (e: number, v: number, dpr: number): EyeTex => {
    const key = `${e}:${v}:${dpr}`;
    const hit = cache.get(key);
    if (hit) return hit;
    const seed = (part: string) => seedFor(cfg.id, part, e, v);
    const toTex = ([x, y]: Pt): Pt => [x + texW / 2, y + texH / 2];
    const poly = lidPolygon(lids(spec, jit[e][v], 1)).map(toTex);
    const rng = makeRng(cfg.id, "tex", e, v);

    // Whites: crayon hatching in two directions + a ragged crayon contour.
    const whitesMask = paintMask(texW, texH, seed("whites"), (b) => {
      b.noFill();
      b.noStroke();
      b.hatchStyle("crayon", "#000000", 5);
      b.hatch(6.5, 32 + rng.range(-6, 6), { rand: 0.18 });
      b.polygon(poly);
      b.hatch(8, -38 + rng.range(-6, 6), { rand: 0.2 });
      b.polygon(poly);
      b.noHatch();
      b.set("crayon", "#000000", 7);
      b.beginShape(0.4);
      for (const p of poly) b.vertex(p[0] + rng.gauss() * 2, p[1] + rng.gauss() * 2);
      b.endShape(true);
    });
    const whites = colorize(whitesMask, CRAYON.white);

    // Iris: concentric crayon rings, a darker rim, a black pupil.
    const isz = Math.ceil(R * 2 + 40);
    const ic = isz / 2;
    const ringMask = paintMask(isz, isz, seed("iris"), (b) => {
      b.noFill();
      b.set("crayon", "#000000", 6);
      for (let r = 8; r <= R; r += 9) b.circle(ic + rng.gauss() * 3, ic + rng.gauss() * 3, r + rng.gauss() * 2);
      // Radial crayon strokes from the pupil outwards (iris fibres).
      b.set("crayon", "#000000", 4);
      for (let i = 0; i < 70; i++) {
        const a = (i / 70) * 360 + rng.gauss() * 3;
        const r0 = R * rng.range(0.3, 0.45);
        const r1 = R * rng.range(0.85, 1);
        const rad = (a * Math.PI) / 180;
        b.line(ic + Math.cos(rad) * r0, ic + Math.sin(rad) * r0, ic + Math.cos(rad) * r1, ic + Math.sin(rad) * r1);
      }
    });
    const rimMask = paintMask(isz, isz, seed("rim"), (b) => {
      b.noFill();
      b.set("crayon", "#000000", 6);
      for (let r = R * 0.8; r <= R + 2; r += 7) b.circle(ic + rng.gauss() * 2, ic + rng.gauss() * 2, r);
    });
    const pupilMask = paintMask(isz, isz, seed("pupil"), (b) => {
      b.noFill();
      b.set("crayon", "#000000", 7);
      for (let r = 4; r <= R * CRAYON.pupil; r += 5) b.circle(ic + rng.gauss(), ic + rng.gauss(), r);
    });
    const { c: iris, ctx: ictx } = makeCanvas(isz, isz);
    ictx.drawImage(
      colorize(ringMask, (cx) => {
        const g = cx.createRadialGradient(ic, ic, R * 0.3, ic, ic, R);
        g.addColorStop(0, cfg.irisCore);
        g.addColorStop(0.7, cfg.iris);
        g.addColorStop(1, cfg.irisRim);
        return g;
      }),
      0,
      0,
    );
    ictx.drawImage(colorize(rimMask, cfg.irisRim, 0.45), 0, 0);
    ictx.drawImage(colorize(pupilMask, "#040404"), 0, 0);
    ictx.drawImage(colorize(pupilMask, "#040404"), 0, 0);

    // Catchlight: a small white crayon blob.
    const csz = Math.ceil(R * 0.5);
    const catchMask = paintMask(csz, csz, seed("catch"), (b) => {
      b.noFill();
      b.set("crayon", "#000000", 6);
      for (let r = 3; r <= csz * 0.4; r += 4) b.circle(csz / 2, csz / 2, r);
    });
    const catchTex = colorize(catchMask, "#FFFFFF");

    // Closed-lid line.
    const closed = lids(spec, jit[e][v], 0).closed.map(toTex);
    const lidMask = paintMask(texW, texH, seed("lid"), (b) => {
      b.noFill();
      b.set("crayon", "#000000", 9);
      b.beginShape(0.5);
      for (const p of closed) b.vertex(p[0], p[1]);
      b.endShape(false);
    });

    const ragged: Pt[] = poly.map(() => [rng.gauss() * 3, rng.gauss() * 4]);
    const tex: EyeTex = {
      whites: resampleTo(whites, dpr),
      iris: resampleTo(iris, dpr),
      catch: resampleTo(catchTex, dpr),
      lidLine: resampleTo(colorize(lidMask, CRAYON.white), dpr),
      ragged,
    };
    cache.set(key, tex);
    return tex;
  };

  const acting = buildActing(makeRng(cfg.id, "acting"), {
    duration: LOOP,
    glanceDur: [6, 10],
    holdRange: [24, 46],
    blinkLen: 6,
    blinks: 3,
    narrow: true,
    widen: true,
    amplitude: 1,
  });

  let layer: ReturnType<typeof makeCanvas> | null = null;

  return (ctx, frame, { dpr }) => {
    const v = mod(Math.floor(frame / CRAYON.boilHold), CRAYON.boilVariants);
    const pose = acting.poseAt(frame);
    const lw = Math.ceil(texW * dpr);
    const lh = Math.ceil(texH * 1.25 * dpr);
    if (!layer || layer.c.width !== lw) layer = makeCanvas(lw, lh);
    const L = layer;

    for (let e = 0; e < 2; e++) {
      const tex = getTex(e, v, dpr);
      const mirror = e === 1 ? -1 : 1;
      const lc = L.ctx;
      lc.setTransform(1, 0, 0, 1, 0, 0);
      lc.clearRect(0, 0, lw, lh);
      // Eye-local coordinates (4K units), centred in the layer.
      lc.setTransform(dpr * mirror, 0, 0, dpr, lw / 2, lh / 2);

      const open = Math.min(1, pose.open);
      const stretch = Math.max(1, pose.open); // widen: the drawing stretches
      lc.save();
      lc.scale(1, stretch);
      if (open < 0.999) {
        // Lid cut: the lid shape at this openness, with a crayon-ragged edge.
        // Near full open it grows past the texture so the painted edge shows.
        const lidsNow = lids(spec, jit[e][v], open);
        const grow = smoothstep((open - 0.6) / 0.4) * 40;
        const poly = lidPolygon(lidsNow).map(([x, y], i): Pt => {
          const up = i < lidsNow.upper.length;
          return [x + tex.ragged[i][0], y + tex.ragged[i][1] + (up ? -grow : grow)];
        });
        lc.clip(polyPath(poly));
      }
      lc.drawImage(tex.whites, -texW / 2, -texH / 2, texW, texH);
      const ix = pose.gx * mirror * ew * 0.27;
      const iy = pose.gy * eh * 0.13;
      const isz = tex.iris.width / dpr;
      // Iris only inside the whites (a crayon iris never leaves the eye).
      lc.globalCompositeOperation = "source-atop";
      lc.drawImage(tex.iris, ix - isz / 2, iy - isz / 2, isz, isz);
      lc.globalCompositeOperation = "source-over";
      // Catchlight: fixed to the eye (same screen side for both eyes).
      const csz = tex.catch.width / dpr;
      const cxl = mirror * R * 0.24;
      lc.globalAlpha = 0.95;
      lc.drawImage(tex.catch, cxl - csz / 2 + ix * 0.15, -R * 0.3 - csz / 2 + iy * 0.15 + eh * 0.05, csz, csz);
      lc.globalAlpha = 1;
      lc.restore();
      if (pose.open < 0.35) {
        lc.globalAlpha = clamp(1 - pose.open / 0.35);
        lc.drawImage(tex.lidLine, -texW / 2, -texH / 2, texW, texH);
        lc.globalAlpha = 1;
      }

      // Composite: tight glow underneath, then the sharp drawing.
      const [cx, cy] = centers[e];
      const x0 = cx - lw / dpr / 2;
      const y0 = cy - lh / dpr / 2;
      ctx.save();
      ctx.filter = `blur(${CRAYON.glowPx * dpr}px)`;
      ctx.globalAlpha = CRAYON.glowAlpha;
      ctx.drawImage(L.c, x0, y0, lw / dpr, lh / dpr);
      ctx.restore();
      ctx.drawImage(L.c, x0, y0, lw / dpr, lh / dpr);
    }
  };
};

export const drawCrayonEyesBlue = makeCrayonEyes({
  id: "CrayonEyes_Blue",
  iris: "#2A9AE8",
  irisRim: "#16639F",
  irisCore: "#4FB2F0",
});

export const drawCrayonEyesAmber = makeCrayonEyes({
  id: "CrayonEyes_Amber",
  iris: "#E89A1A",
  irisRim: "#8A4A06",
  irisCore: "#F6C25A",
});

