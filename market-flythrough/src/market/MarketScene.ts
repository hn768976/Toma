import {
  AdditiveBlending,
  Color,
  FogExp2,
  HalfFloatType,
  InstancedMesh,
  Material,
  Mesh,
  MeshBasicMaterial,
  Object3D,
  PerspectiveCamera,
  PlaneGeometry,
  Scene,
  Sprite,
  SpriteMaterial,
  Texture,
  Vector2,
  Vector3,
  WebGLRenderTarget,
} from "three";
import { EffectComposer } from "three/examples/jsm/postprocessing/EffectComposer.js";
import { OutputPass } from "three/examples/jsm/postprocessing/OutputPass.js";
import { RenderPass } from "three/examples/jsm/postprocessing/RenderPass.js";
import { UnrealBloomPass } from "three/examples/jsm/postprocessing/UnrealBloomPass.js";
import { Line2 } from "three/examples/jsm/lines/Line2.js";
import { LineGeometry } from "three/examples/jsm/lines/LineGeometry.js";
import { LineMaterial } from "three/examples/jsm/lines/LineMaterial.js";
import { LineSegments2 } from "three/examples/jsm/lines/LineSegments2.js";
import { LineSegmentsGeometry } from "three/examples/jsm/lines/LineSegmentsGeometry.js";
import { staticFile } from "remotion";
import type { SceneFactory } from "../three/ThreeStage";
import { clamp, loadFont, makeRandom, smoothstep, track } from "../three/util";
import { marketCamera, type MarketPalette } from "./config";
import {
  FONT,
  makeCandleTexture,
  makeFlareTexture,
  makeGlowTexture,
  makeTableTexture,
  type TableSpec,
} from "./textures";

const DEG = Math.PI / 180;

type Fader = (t: number) => number;
const always: Fader = () => 1;
/** Visible from `a` (fade-in over `fi`), until `b` (fade-out over `fo`). */
const window_ =
  (a: number, fi: number, b: number, fo: number): Fader =>
  (t) =>
    smoothstep(a, a + fi, t) * (1 - smoothstep(b, b + fo, t));

/** Random walk that trends upward, normalised to [0,1] x [0,1]. */
const makeSeries = (
  n: number,
  rand: () => number,
  vol: number,
  drift: number,
) => {
  const ys: number[] = [];
  let v = 0;
  let mom = 0;
  for (let i = 0; i < n; i++) {
    mom = mom * 0.7 + (rand() - 0.46) * vol;
    v += drift + mom + (rand() - 0.5) * vol * 1.6;
    ys.push(v);
  }
  const lo = Math.min(...ys);
  const hi = Math.max(...ys);
  return ys.map((y, i) => [i / (n - 1), (y - lo) / (hi - lo)] as const);
};

export const createMarketScene =
  (palette: MarketPalette): SceneFactory =>
  async (ctx) => {
    const { renderer, width, height, pixelRatio, pxScale, fps } = ctx;
    await loadFont(FONT, staticFile("fonts/Oswald-Regular.woff2"));
    const rand = makeRandom(918732336);

    const colMain = new Color(palette.main);
    const colHot = new Color(palette.hot);
    const colGlow = new Color(palette.glow);
    const colLine = colHot.clone().lerp(colMain, 0.55);

    const scene = new Scene();
    scene.background = new Color(palette.background);
    // Additive layers fade toward black with distance.
    scene.fog = new FogExp2(0x000000, 0.03);

    const camera = new PerspectiveCamera(45, width / height, 0.02, 200);
    scene.add(camera);

    const bufW = width * pixelRatio;
    const bufH = height * pixelRatio;
    const faders: {
      mat: Material & { opacity: number };
      base: number;
      fade: Fader;
    }[] = [];
    const register = <M extends Material & { opacity: number }>(
      mat: M,
      fade: Fader,
    ) => {
      faders.push({ mat, base: mat.opacity, fade });
      return mat;
    };

    /* ------------------------------------------------------------- */
    /* Ticker tables and candlesticks                                 */
    /* ------------------------------------------------------------- */
    const plane = new PlaneGeometry(1, 1);
    const addPanel = (
      tex: Texture,
      aspect: number,
      center: [number, number, number],
      h: number,
      opacity: number,
      fade: Fader = always,
      rotY = 0,
      color: Color = colMain,
    ) => {
      const mat = new MeshBasicMaterial({
        map: tex,
        color,
        transparent: true,
        opacity,
        blending: AdditiveBlending,
        depthWrite: false,
        depthTest: false,
        fog: true,
      });
      const m = new Mesh(plane, mat);
      m.scale.set(h * aspect, h, 1);
      m.position.set(...center);
      m.rotation.y = rotY * DEG;
      scene.add(m);
      register(mat, fade);
      return m;
    };
    const TABLE_GAIN = 1.45;
    const addTable = (
      spec: TableSpec,
      center: [number, number, number],
      h: number,
      opacity: number,
      fade: Fader = always,
      rotY = 0,
    ) => {
      const { texture, aspect } = makeTableTexture(spec, rand);
      return addPanel(
        texture,
        aspect,
        center,
        h,
        Math.min(1, opacity * TABLE_GAIN),
        fade,
        rotY,
      );
    };

    const fadeC = window_(-1, 0.1, 10.3, 1.6);

    // Cluster A - opening.
    addTable({ rows: 6, columns: 5, rowPx: 64 }, [-4.4, 2.9, -3.5], 1.5, 0.55);
    addTable({ rows: 5, columns: 4, rowPx: 64 }, [-0.4, 3.3, -6.5], 1.3, 0.45);
    addTable({ rows: 4, columns: 5, rowPx: 64 }, [3.2, 3.4, -9], 1.1, 0.4);
    addTable({ rows: 7, columns: 5, rowPx: 64 }, [-3.4, -2.5, -2.4], 1.9, 0.5);
    addTable({ rows: 6, columns: 3, rowPx: 64 }, [4.3, -2.3, -3.2], 1.5, 0.45);
    // The table we fly into (high resolution for the macro shot).
    addTable(
      { rows: 13, columns: 5, rowPx: 150 },
      [7.8, 0.85, -1.0],
      3.2,
      0.85,
    );
    addTable({ rows: 9, columns: 5, rowPx: 64 }, [11.5, 1.2, -3.0], 2.4, 0.5);
    const candA = makeCandleTexture(46, rand);
    addPanel(candA.texture, candA.aspect, [2.6, -1.9, -1.6], 2.1, 1);

    // Cluster B - behind the big table.
    addTable({ rows: 6, columns: 5, rowPx: 64 }, [6.8, 1.9, -7.8], 1.6, 0.5);
    addTable({ rows: 8, columns: 4, rowPx: 64 }, [-1.5, 2.2, -9.5], 2.0, 0.45);
    addTable({ rows: 6, columns: 5, rowPx: 64 }, [7.4, -1.6, -9.0], 1.6, 0.5);

    // Cluster C - the medium shot.
    addTable(
      { rows: 10, columns: 5, rowPx: 80 },
      [0.6, -2.2, -18.5],
      2.6,
      0.6,
      fadeC,
    );
    addTable(
      { rows: 9, columns: 4, rowPx: 80 },
      [5.0, -1.8, -19.2],
      2.4,
      0.55,
      fadeC,
    );
    addTable(
      { rows: 6, columns: 5, rowPx: 64 },
      [-3.8, 2.2, -21.5],
      1.6,
      0.4,
      fadeC,
    );
    addTable(
      { rows: 5, columns: 5, rowPx: 64 },
      [3.5, 2.8, -23],
      1.3,
      0.35,
      fadeC,
    );
    const candC = makeCandleTexture(40, rand);
    addPanel(candC.texture, candC.aspect, [0.9, -1.6, -15.4], 2.1, 1, fadeC);

    // Faint ticker "walls" high in the background, as in the reference.
    for (let i = 0; i < 7; i++) {
      addTable(
        { rows: 8, columns: 5, rowPx: 48 },
        [-9 + i * 3.3 + rand() * 0.8, 4.6 + rand() * 1.2, -13 - rand() * 14],
        2.6,
        0.32,
      );
    }
    for (let i = 0; i < 5; i++) {
      addTable(
        { rows: 7, columns: 5, rowPx: 48 },
        [-7 + i * 3.6 + rand(), -4.6 - rand(), -24 - rand() * 12],
        2.2,
        0.3,
      );
    }

    // Cluster D - far away, revealed at the end like the opening frame.
    addTable({ rows: 6, columns: 5, rowPx: 64 }, [-4.5, 2.4, -44], 1.8, 0.5);
    addTable({ rows: 5, columns: 5, rowPx: 64 }, [3.6, 1.6, -45], 1.6, 0.45);
    addTable({ rows: 4, columns: 5, rowPx: 64 }, [-0.6, -1.2, -43], 1.2, 0.35);

    /* ------------------------------------------------------------- */
    /* Line charts                                                    */
    /* ------------------------------------------------------------- */
    type ChartDef = {
      origin: [number, number, number];
      u: [number, number, number];
      v: [number, number, number];
      n: number;
      width: number;
      led: boolean;
      opacity: number;
      progress: (t: number) => number;
      fade?: Fader;
      vol?: number;
    };
    const charts: {
      lines: Line2[];
      segs: number;
      progress: (t: number) => number;
    }[] = [];
    const lineMats: LineMaterial[] = [];
    const addChart = (def: ChartDef) => {
      const series = makeSeries(def.n, rand, def.vol ?? 0.06, 0.02);
      const o = new Vector3(...def.origin);
      const u = new Vector3(...def.u);
      const v = new Vector3(...def.v);
      const pts: number[] = [];
      series.forEach(([x, y]) => {
        const p = o.clone().addScaledVector(u, x).addScaledVector(v, y);
        pts.push(p.x, p.y, p.z);
      });
      const geo = new LineGeometry();
      geo.setPositions(pts);
      const mk = (
        lw: number,
        dashed: boolean,
        color: Color,
        opacity: number,
      ) => {
        const mat = new LineMaterial({
          color,
          linewidth: lw,
          worldUnits: true,
          dashed,
          dashSize: lw * 0.75,
          gapSize: lw * 0.35,
          transparent: true,
          opacity,
          blending: AdditiveBlending,
          depthWrite: false,
          depthTest: false,
        });
        mat.fog = true;
        mat.resolution.set(bufW, bufH);
        lineMats.push(mat);
        register(mat, def.fade ?? always);
        const line = new Line2(geo, mat);
        line.computeLineDistances();
        line.frustumCulled = false;
        scene.add(line);
        return line;
      };
      const lines = [mk(def.width, def.led, colLine, def.opacity)];
      charts.push({ lines, segs: def.n - 1, progress: def.progress });
    };

    const grow =
      (a: number, b: number, from = 0) =>
      (t: number) =>
        from + (1 - from) * smoothstep(a, b, t);

    addChart({
      origin: [-5.6, -2.7, 0],
      u: [9.4, 0, 0],
      v: [0, 5.0, 0],
      n: 420,
      width: 0.07,
      led: true,
      opacity: 1,
      progress: grow(-0.2, 4.6, 0.3),
    });
    addChart({
      origin: [-5.2, -2.2, -0.9],
      u: [8.8, 0, 0],
      v: [0, 3.0, 0],
      n: 200,
      width: 0.035,
      led: false,
      opacity: 0.7,
      progress: grow(0.2, 5.0, 0.35),
      vol: 0.09,
    });
    addChart({
      origin: [-2.2, -3.0, -5.6],
      u: [7.4, 0, 0],
      v: [0, 3.6, 0],
      n: 200,
      width: 0.065,
      led: true,
      opacity: 1,
      progress: grow(5.2, 7.5, 0.25),
    });
    addChart({
      origin: [-7.8, -2.4, -16.8],
      u: [8.6, 0, 1.6],
      v: [0, 6.6, 0],
      n: 400,
      width: 0.07,
      led: true,
      opacity: 1,
      progress: grow(7.0, 10.4, 0.3),
      fade: window_(-1, 0.1, 11.2, 1.4),
    });
    addChart({
      origin: [-6.0, -1.6, -18.0],
      u: [9.5, 0, 0.8],
      v: [0, 3.4, 0],
      n: 200,
      width: 0.035,
      led: false,
      opacity: 0.65,
      progress: grow(7.4, 10.6, 0.3),
      fade: window_(-1, 0.1, 10.6, 1.4),
      vol: 0.09,
    });
    addChart({
      origin: [-3.4, -1.7, -40],
      u: [6.6, 0, 0],
      v: [0, 3.2, 0],
      n: 200,
      width: 0.06,
      led: false,
      opacity: 1,
      progress: grow(10.5, 13.3, 0.45),
    });

    /* ------------------------------------------------------------- */
    /* Plexus network + lens flares                                    */
    /* ------------------------------------------------------------- */
    const nodes: Vector3[] = [];
    for (let i = 0; i < 60; i++) {
      nodes.push(
        new Vector3(-11 + rand() * 24, -5.5 + rand() * 11, -48 + rand() * 60),
      );
    }
    const edges: [number, number][] = [];
    const seen = new Set<string>();
    nodes.forEach((a, i) => {
      nodes
        .map((b, j) => ({ j, d: a.distanceTo(b) }))
        .filter((e) => e.j !== i && e.d < 10)
        .sort((x, y) => x.d - y.d)
        .slice(0, 2)
        .forEach(({ j }) => {
          const key = i < j ? `${i}-${j}` : `${j}-${i}`;
          if (!seen.has(key)) {
            seen.add(key);
            edges.push([i, j]);
          }
        });
    });
    const segPos = new Float32Array(edges.length * 6);
    edges.forEach(([a, b], k) => {
      nodes[a].toArray(segPos, k * 6);
      nodes[b].toArray(segPos, k * 6 + 3);
    });
    const netGeo = new LineSegmentsGeometry();
    netGeo.setPositions(segPos);
    netGeo.setColors(new Float32Array(edges.length * 6).fill(1));
    const netMat = new LineMaterial({
      color: 0xffffff,
      linewidth: 2.0 * pxScale,
      vertexColors: true,
      transparent: true,
      opacity: 1,
      blending: AdditiveBlending,
      depthWrite: false,
      depthTest: false,
    });
    netMat.resolution.set(bufW, bufH);
    const net = new LineSegments2(netGeo, netMat);
    net.frustumCulled = false;
    scene.add(net);
    const netColors = netGeo.getAttribute("instanceColorStart") as unknown as {
      data: { array: Float32Array; needsUpdate: boolean };
    };

    const flareTex = makeFlareTexture();
    const flares: { s: Sprite; base: number; phase: number; node: number }[] =
      [];
    nodes.forEach((n, i) => {
      if (rand() > 0.4) return;
      const hero = rand() < 0.18;
      const mat = new SpriteMaterial({
        map: flareTex,
        color: hero
          ? colMain.clone().lerp(colHot, 0.45)
          : colMain.clone().lerp(colHot, 0.2),
        transparent: true,
        blending: AdditiveBlending,
        depthWrite: false,
        depthTest: false,
        fog: true,
        opacity: hero ? 1 : 0.75,
      });
      const s = new Sprite(mat);
      s.position.copy(n);
      const base = hero ? 2.6 + rand() * 1.4 : 0.6 + rand() * 0.9;
      s.scale.set(base, base, 1);
      scene.add(s);
      flares.push({ s, base, phase: rand() * Math.PI * 2, node: i });
    });

    /* ------------------------------------------------------------- */
    /* Floating data bits                                             */
    /* ------------------------------------------------------------- */
    const BITS = 200;
    const bitMat = new MeshBasicMaterial({
      color: colMain,
      transparent: true,
      opacity: 0.8,
      blending: AdditiveBlending,
      depthWrite: false,
      depthTest: false,
      fog: true,
    });
    const bits = new InstancedMesh(plane, bitMat, BITS);
    const dummy = new Object3D();
    for (let i = 0; i < BITS; i++) {
      dummy.position.set(
        -10 + rand() * 22,
        -5 + rand() * 10,
        -46 + rand() * 58,
      );
      const w = 0.05 + rand() * 0.16;
      dummy.scale.set(w, w * (0.35 + rand() * 0.25), 1);
      dummy.updateMatrix();
      bits.setMatrixAt(i, dummy.matrix);
      bits.setColorAt(
        i,
        colMain
          .clone()
          .lerp(colHot, rand() * 0.6)
          .multiplyScalar(0.4 + rand() * 0.6),
      );
    }
    bits.frustumCulled = false;
    scene.add(bits);

    /* ------------------------------------------------------------- */
    /* Centre glow (camera-locked) + bloom                            */
    /* ------------------------------------------------------------- */
    const glowMat = new SpriteMaterial({
      map: makeGlowTexture(),
      color: colGlow,
      transparent: true,
      blending: AdditiveBlending,
      depthWrite: false,
      depthTest: false,
      fog: false,
      opacity: 0.6,
    });
    const glow = new Sprite(glowMat);
    glow.position.set(0, -0.15, -5);
    glow.scale.set(13, 7.6, 1);
    glow.renderOrder = -1;
    camera.add(glow);
    const glowLevel = track([
      [0, 0.6],
      [3, 0.54],
      [6, 0.5],
      [8.5, 0.53],
      [10.7, 0.68],
      [12, 0.78],
      [13.34, 0.74],
    ]);

    const target = new WebGLRenderTarget(bufW, bufH, {
      type: HalfFloatType,
      samples: 4,
    });
    const composer = new EffectComposer(renderer, target);
    composer.setPixelRatio(pixelRatio);
    composer.setSize(width, height);
    composer.addPass(new RenderPass(scene, camera));
    composer.addPass(
      new UnrealBloomPass(new Vector2(bufW, bufH), 0.75, 0.6, 0.2),
    );
    composer.addPass(new OutputPass());

    const tmp = new Vector3();
    const fadeIn = track([
      [0, 1],
      [13.34, 1],
    ]);

    const render = (frame: number) => {
      const t = frame / fps;
      const cam = marketCamera(t);
      camera.position.set(...cam.pos);
      camera.up.set(0, 1, 0);
      camera.lookAt(...cam.look);
      camera.rotateZ(cam.roll * DEG);
      camera.updateMatrixWorld();

      const master = fadeIn(t);
      faders.forEach(({ mat, base, fade }) => {
        mat.opacity = base * fade(t) * master;
      });
      charts.forEach((c) => {
        const p = clamp(c.progress(t));
        const count = Math.max(1, Math.round(c.segs * p));
        c.lines.forEach((l) => {
          l.geometry.instanceCount = count;
        });
      });
      glowMat.opacity = Math.min(1, glowLevel(t) * master);

      // Network: fade with distance (fog) and very close to the lens.
      const arr = netColors.data.array;
      const fadeOf = (v: Vector3) => {
        const d = tmp.copy(v).sub(camera.position).length();
        const fog = Math.exp(-Math.pow(0.034 * d, 2));
        return fog * smoothstep(0.4, 2.5, d) * master;
      };
      const nf = nodes.map(fadeOf);
      edges.forEach(([a, b], k) => {
        const fa = nf[a] * 0.8;
        const fb = nf[b] * 0.8;
        arr[k * 6 + 0] = colMain.r * fa;
        arr[k * 6 + 1] = colMain.g * fa;
        arr[k * 6 + 2] = colMain.b * fa;
        arr[k * 6 + 3] = colMain.r * fb;
        arr[k * 6 + 4] = colMain.g * fb;
        arr[k * 6 + 5] = colMain.b * fb;
      });
      netColors.data.needsUpdate = true;

      flares.forEach((f) => {
        const pulse = 0.82 + 0.18 * Math.sin(t * 2.4 + f.phase);
        const s = f.base * pulse;
        f.s.scale.set(s, s, 1);
        const d = tmp.copy(f.s.position).sub(camera.position).length();
        f.s.material.opacity =
          (f.base > 2 ? 1 : 0.75) * master * smoothstep(0.6, 2.5, d);
      });
      bitMat.opacity = 0.8 * master;

      composer.render();
    };

    return {
      render,
      dispose: () => {
        composer.dispose();
        target.dispose();
      },
    };
  };
