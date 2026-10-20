// Rolling-ball overbalanced wheel (the classic design family: Jacopo Strada's
// and the Marquis of Worcester's wheels of the 16th–17th centuries are the
// best-known). The axle runs along world x; the wheel turns in the y–z plane.
export const ROLLING = {
  centre: [0, 0, 128] as [number, number, number],
  rimOuter: 82,
  rimInner: 75,
  hub: 19,
  channels: 8,
  ballRadius: 5.6,
  /** channel from the hub (r0) to the rim (r1), bending forward by `bend` degrees */
  r0: 20,
  r1: 74,
  bend: 55,
  wall: 2.4,
  /** web plate behind the channels, then the channel walls in front */
  web: [-6, -3.5] as [number, number],
  walls: [-3.5, 6] as [number, number],
  /** the ball rests on the web: its centre one radius in front of it */
  ballPlane: 2.1,
  trestleX: 34,
};

/** The channel centreline in wheel coordinates (flat, y down), hub to rim. */
export function channelPoints(steps = 96): [number, number][] {
  const out: [number, number][] = [];
  for (let i = 0; i <= steps; i++) {
    const w = i / steps;
    const r = ROLLING.r0 + (ROLLING.r1 - ROLLING.r0) * w;
    const g = (ROLLING.bend * (1 - Math.pow(1 - w, 2)) * Math.PI) / 180;
    out.push([r * Math.cos(g), r * Math.sin(g)]);
  }
  return out;
}
