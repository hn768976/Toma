import {
  BufferAttribute,
  BufferGeometry,
  CanvasTexture,
  Color,
  CustomBlending,
  LinearFilter,
  LinearMipmapLinearFilter,
  Mesh,
  OneFactor,
  OneMinusSrcAlphaFactor,
  PlaneGeometry,
  ShaderMaterial,
  ShapeGeometry,
  Vector2,
  type Shape,
} from "three";

/** Shared palette (Info Stories). */
export const PAL = {
  white: "#F4F6FF",
  cyan: "#3AD8FF",
  violet: "#A04AFF",
  magenta: "#D04AFF",
  blue: "#5A8AF0",
};

const premulBlend = {
  transparent: true,
  depthTest: false,
  depthWrite: false,
  blending: CustomBlending,
  blendSrc: OneFactor,
  blendDst: OneMinusSrcAlphaFactor,
  blendSrcAlpha: OneFactor,
  blendDstAlpha: OneMinusSrcAlphaFactor,
} as const;

// ---------------------------------------------------------------- lines ----
/** Ribbon geometry for a 2D polyline in the local XY plane, with arc-length for draw-on masks. */
export const ribbonGeometry = (pts: Vector2[], width: number, closed = false) => {
  // drop consecutive duplicates (zero-length segments would give NaN normals)
  const clean = pts.filter((p, i) => i === 0 || p.distanceTo(pts[i - 1]) > 1e-6);
  if (closed && clean.length > 1 && clean[clean.length - 1].distanceTo(clean[0]) < 1e-6) clean.pop();
  const P = closed ? [...clean, clean[0]] : clean;
  const n = P.length;
  const pos: number[] = [];
  const side: number[] = [];
  const dist: number[] = [];
  const idx: number[] = [];
  const cum = [0];
  for (let i = 1; i < n; i++) cum.push(cum[i - 1] + P[i].distanceTo(P[i - 1]));
  const total = cum[n - 1] || 1;
  const hw = width / 2;
  for (let i = 0; i < n; i++) {
    const prev = i > 0 ? P[i - 1] : closed ? P[n - 2] : null;
    const next = i < n - 1 ? P[i + 1] : closed ? P[1] : null;
    const t1 = prev ? P[i].clone().sub(prev).normalize() : null;
    const t2 = next ? next.clone().sub(P[i]).normalize() : null;
    const ta = t1 && t2 ? t1.clone().add(t2).normalize() : (t1 ?? t2)!;
    const nrm = new Vector2(-ta.y, ta.x);
    const ref = t1 ?? t2!;
    const dotv = Math.max(0.25, Math.abs(nrm.dot(new Vector2(-ref.y, ref.x))));
    const m = hw / dotv;
    pos.push(P[i].x + nrm.x * m, P[i].y + nrm.y * m, 0, P[i].x - nrm.x * m, P[i].y - nrm.y * m, 0);
    side.push(1, -1);
    dist.push(cum[i] / total, cum[i] / total);
    if (i < n - 1) {
      const a = i * 2;
      idx.push(a, a + 1, a + 2, a + 1, a + 3, a + 2);
    }
  }
  const g = new BufferGeometry();
  g.setAttribute("position", new BufferAttribute(new Float32Array(pos), 3));
  g.setAttribute("aSide", new BufferAttribute(new Float32Array(side), 1));
  g.setAttribute("aDist", new BufferAttribute(new Float32Array(dist), 1));
  g.setIndex(idx);
  return g;
};

const LINE_VERT = /* glsl */ `
attribute float aSide; attribute float aDist;
varying float vSide; varying float vDist;
void main() { vSide = aSide; vDist = aDist; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }`;
const LINE_FRAG = /* glsl */ `
uniform vec3 uColor; uniform float uOpacity; uniform float uDraw; uniform float uGain;
varying float vSide; varying float vDist;
void main() {
  float aa = fwidth(vSide);
  float edge = 1.0 - smoothstep(1.0 - 1.5 * aa, 1.0, abs(vSide));
  float draw = uDraw >= 1.0 ? 1.0 : 1.0 - smoothstep(uDraw - 0.003, uDraw, vDist);
  float a = edge * draw * uOpacity;
  gl_FragColor = vec4(uColor * uGain * a, a);
}`;

export type LineMesh = Mesh<BufferGeometry, ShaderMaterial>;
export const lineMesh = (pts: Vector2[], width: number, color: string, closed = false, gain = 1): LineMesh =>
  new Mesh(
    ribbonGeometry(pts, width, closed),
    new ShaderMaterial({
      vertexShader: LINE_VERT,
      fragmentShader: LINE_FRAG,
      uniforms: {
        uColor: { value: new Color(color) },
        uOpacity: { value: 1 },
        uDraw: { value: 1 },
        uGain: { value: gain },
      },
      ...premulBlend,
    }),
  );

export const rectPts = (w: number, h: number, cx = 0, cy = 0) => [
  new Vector2(cx - w / 2, cy + h / 2),
  new Vector2(cx - w / 2, cy - h / 2),
  new Vector2(cx + w / 2, cy - h / 2),
  new Vector2(cx + w / 2, cy + h / 2),
];

// ---------------------------------------------------------------- fills ----
const FILL_VERT = /* glsl */ `
varying vec3 vLocal;
void main() { vLocal = position; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }`;
const FILL_FRAG = /* glsl */ `
uniform vec3 uColor; uniform float uOpacity; uniform float uGain;
uniform vec3 uFade;      // x0, x1, alpha at x1 (horizontal gradient)
uniform vec2 uFadeIn;    // alpha ramps 0 -> 1 over [x0, x1]
uniform vec3 uSweep;     // position, width, amount (diagonal light sweep)
varying vec3 vLocal;
void main() {
  float g = mix(1.0, uFade.z, clamp((vLocal.x - uFade.x) / (uFade.y - uFade.x), 0.0, 1.0));
  float a = uOpacity * g * clamp((vLocal.x - uFadeIn.x) / max(uFadeIn.y - uFadeIn.x, 1e-4), 0.0, 1.0);
  float sw = uSweep.z * exp(-pow((vLocal.x + 0.55 * vLocal.y - uSweep.x) / uSweep.y, 2.0));
  gl_FragColor = vec4(uColor * uGain * a + vec3(sw) * a, a);
}`;

export type FillMesh = Mesh<BufferGeometry, ShaderMaterial>;
export const fillMaterial = (color: string, opacity = 1) =>
  new ShaderMaterial({
    vertexShader: FILL_VERT,
    fragmentShader: FILL_FRAG,
    uniforms: {
      uColor: { value: new Color(color) },
      uOpacity: { value: opacity },
      uGain: { value: 1 },
      uFade: { value: [0, 1, 1] },
      uFadeIn: { value: [-1e4, -1e4 + 1] },
      uSweep: { value: [-99, 0.3, 0] },
    },
    ...premulBlend,
  });
export const shapeMesh = (shape: Shape | Shape[], color: string, opacity = 1, segs = 48): FillMesh =>
  new Mesh(new ShapeGeometry(shape, segs), fillMaterial(color, opacity));
export const rectMesh = (w: number, h: number, color: string, opacity = 1): FillMesh => {
  const g = new PlaneGeometry(w, h);
  return new Mesh(g, fillMaterial(color, opacity));
};

// ---------------------------------------------------------------- text -----
const TEXT_VERT = /* glsl */ `
varying vec2 vUv;
void main() { vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }`;
const TEXT_FRAG = /* glsl */ `
uniform sampler2D tMap; uniform vec3 uColor; uniform float uOpacity; uniform float uRGB; uniform float uGain;
uniform vec3 uReveal;   // fully revealed up to u=x, current letter up to u=y, its alpha z
varying vec2 vUv;
void main() {
  vec4 t = texture2D(tMap, vUv);
  float m = vUv.x < uReveal.x ? 1.0 : (vUv.x < uReveal.y ? uReveal.z : 0.0);
  float a = t.a * uOpacity * m;
  vec3 c = uRGB > 0.5 ? t.rgb * uColor : uColor * t.a;
  gl_FragColor = vec4(c * uGain * uOpacity * m, a);
}`;

export type TextOpts = {
  family?: string;
  weight?: number;
  px?: number;         // canvas em size in pixels (>= 1:1 with the 4K frame)
  em: number;          // em size in world units
  color?: string;
  align?: "left" | "center";
  glow?: number;       // canvas glow alpha (0 = none)
  bevel?: boolean;     // SWOT letters: gradient fill + edge for a slight bevel look
  anisotropy: number;
};

export type Label = {
  mesh: Mesh<PlaneGeometry, ShaderMaterial>;
  /** per-letter right edges in texture u, for type-on */
  stops: number[];
  width: number;       // world width of the text run (without padding)
  /** letter-by-letter type-on; `start` frame, frames per letter */
  typeOn: (f: number, start: number, perLetter?: number) => void;
  setOpacity: (o: number) => void;
};

export const makeLabel = (text: string, o: TextOpts): Label => {
  const family = o.family ?? "Inter";
  const weight = o.weight ?? 300;
  const px = o.px ?? 220;
  const font = `${weight} ${px}px "${family}"`;
  const meas = document.createElement("canvas").getContext("2d")!;
  meas.font = font;
  const textW = meas.measureText(text).width;
  const pad = Math.ceil(px * 0.35);
  const W = Math.ceil(textW + pad * 2);
  const H = Math.ceil(px * 1.35 + pad * 2);
  const canvas = document.createElement("canvas");
  canvas.width = W;
  canvas.height = H;
  const ctx = canvas.getContext("2d")!;
  ctx.font = font;
  ctx.textBaseline = "middle";
  ctx.textAlign = "left";
  const y = H / 2 + px * 0.04;
  if (o.glow && o.glow > 0) {
    ctx.save();
    ctx.shadowColor = `rgba(255,255,255,${o.glow})`;
    ctx.shadowBlur = px * 0.14;
    ctx.fillStyle = "rgba(255,255,255,0.0)";
    ctx.fillStyle = "#ffffff";
    ctx.globalAlpha = 0.6;
    ctx.fillText(text, pad, y);
    ctx.restore();
  }
  if (o.bevel) {
    const gr = ctx.createLinearGradient(0, y - px * 0.4, 0, y + px * 0.4);
    gr.addColorStop(0, "#ffffff");
    gr.addColorStop(0.55, "#f2f3fb");
    gr.addColorStop(1, "#c9cdea");
    ctx.fillStyle = gr;
    ctx.fillText(text, pad, y);
  } else {
    ctx.fillStyle = "#ffffff";
    ctx.fillText(text, pad, y);
  }
  const tex = new CanvasTexture(canvas);
  tex.premultiplyAlpha = true;
  tex.generateMipmaps = true;
  tex.minFilter = LinearMipmapLinearFilter;
  tex.magFilter = LinearFilter;
  tex.anisotropy = o.anisotropy;
  tex.needsUpdate = true;

  const stops: number[] = [];
  for (let i = 1; i <= text.length; i++) stops.push((pad + meas.measureText(text.slice(0, i)).width) / W);
  stops[stops.length - 1] = 1.0;

  const k = o.em / px;
  const geo = new PlaneGeometry(W * k, H * k);
  if ((o.align ?? "left") === "left") geo.translate((W * k) / 2 - pad * k, 0, 0);
  const mat = new ShaderMaterial({
    vertexShader: TEXT_VERT,
    fragmentShader: TEXT_FRAG,
    uniforms: {
      tMap: { value: tex },
      uColor: { value: new Color(o.color ?? PAL.white) },
      uOpacity: { value: 1 },
      uRGB: { value: o.bevel ? 1 : 0 },
      uGain: { value: 1 },
      uReveal: { value: [2, 2, 1] },
    },
    ...premulBlend,
  });
  const mesh = new Mesh(geo, mat);
  const label: Label = {
    mesh,
    stops,
    width: textW * k,
    typeOn: (f, start, perLetter = 2) => {
      const p = (f - start) / perLetter; // letters revealed
      if (p <= 0) {
        mat.uniforms.uReveal.value = [-1, -1, 0];
        return;
      }
      const n = Math.floor(p);
      if (n >= text.length) {
        mat.uniforms.uReveal.value = [2, 2, 1];
        return;
      }
      const lo = n === 0 ? pad / W - 0.02 : stops[n - 1];
      mat.uniforms.uReveal.value = [n === 0 ? -1 : lo, stops[n], Math.min(1, p - n)];
    },
    setOpacity: (v) => {
      mat.uniforms.uOpacity.value = v;
    },
  };
  return label;
};

// --------------------------------------------------- background glyph atlas -
/** 8x2 atlas, 256px cells: digits 0-9 then calendar, envelope, bank, cap, chevron, bolt. */
export const makeGlyphAtlas = (anisotropy: number) => {
  const C = 256;
  const canvas = document.createElement("canvas");
  canvas.width = C * 8;
  canvas.height = C * 2;
  const ctx = canvas.getContext("2d")!;
  ctx.fillStyle = "#fff";
  ctx.strokeStyle = "#fff";
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.font = `300 ${C * 0.78}px "Inter"`;
  for (let d = 0; d < 10; d++) {
    const cx = (d % 8) * C + C / 2;
    const cy = Math.floor(d / 8) * C + C / 2;
    ctx.fillText(String(d), cx, cy + C * 0.03);
  }
  const lw = C * 0.06;
  ctx.lineWidth = lw;
  ctx.lineJoin = "round";
  ctx.lineCap = "round";
  const cell = (i: number) => ({ x: (i % 8) * C, y: Math.floor(i / 8) * C });
  // 10 calendar
  {
    const { x, y } = cell(10);
    ctx.strokeRect(x + C * 0.2, y + C * 0.26, C * 0.6, C * 0.54);
    ctx.fillRect(x + C * 0.2, y + C * 0.26, C * 0.6, C * 0.12);
    ctx.beginPath();
    ctx.moveTo(x + C * 0.35, y + C * 0.18);
    ctx.lineTo(x + C * 0.35, y + C * 0.32);
    ctx.moveTo(x + C * 0.65, y + C * 0.18);
    ctx.lineTo(x + C * 0.65, y + C * 0.32);
    ctx.stroke();
    for (let r = 0; r < 2; r++)
      for (let c = 0; c < 3; c++) ctx.fillRect(x + C * (0.29 + c * 0.16), y + C * (0.47 + r * 0.15), C * 0.09, C * 0.08);
  }
  // 11 envelope
  {
    const { x, y } = cell(11);
    ctx.strokeRect(x + C * 0.17, y + C * 0.28, C * 0.66, C * 0.46);
    ctx.beginPath();
    ctx.moveTo(x + C * 0.17, y + C * 0.28);
    ctx.lineTo(x + C * 0.5, y + C * 0.54);
    ctx.lineTo(x + C * 0.83, y + C * 0.28);
    ctx.stroke();
  }
  // 12 bank
  {
    const { x, y } = cell(12);
    ctx.beginPath();
    ctx.moveTo(x + C * 0.15, y + C * 0.36);
    ctx.lineTo(x + C * 0.5, y + C * 0.16);
    ctx.lineTo(x + C * 0.85, y + C * 0.36);
    ctx.closePath();
    ctx.fill();
    for (let c = 0; c < 4; c++) ctx.fillRect(x + C * (0.22 + c * 0.155), y + C * 0.42, C * 0.08, C * 0.3);
    ctx.fillRect(x + C * 0.14, y + C * 0.75, C * 0.72, C * 0.08);
  }
  // 13 graduation cap
  {
    const { x, y } = cell(13);
    ctx.beginPath();
    ctx.moveTo(x + C * 0.1, y + C * 0.42);
    ctx.lineTo(x + C * 0.5, y + C * 0.24);
    ctx.lineTo(x + C * 0.9, y + C * 0.42);
    ctx.lineTo(x + C * 0.5, y + C * 0.6);
    ctx.closePath();
    ctx.fill();
    ctx.beginPath();
    ctx.moveTo(x + C * 0.28, y + C * 0.52);
    ctx.lineTo(x + C * 0.28, y + C * 0.7);
    ctx.quadraticCurveTo(x + C * 0.5, y + C * 0.82, x + C * 0.72, y + C * 0.7);
    ctx.lineTo(x + C * 0.72, y + C * 0.52);
    ctx.fill();
    ctx.beginPath();
    ctx.moveTo(x + C * 0.86, y + C * 0.44);
    ctx.lineTo(x + C * 0.86, y + C * 0.68);
    ctx.stroke();
  }
  // 14 chevron
  {
    const { x, y } = cell(14);
    ctx.lineWidth = C * 0.11;
    ctx.beginPath();
    ctx.moveTo(x + C * 0.36, y + C * 0.22);
    ctx.lineTo(x + C * 0.64, y + C * 0.5);
    ctx.lineTo(x + C * 0.36, y + C * 0.78);
    ctx.stroke();
    ctx.lineWidth = lw;
  }
  // 15 lightning bolt
  {
    const { x, y } = cell(15);
    ctx.beginPath();
    ctx.moveTo(x + C * 0.56, y + C * 0.12);
    ctx.lineTo(x + C * 0.3, y + C * 0.54);
    ctx.lineTo(x + C * 0.48, y + C * 0.54);
    ctx.lineTo(x + C * 0.42, y + C * 0.88);
    ctx.lineTo(x + C * 0.72, y + C * 0.42);
    ctx.lineTo(x + C * 0.54, y + C * 0.42);
    ctx.closePath();
    ctx.fill();
  }
  const tex = new CanvasTexture(canvas);
  tex.generateMipmaps = true;
  tex.minFilter = LinearMipmapLinearFilter;
  tex.magFilter = LinearFilter;
  tex.anisotropy = anisotropy;
  tex.needsUpdate = true;
  return tex;
};
