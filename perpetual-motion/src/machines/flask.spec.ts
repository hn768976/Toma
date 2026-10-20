// Boyle's self-flowing flask (Robert Boyle, 17th century): a glass bowl whose
// long, narrowing neck leaves the bottom, climbs beside it, bends over the
// mouth and returns into the bowl, the claim being that the water climbs the
// neck by itself and drips back for ever. World units are centimetres.
import { catmull, lengths, type V3 } from "../lib/curve.ts";

export const FLASK = {
  /** the bowl: a sphere cut at the shoulder, then a short neck to the mouth */
  centre: [0, 0, 66] as V3,
  radius: 30,
  glass: 0.9,
  shoulder: 84,
  mouth: 94,
  mouthRadius: 22.5,
  lip: 2.2,
  water: 76,
  tubeOuter: 3.1,
  tubeInner: 1.9,
  ringZ: 51,
  spout: [11, 0, 87] as V3,
};

/** the neck's centreline from the bowl's bottom to the spout */
const CONTROL: V3[] = [
  [0, 0, 36],
  [0, 0, 30],
  [8, 0, 24.5],
  [26, 0, 23],
  [40, 0, 25],
  [47, 0, 33],
  [48.5, 0, 52],
  [48.5, 0, 82],
  [47, 0, 104],
  [39, 0, 118],
  [26, 0, 121],
  [15, 0, 113],
  [11.5, 0, 100],
  FLASK.spout,
];

export const NECK: V3[] = catmull(CONTROL, 16);
export const NECK_S = lengths(NECK);
