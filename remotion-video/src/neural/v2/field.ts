/**
 * Layout for V2, "Loopable isometric branching neural network".
 *
 * Where V1 scatters bundles through open space, V2 stacks them: each bundle
 * lies flat in its own horizontal plane, and the planes are stepped in height
 * and depth so the camera -- looking down at a shallow angle -- reads them as
 * the layers of a network seen isometrically.
 *
 * Everything animated here is periodic over exactly `V2_DURATION_IN_FRAMES`,
 * so the last frame hands back to the first with no seam.
 */

import { mulberry32 } from "../core/noise";

export const V2_FPS = 30;
export const V2_DURATION_IN_FRAMES = 240;
export const TAU = Math.PI * 2;

export type BandId = 0 | 1 | 2;
export const BANDS: readonly BandId[] = [0, 1, 2];

export type Layer = {
  /** Pinch point, where the strands converge. */
  x: number;
  y: number;
  z: number;
  /** Heading of the layer's axis within its horizontal plane. */
  angle: number;
  band: BandId;
  length: number;
  spread: number;
  /** How tightly the incoming side of the bundle is gathered. */
  tightBias: number;
  /**
   * How much shorter the outermost strand is than the innermost. A linear
   * ramp makes the strand tips line up along a straight edge, which is the
   * stepped silhouette the reference shows along the top of each fan.
   */
  edgeSlope: number;
  /** Pulls the wide end of the fan backwards, curling it like a feather. */
  curl: number;
  strandCount: number;
  brightness: number;
  seed: number;
  strandOffset: number;
};

export type Strand = {
  layer: number;
  branch: number;
  withinBranch: number;
  branchWidth: number;
  /** -1..1 across the fan; drives the tip edge and the depth offset. */
  radial: number;
  yJitter: number;
  widthScale: number;
  tone: number;
  /** 0 = ordinary cool strand, 1 = warm minority strand. */
  warmth: number;
  /** The single bright mint strand riding the top of a bundle. */
  isSpine: boolean;
  phase: number;
  dim: number;
};

export type BandData = {
  band: BandId;
  layers: Layer[];
  strands: Strand[];
};

/**
 * Layers are stacked mostly in depth rather than in height: seen from above,
 * a plane further away already sits higher in frame, so only a small vertical
 * step is needed to keep them from overlapping.
 */
const LAYER_SPECS: { band: BandId; y: number; z: number; scale: number }[] = [
  // Nearest to camera, heavily defocused.
  { band: 2, y: -2.3, z: 6.5, scale: 1.15 },
  // The two layers the shot is focused on.
  { band: 1, y: -0.8, z: 1.5, scale: 1.0 },
  { band: 1, y: 0.6, z: -3.5, scale: 0.95 },
  // Receding into the haze.
  { band: 0, y: 2.0, z: -8.5, scale: 0.9 },
  { band: 0, y: 3.4, z: -13.5, scale: 0.85 },
];

export const buildV2Field = (): Record<BandId, BandData> => {
  const rnd = mulberry32(0x5eed02);

  const layers: Layer[] = LAYER_SPECS.map((spec, i) => ({
    // The pinch sits right of centre, leaving the dark open space on the
    // right that the reference composition relies on.
    x: 1.5 + (rnd() - 0.5) * 3.0,
    y: spec.y,
    z: spec.z,
    angle: -0.22 + (rnd() - 0.5) * 0.3,
    band: spec.band,
    // Kept close to the fan's own width: the reference fans are broad, not
    // long, and a longer axis just runs them off both edges of frame.
    length: (11 + rnd() * 2.5) * spec.scale,
    spread: (13 + rnd() * 3) * spec.scale,
    tightBias: 0.12 + rnd() * 0.12,
    edgeSlope: 0.38 + rnd() * 0.22,
    curl: 0.4 + rnd() * 0.3,
    strandCount: 26 + Math.floor(rnd() * 14),
    brightness: spec.band === 1 ? 1 : spec.band === 0 ? 0.64 : 0.42,
    seed: i * 977,
    strandOffset: 0,
  }));

  const result = {} as Record<BandId, BandData>;

  for (const band of BANDS) {
    const bandLayers = layers.filter((l) => l.band === band);
    const strands: Strand[] = [];

    for (let li = 0; li < bandLayers.length; li++) {
      const layer = bandLayers[li];
      layer.strandOffset = strands.length;

      const branchCount = 4 + Math.floor(rnd() * 3);
      const branchCentre: number[] = [];
      const branchWidth: number[] = [];
      for (let k = 0; k < branchCount; k++) {
        branchCentre.push(
          (k / Math.max(1, branchCount - 1)) * 2 - 1 + (rnd() - 0.5) * 0.26,
        );
        branchWidth.push(0.16 + rnd() * 0.26);
      }

      for (let s = 0; s < layer.strandCount; s++) {
        const k = Math.floor((s / layer.strandCount) * branchCount);
        const inBranch = layer.strandCount / branchCount;
        const local = ((s % inBranch) / Math.max(1, inBranch - 1)) * 2 - 1;
        const radial = (s / (layer.strandCount - 1)) * 2 - 1;

        strands.push({
          layer: li,
          branch: branchCentre[k] + (rnd() - 0.5) * 0.07,
          withinBranch: local + (rnd() - 0.5) * 0.22,
          branchWidth: branchWidth[k],
          radial,
          yJitter: (rnd() - 0.5) * 2,
          widthScale: 0.75 + rnd() * 0.7,
          tone: Math.pow(rnd(), 1.6),
          // A thin red-orange minority, as in the reference.
          warmth: rnd() < 0.09 ? 0.7 + rnd() * 0.3 : 0,
          // One mint strand rides the top edge of each bundle.
          isSpine: s === layer.strandCount - 2,
          phase: rnd() * TAU,
          dim: 0.55 + rnd() * 0.6,
        });
      }
    }

    result[band] = { band, layers: bandLayers, strands };
  }

  return result;
};

/** Camera pose at a given frame. Periodic, so the clip loops. */
export const v2Camera = (frame: number) => {
  const f = frame / V2_DURATION_IN_FRAMES;
  // Roughly 35 degrees above the layer planes: steep enough to read as
  // isometric, shallow enough that the fans still stretch across frame.
  return {
    x: 8 + Math.sin(TAU * f) * 0.95,
    y: 12.5 + Math.sin(TAU * f + 1.2) * 0.5,
    z: 17 + Math.cos(TAU * f) * 0.8,
    lookX: 0.2 + Math.sin(TAU * f + 2.1) * 0.5,
    lookY: Math.cos(TAU * f * 2) * 0.22,
    lookZ: -3,
  };
};
