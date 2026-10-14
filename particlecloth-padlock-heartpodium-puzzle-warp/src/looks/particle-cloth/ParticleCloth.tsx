import React, { useEffect, useLayoutEffect, useRef, useState } from "react";
import { AbsoluteFill, continueRender, delayRender, useCurrentFrame, useVideoConfig } from "remotion";
import { Application, Container, Geometry, Mesh, RenderTexture, Shader, UniformGroup } from "pixi.js";
import { mulberry32 } from "../../lib/random";
import { loopFrame, loopTheta, renderDpr } from "../../lib/loop";
import { NOISE4D_GLSL } from "../../lib/noise4d.glsl";
import { GRAIN_GLSL } from "../../lib/grain.glsl";

export interface ParticleClothProps {
  /** colour where the sheet faces the camera / is dense */
  light: string;
  /** colour of the sheet's shaded, sparse parts */
  deep: string;
}

// ---------- particle grid (module level, seeded) ----------
const COLS = 640;
const ROWS = 320;
const COUNT = COLS * ROWS; // 204,800
const grid = (() => {
  const rnd = mulberry32(0xc1077001);
  const pos = new Float32Array(COUNT * 2);
  const seed = new Float32Array(COUNT * 2);
  let k = 0;
  for (let j = 0; j < ROWS; j++) {
    for (let i = 0; i < COLS; i++) {
      // tiny sub-cell jitter keeps the grid's moiré without looking ruled
      pos[k * 2] = (i + 0.5 + (rnd() - 0.5) * 0.35) / COLS;
      pos[k * 2 + 1] = (j + 0.5 + (rnd() - 0.5) * 0.35) / ROWS;
      seed[k * 2] = rnd();
      seed[k * 2 + 1] = rnd();
      k++;
    }
  }
  return { pos, seed };
})();

const hexToLinear = (hex: string): [number, number, number] => {
  const n = parseInt(hex.slice(1), 16);
  const f = (c: number) => {
    const s = c / 255;
    return s <= 0.04045 ? s / 12.92 : Math.pow((s + 0.055) / 1.055, 2.4);
  };
  return [f((n >> 16) & 255), f((n >> 8) & 255), f(n & 255)];
};

const CLOTH_VERT = /* glsl */ `#version 300 es
precision highp float;
in vec2 aPosition;   // grid uv 0..1
in vec2 aSeed;
uniform float uTheta;    // 2π·(frame % 600)/600
uniform float uAspect;
uniform float uPx;       // drawing-buffer px per 720p px
uniform vec3 uCam;       // camera offset (closed drift)
uniform vec3 uLight;
uniform vec3 uDeep;
out vec3 vColor;
out float vSoft;
${NOISE4D_GLSL}

const float D = 4.0;          // camera distance; frame half-height = 1 at z = 0
const float PI = 3.14159265;

vec4 T(float r) { return vec4(r * cos(uTheta), r * sin(uTheta), 0.0, 0.0); }

// sheet position for grid coords g (u,v)
vec3 sheet(vec2 g) {
  float sx = uAspect * 2.0 * 1.18;   // overflow the frame sideways
  float sy = 1.22;                   // ~55–60% of frame height before the edge lumps
  vec3 p = vec3((g.x - 0.5) * sx, (g.y - 0.5) * sy, 0.0);
  vec2 q = vec2(p.x * 0.55, p.y * 0.9);
  float c = cos(uTheta), s = sin(uTheta);
  // travelling waves in two directions (whole cycles per loop)
  float w1 = sin(p.x * 1.9 - uTheta * 2.0 + p.y * 0.8);
  float w2 = sin(p.x * 1.15 + p.y * 2.6 + uTheta * 1.0 + 1.3);
  float w3 = sin(p.x * 3.3 - p.y * 1.1 - uTheta * 3.0 + 0.4);
  // domain-warped noise on a time circle → folds
  vec4 tc = vec4(q, 1.25 * c, 1.25 * s);
  float warp = snoise(tc + vec4(7.1, 3.3, 0.0, 0.0));
  float warp2 = snoise(vec4(q * 0.8 + 11.0, 0.9 * s, 0.9 * c));
  vec2 qw = q + vec2(warp, warp2) * 0.55;
  float fold = snoise(vec4(qw * 1.35, 1.4 * c + 3.0, 1.4 * s - 2.0));
  p.z += 0.42 * w1 + 0.22 * w2 + 0.08 * w3 + 0.42 * fold;
  // the band undulates up and down, and is pushed along by the folds
  p.y += 0.07 * sin(p.x * 1.3 - uTheta * 2.0 + 0.7) + 0.08 * warp2 + 0.08 * fold * (g.y - 0.2);
  // lumpy, cloud-like top and bottom silhouettes
  float lumpT = snoise(vec4(p.x * 1.5, 2.0, 1.1 * c, 1.1 * s));
  float lumpB = snoise(vec4(p.x * 1.3, 9.0, 0.9 * s, 0.9 * c));
  p.y += 0.24 * lumpT * smoothstep(0.45, 1.0, g.y) - 0.16 * lumpB * smoothstep(0.55, 0.0, g.y);
  p.x += 0.16 * warp + 0.06 * w2;
  return p;
}

void main() {
  vec2 g = aPosition;
  vec3 P = sheet(g);
  // sheet normal from finite differences
  vec3 Pu = sheet(g + vec2(1.5 / 640.0, 0.0)) - P;
  vec3 Pv = sheet(g + vec2(0.0, 1.5 / 320.0)) - P;
  vec3 N = normalize(cross(Pu, Pv));
  // edge scatter: amplitude grows toward the top and bottom edges
  float ev = abs(g.y - 0.5) * 2.0;
  float e = smoothstep(0.6, 1.0, ev);
  float c = cos(uTheta + aSeed.x * 6.2831853), s = sin(uTheta + aSeed.x * 6.2831853);
  vec3 jit = vec3(
    snoise(vec4(g * 9.0, c * 0.7, s * 0.7)),
    snoise(vec4(g * 9.0 + 5.0, s * 0.7, c * 0.7)) * 1.4 + sign(g.y - 0.5) * 0.9,
    (aSeed.y - 0.5) * 2.0);
  P += jit * e * e * 0.10 * (0.3 + aSeed.y);
  // fluff: the sheet has some thickness and breaks into clumps, not a clean surface
  float fl = snoise(vec4(g * vec2(22.0, 11.0), c * 0.9 + 4.0, s * 0.9));
  P += N * ((aSeed.y - 0.5) * 0.12 + fl * 0.08) + vec3(0.0, fl * 0.035, 0.0);
  // project (camera with a slight closed drift)
  vec3 V = P - uCam;
  float persp = D / (D - V.z);
  vec2 ndc = vec2(V.x * persp / uAspect, V.y * persp);
  // bunching: projected area of this point's grid cell (small area = dense)
  float cellA = abs(Pu.x * Pv.y - Pu.y * Pv.x) * persp * persp + 1e-6;
  float bunch = clamp(pow(2.2e-5 / cellA, 0.3), 0.7, 1.25);
  gl_Position = vec4(ndc, 0.0, 1.0);
  float size = (3.4 + aSeed.x * 1.6) * persp * uPx;
  gl_PointSize = max(size, 1.0);
  float cover = min(size * size, 1.0);   // sub-pixel points keep their energy
  float facing = abs(N.z);
  float lit = 0.55 + 0.45 * pow(facing, 1.2);
  float fade = 1.0 - e * 0.85;
  vec3 deep = max(mix(vec3(dot(uDeep, vec3(0.2126, 0.7152, 0.0722))), uDeep, 1.5), 0.0);
  vec3 col = mix(deep, uLight, smoothstep(0.45, 1.0, facing) * 0.7 + 0.25 * aSeed.y);
  vColor = col * lit * fade * cover * bunch * (0.5 + 0.75 * aSeed.y);
  vSoft = step(1.6, size);
}
`;

const CLOTH_FRAG = /* glsl */ `#version 300 es
precision highp float;
in vec3 vColor;
in float vSoft;
out vec4 fragColor;
void main() {
  float d = length(gl_PointCoord - 0.5) * 2.0;
  // tiny glassy bead: crisp disc, darker rim, bright off-centre highlight
  vec2 hp = gl_PointCoord - vec2(0.38, 0.36);
  float hl = exp(-dot(hp, hp) * 40.0);
  // sphere height profile: under MAX blending overlapping beads form a pile of
  // spheres with darker valleys between them, like the reference
  float a = mix(1.0, step(d, 1.0) * (0.06 + 0.62 * (1.0 - d * d) + 0.75 * hl), vSoft);
  fragColor = vec4(vColor * a, 1.0);
}
`;

const FINAL_VERT = /* glsl */ `#version 300 es
precision highp float;
in vec2 aPosition;
out vec2 vUv;
void main() { vUv = aPosition * 0.5 + 0.5; gl_Position = vec4(aPosition, 0.0, 1.0); }
`;

const FINAL_FRAG = /* glsl */ `#version 300 es
precision highp float;
in vec2 vUv;
uniform sampler2D uTexture;
uniform float uLoopFrame;
uniform vec2 uTexel;
out vec4 fragColor;
${GRAIN_GLSL}
void main() {
  vec3 acc = texture(uTexture, vUv).rgb;
  // a whisper of glow from the dense areas
  vec3 glow = vec3(0.0);
  for (int i = 0; i < 8; i++) {
    float a = float(i) * 0.785398;
    glow += texture(uTexture, vUv + vec2(cos(a), sin(a)) * uTexel * 3.0).rgb;
  }
  acc += glow / 8.0 * 0.25;
  vec3 c = 1.0 - exp(-acc * 1.6);
  c = linearToSRGB(c);
  c = applyGrainDither(c, gl_FragCoord.xy, uLoopFrame, 0.015, 0.03, 1.0);
  fragColor = vec4(clamp(c, 0.0, 1.0), 1.0);
}
`;

interface PixiWorld {
  app: Application;
  update: (frame: number) => void;
}

const createPixiWorld = async (canvas: HTMLCanvasElement, w: number, h: number, props: ParticleClothProps): Promise<PixiWorld> => {
  const app = new Application();
  await app.init({
    canvas,
    width: w,
    height: h,
    resolution: 1,
    preference: "webgl",
    antialias: false,
    preserveDrawingBuffer: true,
    autoStart: false,
    sharedTicker: false,
    backgroundColor: 0x000000,
    hello: false,
  });
  app.ticker?.stop();

  const clothU = new UniformGroup({
    uTheta: { value: 0, type: "f32" },
    uAspect: { value: w / h, type: "f32" },
    uPx: { value: h / 720, type: "f32" },
    uCam: { value: new Float32Array([0, 0, 0]), type: "vec3<f32>" },
    uLight: { value: new Float32Array(hexToLinear(props.light)), type: "vec3<f32>" },
    uDeep: { value: new Float32Array(hexToLinear(props.deep)), type: "vec3<f32>" },
  });
  const clothGeo = new Geometry({
    attributes: {
      aPosition: { buffer: grid.pos, format: "float32x2" },
      aSeed: { buffer: grid.seed, format: "float32x2" },
    },
    topology: "point-list",
  });
  const clothShader = Shader.from({ gl: { vertex: CLOTH_VERT, fragment: CLOTH_FRAG }, resources: { clothU } });
  const cloth = new Mesh({ geometry: clothGeo, shader: clothShader });
  // MAX blending: overlapping beads stay distinct instead of smearing into haze
  // (order-independent, so still deterministic across threads)
  cloth.blendMode = "max";
  const clothStage = new Container();
  clothStage.addChild(cloth);

  // accumulate in half float so dense areas build up smoothly
  const accum = RenderTexture.create({ width: w, height: h, format: "rgba16float", antialias: false });

  const finalU = new UniformGroup({
    uLoopFrame: { value: 0, type: "f32" },
    uTexel: { value: new Float32Array([1 / w, 1 / h]), type: "vec2<f32>" },
  });
  const quad = new Geometry({
    attributes: { aPosition: { buffer: new Float32Array([-1, -1, 1, -1, 1, 1, -1, 1]), format: "float32x2" } },
    indexBuffer: new Uint32Array([0, 1, 2, 0, 2, 3]),
  });
  const finalShader = Shader.from({
    gl: { vertex: FINAL_VERT, fragment: FINAL_FRAG },
    resources: { finalU, uTexture: accum.source },
  });
  const finalMesh = new Mesh({ geometry: quad, shader: finalShader });
  const finalStage = new Container();
  finalStage.addChild(finalMesh);

  return {
    app,
    update: (frame: number) => {
      const th = loopTheta(frame);
      clothU.uniforms.uTheta = th;
      const cam = clothU.uniforms.uCam as Float32Array;
      cam[0] = 0.05 * Math.sin(th);
      cam[1] = 0.03 * Math.sin(th * 2 + 0.5);
      cam[2] = 0.08 * Math.cos(th);
      clothU.update();
      finalU.uniforms.uLoopFrame = loopFrame(frame);
      finalU.update();
      app.renderer.render({ container: clothStage, target: accum, clear: true, clearColor: [0, 0, 0, 1] });
      app.renderer.render({ container: finalStage, clear: true, clearColor: [0, 0, 0, 1] });
    },
  };
};

export const ParticleCloth: React.FC<ParticleClothProps> = (props) => {
  const frame = useCurrentFrame();
  const { width, height } = useVideoConfig();
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [world, setWorld] = useState<PixiWorld | null>(null);
  const [initHandle] = useState(() => delayRender("Initialising PixiJS"));
  const dpr = renderDpr();
  const w = Math.round(width * dpr);
  const h = Math.round(height * dpr);
  const { light, deep } = props;

  useEffect(() => {
    let cancelled = false;
    let made: PixiWorld | null = null;
    createPixiWorld(canvasRef.current!, w, h, { light, deep })
      .then((wd) => {
        made = wd;
        if (cancelled) {
          wd.app.destroy();
          return;
        }
        setWorld(wd);
      })
      .catch((e) => {
        console.error(e);
        throw e;
      });
    return () => {
      cancelled = true;
      made?.app.destroy();
    };
  }, [w, h, light, deep]);

  // render the stage manually once per Remotion frame (no ticker)
  useLayoutEffect(() => {
    if (!world) return;
    world.update(frame);
    continueRender(initHandle);
  }, [world, frame, initHandle]);

  return (
    <AbsoluteFill style={{ backgroundColor: "black" }}>
      <canvas ref={canvasRef} width={w} height={h} style={{ width: "100%", height: "100%" }} />
    </AbsoluteFill>
  );
};
