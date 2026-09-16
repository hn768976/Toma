/** Geometry, stack and camera layout — shared by both themes. */
export type Layout = {
  /** Half the edge length of each square slab. */
  plateHalf: number;
  cornerRadius: number;
  plateDepth: number;
  bevel: number;

  /** Gap between consecutive slabs along the stack axis. */
  stepZ: number;
  /** Twist added per slab, in degrees — this is what fans the stack out. */
  twistDeg: number;
  /** Slabs in front of / behind the visible range, so the loop never pops. */
  platesBehindCamera: number;
  platesInFront: number;

  cameraFov: number;
  cameraPosition: [number, number, number];
  cameraTarget: [number, number, number];

  /**
   * Quarter turns of the whole stack per loop. The slab is square, so any
   * whole number of quarter turns lands back on an identical frame.
   */
  quarterTurnsPerLoop: number;

  /** Direction the seam light comes from, as a world-space XY angle (deg). */
  lightAzimuthDeg: number;
  /** Direction of the soft key that shapes the faces. */
  keyDirection: [number, number, number];
};

export const defaultLayout: Layout = {
  // The slab is far wider than the frame, so its edges always run off-screen
  // and the corner is the only part of the outline the camera ever sees whole.
  plateHalf: 28,
  cornerRadius: 7,
  plateDepth: 0.85,
  bevel: 0.2,

  stepZ: 0.95,
  twistDeg: 4.2,
  platesBehindCamera: 2,
  platesInFront: 44,

  // Looking down at the stack from just outside one corner, at a shallow
  // enough angle that the walls read as bands rather than faces.
  cameraFov: 36,
  cameraPosition: [35.09, 35.09, 16.71],
  cameraTarget: [21, 21, 0],

  quarterTurnsPerLoop: 1,

  lightAzimuthDeg: 135,
  keyDirection: [-0.35, 0.8, 0.5],
};
