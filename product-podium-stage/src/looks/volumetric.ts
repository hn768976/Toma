/**
 * Raymarched volumetrics for look 2.
 *
 * The light cone descending from the ring is the defining element of that
 * look, so it is marched through an actual density field rather than faked
 * with a painted gradient mesh - a gradient cannot occlude correctly against
 * the plinth, cannot pick up noise that drifts through it, and reads as a
 * decal the moment anything moves.
 *
 * Rather than sampling a depth buffer to know where to stop, the ray is
 * terminated analytically: the scene this pass has to respect is a ground
 * plane plus a capped cylinder, both of which have closed-form intersections.
 * That keeps the pass independent of the render target setup and exact at
 * every pixel. The result is additive in-scattering - fog between the camera
 * and a surface adds light to it, which is what haze actually does at these
 * densities.
 *
 * Cost: the marching loop is the expensive part of this project. STEPS is a
 * compile-time constant taken from the look row, so lowering it costs nothing
 * at runtime and is the first dial to turn if render time is unworkable.
 */

export const volumetricVertexShader = /* glsl */ `
uniform mat4 uInvViewProj;
varying vec3 vRayTarget;

void main() {
  // The quad is already in clip space, so it covers the frame whatever the
  // camera is doing. Unprojecting the far plane gives a world-space point
  // along this pixel's view ray.
  vec4 clip = vec4(position.xy, 1.0, 1.0);
  vec4 world = uInvViewProj * clip;
  vRayTarget = world.xyz / world.w;
  gl_Position = clip;
}
`;

export const volumetricFragmentShader = /* glsl */ `
uniform vec3 uCamPos;
uniform float uFrame;

uniform float uFloorY;
uniform float uPlinthTop;
uniform float uPlinthRadius;

uniform float uRingY;
uniform float uRingRadius;
uniform float uConeTopRadius;
uniform float uConeBottomRadius;

uniform vec3 uConeColor;
uniform vec3 uFogColor;
uniform float uConeIntensity;
uniform float uGlowIntensity;
uniform float uFogDensity;
uniform float uFogHeight;

uniform vec3 uConeDrift;
uniform vec3 uFogDrift;
uniform float uNoisePeriod;
uniform float uConeNoiseFreq;
uniform float uFogNoiseFreq;

varying vec3 vRayTarget;

const float TMAX = 55.0;
const float TSTART = 0.4;
/** Outer radius of the density bounding volume - the fog's outer fade. */
const float BOUND_RADIUS = 21.0;

float hash12(vec2 p) {
  vec3 p3 = fract(vec3(p.xyx) * 0.1031);
  p3 += dot(p3, p3.yzx + 33.33);
  return fract((p3.x + p3.y) * p3.z);
}

/**
 * Lattice hash wrapped to 'period', which is what makes the noise tileable:
 * translating the sample point by exactly one world period returns an
 * identical field. That is how the fog drifts and still loops.
 *
 * Sine-free on purpose. This runs eight times per noise sample, per octave,
 * per march step - a transcendental here dominates the whole frame time on a
 * software rasteriser.
 */
float hashLattice(vec3 i, float period) {
  vec3 p3 = fract(mod(i, vec3(period)) * 0.1031 + 0.19283);
  p3 += dot(p3, p3.zyx + 31.32);
  return fract((p3.x + p3.y) * p3.z);
}

float vnoise(vec3 p, float period) {
  vec3 i = floor(p);
  vec3 f = fract(p);
  f = f * f * (3.0 - 2.0 * f);

  float n000 = hashLattice(i + vec3(0.0, 0.0, 0.0), period);
  float n100 = hashLattice(i + vec3(1.0, 0.0, 0.0), period);
  float n010 = hashLattice(i + vec3(0.0, 1.0, 0.0), period);
  float n110 = hashLattice(i + vec3(1.0, 1.0, 0.0), period);
  float n001 = hashLattice(i + vec3(0.0, 0.0, 1.0), period);
  float n101 = hashLattice(i + vec3(1.0, 0.0, 1.0), period);
  float n011 = hashLattice(i + vec3(0.0, 1.0, 1.0), period);
  float n111 = hashLattice(i + vec3(1.0, 1.0, 1.0), period);

  return mix(
    mix(mix(n000, n100, f.x), mix(n010, n110, f.x), f.y),
    mix(mix(n001, n101, f.x), mix(n011, n111, f.x), f.y),
    f.z
  );
}

/** Octaves double in frequency and in lattice period together, so the whole
    stack shares one world-space period and stays tileable. */
float fbm3(vec3 p, float period) {
  // Two octaves. A third costs another eight hashes per sample and, at these
  // densities, is not visible through the haze.
  float a = vnoise(p, period);
  float b = vnoise(p * 2.0, period * 2.0);
  return (a * 0.5 + b * 0.25) / 0.75;
}

/** Nearest surface along the ray: ground plane, plinth cap, plinth side. */
float sceneDistance(vec3 ro, vec3 rd) {
  float best = TMAX;

  if (rd.y < -1e-5) {
    float tFloor = (uFloorY - ro.y) / rd.y;
    if (tFloor > 0.0) best = min(best, tFloor);

    float tCap = (uPlinthTop - ro.y) / rd.y;
    if (tCap > 0.0) {
      vec2 hit = (ro + rd * tCap).xz;
      if (dot(hit, hit) <= uPlinthRadius * uPlinthRadius) best = min(best, tCap);
    }
  }

  float a = dot(rd.xz, rd.xz);
  if (a > 1e-6) {
    float b = dot(ro.xz, rd.xz);
    float c = dot(ro.xz, ro.xz) - uPlinthRadius * uPlinthRadius;
    float disc = b * b - a * c;
    if (disc > 0.0) {
      float tSide = (-b - sqrt(disc)) / a;
      if (tSide > 0.0) {
        float y = ro.y + rd.y * tSide;
        if (y >= uFloorY && y <= uPlinthTop) best = min(best, tSide);
      }
    }
  }

  return best;
}

/** The cone of light falling from the ring onto the plinth. */
float coneDensity(vec3 p) {
  float span = max(uRingY - uPlinthTop, 1e-3);
  float h = (p.y - uPlinthTop) / span;
  if (h < -0.08 || h > 1.2) return 0.0;

  float hc = clamp(h, 0.0, 1.0);
  // Widens downward, as a beam spreading away from its source does.
  float radius = mix(uConeBottomRadius, uConeTopRadius, hc);
  float r = length(p.xz);
  float radial = 1.0 - smoothstep(radius * 0.74, radius, r);

  // Soft at both ends so the beam has no visible cap. The upper fade
  // completes at the ring's own plane, so the ring reads as an open loop
  // rather than a filled disc.
  float vertical = smoothstep(-0.08, 0.25, h) * (1.0 - smoothstep(0.72, 1.0, h));
  // Denser toward the ring, thinning as it spreads.
  float falloff = mix(0.5, 1.0, hc);

  return radial * vertical * falloff;
}

/** Halo immediately around the tube of the ring itself. */
float ringGlow(vec3 p) {
  float r = length(p.xz);
  float d = length(vec2(r - uRingRadius, p.y - uRingY));
  return exp(-d * 2.4);
}

/** Haze lying on the floor plane, thinning with height and with distance. */
float groundDensity(vec3 p) {
  float h = p.y - uFloorY;
  if (h < -0.3) return 0.0;
  float vertical = exp(-max(h, 0.0) / uFogHeight);
  // Fades out well before the backdrop, so the far field reads as dark void
  // rather than as milk.
  float radial = 1.0 - smoothstep(9.0, 20.0, length(p.xz));
  return vertical * radial;
}

void main() {
  vec3 ro = uCamPos;
  vec3 rd = normalize(vRayTarget - ro);

  float tEnd = min(sceneDistance(ro, rd), TMAX);
  if (tEnd <= TSTART) {
    gl_FragColor = vec4(0.0, 0.0, 0.0, 1.0);
    return;
  }

  // Clip the march to a bounding volume that actually contains density: a
  // short horizontal slab from the floor to just above the ring, inside a
  // cylinder at the fog's outer fade. Everything above the ring - most of the
  // frame - then costs one intersection test instead of STEPS samples, which
  // is the difference between this look being renderable and not.
  float tNear = TSTART;
  float tFar = tEnd;

  float yMin = uFloorY - 0.35;
  float yMax = uRingY + 1.7;
  if (abs(rd.y) > 1e-5) {
    float ya = (yMin - ro.y) / rd.y;
    float yb = (yMax - ro.y) / rd.y;
    tNear = max(tNear, min(ya, yb));
    tFar = min(tFar, max(ya, yb));
  } else if (ro.y < yMin || ro.y > yMax) {
    gl_FragColor = vec4(0.0, 0.0, 0.0, 1.0);
    return;
  }

  float ba = dot(rd.xz, rd.xz);
  if (ba > 1e-6) {
    float bb = dot(ro.xz, rd.xz);
    float bc = dot(ro.xz, ro.xz) - BOUND_RADIUS * BOUND_RADIUS;
    float bdisc = bb * bb - ba * bc;
    if (bdisc <= 0.0) {
      gl_FragColor = vec4(0.0, 0.0, 0.0, 1.0);
      return;
    }
    float bsq = sqrt(bdisc);
    tNear = max(tNear, (-bb - bsq) / ba);
    tFar = min(tFar, (-bb + bsq) / ba);
  }

  if (tFar <= tNear) {
    gl_FragColor = vec4(0.0, 0.0, 0.0, 1.0);
    return;
  }

  float dt = (tFar - tNear) / float(STEPS);
  // Per-pixel start offset. Without it, a fixed step size lays visible shells
  // through the cone; with it the error becomes noise, which the grain pass
  // then sits on top of naturally.
  float jitter = hash12(gl_FragCoord.xy + vec2(uFrame * 1.371, uFrame * 0.917));
  float t = tNear + jitter * dt;

  vec3 accumulated = vec3(0.0);

  for (int i = 0; i < STEPS; i++) {
    vec3 p = ro + rd * t;

    float cone = coneDensity(p);
    float ground = groundDensity(p);
    float glow = ringGlow(p);

    // Fade everything out before the bounding volume clips it, or the top of
    // the box shows up as a hard horizontal edge across the haze.
    float boundsFade = 1.0 - smoothstep(yMax - 1.1, yMax, p.y);

    if (boundsFade > 0.001 && (cone > 0.002 || ground > 0.002 || glow > 0.002)) {
      if (cone > 0.002) {
        cone *= mix(0.62, 1.38, fbm3(p * uConeNoiseFreq + uConeDrift, uNoisePeriod));
      }
      if (ground > 0.002) {
        ground *= mix(0.2, 1.7, fbm3(p * uFogNoiseFreq + uFogDrift, uNoisePeriod));
      }
      accumulated +=
        uConeColor * (cone * uConeIntensity + glow * uGlowIntensity) * dt * boundsFade;
      accumulated += uFogColor * ground * uFogDensity * dt * boundsFade;
    }

    t += dt;
  }

  gl_FragColor = vec4(accumulated, 1.0);
  #include <tonemapping_fragment>
  #include <colorspace_fragment>
}
`;
