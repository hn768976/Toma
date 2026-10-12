import React, { useEffect, useLayoutEffect, useRef, useState } from "react";
import { AbsoluteFill, continueRender, delayRender, useCurrentFrame, useVideoConfig } from "remotion";
import { Application, Geometry, Mesh, Shader, UniformGroup } from "pixi.js";
import { loopFrame, LOOP, mulberry32 } from "../../lib/random";
import { GRAIN_GLSL } from "../../lib/finalPass";

export type ParticleWaveProps = {
  point: [number, number, number]; // particle colour (0..1)
  glowL: [number, number, number]; // crest glow, left
  glowR: [number, number, number]; // crest glow, right
  haze: [number, number, number]; // horizon haze
  bg: [number, number, number];
};

// ---------------------------------------------------------------- field --
const COLS = 320;
const ROWS = 240;
const X_HALF = 34; // world half-width of the grid
const Z_NEAR = 1.2;
const Z_FAR = 46;
const CAM_H = 2.6; // camera height; line of sight to the focus is ~12° down
const PITCH = (4.5 * Math.PI) / 180; // camera pitch (down)
const FOCUS = Z_NEAR + 0.6 * (Z_FAR - Z_NEAR) - 12; // focal depth (≈60% of the way, measured along the view)
const VFOV = (42 * Math.PI) / 180;

// travelling waves: integer cycles per loop → exact 600-frame loop
// [kx, kz, amplitude, cycles per loop, phase]
const WAVES: [number, number, number, number, number][] = [
  [0.31, 0.42, 0.42, 2, 0.3],
  [-0.47, 0.26, 0.3, 3, 1.7],
  [0.12, 0.83, 0.2, 5, 4.1],
  [0.78, -0.31, 0.14, 4, 2.6],
  [-0.12, 0.17, 0.45, 1, 5.2],
];

const COMMON_GLSL = /* glsl */ `
uniform float uT;        // frame / 600
uniform float uCamX;
uniform float uAspect;
uniform float uFocal;
uniform float uPx;       // output height in pixels
uniform vec4 uW[5];      // kx, kz, amp, cycles
uniform float uWp[5];    // phases
float heightAt(vec2 xz){
  float h = 0.0;
  for (int i = 0; i < 5; i++){
    h += uW[i].z * sin(dot(uW[i].xy, xz) - 6.2831853 * uW[i].w * uT + uWp[i]);
  }
  return h;
}
vec3 project(vec3 p){
  vec3 r = p - vec3(uCamX, ${CAM_H.toFixed(3)}, 0.0);
  float ca = cos(${PITCH.toFixed(5)}), sa = sin(${PITCH.toFixed(5)});
  float y = r.y * ca + r.z * sa;
  float z = -r.y * sa + r.z * ca;
  return vec3(r.x * uFocal / (z * uAspect), y * uFocal / z, z);
}`;

const FIELD_VS = /* glsl */ `
in vec2 aPosition;   // quad corner in [-1,1]
in vec3 aGrid;       // x, z, random
out vec2 vUv;
out vec3 vCol;
out float vAlpha;
out float vSoft;
uniform vec3 uPoint; uniform vec3 uGlowL; uniform vec3 uGlowR;
${COMMON_GLSL}
void main(){
  vec2 xz = aGrid.xy;
  float h = heightAt(xz);
  vec3 s = project(vec3(xz.x, h, xz.y));
  float depth = s.z;
  // size: sharp point + circle of confusion from the focal depth
  float sharpPx = max(1.25, 0.055 * uFocal / depth * 0.5 * uPx);
  float cocPx = abs(1.0 / depth - 1.0 / ${FOCUS.toFixed(3)}) * 0.2 * uPx;
  float sizePx = max(sharpPx, cocPx);
  // energy conservation: blurred points spread the same light
  float energy = (sharpPx * sharpPx) / (sizePx * sizePx);
  vSoft = clamp(cocPx / sizePx, 0.0, 1.0);
  float crest = smoothstep(-0.6, 1.4, h);
  float farT = clamp((depth - 14.0) / 30.0, 0.0, 1.0);
  float sx = clamp(s.x * 0.5 + 0.5, 0.0, 1.0);
  vec3 glow = mix(uGlowL, uGlowR, smoothstep(0.15, 0.85, sx));
  float glowAmt = smoothstep(0.35, 1.0, farT) * (0.35 + 0.9 * crest);
  vCol = mix(uPoint * (0.45 + 0.75 * crest), glow * 1.5, glowAmt * 0.75);
  float twinkle = 0.75 + 0.25 * aGrid.z;
  float fog = 1.0 - smoothstep(0.82, 1.0, (depth - ${Z_NEAR.toFixed(2)}) / ${(Z_FAR - Z_NEAR).toFixed(2)});
  vAlpha = clamp(energy * 1.6, 0.05, 1.0) * twinkle * fog * (0.55 + 0.45 * crest) * smoothstep(0.6, 1.4, depth);
  vec2 off = aPosition * sizePx / uPx * vec2(1.0 / uAspect, 1.0);
  gl_Position = vec4(s.xy + off, 0.0, 1.0);
  vUv = aPosition;
}`;

const FIELD_FS = /* glsl */ `
in vec2 vUv; in vec3 vCol; in float vAlpha; in float vSoft;
out vec4 finalColor;
void main(){
  float r = length(vUv);
  float hard = smoothstep(1.0, 0.45, r);
  float bokeh = smoothstep(1.0, 0.82, r) * (0.75 + 0.25 * smoothstep(0.4, 0.95, r)); // flat disc, faint rim
  float a = mix(hard * hard, bokeh, vSoft) * vAlpha;
  finalColor = vec4(vCol * a, 0.0);
}`;

const DUST_VS = /* glsl */ `
in vec2 aPosition;
in vec4 aSeed;  // x, y, z, random
out vec2 vUv; out float vAlpha;
${COMMON_GLSL}
void main(){
  float ph = 6.2831853 * (uT * (1.0 + floor(aSeed.w * 2.0)) + aSeed.w * 7.0);
  vec3 p = aSeed.xyz + vec3(0.6 * sin(ph), 0.25 * cos(ph), 0.4 * sin(ph + 1.3));
  vec3 s = project(p);
  float sizePx = max(1.2, (0.03 * uFocal / s.z * 0.5 + abs(1.0 / s.z - 1.0 / ${FOCUS.toFixed(3)}) * 0.035) * uPx);
  vAlpha = clamp(1.4 / (sizePx * 0.6), 0.04, 0.8) * (0.4 + 0.6 * fract(aSeed.w * 13.0)) * step(0.5, s.z);
  vec2 off = aPosition * sizePx / uPx * vec2(1.0 / uAspect, 1.0);
  gl_Position = vec4(s.xy + off, 0.0, 1.0);
  vUv = aPosition;
}`;
const DUST_FS = /* glsl */ `
in vec2 vUv; in float vAlpha; out vec4 finalColor;
void main(){ float r = length(vUv); finalColor = vec4(vec3(0.75, 0.82, 1.0) * smoothstep(1.0, 0.3, r) * vAlpha, 0.0); }`;

const BG_VS = /* glsl */ `
in vec2 aPosition; out vec2 vP;
void main(){ vP = aPosition * 0.5 + 0.5; gl_Position = vec4(aPosition, 0.0, 1.0); }`;
const BG_FS = /* glsl */ `
in vec2 vP; out vec4 finalColor;
uniform vec3 uBg; uniform vec3 uHaze; uniform vec3 uGlowL; uniform vec3 uGlowR;
uniform float uHorizon; uniform float uFrame; uniform float uPx;
${GRAIN_GLSL}
void main(){
  float y = vP.y;                       // 0 bottom … 1 top
  float d = y - uHorizon;
  float haze = exp(-pow(d / 0.16, 2.0)) * 0.9 + exp(-pow(d / 0.42, 2.0)) * 0.35;
  vec3 c = uBg + uHaze * haze;
  vec3 glow = mix(uGlowL, uGlowR, smoothstep(0.1, 0.9, vP.x));
  c += glow * exp(-pow(d / 0.012, 2.0)) * 0.22 + glow * exp(-pow(d / 0.06, 2.0)) * 0.06;
  // vignette
  vec2 q = vP - 0.5;
  c *= 1.0 - 0.35 * dot(q, q) * 2.0;
  finalColor = vec4(ditherGrain(c, gl_FragCoord.xy, uFrame, 0.015), 1.0);
}`;

const QUAD = new Float32Array([-1, -1, 1, -1, 1, 1, -1, 1]);
const QIDX = new Uint32Array([0, 1, 2, 0, 2, 3]);

const buildField = () => {
  const r = mulberry32(0x21753046);
  const g = new Float32Array(COLS * ROWS * 3);
  let k = 0;
  for (let j = 0; j < ROWS; j++) {
    // denser rows near the camera in z so the far field stays continuous
    const tz = j / (ROWS - 1);
    const z = Z_NEAR + (Z_FAR - Z_NEAR) * Math.pow(tz, 1.25);
    for (let i = 0; i < COLS; i++) {
      const x = -X_HALF + (2 * X_HALF * (i + 0.5 + (r() - 0.5) * 0.9)) / COLS;
      g[k++] = x;
      g[k++] = z + (r() - 0.5) * 0.9 * ((Z_FAR - Z_NEAR) / ROWS) * 1.25 * Math.pow(tz + 0.01, 0.25);
      g[k++] = r();
    }
  }
  return g;
};
const buildDust = () => {
  const r = mulberry32(0x600);
  const g = new Float32Array(600 * 4);
  for (let i = 0; i < 600; i++) g.set([(r() - 0.5) * 50, 1.2 + r() * 9, 2 + r() * 44, r()], i * 4);
  return g;
};

type Pixi = { app: Application; field: UniformGroup; dust: UniformGroup; bg: UniformGroup };

const WAVE_U = new Float32Array(WAVES.flatMap(([kx, kz, a, n]) => [kx, kz, a, n]));
const WAVE_P = new Float32Array(WAVES.map((w) => w[4]));

export const ParticleWave: React.FC<ParticleWaveProps> = (p) => {
  const frame = useCurrentFrame();
  const { width, height } = useVideoConfig();
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [pixi, setPixi] = useState<Pixi | null>(null);
  const [initHandle] = useState(() => delayRender("PixiJS init"));
  const initDone = useRef(false);
  const dpr = typeof window === "undefined" ? 1 : Math.min(1, window.devicePixelRatio || 1);
  const W = Math.round(width * dpr);
  const H = Math.round(height * dpr);

  useEffect(() => {
    let dead = false;
    const app = new Application();
    app
      .init({
        canvas: canvasRef.current!,
        width: W,
        height: H,
        resolution: 1,
        preference: "webgl",
        antialias: false,
        autoStart: false,
        sharedTicker: false,
        background: "#000000",
        preserveDrawingBuffer: true,
        powerPreference: "high-performance",
      })
      .then(() => {
        if (dead) return;
        app.ticker?.stop();
        const common = () => ({
          uT: { value: 0, type: "f32" as const },
          uCamX: { value: 0, type: "f32" as const },
          uAspect: { value: W / H, type: "f32" as const },
          uFocal: { value: 1 / Math.tan(VFOV / 2), type: "f32" as const },
          uPx: { value: H, type: "f32" as const },
          uW: { value: WAVE_U, type: "vec4<f32>" as const, size: 5 },
          uWp: { value: WAVE_P, type: "f32" as const, size: 5 },
        });
        const bgU = new UniformGroup({
          uBg: { value: new Float32Array(p.bg), type: "vec3<f32>" },
          uHaze: { value: new Float32Array(p.haze), type: "vec3<f32>" },
          uGlowL: { value: new Float32Array(p.glowL), type: "vec3<f32>" },
          uGlowR: { value: new Float32Array(p.glowR), type: "vec3<f32>" },
          uHorizon: { value: 0.5, type: "f32" },
          uFrame: { value: 0, type: "f32" },
          uPx: { value: H, type: "f32" },
        });
        const fieldU = new UniformGroup({
          ...common(),
          uPoint: { value: new Float32Array(p.point), type: "vec3<f32>" },
          uGlowL: { value: new Float32Array(p.glowL), type: "vec3<f32>" },
          uGlowR: { value: new Float32Array(p.glowR), type: "vec3<f32>" },
        });
        const dustU = new UniformGroup(common());

        const bg = new Mesh({
          geometry: new Geometry({ attributes: { aPosition: QUAD }, indexBuffer: QIDX }),
          shader: Shader.from({ gl: { vertex: BG_VS, fragment: BG_FS }, resources: { u: bgU } }),
        });
        const field = new Mesh({
          geometry: new Geometry({
            attributes: {
              aPosition: QUAD,
              aGrid: { buffer: buildField(), format: "float32x3", instance: true },
            },
            indexBuffer: QIDX,
            instanceCount: COLS * ROWS,
          }),
          shader: Shader.from({ gl: { vertex: FIELD_VS, fragment: FIELD_FS }, resources: { u: fieldU } }),
        });
        field.blendMode = "add";
        const dust = new Mesh({
          geometry: new Geometry({
            attributes: { aPosition: QUAD, aSeed: { buffer: buildDust(), format: "float32x4", instance: true } },
            indexBuffer: QIDX,
            instanceCount: 600,
          }),
          shader: Shader.from({ gl: { vertex: DUST_VS, fragment: DUST_FS }, resources: { u: dustU } }),
        });
        dust.blendMode = "add";
        app.stage.addChild(bg, field, dust);
        setPixi({ app, field: fieldU, dust: dustU, bg: bgU });
      });
    return () => {
      dead = true;
      try {
        app.destroy(false);
      } catch {
        /* not initialised */
      }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [W, H]);

  // Render the stage once per Remotion frame (no ticker).
  useLayoutEffect(() => {
    if (!pixi) return;
    const f = loopFrame(frame);
    const t = f / LOOP;
    const camX = 0.03 * 2 * X_HALF * 0.35 * Math.sin(2 * Math.PI * t); // ±3% of the visible width
    // horizon: where the far edge of the field projects (screen fraction from bottom)
    const ca = Math.cos(PITCH), sa = Math.sin(PITCH);
    const ry = -CAM_H, rz = Z_FAR;
    const yv = ry * ca + rz * sa, zv = -ry * sa + rz * ca;
    const horizon = 0.5 + 0.5 * ((yv * (1 / Math.tan(VFOV / 2))) / zv);
    for (const u of [pixi.field, pixi.dust]) {
      u.uniforms.uT = t;
      u.uniforms.uCamX = camX;
      u.update();
    }
    pixi.bg.uniforms.uHorizon = horizon;
    pixi.bg.uniforms.uFrame = f;
    pixi.bg.update();
    pixi.app.renderer.render(pixi.app.stage);
    if (!initDone.current) {
      initDone.current = true;
      continueRender(initHandle);
    }
  }, [frame, pixi, initHandle]);

  return (
    <AbsoluteFill style={{ backgroundColor: "#000" }}>
      <canvas ref={canvasRef} width={W} height={H} style={{ width, height, display: "block" }} />
    </AbsoluteFill>
  );
};
