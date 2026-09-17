/**
 * Gradient noise with ANALYTIC derivatives (after Inigo Quilez).
 *
 * `noised(p)` returns vec4(value, d/dx, d/dy, d/dz). The derivatives let the
 * flag's surface normal be computed in closed form from the displacement
 * function rather than sampled from a texture — texture-derived normals
 * stair-step and show up as banded shading across the folds.
 *
 * `pnoise3` / `pfbm` are the PERIODIC variants used by the sky. Wrapping the
 * lattice index means the field repeats exactly every `period` units, so the
 * clouds can drift by exactly one period over the loop and land back where
 * they started.
 */
export const NOISE_GLSL = /* glsl */ `
vec3 wf_hash33(vec3 p) {
  p = fract(p * vec3(0.1031, 0.1030, 0.0973));
  p += dot(p, p.yxz + 33.33);
  return -1.0 + 2.0 * fract((p.xxy + p.yxx) * p.zyx);
}

// value, and the three partial derivatives
vec4 wf_noised(vec3 x) {
  vec3 p = floor(x);
  vec3 w = fract(x);
  vec3 u = w * w * w * (w * (w * 6.0 - 15.0) + 10.0);
  vec3 du = 30.0 * w * w * (w * (w - 2.0) + 1.0);

  vec3 ga = wf_hash33(p + vec3(0.0, 0.0, 0.0));
  vec3 gb = wf_hash33(p + vec3(1.0, 0.0, 0.0));
  vec3 gc = wf_hash33(p + vec3(0.0, 1.0, 0.0));
  vec3 gd = wf_hash33(p + vec3(1.0, 1.0, 0.0));
  vec3 ge = wf_hash33(p + vec3(0.0, 0.0, 1.0));
  vec3 gf = wf_hash33(p + vec3(1.0, 0.0, 1.0));
  vec3 gg = wf_hash33(p + vec3(0.0, 1.0, 1.0));
  vec3 gh = wf_hash33(p + vec3(1.0, 1.0, 1.0));

  float va = dot(ga, w - vec3(0.0, 0.0, 0.0));
  float vb = dot(gb, w - vec3(1.0, 0.0, 0.0));
  float vc = dot(gc, w - vec3(0.0, 1.0, 0.0));
  float vd = dot(gd, w - vec3(1.0, 1.0, 0.0));
  float ve = dot(ge, w - vec3(0.0, 0.0, 1.0));
  float vf = dot(gf, w - vec3(1.0, 0.0, 1.0));
  float vg = dot(gg, w - vec3(0.0, 1.0, 1.0));
  float vh = dot(gh, w - vec3(1.0, 1.0, 1.0));

  float v = va
    + u.x * (vb - va) + u.y * (vc - va) + u.z * (ve - va)
    + u.x * u.y * (va - vb - vc + vd)
    + u.y * u.z * (va - vc - ve + vg)
    + u.z * u.x * (va - vb - ve + vf)
    + u.x * u.y * u.z * (-va + vb + vc - vd + ve - vf - vg + vh);

  vec3 d = ga
    + u.x * (gb - ga) + u.y * (gc - ga) + u.z * (ge - ga)
    + u.x * u.y * (ga - gb - gc + gd)
    + u.y * u.z * (ga - gc - ge + gg)
    + u.z * u.x * (ga - gb - ge + gf)
    + u.x * u.y * u.z * (-ga + gb + gc - gd + ge - gf - gg + gh)
    + du * (
        vec3(vb - va, vc - va, ve - va)
        + u.yzx * vec3(va - vb - vc + vd, va - vc - ve + vg, va - vb - ve + vf)
        + u.zxy * vec3(va - vb - ve + vf, va - vb - vc + vd, va - vc - ve + vg)
        + u.yzx * u.zxy * (-va + vb + vc - vd + ve - vf - vg + vh)
      );

  return vec4(v, d);
}
`;

/** Periodic gradient noise + fbm — used by the sky so the clouds loop exactly. */
export const PERIODIC_NOISE_GLSL = /* glsl */ `
vec3 wf_hash33p(vec3 p, vec3 period) {
  p = mod(p, max(period, vec3(1.0)));
  p = fract(p * vec3(0.1031, 0.1030, 0.0973));
  p += dot(p, p.yxz + 33.33);
  return -1.0 + 2.0 * fract((p.xxy + p.yxx) * p.zyx);
}

float wf_pnoise3(vec3 x, vec3 period) {
  vec3 p = floor(x);
  vec3 w = fract(x);
  vec3 u = w * w * w * (w * (w * 6.0 - 15.0) + 10.0);

  float va = dot(wf_hash33p(p + vec3(0.0, 0.0, 0.0), period), w - vec3(0.0, 0.0, 0.0));
  float vb = dot(wf_hash33p(p + vec3(1.0, 0.0, 0.0), period), w - vec3(1.0, 0.0, 0.0));
  float vc = dot(wf_hash33p(p + vec3(0.0, 1.0, 0.0), period), w - vec3(0.0, 1.0, 0.0));
  float vd = dot(wf_hash33p(p + vec3(1.0, 1.0, 0.0), period), w - vec3(1.0, 1.0, 0.0));
  float ve = dot(wf_hash33p(p + vec3(0.0, 0.0, 1.0), period), w - vec3(0.0, 0.0, 1.0));
  float vf = dot(wf_hash33p(p + vec3(1.0, 0.0, 1.0), period), w - vec3(1.0, 0.0, 1.0));
  float vg = dot(wf_hash33p(p + vec3(0.0, 1.0, 1.0), period), w - vec3(0.0, 1.0, 1.0));
  float vh = dot(wf_hash33p(p + vec3(1.0, 1.0, 1.0), period), w - vec3(1.0, 1.0, 1.0));

  return va
    + u.x * (vb - va) + u.y * (vc - va) + u.z * (ve - va)
    + u.x * u.y * (va - vb - vc + vd)
    + u.y * u.z * (va - vc - ve + vg)
    + u.z * u.x * (va - vb - ve + vf)
    + u.x * u.y * u.z * (-va + vb + vc - vd + ve - vf - vg + vh);
}

float wf_pfbm(vec3 x, vec3 period, int octaves) {
  float sum = 0.0;
  float amp = 0.5;
  float freq = 1.0;
  for (int i = 0; i < 6; i++) {
    if (i >= octaves) break;
    sum += amp * wf_pnoise3(x * freq, period * freq);
    freq *= 2.0;
    amp *= 0.5;
  }
  return sum;
}
`;
