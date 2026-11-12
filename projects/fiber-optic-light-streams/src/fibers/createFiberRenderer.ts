import * as THREE from "three";
import { createBokehGeometry, createBokehMaterial, markDirty } from "../engine/bokehMaterial";
import { FrameRenderer } from "../engine/GLCanvas";
import { Pipeline } from "../engine/pipeline";
import { clamp, lerp, makeRng, smoothstep } from "../engine/random";
import { RGB } from "./palettes";
import { FiberVariant } from "./variants";

/*
 * Scene layout is authored in "focal-plane units": x/y as they appear on the
 * plane in focus (camera distance F), plus a per-sample camera depth. This
 * makes it easy to compose the frame like the reference while keeping true 3D
 * perspective, parallax and depth of field.
 */
const F = 14; // camera distance to the focal plane
const FOV = 36;
const HALF_H = F * Math.tan((FOV * Math.PI) / 360); // 4.55
const HALF_W = HALF_H * (16 / 9); // 8.09
const BAND_ANGLE = (21 * Math.PI) / 180;
const U_MIN = -13;
const U_MAX = 13;
const FLOOR_Y = -3.4;

type Comet = { u0: number; speed: number; tail: number; color: RGB; size: number; energy: number };
type FiberKind = "band" | "hump" | "top" | "back" | "spark";
type Fiber = {
  kind: FiberKind;
  depth: (u: number) => number;
  path: (u: number) => [number, number];
  spacing: number;
  size: number;
  energy: number;
  glow: number; // brightness of the fibre when no streak is passing
  slot: number;
  comets: Comet[];
  uMin: number;
  uMax: number;
};

const softplus = (x: number) => (x > 20 ? x : Math.log1p(Math.exp(x)));

export const createFiberRenderer = (variant: FiberVariant, fps: number, durationInFrames: number) =>
  (canvas: HTMLCanvasElement, width: number, height: number): FrameRenderer => {
    const pipeline = new Pipeline(canvas, width, height);
    const scene = new THREE.Scene();
    const camera = new THREE.PerspectiveCamera(FOV, width / height, 0.05, 500);
    const rng = makeRng(variant.seed);
    const R = (a: number, b: number) => lerp(a, b, rng());
    const pick = <T,>(arr: T[]) => arr[Math.floor(rng() * arr.length)];

    // ------------------------------------------------------------------ fibres
    // Every fibre carries "streaks": a bright head (the glowing dot / bokeh disc)
    // followed by a lit tail. Nothing is lit ahead of a head, so each streak
    // reads as a light trail shooting towards the upper right.
    const fibers: Fiber[] = [];
    const STREAK_SPAN = U_MAX - U_MIN + 36;
    const cometsFor = (n: number, speed: [number, number], tail: [number, number], size: number, energy: number) => {
      const off = rng();
      return Array.from({ length: n }, (_, i) => ({
        u0: U_MIN - 20 + ((off + i / n + R(-0.12, 0.12)) % 1) * STREAK_SPAN,
        speed: R(speed[0], speed[1]),
        tail: R(tail[0], tail[1]),
        color: pick(variant.heads),
        size: size * R(0.75, 1.25),
        energy: energy * R(0.7, 1.3),
      }));
    };

    // A) the sharp diagonal band of thin fibres (in focus)
    for (let i = 0; i < 32; i++) {
      const n = R(-2.1, 1.5);
      const ang = BAND_ANGLE + R(-0.02, 0.02);
      const d0 = F + R(-0.6, 1.4);
      const cy = 1.15 + n;
      fibers.push({
        kind: "band",
        depth: (u) => d0 + u * 0.09,
        path: (u) => [u * Math.cos(ang), cy + u * Math.sin(ang)],
        spacing: 0.012,
        size: 0.034,
        energy: R(1.4, 2.6),
        glow: 0.05,
        slot: Math.floor(rng() * 1000),
        comets: cometsFor(4, [12, 17], [4, 13], 0.07, 16),
        uMin: U_MIN,
        uMax: U_MAX,
      });
    }
    // D) softer fibres behind the band (depth / haze)
    for (let i = 0; i < 14; i++) {
      const n = R(-3.0, 2.6);
      const ang = BAND_ANGLE + R(-0.05, 0.05);
      const d0 = F + R(5, 12);
      fibers.push({
        kind: "back",
        depth: (u) => d0 + u * 0.15,
        path: (u) => [u * Math.cos(ang), 0.9 + n + u * Math.sin(ang)],
        spacing: 0.03,
        size: 0.12,
        energy: R(0.6, 1.1),
        glow: 0.3,
        slot: Math.floor(rng() * 1000),
        comets: cometsFor(3, [9, 13], [5, 12], 0.12, 7),
        uMin: U_MIN,
        uMax: U_MAX,
      });
    }
    // B) thick out-of-focus foreground cables: rise from the lower left, crest once, drop to the right
    for (let i = 0; i < 4; i++) {
      const n = -2.7 + (i / 3) * 2.6 + R(-0.2, 0.2);
      const d0 = R(6.5, 9.5);
      const xb = R(-0.6, 1.4);
      const s1 = R(0.6, 0.72);
      const s2 = R(0.2, 0.32);
      const w = R(1.1, 1.6);
      fibers.push({
        kind: "hump",
        depth: (u) => d0 + u * 0.05,
        path: (u) => [u, 0.9 + n + s1 * u - (s1 + s2) * w * softplus((u - xb) / w)],
        spacing: 0.12,
        size: R(0.85, 1.15),
        energy: R(0.75, 1.05),
        glow: 1.0,
        slot: Math.floor(rng() * 1000),
        comets: cometsFor(4, [10, 14], [6, 14], 0.5, 22),
        uMin: U_MIN,
        uMax: U_MAX,
      });
    }
    // C) a blurred cable sweeping across the top-left corner
    for (let i = 0; i < 2; i++) {
      const n = R(-0.2, 0.5);
      const d0 = R(7, 9);
      fibers.push({
        kind: "top",
        depth: () => d0,
        path: (u) => [u, 4.3 + n + 0.12 * u + 0.022 * (u + 4) * (u + 4)],
        spacing: 0.08,
        size: R(0.4, 0.55),
        energy: R(0.8, 1.2),
        glow: 1.0,
        slot: Math.floor(rng() * 1000),
        comets: cometsFor(3, [8, 11], [5, 10], 0.42, 16),
        uMin: U_MIN,
        uMax: 4,
      });
    }
    // E) loose out-of-focus sparks: bokeh discs only (no visible fibre body), mostly in the lower half
    for (let i = 0; i < 10; i++) {
      const n = R(-4.2, -0.6);
      const d0 = R(6, 10);
      const ang = BAND_ANGLE + R(-0.1, 0.05);
      fibers.push({
        kind: "spark",
        depth: () => d0,
        path: (u) => [u * Math.cos(ang), n + u * Math.sin(ang) * 0.8],
        spacing: 1,
        size: 0.5,
        energy: 0,
        glow: 0,
        slot: Math.floor(rng() * 1000),
        comets: cometsFor(2, [10, 15], [1, 2], 0.45, 20),
        uMin: U_MIN,
        uMax: U_MAX,
      });
    }

    // Sample every fibre into static points (positions are static in world space;
    // the camera drifts, colours and light pulses animate).
    type Sample = { f: number; u: number; sx: number; sy: number };
    const samples: Sample[] = [];
    for (let f = 0; f < fibers.length; f++) {
      const fb = fibers[f];
      if (fb.kind === "spark") continue; // heads only
      for (let u = fb.uMin; u <= fb.uMax; u += fb.spacing) {
        const [sx, sy] = fb.path(u);
        if (Math.abs(sx) > HALF_W * 1.6 || Math.abs(sy) > HALF_H * 1.8) continue;
        samples.push({ f, u, sx, sy });
      }
    }
    const headCount = fibers.reduce((a, fb) => a + fb.comets.length, 0);
    const geo = createBokehGeometry(samples.length + headCount, rng);
    const toWorld = (sx: number, sy: number, depth: number, out: Float32Array, i: number) => {
      out[i * 3] = (sx * depth) / F;
      out[i * 3 + 1] = (sy * depth) / F;
      out[i * 3 + 2] = F - depth;
    };
    for (let i = 0; i < samples.length; i++) {
      const s = samples[i];
      const fb = fibers[s.f];
      const d = fb.depth(s.u);
      toWorld(s.sx, s.sy, d, geo.positions, i);
      geo.sizes[i] = (fb.size * d) / F;
      // thick soft cables are sampled densely enough already: no stochastic thinning
      geo.spacings[i] = fb.kind === "hump" || fb.kind === "top" ? 0 : (fb.spacing * d) / F;
      geo.rnds[i] = (i * 0.6180339887) % 1;
    }
    const material = createBokehMaterial();
    const points = new THREE.Points(geo.geometry, material);
    points.frustumCulled = false;
    scene.add(points);

    // ------------------------------------------------- reflections & background haze
    const reflSources: number[] = [];
    for (let i = 0; i < samples.length; i += 1) {
      const k = fibers[samples[i].f].kind;
      if ((k === "hump" && i % 12 === 0) || (k === "back" && i % 40 === 0)) reflSources.push(i);
    }
    const hazeCount = 60;
    const hazeSpots = Array.from({ length: hazeCount }, () => ({
      sx: R(-HALF_W * 1.3, HALF_W * 1.3),
      sy: R(-HALF_H * 1.1, HALF_H * 1.1),
      depth: R(30, 45),
      size: R(3.5, 6.0),
      slot: Math.floor(rng() * 1000),
      energy: R(0.035, 0.085),
      drift: R(-0.1, 0.1),
    }));
    const reflGeo = createBokehGeometry(reflSources.length + headCount + hazeCount, rng);
    const reflMat = createBokehMaterial();
    const reflPoints = new THREE.Points(reflGeo.geometry, reflMat);
    reflPoints.frustumCulled = false;
    scene.add(reflPoints);
    const mirror = (sy: number) => 2 * FLOOR_Y - sy;

    // ---------------------------------------------------------- colour waves
    const seq = variant.sequence;
    const WAVE_RATE = 2.0; // theme slots per second (0.5 s per slot)
    const WAVE_LEN = 22; // focal-plane units per slot: colour sweeps gently from left to right
    const themeColor = (phase: number, slot: number, out: number[]) => {
      const k = Math.floor(phase);
      const fr = phase - k;
      const b = smoothstep(0.55, 1.0, fr);
      const ta = seq[clamp(k, 0, seq.length - 1)];
      const tb = seq[clamp(k + 1, 0, seq.length - 1)];
      const ca = ta.colors[slot % ta.colors.length];
      const cb = tb.colors[slot % tb.colors.length];
      const wa = ta.white;
      const wb = tb.white;
      for (let j = 0; j < 3; j++) {
        const a = ca[j] * (1 - wa) + wa;
        const bb = cb[j] * (1 - wb) + wb;
        out[j] = a + (bb - a) * b;
      }
      return out;
    };
    const phaseAt = (sx: number, t: number) => t * WAVE_RATE - sx / WAVE_LEN;
    const reveal = (sx: number, sy: number, t: number, delay = 0) => {
      // light enters from the lower-left during the first ~1.5 s
      const g = (sx / HALF_W + (sy / HALF_H) * 0.6 + 1.6) / 3.2;
      const front = -0.2 + (t - delay) * 1.15;
      return smoothstep(0, 0.35, front - g);
    };
    const delayOf = (k: FiberKind) => (k === "band" || k === "back" ? 0.35 : 0);

    const col = [0, 0, 0];
    // Heads travel down-left (towards -u) and the lit trail extends up-right behind them.
    const headAt = (c: Comet, t: number) =>
      ((((c.u0 - c.speed * t - (U_MIN - 20)) % STREAK_SPAN) + STREAK_SPAN) % STREAK_SPAN) + (U_MIN - 20);
    const fiberTint: Record<FiberKind, number> = { band: 1, back: 0.55, hump: 0.8, top: 0.7, spark: 0 };

    return {
      renderFrame(frame: number) {
        const t = frame / fps;
        const dur = durationInFrames / fps;

        // --- fibre bodies + travelling light pulses
        for (let i = 0; i < samples.length; i++) {
          const s = samples[i];
          const fb = fibers[s.f];
          const vis = reveal(s.sx, s.sy, t, delayOf(fb.kind));
          themeColor(phaseAt(s.sx, t), fb.slot, col);
          const norm = vis * Math.min(1, (fb.spacing / fb.size) * 1.3) * fb.energy * fiberTint[fb.kind];
          let lit = fb.glow;
          let hr = 0;
          let hg = 0;
          let hb = 0;
          for (const c of fb.comets) {
            const du = s.u - headAt(c, t);
            if (du > 0 && du < c.tail) {
              const k = Math.pow(1 - du / c.tail, 0.8) + 1.2 * Math.exp(-du / 0.5);
              lit += k;
              const hk = Math.exp(-du / 1.2) * 0.6;
              hr += c.color[0] * hk;
              hg += c.color[1] * hk;
              hb += c.color[2] * hk;
            }
          }
          const pr = (col[0] * lit + hr) * norm;
          const pg = (col[1] * lit + hg) * norm;
          const pb = (col[2] * lit + hb) * norm;
          geo.colors[i * 3] = pr;
          geo.colors[i * 3 + 1] = pg;
          geo.colors[i * 3 + 2] = pb;
          geo.energies[i] = 1;
        }

        // --- bright heads (the glowing dots / bokeh discs)
        let h = samples.length;
        let r = 0;
        for (const fb of fibers) {
          for (const c of fb.comets) {
            const head = headAt(c, t);
            const [sx, sy] = fb.path(head);
            const d = fb.depth(head);
            const vis = reveal(sx, sy, t, delayOf(fb.kind)) * (head <= fb.uMax && head >= fb.uMin ? 1 : 0);
            toWorld(sx, sy, d, geo.positions, h);
            geo.sizes[h] = (c.size * d) / F;
            geo.spacings[h] = 0;
            geo.shapes[h] = 1;
            const wmix = fb.kind === "band" ? 0.3 : 0.0; // sharp tips are hot-white, bokeh discs stay saturated
            geo.colors[h * 3] = c.color[0] * (1 - wmix) + wmix;
            geo.colors[h * 3 + 1] = c.color[1] * (1 - wmix) + wmix;
            geo.colors[h * 3 + 2] = c.color[2] * (1 - wmix) + wmix;
            geo.energies[h] = c.energy * vis;
            // reflection of the head
            toWorld(sx, mirror(sy), d, reflGeo.positions, r);
            reflGeo.sizes[r] = (1.2 * d) / F;
            reflGeo.spacings[r] = 0;
            reflGeo.colors[r * 3] = c.color[0];
            reflGeo.colors[r * 3 + 1] = c.color[1];
            reflGeo.colors[r * 3 + 2] = c.color[2];
            reflGeo.energies[r] = 0.12 * vis * (fb.kind === "band" ? 0.2 : 1);
            h++;
            r++;
          }
        }
        // --- reflections of the fibre bodies
        for (const i of reflSources) {
          if (r >= reflGeo.count) break;
          const s = samples[i];
          const fb = fibers[s.f];
          const d = fb.depth(s.u);
          toWorld(s.sx, mirror(s.sy), d, reflGeo.positions, r);
          reflGeo.sizes[r] = (0.8 * d) / F;
          reflGeo.spacings[r] = 0;
          reflGeo.colors[r * 3] = geo.colors[i * 3];
          reflGeo.colors[r * 3 + 1] = geo.colors[i * 3 + 1];
          reflGeo.colors[r * 3 + 2] = geo.colors[i * 3 + 2];
          reflGeo.energies[r] = 0.05;
          r++;
        }
        // --- distant haze blobs
        for (const hz of hazeSpots) {
          const sx = hz.sx + hz.drift * t;
          toWorld(sx, hz.sy, hz.depth, reflGeo.positions, r);
          reflGeo.sizes[r] = (hz.size * hz.depth) / F;
          reflGeo.spacings[r] = 0;
          themeColor(phaseAt(sx, t), hz.slot, col);
          const vis = reveal(sx, hz.sy, t);
          // blue-grey ambient haze tinted by the current light colour
          reflGeo.colors[r * 3] = col[0] * 0.5 + 0.45 * 0.5;
          reflGeo.colors[r * 3 + 1] = col[1] * 0.5 + 0.5 * 0.5;
          reflGeo.colors[r * 3 + 2] = col[2] * 0.5 + 0.65 * 0.5;
          reflGeo.energies[r] = hz.energy * vis;
          r++;
        }
        markDirty(geo);
        markDirty(reflGeo);

        // --- camera: slow drift / push, as in the reference
        const k = t / dur;
        camera.fov = FOV;
        camera.updateProjectionMatrix();
        camera.position.set(lerp(-0.35, 0.45, k), lerp(0.15, -0.1, k), F + lerp(0.4, -0.4, k));
        camera.up.set(0, 1, 0);
        camera.lookAt(lerp(-0.1, 0.25, k), lerp(0.1, -0.05, k), 0);
        camera.updateMatrixWorld();

        const proj = height / (2 * Math.tan((FOV * Math.PI) / 360));
        const pxScale = height / 2160;
        const u = material.uniforms;
        u.uProj.value = proj;
        u.uFocus.value = F;
        u.uAperture.value = 1.05;
        u.uMinSize.value = 2.0 * pxScale;
        u.uMaxSize.value = 1000 * pxScale;
        u.uLod.value = 5;
        u.uDisc.value = 1;
        u.uGain.value = 1;
        const ru = reflMat.uniforms;
        ru.uProj.value = proj;
        ru.uFocus.value = F;
        ru.uAperture.value = 0.9;
        ru.uMinSize.value = 2.0 * pxScale;
        ru.uMaxSize.value = 1000 * pxScale;
        ru.uLod.value = 5;
        ru.uDisc.value = 0;
        ru.uGain.value = 1;
        ru.uStretch.value = 1.25;

        const fadeIn = smoothstep(0.0, 1.5, t);
        pipeline.render(scene, camera, {
          exposure: variant.exposure * (0.3 + 0.7 * fadeIn),
          bloomNear: 0.45,
          bloomWide: 0.85,
          saturation: variant.saturation,
          lift: variant.lift.map((v) => v * fadeIn) as [number, number, number],
          vignette: 0.35,
        });
      },
      dispose() {
        geo.geometry.dispose();
        reflGeo.geometry.dispose();
        material.dispose();
        reflMat.dispose();
        pipeline.dispose();
      },
    };
  };


