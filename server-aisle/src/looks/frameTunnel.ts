import {
  BoxGeometry,
  Color,
  CurvePath,
  InstancedBufferAttribute,
  InstancedMesh,
  Mesh,
  PlaneGeometry,
  LineCurve3,
  Matrix4,
  PerspectiveCamera,
  QuadraticBezierCurve3,
  Scene,
  ShaderMaterial,
  TubeGeometry,
  Vector2,
  Vector3,
  WebGLRenderer,
} from "three";
import { GradeParams, makePipeline } from "../lib/post";
import { clamp01, hash01, mod, mulberry32, smooth } from "../lib/random";
import type { LookRuntime } from "../lib/GLStage";

export type FrameTunnelParams = {
  mode: "burst" | "loop";
  colorA: string; // frame colour (even frames)
  colorB: string; // frame colour (odd frames)
  slat: string; // slat albedo
  grade: GradeParams;
  loop: number; // loop length in frames (loop mode)
  duration: number;
};

// Tunnel dimensions (metres). Frames are 16:10 and a little smaller than the
// slatted tunnel.
const SPACING = 0.3; // frame spacing
const FRAME_A = 1.76; // half width
const FRAME_B = 1.1; // half height
const TUBE_R = 0.008;
const WALL_X = 2.12; // inner face of wall slats
const WALL_Y = 1.36; // inner face of floor / ceiling slats
const SLAT_DEPTH = 0.34;
const RIB_SPACING = SPACING * 1.5;
const N_FRAMES = 64; // frames in the scene (indices 0..N-1, k * SPACING ahead)
const N_RIBS = 48;
const K_FAR_Z = 24 * SPACING; // distance of the White Burst's first frame

const frameVert = /* glsl */ `
attribute vec3 iColor;
attribute float iIntensity;
uniform float uPixelAngle;
uniform float uTubeR;
varying vec3 vColor;
varying float vI;
varying vec3 vN;
varying vec3 vV;
varying float vDist;
void main() {
  vec4 wc = instanceMatrix * vec4(position - normal * uTubeR, 1.0);
  vec3 wn = normalize(mat3(instanceMatrix) * normal);
  vec4 vcen = viewMatrix * modelMatrix * wc;
  float depth = -vcen.z;
  // Keep the tube at least ~0.8 px thick so far frames never crawl; dim it
  // by the same factor so the glow energy stays the same.
  float r = max(uTubeR, depth * uPixelAngle * 0.8);
  vec4 wp = modelMatrix * (wc + vec4(wn * r, 0.0));
  vI = iIntensity * (uTubeR / r);
  vColor = iColor;
  vN = wn;
  vV = cameraPosition - wp.xyz;
  vDist = length(vV);
  gl_Position = projectionMatrix * viewMatrix * wp;
}
`;
const frameFrag = /* glsl */ `
uniform float uFog;
uniform vec3 uFogColor;
uniform float uWhiteCore;
varying vec3 vColor;
varying float vI;
varying vec3 vN;
varying vec3 vV;
varying float vDist;
void main() {
  float ndv = abs(dot(normalize(vN), normalize(vV)));
  float core = pow(ndv, 4.0);
  vec3 c = mix(vColor, vec3(1.0), uWhiteCore * core) * vI * (0.45 + 0.9 * core);
  c = mix(uFogColor, c, exp(-vDist * uFog));
  gl_FragColor = vec4(c, 1.0);
}
`;

const slatVert = /* glsl */ `
attribute float iShade;
varying vec3 vP;
varying vec3 vN;
varying float vShade;
void main() {
  vec4 wp = modelMatrix * instanceMatrix * vec4(position, 1.0);
  vP = wp.xyz;
  vN = normalize(mat3(modelMatrix) * mat3(instanceMatrix) * normal);
  vShade = iShade;
  gl_Position = projectionMatrix * viewMatrix * wp;
}
`;
const slatFrag = (n: number) => /* glsl */ `
#define NF ${n}
uniform float uFrameZ[NF];
uniform float uFrameI[NF];
uniform vec3 uFrameC[NF];
uniform vec2 uFrameAB;
uniform vec3 uAlbedo;
uniform float uAmbient;
uniform float uFog;
uniform float uSpec;
uniform float uSpacing;
uniform vec3 uFogColor;
varying vec3 vP;
varying vec3 vN;
varying float vShade;
void main() {
  vec3 n = normalize(vN);
  vec3 v = normalize(cameraPosition - vP);
  vec3 diff = vec3(0.0);
  vec3 spec = vec3(0.0);
  // Only frames near this slat matter: frame k sits at z = -(k - 1) * spacing.
  int kc = int(floor(-vP.z / uSpacing + 1.0 + 0.5));
  for (int j = -7; j <= 7; j++) {
    int k = kc + j;
    if (k < 0 || k >= NF) continue;
    float I = uFrameI[k];
    if (I <= 0.0) continue;
    // Nearest point on the frame's rectangular tube to this slat point.
    vec2 c = clamp(vP.xy, -uFrameAB, uFrameAB);
    vec3 q = vec3(c, uFrameZ[k]);
    vec3 L = q - vP;
    float d2 = dot(L, L);
    vec3 l = L * inversesqrt(d2 + 1e-6);
    float ndl = max(dot(n, l), 0.0);
    // A long tube light falls off slower than a point light.
    float fall = 0.075 / (d2 + 0.04) + 0.015 / sqrt(d2 + 0.04);
    vec3 col = uFrameC[k] * I;
    diff += col * ndl * fall;
    vec3 h = normalize(l + v);
    spec += col * pow(max(dot(n, h), 0.0), 60.0) * fall * ndl;
  }
  vec3 c = uAlbedo * vShade * (diff + uAmbient) + spec * uSpec;
  float dist = length(cameraPosition - vP);
  c = mix(uFogColor, c, exp(-dist * uFog));
  gl_FragColor = vec4(c, 1.0);
}
`;

const roundedRect = (a: number, b: number, r: number) => {
  const path = new CurvePath<Vector3>();
  const P = (x: number, y: number) => new Vector3(x, y, 0);
  path.add(new LineCurve3(P(-a + r, -b), P(a - r, -b)));
  path.add(new QuadraticBezierCurve3(P(a - r, -b), P(a, -b), P(a, -b + r)));
  path.add(new LineCurve3(P(a, -b + r), P(a, b - r)));
  path.add(new QuadraticBezierCurve3(P(a, b - r), P(a, b), P(a - r, b)));
  path.add(new LineCurve3(P(a - r, b), P(-a + r, b)));
  path.add(new QuadraticBezierCurve3(P(-a + r, b), P(-a, b), P(-a, b - r)));
  path.add(new LineCurve3(P(-a, b - r), P(-a, -b + r)));
  path.add(new QuadraticBezierCurve3(P(-a, -b + r), P(-a, -b), P(-a + r, -b)));
  return path;
};

// Rib (slat ring) variation, periodic every 6 ribs so the loop is exact.
const ribRng = mulberry32(0x7a11);
const RIB_VAR = Array.from({ length: 6 }, () => ({
  thick: 0.16 + 0.12 * ribRng(),
  depth: SLAT_DEPTH * (0.75 + 0.5 * ribRng()),
  shade: 0.8 + 0.4 * ribRng(),
}));

export const buildFrameTunnel = (gl: WebGLRenderer, p: FrameTunnelParams): LookRuntime => {
  const size = gl.getDrawingBufferSize(new Vector2());
  const scene = new Scene();
  scene.background = new Color(0, 0, 0);
  const fov = 50;
  const camera = new PerspectiveCamera(fov, 16 / 9, 0.05, 60);
  camera.position.set(0, 0, 0);
  camera.lookAt(0, 0, -1);
  const pixelAngle = (2 * Math.tan(((fov / 2) * Math.PI) / 180)) / size.y;
  const fog = p.mode === "burst" ? 0.07 : 0.22;

  // --- Frames --------------------------------------------------------------
  const tube = new TubeGeometry(roundedRect(FRAME_A, FRAME_B, 0.008) as never, 480, TUBE_R, 10, true);
  const frameMat = new ShaderMaterial({
    vertexShader: frameVert,
    fragmentShader: frameFrag,
    uniforms: {
      uPixelAngle: { value: pixelAngle },
      uTubeR: { value: TUBE_R },
      uFog: { value: fog },
      uFogColor: { value: new Vector3() },
      uWhiteCore: { value: p.mode === "burst" ? 0.9 : 0.25 },
    },
  });
  const frames = new InstancedMesh(tube, frameMat, N_FRAMES);
  const iColor = new InstancedBufferAttribute(new Float32Array(N_FRAMES * 3), 3);
  const iIntensity = new InstancedBufferAttribute(new Float32Array(N_FRAMES), 1);
  tube.setAttribute("iColor", iColor);
  tube.setAttribute("iIntensity", iIntensity);
  const frameZ = (k: number) => -(k + 1) * SPACING; // frame index 0 is just ahead of the start
  for (let k = 0; k < N_FRAMES; k++) frames.setMatrixAt(k, new Matrix4().makeTranslation(0, 0, frameZ(k - 2)));
  frames.frustumCulled = false;
  scene.add(frames);

  // --- Slats ---------------------------------------------------------------
  const ribBox = new BoxGeometry(1, 1, 1);
  const slatMat = new ShaderMaterial({
    vertexShader: slatVert,
    fragmentShader: slatFrag(N_FRAMES),
    uniforms: {
      uFrameZ: { value: new Array(N_FRAMES).fill(0) },
      uFrameI: { value: new Array(N_FRAMES).fill(0) },
      uFrameC: { value: Array.from({ length: N_FRAMES }, () => new Vector3()) },
      uFrameAB: { value: new Vector2(FRAME_A, FRAME_B) },
      uAlbedo: { value: new Vector3(...new Color(p.slat).toArray()) },
      uAmbient: { value: 0 },
      uFog: { value: fog },
      uSpec: { value: 0.3 },
      uSpacing: { value: SPACING },
      uFogColor: { value: new Vector3() },
    },
  });
  const slats = new InstancedMesh(ribBox, slatMat, N_RIBS * 4 + 4);
  const shade = new Float32Array(N_RIBS * 4 + 4);
  let n = 0;
  const m = new Matrix4();
  for (let r = 0; r < N_RIBS; r++) {
    const v = RIB_VAR[mod(r, 4)];
    const z = -(r - 2) * RIB_SPACING - SPACING * 0.5;
    const t = v.thick;
    const d = v.depth;
    // Left / right wall slats (vertical), floor / ceiling slats (horizontal).
    m.makeScale(d, 2 * (WALL_Y + d), t).setPosition(-(WALL_X + d / 2), 0, z);
    slats.setMatrixAt(n, m); shade[n++] = v.shade;
    m.makeScale(d, 2 * (WALL_Y + d), t).setPosition(WALL_X + d / 2, 0, z);
    slats.setMatrixAt(n, m); shade[n++] = v.shade;
    m.makeScale(2 * (WALL_X + d), d, t).setPosition(0, -(WALL_Y + d / 2), z);
    slats.setMatrixAt(n, m); shade[n++] = v.shade * 0.6;
    m.makeScale(2 * (WALL_X + d), d, t).setPosition(0, WALL_Y + d / 2, z);
    slats.setMatrixAt(n, m); shade[n++] = v.shade * 0.9;
  }
  // Back surfaces behind the slats (seen through the gaps).
  const L = N_RIBS * RIB_SPACING + 4;
  const zc = -L / 2 + 2;
  const bd = 0.05;
  m.makeScale(bd, 2 * (WALL_Y + SLAT_DEPTH * 1.6), L).setPosition(-(WALL_X + SLAT_DEPTH * 1.4), 0, zc);
  slats.setMatrixAt(n, m); shade[n++] = 0.12;
  m.makeScale(bd, 2 * (WALL_Y + SLAT_DEPTH * 1.6), L).setPosition(WALL_X + SLAT_DEPTH * 1.4, 0, zc);
  slats.setMatrixAt(n, m); shade[n++] = 0.12;
  m.makeScale(2 * (WALL_X + SLAT_DEPTH * 1.6), bd, L).setPosition(0, -(WALL_Y + SLAT_DEPTH * 1.4), zc);
  slats.setMatrixAt(n, m); shade[n++] = 0.12;
  m.makeScale(2 * (WALL_X + SLAT_DEPTH * 1.6), bd, L).setPosition(0, WALL_Y + SLAT_DEPTH * 1.4, zc);
  slats.setMatrixAt(n, m); shade[n++] = 0.12;
  ribBox.setAttribute("iShade", new InstancedBufferAttribute(shade, 1));
  slats.frustumCulled = false;
  scene.add(slats);

  // End wall just behind the first (far) frame, burst only.
  const endU = { uLevel: { value: 0 } };
  if (p.mode === "burst") {
    const wall = new Mesh(
      new PlaneGeometry(2 * (WALL_X + SLAT_DEPTH * 1.6), 2 * (WALL_Y + SLAT_DEPTH * 1.6)),
      new ShaderMaterial({
        uniforms: endU,
        vertexShader: "varying vec2 vUv; void main(){ vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.0); }",
        fragmentShader:
          "uniform float uLevel; varying vec2 vUv; void main(){ vec2 q = (vUv - 0.5) * vec2(1.0, 1.4); float g = (0.75 + 0.35 * vUv.y) * (0.75 + 1.4 * dot(q, q)); gl_FragColor = vec4(vec3(uLevel * g), 1.0); }",
      }),
    );
    wall.position.set(0, 0, -(K_FAR_Z + 0.22));
    scene.add(wall);
  }

  const pipe = makePipeline(gl, scene, camera, {
    grade: p.grade,
    bloom: { threshold: 1.0, smoothing: 0.4, intensity: 0.8, radius: p.mode === "burst" ? 0.72 : 0.6, levels: 8 },
  });

  const cA = new Color(p.colorA);
  const cB = new Color(p.colorB);
  const tmp = new Color();
  const zUni = slatMat.uniforms.uFrameZ.value as number[];
  const iUni = slatMat.uniforms.uFrameI.value as number[];
  const cUni = slatMat.uniforms.uFrameC.value as Vector3[];

  // ---- White Burst timeline (180 frames) ----------------------------------
  const K_FAR = 25; // first frame to light: 7.2 m ahead
  const K_NEAR = 15; // last frame switched on by 3.5 s: 4.2 m ahead
  const onTime = (k: number) => {
    if (k === K_FAR) return 4;
    if (k > K_FAR || k < K_NEAR) return Infinity;
    const s = (K_FAR - 1 - k) / (K_FAR - 1 - K_NEAR); // 0 (far) .. 1 (near)
    return 20 + 84 * Math.pow(s, 0.8);
  };
  // Flicker from a hash of the frame bucket: deterministic.
  const flicker = (k: number, f: number) => {
    const t0 = onTime(k);
    if (f < t0) return 0;
    const dt = f - t0;
    if (k === K_FAR) {
      // Two fast stutters, then steady.
      if (dt < 2) return 1;
      if (dt < 5) return 0.05;
      if (dt < 7) return 0.9;
      if (dt < 9) return 0.05;
      return 1;
    }
    if (dt >= 7) return 1;
    return hash01(k * 977 + Math.floor(dt / 2) * 131) > 0.42 ? 0.6 + 0.4 * hash01(k * 31 + Math.floor(dt)) : 0.04;
  };

  return {
    render: (frame) => {
      let camZ: number;
      let ambient = 0;
      let exposure = p.grade.exposure ?? 1;
      let bloomI = p.mode === "burst" ? 1.2 : 0.9;
      let fogGrey = 0;
      let whiteMix = 0;
      let grain = p.grade.grain ?? 0.015;
      let dither = 1;
      let seed = frame;
      const intens: number[] = new Array(N_FRAMES).fill(0);
      const cols: Color[] = [];
      if (p.mode === "burst") {
        const f = Math.min(frame, p.duration - 1);
        // Push forward: slow start, steady glide, gentle acceleration into the white.
        const u = clamp01((f - 10) / 170);
        camZ = -(0.15 * u + 2.1 * u * u * u * u);
        const build = smooth(105, 162, f);
        for (let k = 0; k < N_FRAMES; k++) {
          intens[k] = flicker(k, f) * (3.4 + 4 * build);
          cols.push(cA.clone());
        }
        // Lit-frame count drives a faint grey haze at the far end, as in the reference.
        let lit = 0;
        for (let k = 0; k < N_FRAMES; k++) lit += intens[k] > 0.5 ? 1 : 0;
        fogGrey = 0.002 * lit + 0.03 * build;
        ambient = 0.11 * smooth(0, 90, f) + 0.015 + 1.1 * build * build * build;
        exposure *= 1 + 0.7 * smooth(120, 168, f);
        bloomI = 1.2 + 0.6 * build;
        // Lit end wall behind the far frame: a flat, softly lit grey.
        endU.uLevel.value = Math.min(0.05, 0.004 * lit) * (1 + 1.4 * build);
        whiteMix = smooth(156, 168, f);
        if (f >= 168) {
          whiteMix = 1;
          grain = 0;
          dither = 0;
        }
      } else {
        const f = mod(frame, p.loop);
        seed = f;
        camZ = -(f / p.loop) * 6 * SPACING; // exactly 6 frame-spacings per loop
        for (let k = 0; k < N_FRAMES; k++) {
          // Alternating colours; brightness wave with period 300 frames and a
          // wavelength of 3 spacings (divides the 6-spacing travel).
          const wave = 0.5 + 0.5 * Math.cos(2 * Math.PI * (mod(k, 3) / 3 + mod(f, 300) / 300));
          intens[k] = 2.0 + 2.6 * wave * wave;
          cols.push((mod(k, 2) === 0 ? cA : cB).clone());
        }
      }
      camera.position.set(p.mode === "burst" ? -0.08 : 0, p.mode === "burst" ? -0.2 : 0, camZ);
      camera.updateMatrixWorld();
      for (let k = 0; k < N_FRAMES; k++) {
        const c = cols[k];
        iColor.setXYZ(k, c.r, c.g, c.b);
        iIntensity.setX(k, intens[k]);
        zUni[k] = frameZ(k - 2);
        iUni[k] = intens[k];
        tmp.copy(c);
        cUni[k].set(tmp.r, tmp.g, tmp.b);
      }
      iColor.needsUpdate = true;
      iIntensity.needsUpdate = true;
      slatMat.uniforms.uAmbient.value = ambient;
      (slatMat.uniforms.uFogColor.value as Vector3).setScalar(fogGrey);
      (frameMat.uniforms.uFogColor.value as Vector3).setScalar(fogGrey);
      (scene.background as Color).setScalar(fogGrey);
      pipe.bloom!.intensity = bloomI;
      pipe.final.set("exposure", exposure);
      pipe.final.set("whiteMix", whiteMix);
      pipe.final.set("grain", grain);
      pipe.final.set("ditherAmt", dither);
      pipe.final.set("seed", seed);
      pipe.render();
    },
    dispose: () => pipe.dispose(),
  };
};

