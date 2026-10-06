import {
  AdditiveBlending,
  BufferAttribute,
  CustomBlending,
  DoubleSide,
  InstancedBufferAttribute,
  InstancedBufferGeometry,
  Mesh,
  OneFactor,
  OneMinusSrcAlphaFactor,
  ShaderMaterial,
  Texture,
  Color,
  PlaneGeometry,
  Vector2,
  Vector4,
} from "three";
import { GLSL_COMMON, Shared } from "./shared";

/**
 * Three building blocks used by every look. All of them do their own depth of
 * field in the shader (the CoC is computed per vertex/fragment from view
 * depth), because most content here is additive light that never writes depth,
 * so a depth-buffer DoF pass could not blur it.
 *
 *  - Dots:     instanced screen-facing discs (map dots, lights, bokeh).
 *  - Segments: instanced screen-space ribbons (circuit lines, coastlines, wicks).
 *  - TexPlane: a textured plane (charts, labels) blurred by its CoC.
 *
 * Tiny dots/lines are never drawn thinner than ~1.3 px; their intensity is
 * scaled down instead (energy preserving), so they do not crawl or flicker
 * when they move across pixels.
 */

type Uniforms = Record<string, { value: unknown }>;

export type AttrSpec = Record<string, { size: number; data: Float32Array }>;

const quad = (g: InstancedBufferGeometry) => {
  g.setAttribute(
    "position",
    new BufferAttribute(new Float32Array([-1, -1, 0, 1, -1, 0, 1, 1, 0, -1, 1, 0]), 3),
  );
  g.setIndex([0, 1, 2, 0, 2, 3]);
};

const attrDecls = (attrs: AttrSpec) =>
  Object.entries(attrs)
    .map(([k, v]) => `attribute ${v.size === 1 ? "float" : `vec${v.size}`} ${k};`)
    .join("\n");

const uniformDecls = (u: Uniforms | undefined) =>
  Object.entries(u ?? {})
    .map(([k, v]) => {
      const val = v.value as unknown;
      let t = "float";
      if (val instanceof Texture) t = "sampler2D";
      else if (val instanceof Color) t = "vec3";
      else if (val instanceof Vector2) t = "vec2";
      else if (val && typeof val === "object" && "w" in (val as object)) t = "vec4";
      else if (val && typeof val === "object" && "z" in (val as object)) t = "vec3";
      return `uniform ${t} ${k};`;
    })
    .join("\n");

export interface DotsOptions {
  count: number;
  /** Always includes iPos (vec3). Others are free. */
  attrs: AttrSpec;
  shared: Shared;
  uniforms?: Uniforms;
  /** GLSL run in the vertex shader. May modify: pos (vec3, object space),
   *  col (vec3), alpha (float), sizeW (world diameter), minPx (float). */
  hook?: string;
  /** Extra GLSL functions for the vertex shader. */
  functions?: string;
  square?: boolean;
  blending?: "add" | "alpha";
  depthTest?: boolean;
  /** Pull sprites toward the camera (world units) so discs sitting on a
   *  surface are not half-buried in it. */
  depthBias?: number;
}

export const makeDots = (o: DotsOptions) => {
  const g = new InstancedBufferGeometry();
  quad(g);
  for (const [k, v] of Object.entries(o.attrs)) {
    g.setAttribute(k, new InstancedBufferAttribute(v.data, v.size));
  }
  g.instanceCount = o.count;
  const m = new ShaderMaterial({
    uniforms: { ...o.shared, ...(o.uniforms ?? {}) },
    vertexShader: /* glsl */ `
      ${GLSL_COMMON}
      ${uniformDecls(o.uniforms)}
      ${attrDecls(o.attrs)}
      varying vec2 vCorner;
      varying vec3 vCol;
      varying float vEdge;
      ${o.functions ?? ""}
      void main() {
        vec3 pos = iPos;
        vec3 col = vec3(1.0);
        float alpha = 1.0;
        float sizeW = 0.01;
        float minPx = 1.3;
        ${o.hook ?? ""}
        vec4 mv = modelViewMatrix * vec4(pos, 1.0);
        float d = -mv.z;
        mv.xyz *= (d - ${(o.depthBias ?? 0).toFixed(4)}) / max(d, 1e-4);
        vec4 clip = projectionMatrix * mv;
        float px = sizeW * projectionMatrix[1][1] / clip.w * 0.5 * uResolution.y;
        float coc = cocPx(d);
        float core = max(px, minPx);
        float total = sqrt(core * core + coc * coc);
        float energy = (px * px) / (total * total);
        // defocused discs get a soft (not hard-edged) bokeh profile
        float soft = 0.55 * coc / total;
        float half_ = total * 0.5 * (1.0 + soft) + 1.0;
        clip.xy += position.xy * half_ / (0.5 * uResolution) * clip.w;
        vCorner = position.xy * half_ / (total * 0.5);
        vEdge = max(clamp(1.0 / (total * 0.5), 0.0, 1.0), soft);
        vCol = col * alpha * energy * (1.0 + 0.3 * soft);
        if (alpha * energy < 1e-4) clip = vec4(2.0, 2.0, 2.0, 1.0);
        gl_Position = clip;
      }`,
    fragmentShader: /* glsl */ `
      varying vec2 vCorner;
      varying vec3 vCol;
      varying float vEdge;
      void main() {
        ${
          o.square
            ? "float r = max(abs(vCorner.x), abs(vCorner.y));"
            : "float r = length(vCorner);"
        }
        float f = 1.0 - smoothstep(1.0 - vEdge, 1.0 + vEdge, r);
        if (f <= 0.0) discard;
        gl_FragColor = vec4(vCol * f, ${o.blending === "alpha" ? "f" : "0.0"});
      }`,
    transparent: true,
    depthWrite: false,
    depthTest: o.depthTest ?? true,
    blending: o.blending === "alpha" ? CustomBlending : AdditiveBlending,
    blendSrc: OneFactor,
    blendDst: o.blending === "alpha" ? OneMinusSrcAlphaFactor : OneFactor,
  });
  if (o.blending !== "alpha") {
    m.blending = CustomBlending;
    m.blendSrc = OneFactor;
    m.blendDst = OneFactor;
  }
  const mesh = new Mesh(g, m);
  mesh.frustumCulled = false;
  return mesh;
};

export interface SegmentsOptions {
  count: number;
  /** Always includes iA, iB (vec3). Optional: iS (vec2 arclength at A,B). */
  attrs: AttrSpec;
  shared: Shared;
  uniforms?: Uniforms;
  /** Vertex GLSL; may modify a, b (vec3), col, alpha, widthW, minPx. */
  hook?: string;
  /** Fragment GLSL; has vS (float arclength if iS given), vAlong, vData (vec4 varying from hook);
   *  modifies `inten` (float) and `fcol` (vec3). */
  fragHook?: string;
  functions?: string;
  depthTest?: boolean;
  /** Extend the B end by half the width (closes right-angle joints). */
  capB?: boolean;
}

export const makeSegments = (o: SegmentsOptions) => {
  const g = new InstancedBufferGeometry();
  // corner.x ∈ {0,1} along, corner.y ∈ {-1,1} across
  g.setAttribute(
    "position",
    new BufferAttribute(new Float32Array([0, -1, 0, 1, -1, 0, 1, 1, 0, 0, 1, 0]), 3),
  );
  g.setIndex([0, 1, 2, 0, 2, 3]);
  for (const [k, v] of Object.entries(o.attrs)) {
    g.setAttribute(k, new InstancedBufferAttribute(v.data, v.size));
  }
  g.instanceCount = o.count;
  const hasS = "iS" in o.attrs;
  const m = new ShaderMaterial({
    uniforms: { ...o.shared, ...(o.uniforms ?? {}) },
    vertexShader: /* glsl */ `
      ${GLSL_COMMON}
      ${uniformDecls(o.uniforms)}
      ${attrDecls(o.attrs)}
      varying float vAcross;
      varying float vAlong;
      varying float vS;
      varying vec3 vCol;
      varying float vEdge;
      varying vec4 vData;
      ${o.functions ?? ""}
      void main() {
        vec3 a = iA;
        vec3 b = iB;
        vec3 col = vec3(1.0);
        float alpha = 1.0;
        float widthW = 0.01;
        float minPx = 1.2;
        vec4 data = vec4(0.0);
        ${o.hook ?? ""}
        vec4 ma = modelViewMatrix * vec4(a, 1.0);
        vec4 mb = modelViewMatrix * vec4(b, 1.0);
        vec4 ca = projectionMatrix * ma;
        vec4 cb = projectionMatrix * mb;
        vec2 sa = ca.xy / ca.w * 0.5 * uResolution;
        vec2 sb = cb.xy / cb.w * 0.5 * uResolution;
        vec2 dir = sb - sa;
        float len = length(dir);
        dir = len > 1e-5 ? dir / len : vec2(1.0, 0.0);
        vec2 nrm = vec2(-dir.y, dir.x);
        float t = position.x;
        vec4 clip = mix(ca, cb, t);
        float d = mix(-ma.z, -mb.z, t);
        float px = widthW * projectionMatrix[1][1] / clip.w * 0.5 * uResolution.y;
        float coc = cocPx(d);
        float core = max(px, minPx);
        float total = sqrt(core * core + coc * coc);
        float energy = px / total;
        float half_ = total * 0.5 + 1.0;
        vec2 off = nrm * position.y * half_;
        ${o.capB ? "off += dir * t * total * 0.5;" : ""}
        clip.xy += off / (0.5 * uResolution) * clip.w;
        vAcross = position.y * half_ / (total * 0.5);
        vAlong = t;
        vS = ${hasS ? "mix(iS.x, iS.y, t)" : "t"};
        vEdge = clamp(1.0 / (total * 0.5), 0.0, 1.0);
        vCol = col * alpha * energy;
        vData = data;
        if (alpha * energy < 1e-4) clip = vec4(2.0, 2.0, 2.0, 1.0);
        gl_Position = clip;
      }`,
    fragmentShader: /* glsl */ `
      ${GLSL_COMMON}
      ${uniformDecls(o.uniforms)}
      varying float vAcross;
      varying float vAlong;
      varying float vS;
      varying vec3 vCol;
      varying float vEdge;
      varying vec4 vData;
      void main() {
        float r = abs(vAcross);
        float inten = 1.0 - smoothstep(1.0 - vEdge, 1.0 + vEdge, r);
        vec3 fcol = vCol;
        ${o.fragHook ?? ""}
        if (inten <= 0.0) discard;
        gl_FragColor = vec4(fcol * inten, 0.0);
      }`,
    transparent: true,
    depthWrite: false,
    depthTest: o.depthTest ?? true,
    blending: CustomBlending,
    blendSrc: OneFactor,
    blendDst: OneFactor,
  });
  const mesh = new Mesh(g, m);
  mesh.frustumCulled = false;
  return mesh;
};

export interface TexPlaneOptions {
  map: Texture;
  shared: Shared;
  width: number;
  height: number;
  color?: Color;
  opacity?: number;
  /** "add": additive light (charts/holograms). "alpha": premultiplied over. */
  blending?: "add" | "alpha";
  uniforms?: Uniforms;
  /** Fragment GLSL to modify `c` (vec4 premultiplied sample) using vUv. */
  fragHook?: string;
  depthTest?: boolean;
}

/** Textured plane with in-shader DoF (13-tap disc at a matching mip level). */
export const makeTexPlane = (o: TexPlaneOptions) => {
  const m = new ShaderMaterial({
    uniforms: {
      ...o.shared,
      ...(o.uniforms ?? {}),
      uMap: { value: o.map },
      uTexSize: {
        value: new Vector2(
          (o.map.image as { width: number }).width,
          (o.map.image as { height: number }).height,
        ),
      },
      uColor: { value: o.color ?? new Color(1, 1, 1) },
      uOpacity: { value: o.opacity ?? 1 },
      // uv → uv * xy + zw (scrolling strips, atlas rows)
      uUvRect: { value: new Vector4(1, 1, 0, 0) },
    },
    vertexShader: /* glsl */ `
      uniform vec4 uUvRect;
      varying vec2 vUv;
      varying float vDist;
      void main() {
        vUv = uv * uUvRect.xy + uUvRect.zw;
        vec4 mv = modelViewMatrix * vec4(position, 1.0);
        vDist = -mv.z;
        gl_Position = projectionMatrix * mv;
      }`,
    fragmentShader: /* glsl */ `
      ${GLSL_COMMON}
      ${uniformDecls(o.uniforms)}
      uniform sampler2D uMap;
      uniform vec2 uTexSize;
      uniform vec3 uColor;
      uniform float uOpacity;
      varying vec2 vUv;
      varying float vDist;
      void main() {
        float coc = cocPx(vDist);
        vec2 dx = dFdx(vUv);
        vec2 dy = dFdy(vUv);
        vec4 c = texture2D(uMap, vUv);
        // DoF: 4 rotated taps (offsets in screen pixels, mapped through the uv
        // derivatives) at the mip whose texel matches the tap spacing.
        // Fetch count kept low — software GL runs every branch.
        float rpx = coc * 0.5;
        float texPerPx = max(length(dx * uTexSize), length(dy * uTexSize));
        float lod = log2(max(rpx * texPerPx * 0.7, 1.0));
        vec2 o1 = (dx * 0.8 + dy * 0.3) * rpx * 0.65;
        vec2 o2 = (dx * -0.3 + dy * 0.8) * rpx * 0.65;
        vec4 acc = textureLod(uMap, vUv + o1, lod) + textureLod(uMap, vUv - o1, lod)
                 + textureLod(uMap, vUv + o2, lod) + textureLod(uMap, vUv - o2, lod);
        c = mix(c, acc * 0.25, smoothstep(0.75, 2.0, coc));
        ${o.fragHook ?? ""}
        c *= uOpacity;
        gl_FragColor = vec4(c.rgb * uColor, ${o.blending === "alpha" ? "c.a" : "0.0"});
      }`,
    transparent: true,
    depthWrite: false,
    depthTest: o.depthTest ?? true,
    side: DoubleSide,
    blending: CustomBlending,
    blendSrc: OneFactor,
    blendDst: o.blending === "alpha" ? OneMinusSrcAlphaFactor : OneFactor,
  });
  const mesh = new Mesh(new PlaneGeometry(o.width, o.height), m);
  return mesh;
};

/** Fullscreen background quad (drawn first in the opaque pass, at the far plane). */
export const makeBackground = (fragmentBody: string, uniforms: Uniforms, shared: Shared) => {
  const m = new ShaderMaterial({
    uniforms: { ...shared, ...uniforms },
    vertexShader: /* glsl */ `
      varying vec2 vUv;
      void main() { vUv = position.xy * 0.5 + 0.5; gl_Position = vec4(position.xy, 0.9999, 1.0); }`,
    fragmentShader: /* glsl */ `
      ${GLSL_COMMON}
      ${uniformDecls(uniforms)}
      varying vec2 vUv;
      void main() {
        vec3 col = vec3(0.0);
        ${fragmentBody}
        gl_FragColor = vec4(col, 1.0);
      }`,
    depthWrite: false,
    depthTest: false,
  });
  const mesh = new Mesh(new PlaneGeometry(2, 2), m);
  mesh.frustumCulled = false;
  mesh.renderOrder = -1000;
  return mesh;
};

/** Pack an array of numbers into a Float32Array attribute spec. */
export const attr = (size: number, data: number[] | Float32Array) => ({
  size,
  data: data instanceof Float32Array ? data : new Float32Array(data),
});
