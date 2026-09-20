// Timing and sizing for the "Cyber Eye" HUD compositions.
//
// The four references are 12.05 s clips at 29.97 fps (361 frames). We render
// at an even 30 fps with the same frame count, which gives 12.03 s.
export const FPS = 30;
export const DURATION_IN_FRAMES = 361;

export const WIDTH_4K = 3840;
export const HEIGHT_4K = 2160;
export const WIDTH_HD = 1920;
export const HEIGHT_HD = 1080;

// Measurements of public/models/eye.glb in model units. The model was
// re-centred so the pupil hole sits at the origin (see tools/clean-model.py).
export const MODEL = {
  url: "models/eye.glb",
  pupilRadius: 0.082,
  irisSurfaceZ: -0.12,
  width: 1.84,
  height: 0.81,
};

// The HUD ring system floats just in front of the sculpted iris.
export const HUD_Z = -0.09;
export const HUD_RADIUS = 0.26;

// Camera: distance chosen so the HUD disc is ~54% of the frame height, like
// the references, and the eyelids run off both sides of the frame.
export const CAMERA = {
  fov: 30,
  distance: 1.72,
  near: 0.05,
  far: 20,
};
