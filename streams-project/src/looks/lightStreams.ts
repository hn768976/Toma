import { Container, Geometry, Mesh, Renderer, RenderTexture, Shader } from "pixi.js";
import * as THREE from "three";
import { PixiLook } from "../lib/PixiStage";
import { mulberry32, range, TAU } from "../lib/random";

// Look 1 — Light Streams. ~6,000 spiral strands × 64 points, projected and
// coloured in the vertex shader, drawn as analytic-AA ribbons (additive), plus
// ~2,000 sparks riding the strands, a two-level glow, and the final grade.

export type LightStreamsProps = {
  gradient: [string, string, string];
  seed: number;
};

const STRANDS = 6000;
const POINTS = 64;
const SPARKS = 2000;
const LOOP = 600;
const SPIRAL_K = 0.5;
const THETA_REF = 2.79;

// Strand data: module-level seeded generation (identical on every thread).
type StrandSet = { a: Float32Array; b: Float32Array }; // 2 × vec4 per strand
const strandCache = new Map<number, StrandSet>();
const strands = (seed: number): StrandSet => {
  const hit = strandCache.get(seed);
  if (hit) return hit;
  const rng = mulberry32(seed);
  const a = new Float32Array(STRANDS * 4);
  const b = new Float32Array(STRANDS * 4);
  for (let i = 0; i < STRANDS; i++) {
    // Each strand is a segment of a log spiral around the hidden centre.
    // R (1.0–1.4) names the spiral (its radius at the reference angle); the
    // segment starts at s0 radians along it and runs len radians inwards.
    const outer = rng() < 0.55;
    const R = outer ? 1.0 + 0.4 * Math.pow(rng(), 0.7) : range(rng, 0.22, 1.0);
    const s0 = range(rng, -2.4, 2.4);
    const len = range(rng, 1.0, 2.2);
    const k = SPIRAL_K * range(rng, 0.88, 1.12);
    a.set([R, s0, len, k], i * 4);
    const h0 = (rng() - 0.5) * 0.05 * R;
    const wob = range(rng, 0.002, 0.012);
    const phase = rng();
    const bright = Math.pow(rng(), 1.6) * 0.95 + 0.05;
    b.set([h0, wob, phase, bright], i * 4);
  }
  const s = { a, b };
  strandCache.set(seed, s);
  return s;
};

const hexToVec = (hex: string): [number, number, number] => {
  const c = new THREE.Color(hex); // sRGB → linear
  return [c.r, c.g, c.b];
};

const STRAND_FN = /* glsl */ `
uniform float uSpin;
float sAt(vec4 A, float u) { return A.y + A.z * u; }
float rAt(vec4 A, float u) { return A.x * exp(-A.w * sAt(A, u)); }
vec3 strandPos(vec4 A, vec4 B, float u) {
  float s = sAt(A, u);
  float th = ${THETA_REF.toFixed(4)} - s + uSpin;
  float r = A.x * exp(-A.w * s);
  float y = (B.x + B.y * sin(6.2831853 * (u * 1.7 + B.z))) * min(1.0, r);
  return vec3(r * cos(th), y, -r * sin(th));
}
vec3 gradient(float g) {
  g = clamp(g, 0.0, 1.0);
  return g < 0.5 ? mix(uC0, uC1, g * 2.0) : mix(uC1, uC2, g * 2.0 - 2.0 * 0.5);
}
`;

const STRAND_UNIFORMS = /* glsl */ `
uniform mat4 uViewProj;
uniform vec2 uRes;
uniform float uT;
uniform float uWidth;
uniform vec3 uC0;
uniform vec3 uC1;
uniform vec3 uC2;
uniform vec2 uThetaRange;
`;

const STRAND_VERT = /* glsl */ `#version 300 es
precision highp float;
in vec2 aPosition; // u, side
in vec4 aA;
in vec4 aB;
${STRAND_UNIFORMS}
${STRAND_FN}
out float vDist;
out float vHalf;
out vec3 vColor;
void main() {
  float u = aPosition.x;
  float side = aPosition.y;
  vec4 c0 = uViewProj * vec4(strandPos(aA, aB, u), 1.0);
  vec4 c1 = uViewProj * vec4(strandPos(aA, aB, u + 0.01), 1.0);
  vec2 p0 = c0.xy / c0.w * 0.5 * uRes;
  vec2 p1 = c1.xy / c1.w * 0.5 * uRes;
  vec2 d = p1 - p0;
  d = length(d) > 1e-5 ? normalize(d) : vec2(1.0, 0.0);
  vec2 n = vec2(-d.y, d.x);
  // width: constant in pixels, slightly wider when nearer the camera
  float hw = uWidth * clamp(1.4 / c0.w, 0.7, 2.6);
  float hq = max(hw, 0.5);
  float wq = hq + 1.0;
  c0.xy += n * side * wq / (0.5 * uRes) * c0.w;
  gl_Position = c0;
  vDist = side * wq;
  vHalf = hq;
  // sub-pixel lines keep a ≥1px footprint but lose energy instead (no shimmer)
  float energy = hw / hq;

  // flow: brightness texture sliding along u; whole cycles per loop
  float t = uT;
  float s1 = 0.5 + 0.5 * sin(6.2831853 * (u * 2.3 + aB.z - t * 4.0));
  float s2 = 0.5 + 0.5 * sin(6.2831853 * (u * 5.1 + aB.z * 3.0 - t * 9.0));
  float flow = 0.03 + 0.97 * pow(s1, 5.0) * (0.3 + 0.7 * s2);
  float taper = smoothstep(0.0, 0.18, u) * smoothstep(1.0, 0.75, u);
  float sp = sAt(aA, u);
  float rn = clamp((aA.x - 0.22) / 1.18, 0.0, 1.0);
  float inward = exp(-0.35 * max(sp - 1.2, 0.0));
  float g = (sp - uThetaRange.x) / (uThetaRange.y - uThetaRange.x);
  float radial = mix(mix(0.42, 0.2, clamp(g, 0.0, 1.0)), 1.0, pow(rn, 2.2)) * inward * 0.75;
  // crisp bright rim along the outer edge of the band
  radial *= 1.0 + 1.6 * smoothstep(1.3, 1.4, aA.x);
  vec3 col = gradient(g) * mix(1.7, 0.95, clamp(g, 0.0, 1.0));
  // darker and deeper inside the band
  col = mix(col * vec3(0.55, 0.35, 0.75), col, rn);
  vColor = col * flow * taper * radial * aB.w * energy;
}`;

const STRAND_FRAG = /* glsl */ `#version 300 es
precision highp float;
in float vDist;
in float vHalf;
in vec3 vColor;
out vec4 finalColor;
void main() {
  float cov = clamp(vHalf + 0.5 - abs(vDist), 0.0, 1.0);
  finalColor = vec4(vColor * cov, 0.0);
}`;

const SPARK_VERT = /* glsl */ `#version 300 es
precision highp float;
in vec2 aPosition; // corner
in vec4 aA;
in vec4 aB;
in vec4 aS; // u0, speed (int), twinkle (int), phase
${STRAND_UNIFORMS}
${STRAND_FN}
out vec2 vCorner;
out vec3 vColor;
out float vR;
void main() {
  float u = fract(aS.x + uT * aS.y);
  vec4 c = uViewProj * vec4(strandPos(aA, aB, u), 1.0);
  float size = uWidth * (1.0 + 0.9 * fract(aS.w * 7.13)) * clamp(1.3 / c.w, 0.75, 1.6);
  float rq = max(size, 0.75) + 1.0;
  c.xy += aPosition * rq / (0.5 * uRes) * c.w;
  gl_Position = c;
  vCorner = aPosition * rq;
  vR = max(size, 0.75);
  float tw = 0.5 + 0.5 * sin(6.2831853 * (uT * aS.z + aS.w));
  float fade = smoothstep(0.0, 0.1, u) * smoothstep(1.0, 0.85, u);
  float sp = sAt(aA, u);
  float rn = clamp((aA.x - 0.22) / 1.18, 0.0, 1.0) * exp(-0.6 * max(sp - 0.9, 0.0));
  float g = (sp - uThetaRange.x) / (uThetaRange.y - uThetaRange.x);
  vec3 col = mix(gradient(g), vec3(1.0, 0.4, 0.2), 0.55);
  vColor = col * (0.9 + 3.2 * pow(tw, 3.0)) * fade * mix(0.35, 1.0, rn) * (size / vR);
}`;

const SPARK_FRAG = /* glsl */ `#version 300 es
precision highp float;
in vec2 vCorner;
in vec3 vColor;
in float vR;
out vec4 finalColor;
void main() {
  float d = length(vCorner);
  float cov = clamp(vR + 0.5 - d, 0.0, 1.0);
  finalColor = vec4(vColor * cov * cov, 0.0);
}`;

const FS_VERT = /* glsl */ `#version 300 es
precision highp float;
in vec2 aPosition;
out vec2 vUv;
void main() {
  vUv = aPosition * 0.5 + 0.5;
  gl_Position = vec4(aPosition, 0.0, 1.0);
}`;

const DOWN_FRAG = /* glsl */ `#version 300 es
precision highp float;
in vec2 vUv;
uniform sampler2D uTex;
uniform vec2 uTexel; // source texel
out vec4 finalColor;
void main() {
  vec3 s = vec3(0.0);
  for (int y = 0; y < 2; y++)
    for (int x = 0; x < 2; x++)
      s += texture(uTex, vUv + (vec2(float(x), float(y)) - 0.5) * 2.0 * uTexel).rgb;
  finalColor = vec4(s * 0.25, 1.0);
}`;

const BLUR_FRAG = /* glsl */ `#version 300 es
precision highp float;
in vec2 vUv;
uniform sampler2D uTex;
uniform vec2 uDir; // texel step
out vec4 finalColor;
void main() {
  vec3 s = texture(uTex, vUv).rgb;
  float wsum = 1.0;
  for (int i = 1; i <= 12; i++) {
    float x = float(i);
    float w = exp(-x * x / (2.0 * 5.0 * 5.0));
    s += (texture(uTex, vUv + uDir * x).rgb + texture(uTex, vUv - uDir * x).rgb) * w;
    wsum += 2.0 * w;
  }
  finalColor = vec4(s / wsum, 1.0);
}`;

const FINAL_FRAG = /* glsl */ `#version 300 es
precision highp float;
precision highp int;
in vec2 vUv;
uniform sampler2D uMain;
uniform sampler2D uGlowA;
uniform sampler2D uGlowB;
uniform vec3 uGlow; // gains
uniform int uFrame;
uniform vec2 uRes;
uniform vec3 uHaze;
out vec4 finalColor;
uint pcgHash(uint v) {
  uint state = v * 747796405u + 2891336453u;
  uint word = ((state >> ((state >> 28u) + 4u)) ^ state) * 277803737u;
  return (word >> 22u) ^ word;
}
float hash3(uvec3 p) {
  return float(pcgHash(p.x + pcgHash(p.y + pcgHash(p.z)))) / 4294967295.0;
}
vec3 toSrgb(vec3 c) {
  c = clamp(c, 0.0, 1.0);
  return mix(c * 12.92, 1.055 * pow(c, vec3(1.0 / 2.4)) - 0.055, step(0.0031308, c));
}
void main() {
  vec3 col = texture(uMain, vUv).rgb * uGlow.x
           + texture(uGlowA, vUv).rgb * uGlow.y
           + texture(uGlowB, vUv).rgb * uGlow.z;
  col += uHaze * texture(uGlowB, vUv).rgb;
  // soft shoulder: keeps hue on hot strands, rolls to near-white
  col = 1.0 - exp(-col * 1.15);
  col = mix(col, vec3(dot(col, vec3(0.3333))), -0.08);
  vec3 s = toSrgb(col);
  uvec3 p = uvec3(uvec2(gl_FragCoord.xy), uint(uFrame));
  float g = hash3(p) + hash3(p + uvec3(0u, 0u, 7919u)) - 1.0;
  float lum = dot(s, vec3(0.2126, 0.7152, 0.0722));
  // grain fades to zero below ~3% luminance (keeps the black clean)
  s += g * 0.015 * smoothstep(0.02, 0.045, lum);
  float d = hash3(p + uvec3(0u, 0u, 104729u)) + hash3(p + uvec3(0u, 0u, 1299709u)) - 1.0;
  s += d / 255.0 * smoothstep(0.0, 0.004, lum);
  finalColor = vec4(clamp(s, 0.0, 1.0), 1.0);
}`;

const fsGeometry = () =>
  new Geometry({
    attributes: { aPosition: { buffer: new Float32Array([-1, -1, 3, -1, -1, 3]), format: "float32x2" } },
    indexBuffer: new Uint32Array([0, 1, 2]),
  });

export const createLightStreams =
  (props: LightStreamsProps) =>
  (renderer: Renderer, W: number, H: number): PixiLook => {
    const { a, b } = strands(props.seed);
    const rng = mulberry32(props.seed + 77);

    // ---- strand ribbons ----
    const vCount = STRANDS * POINTS * 2;
    const pos = new Float32Array(vCount * 2);
    const A = new Float32Array(vCount * 4);
    const B = new Float32Array(vCount * 4);
    const idx = new Uint32Array(STRANDS * (POINTS - 1) * 6);
    let v = 0,
      k = 0;
    for (let s = 0; s < STRANDS; s++) {
      const base = v;
      for (let p = 0; p < POINTS; p++) {
        const u = p / (POINTS - 1);
        for (const side of [-1, 1]) {
          pos[v * 2] = u;
          pos[v * 2 + 1] = side;
          A.set(a.subarray(s * 4, s * 4 + 4), v * 4);
          B.set(b.subarray(s * 4, s * 4 + 4), v * 4);
          v++;
        }
        if (p < POINTS - 1) {
          const i0 = base + p * 2;
          idx.set([i0, i0 + 1, i0 + 2, i0 + 1, i0 + 3, i0 + 2], k);
          k += 6;
        }
      }
    }
    const strandGeo = new Geometry({
      attributes: {
        aPosition: { buffer: pos, format: "float32x2" },
        aA: { buffer: A, format: "float32x4" },
        aB: { buffer: B, format: "float32x4" },
      },
      indexBuffer: idx,
    });

    const camera = new THREE.PerspectiveCamera(38, W / H, 0.05, 50);
    const vp = new THREE.Matrix4();
    const uniforms = () => ({
      uViewProj: { value: new Float32Array(16), type: "mat4x4<f32>" as const },
      uRes: { value: new Float32Array([W, H]), type: "vec2<f32>" as const },
      uT: { value: 0, type: "f32" as const },
      uSpin: { value: 0, type: "f32" as const },
      uWidth: { value: (0.95 * H) / 720, type: "f32" as const },
      uC0: { value: new Float32Array(hexToVec(props.gradient[0])), type: "vec3<f32>" as const },
      uC1: { value: new Float32Array(hexToVec(props.gradient[1])), type: "vec3<f32>" as const },
      uC2: { value: new Float32Array(hexToVec(props.gradient[2])), type: "vec3<f32>" as const },
      uThetaRange: { value: new Float32Array([-0.2, 1.5]), type: "vec2<f32>" as const },
    });
    const strandShader = Shader.from({
      gl: { vertex: STRAND_VERT, fragment: STRAND_FRAG, name: "strands" },
      resources: { su: uniforms() },
    });
    const strandMesh = new Mesh({ geometry: strandGeo, shader: strandShader });
    strandMesh.blendMode = "add";

    // ---- sparks ----
    const spV = SPARKS * 4;
    const spPos = new Float32Array(spV * 2);
    const spA = new Float32Array(spV * 4);
    const spB = new Float32Array(spV * 4);
    const spS = new Float32Array(spV * 4);
    const spIdx = new Uint32Array(SPARKS * 6);
    const corners = [-1, -1, 1, -1, 1, 1, -1, 1];
    for (let i = 0; i < SPARKS; i++) {
      // bias sparks towards bright outer strands
      let s = Math.floor(rng() * STRANDS);
      while (a[s * 4 + 1] > 1.2) s = Math.floor(rng() * STRANDS);
      if (a[s * 4] < 1.15 && rng() < 0.6) s = Math.floor(rng() * STRANDS);
      const u0 = rng();
      const speed = 1 + Math.floor(rng() * 3); // whole traversals per loop
      const tw = 2 + Math.floor(rng() * 8); // whole twinkles per loop
      const ph = rng();
      for (let c = 0; c < 4; c++) {
        const vi = i * 4 + c;
        spPos[vi * 2] = corners[c * 2];
        spPos[vi * 2 + 1] = corners[c * 2 + 1];
        spA.set(a.subarray(s * 4, s * 4 + 4), vi * 4);
        spB.set(b.subarray(s * 4, s * 4 + 4), vi * 4);
        spS.set([u0, speed, tw, ph], vi * 4);
      }
      const o = i * 4;
      spIdx.set([o, o + 1, o + 2, o, o + 2, o + 3], i * 6);
    }
    const sparkGeo = new Geometry({
      attributes: {
        aPosition: { buffer: spPos, format: "float32x2" },
        aA: { buffer: spA, format: "float32x4" },
        aB: { buffer: spB, format: "float32x4" },
        aS: { buffer: spS, format: "float32x4" },
      },
      indexBuffer: spIdx,
    });
    const sparkShader = Shader.from({
      gl: { vertex: SPARK_VERT, fragment: SPARK_FRAG, name: "sparks" },
      resources: { su: uniforms() },
    });
    const sparkMesh = new Mesh({ geometry: sparkGeo, shader: sparkShader });
    sparkMesh.blendMode = "add";

    const sceneRoot = new Container();
    sceneRoot.addChild(strandMesh, sparkMesh);

    // ---- glow chain ----
    const rt = (w: number, h: number) =>
      {
      const r = RenderTexture.create({ width: w, height: h, format: "rgba16float" });
      r.source.style.scaleMode = "linear";
      r.source.style.addressMode = "clamp-to-edge";
      return r;
    }
    const qW = Math.ceil(W / 4),
      qH = Math.ceil(H / 4);
    const sW = Math.ceil(W / 16),
      sH = Math.ceil(H / 16);
    const main = rt(W, H);
    const q1 = rt(qW, qH),
      q2 = rt(qW, qH);
    const s1 = rt(sW, sH),
      s2 = rt(sW, sH);
    const qHalf = rt(Math.ceil(W / 2), Math.ceil(H / 2));
    const s8 = rt(Math.ceil(W / 8), Math.ceil(H / 8));

    const fsPass = (frag: string, res: Record<string, unknown>) => {
      const m = new Mesh({
        geometry: fsGeometry(),
        shader: Shader.from({ gl: { vertex: FS_VERT, fragment: frag }, resources: res }),
      });
      const c = new Container();
      c.addChild(m);
      return { c, m };
    };
    const down = (src: RenderTexture, sw: number, sh: number) =>
      fsPass(DOWN_FRAG, {
        uTex: src.source,
        du: { uTexel: { value: new Float32Array([1 / sw, 1 / sh]), type: "vec2<f32>" } },
      });
    const blur = (src: RenderTexture, dx: number, dy: number) =>
      fsPass(BLUR_FRAG, {
        uTex: src.source,
        bu: { uDir: { value: new Float32Array([dx, dy]), type: "vec2<f32>" } },
      });
    const passes: [Container, RenderTexture | null][] = [];
    passes.push([down(main, W, H).c, qHalf]);
    passes.push([down(qHalf, W / 2, H / 2).c, q1]);
    passes.push([blur(q1, 1 / qW, 0).c, q2]);
    passes.push([blur(q2, 0, 1 / qH).c, q1]);
    passes.push([down(q1, qW, qH).c, s8]);
    passes.push([down(s8, W / 8, H / 8).c, s1]);
    passes.push([blur(s1, 1 / sW, 0).c, s2]);
    passes.push([blur(s2, 0, 1 / sH).c, s1]);
    const fin = fsPass(FINAL_FRAG, {
      uMain: main.source,
      uGlowA: q1.source,
      uGlowB: s1.source,
      fu: {
        uGlow: { value: new Float32Array([1.05, 0.3, 0.05]), type: "vec3<f32>" },
        uFrame: { value: 0, type: "i32" },
        uRes: { value: new Float32Array([W, H]), type: "vec2<f32>" },
        uHaze: { value: new Float32Array([0.0, 0.0, 0.0]), type: "vec3<f32>" },
      },
    });
    const finUniforms = (fin.m.shader!.resources.fu as { uniforms: { uFrame: number } }).uniforms;

    const su = [strandShader, sparkShader].map(
      (sh) =>
        (sh.resources.su as { uniforms: { uViewProj: Float32Array; uT: number; uSpin: number } })
          .uniforms,
    );

    return {
      render(frame: number) {
        const f = ((frame % LOOP) + LOOP) % LOOP;
        const t = f / LOOP;
        // fixed camera with a slow closed tilt (±1°)
        const tilt = (Math.PI / 180) * Math.sin(TAU * t);
        camera.aspect = W / H;
        camera.fov = 31;
        camera.position.set(-0.233, 0.862, 0.808);
        camera.up.set(0, 1, 0);
        camera.lookAt(-0.40, 0.0, -0.25);
        camera.rotateY(0.1);
        camera.rotateZ(0.3 + tilt * 0.6);
        camera.rotateX(0.1 + tilt);
        camera.updateMatrixWorld();
        camera.updateProjectionMatrix();
        vp.multiplyMatrices(camera.projectionMatrix, camera.matrixWorldInverse);
        for (const u of su) {
          u.uViewProj.set(vp.elements);
          u.uT = t;
          u.uSpin = 0;
        }
        finUniforms.uFrame = f;
        renderer.render({ container: sceneRoot, target: main, clear: true, clearColor: [0, 0, 0, 1] });
        for (const [c, target] of passes) {
          renderer.render({ container: c, target: target!, clear: true, clearColor: [0, 0, 0, 1] });
        }
        renderer.render({ container: fin.c, clear: true, clearColor: [0, 0, 0, 1] });
      },
      destroy() {
        sceneRoot.destroy({ children: true });
        [main, q1, q2, s1, s2, qHalf, s8].forEach((r) => r.destroy(true));
      },
    };
  };
