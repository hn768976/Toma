// Shared key light, in world space: high, to the left, slightly toward camera.
//
// The band is shaded emissively rather than lit by scene lights, so this is
// just a direction every layer agrees on - the strands, the sheet and the
// glint on the specks all have to catch the light from the same place or the
// band stops reading as one object.

const normalise = (x: number, y: number, z: number) => {
  const l = Math.hypot(x, y, z);
  return [x / l, y / l, z / l] as const;
};

export const KEY_LIGHT = normalise(-0.44, 0.83, 0.34);
