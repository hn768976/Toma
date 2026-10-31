import {
  AdditiveBlending,
  BufferAttribute,
  BufferGeometry,
  CanvasTexture,
  Color,
  Group,
  InstancedBufferAttribute,
  InstancedBufferGeometry,
  LinearFilter,
  LinearMipmapLinearFilter,
  Mesh,
  PerspectiveCamera,
  PlaneGeometry,
  Points,
  Scene,
  ShaderMaterial,
  SphereGeometry,
  SRGBColorSpace,
  Sprite,
  SpriteMaterial,
  Vector2,
  Vector3,
  WebGLRenderTarget,
  HalfFloatType,
} from "three";
import { EffectComposer } from "three/examples/jsm/postprocessing/EffectComposer.js";
import { OutputPass } from "three/examples/jsm/postprocessing/OutputPass.js";
import { RenderPass } from "three/examples/jsm/postprocessing/RenderPass.js";
import { UnrealBloomPass } from "three/examples/jsm/postprocessing/UnrealBloomPass.js";
import { LineMaterial } from "three/examples/jsm/lines/LineMaterial.js";
import { LineSegments2 } from "three/examples/jsm/lines/LineSegments2.js";
import { LineSegmentsGeometry } from "three/examples/jsm/lines/LineSegmentsGeometry.js";
import { staticFile } from "remotion";
import type { SceneFactory } from "../three/ThreeStage";
import { clamp, loadFont, makeRandom, smoothstep } from "../three/util";
import type { GlobeConfig } from "./config";
import { buildLandMask } from "./landMask";
import {
  atmoFragment,
  atmoVertex,
  digitFragment,
  digitVertex,
  labelFragment,
  labelVertex,
  pointFragment,
  pointVertex,
} from "./shaders";

const DEG = Math.PI / 180;
const FONT = "ShareTechMono";

/** 4-cell glyph atlas: sharp "0", sharp "1", blurred "0", blurred "1". */
const makeDigitAtlas = () => {
  const cw = 160;
  const ch = 256;
  const canvas = document.createElement("canvas");
  canvas.width = cw * 4;
  canvas.height = ch;
  const ctx = canvas.getContext("2d")!;
  ctx.clearRect(0, 0, canvas.width, canvas.height);
  ctx.fillStyle = "#fff";
  ctx.strokeStyle = "#fff";
  // Squared "digital readout" glyphs, drawn as geometry so they stay crisp.
  const drawGlyph = (g: number, x0: number) => {
    const gw = cw * 0.56;
    const gh = ch * 0.74;
    const x = x0 + (cw - gw) / 2;
    const y = (ch - gh) / 2;
    const stroke = gw * 0.26;
    if (g === 0) {
      ctx.lineWidth = stroke;
      const r = stroke * 0.5;
      const ix = x + stroke / 2;
      const iy = y + stroke / 2;
      const iw = gw - stroke;
      const ih = gh - stroke;
      ctx.beginPath();
      ctx.moveTo(ix + r, iy);
      ctx.arcTo(ix + iw, iy, ix + iw, iy + ih, r);
      ctx.arcTo(ix + iw, iy + ih, ix, iy + ih, r);
      ctx.arcTo(ix, iy + ih, ix, iy, r);
      ctx.arcTo(ix, iy, ix + iw, iy, r);
      ctx.closePath();
      ctx.stroke();
    } else {
      const bx = x + gw * 0.5 - stroke * 0.3;
      ctx.fillRect(bx, y, stroke * 1.05, gh);
      ctx.fillRect(bx - gw * 0.28, y, gw * 0.3, stroke * 0.85);
    }
  };
  [0, 1, 0, 1].forEach((g, i) => {
    ctx.save();
    if (i >= 2) ctx.filter = "blur(14px)";
    drawGlyph(g, cw * i);
    if (i >= 2) {
      // Blurred glyphs keep their energy: draw twice for a bokeh-like core.
      ctx.globalAlpha = 0.6;
      drawGlyph(g, cw * i);
    }
    ctx.restore();
  });
  const tex = new CanvasTexture(canvas);
  tex.generateMipmaps = true;
  tex.minFilter = LinearMipmapLinearFilter;
  tex.magFilter = LinearFilter;
  tex.anisotropy = 4;
  return tex;
};

const makeBackground = (center: string, edge: string) => {
  const c = document.createElement("canvas");
  c.width = 1024;
  c.height = 576;
  const ctx = c.getContext("2d")!;
  const g = ctx.createRadialGradient(512, 250, 0, 512, 250, 640);
  g.addColorStop(0, center);
  g.addColorStop(0.55, edge);
  g.addColorStop(1, edge);
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, c.width, c.height);
  const tex = new CanvasTexture(c);
  tex.colorSpace = SRGBColorSpace;
  return tex;
};

const makeHaloTexture = (color: string) => {
  const c = document.createElement("canvas");
  c.width = c.height = 512;
  const ctx = c.getContext("2d")!;
  const g = ctx.createRadialGradient(256, 256, 0, 256, 256, 256);
  // Globe edge sits at r = 1 / 1.9 of the sprite radius.
  g.addColorStop(0, "rgba(0,0,0,0)");
  g.addColorStop(0.45, color + "10");
  g.addColorStop(0.53, color + "30");
  g.addColorStop(0.6, color + "14");
  g.addColorStop(0.8, color + "05");
  g.addColorStop(1, "rgba(0,0,0,0)");
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, 512, 512);
  const tex = new CanvasTexture(c);
  tex.colorSpace = SRGBColorSpace;
  return tex;
};

const latLonToVec = (latDeg: number, lonDeg: number, r: number) => {
  const lat = latDeg * DEG;
  const lon = lonDeg * DEG;
  return new Vector3(
    r * Math.cos(lat) * Math.sin(lon),
    r * Math.sin(lat),
    r * Math.cos(lat) * Math.cos(lon),
  );
};

export const createGlobeScene =
  (config: GlobeConfig): SceneFactory =>
  async (ctx) => {
    const { renderer, width, height, pixelRatio, pxScale, fps } = ctx;
    const pal = config.palette;
    await loadFont(FONT, staticFile("fonts/ShareTechMono-Regular.woff2"));

    const rand = makeRandom(20241031);
    const land = buildLandMask();
    const atlas = makeDigitAtlas();

    const scene = new Scene();
    scene.background = makeBackground(pal.bgCenter, pal.bgEdge);

    const camera = new PerspectiveCamera(30, width / height, 0.002, 200);

    const colDeep = new Color(pal.deep);
    const colMain = new Color(pal.main);
    const colHot = new Color(pal.hot);
    const colRim = new Color(pal.rim);

    // Globe group: tilt (fixed) > spin (animated).
    const tilt = new Group();
    tilt.rotation.z = -10 * DEG;
    scene.add(tilt);
    const globe = new Group();
    tilt.add(globe);

    /* ---------------------------------------------------------------- */
    /* Surface + data-panel digits                                       */
    /* ---------------------------------------------------------------- */
    const pos: number[] = [];
    const data: number[] = [];
    const kind: number[] = [];
    const STEP = 0.75;
    const EQ_COUNT = Math.round(360 / STEP);
    for (let lat = -84; lat <= 84; lat += STEP) {
      const count = Math.max(6, Math.round(EQ_COUNT * Math.cos(lat * DEG)));
      const offset = rand() * 360;
      for (let i = 0; i < count; i++) {
        const lon = ((offset + (i * 360) / count) % 360) - 180;
        const isLand = land.isLand(lon, lat);
        if (!isLand && rand() > 0.3) continue;
        const coast = isLand && land.isCoast(lon, lat);
        const p = latLonToVec(lat, lon, 1.0);
        pos.push(p.x, p.y, p.z);
        const level = coast
          ? 0.82 + rand() * 0.18
          : isLand
            ? 0.46 + rand() * 0.3
            : 0.06 + rand() * 0.22;
        data.push(rand(), level, isLand ? 1 : 0.85, rand() * 0.35);
        kind.push(0);
      }
    }

    // Floating binary panels on a shell just above the surface. The first
    // one sits over central Africa, in front of the lens during the dive.
    const panelDefs: [number, number, number, number][] = [
      // lat, lon, rows, groups
      [6, 14, 10, 4],
      [-28, 60, 9, 2],
      [22, -60, 6, 3],
      [-18, -120, 8, 2],
      [30, 120, 7, 3],
      [-34, 170, 6, 2],
      [12, -170, 9, 2],
      [-8, -30, 6, 2],
      [40, 30, 5, 2],
      [-40, -75, 7, 2],
      [18, 75, 6, 2],
      // Tall bands on the flanks of Africa (visible at 2.7-4 s).
      [8, -52, 14, 2],
      [-14, -58, 12, 2],
      [6, 92, 14, 2],
      [-16, 86, 12, 2],
      [-30, 28, 6, 3],
    ];
    panelDefs.forEach(([lat0, lon0, rows, groups], pi) => {
      const r = 1.09 + (pi % 3) * 0.025;
      const c = latLonToVec(lat0, lon0, 1).normalize();
      const refUp = new Vector3(0, 1, 0);
      const east = new Vector3().crossVectors(refUp, c).normalize();
      const north = new Vector3().crossVectors(c, east).normalize();
      const pitchX = 0.0118;
      const pitchY = 0.026;
      const cols = groups * 8 + (groups - 1) * 3;
      for (let row = 0; row < rows; row++) {
        const rowSeed = rand();
        for (let col = 0; col < cols; col++) {
          const inGroup = col % 11 < 8;
          if (!inGroup) continue;
          const u = (col - cols / 2) * pitchX;
          const v = (rows / 2 - row) * pitchY;
          const p = c
            .clone()
            .addScaledVector(east, u)
            .addScaledVector(north, v)
            .normalize()
            .multiplyScalar(r);
          pos.push(p.x, p.y, p.z);
          data.push(
            rowSeed * 0.999,
            0.85 + rand() * 0.15,
            pi === 0 ? 1.6 : 1.25,
            0.6 + rand() * 0.4,
          );
          kind.push(1);
        }
      }
    });

    const plane = new PlaneGeometry(1, 1);
    const digitGeo = new InstancedBufferGeometry();
    digitGeo.index = plane.index;
    digitGeo.setAttribute("position", plane.getAttribute("position"));
    digitGeo.setAttribute("uv", plane.getAttribute("uv"));
    digitGeo.setAttribute(
      "iPos",
      new InstancedBufferAttribute(new Float32Array(pos), 3),
    );
    digitGeo.setAttribute(
      "iData",
      new InstancedBufferAttribute(new Float32Array(data), 4),
    );
    digitGeo.setAttribute(
      "iKind",
      new InstancedBufferAttribute(new Float32Array(kind), 1),
    );
    digitGeo.instanceCount = kind.length;

    const digitMat = new ShaderMaterial({
      vertexShader: digitVertex,
      fragmentShader: digitFragment,
      uniforms: {
        uAtlas: { value: atlas },
        uTime: { value: 0 },
        uSize: { value: 0.0098 },
        uDefocus: { value: 0 },
        uPanelDefocus: { value: 0 },
        uBackFade: { value: 0.1 },
        uExposure: { value: 1 },
        uGain: { value: 1 },
        uPanelBoost: { value: 1 },
        uDeep: { value: colDeep },
        uMain: { value: colMain },
        uHot: { value: colHot },
      },
      transparent: true,
      depthWrite: false,
      depthTest: false,
      blending: AdditiveBlending,
    });
    const digits = new Mesh(digitGeo, digitMat);
    digits.frustumCulled = false;
    globe.add(digits);

    /* ---------------------------------------------------------------- */
    /* Atmosphere / hologram body                                        */
    /* ---------------------------------------------------------------- */
    const atmoMat = new ShaderMaterial({
      vertexShader: atmoVertex,
      fragmentShader: atmoFragment,
      uniforms: {
        uRim: { value: colRim },
        uFill: { value: colDeep.clone().multiplyScalar(0.22) },
        uExposure: { value: 1 },
        uRimStrength: { value: 0.32 },
      },
      transparent: true,
      depthWrite: false,
      depthTest: false,
      blending: AdditiveBlending,
    });
    const atmo = new Mesh(new SphereGeometry(1.004, 96, 64), atmoMat);
    globe.add(atmo);

    const halo = new Sprite(
      new SpriteMaterial({
        map: makeHaloTexture(pal.rim),
        transparent: true,
        depthWrite: false,
        depthTest: false,
        blending: AdditiveBlending,
      }),
    );
    halo.scale.set(3.0, 3.0, 1);
    scene.add(halo);

    /* ---------------------------------------------------------------- */
    /* Network ("plexus") on and around the globe                        */
    /* ---------------------------------------------------------------- */
    const nodes: Vector3[] = [];
    for (let i = 0; i < 300; i++) {
      const u = rand() * 2 - 1;
      const th = rand() * Math.PI * 2;
      const s = Math.sqrt(1 - u * u);
      nodes.push(
        new Vector3(s * Math.cos(th), u, s * Math.sin(th)).multiplyScalar(
          1.012,
        ),
      );
    }
    // A handful of nodes float off the surface, pulling lines into space.
    for (let i = 0; i < 9; i++) {
      const u = rand() * 1.2 - 0.6;
      const th = rand() * Math.PI * 2;
      const s = Math.sqrt(1 - u * u);
      const r = 1.18 + rand() * 0.35;
      nodes.push(
        new Vector3(s * Math.cos(th), u, s * Math.sin(th)).multiplyScalar(r),
      );
    }
    const edges: [number, number][] = [];
    const seen = new Set<string>();
    nodes.forEach((a, i) => {
      const near = nodes
        .map((b, j) => ({ j, d: a.distanceTo(b) }))
        .filter((e) => e.j !== i)
        .sort((x, y) => x.d - y.d)
        .slice(0, i >= 300 ? 2 : 3);
      near.forEach(({ j, d }) => {
        if (d > (i >= 300 || j >= 300 ? 0.6 : 0.3)) return;
        const key = i < j ? `${i}-${j}` : `${j}-${i}`;
        if (seen.has(key)) return;
        seen.add(key);
        edges.push([i, j]);
      });
    });
    const linePos = new Float32Array(edges.length * 6);
    edges.forEach(([a, b], k) => {
      nodes[a].toArray(linePos, k * 6);
      nodes[b].toArray(linePos, k * 6 + 3);
    });
    const lineGeo = new LineSegmentsGeometry();
    lineGeo.setPositions(linePos);
    const lineCol = new Float32Array(edges.length * 6).fill(1);
    lineGeo.setColors(lineCol);
    const lineMat = new LineMaterial({
      color: 0xffffff,
      linewidth: 1.5 * pxScale,
      vertexColors: true,
      transparent: true,
      depthWrite: false,
      depthTest: false,
      blending: AdditiveBlending,
      opacity: 0.6,
    });
    lineMat.resolution.set(width * pixelRatio, height * pixelRatio);
    const lines = new LineSegments2(lineGeo, lineMat);
    lines.frustumCulled = false;
    globe.add(lines);
    const colorStart = lineGeo.getAttribute(
      "instanceColorStart",
    ) as unknown as {
      data: { array: Float32Array; needsUpdate: boolean };
    };

    const makePointMaterial = (occlusion: number, surface: number) =>
      new ShaderMaterial({
        vertexShader: pointVertex,
        fragmentShader: pointFragment,
        uniforms: {
          uPx: { value: pxScale },
          uTime: { value: 0 },
          uExposure: { value: 1 },
          uOcclusion: { value: occlusion },
          uSurface: { value: surface },
          uDeep: { value: colDeep },
          uMain: { value: colMain },
          uHot: { value: colHot },
        },
        transparent: true,
        depthWrite: false,
        depthTest: false,
        blending: AdditiveBlending,
      });

    const nodeGeo = new BufferGeometry();
    nodeGeo.setAttribute(
      "position",
      new BufferAttribute(
        new Float32Array(nodes.flatMap((n) => n.toArray())),
        3,
      ),
    );
    nodeGeo.setAttribute(
      "aSize",
      new BufferAttribute(new Float32Array(nodes.map(() => 3 + rand() * 4)), 1),
    );
    nodeGeo.setAttribute(
      "aBright",
      new BufferAttribute(
        new Float32Array(nodes.map(() => 0.6 + rand() * 0.4)),
        1,
      ),
    );
    nodeGeo.setAttribute(
      "aLevel",
      new BufferAttribute(new Float32Array(nodes.map(() => 0.9)), 1),
    );
    const nodeMat = makePointMaterial(1, 0);
    const nodePoints = new Points(nodeGeo, nodeMat);
    nodePoints.frustumCulled = false;
    globe.add(nodePoints);

    /* ---------------------------------------------------------------- */
    /* Orbital rings of particles                                        */
    /* ---------------------------------------------------------------- */
    type RingDef = {
      r: number;
      tx: number;
      tz: number;
      speed: number;
      lanes: number;
      density: number;
    };
    const ringDefs: RingDef[] = [
      { r: 1.22, tx: -6, tz: 6, speed: 14, lanes: 2, density: 0.55 },
      { r: 1.34, tx: 4, tz: -3, speed: -9, lanes: 3, density: 0.7 },
      { r: 1.47, tx: -2, tz: 4, speed: 11, lanes: 2, density: 0.6 },
      { r: 1.6, tx: 6, tz: 1, speed: -6, lanes: 3, density: 0.75 },
      { r: 1.74, tx: -4, tz: -5, speed: 7, lanes: 2, density: 0.55 },
      { r: 1.88, tx: 2, tz: 6, speed: -4, lanes: 2, density: 0.5 },
    ];
    const ringMat = makePointMaterial(1, 0);
    const ringSpinners: { obj: Group; speed: number; phase: number }[] = [];
    const ringRoot = new Group();
    ringRoot.rotation.z = -6 * DEG;
    scene.add(ringRoot);
    ringDefs.forEach((def, ri) => {
      const tiltG = new Group();
      tiltG.rotation.set(def.tx * DEG, 0, def.tz * DEG);
      const spinG = new Group();
      tiltG.add(spinG);
      ringRoot.add(tiltG);
      const p: number[] = [];
      const sz: number[] = [];
      const br: number[] = [];
      const lv: number[] = [];
      const N = 2600;
      // Dash pattern: a few bright arcs and many short dotted dashes.
      const arcSeeds = Array.from({ length: 7 }, () => [
        rand() * Math.PI * 2,
        0.3 + rand() * 0.9,
      ]);
      for (let lane = 0; lane < def.lanes; lane++) {
        const lr = def.r + (lane - (def.lanes - 1) / 2) * 0.016;
        for (let i = 0; i < N; i++) {
          const a = (i / N) * Math.PI * 2 + rand() * 0.002;
          const dash =
            Math.sin(a * 37 + ri * 3 + lane) * 0.5 +
            Math.sin(a * 11 + ri) * 0.5;
          let inArc = false;
          for (const [s, len] of arcSeeds) {
            const d = Math.abs(
              ((a - s + Math.PI * 3) % (Math.PI * 2)) - Math.PI,
            );
            if (d < len / 2) inArc = true;
          }
          const keep = inArc
            ? rand() < 0.95
            : dash > 0.35 - def.density * 0.6 && rand() < 0.6;
          if (!keep) continue;
          const rr = lr + (rand() - 0.5) * 0.006;
          p.push(rr * Math.cos(a), (rand() - 0.5) * 0.004, rr * Math.sin(a));
          sz.push(inArc ? 2.4 + rand() * 1.2 : 1.8 + rand() * 1.6);
          br.push(inArc ? 0.6 + rand() * 0.3 : 0.32 + rand() * 0.35);
          lv.push(inArc ? 0.62 + rand() * 0.25 : 0.45 + rand() * 0.25);
        }
      }
      const g = new BufferGeometry();
      g.setAttribute("position", new BufferAttribute(new Float32Array(p), 3));
      g.setAttribute("aSize", new BufferAttribute(new Float32Array(sz), 1));
      g.setAttribute("aBright", new BufferAttribute(new Float32Array(br), 1));
      g.setAttribute("aLevel", new BufferAttribute(new Float32Array(lv), 1));
      const pts = new Points(g, ringMat);
      pts.frustumCulled = false;
      spinG.add(pts);
      ringSpinners.push({ obj: spinG, speed: def.speed, phase: rand() * 360 });
    });

    /* ---------------------------------------------------------------- */
    /* Floating binary labels riding the rings                           */
    /* ---------------------------------------------------------------- */
    const labelAnchors: number[] = [];
    const labelChars: number[] = [];
    const LABELS = 22;
    for (let l = 0; l < LABELS; l++) {
      // Stratified angles keep read-outs from piling on top of each other.
      const a = ((l + 0.2 + rand() * 0.6) / LABELS) * Math.PI * 2 * 2.0;
      const r = l % 3 !== 2 ? 1.04 + rand() * 0.2 : 1.3 + rand() * 0.35;
      const y = (rand() - 0.5) * (r < 1.3 ? 1.5 : 0.3);
      const anchor = new Vector3(r * Math.cos(a), y, r * Math.sin(a));
      const len = 7 + Math.floor(rand() * 2);
      const labelSeed = rand();
      const bright = 0.9 + rand() * 0.1;
      for (let c = 0; c < len; c++) {
        labelAnchors.push(anchor.x, anchor.y, anchor.z);
        labelChars.push(c - len / 2, rand(), labelSeed, bright);
      }
    }
    const labelGeo = new InstancedBufferGeometry();
    labelGeo.index = plane.index;
    labelGeo.setAttribute("position", plane.getAttribute("position"));
    labelGeo.setAttribute("uv", plane.getAttribute("uv"));
    labelGeo.setAttribute(
      "iAnchor",
      new InstancedBufferAttribute(new Float32Array(labelAnchors), 3),
    );
    labelGeo.setAttribute(
      "iChar",
      new InstancedBufferAttribute(new Float32Array(labelChars), 4),
    );
    labelGeo.instanceCount = labelChars.length / 4;
    const labelMat = new ShaderMaterial({
      vertexShader: labelVertex,
      fragmentShader: labelFragment,
      uniforms: {
        uAtlas: { value: atlas },
        uTime: { value: 0 },
        uCharH: { value: 0.054 },
        uExposure: { value: 1 },
        uHot: { value: colHot },
      },
      transparent: true,
      depthWrite: false,
      depthTest: false,
      blending: AdditiveBlending,
    });
    const labels = new Mesh(labelGeo, labelMat);
    labels.frustumCulled = false;
    const labelSpin = new Group();
    labelSpin.add(labels);
    ringRoot.add(labelSpin);

    /* ---------------------------------------------------------------- */
    /* Background dust                                                   */
    /* ---------------------------------------------------------------- */
    const dustP: number[] = [];
    const dustS: number[] = [];
    const dustB: number[] = [];
    const dustL: number[] = [];
    for (let i = 0; i < 1800; i++) {
      const u = rand() * 2 - 1;
      const th = rand() * Math.PI * 2;
      const s = Math.sqrt(1 - u * u);
      const r = 3 + rand() * 14;
      dustP.push(r * s * Math.cos(th), r * u, r * s * Math.sin(th));
      dustS.push(1.2 + rand() * 2.2);
      dustB.push(0.08 + rand() * 0.3);
      dustL.push(0.3 + rand() * 0.5);
    }
    const dustGeo = new BufferGeometry();
    dustGeo.setAttribute(
      "position",
      new BufferAttribute(new Float32Array(dustP), 3),
    );
    dustGeo.setAttribute(
      "aSize",
      new BufferAttribute(new Float32Array(dustS), 1),
    );
    dustGeo.setAttribute(
      "aBright",
      new BufferAttribute(new Float32Array(dustB), 1),
    );
    dustGeo.setAttribute(
      "aLevel",
      new BufferAttribute(new Float32Array(dustL), 1),
    );
    const dustMat = makePointMaterial(1, 0);
    const dust = new Points(dustGeo, dustMat);
    dust.frustumCulled = false;
    scene.add(dust);

    /* ---------------------------------------------------------------- */
    /* Post: bloom + sRGB output                                          */
    /* ---------------------------------------------------------------- */
    const target = new WebGLRenderTarget(
      width * pixelRatio,
      height * pixelRatio,
      {
        type: HalfFloatType,
        samples: 4,
      },
    );
    const composer = new EffectComposer(renderer, target);
    composer.setPixelRatio(pixelRatio);
    composer.setSize(width, height);
    composer.addPass(new RenderPass(scene, camera));
    const bloom = new UnrealBloomPass(
      new Vector2(width * pixelRatio, height * pixelRatio),
      0.62,
      0.4,
      0.22,
    );
    composer.addPass(bloom);
    composer.addPass(new OutputPass());

    // Spin is integrated from its rate so it is exact for any frame order.
    const tmpA = new Vector3();
    const tmpB = new Vector3();
    const camDir = new Vector3();

    const render = (frame: number) => {
      const t = frame / fps;
      const cam = config.camera(t);

      globe.rotation.y = config.spin(t) * DEG;
      ringSpinners.forEach((r) => {
        r.obj.rotation.y = (r.phase + r.speed * t) * DEG;
      });
      labelSpin.rotation.y = 8 * t * DEG;
      dust.rotation.y = 1.2 * t * DEG;

      const az = cam.azimuth * DEG;
      const el = cam.elevation * DEG;
      camDir.set(
        Math.sin(az) * Math.cos(el),
        Math.sin(el),
        Math.cos(az) * Math.cos(el),
      );
      camera.position.copy(camDir).multiplyScalar(cam.distance);
      camera.up.set(0, 1, 0);
      camera.lookAt(0, cam.lookY, 0);
      camera.rotateZ(cam.roll * DEG);
      camera.updateMatrixWorld();

      const exposure = cam.exposure;
      const panelDefocus = clamp(smoothstep(2.9, 1.7, cam.distance) * 0.9);
      const u = digitMat.uniforms;
      u.uTime.value = t;
      u.uDefocus.value = cam.defocus;
      u.uPanelDefocus.value = panelDefocus;
      u.uExposure.value = exposure;
      // Tiny far-away glyphs lose ink to mip-mapping; compensate so the
      // continents read as solid bright dot fields like the reference.
      u.uGain.value = 1 + 3.2 * smoothstep(1.15, 2.8, cam.distance);
      // The reference's "glow burst" (~1.8-2.8 s): floating data panels flare
      // up while the camera is mid-way out of the dive.
      u.uPanelBoost.value =
        1 +
        2.2 *
          smoothstep(1.45, 1.85, cam.distance) *
          (1 - smoothstep(2.5, 3.3, cam.distance));
      // Back hemisphere fades out entirely when we're skimming the surface.
      u.uBackFade.value = 0.1 * smoothstep(1.3, 2.2, cam.distance);
      labelMat.uniforms.uTime.value = t;
      labelMat.uniforms.uExposure.value =
        exposure * smoothstep(1.45, 2.3, cam.distance);
      atmoMat.uniforms.uExposure.value =
        exposure * (0.35 + 0.65 * smoothstep(1.2, 2.5, cam.distance));
      halo.material.opacity =
        0.45 * exposure * smoothstep(2.2, 4.0, cam.distance);
      for (const m of [ringMat, nodeMat, dustMat]) {
        m.uniforms.uTime.value = t;
        m.uniforms.uExposure.value = exposure;
      }
      const ringsByDistance = smoothstep(1.7, 3.2, cam.distance);
      const ringsByTime =
        config.ringsCloseFrom === undefined
          ? 0
          : smoothstep(config.ringsCloseFrom, config.ringsCloseFrom + 1.5, t);
      ringMat.uniforms.uExposure.value =
        exposure * Math.max(ringsByDistance, ringsByTime);

      // Per-vertex line brightness: fade lines on the far hemisphere.
      globe.updateMatrixWorld(true);
      const arr = colorStart.data.array;
      const fade = (v: Vector3) => {
        tmpA.copy(v).applyMatrix4(globe.matrixWorld);
        const len = tmpA.length();
        if (len > 1.1) {
          // Floating node: dim only if hidden behind the planet.
          tmpB.copy(camera.position).sub(tmpA).normalize();
          const toC = camera.position.clone();
          const b = toC.dot(tmpB.clone().negate());
          const c = toC.lengthSq() - 1;
          const h = b * b - c;
          const L = camera.position.distanceTo(tmpA);
          const tHit = -b - Math.sqrt(Math.max(h, 0));
          return h > 0 && tHit > 0 && tHit < L ? 0.15 : 1;
        }
        tmpB.copy(camera.position).sub(tmpA).normalize();
        const facing = tmpA.normalize().dot(tmpB);
        return 0.12 + 0.88 * smoothstep(-0.05, 0.25, facing);
      };
      const nodeFade = nodes.map(fade);
      const lineGain =
        exposure * (0.25 + 0.75 * smoothstep(1.2, 2.4, cam.distance));
      edges.forEach(([a, b], k) => {
        const fa = nodeFade[a] * lineGain;
        const fb = nodeFade[b] * lineGain;
        arr[k * 6 + 0] = colMain.r * fa;
        arr[k * 6 + 1] = colMain.g * fa;
        arr[k * 6 + 2] = colMain.b * fa;
        arr[k * 6 + 3] = colMain.r * fb;
        arr[k * 6 + 4] = colMain.g * fb;
        arr[k * 6 + 5] = colMain.b * fb;
      });
      colorStart.data.needsUpdate = true;

      composer.render();
    };

    return {
      render,
      dispose: () => {
        composer.dispose();
        atlas.dispose();
        digitGeo.dispose();
        digitMat.dispose();
      },
    };
  };
