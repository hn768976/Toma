import * as THREE from "three";

// A HUD panel: a plane carrying a Canvas-2D texture that is drawn once
// (static parts), plus small widget planes whose canvases are redrawn from
// the frame number (ticking parts). Layout is in "4K pixels"; textures are
// allocated at the render's real resolution.

export type Widget = {
  x: number;
  y: number;
  w: number;
  h: number;
  draw: (ctx: CanvasRenderingContext2D, frame: number) => void;
  // Redraw only when the key changes. The key must be a pure function of
  // the frame, so skipping a redraw never changes the output.
  key?: (frame: number) => string;
};

const VERT = /* glsl */ `
varying vec2 vUv;
void main() {
  vUv = uv;
  gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
}
`;
const FRAG = /* glsl */ `
uniform sampler2D map;
uniform vec3 tint;
uniform float opacity;
varying vec2 vUv;
void main() {
  vec4 t = texture2D(map, vUv);
  float a = t.a * opacity;
  // Fully clear texels write no depth, so the DoF pass sees what is
  // behind them.
  if (a < 0.02) discard;
  gl_FragColor = vec4(t.rgb * tint, a);
}
`;

export const hudMaterial = (
  map: THREE.Texture,
  tint: THREE.ColorRepresentation | THREE.Vector3,
  opacity = 1,
) =>
  new THREE.ShaderMaterial({
    vertexShader: VERT,
    fragmentShader: FRAG,
    uniforms: {
      map: { value: map },
      tint: {
        value:
          tint instanceof THREE.Vector3
            ? tint
            : (() => {
                const c = new THREE.Color(tint);
                return new THREE.Vector3(c.r, c.g, c.b);
              })(),
      },
      opacity: { value: opacity },
    },
    transparent: true,
    blending: THREE.AdditiveBlending,
    depthWrite: true,
    depthTest: true,
  });

export const canvasTexture = (
  canvas: HTMLCanvasElement,
  anisotropy: number,
) => {
  const t = new THREE.CanvasTexture(canvas);
  t.colorSpace = THREE.SRGBColorSpace;
  t.generateMipmaps = true;
  t.minFilter = THREE.LinearMipmapLinearFilter;
  t.magFilter = THREE.LinearFilter;
  t.anisotropy = anisotropy;
  return t;
};

export class HudPanel {
  group = new THREE.Group();
  material: THREE.ShaderMaterial;
  private widgets: {
    w: Widget;
    ctx: CanvasRenderingContext2D;
    tex: THREE.CanvasTexture;
    mat: THREE.ShaderMaterial;
    last: string | null;
  }[] = [];
  readonly worldW: number;
  readonly worldH: number;

  constructor(opts: {
    w4k: number;
    h4k: number;
    worldW: number;
    texScale: number; // texture pixels per 4K pixel
    anisotropy: number;
    drawStatic?: (ctx: CanvasRenderingContext2D) => void;
    widgets?: Widget[];
    intensity?: number; // HDR multiplier so bright parts bloom
    tint?: THREE.ColorRepresentation;
    renderOrder?: number;
  }) {
    const { w4k, h4k, worldW, texScale } = opts;
    this.worldW = worldW;
    this.worldH = (worldW * h4k) / w4k;
    const k = opts.intensity ?? 1;
    const tc = new THREE.Color(opts.tint ?? 0xffffff);
    const tint = new THREE.Vector3(tc.r * k, tc.g * k, tc.b * k);
    const mk = (w: number, h: number) => {
      const c = document.createElement("canvas");
      // Cap texture size; keep the drawing in 4K units via ctx.scale.
      const s = Math.min(texScale, 4096 / Math.max(w, h));
      c.width = Math.max(2, Math.round(w * s));
      c.height = Math.max(2, Math.round(h * s));
      const ctx = c.getContext("2d")!;
      return { c, ctx, sx: c.width / w, sy: c.height / h };
    };
    const base = mk(w4k, h4k);
    base.ctx.scale(base.sx, base.sy);
    opts.drawStatic?.(base.ctx);
    const tex = canvasTexture(base.c, opts.anisotropy);
    this.material = hudMaterial(tex, tint);
    const plane = new THREE.Mesh(
      new THREE.PlaneGeometry(this.worldW, this.worldH),
      this.material,
    );
    plane.renderOrder = opts.renderOrder ?? 0;
    this.group.add(plane);
    for (const w of opts.widgets ?? []) {
      const m = mk(w.w, w.h);
      m.ctx.scale(m.sx, m.sy);
      const t = canvasTexture(m.c, opts.anisotropy);
      const mat = hudMaterial(t, tint);
      // Share the panel opacity uniform so fades apply to widgets too.
      mat.uniforms.opacity = this.material.uniforms.opacity;
      const ww = (w.w / w4k) * this.worldW;
      const wh = (w.h / h4k) * this.worldH;
      const mesh = new THREE.Mesh(new THREE.PlaneGeometry(ww, wh), mat);
      mesh.position.set(
        ((w.x + w.w / 2) / w4k - 0.5) * this.worldW,
        -((w.y + w.h / 2) / h4k - 0.5) * this.worldH,
        this.worldW * 0.0005,
      );
      mesh.renderOrder = (opts.renderOrder ?? 0) + 1;
      this.group.add(mesh);
      this.widgets.push({ w, ctx: m.ctx, tex: t, mat, last: null });
    }
  }

  set opacity(v: number) {
    this.material.uniforms.opacity.value = v;
  }

  update(frame: number) {
    for (const it of this.widgets) {
      const key = it.w.key ? it.w.key(frame) : String(frame);
      if (key === it.last) continue;
      it.last = key;
      it.ctx.clearRect(0, 0, it.w.w, it.w.h);
      it.w.draw(it.ctx, frame);
      it.tex.needsUpdate = true;
    }
  }
}
