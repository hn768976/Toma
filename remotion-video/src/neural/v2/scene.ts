/**
 * three.js scene for one depth slice of V2.
 *
 * The strands of a bundle lie in a horizontal plane and the planes are
 * stacked, so lateral fan-out is in XZ and the sway is in Y -- the opposite
 * arrangement to V1, which is what produces the isometric layered read.
 *
 * Every time-varying term is a sine of `frame / duration` with an integer
 * cycle count, so frame `duration` is bit-identical to frame 0 and the clip
 * repeats seamlessly.
 */

import { PerspectiveCamera, Scene, type Texture } from "three";
import { DotField, makeDotTexture, type Dot } from "../core/dots";
import { mulberry32 } from "../core/noise";
import { edgeFade } from "../core/math";
import { mixRgb, V2, type Rgb } from "../core/palette";
import { RibbonMesh, type Sample } from "../core/ribbon";
import type { PosedScene } from "../components/ThreeLayer";
import {
  buildV2Field,
  v2Camera,
  TAU,
  V2_DURATION_IN_FRAMES,
  type BandData,
  type BandId,
} from "./field";

export const V2_FOV = 32;

const SAMPLES = 46;
const BASE_WIDTH = 0.075;
const DOTS_PER_STRAND = 7;

/** Defocus radius per slice, in composition pixels at 1080p. */
export const V2_BAND_BLUR: Record<BandId, number> = { 0: 6, 1: 0, 2: 22 };

type Point = { x: number; y: number; z: number; pinch: number; fan: number };

const strandPoint = (
  data: BandData,
  strandIndex: number,
  t: number,
  f: number,
  out: Point,
): void => {
  const strand = data.strands[strandIndex];
  const layer = data.layers[strand.layer];

  const u = (t - 0.5) * 2;
  const absU = Math.abs(u);

  // Strands arrive from the right as a tight gathered beam, pass through the
  // pinch and open out to the left across the layer's plane.
  const bias = u > 0 ? layer.tightBias : 1;
  const branchFan = Math.pow(absU, 1.3);
  const strandFan = Math.pow(absU, 2.1);
  const lateral =
    (strand.branch * branchFan +
      strand.withinBranch * strand.branchWidth * strandFan) *
    bias *
    layer.spread;

  // Outer strands stop shorter than inner ones by a linear ramp, so the tips
  // line up along a straight edge rather than a ragged arc.
  const reach =
    layer.length * (1 - layer.edgeSlope * ((strand.radial + 1) * 0.5));
  // Strands that travel furthest sideways also fall furthest back along the
  // axis, which curves the fan into a feather instead of a flat radial
  // spray.
  const along =
    u * reach + (layer.curl * lateral * lateral) / layer.spread;

  // Two travelling waves with whole-number cycle counts: periodic by
  // construction, so the loop closes exactly.
  const wave =
    Math.sin(along * 0.42 + strand.phase + TAU * f) * 0.5 +
    Math.sin(along * 0.23 - strand.phase * 0.7 + TAU * f * 2) * 0.28;

  const ca = Math.cos(layer.angle);
  const sa = Math.sin(layer.angle);

  out.x = layer.x + along * ca - lateral * sa;
  out.z = layer.z + along * sa + lateral * ca;
  // Sway lifts the strands out of their plane, which is what stops the
  // layers looking like flat cut-outs.
  out.y =
    layer.y +
    strand.yJitter * 0.22 +
    wave * (0.35 + branchFan * 1.5) +
    // The spine rides clear of the bundle it belongs to.
    (strand.isSpine ? 0.55 : 0);

  out.pinch = Math.exp(-(u * u) / 0.035);
  out.fan = branchFan;
};

export const buildV2Band = (
  band: BandId,
  width: number,
  height: number,
): PosedScene => {
  const field = buildV2Field();
  const data = field[band];

  const scene = new Scene();
  const camera = new PerspectiveCamera(V2_FOV, width / height, 0.1, 260);

  const ribbons = new RibbonMesh(data.strands.length, SAMPLES);
  scene.add(ribbons.mesh);

  const packetTexture: Texture = makeDotTexture(64, 2.6);
  const flareTexture: Texture = makeDotTexture(128, 1.15);

  const dotCount = Math.round(data.strands.length * DOTS_PER_STRAND);
  const packetsSmall = new DotField(dotCount, 0.3, packetTexture);
  const packetsLarge = new DotField(
    Math.round(dotCount * 0.28),
    0.55,
    packetTexture,
  );
  const flares = new DotField(data.layers.length, 2.2, flareTexture);
  const flareCores = new DotField(data.layers.length, 0.6, packetTexture);
  scene.add(
    packetsSmall.points,
    packetsLarge.points,
    flares.points,
    flareCores.points,
  );

  const rnd = mulberry32(0x2c0de + band);
  const totalPackets = dotCount + Math.round(dotCount * 0.28);
  const packetStrand = new Int32Array(totalPackets);
  const packetPhase = new Float32Array(totalPackets);
  /** Whole cycles per loop, so packets return to their start. */
  const packetCycles = new Int32Array(totalPackets);
  const packetGain = new Float32Array(totalPackets);
  for (let i = 0; i < totalPackets; i++) {
    packetStrand[i] = Math.floor(rnd() * data.strands.length);
    packetPhase[i] = rnd();
    packetCycles[i] = (rnd() > 0.5 ? 1 : -1) * (1 + Math.floor(rnd() * 2));
    packetGain[i] = 0.55 + rnd() * 1.0;
  }

  const point: Point = { x: 0, y: 0, z: 0, pinch: 0, fan: 0 };
  /** Loop phase, 0..1. */
  let f = 0;

  const strandColour = (strand: BandData["strands"][number], pinch: number): Rgb => {
    if (strand.isSpine) {
      return mixRgb(V2.fibreSpine, V2.fibreCore, pinch * 0.5);
    }
    if (strand.warmth > 0) {
      return mixRgb(V2.fibreWarm, V2.fibreCore, pinch * 0.35);
    }
    const body = mixRgb(V2.fibreDeep, V2.fibreBody, strand.tone);
    return mixRgb(body, V2.fibreCore, pinch * (0.25 + 0.5 * strand.tone));
  };

  const writeRibbon = (
    strandIndex: number,
    _sampleIndex: number,
    t: number,
    out: Sample,
  ): void => {
    const strand = data.strands[strandIndex];
    const layer = data.layers[strand.layer];
    strandPoint(data, strandIndex, t, f, point);

    out.x = point.x;
    out.y = point.y;
    out.z = point.z;
    out.width =
      BASE_WIDTH *
      strand.widthScale *
      (strand.isSpine ? 1.8 : 1) *
      (1 + point.pinch * 0.5);

    const colour = strandColour(strand, point.pinch);
    out.r = colour[0];
    out.g = colour[1];
    out.b = colour[2];

    out.a =
      edgeFade(t, 0.12) *
      layer.brightness *
      strand.dim *
      (strand.isSpine ? 2.4 : 1) *
      (0.3 + 1.2 * point.pinch) *
      (1 - 0.4 * point.fan) *
      0.42;
  };

  const writePacket = (offset: number) => (index: number, out: Dot) => {
    const i = offset + index;
    if (i >= totalPackets) {
      out.brightness = 0;
      return;
    }

    const strandIndex = packetStrand[i];
    let t = (packetPhase[i] + f * packetCycles[i]) % 1;
    if (t < 0) {
      t += 1;
    }

    strandPoint(data, strandIndex, t, f, point);
    out.x = point.x;
    out.y = point.y;
    out.z = point.z;

    const strand = data.strands[strandIndex];
    const colour = strand.warmth > 0 ? V2.fibreWarm : strand.isSpine ? V2.fibreSpine : data.strands[strandIndex].tone > 0.6 ? V2.dotWhite : V2.dotCool;
    out.r = colour[0];
    out.g = colour[1];
    out.b = colour[2];

    out.brightness =
      data.layers[strand.layer].brightness *
      packetGain[i] *
      edgeFade(t, 0.07) *
      (0.5 + 0.9 * point.pinch);
  };

  const writeFlare = (scale: number) => (index: number, out: Dot) => {
    const layer = data.layers[index];
    strandPoint(data, layer.strandOffset, 0.5, f, point);

    out.x = point.x;
    out.y = point.y;
    out.z = point.z;
    out.r = V2.nodeFlare[0];
    out.g = V2.nodeFlare[1];
    out.b = V2.nodeFlare[2];

    const breath = 0.8 + 0.2 * Math.sin(TAU * f + layer.seed * 0.01);
    out.brightness = layer.brightness * breath * scale;
  };

  const writeFlareWide = writeFlare(0.55);
  const writeFlareCore = writeFlare(1.4);

  return {
    scene,
    camera,
    update: (frame) => {
      f = (frame % V2_DURATION_IN_FRAMES) / V2_DURATION_IN_FRAMES;

      const pose = v2Camera(frame);
      camera.position.set(pose.x, pose.y, pose.z);
      camera.lookAt(pose.lookX, pose.lookY, pose.lookZ);
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
