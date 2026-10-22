import * as THREE from "three";

// Shared GLSL building blocks.
//  * Points are drawn as soft glow sprites, glossy "bead" spheres or
//    depth-of-field bokeh discs.
//  * Rays/filaments are drawn as screen-space ribbons (instanced quads) so
//    their thickness stays resolution independent: 1px GL lines would vanish
//    once a 4K master is downscaled.

export const POINT_FRAG = /* glsl */ `
varying vec3 vColor;
varying float vAlpha;
varying float vKind;   // 0 = glow sprite, 1 = glossy bead
varying float vBlur;   // 0 = in focus, 1 = fully defocused bokeh disc

void main() {
  vec2 p = gl_PointCoord * 2.0 - 1.0;
  float r2 = dot(p, p);
  if (r2 > 1.0) discard;
  vec3 col;
  float a;
  if (vKind > 0.5) {
    // Glossy bead: a lit sphere with a specular highlight and rim light.
    vec3 n = vec3(p.x, -p.y, sqrt(1.0 - r2));
    vec3 l = normalize(vec3(-0.45, 0.6, 0.65));
    float diff = max(dot(n, l), 0.0);
    float spec = pow(max(dot(reflect(-l, n), vec3(0.0, 0.0, 1.0)), 0.0), 28.0);
    float rim = pow(1.0 - n.z, 2.0);
    col = vColor * (0.35 + 0.95 * diff) + vec3(spec) * 1.6 + vColor * rim * 0.8;
    a = smoothstep(1.0, 0.82, sqrt(r2));
  } else {
    float r = sqrt(r2);
    float glow = exp(-r2 * 9.0) * 1.4 + exp(-r2 * 3.2) * 0.35;
    glow *= smoothstep(1.0, 0.6, r);
    // Bokeh disc: flat body, slightly brighter rim, soft edge.
    float disc = smoothstep(1.0, 0.86, r) * (0.75 + 0.35 * smoothstep(0.55, 0.95, r));
    a = mix(glow, disc, vBlur);
    col = vColor;
  }
  gl_FragColor = vec4(col * a * vAlpha, 1.0);
}`;

/**
 * Returns the gl_PointSize/alpha for a sprite of `sizePx` (1080p pixels)
 * with optional depth of field. Energy is conserved when a point grows
 * into a bokeh disc so defocused points dim instead of blowing out.
 */
export const DOF_CHUNK = /* glsl */ `
uniform float uPx;
uniform float uFocus;      // focus distance (view-space units)
uniform float uAperture;   // circle of confusion in 1080p px per unit of defocus
uniform float uMaxCoc;

void applyPointSize(float sizePx, float viewDepth, inout float alpha, out float blur) {
  float coc = uAperture > 0.0
    ? min(abs(viewDepth - uFocus) * uAperture / max(viewDepth, 0.1) * uFocus, uMaxCoc)
    : 0.0;
  float s = max(sizePx, coc);
  blur = clamp((coc - sizePx) / max(sizePx * 2.0, 1.0), 0.0, 1.0);
  alpha *= clamp((sizePx * sizePx) / (s * s) * (1.0 + blur * 0.9), 0.0, 1.0);
  gl_PointSize = max(s * uPx, 1.0);
}`;

/**
 * Projects the view-space segment a->b, clips it against the near plane
 * and expands it into a camera-facing ribbon `halfWidthPx` wide.
 */
export const RIBBON_CHUNK = /* glsl */ `
uniform vec2 uRes;
uniform float uNear;

vec4 ribbon(vec3 a, vec3 b, vec2 corner, float halfWidthPx, float capPx, out float behind) {
  behind = 0.0;
  float za = -a.z;
  float zb = -b.z;
  if (za < uNear && zb < uNear) { behind = 1.0; return vec4(2.0, 2.0, 2.0, 1.0); }
  if (za < uNear) a = mix(a, b, (uNear - za) / (zb - za));
  if (zb < uNear) b = mix(b, a, (uNear - zb) / (za - zb));
  vec4 ca = projectionMatrix * vec4(a, 1.0);
  vec4 cb = projectionMatrix * vec4(b, 1.0);
  vec2 sa = ca.xy / ca.w * uRes;
  vec2 sb = cb.xy / cb.w * uRes;
  vec2 d = sb - sa;
  float len = length(d);
  vec2 dir = len > 1e-4 ? d / len : vec2(1.0, 0.0);
  vec2 nrm = vec2(-dir.y, dir.x);
  vec4 c = mix(ca, cb, corner.x);
  c.xy += (nrm * corner.y * halfWidthPx + dir * (corner.x * 2.0 - 1.0) * capPx) / uRes * 2.0 * c.w;
  return c;
}`;

export const RIBBON_FRAG = /* glsl */ `
varying vec3 vColor;
varying float vAlpha;
varying float vAcross;
void main() {
  float a = exp(-vAcross * vAcross * 4.5);
  gl_FragColor = vec4(vColor * a * vAlpha, 1.0);
}`;

/** Unit quad used by every instanced ribbon: x = along (0..1), y = across (-1..1). */
export const ribbonQuad = () => {
  const g = new THREE.InstancedBufferGeometry();
  g.setAttribute(
    "corner",
    new THREE.BufferAttribute(new Float32Array([0, -1, 1, -1, 1, 1, 0, 1]), 2),
  );
  // three.js requires a position attribute; corner carries the real data.
  g.setAttribute(
    "position",
    new THREE.BufferAttribute(new Float32Array(12), 3),
  );
  g.setIndex([0, 1, 2, 0, 2, 3]);
  return g;
};

export const additive = {
  transparent: true,
  depthTest: false,
  depthWrite: false,
  blending: THREE.CustomBlending,
  blendEquation: THREE.AddEquation,
  blendSrc: THREE.OneFactor,
  blendDst: THREE.OneFactor,
} as const;

export const instanced = (
  geo: THREE.InstancedBufferGeometry,
  name: string,
  data: Float32Array,
  size: number,
) => {
  geo.setAttribute(name, new THREE.InstancedBufferAttribute(data, size));
};
