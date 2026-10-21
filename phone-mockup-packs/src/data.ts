import packsJson from "../data/packs.json";

export type BackgroundId = "white" | "black" | "graphite" | "green";

export type Segment = {
  move: string;
  start: number;
  length: number;
  phones: number;
  params?: Record<string, number>;
};

export type Pack = {
  id: string;
  reference: string;
  background: BackgroundId;
  durationInFrames: number;
  segments: Segment[];
};

type PacksFile = {
  fps: number;
  width: number;
  height: number;
  packs: Pack[];
};

export const PACKS_FILE = packsJson as PacksFile;
export const PACKS = PACKS_FILE.packs;

const BACKGROUNDS: BackgroundId[] = ["white", "black", "graphite", "green"];

// Fails loudly in the Studio and at render time if the data was edited into
// an inconsistent state (gaps, overlaps, wrong totals, unknown background).
export const validatePack = (pack: Pack, knownMoves: string[]): void => {
  if (!BACKGROUNDS.includes(pack.background)) {
    throw new Error(
      `${pack.id}: unknown background "${pack.background}" (use ${BACKGROUNDS.join(", ")})`,
    );
  }
  let cursor = 0;
  for (const seg of pack.segments) {
    if (seg.start !== cursor) {
      throw new Error(
        `${pack.id}: segment "${seg.move}" starts at ${seg.start}, expected ${cursor} (gap or overlap). Run "npm run retime" to recompute starts.`,
      );
    }
    if (!knownMoves.includes(seg.move)) {
      throw new Error(`${pack.id}: unknown move "${seg.move}"`);
    }
    cursor += seg.length;
  }
  if (cursor !== pack.durationInFrames) {
    throw new Error(
      `${pack.id}: segments add up to ${cursor} frames, but durationInFrames is ${pack.durationInFrames}`,
    );
  }
};

// Remotion composition IDs may not contain "_", so PhonePack_White renders as
// composition "PhonePack-White" (the output file keeps the underscore name).
export const compositionId = (packId: string) => packId.replace(/_/g, "-");

export const findSegment = (pack: Pack, frame: number): Segment => {
  for (const seg of pack.segments) {
    if (frame >= seg.start && frame < seg.start + seg.length) {
      return seg;
    }
  }
  return pack.segments[pack.segments.length - 1];
};
