import { Container, RenderTexture } from "pixi.js";
import React, { useMemo } from "react";
import { canvasTexture, fullscreenMesh, GLSL_HEADER, ShaderMesh } from "../../lib/pixi/helpers";
import { PixiCanvas, PixiLook } from "../../lib/pixi/PixiCanvas";
import { noiseTexture } from "../../lib/noisetex";
import { loopPhase } from "../../lib/rand";
import { catmull, resample } from "../../lib/spline";
import { drawStars } from "./stars";
import { drawTreeline } from "./treeline";

export type AuroraParams = {
  green: string; // curtain colour
  edge: string; // bright lower edge
  top: string; // upper colour (same as green for the pure-green version)
  topMix: number; // 0..1 how strongly tops shift to `top`
  brightness: number;
};

const hex = (h: string) => {
  const n = parseInt(h.replace("#", ""), 16);
  return [((n >> 16) & 255) / 255, ((n >> 8) & 255) / 255, (n & 255) / 255];
};
const lin = (c: number[]) => c.map((v) => Math.pow(v, 2.2));

// Shared loopable noise: two translations of a tileable fbm texture around
// circles in opposite directions -> evolving pattern, exact 600-frame loop.
const NOISE = /* glsl */ `
uniform sampler2D uNoise;
uniform float uTheta;
vec4 N(vec2 p) { return texture(uNoise, p); }
vec4 LN(vec2 p, float r) {
  vec2 o = vec2(cos(uTheta), sin(uTheta)) * r;
  return 0.5 * (texture(uNoise, p + o) + texture(uNoise, p.yx * vec2(1.0, -1.0) + vec2(0.37, 0.11) - o.yx));
}
`;

// Pass 1 (half resolution): the curtains, in linear light. Each sheet is a
// ribbon of NODES nodes (position, tangent, height, brightness) computed on
// the CPU per frame in closed form, splatted additively (aurora is emissive).
const RIBBONS = 4;
const NODES = 24;
const CURTAIN = /* glsl */ `${GLSL_HEADER}
in vec2 vUV;
out vec4 finalColor;
uniform vec3 uGreen;
uniform vec3 uEdge;
uniform vec3 uTop;
uniform float uTopMix;
uniform vec4 uNode[${RIBBONS * NODES}];
uniform vec4 uAttr[${RIBBONS * NODES}];
${NOISE}

void main() {
  vec2 s = vUV * vec2(1.7778, 1.0);
  vec3 acc = vec3(0.0);
  for (int r = 0; r < ${RIBBONS}; r++) {
    float W = 0.0, Ta = 0.0, I = 0.0, E = 0.0, T = 0.0, B = 0.0;
    for (int i = 0; i < ${NODES}; i++) {
      vec4 nd = uNode[r * ${NODES} + i];
      vec4 at = uAttr[r * ${NODES} + i];
      vec2 dp = s - nd.xy;
      float a = dot(dp, nd.zw);
      // normal = tangent rotated so a left-to-right ribbon glows upward (-y)
      float v = dot(dp, vec2(nd.w, -nd.z));
      float w = exp(-a * a / (2.0 * at.w * at.w));
      if (w < 1e-4) continue;
      float H = at.x;
      float lower = r == 3 ? smoothstep(-0.12, 0.05, v) : smoothstep(-0.018, 0.008, v);
      float vv = max(v, 0.0);
      float prof = (exp(-vv / H) * 0.8 + exp(-vv / (H * 0.25)) * 0.7 + exp(-vv / 0.01) * 0.8) * lower
                 + (1.0 - lower) * exp(-max(-v, 0.0) / 0.035) * 0.15
                 + exp(-abs(v - H * 0.3) / 0.06) * 0.03;
      float wb = w * at.y;
      I += wb * prof;
      E += wb * exp(-vv / 0.025) * lower;
      B += wb * exp(-abs(v + 0.012) / 0.01);
      T += wb * smoothstep(H * 0.35, H * 1.3, vv) * prof;
      W += w; Ta += w * (at.z + a);
    }
    if (W < 1e-3) continue;
    // Rays converge on the magnetic zenith (above the frame): their
    // coordinate is the angle around that point, drifting slowly.
    vec2 zd = s - vec2(1.05, -0.3);
    float phi = atan(zd.x, zd.y);
    float rho = length(zd);
    // rays wander a little (field-line structure + exposure motion)
    phi += (LN(vec2(rho * 1.7, phi * 0.6) + float(r) * 0.4, 0.06).y - 0.5) * 0.035;
    float drift = 0.012 * sin(uTheta + float(r)) + 0.006 * sin(2.0 * uTheta + float(r) * 2.3);
    // coarse ray bundles x fine striations (long along the field lines)
    vec4 r1 = LN(vec2((phi + drift) * 1.3 + float(r) * 0.31, rho * 0.08), 0.05);
    vec4 r2 = LN(vec2((phi - drift) * 5.5 + float(r) * 0.17, rho * 0.05 + 0.5), 0.12);
    float ray = mix(1.0, (0.3 + 1.0 * pow(r1.z, 2.0)) * (0.35 + 1.25 * pow(r2.w, 2.2)), 0.45);
    vec4 al = LN(vec2(Ta / W * 0.45 + float(r) * 0.23, 0.2), 0.07);
    float along = mix(0.02, 1.35, smoothstep(0.35, 0.72, al.x * 0.7 + al.y * 0.3));
    // blotchy, uneven brightness within the curtains
    along *= 0.55 + 0.9 * LN(vec2(Ta / W * 1.7 + 3.1, 0.6) + float(r), 0.08).z;
    float k = ray * along;
    // colour with height: yellow-green bright lower edge, green body,
    // faint red/purple tops
    vec3 col = uGreen * I + (uEdge - uGreen) * E * 0.2;
    col = mix(col, uTop * I, clamp(T / max(I, 1e-4), 0.0, 1.0) * uTopMix);
    // very faint magenta fringe just under the brightest lower edges
    col += vec3(0.5, 0.05, 0.35) * B * 0.14;
    acc += col * k;
  }
  finalColor = vec4(acc, 1.0);
}`;

type V2 = [number, number];
type RibbonDef = {
  pts: (th: number) => V2[];
  height: (u: number) => number;
  bright: (u: number, th: number) => number;
};

const S = Math.sin, C = Math.cos;
// Control points move on whole-cycle sines of theta -> exact loop.
const RIBBON_DEFS: RibbonDef[] = [
  {
    // Main band from the left, folding up into a tall curl right of centre.
    pts: (th) => [
      [-0.2, 0.5 + 0.02 * S(th)],
      [0.12, 0.55 + 0.03 * S(th + 1.0)],
      [0.42, 0.6 + 0.03 * S(2 * th + 0.5)],
      [0.7, 0.66 + 0.025 * S(th + 2.0)],
      [0.95 + 0.03 * S(th), 0.72 + 0.02 * C(2 * th)],
      [1.12 + 0.03 * S(th + 0.7), 0.64 + 0.02 * S(th)],
      [1.19 + 0.03 * S(th + 1.2), 0.47 + 0.03 * C(th)],
      [1.18 + 0.03 * S(th + 1.9), 0.31 + 0.04 * S(th + 0.4)],
      [1.11 + 0.02 * C(th), 0.21 + 0.03 * S(2 * th)],
    ],
    height: (u) => 0.08 + 0.15 * Math.pow(Math.max(0, (u - 0.5) / 0.5), 1.3),
    bright: (u, th) => 1.2 + 0.3 * S(th + u * 4.0),
  },
  {
    // Second band beneath the fold.
    pts: (th) => [
      [0.62, 0.86 + 0.02 * S(th + 0.3)],
      [0.86, 0.88 + 0.02 * C(th)],
      [1.1, 0.86 + 0.03 * S(2 * th + 1.0)],
      [1.3, 0.84 + 0.03 * S(th + 2.2)],
      [1.45, 0.83 + 0.02 * C(th + 0.6)],
    ],
    height: () => 0.08,
    bright: (u, th) => 0.7 + 0.25 * S(th * 2 + u * 3.0),
  },
  {
    // Lower band, right, near the horizon.
    pts: (th) => [
      [0.8, 0.95 + 0.01 * S(th)],
      [1.0, 0.94 + 0.015 * S(th + 1.3)],
      [1.2, 0.93 + 0.015 * C(th + 0.4)],
      [1.4, 0.93 + 0.01 * C(th)],
    ],
    height: () => 0.06,
    bright: (u, th) => 0.35 + 0.15 * S(th + u * 5.0),
  },
  {
    // Faint high streaks, upper right.
    pts: (th) => [
      [1.3, 0.2 + 0.02 * S(th)],
      [1.55, 0.13 + 0.02 * C(th + 0.5)],
      [1.95, 0.17 + 0.02 * S(th + 1.5)],
    ],
    height: () => 0.12,
    bright: () => 0.025,
  },
];

const ribbonUniforms = (th: number, node: Float32Array, attr: Float32Array) => {
  RIBBON_DEFS.forEach((def, r) => {
    const now = def.pts(th);
    const mean = def.pts(0).map((_, i) => {
      let x = 0, y = 0;
      for (let k = 0; k < 8; k++) {
        const q = def.pts((k / 8) * Math.PI * 2)[i];
        x += q[0] / 8;
        y += q[1] / 8;
      }
      return [x, y] as V2;
    });
    const pts = now.map((p, i) => [mean[i][0] + 0.6 * (p[0] - mean[i][0]), mean[i][1] + 0.6 * (p[1] - mean[i][1])] as V2);
    const dense = catmull(pts, 20);
    const { p, t, len } = resample(dense, NODES);
    const spacing = len / (NODES - 1);
    for (let i = 0; i < NODES; i++) {
      const k = (r * NODES + i) * 4;
      const u = i / (NODES - 1);
      node[k] = p[i][0];
      node[k + 1] = p[i][1];
      node[k + 2] = t[i][0];
      node[k + 3] = t[i][1];
      // fade the ribbon ends
      const endFade = Math.min(1, u / 0.12, (1 - u) / 0.12);
      attr[k] = def.height(u);
      attr[k + 1] = def.bright(u, th) * Math.max(0, endFade) * (spacing / (spacing * 0.75 * 2.5066));
      attr[k + 2] = u * len;
      attr[k + 3] = spacing * 0.75;
    }
  });
};

// Pass 2 (full resolution): sky, stars, clouds, curtains, treeline.
const COMPOSITE = /* glsl */ `${GLSL_HEADER}
in vec2 vUV;
out vec4 finalColor;
uniform sampler2D uCurtains;
uniform sampler2D uTrees;
uniform sampler2D uStars;
uniform vec3 uGreen;
uniform float uBright;
${NOISE}
void main() {
  vec2 s = vUV * vec2(1.7778, 1.0);
  // night sky with faint airglow toward the horizon
  vec3 sky = vec3(0.0006, 0.0008, 0.0011) + vec3(0.0022, 0.0024, 0.0016) * smoothstep(0.35, 1.0, s.y);
  vec3 aur = texture(uCurtains, vUV).rgb * uBright;
  // broad scattered glow: the sky brightens around bright aurora
  // true wide blur from the curtain target's mip chain (no offset copies)
  vec3 wide = (textureLod(uCurtains, vUV, 4.5).rgb + textureLod(uCurtains, vUV, 5.5).rgb + textureLod(uCurtains, vUV, 6.5).rgb) * (uBright / 3.0);
  vec3 stars = texture(uStars, vUV).rgb * 0.09 * (0.75 + 0.5 * LN(vUV * 60.0, 0.3).w);
  vec3 col = sky + stars * (1.0 - smoothstep(0.45, 0.75, s.y)) + aur + wide * 1.1;
  // Clouds, lower left, lit by the aurora above them.
  vec4 cn = LN(vec2(s.x * 0.45, s.y * 0.9) + 0.6, 0.03);
  float region = (1.0 - smoothstep(0.3, 0.75, s.x)) * smoothstep(0.36, 0.48, s.y) * (1.0 - smoothstep(0.74, 0.92, s.y));
  float cloud = smoothstep(0.1, 0.6, cn.x * 0.75 + cn.y * 0.25) * region;
  vec3 cloudCol = vec3(0.075, 0.08, 0.075) * (0.6 + 0.6 * cn.w) + wide * 0.8 + aur * 0.25;
  col = mix(col, cloudCol, cloud * 0.85);
  // Foreground: R = ground, G = trees (both always in front of the sky).
  vec4 fg = texture(uTrees, vUV);
  vec3 ground = vec3(0.0022, 0.0026, 0.0024) + wide * 0.12;
  col = mix(col, ground, max(fg.r, fg.g));
  // tree silhouettes pick up a faint green rim from the sky behind them
  float rim = fg.g * (1.0 - fg.g) * 4.0;
  col = mix(col, vec3(0.0022, 0.0026, 0.0024) + wide * 0.04 * rim, fg.g);
  finalColor = vec4(col, 1.0);
}`;

type Scene = { root: Container; curtains: Container; rt: RenderTexture; meshes: ShaderMesh[]; node: Float32Array; attr: Float32Array };

const makeLook = (params: AuroraParams): PixiLook<Scene> => ({
  post: { grain: 0.015, darkFade: true, blueNoise: 1.0, linear: true, vignette: 0.28 },
  build: ({ W, H, res }) => {
    const noise = noiseTexture(256, [[4, 4], [4, 4], [8, 3], [16, 3]], 777);
    const trees = canvasTexture(drawTreeline(W, H, res));
    const stars = canvasTexture(drawStars(W, H, res));
    const rt = RenderTexture.create({ width: W, height: H, resolution: res * 0.75, format: "rgba16float", autoGenerateMipmaps: true });
    rt.source.style.mipmapFilter = "linear";
    const node = new Float32Array(RIBBONS * NODES * 4);
    const attr = new Float32Array(RIBBONS * NODES * 4);
    const common = {
      uTheta: { value: 0, type: "f32" },
      uGreen: { value: lin(hex(params.green)), type: "vec3<f32>" },
    };
    const curt = fullscreenMesh(
      W,
      H,
      CURTAIN,
      {
        ...common,
        uEdge: { value: lin(hex(params.edge)), type: "vec3<f32>" },
        uTop: { value: lin(hex(params.top)), type: "vec3<f32>" },
        uTopMix: { value: params.topMix, type: "f32" },
        uNode: { value: node, type: "vec4<f32>", size: RIBBONS * NODES },
        uAttr: { value: attr, type: "vec4<f32>", size: RIBBONS * NODES },
      },
      { uNoise: noise.source },
      "aurora-curtains",
    );
    const comp = fullscreenMesh(
      W,
      H,
      COMPOSITE,
      { ...common, uBright: { value: params.brightness, type: "f32" } },
      { uNoise: noise.source, uCurtains: rt.source, uTrees: trees.source, uStars: stars.source },
      "aurora-composite",
    );
    const curtains = new Container();
    curtains.addChild(curt.mesh);
    const root = new Container();
    root.addChild(comp.mesh);
    return { root, curtains, rt, meshes: [curt, comp], node, attr };
  },
  update: (s, frame, ctx) => {
    const th = loopPhase(frame) * Math.PI * 2;
    for (const m of s.meshes) m.u.uTheta = th;
    ribbonUniforms(th, s.node, s.attr);
    ctx.app.renderer.render({ container: s.curtains, target: s.rt, clear: true, clearColor: [0, 0, 0, 1] });
    s.rt.source.updateMipmaps();
  },
  root: (s) => s.root,
});

export const Aurora: React.FC<{ params: AuroraParams }> = ({ params }) => {
  const look = useMemo(() => makeLook(params), [params]);
  return <PixiCanvas look={look} />;
};
