import {
  Color,
  DirectionalLight,
  Euler,
  ExtrudeGeometry,
  Group,
  Mesh,
  MeshBasicMaterial,
  MeshPhysicalMaterial,
  PerspectiveCamera,
  PlaneGeometry,
  PMREMGenerator,
  Quaternion,
  Raycaster,
  Scene,
  Shape,
  ShapeGeometry,
  SphereGeometry,
  BackSide,
  Vector2,
  Vector3,
  Texture,
  WebGLRenderer,
} from "three";
import { FONT } from "../lib/assets";
import { canvasTexture, heightToNormal, makeCanvas, roundRect } from "../lib/canvas";
import { clamp01, easeInOutCubic, easeOutBack, easeOutCubic, lerp, prog, smoothstep } from "../lib/ease";
import { landGrid } from "../lib/geo";
import { LookFactory } from "../lib/LookCanvas";
import { attr, makeBackground, makeDots, makeSegments, makeTexPlane } from "../lib/materials";
import { defaultPost } from "../lib/postfx";
import { mulberry32, SEEDS } from "../lib/rand";

export interface PaymentParams {
  /** Card body colour (hex). */
  body: string;
  /** Text colour on the card face. */
  text: string;
  /** "black": matte black body, silver embossed text. "gold": brushed gold body, dark text. */
  finish: "black" | "gold";
  chip: "gold" | "silver";
  /** Node ring colour. */
  accent: string;
}

// Card: ISO/IEC 7810 ID-1, 85.6 × 54 mm. 1 world unit = 1 cm.
const CW = 8.56;
const CH = 5.398;
const CR = 0.32;
const CT = 0.1; // thickness (slightly exaggerated so the edge reads)
const FLOAT_Y = 0.24;
const CARD_YAW = -0.5;

const TW = 2048;
const TH = Math.round((TW * CH) / CW);

/** Card face: albedo, height (→ normal) and roughness/metalness maps. */
const buildCardMaps = (p: PaymentParams, gl: WebGLRenderer) => {
  const gold = p.finish === "gold";
  const r = mulberry32(SEEDS.payment + 7);
  const albedo = makeCanvas(TW, TH);
  const height = makeCanvas(TW, TH);
  const rm = makeCanvas(TW, TH); // G = roughness, B = metalness

  // Body
  const a = albedo.ctx;
  a.fillStyle = p.body;
  a.fillRect(0, 0, TW, TH);
  const hctx = height.ctx;
  hctx.fillStyle = "#000";
  hctx.fillRect(0, 0, TW, TH);
  const m = rm.ctx;
  m.fillStyle = gold ? "rgb(255, 92, 255)" : "rgb(255, 70, 0)";
  m.fillRect(0, 0, TW, TH);
  if (gold) {
    // brushed streaks: thin horizontal lines in albedo + roughness
    for (let i = 0; i < 2600; i++) {
      const y = r() * TH;
      const x = r() * TW * 1.2 - TW * 0.1;
      const len = 200 + r() * 900;
      const v = r();
      a.strokeStyle = v > 0.5 ? `rgba(255,236,190,${0.05 + r() * 0.07})` : `rgba(90,60,10,${0.05 + r() * 0.08})`;
      a.lineWidth = 0.6 + r() * 1.4;
      a.beginPath();
      a.moveTo(x, y);
      a.lineTo(x + len, y + (r() - 0.5) * 2);
      a.stroke();
      m.strokeStyle = `rgba(255,${70 + r() * 50},255,0.35)`;
      m.lineWidth = 1;
      m.beginPath();
      m.moveTo(x, y);
      m.lineTo(x + len, y);
      m.stroke();
    }
    const g = a.createLinearGradient(0, 0, TW, TH);
    g.addColorStop(0, "rgba(255,240,200,0.18)");
    g.addColorStop(0.5, "rgba(0,0,0,0)");
    g.addColorStop(1, "rgba(60,40,0,0.2)");
    a.fillStyle = g;
    a.fillRect(0, 0, TW, TH);
  } else {
    // very faint fine grain on the matte black body
    for (let i = 0; i < 9000; i++) {
      a.fillStyle = `rgba(255,255,255,${r() * 0.025})`;
      a.fillRect(r() * TW, r() * TH, 2, 2);
    }
  }

  // Chip (left, upper half)
  const cx = TW * 0.115;
  const cy = TH * 0.27;
  const cw = TW * 0.15;
  const ch = TH * 0.22;
  const chipGold = p.chip === "gold";
  const cg = a.createLinearGradient(cx, cy, cx + cw, cy + ch);
  if (chipGold) {
    cg.addColorStop(0, "#FBE7A0");
    cg.addColorStop(0.5, "#E8C46A");
    cg.addColorStop(1, "#D0A44C");
  } else {
    cg.addColorStop(0, "#F2F3F5");
    cg.addColorStop(0.5, "#C5C9CF");
    cg.addColorStop(1, "#9EA3AA");
  }
  roundRect(a, cx, cy, cw, ch, TW * 0.016);
  a.fillStyle = cg;
  a.fill();
  roundRect(m, cx, cy, cw, ch, TW * 0.016);
  m.fillStyle = "rgb(255, 90, 150)";
  m.fill();
  roundRect(hctx, cx, cy, cw, ch, TW * 0.016);
  hctx.fillStyle = "#606060";
  hctx.fill();
  // contact pad engraving
  const lines: [number, number, number, number][] = [
    [cx + cw * 0.36, cy, cx + cw * 0.36, cy + ch],
    [cx + cw * 0.64, cy, cx + cw * 0.64, cy + ch],
    [cx, cy + ch * 0.34, cx + cw * 0.36, cy + ch * 0.34],
    [cx, cy + ch * 0.66, cx + cw * 0.36, cy + ch * 0.66],
    [cx + cw * 0.64, cy + ch * 0.34, cx + cw, cy + ch * 0.34],
    [cx + cw * 0.64, cy + ch * 0.66, cx + cw, cy + ch * 0.66],
    [cx + cw * 0.36, cy + ch * 0.5, cx + cw * 0.64, cy + ch * 0.5],
  ];
  for (const [x0, y0, x1, y1] of lines) {
    for (const [ctx, style, w] of [
      [a, chipGold ? "rgba(150,105,30,0.12)" : "rgba(90,95,105,0.15)", 3],
      [hctx, "#202020", 6],
    ] as const) {
      ctx.strokeStyle = style;
      ctx.lineWidth = w;
      ctx.beginPath();
      ctx.moveTo(x0, y0);
      ctx.lineTo(x1, y1);
      ctx.stroke();
    }
  }

  // Embossed text
  const text = (s: string, x: number, y: number, size: number, font: string, align: CanvasTextAlign, spacing = 0) => {
    for (const ctx of [a, hctx, m]) {
      ctx.font = `${font === FONT.card ? 500 : 600} ${size}px "${font}"`;
      ctx.textAlign = align;
      ctx.textBaseline = "alphabetic";
      (ctx as CanvasRenderingContext2D & { letterSpacing: string }).letterSpacing = `${spacing}px`;
    }
    // albedo with a soft shadow + highlight to suggest relief
    a.fillStyle = gold ? "rgba(255,240,200,0.35)" : "rgba(0,0,0,0.6)";
    a.fillText(s, x + size * 0.025, y + size * 0.03);
    if (gold) {
      a.fillStyle = p.text;
    } else {
      const tg = a.createLinearGradient(0, y - size, 0, y);
      tg.addColorStop(0, "#D4D8DD");
      tg.addColorStop(0.55, "#9DA3AB");
      tg.addColorStop(1, "#C3C8CE");
      a.fillStyle = tg;
    }
    a.fillText(s, x, y);
    hctx.fillStyle = "#FFFFFF";
    hctx.fillText(s, x, y);
    m.fillStyle = gold ? "rgb(255, 150, 0)" : "rgb(255, 80, 40)";
    m.fillText(s, x, y);
  };
  text("1234 5678 9101 1234", TW * 0.08, TH * 0.64, TH * 0.098, FONT.card, "left", TH * 0.006);
  text("00/00", TW * 0.5, TH * 0.83, TH * 0.07, FONT.card, "left", TH * 0.006);
  text("BANK", TW * 0.915, TH * 0.235, TH * 0.1, FONT.inter, "right", TH * 0.012);

  // Soften the height map a little so the relief has bevels, then derive normals.
  const blurred = makeCanvas(TW, TH);
  blurred.ctx.filter = "blur(2.5px)";
  blurred.ctx.drawImage(height.c, 0, 0);
  const normal = heightToNormal(blurred.c, 3.2);

  return {
    map: canvasTexture(albedo.c, gl),
    normalMap: canvasTexture(normal, gl, { srgb: false }),
    rmMap: canvasTexture(rm.c, gl, { srgb: false }),
  };
};

/** Simple studio environment for the card reflections (soft boxes on a dark dome). */
const buildEnvironment = (gl: WebGLRenderer) => {
  const env = new Scene();
  const dome = new Mesh(
    new SphereGeometry(50, 32, 16),
    new MeshBasicMaterial({ color: new Color("#05070d"), side: BackSide }),
  );
  env.add(dome);
  const box = (w: number, h: number, pos: Vector3, c: string, k: number) => {
    const mesh = new Mesh(
      new PlaneGeometry(w, h),
      new MeshBasicMaterial({ color: new Color(c).multiplyScalar(k), side: 2 }),
    );
    mesh.position.copy(pos);
    mesh.lookAt(0, 0, 0);
    env.add(mesh);
  };
  box(30, 14, new Vector3(-14, 26, 18), "#ffffff", 5); // key soft box, upper front-left
  box(6, 34, new Vector3(30, 14, -8), "#cfe0ff", 2.2); // strip, right
  box(40, 8, new Vector3(0, -6, 40), "#2a6cff", 0.9); // blue bounce from the map, front
  box(20, 20, new Vector3(0, 45, -10), "#ffffff", 1.2); // top fill
  const pmrem = new PMREMGenerator(gl);
  const rt = pmrem.fromScene(env, 0.02);
  pmrem.dispose();
  return rt.texture;
};

const cardGeometry = () => {
  const s = new Shape();
  const x0 = -CW / 2;
  const y0 = -CH / 2;
  s.moveTo(x0 + CR, y0);
  s.lineTo(x0 + CW - CR, y0);
  s.quadraticCurveTo(x0 + CW, y0, x0 + CW, y0 + CR);
  s.lineTo(x0 + CW, y0 + CH - CR);
  s.quadraticCurveTo(x0 + CW, y0 + CH, x0 + CW - CR, y0 + CH);
  s.lineTo(x0 + CR, y0 + CH);
  s.quadraticCurveTo(x0, y0 + CH, x0, y0 + CH - CR);
  s.lineTo(x0, y0 + CR);
  s.quadraticCurveTo(x0, y0, x0 + CR, y0);
  const bevel = 0.025;
  const body = new ExtrudeGeometry(s, {
    depth: CT - bevel * 2,
    bevelEnabled: true,
    bevelThickness: bevel,
    bevelSize: bevel,
    bevelSegments: 3,
    curveSegments: 10,
  });
  body.translate(0, 0, -(CT - bevel * 2) / 2);
  const face = new ShapeGeometry(s, 10);
  const uv = face.attributes.uv;
  const pos = face.attributes.position;
  for (let i = 0; i < uv.count; i++) {
    uv.setXY(i, (pos.getX(i) - x0) / CW, (pos.getY(i) - y0) / CH);
  }
  face.translate(0, 0, CT / 2 + 0.002);
  return { body, face };
};

/** Node disc texture: glowing ring + symbol (or bank icon). */
const nodeTexture = (symbol: string, gl: WebGLRenderer) => {
  const S = 512;
  const { c, ctx } = makeCanvas(S, S);
  ctx.clearRect(0, 0, S, S);
  const cx = S / 2;
  // outer ring
  ctx.strokeStyle = "rgba(255,255,255,1)";
  ctx.lineWidth = S * 0.045;
  ctx.beginPath();
  ctx.arc(cx, cx, S * 0.42, 0, Math.PI * 2);
  ctx.stroke();
  // faint inner ring
  ctx.strokeStyle = "rgba(255,255,255,0.0)";
  ctx.lineWidth = S * 0.012;
  ctx.beginPath();
  ctx.arc(cx, cx, S * 0.33, 0, Math.PI * 2);
  ctx.stroke();
  ctx.fillStyle = "rgba(255,255,255,1)";
  if (symbol === "bank") {
    const w = S * 0.36;
    const x = cx - w / 2;
    const top = cx - S * 0.16;
    // pediment
    ctx.beginPath();
    ctx.moveTo(cx, top);
    ctx.lineTo(x + w + S * 0.02, top + S * 0.09);
    ctx.lineTo(x - S * 0.02, top + S * 0.09);
    ctx.closePath();
    ctx.fill();
    ctx.fillRect(x, top + S * 0.11, w, S * 0.025);
    // columns
    for (let i = 0; i < 4; i++) {
      const colX = x + S * 0.025 + i * ((w - S * 0.09) / 3);
      ctx.fillRect(colX, top + S * 0.15, S * 0.04, S * 0.13);
    }
    ctx.fillRect(x, top + S * 0.29, w, S * 0.03);
    ctx.fillRect(x - S * 0.03, top + S * 0.335, w + S * 0.06, S * 0.03);
  } else {
    ctx.font = `700 ${S * 0.46}px "${FONT.inter}"`;
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText(symbol, cx, cx + S * 0.015);
  }
  return canvasTexture(c, gl);
};

/** Dark disc under each node (alpha), so lines and map stop at the ring. */
const discTexture = (gl: WebGLRenderer) => {
  const S = 256;
  const { c, ctx } = makeCanvas(S, S);
  const g = ctx.createRadialGradient(S / 2, S / 2, 0, S / 2, S / 2, S / 2);
  g.addColorStop(0, "rgba(2,10,30,0.92)");
  g.addColorStop(0.78, "rgba(2,10,30,0.92)");
  g.addColorStop(0.84, "rgba(2,10,30,0)");
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, S, S);
  return canvasTexture(c, gl);
};

const shadowTexture = (gl: WebGLRenderer) => {
  const W = 512;
  const H = 340;
  const { c, ctx } = makeCanvas(W, H);
  ctx.filter = "blur(26px)";
  ctx.fillStyle = "rgba(0,0,0,0.85)";
  roundRect(ctx, 70, 70, W - 140, H - 140, 30);
  ctx.fill();
  return canvasTexture(c, gl);
};

// Final camera (after the settle). Elevation 35°.
const CAM_DIST = 32;
const CAM_EL = (38 * Math.PI) / 180;
const TARGET = new Vector3(0.15, 0, 0.35);

const finalCamera = (aspect: number) => {
  const cam = new PerspectiveCamera(22, aspect, 0.5, 300);
  cam.position.set(TARGET.x, TARGET.y + CAM_DIST * Math.sin(CAM_EL), TARGET.z + CAM_DIST * Math.cos(CAM_EL));
  cam.lookAt(TARGET);
  cam.updateMatrixWorld();
  return cam;
};

/** NDC on the final framing → point on the map plane. */
const groundAt = (cam: PerspectiveCamera, x: number, y: number) => {
  const rc = new Raycaster();
  rc.setFromCamera(new Vector2(x, y), cam);
  const t = -rc.ray.origin.y / rc.ray.direction.y;
  return rc.ray.origin.clone().addScaledVector(rc.ray.direction, t);
};

// Node layout in screen space of the final framing (mirrors the reference composition).
const NODES: { sym: string; ndc: [number, number] }[] = [
  { sym: "$", ndc: [-0.84, 0.31] },
  { sym: "¥", ndc: [-0.49, 0.55] },
  { sym: "£", ndc: [-0.15, 0.62] },
  { sym: "€", ndc: [0.47, 0.27] },
  { sym: "¥", ndc: [0.73, -0.09] },
  { sym: "฿", ndc: [0.56, -0.57] },
  { sym: "bank", ndc: [-0.33, -0.62] },
  { sym: "₹", ndc: [-0.65, -0.19] },
];

const NODE_R = 0.78; // node disc radius (world)
const T_LINES = 5.3; // first line starts growing (s)
const WAVE_TIMES = [10.6, 15.6];

export const paymentNetwork: LookFactory<PaymentParams> = ({ gl, assets, shared, params, width, height }) => {
  const opaque = new Scene();
  const overlay = new Scene();
  const aspect = width / height;
  const camera = finalCamera(aspect);
  const camFinal = finalCamera(aspect);
  const rng = mulberry32(SEEDS.payment);

  // ── Background: navy with a brighter blue pool lower-left ──────────────────
  opaque.add(
    makeBackground(
      /* glsl */ `
      vec3 navy = vec3(0.0006, 0.0037, 0.0232);
      vec3 blue = vec3(0.006, 0.03, 0.16);
      float pool = exp(-pow(length((vUv - vec2(0.05, 0.08)) * vec2(1.0, 1.5)), 2.0) * 5.0);
      float top = smoothstep(0.55, 1.0, vUv.y);
      col = mix(navy, blue, pool * 0.9) * (1.0 - top * 0.55) * (1.0 - 0.45 * smoothstep(0.5, 1.0, vUv.x) * smoothstep(0.3, 1.0, vUv.y));
      `,
      {},
      shared,
    ),
  );

  // ── Card ───────────────────────────────────────────────────────────────────
  opaque.environment = buildEnvironment(gl);
  opaque.environmentIntensity = params.finish === "gold" ? 1.1 : 1.5;
  const maps = buildCardMaps(params, gl);
  const { body, face } = cardGeometry();
  const gold = params.finish === "gold";
  const bodyMat = new MeshPhysicalMaterial({
    color: new Color(params.body).multiplyScalar(gold ? 1 : 1.6),
    roughness: gold ? 0.3 : 0.2,
    metalness: gold ? 1 : 0.2,
    clearcoat: gold ? 0.2 : 0.5,
    clearcoatRoughness: 0.2,
  });
  const faceMat = new MeshPhysicalMaterial({
    map: maps.map,
    normalMap: maps.normalMap,
    normalScale: new Vector2(1, 1),
    roughnessMap: maps.rmMap,
    metalnessMap: maps.rmMap,
    roughness: 1,
    metalness: 1,
    clearcoat: gold ? 0.25 : 0.55,
    clearcoatRoughness: gold ? 0.3 : 0.16,
    anisotropy: gold ? 0.75 : 0,
    anisotropyRotation: 0,
  });
  const card = new Group();
  const cardInner = new Group(); // card built in XY, face +Z → laid flat by rotating -90° about X
  cardInner.rotation.x = -Math.PI / 2;
  cardInner.add(new Mesh(body, bodyMat));
  cardInner.add(new Mesh(face, faceMat));
  card.add(cardInner);
  opaque.add(card);
  const key = new DirectionalLight(0xffffff, 0.6);
  key.position.set(-6, 12, 8);
  opaque.add(key);

  // ── Map: Natural Earth land as fine dots on the plane ─────────────────────
  const MAP_K = 0.17; // world units per degree
  const MAP_LON0 = 8; // lon/lat under the card
  const MAP_LAT0 = 30;
  const grid = landGrid(assets, 0.42, { minLat: -58, maxLat: 80 });
  const mapPos: number[] = [];
  for (let i = 0; i < grid.length; i += 2) {
    const x = (grid[i] - MAP_LON0) * MAP_K;
    const z = -(grid[i + 1] - MAP_LAT0) * MAP_K;
    if (Math.abs(x) > 30 + Math.max(0, -z) * 0.9 || z < -36 || z > 14) continue;
    mapPos.push(x, 0, z);
  }
  const mapDots = makeDots({
    count: mapPos.length / 3,
    attrs: { iPos: attr(3, mapPos) },
    shared,
    uniforms: { uReveal: { value: 0 }, uMapCol: { value: new Color("#1A3A6A") } },
    hook: /* glsl */ `
      sizeW = 0.038;
      float r = length(pos.xz);
      float rev = smoothstep(uReveal, uReveal - 5.0, r);
      // fade toward the far/top and right of frame (dark corners as in the reference)
      float far = smoothstep(-30.0, -8.0, pos.z) * smoothstep(30.0, 14.0, abs(pos.x)) * mix(1.0, 0.45, smoothstep(0.0, 22.0, pos.x - pos.z * 0.5));
      col = uMapCol * 0.6;
      alpha = rev * far;
      minPx = 1.0;
    `,
  });
  mapDots.name = "map";
  overlay.add(mapDots);

  // Shadow under the card (premultiplied alpha → darkens map + lines)
  const shadow = makeTexPlane({
    map: shadowTexture(gl),
    shared,
    width: CW * 1.35,
    height: CH * 1.5,
    blending: "alpha",
    opacity: 0,
  });
  shadow.rotation.x = -Math.PI / 2;
  shadow.position.y = 0.01;
  shadow.renderOrder = 2;
  shadow.name = "shadow";
  overlay.add(shadow);

  // ── Circuit lines: right-angle routes from under the card to each node ────
  type Path = { pts: [number, number][]; t0: number; dur: number; node: number };
  const paths: Path[] = [];
  const nodePos = NODES.map((n) => groundAt(camFinal, n.ndc[0], n.ndc[1]));
  const cardDir = (dx: number, dz: number) => {
    // a start point well under the card, toward the node
    const l = Math.hypot(dx, dz);
    return [(dx / l) * 2.2, (dz / l) * 1.4] as [number, number];
  };
  nodePos.forEach((np, i) => {
    const [sx, sz] = cardDir(np.x, np.z);
    const horizontalFirst = Math.abs(np.x) > Math.abs(np.z) * 1.1;
    const f = 0.35 + rng() * 0.3;
    // stop at the ring edge
    let ex = np.x;
    let ez = np.z;
    let pts: [number, number][];
    if (horizontalFirst) {
      const mx = lerp(sx, np.x, f);
      ex = np.x - Math.sign(np.x - mx) * NODE_R * 0.86;
      pts = [
        [sx, sz],
        [mx, sz],
        [mx, np.z],
        [ex, np.z],
      ];
    } else {
      const mz = lerp(sz, np.z, f);
      ez = np.z - Math.sign(np.z - mz) * NODE_R * 0.86;
      pts = [
        [sx, sz],
        [sx, mz],
        [np.x, mz],
        [np.x, ez],
      ];
    }
    paths.push({ pts, t0: T_LINES + i * 0.32, dur: 1.25, node: i });
  });
  // Stubs that run off the frame without a node (as in the reference)
  const stubs: [number, number][][] = [
    [[1.6, -1.2], [1.6, -4.6], [5.0, -4.6], [5.0, -7.5]],
    [[-1.8, 1.0], [-4.6, 1.0], [-4.6, 4.2], [-7.5, 4.2]],
    [[2.4, 0.9], [5.2, 0.9], [5.2, 3.0], [8.5, 3.0]],
    [[-0.9, -1.3], [-0.9, -5.2], [-3.0, -5.2], [-3.0, -7.6]],
  ];
  // (the reference network is sparse: every line ends at a node, so stubs stay unused)
  void stubs;

  // Polylines with rounded corners → segments with arclength
  const segA: number[] = [];
  const segB: number[] = [];
  const segS: number[] = [];
  const segP: number[] = [];
  const pathLen: number[] = [];
  const CORNER = 0.45;
  paths.forEach((p, pi) => {
    const pts: [number, number][] = [p.pts[0]];
    for (let i = 1; i < p.pts.length - 1; i++) {
      const [px, pz] = p.pts[i - 1];
      const [cx, cz] = p.pts[i];
      const [nx, nz] = p.pts[i + 1];
      const l0 = Math.hypot(cx - px, cz - pz);
      const l1 = Math.hypot(nx - cx, nz - cz);
      const r = Math.min(CORNER, l0 * 0.45, l1 * 0.45);
      const ax = cx - ((cx - px) / l0) * r;
      const az = cz - ((cz - pz) / l0) * r;
      const bx = cx + ((nx - cx) / l1) * r;
      const bz = cz + ((nz - cz) / l1) * r;
      for (let k = 0; k <= 6; k++) {
        const t = k / 6;
        // quadratic Bézier through the corner
        const x = (1 - t) * (1 - t) * ax + 2 * (1 - t) * t * cx + t * t * bx;
        const z = (1 - t) * (1 - t) * az + 2 * (1 - t) * t * cz + t * t * bz;
        pts.push([x, z]);
      }
    }
    pts.push(p.pts[p.pts.length - 1]);
    let s = 0;
    for (let i = 0; i < pts.length - 1; i++) {
      const l = Math.hypot(pts[i + 1][0] - pts[i][0], pts[i + 1][1] - pts[i][1]);
      if (l < 1e-4) continue;
      segA.push(pts[i][0], 0.02, pts[i][1]);
      segB.push(pts[i + 1][0], 0.02, pts[i + 1][1]);
      segS.push(s, s + l);
      s += l;
      segP.push(p.t0, 0, p.dur, pi);
    }
    pathLen.push(s);
  });
  // fill total path length into the attribute
  for (let i = 0; i < segP.length / 4; i++) segP[i * 4 + 1] = pathLen[segP[i * 4 + 3]];
  const lineCol = new Color("#3A9CFF").multiplyScalar(0.75);
  const lines = makeSegments({
    count: segA.length / 3,
    attrs: { iA: attr(3, segA), iB: attr(3, segB), iS: attr(2, segS), iP: attr(4, segP) },
    shared,
    capB: true,
    uniforms: { uLineCol: { value: lineCol }, uPulseCol: { value: new Color(params.accent) } },
    hook: /* glsl */ `
      widthW = 0.03;
      minPx = 1.0;
      col = uLineCol;
      data = iP;
      float rr = length(mix(a.xz, b.xz, 0.5));
      alpha = smoothstep(15.0, 8.5, rr);
    `,
    fragHook: /* glsl */ `
      float t0 = vData.x;
      float L = vData.y;
      float dur = vData.z;
      float pid = vData.w;
      float grown = clamp((uTime - t0) / dur, 0.0, 1.0);
      grown = 1.0 - pow(1.0 - grown, 2.0);
      float g = grown * L;
      if (vS > g) inten = 0.0;
      // bright growing head
      float head = exp(-max(g - vS, 0.0) * 2.2) * step(grown, 0.999);
      // pulses running outward during the hold
      float sp = 3.2;
      float spacing = 7.5 + hash11(pid * 7.13) * 4.0;
      float ph = fract((vS - (uTime - t0 - dur) * sp) / spacing + hash11(pid * 3.7));
      float pulse = smoothstep(0.82, 0.97, ph) * (1.0 - smoothstep(0.97, 1.0, ph));
      pulse *= smoothstep(t0 + dur, t0 + dur + 0.8, uTime);
      fcol = fcol * (1.0 + head * 3.0) + uPulseCol * vCol.b / max(uLineCol.b, 1e-3) * pulse * 1.6;
    `,
  });
  lines.renderOrder = 3;
  lines.name = "lines";
  overlay.add(lines);

  // ── Nodes ──────────────────────────────────────────────────────────────────
  const discTex = discTexture(gl);
  const accent = new Color(params.accent);
  const nodeArrive: number[] = [];
  const nodes = NODES.map((n, i) => {
    const p = paths[i];
    nodeArrive.push(p.t0 + p.dur * 0.92);
    const g = new Group();
    const disc = makeTexPlane({ map: discTex, shared, width: NODE_R * 2.1, height: NODE_R * 2.1, blending: "alpha" });
    disc.renderOrder = 4;
    const ring = makeTexPlane({
      map: nodeTexture(n.sym, gl),
      shared,
      width: NODE_R * 2,
      height: NODE_R * 2,
      color: accent.clone().multiplyScalar(2.0),
      fragHook: /* glsl */ `
        // symbol (inner) whiter than the ring
        float rr = length(vUv - 0.5);
        c.rgb = mix(c.rgb, c.rgb * vec3(1.6, 1.15, 1.0) * 0.75, smoothstep(0.36, 0.3, rr));
      `,
    });
    ring.renderOrder = 5;
    ring.position.y = 0.01;
    g.add(disc, ring);
    g.name = "nodes";
    g.rotation.x = -Math.PI / 2;
    g.position.set(nodePos[i].x, 0.03, nodePos[i].z);
    overlay.add(g);
    return { g, disc, ring };
  });

  // ── Contactless wave arcs (lie on the plane around the card) ──────────────
  const waveA: number[] = [];
  const waveB: number[] = [];
  const waveI: number[] = [];
  const ARC_SEG = 40;
  for (let e = 0; e < WAVE_TIMES.length; e++)
    for (let side = 0; side < 2; side++)
      for (let k = 0; k < 3; k++)
        for (let s = 0; s < ARC_SEG; s++) {
          waveA.push(0, 0, 0);
          waveB.push(0, 0, 0);
          const span = 0.72;
          const a0 = -span + (2 * span * s) / ARC_SEG;
          const a1 = -span + (2 * span * (s + 1)) / ARC_SEG;
          waveI.push(a0 + side * Math.PI, a1 + side * Math.PI, k, e);
        }
  const waves = makeSegments({
    count: waveA.length / 3,
    attrs: { iA: attr(3, waveA), iB: attr(3, waveB), iW: attr(4, waveI) },
    shared,
    uniforms: {
      uWaveT0: { value: WAVE_TIMES[0] },
      uWaveT1: { value: WAVE_TIMES[1] },
      uYaw: { value: CARD_YAW },
      uCenter: { value: new Vector3(0, 0.05, 0) },
      uWaveCol: { value: accent.clone() },
    },
    hook: /* glsl */ `
      float te = iW.w < 0.5 ? uWaveT0 : uWaveT1;
      float lt = uTime - te - iW.z * 0.22;
      float life = 1.6;
      float p = clamp(lt / life, 0.0, 1.0);
      float rad = 4.75 + p * 1.5 + iW.z * 0.32; // starts just outside the card ends
      float ang0 = iW.x + uYaw;
      float ang1 = iW.y + uYaw;
      a = uCenter + vec3(cos(ang0) * rad, 0.0, -sin(ang0) * rad * 0.82);
      b = uCenter + vec3(cos(ang1) * rad, 0.0, -sin(ang1) * rad * 0.82);
      float fade = smoothstep(0.0, 0.12, p) * (1.0 - smoothstep(0.55, 1.0, p));
      float local = iW.x > 1.6 ? iW.x - 3.14159265 : iW.x;
      float edge = cos(clamp(local / 0.72, -1.0, 1.0) * 1.5707963);
      alpha = (lt > 0.0 && lt < life) ? fade * (0.55 + 0.45 * edge) : 0.0;
      widthW = 0.045;
      col = uWaveCol * 2.8;
    `,
  });
  waves.renderOrder = 6;
  waves.name = "waves";
  overlay.add(waves);

  // ── Post / DoF ───────────────────────────────────────────────────────────
  const post = defaultPost();
  post.opaqueDof = false; // the card is always in focus; only overlay light needs blur
  post.bloomStrength = 0.85;
  post.bloomThreshold = 0.55;
  post.bloomRadius = 0.75;
  post.exposure = 1.05;
  post.vignette = 0.5;
  shared.uAperture.value = 0.015;
  shared.uMaxCoc.value = 0.01;
  shared.uNearMul.value = 1.0;
  shared.uFocusRange.value = 1.5;

  // ── Animation ────────────────────────────────────────────────────────────
  const qFinal = new Quaternion().setFromEuler(new Euler(0, CARD_YAW, 0));
  const tmpQ = new Quaternion();
  const startPos = new Vector3(-17, 9.5, -5);
  const finalPos = new Vector3(0, FLOAT_Y, 0);

  const update = (frame: number) => {
    const t = frame / 30;
    // card entry: 0–3 s fly in from upper left turning/tilting, 3–5 s settle flat
    const e = easeOutCubic(prog(t, 0, 3.0));
    const pos = new Vector3().lerpVectors(startPos, finalPos, e);
    // settle: small damped bob after arrival
    const st = prog(t, 3.0, 5.0);
    const bob = Math.sin(st * Math.PI * 2) * (1 - st) * 0.18 * smoothstep(3.0, 3.2, t);
    pos.y += bob + (1 - easeInOutCubic(st)) * 0.35 * smoothstep(2.6, 3.0, t);
    card.position.copy(pos);
    // orientation: tilted toward camera + spinning, easing to flat
    const spin = (1 - easeOutCubic(prog(t, 0, 3.2))) * 2.1;
    const tilt = (1 - easeInOutCubic(prog(t, 0.4, 4.6))) * 1.05;
    const roll = (1 - easeInOutCubic(prog(t, 0, 4.2))) * 0.55;
    const eul = new Euler(tilt, CARD_YAW + spin, roll, "YXZ");
    tmpQ.setFromEuler(eul);
    card.quaternion.copy(tmpQ.slerp(qFinal, smoothstep(4.6, 5.0, t)));

    // camera: settles from a higher, closer angle to 35° by 5 s, then slow drift
    const cs = easeInOutCubic(prog(t, 0, 5.0));
    const el = lerp((44 * Math.PI) / 180, CAM_EL, cs);
    const drift = smoothstep(5, 20, t);
    const az = lerp(-0.16, 0, cs) + Math.sin(drift * Math.PI * 0.9) * 0.06;
    const dist = lerp(CAM_DIST * 0.9, CAM_DIST, cs) - drift * 1.1;
    camera.position.set(
      TARGET.x + dist * Math.cos(el) * Math.sin(az),
      TARGET.y + dist * Math.sin(el),
      TARGET.z + dist * Math.cos(el) * Math.cos(az),
    );
    camera.lookAt(TARGET);
    camera.updateMatrixWorld();
    // focus on the card
    shared.uFocus.value = camera.position.distanceTo(card.position);

    // moving reflection
    opaque.environmentRotation.set(0.15, -0.6 + t * 0.055, 0);

    // map reveal 5–9 s
    (mapDots.material as { uniforms: Record<string, { value: number }> }).uniforms.uReveal.value =
      lerp(0, 46, easeInOutCubic(prog(t, 4.6, 9.0)));
    (shadow.material as { uniforms: Record<string, { value: number }> }).uniforms.uOpacity.value =
      smoothstep(2.4, 4.5, t) * 0.35;

    // nodes pop in as their line arrives
    nodes.forEach((n, i) => {
      const p = prog(t, nodeArrive[i], nodeArrive[i] + 0.45);
      const s = p <= 0 ? 0.0001 : lerp(0.55, 1, easeOutBack(p, 2.2));
      n.g.scale.setScalar(s);
      const o = smoothstep(0, 0.4, p);
      // gentle breathing glow in the hold
      const breathe = 1 + 0.12 * Math.sin(t * 2.2 + i * 1.7) * smoothstep(9, 10, t);
      (n.ring.material as { uniforms: Record<string, { value: number }> }).uniforms.uOpacity.value =
        o * breathe * (1 + 1.5 * Math.exp(-Math.max(0, t - nodeArrive[i]) * 4) * clamp01(p * 4));
      (n.disc.material as { uniforms: Record<string, { value: number }> }).uniforms.uOpacity.value = o;
    });
  };

  return {
    opaque,
    overlay,
    camera,
    post,
    update,
    dispose: () => {
      (opaque.environment as Texture | null)?.dispose();
    },
  };
};
