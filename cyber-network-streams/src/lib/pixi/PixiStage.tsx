import { Application, Container, Filter, GlProgram, Rectangle, Sprite, Texture } from "pixi.js";
import { FloatBlur } from "./FloatBlur";
import { floatTarget } from "./floatTarget";
import React, { useEffect, useLayoutEffect, useRef, useState } from "react";
import { AbsoluteFill, continueRender, delayRender, getRemotionEnvironment, useCurrentFrame, useVideoConfig } from "remotion";

// PixiJS 8 stage for looks 4–5.
//   world (additive, HDR rgba16float) → two blurred low-res copies (bloom) →
//   one full-screen composite Filter (tone map, dither ±1/255, grain from
//   pixel+frame) writing the 8-bit canvas. Ticker stopped; exactly one
//   app.render() per Remotion frame.

export type PixiScene = {
  world: Container;
  update: (frame: number, info: { width: number; height: number; px: number }) => void;
  // optional per-frame bloom strengths [tight, wide], overriding post.bloomA/B
  bloomAt?: (frame: number) => [number, number];
};

export type PixiPost = {
  bloomA: number; // tight bloom strength
  bloomB: number; // wide bloom strength
  exposure: number;
  grain: number; // 0 → none
  dither: boolean;
  // When true, output is forced to exactly 0 where the scene is ~empty and
  // dither/grain are suppressed there (look 5, pure black).
  blackSafe: boolean;
  bg: [number, number, number]; // sRGB 0..1 background added before tone map
  grainPeriod: number;
};

export const VERT = /* glsl */ `#version 300 es
in vec2 aPosition;
out vec2 vTextureCoord;
out vec2 vScreen;
uniform vec4 uInputSize;
uniform vec4 uOutputFrame;
uniform vec4 uOutputTexture;
void main(){
  vec2 position = aPosition * uOutputFrame.zw + uOutputFrame.xy;
  position.x = position.x * (2.0 / uOutputTexture.x) - 1.0;
  position.y = position.y * (2.0*uOutputTexture.z / uOutputTexture.y) - uOutputTexture.z;
  gl_Position = vec4(position, 0.0, 1.0);
  vTextureCoord = aPosition * (uOutputFrame.zw * uInputSize.zw);
  vScreen = aPosition;
}`;

export const FRAG = /* glsl */ `#version 300 es
precision highp float;
in vec2 vTextureCoord;
in vec2 vScreen;
out vec4 finalColor;
uniform sampler2D uTexture;
uniform sampler2D uWorld;
uniform sampler2D uBloomA;
uniform sampler2D uBloomB;
uniform float uFrame;
uniform float uGrain;
uniform float uDither;
uniform float uBlackSafe;
uniform float uBloomAk;
uniform float uBloomBk;
uniform float uExposure;
uniform vec3 uBg;
uint pcg(uint v){ uint s = v*747796405u+2891336453u; uint w = ((s>>((s>>28u)+4u))^s)*277803737u; return (w>>22u)^w; }
float h01(uvec3 p){ return float(pcg(p.x + pcg(p.y + pcg(p.z)))) / 4294967295.; }
vec3 toLin(vec3 c){ return mix(c/12.92, pow((c+0.055)/1.055, vec3(2.4)), step(0.04045,c)); }
vec3 toSRGB(vec3 c){ c = clamp(c,0.,1.); return mix(c*12.92, 1.055*pow(c,vec3(1./2.4))-0.055, step(0.0031308,c)); }
void main(){
  vec3 w = texture(uWorld, vScreen).rgb;
  vec3 a = texture(uBloomA, vScreen).rgb;
  vec3 b = texture(uBloomB, vScreen).rgb;
  vec3 c = (w + a*uBloomAk + b*uBloomBk) * uExposure;
  // soft shoulder so additive pile-ups roll off to white instead of clipping
  vec3 t = 1.0 - exp(-c * 1.6);
  t /= (1.0 - exp(-1.6));
  t = min(t, vec3(1.0));
  vec3 outc = toSRGB(toLin(uBg) + t);
  float l = max(t.r, max(t.g, t.b));
  uvec2 px = uvec2(gl_FragCoord.xy);
  uint fr = uint(uFrame);
  float g = h01(uvec3(px, fr)) - 0.5;
  float d = h01(uvec3(px, fr + 7919u)) + h01(uvec3(px + 1013u, fr)) - 1.0;
  float gate = 1.0;
  if (uBlackSafe > 0.5) {
    // no grain on black; dither only where there is actual signal
    gate = smoothstep(0.004, 0.02, l);
  }
  outc += g * uGrain * gate + d * uDither / 255.0 * gate;
  if (uBlackSafe > 0.5 && l < 0.0015) outc = vec3(0.0);
  finalColor = vec4(outc, 1.0);
}`;

export const PixiStage: React.FC<{ build: () => PixiScene; post: PixiPost }> = ({ build, post }) => {
  const frame = useCurrentFrame();
  const { width, height } = useVideoConfig();
  const hostRef = useRef<HTMLDivElement>(null);
  const [ready, setReady] = useState<null | ((f: number) => void)>(null);
  const [initHandle] = useState(() => delayRender("Initialising PixiJS"));

  useEffect(() => {
    let destroyed = false;
    const app = new Application();
    const dprRaw = window.devicePixelRatio || 1;
    const dpr = getRemotionEnvironment().isRendering ? dprRaw : Math.min(dprRaw, 0.4);
    const W = Math.round(width * dpr);
    const H = Math.round(height * dpr);
    app
      .init({
        width: W,
        height: H,
        resolution: 1,
        preference: "webgl",
        autoStart: false,
        preserveDrawingBuffer: true,
        antialias: false,
        background: "#000000",
        backgroundAlpha: 1,
        powerPreference: "high-performance",
      })
      .then(() => {
        if (destroyed) return;
        app.ticker.stop();
        const canvas = app.canvas as HTMLCanvasElement;
        canvas.style.width = `${width}px`;
        canvas.style.height = `${height}px`;
        canvas.style.display = "block";
        hostRef.current?.appendChild(canvas);

        const scene = build();
        const px = H / 2160;
        const worldRT = floatTarget(W, H);
        const qW = Math.max(2, Math.round(W / 4)),
          qH = Math.max(2, Math.round(H / 4));
        const eW = Math.max(2, Math.round(W / 16)),
          eH = Math.max(2, Math.round(H / 16));
        const mk = (w: number, h: number) => floatTarget(w, h);
        const halfRT = mk(Math.round(W / 2), Math.round(H / 2));
        const rtA = mk(qW, qH),
          tmpA = mk(qW, qH);
        const rt8 = mk(Math.round(W / 8), Math.round(H / 8));
        const rtB = mk(eW, eH),
          tmpB = mk(eW, eH);
        const fb = new FloatBlur();
        const composite = new Filter({
          glProgram: GlProgram.from({ vertex: VERT, fragment: FRAG, name: "composite-dither-grain" }),
          resources: {
            uWorld: worldRT.source,
            uBloomA: rtA.source,
            uBloomB: rtB.source,
            u: {
              uFrame: { value: 0, type: "f32" },
              uGrain: { value: post.grain, type: "f32" },
              uDither: { value: post.dither ? 1 : 0, type: "f32" },
              uBlackSafe: { value: post.blackSafe ? 1 : 0, type: "f32" },
              uBloomAk: { value: post.bloomA, type: "f32" },
              uBloomBk: { value: post.bloomB, type: "f32" },
              uExposure: { value: post.exposure, type: "f32" },
              uBg: { value: new Float32Array(post.bg), type: "vec3<f32>" },
            },
          },
        });
        const screen = new Sprite(Texture.WHITE);
        screen.width = W;
        screen.height = H;
        screen.filters = [composite];
        app.stage.addChild(screen);
        app.stage.filterArea = new Rectangle(0, 0, W, H);
        screen.filterArea = new Rectangle(0, 0, W, H);

        const draw = (f: number) => {
          scene.update(f, { width: W, height: H, px });
          app.renderer.render({ container: scene.world, target: worldRT, clear: true, clearColor: [0, 0, 0, 0] });
          const rd = app.renderer as never;
          fb.down(rd, worldRT, halfRT);
          fb.down(rd, halfRT, rtA);
          fb.blur(rd, rtA, tmpA, 1.0);
          fb.blur(rd, rtA, tmpA, 2.0);
          fb.down(rd, rtA, rt8);
          fb.down(rd, rt8, rtB);
          fb.blur(rd, rtB, tmpB, 1.0);
          fb.blur(rd, rtB, tmpB, 2.0);
          const gp = post.grainPeriod;
          composite.resources.u.uniforms.uFrame = ((f % gp) + gp) % gp;
          const bl = scene.bloomAt ? scene.bloomAt(f) : [post.bloomA, post.bloomB];
          composite.resources.u.uniforms.uBloomAk = bl[0];
          composite.resources.u.uniforms.uBloomBk = bl[1];
          app.render();
        };
        setReady(() => draw);
        continueRender(initHandle);
      });
    return () => {
      destroyed = true;
      try {
        app.destroy(true, { children: true, texture: true });
      } catch {
        /* not initialised */
      }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useLayoutEffect(() => {
    if (ready) ready(frame);
  }, [ready, frame]);

  return <AbsoluteFill ref={hostRef} style={{ backgroundColor: "#000" }} />;
};
