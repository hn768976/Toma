import { GLSL_COMMON } from "./common";

/**
 * Composition 2: bright, shallow water seen from below. The rippling underside
 * of the surface fills the top of frame in perspective, the sun burns through
 * it top-left of centre, and shimmering rays fan down towards a hazy, lit
 * seabed. The bottom-right corner falls off into deep blue.
 *
 * All colours are uniforms so alternative grades can reuse the same scene.
 */
export const SURFACE_RAYS_FRAG = /* glsl */ `#version 300 es
precision highp float;

uniform vec2 uResolution;
uniform float uTime;

uniform vec2 uSunPos;       // sun hotspot in uv (0..1, y up)

uniform vec3 uColTop;       // water just below the surface
uniform vec3 uColMid;       // water body
uniform vec3 uColLow;       // water near the bottom
uniform vec3 uColShadow;    // dark falloff (bottom right)
uniform vec3 uColSeabed;    // lit haze over the seabed
uniform vec3 uColSurface;   // lit wave crests on the surface underside
uniform vec3 uColRay;       // light shafts
uniform vec3 uColSun;       // sun core

out vec4 outColor;

${GLSL_COMMON}

// Height field of the surface, animated. Two wave trains plus detail.
float waveHeight(vec2 x, float t) {
  float h = 0.0;
  h += fbm(x + vec2(t * 0.45, t * 0.16), 4);
  h += 0.6 * fbm(x * 1.7 + vec2(-t * 0.32, t * 0.38) + 9.0, 3);
  return h;
}

void main() {
  float aspect = uResolution.x / uResolution.y;
  vec2 uv = gl_FragCoord.xy / uResolution;
  float t = uTime;

  // ---- Water body -------------------------------------------------------
  vec3 col = mix(uColLow, uColMid, smoothstep(0.1, 0.62, uv.y));
  col = mix(col, uColTop, smoothstep(0.55, 0.92, uv.y));

  // Brighter column under the sun.
  float column = exp(-pow((uv.x - uSunPos.x - (1.0 - uv.y) * 0.12) * 2.4, 2.0));
  col += uColRay * 0.16 * column * smoothstep(0.0, 0.9, uv.y);

  // Deep falloff towards the bottom right.
  vec2 sh = (uv - vec2(1.0, 0.22)) * vec2(1.0, 1.1);
  float shadow = exp(-dot(sh, sh) * 6.0);
  col = mix(col, uColShadow, 0.9 * shadow);

  // Lit haze over the seabed along the bottom edge.
  float seabed = smoothstep(0.26, 0.0, uv.y) * exp(-pow((uv.x - 0.45) * 2.9, 2.0));
  col = mix(col, uColSeabed, 0.95 * seabed);
  // The water darkens a little towards the left edge, away from the sun.
  col *= mix(0.86, 1.0, smoothstep(0.0, 0.3, uv.x));

  // ---- Light shafts -----------------------------------------------------
  // Computed here, added after the surface so the main shaft starts inside
  // the sun's glare.
  vec2 p = vec2(uv.x * aspect, uv.y);
  vec2 s = vec2(uSunPos.x * aspect, uSunPos.y + 0.12);
  vec2 v = p - s;
  float d = length(v);
  // Angle measured from straight down, positive towards the right.
  float a = atan(v.x, -v.y);
  // One broad, soft main shaft leaning slightly right...
  float mainShaft = exp(-pow((a - 0.16) / 0.3, 2.0)) * pow(0.35 + 0.65 * noise2(vec2(a * 20.0, t * 0.7)), 1.5);
  // ...and fainter shafts fanning further right; none lean left.
  float fan = exp(-pow((a - 0.5) / 0.45, 2.0)) * smoothstep(-0.05, 0.2, a);
  float r1 = noise2(vec2(a * 11.0, t * 0.9));
  float r2 = noise2(vec2(a * 24.0 + 4.0, t * 1.3));
  float r3 = pow(noise2(vec2(a * 55.0 + 9.0, t * 1.1)), 6.0);
  float side = pow(0.6 * r1 + 0.4 * r2, 2.4) * 1.6 + r3 * 0.2;
  float along = 0.8 + 0.4 * noise2(vec2(a * 8.0, d * 3.0 - t * 0.6));
  float shaftFade = exp(-max(d - 0.1, 0.0) * 1.3) * smoothstep(0.0, 0.18, uv.y);
  vec3 shaftLight = uColRay * (mainShaft * 0.42 + side * fan * 0.26) * along * shaftFade;

  // ---- Surface underside ------------------------------------------------
  // Ray-cast from a camera looking slightly upwards to a plane above it.
  vec2 ndc = (uv - 0.5) * vec2(aspect, 1.0);
  vec3 rd = normalize(vec3(ndc.x, ndc.y - 0.1, 1.35));
  if (rd.y > 0.0) {
    float dist = 1.0 / rd.y;
    // Wavelets are wider than they are deep, as on a wind-blown surface.
    // Larger cells, running diagonally across frame like the reference.
    vec2 x = rotate2(rd.xz * dist * vec2(1.15, 2.3), 0.45);
    float e = 0.02;
    float h0 = waveHeight(x, t);
    float hx = waveHeight(x + vec2(e, 0.0), t);
    float hz = waveHeight(x + vec2(0.0, e), t);
    vec2 grad = vec2(hx - h0, hz - h0) / e;
    // Facets tilted towards the sun light up; troughs between them go dark.
    float facing = clamp(0.5 + 0.3 * dot(grad, normalize(vec2(-0.35, -1.0))), 0.0, 1.0);
    // Thin bright lines along the wave crests.
    float ridge = 1.0 - abs(2.0 * h0 / 1.6 - 1.0);
    ridge = pow(clamp(ridge, 0.0, 1.0), 6.0);
    float lit = clamp(facing * 0.85 + ridge * 0.45, 0.0, 1.0);
    // Far surface dissolves into the water haze.
    float vis = exp(-(dist - 2.0) * 0.38) * smoothstep(0.0, 0.1, rd.y);
    vis = clamp(vis, 0.0, 1.0);
    col = mix(col, col * 0.5, vis * 0.95 * smoothstep(0.65, 0.2, lit));
    col += uColSurface * vis * pow(lit, 2.4) * 0.8;

    // Sun burning through: a hot patch broken up by the wavelets.
    vec2 sv = (uv - uSunPos) * vec2(aspect, 1.0);
    float sd = length(sv * vec2(1.1, 1.45));
    float sunMask = exp(-sd * sd * 16.0);
    float sparkle = smoothstep(0.4, 0.85, lit);
    // Blown out at the centre, broken up by the wavelets towards its edge.
    col += uColSun * sunMask * (0.75 + 1.3 * sparkle) * vis;
  }

  col += shaftLight;

  // Wide atmospheric glow around the sun.
  vec2 gv = (uv - uSunPos) * vec2(aspect, 1.0);
  col += uColSun * 0.13 * exp(-dot(gv, gv) * 8.0);

  col += dither(gl_FragCoord.xy);
  outColor = vec4(clamp(col, 0.0, 1.0), 1.0);
}
`;
