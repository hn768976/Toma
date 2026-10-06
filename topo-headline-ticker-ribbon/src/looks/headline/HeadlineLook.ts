import * as THREE from "three";
import { FONT_INTER, LandPolygons } from "../../lib/assets";
import { GlyphAtlas, SpriteLayer } from "../../lib/glyphs";
import { clamp, hash01, mod, mulberry32, smoothstep, TAU } from "../../lib/random";
import type { LookFactory } from "../../lib/Stage";

export type HeadlineVersion = {
  id: string;
  headline: string;
  keywords: string[];
  seed: number;
};

const RED = "#E81A2A";
const CYAN = "#5AD8FF";

// ---------- helpers
const easeOutCubic = (t: number) => 1 - Math.pow(1 - clamp(t), 3);

function canvasTex(c: HTMLCanvasElement, srgb = true) {
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = srgb ? THREE.SRGBColorSpace : THREE.NoColorSpace;
  t.generateMipmaps = true;
  t.minFilter = THREE.LinearMipmapLinearFilter;
  t.magFilter = THREE.LinearFilter;
  t.anisotropy = 8;
  t.needsUpdate = true;
  return t;
}

/** Natural Earth land -> grid of dots (equirectangular). */
function buildMapTexture(land: LandPolygons) {
  const MW = 1440, MH = 720; // mask
  const mask = document.createElement("canvas");
  mask.width = MW;
  mask.height = MH;
  const m = mask.getContext("2d")!;
  m.fillStyle = "#000";
  m.fillRect(0, 0, MW, MH);
  m.fillStyle = "#fff";
  for (const poly of land) {
    m.beginPath();
    for (const ring of poly) {
      ring.forEach(([lon, lat], i) => {
        const x = ((lon + 180) / 360) * MW;
        const y = ((90 - lat) / 180) * MH;
        if (i === 0) m.moveTo(x, y);
        else m.lineTo(x, y);
      });
      m.closePath();
    }
    m.fill("evenodd");
  }
  const data = m.getImageData(0, 0, MW, MH).data;
  // dot grid: lon -170..190, lat 84..-58
  const COLS = 150;
  const lon0 = -170, lon1 = 190, lat0 = 84, lat1 = -58;
  const cell = (lon1 - lon0) / COLS;
  const ROWS = Math.round((lat0 - lat1) / cell);
  const px = 16;
  const W = COLS * px, H = ROWS * px;
  const c = document.createElement("canvas");
  c.width = W;
  c.height = H;
  const g = c.getContext("2d")!;
  g.clearRect(0, 0, W, H);
  for (let r = 0; r < ROWS; r++)
    for (let q = 0; q < COLS; q++) {
      const lon = lon0 + (q + 0.5) * cell;
      const lat = lat0 - (r + 0.5) * cell;
      const mx = Math.floor(((((lon + 180) % 360) + 360) % 360) / 360 * MW);
      const my = Math.floor(((90 - lat) / 180) * MH);
      if (data[(my * MW + mx) * 4] < 128) continue;
      const v = 0.78 + 0.22 * hash01(q, r, 5);
      g.fillStyle = `rgba(${Math.round(225 * v)},${Math.round(232 * v)},${Math.round(245 * v)},1)`;
      const s = px * 0.68;
      g.fillRect(q * px + (px - s) / 2, r * px + (px - s) / 2, s, s);
    }
  return { tex: canvasTex(c), aspect: W / H };
}

function buildHeadlineTexture(word: string) {
  const fontPx = 300;
  const font = `italic 900 ${fontPx}px ${FONT_INTER}`;
  const meas = document.createElement("canvas").getContext("2d")!;
  meas.font = font;
  const tw = meas.measureText(word).width;
  const pad = 120;
  const W = Math.ceil(tw + pad * 2), H = Math.ceil(fontPx * 1.5);
  const c = document.createElement("canvas");
  c.width = W;
  c.height = H;
  const g = c.getContext("2d")!;
  g.font = font;
  g.textBaseline = "alphabetic";
  const by = H * 0.74;
  g.fillStyle = RED;
  g.fillText(word, pad, by);
  // thin bright edge
  g.lineWidth = 5;
  g.strokeStyle = "rgba(255,120,120,0.9)";
  g.strokeText(word, pad, by);
  // inner top highlight
  g.globalCompositeOperation = "source-atop";
  const grad = g.createLinearGradient(0, by - fontPx * 0.75, 0, by);
  grad.addColorStop(0, "rgba(255,90,90,0.35)");
  grad.addColorStop(0.5, "rgba(255,40,50,0)");
  grad.addColorStop(1, "rgba(120,0,10,0.25)");
  g.fillStyle = grad;
  g.fillRect(0, 0, W, H);
  // extrusion mask (solid)
  const e = document.createElement("canvas");
  e.width = W;
  e.height = H;
  const eg = e.getContext("2d")!;
  eg.font = font;
  eg.fillStyle = "#fff";
  eg.fillText(word, pad, by);
  return { face: canvasTex(c), solid: canvasTex(e, false), aspect: W / H, textFrac: tw / W };
}

function buildTickerTexture(words: string[]) {
  const fontPx = 100;
  const font = `italic 700 ${fontPx}px ${FONT_INTER}`;
  const meas = document.createElement("canvas").getContext("2d")!;
  meas.font = font;
  const sep = "   •   ";
  const str = words.join(sep) + sep;
  const W0 = meas.measureText(str).width;
  const W = Math.ceil(W0), H = 146;
  const c = document.createElement("canvas");
  c.width = W;
  c.height = H;
  const g = c.getContext("2d")!;
  g.clearRect(0, 0, W, H);
  g.font = font;
  g.fillStyle = "#fff";
  g.textBaseline = "alphabetic";
  // draw twice shifted so the wrap seam is seamless
  g.fillText(str, 0, H * 0.78);
  g.fillText(str, -W0, H * 0.78);
  const t = canvasTex(c);
  t.wrapS = THREE.RepeatWrapping;
  return { tex: t, aspect: W / H };
}

const quadVert = /* glsl */ `
out vec2 vUv; out float vDist;
void main(){ vUv = uv; vec4 mv = modelViewMatrix*vec4(position,1.0); vDist = -mv.z; gl_Position = projectionMatrix*mv; }`;

export const makeHeadlineLook = (v: HeadlineVersion): LookFactory => (ctx) => {
  const rng = mulberry32(v.seed);
  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(34, ctx.width / ctx.height, 0.1, 200);

  // ---- background gradient
  const bg = new THREE.Mesh(
    new THREE.PlaneGeometry(120, 70),
    new THREE.ShaderMaterial({
      glslVersion: THREE.GLSL3,
      vertexShader: quadVert,
      fragmentShader: /* glsl */ `
      precision highp float;
      uniform vec3 uA; uniform vec3 uB; uniform float uOn;
      in vec2 vUv; out vec4 o;
      void main(){
        float d = length((vUv - vec2(0.42, 0.55)) * vec2(1.7, 1.0));
        vec3 c = mix(uA, uB, smoothstep(0.0, 0.45, d)); c = mix(c, vec3(0.0), smoothstep(0.35, 0.75, d)*0.8);
        o = vec4(c * uOn, 1.0);
      }`,
      depthWrite: true,
      uniforms: { uA: { value: new THREE.Color("#041A4A") }, uB: { value: new THREE.Color("#020A20") }, uOn: { value: 1 } },
    }),
  );
  bg.position.set(0, 0, -30);
  scene.add(bg);

  // ---- translucent light panels (behind map)
  const panelMat = new THREE.ShaderMaterial({
    glslVersion: THREE.GLSL3,
    vertexShader: quadVert,
    fragmentShader: /* glsl */ `
    precision highp float; uniform vec3 uC; uniform float uA;
    in vec2 vUv; out vec4 o;
    void main(){ float e = smoothstep(0.0,0.08,vUv.y)*smoothstep(1.0,0.92,vUv.y)*smoothstep(0.0,0.03,vUv.x)*smoothstep(1.0,0.97,vUv.x);
      o = vec4(uC*uA*e*(0.7+0.3*vUv.y), 1.0); }`,
    uniforms: { uC: { value: new THREE.Color("#2A62C8") }, uA: { value: 0.0 } },
    transparent: true,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
  });
  const panels: THREE.Mesh[] = [];
  for (let i = 0; i < 5; i++) {
    const p = new THREE.Mesh(new THREE.PlaneGeometry(14 + rng() * 10, 1.2 + rng() * 2.5), panelMat);
    p.position.set((rng() - 0.5) * 26, (rng() - 0.5) * 16, -6 - rng() * 6);
    p.scale.setScalar(1.6);
    p.rotation.z = -0.08 + (rng() - 0.5) * 0.06;
    panels.push(p);
    scene.add(p);
  }

  // ---- dotted world map
  const map = buildMapTexture(ctx.assets.land);
  const mapW = 27;
  const mapMat = new THREE.ShaderMaterial({
    glslVersion: THREE.GLSL3,
    vertexShader: quadVert,
    fragmentShader: /* glsl */ `
    precision highp float; uniform sampler2D tMap; uniform float uA;
    in vec2 vUv; out vec4 o;
    void main(){ vec4 t = texture(tMap, vUv); float shade = 0.55 + 0.45*smoothstep(0.0, 0.8, vUv.y);
      if (t.a * uA < 0.08) discard;
      o = vec4(t.rgb * t.a * uA * shade * 0.75, t.a * uA); }`,
    uniforms: { tMap: { value: map.tex }, uA: { value: 0 } },
    transparent: true,
    depthWrite: true,
    blending: THREE.CustomBlending,
    blendSrc: THREE.OneFactor,
    blendDst: THREE.OneMinusSrcAlphaFactor,
  });
  const mapMesh = new THREE.Mesh(new THREE.PlaneGeometry(mapW, mapW / map.aspect), mapMat);
  mapMesh.position.set(-0.8, 1.4, -2.5);
  scene.add(mapMesh);

  // ---- numbers floor (tilted plane of percentages)
  const numAtlas = new GlyphAtlas({ font: `italic 700 96px ${FONT_INTER}`, fontPx: 96, chars: "0123456789%", cellW: 96, cellH: 128 });
  const floorUp = new THREE.Vector3(0, Math.sin(0.72), -Math.cos(0.72)).normalize(); // recedes upward
  const numbers = new SpriteLayer(numAtlas, 8000, { billboard: false, depthWrite: true, right: new THREE.Vector3(1, 0, 0), up: floorUp });
  scene.add(numbers.mesh);
  type Num = { u: number; w: number; text: string; red: boolean; b: number };
  const NUM_COLS = 13, NUM_ROWS = 30, ROW_GAP = 1.35, COL_GAP = 2.9;
  const nums: Num[] = [];
  const vals = ["10%", "30%", "36%", "20%", "0%", "10%", "36%", "30%"];
  for (let r = 0; r < NUM_ROWS; r++)
    for (let q = 0; q < NUM_COLS; q++) {
      if (rng() < 0.42) continue;
      nums.push({ u: (q - NUM_COLS / 2 + (rng() - 0.5) * 0.7 + (r % 2) * 0.5) * COL_GAP, w: r * ROW_GAP + rng() * 0.3, text: vals[Math.floor(rng() * vals.length)], red: rng() < 0.16, b: 0.6 + rng() * 0.4 });
    }
  const floorOrigin = new THREE.Vector3(0, -7.5, 5.0);
  const floorLen = NUM_ROWS * ROW_GAP;

  // ---- headline word
  const hl = buildHeadlineTexture(v.headline);
  const hlWidth = Math.min(12.6, v.headline.length * 1.6) / hl.textFrac;
  const hlH = hlWidth / hl.aspect;
  const hlGroup = new THREE.Group();
  hlGroup.position.set(0.3, 2.3, 1.0);
  scene.add(hlGroup);
  const hlFaceMat = new THREE.ShaderMaterial({
    glslVersion: THREE.GLSL3,
    vertexShader: quadVert,
    fragmentShader: /* glsl */ `
    precision highp float; uniform sampler2D tMap; uniform float uBlur; uniform float uFlash; uniform float uA;
    in vec2 vUv; out vec4 o;
    void main(){
      vec4 acc = vec4(0.0);
      // zoom blur toward the centre while slamming in
      for (int i = 0; i < 12; i++) {
        float s = 1.0 + uBlur * float(i) / 11.0;
        vec4 t = texture(tMap, (vUv - 0.5) / s + 0.5);
        acc += vec4(t.rgb * t.a, t.a);
      }
      acc /= 12.0;
      if (acc.a * uA < 0.08) discard;
      o = vec4((acc.rgb * 1.25 + vec3(1.0, 0.8, 0.8) * acc.a * uFlash) * uA, acc.a * uA);
    }`,
    uniforms: { tMap: { value: hl.face }, uBlur: { value: 0 }, uFlash: { value: 0 }, uA: { value: 0 } },
    transparent: true,
    depthWrite: true,
    blending: THREE.CustomBlending,
    blendSrc: THREE.OneFactor,
    blendDst: THREE.OneMinusSrcAlphaFactor,
  });
  const extrudeMat = new THREE.ShaderMaterial({
    glslVersion: THREE.GLSL3,
    vertexShader: quadVert,
    fragmentShader: /* glsl */ `
    precision highp float; uniform sampler2D tMap; uniform float uA; uniform vec3 uC;
    in vec2 vUv; out vec4 o;
    void main(){ float a = texture(tMap, vUv).r * uA; if (a < 0.08) discard; o = vec4(uC * a, a); }`,
    uniforms: { tMap: { value: hl.solid }, uA: { value: 0 }, uC: { value: new THREE.Color("#3A0208") } },
    transparent: true,
    depthWrite: true,
    blending: THREE.CustomBlending,
    blendSrc: THREE.OneFactor,
    blendDst: THREE.OneMinusSrcAlphaFactor,
  });
  const hlGeo = new THREE.PlaneGeometry(hlWidth, hlH);
  const EXTRUDE = 6;
  for (let i = EXTRUDE; i >= 1; i--) {
    const m = new THREE.Mesh(hlGeo, extrudeMat);
    m.position.set(i * 0.006, -i * 0.006, -i * 0.012);
    m.renderOrder = 10;
    hlGroup.add(m);
  }
  const hlFace = new THREE.Mesh(hlGeo, hlFaceMat);
  hlFace.renderOrder = 11;
  hlGroup.add(hlFace);

  // ---- ticker band
  const tk = buildTickerTexture(v.keywords);
  const bandW = 34, bandH = 1.3;
  const band = new THREE.Group();
  band.position.set(0.8, 0.2, 1.6);
  scene.add(band);
  const bandBgMat = new THREE.ShaderMaterial({
    glslVersion: THREE.GLSL3,
    vertexShader: quadVert,
    fragmentShader: /* glsl */ `
    precision highp float; uniform float uA;
    in vec2 vUv; out vec4 o;
    void main(){
      float edge = smoothstep(0.0, 0.14, vUv.x) * smoothstep(1.0, 0.86, vUv.x);
      vec3 c = mix(vec3(0.10,0.13,0.20), vec3(0.42,0.46,0.55), smoothstep(0.0, 1.0, vUv.y));
      c += vec3(0.6,0.65,0.75) * smoothstep(0.93, 0.97, vUv.y) * smoothstep(1.0, 0.97, vUv.y);
      float a = 0.42 * edge * uA;
      if (a < 0.02) discard;
      o = vec4(c * a, a);
    }`,
    uniforms: { uA: { value: 0 } },
    transparent: true,
    depthWrite: true,
    blending: THREE.CustomBlending,
    blendSrc: THREE.OneFactor,
    blendDst: THREE.OneMinusSrcAlphaFactor,
  });
  const bandBg = new THREE.Mesh(new THREE.PlaneGeometry(bandW, bandH), bandBgMat);
  bandBg.renderOrder = 12;
  band.add(bandBg);
  const textH = bandH * 0.9;
  const repeatU = bandW / (textH * tk.aspect);
  const tickerMat = new THREE.ShaderMaterial({
    glslVersion: THREE.GLSL3,
    vertexShader: quadVert,
    fragmentShader: /* glsl */ `
    precision highp float; uniform sampler2D tMap; uniform float uOff; uniform float uRep; uniform float uSmear; uniform float uA;
    in vec2 vUv; out vec4 o;
    void main(){
      float u = vUv.x * uRep + uOff;
      float edge = smoothstep(0.0, 0.16, vUv.x) * smoothstep(1.0, 0.84, vUv.x);
      // motion blur grows toward the band edges
      float smear = uSmear * (0.25 + 1.6 * pow(abs(vUv.x - 0.5) * 2.0, 2.0));
      float a = 0.0;
      for (int i = 0; i < 9; i++) a += texture(tMap, vec2(u + smear * (float(i) / 8.0 - 0.5), vUv.y)).a;
      a /= 9.0;
      a *= edge * uA;
      if (a < 0.03) discard;
      o = vec4(vec3(1.0, 1.0, 1.02) * a * 1.15, a);
    }`,
    uniforms: { tMap: { value: tk.tex }, uOff: { value: 0 }, uRep: { value: repeatU }, uSmear: { value: 0.004 }, uA: { value: 0 } },
    transparent: true,
    depthWrite: true,
    blending: THREE.CustomBlending,
    blendSrc: THREE.OneFactor,
    blendDst: THREE.OneMinusSrcAlphaFactor,
  });
  const ticker = new THREE.Mesh(new THREE.PlaneGeometry(bandW, textH), tickerMat);
  ticker.position.set(0, 0, 0.01);
  ticker.renderOrder = 13;
  band.add(ticker);

  // ---- full-frame flash
  const flashMat = new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0, blending: THREE.AdditiveBlending, depthTest: false, depthWrite: false });
  const flash = new THREE.Mesh(new THREE.PlaneGeometry(4, 4), flashMat);
  flash.renderOrder = 100;
  flash.frustumCulled = false;
  camera.add(flash);
  flash.position.set(0, 0, -1);
  scene.add(camera);

  const cyan = new THREE.Color(CYAN);
  const red = new THREE.Color("#E81A2A");

  return {
    scene,
    camera,
    grainFrame: (f) => f,
    update(frame) {
      const t = frame / 30;
      // ---- timing
      const mapOn = smoothstep(30, 44, frame);
      const mapFlash = Math.max(0, 1 - Math.abs(frame - 36) / 8) * (frame >= 30 ? 1 : 0);
      const slam = clamp((frame - 60) / 10);
      const hlOn = frame >= 60 ? 1 : 0;
      const hlFlash = frame >= 60 ? Math.exp(-(frame - 60) / 2.5) : 0;

      // ---- camera: slight angle, slow drift
      const drift = smoothstep(60, 450, frame);
      const ang = -0.2 + 0.07 * drift;
      const dist = 19.5 - 1.4 * drift;
      camera.position.set(Math.sin(ang) * dist + 0.6, 0.6 + 0.4 * drift, Math.cos(ang) * dist);
      camera.up.set(Math.sin(0.06), Math.cos(0.06), 0);
      camera.lookAt(0.2, 0.5 + 0.1 * drift, 0);
      camera.updateMatrixWorld();

      (bg.material as THREE.ShaderMaterial).uniforms.uOn.value = 0.55 + 0.45 * smoothstep(0, 30, frame);
      panelMat.uniforms.uA.value = 0.18 * mapOn + 0.25 * mapFlash;
      mapMat.uniforms.uA.value = mapOn * (1 + 0.8 * mapFlash);

      // number floor: scrolls slowly toward the camera
      const scroll = t * 0.55;
      numbers.begin();
      for (const n of nums) {
        const w = mod(n.w - scroll, floorLen);
        const fadeIn = smoothstep(0, 2.5, w) * smoothstep(floorLen, floorLen - 4, w);
        const a = mapOn * (1 + 0.7 * mapFlash) * fadeIn * n.b;
        const base = n.red ? red : cyan;
        const k = 1.25 * a;
        const ax = floorOrigin.x + n.u;
        const ay = floorOrigin.y + floorUp.y * w;
        const az = floorOrigin.z + floorUp.z * w;
        numbers.text(n.text, ax, ay, az, 0.66, [base.r * k, base.g * k, base.b * k, 1], "center");
      }
      numbers.end();

      // headline slam: scale 1.15 -> 1 with zoom blur and flash
      const e = easeOutCubic(slam);
      const sc = 1.15 - 0.15 * e;
      hlGroup.scale.setScalar(sc);
      hlFaceMat.uniforms.uBlur.value = 0.22 * (1 - e);
      hlFaceMat.uniforms.uFlash.value = 1.4 * hlFlash;
      hlFaceMat.uniforms.uA.value = hlOn * smoothstep(60, 62, frame);
      extrudeMat.uniforms.uA.value = hlOn * smoothstep(61, 66, frame);
      flashMat.opacity = 0.14 * hlFlash + 0.04 * mapFlash;

      // ticker
      const bandOn = smoothstep(60, 70, frame);
      band.scale.set(1, 0.6 + 0.4 * easeOutCubic(clamp((frame - 60) / 8)), 1);
      bandBgMat.uniforms.uA.value = bandOn;
      tickerMat.uniforms.uA.value = bandOn;
      const speed = 0.06; // texture repeats per second
      tickerMat.uniforms.uOff.value = Math.max(0, t - 1.6) * speed + 0.35;
      tickerMat.uniforms.uSmear.value = speed / 30 * 1.6;

      void TAU;
      return {
        focusNear: 16.8,
        focusFar: 18.9,
        nearBlurAt: 12.0,
        farBlurAt: 25,
        nearCoc: 0.006,
        farCoc: 0.004,
        bloom: 0.22,
        bloomRadius: 0.5,
        exposure: 1.05,
        vignette: 0.6,
        grain: 0.015,
        saturation: 1.05,
      };
    },
  };
};
