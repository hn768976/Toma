/**
 * Six shots, one per supplied reference clip.
 *
 * Every reference was measured with ffprobe and its duration carried over
 * exactly; the two 25fps references are retimed to 30fps at the same wall
 * clock length, which is why their frame counts are round numbers.
 */

export const FPS = 30;

export type ShotId =
  | "container-ascent"
  | "container-wall"
  | "container-canyon"
  | "cloud-cruise"
  | "overhead-silhouette"
  | "airport-sign";

export type ShotSpec = {
  readonly id: ShotId;
  /** Composition id suffix and human-facing name. */
  readonly title: string;
  /** Frames at 30fps. */
  readonly durationInFrames: number;
  /** The reference this shot recreates, for the README and the studio sidebar. */
  readonly reference: string;
  /** Reference duration in seconds, before retiming. */
  readonly referenceSeconds: number;
  readonly referenceFps: number;
};

export const SHOTS: readonly ShotSpec[] = [
  {
    id: "container-ascent",
    title: "Container Ascent",
    durationInFrames: 251,
    reference: "istockphoto-2195724474",
    referenceSeconds: 8.375,
    referenceFps: 29.97,
  },
  {
    id: "container-wall",
    title: "Container Wall",
    durationInFrames: 360,
    reference: "istockphoto-2194384866",
    referenceSeconds: 12.012,
    referenceFps: 29.97,
  },
  {
    id: "container-canyon",
    title: "Container Canyon",
    durationInFrames: 301,
    reference: "istockphoto-2194385790",
    referenceSeconds: 10.043,
    referenceFps: 29.97,
  },
  {
    id: "cloud-cruise",
    title: "Cloud Cruise",
    durationInFrames: 151,
    reference: "shutterstock-4179374583",
    referenceSeconds: 5.033,
    referenceFps: 30,
  },
  {
    id: "overhead-silhouette",
    title: "Overhead Silhouette",
    durationInFrames: 216,
    reference: "shutterstock-3390729315",
    referenceSeconds: 7.2,
    referenceFps: 25,
  },
  {
    id: "airport-sign",
    title: "Airport Sign",
    durationInFrames: 270,
    reference: "shutterstock-4036720581",
    referenceSeconds: 9,
    referenceFps: 25,
  },
];

export const RESOLUTIONS = {
  "1080p": { width: 1920, height: 1080 },
  "4k": { width: 3840, height: 2160 },
} as const;

export type ResolutionKey = keyof typeof RESOLUTIONS;

/**
 * Raymarch step counts and render-target scale are the only real cost knobs in
 * the cloud pass, so they key off the delivery resolution: 4K gets a denser
 * march because the extra pixels show the banding a coarse one leaves behind.
 *
 * The counts are low for a cloud march because the march is unrolled into the
 * shader rather than looped (see `post/clouds.ts`), so each step has a direct
 * cost in shader size as well as in time. Per-pixel jitter on the start offset
 * is what makes them hold up: it converts the banding a short march would
 * otherwise show into fine noise, which the half-resolution upscale then
 * smooths away.
 */
export type QualityProfile = {
  readonly cloudSteps: number;
  readonly cloudLightSteps: number;
  /** Cloud pass resolution as a fraction of the output. */
  readonly cloudScale: number;
  readonly anisotropy: number;
  readonly shadowMapSize: number;
};

export const QUALITY: Record<ResolutionKey, QualityProfile> = {
  "1080p": { cloudSteps: 24, cloudLightSteps: 2, cloudScale: 0.5, anisotropy: 4, shadowMapSize: 2048 },
  "4k": { cloudSteps: 30, cloudLightSteps: 3, cloudScale: 0.5, anisotropy: 8, shadowMapSize: 4096 },
};

/** Model scale factors that put both GLBs into metres. */
export const SCALE = {
  /** 1.903 model units long -> 6.058 m, a real ISO 20ft container. */
  container: 6.058 / 1.903,
  /** 1.900 model units of span -> 60.3 m, an A330-200-sized widebody. */
  jet: 60.3 / 1.8997,
} as const;

/** The airport named on the shot 6 direction sign. */
export const AIRPORT_NAME = "Paris";
export const AIRPORT_SUBTITLE = "International Airport";
