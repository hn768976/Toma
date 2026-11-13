/** GLSL shared between the vertex and fragment stage of the hair shader */
export const NOISE = /* glsl */ `
  float hash13(vec3 p) {
    p = fract(p * 0.1031);
    p += dot(p, p.zyx + 31.32);
    return fract((p.x + p.y) * p.z);
  }
  float vnoise(vec3 p) {
    vec3 i = floor(p);
    vec3 f = fract(p);
    f = f * f * (3.0 - 2.0 * f);
    return mix(
      mix(mix(hash13(i), hash13(i + vec3(1, 0, 0)), f.x),
          mix(hash13(i + vec3(0, 1, 0)), hash13(i + vec3(1, 1, 0)), f.x), f.y),
      mix(mix(hash13(i + vec3(0, 0, 1)), hash13(i + vec3(1, 0, 1)), f.x),
          mix(hash13(i + vec3(0, 1, 1)), hash13(i + vec3(1, 1, 1)), f.x), f.y),
      f.z);
  }
`;

export const HAIR_COMMON = /* glsl */ `
  ${NOISE}

  uniform float uRepairFront;
  uniform float uContactS;

  // Height field of the lifted, damaged cuticle scales (0..1)
  // s: distance along the strand, a: angle around it
  float cuticleHeight(float s, float a) {
    vec2 ring = vec2(cos(a), sin(a));
    float n1 = vnoise(vec3(ring * 1.5, s * 0.4));
    float n2 = vnoise(vec3(ring * 4.2 + 7.0, s * 1.6 + 3.0));
    float v = s * 1.6 + n1 * 1.55 + n2 * 0.7;
    float f = fract(v);
    // each scale ramps up, then drops off sharply at its lifted edge
    float h = f * f * smoothstep(1.0, 0.86, f);
    h *= 0.55 + 0.75 * n2;
    h += 0.14 * vnoise(vec3(ring * 11.0, s * 6.0));
    return h;
  }

  // Signed distance (along the strand) to the wavy repair front; < 0 = repaired
  float repairDistance(float s, float a) {
    vec2 ring = vec2(cos(a), sin(a));
    float wobble = (vnoise(vec3(ring * 1.3 + 2.0, s * 0.35 + uRepairFront * 0.6)) - 0.5) * 1.1
                 + 0.16 * sin(a * 3.0 + s * 1.7);
    return abs(s - uContactS) - (uRepairFront + wobble * smoothstep(0.0, 1.2, uRepairFront));
  }

  float repairMask(float s, float a) {
    if (uRepairFront <= 0.0) return 0.0;
    return 1.0 - smoothstep(-0.32, 0.03, repairDistance(s, a));
  }
`;
