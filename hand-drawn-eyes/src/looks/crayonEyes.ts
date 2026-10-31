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
  pairWidth: 0.8, // both eyes together, fraction of frame width
  gap: 0.11, // between the eyes, fraction of frame width
  eyeY: 0.52, // fraction of frame height
  aspect: 0.33,
  irisDiameter: 1.3, // fraction of eye height
  pupil: 0.31, // fraction of iris radius
  white: "#FCFBF8",
  glowPx: 6, // glow blur radius at 4K
  glowAlpha: 1,
  haloPx: 13, // a second, fainter halo (gone within ~8px at 720p)
  haloAlpha: 0.6,
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
    upperPow: 0.85,
    lowerPow: 1.45,
    upperSkew: -0.15,
    lowerSkew: 0.1,
    closeAt: 0.68,
    upperFrac: 0.62,
  };

  // The two eyes are drawn separately by hand: never quite the same shape.
  const specs: AlmondSpec[] = [
    { ...spec, w: spec.w * 1.03, h: spec.h * 0.96, upperSkew: spec.upperSkew - 0.1 },
    { ...spec, w: spec.w * 0.96, h: spec.h * 1.05, upperSkew: spec.upperSkew + 0.12, lowerSkew: spec.lowerSkew - 0.08 },
  ];

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
  // p5.brush keeps a little compositing state between paints, so textures are
  // always painted in one fixed order (all variants, both eyes) the first time
  // any is needed. Every browser tab then paints identically, whichever frame
  // it starts on.
  const getTex = (e: number, v: number, dpr: number): EyeTex => {
    const key = `${e}:${v}:${dpr}`;
    if (!cache.has(key)) {
      for (let vv = 0; vv < CRAYON.boilVariants; vv++)
        for (let ee = 0; ee < 2; ee++) {
          const k = `${ee}:${vv}:${dpr}`;
          if (!cache.has(k)) cache.set(k, paintTex(ee, vv, dpr));
        }
    }
    return cache.get(key)!;
  };
  const paintTex = (e: number, v: number, dpr: number): EyeTex => {
    const seed = (part: string) => seedFor(cfg.id, part, e, v);
    const toTex = ([x, y]: Pt): Pt => [x + texW / 2, y + texH / 2];
    const poly = lidPolygon(lids(specs[e], jit[e][v], 1)).map(toTex);
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
    const wobbly = (r: number, n = 22): [number, number][] =>
      Array.from({ length: n }, (_, i) => {
        const t = (i / n) * Math.PI * 2;
        const rr = r * (1 + 0.05 * Math.sin(t * 3 + rng.range(0, 6)) + rng.gauss() * 0.015);
        return [ic + Math.cos(t) * rr, ic + Math.sin(t) * rr];
      });
    // Iris: crayon scribbled back and forth in two directions, a few loose
    // rings, radial fibres.
    const ringMask = paintMask(isz, isz, seed("iris"), (b) => {
      b.noFill();
      b.noStroke();
      b.hatchStyle("crayon", "#000000", 5);
      b.hatch(7, rng.range(20, 70), { rand: 0.25 });
      b.polygon(wobbly(R));
      b.hatch(9, rng.range(-70, -20), { rand: 0.25 });
      b.polygon(wobbly(R * 0.96));
      b.noHatch();
      b.set("crayon", "#000000", 5);
      for (let k = 0; k < 3; k++) b.circle(ic + rng.gauss() * 4, ic + rng.gauss() * 4, R * rng.range(0.55, 0.95));
      b.set("crayon", "#000000", 4);
      for (let i = 0; i < 46; i++) {
        const a = rng.range(0, Math.PI * 2);
        const r0 = R * rng.range(0.3, 0.45);
        const r1 = R * rng.range(0.75, 1);
        b.line(ic + Math.cos(a) * r0, ic + Math.sin(a) * r0, ic + Math.cos(a) * r1, ic + Math.sin(a) * r1);
      }
    });
    const rimMask = paintMask(isz, isz, seed("rim"), (b) => {
      b.noFill();
      b.set("crayon", "#000000", 6);
      for (let r = R * 0.82; r <= R + 2; r += 9) b.circle(ic + rng.gauss() * 3, ic + rng.gauss() * 3, r);
    });
    const pupilMask = paintMask(isz, isz, seed("pupil"), (b) => {
      b.noFill();
      b.noStroke();
      b.hatchStyle("crayon", "#000000", 6);
      b.hatch(4, rng.range(0, 180), { rand: 0.2 });
      b.polygon(wobbly(R * CRAYON.pupil, 14));
      b.hatch(5, rng.range(0, 180), { rand: 0.2 });
      b.polygon(wobbly(R * CRAYON.pupil * 0.97, 14));
      b.noHatch();
      b.set("crayon", "#000000", 6);
      b.beginShape(0.6);
      for (const p of wobbly(R * CRAYON.pupil, 14)) b.vertex(p[0], p[1]);
      b.endShape(true);
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
    ictx.drawImage(colorize(rimMask, cfg.irisRim, 0.3), 0, 0);
    ictx.drawImage(colorize(pupilMask, "#040404"), 0, 0);
    ictx.drawImage(colorize(pupilMask, "#040404"), 0, 0);

    // Catchlight: a small white crayon blob.
    const csz = Math.ceil(R * 0.5);
    const catchMask = paintMask(csz, csz, seed("catch"), (b) => {
      const pts: [number, number][] = Array.from({ length: 9 }, (_, i) => {
        const t = (i / 9) * Math.PI * 2;
        const rr = csz * 0.3 * (1 + rng.gauss() * 0.12);
        return [csz / 2 + Math.cos(t) * rr * 1.1, csz / 2 + Math.sin(t) * rr * 0.9];
      });
      b.noFill();
      b.noStroke();
      b.hatchStyle("crayon", "#000000", 5);
      b.hatch(3, rng.range(0, 180), { rand: 0.2 });
      b.polygon(pts);
      b.noHatch();
    });
    const catchTex = colorize(catchMask, "#FFFFFF");

    // Closed-lid line.
    const closed = lids(specs[e], jit[e][v], 0).closed.map(toTex);
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
        const lidsNow = lids(specs[e], jit[e][v], open);
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
      const cxl = mirror * R * 0.2;
      lc.globalAlpha = 0.95;
      lc.drawImage(tex.catch, cxl - csz / 2 + ix * 0.15, -R * 0.2 - csz / 2 + iy * 0.15 + eh * 0.05, csz, csz);
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
      ctx.filter = `blur(${CRAYON.haloPx * dpr}px)`;
      ctx.globalAlpha = CRAYON.haloAlpha;
      ctx.drawImage(L.c, x0, y0, lw / dpr, lh / dpr);
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
  irisRim: "#1A78BC",
  irisCore: "#22B2F2",
});

export const drawCrayonEyesAmber = makeCrayonEyes({
  id: "CrayonEyes_Amber",
  iris: "#E89A1A",
  irisRim: "#8A4A06",
  irisCore: "#F6C25A",
});

