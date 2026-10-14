// The glass "AI" cube: frosted glass shell with a fresnel rim, inner circuit
// faces (traces reveal from the centre out, pulses run along them), the "AI"
// letters on the front face, a 12-edge frame that draws on, an inner glow and
// the glowing square on the palm. All animated from SceneState values.
import * as THREE from "three";
import { FONT_AI } from "../lib/fonts";
import { mulberry32 } from "../lib/random";
import type { Palette } from "../versions";

// 80% of the palm width (the brief says ~70%; matched up to the reference)
const WHITE = new THREE.Color("#ffffff");
export const CUBE_SIZE = 0.8;

// ---------------------------------------------------------------------------
// Circuit texture: R = traces/outlines, G = distance from the centre along
// the traces (0..1), B = frosted panel fill. Generated once from a seed.
const TEX = 2048;

const buildCircuitTexture = () => {
  const rng = mulberry32(0xc1c0);
  const S = TEX;
  const mk = () => {
    const c = document.createElement("canvas");
    c.width = S;
    c.height = S;
    return c;
  };
  const trace = mk();
  const dist = mk();
  const fill = mk();
  const tc = trace.getContext("2d")!;
  const dc = dist.getContext("2d")!;
  const fc = fill.getContext("2d")!;
  tc.fillStyle = "#000";
  tc.fillRect(0, 0, S, S);
  dc.fillStyle = "#fff";
  dc.fillRect(0, 0, S, S);
  fc.fillStyle = "#000";
  fc.fillRect(0, 0, S, S);
  const maxD = S * 1.1;
  const grey = (d: number) => {
    const v = Math.max(0, Math.min(255, Math.round((d / maxD) * 255)));
    return `rgb(${v},${v},${v})`;
  };
  const cx = S / 2;
  const cy = S / 2;
  const grid = S / 40;
  const snap = (v: number) => Math.round(v / grid) * grid;

  // frosted panels: nested rectangles of slightly different fill (the
  // "maze" look of the faces)
  for (let i = 0; i < 230; i++) {
    const big = i < 40;
    const w = snap(grid * (big ? 4 + rng() * 9 : 1 + rng() * 4));
    const h = snap(grid * (big ? 4 + rng() * 9 : 1 + rng() * 4));
    const x = snap(rng() * (S - w));
    const y = snap(rng() * (S - h));
    const v = Math.round(big ? 120 + rng() * 70 : 150 + rng() * 105);
    fc.fillStyle = `rgb(${v},${v},${v})`;
    fc.fillRect(x, y, w, h);
    // dark seam around each panel (in the fill channel)
    fc.strokeStyle = "#000";
    fc.lineWidth = 14;
    fc.strokeRect(x + 7, y + 7, w - 14, h - 14);
    // a few panels also get a faint lit outline
    if (rng() < 0.25) {
      tc.strokeStyle = `rgba(255,255,255,${0.2 + rng() * 0.3})`;
      tc.lineWidth = 3;
      tc.strokeRect(x + 6, y + 6, w - 12, h - 12);
    }
    // distance for outlines: radial from the centre
    const d = Math.hypot(x + w / 2 - cx, y + h / 2 - cy);
    dc.strokeStyle = grey(d);
    dc.lineWidth = 7;
    dc.strokeRect(x + 1.5, y + 1.5, w - 3, h - 3);
  }

  // traces: orthogonal random walks from the central chip outward
  const drawSeg = (x0: number, y0: number, x1: number, y1: number, d0: number, d1: number, lw: number) => {
    tc.strokeStyle = "#fff";
    tc.lineWidth = lw;
    tc.lineCap = "square";
    tc.beginPath();
    tc.moveTo(x0, y0);
    tc.lineTo(x1, y1);
    tc.stroke();
    const g = dc.createLinearGradient(x0, y0, x1 + 0.01, y1 + 0.01);
    g.addColorStop(0, grey(d0));
    g.addColorStop(1, grey(d1));
    dc.strokeStyle = g;
    dc.lineWidth = lw + 6;
    dc.lineCap = "butt";
    dc.beginPath();
    dc.moveTo(x0, y0);
    dc.lineTo(x1, y1);
    dc.stroke();
  };
  const pad = (x: number, y: number, d: number, r: number) => {
    tc.fillStyle = "#fff";
    tc.beginPath();
    tc.arc(x, y, r, 0, Math.PI * 2);
    tc.fill();
    dc.fillStyle = grey(d);
    dc.beginPath();
    dc.arc(x, y, r + 4, 0, Math.PI * 2);
    dc.fill();
  };
  const core = S * 0.11;
  for (let i = 0; i < 90; i++) {
    // start on the edge of the central chip
    const side = Math.floor(rng() * 4);
    const off = snap((rng() - 0.5) * core * 1.8);
    let x = side === 0 ? cx - core : side === 1 ? cx + core : cx + off;
    let y = side === 2 ? cy - core : side === 3 ? cy + core : cy + off;
    let dir = side; // 0 left, 1 right, 2 up, 3 down
    let d = core;
    const steps = 3 + Math.floor(rng() * 6);
    const lw = rng() < 0.2 ? 7 : 4;
    for (let k = 0; k < steps; k++) {
      const len = snap(grid * (2 + rng() * 9));
      const nx = x + (dir === 0 ? -len : dir === 1 ? len : 0);
      const ny = y + (dir === 2 ? -len : dir === 3 ? len : 0);
      const cxl = Math.max(grid, Math.min(S - grid, nx));
      const cyl = Math.max(grid, Math.min(S - grid, ny));
      drawSeg(x, y, cxl, cyl, d, d + len, lw);
      d += len;
      x = cxl;
      y = cyl;
      // turn 90 degrees, mostly continuing outward
      if (rng() < 0.6) {
        if (dir < 2) dir = rng() < 0.5 ? 2 : 3;
        else dir = rng() < 0.5 ? 0 : 1;
      }
    }
    pad(x, y, d, lw * 2.2);
  }
  // central chip outline + pins
  tc.strokeStyle = "#fff";
  tc.lineWidth = 8;
  tc.strokeRect(cx - core, cy - core, core * 2, core * 2);
  tc.strokeRect(cx - core * 0.7, cy - core * 0.7, core * 1.4, core * 1.4);
  dc.fillStyle = grey(0);
  dc.fillRect(cx - core - 8, cy - core - 8, core * 2 + 16, core * 2 + 16);
  fc.fillStyle = "rgb(150,150,150)";
  fc.fillRect(cx - core, cy - core, core * 2, core * 2);

  // combine into one RGBA texture
  const out = mk();
  const oc = out.getContext("2d")!;
  const id = oc.createImageData(S, S);
  const t = tc.getImageData(0, 0, S, S).data;
  const dd = dc.getImageData(0, 0, S, S).data;
  const ff = fc.getImageData(0, 0, S, S).data;
  for (let i = 0; i < id.data.length; i += 4) {
    id.data[i] = t[i];
    id.data[i + 1] = dd[i];
    id.data[i + 2] = ff[i];
    id.data[i + 3] = 255;
  }
  oc.putImageData(id, 0, 0);
  const tex = new THREE.CanvasTexture(out);
  tex.colorSpace = THREE.NoColorSpace; // data texture
  tex.anisotropy = 8;
  tex.minFilter = THREE.LinearMipmapLinearFilter;
  tex.generateMipmaps = true;
  return tex;
};

// "AI" letters: white core with a soft outline glow, on transparent black.
const buildTextTexture = (text: string) => {
  const W = 1024;
  const c = document.createElement("canvas");
  c.width = W;
  c.height = W;
  const g = c.getContext("2d")!;
  g.clearRect(0, 0, W, W);
  g.textAlign = "center";
  g.textBaseline = "middle";
  const size = text.length <= 2 ? 560 : Math.round(1000 / text.length);
  g.font = `600 ${size}px ${FONT_AI}`;
  const y = W / 2 + 20;
  // soft halo
  g.shadowColor = "#fff";
  g.shadowBlur = 40;
  g.strokeStyle = "rgba(255,255,255,0.22)";
  g.lineWidth = 64;
  g.strokeText(text, W / 2, y);
  g.shadowBlur = 0;
  // hollow double-stroke neon outline: a bright outer stroke with a dark
  // channel cut through it, leaving two crisp lines
  // single glowing outline over a light translucent fill
  g.fillStyle = "rgba(255,255,255,0.2)";
  g.fillText(text, W / 2, y);
  g.shadowBlur = 10;
  g.lineWidth = 26;
  g.strokeStyle = "#fff";
  g.strokeText(text, W / 2, y);
  g.shadowBlur = 0;
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.NoColorSpace;
  tex.anisotropy = 8;
  tex.minFilter = THREE.LinearMipmapLinearFilter;
  return tex;
};

const additive = (
  vertexShader: string,
  fragmentShader: string,
  uniforms: Record<string, THREE.IUniform>,
  side: THREE.Side = THREE.DoubleSide,
) =>
  new THREE.ShaderMaterial({
    glslVersion: THREE.GLSL3,
    vertexShader,
    fragmentShader,
    uniforms,
    transparent: true,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
    side,
  });

// alpha-blended with premultiplied colour (rgb already multiplied by alpha)
const premultiplied = (
  vertexShader: string,
  fragmentShader: string,
  uniforms: Record<string, THREE.IUniform>,
) => {
  const m = additive(vertexShader, fragmentShader, uniforms);
  m.blending = THREE.CustomBlending;
  m.blendSrc = THREE.OneFactor;
  m.blendDst = THREE.OneMinusSrcAlphaFactor;
  m.blendSrcAlpha = THREE.OneFactor;
  m.blendDstAlpha = THREE.OneMinusSrcAlphaFactor;
  return m;
};

const UV_VERT = /* glsl */ `
uniform mat3 uUvTransform;
out vec2 vUv;
out vec3 vN;
out vec3 vView;
void main() {
  vUv = (uUvTransform * vec3(uv, 1.0)).xy;
  vec4 mv = modelViewMatrix * vec4(position, 1.0);
  vN = normalize(normalMatrix * normal);
  vView = -mv.xyz;
  gl_Position = projectionMatrix * mv;
}`;

export type CubeRig = {
  group: THREE.Group; // world-placed; rotation.y = cube turn
  square: THREE.Group; // glow square + light pool, parented to the palm by the caller
  update: (s: CubeState) => void;
};

export type CubeState = {
  t: number;
  squareGlow: number;
  edgeBottom: number;
  edgeVertical: number;
  edgeTop: number;
  glass: number;
  circuit: number;
  innerGlow: number;
  aiOn: number;
  aiFlash: number;
  /** vertical scale of the frame while the vertical edges grow (0..1) */
};

export const buildCube = (p: Palette, env: THREE.Texture, text: string): CubeRig => {
  const s = CUBE_SIZE;
  const E = p.emissive;
  const h = s / 2;
  const group = new THREE.Group();
  const circuitColor = new THREE.Color(p.circuit);
  const textColor = new THREE.Color(p.text).lerp(new THREE.Color(p.circuit), 0.55);
  const circuitTex = buildCircuitTexture();
  const textTex = buildTextTexture(text);

  // --- glass shell ------------------------------------------------------------
  const glassMat = new THREE.MeshPhysicalMaterial({
    color: new THREE.Color(p.circuit).lerp(new THREE.Color("#ffffff"), 0.7),
    metalness: 0,
    roughness: 0.1,
    transmission: 0.6,
    thickness: 0.35,
    ior: 1.45,
    envMap: env,
    envMapIntensity: 0.6,
    transparent: true,
    depthWrite: false,
    specularIntensity: 1,
  });
  const glass = new THREE.Mesh(new THREE.BoxGeometry(s, s, s), glassMat);
  glass.renderOrder = 1;
  group.add(glass);

  // fresnel rim shell
  const rimMat = additive(
    /* glsl */ `
    out vec3 vN;
    out vec3 vView;
    void main() {
      vec4 mv = modelViewMatrix * vec4(position, 1.0);
      vN = normalize(normalMatrix * normal);
      vView = -mv.xyz;
      gl_Position = projectionMatrix * mv;
    }`,
    /* glsl */ `
    precision highp float;
    uniform vec3 uColor;
    uniform float uAmount;
    in vec3 vN;
    in vec3 vView;
    out vec4 outColor;
    void main() {
      float f = 1.0 - abs(dot(normalize(vN), normalize(vView)));
      float rim = pow(f, 2.5);
      outColor = vec4(uColor * (0.06 + rim * 0.9) * uAmount, 1.0);
    }`,
    { uColor: { value: circuitColor.clone() }, uAmount: { value: 0 } },
    THREE.FrontSide,
  );
  const rim = new THREE.Mesh(new THREE.BoxGeometry(s * 1.004, s * 1.004, s * 1.004), rimMat);
  rim.renderOrder = 3;
  group.add(rim);

  // --- inner circuit faces -------------------------------------------------------
  const faceMat = (rot: number, flip: boolean, offset: [number, number]) => {
    const m = new THREE.Matrix3().setUvTransform(offset[0], offset[1], flip ? -1 : 1, 1, rot, 0.5, 0.5);
    return premultiplied(
      UV_VERT,
      /* glsl */ `
      precision highp float;
      uniform sampler2D tCircuit;
      uniform vec3 uColor;
      uniform float uReveal;
      uniform float uTime;
      uniform float uGlass;
      uniform float uGlow;
      in vec2 vUv;
      in vec3 vN;
      in vec3 vView;
      out vec4 outColor;
      void main() {
        vec4 c = texture(tCircuit, vUv);
        float d = c.g;
        // reveal from the centre outward
        float shown = 1.0 - smoothstep(uReveal * 1.08 - 0.06, uReveal * 1.08, d);
        float front = exp(-pow((d - uReveal * 1.08) / 0.025, 2.0)) * step(0.001, uReveal) * step(uReveal, 0.999);
        // pulses running outward along the traces (period 2 s)
        float ph = fract(d * 3.0 - uTime * 0.5);
        float pulse = exp(-pow((ph - 0.5) / 0.035, 2.0));
        float lines = c.r * (shown * (0.55 + 1.6 * pulse * uGlow) + front * 3.0);
        // frosted panel fill: makes the faces read pale and solid
        float facing = abs(dot(normalize(vN), normalize(vView)));
        float fill = (0.02 + c.b * 0.32) * uGlass * (0.25 + 0.75 * uGlow) * (0.6 + 0.4 * facing);
        // semi-opaque pale panels (alpha blended) with glowing traces on top
        // light grey-blue machined panels: mostly opaque, dark carved seams
        vec3 metal = mix(uColor, vec3(0.8, 0.86, 0.94), 0.72);
        float shade = 0.12 + 0.95 * pow(c.b, 1.2);
        // faces turned toward the upper-left key read silver, others darker blue
        float key = clamp(dot(normalize(vN), normalize(vec3(-0.75, 0.35, 0.55))), 0.0, 1.0);
        vec3 tint = mix(uColor * 0.6, metal, 0.55 + 0.45 * key);
        vec3 panel = tint * shade * (0.45 + 0.55 * uGlow) * (0.6 + 0.7 * key);
        float alpha = uGlass * (0.9 + 0.08 * c.b);
        vec3 col = panel * alpha + uColor * lines * 1.1;
        outColor = vec4(col, alpha);
      }`,
      {
        tCircuit: { value: circuitTex },
        uUvTransform: { value: m },
        uColor: { value: circuitColor.clone() },
        uReveal: { value: 0 },
        uTime: { value: 0 },
        uGlass: { value: 0 },
        uGlow: { value: 0 },
      },
    );
  };
  const faces: THREE.ShaderMaterial[] = [];
  const inset = h * 0.985;
  const faceDefs: [THREE.Euler, THREE.Vector3, number, boolean, [number, number]][] = [
    [new THREE.Euler(0, 0, 0), new THREE.Vector3(0, 0, inset), 0, false, [0, 0]], // +Z front
    [new THREE.Euler(0, Math.PI, 0), new THREE.Vector3(0, 0, -inset), Math.PI / 2, true, [0.13, 0.07]],
    [new THREE.Euler(0, Math.PI / 2, 0), new THREE.Vector3(inset, 0, 0), Math.PI, false, [0.21, -0.11]],
    [new THREE.Euler(0, -Math.PI / 2, 0), new THREE.Vector3(-inset, 0, 0), -Math.PI / 2, false, [-0.17, 0.19]],
    [new THREE.Euler(-Math.PI / 2, 0, 0), new THREE.Vector3(0, inset, 0), Math.PI / 2, false, [0.31, 0.27]],
    [new THREE.Euler(Math.PI / 2, 0, 0), new THREE.Vector3(0, -inset, 0), 0, true, [-0.29, 0.05]],
  ];
  const faceGeo = new THREE.PlaneGeometry(s * 0.985, s * 0.985);
  faceDefs.forEach(([rot, pos, uvRot, flip, off]) => {
    const m = faceMat(uvRot, flip, off);
    faces.push(m);
    const mesh = new THREE.Mesh(faceGeo, m);
    mesh.rotation.copy(rot);
    mesh.position.copy(pos);
    mesh.renderOrder = 2;
    group.add(mesh);
  });

  // --- "AI" letters on the front face ---------------------------------------
  const textMat = additive(
    UV_VERT,
    /* glsl */ `
    precision highp float;
    uniform sampler2D tText;
    uniform vec3 uColor;
    uniform float uAmount;
    in vec2 vUv;
    out vec4 outColor;
    void main() {
      float a = texture(tText, vUv).a;
      outColor = vec4(uColor * a * uAmount, 1.0);
    }`,
    { tText: { value: textTex }, uUvTransform: { value: new THREE.Matrix3() }, uColor: { value: textColor.clone() }, uAmount: { value: 0 } },
    THREE.FrontSide,
  );
  const textMesh = new THREE.Mesh(new THREE.PlaneGeometry(s * 0.92, s * 0.92), textMat);
  textMesh.position.z = h + 0.003;
  textMesh.renderOrder = 4;
  group.add(textMesh);

  // --- inner glow (camera-facing soft sprite at the centre) -----------------
  const glowMat = additive(
    /* glsl */ `
    out vec2 vUv;
    void main() {
      vUv = uv;
      vec4 mv = modelViewMatrix * vec4(0.0, 0.0, 0.0, 1.0);
      mv.xy += position.xy;
      gl_Position = projectionMatrix * mv;
    }`,
    /* glsl */ `
    precision highp float;
    uniform vec3 uColor;
    uniform float uAmount;
    in vec2 vUv;
    out vec4 outColor;
    void main() {
      float r = length(vUv - 0.5) * 2.0;
      float g = exp(-r * r * 5.0) * 0.8 + exp(-r * r * 1.6) * 0.25;
      outColor = vec4(uColor * g * uAmount, 1.0);
    }`,
    { uColor: { value: circuitColor.clone() }, uAmount: { value: 0 } },
  );
  const glow = new THREE.Mesh(new THREE.PlaneGeometry(s * 1.9, s * 1.9), glowMat);
  glow.renderOrder = 5;
  glow.frustumCulled = false;
  group.add(glow);

  // depth proxy: an invisible box drawn last that writes the cube's depth, so
  // depth of field treats the (transparent) cube as the in-focus subject
  const depthMat = new THREE.MeshBasicMaterial({ colorWrite: false, transparent: true });
  const depthBox = new THREE.Mesh(new THREE.BoxGeometry(s, s, s), depthMat);
  depthBox.renderOrder = 100;
  group.add(depthBox);

  // --- edge frame (12 edges, drawn on) -----------------------------------------
  const edgeMat = new THREE.MeshBasicMaterial({ color: circuitColor.clone(), toneMapped: false });
  const edgeT = 0.012;
  const edgeGeo = new THREE.BoxGeometry(1, 1, 1);
  edgeGeo.translate(0.5, 0, 0); // grows from its start along +X
  type Edge = { mesh: THREE.Mesh; from: THREE.Vector3; dir: THREE.Vector3; len: number };
  const mkEdge = (from: THREE.Vector3, to: THREE.Vector3): Edge => {
    const mesh = new THREE.Mesh(edgeGeo, edgeMat);
    const dir = to.clone().sub(from);
    const len = dir.length();
    dir.normalize();
    mesh.position.copy(from);
    mesh.quaternion.setFromUnitVectors(new THREE.Vector3(1, 0, 0), dir);
    mesh.renderOrder = 6;
    group.add(mesh);
    return { mesh, from, dir, len };
  };
  const c = (x: number, y: number, z: number) => new THREE.Vector3(x * h, y * h, z * h);
  const bottom = [
    mkEdge(c(-1, -1, 1), c(1, -1, 1)),
    mkEdge(c(1, -1, 1), c(1, -1, -1)),
    mkEdge(c(1, -1, -1), c(-1, -1, -1)),
    mkEdge(c(-1, -1, -1), c(-1, -1, 1)),
  ];
  const vertical = [
    mkEdge(c(-1, -1, 1), c(-1, 1, 1)),
    mkEdge(c(1, -1, 1), c(1, 1, 1)),
    mkEdge(c(1, -1, -1), c(1, 1, -1)),
    mkEdge(c(-1, -1, -1), c(-1, 1, -1)),
  ];
  const top = [
    mkEdge(c(-1, 1, 1), c(1, 1, 1)),
    mkEdge(c(1, 1, 1), c(1, 1, -1)),
    mkEdge(c(1, 1, -1), c(-1, 1, -1)),
    mkEdge(c(-1, 1, -1), c(-1, 1, 1)),
  ];
  const setEdges = (edges: Edge[], progress: number, sequential: boolean) => {
    edges.forEach((e, i) => {
      const pr = sequential ? Math.min(1, Math.max(0, progress * edges.length - i)) : progress;
      e.mesh.visible = pr > 0.0005;
      e.mesh.scale.set(Math.max(1e-4, e.len * pr), edgeT, edgeT);
    });
  };
  // corner sparks: small bright dots where edges are being drawn
  const sparkGeo = new THREE.SphereGeometry(edgeT * 1.9, 12, 8);
  const sparks = [...bottom, ...vertical, ...top].map(() => {
    const m = new THREE.Mesh(sparkGeo, edgeMat);
    m.renderOrder = 6;
    group.add(m);
    return m;
  });

  // --- glowing square on the palm (parented to the palm by the caller) ---------
  const square = new THREE.Group();
  const squareMat = additive(
    /* glsl */ `
    out vec2 vUv;
    void main() { vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }`,
    /* glsl */ `
    precision highp float;
    uniform vec3 uColor;
    uniform float uAmount;
    uniform float uEdge;
    in vec2 vUv;
    out vec4 outColor;
    void main() {
      vec2 q = abs(vUv - 0.5) * 2.0; // 0 centre .. 1 edge of the inner square (plane is 1.6x)
      float sq = max(q.x, q.y) * 1.6;
      float inside = 1.0 - smoothstep(0.97, 1.0, sq);
      float edge = exp(-pow((sq - 1.0) / 0.025, 2.0));
      float pool = exp(-sq * sq * 1.4);
      float v = inside * 0.35 + edge * 1.6 * uEdge + pool * 0.6;
      outColor = vec4(uColor * v * uAmount, 1.0);
    }`,
    { uColor: { value: circuitColor.clone() }, uAmount: { value: 0 }, uEdge: { value: 1 } },
  );
  const squareMesh = new THREE.Mesh(new THREE.PlaneGeometry(s * 1.6, s * 1.6), squareMat);
  squareMesh.rotation.x = -Math.PI / 2;
  squareMesh.renderOrder = 2;
  square.add(squareMesh);

  const update = (st: CubeState) => {
    setEdges(bottom, st.edgeBottom, true);
    setEdges(vertical, st.edgeVertical, false);
    setEdges(top, st.edgeTop, true);
    // sparks sit at the growing tip of each edge while it draws
    [...bottom, ...vertical, ...top].forEach((e, i) => {
      const grp = i < 4 ? bottom : i < 8 ? vertical : top;
      const prog = i < 4 ? st.edgeBottom : i < 8 ? st.edgeVertical : st.edgeTop;
      const k = i % 4;
      const pr = grp === vertical ? prog : Math.min(1, Math.max(0, prog * 4 - k));
      const sp = sparks[i];
      sp.visible = pr > 0.001 && pr < 0.999;
      sp.position.copy(e.from).addScaledVector(e.dir, e.len * pr);
    });
    glassMat.opacity = st.glass;
    glassMat.transmission = 0.6 * st.glass;
    glass.visible = st.glass > 0.001;
    depthBox.visible = st.glass > 0.001;
    rimMat.uniforms.uAmount.value = E * st.glass * (0.8 + 0.6 * st.innerGlow);
    faces.forEach((m) => {
      m.uniforms.uReveal.value = st.circuit;
      m.uniforms.uTime.value = st.t;
      m.uniforms.uGlass.value = st.glass;
      m.uniforms.uGlow.value = st.innerGlow;
      m.uniforms.uColor.value.copy(circuitColor).multiplyScalar(E);
    });
    edgeMat.color.copy(circuitColor).lerp(WHITE, 0.15).multiplyScalar(E * (1.5 + 0.8 * st.innerGlow + 2.0 * st.aiFlash));
    textMat.uniforms.uAmount.value = E * st.aiOn * (1.0 + 3.0 * st.aiFlash);
    glowMat.uniforms.uAmount.value = E * (0.15 * st.squareGlow + 0.06 * st.innerGlow + 0.5 * st.aiFlash);
    squareMat.uniforms.uAmount.value = E * st.squareGlow * (1.0 - 0.82 * st.glass);
    squareMat.uniforms.uEdge.value = 1 - 0.6 * st.glass;
  };

  return { group, square, update };
};
