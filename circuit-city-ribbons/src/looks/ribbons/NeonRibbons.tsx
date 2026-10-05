import React from "react";
import * as THREE from "three";
import { GLStage, World } from "../../lib/GLStage";
import { Post } from "../../lib/post";
import { lin, mulberry32, range } from "../../lib/random";
import type { RibbonsVersion } from "../../versions";

/*
 * Neon Ribbons: one full-screen fragment shader.
 * The band layout is a fixed, seeded table (module-level PRNG). Motion is a
 * function of u = (frame % 600) / 600 only, and every periodic term completes
 * a whole number of cycles over u in [0, 1], so frame 600 == frame 0.
 */

export const RIBBONS_LOOP = 600;
const NB = 12;

type Band = {
  r: number; // inner radius
  w: number; // width
  ci: number; // base colour index 0..3
  kind: number; // 0 convex, 1 inverted shading, 2 thin bright line
  bright: number;
  hl: [number, number, number, number]; // speed1, phase1, speed2, phase2
  fl: [number, number, number]; // flash speed, phase, strength
  wob: [number, number]; // undulation phase, amplitude
};

// Seeded at module level: identical in every render thread.
const BANDS: Band[] = (() => {
  const r = mulberry32(0x1077857705 % 4294967295);
  const out: Band[] = [];
  // Hand-ordered stack (top to bottom): a thin neon line, a dark gap, an
  // indigo/violet group, a deep cyan block lower down, violet/magenta at the
  // bottom. kind: 0 glossy convex, 1 inverted (edge-lit), 2 thin neon line.
  const spec: [number, number, number, number][] = [
    // width, colour index, kind, gap after
    [0.006, 1.0, 2, 0.006],
    [0.004, 0.9, 2, 0.04],
    [0.02, 1.8, 0, 0.007],
    [0.012, 1.6, 0, 0.009],
    [0.06, 1.75, 0, 0.003],
    [0.045, 1.3, 1, 0.008],
    [0.055, 1.05, 0, 0.002],
    [0.07, 0.75, 0, 0.006],
    [0.03, 1.85, 1, 0.003],
    [0.065, 0.95, 0, 0.007],
    [0.05, 1.95, 1, 0.003],
    [0.08, 2.25, 0, 0.0],
  ];
  let rad = 0.935;
  spec.forEach(([w, ci, kind, gap]) => {
    out.push({
      r: rad,
      w,
      ci,
      kind,
      bright: kind === 2 ? range(r, 0.9, 1.1) : range(r, 0.6, 0.85),
      hl: [Math.floor(range(r, 1, 3.999)), r(), Math.floor(range(r, 1, 2.999)), r()],
      fl: [Math.floor(range(r, 1, 3.999)), r(), kind === 2 ? 0 : range(r, 1.2, 1.8)],
      wob: [r() * Math.PI * 2, range(r, 0.6, 1.0)],
    });
    rad += w + gap;
  });
  return out;
})();

const FRAG = /* glsl */ `
precision highp float;
uniform vec2 resolution;
uniform float u;          // loop phase 0..1
uniform vec3 pal[4];
uniform vec3 bgTop;
uniform vec3 bgNear;
uniform vec3 flashCol;
uniform vec4 bandA[${NB}]; // r, w, ci, kind
uniform vec4 bandB[${NB}]; // bright, hlSpeed1, hlPhase1, hlSpeed2
uniform vec4 bandC[${NB}]; // hlPhase2, flSpeed, flPhase, flStrength
uniform vec4 bandD[${NB}]; // wobPhase, wobAmp, -, -
in vec2 vUv;
out vec4 outColor;
const float TAU = 6.28318530718;

vec3 palette(float x) {
  x = clamp(x, 0.0, 3.0);
  vec3 a = mix(pal[0], pal[1], smoothstep(0.0, 1.0, x));
  a = mix(a, pal[2], smoothstep(1.0, 2.0, x));
  return mix(a, pal[3], smoothstep(2.0, 3.0, x));
}

void main() {
  vec2 uv = vUv;
  float aspect = resolution.x / resolution.y;
  // Curve family: concentric ellipses, centre above-left of frame.
  // Breathing: centre and radius move on whole-cycle sinusoids of u.
  vec2 c = vec2(0.26 + 0.012 * sin(TAU * u), 1.40 + 0.010 * sin(TAU * 2.0 * u + 1.0));
  vec2 q = uv - c;
  q.x *= mix(0.78, 1.16, smoothstep(-0.25, 0.35, q.x)) + 0.015 * sin(TAU * u + 2.0);
  q.y *= 0.95;
  float d = length(q);
  float th = atan(q.x, -q.y);   // 0 straight down, + toward right
  // along-band coordinate: 0 at left edge region, 1 at top right
  float s = (th + 0.35) / 1.35;
  float pxd = fwidth(d);

  // background gradient: dark top, warmer near the band arc
  float above = max(0.93 - d, 0.0);
  vec3 col = mix(bgNear, bgTop, smoothstep(0.0, 0.75, above));
  col *= 0.5 + 0.6 * smoothstep(0.0, 1.0, uv.x * 0.7 + 0.3 * (1.0 - uv.y));
  col += pal[3] * 0.012 * smoothstep(0.4, 1.0, uv.x) * smoothstep(0.3, 1.0, uv.y);
  // faint brushed streaks in the sky, along the arc direction (static)
  float streak = fract(sin(floor(d * 420.0) * 12.9898) * 43758.5453);
  col *= 1.0 + 0.14 * (streak - 0.5) * smoothstep(0.0, 0.1, above);
  // faint glow above the top band
  col += mix(palette(1.6), palette(2.4), 0.4) * exp(-above / 0.16) * 0.09;

  vec3 glow = vec3(0.0);
  float occl = 0.0;
  for (int i = 0; i < ${NB}; i++) {
    vec4 A = bandA[i];
    vec4 B = bandB[i];
    vec4 C = bandC[i];
    vec4 D = bandD[i];
    float fi = float(i);
    // gentle undulation: whole-number frequencies in angle and in time
    float wob = 0.0035 * D.y * sin(3.0 * th + D.x + TAU * u)
              + 0.0020 * D.y * sin(5.0 * th - D.x * 1.3 - TAU * 2.0 * u);
    float r0 = A.x + wob * (1.0 + fi * 0.12);
    float w = A.y;
    float x = (d - r0) / w * 2.0 - 1.0; // -1 inner (top) edge .. +1 outer edge
    float ax = abs(x);
    float aa = pxd / w * 2.0;
    float cover = 1.0 - smoothstep(1.0 - aa, 1.0 + aa, ax);

    // colour drifts slowly along the band
    float ci = A.z + 0.22 * sin(th * 2.0 + TAU * u + fi * 0.7) + 0.15 * sin(TAU * 2.0 * u - th * 3.0 + fi);
    vec3 bc = palette(ci);

    // highlights gliding along the band (positions wrap once per loop * speed)
    float h1 = fract(B.z + B.y * u) * 1.8 - 0.4;
    float h2 = fract(C.x - B.w * u) * 1.8 - 0.4;
    float st1 = exp(-pow((s - h1) / 0.16, 2.0));
    float st2 = exp(-pow((s - h2) / 0.28, 2.0)) * 0.6;
    float hl = st1 + st2;
    // magenta flashes travelling along some bands
    float fpos = fract(C.z + C.y * u) * 1.6 - 0.3;
    float fpos2 = fract(C.z + 0.5 - (C.y + 1.0) * u) * 1.6 - 0.3;
    float flash = C.w * (exp(-pow((s - fpos) / 0.035, 2.0)) + 0.8 * exp(-pow((s - fpos2) / 0.025, 2.0)));

    float nrm = sqrt(max(1.0 - x * x, 0.0));
    // flat glassy slat: gentle shading, fine slat lines inside, crisp edges
    float shade;
    float specL;
    if (A.w < 1.5) {
      float flip = A.w < 0.5 ? 1.0 : -1.0;
      shade = 0.38 + 0.22 * flip * (-x) + 0.12 * nrm;
      specL = exp(-pow((x + 0.6 * flip) / 0.1, 2.0));
      // 3-4 hairline sub-strips per band
      float k = 1.0 + mod(fi, 2.0);
      float sub = abs(fract((x * 0.5 + 0.5) * k) - 0.5) * w / k * 2.0;
      float hair = exp(-pow(sub / (0.0007 + pxd), 2.0));
      specL += hair * 0.12;
      shade *= 0.93 + 0.07 * smoothstep(0.0, 0.004, sub);
    } else {
      shade = 0.9 + 0.3 * nrm;
      specL = 0.0;
    }
    shade *= B.x * (0.85 + 0.15 * sin(th * 4.0 + fi * 2.1));
    vec3 body = bc * shade * (1.0 + 0.8 * hl);
    body += mix(bc, vec3(1.0), 0.15) * 1.3 * specL * (0.45 + 1.4 * hl);
    body += flashCol * flash * 1.4 * (0.5 + 0.8 * specL + 0.3 * nrm);
    // crisp bright edge line on every strip
    float rimW = 0.0008 / w * 2.0;
    float rim = exp(-pow((1.0 - ax) / (rimW + aa), 2.0));
    body += mix(bc, vec3(1.0), 0.2) * rim * (A.w > 1.5 ? 0.0 : 0.5) * B.x;

    // bands lower in the stack sit "behind" the ones above (occlusion)
    col = mix(col, body, cover * (1.0 - occl * 0.0));
    // soft glow spilling outwards
    float e = max(ax - 1.0, 0.0) * w * 0.5;
    float isLine = step(1.5, A.w);
    glow += bc * B.x * (exp(-e / 0.02) * 0.10 + exp(-e / 0.005) * 0.22) * isLine * (1.0 - cover);
    glow += bc * B.x * exp(-e / 0.004) * 0.04 * (1.0 - isLine) * (1.0 - cover);
    glow += flashCol * flash * exp(-e / 0.012) * 0.35 * (1.0 - cover);
  }
  col += glow;
  // lower edge of the frame recedes into shadow
  col *= mix(0.75, 1.0, smoothstep(0.0, 0.2, uv.y));
  outColor = vec4(col, 1.0);
}`;

const VERT = /* glsl */ `
out vec2 vUv;
void main() { vUv = position.xy * 0.5 + 0.5; gl_Position = vec4(position.xy, 0.0, 1.0); }`;

class RibbonsWorld implements World {
  post: Post;
  scene = new THREE.Scene();
  cam = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1);
  mat: THREE.ShaderMaterial;
  constructor(v: RibbonsVersion) {
    const v3 = (h: string) => new THREE.Vector3(...lin(h));
    this.mat = new THREE.ShaderMaterial({
      glslVersion: THREE.GLSL3,
      vertexShader: VERT,
      fragmentShader: FRAG,
      depthTest: false,
      depthWrite: false,
      uniforms: {
        resolution: { value: new THREE.Vector2(1, 1) },
        u: { value: 0 },
        pal: { value: v.bands.map(v3) },
        bgTop: { value: v3(v.bgTop) },
        bgNear: { value: v3(v.bgNear) },
        flashCol: { value: v3(v.flash) },
        bandA: { value: BANDS.map((b) => new THREE.Vector4(b.r, b.w, b.ci, b.kind)) },
        bandB: { value: BANDS.map((b) => new THREE.Vector4(b.bright, b.hl[0], b.hl[1], b.hl[2])) },
        bandC: { value: BANDS.map((b) => new THREE.Vector4(b.hl[3], b.fl[0], b.fl[1], b.fl[2])) },
        bandD: { value: BANDS.map((b) => new THREE.Vector4(b.wob[0], b.wob[1], 0, 0)) },
      },
    });
    const g = new THREE.BufferGeometry();
    g.setAttribute("position", new THREE.BufferAttribute(new Float32Array([-1, -1, 0, 3, -1, 0, -1, 3, 0]), 3));
    const m = new THREE.Mesh(g, this.mat);
    m.frustumCulled = false;
    this.scene.add(m);
    this.post = new Post({
      dof: false,
      maxCoc: 0,
      bloomStrength: 0.45,
      bloomSpread: 0.8,
      threshold: 0.35,
      knee: 0.3,
      exposure: 1.05,
      vignette: 0.25,
      grain: 0.015,
    });
  }
  render(gl: THREE.WebGLRenderer, frame: number) {
    const fm = ((frame % RIBBONS_LOOP) + RIBBONS_LOOP) % RIBBONS_LOOP;
    this.post.render(
      gl,
      (target) => {
        this.mat.uniforms.resolution.value.set(target.width, target.height);
        this.mat.uniforms.u.value = fm / RIBBONS_LOOP;
        gl.setRenderTarget(target);
        gl.setClearColor(0x000000, 1);
        gl.clear(true, true, false);
        gl.render(this.scene, this.cam);
      },
      fm,
    );
  }
  dispose() {
    this.post.dispose();
    this.mat.dispose();
  }
}

export const NeonRibbons: React.FC<{ version: RibbonsVersion }> = ({ version }) => (
  <GLStage create={() => new RibbonsWorld(version)} deps={[version]} />
);
