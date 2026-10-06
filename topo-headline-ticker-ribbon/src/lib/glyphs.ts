import * as THREE from "three";

/**
 * Glyph atlas + instanced sprite layer.
 * Text is laid out per frame from scratch (never incrementally), so ticking
 * numbers are just a function of the frame.
 */
export type IconDraw = (ctx: CanvasRenderingContext2D, w: number, h: number) => void;

export type Glyph = { u0: number; v0: number; u1: number; v1: number; adv: number; x0: number; y0: number; w: number; h: number };

export const ICON_SOLID = "";

/** Turns drawn text into an LED dot-matrix look: keep only round dots on a grid. */
export function applyDotMatrix(ctx: CanvasRenderingContext2D, W: number, H: number, pitch: number) {
  const pat = document.createElement("canvas");
  pat.width = pitch;
  pat.height = pitch;
  const pg = pat.getContext("2d")!;
  pg.fillStyle = "#fff";
  pg.beginPath();
  pg.arc(pitch / 2, pitch / 2, pitch * 0.4, 0, Math.PI * 2);
  pg.fill();
  ctx.save();
  ctx.globalCompositeOperation = "destination-in";
  ctx.fillStyle = ctx.createPattern(pat, "repeat")!;
  ctx.fillRect(0, 0, W, H);
  ctx.restore();
}

export class GlyphAtlas {
  texture: THREE.CanvasTexture;
  private map = new Map<string, Glyph>();
  constructor(opts: { font: string; fontPx: number; chars: string; cellW: number; cellH: number; icons?: Record<string, IconDraw>; italicPad?: number; dotMatrix?: number }) {
    const { font, fontPx, cellW, cellH } = opts;
    const icons: Record<string, IconDraw> = { [ICON_SOLID]: (c: CanvasRenderingContext2D, w: number, h: number) => c.fillRect(0, 0, w, h), ...(opts.icons ?? {}) };
    const all = Array.from(new Set(Array.from(opts.chars))).filter((c) => !(c in icons));
    const iconKeys = Object.keys(icons);
    const n = all.length + iconKeys.length;
    const cols = Math.ceil(Math.sqrt(n));
    const rows = Math.ceil(n / cols);
    const W = cols * cellW;
    const H = rows * cellH;
    const canvas = document.createElement("canvas");
    canvas.width = W;
    canvas.height = H;
    const ctx = canvas.getContext("2d")!;
    ctx.clearRect(0, 0, W, H);
    ctx.fillStyle = "#fff";
    ctx.font = font;
    ctx.textBaseline = "alphabetic";
    const padX = opts.italicPad ?? Math.round(fontPx * 0.12);
    const baseY = Math.round(cellH * 0.78);
    let i = 0;
    const place = (key: string, draw: (x: number, y: number) => number, isIcon: boolean) => {
      const cx = (i % cols) * cellW;
      const cy = Math.floor(i / cols) * cellH;
      i++;
      ctx.save();
      ctx.beginPath();
      ctx.rect(cx, cy, cellW, cellH);
      ctx.clip();
      const adv = draw(cx, cy);
      ctx.restore();
      // inset UVs by half a texel to avoid bleeding
      const g: Glyph = {
        u0: (cx + 0.5) / W,
        u1: (cx + cellW - 0.5) / W,
        v1: 1 - (cy + 0.5) / H,
        v0: 1 - (cy + cellH - 0.5) / H,
        adv: adv / fontPx,
        x0: isIcon ? 0 : -padX / fontPx,
        y0: isIcon ? 0 : -(cellH - baseY) / fontPx,
        w: cellW / fontPx,
        h: cellH / fontPx,
      };
      this.map.set(key, g);
    };
    for (const ch of all) {
      place(
        ch,
        (cx, cy) => {
          ctx.fillText(ch, cx + padX, cy + baseY);
          return ctx.measureText(ch).width;
        },
        false,
      );
    }
    for (const k of iconKeys) {
      place(
        k,
        (cx, cy) => {
          ctx.translate(cx, cy);
          icons[k](ctx, cellW, cellH);
          return cellW;
        },
        true,
      );
    }
    if (opts.dotMatrix) applyDotMatrix(ctx, W, H, opts.dotMatrix);
    this.texture = new THREE.CanvasTexture(canvas);
    this.texture.colorSpace = THREE.NoColorSpace; // used as a coverage mask
    this.texture.generateMipmaps = true;
    this.texture.minFilter = THREE.LinearMipmapLinearFilter;
    this.texture.magFilter = THREE.LinearFilter;
    this.texture.anisotropy = 8;
    this.texture.needsUpdate = true;
  }
  get(ch: string): Glyph | undefined {
    return this.map.get(ch);
  }
  width(str: string, tracking = 0): number {
    let w = 0;
    for (const ch of str) w += (this.map.get(ch)?.adv ?? 0.5) + tracking;
    return w - tracking;
  }
}

const spriteVert = /* glsl */ `
in vec3 aAnchor; in vec4 aRect; in vec4 aUV; in vec4 aColor; in float aSize;
uniform vec3 uRight; uniform vec3 uUp; uniform float uBillboard;
out vec2 vUv; out vec4 vColor; out float vFogDist;
void main(){
  vec3 right = uBillboard > 0.5 ? vec3(viewMatrix[0][0], viewMatrix[1][0], viewMatrix[2][0]) : uRight;
  vec3 up    = uBillboard > 0.5 ? vec3(viewMatrix[0][1], viewMatrix[1][1], viewMatrix[2][1]) : uUp;
  vec2 local = aRect.xy + position.xy * aRect.zw;
  vec3 wp = aAnchor + (right * local.x + up * local.y) * aSize;
  vUv = mix(aUV.xy, aUV.zw, position.xy);
  vColor = aColor;
  vec4 mv = viewMatrix * vec4(wp, 1.0);
  vFogDist = -mv.z;
  gl_Position = projectionMatrix * mv;
}`;

const spriteFrag = /* glsl */ `
uniform sampler2D tAtlas; uniform vec3 uFogColor; uniform float uFogNear; uniform float uFogFar; uniform float uGain; uniform float uAlphaTest;
in vec2 vUv; in vec4 vColor; in float vFogDist;
out vec4 o;
void main(){
  float a = texture(tAtlas, vUv).a * vColor.a;
  float fog = smoothstep(uFogNear, uFogFar, vFogDist);
  vec3 c = vColor.rgb * uGain * (1.0 - fog);
  if (a < uAlphaTest) discard;
  o = vec4(c * a, a);
}`;

export type RGBA = [number, number, number, number];

export function colorRGBA(hex: string, a = 1, mul = 1): RGBA {
  const c = new THREE.Color(hex); // converted to linear working space
  return [c.r * mul, c.g * mul, c.b * mul, a];
}

export class SpriteLayer {
  mesh: THREE.Mesh;
  material: THREE.ShaderMaterial;
  private geo: THREE.InstancedBufferGeometry;
  private anchor: Float32Array;
  private rectA: Float32Array;
  private uv: Float32Array;
  private color: Float32Array;
  private size: Float32Array;
  private n = 0;
  constructor(
    public atlas: GlyphAtlas,
    private capacity: number,
    opts: { billboard: boolean; depthWrite?: boolean; alphaTest?: number; right?: THREE.Vector3; up?: THREE.Vector3; blending?: THREE.Blending; depthTest?: boolean; fogColor?: THREE.Color; fogNear?: number; fogFar?: number },
  ) {
    const base = new THREE.PlaneGeometry(1, 1);
    base.translate(0.5, 0.5, 0);
    this.geo = new THREE.InstancedBufferGeometry();
    this.geo.index = base.index;
    this.geo.setAttribute("position", base.getAttribute("position"));
    this.anchor = new Float32Array(capacity * 3);
    this.rectA = new Float32Array(capacity * 4);
    this.uv = new Float32Array(capacity * 4);
    this.color = new Float32Array(capacity * 4);
    this.size = new Float32Array(capacity);
    const ia = (arr: Float32Array, n: number) => {
      const a = new THREE.InstancedBufferAttribute(arr, n);
      a.setUsage(THREE.DynamicDrawUsage);
      return a;
    };
    this.geo.setAttribute("aAnchor", ia(this.anchor, 3));
    this.geo.setAttribute("aRect", ia(this.rectA, 4));
    this.geo.setAttribute("aUV", ia(this.uv, 4));
    this.geo.setAttribute("aColor", ia(this.color, 4));
    this.geo.setAttribute("aSize", ia(this.size, 1));
    this.material = new THREE.ShaderMaterial({
      glslVersion: THREE.GLSL3,
      vertexShader: spriteVert,
      fragmentShader: spriteFrag,
      uniforms: {
        tAtlas: { value: atlas.texture },
        uRight: { value: opts.right ?? new THREE.Vector3(1, 0, 0) },
        uUp: { value: opts.up ?? new THREE.Vector3(0, 1, 0) },
        uBillboard: { value: opts.billboard ? 1 : 0 },
        uFogColor: { value: opts.fogColor ?? new THREE.Color(0, 0, 0) },
        uFogNear: { value: opts.fogNear ?? 1e6 },
        uFogFar: { value: opts.fogFar ?? 2e6 },
        uGain: { value: 1 },
        uAlphaTest: { value: opts.alphaTest ?? (opts.depthWrite ? 0.08 : 0.002) },
      },
      transparent: true,
      depthWrite: opts.depthWrite ?? false,
      depthTest: opts.depthTest ?? true,
      blending: THREE.CustomBlending,
      blendSrc: THREE.OneFactor,
      blendDst: opts.blending === THREE.NormalBlending ? THREE.OneMinusSrcAlphaFactor : THREE.OneFactor,
      blendSrcAlpha: THREE.ZeroFactor,
      blendDstAlpha: THREE.OneFactor,
    });
    this.mesh = new THREE.Mesh(this.geo, this.material);
    this.mesh.frustumCulled = false;
  }
  begin() {
    this.n = 0;
  }
  private push(ax: number, ay: number, az: number, x0: number, y0: number, w: number, h: number, g: Glyph, c: RGBA, size: number) {
    if (this.n >= this.capacity) return;
    const i = this.n++;
    this.anchor[i * 3] = ax;
    this.anchor[i * 3 + 1] = ay;
    this.anchor[i * 3 + 2] = az;
    this.rectA[i * 4] = x0;
    this.rectA[i * 4 + 1] = y0;
    this.rectA[i * 4 + 2] = w;
    this.rectA[i * 4 + 3] = h;
    this.uv[i * 4] = g.u0;
    this.uv[i * 4 + 1] = g.v0;
    this.uv[i * 4 + 2] = g.u1;
    this.uv[i * 4 + 3] = g.v1;
    this.color[i * 4] = c[0];
    this.color[i * 4 + 1] = c[1];
    this.color[i * 4 + 2] = c[2];
    this.color[i * 4 + 3] = c[3];
    this.size[i] = size;
  }
  /** Text: anchor in world units; ox/oy offset in em; size = world units per em. */
  text(str: string, ax: number, ay: number, az: number, size: number, c: RGBA, align: "left" | "center" | "right" = "left", ox = 0, oy = 0, tracking = 0) {
    const w = this.atlas.width(str, tracking);
    let x = ox - (align === "center" ? w / 2 : align === "right" ? w : 0);
    for (const ch of str) {
      const g = this.atlas.get(ch);
      if (!g) {
        x += 0.5 + tracking;
        continue;
      }
      if (ch !== " ") this.push(ax, ay, az, x + g.x0, oy + g.y0, g.w, g.h, g, c, size);
      x += g.adv + tracking;
    }
    return w;
  }
  /** Icon / solid rect in em units relative to anchor. */
  icon(key: string, ax: number, ay: number, az: number, size: number, c: RGBA, x0: number, y0: number, w: number, h: number) {
    const g = this.atlas.get(key);
    if (g) this.push(ax, ay, az, x0, y0, w, h, g, c, size);
  }
  rect(ax: number, ay: number, az: number, size: number, c: RGBA, x0: number, y0: number, w: number, h: number) {
    this.icon(ICON_SOLID, ax, ay, az, size, c, x0, y0, w, h);
  }
  /** Outline rectangle with line thickness t (em). */
  frame(ax: number, ay: number, az: number, size: number, c: RGBA, x0: number, y0: number, w: number, h: number, t: number) {
    this.rect(ax, ay, az, size, c, x0, y0, w, t);
    this.rect(ax, ay, az, size, c, x0, y0 + h - t, w, t);
    this.rect(ax, ay, az, size, c, x0, y0 + t, t, h - 2 * t);
    this.rect(ax, ay, az, size, c, x0 + w - t, y0 + t, t, h - 2 * t);
  }
  end() {
    this.geo.instanceCount = this.n;
    for (const k of ["aAnchor", "aRect", "aUV", "aColor", "aSize"]) {
      const a = this.geo.getAttribute(k) as THREE.InstancedBufferAttribute;
      a.clearUpdateRanges();
      a.addUpdateRange(0, this.n * a.itemSize);
      a.needsUpdate = true;
    }
  }
}
