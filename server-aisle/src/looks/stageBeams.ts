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
  float w = 0.012 + max(along, 0.0) * 0.095;
  acrossN = across / w;
  float cone = exp(-acrossN * acrossN * 1.4);
  float fall = 0.42 / (0.16 + along * along * 2.6);
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

  // Two lamps just above the top edge. Their beams cross a little above the
  // frame (they "drift in and out of crossing" as they sway) and diverge into
  // two separate cones with a dark gap between the lamp heads.
  vec2 L1 = vec2(cx + 0.075, 1.35);
  vec2 L2 = vec2(cx - 0.045, 1.35);
  float al1, an1, al2, an2;
  float b1 = beam(p, L1, uA1, al1, an1);
  float b2 = beam(p, L2, uA2, al2, an2);
  // Beams fade out by about half height, as in the reference.
  float floorCut = smoothstep(0.07, 0.17, p.y) * (0.08 + 0.92 * smoothstep(0.32, 0.85, p.y));
  float beams = (b1 + b2) * floorCut;
  vec3 col = uBg;
  // Navy haze lift across the frame.
  col += uBeam * 0.007 * (0.5 + 0.8 * smoke);
  // Faint drifting wisps everywhere (ridged noise), strongest right of centre.
  float ridge = 1.0 - abs(sm * 1.6);
  ridge = ridge * ridge * ridge * ridge * ridge * ridge;
  col += uBeam * 0.014 * ridge * (0.5 + 0.8 * exp(-pow((p.x - cx - 0.35) / 0.4, 2.0)));
  col += uBeam * beams * (0.2 + 0.8 * smoke) * 1.0;
  // Small warm cores at the very top of each beam (the lamp heads).
  float top = exp(-max(1.0 - p.y, 0.0) / 0.035);
  float fr1 = top * exp(-an1 * an1 * 0.9) * step(0.0, al1);
  float fr2 = top * exp(-an2 * an2 * 0.9) * step(0.0, al2);
  col += uFringe * (fr1 * 0.75 + fr2 * 1.0) * 0.85;
  // Cool glow at the top centre, between and behind the lamp heads.
  col += mix(uBeam, vec3(1.0), 0.2) * 0.06 * exp(-pow((p.x - cx) / 0.16, 2.0)) * exp(-max(1.0 - p.y, 0.0) / 0.12);
  float head = exp(-max(1.0 - p.y, 0.0) / 0.12);
  col += mix(uBeam, vec3(1.0), 0.35) * (exp(-an1 * an1 * 1.5) + exp(-an2 * an2 * 1.5)) * head * 0.12;

  // Thin smoke column rising in the centre.
  float y = p.y;
  float wig = 0.018 * sin(y * 9.0 - 6.28318530718 * uT * 3.0) + 0.012 * sin(y * 23.0 + 1.7 - 6.28318530718 * uT * 5.0) + 0.03 * sm;
  float colX = (p.x - (cx - 0.02) - wig) / (0.01 + 0.03 * (1.0 - y));
  float column = exp(-colX * colX) * smoothstep(0.12, 0.3, y) * smoothstep(0.85, 0.45, y);
  column *= clamp(0.3 + 1.2 * wisp + 0.6 * sm, 0.0, 1.2);
  col += mix(uBeam, vec3(1.0), 0.3) * column * 0.045;

  // Low glowing pool of haze along the bottom fifth, brightest under the beams.
  float hit1 = L1.x + (L1.y - 0.13) * tan(uA1);
  float hit2 = L2.x + (L2.y - 0.13) * tan(uA2);
  float band = exp(-pow((y - 0.14) / 0.04, 2.0));
  float spread = exp(-pow((p.x - cx) / (A * 0.4), 4.0));
  float under = 1.5 * (exp(-pow((p.x - hit1) / 0.2, 2.0)) + exp(-pow((p.x - hit2) / 0.2, 2.0)));
  float poolTex = fbm(vec2(p.x * 0.7, p.y * 3.0) + vec2(5.0, 0.0), 3.0, uT, uT, 3, 2);
  float mott = fbm(vec2(p.x * 1.6, p.y * 5.0) + vec2(1.3, 0.0), 3.0, uT, uT, 3, 2);
  float pool = band * spread * (0.3 + 0.9 * under) * clamp(0.45 + 2.2 * poolTex + 1.3 * mott, 0.0, 2.2);
  col += uPool * pool * 1.6;
  // Dim haze continues below the pool.
  col += uPool * 0.035 * smoothstep(0.16, 0.0, y) * spread * clamp(0.6 + poolTex, 0.0, 1.5);
  // Heavy vignette, but keep the lamp heads at the top centre bright.
  vec2 vq = vec2((p.x - cx) / A, y - 0.6);
  col *= mix(1.0, 0.32, smoothstep(0.28, 0.75, length(vq * vec2(1.35, 1.0))));
  // Sparse dust specks drifting with the smoke (fixed formula of position and loop phase).
  vec2 sp = floor(vUv * uRes / 2.0);
  float spk = fract(sin(dot(sp + floor(vec2(0.0, uT * 60.0)), vec2(12.9898, 78.233))) * 43758.5453);
  col += uBeam * 0.05 * step(0.9985, spk) * (0.4 + smoke);
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
      // Beam 1 (from the right lamp) points down-left, beam 2 down-right.
      mat.uniforms.uA1.value = -30 * deg + 6 * deg * Math.cos((2 * Math.PI * f) / 600);
      mat.uniforms.uA2.value = 30 * deg + 6 * deg * Math.cos((2 * Math.PI * mod(f, 300)) / 300 + 1.1);
      mat.uniforms.uT.value = f / p.loop;
      pipe.final.set("seed", f);
      pipe.render();
    },
    dispose: () => pipe.dispose(),
  };
};
