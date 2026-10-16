import React, { useMemo } from "react";
import * as THREE from "three";
import { Stage, useDrive } from "../lib/Stage";
import { Post } from "../lib/post";
import { frag } from "../lib/glsl";

/**
 * Look 5 — Liquid Ripples. A still liquid seen straight down; one new ring
 * every 75 frames. The ring set at frame f is the ages (f mod 75) + 75·j,
 * j = 0..8, so the surface repeats every 75 frames (and thus every 600)
 * exactly. Amplitude ramps up from zero at birth (no ring pops in) and is
 * windowed to exactly zero by age 600, before the oldest slot is dropped.
 */
export type RipplesParams = {
  shading: "satin" | "ink";
  /** Liquid albedo, sRGB hex. */
  liquid: string;
};

const LOOP = 600;
const PERIOD = 75;
const RINGS = 9;

const RIPPLE_GLSL = /* glsl */ `
uniform float uPhase;      // frame mod 75
uniform vec2 uCenter;
// Ring front r(age) = R0 + A·age^0.75: rings slow as they spread, so they
// pack tighter toward the edges and leave a wide calm dish in the middle.
const float R0 = 1.9;
const float A = 0.083;
float ringAmp(float age, float r) {
  float birth = smoothstep(0.0, 36.0, age);           // starts at zero amplitude
  float window = 1.0 - smoothstep(420.0, 600.0, age); // exactly 0 by age 600
  float decay = exp(-age / 700.0);
  float spread = 1.0 / sqrt(1.0 + r * 0.35);
  return 0.24 * birth * window * decay * spread;
}
float rippleH(float r) {
  float h = 0.0;
  for (int j = 0; j < ${RINGS}; j++) {
    float age = uPhase + float(j) * ${PERIOD}.0;
    float front = R0 + A * pow(age, 0.75);
    float d = r - front;
    // soft broad swells near the centre, crisper crests further out
    float SIGMA = mix(0.78, 0.36, clamp((front - R0) / 8.0, 0.0, 1.0));
    float K = 2.1 / SIGMA;
    float env = exp(-(d * d) / (SIGMA * SIGMA));
    // cos packet minus its mean so the far field stays flat
    h += ringAmp(age, r) * SIGMA * 1.6 * (cos(K * d) - exp(-K * K * SIGMA * SIGMA * 0.25)) * env;
  }
  // gentle central dome where the drops land
  return h;
}
float rippleHeight(vec2 p) { return rippleH(length(p - uCenter)); }
vec3 rippleNormal(vec2 p) {
  vec2 dp = p - uCenter;
  float r = length(dp);
  float e = 0.004;
  float dhdr = (rippleH(r + e) - rippleH(max(r - e, 0.0))) / (r + e - max(r - e, 0.0));
  vec2 dir = r > 1e-4 ? dp / r : vec2(0.0);
  return normalize(vec3(-dhdr * dir, 1.0));
}
`;

const VERT = /* glsl */ `
${RIPPLE_GLSL}
out vec3 vWorld;
void main() {
  vec3 p = position;
  p.z += rippleHeight(p.xy);
  vec4 w = modelMatrix * vec4(p, 1.0);
  vWorld = w.xyz;
  gl_Position = projectionMatrix * viewMatrix * w;
}
`;

const FRAG = /* glsl */ `
${RIPPLE_GLSL}
in vec3 vWorld;
uniform vec3 uAlbedo;
uniform float uInk;
uniform vec3 uCam;

float D_GGX(float NoH, float a) {
  float a2 = a * a;
  float d = NoH * NoH * (a2 - 1.0) + 1.0;
  return a2 / (3.14159265 * d * d);
}
// Soft strip light at infinity: c = centre direction, t = long axis.
// halfW / halfL are angular half-sizes (radians), soft = edge softness.
float strip(vec3 R, vec3 c, vec3 t, float halfW, float halfL, float soft) {
  vec3 n = normalize(cross(c, t));
  float u = asin(clamp(dot(R, n), -1.0, 1.0));
  float v = atan(dot(R, t), dot(R, c));
  return smoothstep(halfW + soft, halfW - soft, abs(u)) * smoothstep(halfL + soft * 4.0, halfL - soft * 4.0, abs(v));
}
vec3 dirFrom(float azimuth, float offZenith) {
  return vec3(sin(offZenith) * cos(azimuth), sin(offZenith) * sin(azimuth), cos(offZenith));
}

void main() {
  vec3 n = rippleNormal(vWorld.xy);
  vec3 V = normalize(uCam - vWorld);
  vec3 col;
  if (uInk < 0.5) {
    // Milky satin: wrap diffuse (subsurface feel) from a big soft key at the
    // upper left, soft GGX sheen (roughness 0.25), sky fill.
    vec3 L = normalize(vec3(-0.62, 0.55, 0.62));
    float wrap = 0.35;
    float diff = clamp((dot(n, L) + wrap) / (1.0 + wrap), 0.0, 1.0);
    float fill = 0.5 + 0.5 * n.z;
    // Satin sheen: the big soft key (and a dimmer bounce card on the right)
    // reflected by a roughness-0.25 surface → broad, soft highlight bands.
    vec3 R = reflect(-V, n);
    vec3 c1 = dirFrom(radians(140.0), radians(34.0));
    vec3 t1 = normalize(cross(c1, vec3(0.0, 0.0, 1.0)));
    vec3 c2 = dirFrom(radians(-20.0), radians(32.0));
    vec3 t2 = normalize(cross(c2, vec3(0.0, 0.0, 1.0)));
    // one big soft key at the upper left (glossy streak on that flank of
    // every ring, fading round it) and a dim card on the right
    vec3 c3 = dirFrom(radians(50.0), radians(30.0));
    vec3 t3 = normalize(cross(c3, vec3(0.0, 0.0, 1.0)));
    float sheen = strip(R, c1, t1, radians(9.0), radians(65.0), radians(10.0)) * 0.62
                + strip(R, c2, t2, radians(8.0), radians(60.0), radians(10.0)) * 0.34
                + strip(R, c3, t3, radians(8.0), radians(60.0), radians(10.0)) * 0.2;
    vec3 H = normalize(L + V);
    float spec = D_GGX(max(dot(n, H), 0.0), 0.0625) * 0.02;
    col = uAlbedo * (0.70 * diff + 0.22 * fill) * vec3(0.985, 0.99, 1.0) + vec3(sheen + spec) * vec3(0.97, 0.985, 1.0);
    // the key falls off across the frame: bright top-left, dimmer bottom-right
    col *= mix(0.97, 1.08, smoothstep(-9.0, 9.0, -vWorld.x * 0.8 + vWorld.y * 1.1));
  } else {
    // Glossy black ink (roughness 0.08): two soft strip lights above, a faint
    // studio gradient for body, Fresnel-weighted.
    vec3 R = reflect(-V, n);
    float F = 0.04 + 0.96 * pow(1.0 - max(dot(n, V), 0.0), 5.0);
    vec3 c1 = dirFrom(radians(135.0), radians(30.0));
    vec3 t1 = normalize(cross(c1, vec3(0.0, 0.0, 1.0)));
    vec3 c2 = dirFrom(radians(-15.0), radians(27.0));
    vec3 t2 = normalize(cross(c2, vec3(0.0, 0.0, 1.0)));
    float s1 = strip(R, c1, t1, radians(3.2), radians(38.0), radians(0.9));
    float s2 = strip(R, c2, t2, radians(2.2), radians(30.0), radians(0.9));
    float env = 0.035 * smoothstep(0.75, 1.0, R.z) + 0.2 * smoothstep(0.5, 0.0, R.z);
    float spec = (s1 * 30.0 + s2 * 18.0 + env) * F;
    col = uAlbedo * 0.15 + vec3(spec);
  }
  gl_FragColor = vec4(col, 1.0);
}
`;

const hexLinear = (hex: string) => new THREE.Color(hex); // ColorManagement converts sRGB hex → linear

class RipplesLook {
  scene = new THREE.Scene();
  camera: THREE.PerspectiveCamera;
  post: Post;
  material: THREE.ShaderMaterial;
  constructor(p: RipplesParams) {
    const ink = p.shading === "ink";
    this.camera = new THREE.PerspectiveCamera(14, 16 / 9, 1, 200);
    // Straight down onto the liquid: the plane is XY, the camera looks along -Z.
    this.camera.position.set(0, 0, 38);
    this.camera.lookAt(0, 0, 0);
    this.camera.updateMatrixWorld();
    this.material = new THREE.ShaderMaterial({
      glslVersion: THREE.GLSL3,
      vertexShader: VERT,
      fragmentShader: frag(FRAG),
      uniforms: {
        uPhase: { value: 0 },
        uCenter: { value: new THREE.Vector2(-0.45, 0.55) },
        uAlbedo: { value: hexLinear(p.liquid) },
        uInk: { value: ink ? 1 : 0 },
        uCam: { value: this.camera.position.clone() },
      },
    });
    const geo = new THREE.PlaneGeometry(19, 11, 640, 370);
    const mesh = new THREE.Mesh(geo, this.material);
    mesh.frustumCulled = false;
    this.scene.add(mesh);
    this.post = new Post({
      loopLength: LOOP,
      msaa: 0,
      bloom: ink ? { threshold: 0.9, knee: 0.4, levels: 5 } : null,
      blueNoise: true,
      grain: 0.015,
      grainDarkFade: ink,
      grade: ink
        ? /* glsl */ `vec3 grade(vec3 hdr, vec3 bl, vec2 uv) {
             vec3 c = hdr + bl * 0.06;
             c = c / (1.0 + max(c - 0.8, 0.0) * 0.6);  // soft shoulder on the hot crests
             return c;
           }`
        : /* glsl */ `vec3 grade(vec3 hdr, vec3 bl, vec2 uv) {
             vec3 c = hdr;
             // soft vignette like the reference's lens falloff
             vec2 d = (uv - 0.5) * vec2(uAspect, 1.0);
             c *= 1.0 - 0.10 * dot(d, d);
             return c / (1.0 + max(c - 0.85, 0.0) * 1.2);
           }`,
    });
  }
  update = (frame: number) => {
    this.material.uniforms.uPhase.value = ((frame % PERIOD) + PERIOD) % PERIOD;
  };
  render = (gl: THREE.WebGLRenderer, frame: number) => {
    this.post.render(gl, this.scene, this.camera, frame);
  };
}

const Inner: React.FC<RipplesParams> = (p) => {
  const look = useMemo(() => new RipplesLook(p), [p.shading, p.liquid]); // eslint-disable-line react-hooks/exhaustive-deps
  useDrive(look);
  return null;
};

export const LiquidRipples: React.FC<RipplesParams> = (p) => (
  <Stage>
    <Inner {...p} />
  </Stage>
);
