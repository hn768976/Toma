import {
  Color,
  Group,
  HalfFloatType,
  LinearFilter,
  LinearMipmapLinearFilter,
  Matrix4,
  Mesh,
  OneFactor,
  CustomBlending,
  PerspectiveCamera,
  PlaneGeometry,
  RGBAFormat,
  Scene,
  ShaderMaterial,
  Vector3,
  WebGLRenderTarget,
  type WebGLRenderer,
} from "three";
import { GLSL_COMMON } from "../lib/glsl";
import { FullscreenPass } from "../lib/pass";
import { animFrame, grainFrame } from "../lib/loop";
import type { StageFactory } from "../lib/GLStage";
import { makeGlyphAtlas } from "./kit";

export type Story = { group: Group; update: (f: number) => void };
export type StoryBuilder = (ctx: { anisotropy: number }) => Story;

export type InfoParams = {
  period: number;             // 450 for stories, 600 for the loop
  loop: boolean;              // closed camera path (1D)
  calm: boolean;              // fewer icons in the centre-left two-thirds (copy space)
  story: StoryBuilder | null;
  layerRot: [number, number, number];
  bgYaw?: number;             // degrees; sign picks which side of the plane is nearer (sharper)
  grain: number;
};

const TILES_X = 40;
const TILES_Y = 24;
const TILE = 0.5;

const BG_VERT = /* glsl */ `
varying vec2 vUv; varying float vDepth;
void main() {
  vUv = uv;
  vec4 mv = modelViewMatrix * vec4(position, 1.0);
  vDepth = -mv.z;
  gl_Position = projectionMatrix * mv;
}`;

const BG_FRAG = GLSL_COMMON + /* glsl */ `
uniform sampler2D tAtlas;
uniform vec2 uRes; uniform float uCalm;
uniform mat4 uMaskVP; uniform mat4 uModel; uniform vec2 uPlane;
uniform float uFocus, uCocK, uCocMin, uCocMax;
varying vec2 vUv; varying float vDepth;

const vec3 cDark = vec3(0.165, 0.165, 0.604);   // #2A2A9A
const vec3 cMid = vec3(0.227, 0.29, 0.784);     // #3A4AC8
const vec3 cLight = vec3(0.353, 0.541, 0.91);   // #5A8AE8
const vec3 cLine = vec3(0.353, 0.478, 0.91);    // #5A7AE8
const vec3 cViolet = vec3(0.227, 0.102, 0.604); // #3A1A9A
const vec3 cBlue = vec3(0.165, 0.416, 0.855);   // #2A6ADA

float bandRow(int j) {
  // soft horizontal bands: weights per tile row
  if (j == 4 || j == 5) return 0.9;
  if (j == 9) return 0.7;
  if (j == 14 || j == 15) return 0.85;
  if (j == 19) return 0.6;
  return 0.0;
}

void main() {
  vec2 tc = vUv * vec2(${TILES_X}.0, ${TILES_Y}.0);
  ivec2 id = ivec2(floor(tc));
  vec2 f = fract(tc);
  vec2 fw = fwidth(tc);

  // screen-space light: violet upper-left -> blue lower-right, darker at the top
  vec2 suv = gl_FragCoord.xy / uRes;
  float gd = 0.15 + 0.6 * smoothstep(0.1, 1.1, (1.0 - suv.y) + 0.3 * (suv.x - 0.5));
  vec3 grad = mix(cViolet * 0.95, cBlue * 0.9, gd);
  float topDark = mix(0.9, 1.0, smoothstep(1.0, 0.45, suv.y));

  // per-tile fill (seeded): mostly dark, some mid, a few lighter tiles
  float h = hash2i(id, 11u);
  float L = h < 0.62 ? 0.84 : (h < 0.92 ? 0.95 : 1.12);
  vec3 tint = h < 0.64 ? cDark : (h < 0.93 ? cMid : cLight);
  L *= 0.9 + 0.2 * hash2i(id, 12u);

  // sliding light bands: whole periods per loop/story, evaluated per tile
  float bw = bandRow(id.y);
  float band = 0.0;
  if (bw > 0.0) {
    float per = 9.0 + float(id.y % 5);
    float ph = hash1(uint(id.y) * 977u);
    float k = (id.y % 2 == 0) ? 1.0 : -1.0;
    float w = 0.5 + 0.5 * cos(TAU * (float(id.x) / per - k * phaseK(1) + ph));
    band = pow(w, 3.0) * bw;
  }
  vec3 fill = grad * L * 1.25 + (tint - cMid) * 0.12 * L;
  fill = mix(fill, grad * 1.8 + vec3(0.03, 0.06, 0.1) * gd, band * 0.45);
  fill *= topDark;

  // tile outline #5A7AE8 at 25%
  vec2 de = min(f, 1.0 - f);
  float lw = 0.045;
  float e = 1.0 - smoothstep(lw, lw + 1.5 * max(fw.x, fw.y), min(de.x, de.y));
  float gap = 1.0 - smoothstep(0.0, lw * 0.5 + fw.x, min(de.x, de.y));
  vec3 col = mix(fill * 0.95, fill * 0.55, gap * 0.6);   // thin dark grout
  col = mix(col, cLine * (0.9 + 0.5 * gd) * topDark, e * 0.3);

  // stray digits and small icons, from the atlas
  float calm = 0.0;
  if (uCalm > 0.5) {
    vec2 lc = ((vec2(id) + 0.5) / vec2(${TILES_X}.0, ${TILES_Y}.0) - 0.5) * uPlane;
    vec4 clip = uMaskVP * uModel * vec4(lc, 0.0, 1.0);
    vec2 ndc = clip.xy / clip.w;
    // centre-left two-thirds of the frame: x in [-1, 0.33]
    calm = smoothstep(0.55, 0.25, ndc.x) * smoothstep(-1.25, -0.95, ndc.x) * smoothstep(0.98, 0.72, abs(ndc.y));
  }
  float g = hash2i(id, 21u);
  float pD = 0.22 * mix(1.0, 0.12, calm);
  float pI = 0.07 * mix(1.0, 0.0, calm);
  int cellI = -1;
  if (g < pD) cellI = int(hash2i(id, 22u) * 10.0);
  else if (g < pD + pI) cellI = 10 + int(hash2i(id, 23u) * 6.0);
  if (cellI >= 0) {
    float gs = 0.8;
    vec2 gu = (f - 0.5) / gs + 0.5;
    vec2 cellUv = vec2(float(cellI % 8), float(1 - cellI / 8));
    vec2 auv = (cellUv + gu) / vec2(8.0, 2.0);
    vec2 dx = dFdx(tc) / gs / vec2(8.0, 2.0), dy = dFdy(tc) / gs / vec2(8.0, 2.0);
    float inside = step(0.0, gu.x) * step(gu.x, 1.0) * step(0.0, gu.y) * step(gu.y, 1.0);
    float ga = textureGrad(tAtlas, auv, dx, dy).a * inside;
    float op = 0.32 + 0.18 * hash2i(id, 24u);
    col = mix(col, (grad * 2.2 + vec3(0.08, 0.1, 0.2)) * topDark, ga * op);
  }

  // overall exposure, matched to the reference: dark violet top, deeper blue bottom
  col *= mix(0.52, 0.82, smoothstep(0.3, 1.0, (1.0 - suv.y) * 0.75 + suv.x * 0.35));
  col.b *= 1.0 + 0.16 * smoothstep(0.4, 1.0, 1.0 - suv.y);

  // circle of confusion (frame heights), focus on the infographic layer
  float coc = clamp(uCocK * abs(vDepth - uFocus) / vDepth, uCocMin, uCocMax);
  gl_FragColor = vec4(col, coc);
}`;

const DOF_FRAG = /* glsl */ `
uniform sampler2D tBg; uniform vec2 uRes;
in vec2 vUv; out vec4 outColor;
const int N = 48;
void main() {
  float coc = texture(tBg, vUv).a;
  float rPx = coc * uRes.y;
  float lod = log2(max(rPx * 2.2 / sqrt(float(N)), 1.0));
  vec3 acc = vec3(0.0);
  for (int i = 0; i < N; i++) {
    float fi = float(i) + 0.5;
    float r = sqrt(fi / float(N));
    float th = fi * 2.39996323;
    vec2 o = vec2(cos(th), sin(th)) * r * rPx;
    acc += textureLod(tBg, vUv + o / uRes, lod).rgb;
  }
  outColor = vec4(acc / float(N), 1.0);
}`;

const COMP_FRAG = /* glsl */ `
uniform sampler2D tBg; uniform sampler2D tFg;
in vec2 vUv; out vec4 outColor;
void main() {
  vec4 fg = texture(tFg, vUv);
  vec3 bg = texture(tBg, vUv).rgb;
  outColor = vec4(bg * (1.0 - clamp(fg.a, 0.0, 1.0)) + fg.rgb, 1.0);
}`;

const DOWN_FRAG = /* glsl */ `
uniform sampler2D tSrc; uniform vec2 uTexel; uniform float uPrefilter;
in vec2 vUv; out vec4 outColor;
void main() {
  vec2 o = uTexel;
  vec3 c = texture(tSrc, vUv + vec2(-o.x, -o.y)).rgb + texture(tSrc, vUv + vec2(o.x, -o.y)).rgb
         + texture(tSrc, vUv + vec2(-o.x, o.y)).rgb + texture(tSrc, vUv + vec2(o.x, o.y)).rgb;
  c *= 0.25;
  if (uPrefilter > 0.5) {
    float l = max(c.r, max(c.g, c.b));
    float knee = 0.25, th = 0.62;
    float soft = clamp(l - th + knee, 0.0, 2.0 * knee);
    soft = soft * soft / (4.0 * knee + 1e-4);
    float w = max(soft, l - th) / max(l, 1e-4);
    c *= w;
  }
  outColor = vec4(c, 1.0);
}`;

const UP_FRAG = /* glsl */ `
uniform sampler2D tSrc; uniform vec2 uTexel; uniform float uScale;
in vec2 vUv; out vec4 outColor;
void main() {
  vec2 o = uTexel;
  vec3 c = texture(tSrc, vUv).rgb * 4.0;
  c += (texture(tSrc, vUv + vec2(o.x, 0)).rgb + texture(tSrc, vUv - vec2(o.x, 0)).rgb
      + texture(tSrc, vUv + vec2(0, o.y)).rgb + texture(tSrc, vUv - vec2(0, o.y)).rgb) * 2.0;
  c += texture(tSrc, vUv + o).rgb + texture(tSrc, vUv - o).rgb
     + texture(tSrc, vUv + vec2(o.x, -o.y)).rgb + texture(tSrc, vUv + vec2(-o.x, o.y)).rgb;
  outColor = vec4(c / 16.0 * uScale, 1.0);
}`;

const FINAL_FRAG = GLSL_COMMON + /* glsl */ `
uniform sampler2D tComp; uniform sampler2D tBloom; uniform vec2 uRes; uniform float uFrame; uniform float uGrain;
in vec2 vUv; out vec4 outColor;
void main() {
  vec3 c = texture(tComp, vUv).rgb + texture(tBloom, vUv).rgb * 0.48;
  c = c / (1.0 + max(c - 0.92, 0.0) * 0.8);
  vec2 q = vUv - 0.5;
  c *= 1.0 - 0.22 * pow(dot(q, q) * 2.0, 1.25);
  uint fr = uint(uFrame);
  c += grainN(gl_FragCoord.xy, fr) * uGrain + ditherTri(gl_FragCoord.xy, fr);
  outColor = vec4(clamp(c, 0.0, 1.0), 1.0);
}`;

const rt = (w: number, h: number, opts: { mip?: boolean; samples?: number } = {}) =>
  new WebGLRenderTarget(Math.max(1, w), Math.max(1, h), {
    type: HalfFloatType,
    format: RGBAFormat,
    depthBuffer: false,
    generateMipmaps: !!opts.mip,
    minFilter: opts.mip ? LinearMipmapLinearFilter : LinearFilter,
    magFilter: LinearFilter,
    samples: opts.samples ?? 0,
  });

export const createInfo =
  (prm: InfoParams): StageFactory =>
  (gl: WebGLRenderer, W: number, H: number) => {
    const anisotropy = gl.capabilities.getMaxAnisotropy();
    const camera = new PerspectiveCamera(30, W / H, 0.1, 100);

    // background plane ------------------------------------------------------
    const bgScene = new Scene();
    const atlas = makeGlyphAtlas(anisotropy);
    const planeSize: [number, number] = [TILES_X * TILE, TILES_Y * TILE];
    const bgMat = new ShaderMaterial({
      vertexShader: BG_VERT,
      fragmentShader: BG_FRAG,
      uniforms: {
        tAtlas: { value: atlas },
        uRes: { value: [W, H] },
        uFI: { value: 0 },
        uPI: { value: prm.period },
        uCalm: { value: prm.calm ? 1 : 0 },
        uMaskVP: { value: new Matrix4() },
        uModel: { value: new Matrix4() },
        uPlane: { value: planeSize },
        uFocus: { value: 10 },
        uCocK: { value: 0.065 },
        uCocMin: { value: 0.0015 },
        uCocMax: { value: 0.022 },
      },
      depthTest: false,
      depthWrite: false,
    });
    const bg = new Mesh(new PlaneGeometry(planeSize[0], planeSize[1]), bgMat);
    bg.position.set(0.6, 0.6, -2.2);
    bg.rotation.set((-25 * Math.PI) / 180, ((prm.bgYaw ?? 15) * Math.PI) / 180, 0, "YXZ");
    bgScene.add(bg);
    bg.updateMatrixWorld(true);
    bgMat.uniforms.uModel.value.copy(bg.matrixWorld);

    // infographic layer -------------------------------------------------------
    const fgScene = new Scene();
    const layer = new Group();
    layer.rotation.set(prm.layerRot[0], prm.layerRot[1], prm.layerRot[2], "YXZ");
    fgScene.add(layer);
    const story = prm.story ? prm.story({ anisotropy }) : null;
    if (story) layer.add(story.group);

    // targets & passes ------------------------------------------------------
    const bgRT = rt(W, H, { mip: true });
    const dofRT = rt(W, H);
    const fgRT = rt(W, H, { samples: 4 });
    const compRT = rt(W, H);
    const levels: WebGLRenderTarget[] = [];
    for (let i = 1, w = W >> 1, h = H >> 1; i <= 6; i++, w >>= 1, h >>= 1) levels.push(rt(w, h));

    const dof = new FullscreenPass(DOF_FRAG, { tBg: { value: bgRT.texture }, uRes: { value: [W, H] } });
    const comp = new FullscreenPass(COMP_FRAG, { tBg: { value: dofRT.texture }, tFg: { value: fgRT.texture } });
    const down = new FullscreenPass(DOWN_FRAG, { tSrc: { value: null }, uTexel: { value: [0, 0] }, uPrefilter: { value: 0 } });
    const up = new FullscreenPass(UP_FRAG, { tSrc: { value: null }, uTexel: { value: [0, 0] }, uScale: { value: 1 } });
    up.material.blending = CustomBlending;
    up.material.blendSrc = OneFactor;
    up.material.blendDst = OneFactor;
    up.material.transparent = true;
    const fin = new FullscreenPass(FINAL_FRAG, {
      tComp: { value: compRT.texture },
      tBloom: { value: levels[0].texture },
      uRes: { value: [W, H] },
      uFrame: { value: 0 },
      uGrain: { value: prm.grain },
      uFI: { value: 0 },
      uPI: { value: prm.period },
    });
    const clearBlack = new Color(0, 0, 0);

    const placeCamera = (f: number) => {
      const P = prm.period;
      if (prm.loop) {
        // trig argument reduced exactly (integer frame mod period); the path is closed by construction
        const a = (2 * Math.PI * (((f % P) + P) % P)) / P;
        camera.position.set(0.35 * Math.cos(a), 0.2 * Math.sin(a), 10 * (0.98 + 0.02 * Math.cos(a)));
        camera.lookAt(0.1 * Math.cos(a), 0.05 * Math.sin(a), 0);
      } else {
        const u = f / P;
        const s = u * u * (3 - 2 * u);
        camera.position.set(-0.3 + 0.6 * s, 0.12 * Math.sin(Math.PI * u), 10 * (1 - 0.04 * s));
        camera.lookAt(-0.1 + 0.2 * s, 0.03 * Math.sin(Math.PI * u), 0);
      }
      camera.updateMatrixWorld(true);
    };

    // reference view (frame 0) for the 1D copy-space mask: fixed to tiles
    placeCamera(0);
    camera.updateProjectionMatrix();
    bgMat.uniforms.uMaskVP.value.multiplyMatrices(camera.projectionMatrix, camera.matrixWorldInverse);
    const focusPoint = new Vector3();

    return {
      render: (frame) => {
        const f = animFrame(frame, prm.period);
        placeCamera(f);
        bgMat.uniforms.uFI.value = f;
        bgMat.uniforms.uFocus.value = camera.position.distanceTo(focusPoint);
        story?.update(f);
        fgScene.updateMatrixWorld(true);

        gl.setClearColor(clearBlack, 0);
        gl.setRenderTarget(bgRT);
        gl.clear(true, false, false);
        gl.render(bgScene, camera);
        dof.render(gl, dofRT);

        gl.setRenderTarget(fgRT);
        gl.clear(true, true, false);
        gl.render(fgScene, camera);

        comp.render(gl, compRT);

        // bloom: deterministic mip chain
        let src = compRT;
        levels.forEach((dst, i) => {
          down.uniforms.tSrc.value = src.texture;
          down.uniforms.uTexel.value = [0.5 / src.width, 0.5 / src.height];
          down.uniforms.uPrefilter.value = i === 0 ? 1 : 0;
          down.render(gl, dst);
          src = dst;
        });
        for (let i = levels.length - 1; i > 0; i--) {
          const s = levels[i];
          up.uniforms.tSrc.value = s.texture;
          up.uniforms.uTexel.value = [1 / s.width, 1 / s.height];
          up.uniforms.uScale.value = 0.9;
          up.render(gl, levels[i - 1]);
        }

        fin.uniforms.uFrame.value = grainFrame(frame, prm.period);
        fin.render(gl, null);
      },
      dispose: () => {
        [bgRT, dofRT, fgRT, compRT, ...levels].forEach((r) => r.dispose());
        [dof, comp, down, up, fin].forEach((p) => p.dispose());
        atlas.dispose();
        bgMat.dispose();
      },
    };
  };
