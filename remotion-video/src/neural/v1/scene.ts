/**
 * three.js scene for one depth slice of V1.
 *
 * Each slice gets its own canvas so it can be blurred independently, which is
 * how the shallow depth of field is produced without a post-processing pass.
 * All three slices share one camera path, so parallax stays consistent.
 *
 * The strands are heavily beaded: in the reference every fibre is a visible
 * line of travelling dots, and that beading carries as much of the look as
 * the fibres themselves do.
 */

import { PerspectiveCamera, Scene, type Texture } from "three";
import { DotField, makeDotTexture, type Dot } from "../core/dots";
import { fbm2, mulberry32 } from "../core/noise";
import { smoothstep } from "../core/math";
import { mixRgb, V1, type Rgb } from "../core/palette";
import { RibbonMesh, type Sample } from "../core/ribbon";
import type { PosedScene } from "../components/ThreeLayer";
import { buildV1Field, v1Camera, type BandData, type BandId } from "./field";

export const V1_FOV = 38;

const SAMPLES = 52;
/** Total strand width in world units, including the soft glow skirt. */
const BASE_WIDTH = 0.26;
/** Beyond this distance from the camera along X a strand is faded out. */
const FADE_NEAR = 36;
const FADE_FAR = 50;
const DOTS_PER_STRAND = 24;

/** Defocus radius per slice, in composition pixels at 1080p. */
export const V1_BAND_BLUR: Record<BandId, number> = { 0: 5, 1: 0, 2: 17 };

type Point = { x: number; y: number; z: number; node: number; open: number };

/**
 * Position along a strand. Shared by the ribbon geometry and by the dots that
 * ride it, so the beads always sit exactly on their fibre.
 */
const strandPoint = (
  data: BandData,
  strandIndex: number,
  t: number,
  seconds: number,
  out: Point,
): void => {
  const strand = data.strands[strandIndex];
  const bundle = data.bundles[strand.bundle];

  const reach = bundle.length * strand.lengthScale;
  const along = t * reach;
  const x = bundle.x + along * bundle.dir;

  // The fan opens over `falloff` and then flattens: tanh saturates, so past
  // a few falloffs every strand is running parallel to its neighbours at its
  // own height. This is the single most characteristic shape in the
  // reference -- a starburst would keep diverging instead.
  const falloff = bundle.falloff * strand.falloffScale;
  const open = Math.tanh(along / falloff);
  // A little scatter at the root keeps the strands from all passing through
  // one mathematical point, which would read as a hard crease.
  const lateral =
    strand.offset * bundle.spread * open +
    strand.zOffset * 0.35 * (1 - open);
  const depth = strand.zOffset * bundle.spread * 0.45 * open;

  // A field-wide drape as a function of X makes separate bundles read as one
  // continuous flow rather than as isolated objects.
  const warpY =
    Math.sin(x * 0.045 + 0.9 + seconds * 0.12) * 1.7 +
    Math.sin(x * 0.018 - 2.1 - seconds * 0.07) * 2.6;

  // Two scales of wander. The long one carries the strand across the frame;
  // the shorter one puts an S-curve into it roughly once per screen width,
  // which is what stops the flattened-out section reading as ruled lines.
  const wander = 0.3 + open * 1.5;
  const wanderY =
    fbm2(x * 0.032, strand.wanderSeed + seconds * 0.04) * 2.4 +
    fbm2(x * 0.095, strand.wanderSeed + 57.1 + seconds * 0.06) * 1.5;
  const wanderZ = fbm2(x * 0.038, strand.wanderSeed + 191.3) * 1.3;

  out.x = x;
  out.y = bundle.y + lateral + warpY + wanderY * wander;
  out.z = bundle.z + depth + wanderZ * wander;
  // Bright right at the node, falling away fast.
  out.node = Math.exp(-Math.pow(along / (bundle.falloff * 0.28), 2) * 1.6);
  out.open = open;
};

const bundleGain = (
  data: BandData,
  strandIndex: number,
  x: number,
  seconds: number,
  cameraX: number,
): number => {
  const bundle = data.bundles[data.strands[strandIndex].bundle];
  const entry = smoothstep(bundle.entryTime, bundle.entryTime + 1.6, seconds);
  return entry * (1 - smoothstep(FADE_NEAR, FADE_FAR, Math.abs(x - cameraX)));
};

export const buildV1Band = (
  band: BandId,
  width: number,
  height: number,
): PosedScene => {
  const data = buildV1Field()[band];

  const scene = new Scene();
  const camera = new PerspectiveCamera(V1_FOV, width / height, 0.1, 260);

  const ribbons = new RibbonMesh(data.strands.length, SAMPLES);
  scene.add(ribbons.mesh);

  const beadTexture: Texture = makeDotTexture(64, 2.4);
  const flareTexture: Texture = makeDotTexture(128, 1.15);

  const beadCount = Math.round(data.strands.length * DOTS_PER_STRAND);
  const largeCount = Math.round(beadCount * 0.3);
  const beadsSmall = new DotField(beadCount, 0.5, beadTexture);
  const beadsLarge = new DotField(largeCount, 0.95, beadTexture);
  // Every strand ends in a bright head, which is what gives the reference its
  // scattering of sharp points among the softer beads.
  const tips = new DotField(data.strands.length, 0.6, beadTexture);
  const flares = new DotField(data.bundles.length, 2.0, flareTexture);
  const flareCores = new DotField(data.bundles.length, 0.6, beadTexture);
  scene.add(
    beadsSmall.points,
    beadsLarge.points,
    tips.points,
    flares.points,
    flareCores.points,
  );

  const rnd = mulberry32(0x1c0de + band);
  const totalBeads = beadCount + largeCount;
  const beadStrand = new Int32Array(totalBeads);
  const beadPhase = new Float32Array(totalBeads);
  const beadSpeed = new Float32Array(totalBeads);
  const beadTone = new Float32Array(totalBeads);
  const beadGain = new Float32Array(totalBeads);
  for (let i = 0; i < totalBeads; i++) {
    beadStrand[i] = Math.floor(rnd() * data.strands.length);
    beadPhase[i] = rnd();
    beadSpeed[i] = (0.004 + rnd() * 0.012) * (rnd() > 0.5 ? 1 : -1);
    beadTone[i] = rnd();
    beadGain[i] = 0.6 + rnd() * 0.95;
  }

  const point: Point = { x: 0, y: 0, z: 0, node: 0, open: 0 };
  let seconds = 0;
  let cameraX = 0;

  // The amber beads are a signature of the reference; they need a real share
  // of the population, not a token few.
  const beadColour = (tone: number): Rgb =>
    tone > 0.62 ? V1.dotWarm : tone > 0.38 ? V1.dotWhite : V1.dotCool;

  const writeRibbon = (
    strandIndex: number,
    _sampleIndex: number,
    t: number,
    out: Sample,
  ): void => {
    const strand = data.strands[strandIndex];
    strandPoint(data, strandIndex, t, seconds, point);

    out.x = point.x;
    out.y = point.y;
    out.z = point.z;
    // Taper towards the node. Full-width ribbons all converging on one point
    // fill in as a solid triangle; in the reference the fibres are finest
    // where they meet and thicken as they spread.
    out.width = BASE_WIDTH * strand.widthScale * (0.28 + 0.72 * point.open);

    const body: Rgb = mixRgb(V1.fibreDeep, V1.fibreBody, strand.tone);
    const lit = mixRgb(body, V1.fibreCore, point.node * 0.42);
    out.r = lit[0];
    out.g = lit[1];
    out.b = lit[2];

    // Fade the far tip out, and ease the very root in. Without the root
    // ease every strand hits full strength at the same point and the bundle
    // reads as a solid wedge rather than a glow with fibres leaving it.
    const tipFade = 1 - smoothstep(0.82, 1, t);
    const rootEase = smoothstep(0, 0.05, t);
    out.a =
      tipFade *
      rootEase *
      bundleGain(data, strandIndex, point.x, seconds, cameraX) *
      strand.dim *
      (0.36 + 0.7 * point.node) *
      0.26;
  };

  const writeBead = (offset: number) => (index: number, out: Dot) => {
    const i = offset + index;
    if (i >= totalBeads) {
      out.brightness = 0;
      return;
    }

    const strandIndex = beadStrand[i];
    let t = (beadPhase[i] + seconds * beadSpeed[i]) % 1;
    if (t < 0) {
      t += 1;
    }

    strandPoint(data, strandIndex, t, seconds, point);
    out.x = point.x;
    out.y = point.y;
    out.z = point.z;

    const colour = beadColour(beadTone[i]);
    out.r = colour[0];
    out.g = colour[1];
    out.b = colour[2];

    out.brightness =
      bundleGain(data, strandIndex, point.x, seconds, cameraX) *
      beadGain[i] *
      (1 - smoothstep(0.86, 1, t)) *
      (0.65 + 0.5 * point.node);
  };

  const writeTip = (index: number, out: Dot) => {
    strandPoint(data, index, 0.97, seconds, point);
    out.x = point.x;
    out.y = point.y;
    out.z = point.z;

    const colour = beadColour((index * 0.37) % 1);
    out.r = colour[0];
    out.g = colour[1];
    out.b = colour[2];
    out.brightness =
      bundleGain(data, index, point.x, seconds, cameraX) *
      data.strands[index].dim *
      0.75;
  };

  const writeFlare = (scale: number) => (index: number, out: Dot) => {
    const bundle = data.bundles[index];
    strandPoint(data, bundle.strandOffset, 0, seconds, point);

    out.x = point.x;
    out.y = point.y;
    out.z = point.z;

    const tint = mixRgb(V1.nodeFlare, V1.dotWarm, bundle.flareWarmth);
    out.r = tint[0];
    out.g = tint[1];
    out.b = tint[2];

    const entry = smoothstep(bundle.entryTime, bundle.entryTime + 1.6, seconds);
    const visible =
      1 - smoothstep(FADE_NEAR, FADE_FAR, Math.abs(point.x - cameraX));
    const breath = 0.78 + 0.22 * Math.sin(seconds * 0.9 + bundle.seed * 0.01);
    out.brightness = entry * visible * bundle.brightness * breath * scale;
  };

  const writeFlareWide = writeFlare(0.34);
  const writeFlareCore = writeFlare(0.85);

  return {
    scene,
    camera,
    update: (frame) => {
      seconds = frame / 30;
      const pose = v1Camera(seconds);
      cameraX = pose.x;

      camera.position.set(pose.x, pose.y, pose.z);
      camera.lookAt(pose.lookX, pose.lookY, 0);
      camera.updateMatrixWorld();

      ribbons.update(writeRibbon);
      beadsSmall.update(writeBead(0));
      beadsLarge.update(writeBead(beadCount));
      tips.update(writeTip);
      flares.update(writeFlareWide);
      flareCores.update(writeFlareCore);
    },
    dispose: () => {
      ribbons.dispose();
      beadsSmall.dispose();
      beadsLarge.dispose();
      tips.dispose();
      flares.dispose();
      flareCores.dispose();
      beadTexture.dispose();
      flareTexture.dispose();
    },
  };
};
