// All units are metres. The corridor runs along -Z, camera starts at z = 0.

export const HALF_WIDTH = 2.65; // centre line to the rack fronts
export const CEILING_Y = 3.2;
export const RACK_TOP_Y = 2.98;
export const PLINTH_TOP_Y = 0.47;
export const GLASS_TOP_Y = 2.76;

export const CABINET_PITCH = 2.45;
export const PILLAR_WIDTH = 0.36;
export const GLASS_WIDTH = CABINET_PITCH - PILLAR_WIDTH;

// The far wall: three glass cabinets spanning the full corridor width.
export const END_WALL_Z = -21.55;
export const END_CABINETS = 3;

// Camera: eye height and lens matched to the reference perspective
// (horizon sits at the frame centre, far wall grows ~2.18x over the shot).
export const CAMERA_Y = 1.1;
export const CAMERA_FOV = 54;
export const CAMERA_START_Z = 0;
export const CAMERA_END_Z = -11.69;

// Side cabinets: from just behind the camera to the far wall.
export const FIRST_CABINET_Z = 3.2;
