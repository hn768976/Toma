import { Color, Mesh, OrthographicCamera, PlaneGeometry, Scene, ShaderMaterial, Vector2, WebGLRenderer } from "three";
import { GradeParams, makePipeline } from "../lib/post";
import { mod } from "../lib/random";
import type { LookRuntime } from "../lib/GLStage";

export type StageBeamsParams = {
  beam: string;
  fringe: string;
  pool: string;
  background: string;
  grade: GradeParams;
  loop: number;
};

// One full-screen fragment shader. Smoke is fbm of 3D gradient noise whose
// lattice wraps in y and z, so sampling it at (x, y - t, t) walks a closed
// loop through noise space (time on a circle): upward drift and slow
// evolution that repeat exactly every 600 frames.
const frag = /* glsl */ `
precision highp float;
uniform vec2 uRes;
uniform float uT;      // loop phase 0..1
uniform float uA1;     // beam 1 angle (radians from straight down)
uniform float uA2;     // beam 2 angle
uniform vec3 uBeam;
uniform vec3 uFringe;
uniform vec3 uPool;
uniform vec3 uBg;
varying vec2 vUv;

vec3 hash3(ivec3 p) {
  uvec3 q = uvec3(p) * uvec3(1597334673u, 3812015801u, 2798796415u);
  q = (q.x ^ q.y ^ q.z) * uvec3(1597334673u, 3812015801u, 2798796415u);
  return vec3(q) * (2.0 / 4294967295.0) - 1.0;
}
// Gradient noise, lattice periodic in y (py) and z (pz).
float gnoise(vec3 x, int py, int pz) {
  vec3 i = floor(x);
  vec3 f = x - i;
  vec3 u = f * f * f * (f * (f * 6.0 - 15.0) + 10.0);
  ivec3 b = ivec3(i);
  float n = 0.0;
  float v[8];
  for (int k = 0; k < 8; k++) {
    ivec3 o = ivec3(k & 1, (k >> 1) & 1, (k >> 2) & 1);
    ivec3 c = b + o;
    c.y = ((c.y % py) + py) % py;
    c.z = ((c.z % pz) + pz) % pz;
    v[k] = dot(hash3(c), f - vec3(o));
  }
  float x00 = mix(v[0], v[1], u.x);
  float x10 = mix(v[2], v[3], u.x);
  float x01 = mix(v[4], v[5], u.x);
  float x11 = mix(v[6], v[7], u.x);
  return mix(mix(x00, x10, u.y), mix(x01, x11, u.y), u.z);
}
// fbm; each octave doubles the lattice period, so every octave still wraps.
float fbm(vec2 p, float scale, float tDrift, float tEvo, int py, int pz) {
  float a = 0.5;
  float s = 0.0;
  float fr = 1.0;
  int qy = py;
  int qz = pz;
  for (int o = 0; o < 5; o++) {
    vec3 q = vec3(p.x * scale * fr + float(o) * 17.3,
                  p.y * scale * fr - tDrift * float(qy),
                  tEvo * float(qz));
    s += a * gnoise(q, qy, qz);
    fr *= 2.0;
    a *= 0.5;
    qy *= 2;
    qz *= 2;
  }
  return s;
}

float beam(vec2 p, vec2 L, float ang, out float along, out float acrossN) {
  vec2 D = vec2(sin(ang), -cos(ang));
  vec2 v = p - L;
  along = dot(v, D);
  float across = abs(v.x * D.y - v.y * D.x);
  float w = 0.012 + max(along, 0.0) * 0.15;
  acrossN = across / w;
  float cone = exp(-acrossN * acrossN * 1.4);
  float fall = 0.32 / (0.22 + along * along * 1.6);
  return along > 0.0 ? cone * fall : 0.0;
}

void main() {
  float A = uRes.x / uRes.y;
  vec2 p = vec2(vUv.x * A, vUv.y);
  float cx = A * 0.5;
  // Smoke densities.
  float sm = fbm(p, 3.0, uT, uT, 3, 2);           // drifts up one lattice period per loop
  float wisp = fbm(p + vec2(3.1, 0.0), 6.0, uT, uT, 6, 2);
  float smoke = clamp(0.5 + 1.25 * sm + 0.75 * wisp, 0.0, 1.8);
  float wispy = smoothstep(0.05, 0.4, abs(wisp)) ;

  // Beams from two lamps just above the top edge.
  vec2 L1 = vec2(cx - 0.065, 1.16);
  vec2 L2 = vec2(cx + 0.065, 1.16);
  float al1, an1, al2, an2;
  float b1 = beam(p, L1, uA1, al1, an1);
  float b2 = beam(p, L2, uA2, al2, an2);
  float floorCut = smoothstep(0.07, 0.17, p.y);
  float beams = (b1 + b2) * floorCut;
  vec3 col = uBg;
  col += uBeam * beams * (0.25 + 0.75 * smoke) * 0.62;
  // Warm fringe at the lamp heads (edges of the cone, very top).
  float fr1 = exp(-max(al1, 0.0) / 0.13) * smoothstep(0.2, 1.1, an1) * exp(-an1 * an1 * 0.5);
  float fr2 = exp(-max(al2, 0.0) / 0.13) * smoothstep(0.2, 1.1, an2) * exp(-an2 * an2 * 0.5);
  col += uFringe * (fr1 + fr2) * 1.4;
  col += mix(uBeam, vec3(1.0), 0.4) * (exp(-max(al1, 0.0) / 0.05) * exp(-an1 * an1) + exp(-max(al2, 0.0) / 0.05) * exp(-an2 * an2)) * 0.35;

  // Ambient haze lit by the beams, very low.
  col += uBeam * 0.02 * smoke * smoothstep(1.0, 0.2, length((p - vec2(cx, 0.55)) * vec2(0.6, 1.0)));

  // Thin smoke column rising in the centre.
  float y = p.y;
  float wig = 0.018 * sin(y * 9.0 - 6.28318530718 * uT * 3.0) + 0.012 * sin(y * 23.0 + 1.7 - 6.28318530718 * uT * 5.0) + 0.03 * sm;
  float colX = (p.x - (cx - 0.02) - wig) / (0.01 + 0.03 * (1.0 - y));
  float column = exp(-colX * colX) * smoothstep(0.12, 0.3, y) * smoothstep(0.85, 0.45, y);
  column *= clamp(0.3 + 1.2 * wisp + 0.6 * sm, 0.0, 1.2);
  col += mix(uBeam, vec3(1.0), 0.3) * column * 0.11;

  // Low glowing pool of haze along the bottom fifth, brightest under the beams.
  float hit1 = L1.x + (L1.y - 0.13) * tan(uA1);
  float hit2 = L2.x + (L2.y - 0.13) * tan(uA2);
  float band = exp(-pow((y - 0.135) / 0.032, 2.0));
  float spread = exp(-pow((p.x - cx) / (A * 0.4), 4.0));
  float under = exp(-pow((p.x - hit1) / 0.2, 2.0)) + exp(-pow((p.x - hit2) / 0.2, 2.0));
  float poolTex = fbm(vec2(p.x * 0.7, p.y * 3.0) + vec2(5.0, 0.0), 3.0, uT, uT, 3, 2);
  float pool = band * spread * (0.35 + 0.9 * under) * clamp(0.65 + 1.1 * poolTex, 0.15, 1.6);
  col += uPool * pool * 0.75;
  // Darker floor below the pool.
  col *= mix(1.0, 0.55, smoothstep(0.1, 0.0, y));
  // Heavy vignette, but keep the lamp heads at the top centre bright.
  vec2 vq = vec2((p.x - cx) / A, y - 0.6);
  col *= mix(1.0, 0.25, smoothstep(0.25, 0.75, length(vq * vec2(1.25, 1.0))));
  gl_FragColor = vec4(col, 1.0);
}
`;
const vert = /* glsl */ `
varying vec2 vUv;
void main() {
  vUv = uv;
  gl_Position = vec4(position.xy, 0.0, 1.0);
}
`;

export const buildStageBeams = (gl: WebGLRenderer, p: StageBeamsParams): LookRuntime => {
  const size = gl.getDrawingBufferSize(new Vector2());
  const scene = new Scene();
  const camera = new OrthographicCamera(-1, 1, 1, -1, 0, 1);
  const lin = (hex: string) => new Color(hex); // Color() converts sRGB hex to linear
  const mat = new ShaderMaterial({
    vertexShader: vert,
    fragmentShader: frag,
    uniforms: {
      uRes: { value: new Vector2(size.x, size.y) },
      uT: { value: 0 },
      uA1: { value: 0 },
      uA2: { value: 0 },
      uBeam: { value: lin(p.beam) },
      uFringe: { value: lin(p.fringe) },
      uPool: { value: lin(p.pool) },
      uBg: { value: lin(p.background) },
    },
    depthTest: false,
    depthWrite: false,
  });
  const quad = new Mesh(new PlaneGeometry(2, 2), mat);
  quad.frustumCulled = false;
  scene.add(quad);
  const pipe = makePipeline(gl, scene, camera, {
    grade: { ...p.grade, toneMap: false },
    multisampling: 0,
  });
  const deg = Math.PI / 180;
  return {
    render: (frame) => {
      const f = mod(frame, p.loop);
      // Each beam swings +-6 degrees on a cosine: periods 600 and 300 frames.
      mat.uniforms.uA1.value = 22 * deg + 6 * deg * Math.cos((2 * Math.PI * f) / 600);
      mat.uniforms.uA2.value = -22 * deg + 6 * deg * Math.cos((2 * Math.PI * mod(f, 300)) / 300 + 1.1);
      mat.uniforms.uT.value = f / p.loop;
      pipe.final.set("seed", f);
      pipe.render();
    },
    dispose: () => pipe.dispose(),
  };
};
