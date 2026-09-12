/**
 * Shared GLSL prelude.
 *
 * `filamentWobble` is a slow organic drift added to every point of a
 * filament. It is compiled into *both* the ribbon shader and the
 * travelling-node shader, verbatim and with identical uniforms, so the
 * dots stay glued to the lines they ride — if the two ever disagreed the
 * nodes would visibly float off their tendrils.
 *
 * The amplitude is scaled by `along^2`, so filaments are pinned at the
 * core and only breathe near their tips.
 */
export const WOBBLE_GLSL = /* glsl */ `
uniform float uTime;
uniform float uWobble;

vec3 filamentWobble(float filamentId, float along) {
  float amp = uWobble * along * along;
  float a = uTime * 0.42 + filamentId * 1.73 + along * 4.1;
  float b = uTime * 0.33 + filamentId * 2.91 + along * 2.7;
  float c = uTime * 0.27 + filamentId * 0.87 + along * 3.3;
  return vec3(sin(a), sin(b), sin(c)) * amp;
}
`;
