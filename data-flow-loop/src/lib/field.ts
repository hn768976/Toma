import {CatmullRomCurve3, Vector3} from 'three';
import type {SceneConfig} from '../config';
import {DOF_BANDS, TILE_WIDTH} from '../config';
import {clamp, hexToRgb, lerp, mulberry32, smoothstep, wrapCentered} from './prng';

export type PinchNode = {
  chain: number;
  x: number;
  sigmaX: number;
  strength: number;
};

/** A tile-periodic path through the field that a bundle of strands follows. */
export type Chain = {
  y: number;
  z: number;
  ay: number;
  my: number;
  py: number;
  az: number;
  mz: number;
  pz: number;
  /** Per-chain multiplier on the bundle's fanned-out radius. */
  fan: number;
};

export type Strand = {
  bucket: number;
  widthBin: number;
  /** (segments+1)*3 world positions, x running -W/2 .. +W/2. */
  positions: Float32Array;
  /** (segments+1)*3 undulation amplitude vectors, wave A. */
  amp1: Float32Array;
  /** (segments+1)*3 undulation amplitude vectors, wave B. */
  amp2: Float32Array;
  /** [kA, phaseA, kB, phaseB] — integer k so the motion closes the loop. */
  wave: [number, number, number, number];
  colour: [number, number, number];
  opacity: number;
};

export type GlyphData = {
  bucket: number;
  offset: Float32Array;
  size: Float32Array;
  type: Float32Array;
  colour: Float32Array;
  /** [scrollCycles, pulseCycles, pulsePhase, pulseDepth] */
  anim: Float32Array;
};

export type Field = {
  chains: Chain[];
  nodes: PinchNode[];
  strands: Strand[];
  glyphs: GlyphData[];
  /** Line widths in "px at 3840x2160" for each width bin. */
  widthBins: number[];
};

const WIDTH_BINS = [0.65, 0.88, 1.12, 1.4];

/** Shape aspect ratios: [w, h] multipliers per glyph type. */
const GLYPH_ASPECT: [number, number][] = [
  [1, 1], // 0 filled dot
  [3.4, 0.85], // 1 short dash
  [1, 1], // 2 small square
  [1.05, 1.05], // 3 hollow square
  [1.15, 1.15], // 4 ring
  [0.45, 2.6], // 5 thin bar
];

const bucketFor = (z: number, focusZ: number) => {
  const d = Math.abs(z - focusZ);
  for (let i = 0; i < DOF_BANDS.length; i++) {
    if (d < DOF_BANDS[i]) return i;
  }
  return DOF_BANDS.length - 1;
};

export const buildField = (cfg: SceneConfig): Field => {
  const rng = mulberry32(cfg.seed);
  const W = TILE_WIDTH;
  const focusZ = cfg.camera.focusZ;

  // --------------------------------------------------------------- chains
  // Each chain is a smooth, tile-periodic axis through the field. A bundle of
  // strands wraps around it, and the chain's pinch nodes squeeze that bundle's
  // radius down to a waist — the hourglass silhouette the look lives or dies on.
  const chainCount = 3;
  const chains: Chain[] = Array.from({length: chainCount}, (_, i) => ({
    y: rng.range(-13, -5) + (i / (chainCount - 1)) * rng.range(14, 24),
    // Clearly separated depth slabs so the DOF pass can tell them apart.
    z: rng.range(-34, -24) + (i / (chainCount - 1)) * rng.range(38, 50),
    ay: rng.range(1.6, 4),
    my: rng.int(1, 3),
    py: rng.next(),
    az: rng.range(3, 7),
    mz: rng.int(1, 3),
    pz: rng.next(),
    // A tight bundle next to a loose one keeps the depths distinguishable.
    fan: rng.range(0.7, 1.35),
  }));

  const chainAt = (c: Chain, u: number) => ({
    y: c.y + c.ay * Math.sin(Math.PI * 2 * (c.my * u + c.py)),
    z: c.z + c.az * Math.sin(Math.PI * 2 * (c.mz * u + c.pz)),
  });

  // ---------------------------------------------------------------- nodes
  const nodes: PinchNode[] = [];
  for (let c = 0; c < chainCount; c++) {
    const per =
      Math.floor(cfg.nodeCount / chainCount) + (c < cfg.nodeCount % chainCount ? 1 : 0);
    // Irregular X spacing — evenly spaced nodes read as a mechanical comb.
    const gaps: number[] = [];
    let gapSum = 0;
    for (let i = 0; i < per; i++) {
      const g = 0.55 + rng.next() * 1.2;
      gaps.push(g);
      gapSum += g;
    }
    let acc = rng.next() * (W / per);
    for (let i = 0; i < per; i++) {
      acc += (gaps[i] / gapSum) * W;
      nodes.push({
        chain: c,
        x: wrapCentered(acc, W),
        // Tight enough that the influence really does fall to nothing between
        // nodes — otherwise every strand is squeezed everywhere and there is
        // no waist at all, just a uniformly thinner rope.
        sigmaX: rng.range(3.2, 5.6),
        strength: rng.range(1.1, 1.8),
      });
    }
  }

  /** Gaussian pinch influence of chain `c` at world x, saturating at 1. */
  const influence = (c: number, x: number) => {
    let total = 0;
    for (const n of nodes) {
      if (n.chain !== c) continue;
      const dx = wrapCentered(x - n.x, W);
      total += n.strength * Math.exp(-(dx * dx) / (2 * n.sigmaX * n.sigmaX));
    }
    return 1 - Math.exp(-total * 1.6);
  };

  // -------------------------------------------------------------- strands
  const segments = cfg.strandSegments;
  const nCtrl = cfg.strandControlPoints;
  type Draft = Strand & {warmScore: number};
  const drafts: Draft[] = [];

  for (let s = 0; s < cfg.strandCount; s++) {
    // ~62% of strands belong to a bundle; the rest drift free and read as the
    // ambient field between and around the bundles.
    const member = rng.bool(0.62);
    const chainIndex = rng.int(0, chainCount);
    const chain = chains[chainIndex];

    // Bundle members: a fixed offset direction, a radius that opens and closes.
    const rho = Math.sqrt(rng.next());
    const theta = rng.next() * Math.PI * 2;
    const fanR = rng.range(7.5, 14) * chains[chainIndex].fan;
    const waistR = rng.range(0.5, 2.2);

    // Free strands: their own place in the field.
    const y0 = clamp(rng.gauss() * 21, -18, 18);
    const z0 = rng.range(-40, 25);

    // Wander: sums of integer-frequency sinusoids in the tile parameter
    // u = x/W, so the path is exactly periodic across the tile seam.
    const wanderAmp = member ? rng.range(0.3, 1.6) : rng.range(0.5, 2.6);
    const wanderY = [0, 1].map(() => ({
      m: rng.int(1, 4),
      p: rng.next(),
      a: wanderAmp * rng.range(0.5, 1),
    }));
    const wanderZ = [0, 1].map(() => ({
      m: rng.int(1, 4),
      p: rng.next(),
      a: wanderAmp * rng.range(0.4, 0.9),
    }));

    const solve = (x: number) => {
      const u = x / W;
      let y: number;
      let z: number;
      let infl = 0;
      if (member) {
        infl = influence(chainIndex, x);
        const axis = chainAt(chain, u);
        const r = lerp(fanR, waistR, infl);
        y = axis.y + Math.cos(theta) * rho * r;
        z = axis.z + Math.sin(theta) * rho * r * 0.75;
      } else {
        y = y0;
        z = z0;
      }
      for (const k of wanderY) y += k.a * Math.sin(Math.PI * 2 * (k.m * u + k.p));
      for (const k of wanderZ) z += k.a * Math.sin(Math.PI * 2 * (k.m * u + k.p));
      return {y, z, infl};
    };

    // Control points span one tile, plus a ghost either side so the
    // Catmull-Rom stays C1-continuous across the seam.
    const pts: Vector3[] = [];
    const step = W / (nCtrl - 1);
    for (let i = -1; i <= nCtrl; i++) {
      const x = -W / 2 + i * step;
      const r = solve(x);
      pts.push(new Vector3(x, r.y, r.z));
    }
    const curve = new CatmullRomCurve3(pts, false, 'centripetal', 0.5);
    const tSpan = pts.length - 1;
    const t0 = 1 / tSpan;
    const t1 = (pts.length - 2) / tSpan;

    // Undulation: two integer-frequency waves so motion returns exactly to its
    // start at frame 600.
    const dirA = new Vector3(rng.gauss() * 0.25, rng.gauss(), rng.gauss() * 0.8).normalize();
    const dirB = new Vector3(rng.gauss() * 0.25, rng.gauss(), rng.gauss() * 0.8).normalize();
    const ampBase = rng.range(0.12, 0.9);
    const envA = {m: rng.int(1, 4), p: rng.next()};
    const envB = {m: rng.int(1, 4), p: rng.next()};

    const positions = new Float32Array((segments + 1) * 3);
    const amp1 = new Float32Array((segments + 1) * 3);
    const amp2 = new Float32Array((segments + 1) * 3);

    let zSum = 0;
    const tmp = new Vector3();
    for (let i = 0; i <= segments; i++) {
      const f = i / segments;
      curve.getPoint(lerp(t0, t1, f), tmp);
      positions[i * 3] = tmp.x;
      positions[i * 3 + 1] = tmp.y;
      positions[i * 3 + 2] = tmp.z;
      zSum += tmp.z;

      const u = tmp.x / W;
      // Waists stay tight: undulation is damped where the pinch is strong.
      const damp = 1 - 0.85 * solve(tmp.x).infl;
      const eA = ampBase * (0.6 + 0.4 * Math.sin(Math.PI * 2 * (envA.m * u + envA.p))) * damp;
      const eB =
        ampBase * 0.55 * (0.6 + 0.4 * Math.sin(Math.PI * 2 * (envB.m * u + envB.p))) * damp;
      amp1[i * 3] = dirA.x * eA;
      amp1[i * 3 + 1] = dirA.y * eA;
      amp1[i * 3 + 2] = dirA.z * eA;
      amp2[i * 3] = dirB.x * eB;
      amp2[i * 3 + 1] = dirB.y * eB;
      amp2[i * 3 + 2] = dirB.z * eB;
    }

    const meanZ = zSum / (segments + 1);

    drafts.push({
      bucket: bucketFor(meanZ, focusZ),
      widthBin: rng.int(0, WIDTH_BINS.length),
      positions,
      amp1,
      amp2,
      wave: [rng.int(1, 4), rng.next(), rng.int(1, 4), rng.next()],
      colour: [0, 0, 0],
      // Atmospheric perspective: the far half of the field drops back to haze.
      // Free strands sit back so the bundles stay the subject.
      opacity:
        lerp(0.12, 0.45, Math.pow(rng.next(), 1.5)) *
        (member ? 1 : 0.7) *
        lerp(0.3, 1, smoothstep(-40, 8, meanZ)),
      // Warm strands belong in the bundle cores.
      warmScore: member ? (1 - rho) + rng.next() * 0.12 : rng.next() * 0.05,
    });
  }

  // Exactly ~18% warm, allocated to the strands deepest inside the bundles.
  const order = drafts
    .map((_, i) => i)
    .sort((a, b) => drafts[b].warmScore - drafts[a].warmScore);
  const warmCount = Math.round(drafts.length * 0.18);
  const isWarm = new Uint8Array(drafts.length);
  for (let i = 0; i < warmCount; i++) isWarm[order[i]] = 1;

  const paletteRng = mulberry32(cfg.seed ^ 0x9e3779b9);
  const strands: Strand[] = drafts.map((d, i) => {
    const hex = isWarm[i] ? paletteRng.pick(cfg.warm) : paletteRng.pick(cfg.cool);
    return {
      bucket: d.bucket,
      widthBin: d.widthBin,
      positions: d.positions,
      amp1: d.amp1,
      amp2: d.amp2,
      wave: d.wave,
      colour: hexToRgb(hex),
      // Warm cores burn a little hotter so the pinch nodes flare copper.
      opacity: d.opacity * cfg.strandGain * (isWarm[i] ? 1.4 : 1),
    };
  });

  // ------------------------------------------------------------ data rows
  const glyphRng = mulberry32(cfg.seed ^ 0x85ebca6b);
  const buckets = Array.from({length: DOF_BANDS.length}, () => ({
    offset: [] as number[],
    size: [] as number[],
    type: [] as number[],
    colour: [] as number[],
    anim: [] as number[],
  }));

  for (let r = 0; r < cfg.rowCount; r++) {
    const y = glyphRng.range(-16, 16);
    const z = glyphRng.range(-38, 22);
    const bucket = bucketFor(z, focusZ);
    // Near rows scroll faster. Integer cycles => exact loop, wraps on the tile.
    const depth01 = clamp((z + 40) / 65, 0, 1);
    const scrollCycles = 1 + Math.round(depth01 * 2.4);
    const rowScale = lerp(0.7, 1.25, glyphRng.next());
    const rowFade = lerp(0.35, 1, smoothstep(-38, 6, z));

    // Irregular gaps: heavy-tailed spacing, renormalised so the row's total
    // length is exactly one tile (keeps the wrap seamless).
    const nGlyphs = glyphRng.int(70, 150);
    const gaps: number[] = [];
    let gapSum = 0;
    for (let i = 0; i < nGlyphs; i++) {
      const g = 0.35 + Math.pow(glyphRng.next(), 3) * 7;
      gaps.push(g);
      gapSum += g;
    }
    let x = -W / 2;
    const b = buckets[bucket];
    for (let i = 0; i < nGlyphs; i++) {
      x += (gaps[i] / gapSum) * W;
      const type = glyphRng.int(0, 6);
      const px = lerp(2, 16, Math.pow(glyphRng.next(), 2.1)) * rowScale;
      const [aw, ah] = GLYPH_ASPECT[type];

      const hotPixel = glyphRng.bool(1 / 25);
      const hex = hotPixel
        ? glyphRng.pick(cfg.hot)
        : glyphRng.pick([cfg.cool[0], cfg.cool[1]]);
      const [cr, cg, cb] = hexToRgb(hex);
      const gain =
        (hotPixel ? 1.9 : 1) * lerp(0.45, 1.15, glyphRng.next()) * cfg.glyphGain * rowFade;

      b.offset.push(x, y + glyphRng.gauss() * 0.25, z);
      b.size.push(px * aw * 0.5, px * ah * 0.5);
      b.type.push(type);
      b.colour.push(cr * gain, cg * gain, cb * gain);
      b.anim.push(
        scrollCycles,
        glyphRng.bool(0.45) ? 0 : glyphRng.int(1, 4),
        glyphRng.next(),
        glyphRng.range(0.15, 0.85)
      );
    }
  }

  const glyphs: GlyphData[] = buckets
    .map((b, i) => ({
      bucket: i,
      offset: new Float32Array(b.offset),
      size: new Float32Array(b.size),
      type: new Float32Array(b.type),
      colour: new Float32Array(b.colour),
      anim: new Float32Array(b.anim),
    }))
    .filter((g) => g.type.length > 0);

  return {chains, nodes, strands, glyphs, widthBins: WIDTH_BINS};
};
