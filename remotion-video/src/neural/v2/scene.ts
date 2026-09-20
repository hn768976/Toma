/**
 * three.js scene for one depth slice of V2.
 *
 * A fibre leaves its root perpendicular to the root line and drifts sideways
 * by a power of its travel, which bends it into the curl the reference shows
 * while keeping neighbouring fibres parallel near the root -- the combed
 * look. Everything time-varying is a sine of the loop phase with an integer
 * cycle count, so frame `duration` reproduces frame 0 exactly.
 *
 * Depth of field is assigned per *fibre* rather than per sheet. The
 * reference holds the middle of the sheet sharp while the near curl and the
 * far edge fall off, which a per-sheet split cannot express.
 */

import { PerspectiveCamera, Scene, Vector3, type Texture } from "three";
import { DotField, makeDotTexture, type Dot } from "../core/dots";
import { mulberry32 } from "../core/noise";
import { smoothstep } from "../core/math";
import { mixRgb, V2, type Rgb } from "../core/palette";
import { RibbonMesh, type Sample } from "../core/ribbon";
import type { PosedScene } from "../components/ThreeLayer";
import {
  buildV2Field,
  v2Camera,
  TAU,
  V2_DURATION_IN_FRAMES,
  type BandId,
  type Fibre,
  type Sheet,
} from "./field";

export const V2_FOV = 34;

const SAMPLES = 48;
const BASE_WIDTH = 0.082;
const BEADS_PER_FIBRE = 5;

/** Defocus radius per slice, in composition pixels at 1080p. */
export const V2_BAND_BLUR: Record<BandId, number> = { 0: 9, 1: 0, 2: 16 };

type Point = { x: number; y: number; z: number; travel: number };

const fibrePoint = (
  sheets: Sheet[],
  fibre: Fibre,
  t: number,
  f: number,
  out: Point,
): void => {
  const sheet = sheets[fibre.sheet];

  const travel = t * fibre.length;

  // Axes of the sheet's plane: along the root line, and the sweep direction
  // the fibres set off in. Each fibre sweeps at its own angle, so the bundle
  // diverges gently with distance while staying packed at the root.
  const la = sheet.rootAngle;
  const lx = Math.cos(la);
  const lz = Math.sin(la);
  const sa = la - Math.PI / 2 - sheet.skew + fibre.fan;
  const sx = Math.cos(sa);
  const sz = Math.sin(sa);

  const root = fibre.s * sheet.rootLength;
  // The tips hook back toward the near end of the root line.
  const side = -fibre.curl * fibre.length * Math.pow(t, 2.2);

  // Two travelling waves, whole cycles per loop.
  const wave =
    Math.sin(travel * 0.5 + fibre.phase + TAU * f) * 0.42 +
    Math.sin(travel * 0.27 - fibre.phase * 0.7 + TAU * f * 2) * 0.22;

  out.x = sheet.cx + lx * (root + side) + sx * travel;
  out.z = sheet.cz + lz * (root + side) + sz * travel;
  // Each fibre falls at its own rate, rising smoothly across the sheet. The
  // roots stay packed on the plane's edge while the tips spread over most of
  // frame height, which is the cascade the reference opens into. A spread
  // confined to the horizontal plane would be crushed flat by the shallow
  // camera instead.
  out.y =
    sheet.cy +
    -fibre.drop * t * t +
    fibre.lift * Math.sin(t * Math.PI) +
    wave * (0.15 + t * 1.5) +
    (fibre.isSpine ? 0.5 : 0);
  out.travel = t;
};

export const buildV2Band = (
  band: BandId,
  width: number,
  height: number,
): PosedScene => {
  const { sheets, fibres: allFibres } = buildV2Field();

  // Bucket fibres by how far their midpoint sits from the camera, so the
  // focal plane cuts across the sheet instead of following it.
  const scratch: Point = { x: 0, y: 0, z: 0, travel: 0 };
  const eye = v2Camera(0);
  const eyeVec = new Vector3(eye.x, eye.y, eye.z);
  const depths = allFibres.map((fibre) => {
    fibrePoint(sheets, fibre, 0.55, 0, scratch);
    return eyeVec.distanceTo(new Vector3(scratch.x, scratch.y, scratch.z));
  });

  const sorted = [...depths].sort((a, b) => a - b);
  const nearCut = sorted[Math.floor(sorted.length * 0.22)];
  const farCut = sorted[Math.floor(sorted.length * 0.74)];

  allFibres.forEach((fibre, i) => {
    fibre.band = depths[i] < nearCut ? 2 : depths[i] > farCut ? 0 : 1;
  });

  const fibres = allFibres.filter((fibre) => fibre.band === band);

  const scene = new Scene();
  const camera = new PerspectiveCamera(V2_FOV, width / height, 0.1, 260);

  const ribbons = new RibbonMesh(fibres.length, SAMPLES);
  scene.add(ribbons.mesh);

  const beadTexture: Texture = makeDotTexture(64, 2.4);
  const flareTexture: Texture = makeDotTexture(128, 1.15);

  const beadCount = Math.max(1, Math.round(fibres.length * BEADS_PER_FIBRE));
  const beads = new DotField(beadCount, 0.2, beadTexture);
  // A dot at every root: in the reference the root line reads as a dotted
  // edge running back into the distance.
  const roots = new DotField(Math.max(1, fibres.length), 0.22, beadTexture);
  const glow = new DotField(Math.max(1, fibres.length), 0.9, flareTexture);
  scene.add(beads.points, roots.points, glow.points);

  const rnd = mulberry32(0x2c0de + band);
  const beadFibre = new Int32Array(beadCount);
  const beadPhase = new Float32Array(beadCount);
  const beadCycles = new Int32Array(beadCount);
  const beadGain = new Float32Array(beadCount);
  for (let i = 0; i < beadCount; i++) {
    beadFibre[i] = Math.floor(rnd() * Math.max(1, fibres.length));
    beadPhase[i] = rnd();
    beadCycles[i] = (rnd() > 0.5 ? 1 : -1) * (1 + Math.floor(rnd() * 2));
    beadGain[i] = 0.4 + rnd() * 0.8;
  }

  const point: Point = { x: 0, y: 0, z: 0, travel: 0 };
  let f = 0;

  const fibreColour = (fibre: Fibre, t: number): Rgb => {
    if (fibre.isSpine) {
      return V2.fibreSpine;
    }
    const body = mixRgb(V2.fibreDeep, V2.fibreBody, fibre.tone);
    const warmed = fibre.warmth > 0 ? mixRgb(body, V2.fibreWarm, fibre.warmth) : body;
    // The highlight is strongest partway along the fibre, as a specular
    // band would be.
    const spec = fibre.highlight * Math.exp(-Math.pow((t - 0.42) / 0.3, 2));
    return mixRgb(warmed, V2.fibreCore, spec);
  };

  const writeRibbon = (
    fibreIndex: number,
    _sampleIndex: number,
    t: number,
    out: Sample,
  ): void => {
    const fibre = fibres[fibreIndex];
    fibrePoint(sheets, fibre, t, f, point);

    out.x = point.x;
    out.y = point.y;
    out.z = point.z;
    out.width = BASE_WIDTH * fibre.widthScale;

    const colour = fibreColour(fibre, t);
    out.r = colour[0];
    out.g = colour[1];
    out.b = colour[2];

    const spec = fibre.highlight * Math.exp(-Math.pow((t - 0.42) / 0.3, 2));
    out.a =
      // Roots stay crisp; tips fade out into the dark.
      (1 - smoothstep(0.72, 1, t)) *
      sheets[fibre.sheet].brightness *
      fibre.dim *
      (fibre.isSpine ? 2.8 : 1) *
      (0.5 + 1.6 * spec) *
      0.42;
  };

  const writeBead = (index: number, out: Dot) => {
    const fibre = fibres[beadFibre[index]];
    if (!fibre) {
      out.brightness = 0;
      return;
    }

    let t = (beadPhase[index] + f * beadCycles[index]) % 1;
    if (t < 0) {
      t += 1;
    }

    fibrePoint(sheets, fibre, t, f, point);
    out.x = point.x;
    out.y = point.y;
    out.z = point.z;

    const colour = fibre.warmth > 0.5 ? V2.fibreWarm : V2.dotWhite;
    out.r = colour[0];
    out.g = colour[1];
    out.b = colour[2];
    out.brightness =
      sheets[fibre.sheet].brightness *
      beadGain[index] *
      (1 - smoothstep(0.7, 1, t));
  };

  const writeRoot = (index: number, out: Dot) => {
    const fibre = fibres[index];
    if (!fibre) {
      out.brightness = 0;
      return;
    }

    fibrePoint(sheets, fibre, 0.012, f, point);
    out.x = point.x;
    out.y = point.y;
    out.z = point.z;
    out.r = V2.dotCool[0];
    out.g = V2.dotCool[1];
    out.b = V2.dotCool[2];
    out.brightness = sheets[fibre.sheet].brightness * 1.35;
  };

  const writeGlow = (index: number, out: Dot) => {
    const fibre = fibres[index];
    if (!fibre || fibre.highlight <= 0.15) {
      out.brightness = 0;
      return;
    }

    fibrePoint(sheets, fibre, 0.42, f, point);
    out.x = point.x;
    out.y = point.y;
    out.z = point.z;
    out.r = V2.nodeFlare[0];
    out.g = V2.nodeFlare[1];
    out.b = V2.nodeFlare[2];
    const breath = 0.82 + 0.18 * Math.sin(TAU * f + fibre.phase);
    out.brightness =
      sheets[fibre.sheet].brightness * fibre.highlight * breath * 0.28;
  };

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
      beads.update(writeBead);
      roots.update(writeRoot);
      glow.update(writeGlow);
    },
    dispose: () => {
      ribbons.dispose();
      beads.dispose();
      roots.dispose();
      glow.dispose();
      beadTexture.dispose();
      flareTexture.dispose();
    },
  };
};
