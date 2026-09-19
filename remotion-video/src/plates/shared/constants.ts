// Shared spec for the four abstract light-texture plates.
//
// Each plate recreates one supplied stock reference procedurally: same
// palette, bokeh scale, density and motion feel, generated in a fragment
// shader rather than filmed. Every plate is a SEAMLESS LOOP - all motion
// is built from terms that are periodic over `durationInFrames`, so the
// last frame flows back into the first.

export const PLATE_FPS = 30;

// Delivery resolutions. 1080p is what gets rendered to MP4; the 4K
// composition is registered alongside it so the project can be rendered
// at 2160p on a machine with a real GPU.
export const HD_WIDTH = 1920;
export const HD_HEIGHT = 1080;
export const UHD_WIDTH = 3840;
export const UHD_HEIGHT = 2160;

export type PlateId =
  | "GoldenRays"
  | "SilverBokeh"
  | "DeepBlueDust"
  | "BokehCurtain";

export type PlateSpec = {
  id: PlateId;
  /** Human-readable summary, shown in the Studio sidebar tooltip. */
  description: string;
  /** Length at 30fps, matched to the corresponding reference clip. */
  durationInFrames: number;
  /** Source clip this plate was matched against, for provenance. */
  reference: { file: string; seconds: number; fps: number };
};

// Reference durations converted to whole frames at 30fps:
//   bd91a4b1  14.014s @ 23.976 -> 420 frames (14.000s)
//   f6f0d1b3  18.986s @ 29.970 -> 570 frames (19.000s)
//   5d412a9b  13.013s @ 29.970 -> 390 frames (13.000s)
//   97b80acb  10.000s @ 30.000 -> 300 frames (10.000s)
export const PLATE_SPECS: Record<PlateId, PlateSpec> = {
  GoldenRays: {
    id: "GoldenRays",
    description:
      "Warm sun through foliage - blown-out gold core, crepuscular shafts, soft amber bokeh over olive greens.",
    durationInFrames: 420,
    reference: {
      file: "bd91a4b1-istockphoto-1164612548",
      seconds: 14.014,
      fps: 23.976,
    },
  },
  SilverBokeh: {
    id: "SilverBokeh",
    description:
      "High-key silver bokeh - dense overlapping white discs on a near-white field, very low contrast.",
    durationInFrames: 570,
    reference: {
      file: "f6f0d1b3-istockphoto-1302304170",
      seconds: 18.986,
      fps: 29.97,
    },
  },
  DeepBlueDust: {
    id: "DeepBlueDust",
    description:
      "Deep navy particle field - ringed blue bokeh and fine twinkling dust, heavy vignette, light massed to the right.",
    durationInFrames: 390,
    reference: {
      file: "5d412a9b-istockphoto-2173944616",
      seconds: 13.013,
      fps: 29.97,
    },
  },
  BokehCurtain: {
    id: "BokehCurtain",
    description:
      "Defocused string-light curtain - vertical strands of amber and steel-blue discs with layered parallax.",
    durationInFrames: 300,
    reference: {
      file: "97b80acb-istockphoto-2158380992",
      seconds: 10.0,
      fps: 30.0,
    },
  },
};

export const PLATE_ORDER: PlateId[] = [
  "GoldenRays",
  "SilverBokeh",
  "DeepBlueDust",
  "BokehCurtain",
];
