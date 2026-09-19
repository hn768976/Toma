import { z } from "zod";
import { DUST_FRAG } from "./shaders/dust";
import { RAIN_FRAG } from "./shaders/rain";
import { SMOKE_FRAG } from "./shaders/smoke";
import { SNOW_FRAG } from "./shaders/snow";

/** Every plate is delivered at 30fps. */
export const PLATE_FPS = 30;

/** Mastering resolution. Deliverables are rendered from the 1080p siblings. */
export const UHD_WIDTH = 3840;
export const UHD_HEIGHT = 2160;
export const HD_WIDTH = 1920;
export const HD_HEIGHT = 1080;

export const plateSchema = z.object({
  density: z.number().min(0).max(3),
  brightness: z.number().min(0).max(4),
  seed: z.number().min(0).max(1000),
  speed: z.number().min(0.05).max(4),
});

export type PlateProps = z.infer<typeof plateSchema>;

export type PlateDefinition = {
  /** Composition id stem; the registered ids are `${id}4K` and `${id}1080`. */
  id: string;
  label: string;
  fragment: string;
  /**
   * Length in frames at 30fps, matched to the corresponding reference clip.
   * Because the loop closes on the composition boundary, frame `durationInFrames`
   * would be identical to frame 0 - so the plate can be looped end to end.
   */
  durationInFrames: number;
  /** Source reference this plate was matched against, for the record. */
  reference: string;
  defaults: PlateProps;
};

export const PLATES: PlateDefinition[] = [
  {
    id: "DustMotes",
    label: "Dust motes",
    fragment: DUST_FRAG,
    // reference 14.48s -> 435 frames = 14.500s
    durationInFrames: 435,
    reference: "istockphoto-2008506475 (14.48s @ 29.97fps)",
    defaults: { density: 1, brightness: 1, seed: 17, speed: 1 },
  },
  {
    id: "Rain",
    label: "Rain",
    fragment: RAIN_FRAG,
    // reference 20.02s -> 600 frames = 20.000s
    durationInFrames: 600,
    reference: "istockphoto-2212768742 (20.02s @ 29.97fps)",
    defaults: { density: 1, brightness: 1, seed: 43, speed: 1 },
  },
  {
    id: "Smoke",
    label: "Smoke / fog",
    fragment: SMOKE_FRAG,
    // reference 22.28s -> 668 frames = 22.267s
    durationInFrames: 668,
    reference: "istockphoto-2230909784 (22.28s @ 25fps)",
    // speed 3: the reference-matched rate read as too slow. Verified clean -
    // the cross-dissolve loop stays exact at any speed, and adjacent-frame
    // motion at mid-loop measures 0.99x the rate at the loop ends, so there is
    // no dissolve artifact.
    defaults: { density: 1, brightness: 1, seed: 71, speed: 3 },
  },
  {
    id: "Snow",
    label: "Driving snow",
    fragment: SNOW_FRAG,
    // reference 29.11s -> 873 frames = 29.100s
    durationInFrames: 873,
    reference: "istockphoto-2247911326 (29.11s @ 23.98fps)",
    defaults: { density: 1, brightness: 1, seed: 5, speed: 1 },
  },
];
