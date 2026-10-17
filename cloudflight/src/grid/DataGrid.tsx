import { useFrame, useThree } from "@react-three/fiber";
import { ThreeCanvas } from "@remotion/three";
import React, { useEffect, useLayoutEffect, useMemo, useState } from "react";
import {
  continueRender,
  delayRender,
  staticFile,
  useCurrentFrame,
  useVideoConfig,
} from "remotion";
import * as THREE from "three";
import type { DataGridRow } from "../data";
import { hexToLinear } from "../lib/color";
import { renderDpr } from "../lib/dpr";
import { FULLSCREEN_VERT, GLSL_FINISH, GLSL_HASH, GLSL_HEADER } from "../lib/glsl";
import { getBlueNoiseTexture } from "../lib/textures";
import { makeLayout } from "./layout";

const TAU = Math.PI * 2;
const FONT_FAMILY = "JetBrainsMonoGrid";
const CELL_W = 256;
const CELL_H = 88;
const ATLAS_COLS = 10;

const LINE_VERT = /* glsl */ `
precision highp float;
in vec3 position;          // x: along (0..1), y: across (-1..1)
in vec3 iA;
in vec3 iB;
in float iBright;
uniform mat4 modelViewMatrix;
uniform mat4 projectionMatrix;
uniform vec2 uRes;
uniform float uWidth;      // px at 1080p
uniform float uFocus;
uniform float uCoc;        // px of blur per unit of |1/focus - 1/depth| at 1080p
uniform float uFade;
out float vAcross;
out float vHalfW;
out float vAlpha;
out float vBright;
void main() {
  vec4 a = modelViewMatrix * vec4(iA, 1.0);
  vec4 b = modelViewMatrix * vec4(iB, 1.0);
  float nz = -0.15;
  if (a.z > nz && b.z > nz) { gl_Position = vec4(2.0, 2.0, 2.0, 1.0); return; }
  if (a.z > nz) a = mix(a, b, (a.z - nz) / (a.z - b.z));
  if (b.z > nz) b = mix(b, a, (b.z - nz) / (b.z - a.z));
  vec4 pa = projectionMatrix * a;
  vec4 pb = projectionMatrix * b;
  vec2 sa = pa.xy / pa.w * 0.5 * uRes;
  vec2 sb = pb.xy / pb.w * 0.5 * uRes;
  vec2 d = sb - sa;
  vec2 dir = length(d) > 1e-4 ? normalize(d) : vec2(1.0, 0.0);
  vec2 nrm = vec2(-dir.y, dir.x);
  float t = position.x;
  vec4 p = mix(pa, pb, t);
  float depth = -mix(a.z, b.z, t);
  float rs = uRes.y / 1080.0;
  float base = 0.5 * uWidth * rs;
  float coc = abs(1.0 / uFocus - 1.0 / max(depth, 0.2)) * uCoc * rs;
  float halfW = base + coc;
  float ext = halfW + 1.0;
  // Extend past the ends a little so caps are antialiased too.
  p.xy += (nrm * position.y * ext + dir * (t * 2.0 - 1.0) * 1.0) / (0.5 * uRes) * p.w;
  gl_Position = p;
  vAcross = position.y * ext;
  vHalfW = halfW;
  float energy = base / halfW;
  float near = smoothstep(0.6, 3.0, depth);
  vAlpha = energy * exp(-depth / uFade) * near;
  vBright = iBright;
}
`;

const LINE_FRAG = /* glsl */ `
precision highp float;
in float vAcross;
in float vHalfW;
in float vAlpha;
in float vBright;
uniform vec3 uColor;
out vec4 fragColor;
void main() {
  // Exact overlap of the line [-w, w] with this pixel [x - 0.5, x + 0.5]:
  // sub-pixel lines keep their energy instead of flickering.
  float x = abs(vAcross);
  float cov = clamp(min(vHalfW, x + 0.5) - max(-vHalfW, x - 0.5), 0.0, 1.0);
  float a = cov * vAlpha;
  vec3 c = mix(uColor, vec3(0.85, 1.0, 0.97), clamp(vBright - 1.0, 0.0, 1.0) * 0.8) * vBright * 1.35;
  fragColor = vec4(c * a, a);
}
`;

const DOT_VERT = /* glsl */ `
precision highp float;
in vec3 position;          // quad corner (-1..1)
in vec3 iP;
in float iSize;
in float iPhase;
uniform mat4 modelViewMatrix;
uniform mat4 projectionMatrix;
uniform vec2 uRes;
uniform float uFocus;
uniform float uCoc;
uniform float uFade;
uniform float uT;
out vec2 vUv;
out float vR;
out float vAlpha;
void main() {
  vec4 v = modelViewMatrix * vec4(iP, 1.0);
  if (v.z > -0.6) { gl_Position = vec4(2.0, 2.0, 2.0, 1.0); return; }
  vec4 p = projectionMatrix * v;
  float depth = -v.z;
  float rs = uRes.y / 1080.0;
  float base = iSize * 2.6 * rs * clamp(14.0 / depth, 0.7, 2.4);
  float coc = abs(1.0 / uFocus - 1.0 / depth) * uCoc * rs;
  float r = base + coc;
  p.xy += position.xy * (r + 1.0) / (0.5 * uRes) * p.w;
  gl_Position = p;
  vUv = position.xy * (r + 1.0);
  vR = r;
  float tw = 0.75 + 0.25 * sin(6.2831853 * 2.0 * uT + iPhase);
  vAlpha = (base * base) / (r * r) * exp(-depth / uFade) * tw * smoothstep(0.6, 3.0, depth);
}
`;

const DOT_FRAG = /* glsl */ `
precision highp float;
in vec2 vUv;
in float vR;
in float vAlpha;
uniform vec3 uColor;
out vec4 fragColor;
void main() {
  float d = length(vUv);
  float cov = clamp(vR + 0.5 - d, 0.0, 1.0);
  float a = cov * vAlpha;
  fragColor = vec4(mix(uColor, vec3(1.0), 0.5) * a * 1.6, a);
}
`;

const TAG_VERT = /* glsl */ `
precision highp float;
in vec3 position;          // corner (-0.5..0.5)
in vec3 iP;
in float iScale;
in float iCell;
uniform mat4 modelViewMatrix;
uniform mat4 projectionMatrix;
uniform vec2 uRes;
uniform float uFocus;
uniform float uCoc;
uniform float uFade;
uniform vec2 uAtlas;       // cols, rows
uniform vec2 uTagSize;     // world size
out vec2 vUv;
out float vBias;
out float vAlpha;
void main() {
  vec4 v = modelViewMatrix * vec4(iP, 1.0);
  if (v.z > -0.8) { gl_Position = vec4(2.0, 2.0, 2.0, 1.0); return; }
  v.xy += position.xy * uTagSize * iScale;
  gl_Position = projectionMatrix * v;
  float depth = -v.z;
  float col = mod(iCell, uAtlas.x);
  float row = floor(iCell / uAtlas.x);
  vec2 uv = position.xy + 0.5;
  vUv = vec2((col + uv.x) / uAtlas.x, 1.0 - (row + 1.0 - uv.y) / uAtlas.y);
  // Pixel size of one atlas texel decides the mip; DoF adds bias on top.
  float rs = uRes.y / 1080.0;
  float coc = abs(1.0 / uFocus - 1.0 / depth) * uCoc * rs;
  vBias = log2(1.0 + coc * 0.6);
  vAlpha = exp(-depth / uFade) * smoothstep(3.0, 6.0, depth);
}
`;

const TAG_FRAG = /* glsl */ `
precision highp float;
in vec2 vUv;
in float vBias;
in float vAlpha;
uniform sampler2D uAtlasTex;
out vec4 fragColor;
void main() {
  vec4 t = texture(uAtlasTex, vUv, vBias);
  // Atlas holds premultiplied sRGB; convert colour to linear.
  vec3 c = pow(max(t.rgb / max(t.a, 1e-4), 0.0), vec3(2.2)) * t.a;
  fragColor = vec4(c * 1.35, t.a) * vAlpha;
}
`;

const FINAL_FRAG = /* glsl */ `${GLSL_HEADER}
uniform sampler2D uScene;
uniform vec2 uResolution;
uniform vec3 uBgTop;
uniform vec3 uBgBottom;
${GLSL_HASH}
${GLSL_FINISH}
out vec4 fragColor;
void main() {
  vec2 uv = gl_FragCoord.xy / uResolution;
  vec3 bg = mix(uBgBottom, uBgTop, uv.y);
  vec4 s = texelFetch(uScene, ivec2(gl_FragCoord.xy), 0);
  vec3 c = bg * (1.0 - min(s.a, 1.0) * 0.0) + s.rgb;
  // Gentle shoulder for overlapping bright lines.
  c = c / (1.0 + 0.25 * max(c - 0.7, 0.0));
  fragColor = vec4(finishSrgb(linearToSrgb(c), gl_FragCoord.xy, uFrame), 1.0);
}
`;

const instancedQuad = (corners: number[], index: number[]) => {
  const g = new THREE.InstancedBufferGeometry();
  g.setAttribute("position", new THREE.Float32BufferAttribute(corners, 3));
  g.setIndex(index);
  return g;
};

const useFontReady = () => {
  const [ready, setReady] = useState(false);
  useEffect(() => {
    const handle = delayRender("Loading JetBrains Mono");
    const face = new FontFace(FONT_FAMILY, `url(${staticFile("fonts/JetBrainsMono-Medium.woff2")})`);
    face
      .load()
      .then((f) => {
        document.fonts.add(f);
        setReady(true);
        continueRender(handle);
      })
      .catch((e) => {
        throw e;
      });
  }, []);
  return ready;
};

const GridScene: React.FC<{ row: DataGridRow }> = ({ row }) => {
  const frame = useCurrentFrame();
  const { gl } = useThree();
  const buf = useMemo(() => new THREE.Vector2(), []);
  gl.getDrawingBufferSize(buf);
  const w = buf.x;
  const h = buf.y;
  const looped = frame % row.durationInFrames;
  const t = looped / row.durationInFrames;

  const layout = useMemo(() => makeLayout(row.seed), [row.seed]);
  const lineColor = useMemo(() => new THREE.Vector3(...hexToLinear(row.line)), [row.line]);

  const camera = useMemo(() => new THREE.PerspectiveCamera(48, w / h, 0.1, 400), [w, h]);

  const common = useMemo(
    () => ({
      uRes: { value: new THREE.Vector2(w, h) },
      uFocus: { value: 14.0 },
      uCoc: { value: 12.0 },
      uFade: { value: 70.0 },
      uT: { value: 0 },
    }),
    [w, h],
  );

  const scene = useMemo(() => {
    const s = new THREE.Scene();
    // Lines.
    const lg = instancedQuad([0, -1, 0, 1, -1, 0, 1, 1, 0, 0, 1, 0], [0, 1, 2, 0, 2, 3]);
    const A = new Float32Array(layout.segs.length * 3);
    const B = new Float32Array(layout.segs.length * 3);
    const Br = new Float32Array(layout.segs.length);
    layout.segs.forEach((sg, i) => {
      A.set(sg.a, i * 3);
      B.set(sg.b, i * 3);
      Br[i] = sg.bright;
    });
    lg.setAttribute("iA", new THREE.InstancedBufferAttribute(A, 3));
    lg.setAttribute("iB", new THREE.InstancedBufferAttribute(B, 3));
    lg.setAttribute("iBright", new THREE.InstancedBufferAttribute(Br, 1));
    lg.instanceCount = layout.segs.length;
    const lm = new THREE.RawShaderMaterial({
      glslVersion: THREE.GLSL3,
      vertexShader: LINE_VERT,
      fragmentShader: LINE_FRAG,
      uniforms: { ...common, uWidth: { value: 1.25 }, uColor: { value: lineColor } },
      transparent: true,
      depthTest: false,
      depthWrite: false,
      blending: THREE.CustomBlending,
      blendSrc: THREE.OneFactor,
      blendDst: THREE.OneFactor,
      blendSrcAlpha: THREE.OneFactor,
      blendDstAlpha: THREE.OneFactor,
    });
    const lines = new THREE.Mesh(lg, lm);
    lines.frustumCulled = false;
    s.add(lines);

    // Dots.
    const dg = instancedQuad([-1, -1, 0, 1, -1, 0, 1, 1, 0, -1, 1, 0], [0, 1, 2, 0, 2, 3]);
    const P = new Float32Array(layout.dots.length * 3);
    const S = new Float32Array(layout.dots.length);
    const Ph = new Float32Array(layout.dots.length);
    layout.dots.forEach((d, i) => {
      P.set(d.p, i * 3);
      S[i] = d.size;
      Ph[i] = d.phase;
    });
    dg.setAttribute("iP", new THREE.InstancedBufferAttribute(P, 3));
    dg.setAttribute("iSize", new THREE.InstancedBufferAttribute(S, 1));
    dg.setAttribute("iPhase", new THREE.InstancedBufferAttribute(Ph, 1));
    dg.instanceCount = layout.dots.length;
    const dm = new THREE.RawShaderMaterial({
      glslVersion: THREE.GLSL3,
      vertexShader: DOT_VERT,
      fragmentShader: DOT_FRAG,
      uniforms: { ...common, uColor: { value: lineColor } },
      transparent: true,
      depthTest: false,
      depthWrite: false,
      blending: THREE.CustomBlending,
      blendSrc: THREE.OneFactor,
      blendDst: THREE.OneFactor,
      blendSrcAlpha: THREE.OneFactor,
      blendDstAlpha: THREE.OneFactor,
    });
    const dots = new THREE.Mesh(dg, dm);
    dots.frustumCulled = false;
    s.add(dots);
    return { s, lines, dots };
  }, [layout, common, lineColor]);

  // Tag atlas, redrawn whenever the (looped) frame changes.
  const atlas = useMemo(() => {
    const rows = Math.ceil(layout.tags.length / ATLAS_COLS);
    const c = document.createElement("canvas");
    c.width = CELL_W * ATLAS_COLS;
    c.height = CELL_H * rows;
    const tex = new THREE.CanvasTexture(c);
    tex.generateMipmaps = true;
    tex.minFilter = THREE.LinearMipmapLinearFilter;
    tex.magFilter = THREE.LinearFilter;
    tex.premultiplyAlpha = true;
    tex.colorSpace = THREE.NoColorSpace;
    return { c, tex, rows };
  }, [layout]);

  const tagMesh = useMemo(() => {
    const tg = instancedQuad(
      [-0.5, -0.5, 0, 0.5, -0.5, 0, 0.5, 0.5, 0, -0.5, 0.5, 0],
      [0, 1, 2, 0, 2, 3],
    );
    const n = layout.tags.length;
    tg.setAttribute("iP", new THREE.InstancedBufferAttribute(new Float32Array(n * 3), 3));
    tg.setAttribute("iScale", new THREE.InstancedBufferAttribute(new Float32Array(n), 1));
    tg.setAttribute("iCell", new THREE.InstancedBufferAttribute(new Float32Array(n), 1));
    tg.instanceCount = n;
    const tm = new THREE.RawShaderMaterial({
      glslVersion: THREE.GLSL3,
      vertexShader: TAG_VERT,
      fragmentShader: TAG_FRAG,
      uniforms: {
        ...common,
        uAtlas: { value: new THREE.Vector2(ATLAS_COLS, atlas.rows) },
        uTagSize: { value: new THREE.Vector2(1.3, (1.3 * CELL_H) / CELL_W) },
        uAtlasTex: { value: atlas.tex },
      },
      transparent: true,
      depthTest: false,
      depthWrite: false,
      blending: THREE.CustomBlending,
      blendSrc: THREE.OneFactor,
      blendDst: THREE.OneMinusSrcAlphaFactor,
      blendSrcAlpha: THREE.OneFactor,
      blendDstAlpha: THREE.OneMinusSrcAlphaFactor,
    });
    const m = new THREE.Mesh(tg, tm);
    m.frustumCulled = false;
    scene.s.add(m);
    return m;
  }, [layout, common, atlas, scene]);

  const target = useMemo(
    () =>
      new THREE.WebGLRenderTarget(w, h, {
        type: THREE.HalfFloatType,
        format: THREE.RGBAFormat,
        samples: 4,
        depthBuffer: false,
      }),
    [w, h],
  );
  const finalPass = useMemo(() => {
    const tri = new THREE.BufferGeometry();
    tri.setAttribute(
      "position",
      new THREE.BufferAttribute(new Float32Array([-1, -1, 0, 3, -1, 0, -1, 3, 0]), 3),
    );
    const mat = new THREE.RawShaderMaterial({
      glslVersion: THREE.GLSL3,
      vertexShader: FULLSCREEN_VERT,
      fragmentShader: FINAL_FRAG,
      uniforms: {
        uScene: { value: target.texture },
        uResolution: { value: new THREE.Vector2(w, h) },
        uBgTop: { value: new THREE.Vector3(...hexToLinear(row.bgTop)) },
        uBgBottom: { value: new THREE.Vector3(...hexToLinear(row.bgBottom)) },
        uBlue: { value: getBlueNoiseTexture() },
        uFrame: { value: 0 },
        uGrain: { value: 0.01 },
      },
      depthTest: false,
      depthWrite: false,
    });
    const s = new THREE.Scene();
    const m = new THREE.Mesh(tri, mat);
    m.frustumCulled = false;
    s.add(m);
    return { s, mat, cam: new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1) };
  }, [target, w, h, row]);

  useLayoutEffect(() => {
    // Camera on a closed ellipse with a gentle yaw sway: one cycle per loop.
    const a = TAU * t;
    camera.position.set(2.6 * Math.sin(a), 0.7 * Math.sin(2 * a), -8 + 6 * Math.cos(a));
    camera.rotation.set(0.03 * Math.sin(a + 0.6), 0.11 * Math.sin(a) + 0.04 * Math.sin(2 * a), 0, "YXZ");
    camera.updateMatrixWorld();
    common.uT.value = t;

    // Tags: current values into the atlas, sorted far to near.
    const ctx = atlas.c.getContext("2d")!;
    ctx.clearRect(0, 0, atlas.c.width, atlas.c.height);
    ctx.font = `500 ${Math.round(CELL_H * 0.66)}px ${FONT_FAMILY}`;
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    const inv = camera.matrixWorldInverse;
    const v = new THREE.Vector3();
    const order = layout.tags
      .map((tg, i) => {
        v.set(...tg.pos).applyMatrix4(inv);
        return { i, z: v.z };
      })
      .sort((p, q) => p.z - q.z);
    const iP = tagMesh.geometry.getAttribute("iP") as THREE.InstancedBufferAttribute;
    const iS = tagMesh.geometry.getAttribute("iScale") as THREE.InstancedBufferAttribute;
    const iC = tagMesh.geometry.getAttribute("iCell") as THREE.InstancedBufferAttribute;
    order.forEach(({ i }, slot) => {
      const tg = layout.tags[i];
      const value = tg.values[Math.floor(looped / tg.period) % tg.values.length];
      const cx = (i % ATLAS_COLS) * CELL_W;
      const cy = Math.floor(i / ATLAS_COLS) * CELL_H;
      const pad = 6;
      ctx.fillStyle = "rgba(20, 96, 88, 0.7)";
      ctx.fillRect(cx + pad, cy + pad, CELL_W - 2 * pad, CELL_H - 2 * pad);
      ctx.strokeStyle = row.line;
      ctx.lineWidth = 3;
      ctx.strokeRect(cx + pad + 1.5, cy + pad + 1.5, CELL_W - 2 * pad - 3, CELL_H - 2 * pad - 3);
      ctx.fillStyle = row.tag;
      ctx.fillText(value, cx + CELL_W / 2, cy + CELL_H / 2 + 2);
      iP.setXYZ(slot, ...tg.pos);
      iS.setX(slot, tg.scale);
      iC.setX(slot, i);
    });
    iP.needsUpdate = true;
    iS.needsUpdate = true;
    iC.needsUpdate = true;
    atlas.tex.needsUpdate = true;
    finalPass.mat.uniforms.uFrame.value = looped;
  }, [t, looped, camera, common, atlas, layout, tagMesh, finalPass, row]);

  useFrame(() => {
    gl.autoClear = false;
    gl.setRenderTarget(target);
    gl.setClearColor(0x000000, 0);
    gl.clear(true, false, false);
    gl.render(scene.s, camera);
    gl.setRenderTarget(null);
    gl.render(finalPass.s, finalPass.cam);
  }, 1);

  return null;
};

export const DataGrid: React.FC<{ row: DataGridRow }> = ({ row }) => {
  const { width, height } = useVideoConfig();
  const fontReady = useFontReady();
  if (!fontReady) return null;
  return (
    <ThreeCanvas
      width={width}
      height={height}
      dpr={renderDpr(0.5)}
      gl={{ antialias: false, alpha: false }}
      linear
      flat
    >
      <GridScene row={row} />
    </ThreeCanvas>
  );
};
