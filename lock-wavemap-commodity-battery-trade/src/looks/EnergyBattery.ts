import * as THREE from "three";
import type { LookFactory } from "../core/Stage";
import { canvasTexture, font, hexVec, makeCanvas } from "../core/canvas";
import { mulberry32, range, TAU } from "../core/random";

// Look 4 — Energy Battery. A glowing battery with a lightning bolt on a
// perspective floor of ~30k tiny lights. 600-frame seamless loop: every
// oscillator below completes a whole number of cycles in LOOP frames.
//
// Particles don't write depth, so depth of field is done per particle in
// the vertex shader (circle of confusion -> bigger, dimmer, softer disc)
// rather than in the post pass.

export type EnergyBatteryProps = {
  battery: string;
  bolt: string;
  floor: string;
  accent: string;
  background: string;
};

const LOOP = 600;
const BH = 2.0; // battery body height
const BW = 1.02; // body width
const BD = 0.5; // body depth
const FOCUS = 8.3;

const rng = mulberry32(77753);

// ---- Shared bokeh point shader -------------------------------------------
const POINT_VERT = /* glsl */ `
  in vec4 aDat;   // brightness, size, phase, kind
  in vec3 aCol;
  uniform float t, pxScale, pxRes, focus, cocScale, cocMax;
  out vec3 vCol; out float vA; out float vSoft;
  #define TAU 6.2831853
  vec3 animate(vec3 p, vec4 d);
  float glowAt(vec3 p, vec4 d);
  void main(){
    vec3 p = animate(position, aDat);
    vec4 mv = modelViewMatrix * vec4(p, 1.0);
    float z = -mv.z;
    float base = aDat.y * 0.011 * pxScale / z;          // in-focus size (px); pxScale = focal length in px
    float coc = min(abs(z - focus) / z * cocScale, cocMax) * pxRes; // blur disc (px), 4K-relative
    float size = max(base + coc, 1.5);
    float energy = max(base * base, 1.0) / (size * size);  // conserve light while growing
    vA = glowAt(p, aDat) * min(1.0, energy * 1.4);
    vSoft = clamp(coc / max(size, 1e-3), 0.0, 1.0);
    vCol = aCol;
    gl_PointSize = size;
    gl_Position = projectionMatrix * mv;
  }`;
const POINT_FRAG = /* glsl */ `precision highp float;
  in vec3 vCol; in float vA; in float vSoft; out vec4 o;
  void main(){
    vec2 q = gl_PointCoord * 2.0 - 1.0; float r = length(q);
    if (r > 1.0) discard;
    float sharp = 1.0 - smoothstep(0.55, 1.0, r);
    float bokeh = (1.0 - smoothstep(0.75, 1.0, r)) * (0.75 + 0.25 * r);
    float a = mix(sharp, bokeh, vSoft) * vA;
    o = vec4(vCol * a, 1.0);
  }`;

const pointsMaterial = (animateGlsl: string, extraUniforms: Record<string, THREE.IUniform> = {}) =>
  new THREE.ShaderMaterial({
    glslVersion: THREE.GLSL3,
    transparent: true,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
    uniforms: {
      t: { value: 0 },
      pxScale: { value: 1 },
      pxRes: { value: 1 },
      focus: { value: FOCUS },
      cocScale: { value: 46 },
      cocMax: { value: 60 },
      ...extraUniforms,
    },
    vertexShader: POINT_VERT.replace("vec3 animate(vec3 p, vec4 d);\n  float glowAt(vec3 p, vec4 d);", animateGlsl),
    fragmentShader: POINT_FRAG,
  });

const pointsGeo = (pos: number[], dat: number[], col: number[]) => {
  const g = new THREE.BufferGeometry();
  g.setAttribute("position", new THREE.Float32BufferAttribute(pos, 3));
  g.setAttribute("aDat", new THREE.Float32BufferAttribute(dat, 4));
  g.setAttribute("aCol", new THREE.Float32BufferAttribute(col, 3));
  return g;
};

// ---- Floor data (module level, seeded) ------------------------------------
// Lit "circuit" segments strung along a perspective grid (both directions),
// plus loose scatter. aDat = brightness, size, phase, kind (0 along z, 1 along x, 2 scatter).
const GRID = 0.12;
const FLOOR = (() => {
  const pos: number[] = [];
  const dat: number[] = [];
  const kind: number[] = [];
  const segs = 3000;
  for (let s = 0; s < segs && pos.length / 3 < 25000; s++) {
    const zc = -24 + Math.pow(rng(), 0.55) * 32; // denser toward the battery / camera
    const xs = 1.5 + (9.5 - zc) * 0.5;
    const xc = range(rng, -1, 1) * xs * Math.pow(rng(), 0.6);
    const gx = Math.round(xc / GRID) * GRID;
    const gz = Math.round(zc / GRID) * GRID;
    const b = range(rng, 0.35, 1);
    const accent = rng() < 0.05 ? 1 : 0;
    const step = 0.028;
    if (rng() < 0.18) {
      // small lit block (chip)
      const n = 2 + Math.floor(rng() * 3);
      for (let a = 0; a < n; a++)
        for (let c = 0; c < n; c++) {
          pos.push(gx + a * 0.045, 0, gz + c * 0.045);
          dat.push(b, range(rng, 0.8, 1.2), rng() * TAU, 2);
          kind.push(accent);
        }
      continue;
    }
    const alongZ = rng() < 0.6;
    const len = range(rng, 0.2, alongZ ? 1.6 : 1.0);
    for (let k = 0; k * step < len; k++) {
      const o = k * step - len / 2;
      if (alongZ) pos.push(gx, 0, gz + o);
      else pos.push(gx + o, 0, gz);
      dat.push(b * range(rng, 0.7, 1), range(rng, 0.7, 1.2), rng() * TAU, alongZ ? 0 : 1);
      kind.push(accent);
    }
  }
  while (pos.length / 3 < 30000) {
    const z = -24 + Math.pow(rng(), 0.6) * 32;
    const xs = 2 + (9.5 - z) * 0.5;
    pos.push(Math.round(range(rng, -xs, xs) / GRID) * GRID, 0, Math.round(z / GRID) * GRID);
    dat.push(range(rng, 0.3, 1.2), range(rng, 0.9, 2.2), rng() * TAU, 2);
    kind.push(rng() < 0.08 ? 1 : 0);
  }
  return { pos, dat, kind };
})();

const SPECKS = (() => {
  const pos: number[] = [];
  const dat: number[] = [];
  const kind: number[] = [];
  for (let i = 0; i < 700; i++) {
    const z = i < 40 ? range(rng, 6.5, 8.5) : range(rng, -28, 6.5);
    const spread = 3 + (8 - z) * 0.55;
    pos.push(range(rng, -spread, spread), range(rng, -0.6, 0.6 + (8 - z) * 0.42), z);
    dat.push(range(rng, 0.25, 1), range(rng, 0.8, 3.2), rng() * TAU, Math.floor(rng() * 3) + 1);
    kind.push(rng() < 0.05 ? 1 : 0);
  }
  return { pos, dat, kind };
})();

const RISERS = (() => {
  const pos: number[] = [];
  const dat: number[] = [];
  for (let i = 0; i < 700; i++) {
    const a = rng() * TAU;
    const r = Math.sqrt(rng());
    pos.push(Math.cos(a) * r * BW * 0.42, rng(), Math.sin(a) * r * BD * 0.42);
    // brightness, size, phase, cycles per loop (integer => seamless)
    dat.push(range(rng, 0.4, 1), range(rng, 0.5, 1.3), rng(), 2 + Math.floor(rng() * 4));
  }
  return { pos, dat };
})();

const NUMBERS = ["921.80", "358.37", "77753", "430.68", "6402.7", "88415", "570.31", "2048.6", "12.09", "93.77", "41166", "705.2", "65537", "814.40"];
const NUM_POS = NUMBERS.map((_, i) =>
  i === 0 ? ([-1.7, 0.18, 5.6, 0.3] as const) : ([range(rng, -9, 9) * (rng() < 0.5 ? 1 : -1), range(rng, 0.8, 7), range(rng, -18, -4), rng() * TAU] as const),
);

export const energyBatteryLook: LookFactory<EnergyBatteryProps> = (env, p) => {
  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(32, env.aspect, 0.1, 200);
  const pxScale = env.pxH / 2160;
  const focalPx = env.pxH / (2 * Math.tan((32 * Math.PI) / 360));
  const batCol = hexVec(p.battery);
  const boltCol = hexVec(p.bolt);
  const floorCol = hexVec(p.floor);
  const accCol = hexVec(p.accent);

  // Background: near-black navy, faintly lifted around the horizon.
  const bg = new THREE.Mesh(
    new THREE.PlaneGeometry(2, 2),
    new THREE.ShaderMaterial({
      glslVersion: THREE.GLSL3,
      depthWrite: false,
      depthTest: false,
      uniforms: { col: { value: hexVec(p.background) }, tint: { value: floorCol } },
      vertexShader: `out vec2 vUv; void main(){ vUv=uv; gl_Position=vec4(position.xy,0.9999,1.0);} `,
      fragmentShader: `precision highp float; in vec2 vUv; out vec4 o; uniform vec3 col, tint;
        void main(){ float h = exp(-pow((vUv.y-0.47)/0.16,2.0)); vec2 q=vUv-0.5; q.x*=1.78;
          vec3 c = col * (1.0 - 0.5*smoothstep(0.3,1.0,length(q))) + tint*0.08*h*(1.0-smoothstep(0.0,0.6,abs(q.x)));
          // faint vertical "data skyline" strokes in the upper half
          float colx = floor(vUv.x * 160.0);
          float hv = fract(sin(colx * 17.13) * 4375.5);
          float strokeV = step(0.82, hv) * (1.0 - smoothstep(0.0, 0.25, abs(fract(vUv.x * 160.0) - 0.5) - 0.2));
          float top = 0.55 + hv * 0.4;
          c += tint * strokeV * 0.015 * smoothstep(0.5, 0.56, vUv.y) * (1.0 - smoothstep(top - 0.1, top, vUv.y));
          // soft rays fanning out behind the battery
          vec2 rp = vUv - vec2(0.5, 0.42); rp.x *= 1.78;
          float ang = atan(rp.y, rp.x);
          float ray = pow(0.5 + 0.5 * sin(ang * 23.0 + 1.3) * sin(ang * 7.0), 6.0);
          c += tint * ray * 0.05 * exp(-length(rp) / 0.35) * smoothstep(0.02, 0.1, length(rp));
          o=vec4(c,1.0);} `,
    }),
  );
  bg.frustumCulled = false;
  bg.renderOrder = -10;
  scene.add(bg);

  // ---- Floor lights -------------------------------------------------------
  const fCol: number[] = [];
  FLOOR.kind.forEach((k) => {
    const c = k ? accCol : floorCol;
    fCol.push(c.x, c.y, c.z);
  });
  const floorMat = pointsMaterial(
    /* glsl */ `
    uniform vec3 hot;
    vec3 animate(vec3 p, vec4 d){ return p; }
    float glowAt(vec3 p, vec4 d){
      float r = length(p.xz);
      float near = exp(-r / 1.8) * 2.2 + exp(-r / 5.5) * 0.7 + 0.08;
      near *= exp(-max(0.0, -p.z - 1.0) / 3.2);   // fade into the distance: no hard horizon
      float flick = 0.7 + 0.3 * sin(TAU * t * 3.0 + d.z * 7.0);
      float cone = exp(-pow(max(0.0, abs(p.x) - 0.4 - max(0.0, p.z) * 0.45) / 1.6, 2.0));
      float g = d.x * near * flick * (d.w > 1.5 ? 1.3 : 0.9) * mix(0.25, 1.0, cone);
      // streaks: pulses running along grid lines toward the battery
      if (d.w < 1.5) {
        float lineId = floor(d.z * 13.0);
        float on = step(0.86, fract(sin(lineId * 12.9898 + d.w * 78.233) * 43758.5453));
        float along = d.w < 0.5 ? abs(p.z) : abs(p.x);
        float head = (1.0 - fract(t * 3.0 + fract(lineId * 0.6180339))) * 26.0;
        float x = along - head;          // >0: behind the head (tail)
        float pulse = on * (exp(-pow(x / 0.25, 2.0)) * 3.0 + (x > 0.0 ? exp(-x / 0.8) : 0.0) * 0.8);
        g += pulse * (0.5 + exp(-r / 5.0)) * mix(0.2, 1.0, cone);
      }
      return g;
    }`,
  );
  // streak line ids must be stable per grid line: use line coordinate instead of phase
  floorMat.vertexShader = floorMat.vertexShader.replace(
    "float lineId = floor(d.z * 13.0);",
    "float lineId = d.w < 0.5 ? floor(p.x / 0.12 + 0.5) : floor(p.z / 0.12 + 0.5) + 1000.0;",
  );
  const floor = new THREE.Points(pointsGeo(FLOOR.pos, FLOOR.dat, fCol), floorMat);
  floor.frustumCulled = false;
  scene.add(floor);

  // ---- Specks (floating at depth) --------------------------------------------
  const sCol: number[] = [];
  SPECKS.kind.forEach((k, i) => {
    const c = k ? accCol : i % 3 === 0 ? new THREE.Vector3(0.85, 0.92, 1.0) : batCol;
    sCol.push(c.x, c.y, c.z);
  });
  const speckMat = pointsMaterial(/* glsl */ `
    vec3 animate(vec3 p, vec4 d){
      float a = TAU * t * d.w + d.z;
      return p + vec3(sin(a) * 0.25, sin(a * 2.0 + 1.0) * 0.12, cos(a) * 0.25);
    }
    float glowAt(vec3 p, vec4 d){ return d.x * (0.55 + 0.45 * sin(TAU * t * d.w * 2.0 + d.z * 3.0)) * 2.2; }`);
  const specks = new THREE.Points(pointsGeo(SPECKS.pos, SPECKS.dat, sCol), speckMat);
  specks.frustumCulled = false;
  scene.add(specks);

  // ---- Rising energy -----------------------------------------------------------
  const rCol: number[] = [];
  for (let i = 0; i < RISERS.pos.length / 3; i++) rCol.push(boltCol.x, boltCol.y, boltCol.z);
  const riserMat = pointsMaterial(/* glsl */ `
    vec3 animate(vec3 p, vec4 d){
      float u = fract(d.z + t * d.w);
      return vec3(p.x * (1.0 - u * 0.4), u * ${(BH + 1.6).toFixed(2)}, p.z);
    }
    float glowAt(vec3 p, vec4 d){
      float u = p.y / ${(BH + 1.6).toFixed(2)};
      return d.x * 1.1 * smoothstep(0.0, 0.08, u) * (1.0 - smoothstep(0.45, 0.62, u));
    }`);
  const risers = new THREE.Points(pointsGeo(RISERS.pos, RISERS.dat, rCol), riserMat);
  risers.frustumCulled = false;
  scene.add(risers);

  // ---- Battery body ----------------------------------------------------------
  // Bolt artwork: R = crisp fill, G = wide soft glow (drawn once).
  const boltC = makeCanvas(512, 1024);
  {
    const { ctx } = boltC;
    const bolt = () => {
      ctx.beginPath();
      // normalized bolt polygon in a 512x1024 box
      const P = [
        [300, 150], [150, 560], [262, 560], [205, 880], [372, 420], [258, 420], [330, 150],
      ];
      // ~45% of the body height, centred a little above the middle
      P.forEach(([x, y], i) => {
        const X = 256 + (x - 261) * 0.72;
        const Y = 470 + (y - 515) * 0.72;
        if (i) ctx.lineTo(X, Y);
        else ctx.moveTo(X, Y);
      });
      ctx.closePath();
    };
    ctx.fillStyle = "#000";
    ctx.fillRect(0, 0, 512, 1024);
    ctx.globalCompositeOperation = "lighter";
    ctx.filter = "blur(36px)";
    ctx.fillStyle = "rgb(0,255,0)";
    bolt();
    ctx.fill();
    ctx.filter = "blur(10px)";
    ctx.fillStyle = "rgb(0,120,0)";
    bolt();
    ctx.fill();
    ctx.filter = "none";
    ctx.fillStyle = "rgb(255,0,0)";
    bolt();
    ctx.fill();
    ctx.strokeStyle = "rgb(0,0,255)";
    ctx.lineWidth = 9;
    ctx.lineJoin = "round";
    bolt();
    ctx.stroke();
  }
  const boltTex = canvasTexture(boltC.canvas, env.gl);

  const faceMat = (back: boolean) =>
    new THREE.ShaderMaterial({
      glslVersion: THREE.GLSL3,
      transparent: true,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
      side: THREE.DoubleSide,
      uniforms: {
        t: { value: 0 },
        level: { value: 0.5 },
        pulse: { value: 1 },
        col: { value: batCol },
        boltCol: { value: boltCol },
        boltTex: { value: boltTex },
        size: { value: new THREE.Vector2(BW, BH) },
        px: { value: 1 },
        back: { value: back ? 1 : 0 },
        rad: { value: 0.06 },
      },
      vertexShader: `out vec2 vUv; void main(){ vUv=uv; gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.0);} `,
      fragmentShader: /* glsl */ `precision highp float; in vec2 vUv; out vec4 o;
        uniform float t, level, pulse, px, back, rad; uniform vec3 col, boltCol; uniform sampler2D boltTex; uniform vec2 size;
        #define TAU 6.2831853
        float hash(vec2 p){ return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
        float sdRound(vec2 p, vec2 b, float r){ vec2 q = abs(p) - b + r; return length(max(q,0.0)) + min(max(q.x,q.y),0.0) - r; }
        void main(){
          vec2 p = (vUv - 0.5) * size;
          float d = sdRound(p, size * 0.5 - 0.02, rad);
          float edgeW = 0.008;
          float line = exp(-pow(d / edgeW, 2.0));
          float halo = exp(-abs(d) / 0.03) * 0.15;
          float inside = 1.0 - smoothstep(-0.01, 0.01, d);
          // digital particle pattern: cells that flicker on whole loop cycles
          vec2 g = vUv * vec2(46.0, 92.0) + vec2(hash(floor(vUv * vec2(46.0, 92.0)).yx) * 0.5, 0.0);
          vec2 cell = floor(g);
          vec2 f = fract(g) - 0.5;
          float h = hash(cell);
          float tw = 0.5 + 0.5 * sin(TAU * (t * (1.0 + floor(h * 4.0)) + h * 9.0));
          float dotm = 1.0 - smoothstep(0.18, 0.42, length(f));
          float lev = level;
          float below = 1.0 - smoothstep(lev - 0.006, lev + 0.006, vUv.y);
          float meniscus = exp(-pow((vUv.y - lev) / 0.008, 2.0));
          float fill = inside * (0.035 + below * 0.09);
          float dots = inside * dotm * step(0.38, h) * tw * (0.16 + below * 0.5);
          // edge dots: dense sparkle along the outline
          float edgeDots = dotm * exp(-abs(d) / 0.025) * step(0.2, h) * (0.6 + 0.4 * tw);
          vec3 c = col * (fill + dots + halo * 0.5 + edgeDots * 1.0) + mix(col, vec3(1.0), 0.2) * line * 0.45;
          c += mix(col, vec3(1.0), 0.3) * meniscus * inside * 0.6 * step(0.02, lev);
          if (back < 0.5) {
            vec4 b = texture(boltTex, vec2(vUv.x, 1.0 - vUv.y) * vec2(1.0, 1.0));
            float bd = dotm * step(0.25, h);
            c += mix(col, boltCol, 0.35) * (b.r * (0.12 + 0.6 * bd) + b.b * 1.2) * pulse;
            c += col * b.g * 0.3 * pulse;
          } else {
            c *= back > 0.55 ? 0.8 : 0.18;
          }
          o = vec4(c, 1.0);
        }`,
    });

  const battery = new THREE.Group();
  scene.add(battery);
  const front = new THREE.Mesh(new THREE.PlaneGeometry(BW, BH), faceMat(false));
  front.position.set(0, BH / 2 + 0.02, BD / 2);
  const back = new THREE.Mesh(new THREE.PlaneGeometry(BW, BH), faceMat(true));
  back.position.set(0, BH / 2 + 0.02, -BD / 2);
  const sideL = new THREE.Mesh(new THREE.PlaneGeometry(BD, BH), faceMat(true));
  sideL.rotation.y = Math.PI / 2;
  sideL.position.set(-BW / 2, BH / 2 + 0.02, 0);
  (sideL.material as THREE.ShaderMaterial).uniforms.size.value = new THREE.Vector2(BD, BH);
  const sideR = sideL.clone();
  sideR.material = faceMat(true);
  (sideR.material as THREE.ShaderMaterial).uniforms.size.value = new THREE.Vector2(BD, BH);
  sideR.position.x = BW / 2;
  // terminal cap
  const cap = new THREE.Mesh(new THREE.PlaneGeometry(BW * 0.55, 0.13), faceMat(true));
  (cap.material as THREE.ShaderMaterial).uniforms.size.value = new THREE.Vector2(BW * 0.55, 0.13);
  (cap.material as THREE.ShaderMaterial).uniforms.rad.value = 0.015;
  (cap.material as THREE.ShaderMaterial).uniforms.level.value = 1;
  (cap.material as THREE.ShaderMaterial).uniforms.back.value = 0.6;
  cap.position.set(0, BH + 0.06, BD * 0.2);
  const top = new THREE.Mesh(new THREE.PlaneGeometry(BW, BD), faceMat(true));
  (top.material as THREE.ShaderMaterial).uniforms.size.value = new THREE.Vector2(BW, BD);
  top.rotation.x = -Math.PI / 2;
  top.position.set(0, BH + 0.02, 0);
  battery.add(back, sideL, sideR, top, cap, front);
  const faces = [front, back, sideL, sideR, cap, top].map((m) => m.material as THREE.ShaderMaterial);

  // ---- Light pool, shaft ------------------------------------------------------
  const glowMat = (frag: string) =>
    new THREE.ShaderMaterial({
      glslVersion: THREE.GLSL3,
      transparent: true,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
      side: THREE.DoubleSide,
      uniforms: { col: { value: batCol }, hot: { value: boltCol }, k: { value: 1 } },
      vertexShader: `out vec2 vUv; void main(){ vUv=uv; gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.0);} `,
      fragmentShader: `precision highp float; in vec2 vUv; out vec4 o; uniform vec3 col, hot; uniform float k; void main(){ vec2 q = vUv - 0.5; ${frag} }`,
    });
  const pool = new THREE.Mesh(
    new THREE.PlaneGeometry(9, 9),
    glowMat(`float r = length(q * vec2(1.0, 1.0)) * 9.0;
      vec2 qq = q * 9.0;
      vec3 c = hot * exp(-pow(r / 0.08, 2.0)) * 3.0 + col * exp(-r / 0.5) * 0.4 + col * exp(-r / 3.0) * 0.12
             + col * exp(-abs(qq.y) / 0.05) * exp(-abs(qq.x) / 1.6) * 0.5;
      o = vec4(c * k, 1.0);`),
  );
  pool.rotation.x = -Math.PI / 2;
  pool.position.y = 0.01;
  scene.add(pool);
  const shaft = new THREE.Mesh(
    new THREE.PlaneGeometry(3.2, 9),
    glowMat(`float x = abs(q.x) * 3.2; float y = vUv.y;
      vec3 c = col * (exp(-pow(x / 0.22, 2.0)) * 0.06 + exp(-x / 0.9) * 0.015) * smoothstep(0.0, 0.25, y) * (1.0 - smoothstep(0.35, 1.0, y));
      o = vec4(c * k, 1.0);`),
  );
  shaft.position.set(0, 4.5, -BD);
  scene.add(shaft);

  // ---- Floating numbers ----------------------------------------------------------
  const atlas = makeCanvas(1024, 64 * NUMBERS.length);
  {
    const { ctx } = atlas;
    ctx.font = font(500, 40, "JetBrains Mono");
    ctx.textBaseline = "middle";
    NUMBERS.forEach((s, i) => {
      ctx.fillStyle = "rgba(170,210,255,1)";
      ctx.beginPath();
      ctx.arc(14, i * 64 + 32, 7, 0, TAU);
      ctx.fill();
      ctx.fillText(s, 34, i * 64 + 32);
    });
  }
  const atlasTex = canvasTexture(atlas.canvas, env.gl);
  const nums = NUMBERS.map((_, i) => {
    const m = new THREE.ShaderMaterial({
      glslVersion: THREE.GLSL3,
      transparent: true,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
      uniforms: { map: { value: atlasTex }, row: { value: i }, rows: { value: NUMBERS.length }, col: { value: batCol }, a: { value: 1 } },
      vertexShader: `out vec2 vUv; void main(){ vUv=uv; gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.0);} `,
      fragmentShader: `precision highp float; in vec2 vUv; out vec4 o; uniform sampler2D map; uniform float row, rows, a; uniform vec3 col;
        void main(){ vec2 uv = vec2(vUv.x * 0.5, (row + vUv.y) / rows); uv.y = 1.0 - uv.y; uv.y = 1.0 - ((rows - row - 1.0) + vUv.y) / rows;
          float t = texture(map, vec2(uv.x, 1.0 - uv.y)).a; o = vec4(mix(col, vec3(0.6, 0.95, 1.0), 0.5) * t * a, 1.0);} `,
    });
    const mesh = new THREE.Mesh(new THREE.PlaneGeometry(1.7, 0.2125), m);
    if (i === 0) mesh.scale.setScalar(0.6);
    const [x, y, z] = NUM_POS[i];
    mesh.position.set(x, y, z);
    scene.add(mesh);
    return { mesh, m };
  });

  const ptMats = [floorMat, speckMat, riserMat];

  return {
    scene,
    camera,
    post: { bloomStrength: 0.85, bloomThreshold: 0.45, bloomKnee: 0.3, bloomRadius: 0.8, vignette: 0.5, loop: LOOP },
    update: (frame) => {
      const f = ((frame % LOOP) + LOOP) % LOOP;
      const t = f / LOOP;
      const th = TAU * t;
      // closed camera path: gentle push in and out with a lateral drift
      camera.position.set(0.4 * Math.sin(th), 1.35 + 0.08 * Math.sin(2 * th), 11.0 - 0.6 * (0.5 - 0.5 * Math.cos(th)));
      camera.lookAt(0.05 * Math.sin(th), 0.7, 0);
      camera.updateMatrixWorld();
      // charge: fills over ~2/3 of the loop, then dims back (smooth, periodic)
      const charge = 0.5 - 0.5 * Math.cos(th);
      const level = 0.12 + 0.8 * Math.pow(charge, 0.9);
      const pulse = 0.78 + 0.22 * Math.pow(0.5 + 0.5 * Math.sin(TAU * t * 10), 2);
      faces.forEach((m) => {
        m.uniforms.t.value = t;
        m.uniforms.level.value = level;
        m.uniforms.pulse.value = pulse;
      });
      ptMats.forEach((m) => {
        m.uniforms.t.value = t;
        m.uniforms.pxScale.value = focalPx;
        m.uniforms.pxRes.value = pxScale;
      });
      const camDist = camera.position.distanceTo(new THREE.Vector3(0, 1, 0));
      ptMats.forEach((m) => (m.uniforms.focus.value = camDist));
      nums.forEach(({ mesh, m }, i) => {
        mesh.quaternion.copy(camera.quaternion);
        m.uniforms.a.value = i === 0 ? 0.95 : 0.22 + 0.15 * Math.sin(th * 2 + NUM_POS[i][3]);
      });
    },
  };
};
