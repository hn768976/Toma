/**
 * three.js scene for one depth slice of V1.
 *
 * Each slice gets its own canvas so it can be blurred independently, which is
 * how the shallow depth of field is produced: a real DOF pass would need
 * post-processing (and a different implementation per backend), whereas
 * compositing three separately blurred slices is backend-agnostic and costs
 * nothing at render time.
 *
 * All three slices share one camera path, so parallax stays consistent
 * between them.
 */

import { PerspectiveCamera, Scene, type Texture } from "three";
import { DotField, makeDotTexture, type Dot } from "../core/dots";
import { fbm2, mulberry32 } from "../core/noise";
import { edgeFade, smoothstep } from "../core/math";
import { mixRgb, V1, type Rgb } from "../core/palette";
import { RibbonMesh, type Sample } from "../core/ribbon";
import type { PosedScene } from "../components/ThreeLayer";
import {
  buildV1Field,
  v1Camera,
  type BandData,
  type BandId,
} from "./field";

export const V1_FOV = 38;

const SAMPLES = 44;
const SPREAD_SCALE = 6.4;
const BASE_WIDTH = 0.088;
/** Beyond this distance from the camera along X a strand is faded out. */
const FADE_NEAR = 34;
const FADE_FAR = 47;
/**
 * The strands in the reference read as strings of beads rather than as plain
 * curves, so each one carries a lot of packets.
 */
const DOTS_PER_STRAND = 9;

type Point = { x: number; y: number; z: number; pinch: number; fan: number };

/**
 * Position of a strand at parameter `t`, shared by the ribbon geometry and by
 * the data packets that ride along it, so packets always sit exactly on their
 * strand.
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

  const u = (t - 0.5) * 2;
  const along = u * bundle.length * strand.lengthScale;
  const absU = Math.abs(u);

  // One side of each bundle stays tight while the other opens wide.
  const bias = u < 0 ? bundle.spreadLeft : bundle.spreadRight;

  // Two separation rates: branches peel away from the pinch early, strands
  // only leave their branch further out. That ordering is what reads as
  // branching rather than as a plain fan.
  const branchFan = Math.pow(absU, 1.35);
  const strandFan = Math.pow(absU, 2.3);
  const lateral =
    (strand.branch * branchFan +
      strand.withinBranch * strand.branchWidth * strandFan) *
    bias *
    SPREAD_SCALE;

  // Rotate the bundle's local axes into world space.
  const ca = Math.cos(bundle.angle);
  const sa = Math.sin(bundle.angle);
  const x = bundle.x + along * ca - lateral * sa;
  const baseY = bundle.y + along * sa + lateral * ca;

  // A field-wide drape, applied purely as a function of X, is what makes
  // separate bundles read as one continuous flow rather than as isolated
  // objects.
  const warpY =
    Math.sin(x * 0.048 + 0.9 + seconds * 0.13) * 1.5 +
    Math.sin(x * 0.019 - 2.1 - seconds * 0.08) * 2.4;

  const fan = branchFan;
  const wanderScale = 0.3 + fan * 1.4;
  const wanderY = fbm2(x * 0.085, strand.wanderSeed + seconds * 0.05) * 1.15;
  const wanderZ = fbm2(x * 0.07, strand.wanderSeed + 191.3) * 0.95;

  out.x = x;
  out.y = baseY + warpY + wanderY * wanderScale;
  out.z = bundle.z + strand.zJitter * Math.abs(lateral) * 0.5 + wanderZ * wanderScale;
  out.pinch = Math.exp(-(u * u) / 0.03);
  out.fan = fan;
};

/** Fade a bundle up as it enters, and out once it is far behind the camera. */
const bundleGain = (
  data: BandData,
  strandIndex: number,
  x: number,
  seconds: number,
  cameraX: number,
): number => {
  const bundle = data.bundles[data.strands[strandIndex].bundle];
  const entry = smoothstep(
    bundle.entryTime,
    bundle.entryTime + 1.8,
    seconds,
  );
  const distance = Math.abs(x - cameraX);
  return entry * (1 - smoothstep(FADE_NEAR, FADE_FAR, distance));
};

export const buildV1Band = (
  band: BandId,
  width: number,
  height: number,
): PosedScene => {
  const field = buildV1Field();
  const data = field[band];

  const scene = new Scene();
  const camera = new PerspectiveCamera(V1_FOV, width / height, 0.1, 260);

  const ribbons = new RibbonMesh(data.strands.length, SAMPLES);
  scene.add(ribbons.mesh);

  // Sprite sheets: a crisp packet, and a wide soft flare for the nodes.
  const packetTexture: Texture = makeDotTexture(64, 2.6);
  const flareTexture: Texture = makeDotTexture(128, 1.15);

  const dotCount = Math.round(data.strands.length * DOTS_PER_STRAND);
  const packetsSmall = new DotField(dotCount, 0.4, packetTexture);
  const packetsLarge = new DotField(
    Math.round(dotCount * 0.3),
    0.7,
    packetTexture,
  );
  const flares = new DotField(data.bundles.length, 1.9, flareTexture);
  const flareCores = new DotField(data.bundles.length, 0.55, packetTexture);
  scene.add(packetsSmall.points, packetsLarge.points, flares.points, flareCores.points);

  // Per-packet constants, drawn once so the animation stays deterministic.
  const rnd = mulberry32(0x1c0de + band);
  const totalPackets = dotCount + Math.round(dotCount * 0.3);
  const packetStrand = new Int32Array(totalPackets);
  const packetPhase = new Float32Array(totalPackets);
  const packetSpeed = new Float32Array(totalPackets);
  const packetTone = new Float32Array(totalPackets);
  const packetGain = new Float32Array(totalPackets);
  for (let i = 0; i < totalPackets; i++) {
    packetStrand[i] = Math.floor(rnd() * data.strands.length);
    packetPhase[i] = rnd();
    packetSpeed[i] = (0.006 + rnd() * 0.016) * (rnd() > 0.5 ? 1 : -1);
    packetTone[i] = rnd();
    packetGain[i] = 0.6 + rnd() * 1.1;
  }

  const point: Point = { x: 0, y: 0, z: 0, pinch: 0, fan: 0 };
  let seconds = 0;
  let cameraX = 0;

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
    out.width = BASE_WIDTH * strand.widthScale * (1 + point.pinch * 0.5);

    const body: Rgb = mixRgb(V1.fibreDeep, V1.fibreBody, strand.tone);
    const lit = mixRgb(body, V1.fibreCore, point.pinch * (0.22 + 0.45 * strand.tone));
    out.r = lit[0];
    out.g = lit[1];
    out.b = lit[2];

    const gain = bundleGain(data, strandIndex, point.x, seconds, cameraX);
    // Dozens of strands overlap additively, so the per-strand level has to
    // stay low or the bundles clip to white and lose their colour.
    out.a =
      edgeFade(t, 0.13) *
      gain *
      strand.dim *
      (0.3 + 1.2 * point.pinch) *
      // Tips fade out, which keeps the fans feeling open rather than solid.
      (1 - 0.45 * point.fan) *
      0.46;
  };

  const writePacket = (offset: number) => (index: number, out: Dot) => {
      const i = offset + index;
      if (i >= totalPackets) {
        out.brightness = 0;
        return;
      }

      const strandIndex = packetStrand[i];
      // Packets loop along their strand; `t` stays in 0..1 by wrapping.
      let t = (packetPhase[i] + seconds * packetSpeed[i]) % 1;
      if (t < 0) {
        t += 1;
      }

      strandPoint(data, strandIndex, t, seconds, point);
      out.x = point.x;
      out.y = point.y;
      out.z = point.z;

      const tone = packetTone[i];
      const colour =
        tone > 0.66 ? V1.dotWarm : tone > 0.42 ? V1.dotWhite : V1.dotCool;
      out.r = colour[0];
      out.g = colour[1];
      out.b = colour[2];

      const gain = bundleGain(data, strandIndex, point.x, seconds, cameraX);
      out.brightness =
        gain * packetGain[i] * edgeFade(t, 0.08) * (0.55 + 0.85 * point.pinch);
    };

  const writeFlare = (scale: number) => (index: number, out: Dot) => {
      const bundle = data.bundles[index];
      const tint = mixRgb(V1.nodeFlare, V1.dotWarm, bundle.flareWarmth);
      // Sample the bundle exactly at its pinch so the flare sits on the knot.
      const strandIndex = bundle.strandOffset;
      strandPoint(data, strandIndex, 0.5, seconds, point);

      out.x = point.x;
      out.y = point.y;
      out.z = point.z;
      out.r = tint[0];
      out.g = tint[1];
      out.b = tint[2];

      const entry = smoothstep(bundle.entryTime, bundle.entryTime + 1.8, seconds);
      const distance = Math.abs(point.x - cameraX);
      const visible = 1 - smoothstep(FADE_NEAR, FADE_FAR, distance);
      // A slow breath keeps the nodes from looking like static highlights.
      const breath = 0.78 + 0.22 * Math.sin(seconds * 0.9 + bundle.seed * 0.01);
      out.brightness = entry * visible * bundle.brightness * breath * scale;
    };

  const writeFlareWide = writeFlare(0.5);
  const writeFlareCore = writeFlare(1.25);

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
      packetsSmall.update(writePacket(0));
      packetsLarge.update(writePacket(dotCount));
      flares.update(writeFlareWide);
      flareCores.update(writeFlareCore);
    },
    dispose: () => {
      ribbons.dispose();
      packetsSmall.dispose();
      packetsLarge.dispose();
      flares.dispose();
      flareCores.dispose();
      packetTexture.dispose();
      flareTexture.dispose();
    },
  };
};

/**
 * Defocus radius per depth slice, in composition pixels at 1080p. The
 * composition scales these with output height so 4K matches 1080p.
 */
export const V1_BAND_BLUR: Record<BandId, number> = { 0: 6.5, 1: 0, 2: 19 };
