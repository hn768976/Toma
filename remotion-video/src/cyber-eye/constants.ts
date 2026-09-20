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
export const HUD_RADIUS = 0.27;
// The lids fade into the background between these heights (brow ridge).
export const BROW_FADE_BOTTOM = 0.14;
export const BROW_FADE_TOP = 0.36;

// Camera: distance chosen so the HUD disc is ~52% of the frame height and the
// shaded eyeball and lids frame it.
export const CAMERA = {
  fov: 30,
  distance: 1.82,
  near: 0.05,
  far: 20,
};

/** Radius of the HUD disc in pixels for a given frame height (used by the SVG overlay). */
export const hudDiscRadiusPx = (frameHeight: number) => {
  const visibleHeight =
    2 * (CAMERA.distance - HUD_Z) * Math.tan((CAMERA.fov / 2) * (Math.PI / 180));
  return (HUD_RADIUS / visibleHeight) * frameHeight;
};
