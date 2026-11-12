import * as THREE from "three";
import { Seg, SegmentBatch } from "../engine/SegmentBatch";
import { Sprite, SpriteBatch } from "../engine/SpriteBatch";
import { createBackground } from "../engine/Background";
import { SceneSpec } from "../engine/Stage";
import { easeInOutCubic, makeNoise1D, mulberry32, range, smoothstep } from "../engine/rng";
import { BLUE, EMBER, ChipPalette, col } from "./palettes";

export type ChipVariant = "v1" | "v2";

const STRIPS = 16; // data bands on each side of the centre band
const LENGTH = 26; // half length of every strip along X
const CHIP = 0.75; // chip half size

export const createChipScene = (variant: ChipVariant): SceneSpec => {
  const pal: ChipPalette = variant === "v1" ? BLUE : EMBER;
  const rng = mulberry32(1485728213);
  const nA = makeNoise1D(11);
  const nC = makeNoise1D(37);

  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(13, 16 / 9, 0.05, 400);

  const tick = col(pal.tick);
  const tickBright = col(pal.tickBright);
  const rail = col(pal.rail);
  const chipC = col(pal.chip);

  const segs: Seg[] = [];
  const chipSegs: Seg[] = [];

  // ---- data bands ------------------------------------------------------------
  // Centre band (holds the chip): "fader" ticks = thin rung + bright pill.
  const CENTER_HALF = 0.87;
  const centreStart = 2.45;
  const centreSpeed = 9.0;
  for (const off of [-CENTER_HALF - 0.05, CENTER_HALF + 0.05]) {
    segs.push({
      x0: -LENGTH, z0: off, x1: LENGTH, z1: off, w: 0.008, color: rail, a: 0.55,
      tIn: 2.0, inDur: 2.4, grow: 1, anchor: 0.5,
    });
  }
  for (let x = -LENGTH; x <= LENGTH; x += 0.16) {
    if (Math.abs(x) < CHIP + 0.12) continue;
    const t0 = centreStart + Math.abs(x) / centreSpeed + range(rng, 0, 0.06);
    segs.push({
      x0: x, z0: -0.8 * CENTER_HALF, x1: x, z1: 0.8 * CENTER_HALF, w: 0.014, color: tick, a: 0.62,
      tIn: t0, inDur: 0.35, grow: 1, anchor: 0.5,
      twAmp: 0.12, twFreq: range(rng, 1, 3), twPhase: range(rng, 0, 6.28),
    });
    const pc = ((nA(x * 0.7 + 3) - 0.5) * 0.5 + (rng() - 0.5) * 0.65);
    const pl = 0.045 + 0.05 * rng();
    segs.push({
      x0: x, z0: pc - pl, x1: x, z1: pc + pl, w: 0.034, color: tickBright, a: 0.8,
      tIn: t0 + 0.08, inDur: 0.3, grow: 1, anchor: 0.5,
      twAmp: 0.15, twFreq: range(rng, 1, 4), twPhase: range(rng, 0, 6.28),
    });
  }

  // Data bands: dense rows of short dashes, flush to a bright inner edge line
  // with a jagged (waveform) outer edge.
  const BAND_W = 1.05;
  const BAND_GAP = 0.14;
  for (let k = 1; k <= STRIPS; k++) {
    for (const side of [-1, 1]) {
      const inner = side * (CENTER_HALF + 0.17 + (k - 1) * (BAND_W + BAND_GAP));
      const flip = k % 2 === 1 ? 1 : -1; // alternate which edge is straight
      const edge = flip === 1 ? inner : inner + side * BAND_W;
      const dirOut = side * flip; // direction the rows grow from the edge
      const start = 3.3 + 0.28 * (k - 1) + range(rng, 0, 0.15);
      const speed = 7 + range(rng, 0, 2);
      const fall = k === 1 ? 1 : k === 2 ? 0.88 : 0.78;
      const revealAt = (x: number) => start + Math.abs(x) / speed + range(rng, 0, 0.08);
      const nz = side * 13.7 + k * 5.1;
      segs.push({
        x0: -LENGTH, z0: edge, x1: LENGTH, z1: edge, w: 0.009, color: tickBright, a: 0.6 * fall,
        tIn: start - 0.25, inDur: 2.2, grow: 1, anchor: 0.5,
      });
      const DASH = 0.12;
      const GAP = 0.022;
      const maxUnits = Math.floor(BAND_W / (DASH + GAP));
      for (let x = -LENGTH; x <= LENGTH; x += 0.09) {
        const t0 = revealAt(x);
        const env = 0.86 + 0.14 * nC(x * 1.3 + nz);
        const units = Math.max(2, Math.round(maxUnits * env + (rng() - 0.5) * 2));
        for (let u = 0; u < units; u++) {
          if (rng() < 0.02) continue;
          const p = 0.03 + u * (DASH + GAP);
          const len = rng() < 0.35 ? DASH * 2 + GAP : DASH;
          if (p + len > BAND_W) break;
          const bright = rng() < 0.16;
          segs.push({
            x0: x, z0: edge + dirOut * p, x1: x, z1: edge + dirOut * (p + len), w: 0.017,
            color: bright ? tickBright : tick, a: (bright ? 1.1 : 0.86) * fall,
            tIn: t0 + p * 0.3, inDur: 0.45,
            twAmp: 0.18, twFreq: range(rng, 0.5, 3), twPhase: range(rng, 0, 6.28),
          });
          if (len > DASH) u++;
        }
      }
      // block clusters beyond the second band
      if (k >= 2) {
        const zg = inner + side * (BAND_W + BAND_GAP * 0.5);
        for (let x = -LENGTH + range(rng, 0, 3); x < LENGTH; x += range(rng, 1.2, 3.5)) {
          if (rng() < 0.35) continue;
          const t0 = revealAt(x) + range(rng, 0.2, 0.9);
          const rows = 2;
          const cols = 3;
          for (let r = 0; r < rows; r++)
            for (let c = 0; c < cols; c++) {
              const cx = x + r * 0.2;
              const cz = zg + (c - 1) * 0.26 * side;
              segs.push({
                x0: cx, z0: cz - 0.1, x1: cx, z1: cz + 0.1, w: 0.12,
                color: tick, a: range(rng, 0.35, 0.6) * fall,
                tIn: t0 + 0.05 * (r + c), inDur: 0.35,
                twAmp: 0.2, twFreq: range(rng, 0.5, 2), twPhase: range(rng, 0, 6.28),
              });
            }
        }
      }
    }
  }

  // ---- the chip --------------------------------------------------------------
  chipSegs.push({ x0: -CHIP, z0: 0, x1: CHIP, z1: 0, w: 2 * CHIP, color: chipC, a: 0.06, tIn: 1.2, inDur: 0.8, y: 0.01 });
  const frame = (h: number, a: number, t: number, w: number) => {
    const e: [number, number, number, number][] = [
      [-h, -h, h, -h], [h, -h, h, h], [h, h, -h, h], [-h, h, -h, -h],
    ];
    e.forEach(([x0, z0, x1, z1], i) =>
      chipSegs.push({ x0, z0, x1, z1, w, color: chipC, a, tIn: t + i * 0.1, inDur: 0.4, grow: 1, anchor: 0, y: 0.012 }),
    );
  };
  frame(CHIP, 0.75, 1.3, 0.014);
  frame(CHIP * 0.82, 0.45, 1.5, 0.009);
  // cross dividing the core into four windows
  chipSegs.push({ x0: -CHIP * 0.82, z0: 0, x1: CHIP * 0.82, z1: 0, w: 0.014, color: chipC, a: 0.7, tIn: 1.7, inDur: 0.4, grow: 1, anchor: 0.5, y: 0.012 });
  chipSegs.push({ x0: 0, z0: -CHIP * 0.82, x1: 0, z1: CHIP * 0.82, w: 0.014, color: chipC, a: 0.7, tIn: 1.75, inDur: 0.4, grow: 1, anchor: 0.5, y: 0.012 });
  // window panes
  for (const i of [-1, 1])
    for (const j of [-1, 1]) {
      const cx = i * CHIP * 0.41;
      const cz = j * CHIP * 0.41;
      chipSegs.push({
        x0: cx - CHIP * 0.33, z0: cz, x1: cx + CHIP * 0.33, z1: cz, w: CHIP * 0.66, color: tickBright,
        a: i === j ? 0.12 : 0.07, tIn: 1.4 + range(rng, 0, 0.4), inDur: 0.3, y: 0.012,
        twAmp: 0.3, twFreq: range(rng, 1, 3), twPhase: range(rng, 0, 6.28),
      });
    }
  // small satellite tiles around the core
  for (const [sx, sz] of [[-1.85, 0.2], [1.8, -0.3], [-0.2, 1.55], [0.35, -1.55], [1.5, 1.25], [-1.5, -1.2]]) {
    const h = 0.15;
    chipSegs.push({ x0: sx - h, z0: sz, x1: sx + h, z1: sz, w: 2 * h, color: tickBright, a: 0.14, tIn: 1.3 + range(rng, 0, 0.8), inDur: 0.5, y: 0.01 });
    for (const [a0, b0, a1, b1] of [[-h, -h, h, -h], [h, -h, h, h], [h, h, -h, h], [-h, h, -h, -h]])
      chipSegs.push({ x0: sx + a0, z0: sz + b0, x1: sx + a1, z1: sz + b1, w: 0.008, color: chipC, a: 0.35, tIn: 1.4 + range(rng, 0, 0.8), inDur: 0.4, grow: 1, anchor: 0, y: 0.01 });
  }
  // pins sticking out across the band
  for (let i = 0; i < 6; i++) {
    const x = -CHIP + 0.14 + i * ((2 * CHIP - 0.28) / 5);
    for (const s2 of [-1, 1])
      chipSegs.push({
        x0: x, z0: s2 * (CHIP + 0.03), x1: x, z1: s2 * (CHIP + 0.2), w: 0.022, color: tickBright, a: 0.65,
        tIn: 1.85 + i * 0.04, inDur: 0.35, grow: 1, anchor: 0, y: 0.01,
      });
  }
  for (let i = 0; i < 4; i++) {
    const z = -CHIP + 0.18 + i * ((2 * CHIP - 0.36) / 3);
    for (const s2 of [-1, 1])
      chipSegs.push({
        x0: s2 * (CHIP + 0.03), z0: z, x1: s2 * (CHIP + 0.14), z1: z, w: 0.02, color: tickBright, a: 0.5,
        tIn: 1.95 + i * 0.04, inDur: 0.3, grow: 1, anchor: 0, y: 0.01,
      });
  }

  // ---- secondary chips (sit off-focus in the foreground / far side) ---------
  const secondary: [number, number, number][] = [
    // [along-band x, across z, reveal time]
    [2.6, 3.4, 3.9],
    [-1.2, -3.6, 4.3],
    [-4.2, 2.6, 4.6],
  ];
  for (const [sx, sz, t0] of secondary) {
    const h = 0.32;
    chipSegs.push({ x0: sx - h, z0: sz, x1: sx + h, z1: sz, w: 2 * h, color: tickBright, a: 0.06, tIn: t0, inDur: 0.6, y: 0.01 });
    for (const [a0, b0, a1, b1] of [[-h, -h, h, -h], [h, -h, h, h], [h, h, -h, h], [-h, h, -h, -h], [0, -h, 0, h], [-h, 0, h, 0]])
      chipSegs.push({ x0: sx + a0, z0: sz + b0, x1: sx + a1, z1: sz + b1, w: 0.014, color: tickBright, a: 0.5, tIn: t0 + 0.1, inDur: 0.5, grow: 1, anchor: 0, y: 0.01 });
    for (const i of [-1, 1]) for (const j of [-1, 1]) {
      const cx = sx + i * h * 0.5, cz = sz + j * h * 0.5;
      chipSegs.push({ x0: cx - h * 0.35, z0: cz, x1: cx + h * 0.35, z1: cz, w: h * 0.7, color: tick, a: 0.3, tIn: t0 + 0.2, inDur: 0.4, y: 0.01 });
    }
  }

  // ---- sparks & dust --------------------------------------------------------
  const sparks: Sprite[] = [];
  const spark = col(pal.spark);
  for (let i = 0; i < 180; i++) {
    const near = i < 110;
    const x = near ? range(rng, -7, 7) : range(rng, -16, 16);
    const z = near
      ? (rng() < 0.5 ? -1 : 1) * range(rng, 0.5, 0.75)
      : range(rng, -8, 8);
    sparks.push({
      x, y: range(rng, 0.01, 0.06), z, size: range(rng, 0.022, 0.04), sharp: 5,
      color: spark, a: range(rng, 0.7, 1.4),
      tIn: 2.3 + Math.abs(x) / 6 + range(rng, 0, 1.2), inDur: 0.4,
      twAmp: 0.6, twFreq: range(rng, 1.5, 4), twPhase: range(rng, 0, 6.28),
    });
  }
  const dustC = col(pal.dust);
  // larger out-of-focus motes drifting close to the lens: keep the dark
  // pre-ignition beat alive (as the reference does)
  for (let i = 0; i < 40; i++) {
    sparks.push({
      x: range(rng, -4, 4), y: range(rng, 0.4, 2.2), z: range(rng, -3, 4),
      vx: range(rng, -0.12, 0.12), vy: range(rng, 0.03, 0.1), vz: range(rng, -0.12, 0.12),
      size: range(rng, 0.03, 0.07), sharp: 2.5, color: dustC, a: range(rng, 0.06, 0.18),
      twAmp: 0.7, twFreq: range(rng, 1, 3), twPhase: range(rng, 0, 6.28),
    });
  }
  for (let i = 0; i < 380; i++) {
    sparks.push({
      x: range(rng, -12, 12), y: range(rng, 0.05, 2.6), z: range(rng, -9, 9),
      vx: range(rng, -0.08, 0.08), vy: range(rng, 0.02, 0.07), vz: range(rng, -0.08, 0.08),
      size: range(rng, 0.012, 0.03), sharp: 3, color: dustC, a: range(rng, 0.1, 0.3),
      twAmp: 0.6, twFreq: range(rng, 0.5, 2), twPhase: range(rng, 0, 6.28),
    });
  }

  // ---- chip glow (animated intensity) ---------------------------------------
  const glowC = col(pal.chipGlow);
  const glows: Sprite[] = [
    { x: 0, y: 0.05, z: 0, size: 1.8, sharp: 4, color: glowC, a: 0.13 },
    { x: 0, y: 0.06, z: 0, size: 0.7, sharp: 5, color: chipC, a: 0.16 },
  ];

  const bg = createBackground({
    colA: col(pal.bgA), colB: col(pal.bgB), glowColor: col(pal.bgGlow),
    glowPos: [1.0, 0.3], glowRadius: 0.55, glowStrength: 0.45,
  });

  const stripBatch = new SegmentBatch(segs, { additive: true, renderOrder: 1 });
  const chipBatch = new SegmentBatch(chipSegs, { additive: true, renderOrder: 2 });
  const sparkBatch = new SpriteBatch(sparks, { additive: true, renderOrder: 3 });
  const glowBatch = new SpriteBatch(glows, { additive: true, renderOrder: 4 });
  scene.add(bg.mesh, stripBatch.mesh, chipBatch.mesh, sparkBatch.mesh, glowBatch.mesh);

  const target = new THREE.Vector3(0, 0, 0);
  const dof = { focus: 17, aperture: 0.016, maxBlur: 0.0065, nearMul: 1.2, skyBlur: 0.0065 };

  return {
    scene,
    camera,
    batches: [stripBatch, chipBatch, sparkBatch, glowBatch],
    dof,
    bloom: { strength: 0.45, radius: 0.5, threshold: 0.2 },
    grade: { exposure: 1.0, vignette: 0.55, vignetteColor: col(pal.vignette) },
    animate: (t, stage) => {
      // eased push-in plus a constant slow drift so the camera is never static
      const u = 0.75 * easeInOutCubic(Math.min(1, t / 10.0333)) + 0.25 * (t / 10.0333);
      // long lens (13° fov) from far away: near-parallel bands, as in the reference
      // low (~14°), rolled camera: bands run ~36° down-right while
      // the ticks read almost horizontal, exactly like the reference framing
      const radius = 17 - 0.8 * u;
      const el = THREE.MathUtils.degToRad(14.6 - 0.6 * u);
      const az = THREE.MathUtils.degToRad(50 - 1.5 * u);
      camera.position.set(
        target.x + radius * Math.cos(el) * Math.sin(az),
        target.y + radius * Math.sin(el),
        target.z + radius * Math.cos(el) * Math.cos(az),
      );
      camera.up.set(0, 1, 0);
      camera.lookAt(target);
      camera.rotateZ(THREE.MathUtils.degToRad(18));
      stage.dof.params.focus = radius;
      // chip ignition: soft glow builds from ~0.3 s, peaks ~1.6 s then settles
      const flare = smoothstep(0.35, 1.7, t) * (1 - 0.4 * smoothstep(2.0, 3.4, t));
      glowBatch.material.uniforms.uIntensity.value = flare * (1 + 0.04 * Math.sin(t * 5.0));
      // background light slowly drifts and breathes
      bg.material.uniforms.uGP.value.set(1.0 - 0.06 * Math.sin(t * 0.35), 0.3 + 0.05 * Math.sin(t * 0.5 + 1));
      bg.material.uniforms.uGS.value = 0.2 + 0.2 * smoothstep(2, 6, t) + 0.04 * Math.sin(t * 1.3);
      // overall bloom breathes in as the data spreads
      if (stage.bloom) stage.bloom.strength = 0.35 + 0.15 * smoothstep(2, 6, t);
    },
  };
};
