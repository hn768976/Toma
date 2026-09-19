/**
 * Shared constants for the container-yard shots.
 *
 * Everything downstream works in metres. The supplied mesh is authored at an
 * arbitrary scale with a bounding box of 0.7889 x 0.8066 x 1.9032, so a single
 * uniform factor maps it onto a real ISO 20ft container (6.058m long). That
 * lands the width and height within ~3% of spec, which is well inside what the
 * reference footage shows.
 */

export const FPS = 30;

export const HD_WIDTH = 1920;
export const HD_HEIGHT = 1080;
export const UHD_WIDTH = 3840;
export const UHD_HEIGHT = 2160;

/** Uniform scale that turns the supplied mesh into a 6.058m ISO container. */
export const MESH_SCALE = 3.1831;

/** Container dimensions in metres, derived from the mesh bounds x MESH_SCALE. */
export const BOX_LENGTH = 6.058; // along local Z
export const BOX_WIDTH = 2.511; // along local X
export const BOX_HEIGHT = 2.567; // along local Y

/** Stacking pitch. Real stacks sit corner-casting to corner-casting. */
export const STACK_PITCH_Y = BOX_HEIGHT + 0.03;
/** Lateral pitch when containers are parked side by side across their width. */
export const ROW_PITCH_X = BOX_WIDTH + 0.09;
/** Pitch along the length when containers sit end to end. */
export const ROW_PITCH_Z = BOX_LENGTH + 0.14;

export type VersionId = "v1" | "v2" | "v3" | "v4" | "v5" | "v6";

export type VersionSpec = {
  id: VersionId;
  /** Composition id stem, e.g. "Yard01DockWall". */
  name: string;
  /** Duration in frames at 30fps, matched to the reference clip. */
  durationInFrames: number;
  /** Reference clip this shot recreates, for traceability. */
  reference: string;
  /** Seconds, as measured from the reference. */
  seconds: number;
  description: string;
};

export const VERSIONS: VersionSpec[] = [
  {
    id: "v1",
    name: "Yard01DockWall",
    durationInFrames: 600,
    seconds: 20.0,
    reference: "istockphoto-1162584442",
    description:
      "Low lateral dolly along a wall of container doors, open sky above, saturated livery.",
  },
  {
    id: "v2",
    name: "Yard02GoldenTruck",
    durationInFrames: 300,
    seconds: 10.0,
    reference: "istockphoto-1345063988",
    description:
      "Tight golden-hour truck past weathered stacks, frame filled edge to edge.",
  },
  {
    id: "v3",
    name: "Yard03GridWall",
    durationInFrames: 300,
    seconds: 10.0,
    reference: "istockphoto-1345063252",
    description:
      "Flat-on grid of container doors filling frame, slow diagonal drift.",
  },
  {
    id: "v4",
    name: "Yard04AerialRows",
    durationInFrames: 300,
    seconds: 10.0,
    reference: "istockphoto-1345063383",
    description: "High-angle push over yard rows with gaps between the blocks.",
  },
  {
    id: "v5",
    name: "Yard05TwinStacks",
    durationInFrames: 300,
    seconds: 10.0,
    reference: "istockphoto-2217367108",
    description:
      "Wide two-block composition with open sky, slow crane and drift.",
  },
  {
    id: "v6",
    name: "Yard06CornerDusk",
    durationInFrames: 399,
    seconds: 13.3,
    reference: "istockphoto-2260573766",
    description:
      "Very tight dusk push around the corner of a stack, sky in the upper corner.",
  },
];

export const versionById = (id: VersionId): VersionSpec => {
  const found = VERSIONS.find((v) => v.id === id);
  if (!found) throw new Error(`Unknown version: ${id}`);
  return found;
};
